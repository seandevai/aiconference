import type { AudioLevels } from './types';

export const AUDIO_LEVEL_INTERVAL_MS = 125;

// La voce normale sta fra 0,05 e 0,3: la radice la porta a metà scala. Passi di 0,1
// bastano all'occhio e riducono gli aggiornamenti.
export function quantizeLevel(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(Math.min(1, Math.sqrt(raw)) * 10) / 10;
}

type Speaker = { identity: string; audioLevel: number };

// Restituisce la nuova mappa solo se è cambiata, altrimenti null.
export function createLevelTracker(): (speakers: ReadonlyArray<Speaker>) => AudioLevels | null {
  let last: AudioLevels = {};
  return (speakers) => {
    const next: AudioLevels = {};
    for (const speaker of speakers) {
      const level = quantizeLevel(speaker.audioLevel);
      if (level > 0) next[speaker.identity] = level;
    }
    const keys = Object.keys(next);
    const same =
      keys.length === Object.keys(last).length && keys.every((key) => last[key] === next[key]);
    if (same) return null;
    last = next;
    return next;
  };
}
