import type { RosterEntry } from '@omnicanvas/realtime';

export function tileLabel(entry: RosterEntry): string {
  const who = entry.isLocal ? `${entry.name} (tu)` : entry.name;
  const role = entry.role === 'host' ? 'host' : 'ospite';
  return `${who}, ${role}, microfono ${entry.micOn ? 'acceso' : 'spento'}`;
}

// Il pulsante copre la tessera: il suo nome deve portare anche lo stato del microfono.
export function spotlightButtonLabel(entry: RosterEntry): string {
  return `Mostra ${entry.name} a tutto schermo, microfono ${entry.micOn ? 'acceso' : 'spento'}`;
}

export function micButtonLabel(on: boolean): string {
  return on ? 'Disattiva microfono' : 'Attiva microfono';
}

export function cameraButtonLabel(on: boolean): string {
  return on ? 'Disattiva camera' : 'Attiva camera';
}
