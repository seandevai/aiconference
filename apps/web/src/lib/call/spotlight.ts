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

// Il video del PiP: spotlight, poi chi ha parlato per ultimo, poi il primo remoto con la
// camera accesa (il roster mette l'host per primo). Mai se stessi, mai una camera spenta:
// un PiP nero non serve e su una camera spenta il browser rifiuta di aprirlo.
export function pipTarget(
  roster: readonly RosterEntry[],
  spotlight: string | null,
  lastSpeaker: string | null,
): string | null {
  const withVideo = (identity: string | null) => {
    const entry = remote(roster, identity);
    return entry?.camOn ? entry.identity : undefined;
  };
  return (
    withVideo(spotlight) ??
    withVideo(lastSpeaker) ??
    roster.find((entry) => !entry.isLocal && entry.camOn)?.identity ??
    null
  );
}
