import type { RosterEntry } from '@omnicanvas/realtime';

const remote = (roster: readonly RosterEntry[], identity: string | null) =>
  identity ? roster.find((entry) => entry.identity === identity && !entry.isLocal) : undefined;

// Chi è a tutto schermo: solo un remoto ancora presente. Se esce, lo spotlight si chiude.
export function resolveSpotlight(
  selected: string | null,
  roster: readonly RosterEntry[],
): string | null {
  return remote(roster, selected)?.identity ?? null;
}

// L'ultimo remoto che ha parlato: resta tale nei silenzi, si dimentica se esce.
export function nextLastSpeaker(
  previous: string | null,
  roster: readonly RosterEntry[],
): string | null {
  const speaking = roster.find((entry) => entry.speaking && !entry.isLocal);
  return speaking?.identity ?? remote(roster, previous)?.identity ?? null;
}

// Chi va nel PiP: spotlight, poi chi ha parlato per ultimo, poi il primo remoto con la
// camera accesa (il roster mette l'host per primo), poi il primo remoto. Mai se stessi.
// Con la camera spenta il PiP mostra iniziale e nome (pip-avatar), come WhatsApp.
export function pipTarget(
  roster: readonly RosterEntry[],
  spotlight: string | null,
  lastSpeaker: string | null,
): string | null {
  const remotes = roster.filter((entry) => !entry.isLocal);
  return (
    remote(roster, spotlight)?.identity ??
    remote(roster, lastSpeaker)?.identity ??
    remotes.find((entry) => entry.camOn)?.identity ??
    remotes[0]?.identity ??
    null
  );
}
