'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectToRoom,
  createReconnector,
  type RealtimeSession,
  type Reconnector,
  type RosterEntry,
} from '@omnicanvas/realtime';
import {
  MEDIA_ERROR_MESSAGE,
  phaseAfterDisconnect,
  phaseFromStatus,
  tokenErrorPhase,
  type CallPhase,
} from './phase';

export type CallState = {
  phase: CallPhase;
  roster: RosterEntry[];
  audioBlocked: boolean;
  mediaError: string | null;
};

class TokenRefusedError extends Error {
  constructor(readonly status: number) {
    super(`room token refused with status ${status}`);
  }
}

async function fetchRoomToken(joinCode: string): Promise<{ url: string; token: string }> {
  const response = await fetch(`/room/${joinCode}/token`, { method: 'POST', cache: 'no-store' });
  // 4xx è una risposta definitiva: non ha senso riprovare. 5xx e rete sì.
  if (response.status >= 400 && response.status < 500) throw new TokenRefusedError(response.status);
  if (!response.ok) throw new Error(`room token failed with status ${response.status}`);
  return (await response.json()) as { url: string; token: string };
}

const initialState: CallState = {
  phase: 'connecting',
  roster: [],
  audioBlocked: false,
  mediaError: null,
};

export function useCall(joinCode: string) {
  const [state, setState] = useState<CallState>(initialState);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const reconnectorRef = useRef<Reconnector | null>(null);
  // Condiviso con leave(): chi esce mentre una connessione è in volo deve fermarla.
  const lifecycleRef = useRef<{ stopped: boolean } | null>(null);

  useEffect(() => {
    const lifecycle = { stopped: false };
    lifecycleRef.current = lifecycle;
    const patch = (next: Partial<CallState>) => {
      if (!lifecycle.stopped) setState((current) => ({ ...current, ...next }));
    };

    const connect = async (): Promise<void> => {
      patch({ phase: 'connecting' });
      let credentials: { url: string; token: string };
      try {
        credentials = await fetchRoomToken(joinCode);
      } catch (error) {
        if (error instanceof TokenRefusedError) {
          patch({ phase: tokenErrorPhase(error.status) });
          return;
        }
        throw error;
      }
      if (lifecycle.stopped) return;

      const session = await connectToRoom(credentials.url, credentials.token);
      if (lifecycle.stopped) {
        await session.disconnect();
        return;
      }
      sessionRef.current = session;
      session.onStatusChange((status) => {
        const phase = phaseFromStatus(status);
        if (phase) patch({ phase });
      });
      session.onRosterChange((roster) => patch({ roster }));
      session.onAudioBlockedChange((audioBlocked) => patch({ audioBlocked }));
      session.onDisconnected((cause) => {
        sessionRef.current = null;
        patch({ phase: phaseAfterDisconnect(cause) });
        reconnectorRef.current?.handleDisconnect(cause);
      });
      patch({
        phase: 'connected',
        roster: session.getRoster(),
        audioBlocked: session.isAudioBlocked(),
      });

      // Microfono e camera separati: se uno manca, l'altro funziona lo stesso.
      const results = await Promise.allSettled([
        session.setMicrophoneEnabled(true),
        session.setCameraEnabled(true),
      ]);
      patch({
        mediaError: results.some((r) => r.status === 'rejected') ? MEDIA_ERROR_MESSAGE : null,
      });
    };

    const reconnector = createReconnector({ connect, onGiveUp: () => patch({ phase: 'failed' }) });
    reconnectorRef.current = reconnector;
    connect().catch(() => reconnector.handleDisconnect('network'));

    return () => {
      lifecycle.stopped = true;
      reconnector.cancel();
      void sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
  }, [joinCode]);

  const local = state.roster.find((entry) => entry.isLocal);

  const toggleMic = useCallback(() => {
    sessionRef.current
      ?.setMicrophoneEnabled(!local?.micOn)
      .catch(() => setState((s) => ({ ...s, mediaError: MEDIA_ERROR_MESSAGE })));
  }, [local?.micOn]);

  const toggleCamera = useCallback(() => {
    sessionRef.current
      ?.setCameraEnabled(!local?.camOn)
      .catch(() => setState((s) => ({ ...s, mediaError: MEDIA_ERROR_MESSAGE })));
  }, [local?.camOn]);

  const startAudio = useCallback(() => {
    void sessionRef.current?.startAudio();
  }, []);

  const retry = useCallback(() => reconnectorRef.current?.retryNow(), []);

  const leave = useCallback(async () => {
    if (lifecycleRef.current) lifecycleRef.current.stopped = true;
    reconnectorRef.current?.cancel();
    await sessionRef.current?.disconnect();
    sessionRef.current = null;
    setState((s) => ({ ...s, phase: 'left', roster: [] }));
  }, []);

  const attachVideo = useCallback(
    (identity: string, element: HTMLVideoElement) =>
      sessionRef.current?.attachVideo(identity, element) ?? (() => {}),
    [],
  );

  return { state, toggleMic, toggleCamera, startAudio, retry, leave, attachVideo };
}
