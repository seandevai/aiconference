import { describe, expect, it } from 'vitest';
import { followPoint } from '@/lib/stage/cursor-motion';

describe('followPoint', () => {
  it('jumps to the target when there is no current point', () => {
    expect(followPoint(null, { x: 10, y: 20 }, 16, 60)).toEqual({ x: 10, y: 20 });
  });

  it('covers half the distance in one half-life', () => {
    const next = followPoint({ x: 0, y: 0 }, { x: 100, y: 40 }, 60, 60);
    expect(next.x).toBeCloseTo(50, 5);
    expect(next.y).toBeCloseTo(20, 5);
  });

  it('stays put with no elapsed time and reaches the target eventually', () => {
    expect(followPoint({ x: 5, y: 5 }, { x: 50, y: 50 }, 0, 60)).toEqual({ x: 5, y: 5 });
    const far = followPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 2_000, 60);
    expect(far.x).toBeCloseTo(100, 3);
  });
});
