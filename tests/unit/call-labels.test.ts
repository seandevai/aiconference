import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';
import { cameraButtonLabel, micButtonLabel, tileLabel } from '@/lib/call/labels';

const entry: RosterEntry = {
  identity: 'p1',
  name: 'Cliente',
  role: 'guest',
  language: 'en',
  isLocal: false,
  micOn: true,
  camOn: true,
  speaking: false,
};

describe('call labels', () => {
  it('describes a tile for screen readers', () => {
    expect(tileLabel(entry)).toBe('Cliente, ospite, microfono acceso');
    expect(tileLabel({ ...entry, micOn: false })).toBe('Cliente, ospite, microfono spento');
    expect(tileLabel({ ...entry, name: 'Sean', role: 'host', isLocal: true })).toBe(
      'Sean (tu), host, microfono acceso',
    );
  });

  it('names buttons after the action they perform', () => {
    expect(micButtonLabel(true)).toBe('Disattiva microfono');
    expect(micButtonLabel(false)).toBe('Attiva microfono');
    expect(cameraButtonLabel(true)).toBe('Disattiva camera');
    expect(cameraButtonLabel(false)).toBe('Attiva camera');
  });
});
