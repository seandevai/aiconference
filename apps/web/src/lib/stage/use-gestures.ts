'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stage, StageCommand } from '@omnicanvas/canvas';
import type { GestureRunner } from '@omnicanvas/gesture/runner';
import type { RealtimeSession } from '@omnicanvas/realtime';
import type { GestureEvent } from '@omnicanvas/gesture';
import type { GestureStatus } from './gesture-actions';
import { createStageGestureHandler, type StageCursor } from './stage-gesture-handler';

type Options = {
  session: RealtimeSession | null;
  cameraOn: boolean;
  stage: Stage;
  dispatch: (command: StageCommand) => void;
  onAgent: () => void;
  areaRef: React.RefObject<HTMLElement | null>;
};

export function useGestures({ session, cameraOn, stage, dispatch, onAgent, areaRef }: Options) {
  const [status, setStatus] = useState<GestureStatus>('off');
  const [armed, setArmed] = useState(false);
  const [cursor, setCursor] = useState<StageCursor | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const runnerRef = useRef<GestureRunner | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const stageRef = useRef(stage);
  const handlersRef = useRef({ dispatch, onAgent });

  useEffect(() => {
    stageRef.current = stage;
    handlersRef.current = { dispatch, onAgent };
  }, [stage, dispatch, onAgent]);

  // Punto normalizzato (vista specchio) → coordinate dello schermo sull'area del palco.
  const toScreen = useCallback(
    (x: number, y: number) => {
      const box = areaRef.current?.getBoundingClientRect();
      return box ? { x: box.left + x * box.width, y: box.top + y * box.height } : null;
    },
    [areaRef],
  );

  // Il gestore vive in un ref creato in un effetto: legge i ref solo dentro i callback.
  const handlerRef = useRef<((event: GestureEvent) => void) | null>(null);
  useEffect(() => {
    handlerRef.current = createStageGestureHandler({
      toScreen,
      getStage: () => stageRef.current,
      dispatch: (command) => handlersRef.current.dispatch(command),
      onAgent: () => handlersRef.current.onAgent(),
      onArmed: setArmed,
      onCursor: setCursor,
    });
  }, [toScreen]);
  const onEvent = useCallback((event: GestureEvent) => handlerRef.current?.(event), []);

  const toggle = useCallback(async () => {
    if (runnerRef.current) {
      const next = !armed;
      runnerRef.current.setArmed(next);
      setArmed(next);
      return;
    }
    const video = videoRef.current;
    if (!session || !cameraOn || !video) {
      setStatus('no_camera');
      return;
    }
    setStatus('loading');
    try {
      detachRef.current = session.attachVideo(session.localIdentity, video);
      const { startGestures } = await import('@omnicanvas/gesture/runner');
      runnerRef.current = await startGestures(video, { onEvent, armed: true });
      setArmed(true);
      setStatus('on');
    } catch {
      detachRef.current?.();
      detachRef.current = null;
      setStatus('unavailable');
    }
  }, [armed, cameraOn, onEvent, session]);

  // Camera spenta o sessione finita: il riconoscimento si ferma, il mouse resta.
  useEffect(() => {
    if (cameraOn && session) return;
    runnerRef.current?.stop();
    runnerRef.current = null;
    detachRef.current?.();
    detachRef.current = null;
  }, [cameraOn, session]);

  useEffect(
    () => () => {
      runnerRef.current?.stop();
      detachRef.current?.();
    },
    [],
  );

  const effectiveStatus: GestureStatus =
    status === 'on' && (!cameraOn || !session) ? 'no_camera' : status;
  return {
    status: effectiveStatus,
    armed: effectiveStatus === 'on' && armed,
    cursor,
    videoRef,
    toggle,
  };
}
