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
    if (!onStage && sharing) void session?.stopScreenShare().catch(() => {});
  }, [isHost, ready, onStage, sharing, session, dispatch]);

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
    setSharedOn(session);
    screenStartCommands(stageRef.current, {
      owner: session.localIdentity,
      contentId: newId(),
      windowId: newId(),
    }).forEach(dispatch);
  }, [session, isHost, sharing, dispatch, newId]);

  const stop = useCallback(() => {
    void session?.stopScreenShare().catch(() => {});
  }, [session]);

  return { available, sharing, error, start, stop };
}
