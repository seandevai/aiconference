import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import { isFromHost, peekNeighbor } from '@/lib/stage/peek';

const stage = [
  { type: 'WINDOW_CREATE', windowId: 'A', title: 'A' } as const,
  { type: 'WINDOW_CREATE', windowId: 'B', title: 'B' } as const,
  { type: 'WINDOW_CREATE', windowId: 'C', title: 'C' } as const,
].reduce(applyCommand, emptyStage());

const entry = (identity: string, role: 'host' | 'guest'): RosterEntry => ({
  identity,
  name: identity,
  role,
  language: 'it',
  isLocal: false,
  micOn: true,
  camOn: true,
  speaking: false,
});

describe('peekNeighbor', () => {
  it('walks the windows in slot order and wraps around', () => {
    expect(peekNeighbor(stage, 'A', 1)).toBe('B');
    expect(peekNeighbor(stage, 'C', 1)).toBe('A');
    expect(peekNeighbor(stage, 'A', -1)).toBe('C');
  });

  it('starts from the focused window when nothing is shown', () => {
    expect(peekNeighbor(stage, null, 1)).toBe('B');
    expect(peekNeighbor(emptyStage(), null, 1)).toBeNull();
  });
});

describe('isFromHost', () => {
  const roster = [entry('h', 'host'), entry('g', 'guest')];

  it('accepts only the identity whose signed role is host', () => {
    expect(isFromHost(roster, 'h')).toBe(true);
    expect(isFromHost(roster, 'g')).toBe(false);
    expect(isFromHost(roster, 'unknown')).toBe(false);
  });
});
