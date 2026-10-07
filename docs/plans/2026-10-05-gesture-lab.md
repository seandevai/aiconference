# Laboratorio gesture — piano di implementazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, task per task. I passi usano le caselle
> (`- [ ]`) per il tracciamento.

**Obiettivo:** una pagina `/dev/gesture-lab`, solo per lo sviluppo, dove Sean vede la mano, la
posa e i numeri che la decidono, cambia dizionario e soglie, accende una per una quattro
correzioni della «meccanicità» e rigioca le registrazioni, sul palco vero. Con i predefiniti
la call resta identica a oggi.

**Architettura:** `packages/gesture` diventa una catena regolabile: `Tuning` (soglie e
correzioni, predefiniti = valori attuali) → filtro One Euro opzionale → riconoscitore con
stabilità delle pose e una `view()` dello stato interno → `createPipeline`, usata da
`startGestures` e dal rigioco. Nell'app: la traduzione eventi → comandi del palco esce da
`use-gestures.ts` in `createStageGestureHandler` (seconda implementazione: la call e il
laboratorio); funzioni pure del laboratorio in `apps/web/src/lib/gesture-lab/`; pagina in
`apps/web/src/app/dev/gesture-lab/`.

**Stack:** TypeScript strict, React 19, Next.js 16 App Router, MediaPipe Tasks Vision,
Vitest (happy-dom, Testing Library), Tailwind v4 con i token Nod.

**Spec:** `docs/specs/2026-10-05-gesture-lab-design.md`

Branch: `slice/gesture-lab` (da `main`, contiene la spec).

## Vincoli globali

- Con `DEFAULT_TUNING` e `DEFAULT_DICTIONARY` gli eventi prodotti sono identici a oggi: i test
  esistenti `gesture-recognizer`, `gesture-pose`, `gesture-fixtures`, `gesture-actions`,
  `gesture-adaptive` passano **senza modifiche**.
- Predefiniti: `timings` = `holdMs 1000`, `cooldownMs 800`, `stillness 0.08`, swipe
  `0.25/400`, flick `0.25/300`, spread `0.2/600`; `pose` = `pinchOn 0.25`, `pinchOff 0.35`,
  `extended 1.6`, `folded 1.2`, `thumbMargin 0.3`; `smoothing` = `enabled false`,
  `minCutoff 1.0`, `beta 0.007`; `stability.frames 1`.
- `packages/gesture` non conosce finestre, stanze né rete (confine del repo).
- La pagina risponde `notFound()` in produzione, come `/dev/gesture-recorder`.
- Nessuna immagine salvata o inviata: solo landmark in memoria (regola 1).
- `localStorage` chiave `gesture-lab:v1`; ogni accesso in try/catch.
- Testi dell'interfaccia in italiano; codice, test e commit in inglese; commenti in italiano.
- Colori solo dai token (`bg`, `surface`, `stage`, `raised`, `line`, `fg`, `muted`, `accent`,
  `danger`); niente `neutral-*` nella pagina nuova.
- Commit con trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Focus della revisione

1. **Mani che si scambiano d'ordine** fra due fotogrammi: il filtro non deve mescolarle.
   Test in Task 3.
2. **Taratura incoerente da cursori o storage** (`pinchOn ≥ pinchOff`, `frames 0`, valori
   NaN): `clampTuning` la riporta in limiti sensati. Test in Task 1.
3. **Finestra degli swipe più lunga di quella delle due mani** (oggi i campioni del palmo si
   tengono per `spread.withinMs`): con tarature diverse lo swipe non deve sparire. Test in
   Task 2.
4. **File di rigioco non valido** (JSON di altro tipo, mani con meno di 21 punti): rifiutato,
   pagina intatta. Test in Task 6.
5. **Storage assente o corrotto:** la pagina parte dai predefiniti. Test in Task 6.

## Mappa dei file

| File | Responsabilità |
|---|---|
| `packages/gesture/src/tuning.ts` | `Tuning`, `DEFAULT_TUNING`, `clampTuning` |
| `packages/gesture/src/pose.ts` | `classifyPose` con soglie, `poseMetrics` |
| `packages/gesture/src/recognizer.ts` | riconoscitore con tuning, stabilità, `view()`; `GESTURE_NAMES`, `GESTURE_COMMANDS` |
| `packages/gesture/src/filter.ts` | filtro One Euro per mano |
| `packages/gesture/src/pipeline.ts` | `createPipeline` |
| `packages/gesture/src/runner.ts` | webcam → pipeline, `reconfigure` |
| `apps/web/src/lib/stage/stage-gesture-handler.ts` | eventi → comandi del palco (call e laboratorio) |
| `apps/web/src/lib/stage/cursor-motion.ts` | `followPoint` |
| `apps/web/src/lib/gesture-lab/settings.ts` | impostazioni, storage, cursori, «Copia come codice» |
| `apps/web/src/lib/gesture-lab/recording.ts` | validazione e rigioco delle registrazioni |
| `apps/web/src/lib/gesture-lab/event-log.ts` | elenco eventi |
| `apps/web/src/lib/gesture-lab/lab-stage.ts` | palco iniziale di prova |
| `apps/web/src/lib/gesture-lab/hand-drawing.ts` | scheletro su canvas |
| `apps/web/src/lib/gesture-lab/use-gesture-lab.ts` | stato e collegamenti della pagina |
| `apps/web/src/app/dev/gesture-lab/*` | pagina e componenti |

---

### Task 1: taratura e pose con soglie

**Files:**
- Create: `packages/gesture/src/tuning.ts`
- Modify: `packages/gesture/src/pose.ts`, `packages/gesture/src/index.ts`
- Test: `tests/unit/gesture-tuning.test.ts`

**Interfaces:**
- Produces:
  - `type Timings`, `type PoseThresholds`, `type Tuning` (forma nella spec §1.1)
  - `DEFAULT_TUNING: Tuning`, `DEFAULT_POSE_THRESHOLDS: PoseThresholds`
  - `clampTuning(value: unknown): Tuning`
  - `classifyPose(hand: Hand, wasPinching?: boolean, thresholds?: PoseThresholds): Pose`
  - `type PoseMetrics = { fingers: Record<Finger, number>; pinch: number; thumbExtended: boolean }`, `poseMetrics(hand: Hand): PoseMetrics`
  - `PINCH_ON`, `PINCH_OFF` restano esportati con gli stessi valori

- [ ] **Step 1: Write the failing test**

`tests/unit/gesture-tuning.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  PINCH_OFF,
  PINCH_ON,
  clampTuning,
  classifyPose,
  poseMetrics,
} from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

describe('DEFAULT_TUNING', () => {
  it('keeps today values, with corrections off', () => {
    expect(DEFAULT_TUNING).toEqual({
      timings: {
        holdMs: 1_000,
        cooldownMs: 800,
        stillness: 0.08,
        swipe: { distance: 0.25, withinMs: 400 },
        flick: { distance: 0.25, withinMs: 300 },
        spread: { distance: 0.2, withinMs: 600 },
      },
      pose: { pinchOn: 0.25, pinchOff: 0.35, extended: 1.6, folded: 1.2, thumbMargin: 0.3 },
      smoothing: { enabled: false, minCutoff: 1.0, beta: 0.007 },
      stability: { frames: 1 },
    });
    expect(PINCH_ON).toBe(0.25);
    expect(PINCH_OFF).toBe(0.35);
  });
});

describe('clampTuning', () => {
  it('fills missing or invalid fields with the defaults', () => {
    expect(clampTuning(undefined)).toEqual(DEFAULT_TUNING);
    expect(clampTuning({ timings: { holdMs: 'x' }, stability: { frames: Number.NaN } })).toEqual(
      DEFAULT_TUNING,
    );
  });

  it('keeps values inside sensible bounds', () => {
    const tuning = clampTuning({
      timings: { holdMs: 50, cooldownMs: 99_999 },
      smoothing: { enabled: true, minCutoff: -1, beta: 5 },
      stability: { frames: 0 },
    });
    expect(tuning.timings.holdMs).toBe(200);
    expect(tuning.timings.cooldownMs).toBe(3_000);
    expect(tuning.smoothing).toEqual({ enabled: true, minCutoff: 0.01, beta: 1 });
    expect(tuning.stability.frames).toBe(1);
  });

  it('keeps pinch-on below pinch-off and folded below extended', () => {
    const tuning = clampTuning({ pose: { pinchOn: 0.5, pinchOff: 0.3, extended: 1.1, folded: 1.4 } });
    expect(tuning.pose.pinchOn).toBeLessThan(tuning.pose.pinchOff);
    expect(tuning.pose.folded).toBeLessThan(tuning.pose.extended);
  });

  it('rounds the stability frames to an integer', () => {
    expect(clampTuning({ stability: { frames: 3.6 } }).stability.frames).toBe(4);
  });
});

describe('classifyPose with thresholds', () => {
  it('follows the thresholds it is given', () => {
    const palm = hand('open_palm');
    expect(classifyPose(palm)).toBe('open_palm');
    expect(classifyPose(palm, false, { ...DEFAULT_TUNING.pose, extended: 10 })).toBe('none');
  });
});

describe('poseMetrics', () => {
  it('reports finger ratios, pinch and thumb', () => {
    const open = poseMetrics(hand('open_palm'));
    expect(Object.keys(open.fingers)).toEqual(['index', 'middle', 'ring', 'pinky']);
    expect(Object.values(open.fingers).every((r) => r > 1.6)).toBe(true);
    expect(open.thumbExtended).toBe(true);
    const fist = poseMetrics(hand('fist'));
    expect(Object.values(fist.fingers).every((r) => r < 1.2)).toBe(true);
    expect(fist.thumbExtended).toBe(false);
    expect(poseMetrics(hand('pinch')).pinch).toBeLessThan(0.25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/gesture-tuning.test.ts`
Expected: FAIL, `DEFAULT_TUNING` / `clampTuning` / `poseMetrics` non esportati.

- [ ] **Step 3: `tuning.ts`**

`packages/gesture/src/tuning.ts`:

```ts
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
```

- [ ] **Step 4: thresholds and metrics in `pose.ts`**

`packages/gesture/src/pose.ts`, file completo:

```ts
import { fingerRatio, palmSize, pinchRatio, thumbExtended, type Finger } from './geometry';
import { DEFAULT_POSE_THRESHOLDS, type PoseThresholds } from './tuning';
import type { Hand, Pose } from './types';

export const PINCH_ON = DEFAULT_POSE_THRESHOLDS.pinchOn;
export const PINCH_OFF = DEFAULT_POSE_THRESHOLDS.pinchOff;

const FINGER_NAMES: Finger[] = ['index', 'middle', 'ring', 'pinky'];
const OTHERS: Finger[] = ['middle', 'ring', 'pinky'];

export function classifyPose(
  hand: Hand,
  wasPinching = false,
  thresholds: PoseThresholds = DEFAULT_POSE_THRESHOLDS,
): Pose {
  if (hand.landmarks.length < 21) return 'none';
  if (pinchRatio(hand) < (wasPinching ? thresholds.pinchOff : thresholds.pinchOn)) return 'pinch';

  const extended = (f: Finger) => fingerRatio(hand, f) > thresholds.extended;
  const folded = (f: Finger) => fingerRatio(hand, f) < thresholds.folded;
  const thumb = thumbExtended(hand);
  const fourExtended = extended('index') && OTHERS.every(extended);
  const fourFolded = folded('index') && OTHERS.every(folded);

  if (fourExtended && thumb) return 'open_palm';
  if (extended('index') && OTHERS.every(folded) && !thumb) return 'index_up';
  if (fourFolded && thumb) {
    const tip = hand.landmarks[4]!;
    const base = hand.landmarks[2]!;
    const margin = thresholds.thumbMargin * palmSize(hand);
    if (tip.y < base.y - margin) return 'thumb_up';
    if (tip.y > base.y + margin) return 'thumb_down';
  }
  if (fourFolded && !thumb) return 'fist';
  return 'none';
}

export type PoseMetrics = {
  fingers: Record<Finger, number>;
  pinch: number;
  thumbExtended: boolean;
};

// I numeri che decidono la posa, per il laboratorio: rapporti delle dita e del pinch.
export function poseMetrics(hand: Hand): PoseMetrics {
  const fingers = Object.fromEntries(
    FINGER_NAMES.map((f) => [f, fingerRatio(hand, f)]),
  ) as Record<Finger, number>;
  return { fingers, pinch: pinchRatio(hand), thumbExtended: thumbExtended(hand) };
}
```

- [ ] **Step 5: exports**

In `packages/gesture/src/index.ts` sostituire la riga di `pose` e aggiungere quella di `tuning`:

```ts
export { PINCH_OFF, PINCH_ON, classifyPose, poseMetrics, type PoseMetrics } from './pose';
export {
  DEFAULT_POSE_THRESHOLDS,
  DEFAULT_TUNING,
  clampTuning,
  type PoseThresholds,
  type Timings,
  type Tuning,
} from './tuning';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/gesture-tuning.test.ts tests/unit/gesture-pose.test.ts tests/unit/gesture-recognizer.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/gesture/src/tuning.ts packages/gesture/src/pose.ts packages/gesture/src/index.ts tests/unit/gesture-tuning.test.ts
git commit -m "feat(gesture): tuning object with today's defaults and pose thresholds"
```

---

### Task 2: riconoscitore con taratura, stabilità e `view()`

**Files:**
- Modify: `packages/gesture/src/recognizer.ts`, `packages/gesture/src/index.ts`
- Test: `tests/unit/gesture-recognizer-tuning.test.ts`

**Interfaces:**
- Consumes: `Tuning`, `DEFAULT_TUNING`, `classifyPose(hand, wasPinching, thresholds)` (Task 1)
- Produces:
  - `createRecognizer(options?: { dictionary?: Dictionary; armed?: boolean; twoHands?: boolean; tuning?: Tuning })`
  - `type RecognizerView = { rawPose: Pose; pose: Pose; hold: { pose: Pose; progress: number } | null; armed: boolean; cooldownLeftMs: number; dragging: boolean }`
  - `Recognizer` acquisisce `view(): RecognizerView`
  - `GESTURE_NAMES: readonly GestureName[]`, `GESTURE_COMMANDS: readonly GestureCommand[]`
  - `TIMINGS` resta esportato (= `DEFAULT_TUNING.timings`)

- [ ] **Step 1: Write the failing test**

`tests/unit/gesture-recognizer-tuning.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DICTIONARY,
  DEFAULT_TUNING,
  GESTURE_COMMANDS,
  GESTURE_NAMES,
  createRecognizer,
  type Frame,
  type Hand,
  type Tuning,
} from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const STEP = 33;

function span(from: number, to: number, make: (progress: number) => Hand[]): Frame[] {
  const frames: Frame[] = [];
  for (let t = from; t <= to; t += STEP)
    frames.push({ t, hands: make((t - from) / Math.max(1, to - from)) });
  return frames;
}

const tuned = (over: Partial<Tuning>): Tuning => ({ ...DEFAULT_TUNING, ...over });

describe('stability', () => {
  // Indice alzato per 1,1 s con un fotogramma di pugno a metà (sfarfallio).
  const glitchy = span(0, 1_100, () => [hand('index_up')]).map((frame) =>
    frame.t === 495 ? { ...frame, hands: [hand('fist')] } : frame,
  );

  it('with one frame a single glitch restarts the hold', () => {
    const recognizer = createRecognizer({ armed: true });
    const events = glitchy.flatMap((f) => recognizer.push(f));
    expect(events).toEqual([]);
  });

  it('with three frames a single glitch is ignored', () => {
    const recognizer = createRecognizer({ armed: true, tuning: tuned({ stability: { frames: 3 } }) });
    const events = glitchy.flatMap((f) => recognizer.push(f));
    expect(events).toEqual([{ type: 'AGENT_ACTIVATE' }]);
  });
});

describe('tuned timings', () => {
  it('fires a hold sooner with a shorter hold time', () => {
    const recognizer = createRecognizer({
      armed: true,
      tuning: tuned({ timings: { ...DEFAULT_TUNING.timings, holdMs: 400 } }),
    });
    const events = span(0, 500, () => [hand('index_up')]).flatMap((f) => recognizer.push(f));
    expect(events).toEqual([{ type: 'AGENT_ACTIVATE' }]);
  });

  it('keeps swipe samples when the swipe window is longer than the two-hands one', () => {
    const recognizer = createRecognizer({
      armed: true,
      tuning: tuned({
        timings: {
          ...DEFAULT_TUNING.timings,
          swipe: { distance: 0.25, withinMs: 900 },
          spread: { distance: 0.2, withinMs: 300 },
        },
      }),
    });
    // 0,3 di immagine in 800 ms: troppo lento per i 400 ms di oggi, valido con 900.
    const frames = span(0, 800, (k) => [hand('fist', { x: 0.35 + 0.3 * k, y: 0.5 })]);
    const events = frames.flatMap((f) => recognizer.push(f));
    expect(events).toEqual([{ type: 'FOCUS_NEXT' }]);
  });
});

describe('view', () => {
  it('shows the hold progress, then the cooldown', () => {
    const recognizer = createRecognizer({ armed: true });
    span(0, 500, () => [hand('index_up')]).forEach((f) => recognizer.push(f));
    const halfway = recognizer.view();
    expect(halfway.rawPose).toBe('index_up');
    expect(halfway.pose).toBe('index_up');
    expect(halfway.hold?.pose).toBe('index_up');
    expect(halfway.hold?.progress).toBeCloseTo(0.5, 1);

    span(528, 1_100, () => [hand('index_up')]).forEach((f) => recognizer.push(f));
    const after = recognizer.view();
    expect(after.hold).toBeNull();
    expect(after.cooldownLeftMs).toBeGreaterThan(0);
    expect(after.armed).toBe(true);
  });

  it('reports dragging and the raw pose before stabilizing', () => {
    const recognizer = createRecognizer({ armed: true, tuning: tuned({ stability: { frames: 3 } }) });
    recognizer.push({ t: 0, hands: [hand('fist')] });
    recognizer.push({ t: 33, hands: [hand('fist')] });
    recognizer.push({ t: 66, hands: [hand('fist')] });
    recognizer.push({ t: 99, hands: [hand('index_up')] });
    expect(recognizer.view()).toMatchObject({ rawPose: 'index_up', pose: 'fist', dragging: false });
  });

  it('starts empty', () => {
    expect(createRecognizer().view()).toEqual({
      rawPose: 'none',
      pose: 'none',
      hold: null,
      armed: false,
      cooldownLeftMs: 0,
      dragging: false,
    });
  });
});

describe('dictionary lists', () => {
  it('lists every gesture and every command', () => {
    expect([...GESTURE_NAMES].sort()).toEqual(Object.keys(DEFAULT_DICTIONARY).sort());
    expect(GESTURE_COMMANDS).toEqual([
      'GESTURES_TOGGLE',
      'AGENT_ACTIVATE',
      'CONFIRM',
      'REJECT',
      'DRAG',
      'FOCUS_NEXT',
      'FOCUS_PREV',
      'WINDOW_ARCHIVE',
      'WINDOW_CREATE',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/gesture-recognizer-tuning.test.ts`
Expected: FAIL (`GESTURE_NAMES` non esportato; `view` non è una funzione).

- [ ] **Step 3: the recognizer**

`packages/gesture/src/recognizer.ts`, file completo:

```ts
import { palmCenter, pinchPoint } from './geometry';
import { classifyPose } from './pose';
import { DEFAULT_TUNING, type Tuning } from './tuning';
import type {
  Dictionary,
  Frame,
  GestureCommand,
  GestureEvent,
  GestureName,
  Point,
  Pose,
} from './types';

export const DEFAULT_DICTIONARY: Dictionary = {
  open_palm_hold: 'GESTURES_TOGGLE',
  index_up_hold: 'AGENT_ACTIVATE',
  pinch_drag: 'DRAG',
  swipe_left: 'FOCUS_NEXT',
  swipe_right: 'FOCUS_PREV',
  two_hands_spread: 'WINDOW_CREATE',
  thumb_up_hold: 'CONFIRM',
  thumb_down_hold: 'REJECT',
  flick_up: 'WINDOW_ARCHIVE',
};

export const GESTURE_NAMES = Object.keys(DEFAULT_DICTIONARY) as readonly GestureName[];

export const GESTURE_COMMANDS: readonly GestureCommand[] = [
  'GESTURES_TOGGLE',
  'AGENT_ACTIVATE',
  'CONFIRM',
  'REJECT',
  'DRAG',
  'FOCUS_NEXT',
  'FOCUS_PREV',
  'WINDOW_ARCHIVE',
  'WINDOW_CREATE',
];

// Compatibilità: i tempi predefiniti, gli stessi di DEFAULT_TUNING.
export const TIMINGS = DEFAULT_TUNING.timings;

const HOLDS: Partial<Record<Pose, GestureName>> = {
  open_palm: 'open_palm_hold',
  index_up: 'index_up_hold',
  thumb_up: 'thumb_up_hold',
  thumb_down: 'thumb_down_hold',
};

// Cosa sta «pensando» il riconoscitore: il laboratorio ci disegna sopra anello e posa.
export type RecognizerView = {
  rawPose: Pose;
  pose: Pose;
  hold: { pose: Pose; progress: number } | null;
  armed: boolean;
  cooldownLeftMs: number;
  dragging: boolean;
};

export type Recognizer = {
  push(frame: Frame): GestureEvent[];
  setArmed(armed: boolean): void;
  setTwoHands(on: boolean): void;
  isArmed(): boolean;
  view(): RecognizerView;
};

type Sample = Point & { t: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function oldestWithin<T extends { t: number }>(
  samples: T[],
  t: number,
  withinMs: number,
): T | undefined {
  return samples.find((s) => t - s.t <= withinMs);
}

export function createRecognizer(
  options: { dictionary?: Dictionary; armed?: boolean; twoHands?: boolean; tuning?: Tuning } = {},
): Recognizer {
  const dictionary = options.dictionary ?? DEFAULT_DICTIONARY;
  const { timings, pose: thresholds, stability } = options.tuning ?? DEFAULT_TUNING;
  // I campioni del palmo servono a swipe, flick e due mani: si tiene la finestra più lunga.
  const motionWindowMs = Math.max(
    timings.swipe.withinMs,
    timings.flick.withinMs,
    timings.spread.withinMs,
  );
  let armed = options.armed ?? false;
  let twoHands = options.twoHands ?? true;

  let hold: { pose: Pose; start: number; anchor: Point; fired: boolean } | null = null;
  let rawPinching = false;
  let dragging: Point | null = null;
  let cooldownUntil = 0;
  let palms: Sample[] = [];
  let spreads: { t: number; d: number }[] = [];
  let rawPose: Pose = 'none';
  let stable: { pose: Pose; candidate: Pose; count: number } = {
    pose: 'none',
    candidate: 'none',
    count: 0,
  };
  let lastT = 0;

  const resetMotion = () => {
    palms = [];
    spreads = [];
  };

  // Una posa nuova vale dopo `stability.frames` fotogrammi uguali di fila.
  const stabilize = (next: Pose): Pose => {
    if (next === stable.candidate) stable.count += 1;
    else stable = { pose: stable.pose, candidate: next, count: 1 };
    if (stable.count >= stability.frames) stable.pose = next;
    return stable.pose;
  };

  const fire = (name: GestureName, t: number, out: GestureEvent[]) => {
    const command: GestureCommand | null = dictionary[name];
    if (!command || command === 'DRAG' || t < cooldownUntil) return;
    if (command === 'GESTURES_TOGGLE') {
      armed = !armed;
      out.push({ type: 'GESTURES_TOGGLE', armed });
    } else {
      if (!armed) return;
      out.push({ type: command });
    }
    cooldownUntil = t + timings.cooldownMs;
    resetMotion();
  };

  return {
    push(frame) {
      const out: GestureEvent[] = [];
      const { t } = frame;
      lastT = t;
      const primary = frame.hands[0];

      if (!primary) {
        hold = null;
        rawPinching = false;
        rawPose = 'none';
        stable = { pose: 'none', candidate: 'none', count: 0 };
        resetMotion();
        if (dragging) out.push({ type: 'DROP', ...dragging });
        dragging = null;
        return out;
      }

      rawPose = classifyPose(primary, rawPinching, thresholds);
      rawPinching = rawPose === 'pinch';
      const pose = stabilize(rawPose);
      const pinching = pose === 'pinch';
      const center = palmCenter(primary);

      // Pinch-trascina-rilascia: un GRAB, un MOVE per frame, un DROP.
      const dragAllowed = armed && dictionary.pinch_drag === 'DRAG';
      if (dragging && !(pinching && dragAllowed)) {
        out.push({ type: 'DROP', ...dragging });
        dragging = null;
      } else if (pinching && dragAllowed) {
        const point = pinchPoint(primary);
        out.push({ type: dragging ? 'MOVE' : 'GRAB', ...point });
        dragging = point;
      }
      if (dragging) {
        hold = null;
        resetMotion();
        return out;
      }

      // Hold: stessa posa, mano ferma, per holdMs. Un solo evento per hold.
      const holdName = HOLDS[pose];
      if (!holdName) {
        hold = null;
      } else if (!hold || hold.pose !== pose || distance(hold.anchor, center) > timings.stillness) {
        hold = { pose, start: t, anchor: center, fired: false };
      } else if (!hold.fired && t - hold.start >= timings.holdMs) {
        hold.fired = true;
        fire(holdName, t, out);
      }

      // Movimenti: swipe e flick sul centro del palmo, due mani sulla loro distanza.
      palms = [...palms.filter((s) => t - s.t <= motionWindowMs), { t, ...center }];
      const swipeFrom = oldestWithin(palms, t, timings.swipe.withinMs);
      if (swipeFrom) {
        const dx = center.x - swipeFrom.x;
        const dy = center.y - swipeFrom.y;
        if (Math.abs(dx) >= timings.swipe.distance && Math.abs(dy) < Math.abs(dx) / 2) {
          // Immagine verso destra = schermo (a specchio) verso sinistra.
          fire(dx > 0 ? 'swipe_left' : 'swipe_right', t, out);
        }
      }
      const flickFrom = oldestWithin(palms, t, timings.flick.withinMs);
      if (flickFrom && pose === 'open_palm') {
        const dx = center.x - flickFrom.x;
        const dy = center.y - flickFrom.y;
        if (dy <= -timings.flick.distance && Math.abs(dx) < Math.abs(dy) / 2)
          fire('flick_up', t, out);
      }

      const second = frame.hands[1];
      if (twoHands && second) {
        const d = distance(center, palmCenter(second));
        spreads = [...spreads.filter((s) => t - s.t <= timings.spread.withinMs), { t, d }];
        const from = oldestWithin(spreads, t, timings.spread.withinMs);
        if (from && d - from.d >= timings.spread.distance) fire('two_hands_spread', t, out);
      } else {
        spreads = [];
      }

      return out;
    },

    setArmed(value) {
      armed = value;
      if (!value) dragging = null;
    },

    setTwoHands(on) {
      twoHands = on;
      spreads = [];
    },

    isArmed: () => armed,

    view() {
      return {
        rawPose,
        pose: stable.pose,
        hold:
          hold && !hold.fired
            ? { pose: hold.pose, progress: Math.min(1, (lastT - hold.start) / timings.holdMs) }
            : null,
        armed,
        cooldownLeftMs: Math.max(0, cooldownUntil - lastT),
        dragging: dragging !== null,
      };
    },
  };
}
```

Nota per chi rivede: con `DEFAULT_TUNING` `stable.pose === rawPose` a ogni fotogramma e
`motionWindowMs === spread.withinMs` (600), quindi gli eventi sono identici a prima.

- [ ] **Step 4: exports**

In `packages/gesture/src/index.ts` la riga del riconoscitore diventa:

```ts
export {
  DEFAULT_DICTIONARY,
  GESTURE_COMMANDS,
  GESTURE_NAMES,
  TIMINGS,
  createRecognizer,
  type Recognizer,
  type RecognizerView,
} from './recognizer';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/gesture-recognizer-tuning.test.ts tests/unit/gesture-recognizer.test.ts tests/unit/gesture-pose.test.ts tests/unit/gesture-fixtures.test.ts && npm run typecheck`
Expected: PASS; `gesture-recognizer.test.ts` invariato e verde.

- [ ] **Step 6: Commit**

```bash
git add packages/gesture/src/recognizer.ts packages/gesture/src/index.ts tests/unit/gesture-recognizer-tuning.test.ts
git commit -m "feat(gesture): tunable recognizer with pose stability and an inspection view"
```

---

### Task 3: filtro anti-tremolio

**Files:**
- Create: `packages/gesture/src/filter.ts`
- Modify: `packages/gesture/src/index.ts`
- Test: `tests/unit/gesture-filter.test.ts`

**Interfaces:**
- Produces: `createHandSmoother(options: { minCutoff: number; beta: number; dCutoff?: number }): HandSmoother`, `type HandSmoother = { smooth(frame: Frame): Frame; reset(): void }`

- [ ] **Step 1: Write the failing test**

`tests/unit/gesture-filter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createHandSmoother, type Frame, type Hand } from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const shift = (h: Hand, dx: number, dy = 0): Hand => ({
  landmarks: h.landmarks.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z })),
});

const wristX = (frame: Frame, i = 0) => frame.hands[i]!.landmarks[0]!.x;

describe('createHandSmoother', () => {
  it('passes the first frame through unchanged', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    const frame = { t: 0, hands: [hand('open_palm')] };
    expect(smoother.smooth(frame)).toEqual(frame);
  });

  it('reduces jitter on a still hand', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    const base = hand('open_palm');
    const outputs: number[] = [];
    for (let i = 0; i < 60; i++) {
      const noise = i % 2 === 0 ? 0.01 : -0.01;
      outputs.push(wristX(smoother.smooth({ t: i * 33, hands: [shift(base, noise)] })));
    }
    const tail = outputs.slice(30);
    const spread = Math.max(...tail) - Math.min(...tail);
    expect(spread).toBeLessThan(0.02 * 0.5);
  });

  it('catches up with a hand that moved and stays there', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0.5 });
    const base = hand('open_palm');
    smoother.smooth({ t: 0, hands: [base] });
    let last = 0;
    for (let t = 33; t <= 1_000; t += 33) last = wristX(smoother.smooth({ t, hands: [shift(base, 0.3)] }));
    expect(Math.abs(last - wristX({ t: 0, hands: [shift(base, 0.3)] }))).toBeLessThan(0.01);
  });

  it('forgets a hand that disappeared', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    smoother.smooth({ t: 0, hands: [hand('open_palm')] });
    smoother.smooth({ t: 33, hands: [] });
    const far = { t: 66, hands: [shift(hand('open_palm'), 0.3)] };
    expect(smoother.smooth(far)).toEqual(far);
  });

  it('keeps each hand on its own track when MediaPipe swaps their order', () => {
    const smoother = createHandSmoother({ minCutoff: 1, beta: 0 });
    const left = hand('open_palm', { x: 0.25, y: 0.5 });
    const right = hand('open_palm', { x: 0.75, y: 0.5 });
    smoother.smooth({ t: 0, hands: [left, right] });
    const swapped = smoother.smooth({ t: 33, hands: [right, left] });
    expect(wristX(swapped, 0)).toBeCloseTo(right.landmarks[0]!.x, 5);
    expect(wristX(swapped, 1)).toBeCloseTo(left.landmarks[0]!.x, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/gesture-filter.test.ts`
Expected: FAIL, `createHandSmoother` non esportato.

- [ ] **Step 3: the filter**

`packages/gesture/src/filter.ts`:

```ts
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
```

Nota: il polso della traccia è quello grezzo del fotogramma, così l'abbinamento non dipende
dal ritardo del filtro.

- [ ] **Step 4: exports**

In `packages/gesture/src/index.ts`:

```ts
export { createHandSmoother, type HandSmoother } from './filter';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/gesture-filter.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/gesture/src/filter.ts packages/gesture/src/index.ts tests/unit/gesture-filter.test.ts
git commit -m "feat(gesture): One Euro hand smoother with wrist-based hand matching"
```

---

### Task 4: catena unica e runner

**Files:**
- Create: `packages/gesture/src/pipeline.ts`
- Modify: `packages/gesture/src/runner.ts`, `packages/gesture/src/index.ts`
- Test: `tests/unit/gesture-pipeline.test.ts`

**Interfaces:**
- Consumes: `createRecognizer` con `tuning`, `RecognizerView` (Task 2); `createHandSmoother` (Task 3); `Tuning`, `DEFAULT_TUNING` (Task 1)
- Produces:
  - `createPipeline(options?: { tuning?: Tuning; dictionary?: Dictionary; armed?: boolean; twoHands?: boolean }): Pipeline`
  - `type Pipeline = { push(frame: Frame): PipelineOutput; setArmed(armed: boolean): void; setTwoHands(on: boolean): void; isArmed(): boolean; reconfigure(next: { tuning?: Tuning; dictionary?: Dictionary }): void }`
  - `type PipelineOutput = { frame: Frame; events: GestureEvent[]; view: RecognizerView }`
  - `startGestures(video, { onEvent, onFrame?(raw: Frame, processed: Frame, view: RecognizerView), armed?, dictionary?, tuning? })`
  - `GestureRunner = { setArmed(armed: boolean): void; reconfigure(next: { tuning?: Tuning; dictionary?: Dictionary }): void; stop(): void }`

- [ ] **Step 1: Write the failing test**

`tests/unit/gesture-pipeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  createPipeline,
  createRecognizer,
  type Frame,
  type Hand,
} from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const STEP = 33;
function span(from: number, to: number, make: (progress: number) => Hand[]): Frame[] {
  const frames: Frame[] = [];
  for (let t = from; t <= to; t += STEP)
    frames.push({ t, hands: make((t - from) / Math.max(1, to - from)) });
  return frames;
}

// Un percorso misto: armo, swipe, pinch-trascina, indice alzato, due mani.
const scenario: Frame[] = [
  ...span(0, 1_200, () => [hand('open_palm')]),
  ...span(1_233, 1_300, () => []),
  ...span(2_200, 2_500, (k) => [hand('fist', { x: 0.3 + 0.4 * k, y: 0.5 })]),
  ...span(3_400, 3_800, (k) => [hand('pinch', { x: 0.3 + 0.2 * k, y: 0.5 })]),
  ...span(3_833, 3_900, () => []),
  ...span(4_800, 6_000, () => [hand('index_up')]),
  ...span(7_000, 7_500, (k) => [
    hand('open_palm', { x: 0.4 - 0.15 * k, y: 0.5 }),
    hand('open_palm', { x: 0.6 + 0.15 * k, y: 0.5 }),
  ]),
];

describe('createPipeline', () => {
  it('with the defaults emits exactly what the recognizer emits', () => {
    const recognizer = createRecognizer();
    const pipeline = createPipeline();
    const expected = scenario.flatMap((f) => recognizer.push(f));
    const actual = scenario.flatMap((f) => pipeline.push(f).events);
    expect(actual).toEqual(expected);
    expect(actual.length).toBeGreaterThan(3);
  });

  it('passes frames through untouched when smoothing is off', () => {
    const pipeline = createPipeline();
    const frame = scenario[0]!;
    expect(pipeline.push(frame).frame).toBe(frame);
  });

  it('smooths frames when smoothing is on', () => {
    const pipeline = createPipeline({
      tuning: { ...DEFAULT_TUNING, smoothing: { enabled: true, minCutoff: 1, beta: 0 } },
    });
    pipeline.push({ t: 0, hands: [hand('open_palm', { x: 0.5, y: 0.5 })] });
    const out = pipeline.push({ t: 33, hands: [hand('open_palm', { x: 0.6, y: 0.5 })] });
    const raw = hand('open_palm', { x: 0.6, y: 0.5 }).landmarks[0]!.x;
    expect(out.frame.hands[0]!.landmarks[0]!.x).toBeLessThan(raw);
  });

  it('returns the recognizer view with every push', () => {
    const pipeline = createPipeline({ armed: true });
    const out = pipeline.push({ t: 0, hands: [hand('index_up')] });
    expect(out.view).toMatchObject({ rawPose: 'index_up', armed: true });
  });

  it('keeps the armed state when reconfigured', () => {
    const pipeline = createPipeline({ armed: true });
    pipeline.reconfigure({ tuning: { ...DEFAULT_TUNING, stability: { frames: 3 } } });
    expect(pipeline.isArmed()).toBe(true);
    pipeline.reconfigure({ dictionary: { ...createDictionaryWithout('index_up_hold') } });
    const events = span(0, 1_200, () => [hand('index_up')]).flatMap((f) => pipeline.push(f).events);
    expect(events).toEqual([]);
  });
});

function createDictionaryWithout(name: 'index_up_hold') {
  return {
    open_palm_hold: 'GESTURES_TOGGLE',
    index_up_hold: null,
    pinch_drag: 'DRAG',
    swipe_left: 'FOCUS_NEXT',
    swipe_right: 'FOCUS_PREV',
    two_hands_spread: 'WINDOW_CREATE',
    thumb_up_hold: 'CONFIRM',
    thumb_down_hold: 'REJECT',
    flick_up: 'WINDOW_ARCHIVE',
    [name]: null,
  } as const;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/gesture-pipeline.test.ts`
Expected: FAIL, `createPipeline` non esportato.

- [ ] **Step 3: the pipeline**

`packages/gesture/src/pipeline.ts`:

```ts
import { createHandSmoother, type HandSmoother } from './filter';
import { DEFAULT_DICTIONARY, createRecognizer, type RecognizerView } from './recognizer';
import { DEFAULT_TUNING, type Tuning } from './tuning';
import type { Dictionary, Frame, GestureEvent } from './types';

export type PipelineOutput = { frame: Frame; events: GestureEvent[]; view: RecognizerView };

export type Pipeline = {
  push(frame: Frame): PipelineOutput;
  setArmed(armed: boolean): void;
  setTwoHands(on: boolean): void;
  isArmed(): boolean;
  reconfigure(next: { tuning?: Tuning; dictionary?: Dictionary }): void;
};

const smootherFor = (tuning: Tuning): HandSmoother | null =>
  tuning.smoothing.enabled
    ? createHandSmoother({ minCutoff: tuning.smoothing.minCutoff, beta: tuning.smoothing.beta })
    : null;

// Una sola catena per webcam e rigioco: stesso comportamento dal vivo e su registrazione.
export function createPipeline(
  options: { tuning?: Tuning; dictionary?: Dictionary; armed?: boolean; twoHands?: boolean } = {},
): Pipeline {
  let tuning = options.tuning ?? DEFAULT_TUNING;
  let dictionary = options.dictionary ?? DEFAULT_DICTIONARY;
  let twoHands = options.twoHands ?? true;
  let recognizer = createRecognizer({ tuning, dictionary, armed: options.armed ?? false, twoHands });
  let smoother = smootherFor(tuning);

  return {
    push(frame) {
      const processed = smoother ? smoother.smooth(frame) : frame;
      const events = recognizer.push(processed);
      return { frame: processed, events, view: recognizer.view() };
    },
    setArmed(armed) {
      recognizer.setArmed(armed);
    },
    setTwoHands(on) {
      twoHands = on;
      recognizer.setTwoHands(on);
    },
    isArmed: () => recognizer.isArmed(),
    // Si ricomincia da capo (hold, movimenti, filtro), tenendo solo lo stato armato.
    reconfigure(next) {
      tuning = next.tuning ?? tuning;
      dictionary = next.dictionary ?? dictionary;
      recognizer = createRecognizer({ tuning, dictionary, armed: recognizer.isArmed(), twoHands });
      smoother = smootherFor(tuning);
    },
  };
}
```

- [ ] **Step 4: the runner on the pipeline**

`packages/gesture/src/runner.ts`: sostituire gli import del riconoscitore e il corpo di
`startGestures` come segue (`createLandmarker`, `WASM_BASE`, `HAND_MODEL` restano uguali):

```ts
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { createAdaptiveController } from './adaptive';
import { createPipeline } from './pipeline';
import type { RecognizerView } from './recognizer';
import type { Tuning } from './tuning';
import type { Dictionary, Frame, GestureEvent } from './types';
```

```ts
export type GestureRunner = {
  setArmed(armed: boolean): void;
  reconfigure(next: { tuning?: Tuning; dictionary?: Dictionary }): void;
  stop(): void;
};
```

```ts
export async function startGestures(
  video: HTMLVideoElement,
  options: {
    onEvent(event: GestureEvent): void;
    // Fotogramma grezzo (quello da registrare), quello usato dal riconoscitore e la sua vista.
    onFrame?(raw: Frame, processed: Frame, view: RecognizerView): void;
    armed?: boolean;
    dictionary?: Dictionary;
    tuning?: Tuning;
  },
): Promise<GestureRunner> {
  const landmarker = await createLandmarker();
  const pipeline = createPipeline({
    ...(options.dictionary ? { dictionary: options.dictionary } : {}),
    ...(options.tuning ? { tuning: options.tuning } : {}),
    armed: options.armed ?? false,
  });
  const adaptive = createAdaptiveController();
  let stopped = false;
  let lastRun = 0;
  let handle = 0;

  const tick = (now: number) => {
    if (stopped) return;
    const { fps } = adaptive.current();
    if (now - lastRun >= 1000 / fps && video.readyState >= 2) {
      lastRun = now;
      const started = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const change = adaptive.record(performance.now() - started);
      if (change) {
        pipeline.setTwoHands(change.twoHands);
        void landmarker.setOptions({ numHands: change.twoHands ? 2 : 1 });
      }
      const frame: Frame = {
        t: now,
        hands: result.landmarks.map((points) => ({
          landmarks: points.map(({ x, y, z }) => ({ x, y, z })),
        })),
      };
      const out = pipeline.push(frame);
      options.onFrame?.(frame, out.frame, out.view);
      for (const event of out.events) options.onEvent(event);
    }
    handle = video.requestVideoFrameCallback(tick);
  };
  handle = video.requestVideoFrameCallback(tick);

  return {
    setArmed(armed) {
      pipeline.setArmed(armed);
    },
    reconfigure(next) {
      pipeline.reconfigure(next);
    },
    stop() {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
      landmarker.close();
    },
  };
}
```

Il registratore (`apps/web/src/app/dev/gesture-recorder/recorder.tsx`) passa
`onFrame: (frame) => frames.push(frame)`: il primo argomento resta il grezzo, quindi non
cambia.

- [ ] **Step 5: exports**

In `packages/gesture/src/index.ts`:

```ts
export { createPipeline, type Pipeline, type PipelineOutput } from './pipeline';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/gesture-pipeline.test.ts tests/unit && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/gesture/src/pipeline.ts packages/gesture/src/runner.ts packages/gesture/src/index.ts tests/unit/gesture-pipeline.test.ts
git commit -m "feat(gesture): one pipeline for webcam and replay, runner reconfigurable"
```

---

### Task 5: gestore condiviso del palco e cursore fluido

**Files:**
- Create: `apps/web/src/lib/stage/stage-gesture-handler.ts`, `apps/web/src/lib/stage/cursor-motion.ts`
- Modify: `apps/web/src/lib/stage/use-gestures.ts`
- Test: `tests/unit/stage-gesture-handler.test.ts`, `tests/unit/cursor-motion.test.ts`

**Interfaces:**
- Consumes: `gestureAction` (`gesture-actions.ts`), `dragItemAt`, `resolveDrop`, `slotRectsFromDom` (`drop.ts`), `nearestSlot` (`@omnicanvas/canvas`)
- Produces:
  - `type StageCursor = { x: number; y: number; grabbing: boolean }`
  - `createStageGestureHandler(deps: StageGestureDeps): (event: GestureEvent) => void`
  - `type StageGestureDeps = { toScreen(x: number, y: number): { x: number; y: number } | null; getStage(): Stage; dispatch(command: StageCommand): void; onAgent(): void; onArmed(armed: boolean): void; onCursor(cursor: StageCursor | null): void; newId?: () => string; itemAt?: (x: number, y: number) => DragItem | null; slotRects?: () => Partial<Record<Slot, Rect>> }`
  - `followPoint(current: { x: number; y: number } | null, target: { x: number; y: number }, dtMs: number, halfLifeMs: number): { x: number; y: number }`

- [ ] **Step 1: Write the failing tests**

`tests/unit/cursor-motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { followPoint } from '@/lib/stage/cursor-motion';

describe('followPoint', () => {
  it('jumps to the target when there is no current point', () => {
    expect(followPoint(null, { x: 10, y: 20 }, 16, 60)).toEqual({ x: 10, y: 20 });
  });

  it('covers half the distance in one half-life', () => {
    const next = followPoint({ x: 0, y: 0 }, { x: 100, y: 40 }, 60, 60);
    expect(next.x).toBeCloseTo(50, 5);
    expect(next.y).toBeCloseTo(20, 5);
  });

  it('stays put with no elapsed time and reaches the target eventually', () => {
    expect(followPoint({ x: 5, y: 5 }, { x: 50, y: 50 }, 0, 60)).toEqual({ x: 5, y: 5 });
    const far = followPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 2_000, 60);
    expect(far.x).toBeCloseTo(100, 3);
  });
});
```

`tests/unit/stage-gesture-handler.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { applyCommand, emptyStage, type Stage } from '@omnicanvas/canvas';
import { createStageGestureHandler } from '@/lib/stage/stage-gesture-handler';

function stageWithWindow(): Stage {
  return applyCommand(emptyStage(), { type: 'WINDOW_CREATE', windowId: 'w1', title: 'Finestra 1' });
}

function setup(overrides: Partial<Parameters<typeof createStageGestureHandler>[0]> = {}) {
  const deps = {
    toScreen: (x: number, y: number) => ({ x: x * 1000, y: y * 500 }),
    getStage: stageWithWindow,
    dispatch: vi.fn(),
    onAgent: vi.fn(),
    onArmed: vi.fn(),
    onCursor: vi.fn(),
    newId: () => 'new-id',
    itemAt: vi.fn(() => ({ type: 'window' as const, id: 'w1' })),
    slotRects: () => ({ 'side-1': { x: 600, y: 0, width: 200, height: 200 } }),
    ...overrides,
  };
  return { deps, handle: createStageGestureHandler(deps) };
}

describe('createStageGestureHandler', () => {
  it('reports the armed state', () => {
    const { deps, handle } = setup();
    handle({ type: 'GESTURES_TOGGLE', armed: true });
    expect(deps.onArmed).toHaveBeenCalledWith(true);
  });

  it('grabs the item under the hand, moves the cursor and drops into the nearest slot', () => {
    const { deps, handle } = setup();
    handle({ type: 'GRAB', x: 0.1, y: 0.1 });
    expect(deps.itemAt).toHaveBeenCalledWith(100, 50);
    expect(deps.onCursor).toHaveBeenLastCalledWith({ x: 100, y: 50, grabbing: true });
    handle({ type: 'MOVE', x: 0.7, y: 0.2 });
    expect(deps.onCursor).toHaveBeenLastCalledWith({ x: 700, y: 100, grabbing: true });
    handle({ type: 'DROP', x: 0.7, y: 0.2 });
    expect(deps.onCursor).toHaveBeenLastCalledWith(null);
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: 'WINDOW_MOVE',
      windowId: 'w1',
      slot: 'side-1',
    });
  });

  it('shows a plain cursor when nothing is under the hand', () => {
    const { deps, handle } = setup({ itemAt: vi.fn(() => null) });
    handle({ type: 'GRAB', x: 0.5, y: 0.5 });
    expect(deps.onCursor).toHaveBeenLastCalledWith({ x: 500, y: 250, grabbing: false });
    handle({ type: 'DROP', x: 0.5, y: 0.5 });
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it('turns discrete gestures into stage commands or agent requests', () => {
    const { deps, handle } = setup();
    handle({ type: 'FOCUS_NEXT' });
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'FOCUS_NEXT' });
    handle({ type: 'WINDOW_CREATE' });
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: 'WINDOW_CREATE',
      windowId: 'new-id',
      title: 'Finestra 2',
    });
    handle({ type: 'AGENT_ACTIVATE' });
    expect(deps.onAgent).toHaveBeenCalled();
  });

  it('ignores pointer events outside the stage area', () => {
    const { deps, handle } = setup({ toScreen: () => null });
    handle({ type: 'GRAB', x: 0.5, y: 0.5 });
    expect(deps.onCursor).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/cursor-motion.test.ts tests/unit/stage-gesture-handler.test.ts`
Expected: FAIL, moduli non risolti.

- [ ] **Step 3: `cursor-motion.ts`**

```ts
// Inseguimento esponenziale: ogni halfLifeMs il cursore copre metà della distanza che resta.
// Ridisegnato a 60fps rende fluido un cursore che riceve punti a 10-30fps.
export function followPoint(
  current: { x: number; y: number } | null,
  target: { x: number; y: number },
  dtMs: number,
  halfLifeMs: number,
): { x: number; y: number } {
  if (!current) return { ...target };
  const k = 1 - 2 ** (-Math.max(0, dtMs) / halfLifeMs);
  return { x: current.x + (target.x - current.x) * k, y: current.y + (target.y - current.y) * k };
}
```

- [ ] **Step 4: `stage-gesture-handler.ts`**

```ts
import {
  nearestSlot,
  type Rect,
  type Slot,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import type { GestureEvent } from '@omnicanvas/gesture';
import { dragItemAt, resolveDrop, slotRectsFromDom, type DragItem } from './drop';
import { gestureAction } from './gesture-actions';

export type StageCursor = { x: number; y: number; grabbing: boolean };

export type StageGestureDeps = {
  // Punto normalizzato (vista specchio) → coordinate dello schermo; null fuori dall'area.
  toScreen(x: number, y: number): { x: number; y: number } | null;
  getStage(): Stage;
  dispatch(command: StageCommand): void;
  onAgent(): void;
  onArmed(armed: boolean): void;
  onCursor(cursor: StageCursor | null): void;
  newId?: () => string;
  itemAt?: (x: number, y: number) => DragItem | null;
  slotRects?: () => Partial<Record<Slot, Rect>>;
};

// Eventi delle mani → comandi del palco. La usano la call e il laboratorio gesture: mano,
// mouse e agente finiscono nello stesso dispatch.
export function createStageGestureHandler(deps: StageGestureDeps): (event: GestureEvent) => void {
  const itemAt = deps.itemAt ?? dragItemAt;
  const slotRects = deps.slotRects ?? (() => slotRectsFromDom());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  let dragging: DragItem | null = null;

  return (event) => {
    if (event.type === 'GESTURES_TOGGLE') {
      deps.onArmed(event.armed);
      return;
    }
    if ('x' in event) {
      const point = deps.toScreen(event.x, event.y);
      if (!point) return;
      if (event.type === 'GRAB') dragging = itemAt(point.x, point.y);
      if (event.type === 'DROP') {
        const item = dragging;
        dragging = null;
        deps.onCursor(null);
        const slot = nearestSlot(point, slotRects());
        const command = item && slot ? resolveDrop(deps.getStage(), item, slot) : null;
        if (command) deps.dispatch(command);
        return;
      }
      deps.onCursor({ ...point, grabbing: dragging !== null });
      return;
    }
    const action = gestureAction(event, deps.getStage(), newId);
    if (action.kind === 'command') deps.dispatch(action.command);
    if (action.kind === 'agent') deps.onAgent();
  };
}
```

- [ ] **Step 5: `use-gestures.ts` on the shared handler**

In `apps/web/src/lib/stage/use-gestures.ts`:
- import: togliere `nearestSlot`, `dragItemAt`, `resolveDrop`, `slotRectsFromDom`, `DragItem`,
  `gestureAction`, `GestureEvent`; aggiungere `useMemo` da React e
  `import { createStageGestureHandler, type StageCursor } from './stage-gesture-handler';`.
  Tenere `import type { GestureStatus } from './gesture-actions';`.
- `type Cursor` diventa `StageCursor`: `useState<StageCursor | null>(null)`.
- eliminare `draggingRef`.
- sostituire l'intero `const onEvent = useCallback(...)` con:

```ts
  const onEvent = useMemo(
    () =>
      createStageGestureHandler({
        toScreen,
        getStage: () => stageRef.current,
        dispatch: (command) => handlersRef.current.dispatch(command),
        onAgent: () => handlersRef.current.onAgent(),
        onArmed: setArmed,
        onCursor: setCursor,
      }),
    [toScreen],
  );
```

Il resto (`toggle`, effetti, valore restituito) non cambia.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit && npm run typecheck && npm run lint`
Expected: PASS, compresi i test esistenti della call e del palco.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/stage/stage-gesture-handler.ts apps/web/src/lib/stage/cursor-motion.ts apps/web/src/lib/stage/use-gestures.ts tests/unit/stage-gesture-handler.test.ts tests/unit/cursor-motion.test.ts
git commit -m "refactor(stage): shared gesture-to-stage handler and a smooth cursor helper"
```

---

### Task 6: logica pura del laboratorio

**Files:**
- Create: `apps/web/src/lib/gesture-lab/settings.ts`, `recording.ts`, `event-log.ts`, `lab-stage.ts`
- Test: `tests/unit/gesture-lab-settings.test.ts`, `tests/unit/gesture-lab-recording.test.ts`, `tests/unit/gesture-lab-log.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_TUNING`, `clampTuning`, `DEFAULT_DICTIONARY`, `GESTURE_NAMES`, `GESTURE_COMMANDS`, tipi `Tuning`, `Dictionary`, `Frame`, `GestureEvent` (`@omnicanvas/gesture`); `applyCommand`, `emptyStage`, `sampleContent` (`@omnicanvas/canvas`)
- Produces:
  - `type LabToggles = { smoothCursor: boolean; feedback: boolean; stablePoses: boolean }`
  - `type LabSettings = { tuning: Tuning; dictionary: Dictionary; toggles: LabToggles }`
  - `DEFAULT_LAB_SETTINGS: LabSettings`, `LAB_STORAGE_KEY = 'gesture-lab:v1'`
  - `effectiveTuning(settings: LabSettings): Tuning`
  - `parseDictionary(value: unknown): Dictionary`
  - `loadLabSettings(storage: Pick<Storage, 'getItem'> | null): LabSettings`
  - `saveLabSettings(storage: Pick<Storage, 'setItem'> | null, settings: LabSettings): void`
  - `type TuningSlider = { path: string; label: string; min: number; max: number; step: number }`, `TUNING_SLIDERS: TuningSlider[]`
  - `readTuningValue(tuning: Tuning, path: string): number`, `setTuningValue(tuning: Tuning, path: string, value: number): Tuning`
  - `tuningToCode(tuning: Tuning, dictionary: Dictionary): string`
  - `type Recording = { expect: GestureEvent['type']; armed: boolean; frames: Frame[] }`, `parseRecording(value: unknown): Recording | null`
  - `createReplayer(frames: Frame[], onFrame: (frame: Frame) => void, onEnd: () => void): { play(): void; pause(): void; isPlaying(): boolean }`
  - `type LogEntry = { t: number; label: string }`, `appendEvent(log: LogEntry[], event: GestureEvent, t: number): LogEntry[]`, `LOG_LIMIT = 20`
  - `labStage(): Stage`

- [ ] **Step 1: Write the failing tests**

`tests/unit/gesture-lab-settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_DICTIONARY, DEFAULT_TUNING } from '@omnicanvas/gesture';
import {
  DEFAULT_LAB_SETTINGS,
  LAB_STORAGE_KEY,
  TUNING_SLIDERS,
  effectiveTuning,
  loadLabSettings,
  parseDictionary,
  readTuningValue,
  saveLabSettings,
  setTuningValue,
  tuningToCode,
} from '@/lib/gesture-lab/settings';
import { labStage } from '@/lib/gesture-lab/lab-stage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('lab settings', () => {
  it('starts from today defaults, with every correction off', () => {
    expect(DEFAULT_LAB_SETTINGS.dictionary).toEqual(DEFAULT_DICTIONARY);
    expect(DEFAULT_LAB_SETTINGS.toggles).toEqual({
      smoothCursor: false,
      feedback: false,
      stablePoses: false,
    });
    expect(effectiveTuning(DEFAULT_LAB_SETTINGS)).toEqual(DEFAULT_TUNING);
  });

  it('applies the stability frames only when stable poses are on', () => {
    const on = { ...DEFAULT_LAB_SETTINGS, toggles: { ...DEFAULT_LAB_SETTINGS.toggles, stablePoses: true } };
    expect(effectiveTuning(on).stability.frames).toBe(3);
    expect(effectiveTuning(DEFAULT_LAB_SETTINGS).stability.frames).toBe(1);
  });

  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const settings = {
      ...DEFAULT_LAB_SETTINGS,
      tuning: setTuningValue(DEFAULT_LAB_SETTINGS.tuning, 'timings.holdMs', 600),
      dictionary: { ...DEFAULT_DICTIONARY, flick_up: null },
      toggles: { smoothCursor: true, feedback: true, stablePoses: false },
    };
    saveLabSettings(storage, settings);
    expect(storage.data.has(LAB_STORAGE_KEY)).toBe(true);
    expect(loadLabSettings(storage)).toEqual(settings);
  });

  it('falls back to the defaults when storage is missing, broken or throws', () => {
    expect(loadLabSettings(null)).toEqual(DEFAULT_LAB_SETTINGS);
    const broken = new MemoryStorage();
    broken.setItem(LAB_STORAGE_KEY, '{not json');
    expect(loadLabSettings(broken)).toEqual(DEFAULT_LAB_SETTINGS);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadLabSettings(throwing)).toEqual(DEFAULT_LAB_SETTINGS);
    expect(() =>
      saveLabSettings(
        {
          setItem: () => {
            throw new Error('full');
          },
        },
        DEFAULT_LAB_SETTINGS,
      ),
    ).not.toThrow();
  });

  it('keeps only valid dictionary entries', () => {
    const parsed = parseDictionary({ swipe_left: 'FOCUS_PREV', flick_up: null, index_up_hold: 'BOOM' });
    expect(parsed.swipe_left).toBe('FOCUS_PREV');
    expect(parsed.flick_up).toBeNull();
    expect(parsed.index_up_hold).toBe(DEFAULT_DICTIONARY.index_up_hold);
    expect(parsed.open_palm_hold).toBe(DEFAULT_DICTIONARY.open_palm_hold);
  });
});

describe('sliders', () => {
  it('read and write every slider path within the clamped bounds', () => {
    for (const slider of TUNING_SLIDERS) {
      const value = readTuningValue(DEFAULT_LAB_SETTINGS.tuning, slider.path);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(slider.min);
      expect(value).toBeLessThanOrEqual(slider.max);
    }
    const tuned = setTuningValue(DEFAULT_TUNING, 'pose.pinchOn', 0.9);
    expect(tuned.pose.pinchOn).toBeLessThan(tuned.pose.pinchOff);
    expect(setTuningValue(DEFAULT_TUNING, 'timings.swipe.withinMs', 700).timings.swipe.withinMs).toBe(700);
  });
});

describe('tuningToCode', () => {
  it('writes the current values as code ready to paste', () => {
    const tuning = setTuningValue(DEFAULT_TUNING, 'timings.holdMs', 700);
    const code = tuningToCode(tuning, { ...DEFAULT_DICTIONARY, flick_up: null });
    expect(code).toContain('export const DEFAULT_TUNING: Tuning = ');
    expect(code).toContain('export const DEFAULT_DICTIONARY: Dictionary = ');
    const tuningJson = code.split('export const DEFAULT_TUNING: Tuning = ')[1]!.split(';\n')[0]!;
    expect(JSON.parse(tuningJson).timings.holdMs).toBe(700);
    expect(code).toContain('"flick_up": null');
  });
});

describe('labStage', () => {
  it('builds three windows, each with a sample content', () => {
    const stage = labStage();
    expect(stage.windows).toHaveLength(3);
    expect(stage.windows.every((w) => w.contents.length === 1)).toBe(true);
    expect(stage.tray).toEqual([]);
  });
});
```

Nota: `StageWindow` ha `contents: Content[]`; `CONTENT_PLACE` sposta il contenuto dal vassoio
alla finestra. Se `tray` non si svuota (verificare in `packages/canvas/src/reducer.ts`),
togliere solo l'ultima asserzione e dirlo nel report.

`tests/unit/gesture-lab-recording.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReplayer, parseRecording } from '@/lib/gesture-lab/recording';
import { hand } from '../fixtures/hands';

const valid = {
  expect: 'FOCUS_NEXT',
  armed: true,
  frames: [
    { t: 0, hands: [hand('fist')] },
    { t: 33, hands: [] },
    { t: 66, hands: [hand('fist')] },
  ],
};

describe('parseRecording', () => {
  it('accepts a recorder file', () => {
    expect(parseRecording(valid)).toEqual(valid);
  });

  it('rejects anything else', () => {
    expect(parseRecording(null)).toBeNull();
    expect(parseRecording({ ...valid, expect: 'DANCE' })).toBeNull();
    expect(parseRecording({ ...valid, armed: 'yes' })).toBeNull();
    expect(parseRecording({ ...valid, frames: 'many' })).toBeNull();
    expect(
      parseRecording({ ...valid, frames: [{ t: 0, hands: [{ landmarks: [{ x: 0, y: 0, z: 0 }] }] }] }),
    ).toBeNull();
    expect(parseRecording({ ...valid, frames: [{ t: 'zero', hands: [] }] })).toBeNull();
  });
});

describe('createReplayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays frames at their recorded times, pauses and resumes', () => {
    const seen: number[] = [];
    const onEnd = vi.fn();
    const replayer = createReplayer(valid.frames, (f) => seen.push(f.t), onEnd);
    replayer.play();
    expect(seen).toEqual([0]);
    vi.advanceTimersByTime(33);
    expect(seen).toEqual([0, 33]);
    replayer.pause();
    expect(replayer.isPlaying()).toBe(false);
    vi.advanceTimersByTime(500);
    expect(seen).toEqual([0, 33]);
    replayer.play();
    vi.advanceTimersByTime(33);
    expect(seen).toEqual([0, 33, 66]);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(replayer.isPlaying()).toBe(false);
  });

  it('starts over after reaching the end', () => {
    const seen: number[] = [];
    const replayer = createReplayer(valid.frames, (f) => seen.push(f.t), () => {});
    replayer.play();
    vi.advanceTimersByTime(100);
    replayer.play();
    expect(seen).toEqual([0, 33, 66, 0]);
  });
});
```

`tests/unit/gesture-lab-log.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOG_LIMIT, appendEvent, type LogEntry } from '@/lib/gesture-lab/event-log';

describe('appendEvent', () => {
  it('writes discrete events and the armed state in words', () => {
    let log: LogEntry[] = [];
    log = appendEvent(log, { type: 'GESTURES_TOGGLE', armed: true }, 10);
    log = appendEvent(log, { type: 'FOCUS_NEXT' }, 20);
    expect(log).toEqual([
      { t: 20, label: 'FOCUS_NEXT' },
      { t: 10, label: 'Gesture attive' },
    ]);
  });

  it('groups a drag into one line', () => {
    let log: LogEntry[] = [];
    log = appendEvent(log, { type: 'GRAB', x: 0.1, y: 0.1 }, 0);
    log = appendEvent(log, { type: 'MOVE', x: 0.2, y: 0.1 }, 33);
    log = appendEvent(log, { type: 'MOVE', x: 0.3, y: 0.1 }, 66);
    log = appendEvent(log, { type: 'DROP', x: 0.3, y: 0.1 }, 99);
    expect(log).toEqual([{ t: 0, label: 'Trascinamento → rilascio' }]);
  });

  it('keeps the latest entries only', () => {
    let log: LogEntry[] = [];
    for (let i = 0; i < LOG_LIMIT + 5; i++) log = appendEvent(log, { type: 'FOCUS_PREV' }, i);
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]!.t).toBe(LOG_LIMIT + 4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/gesture-lab-settings.test.ts tests/unit/gesture-lab-recording.test.ts tests/unit/gesture-lab-log.test.ts`
Expected: FAIL, moduli non risolti.

- [ ] **Step 3: `settings.ts`**

```ts
import {
  DEFAULT_DICTIONARY,
  DEFAULT_TUNING,
  GESTURE_COMMANDS,
  GESTURE_NAMES,
  clampTuning,
  type Dictionary,
  type GestureCommand,
  type Tuning,
} from '@omnicanvas/gesture';

// Impostazioni del laboratorio gesture (solo sviluppo): restano nel browser di Sean.

export type LabToggles = { smoothCursor: boolean; feedback: boolean; stablePoses: boolean };
export type LabSettings = { tuning: Tuning; dictionary: Dictionary; toggles: LabToggles };

export const LAB_STORAGE_KEY = 'gesture-lab:v1';

// La stabilità ha già un valore da provare (3), ma conta solo con l'interruttore acceso.
export const DEFAULT_LAB_SETTINGS: LabSettings = {
  tuning: { ...DEFAULT_TUNING, stability: { frames: 3 } },
  dictionary: DEFAULT_DICTIONARY,
  toggles: { smoothCursor: false, feedback: false, stablePoses: false },
};

export function effectiveTuning(settings: LabSettings): Tuning {
  return {
    ...settings.tuning,
    stability: { frames: settings.toggles.stablePoses ? settings.tuning.stability.frames : 1 },
  };
}

const isCommand = (value: unknown): value is GestureCommand =>
  (GESTURE_COMMANDS as readonly unknown[]).includes(value);

export function parseDictionary(value: unknown): Dictionary {
  const source =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const dictionary = { ...DEFAULT_DICTIONARY };
  for (const name of GESTURE_NAMES) {
    const entry = source[name];
    if (entry === null || isCommand(entry)) dictionary[name] = entry;
  }
  return dictionary;
}

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export function loadLabSettings(storage: Pick<Storage, 'getItem'> | null): LabSettings {
  try {
    const raw = storage?.getItem(LAB_STORAGE_KEY);
    if (!raw) return DEFAULT_LAB_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const toggles = (parsed.toggles ?? {}) as Record<string, unknown>;
    const d = DEFAULT_LAB_SETTINGS.toggles;
    return {
      tuning: clampTuning(parsed.tuning ?? DEFAULT_LAB_SETTINGS.tuning),
      dictionary: parseDictionary(parsed.dictionary),
      toggles: {
        smoothCursor: bool(toggles.smoothCursor, d.smoothCursor),
        feedback: bool(toggles.feedback, d.feedback),
        stablePoses: bool(toggles.stablePoses, d.stablePoses),
      },
    };
  } catch {
    return DEFAULT_LAB_SETTINGS;
  }
}

export function saveLabSettings(storage: Pick<Storage, 'setItem'> | null, settings: LabSettings) {
  try {
    storage?.setItem(LAB_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage pieno o bloccato: le impostazioni valgono fino alla chiusura della pagina.
  }
}

export type TuningSlider = { path: string; label: string; min: number; max: number; step: number };

export const TUNING_SLIDERS: TuningSlider[] = [
  { path: 'timings.holdMs', label: 'Attesa del gesto (ms)', min: 200, max: 3_000, step: 50 },
  { path: 'timings.cooldownMs', label: 'Pausa dopo un gesto (ms)', min: 0, max: 3_000, step: 50 },
  { path: 'timings.stillness', label: 'Immobilità durante l’attesa', min: 0.01, max: 0.3, step: 0.01 },
  { path: 'timings.swipe.distance', label: 'Swipe: distanza', min: 0.05, max: 0.6, step: 0.01 },
  { path: 'timings.swipe.withinMs', label: 'Swipe: entro (ms)', min: 100, max: 1_500, step: 25 },
  { path: 'timings.flick.distance', label: 'Flick: distanza', min: 0.05, max: 0.6, step: 0.01 },
  { path: 'timings.flick.withinMs', label: 'Flick: entro (ms)', min: 100, max: 1_500, step: 25 },
  { path: 'timings.spread.distance', label: 'Due mani: distanza', min: 0.05, max: 0.6, step: 0.01 },
  { path: 'timings.spread.withinMs', label: 'Due mani: entro (ms)', min: 100, max: 1_500, step: 25 },
  { path: 'pose.pinchOn', label: 'Pinch: si chiude sotto', min: 0.05, max: 0.6, step: 0.01 },
  { path: 'pose.pinchOff', label: 'Pinch: si apre sopra', min: 0.06, max: 0.8, step: 0.01 },
  { path: 'pose.extended', label: 'Dito esteso sopra', min: 1.0, max: 2.5, step: 0.05 },
  { path: 'pose.folded', label: 'Dito piegato sotto', min: 0.5, max: 2.45, step: 0.05 },
  { path: 'pose.thumbMargin', label: 'Margine pollice su/giù', min: 0, max: 1, step: 0.05 },
  { path: 'smoothing.minCutoff', label: 'Filtro: tremolio (minCutoff)', min: 0.01, max: 10, step: 0.01 },
  { path: 'smoothing.beta', label: 'Filtro: reattività (beta)', min: 0, max: 1, step: 0.001 },
  { path: 'stability.frames', label: 'Pose stabili: fotogrammi', min: 1, max: 10, step: 1 },
];

export function readTuningValue(tuning: Tuning, path: string): number {
  let node: unknown = tuning;
  for (const key of path.split('.')) node = (node as Record<string, unknown>)[key];
  return typeof node === 'number' ? node : Number.NaN;
}

export function setTuningValue(tuning: Tuning, path: string, value: number): Tuning {
  const copy = structuredClone(tuning) as unknown as Record<string, unknown>;
  const keys = path.split('.');
  let node = copy;
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[keys[keys.length - 1]!] = value;
  return clampTuning(copy);
}

// Il blocco da incollare in packages/gesture quando una taratura convince.
export function tuningToCode(tuning: Tuning, dictionary: Dictionary): string {
  return [
    `export const DEFAULT_TUNING: Tuning = ${JSON.stringify(tuning, null, 2)};`,
    '',
    `export const DEFAULT_DICTIONARY: Dictionary = ${JSON.stringify(dictionary, null, 2)};`,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: `recording.ts`**

```ts
import type { Frame, GestureEvent } from '@omnicanvas/gesture';

export type Recording = { expect: GestureEvent['type']; armed: boolean; frames: Frame[] };

const EVENT_TYPES: GestureEvent['type'][] = [
  'GESTURES_TOGGLE',
  'AGENT_ACTIVATE',
  'CONFIRM',
  'REJECT',
  'FOCUS_NEXT',
  'FOCUS_PREV',
  'WINDOW_ARCHIVE',
  'WINDOW_CREATE',
  'GRAB',
  'MOVE',
  'DROP',
];
const MAX_FRAMES = 2_000;

const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

const isHand = (value: unknown) => {
  const landmarks = (value as { landmarks?: unknown } | null)?.landmarks;
  return (
    Array.isArray(landmarks) &&
    landmarks.length === 21 &&
    landmarks.every((p) => {
      const point = p as Record<string, unknown> | null;
      return point !== null && isNumber(point.x) && isNumber(point.y) && isNumber(point.z);
    })
  );
};

// File del registratore: solo landmark. Tutto il resto si rifiuta senza rompere la pagina.
export function parseRecording(value: unknown): Recording | null {
  if (typeof value !== 'object' || value === null) return null;
  const { expect, armed, frames } = value as Record<string, unknown>;
  if (!EVENT_TYPES.includes(expect as GestureEvent['type'])) return null;
  if (typeof armed !== 'boolean') return null;
  if (!Array.isArray(frames) || frames.length === 0 || frames.length > MAX_FRAMES) return null;
  const valid = frames.every((f) => {
    const frame = f as Record<string, unknown> | null;
    return (
      frame !== null && isNumber(frame.t) && Array.isArray(frame.hands) && frame.hands.every(isHand)
    );
  });
  return valid ? { expect: expect as GestureEvent['type'], armed, frames: frames as Frame[] } : null;
}

// Rigioca i fotogrammi con i loro tempi relativi. Finita la registrazione, «play» riparte da capo.
export function createReplayer(
  frames: Frame[],
  onFrame: (frame: Frame) => void,
  onEnd: () => void,
) {
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const step = () => {
    const frame = frames[index];
    if (!frame) {
      timer = null;
      index = 0;
      onEnd();
      return;
    }
    onFrame(frame);
    index += 1;
    const next = frames[index];
    if (!next) {
      timer = null;
      index = 0;
      onEnd();
      return;
    }
    timer = setTimeout(step, Math.max(0, next.t - frame.t));
  };

  return {
    play() {
      if (timer !== null) return;
      step();
    },
    pause() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    isPlaying: () => timer !== null,
  };
}
```

- [ ] **Step 5: `event-log.ts`**

```ts
import type { GestureEvent } from '@omnicanvas/gesture';

export type LogEntry = { t: number; label: string };
export const LOG_LIMIT = 20;

const DRAGGING = 'Trascinamento…';

// Più recente in cima. Un trascinamento è una riga sola, che si chiude al rilascio.
export function appendEvent(log: LogEntry[], event: GestureEvent, t: number): LogEntry[] {
  if (event.type === 'MOVE') return log;
  if (event.type === 'DROP') {
    const [last, ...rest] = log;
    return last?.label === DRAGGING ? [{ ...last, label: 'Trascinamento → rilascio' }, ...rest] : log;
  }
  const label =
    event.type === 'GRAB'
      ? DRAGGING
      : event.type === 'GESTURES_TOGGLE'
        ? event.armed
          ? 'Gesture attive'
          : 'Gesture in pausa'
        : event.type;
  return [{ t, label }, ...log].slice(0, LOG_LIMIT);
}
```

- [ ] **Step 6: `lab-stage.ts`**

```ts
import { applyCommand, emptyStage, sampleContent, type Stage } from '@omnicanvas/canvas';

const KINDS = ['chart', 'text', 'table'] as const;

// Palco di prova costruito con comandi veri: tre finestre, ognuna col suo contenuto d'esempio.
export function labStage(): Stage {
  let stage = emptyStage();
  KINDS.forEach((kind, i) => {
    const windowId = `lab-window-${i + 1}`;
    const contentId = `lab-content-${i + 1}`;
    stage = applyCommand(stage, { type: 'WINDOW_CREATE', windowId, title: `Finestra ${i + 1}` });
    stage = applyCommand(stage, { type: 'TRAY_ADD', content: sampleContent(kind, contentId) });
    stage = applyCommand(stage, { type: 'CONTENT_PLACE', contentId, windowId });
  });
  return stage;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/gesture-lab-settings.test.ts tests/unit/gesture-lab-recording.test.ts tests/unit/gesture-lab-log.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/gesture-lab tests/unit/gesture-lab-settings.test.ts tests/unit/gesture-lab-recording.test.ts tests/unit/gesture-lab-log.test.ts
git commit -m "feat(gesture-lab): settings, storage, replay, event log and test stage"
```

---

### Task 7: la pagina del laboratorio

**Files:**
- Create: `apps/web/src/lib/gesture-lab/hand-drawing.ts`
- Create: `apps/web/src/lib/gesture-lab/use-gesture-lab.ts`
- Create: `apps/web/src/app/dev/gesture-lab/page.tsx`, `lab.tsx`, `lab-controls.tsx`, `hand-panel.tsx`, `replay-panel.tsx`, `event-list.tsx`
- Test: `tests/unit/gesture-lab-ui.test.tsx`

**Interfaces:**
- Consumes: tutto dai Task 1-6; `StageBoard` (`apps/web/src/app/room/[code]/stage-board.tsx`, props `stage`, `assetUrls`, `dispatch`); `Button` da `@omnicanvas/ui`
- Produces: la pagina `/dev/gesture-lab`; `LabControls`, `ReplayPanel`, `EventList` (componenti di presentazione testati)

- [ ] **Step 1: Write the failing test**

`tests/unit/gesture-lab-ui.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LabControls } from '@/app/dev/gesture-lab/lab-controls';
import { ReplayPanel } from '@/app/dev/gesture-lab/replay-panel';
import { EventList } from '@/app/dev/gesture-lab/event-list';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { hand } from '../fixtures/hands';

afterEach(cleanup);

describe('LabControls', () => {
  it('turns a correction on', () => {
    const onChange = vi.fn();
    render(<LabControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Filtro anti-tremolio'));
    expect(onChange.mock.calls[0]![0].tuning.smoothing.enabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Cursore fluido a 60fps'));
    expect(onChange.mock.calls[1]![0].toggles.smoothCursor).toBe(true);
  });

  it('changes a threshold with its slider', () => {
    const onChange = vi.fn();
    render(<LabControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Attesa del gesto (ms)'), { target: { value: '600' } });
    expect(onChange.mock.calls[0]![0].tuning.timings.holdMs).toBe(600);
  });

  it('turns a gesture off in the dictionary, and offers drag only to the pinch', () => {
    const onChange = vi.fn();
    render(<LabControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Flick verso l’alto'), { target: { value: '' } });
    expect(onChange.mock.calls[0]![0].dictionary.flick_up).toBeNull();
    const pinch = screen.getByLabelText('Pinch e trascina') as HTMLSelectElement;
    expect([...pinch.options].map((o) => o.value)).toEqual(['DRAG', '']);
    const swipe = screen.getByLabelText('Swipe a sinistra') as HTMLSelectElement;
    expect([...swipe.options].map((o) => o.value)).not.toContain('DRAG');
  });

  it('resets to the defaults', () => {
    const onChange = vi.fn();
    const changed = { ...DEFAULT_LAB_SETTINGS, toggles: { ...DEFAULT_LAB_SETTINGS.toggles, feedback: true } };
    render(<LabControls settings={changed} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina predefiniti' }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_LAB_SETTINGS);
  });
});

describe('ReplayPanel', () => {
  const file = (content: string) => new File([content], 'FOCUS_NEXT-test.json', { type: 'application/json' });

  it('loads a valid recording and shows what it expects', async () => {
    const onLoad = vi.fn();
    render(
      <ReplayPanel recording={null} playing={false} onLoad={onLoad} onPlay={vi.fn()} onPause={vi.fn()} fired={[]} />,
    );
    const json = JSON.stringify({ expect: 'FOCUS_NEXT', armed: true, frames: [{ t: 0, hands: [hand('fist')] }] });
    fireEvent.change(screen.getByLabelText('Registrazione da rigiocare'), { target: { files: [file(json)] } });
    await waitFor(() => expect(onLoad).toHaveBeenCalled());
    expect(onLoad.mock.calls[0]![0].expect).toBe('FOCUS_NEXT');
  });

  it('refuses a file that is not a recording', async () => {
    render(
      <ReplayPanel recording={null} playing={false} onLoad={vi.fn()} onPlay={vi.fn()} onPause={vi.fn()} fired={[]} />,
    );
    fireEvent.change(screen.getByLabelText('Registrazione da rigiocare'), {
      target: { files: [file('{"hello": 1}')] },
    });
    expect(await screen.findByText('Questo file non è una registrazione del registratore di gesture.')).toBeTruthy();
  });

  it('shows the expected event next to the fired ones', () => {
    render(
      <ReplayPanel
        recording={{ expect: 'FOCUS_NEXT', armed: true, frames: [{ t: 0, hands: [] }] }}
        playing={false}
        onLoad={vi.fn()}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        fired={['FOCUS_NEXT']}
      />,
    );
    expect(screen.getByText('Atteso: FOCUS_NEXT')).toBeTruthy();
    expect(screen.getByText('Scattati: FOCUS_NEXT')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rigioca' })).toBeTruthy();
  });
});

describe('EventList', () => {
  it('lists entries, newest first', () => {
    render(<EventList entries={[{ t: 2_000, label: 'FOCUS_NEXT' }, { t: 1_000, label: 'Gesture attive' }]} />);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('FOCUS_NEXT');
    expect(items[1]).toContain('Gesture attive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/gesture-lab-ui.test.tsx`
Expected: FAIL, moduli non risolti.

- [ ] **Step 3: `hand-drawing.ts`**

```ts
import type { Frame } from '@omnicanvas/gesture';

// Collegamenti dello scheletro con gli indici di MediaPipe (0 polso, 4 punta del pollice…).
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, color: string, w: number, h: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  for (const hand of frame.hands) {
    // Vista specchio, come il video: x → 1 - x.
    const at = (i: number) => {
      const p = hand.landmarks[i]!;
      return { x: (1 - p.x) * w, y: p.y * h };
    };
    for (const [a, b] of HAND_CONNECTIONS) {
      const from = at(a);
      const to = at(b);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    for (let i = 0; i < hand.landmarks.length; i++) {
      const p = at(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Grezzo e filtrato con colori diversi: si vede quanto il filtro ferma il tremolio.
export function drawHands(
  canvas: HTMLCanvasElement,
  frames: { raw: Frame; processed: Frame } | null,
  colors: { raw: string; processed: string },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frames) return;
  drawFrame(ctx, frames.raw, colors.raw, canvas.width, canvas.height);
  if (frames.processed !== frames.raw)
    drawFrame(ctx, frames.processed, colors.processed, canvas.width, canvas.height);
}
```

- [ ] **Step 4: `lab-controls.tsx`**

```tsx
'use client';

import { Button } from '@omnicanvas/ui';
import { GESTURE_COMMANDS, GESTURE_NAMES, type GestureName } from '@omnicanvas/gesture';
import {
  DEFAULT_LAB_SETTINGS,
  TUNING_SLIDERS,
  readTuningValue,
  setTuningValue,
  type LabSettings,
} from '@/lib/gesture-lab/settings';

const GESTURE_LABELS: Record<GestureName, string> = {
  open_palm_hold: 'Palmo aperto, 1 s',
  index_up_hold: 'Indice alzato, 1 s',
  thumb_up_hold: 'Pollice su, 1 s',
  thumb_down_hold: 'Pollice giù, 1 s',
  pinch_drag: 'Pinch e trascina',
  swipe_left: 'Swipe a sinistra',
  swipe_right: 'Swipe a destra',
  flick_up: 'Flick verso l’alto',
  two_hands_spread: 'Due mani che si allontanano',
};

type Props = { settings: LabSettings; onChange: (next: LabSettings) => void };

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function LabControls({ settings, onChange }: Props) {
  const { tuning, dictionary, toggles } = settings;
  const setToggle = (key: keyof LabSettings['toggles'], value: boolean) =>
    onChange({ ...settings, toggles: { ...toggles, [key]: value } });

  return (
    <div className="flex flex-col gap-4 text-fg">
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-muted">Correzioni</h2>
        <Toggle
          label="Filtro anti-tremolio"
          checked={tuning.smoothing.enabled}
          onChange={(v) => onChange({ ...settings, tuning: { ...tuning, smoothing: { ...tuning.smoothing, enabled: v } } })}
        />
        <Toggle label="Cursore fluido a 60fps" checked={toggles.smoothCursor} onChange={(v) => setToggle('smoothCursor', v)} />
        <Toggle label="Riscontro durante il gesto" checked={toggles.feedback} onChange={(v) => setToggle('feedback', v)} />
        <Toggle label="Pose stabili" checked={toggles.stablePoses} onChange={(v) => setToggle('stablePoses', v)} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Taratura</h2>
        {TUNING_SLIDERS.map((slider) => {
          const value = readTuningValue(tuning, slider.path);
          const fallback = readTuningValue(DEFAULT_LAB_SETTINGS.tuning, slider.path);
          return (
            <label key={slider.path} className="flex flex-col gap-1 text-xs">
              <span className="flex justify-between">
                <span>{slider.label}</span>
                <span className="tabular-nums text-muted">
                  {value} <span aria-hidden>· predefinito {fallback}</span>
                </span>
              </span>
              <input
                type="range"
                aria-label={slider.label}
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={value}
                onChange={(e) =>
                  onChange({ ...settings, tuning: setTuningValue(tuning, slider.path, Number(e.target.value)) })
                }
              />
            </label>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Dizionario</h2>
        {GESTURE_NAMES.map((name) => {
          const options = GESTURE_COMMANDS.filter((c) => (name === 'pinch_drag' ? c === 'DRAG' : c !== 'DRAG'));
          return (
            <label key={name} className="flex items-center justify-between gap-2 text-xs">
              <span>{GESTURE_LABELS[name]}</span>
              <select
                aria-label={GESTURE_LABELS[name]}
                value={dictionary[name] ?? ''}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    dictionary: { ...dictionary, [name]: e.target.value === '' ? null : e.target.value },
                  })
                }
                className="min-h-11 rounded-tile border border-line bg-stage px-2 text-fg"
              >
                {options.map((command) => (
                  <option key={command} value={command}>
                    {command}
                  </option>
                ))}
                <option value="">spento</option>
              </select>
            </label>
          );
        })}
      </section>

      <Button variant="quiet" onClick={() => onChange(DEFAULT_LAB_SETTINGS)}>
        Ripristina predefiniti
      </Button>
    </div>
  );
}
```

Nota: il cast del valore della select a `GestureCommand` è sicuro perché le opzioni vengono
da `GESTURE_COMMANDS`; se il typecheck lo chiede, scrivere
`e.target.value as GestureCommand` importando il tipo.

- [ ] **Step 5: `replay-panel.tsx` and `event-list.tsx`**

`replay-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@omnicanvas/ui';
import { parseRecording, type Recording } from '@/lib/gesture-lab/recording';

type Props = {
  recording: Recording | null;
  playing: boolean;
  fired: string[];
  onLoad: (recording: Recording) => void;
  onPlay: () => void;
  onPause: () => void;
};

export function ReplayPanel({ recording, playing, fired, onLoad, onPlay, onPause }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseRecording(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid recording');
      setError(null);
      onLoad(parsed);
    } catch {
      setError('Questo file non è una registrazione del registratore di gesture.');
    }
  }

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <h2 className="text-sm font-semibold text-muted">Rigioco</h2>
      <label className="flex flex-col gap-1 text-xs">
        Registrazione da rigiocare
        <input
          type="file"
          accept="application/json"
          aria-label="Registrazione da rigiocare"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      {recording && (
        <>
          <p className="text-xs">{`Atteso: ${recording.expect}`}</p>
          <p className="text-xs">{`Scattati: ${fired.length > 0 ? fired.join(', ') : 'nessuno'}`}</p>
          {playing ? (
            <Button size="sm" onClick={onPause}>
              Pausa
            </Button>
          ) : (
            <Button size="sm" onClick={onPlay}>
              Rigioca
            </Button>
          )}
        </>
      )}
    </section>
  );
}
```

`event-list.tsx`:

```tsx
import type { LogEntry } from '@/lib/gesture-lab/event-log';

export function EventList({ entries }: { entries: LogEntry[] }) {
  return (
    <section className="flex flex-col gap-1 text-xs text-fg">
      <h2 className="text-sm font-semibold text-muted">Eventi</h2>
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry, i) => (
          <li key={`${entry.t}-${i}`} className="flex justify-between gap-2">
            <span>{entry.label}</span>
            <span className="tabular-nums text-muted">{(entry.t / 1000).toFixed(1)} s</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Run the UI test to verify it passes**

Run: `npx vitest run tests/unit/gesture-lab-ui.test.tsx`
Expected: PASS.

- [ ] **Step 7: the hook**

`apps/web/src/lib/gesture-lab/use-gesture-lab.ts`:

```ts
'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { applyCommand } from '@omnicanvas/canvas';
import { createPipeline, type Frame, type GestureEvent, type Pipeline, type RecognizerView } from '@omnicanvas/gesture';
import type { GestureRunner } from '@omnicanvas/gesture/runner';
import { followPoint } from '@/lib/stage/cursor-motion';
import { createStageGestureHandler, type StageCursor } from '@/lib/stage/stage-gesture-handler';
import { appendEvent, type LogEntry } from './event-log';
import { labStage } from './lab-stage';
import { createReplayer, type Recording } from './recording';
import { effectiveTuning, loadLabSettings, saveLabSettings, type LabSettings } from './settings';

const CURSOR_HALF_LIFE_MS = 60;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export type LiveStatus = 'off' | 'loading' | 'on' | 'no_camera' | 'unavailable';

export function useGestureLab() {
  const [settings, setSettings] = useState<LabSettings>(() => loadLabSettings(safeStorage()));
  const [stage, dispatch] = useReducer(applyCommand, undefined, labStage);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [view, setView] = useState<RecognizerView | null>(null);
  const [armed, setArmed] = useState(false);
  const [target, setTarget] = useState<StageCursor | null>(null);
  const [cursor, setCursor] = useState<StageCursor | null>(null);
  const [live, setLive] = useState<LiveStatus>('off');
  const [recording, setRecording] = useState<Recording | null>(null);
  const [playing, setPlaying] = useState(false);
  const [fired, setFired] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<{ raw: Frame; processed: Frame } | null>(null);
  const runnerRef = useRef<GestureRunner | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const replayerRef = useRef<ReturnType<typeof createReplayer> | null>(null);
  const stageRef = useRef(stage);
  const startRef = useRef(0);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    saveLabSettings(safeStorage(), settings);
    runnerRef.current?.reconfigure({ tuning: effectiveTuning(settings), dictionary: settings.dictionary });
  }, [settings]);

  const handler = useMemo(
    () =>
      createStageGestureHandler({
        toScreen: (x, y) => {
          const box = areaRef.current?.getBoundingClientRect();
          return box ? { x: box.left + x * box.width, y: box.top + y * box.height } : null;
        },
        getStage: () => stageRef.current,
        dispatch,
        onAgent: () => setLog((current) => appendEvent(current, { type: 'AGENT_ACTIVATE' }, performance.now() - startRef.current)),
        onArmed: setArmed,
        onCursor: setTarget,
      }),
    [],
  );

  const onEvent = useCallback(
    (event: GestureEvent) => {
      // AGENT_ACTIVATE lo scrive onAgent: qui si evita la riga doppia.
      if (event.type !== 'AGENT_ACTIVATE')
        setLog((current) => appendEvent(current, event, performance.now() - startRef.current));
      if (event.type !== 'GRAB' && event.type !== 'MOVE' && event.type !== 'DROP')
        setFired((current) => [...current, event.type]);
      handler(event);
    },
    [handler],
  );

  // Cursore: salta come nella call, oppure insegue il bersaglio a 60fps.
  useEffect(() => {
    if (!settings.toggles.smoothCursor || !target) {
      setCursor(target);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      setCursor((current) => (current ? { ...followPoint(current, target, now - last, CURSOR_HALF_LIFE_MS), grabbing: target.grabbing } : target));
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [target, settings.toggles.smoothCursor]);

  const stopLive = useCallback(() => {
    runnerRef.current?.stop();
    runnerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    framesRef.current = null;
    setLive('off');
  }, []);

  const startLive = useCallback(async () => {
    replayerRef.current?.pause();
    setPlaying(false);
    const video = videoRef.current;
    if (!video) return;
    setLive('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
    } catch {
      setLive('no_camera');
      return;
    }
    try {
      const { startGestures } = await import('@omnicanvas/gesture/runner');
      startRef.current = performance.now();
      runnerRef.current = await startGestures(video, {
        armed: true,
        tuning: effectiveTuning(settings),
        dictionary: settings.dictionary,
        onEvent,
        onFrame: (raw, processed, nextView) => {
          framesRef.current = { raw, processed };
          setView(nextView);
        },
      });
      setArmed(true);
      setLive('on');
    } catch {
      setLive('unavailable');
    }
  }, [onEvent, settings]);

  const loadRecording = useCallback((next: Recording) => {
    replayerRef.current?.pause();
    setPlaying(false);
    setRecording(next);
    setFired([]);
  }, []);

  const play = useCallback(() => {
    if (!recording) return;
    stopLive();
    if (!replayerRef.current || !playing) {
      const pipeline: Pipeline = createPipeline({
        tuning: effectiveTuning(settings),
        dictionary: settings.dictionary,
        armed: recording.armed,
      });
      setFired([]);
      startRef.current = performance.now();
      replayerRef.current = createReplayer(
        recording.frames,
        (frame) => {
          const out = pipeline.push(frame);
          framesRef.current = { raw: frame, processed: out.frame };
          setView(out.view);
          out.events.forEach(onEvent);
        },
        () => setPlaying(false),
      );
    }
    replayerRef.current.play();
    setPlaying(true);
  }, [recording, playing, settings, onEvent, stopLive]);

  const pause = useCallback(() => {
    replayerRef.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(
    () => () => {
      replayerRef.current?.pause();
      runnerRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return {
    settings,
    setSettings,
    stage,
    dispatch,
    log,
    view,
    armed,
    cursor,
    live,
    startLive,
    stopLive,
    recording,
    loadRecording,
    playing,
    play,
    pause,
    fired,
    videoRef,
    areaRef,
    framesRef,
  };
}
```

Nota sul rigioco: «Rigioca» dopo «Pausa» riprende dallo stesso punto (la catena e il
`replayer` restano); a registrazione finita riparte da capo con una catena nuova. Se il lint di
`react-hooks` rifiuta un `setState` dentro un effetto (cursore), spostare l'aggiornamento
nella callback di `requestAnimationFrame` come sopra e, per il ramo senza inseguimento,
derivare `cursor` durante il render: `const shown = settings.toggles.smoothCursor ? cursor : target;`
e restituire `cursor: shown`.

- [ ] **Step 8: `hand-panel.tsx`, `lab.tsx`, `page.tsx`**

`hand-panel.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { poseMetrics, type Frame, type RecognizerView, type Tuning } from '@omnicanvas/gesture';
import { drawHands } from '@/lib/gesture-lab/hand-drawing';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  framesRef: React.RefObject<{ raw: Frame; processed: Frame } | null>;
  view: RecognizerView | null;
  tuning: Tuning;
  feedback: boolean;
};

const FINGER_LABELS = { index: 'Indice', middle: 'Medio', ring: 'Anulare', pinky: 'Mignolo' } as const;

export function HandPanel({ videoRef, framesRef, view, tuning, feedback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!feedback) {
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let frame = 0;
    const styles = getComputedStyle(document.documentElement);
    const colors = {
      raw: styles.getPropertyValue('--color-muted').trim() || 'gray',
      processed: styles.getPropertyValue('--color-accent').trim() || 'lime',
    };
    const loop = () => {
      if (canvasRef.current) drawHands(canvasRef.current, framesRef.current, colors);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [feedback, framesRef]);

  const hand = framesRef.current?.processed.hands[0];
  const metrics = hand ? poseMetrics(hand) : null;
  const progress = view?.hold?.progress ?? 0;

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-tile bg-stage">
        <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        <canvas ref={canvasRef} width={640} height={480} className="pointer-events-none absolute inset-0 h-full w-full" />
        {feedback && view && (
          <div className="absolute left-2 top-2 flex items-center gap-2 rounded-full bg-surface px-3 py-1">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-label="Attesa del gesto">
              <circle cx="14" cy="14" r="11" fill="none" className="stroke-line" strokeWidth="3" />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                className="stroke-accent"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 11 * progress} ${2 * Math.PI * 11}`}
                transform="rotate(-90 14 14)"
              />
            </svg>
            <span className="text-base font-semibold">{view.pose}</span>
          </div>
        )}
      </div>
      {view && (
        <p className="text-xs text-muted">
          {`Posa grezza: ${view.rawPose} · stabile: ${view.pose} · ${view.armed ? 'armato' : 'in pausa'} · pausa ${Math.round(view.cooldownLeftMs)} ms`}
        </p>
      )}
      {metrics && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          {(Object.keys(FINGER_LABELS) as (keyof typeof FINGER_LABELS)[]).map((finger) => (
            <div key={finger} className="flex justify-between">
              <dt>{FINGER_LABELS[finger]}</dt>
              <dd className="tabular-nums">
                {metrics.fingers[finger].toFixed(2)}{' '}
                <span className="text-muted">{`(> ${tuning.pose.extended} esteso, < ${tuning.pose.folded} piegato)`}</span>
              </dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt>Pinch</dt>
            <dd className="tabular-nums">
              {metrics.pinch.toFixed(2)} <span className="text-muted">{`(< ${tuning.pose.pinchOn})`}</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Pollice</dt>
            <dd>{metrics.thumbExtended ? 'esteso' : 'chiuso'}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
```

I nomi `--color-muted` e `--color-accent` sono quelli di `packages/ui/src/theme.css`.

`lab.tsx`:

```tsx
'use client';

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@omnicanvas/ui';
import { StageBoard } from '@/app/room/[code]/stage-board';
import { effectiveTuning, tuningToCode } from '@/lib/gesture-lab/settings';
import { useGestureLab } from '@/lib/gesture-lab/use-gesture-lab';
import { EventList } from './event-list';
import { HandPanel } from './hand-panel';
import { LabControls } from './lab-controls';
import { ReplayPanel } from './replay-panel';

const LIVE_MESSAGES = {
  off: null,
  loading: 'Avvio della webcam e del riconoscimento…',
  on: null,
  no_camera: 'Webcam non disponibile: consenti la fotocamera nel browser. Il rigioco funziona lo stesso.',
  unavailable: 'Riconoscimento delle mani non disponibile su questo dispositivo. Il rigioco funziona lo stesso.',
} as const;

// Solo nel browser: le impostazioni vengono da localStorage, il server non le conosce.
const subscribe = () => () => {};
export function Lab() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? <LabClient /> : null;
}

function LabClient() {
  const lab = useGestureLab();
  const [code, setCode] = useState<string | null>(null);
  const message = LIVE_MESSAGES[lab.live];

  async function copyCode() {
    const text = tuningToCode(lab.settings.tuning, lab.settings.dictionary);
    try {
      await navigator.clipboard.writeText(text);
      setCode(null);
    } catch {
      setCode(text);
    }
  }

  return (
    <main className="grid min-h-dvh grid-cols-1 gap-4 bg-bg p-4 text-fg lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-h-0 flex-col gap-2">
        <h1 className="text-lg font-extrabold">Laboratorio gesture</h1>
        <div ref={lab.areaRef} className="relative min-h-[480px] flex-1">
          <StageBoard stage={lab.stage} assetUrls={{}} dispatch={lab.dispatch} />
        </div>
        {lab.cursor && (
          <div
            aria-hidden
            style={{ left: lab.cursor.x, top: lab.cursor.y }}
            className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
              lab.cursor.grabbing ? 'h-8 w-8 border-accent bg-accent/30' : 'h-5 w-5 border-fg'
            }`}
          />
        )}
      </section>

      <aside className="flex flex-col gap-4 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {lab.live === 'on' ? (
            <Button onClick={lab.stopLive}>Ferma la webcam</Button>
          ) : (
            <Button variant="accent" onClick={() => void lab.startLive()}>
              Avvia la webcam
            </Button>
          )}
          <span className="self-center text-xs text-muted">{lab.armed ? 'Gesture attive' : 'Gesture in pausa'}</span>
        </div>
        {message && <p className="text-xs text-muted">{message}</p>}
        <HandPanel
          videoRef={lab.videoRef}
          framesRef={lab.framesRef}
          view={lab.view}
          tuning={effectiveTuning(lab.settings)}
          feedback={lab.settings.toggles.feedback}
        />
        <ReplayPanel
          recording={lab.recording}
          playing={lab.playing}
          fired={lab.fired}
          onLoad={lab.loadRecording}
          onPlay={lab.play}
          onPause={lab.pause}
        />
        <EventList entries={lab.log} />
        <LabControls settings={lab.settings} onChange={lab.setSettings} />
        <Button onClick={() => void copyCode()}>Copia come codice</Button>
        {code && (
          <textarea readOnly value={code} rows={12} className="rounded-tile border border-line bg-stage p-2 font-mono text-xs" />
        )}
      </aside>
    </main>
  );
}
```

`page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { Lab } from './lab';

// Strumento di sviluppo: mai in produzione.
export default function GestureLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Lab />;
}
```

- [ ] **Step 9: Run all checks**

Run: `npx vitest run tests/unit && npm run typecheck && npm run lint`
Expected: PASS.

Poi a mano: `npm run dev`, aprire `http://localhost:3000/dev/gesture-lab`, verificare che la
pagina si carichi, che «Avvia la webcam» mostri il video e che le 3 finestre siano sul palco.
Annotare l'esito nel report (Sean farà la prova vera con le mani).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/gesture-lab apps/web/src/app/dev/gesture-lab tests/unit/gesture-lab-ui.test.tsx
git commit -m "feat(gesture-lab): dev page with hand view, corrections, tuning, dictionary and replay"
```

---

### Task 8: documenti e verifica finale

**Files:**
- Modify: `docs/BACKLOG.md`, `CLAUDE.md` («Stato attuale»), `tests/fixtures/gestures/README.md`

- [ ] **Step 1: backlog**

In `docs/BACKLOG.md`, sezione gesture (vicino a «Registrare gesture reali…»):

```markdown
- [x] Laboratorio gesture `/dev/gesture-lab`: dizionario, soglie, filtro One Euro, cursore a
      60fps, riscontro, pose stabili, rigioco (spec `docs/specs/2026-10-05-gesture-lab-design.md`)
- [ ] Decidere quali correzioni accendere nella call dopo le prove nel laboratorio, e portarle
      nei predefiniti con un test
- [ ] Gesti continui (zoom con le dita, rotazione): serve un ADR nuovo, ADR-0010 non li prevede
```

- [ ] **Step 2: fixtures README and project state**

In `tests/fixtures/gestures/README.md` aggiungere in fondo:
`Si possono rigiocare con le impostazioni correnti da /dev/gesture-lab.`

In `CLAUDE.md`, sezione «Stato attuale», una riga: laboratorio gesture `/dev/gesture-lab` su
`slice/gesture-lab` (spec `docs/specs/2026-10-05-gesture-lab-design.md`), solo sviluppo, call
invariata.

- [ ] **Step 3: full verification**

Run: `npm run verify`
Expected: typecheck, lint e test unitari verdi.

- [ ] **Step 4: Commit**

```bash
git add docs/BACKLOG.md CLAUDE.md tests/fixtures/gestures/README.md
git commit -m "docs: gesture lab in backlog and project state"
```
