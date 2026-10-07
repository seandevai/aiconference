// Taratura del riconoscimento: un solo oggetto, predefiniti = comportamento attuale.
// Il laboratorio gesture la cambia; la call usa i predefiniti finché non si decide altro.

export type Timings = {
  holdMs: number;
  cooldownMs: number;
  // La mano deve restare ferma (in frazioni dell'immagine) perché un hold conti.
  stillness: number;
  swipe: { distance: number; withinMs: number };
  flick: { distance: number; withinMs: number };
  spread: { distance: number; withinMs: number };
};

export type PoseThresholds = {
  pinchOn: number;
  pinchOff: number;
  extended: number;
  folded: number;
  thumbMargin: number;
};

export type Tuning = {
  timings: Timings;
  pose: PoseThresholds;
  smoothing: { enabled: boolean; minCutoff: number; beta: number };
  // Fotogrammi uguali di fila prima che una posa nuova valga. 1 = subito, come oggi.
  stability: { frames: number };
};

export const DEFAULT_POSE_THRESHOLDS: PoseThresholds = {
  pinchOn: 0.25,
  pinchOff: 0.35,
  extended: 1.6,
  folded: 1.2,
  thumbMargin: 0.3,
};

export const DEFAULT_TUNING: Tuning = {
  timings: {
    holdMs: 1_000,
    cooldownMs: 800,
    stillness: 0.08,
    swipe: { distance: 0.25, withinMs: 400 },
    flick: { distance: 0.25, withinMs: 300 },
    spread: { distance: 0.2, withinMs: 600 },
  },
  pose: DEFAULT_POSE_THRESHOLDS,
  smoothing: { enabled: false, minCutoff: 1.0, beta: 0.007 },
  stability: { frames: 1 },
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function motion(value: unknown, fallback: { distance: number; withinMs: number }) {
  const v = record(value);
  return {
    distance: num(v.distance, fallback.distance, 0.05, 0.6),
    withinMs: num(v.withinMs, fallback.withinMs, 100, 1_500),
  };
}

// Da storage o cursori: ogni campo mancante prende il predefinito, ogni numero un limite.
export function clampTuning(value: unknown): Tuning {
  const v = record(value);
  const t = record(v.timings);
  const p = record(v.pose);
  const s = record(v.smoothing);
  const st = record(v.stability);
  const d = DEFAULT_TUNING;

  const pinchOn = num(p.pinchOn, d.pose.pinchOn, 0.05, 0.6);
  const extended = num(p.extended, d.pose.extended, 1.0, 2.5);
  return {
    timings: {
      holdMs: num(t.holdMs, d.timings.holdMs, 200, 3_000),
      cooldownMs: num(t.cooldownMs, d.timings.cooldownMs, 0, 3_000),
      stillness: num(t.stillness, d.timings.stillness, 0.01, 0.3),
      swipe: motion(t.swipe, d.timings.swipe),
      flick: motion(t.flick, d.timings.flick),
      spread: motion(t.spread, d.timings.spread),
    },
    pose: {
      pinchOn,
      pinchOff: num(p.pinchOff, d.pose.pinchOff, pinchOn + 0.01, 0.8),
      extended,
      folded: num(p.folded, d.pose.folded, 0.5, extended - 0.05),
      thumbMargin: num(p.thumbMargin, d.pose.thumbMargin, 0, 1),
    },
    smoothing: {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : d.smoothing.enabled,
      minCutoff: num(s.minCutoff, d.smoothing.minCutoff, 0.01, 10),
      beta: num(s.beta, d.smoothing.beta, 0, 1),
    },
    stability: { frames: Math.round(num(st.frames, d.stability.frames, 1, 10)) },
  };
}
