'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  findScreen,
  screenEndCommands,
  screenStartCommands,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import { ScreenShareCancelled, type RealtimeSession } from '@omnicanvas/realtime';

export const SCREEN_SHARE_ERROR = 'Non riesco a condividere lo schermo.';
export const SCREEN_TRAY_FULL =
  'Il vassoio è pieno: togli qualche contenuto per condividere lo schermo.';
export const SCREEN_STOP_ERROR =
  'Non riesco a interrompere la condivisione: chiudila dalla barra del browser.';

const STOP_RETRY_MS = 1_000;

type Options = {
  session: RealtimeSession | null;
  role: 'host' | 'guest';
  stage: Stage;
  ready: boolean;
  dispatch: (command: StageCommand) => void;
  newId?: () => string;
};

const randomId = () => crypto.randomUUID();

export function useScreenShare({
  session,
  role,
  stage,
  ready,
  dispatch,
  newId = randomId,
}: Options) {
  // La sessione su cui si condivide: una sessione nuova (dopo una caduta) non condivide.
  const [sharedOn, setSharedOn] = useState<RealtimeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickingRef = useRef(false);
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  // Il selettore può chiudersi dopo un cambio di sessione o dopo l'uscita dalla call.
  const sessionRef = useRef(session);
  const mountedRef = useRef(true);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Lo stop può fallire mentre la connessione è instabile: un secondo tentativo, poi si
  // chiede di chiudere dalla barra del browser, che ferma comunque la cattura.
  const stopShare = useCallback((target: RealtimeSession) => {
    target.stopScreenShare().catch(() => {
      setTimeout(() => {
        target.stopScreenShare().catch(() => {
          if (mountedRef.current) setError(SCREEN_STOP_ERROR);
        });
      }, STOP_RETRY_MS);
    });
  }, []);

  const isHost = role === 'host';
  const sharing = session !== null && sharedOn === session;
  const available = isHost && session !== null && session.canShareScreen();

  useEffect(() => {
    if (!session || !isHost) return;
    return session.onScreenShareEnded(() =>
      setSharedOn((current) => (current === session ? null : current)),
    );
  }, [session, isHost]);

  // Invariante: lo schermo è sul palco se e solo se l'host condivide (spec §1).
  const onStage = findScreen(stage) !== null;
  useEffect(() => {
    if (!isHost || !ready) return;
    if (onStage && !sharing) screenEndCommands(stageRef.current).forEach(dispatch);
    if (!onStage && sharing && session) stopShare(session);
  }, [isHost, ready, onStage, sharing, session, dispatch, stopShare]);

  const start = useCallback(async () => {
    if (!session || !isHost || sharing || pickingRef.current) return;
    pickingRef.current = true;
    setError(null);
    try {
      await session.startScreenShare();
    } catch (cause) {
      if (!(cause instanceof ScreenShareCancelled)) setError(SCREEN_SHARE_ERROR);
      return;
    } finally {
      pickingRef.current = false;
    }
    // Cattura partita su una sessione che non è più quella della call: la si ferma subito.
    if (!mountedRef.current || sessionRef.current !== session) {
      void session.stopScreenShare().catch(() => {});
      return;
    }
    setSharedOn(session);
    const commands = screenStartCommands(stageRef.current, {
      owner: session.localIdentity,
      contentId: newId(),
      windowId: newId(),
    });
    // Nessun comando con lo schermo assente: il vassoio è pieno. L'invariante ferma la
    // condivisione, il messaggio dice perché.
    if (commands.length === 0 && !findScreen(stageRef.current)) setError(SCREEN_TRAY_FULL);
    commands.forEach(dispatch);
  }, [session, isHost, sharing, dispatch, newId]);

  const stop = useCallback(() => {
    if (session) stopShare(session);
  }, [session, stopShare]);

  return { available, sharing, error, start, stop };
}
