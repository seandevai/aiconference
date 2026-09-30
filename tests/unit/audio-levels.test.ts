import { describe, expect, it } from 'vitest';
import { createLevelTracker, quantizeLevel } from '../../packages/realtime/src/audio-levels';

describe('quantizeLevel', () => {
  it('lifts quiet speech and rounds to tenths', () => {
    // La voce normale sta fra 0,05 e 0,3: la radice la porta a metà scala.
    expect(quantizeLevel(0.09)).toBe(0.3);
    expect(quantizeLevel(0.25)).toBe(0.5);
    expect(quantizeLevel(1)).toBe(1);
  });
  it('stays within 0 and 1 for any input', () => {
    expect(quantizeLevel(-1)).toBe(0);
    expect(quantizeLevel(Number.NaN)).toBe(0);
    expect(quantizeLevel(4)).toBe(1);
  });
});

describe('createLevelTracker', () => {
  it('emits only when a level changes', () => {
    const track = createLevelTracker();
    expect(track([{ identity: 'a', audioLevel: 0.25 }])).toEqual({ a: 0.5 });
    expect(track([{ identity: 'a', audioLevel: 0.26 }])).toBeNull();
    expect(track([{ identity: 'a', audioLevel: 0.64 }])).toEqual({ a: 0.8 });
  });
  it('drops who stopped speaking once, then stays silent', () => {
    const track = createLevelTracker();
    track([{ identity: 'a', audioLevel: 0.25 }]);
    expect(track([])).toEqual({});
    expect(track([])).toBeNull();
  });
  it('leaves out speakers whose level rounds to zero', () => {
    const track = createLevelTracker();
    expect(track([{ identity: 'a', audioLevel: 0.001 }])).toBeNull();
  });
});
