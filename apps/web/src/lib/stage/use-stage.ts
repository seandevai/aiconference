'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';
import {
  emptyStage,
  followMessage,
  imageAssetIds,
  packAsset,
  parseStage,
  parseStageMessage,
  unpackAsset,
  writeCommand,
  type ImageMime,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import { commitStage } from './motion';
import { isFromHost } from './peek';

const PERSIST_DELAY_MS = 1_000;
const SYNC_THROTTLE_MS = 1_000;
const SYNC_RETRY_MS = 2_000;
const ASSET_RETRY_MS = 3_000;
const BORN_MS = 600;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type Options = {
  joinCode: string;
  role: 'host' | 'guest';
  session: RealtimeSession | null;
  roster: RosterEntry[];
};

export function useStage({ joinCode, role, session, roster }: Options) {
  const [stage, setStage] = useState<Stage>(emptyStage);
  const [ready, setReady] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const stageRef = useRef(stage);
  const rosterRef = useRef(roster);
  const assetsRef = useRef(new Map<string, { mime: ImageMime; bytes: Uint8Array }>());
  const urlsRef = useRef<string[]>([]);
  const requestedRef = useRef(new Map<string, number>());

  const hostIdentity = roster.find((e) => e.role === 'host' && !e.isLocal)?.identity ?? null;

  useEffect(() => {
    rosterRef.current = roster;
  }, [roster]);

  const [born, setBorn] = useState<string[]>([]);
  const bornTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  const markBorn = useCallback((ids: string[]) => {
    setBorn((current) => [...new Set([...current, ...ids])]);
    const timer = setTimeout(() => {
      bornTimersRef.current.delete(timer);
      setBorn((current) => current.filter((id) => !ids.includes(id)));
    }, BORN_MS);
    bornTimersRef.current.add(timer);
  }, []);

  useEffect(() => {
    const timers = bornTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const commit = useCallback(
    (next: Stage) => {
      const prev = stageRef.current;
      stageRef.current = next;
      commitStage({
        prev,
        next,
        doc: document,
        win: window,
        // Sempre l'ultimo stato: una View Transition può partire dopo un aggiornamento nuovo.
        render: () => setStage(stageRef.current),
        onBorn: markBorn,
      });
    },
    [markBorn],
  );

  const storeAsset = useCallback((assetId: string, mime: ImageMime, bytes: Uint8Array) => {
    if (assetsRef.current.has(assetId)) return;
    assetsRef.current.set(assetId, { mime, bytes });
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: mime }));
    urlsRef.current.push(url);
    setAssetUrls((current) => ({ ...current, [assetId]: url }));
  }, []);

  // Snapshot in KV: l'host riparte da lì, l'ospite lo usa solo se è più avanti di lui.
  useEffect(() => {
    let cancelled = false;
    void fetch(`/room/${joinCode}/stage`, { cache: 'no-store' })
      .then(async (response) =>
        response.status === 200
          ? parseStage(((await response.json()) as { stage?: unknown }).stage)
          : null,
      )
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        if (stored && (role === 'host' || stored.version > stageRef.current.version))
          commit(stored);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [joinCode, role, commit]);

  // L'host salva lo snapshot un secondo dopo l'ultimo cambiamento.
  useEffect(() => {
    if (role !== 'host' || !ready || stage.version === 0) return;
    const timer = setTimeout(() => {
      void fetch(`/room/${joinCode}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageRef.current),
      }).catch(() => {});
    }, PERSIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [role, ready, stage.version, joinCode]);

  // Host: risponde alle richieste di snapshot e di immagini, e si annuncia a ogni connessione.
  useEffect(() => {
    if (role !== 'host' || !session || !ready) return;
    const sendSnapshot = (to?: string[]) =>
      void session
        .sendBytes('stage-snapshot', encoder.encode(JSON.stringify(stageRef.current)), to)
        .catch(() => {});
    sendSnapshot();
    const offSync = session.onData('stage-sync', (_payload, from) => sendSnapshot([from]));
    const offAsset = session.onData('asset-request', (payload, from) => {
      const assetId = (payload as { assetId?: unknown } | null)?.assetId;
      const asset = typeof assetId === 'string' ? assetsRef.current.get(assetId) : undefined;
      if (!asset || typeof assetId !== 'string') return;
      void session
        .sendBytes('asset', packAsset({ assetId, mime: asset.mime }, asset.bytes), [from])
        .catch(() => {});
    });
    return () => {
      offSync();
      offAsset();
    };
  }, [role, session, ready]);

  // Ospite: accetta solo messaggi dell'host, chiede lo snapshot quando perde il filo.
  // Finché non ha ricevuto nulla dall'host ripete la richiesta: la prima può perdersi
  // se l'host non è ancora pronto o se il canale dati dell'ospite non è ancora aperto.
  useEffect(() => {
    if (role !== 'guest' || !session || !hostIdentity) return;
    let lastSync = 0;
    let synced = false;
    const requestSync = () => {
      const now = Date.now();
      if (now - lastSync < SYNC_THROTTLE_MS) return;
      lastSync = now;
      void session.sendData('stage-sync', {}, [hostIdentity]).catch(() => {});
    };
    const fromHost = (identity: string) => isFromHost(rosterRef.current, identity);

    const offCommand = session.onData('stage', (payload, from) => {
      if (!fromHost(from)) return;
      const message = parseStageMessage(payload);
      if (!message) return;
      const result = followMessage(stageRef.current, message);
      if (result.stage !== stageRef.current) commit(result.stage);
      if (result.outOfSync) requestSync();
      else synced = true;
    });
    const offSnapshot = session.onBytes('stage-snapshot', (bytes, from) => {
      if (!fromHost(from)) return;
      try {
        const snapshot = parseStage(JSON.parse(decoder.decode(bytes)));
        if (snapshot) {
          commit(snapshot);
          synced = true;
        }
      } catch {
        // Snapshot illeggibile: si aspetta il prossimo.
      }
    });
    const offAsset = session.onBytes('asset', (bytes, from) => {
      if (!fromHost(from)) return;
      const asset = unpackAsset(bytes);
      if (asset) storeAsset(asset.header.assetId, asset.header.mime, asset.bytes);
    });
    requestSync();
    const retry = setInterval(() => {
      if (!synced) requestSync();
    }, SYNC_RETRY_MS);
    return () => {
      clearInterval(retry);
      offCommand();
      offSnapshot();
      offAsset();
    };
  }, [role, session, hostIdentity, commit, storeAsset]);

  // Ospite: chiede all'host le immagini che il palco cita e che non ha ancora. Riprova
  // ogni pochi secondi: richiesta o risposta possono perdersi mentre il canale si apre.
  useEffect(() => {
    if (role !== 'guest' || !session || !hostIdentity) return;
    const requestMissing = () => {
      const now = Date.now();
      for (const assetId of imageAssetIds(stageRef.current)) {
        if (assetsRef.current.has(assetId)) continue;
        if (now - (requestedRef.current.get(assetId) ?? 0) < ASSET_RETRY_MS) continue;
        requestedRef.current.set(assetId, now);
        void session.sendData('asset-request', { assetId }, [hostIdentity]).catch(() => {});
      }
    };
    requestMissing();
    const retry = setInterval(requestMissing, ASSET_RETRY_MS);
    return () => clearInterval(retry);
  }, [role, session, hostIdentity, stage]);

  // I blob URL restano validi finché la pagina vive: si liberano all'uscita.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const dispatch = useCallback(
    (command: StageCommand) => {
      if (role !== 'host' || !ready) return;
      const result = writeCommand(stageRef.current, command);
      if (!result) return;
      commit(result.stage);
      // Se l'invio fallisce, gli ospiti vedranno un buco di versione e chiederanno lo snapshot.
      void session?.sendData('stage', result.message).catch(() => {});
    },
    [role, ready, session, commit],
  );

  const addImage = useCallback(
    (bytes: Uint8Array, mime: ImageMime, title: string, alt: string) => {
      const assetId = crypto.randomUUID();
      storeAsset(assetId, mime, bytes);
      void session?.sendBytes('asset', packAsset({ assetId, mime }, bytes)).catch(() => {});
      dispatch({
        type: 'TRAY_ADD',
        content: { id: crypto.randomUUID(), kind: 'image', data: { title, assetId, mime, alt } },
      });
    },
    [session, storeAsset, dispatch],
  );

  return { stage, ready, assetUrls, born, dispatch, addImage };
}
