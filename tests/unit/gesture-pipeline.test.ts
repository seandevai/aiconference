import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  createPipeline,
  createRecognizer,
  type Frame,
  type Hand,
} from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const STEP = 33;
function span(from: number, to: number, make: (progress: number) => Hand[]): Frame[] {
  const frames: Frame[] = [];
  for (let t = from; t <= to; t += STEP)
    frames.push({ t, hands: make((t - from) / Math.max(1, to - from)) });
  return frames;
}

// Un percorso misto: armo, swipe, pinch-trascina, indice alzato, due mani.
const scenario: Frame[] = [
  ...span(0, 1_200, () => [hand('open_palm')]),
  ...span(1_233, 1_300, () => []),
  ...span(2_200, 2_500, (k) => [hand('fist', { x: 0.3 + 0.4 * k, y: 0.5 })]),
  ...span(3_400, 3_800, (k) => [hand('pinch', { x: 0.3 + 0.2 * k, y: 0.5 })]),
  ...span(3_833, 3_900, () => []),
  ...span(4_800, 6_000, () => [hand('index_up')]),
  ...span(7_000, 7_500, (k) => [
    hand('open_palm', { x: 0.4 - 0.15 * k, y: 0.5 }),
    hand('open_palm', { x: 0.6 + 0.15 * k, y: 0.5 }),
  ]),
];

describe('createPipeline', () => {
  it('with the defaults emits exactly what the recognizer emits', () => {
    const recognizer = createRecognizer();
    const pipeline = createPipeline();
    const expected = scenario.flatMap((f) => recognizer.push(f));
    const actual = scenario.flatMap((f) => pipeline.push(f).events);
    expect(actual).toEqual(expected);
    expect(actual.length).toBeGreaterThan(3);
  });

  it('passes frames through untouched when smoothing is off', () => {
    const pipeline = createPipeline();
    const frame = scenario[0]!;
    expect(pipeline.push(frame).frame).toBe(frame);
  });

  it('smooths frames when smoothing is on', () => {
    const pipeline = createPipeline({
      tuning: { ...DEFAULT_TUNING, smoothing: { enabled: true, minCutoff: 1, beta: 0 } },
    });
    pipeline.push({ t: 0, hands: [hand('open_palm', { x: 0.5, y: 0.5 })] });
    const out = pipeline.push({ t: 33, hands: [hand('open_palm', { x: 0.6, y: 0.5 })] });
    const raw = hand('open_palm', { x: 0.6, y: 0.5 }).landmarks[0]!.x;
    expect(out.frame.hands[0]!.landmarks[0]!.x).toBeLessThan(raw);
  });

  it('returns the recognizer view with every push', () => {
    const pipeline = createPipeline({ armed: true });
    const out = pipeline.push({ t: 0, hands: [hand('index_up')] });
    expect(out.view).toMatchObject({ rawPose: 'index_up', armed: true });
  });

  it('keeps the armed state when reconfigured', () => {
    const pipeline = createPipeline({ armed: true });
    pipeline.reconfigure({ tuning: { ...DEFAULT_TUNING, stability: { frames: 3 } } });
    expect(pipeline.isArmed()).toBe(true);
    pipeline.reconfigure({ dictionary: { ...createDictionaryWithout('index_up_hold') } });
    const events = span(0, 1_200, () => [hand('index_up')]).flatMap((f) => pipeline.push(f).events);
    expect(events).toEqual([]);
  });
});

function createDictionaryWithout(_name: 'index_up_hold') {
  return {
    open_palm_hold: 'GESTURES_TOGGLE',
    index_up_hold: null,
    pinch_drag: 'DRAG',
    swipe_left: 'FOCUS_NEXT',
    swipe_right: 'FOCUS_PREV',
    two_hands_spread: 'WINDOW_CREATE',
    thumb_up_hold: 'CONFIRM',
    thumb_down_hold: 'REJECT',
    flick_up: 'WINDOW_ARCHIVE',
  } as const;
}
