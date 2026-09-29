import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';
import { isMirrored } from '@/lib/call/mirror';

const entry = (isLocal: boolean): RosterEntry => ({
  identity: isLocal ? 'me' : 'ana',
  name: 'x',
  role: 'guest',
  language: 'it',
  isLocal,
  micOn: true,
  camOn: true,
  speaking: false,
});

describe('isMirrored', () => {
  it('mirrors your own front camera, like a mirror', () => {
    expect(isMirrored(entry(true), 'user')).toBe(true);
  });
  it('never mirrors the back camera: what you frame must read right', () => {
    expect(isMirrored(entry(true), 'environment')).toBe(false);
  });
  it('never mirrors other people: they must look as they are', () => {
    expect(isMirrored(entry(false), 'user')).toBe(false);
  });
});
