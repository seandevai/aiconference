import { describe, expect, it } from 'vitest';
import { createHandSmoother, type Frame, type Hand } from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const shift = (h: Hand, dx: number, dy = 0): Hand => ({
  landmarks: h.landmarks.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z })),
});

const wristX = (frame: Frame, i = 0) => frame.hands[i]!.landmarks[0]!.x;

describe('createHandSmoother', () => {
  it('passes the first frame through unchanged', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    const frame = { t: 0, hands: [hand('open_palm')] };
    expect(smoother.smooth(frame)).toEqual(frame);
  });

  it('reduces jitter on a still hand', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    const base = hand('open_palm');
    const outputs: number[] = [];
    for (let i = 0; i < 60; i++) {
      const noise = i % 2 === 0 ? 0.01 : -0.01;
      outputs.push(wristX(smoother.smooth({ t: i * 33, hands: [shift(base, noise)] })));
    }
    const tail = outputs.slice(30);
    const spread = Math.max(...tail) - Math.min(...tail);
    expect(spread).toBeLessThan(0.02 * 0.5);
  });

  it('catches up with a hand that moved and stays there', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0.5 });
    const base = hand('open_palm');
    smoother.smooth({ t: 0, hands: [base] });
    let last = 0;
    for (let t = 33; t <= 1_000; t += 33)
      last = wristX(smoother.smooth({ t, hands: [shift(base, 0.3)] }));
    expect(Math.abs(last - wristX({ t: 0, hands: [shift(base, 0.3)] }))).toBeLessThan(0.01);
  });

  it('forgets a hand that disappeared', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    smoother.smooth({ t: 0, hands: [hand('open_palm')] });
    smoother.smooth({ t: 33, hands: [] });
    const far = { t: 66, hands: [shift(hand('open_palm'), 0.3)] };
    expect(smoother.smooth(far)).toEqual(far);
  });

  it('keeps each hand on its own track when MediaPipe swaps their order', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    const left = hand('open_palm', { x: 0.25, y: 0.5 });
    const right = hand('open_palm', { x: 0.75, y: 0.5 });
    smoother.smooth({ t: 0, hands: [left, right] });
    const swapped = smoother.smooth({ t: 33, hands: [right, left] });
    expect(wristX(swapped, 0)).toBeCloseTo(right.landmarks[0]!.x, 5);
    expect(wristX(swapped, 1)).toBeCloseTo(left.landmarks[0]!.x, 5);
  });
});
