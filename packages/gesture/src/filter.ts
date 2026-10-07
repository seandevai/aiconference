import type { Frame, Hand, Landmark } from './types';

// Filtro One Euro (Casiez et al., 2012): ferma il tremolio quando la mano è quasi ferma e
// segue subito quando si muove veloce. minCutoff abbassa il tremolio, beta riduce il ritardo.

type Scalar = { x: number; dx: number; t: number };

const alpha = (cutoff: number, dtSeconds: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtSeconds);
};

// Oltre questa distanza fra polsi (frazioni dell'immagine) è un'altra mano.
const MATCH_DISTANCE = 0.2;

type Track = { wrist: Landmark; points: Scalar[] };

export type HandSmoother = { smooth(frame: Frame): Frame; reset(): void };

export function createHandSmoother(options: {
  minCutoff: number;
  beta: number;
  dCutoff?: number;
}): HandSmoother {
  const dCutoff = options.dCutoff ?? 1;
  let tracks: Track[] = [];

  const filterValue = (state: Scalar | undefined, x: number, t: number): Scalar => {
    if (!state) return { x, dx: 0, t };
    const dt = (t - state.t) / 1000;
    if (dt <= 0) return state;
    const dx = (x - state.x) / dt;
    const edx = state.dx + alpha(dCutoff, dt) * (dx - state.dx);
    const cutoff = options.minCutoff + options.beta * Math.abs(edx);
    return { x: state.x + alpha(cutoff, dt) * (x - state.x), dx: edx, t };
  };

  const smoothHand = (hand: Hand, track: Track | undefined, t: number): Track => {
    const points: Scalar[] = [];
    hand.landmarks.forEach((p, i) => {
      // Tre coordinate per punto: x, y, z in fila.
      points[i * 3] = filterValue(track?.points[i * 3], p.x, t);
      points[i * 3 + 1] = filterValue(track?.points[i * 3 + 1], p.y, t);
      points[i * 3 + 2] = filterValue(track?.points[i * 3 + 2], p.z, t);
    });
    return { wrist: hand.landmarks[0] ?? { x: 0, y: 0, z: 0 }, points };
  };

  // Abbina ogni mano alla traccia col polso più vicino: MediaPipe può scambiarne l'ordine.
  const matchTrack = (hand: Hand, free: Track[]): Track | undefined => {
    const wrist = hand.landmarks[0];
    if (!wrist) return undefined;
    let best: Track | undefined;
    let bestDistance = MATCH_DISTANCE;
    for (const track of free) {
      const d = Math.hypot(track.wrist.x - wrist.x, track.wrist.y - wrist.y);
      if (d < bestDistance) {
        best = track;
        bestDistance = d;
      }
    }
    return best;
  };

  return {
    smooth(frame) {
      const free = [...tracks];
      const next: Track[] = [];
      const hands = frame.hands.map((hand) => {
        const previous = matchTrack(hand, free);
        if (previous) free.splice(free.indexOf(previous), 1);
        const track = smoothHand(hand, previous, frame.t);
        next.push(track);
        return {
          landmarks: hand.landmarks.map((_, i) => ({
            x: track.points[i * 3]!.x,
            y: track.points[i * 3 + 1]!.x,
            z: track.points[i * 3 + 2]!.x,
          })),
        };
      });
      tracks = next;
      return { t: frame.t, hands };
    },
    reset() {
      tracks = [];
    },
  };
}
