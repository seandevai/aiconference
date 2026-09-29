import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DICTIONARY,
  createRecognizer,
  type Frame,
  type GestureEvent,
  type Hand,
} from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const STEP = 33;

// Frame da `from` a `to` ms; `make(progress)` restituisce le mani al punto 0..1 del tratto.
function span(from: number, to: number, make: (progress: number) => Hand[]): Frame[] {
  const frames: Frame[] = [];
  for (let t = from; t <= to; t += STEP)
    frames.push({ t, hands: make((t - from) / Math.max(1, to - from)) });
  return frames;
}

function run(frames: Frame[], options: Parameters<typeof createRecognizer>[0] = {}) {
  const recognizer = createRecognizer(options);
  const events: GestureEvent[] = frames.flatMap((f) => recognizer.push(f));
  return { events, recognizer };
}

const still = (
  pose: Parameters<typeof hand>[0],
  from: number,
  to: number,
  center = { x: 0.5, y: 0.5 },
) => span(from, to, () => [hand(pose, center)]);

describe('arming', () => {
  it('toggles on an open palm held still for a second, once', () => {
    const { events, recognizer } = run(still('open_palm', 0, 2_500));
    expect(events).toEqual([{ type: 'GESTURES_TOGGLE', armed: true }]);
    expect(recognizer.isArmed()).toBe(true);
  });

  it('ignores every other gesture while disarmed', () => {
    const { events } = run([...still('index_up', 0, 1_500), ...still('thumb_up', 1_600, 3_000)]);
    expect(events).toEqual([]);
  });

  it('does not toggle on a palm that moves or shows up for less than a second', () => {
    const moving = span(0, 2_000, (k) => [hand('open_palm', { x: 0.3 + 0.4 * k, y: 0.5 })]);
    expect(run(moving).events).toEqual([]);
    expect(run(still('open_palm', 0, 800)).events).toEqual([]);
  });

  it('disarms with the same gesture', () => {
    const { events } = run([
      ...still('open_palm', 0, 1_200),
      ...still('fist', 1_233, 1_500),
      ...still('open_palm', 2_400, 3_600),
    ]);
    expect(events).toEqual([
      { type: 'GESTURES_TOGGLE', armed: true },
      { type: 'GESTURES_TOGGLE', armed: false },
    ]);
  });
});

describe('holds when armed', () => {
  it('maps index up, thumb up and thumb down', () => {
    const frames = [
      ...still('index_up', 0, 1_200),
      ...still('thumb_up', 2_200, 3_400),
      ...still('thumb_down', 4_400, 5_600),
    ];
    expect(run(frames, { armed: true }).events.map((e) => e.type)).toEqual([
      'AGENT_ACTIVATE',
      'CONFIRM',
      'REJECT',
    ]);
  });

  it('respects a gesture switched off in the dictionary', () => {
    const dictionary = { ...DEFAULT_DICTIONARY, index_up_hold: null };
    expect(run(still('index_up', 0, 1_500), { armed: true, dictionary }).events).toEqual([]);
  });
});

describe('pinch drag', () => {
  it('grabs, moves and drops at the mirrored pinch point', () => {
    const frames = [
      ...span(0, 200, (k) => [hand('pinch', { x: 0.3 + 0.2 * k, y: 0.5 })]),
      ...still('open_palm', 233, 300, { x: 0.5, y: 0.5 }),
    ];
    const { events } = run(frames, { armed: true });
    expect(events[0]).toMatchObject({ type: 'GRAB' });
    expect((events[0] as { x: number }).x).toBeCloseTo(0.728, 2);
    expect(events.slice(1, -1).every((e) => e.type === 'MOVE')).toBe(true);
    const drop = events.at(-1) as { type: string; x: number };
    expect(drop.type).toBe('DROP');
    expect(drop.x).toBeCloseTo(1 - (0.5 - 0.028), 2);
  });

  it('drops at the last point when the hand leaves the frame', () => {
    const frames: Frame[] = [...still('pinch', 0, 100), { t: 133, hands: [] }];
    expect(run(frames, { armed: true }).events.map((e) => e.type)).toEqual([
      'GRAB',
      'MOVE',
      'MOVE',
      'MOVE',
      'DROP',
    ]);
  });

  it('does nothing when disarmed', () => {
    expect(run(still('pinch', 0, 300)).events).toEqual([]);
  });
});

describe('motion when armed', () => {
  it('swipes: hand to the left of the screen is next, to the right is previous', () => {
    // Nell'immagine x cresce verso destra; sullo schermo, a specchio, verso sinistra.
    const left = span(0, 200, (k) => [hand('open_palm', { x: 0.3 + 0.4 * k, y: 0.5 })]);
    expect(run(left, { armed: true }).events).toEqual([{ type: 'FOCUS_NEXT' }]);
    const right = span(0, 200, (k) => [hand('open_palm', { x: 0.7 - 0.4 * k, y: 0.5 })]);
    expect(run(right, { armed: true }).events).toEqual([{ type: 'FOCUS_PREV' }]);
  });

  it('ignores slow drifting', () => {
    const slow = span(0, 2_000, (k) => [hand('open_palm', { x: 0.3 + 0.4 * k, y: 0.5 })]);
    expect(run(slow, { armed: true }).events).toEqual([]);
  });

  it('archives on an upward flick', () => {
    const flick = span(0, 200, (k) => [hand('open_palm', { x: 0.5, y: 0.7 - 0.35 * k })]);
    expect(run(flick, { armed: true }).events).toEqual([{ type: 'WINDOW_ARCHIVE' }]);
  });

  it('creates a window when two hands spread apart, unless two hands are off', () => {
    const spread = span(0, 400, (k) => [
      hand('open_palm', { x: 0.45 - 0.2 * k, y: 0.5 }),
      hand('open_palm', { x: 0.55 + 0.2 * k, y: 0.5 }),
    ]);
    expect(run(spread, { armed: true }).events).toEqual([{ type: 'WINDOW_CREATE' }]);
    expect(run(spread, { armed: true, twoHands: false }).events).toEqual([]);
  });

  it('fires one command per swipe thanks to the cooldown', () => {
    const long = span(0, 400, (k) => [hand('open_palm', { x: 0.1 + 0.8 * k, y: 0.5 })]);
    expect(run(long, { armed: true }).events).toEqual([{ type: 'FOCUS_NEXT' }]);
  });
});
