import type { Hand, Landmark, Point } from './types';

export const FINGERS = {
  index: [5, 6, 8],
  middle: [9, 10, 12],
  ring: [13, 14, 16],
  pinky: [17, 18, 20],
} as const;
export type Finger = keyof typeof FINGERS;

const at = (hand: Hand, i: number): Landmark => hand.landmarks[i] ?? { x: 0, y: 0, z: 0 };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Distanza polso-nocca del medio: rende le soglie indipendenti da quanto è vicina la mano.
export function palmSize(hand: Hand): number {
  return dist(at(hand, 0), at(hand, 9));
}

// Rapporto polso-punta / polso-nocca: > 1.6 dito esteso, < 1.2 dito piegato.
export function fingerRatio(hand: Hand, finger: Finger): number {
  const [mcp, , tip] = FINGERS[finger];
  const base = dist(at(hand, 0), at(hand, mcp));
  return base === 0 ? 0 : dist(at(hand, 0), at(hand, tip)) / base;
}

export function thumbExtended(hand: Hand): boolean {
  return dist(at(hand, 4), at(hand, 5)) > 0.7 * palmSize(hand);
}

export function pinchRatio(hand: Hand): number {
  const size = palmSize(hand);
  return size === 0 ? Number.POSITIVE_INFINITY : dist(at(hand, 4), at(hand, 8)) / size;
}

export function palmCenter(hand: Hand): Point {
  const points = [0, 5, 9, 13, 17].map((i) => at(hand, i));
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

// Punto fra pollice e indice, in vista specchio (come l'utente si vede).
export function pinchPoint(hand: Hand): Point {
  const thumb = at(hand, 4);
  const index = at(hand, 8);
  return { x: 1 - (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 };
}
