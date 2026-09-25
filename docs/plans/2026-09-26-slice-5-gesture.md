# Slice 5 — Gesture: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'host comanda il palco con le mani. Palmo aperto per un secondo arma o
disarma le gesture; indice alzato chiama l'agente; pinch-trascina-rilascia porta un
contenuto dal vassoio a una finestra o sposta una finestra; swipe cambia la finestra
in primo piano; due mani che si allontanano creano una finestra; flick verso l'alto
archivia. Ogni gesto ha già il suo click. Se la CPU non regge, cade prima il gesto a
due mani, poi la frequenza; mai una funzione.

**Architecture:** `packages/gesture` ha un nucleo puro, senza browser: geometria dei
landmark, `classifyPose`, `createRecognizer` (armamento, hold, cooldown, drag, swipe,
flick, due mani, dizionario configurabile di ADR-0010) e `createAdaptiveController`. Il
runner MediaPipe (`@omnicanvas/gesture/runner`, solo browser) riceve un `<video>`,
chiama il riconoscitore ed emette eventi. `apps/web` traduce gli eventi in comandi di
palco con le stesse funzioni del mouse (`resolveDrop`, `gestureAction`): il palco non sa
da dove arriva un comando. I frame e i landmark non lasciano il browser.

**Tech Stack:** `@mediapipe/tasks-vision` 1.0.1 (HandLandmarker, modalità VIDEO, delegate
GPU con ripiego su CPU), TypeScript, Vitest con mani sintetiche, Playwright.

**Spec:** `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (§2.7 gesture, §4.8, §8 slice 5,
§9 DoD della prima demo). Leggere `docs/adr/0005-le-gesture-sono-un-pilastro.md`,
`docs/adr/0010-dizionario-gesture-provvisorio.md`, `docs/ARCHITECTURE.md` §8.

## Global Constraints

- `packages/gesture` non conosce finestre, stanze, LiveKit né React: riceve un `<video>` (o frame di landmark) ed emette eventi. Il nucleo puro si testa senza webcam.
- Nessun frame e nessun landmark lascia il dispositivo: niente rete, niente log dei landmark.
- Palmo aperto è l'interruttore: da disarmati passa solo il comando mappato su `GESTURES_TOGGLE`.
- Il dizionario è configurazione (`Dictionary`), non costante sparsa: ogni gesto si può rimappare o spegnere (`null`).
- Il video vince: il controller adattivo toglie prima il gesto a due mani, poi riduce la frequenza (30 → 20 → 15 → 10).
- Ogni comando resta raggiungibile col mouse (regola 6). Senza camera le gesture si spiegano e non tolgono nulla.
- Solo l'host usa le gesture nell'MVP, e solo dal desktop.
- Coordinate: il riconoscitore emette punti normalizzati 0-1 **in vista specchio** (x = 1 - x dell'immagine), come l'utente vede sé stesso.
- Commit `<tipo>(<ambito>): <cosa>`, ambiti `gesture`, `web`. Branch `slice/5-gesture` da `slice/4a-agente`.

## Review Focus

1. Movimenti involontari mentre si parla (mani che gesticolano, palmo che passa davanti alla camera) → nessun comando se disarmati, nessun toggle se la mano non resta ferma un secondo. Test nel task 5.2.
2. La mano esce dall'inquadratura durante un pinch → `DROP` all'ultimo punto, niente contenuto «appeso». Test nel task 5.2.
3. Un gesto tenuto a lungo → un solo comando, non uno per frame. Test nel task 5.2.
4. CPU satura → il controller spegne prima le due mani, poi scende di frequenza, e risale quando torna la calma. Test nel task 5.3.
5. Camera spenta o negata, o MediaPipe che non si carica → messaggio chiaro, il palco funziona col mouse. Test nel task 5.4 (logica) e 5.6 (e2e).

## Mappa dei file

```
packages/gesture/
  package.json, tsconfig.json         exports "." (puro) e "./runner" (browser)
  src/types.ts                        Landmark, Hand, Frame, Pose, GestureEvent, Dictionary
  src/geometry.ts                     palmSize, fingerExtended, pinchRatio, palmCenter, pinchPoint
  src/pose.ts                         classifyPose
  src/recognizer.ts                   createRecognizer
  src/adaptive.ts                     createAdaptiveController
  src/runner.ts                       startGestures (MediaPipe)
  src/index.ts
apps/web/src/lib/stage/drop.ts        DragItem, resolveDrop, slotRectsFromDom
apps/web/src/lib/stage/gesture-actions.ts  gestureAction, gestureStatusMessage
apps/web/src/lib/stage/use-gestures.ts     hook
apps/web/src/app/room/[code]/gesture-control.tsx  ✋, stato, video nascosto, cursore
apps/web/src/app/room/[code]/stage-board.tsx, window-view.tsx, tray.tsx, stage-area.tsx, agent-panel.tsx  modifica
apps/web/src/app/dev/gesture-recorder/     registratore di landmark (solo sviluppo)
tests/fixtures/hands.ts                mani sintetiche
tests/fixtures/gestures/               registrazioni reali (le aggiunge Sean)
tests/unit/gesture-*.test.ts, stage-drop.test.ts, gesture-actions.test.ts
e2e/gestures.spec.ts
docs/spikes/2026-09-26-test-demo-consulenti.md
```

---

### Task 5.1: `packages/gesture` — geometria e pose

**Files:**
- Create: `packages/gesture/package.json`, `packages/gesture/tsconfig.json`, `packages/gesture/src/types.ts`, `packages/gesture/src/geometry.ts`, `packages/gesture/src/pose.ts`, `packages/gesture/src/index.ts`, `tests/fixtures/hands.ts`
- Delete: `packages/gesture/README.md`
- Test: `tests/unit/gesture-pose.test.ts`

**Interfaces:**
- Produces:
  - `type Landmark = { x: number; y: number; z: number }`, `type Hand = { landmarks: Landmark[] }` (21 punti, indici MediaPipe), `type Frame = { t: number; hands: Hand[] }`, `type Point = { x: number; y: number }`
  - `type Pose = 'open_palm' | 'index_up' | 'pinch' | 'thumb_up' | 'thumb_down' | 'fist' | 'none'`
  - `palmSize(hand)`, `fingerRatio(hand, finger)`, `thumbExtended(hand)`, `pinchRatio(hand)`, `palmCenter(hand): Point`, `pinchPoint(hand): Point` (vista specchio)
  - `PINCH_ON = 0.25`, `PINCH_OFF = 0.35`, `classifyPose(hand: Hand, wasPinching?: boolean): Pose`
  - test: `hand(pose, center?, scale?): Hand`

- [ ] **Step 1: pacchetto**

`packages/gesture/package.json`:

```json
{
  "name": "@omnicanvas/gesture",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./runner": "./src/runner.ts"
  },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@mediapipe/tasks-vision": "1.0.1" }
}
```

`packages/gesture/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`packages/gesture/src/types.ts`:

```ts
// Nessuna dipendenza da finestre, stanze o rete: il pacchetto riceve landmark ed emette eventi.

export type Landmark = { x: number; y: number; z: number };
// 21 punti con gli indici di MediaPipe: 0 polso, 1-4 pollice, 5-8 indice,
// 9-12 medio, 13-16 anulare, 17-20 mignolo.
export type Hand = { landmarks: Landmark[] };
export type Frame = { t: number; hands: Hand[] };
export type Point = { x: number; y: number };

export type Pose = 'open_palm' | 'index_up' | 'pinch' | 'thumb_up' | 'thumb_down' | 'fist' | 'none';

export type GestureName =
  | 'open_palm_hold'
  | 'index_up_hold'
  | 'thumb_up_hold'
  | 'thumb_down_hold'
  | 'pinch_drag'
  | 'swipe_left'
  | 'swipe_right'
  | 'flick_up'
  | 'two_hands_spread';

export type GestureCommand =
  | 'GESTURES_TOGGLE'
  | 'AGENT_ACTIVATE'
  | 'CONFIRM'
  | 'REJECT'
  | 'DRAG'
  | 'FOCUS_NEXT'
  | 'FOCUS_PREV'
  | 'WINDOW_ARCHIVE'
  | 'WINDOW_CREATE';

// ADR-0010: provvisorio e configurabile. null spegne il gesto.
export type Dictionary = Record<GestureName, GestureCommand | null>;

export type DiscreteGestureEvent = {
  type: 'AGENT_ACTIVATE' | 'CONFIRM' | 'REJECT' | 'FOCUS_NEXT' | 'FOCUS_PREV' | 'WINDOW_ARCHIVE' | 'WINDOW_CREATE';
};

export type GestureEvent =
  | { type: 'GESTURES_TOGGLE'; armed: boolean }
  | DiscreteGestureEvent
  | { type: 'GRAB' | 'MOVE' | 'DROP'; x: number; y: number };
```

```bash
git checkout slice/4a-agente
git checkout -b slice/5-gesture
git rm packages/gesture/README.md
npm install
```

- [ ] **Step 2: mani sintetiche e test che falliscono**

`tests/fixtures/hands.ts`:

```ts
import type { Hand, Landmark } from '@omnicanvas/gesture';

// Mani sintetiche, dita verso l'alto (y decresce). Coordinate in unità della mano (s),
// attorno al centro indicato. Le soglie del classificatore hanno margini ampi su queste forme.
type SyntheticPose = 'open_palm' | 'index_up' | 'pinch' | 'thumb_up' | 'thumb_down' | 'fist';

export function hand(pose: SyntheticPose, center = { x: 0.5, y: 0.5 }, s = 0.2): Hand {
  const p = (dx: number, dy: number): Landmark => ({ x: center.x + dx * s, y: center.y + dy * s, z: 0 });
  const mcp = { index: [-0.15, 0], middle: [-0.05, -0.03], ring: [0.05, 0], pinky: [0.15, 0.05] } as const;
  const extended = ([x, y]: readonly [number, number]) => [p(x, y), p(x, y - 0.25), p(x, y - 0.4), p(x, y - 0.5)];
  const folded = ([x, y]: readonly [number, number]) => [p(x, y), p(x, y - 0.12), p(x, y - 0.02), p(x, y + 0.05)];

  const thumbs = {
    side: [p(-0.12, 0.4), p(-0.25, 0.3), p(-0.4, 0.15), p(-0.55, 0.05)],
    folded: [p(-0.12, 0.4), p(-0.2, 0.3), p(-0.15, 0.27), p(-0.05, 0.25)],
    up: [p(-0.12, 0.4), p(-0.2, 0.1), p(-0.2, -0.15), p(-0.2, -0.4)],
    down: [p(-0.12, 0.4), p(-0.2, 0.3), p(-0.2, 0.6), p(-0.2, 0.9)],
    pinch: [p(-0.12, 0.4), p(-0.25, 0.3), p(-0.22, 0.1), p(-0.13, -0.35)],
  };

  const fingersUp = { index: true, middle: true, ring: true, pinky: true };
  const layout: Record<SyntheticPose, { thumb: keyof typeof thumbs; up: typeof fingersUp }> = {
    open_palm: { thumb: 'side', up: fingersUp },
    index_up: { thumb: 'folded', up: { index: true, middle: false, ring: false, pinky: false } },
    pinch: { thumb: 'pinch', up: fingersUp },
    thumb_up: { thumb: 'up', up: { index: false, middle: false, ring: false, pinky: false } },
    thumb_down: { thumb: 'down', up: { index: false, middle: false, ring: false, pinky: false } },
    fist: { thumb: 'folded', up: { index: false, middle: false, ring: false, pinky: false } },
  };
  const { thumb, up } = layout[pose];

  const finger = (name: keyof typeof mcp) => {
    if (pose === 'pinch' && name === 'index') {
      const [x, y] = mcp.index;
      return [p(x, y), p(x, y - 0.2), p(x, y - 0.3), p(x, y - 0.35)];
    }
    return up[name] ? extended(mcp[name]) : folded(mcp[name]);
  };

  return {
    landmarks: [p(0, 0.5), ...thumbs[thumb], ...finger('index'), ...finger('middle'), ...finger('ring'), ...finger('pinky')],
  };
}
```

`tests/unit/gesture-pose.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PINCH_OFF, classifyPose, palmCenter, pinchPoint, pinchRatio } from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

describe('classifyPose', () => {
  for (const pose of ['open_palm', 'index_up', 'pinch', 'thumb_up', 'thumb_down', 'fist'] as const) {
    it(`recognises ${pose}`, () => {
      expect(classifyPose(hand(pose))).toBe(pose);
    });
  }

  it('does not depend on where the hand is or how big it looks', () => {
    expect(classifyPose(hand('open_palm', { x: 0.2, y: 0.7 }, 0.12))).toBe('open_palm');
    expect(classifyPose(hand('index_up', { x: 0.8, y: 0.3 }, 0.3))).toBe('index_up');
  });

  it('keeps a pinch until the fingers clearly open (hysteresis)', () => {
    const almost = hand('pinch');
    // Allontana la punta del pollice fino a un rapporto fra PINCH_ON e PINCH_OFF.
    const thumbTip = almost.landmarks[4]!;
    const size = 0.2 * 0.532;
    almost.landmarks[4] = { ...thumbTip, x: almost.landmarks[8]!.x + size * 0.3 };
    expect(pinchRatio(almost)).toBeLessThan(PINCH_OFF);
    expect(classifyPose(almost, false)).not.toBe('pinch');
    expect(classifyPose(almost, true)).toBe('pinch');
  });

  it('returns none for an empty or partial hand', () => {
    expect(classifyPose({ landmarks: [] })).toBe('none');
  });
});

describe('points', () => {
  it('mirrors the pinch point like a selfie view', () => {
    const point = pinchPoint(hand('pinch', { x: 0.3, y: 0.5 }));
    expect(point.x).toBeCloseTo(0.728, 3);
    expect(point.y).toBeCloseTo(0.43, 3);
  });

  it('puts the palm centre between wrist and knuckles, in image coordinates', () => {
    const c = palmCenter(hand('open_palm', { x: 0.5, y: 0.5 }));
    expect(c.x).toBeCloseTo(0.5, 2);
    expect(c.y).toBeCloseTo(0.5 + 0.2 * 0.104, 2);
  });
});
```

Run: `npx vitest run tests/unit/gesture-pose.test.ts`
Expected: FAIL, `@omnicanvas/gesture` non risolto.

- [ ] **Step 3: geometria e pose**

`packages/gesture/src/geometry.ts`:

```ts
import type { Hand, Landmark, Point } from './types';

export const FINGERS = { index: [5, 6, 8], middle: [9, 10, 12], ring: [13, 14, 16], pinky: [17, 18, 20] } as const;
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
```

`packages/gesture/src/pose.ts`:

```ts
import { fingerRatio, palmSize, pinchRatio, thumbExtended, type Finger } from './geometry';
import type { Hand, Pose } from './types';

export const PINCH_ON = 0.25;
export const PINCH_OFF = 0.35;

const EXTENDED = 1.6;
const FOLDED = 1.2;
const OTHERS: Finger[] = ['middle', 'ring', 'pinky'];

export function classifyPose(hand: Hand, wasPinching = false): Pose {
  if (hand.landmarks.length < 21) return 'none';
  if (pinchRatio(hand) < (wasPinching ? PINCH_OFF : PINCH_ON)) return 'pinch';

  const extended = (f: Finger) => fingerRatio(hand, f) > EXTENDED;
  const folded = (f: Finger) => fingerRatio(hand, f) < FOLDED;
  const thumb = thumbExtended(hand);
  const fourExtended = extended('index') && OTHERS.every(extended);
  const fourFolded = folded('index') && OTHERS.every(folded);

  if (fourExtended && thumb) return 'open_palm';
  if (extended('index') && OTHERS.every(folded) && !thumb) return 'index_up';
  if (fourFolded && thumb) {
    const tip = hand.landmarks[4]!;
    const base = hand.landmarks[2]!;
    const margin = 0.3 * palmSize(hand);
    if (tip.y < base.y - margin) return 'thumb_up';
    if (tip.y > base.y + margin) return 'thumb_down';
  }
  if (fourFolded && !thumb) return 'fist';
  return 'none';
}
```

`packages/gesture/src/index.ts`:

```ts
export * from './types';
export { FINGERS, fingerRatio, palmCenter, palmSize, pinchPoint, pinchRatio, thumbExtended, type Finger } from './geometry';
export { PINCH_OFF, PINCH_ON, classifyPose } from './pose';
```

Run: `npx vitest run tests/unit/gesture-pose.test.ts`
Expected: PASS (11 test).

- [ ] **Step 4: commit**

Run: `npm run typecheck && npm run lint`
Expected: puliti.

```bash
git add -A packages/gesture package-lock.json tests/fixtures/hands.ts tests/unit/gesture-pose.test.ts
git commit -m "feat(gesture): landmark geometry and pose classifier tested on synthetic hands"
```

---

### Task 5.2: Riconoscitore

**Files:**
- Create: `packages/gesture/src/recognizer.ts`
- Modify: `packages/gesture/src/index.ts`
- Test: `tests/unit/gesture-recognizer.test.ts`

**Interfaces:**
- Consumes: `classifyPose`, `palmCenter`, `pinchPoint`, tipi (5.1).
- Produces:
  - `DEFAULT_DICTIONARY: Dictionary` (ADR-0010)
  - `TIMINGS = { holdMs: 1000, cooldownMs: 800, stillness: 0.08, swipe: { distance: 0.25, withinMs: 400 }, flick: { distance: 0.25, withinMs: 300 }, spread: { distance: 0.2, withinMs: 600 } }`
  - `createRecognizer(options?: { dictionary?: Dictionary; armed?: boolean; twoHands?: boolean }): Recognizer` con `Recognizer = { push(frame: Frame): GestureEvent[]; setArmed(armed: boolean): void; setTwoHands(on: boolean): void; isArmed(): boolean }`

- [ ] **Step 1: test che falliscono**

`tests/unit/gesture-recognizer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_DICTIONARY, createRecognizer, type Frame, type GestureEvent, type Hand } from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const STEP = 33;

// Frame da `from` a `to` ms; `make(progress)` restituisce le mani al punto 0..1 del tratto.
function span(from: number, to: number, make: (progress: number) => Hand[]): Frame[] {
  const frames: Frame[] = [];
  for (let t = from; t <= to; t += STEP) frames.push({ t, hands: make((t - from) / Math.max(1, to - from)) });
  return frames;
}

function run(frames: Frame[], options: Parameters<typeof createRecognizer>[0] = {}) {
  const recognizer = createRecognizer(options);
  const events: GestureEvent[] = frames.flatMap((f) => recognizer.push(f));
  return { events, recognizer };
}

const still = (pose: Parameters<typeof hand>[0], from: number, to: number, center = { x: 0.5, y: 0.5 }) =>
  span(from, to, () => [hand(pose, center)]);

describe('arming', () => {
  it('toggles on an open palm held still for a second, once', () => {
    const { events, recognizer } = run(still('open_palm', 0, 2_500));
    expect(events).toEqual([{ type: 'GESTURES_TOGGLE', armed: true }]);
    expect(recognizer.isArmed()).toBe(true);
  });

  it('ignores every other gesture while disarmed', () => {
    const { events } = run([...still('index_up', 0, 1_500), ...still('thumb_up', 1_600, 3_000)]);
    expect(events).toEqual([]);
  });

  it('does not toggle on a palm that moves or shows up for less than a second', () => {
    const moving = span(0, 2_000, (k) => [hand('open_palm', { x: 0.3 + 0.4 * k, y: 0.5 })]);
    expect(run(moving).events).toEqual([]);
    expect(run(still('open_palm', 0, 800)).events).toEqual([]);
  });

  it('disarms with the same gesture', () => {
    const { events } = run([...still('open_palm', 0, 1_200), ...still('fist', 1_233, 1_500), ...still('open_palm', 2_400, 3_600)]);
    expect(events).toEqual([
      { type: 'GESTURES_TOGGLE', armed: true },
      { type: 'GESTURES_TOGGLE', armed: false },
    ]);
  });
});

describe('holds when armed', () => {
  it('maps index up, thumb up and thumb down', () => {
    const frames = [...still('index_up', 0, 1_200), ...still('thumb_up', 2_200, 3_400), ...still('thumb_down', 4_400, 5_600)];
    expect(run(frames, { armed: true }).events.map((e) => e.type)).toEqual(['AGENT_ACTIVATE', 'CONFIRM', 'REJECT']);
  });

  it('respects a gesture switched off in the dictionary', () => {
    const dictionary = { ...DEFAULT_DICTIONARY, index_up_hold: null };
    expect(run(still('index_up', 0, 1_500), { armed: true, dictionary }).events).toEqual([]);
  });
});

describe('pinch drag', () => {
  it('grabs, moves and drops at the mirrored pinch point', () => {
    const frames = [
      ...span(0, 200, (k) => [hand('pinch', { x: 0.3 + 0.2 * k, y: 0.5 })]),
      ...still('open_palm', 233, 300, { x: 0.5, y: 0.5 }),
    ];
    const { events } = run(frames, { armed: true });
    expect(events[0]).toMatchObject({ type: 'GRAB' });
    expect((events[0] as { x: number }).x).toBeCloseTo(0.728, 2);
    expect(events.slice(1, -1).every((e) => e.type === 'MOVE')).toBe(true);
    const drop = events.at(-1) as { type: string; x: number };
    expect(drop.type).toBe('DROP');
    expect(drop.x).toBeCloseTo(1 - (0.5 - 0.028), 2);
  });

  it('drops at the last point when the hand leaves the frame', () => {
    const frames: Frame[] = [...still('pinch', 0, 100), { t: 133, hands: [] }];
    expect(run(frames, { armed: true }).events.map((e) => e.type)).toEqual(['GRAB', 'MOVE', 'MOVE', 'MOVE', 'DROP']);
  });

  it('does nothing when disarmed', () => {
    expect(run(still('pinch', 0, 300)).events).toEqual([]);
  });
});

describe('motion when armed', () => {
  it('swipes: hand to the left of the screen is next, to the right is previous', () => {
    // Nell'immagine x cresce verso destra; sullo schermo, a specchio, verso sinistra.
    const left = span(0, 200, (k) => [hand('open_palm', { x: 0.3 + 0.4 * k, y: 0.5 })]);
    expect(run(left, { armed: true }).events).toEqual([{ type: 'FOCUS_NEXT' }]);
    const right = span(0, 200, (k) => [hand('open_palm', { x: 0.7 - 0.4 * k, y: 0.5 })]);
    expect(run(right, { armed: true }).events).toEqual([{ type: 'FOCUS_PREV' }]);
  });

  it('ignores slow drifting', () => {
    const slow = span(0, 2_000, (k) => [hand('open_palm', { x: 0.3 + 0.4 * k, y: 0.5 })]);
    expect(run(slow, { armed: true }).events).toEqual([]);
  });

  it('archives on an upward flick', () => {
    const flick = span(0, 200, (k) => [hand('open_palm', { x: 0.5, y: 0.7 - 0.35 * k })]);
    expect(run(flick, { armed: true }).events).toEqual([{ type: 'WINDOW_ARCHIVE' }]);
  });

  it('creates a window when two hands spread apart, unless two hands are off', () => {
    const spread = span(0, 400, (k) => [
      hand('open_palm', { x: 0.45 - 0.2 * k, y: 0.5 }),
      hand('open_palm', { x: 0.55 + 0.2 * k, y: 0.5 }),
    ]);
    expect(run(spread, { armed: true }).events).toEqual([{ type: 'WINDOW_CREATE' }]);
    expect(run(spread, { armed: true, twoHands: false }).events).toEqual([]);
  });

  it('fires one command per swipe thanks to the cooldown', () => {
    const long = span(0, 400, (k) => [hand('open_palm', { x: 0.1 + 0.8 * k, y: 0.5 })]);
    expect(run(long, { armed: true }).events).toEqual([{ type: 'FOCUS_NEXT' }]);
  });
});
```

Run: `npx vitest run tests/unit/gesture-recognizer.test.ts`
Expected: FAIL, `createRecognizer` non esportato.

- [ ] **Step 2: implementa**

`packages/gesture/src/recognizer.ts`:

```ts
import { palmCenter, pinchPoint } from './geometry';
import { classifyPose } from './pose';
import type { Dictionary, Frame, GestureCommand, GestureEvent, GestureName, Point, Pose } from './types';

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

export const TIMINGS = {
  holdMs: 1_000,
  cooldownMs: 800,
  // La mano deve restare ferma (in frazioni dell'immagine) perché un hold conti.
  stillness: 0.08,
  swipe: { distance: 0.25, withinMs: 400 },
  flick: { distance: 0.25, withinMs: 300 },
  spread: { distance: 0.2, withinMs: 600 },
} as const;

const HOLDS: Partial<Record<Pose, GestureName>> = {
  open_palm: 'open_palm_hold',
  index_up: 'index_up_hold',
  thumb_up: 'thumb_up_hold',
  thumb_down: 'thumb_down_hold',
};

export type Recognizer = {
  push(frame: Frame): GestureEvent[];
  setArmed(armed: boolean): void;
  setTwoHands(on: boolean): void;
  isArmed(): boolean;
};

type Sample = Point & { t: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function oldestWithin<T extends { t: number }>(samples: T[], t: number, withinMs: number): T | undefined {
  return samples.find((s) => t - s.t <= withinMs);
}

export function createRecognizer(
  options: { dictionary?: Dictionary; armed?: boolean; twoHands?: boolean } = {},
): Recognizer {
  const dictionary = options.dictionary ?? DEFAULT_DICTIONARY;
  let armed = options.armed ?? false;
  let twoHands = options.twoHands ?? true;

  let hold: { pose: Pose; start: number; anchor: Point; fired: boolean } | null = null;
  let pinching = false;
  let dragging: Point | null = null;
  let cooldownUntil = 0;
  let palms: Sample[] = [];
  let spreads: { t: number; d: number }[] = [];

  const resetMotion = () => {
    palms = [];
    spreads = [];
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
    cooldownUntil = t + TIMINGS.cooldownMs;
    resetMotion();
  };

  return {
    push(frame) {
      const out: GestureEvent[] = [];
      const { t } = frame;
      const primary = frame.hands[0];

      if (!primary) {
        hold = null;
        pinching = false;
        resetMotion();
        if (dragging) out.push({ type: 'DROP', ...dragging });
        dragging = null;
        return out;
      }

      const pose = classifyPose(primary, pinching);
      pinching = pose === 'pinch';
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
      } else if (!hold || hold.pose !== pose || distance(hold.anchor, center) > TIMINGS.stillness) {
        hold = { pose, start: t, anchor: center, fired: false };
      } else if (!hold.fired && t - hold.start >= TIMINGS.holdMs) {
        hold.fired = true;
        fire(holdName, t, out);
      }

      // Movimenti: swipe e flick sul centro del palmo, due mani sulla loro distanza.
      palms = [...palms.filter((s) => t - s.t <= TIMINGS.spread.withinMs), { t, ...center }];
      const swipeFrom = oldestWithin(palms, t, TIMINGS.swipe.withinMs);
      if (swipeFrom) {
        const dx = center.x - swipeFrom.x;
        const dy = center.y - swipeFrom.y;
        if (Math.abs(dx) >= TIMINGS.swipe.distance && Math.abs(dy) < Math.abs(dx) / 2) {
          // Immagine verso destra = schermo (a specchio) verso sinistra.
          fire(dx > 0 ? 'swipe_left' : 'swipe_right', t, out);
        }
      }
      const flickFrom = oldestWithin(palms, t, TIMINGS.flick.withinMs);
      if (flickFrom && pose === 'open_palm') {
        const dx = center.x - flickFrom.x;
        const dy = center.y - flickFrom.y;
        if (dy <= -TIMINGS.flick.distance && Math.abs(dx) < Math.abs(dy) / 2) fire('flick_up', t, out);
      }

      const second = frame.hands[1];
      if (twoHands && second) {
        const d = distance(center, palmCenter(second));
        spreads = [...spreads.filter((s) => t - s.t <= TIMINGS.spread.withinMs), { t, d }];
        const from = oldestWithin(spreads, t, TIMINGS.spread.withinMs);
        if (from && d - from.d >= TIMINGS.spread.distance) fire('two_hands_spread', t, out);
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
  };
}
```

Aggiungi a `packages/gesture/src/index.ts`:

```ts
export { DEFAULT_DICTIONARY, TIMINGS, createRecognizer, type Recognizer } from './recognizer';
```

Run: `npx vitest run tests/unit/gesture-recognizer.test.ts`
Expected: PASS (15 test). Se un test di movimento fallisce per un solo frame di
differenza, controlla prima la geometria della mano sintetica in `tests/fixtures/hands.ts`
(i palmi di due mani affiancate non devono generare swipe): correggi le soglie solo se il
test descrive un caso reale.

- [ ] **Step 3: commit**

Run: `npm run typecheck && npm run lint`
Expected: puliti.

```bash
git add packages/gesture/src tests/unit/gesture-recognizer.test.ts
git commit -m "feat(gesture): recognizer with palm arming, holds, pinch drag, swipe, flick and two hands"
```

---

### Task 5.3: Frequenza adattiva e runner MediaPipe

**Files:**
- Create: `packages/gesture/src/adaptive.ts`, `packages/gesture/src/runner.ts`
- Modify: `packages/gesture/src/index.ts`
- Test: `tests/unit/gesture-adaptive.test.ts`

**Interfaces:**
- Produces:
  - `FPS_LADDER = [30, 20, 15, 10]`, `createAdaptiveController(options?: { targetFps?: number; minFps?: number; budgetRatio?: number; window?: number; recoverAfter?: number }): { record(inferenceMs: number): { fps: number; twoHands: boolean } | null; current(): { fps: number; twoHands: boolean } }`
  - da `@omnicanvas/gesture/runner`: `startGestures(video: HTMLVideoElement, options: { onEvent(event: GestureEvent): void; onFrame?(frame: Frame): void; armed?: boolean; dictionary?: Dictionary }): Promise<GestureRunner>` con `GestureRunner = { setArmed(armed: boolean): void; stop(): void }`

- [ ] **Step 1: test che fallisce**

`tests/unit/gesture-adaptive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAdaptiveController } from '@omnicanvas/gesture';

function feed(controller: ReturnType<typeof createAdaptiveController>, ms: number, count: number) {
  const changes = [];
  for (let i = 0; i < count; i += 1) {
    const change = controller.record(ms);
    if (change) changes.push(change);
  }
  return changes;
}

describe('adaptive controller', () => {
  it('drops the two-hand gesture first, then steps the frequency down', () => {
    const c = createAdaptiveController({ window: 10 });
    expect(feed(c, 40, 10)).toEqual([{ fps: 30, twoHands: false }]);
    expect(feed(c, 40, 10)).toEqual([{ fps: 20, twoHands: false }]);
    expect(feed(c, 40, 10)).toEqual([{ fps: 15, twoHands: false }]);
    expect(feed(c, 40, 10)).toEqual([{ fps: 10, twoHands: false }]);
    expect(feed(c, 40, 30)).toEqual([]);
  });

  it('keeps going while inference fits the budget', () => {
    const c = createAdaptiveController({ window: 10 });
    expect(feed(c, 12, 50)).toEqual([]);
    expect(c.current()).toEqual({ fps: 30, twoHands: true });
  });

  it('climbs back when the machine is calm: frequency first, then two hands', () => {
    const c = createAdaptiveController({ window: 10, recoverAfter: 30 });
    feed(c, 40, 20);
    expect(c.current()).toEqual({ fps: 20, twoHands: false });
    expect(feed(c, 2, 30)).toEqual([{ fps: 30, twoHands: false }]);
    expect(feed(c, 2, 30)).toEqual([{ fps: 30, twoHands: true }]);
  });
});
```

Run: `npx vitest run tests/unit/gesture-adaptive.test.ts`
Expected: FAIL.

- [ ] **Step 2: controller**

`packages/gesture/src/adaptive.ts`:

```ts
export const FPS_LADDER = [30, 20, 15, 10] as const;

// Il video vince sempre (ADR-0005): se l'inferenza supera il budget, prima cade il gesto
// a due mani (tracking doppio), poi la frequenza. Quando torna la calma si risale.
export function createAdaptiveController(
  options: { targetFps?: number; minFps?: number; budgetRatio?: number; window?: number; recoverAfter?: number } = {},
) {
  const targetFps = options.targetFps ?? 30;
  const minFps = options.minFps ?? 10;
  const budgetRatio = options.budgetRatio ?? 0.5;
  const window = options.window ?? 30;
  const recoverAfter = options.recoverAfter ?? 90;

  let fps: number = targetFps;
  let twoHands = true;
  let samples: number[] = [];
  let calm = 0;

  const state = () => ({ fps, twoHands });

  return {
    current: state,
    record(inferenceMs: number): { fps: number; twoHands: boolean } | null {
      samples.push(inferenceMs);
      if (samples.length < window) return null;
      const average = samples.reduce((a, b) => a + b, 0) / samples.length;
      samples = [];
      const budget = (1000 / fps) * budgetRatio;

      if (average > budget) {
        calm = 0;
        if (twoHands) {
          twoHands = false;
          return state();
        }
        const lower = FPS_LADDER.find((step) => step < fps && step >= minFps);
        if (lower === undefined) return null;
        fps = lower;
        return state();
      }

      if (average < budget / 2) {
        calm += window;
        if (calm < recoverAfter) return null;
        calm = 0;
        const higher = [...FPS_LADDER].reverse().find((step) => step > fps && step <= targetFps);
        if (higher !== undefined) {
          fps = higher;
          return state();
        }
        if (!twoHands) {
          twoHands = true;
          return state();
        }
        return null;
      }

      calm = 0;
      return null;
    },
  };
}
```

Aggiungi a `index.ts`: `export { FPS_LADDER, createAdaptiveController } from './adaptive';`

Run: `npx vitest run tests/unit/gesture-adaptive.test.ts`
Expected: PASS (3 test).

- [ ] **Step 3: runner**

`packages/gesture/src/runner.ts`:

```ts
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { createAdaptiveController } from './adaptive';
import { createRecognizer } from './recognizer';
import type { Dictionary, Frame, GestureEvent } from './types';

// Scaricati una volta: il modello gira nel browser, frame e landmark non escono mai.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type GestureRunner = { setArmed(armed: boolean): void; stop(): void };

async function createLandmarker(): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const base = { runningMode: 'VIDEO' as const, numHands: 2 };
  try {
    return await HandLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
    });
  } catch {
    return HandLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' },
    });
  }
}

export async function startGestures(
  video: HTMLVideoElement,
  options: {
    onEvent(event: GestureEvent): void;
    onFrame?(frame: Frame): void;
    armed?: boolean;
    dictionary?: Dictionary;
  },
): Promise<GestureRunner> {
  const landmarker = await createLandmarker();
  const recognizer = createRecognizer({
    ...(options.dictionary ? { dictionary: options.dictionary } : {}),
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
        recognizer.setTwoHands(change.twoHands);
        void landmarker.setOptions({ numHands: change.twoHands ? 2 : 1 });
      }
      const frame: Frame = {
        t: now,
        hands: result.landmarks.map((points) => ({ landmarks: points.map(({ x, y, z }) => ({ x, y, z })) })),
      };
      options.onFrame?.(frame);
      for (const event of recognizer.push(frame)) options.onEvent(event);
    }
    handle = video.requestVideoFrameCallback(tick);
  };
  handle = video.requestVideoFrameCallback(tick);

  return {
    setArmed(armed) {
      recognizer.setArmed(armed);
    },
    stop() {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
      landmarker.close();
    },
  };
}
```

Rimuovi `@mediapipe/tasks-vision` dalle `dependencies` di `apps/web/package.json` solo se
nessun file di `apps/web` lo importa più direttamente: lo spike CPU lo usa ancora, quindi
per ora resta (debito già nel BACKLOG).

- [ ] **Step 4: verifica e commit**

Run: `npm install && npm run typecheck && npm run lint && npm run test:unit`
Expected: verde.

```bash
git add packages/gesture tests/unit/gesture-adaptive.test.ts package-lock.json
git commit -m "feat(gesture): adaptive frequency controller and mediapipe runner"
```

---

### Task 5.4: Dalle gesture al palco

**Files:**
- Create: `apps/web/src/lib/stage/drop.ts`, `apps/web/src/lib/stage/gesture-actions.ts`, `apps/web/src/lib/stage/use-gestures.ts`, `apps/web/src/app/room/[code]/gesture-control.tsx`
- Modify: `apps/web/src/app/room/[code]/stage-board.tsx`, `window-view.tsx`, `tray.tsx`, `stage-area.tsx`, `agent-panel.tsx`, `apps/web/package.json`, `apps/web/next.config.ts`
- Test: `tests/unit/stage-drop.test.ts`, `tests/unit/gesture-actions.test.ts`

**Interfaces:**
- Consumes: `nearestSlot`, `Stage`, `StageCommand`, `MAX_WINDOWS` (canvas); `GestureEvent`, `DiscreteGestureEvent` (gesture); `startGestures` (runner); `RealtimeSession.attachVideo`.
- Produces:
  - `type DragItem = { type: 'content' | 'window'; id: string }`, `resolveDrop(stage, item, slot): StageCommand | null`, `slotRectsFromDom(root?: ParentNode): Partial<Record<Slot, Rect>>`, `dragItemAt(x: number, y: number): DragItem | null`
  - `gestureAction(event: DiscreteGestureEvent, stage: Stage, newId: () => string): { kind: 'command'; command: StageCommand } | { kind: 'agent' } | { kind: 'none' }`
  - `type GestureStatus = 'off' | 'loading' | 'on' | 'no_camera' | 'unavailable'`, `gestureStatusMessage(status: GestureStatus, armed: boolean): string | null`
  - `useGestures({ session, cameraOn, stage, dispatch, onAgent, areaRef })` → `{ status, armed, cursor, videoRef, toggle }`
  - attributi DOM: `data-slot` sugli slot, `data-drag-type` e `data-drag-id` sugli elementi trascinabili
  - `AgentPanel` controllato: props `open: boolean`, `onOpenChange(open: boolean): void`

- [ ] **Step 1: test che falliscono**

`tests/unit/stage-drop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import { resolveDrop } from '@/lib/stage/drop';

const stage = [
  { type: 'WINDOW_CREATE', windowId: 'A', title: 'A' } as const,
  { type: 'WINDOW_CREATE', windowId: 'B', title: 'B' } as const,
].reduce(applyCommand, emptyStage());

describe('resolveDrop', () => {
  it('moves a window to the slot it was dropped on', () => {
    expect(resolveDrop(stage, { type: 'window', id: 'B' }, 'main')).toEqual({ type: 'WINDOW_MOVE', windowId: 'B', slot: 'main' });
  });

  it('places content into the window that sits in the slot', () => {
    expect(resolveDrop(stage, { type: 'content', id: 'c1' }, 'side-1')).toEqual({
      type: 'CONTENT_PLACE',
      contentId: 'c1',
      windowId: 'B',
    });
  });

  it('does nothing when content is dropped on an empty slot', () => {
    expect(resolveDrop(stage, { type: 'content', id: 'c1' }, 'side-3')).toBeNull();
  });
});
```

`tests/unit/gesture-actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_WINDOWS, applyCommand, emptyStage } from '@omnicanvas/canvas';
import { gestureAction, gestureStatusMessage } from '@/lib/stage/gesture-actions';

const newId = () => 'new-id';
const one = applyCommand(emptyStage(), { type: 'WINDOW_CREATE', windowId: 'A', title: 'Finestra 1' });

describe('gestureAction', () => {
  it('turns focus gestures into stage commands', () => {
    expect(gestureAction({ type: 'FOCUS_NEXT' }, one, newId)).toEqual({ kind: 'command', command: { type: 'FOCUS_NEXT' } });
    expect(gestureAction({ type: 'FOCUS_PREV' }, one, newId)).toEqual({ kind: 'command', command: { type: 'FOCUS_PREV' } });
  });

  it('creates a numbered window while there is room', () => {
    expect(gestureAction({ type: 'WINDOW_CREATE' }, one, newId)).toEqual({
      kind: 'command',
      command: { type: 'WINDOW_CREATE', windowId: 'new-id', title: 'Finestra 2' },
    });
    let full = emptyStage();
    for (let i = 0; i < MAX_WINDOWS; i += 1) full = applyCommand(full, { type: 'WINDOW_CREATE', windowId: `w${i}`, title: `w${i}` });
    expect(gestureAction({ type: 'WINDOW_CREATE' }, full, newId)).toEqual({ kind: 'none' });
  });

  it('archives the focused window, if any', () => {
    expect(gestureAction({ type: 'WINDOW_ARCHIVE' }, one, newId)).toEqual({
      kind: 'command',
      command: { type: 'WINDOW_ARCHIVE', windowId: 'A' },
    });
    expect(gestureAction({ type: 'WINDOW_ARCHIVE' }, emptyStage(), newId)).toEqual({ kind: 'none' });
  });

  it('opens the agent on index up and ignores confirmations for now', () => {
    expect(gestureAction({ type: 'AGENT_ACTIVATE' }, one, newId)).toEqual({ kind: 'agent' });
    expect(gestureAction({ type: 'CONFIRM' }, one, newId)).toEqual({ kind: 'none' });
    expect(gestureAction({ type: 'REJECT' }, one, newId)).toEqual({ kind: 'none' });
  });
});

describe('gestureStatusMessage', () => {
  it('always says that the mouse keeps working when gestures cannot run', () => {
    expect(gestureStatusMessage('no_camera', false)).toMatch(/Accendi la camera.*mouse/);
    expect(gestureStatusMessage('unavailable', false)).toMatch(/non disponibili.*mouse/);
  });

  it('explains how to switch on and off with the palm', () => {
    expect(gestureStatusMessage('on', true)).toBe('Gesture attive: palmo aperto per un secondo per metterle in pausa.');
    expect(gestureStatusMessage('on', false)).toBe('Gesture in pausa: palmo aperto per un secondo per riattivarle.');
    expect(gestureStatusMessage('loading', false)).toBe('Avvio del riconoscimento delle mani…');
    expect(gestureStatusMessage('off', false)).toBeNull();
  });
});
```

Run: `npx vitest run tests/unit/stage-drop.test.ts tests/unit/gesture-actions.test.ts`
Expected: FAIL.

- [ ] **Step 2: funzioni pure**

`apps/web/src/lib/stage/drop.ts`:

```ts
import { SLOTS, type Rect, type Slot, type Stage, type StageCommand } from '@omnicanvas/canvas';

export type DragItem = { type: 'content' | 'window'; id: string };

// Mouse e mano finiscono qui: il palco non sa da dove arriva il rilascio.
export function resolveDrop(stage: Stage, item: DragItem, slot: Slot): StageCommand | null {
  if (item.type === 'window') return { type: 'WINDOW_MOVE', windowId: item.id, slot };
  const target = stage.windows.find((w) => w.slot === slot);
  return target ? { type: 'CONTENT_PLACE', contentId: item.id, windowId: target.id } : null;
}

export function slotRectsFromDom(root: ParentNode = document): Partial<Record<Slot, Rect>> {
  const rects: Partial<Record<Slot, Rect>> = {};
  for (const slot of SLOTS) {
    const box = root.querySelector(`[data-slot="${slot}"]`)?.getBoundingClientRect();
    if (box) rects[slot] = { x: box.x, y: box.y, width: box.width, height: box.height };
  }
  return rects;
}

export function dragItemAt(x: number, y: number): DragItem | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drag-id]');
  const type = element?.dataset.dragType;
  const id = element?.dataset.dragId;
  return (type === 'content' || type === 'window') && id ? { type, id } : null;
}
```

`apps/web/src/lib/stage/gesture-actions.ts`:

```ts
import { MAX_WINDOWS, type Stage, type StageCommand } from '@omnicanvas/canvas';
import type { DiscreteGestureEvent } from '@omnicanvas/gesture';

export type GestureAction = { kind: 'command'; command: StageCommand } | { kind: 'agent' } | { kind: 'none' };
export type GestureStatus = 'off' | 'loading' | 'on' | 'no_camera' | 'unavailable';

export function gestureAction(event: DiscreteGestureEvent, stage: Stage, newId: () => string): GestureAction {
  switch (event.type) {
    case 'FOCUS_NEXT':
    case 'FOCUS_PREV':
      return { kind: 'command', command: { type: event.type } };
    case 'WINDOW_CREATE':
      return stage.windows.length < MAX_WINDOWS
        ? { kind: 'command', command: { type: 'WINDOW_CREATE', windowId: newId(), title: `Finestra ${stage.windows.length + 1}` } }
        : { kind: 'none' };
    case 'WINDOW_ARCHIVE':
      return stage.focusedId
        ? { kind: 'command', command: { type: 'WINDOW_ARCHIVE', windowId: stage.focusedId } }
        : { kind: 'none' };
    case 'AGENT_ACTIVATE':
      return { kind: 'agent' };
    case 'CONFIRM':
    case 'REJECT':
      // Servono alle immagini con conferma (slice 4B).
      return { kind: 'none' };
  }
}

export function gestureStatusMessage(status: GestureStatus, armed: boolean): string | null {
  switch (status) {
    case 'off':
      return null;
    case 'loading':
      return 'Avvio del riconoscimento delle mani…';
    case 'no_camera':
      return 'Accendi la camera per usare le gesture: ogni comando resta disponibile col mouse.';
    case 'unavailable':
      return 'Gesture non disponibili su questo dispositivo: ogni comando resta disponibile col mouse.';
    case 'on':
      return armed
        ? 'Gesture attive: palmo aperto per un secondo per metterle in pausa.'
        : 'Gesture in pausa: palmo aperto per un secondo per riattivarle.';
  }
}
```

In `apps/web/package.json` aggiungi `"@omnicanvas/gesture": "^0.0.0"` e in `next.config.ts`
`"@omnicanvas/gesture"` a `transpilePackages`. Poi `npm install`.

Run: `npx vitest run tests/unit/stage-drop.test.ts tests/unit/gesture-actions.test.ts`
Expected: PASS (9 test).

- [ ] **Step 3: il mouse usa le stesse funzioni**

In `apps/web/src/app/room/[code]/window-view.tsx` sostituisci la dichiarazione locale di
`DragItem` con `import type { DragItem } from '@/lib/stage/drop';` (e riesportala:
`export type { DragItem };`). Sull'`<header>` aggiungi
`data-drag-type="window" data-drag-id={window.id}`; su ogni `<li>` di contenuto
`data-drag-type="content" data-drag-id={content.id}`.

In `tray.tsx`, su ogni `<li>`: `data-drag-type="content" data-drag-id={content.id}`.

In `stage-board.tsx` usa le funzioni condivise: aggiungi `data-slot={slot}` al `div` con
`role="region"`, togli il ref e la costruzione manuale dei rettangoli, e sostituisci il
corpo di `handleDrop` con:

```tsx
  function handleDrop(event: React.DragEvent) {
    if (!dispatch) return;
    event.preventDefault();
    const item = readDragItem(event);
    if (!item) return;
    const slot = nearestSlot({ x: event.clientX, y: event.clientY }, slotRectsFromDom());
    const command = slot ? resolveDrop(stage, item, slot) : null;
    if (command) dispatch(command);
  }
```

con gli import `import { resolveDrop, slotRectsFromDom } from '@/lib/stage/drop';` e senza
più `useRef`, `SLOTS`, `Rect`.

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: verde (il mouse non cambia comportamento; l'e2e del palco lo conferma nel task 5.6).

- [ ] **Step 4: hook**

`apps/web/src/lib/stage/use-gestures.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nearestSlot, type Stage, type StageCommand } from '@omnicanvas/canvas';
import type { GestureEvent } from '@omnicanvas/gesture';
import type { GestureRunner } from '@omnicanvas/gesture/runner';
import type { RealtimeSession } from '@omnicanvas/realtime';
import { dragItemAt, resolveDrop, slotRectsFromDom, type DragItem } from './drop';
import { gestureAction, type GestureStatus } from './gesture-actions';

type Cursor = { x: number; y: number; grabbing: boolean };

type Options = {
  session: RealtimeSession | null;
  cameraOn: boolean;
  stage: Stage;
  dispatch: (command: StageCommand) => void;
  onAgent: () => void;
  areaRef: React.RefObject<HTMLElement | null>;
};

export function useGestures({ session, cameraOn, stage, dispatch, onAgent, areaRef }: Options) {
  const [status, setStatus] = useState<GestureStatus>('off');
  const [armed, setArmed] = useState(false);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const runnerRef = useRef<GestureRunner | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const stageRef = useRef(stage);
  const handlersRef = useRef({ dispatch, onAgent });
  const draggingRef = useRef<DragItem | null>(null);

  useEffect(() => {
    stageRef.current = stage;
    handlersRef.current = { dispatch, onAgent };
  }, [stage, dispatch, onAgent]);

  // Punto normalizzato (vista specchio) → coordinate dello schermo sull'area del palco.
  const toScreen = useCallback(
    (x: number, y: number) => {
      const box = areaRef.current?.getBoundingClientRect();
      return box ? { x: box.left + x * box.width, y: box.top + y * box.height } : null;
    },
    [areaRef],
  );

  const onEvent = useCallback(
    (event: GestureEvent) => {
      const { dispatch: send, onAgent: agent } = handlersRef.current;
      if (event.type === 'GESTURES_TOGGLE') {
        setArmed(event.armed);
        return;
      }
      if (event.type === 'GRAB' || event.type === 'MOVE' || event.type === 'DROP') {
        const point = toScreen(event.x, event.y);
        if (!point) return;
        if (event.type === 'GRAB') draggingRef.current = dragItemAt(point.x, point.y);
        if (event.type === 'DROP') {
          const item = draggingRef.current;
          draggingRef.current = null;
          setCursor(null);
          const slot = nearestSlot(point, slotRectsFromDom());
          const command = item && slot ? resolveDrop(stageRef.current, item, slot) : null;
          if (command) send(command);
          return;
        }
        setCursor({ ...point, grabbing: draggingRef.current !== null });
        return;
      }
      const action = gestureAction(event, stageRef.current, () => crypto.randomUUID());
      if (action.kind === 'command') send(action.command);
      if (action.kind === 'agent') agent();
    },
    [toScreen],
  );

  const toggle = useCallback(async () => {
    if (runnerRef.current) {
      const next = !armed;
      runnerRef.current.setArmed(next);
      setArmed(next);
      return;
    }
    const video = videoRef.current;
    if (!session || !cameraOn || !video) {
      setStatus('no_camera');
      return;
    }
    setStatus('loading');
    try {
      detachRef.current = session.attachVideo(session.localIdentity, video);
      const { startGestures } = await import('@omnicanvas/gesture/runner');
      runnerRef.current = await startGestures(video, { onEvent, armed: true });
      setArmed(true);
      setStatus('on');
    } catch {
      detachRef.current?.();
      detachRef.current = null;
      setStatus('unavailable');
    }
  }, [armed, cameraOn, onEvent, session]);

  // Camera spenta o sessione finita: il riconoscimento si ferma, il mouse resta.
  useEffect(() => {
    if (cameraOn && session) return;
    runnerRef.current?.stop();
    runnerRef.current = null;
    detachRef.current?.();
    detachRef.current = null;
  }, [cameraOn, session]);

  useEffect(
    () => () => {
      runnerRef.current?.stop();
      detachRef.current?.();
    },
    [],
  );

  const effectiveStatus: GestureStatus = status === 'on' && (!cameraOn || !session) ? 'no_camera' : status;
  return { status: effectiveStatus, armed: effectiveStatus === 'on' && armed, cursor, videoRef, toggle };
}
```

Se `react-hooks/set-state-in-effect` segnala qualcosa, sposta il cambio di stato nel
gestore che lo provoca: lo stato derivato `effectiveStatus` evita già il `setState` negli
effetti.

- [ ] **Step 5: controllo nell'interfaccia**

`apps/web/src/app/room/[code]/gesture-control.tsx`:

```tsx
'use client';

import { gestureStatusMessage, type GestureStatus } from '@/lib/stage/gesture-actions';

type Props = {
  status: GestureStatus;
  armed: boolean;
  cursor: { x: number; y: number; grabbing: boolean } | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggle: () => void;
};

// ✋ è il click equivalente del palmo aperto (ADR-0010). Il video resta invisibile:
// serve solo a MediaPipe, nel browser.
export function GestureControl({ status, armed, cursor, videoRef, onToggle }: Props) {
  const message = gestureStatusMessage(status, armed);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button onClick={onToggle} aria-pressed={armed} className="rounded bg-neutral-800 px-2 py-1">
        {armed ? '✋ Metti in pausa le gesture' : '✋ Attiva le gesture'}
      </button>
      {message && <span className="text-neutral-400">{message}</span>}
      <video ref={videoRef} muted playsInline aria-hidden className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0" />
      {cursor && (
        <div
          aria-hidden
          style={{ left: cursor.x, top: cursor.y }}
          className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
            cursor.grabbing ? 'h-8 w-8 border-emerald-400 bg-emerald-400/30' : 'h-5 w-5 border-neutral-100'
          }`}
        />
      )}
    </div>
  );
}
```

In `agent-panel.tsx` rendi `open` controllato: props `open: boolean` e
`onOpenChange(open: boolean): void` al posto dello `useState` locale; il bottone ✨ chiama
`onOpenChange(!open)`; l'`<input>` riceve `autoFocus`.

In `stage-area.tsx`, ramo host: aggiungi le props `session: RealtimeSession | null` e
`cameraOn: boolean`; crea `const areaRef = useRef<HTMLDivElement>(null)` e
`const [agentOpen, setAgentOpen] = useState(false)`; chiama

```tsx
  const gestures = useGestures({
    session,
    cameraOn,
    stage,
    dispatch,
    onAgent: () => setAgentOpen(true),
    areaRef,
  });
```

(gli hook vanno prima dei `return` anticipati del componente: sposta il controllo
`if (!ready)` dopo le chiamate agli hook), metti `ref={areaRef}` sul `div` radice del ramo
host, passa `open={agentOpen} onOpenChange={setAgentOpen}` ad `AgentPanel` e inserisci
`<GestureControl status={gestures.status} armed={gestures.armed} cursor={gestures.cursor} videoRef={gestures.videoRef} onToggle={() => void gestures.toggle()} />`
subito dopo il pannello dell'agente. In `room-call.tsx` passa `session={session}` e
`cameraOn={local?.camOn ?? false}` a `StageArea`.

- [ ] **Step 6: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit` e build con le variabili di CI.
Expected: verde. Il chunk di MediaPipe deve essere separato (import dinamico): nella build,
`@mediapipe/tasks-vision` non compare nel chunk della pagina della stanza ma in un chunk a
parte.

```bash
git add apps/web packages/gesture package-lock.json tests/unit/stage-drop.test.ts tests/unit/gesture-actions.test.ts
git commit -m "feat(web): gestures drive the stage through the same drop and command paths as the mouse"
```

---

### Task 5.5: Registratore di landmark per i test

**Files:**
- Create: `apps/web/src/app/dev/gesture-recorder/page.tsx`, `apps/web/src/app/dev/gesture-recorder/recorder.tsx`, `tests/fixtures/gestures/README.md`
- Test: `tests/unit/gesture-fixtures.test.ts`

**Interfaces:**
- Consumes: `startGestures({ onFrame })`, `createRecognizer`.
- Produces: file `tests/fixtures/gestures/<nome>.json` con `{ "expect": GestureEvent['type'], "armed": boolean, "frames": Frame[] }`.

I test del classificatore girano su mani sintetiche. Le registrazioni vere le produce
Sean con questa pagina, con la sua webcam: ogni file aggiunto diventa un test.

- [ ] **Step 1: test sulle registrazioni**

`tests/unit/gesture-fixtures.test.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRecognizer, type Frame, type GestureEvent } from '@omnicanvas/gesture';

const dir = new URL('../fixtures/gestures/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

type Recording = { expect: GestureEvent['type']; armed: boolean; frames: Frame[] };

describe.skipIf(files.length === 0)('recorded gestures', () => {
  for (const file of files) {
    it(`${file} produces ${file.split('.')[0]}`, () => {
      const recording = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Recording;
      const recognizer = createRecognizer({ armed: recording.armed });
      const events = recording.frames.flatMap((frame) => recognizer.push(frame)).map((e) => e.type);
      expect(events).toContain(recording.expect);
    });
  }
});

it('keeps the recordings folder in the repository', () => {
  expect(readdirSync(dir)).toContain('README.md');
});
```

`tests/fixtures/gestures/README.md`:

```markdown
# Registrazioni di gesture

Ogni file JSON qui dentro è un test: il riconoscitore deve produrre l'evento `expect`.
Si registrano da `/dev/gesture-recorder` (solo `npm run dev`), con la propria webcam.
Nome del file: `<evento>-<descrizione>.json`, es. `FOCUS_NEXT-swipe-veloce.json`.
Contengono solo landmark (numeri), mai immagini.
```

Run: `npx vitest run tests/unit/gesture-fixtures.test.ts`
Expected: PASS (il blocco delle registrazioni è saltato finché la cartella non ha JSON).

- [ ] **Step 2: pagina**

`apps/web/src/app/dev/gesture-recorder/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { Recorder } from './recorder';

// Strumento di sviluppo: mai in produzione.
export default function GestureRecorderPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Recorder />;
}
```

`apps/web/src/app/dev/gesture-recorder/recorder.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import type { Frame, GestureEvent } from '@omnicanvas/gesture';

const EVENTS: GestureEvent['type'][] = [
  'GESTURES_TOGGLE',
  'AGENT_ACTIVATE',
  'CONFIRM',
  'REJECT',
  'GRAB',
  'FOCUS_NEXT',
  'FOCUS_PREV',
  'WINDOW_ARCHIVE',
  'WINDOW_CREATE',
];

export function Recorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [expected, setExpected] = useState<GestureEvent['type']>('FOCUS_NEXT');
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seen, setSeen] = useState<string[]>([]);
  const [download, setDownload] = useState<string | null>(null);

  async function record() {
    setState('recording');
    setSeen([]);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();
    const frames: Frame[] = [];
    const armed = expected !== 'GESTURES_TOGGLE';
    const { startGestures } = await import('@omnicanvas/gesture/runner');
    const runner = await startGestures(video, {
      armed,
      onFrame: (frame) => frames.push(frame),
      onEvent: (event) => setSeen((current) => [...current, event.type]),
    });
    setTimeout(() => {
      runner.stop();
      stream.getTracks().forEach((track) => track.stop());
      const t0 = frames[0]?.t ?? 0;
      const json = JSON.stringify({ expect: expected, armed, frames: frames.map((f) => ({ ...f, t: f.t - t0 })) });
      setDownload(URL.createObjectURL(new Blob([json], { type: 'application/json' })));
      setState('done');
    }, 4_000);
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-xl font-semibold">Registratore di gesture</h1>
      <p className="text-sm text-neutral-400">4 secondi di landmark, niente immagini. Il file va in tests/fixtures/gestures/.</p>
      <label className="flex w-fit flex-col gap-1 text-sm">
        Evento atteso
        <select value={expected} onChange={(e) => setExpected(e.target.value as GestureEvent['type'])} className="rounded bg-neutral-900 px-2 py-1">
          {EVENTS.map((event) => (
            <option key={event}>{event}</option>
          ))}
        </select>
      </label>
      <button onClick={() => void record()} disabled={state === 'recording'} className="w-fit rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-40">
        {state === 'recording' ? 'Registro…' : 'Registra 4 secondi'}
      </button>
      <video ref={videoRef} muted playsInline className="w-80 -scale-x-100 rounded" />
      {seen.length > 0 && <p className="text-sm">Eventi riconosciuti: {seen.join(', ')}</p>}
      {download && (
        <a href={download} download={`${expected}-registrazione.json`} className="w-fit underline">
          Scarica la registrazione
        </a>
      )}
    </main>
  );
}
```

- [ ] **Step 3: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit` e build di produzione con
`npm run start`: `curl -s -o /dev/null -w "%{http_code}" localhost:3000/dev/gesture-recorder` → `404`.

```bash
git add apps/web/src/app/dev/gesture-recorder tests/fixtures/gestures tests/unit/gesture-fixtures.test.ts
git commit -m "feat(web): dev-only landmark recorder, recorded gestures become tests"
```

---

### Task 5.6: E2E delle gesture

**Files:**
- Create: `e2e/gestures.spec.ts`

- [ ] **Step 1: test**

`e2e/gestures.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { closeParticipants, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

test('the palm button arms and pauses hand tracking', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser);
  await expect(host.getByRole('button', { name: 'Disattiva camera' })).toBeVisible({ timeout: 20_000 });

  await host.getByRole('button', { name: '✋ Attiva le gesture' }).click();
  // MediaPipe si scarica e si avvia: sulla CPU della CI servono alcuni secondi.
  await expect(host.getByText('Gesture attive: palmo aperto per un secondo per metterle in pausa.')).toBeVisible({
    timeout: 60_000,
  });

  await host.getByRole('button', { name: '✋ Metti in pausa le gesture' }).click();
  await expect(host.getByText('Gesture in pausa: palmo aperto per un secondo per riattivarle.')).toBeVisible();
});

test('without a camera the gestures explain themselves and the mouse keeps working', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser);
  await host.getByRole('button', { name: 'Disattiva camera' }).click({ timeout: 20_000 });
  await host.getByRole('button', { name: '✋ Attiva le gesture' }).click();
  await expect(host.getByText(/Accendi la camera per usare le gesture: ogni comando resta disponibile col mouse/)).toBeVisible();

  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await expect(host.getByRole('region', { name: 'Finestra in primo piano' }).getByRole('article', { name: 'Finestra 1' })).toBeVisible();
});
```

- [ ] **Step 2: verifica (Codespace) e CI**

Run: `CI=1 npm run test:e2e -- --reporter=line`, due volte.
Expected: 30 test passati entrambe le volte (gli e2e del palco confermano che il drag col
mouse, ora su `resolveDrop`, non è cambiato).

Se il primo test fallisce con «Gesture non disponibili», leggi la console della pagina:
MediaPipe senza GPU deve ripiegare sul delegate CPU (`createLandmarker`). Non allungare il
timeout oltre 60 secondi senza capire perché.

```bash
git add e2e/gestures.spec.ts
git commit -m "test(web): palm button arms and pauses tracking, camera-off fallback"
git push -u origin slice/5-gesture
gh pr create --base slice/4a-agente --head slice/5-gesture --title "Slice 5: gesture" --body "$(cat <<'EOF'
packages/gesture: classificatore e riconoscitore puri (palmo per armare, hold, pinch
trascina e rilascia, swipe, flick, due mani, dizionario configurabile), controller di
frequenza adattiva, runner MediaPipe nel browser. Le gesture passano dalle stesse
funzioni del mouse. Registratore di landmark per i test reali.

Impilata su #5 (slice 4A). Piano: docs/plans/2026-09-26-slice-5-gesture.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: CI verde.

---

### Task 5.7: Chiusura della slice 5 e protocollo del test con i consulenti

**Files:**
- Create: `docs/spikes/2026-09-26-test-demo-consulenti.md`
- Modify: `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, `CLAUDE.md`

- [ ] **Step 1: protocollo del gate di prodotto**

`docs/spikes/2026-09-26-test-demo-consulenti.md`:

```markdown
# Test della prima demo con 5 consulenti

Spec §11, rischio 1: la demo convince? Le gesture sono comode o solo scenografiche?
**Lo conduce Sean.** Serve la preview con Supabase Cloud, LiveKit Cloud, Upstash e
`AI_PROVIDER=anthropic` (task 0.5), e crediti caricati con `npm run credits:grant`.

## Chi

Cinque persone che fanno call con clienti per lavoro (consulenti, agenzie, studi). Non
colleghi del progetto.

## Come (40 minuti a persona)

1. 5 min — contesto in una frase: «una call dove un agente prepara materiale e tu lo
   disponi con le mani». Niente demo guidata prima.
2. 20 min — compiti, la persona è host, Sean fa il cliente da telefono:
   1. Crea una stanza e invita il cliente.
   2. Chiedi all'agente un grafico delle vendite per trimestre.
   3. Portalo sul palco col mouse, poi prova con le mani (palmo per attivare, pinch).
   4. Crea una seconda finestra e passa dall'una all'altra con uno swipe.
   5. Archivia una finestra.
   6. Chiudi la riunione.
3. 10 min — domande:
   - Quale parte useresti davvero con un tuo cliente la settimana prossima?
   - Le mani: più veloci del mouse, uguali o più lente? In quali momenti?
   - Che cosa ti ha fatto sentire a disagio davanti al cliente?
   - Pagheresti per questo? Quanto, al mese, rispetto a quello che usi oggi?
4. 5 min — Sean annota tempi e errori.

## Cosa si misura

| persona | ruolo | compiti riusciti (6) | tempo compito 3 mouse / mani | gesture fallite | «la userei» (1-5) | citazione |
|---|---|---|---|---|---|---|

## Soglie

- Passa se almeno 3 persone su 5 danno «la userei» ≥ 4 e almeno 3 completano i compiti
  2-5 senza aiuto.
- Le gesture restano nell'esperienza principale se almeno 3 le giudicano più veloci o
  uguali al mouse per il compito 3 o 4; altrimenti ADR che le rende opzionali.
```

- [ ] **Step 2: documenti**

`docs/ARCHITECTURE.md` §8: aggiungi sotto l'elenco «Implementazione: `packages/gesture`
(nucleo puro: `classifyPose`, `createRecognizer`, `createAdaptiveController`; runner
MediaPipe in `@omnicanvas/gesture/runner`, caricato solo quando l'host preme ✋). Le
gesture arrivano al palco da `resolveDrop` e `gestureAction`, le stesse funzioni del mouse.
I test girano su mani sintetiche e sulle registrazioni in `tests/fixtures/gestures/`.»

`docs/BACKLOG.md`, slice 5: spunta le voci fatte; il gate resta aperto con «(protocollo in
`docs/spikes/2026-09-26-test-demo-consulenti.md`, lo conduce Sean)». Aggiungi ai debiti:

```markdown
- [ ] Registrare gesture reali con `/dev/gesture-recorder` e aggiungerle ai test
- [ ] CONFIRM/REJECT a gesto non fanno ancora nulla: servono le immagini con conferma (4B)
- [ ] MediaPipe si scarica da jsdelivr e googleapis: valutare l'hosting dei file
```

`CLAUDE.md`: slice 5 su `slice/5-gesture` (PR #6). Prima demo = slice 0-5: completa lato
codice salvo la slice 4B (voce), in attesa del test con i consulenti.

- [ ] **Step 3: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit`; nel Codespace `npm run test:db && CI=1 npm run test:e2e`.
Expected: verde.

```bash
git add docs CLAUDE.md
git commit -m "docs: close slice 5, consultant demo test protocol"
git push
```
