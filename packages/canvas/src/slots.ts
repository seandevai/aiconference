import { SLOTS, type Slot } from './types';

export type Rect = { x: number; y: number; width: number; height: number };

// Aggancio magnetico: il rilascio va allo slot con il centro più vicino.
export function nearestSlot(
  point: { x: number; y: number },
  rects: Partial<Record<Slot, Rect>>,
): Slot | null {
  let best: Slot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of SLOTS) {
    const rect = rects[slot];
    if (!rect) continue;
    const dx = point.x - (rect.x + rect.width / 2);
    const dy = point.y - (rect.y + rect.height / 2);
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = slot;
      bestDistance = distance;
    }
  }
  return best;
}
