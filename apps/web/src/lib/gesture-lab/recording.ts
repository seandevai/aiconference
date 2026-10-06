import type { Frame, GestureEvent } from '@omnicanvas/gesture';

export type Recording = {
  expect: GestureEvent['type'] | null;
  armed: boolean;
  frames: Frame[];
  label?: string;
};

const EVENT_TYPES: GestureEvent['type'][] = [
  'GESTURES_TOGGLE',
  'AGENT_ACTIVATE',
  'CONFIRM',
  'REJECT',
  'FOCUS_NEXT',
  'FOCUS_PREV',
  'WINDOW_ARCHIVE',
  'WINDOW_CREATE',
  'GRAB',
  'MOVE',
  'DROP',
];
export const isGestureEventType = (value: unknown): value is GestureEvent['type'] =>
  EVENT_TYPES.includes(value as GestureEvent['type']);

const MAX_FRAMES = 2_000;

const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

const isHand = (value: unknown) => {
  const landmarks = (value as { landmarks?: unknown } | null)?.landmarks;
  return (
    Array.isArray(landmarks) &&
    landmarks.length === 21 &&
    landmarks.every((p) => {
      const point = p as Record<string, unknown> | null;
      return point !== null && isNumber(point.x) && isNumber(point.y) && isNumber(point.z);
    })
  );
};

// File del registratore: solo landmark. Tutto il resto si rifiuta senza rompere la pagina.
export function parseRecording(value: unknown): Recording | null {
  if (typeof value !== 'object' || value === null) return null;
  const { expect, armed, frames, label } = value as Record<string, unknown>;
  // null = gesture nuova: si rigioca senza confronto con un evento atteso.
  if (expect !== null && !isGestureEventType(expect)) return null;
  if (typeof armed !== 'boolean') return null;
  if (!Array.isArray(frames) || frames.length === 0 || frames.length > MAX_FRAMES) return null;
  const valid = frames.every((f) => {
    const frame = f as Record<string, unknown> | null;
    return (
      frame !== null && isNumber(frame.t) && Array.isArray(frame.hands) && frame.hands.every(isHand)
    );
  });
  if (!valid) return null;
  const recording: Recording = { expect, armed, frames: frames as Frame[] };
  return typeof label === 'string' ? { ...recording, label } : recording;
}

// Rigioca i fotogrammi con i loro tempi relativi. Finita la registrazione, «play» riparte da capo.
export function createReplayer(
  frames: Frame[],
  onFrame: (frame: Frame) => void,
  onEnd: () => void,
) {
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const step = () => {
    const frame = frames[index];
    if (!frame) {
      timer = null;
      index = 0;
      onEnd();
      return;
    }
    onFrame(frame);
    index += 1;
    const next = frames[index];
    if (!next) {
      timer = null;
      index = 0;
      onEnd();
      return;
    }
    timer = setTimeout(step, Math.max(0, next.t - frame.t));
  };

  return {
    play() {
      if (timer !== null) return;
      step();
    },
    pause() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    isPlaying: () => timer !== null,
  };
}
