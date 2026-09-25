import { describe, expect, it } from 'vitest';
import { nearestSlot } from '@omnicanvas/canvas';

const rects = {
  main: { x: 0, y: 0, width: 600, height: 400 },
  'side-1': { x: 620, y: 0, width: 200, height: 120 },
  'side-2': { x: 620, y: 140, width: 200, height: 120 },
};

describe('nearestSlot', () => {
  it('snaps to the slot whose centre is closest to the drop point', () => {
    expect(nearestSlot({ x: 300, y: 200 }, rects)).toBe('main');
    expect(nearestSlot({ x: 700, y: 60 }, rects)).toBe('side-1');
    expect(nearestSlot({ x: 610, y: 210 }, rects)).toBe('side-2');
  });

  it('returns null when no slot is on screen', () => {
    expect(nearestSlot({ x: 0, y: 0 }, {})).toBeNull();
  });
});
