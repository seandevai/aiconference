import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';
import { sortRoster, toRosterEntry } from '../../packages/realtime/src/roster';

const base = {
  identity: 'p1',
  name: 'Cliente',
  attributes: { role: 'guest', language: 'en' },
  isMicrophoneEnabled: true,
  isCameraEnabled: false,
  isSpeaking: false,
};

describe('toRosterEntry', () => {
  it('reads role and language from the signed attributes', () => {
    expect(toRosterEntry(base, false)).toEqual({
      identity: 'p1',
      name: 'Cliente',
      role: 'guest',
      language: 'en',
      isLocal: false,
      micOn: true,
      camOn: false,
      speaking: false,
    });
  });

  it('never treats an unknown role as host', () => {
    expect(toRosterEntry({ ...base, attributes: { role: 'admin' } }, false).role).toBe('guest');
    expect(toRosterEntry({ ...base, attributes: {} }, false).role).toBe('guest');
  });

  it('falls back to a readable name', () => {
    expect(toRosterEntry({ ...base, name: '  ' }, false).name).toBe('Partecipante');
    expect(toRosterEntry({ ...base, name: undefined }, false).name).toBe('Partecipante');
  });
});

describe('sortRoster', () => {
  const entry = (over: Partial<RosterEntry>): RosterEntry => ({
    ...toRosterEntry(base, false),
    ...over,
  });

  it('puts the host first, then yourself, then the others by name', () => {
    const sorted = sortRoster([
      entry({ identity: 'z', name: 'Zeno' }),
      entry({ identity: 'me', name: 'Tu', isLocal: true }),
      entry({ identity: 'a', name: 'Anna' }),
      entry({ identity: 'h', name: 'Sean', role: 'host' }),
    ]);
    expect(sorted.map((e) => e.identity)).toEqual(['h', 'me', 'a', 'z']);
  });

  it('does not mutate its input', () => {
    const input = [entry({ identity: 'b', name: 'B' }), entry({ identity: 'a', name: 'A' })];
    sortRoster(input);
    expect(input.map((e) => e.identity)).toEqual(['b', 'a']);
  });
});
