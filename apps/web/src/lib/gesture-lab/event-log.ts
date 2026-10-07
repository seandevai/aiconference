import type { GestureEvent } from '@omnicanvas/gesture';

export type LogEntry = { t: number; label: string };
export const LOG_LIMIT = 20;

const DRAGGING = 'Trascinamento…';

// Più recente in cima. Un trascinamento è una riga sola, che si chiude al rilascio.
export function appendEvent(log: LogEntry[], event: GestureEvent, t: number): LogEntry[] {
  if (event.type === 'MOVE') return log;
  if (event.type === 'DROP') {
    const [last, ...rest] = log;
    return last?.label === DRAGGING
      ? [{ ...last, label: 'Trascinamento → rilascio' }, ...rest]
      : log;
  }
  const label =
    event.type === 'GRAB'
      ? DRAGGING
      : event.type === 'GESTURES_TOGGLE'
        ? event.armed
          ? 'Gesture attive'
          : 'Gesture in pausa'
        : event.type;
  return [{ t, label }, ...log].slice(0, LOG_LIMIT);
}
