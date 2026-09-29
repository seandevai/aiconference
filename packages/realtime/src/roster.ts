import type { ParticipantRole, RosterEntry } from './types';

// La forma minima di un partecipante: basta per costruire il roster senza il vendor.
export type ParticipantLike = {
  identity: string;
  name?: string | undefined;
  attributes: Readonly<Record<string, string>>;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isSpeaking: boolean;
};

export function toRosterEntry(participant: ParticipantLike, isLocal: boolean): RosterEntry {
  // Gli attributi li firma il server; un valore inatteso non diventa mai 'host'.
  const role: ParticipantRole = participant.attributes.role === 'host' ? 'host' : 'guest';
  return {
    identity: participant.identity,
    name: participant.name?.trim() || 'Partecipante',
    role,
    language: participant.attributes.language ?? 'it',
    isLocal,
    micOn: participant.isMicrophoneEnabled,
    camOn: participant.isCameraEnabled,
    speaking: participant.isSpeaking,
  };
}

export function sortRoster(entries: readonly RosterEntry[]): RosterEntry[] {
  const rank = (entry: RosterEntry) => (entry.role === 'host' ? 0 : entry.isLocal ? 1 : 2);
  return [...entries].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.name.localeCompare(b.name, 'it') ||
      a.identity.localeCompare(b.identity),
  );
}
