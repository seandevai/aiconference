'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nearestSlot, type Stage, type StageCommand } from '@omnicanvas/canvas';
import type { GestureEvent } from '@omnicanvas/gesture';
import type { GestureRunner } from '@omnicanvas/gesture/runner';
import type { RealtimeSession } from '@omnicanvas/realtime';
import { dragItemAt, resolveDrop, slotRectsFromDom, type DragItem } from './drop';
import { gestureAction, type GestureStatus } from './gesture-actions';

type Cursor = { x: number; y: number; grabbing: boolean };

type Options = {
  session: RealtimeSession | null;
  cameraOn: boolean;
  stage: Stage;
  dispatch: (command: StageCommand) => void;
  onAgent: () => void;
  areaRef: React.RefObject<HTMLElement | null>;
  // Posizione della mano sullo schermo durante un pizzico (null al rilascio): inclina il palco.
  onPointer?: ((point: { x: number; y: number } | null) => void) | undefined;
};

export function useGestures({
  session,
  cameraOn,
  stage,
  dispatch,
  onAgent,
  areaRef,
  onPointer,
}: Options) {
  const [status, setStatus] = useState<GestureStatus>('off');
  const [armed, setArmed] = useState(false);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const runnerRef = useRef<GestureRunner | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const stageRef = useRef(stage);
  const handlersRef = useRef({ dispatch, onAgent, onPointer });
  const draggingRef = useRef<DragItem | null>(null);

  useEffect(() => {
    stageRef.current = stage;
    handlersRef.current = { dispatch, onAgent, onPointer };
  }, [stage, dispatch, onAgent, onPointer]);

  // Punto normalizzato (vista specchio) → coordinate dello schermo sull'area del palco.
  const toScreen = useCallback(
    (x: number, y: number) => {
      const box = areaRef.current?.getBoundingClientRect();
      return box ? { x: box.left + x * box.width, y: box.top + y * box.height } : null;
    },
    [areaRef],
  );

  const onEvent = useCallback(
    (event: GestureEvent) => {
      const { dispatch: send, onAgent: agent } = handlersRef.current;
      if (event.type === 'GESTURES_TOGGLE') {
        setArmed(event.armed);
        return;
      }
      if ('x' in event) {
        const point = toScreen(event.x, event.y);
        if (!point) return;
        if (event.type === 'GRAB') draggingRef.current = dragItemAt(point.x, point.y);
        if (event.type === 'DROP') {
          const item = draggingRef.current;
          draggingRef.current = null;
          handlersRef.current.onPointer?.(null);
          setCursor(null);
          const slot = nearestSlot(point, slotRectsFromDom());
          const command = item && slot ? resolveDrop(stageRef.current, item, slot) : null;
          if (command) send(command);
          return;
        }
        handlersRef.current.onPointer?.(point);
        setCursor({ ...point, grabbing: draggingRef.current !== null });
        return;
      }
      const action = gestureAction(event, stageRef.current, () => crypto.randomUUID());
      if (action.kind === 'command') send(action.command);
      if (action.kind === 'agent') agent();
    },
    [toScreen],
  );

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
