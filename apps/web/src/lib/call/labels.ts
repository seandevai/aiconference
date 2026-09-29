import type { RosterEntry } from '@omnicanvas/realtime';

export function tileLabel(entry: RosterEntry): string {
  const who = entry.isLocal ? `${entry.name} (tu)` : entry.name;
  const role = entry.role === 'host' ? 'host' : 'ospite';
  return `${who}, ${role}, microfono ${entry.micOn ? 'acceso' : 'spento'}`;
}

export function micButtonLabel(on: boolean): string {
  return on ? 'Disattiva microfono' : 'Attiva microfono';
}

export function cameraButtonLabel(on: boolean): string {
  return on ? 'Disattiva camera' : 'Attiva camera';
}
