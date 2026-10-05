import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DICTIONARY,
  DEFAULT_TUNING,
  GESTURE_COMMANDS,
  GESTURE_NAMES,
  createRecognizer,
  type Frame,
  type Hand,
  type Tuning,
} from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const STEP = 33;

function span(from: number, to: number, make: (progress: number) => Hand[]): Frame[] {
  const frames: Frame[] = [];
  for (let t = from; t <= to; t += STEP)
    frames.push({ t, hands: make((t - from) / Math.max(1, to - from)) });
  return frames;
}

const tuned = (over: Partial<Tuning>): Tuning => ({ ...DEFAULT_TUNING, ...over });

describe('stability', () => {
  // Indice alzato per 1,1 s con un fotogramma di pugno a metà (sfarfallio).
  const glitchy = span(0, 1_100, () => [hand('index_up')]).map((frame) =>
    frame.t === 495 ? { ...frame, hands: [hand('fist')] } : frame,
  );

  it('with one frame a single glitch restarts the hold', () => {
    const recognizer = createRecognizer({ armed: true });
    const events = glitchy.flatMap((f) => recognizer.push(f));
    expect(events).toEqual([]);
  });

  it('with three frames a single glitch is ignored', () => {
    const recognizer = createRecognizer({ armed: true, tuning: tuned({ stability: { frames: 3 } }) });
    const events = glitchy.flatMap((f) => recognizer.push(f));
    expect(events).toEqual([{ type: 'AGENT_ACTIVATE' }]);
  });
});

describe('tuned timings', () => {
  it('fires a hold sooner with a shorter hold time', () => {
    const recognizer = createRecognizer({
      armed: true,
      tuning: tuned({ timings: { ...DEFAULT_TUNING.timings, holdMs: 400 } }),
    });
    const events = span(0, 500, () => [hand('index_up')]).flatMap((f) => recognizer.push(f));
    expect(events).toEqual([{ type: 'AGENT_ACTIVATE' }]);
  });

  it('keeps swipe samples when the swipe window is longer than the two-hands one', () => {
    const recognizer = createRecognizer({
      armed: true,
      tuning: tuned({
        timings: {
          ...DEFAULT_TUNING.timings,
          swipe: { distance: 0.25, withinMs: 900 },
          spread: { distance: 0.2, withinMs: 300 },
        },
      }),
    });
    // 0,3 di immagine in 800 ms: troppo lento per i 400 ms di oggi, valido con 900.
    const frames = span(0, 800, (k) => [hand('fist', { x: 0.35 + 0.3 * k, y: 0.5 })]);
    const events = frames.flatMap((f) => recognizer.push(f));
    expect(events).toEqual([{ type: 'FOCUS_NEXT' }]);
  });
});

describe('view', () => {
  it('shows the hold progress, then the cooldown', () => {
    const recognizer = createRecognizer({ armed: true });
    span(0, 500, () => [hand('index_up')]).forEach((f) => recognizer.push(f));
    const halfway = recognizer.view();
    expect(halfway.rawPose).toBe('index_up');
    expect(halfway.pose).toBe('index_up');
    expect(halfway.hold?.pose).toBe('index_up');
    expect(halfway.hold?.progress).toBeCloseTo(0.5, 1);

    span(528, 1_100, () => [hand('index_up')]).forEach((f) => recognizer.push(f));
    const after = recognizer.view();
    expect(after.hold).toBeNull();
    expect(after.cooldownLeftMs).toBeGreaterThan(0);
    expect(after.armed).toBe(true);
  });

  it('reports dragging and the raw pose before stabilizing', () => {
    const recognizer = createRecognizer({ armed: true, tuning: tuned({ stability: { frames: 3 } }) });
    recognizer.push({ t: 0, hands: [hand('fist')] });
    recognizer.push({ t: 33, hands: [hand('fist')] });
    recognizer.push({ t: 66, hands: [hand('fist')] });
    recognizer.push({ t: 99, hands: [hand('index_up')] });
    expect(recognizer.view()).toMatchObject({ rawPose: 'index_up', pose: 'fist', dragging: false });
  });

  it('starts empty', () => {
    expect(createRecognizer().view()).toEqual({
      rawPose: 'none',
      pose: 'none',
      hold: null,
      armed: false,
      cooldownLeftMs: 0,
      dragging: false,
    });
  });
});

describe('dictionary lists', () => {
  it('lists every gesture and every command', () => {
    expect([...GESTURE_NAMES].sort()).toEqual(Object.keys(DEFAULT_DICTIONARY).sort());
    expect(GESTURE_COMMANDS).toEqual([
      'GESTURES_TOGGLE',
      'AGENT_ACTIVATE',
      'CONFIRM',
      'REJECT',
      'DRAG',
      'FOCUS_NEXT',
      'FOCUS_PREV',
      'WINDOW_ARCHIVE',
      'WINDOW_CREATE',
    ]);
  });
});
