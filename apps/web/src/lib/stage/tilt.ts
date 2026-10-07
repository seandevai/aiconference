'use client';

import { useCallback, useEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Box = { left: number; top: number; width: number; height: number };

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

// Posizione del puntatore sul palco → inclinazione in [-1, 1] su entrambi gli assi.
export function tiltFromPoint(rect: Box, point: Point): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp(((point.x - rect.left) / rect.width) * 2 - 1),
    y: clamp(((point.y - rect.top) / rect.height) * 2 - 1),
  };
}

export function tiltEnabled(win: Window): boolean {
  return win.matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
  ).matches;
}

// Scrive --tilt-x e --tilt-y sul palco al massimo una volta per frame, senza render di
// React. Mouse e mano passano da pointAt; null riporta le finestre piatte.
export function useStageTilt() {
  const ref = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<Point | null>(null);

  const pointAt = useCallback((point: Point | null) => {
    pendingRef.current = point;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = ref.current;
      if (!element) return;
      const pending = pendingRef.current;
      const tilt = pending ? tiltFromPoint(element.getBoundingClientRect(), pending) : { x: 0, y: 0 };
      element.style.setProperty('--tilt-x', tilt.x.toFixed(3));
      element.style.setProperty('--tilt-y', tilt.y.toFixed(3));
    });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !tiltEnabled(window)) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') pointAt({ x: event.clientX, y: event.clientY });
    };
    const leave = () => pointAt(null);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    return () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [pointAt]);

  return { ref, pointAt };
}
