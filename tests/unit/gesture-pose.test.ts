import { describe, expect, it } from 'vitest';
import { PINCH_OFF, classifyPose, palmCenter, pinchPoint, pinchRatio } from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

describe('classifyPose', () => {
  for (const pose of [
    'open_palm',
    'index_up',
    'pinch',
    'thumb_up',
    'thumb_down',
    'fist',
  ] as const) {
    it(`recognises ${pose}`, () => {
      expect(classifyPose(hand(pose))).toBe(pose);
    });
  }

  it('does not depend on where the hand is or how big it looks', () => {
    expect(classifyPose(hand('open_palm', { x: 0.2, y: 0.7 }, 0.12))).toBe('open_palm');
    expect(classifyPose(hand('index_up', { x: 0.8, y: 0.3 }, 0.3))).toBe('index_up');
  });

  it('keeps a pinch until the fingers clearly open (hysteresis)', () => {
    const almost = hand('pinch');
    // Allontana la punta del pollice fino a un rapporto fra PINCH_ON e PINCH_OFF.
    const thumbTip = almost.landmarks[4]!;
    const size = 0.2 * 0.532;
    almost.landmarks[4] = { ...thumbTip, x: almost.landmarks[8]!.x + size * 0.3 };
    expect(pinchRatio(almost)).toBeLessThan(PINCH_OFF);
    expect(classifyPose(almost, false)).not.toBe('pinch');
    expect(classifyPose(almost, true)).toBe('pinch');
  });

  it('returns none for an empty or partial hand', () => {
    expect(classifyPose({ landmarks: [] })).toBe('none');
  });
});

describe('points', () => {
  it('mirrors the pinch point like a selfie view', () => {
    const point = pinchPoint(hand('pinch', { x: 0.3, y: 0.5 }));
    expect(point.x).toBeCloseTo(0.728, 3);
    expect(point.y).toBeCloseTo(0.43, 3);
  });

  it('puts the palm centre between wrist and knuckles, in image coordinates', () => {
    const c = palmCenter(hand('open_palm', { x: 0.5, y: 0.5 }));
    expect(c.x).toBeCloseTo(0.5, 2);
    expect(c.y).toBeCloseTo(0.5 + 0.2 * 0.104, 2);
  });
});
