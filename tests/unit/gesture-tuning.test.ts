import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  PINCH_OFF,
  PINCH_ON,
  clampTuning,
  classifyPose,
  poseMetrics,
} from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

describe('DEFAULT_TUNING', () => {
  it('keeps today values, with corrections off', () => {
    expect(DEFAULT_TUNING).toEqual({
      timings: {
        holdMs: 1_000,
        cooldownMs: 800,
        stillness: 0.08,
        swipe: { distance: 0.25, withinMs: 400 },
        flick: { distance: 0.25, withinMs: 300 },
        spread: { distance: 0.2, withinMs: 600 },
      },
      pose: { pinchOn: 0.25, pinchOff: 0.35, extended: 1.6, folded: 1.2, thumbMargin: 0.3 },
      smoothing: { enabled: false, minCutoff: 1.0, beta: 0.007 },
      stability: { frames: 1 },
    });
    expect(PINCH_ON).toBe(0.25);
    expect(PINCH_OFF).toBe(0.35);
  });
});

describe('clampTuning', () => {
  it('fills missing or invalid fields with the defaults', () => {
    expect(clampTuning(undefined)).toEqual(DEFAULT_TUNING);
    expect(clampTuning({ timings: { holdMs: 'x' }, stability: { frames: Number.NaN } })).toEqual(
      DEFAULT_TUNING,
    );
  });

  it('keeps values inside sensible bounds', () => {
    const tuning = clampTuning({
      timings: { holdMs: 50, cooldownMs: 99_999 },
      smoothing: { enabled: true, minCutoff: -1, beta: 5 },
      stability: { frames: 0 },
    });
    expect(tuning.timings.holdMs).toBe(200);
    expect(tuning.timings.cooldownMs).toBe(3_000);
    expect(tuning.smoothing).toEqual({ enabled: true, minCutoff: 0.01, beta: 1 });
    expect(tuning.stability.frames).toBe(1);
  });

  it('keeps pinch-on below pinch-off and folded below extended', () => {
    const tuning = clampTuning({
      pose: { pinchOn: 0.5, pinchOff: 0.3, extended: 1.1, folded: 1.4 },
    });
    expect(tuning.pose.pinchOn).toBeLessThan(tuning.pose.pinchOff);
    expect(tuning.pose.folded).toBeLessThan(tuning.pose.extended);
  });

  it('rounds the stability frames to an integer', () => {
    expect(clampTuning({ stability: { frames: 3.6 } }).stability.frames).toBe(4);
  });
});

describe('classifyPose with thresholds', () => {
  it('follows the thresholds it is given', () => {
    const palm = hand('open_palm');
    expect(classifyPose(palm)).toBe('open_palm');
    expect(classifyPose(palm, false, { ...DEFAULT_TUNING.pose, extended: 10 })).toBe('none');
  });
});

describe('poseMetrics', () => {
  it('reports finger ratios, pinch and thumb', () => {
    const open = poseMetrics(hand('open_palm'));
    expect(Object.keys(open.fingers)).toEqual(['index', 'middle', 'ring', 'pinky']);
    expect(Object.values(open.fingers).every((r) => r > 1.6)).toBe(true);
    expect(open.thumbExtended).toBe(true);
    const fist = poseMetrics(hand('fist'));
    expect(Object.values(fist.fingers).every((r) => r < 1.2)).toBe(true);
    expect(fist.thumbExtended).toBe(false);
    expect(poseMetrics(hand('pinch')).pinch).toBeLessThan(0.25);
  });
});
