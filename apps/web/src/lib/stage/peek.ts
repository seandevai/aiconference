import { orderedWindows, type Stage } from '@omnicanvas/canvas';
import type { RosterEntry } from '@omnicanvas/realtime';

export function peekNeighbor(
  stage: Stage,
  fromId: string | null,
  direction: 1 | -1,
): string | null {
  const ordered = orderedWindows(stage);
  if (ordered.length === 0) return null;
  const start = ordered.findIndex((w) => w.id === (fromId ?? stage.focusedId));
  const index = ((start < 0 ? 0 : start) + direction + ordered.length) % ordered.length;
  return ordered[index]?.id ?? null;
}

// Il ruolo è un attributo firmato dal server nel token LiveKit: non si può falsificare.
export function isFromHost(roster: RosterEntry[], identity: string): boolean {
  return roster.some((entry) => entry.identity === identity && entry.role === 'host');
}
