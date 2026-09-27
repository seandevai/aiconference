import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';
import { nextLastSpeaker, pipTarget, resolveSpotlight } from '@/lib/call/spotlight';

const entry = (identity: string, over: Partial<RosterEntry> = {}): RosterEntry => ({
  identity,
  name: identity,
  role: 'guest',
  language: 'it',
  isLocal: false,
  micOn: true,
  camOn: true,
  speaking: false,
  ...over,
});

const me = entry('me', { isLocal: true });
const host = entry('host', { role: 'host' });
const ana = entry('ana');

describe('resolveSpotlight', () => {
  it('keeps a remote participant who is still in the room', () => {
    expect(resolveSpotlight('ana', [host, me, ana])).toBe('ana');
  });
  it('closes when the participant has left', () => {
    expect(resolveSpotlight('ana', [host, me])).toBeNull();
  });
  it('never spotlights the local participant', () => {
    expect(resolveSpotlight('me', [host, me])).toBeNull();
  });
  it('stays closed when nothing is selected', () => {
    expect(resolveSpotlight(null, [host, me])).toBeNull();
  });
});

describe('nextLastSpeaker', () => {
  it('picks the remote participant who is speaking', () => {
    expect(nextLastSpeaker(null, [host, me, { ...ana, speaking: true }])).toBe('ana');
  });
  it('ignores the local participant speaking', () => {
    expect(nextLastSpeaker('host', [host, { ...me, speaking: true }, ana])).toBe('host');
  });
  it('keeps the previous speaker during silence', () => {
    expect(nextLastSpeaker('ana', [host, me, ana])).toBe('ana');
  });
  it('forgets a previous speaker who has left', () => {
    expect(nextLastSpeaker('ana', [host, me])).toBeNull();
  });
});

describe('pipTarget', () => {
  it('prefers the spotlight', () => {
    expect(pipTarget([host, me, ana], 'ana', 'host')).toBe('ana');
  });
  it('then the last speaker', () => {
    expect(pipTarget([host, me, ana], null, 'ana')).toBe('ana');
  });
  it('then the first remote with the camera on, host first', () => {
    expect(pipTarget([host, me, ana], null, null)).toBe('host');
    expect(pipTarget([{ ...host, camOn: false }, me, ana], null, null)).toBe('ana');
  });
  it('falls back when the last speaker has left', () => {
    expect(pipTarget([host, me], null, 'ana')).toBe('host');
  });
  it('never shows the local participant', () => {
    expect(pipTarget([me], null, 'me')).toBeNull();
  });
});
