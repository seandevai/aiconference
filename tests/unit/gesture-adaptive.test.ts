import { describe, expect, it } from 'vitest';
import { createAdaptiveController } from '@omnicanvas/gesture';

function feed(controller: ReturnType<typeof createAdaptiveController>, ms: number, count: number) {
  const changes = [];
  for (let i = 0; i < count; i += 1) {
    const change = controller.record(ms);
    if (change) changes.push(change);
  }
  return changes;
}

describe('adaptive controller', () => {
  it('drops the two-hand gesture first, then steps the frequency down', () => {
    const c = createAdaptiveController({ window: 10 });
    expect(feed(c, 40, 10)).toEqual([{ fps: 30, twoHands: false }]);
    expect(feed(c, 40, 10)).toEqual([{ fps: 20, twoHands: false }]);
    expect(feed(c, 40, 10)).toEqual([{ fps: 15, twoHands: false }]);
    expect(feed(c, 40, 10)).toEqual([{ fps: 10, twoHands: false }]);
    expect(feed(c, 40, 30)).toEqual([]);
  });

  it('keeps going while inference fits the budget', () => {
    const c = createAdaptiveController({ window: 10 });
    expect(feed(c, 12, 50)).toEqual([]);
    expect(c.current()).toEqual({ fps: 30, twoHands: true });
  });

  it('climbs back when the machine is calm: frequency first, then two hands', () => {
    const c = createAdaptiveController({ window: 10, recoverAfter: 30 });
    feed(c, 40, 20);
    expect(c.current()).toEqual({ fps: 20, twoHands: false });
    expect(feed(c, 2, 30)).toEqual([{ fps: 30, twoHands: false }]);
    expect(feed(c, 2, 30)).toEqual([{ fps: 30, twoHands: true }]);
  });
});
