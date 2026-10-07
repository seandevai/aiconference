# Laboratorio gesture semplice e da telefono — piano di implementazione

> **Per gli agenti:** SOTTO-SKILL OBBLIGATORIA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, task per task. I passi usano le caselle
> (`- [ ]`) per tenere traccia.

**Obiettivo:** `/dev/gesture-lab` diventa una pagina iniziale con tre scelte (Prova, Registra,
Rigioca) che apre una schermata alla volta, usabile da telefono, con il tecnico chiuso in
«Avanzate».

**Architettura:** una sola pagina client (`lab.tsx`) tiene `useGestureLab`, legge la
schermata da `?vista=` (`lib/gesture-lab/lab-view.ts`) e mostra una schermata alla volta.
Mano e palco sono un unico nodo `scene` costruito da `Lab` e passato alle schermate, che lo
mettono sempre nello stesso punto e lo nascondono con `hidden` (così `<video>` non si smonta).
Due funzioni pure nuove, `gesture-catalog.ts` (nomi italiani ↔ eventi) ed `evaluate.ts`
(esito immediato di una registrazione), servono a Registra e Rigioca. Le server action restano
quelle di oggi; le chiamano le schermate tramite `useLabAction`.

**Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Vitest + Testing Library
(happy-dom), `@omnicanvas/gesture`, `@omnicanvas/ui`.

**Spec:** `docs/specs/2026-10-06-gesture-lab-redesign-design.md`. Il piano parte dalla spec:
leggere entrambi. Mockup approvati in `.superpowers/brainstorm/41057-1791309277/content/`
(fuori da git).

**Branch:** `slice/gesture-lab-staging` (PR #22), si continua lì.

## Vincoli globali

- La call non cambia: niente modifiche a `apps/web/src/app/room/`, `packages/gesture`,
  `packages/canvas`, `stage-gesture-handler.ts`.
- Server, tabelle, migrazioni e `actions.ts` non cambiano.
- Regola 1: le registrazioni restano solo landmark; nessun video, nessuna immagine.
- Regola 5: test prima del codice, visti rossi e poi verdi.
- Regola 6: ogni gesto e ogni trascinamento ha il suo click (la maniglia di Avanzate si tocca).
- Bottoni alti almeno 44 px (`Button` `size="md"`, oppure `min-h-11`), niente scroll
  orizzontale, `h-dvh`/`dvh` per le barre del browser mobile.
- Testi dell'interfaccia e commenti in italiano; codice, commit ed errori tecnici in inglese.
- Prima di ogni commit: `npx prettier --write` sui file toccati.
- Le impostazioni restano in `localStorage` (`gesture-lab:v1`), come oggi.
- Comandi dei test: `npx vitest run <file>` per un file; alla fine `npm run typecheck`,
  `npm run lint`, `npm test`, `npm run build`.

## Attenzione in revisione

Casi che la spec implica e che nessun passo «felice» esercita. Ognuno ha il suo test nel task
indicato.

1. **«Annulla» durante i 4 secondi e subito «Inizia»**: la cattura precedente è ancora in
   corso nel hook e la nuova tornerebbe vuota. «Inizia» resta disabilitato finché la cattura
   annullata non finisce (Task 7).
2. **Un link vecchio `?vista=rigioca&id=<registrazione eliminata>`**: messaggio «Non più
   disponibile», la voce sparisce, si torna all'elenco (Task 8).
3. **Tasto indietro del browser durante il conto alla rovescia**: la schermata si smonta,
   il timer si ferma e non parte nessuna cattura (Task 7).
4. **Riconoscimento non disponibile sul dispositivo**: scegliere un gesto non riprova a
   oltranza ad accendere la fotocamera (Task 7).
5. **Taratura cambiata in Avanzate mentre si guarda un rigioco**: l'esito si ricalcola con
   le impostazioni nuove (Task 8).

## Mappa dei file

`apps/web/src/lib/gesture-lab/`:

| File                 | Stato      | Responsabilità                                                    |
| -------------------- | ---------- | ----------------------------------------------------------------- |
| `gesture-catalog.ts` | nuovo      | i nove gesti: icona, nome italiano, «Come si fa», evento, effetto |
| `evaluate.ts`        | nuovo      | `evaluateRecording`, `recordingOutcome`                           |
| `lab-view.ts`        | nuovo      | `resolveView`, `viewSearch`, `useLabView`                         |
| `lab-stage.ts`       | modificato | palco di prova con due finestre                                   |
| `use-gesture-lab.ts` | modificato | `progress` del rigioco, `fired` tipizzato                         |

`apps/web/src/app/dev/gesture-lab/`:

| File                                                                                                               | Stato                | Responsabilità                                                |
| ------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------- |
| `lab.tsx`                                                                                                          | riscritto            | schermata dall'URL, fotocamera per schermata, scena, Avanzate |
| `home-screen.tsx`                                                                                                  | nuovo                | pagina iniziale con le tre scelte                             |
| `try-screen.tsx`                                                                                                   | nuovo                | Prova                                                         |
| `record-wizard.tsx`                                                                                                | nuovo                | Registra in quattro passi                                     |
| `replay-screen.tsx`                                                                                                | nuovo                | elenco e rigioco                                              |
| `lab-scene.tsx`                                                                                                    | nuovo                | disposizione di mano e palco secondo lo schermo               |
| `hand-view.tsx`                                                                                                    | nuovo                | video, scheletro e nome del gesto                             |
| `diagnostics.tsx`                                                                                                  | nuovo                | posa, numeri delle dita, eventi                               |
| `advanced-panel.tsx`                                                                                               | nuovo                | pannello che sale dal basso o entra da destra                 |
| `screen-header.tsx`                                                                                                | nuovo                | «‹ Indietro», titolo, ⚙                                       |
| `outcome-view.tsx`                                                                                                 | nuovo                | «✓ Riconosciuto» / «✗ Non riconosciuto» / «Registrato»        |
| `use-lab-action.ts`                                                                                                | nuovo                | un'azione server alla volta, messaggio d'errore               |
| `lab-controls.tsx`                                                                                                 | modificato           | diviso in Correzioni, Taratura, Dizionario                    |
| `preset-panel.tsx`                                                                                                 | modificato           | più `PresetSection` che chiama le action                      |
| `lab-messages.ts`                                                                                                  | modificato           | più `LIVE_MESSAGES`                                           |
| `lab-tabs.tsx`, `server-panels.tsx`, `record-panel.tsx`, `archive-panel.tsx`, `replay-panel.tsx`, `hand-panel.tsx` | eliminati nel Task 9 |                                                               |

I vecchi componenti restano fino al Task 9: ogni task prima del 9 lascia `typecheck` e test
verdi.

---

### Task 1: Catalogo dei gesti

**Files:**

- Create: `apps/web/src/lib/gesture-lab/gesture-catalog.ts`
- Test: `tests/unit/gesture-lab-catalog.test.ts`

**Interfaces:**

- Produces:
  - `type GestureInfo = { name: GestureName; icon: string; label: string; howTo: string; event: GestureEvent['type']; effect: string; holdPose?: Pose }`
  - `GESTURE_CATALOG: readonly GestureInfo[]` (nove voci, nell'ordine di `GESTURE_NAMES`)
  - `gestureByName(name: GestureName): GestureInfo`
  - `gestureForEvent(type: GestureEvent['type'] | null): GestureInfo | null`
  - `gestureForHold(pose: Pose): GestureInfo | null`
  - `eventLabel(type: GestureEvent['type']): string`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_DICTIONARY, GESTURE_NAMES } from '@omnicanvas/gesture';
import {
  GESTURE_CATALOG,
  eventLabel,
  gestureByName,
  gestureForEvent,
  gestureForHold,
} from '@/lib/gesture-lab/gesture-catalog';
import { isGestureEventType } from '@/lib/gesture-lab/recording';

describe('gesture catalog', () => {
  it('describes the nine gestures, in Italian, once each', () => {
    expect(GESTURE_CATALOG.map((g) => g.name)).toEqual([...GESTURE_NAMES]);
    for (const g of GESTURE_CATALOG) {
      expect(g.label).not.toMatch(/_/);
      expect(g.howTo.length).toBeGreaterThan(10);
      expect(g.effect.length).toBeGreaterThan(3);
    }
  });

  it('expects the event of the default dictionary, with drag opening on GRAB', () => {
    for (const g of GESTURE_CATALOG) {
      const command = DEFAULT_DICTIONARY[g.name];
      expect(g.event).toBe(command === 'DRAG' ? 'GRAB' : command);
      expect(isGestureEventType(g.event)).toBe(true);
    }
  });

  it('goes from event to gesture and back', () => {
    for (const g of GESTURE_CATALOG) {
      expect(gestureForEvent(g.event)).toBe(g);
      expect(gestureByName(g.name)).toBe(g);
    }
    expect(gestureForEvent(null)).toBeNull();
    expect(gestureForEvent('MOVE')).toBeNull();
  });

  it('names the hold gesture of a pose, and nothing for the others', () => {
    expect(gestureForHold('thumb_up')?.name).toBe('thumb_up_hold');
    expect(gestureForHold('open_palm')?.name).toBe('open_palm_hold');
    expect(gestureForHold('fist')).toBeNull();
  });

  it('reads an event as the gesture name, or as its code when no gesture makes it', () => {
    expect(eventLabel('CONFIRM')).toBe('Pollice su');
    expect(eventLabel('DROP')).toBe('DROP');
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/gesture-lab-catalog.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/gesture-lab/gesture-catalog"`.

- [ ] **Step 3: Implementare**

Le direzioni degli swipe seguono `recognizer.ts:194`: `swipe_left` scatta quando il palmo va
verso x crescenti dell'immagine, cioè verso la sinistra di chi sta davanti alla camera.

```ts
import type { GestureEvent, GestureName, Pose } from '@omnicanvas/gesture';

// I nove gesti come li vede chi usa il laboratorio: nome italiano, come si fanno, cosa fanno
// sul palco. L'evento è quello del dizionario predefinito (il trascinamento si apre con GRAB):
// le registrazioni salvano l'evento in `expect`, e il catalogo lo ritraduce in gesto.
export type GestureInfo = {
  name: GestureName;
  icon: string;
  label: string;
  howTo: string;
  event: GestureEvent['type'];
  effect: string;
  // Solo per i gesti «tieni fermo»: la posa che riempie l'anello d'attesa.
  holdPose?: Pose;
};

export const GESTURE_CATALOG: readonly GestureInfo[] = [
  {
    name: 'open_palm_hold',
    icon: '✋',
    label: 'Palmo aperto',
    howTo: 'Mano aperta verso la fotocamera, ferma per un secondo.',
    event: 'GESTURES_TOGGLE',
    effect: 'attiva o mette in pausa le gesture',
    holdPose: 'open_palm',
  },
  {
    name: 'index_up_hold',
    icon: '☝️',
    label: 'Indice alzato',
    howTo: 'Solo l’indice alzato, fermo per un secondo.',
    event: 'AGENT_ACTIVATE',
    effect: 'chiama l’agente',
    holdPose: 'index_up',
  },
  {
    name: 'thumb_up_hold',
    icon: '👍',
    label: 'Pollice su',
    howTo: 'Pugno chiuso col pollice in su, fermo per un secondo.',
    event: 'CONFIRM',
    effect: 'conferma',
    holdPose: 'thumb_up',
  },
  {
    name: 'thumb_down_hold',
    icon: '👎',
    label: 'Pollice giù',
    howTo: 'Pugno chiuso col pollice in giù, fermo per un secondo.',
    event: 'REJECT',
    effect: 'annulla',
    holdPose: 'thumb_down',
  },
  {
    name: 'pinch_drag',
    icon: '🤏',
    label: 'Pinch e trascina',
    howTo: 'Unisci pollice e indice sopra una finestra, spostala, poi apri le dita.',
    event: 'GRAB',
    effect: 'sposta una finestra',
  },
  {
    name: 'swipe_left',
    icon: '👈',
    label: 'Swipe a sinistra',
    howTo: 'Muovi la mano veloce verso la tua sinistra, in orizzontale.',
    event: 'FOCUS_NEXT',
    effect: 'passa alla finestra dopo',
  },
  {
    name: 'swipe_right',
    icon: '👉',
    label: 'Swipe a destra',
    howTo: 'Muovi la mano veloce verso la tua destra, in orizzontale.',
    event: 'FOCUS_PREV',
    effect: 'torna alla finestra prima',
  },
  {
    name: 'flick_up',
    icon: '👆',
    label: 'Flick verso l’alto',
    howTo: 'Mano aperta, muovila veloce verso l’alto.',
    event: 'WINDOW_ARCHIVE',
    effect: 'archivia la finestra',
  },
  {
    name: 'two_hands_spread',
    icon: '🙌',
    label: 'Due mani che si allontanano',
    howTo: 'Due mani aperte vicine davanti alla fotocamera, poi allontanale.',
    event: 'WINDOW_CREATE',
    effect: 'crea una finestra',
  },
];

export function gestureByName(name: GestureName): GestureInfo {
  const info = GESTURE_CATALOG.find((g) => g.name === name);
  if (!info) throw new Error(`unknown gesture: ${name}`);
  return info;
}

export const gestureForEvent = (type: GestureEvent['type'] | null): GestureInfo | null =>
  GESTURE_CATALOG.find((g) => g.event === type) ?? null;

export const gestureForHold = (pose: Pose): GestureInfo | null =>
  GESTURE_CATALOG.find((g) => g.holdPose === pose) ?? null;

// Nome leggibile di un evento: il gesto che lo produce, o il codice se non ce n'è uno.
export const eventLabel = (type: GestureEvent['type']): string =>
  gestureForEvent(type)?.label ?? type;
```

- [ ] **Step 4: Verificare che passi**

Run: `npx vitest run tests/unit/gesture-lab-catalog.test.ts`
Expected: PASS, 5 test.

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/lib/gesture-lab/gesture-catalog.ts tests/unit/gesture-lab-catalog.test.ts
git add apps/web/src/lib/gesture-lab/gesture-catalog.ts tests/unit/gesture-lab-catalog.test.ts
git commit -m "feat(gesture-lab): Italian gesture catalog mapped to recorded events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Esito di una registrazione

**Files:**

- Create: `apps/web/src/lib/gesture-lab/evaluate.ts`
- Test: `tests/unit/gesture-lab-evaluate.test.ts`

**Interfaces:**

- Consumes: `Recording` (`recording.ts`), `LabSettings`, `effectiveTuning` (`settings.ts`)
- Produces:
  - `evaluateRecording(recording: Pick<Recording, 'frames' | 'armed'>, settings: LabSettings): GestureEvent['type'][]`
  - `type Outcome = { kind: 'new' } | { kind: 'recognized' } | { kind: 'missed'; fired: GestureEvent['type'][] }`
  - `recordingOutcome(expect: GestureEvent['type'] | null, fired: GestureEvent['type'][]): Outcome`

- [ ] **Step 1: Scrivere il test che fallisce**

Le mani sintetiche di `tests/fixtures/hands.ts` tenute ferme 1,3 s danno, con i predefiniti
del laboratorio: pollice su armato → `CONFIRM`; pollice su non armato → niente; palmo aperto
non armato → `GESTURES_TOGGLE` (verificato il 07/10).

```ts
import { describe, expect, it } from 'vitest';
import type { Frame } from '@omnicanvas/gesture';
import { evaluateRecording, recordingOutcome } from '@/lib/gesture-lab/evaluate';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { hand } from '../fixtures/hands';

const held = (pose: 'thumb_up' | 'open_palm'): Frame[] =>
  Array.from({ length: 40 }, (_, i) => ({ t: i * 33, hands: [hand(pose)] }));

describe('evaluateRecording', () => {
  it('returns the events a recording fires, all at once', () => {
    expect(
      evaluateRecording({ frames: held('thumb_up'), armed: true }, DEFAULT_LAB_SETTINGS),
    ).toEqual(['CONFIRM']);
  });

  it('starts disarmed when the recording says so', () => {
    expect(
      evaluateRecording({ frames: held('thumb_up'), armed: false }, DEFAULT_LAB_SETTINGS),
    ).toEqual([]);
    expect(
      evaluateRecording({ frames: held('open_palm'), armed: false }, DEFAULT_LAB_SETTINGS),
    ).toEqual(['GESTURES_TOGGLE']);
  });

  it('uses the given settings', () => {
    const off = {
      ...DEFAULT_LAB_SETTINGS,
      dictionary: { ...DEFAULT_LAB_SETTINGS.dictionary, thumb_up_hold: null },
    };
    expect(evaluateRecording({ frames: held('thumb_up'), armed: true }, off)).toEqual([]);
  });

  it('returns nothing for an empty recording', () => {
    expect(evaluateRecording({ frames: [], armed: true }, DEFAULT_LAB_SETTINGS)).toEqual([]);
  });

  it('leaves MOVE and DROP out: they are not gestures', () => {
    const drag: Frame[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        t: i * 33,
        hands: [hand('pinch', { x: 0.3 + i * 0.02, y: 0.5 })],
      })),
      ...Array.from({ length: 5 }, (_, i) => ({ t: 330 + i * 33, hands: [] })),
    ];
    const fired = evaluateRecording({ frames: drag, armed: true }, DEFAULT_LAB_SETTINGS);
    expect(fired).toContain('GRAB');
    expect(fired).not.toContain('MOVE');
    expect(fired).not.toContain('DROP');
  });
});

describe('recordingOutcome', () => {
  it('has no comparison for a new gesture', () => {
    expect(recordingOutcome(null, ['CONFIRM'])).toEqual({ kind: 'new' });
  });

  it('is recognized when the expected event is among the fired ones', () => {
    expect(recordingOutcome('CONFIRM', ['GESTURES_TOGGLE', 'CONFIRM'])).toEqual({
      kind: 'recognized',
    });
  });

  it('is missed otherwise, and says what fired', () => {
    expect(recordingOutcome('CONFIRM', ['REJECT'])).toEqual({ kind: 'missed', fired: ['REJECT'] });
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/gesture-lab-evaluate.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/gesture-lab/evaluate"`.

- [ ] **Step 3: Implementare**

```ts
import { createPipeline, type GestureEvent } from '@omnicanvas/gesture';
import type { Recording } from './recording';
import { effectiveTuning, type LabSettings } from './settings';

// Esito immediato: la registrazione passa tutta, senza attese, nella stessa pipeline del
// rigioco. MOVE e DROP accompagnano un trascinamento e non sono gesti: restano fuori.
export function evaluateRecording(
  recording: Pick<Recording, 'frames' | 'armed'>,
  settings: LabSettings,
): GestureEvent['type'][] {
  const pipeline = createPipeline({
    tuning: effectiveTuning(settings),
    dictionary: settings.dictionary,
    armed: recording.armed,
  });
  return recording.frames
    .flatMap((frame) => pipeline.push(frame).events.map((event) => event.type))
    .filter((type) => type !== 'MOVE' && type !== 'DROP');
}

export type Outcome =
  { kind: 'new' } | { kind: 'recognized' } | { kind: 'missed'; fired: GestureEvent['type'][] };

export function recordingOutcome(
  expect: GestureEvent['type'] | null,
  fired: GestureEvent['type'][],
): Outcome {
  if (expect === null) return { kind: 'new' };
  return fired.includes(expect) ? { kind: 'recognized' } : { kind: 'missed', fired };
}
```

- [ ] **Step 4: Verificare che passi**

Run: `npx vitest run tests/unit/gesture-lab-evaluate.test.ts`
Expected: PASS, 8 test. Se il test del trascinamento non vede `GRAB`, allungare il pinch
(20 fotogrammi) invece di cambiare il codice: la soglia è del riconoscitore, non di qui.

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/lib/gesture-lab/evaluate.ts tests/unit/gesture-lab-evaluate.test.ts
git add apps/web/src/lib/gesture-lab/evaluate.ts tests/unit/gesture-lab-evaluate.test.ts
git commit -m "feat(gesture-lab): evaluate a recording at once and compare with the expected event

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Schermata nell'URL e palco a due finestre

**Files:**

- Create: `apps/web/src/lib/gesture-lab/lab-view.ts`
- Modify: `apps/web/src/lib/gesture-lab/lab-stage.ts:3`
- Test: `tests/unit/gesture-lab-view.test.ts` (nuovo), `tests/unit/gesture-lab-settings.test.ts:126-133`

**Interfaces:**

- Produces:
  - `type LabView = 'home' | 'prova' | 'registra' | 'rigioca'`
  - `resolveView(params: Pick<URLSearchParams, 'get'>, hasArchive: boolean): { view: LabView; id: string | null }`
  - `viewSearch(view: LabView, id?: string | null): string` (`''` oppure `?vista=…[&id=…]`)
  - `useLabView(hasArchive: boolean): { view: LabView; id: string | null; go: (view: LabView, id?: string | null) => void }`
  - `labStage()` con due finestre (`chart`, `text`)

- [ ] **Step 1: Scrivere i test che falliscono**

`tests/unit/gesture-lab-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveView, viewSearch } from '@/lib/gesture-lab/lab-view';

const params = (search: string) => new URLSearchParams(search);

describe('resolveView', () => {
  it('opens the home without a view', () => {
    expect(resolveView(params(''), true)).toEqual({ view: 'home', id: null });
  });

  it('opens a known view', () => {
    expect(resolveView(params('?vista=prova'), false)).toEqual({ view: 'prova', id: null });
    expect(resolveView(params('?vista=registra'), true)).toEqual({ view: 'registra', id: null });
  });

  it('falls back to the home for an unknown view', () => {
    expect(resolveView(params('?vista=taratura'), true)).toEqual({ view: 'home', id: null });
  });

  it('keeps record and replay for those with the archive', () => {
    expect(resolveView(params('?vista=registra'), false).view).toBe('home');
    expect(resolveView(params('?vista=rigioca&id=r1'), false).view).toBe('home');
  });

  it('reads the recording id only in the replay', () => {
    expect(resolveView(params('?vista=rigioca&id=r1'), true)).toEqual({
      view: 'rigioca',
      id: 'r1',
    });
    expect(resolveView(params('?vista=rigioca&id='), true).id).toBeNull();
    expect(resolveView(params('?vista=prova&id=r1'), true).id).toBeNull();
  });
});

describe('viewSearch', () => {
  it('writes the view, and the id only for the replay', () => {
    expect(viewSearch('home')).toBe('');
    expect(viewSearch('prova')).toBe('?vista=prova');
    expect(viewSearch('rigioca', 'r1')).toBe('?vista=rigioca&id=r1');
    expect(viewSearch('registra', 'r1')).toBe('?vista=registra');
  });

  it('goes back and forth with resolveView', () => {
    const search = viewSearch('rigioca', 'a b');
    expect(resolveView(params(search), true)).toEqual({ view: 'rigioca', id: 'a b' });
  });
});
```

In `tests/unit/gesture-lab-settings.test.ts` sostituire il blocco `describe('labStage', …)`:

```ts
describe('labStage', () => {
  it('builds two windows, each with a sample content', () => {
    const stage = labStage();
    expect(stage.windows).toHaveLength(2);
    expect(stage.windows.every((w) => w.contents.length === 1)).toBe(true);
    expect(stage.tray).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/gesture-lab-view.test.ts tests/unit/gesture-lab-settings.test.ts`
Expected: FAIL: import di `lab-view` non risolto; `labStage` ha 3 finestre invece di 2.

- [ ] **Step 3: Implementare**

`apps/web/src/lib/gesture-lab/lab-view.ts`:

```ts
'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// La schermata del laboratorio sta nell'URL (?vista=…): il tasto indietro del telefono e del
// browser torna alla schermata prima. Registra e Rigioca parlano col server: senza archivio
// non esistono.
export type LabView = 'home' | 'prova' | 'registra' | 'rigioca';

const VIEWS: readonly LabView[] = ['prova', 'registra', 'rigioca'];
const ARCHIVE_VIEWS: readonly LabView[] = ['registra', 'rigioca'];

export function resolveView(
  params: Pick<URLSearchParams, 'get'>,
  hasArchive: boolean,
): { view: LabView; id: string | null } {
  const raw = params.get('vista');
  const view = VIEWS.find((v) => v === raw);
  if (!view || (ARCHIVE_VIEWS.includes(view) && !hasArchive)) return { view: 'home', id: null };
  return { view, id: view === 'rigioca' ? params.get('id') || null : null };
}

export function viewSearch(view: LabView, id?: string | null): string {
  if (view === 'home') return '';
  const params = new URLSearchParams({ vista: view });
  if (view === 'rigioca' && id) params.set('id', id);
  return `?${params.toString()}`;
}

export function useLabView(hasArchive: boolean) {
  const params = useSearchParams();
  const current = resolveView(params, hasArchive);
  // pushState aggiorna useSearchParams senza rifare la pagina server: webcam e palco restano.
  const go = useCallback((view: LabView, id?: string | null) => {
    window.history.pushState(null, '', `${window.location.pathname}${viewSearch(view, id)}`);
  }, []);
  return { ...current, go };
}
```

`viewSearch('rigioca', 'a b')` produce `?vista=rigioca&id=a+b`: `URLSearchParams` la rilegge
come `a b`, il test di andata e ritorno lo controlla.

In `apps/web/src/lib/gesture-lab/lab-stage.ts`:

```ts
const KINDS = ['chart', 'text'] as const;

// Palco di prova costruito con comandi veri: due finestre, ognuna col suo contenuto d'esempio.
```

(il commento sopra `labStage` passa da «tre finestre» a «due finestre»).

- [ ] **Step 4: Verificare che passino**

Run: `npx vitest run tests/unit/gesture-lab-view.test.ts tests/unit/gesture-lab-settings.test.ts`
Expected: PASS.

Run: `npx vitest run tests/unit/gesture-lab-layout.test.tsx`
Expected: PASS (il layout di oggi non conta le finestre).

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/lib/gesture-lab/lab-view.ts apps/web/src/lib/gesture-lab/lab-stage.ts tests/unit/gesture-lab-view.test.ts tests/unit/gesture-lab-settings.test.ts
git add apps/web/src/lib/gesture-lab/lab-view.ts apps/web/src/lib/gesture-lab/lab-stage.ts tests/unit/gesture-lab-view.test.ts tests/unit/gesture-lab-settings.test.ts
git commit -m "feat(gesture-lab): screen in the URL, two-window test stage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Vista della mano e diagnostica

**Files:**

- Create: `apps/web/src/app/dev/gesture-lab/hand-view.tsx`
- Create: `apps/web/src/app/dev/gesture-lab/diagnostics.tsx`
- Test: `tests/unit/gesture-lab-hand-view.test.tsx`

**Interfaces:**

- Consumes: `gestureByName`, `gestureForEvent`, `gestureForHold` (Task 1); `drawHands`
  (`hand-drawing.ts`); `EventList` (`event-list.tsx`)
- Produces:
  - `HandView(props: { videoRef: React.RefObject<HTMLVideoElement | null>; framesRef: React.RefObject<{ raw: Frame; processed: Frame } | null>; view: RecognizerView | null; lastEvent: GestureEvent['type'] | null; feedback: boolean; idle: boolean; replaying: boolean })`
  - `Diagnostics(props: { view: RecognizerView | null; hand: Hand | null; tuning: Tuning; log: LogEntry[] })`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING, type RecognizerView } from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const drawing = vi.hoisted(() => ({ drawHands: vi.fn() }));
vi.mock('@/lib/gesture-lab/hand-drawing', () => drawing);

const { HandView } = await import('@/app/dev/gesture-lab/hand-view');
const { Diagnostics } = await import('@/app/dev/gesture-lab/diagnostics');

const view = (over: Partial<RecognizerView> = {}): RecognizerView => ({
  rawPose: 'thumb_up',
  pose: 'thumb_up',
  hold: null,
  armed: true,
  cooldownLeftMs: 0,
  dragging: false,
  ...over,
});

function renderHand(props: Partial<Parameters<typeof HandView>[0]> = {}) {
  render(
    <HandView
      videoRef={{ current: null }}
      framesRef={{ current: null }}
      view={null}
      lastEvent={null}
      feedback={false}
      idle={false}
      replaying={false}
      {...props}
    />,
  );
}

beforeEach(() => {
  drawing.drawHands.mockReset();
  // Un solo giro del ciclo di disegno basta a sapere se disegna.
  let calls = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    if (calls++ === 0) cb(0);
    return calls;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HandView', () => {
  it('names the last recognized gesture and what it does on the stage', () => {
    renderHand({ view: view(), lastEvent: 'CONFIRM' });
    expect(screen.getByText(/Pollice su/)).toBeTruthy();
    expect(screen.getByText('→ conferma')).toBeTruthy();
    expect(screen.queryByText(/CONFIRM/)).toBeNull();
  });

  it('names the drag while the pinch holds a window', () => {
    renderHand({ view: view({ dragging: true }), lastEvent: 'CONFIRM' });
    expect(screen.getByText(/Pinch e trascina/)).toBeTruthy();
  });

  it('shows the hold ring with the gesture name when feedback is on', () => {
    renderHand({
      view: view({ hold: { pose: 'thumb_up', progress: 0.5 } }),
      feedback: true,
    });
    expect(screen.getByLabelText('Attesa del gesto')).toBeTruthy();
    expect(screen.getByText('Pollice su')).toBeTruthy();
  });

  it('says the camera is off instead of a black box', () => {
    renderHand({ idle: true });
    expect(screen.getByText(/Fotocamera spenta/)).toBeTruthy();
  });

  it('draws the hand during a replay even with feedback off, and says there is no video', () => {
    renderHand({ replaying: true });
    expect(drawing.drawHands).toHaveBeenCalled();
    expect(screen.getByText(/nessun video/)).toBeTruthy();
  });

  it('draws nothing live when feedback is off', () => {
    renderHand();
    expect(drawing.drawHands).not.toHaveBeenCalled();
  });
});

describe('Diagnostics', () => {
  it('shows raw and stable pose, finger numbers and the events', () => {
    render(
      <Diagnostics
        view={view({ rawPose: 'fist' })}
        hand={hand('thumb_up')}
        tuning={DEFAULT_TUNING}
        log={[{ t: 1_200, label: 'CONFIRM' }]}
      />,
    );
    expect(screen.getByText(/Posa grezza: fist · stabile: thumb_up/)).toBeTruthy();
    expect(screen.getByText('Indice')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Eventi' })).toBeTruthy();
    expect(screen.getByText('CONFIRM')).toBeTruthy();
  });

  it('says when no hand is in view', () => {
    render(<Diagnostics view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} />);
    expect(screen.getByText('Nessuna mano in vista.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/gesture-lab-hand-view.test.tsx`
Expected: FAIL, import di `hand-view` non risolto.

- [ ] **Step 3: Implementare**

`apps/web/src/app/dev/gesture-lab/hand-view.tsx`. Il ciclo di disegno è quello di
`hand-panel.tsx:43-66`, invariato.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Frame, GestureEvent, RecognizerView } from '@omnicanvas/gesture';
import { gestureByName, gestureForEvent, gestureForHold } from '@/lib/gesture-lab/gesture-catalog';
import { drawHands } from '@/lib/gesture-lab/hand-drawing';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  framesRef: React.RefObject<{ raw: Frame; processed: Frame } | null>;
  view: RecognizerView | null;
  // L'ultimo evento scattato: il suo gesto resta scritto finché non ne scatta un altro.
  lastEvent: GestureEvent['type'] | null;
  feedback: boolean;
  // Né fotocamera né rigioco: al posto del riquadro nero si dice cosa succede.
  idle: boolean;
  // Nel rigioco non c'è video (si salvano solo i punti): lo scheletro si disegna sempre.
  replaying: boolean;
};

const RING = 2 * Math.PI * 11;

// La mano grande col nome del gesto riconosciuto. I numeri stanno in Avanzate → Diagnostica.
export function HandView({
  videoRef,
  framesRef,
  view,
  lastEvent,
  feedback,
  idle,
  replaying,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Scheletro e video condividono la proporzione dello stream (640x480 finché è ignota).
  const [size, setSize] = useState({ w: 640, h: 480 });
  const drawing = feedback || replaying;

  useEffect(() => {
    if (!drawing) {
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
  }, [drawing, framesRef]);

  const shown = view?.dragging ? gestureByName('pinch_drag') : gestureForEvent(lastEvent);
  const holding = feedback && view?.hold ? gestureForHold(view.hold.pose) : null;
  const progress = view?.hold?.progress ?? 0;

  return (
    <section
      aria-label="La tua mano"
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
      className="relative h-full max-w-full overflow-hidden rounded-tile bg-stage"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth && videoHeight) setSize({ w: videoWidth, h: videoHeight });
        }}
        className="h-full w-full -scale-x-100 object-contain"
      />
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {idle && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
          Fotocamera spenta.
        </p>
      )}
      {replaying && (
        <p className="absolute bottom-2 left-2 rounded-full bg-surface px-3 py-1 text-xs text-muted">
          Rigioco: solo i punti della mano, nessun video
        </p>
      )}
      <div className="absolute inset-x-2 top-2 flex flex-col items-start gap-1">
        {shown && (
          <p
            aria-live="polite"
            className="rounded-full bg-surface px-3 py-1 text-lg font-extrabold"
          >
            {`${shown.icon} ${shown.label} `}
            <span className="text-sm font-semibold text-muted">{`→ ${shown.effect}`}</span>
          </p>
        )}
        {holding && (
          <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-label="Attesa del gesto">
              <circle cx="14" cy="14" r="11" fill="none" className="stroke-line" strokeWidth="3" />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                className="stroke-accent"
                strokeWidth="3"
                strokeDasharray={`${RING * progress} ${RING}`}
                transform="rotate(-90 14 14)"
              />
            </svg>
            <span className="text-base font-semibold">{holding.label}</span>
          </div>
        )}
      </div>
    </section>
  );
}
```

`apps/web/src/app/dev/gesture-lab/diagnostics.tsx`. La griglia delle dita è quella di
`hand-panel.tsx:26-31` e `hand-panel.tsx:128-151`, invariata.

```tsx
import { poseMetrics, type Hand, type RecognizerView, type Tuning } from '@omnicanvas/gesture';
import type { LogEntry } from '@/lib/gesture-lab/event-log';
import { EventList } from './event-list';

const FINGER_LABELS = {
  index: 'Indice',
  middle: 'Medio',
  ring: 'Anulare',
  pinky: 'Mignolo',
} as const;

type Props = { view: RecognizerView | null; hand: Hand | null; tuning: Tuning; log: LogEntry[] };

// Quello che serve a tarare: posa grezza e stabile, numeri delle dita, eventi in ordine.
export function Diagnostics({ view, hand, tuning, log }: Props) {
  const metrics = hand ? poseMetrics(hand) : null;
  return (
    <div className="flex flex-col gap-3 text-xs text-fg">
      {view ? (
        <p className="text-muted">
          {`Posa grezza: ${view.rawPose} · stabile: ${view.pose} · ${view.armed ? 'armato' : 'in pausa'} · pausa ${Math.round(view.cooldownLeftMs)} ms`}
        </p>
      ) : (
        <p className="text-muted">Nessuna mano in vista.</p>
      )}
      {metrics && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5">
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
              {metrics.pinch.toFixed(2)}{' '}
              <span className="text-muted">{`(< ${tuning.pose.pinchOn})`}</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Pollice</dt>
            <dd>{metrics.thumbExtended ? 'esteso' : 'chiuso'}</dd>
          </div>
        </dl>
      )}
      <EventList entries={log} />
    </div>
  );
}
```

- [ ] **Step 4: Verificare che passi**

Run: `npx vitest run tests/unit/gesture-lab-hand-view.test.tsx`
Expected: PASS, 8 test.

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/app/dev/gesture-lab/hand-view.tsx apps/web/src/app/dev/gesture-lab/diagnostics.tsx tests/unit/gesture-lab-hand-view.test.tsx
git add apps/web/src/app/dev/gesture-lab/hand-view.tsx apps/web/src/app/dev/gesture-lab/diagnostics.tsx tests/unit/gesture-lab-hand-view.test.tsx
git commit -m "feat(gesture-lab): hand view with the recognized gesture name, diagnostics apart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pannello Avanzate

**Files:**

- Modify: `apps/web/src/app/dev/gesture-lab/lab-controls.tsx` (diviso in tre)
- Create: `apps/web/src/app/dev/gesture-lab/advanced-panel.tsx`
- Test: `tests/unit/gesture-lab-ui.test.tsx` (blocco `LabControls`), `tests/unit/gesture-lab-advanced.test.tsx` (nuovo)

**Interfaces:**

- Consumes: `gestureByName` (Task 1); `labCode`, `DEFAULT_LAB_SETTINGS` (`settings.ts`)
- Produces:
  - `CorrectionControls`, `TuningControls`, `DictionaryControls`, tutti con
    `{ settings: LabSettings; onChange: (next: LabSettings) => void }`
  - `LabControls` resta (le tre sezioni più «Ripristina predefiniti») solo finché il Task 9
    non lo elimina
  - `AdvancedPanel(props: { open: boolean; onClose: () => void; settings: LabSettings; onChange: (next: LabSettings) => void; diagnostics: ReactNode; presets: ReactNode | null })`

- [ ] **Step 1: Scrivere i test che falliscono**

In `tests/unit/gesture-lab-ui.test.tsx`, il blocco `describe('LabControls', …)` passa alle
tre sezioni. Leggere il file prima: i test esistenti cliccano etichette come
`'Filtro anti-tremolio'` e `'Palmo aperto, 1 s'`. Diventano:

- `turns a correction on` → renderizza `<CorrectionControls …/>`, stesso controllo.
- `changes a threshold with its slider` → `<TuningControls …/>`, stesso controllo.
- `turns a gesture off in the dictionary, and offers drag only to the pinch` →
  `<DictionaryControls …/>`; l'etichetta del palmo è ora `'Palmo aperto'` e quella del pinch
  `'Pinch e trascina'` (dal catalogo).
- `resets to the defaults` → si sposta in `gesture-lab-advanced.test.tsx` (sotto).

Aggiornare l'import in testa:
`import { CorrectionControls, DictionaryControls, TuningControls } from '@/app/dev/gesture-lab/lab-controls';`

`tests/unit/gesture-lab-advanced.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdvancedPanel } from '@/app/dev/gesture-lab/advanced-panel';
import { DEFAULT_LAB_SETTINGS, labCode, type LabSettings } from '@/lib/gesture-lab/settings';

const changed: LabSettings = {
  ...DEFAULT_LAB_SETTINGS,
  toggles: { ...DEFAULT_LAB_SETTINGS.toggles, feedback: true },
};

function renderPanel(props: Partial<Parameters<typeof AdvancedPanel>[0]> = {}) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(
    <AdvancedPanel
      open
      onClose={onClose}
      settings={changed}
      onChange={onChange}
      diagnostics={<p>diagnostica di prova</p>}
      presets={null}
      {...props}
    />,
  );
  return { onChange, onClose };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdvancedPanel', () => {
  it('renders nothing while closed', () => {
    renderPanel({ open: false });
    expect(screen.queryByRole('complementary', { name: 'Avanzate' })).toBeNull();
  });

  it('opens with every section closed', () => {
    renderPanel();
    const panel = screen.getByRole('complementary', { name: 'Avanzate' });
    const sections = panel.querySelectorAll('details');
    expect([...sections].map((d) => d.querySelector('summary')!.textContent)).toEqual([
      'Taratura',
      'Correzioni',
      'Dizionario',
      'Diagnostica',
    ]);
    expect([...sections].every((d) => !(d as HTMLDetailsElement).open)).toBe(true);
  });

  it('adds the presets section only when given', () => {
    renderPanel({ presets: <p>preset di prova</p> });
    expect(within(screen.getByRole('complementary')).getByText('Preset')).toBeTruthy();
  });

  it('toggles half and full height by tapping the handle', () => {
    renderPanel();
    const panel = screen.getByRole('complementary', { name: 'Avanzate' });
    expect(panel.dataset.size).toBe('half');
    fireEvent.click(screen.getByRole('button', { name: 'Ingrandisci il pannello' }));
    expect(panel.dataset.size).toBe('full');
    fireEvent.click(screen.getByRole('button', { name: 'Riduci il pannello' }));
    expect(panel.dataset.size).toBe('half');
  });

  it('goes full height when the handle is dragged up', () => {
    renderPanel();
    const handle = screen.getByRole('button', { name: 'Ingrandisci il pannello' });
    fireEvent.pointerDown(handle, { clientY: 500 });
    fireEvent.pointerUp(handle, { clientY: 300 });
    fireEvent.click(handle);
    expect(screen.getByRole('complementary').dataset.size).toBe('full');
  });

  it('resets to the defaults', () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina predefiniti' }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_LAB_SETTINGS);
  });

  it('copies the settings as code, or shows them when the clipboard refuses', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copia come codice' }));
    });
    expect(writeText).toHaveBeenCalledWith(labCode(changed));
    expect(screen.queryByRole('textbox')).toBeNull();

    writeText.mockRejectedValue(new Error('denied'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copia come codice' }));
    });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(labCode(changed));
  });

  it('closes', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi le impostazioni avanzate' }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

Nota sul test del trascinamento: dopo `pointerUp` il browser manda anche `click`; il test lo
simula e verifica che non annulli il trascinamento.

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/gesture-lab-ui.test.tsx tests/unit/gesture-lab-advanced.test.tsx`
Expected: FAIL: `CorrectionControls` non esportato; import di `advanced-panel` non risolto.

- [ ] **Step 3: Implementare**

`lab-controls.tsx`, nuova forma:

```tsx
'use client';

import { Button } from '@omnicanvas/ui';
import { GESTURE_COMMANDS, GESTURE_NAMES, type GestureCommand } from '@omnicanvas/gesture';
import { gestureByName } from '@/lib/gesture-lab/gesture-catalog';
import {
  DEFAULT_LAB_SETTINGS,
  TUNING_SLIDERS,
  readTuningValue,
  setTuningValue,
  type LabSettings,
} from '@/lib/gesture-lab/settings';

type Props = { settings: LabSettings; onChange: (next: LabSettings) => void };

// Toggle: invariato (righe 32-47 di oggi).

export function CorrectionControls({ settings, onChange }: Props) {
  const { tuning, toggles } = settings;
  const setToggle = (key: keyof LabSettings['toggles'], value: boolean) =>
    onChange({ ...settings, toggles: { ...toggles, [key]: value } });
  return (
    <div className="flex flex-col gap-1 text-fg">
      {/* i quattro <Toggle> di oggi, righe 58-82, invariati */}
    </div>
  );
}

export function TuningControls({ settings, onChange }: Props) {
  const { tuning } = settings;
  return (
    <div className="flex flex-col gap-2 text-fg">
      {/* TUNING_SLIDERS.map(…) di oggi, righe 87-114, invariato */}
    </div>
  );
}

export function DictionaryControls({ settings, onChange }: Props) {
  const { dictionary } = settings;
  return (
    <div className="flex flex-col gap-2 text-fg">
      {GESTURE_NAMES.map((name) => {
        const label = gestureByName(name).label;
        const options = GESTURE_COMMANDS.filter((c) =>
          name === 'pinch_drag' ? c === 'DRAG' : c !== 'DRAG',
        );
        return (
          <label key={name} className="flex items-center justify-between gap-2 text-xs">
            <span>{label}</span>
            <select
              aria-label={label}
              value={dictionary[name] ?? ''}
              onChange={(e) =>
                onChange({
                  ...settings,
                  dictionary: {
                    ...dictionary,
                    [name]: e.target.value === '' ? null : (e.target.value as GestureCommand),
                  },
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
    </div>
  );
}

// Provvisorio: la vecchia colonna dei comandi lo usa finché il Task 9 non la sostituisce.
export function LabControls(props: Props) {
  return (
    <div className="flex flex-col gap-4 text-fg">
      <CorrectionControls {...props} />
      <TuningControls {...props} />
      <DictionaryControls {...props} />
      <Button variant="quiet" onClick={() => props.onChange(DEFAULT_LAB_SETTINGS)}>
        Ripristina predefiniti
      </Button>
    </div>
  );
}
```

I commenti `{/* … */}` qui sopra indicano blocchi da spostare **così come sono** dal file di
oggi: nel codice vanno le righe vere, non i commenti. `GESTURE_LABELS` sparisce: i nomi
vengono dal catalogo.

`apps/web/src/app/dev/gesture-lab/advanced-panel.tsx`:

```tsx
'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button, cx } from '@omnicanvas/ui';
import { DEFAULT_LAB_SETTINGS, labCode, type LabSettings } from '@/lib/gesture-lab/settings';
import { CorrectionControls, DictionaryControls, TuningControls } from './lab-controls';

type Props = {
  open: boolean;
  onClose: () => void;
  settings: LabSettings;
  onChange: (next: LabSettings) => void;
  diagnostics: ReactNode;
  // Solo per un admin del laboratorio: i preset stanno sul server.
  presets: ReactNode | null;
};

// Sotto questa distanza il gesto sulla maniglia è un tocco, sopra è un trascinamento.
const DRAG_PX = 40;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="border-b border-line py-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
        {title}
      </summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}

// Il tecnico del laboratorio, sopra la schermata in cui si prova: dal basso sul telefono
// verticale, colonna a destra sul telefono orizzontale e sul computer (spec §2).
export function AdvancedPanel({ open, onClose, settings, onChange, diagnostics, presets }: Props) {
  const [size, setSize] = useState<'half' | 'full'>('half');
  const [code, setCode] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  // Dopo un trascinamento il browser manda anche un click: non deve riportare indietro.
  const dragged = useRef(false);

  if (!open) return null;

  async function copyCode() {
    const text = labCode(settings);
    try {
      await navigator.clipboard.writeText(text);
      setCode(null);
    } catch {
      setCode(text);
    }
  }

  return (
    <aside
      aria-label="Avanzate"
      data-size={size}
      className={cx(
        'fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-line bg-surface text-fg',
        size === 'full' ? 'h-dvh' : 'h-[50dvh]',
        'landscape:inset-y-0 landscape:left-auto landscape:h-dvh landscape:w-80 landscape:border-l landscape:border-t-0',
        'lg:static lg:z-auto lg:h-full lg:w-auto lg:rounded-panel lg:border',
      )}
    >
      <button
        type="button"
        aria-label={size === 'half' ? 'Ingrandisci il pannello' : 'Riduci il pannello'}
        onPointerDown={(e) => {
          dragFrom.current = e.clientY;
        }}
        onPointerUp={(e) => {
          const from = dragFrom.current;
          dragFrom.current = null;
          if (from === null || Math.abs(e.clientY - from) < DRAG_PX) return;
          dragged.current = true;
          setSize(e.clientY < from ? 'full' : 'half');
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          setSize((s) => (s === 'half' ? 'full' : 'half'));
        }}
        className="flex min-h-11 w-full touch-none items-center justify-center landscape:hidden"
      >
        <span aria-hidden className="h-1.5 w-12 rounded-full bg-line" />
      </button>
      <header className="flex items-center gap-2 px-4">
        <h2 className="flex-1 text-base font-extrabold">Avanzate</h2>
        <Button variant="quiet" aria-label="Chiudi le impostazioni avanzate" onClick={onClose}>
          ✕
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <Section title="Taratura">
          <TuningControls settings={settings} onChange={onChange} />
        </Section>
        <Section title="Correzioni">
          <CorrectionControls settings={settings} onChange={onChange} />
        </Section>
        <Section title="Dizionario">
          <DictionaryControls settings={settings} onChange={onChange} />
        </Section>
        {presets && <Section title="Preset">{presets}</Section>}
        <Section title="Diagnostica">{diagnostics}</Section>
        <div className="flex flex-col gap-2 py-4">
          <Button onClick={() => void copyCode()}>Copia come codice</Button>
          {code && (
            <textarea
              readOnly
              value={code}
              rows={12}
              className="rounded-tile border border-line bg-stage p-2 font-mono text-xs"
            />
          )}
          <Button variant="quiet" onClick={() => onChange(DEFAULT_LAB_SETTINGS)}>
            Ripristina predefiniti
          </Button>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx vitest run tests/unit/gesture-lab-ui.test.tsx tests/unit/gesture-lab-advanced.test.tsx tests/unit/gesture-lab-layout.test.tsx`
Expected: PASS (il layout di oggi usa ancora `LabControls`, che c'è).

Se `pointerDown`/`pointerUp` in happy-dom non portano `clientY`, usare
`fireEvent(handle, new PointerEvent('pointerdown', { clientY: 500, bubbles: true }))` nel
test, senza toccare il componente.

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/app/dev/gesture-lab/lab-controls.tsx apps/web/src/app/dev/gesture-lab/advanced-panel.tsx tests/unit/gesture-lab-ui.test.tsx tests/unit/gesture-lab-advanced.test.tsx
git add apps/web/src/app/dev/gesture-lab/lab-controls.tsx apps/web/src/app/dev/gesture-lab/advanced-panel.tsx tests/unit/gesture-lab-ui.test.tsx tests/unit/gesture-lab-advanced.test.tsx
git commit -m "feat(gesture-lab): advanced panel with collapsed sections and a tappable handle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Azioni server condivise e sezione Preset

**Files:**

- Create: `apps/web/src/app/dev/gesture-lab/use-lab-action.ts`
- Modify: `apps/web/src/app/dev/gesture-lab/preset-panel.tsx` (aggiunge `PresetSection`)
- Test: `tests/unit/gesture-lab-presets.test.tsx`

**Interfaces:**

- Consumes: `savePresetAction`, `deletePresetAction` (`actions.ts`); `LAB_MESSAGES`,
  `UNEXPECTED_MESSAGE` (`lab-messages.ts`)
- Produces:
  - `useLabAction(): { busy: boolean; message: string | null; setMessage: (m: string | null) => void; run: <T>(action: () => Promise<LabResult<T>>) => Promise<LabResult<T> | null> }`
    — `run` restituisce `null` se un'azione è già in corso o se l'azione lancia; con un
    risultato `ok: false` imposta il messaggio di `LAB_MESSAGES`, con `ok: true` lo azzera.
  - `PresetSection(props: { userId: string; presets: PresetSummary[]; onPresetsChange: (next: PresetSummary[]) => void; settings: LabSettings; onApply: (settings: LabSettings) => void })`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import type { PresetSummary } from '@/lib/gesture-lab/lab-store';

const actions = vi.hoisted(() => ({ savePresetAction: vi.fn(), deletePresetAction: vi.fn() }));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);

const { PresetSection } = await import('@/app/dev/gesture-lab/preset-panel');

const preset = (over: Partial<PresetSummary>): PresetSummary => ({
  id: 'p1',
  name: 'morbido',
  settings: {
    ...DEFAULT_LAB_SETTINGS,
    toggles: { ...DEFAULT_LAB_SETTINGS.toggles, feedback: true },
  },
  authorId: 'luca',
  authorName: 'Luca',
  createdAt: '2026-10-06T10:00:00Z',
  ...over,
});
const theirs = preset({});
const mine = preset({ id: 'p2', name: 'mio', authorId: 'me', authorName: 'Sean' });

function Harness({ onApply }: { onApply: (s: typeof DEFAULT_LAB_SETTINGS) => void }) {
  const [presets, setPresets] = useState([mine, theirs]);
  return (
    <PresetSection
      userId="me"
      presets={presets}
      onPresetsChange={setPresets}
      settings={DEFAULT_LAB_SETTINGS}
      onApply={onApply}
    />
  );
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PresetSection', () => {
  it('applies a preset', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Applica morbido' }));
    expect(onApply).toHaveBeenCalledWith(theirs.settings);
  });

  it('saves the current settings and lists the new preset first', async () => {
    const saved = preset({ id: 'p3', name: 'nuovo', authorId: 'me' });
    actions.savePresetAction.mockResolvedValue({ ok: true, value: saved });
    render(<Harness onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'nuovo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    });
    expect(actions.savePresetAction).toHaveBeenCalledWith({
      name: 'nuovo',
      settings: DEFAULT_LAB_SETTINGS,
    });
    expect(screen.getAllByRole('listitem')[0]!.textContent).toMatch(/nuovo/);
  });

  it('offers delete only on own presets, and drops one that is already gone', async () => {
    actions.deletePresetAction.mockResolvedValue({ ok: false, error: 'not_found' });
    render(<Harness onApply={vi.fn()} />);
    const [own, other] = screen.getAllByRole('listitem');
    expect(within(other!).queryByRole('button', { name: 'Elimina' })).toBeNull();
    await act(async () => {
      fireEvent.click(within(own!).getByRole('button', { name: 'Elimina' }));
    });
    expect(actions.deletePresetAction).toHaveBeenCalledWith('p2');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText(/Non più disponibile/)).toBeTruthy();
  });

  it('recovers when saving rejects', async () => {
    actions.savePresetAction.mockRejectedValue(new Error('network'));
    render(<Harness onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'x' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    });
    expect(screen.getByText('Operazione non riuscita. Riprova.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Salva taratura' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('saves once on a double click', async () => {
    let resolve: (value: unknown) => void = () => {};
    actions.savePresetAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<Harness onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    expect(actions.savePresetAction).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, value: preset({ id: 'p9', name: 'x' }) }));
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/gesture-lab-presets.test.tsx`
Expected: FAIL, `PresetSection` non esportato.

- [ ] **Step 3: Implementare**

`apps/web/src/app/dev/gesture-lab/use-lab-action.ts`:

```ts
'use client';

import { useCallback, useRef, useState } from 'react';
import type { LabResult } from '@/lib/gesture-lab/lab-store';
import { LAB_MESSAGES, UNEXPECTED_MESSAGE } from './lab-messages';

// Lo schema comune delle azioni sul server: una alla volta, errore leggibile se fallisce.
export function useLabAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Il ref blocca il secondo click prima che lo stato «busy» arrivi ai bottoni.
  const busyRef = useRef(false);

  const run = useCallback(
    async <T>(action: () => Promise<LabResult<T>>): Promise<LabResult<T> | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        const result = await action();
        setMessage(result.ok ? null : LAB_MESSAGES[result.error]);
        return result;
      } catch {
        setMessage(UNEXPECTED_MESSAGE);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return { busy, message, setMessage, run };
}
```

In fondo a `preset-panel.tsx` (aggiungere gli import `LabSettings`, `savePresetAction`,
`deletePresetAction`, `useLabAction`):

```tsx
type SectionProps = {
  userId: string;
  presets: PresetSummary[];
  onPresetsChange: (next: PresetSummary[]) => void;
  settings: LabSettings;
  onApply: (settings: LabSettings) => void;
};

// La sezione Preset di Avanzate: l'elenco lo tiene il Lab, così resta chiudendo il pannello.
export function PresetSection({
  userId,
  presets,
  onPresetsChange,
  settings,
  onApply,
}: SectionProps) {
  const { busy, message, run } = useLabAction();

  async function save(name: string) {
    const result = await run(() => savePresetAction({ name, settings }));
    if (!result?.ok) return false;
    onPresetsChange([result.value, ...presets]);
    return true;
  }

  async function remove(id: string) {
    if (!window.confirm('Eliminare questo preset?')) return;
    const result = await run(() => deletePresetAction(id));
    if (result && (result.ok || result.error === 'not_found'))
      onPresetsChange(presets.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="text-xs text-danger">{message}</p>}
      <PresetPanel
        userId={userId}
        presets={presets}
        busy={busy}
        onSave={save}
        onApply={(preset) => onApply(preset.settings)}
        onDelete={(id) => void remove(id)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verificare che passi**

Run: `npx vitest run tests/unit/gesture-lab-presets.test.tsx tests/unit/gesture-lab-server-panels.test.tsx`
Expected: PASS (i vecchi pannelli non sono toccati).

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/app/dev/gesture-lab/use-lab-action.ts apps/web/src/app/dev/gesture-lab/preset-panel.tsx tests/unit/gesture-lab-presets.test.tsx
git add apps/web/src/app/dev/gesture-lab/use-lab-action.ts apps/web/src/app/dev/gesture-lab/preset-panel.tsx tests/unit/gesture-lab-presets.test.tsx
git commit -m "feat(gesture-lab): shared server action helper, preset section for the advanced panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Registra in quattro passi

**Files:**

- Create: `apps/web/src/app/dev/gesture-lab/screen-header.tsx`
- Create: `apps/web/src/app/dev/gesture-lab/outcome-view.tsx`
- Create: `apps/web/src/app/dev/gesture-lab/record-wizard.tsx`
- Modify: `apps/web/src/app/dev/gesture-lab/lab-messages.ts` (aggiunge `LIVE_MESSAGES`)
- Test: `tests/unit/gesture-lab-record-wizard.test.tsx`

**Interfaces:**

- Consumes: catalogo (Task 1), `evaluateRecording`, `recordingOutcome`, `Outcome` (Task 2),
  `useLabAction` (Task 6), `saveRecordingAction`, `downloadRecording`, `LiveStatus`
- Produces:
  - `ScreenHeader(props: { title: string; onBack: () => void; backLabel?: string; onAdvanced?: () => void })`
    — «‹ Indietro» (o `‹ ${backLabel}`), titolo `h1`, ⚙ con `aria-label="Avanzate"` solo se
    `onAdvanced` c'è.
  - `OutcomeView(props: { outcome: Outcome; newLabel?: string })`
  - `LIVE_MESSAGES: Record<LiveStatus, string | null>`
  - `RecordWizard(props: { live: LiveStatus; hand: Hand | null; settings: LabSettings; scene: ReactNode; capture: (ms: number) => Promise<Frame[]>; onStartCamera: () => void; onRecorded: (clip: Recording) => void; onReview: () => void; onSaved: (summary: RecordingSummary) => void; onScene: (visible: boolean) => void; onAdvanced: () => void; onExit: () => void })`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Frame } from '@omnicanvas/gesture';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { hand } from '../fixtures/hands';

const actions = vi.hoisted(() => ({ saveRecordingAction: vi.fn() }));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);
const download = vi.hoisted(() => ({ downloadRecording: vi.fn() }));
vi.mock('@/lib/gesture-lab/download', () => download);

const { RecordWizard } = await import('@/app/dev/gesture-lab/record-wizard');

const held = (pose: 'thumb_up' | 'open_palm'): Frame[] =>
  Array.from({ length: 40 }, (_, i) => ({ t: i * 33, hands: [hand(pose)] }));
const summary = {
  id: 'r1',
  label: 'Pollice su',
  expect: 'CONFIRM' as const,
  description: '',
  authorId: 'me',
  authorName: 'Sean',
  createdAt: '2026-10-07T10:00:00Z',
};

function setup(over: { live?: LiveStatus; capture?: ReturnType<typeof vi.fn> } = {}) {
  const props = {
    live: over.live ?? ('on' as LiveStatus),
    hand: hand('thumb_up'),
    settings: DEFAULT_LAB_SETTINGS,
    scene: <div data-testid="scene" />,
    capture: over.capture ?? vi.fn().mockResolvedValue(held('thumb_up')),
    onStartCamera: vi.fn(),
    onRecorded: vi.fn(),
    onReview: vi.fn(),
    onSaved: vi.fn(),
    onScene: vi.fn(),
    onAdvanced: vi.fn(),
    onExit: vi.fn(),
  };
  const view = render(<RecordWizard {...props} />);
  return {
    ...props,
    rerender: (next: Partial<typeof props>) => view.rerender(<RecordWizard {...props} {...next} />),
    unmount: view.unmount,
  };
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

async function recordGesture(name: string, over: Parameters<typeof setup>[0] = {}) {
  const ctx = setup(over);
  fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
  await act(async () => {
    vi.advanceTimersByTime(3_000);
  });
  return ctx;
}

beforeEach(() => {
  vi.useFakeTimers();
  actions.saveRecordingAction.mockReset();
  download.downloadRecording.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RecordWizard', () => {
  it('walks gesture, position, countdown and outcome in order', async () => {
    const ctx = setup({ live: 'off' });
    expect(heading()).toBe('Quale gesto registri?');
    expect(screen.getByTestId('scene').parentElement!.hidden).toBe(true);
    expect(ctx.onScene).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    expect(heading()).toBe('Mettiti in posizione');
    expect(ctx.onStartCamera).toHaveBeenCalledTimes(1);
    expect(ctx.onScene).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/Come si fa: Pugno chiuso col pollice in su/)).toBeTruthy();
    expect(screen.getByText('✓ mano vista')).toBeTruthy();
    const start = screen.getByRole('button', { name: 'Inizia' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);

    ctx.rerender({ live: 'on' });
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    expect(screen.getByText('3')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(ctx.capture).toHaveBeenCalledWith(4_000);
    expect(heading()).toBe('Esito');
    expect(screen.getByText('✓ Riconosciuto')).toBeTruthy();
    expect(ctx.onRecorded).toHaveBeenCalledWith({
      expect: 'CONFIRM',
      armed: true,
      frames: held('thumb_up'),
      label: 'Pollice su',
    });
  });

  it('goes back one step at a time, and leaves from the first', () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    fireEvent.click(screen.getByRole('button', { name: '‹ Indietro' }));
    expect(heading()).toBe('Quale gesto registri?');
    fireEvent.click(screen.getByRole('button', { name: '‹ Indietro' }));
    expect(ctx.onExit).toHaveBeenCalled();
  });

  it('asks a name for a new gesture and saves it without an expected event', async () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Gesto nuovo' }));
    const next = screen.getByRole('button', { name: 'Avanti' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Come lo chiami?'), { target: { value: ' V ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('Registrato')).toBeTruthy();

    actions.saveRecordingAction.mockResolvedValue({ ok: true, value: summary });
    fireEvent.change(screen.getByLabelText('Nota (facoltativa)'), {
      target: { value: ' due dita ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    });
    expect(actions.saveRecordingAction).toHaveBeenCalledWith({
      label: 'V',
      expect: null,
      description: 'due dita',
      armed: true,
      frames: held('thumb_up'),
    });
    expect(ctx.onSaved).toHaveBeenCalledWith(summary);
    expect(screen.getByText('Salvato')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Registra un altro' }));
    expect(heading()).toBe('Quale gesto registri?');
  });

  it('names a known gesture by itself', async () => {
    await recordGesture('Pollice su');
    actions.saveRecordingAction.mockResolvedValue({ ok: true, value: summary });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    });
    expect(actions.saveRecordingAction.mock.calls[0]![0]).toMatchObject({
      label: 'Pollice su',
      expect: 'CONFIRM',
      description: '',
    });
  });

  it('saves once on a double click', async () => {
    await recordGesture('Pollice su');
    let resolve: (value: unknown) => void = () => {};
    actions.saveRecordingAction.mockReturnValue(new Promise((r) => (resolve = r)));
    fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    expect(actions.saveRecordingAction).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, value: summary }));
  });

  it('keeps the clip and offers the JSON when saving fails', async () => {
    await recordGesture('Pollice su');
    actions.saveRecordingAction.mockResolvedValue({ ok: false, error: 'failed' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    });
    expect(screen.getByText(/Non sono riuscito a salvare/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Scarica JSON' }));
    expect(download.downloadRecording).toHaveBeenCalled();
  });

  it('reviews the clip and redoes it from the position step', async () => {
    const ctx = await recordGesture('Pollice su');
    fireEvent.click(screen.getByRole('button', { name: /Rivedi/ }));
    expect(ctx.onReview).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Rifai/ }));
    expect(heading()).toBe('Mettiti in posizione');
  });

  it('says the outcome when the gesture was not recognized', async () => {
    await recordGesture('Pollice giù');
    expect(screen.getByText('✗ Non riconosciuto')).toBeTruthy();
    expect(screen.getByText('Scattati: Pollice su')).toBeTruthy();
  });

  it('goes back to the position step when no frame was recorded', async () => {
    await recordGesture('Pollice su', { capture: vi.fn().mockResolvedValue([]) });
    expect(heading()).toBe('Mettiti in posizione');
    expect(screen.getByText(/Nessun fotogramma registrato/)).toBeTruthy();
  });

  it('records the open palm disarmed, like the recorder', async () => {
    const ctx = await recordGesture('Palmo aperto', {
      capture: vi.fn().mockResolvedValue(held('open_palm')),
    });
    expect(ctx.onRecorded.mock.calls[0]![0]).toMatchObject({
      expect: 'GESTURES_TOGGLE',
      armed: false,
    });
  });

  it('cancels the countdown without capturing', async () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(ctx.capture).not.toHaveBeenCalled();
    expect(heading()).toBe('Mettiti in posizione');
  });

  it('waits for a cancelled capture to end before starting again', async () => {
    let finish: (frames: Frame[]) => void = () => {};
    const capture = vi.fn().mockReturnValue(new Promise<Frame[]>((r) => (finish = r)));
    await recordGesture('Pollice su', { capture });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect((screen.getByRole('button', { name: 'Inizia' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => finish(held('thumb_up')));
    expect(heading()).toBe('Mettiti in posizione');
    expect((screen.getByRole('button', { name: 'Inizia' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('captures nothing when the screen is left during the countdown', async () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    ctx.unmount();
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(ctx.capture).not.toHaveBeenCalled();
  });

  it('does not try the camera again when hand recognition is unavailable', () => {
    const ctx = setup({ live: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    expect(ctx.onStartCamera).not.toHaveBeenCalled();
    expect(screen.getByText(/Riconoscimento delle mani non disponibile/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/gesture-lab-record-wizard.test.tsx`
Expected: FAIL, import di `record-wizard` non risolto.

- [ ] **Step 3: Implementare**

In `lab-messages.ts` aggiungere (stessi testi di `lab.tsx:17-25` di oggi, con «fotocamera»):

```ts
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';

export const LIVE_MESSAGES: Record<LiveStatus, string | null> = {
  off: null,
  loading: 'Avvio della fotocamera e del riconoscimento…',
  on: null,
  no_camera:
    'Fotocamera non disponibile: consenti la fotocamera nel browser. Il rigioco funziona lo stesso.',
  unavailable:
    'Riconoscimento delle mani non disponibile su questo dispositivo. Il rigioco funziona lo stesso.',
};
```

`screen-header.tsx`:

```tsx
import { Button } from '@omnicanvas/ui';

type Props = { title: string; onBack: () => void; backLabel?: string; onAdvanced?: () => void };

// In cima a ogni schermata: si torna indietro, si legge dove si è, si aprono le Avanzate.
export function ScreenHeader({ title, onBack, backLabel = 'Indietro', onAdvanced }: Props) {
  return (
    <header className="flex shrink-0 items-center gap-2">
      <Button variant="quiet" onClick={onBack}>{`‹ ${backLabel}`}</Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h1>
      {onAdvanced && (
        <Button size="icon" aria-label="Avanzate" onClick={onAdvanced}>
          ⚙
        </Button>
      )}
    </header>
  );
}
```

`outcome-view.tsx`:

```tsx
import type { Outcome } from '@/lib/gesture-lab/evaluate';
import { eventLabel } from '@/lib/gesture-lab/gesture-catalog';

// L'esito grande, uguale al passo 4 di Registra e nel rigioco.
export function OutcomeView({
  outcome,
  newLabel = 'Registrato',
}: {
  outcome: Outcome;
  newLabel?: string;
}) {
  if (outcome.kind === 'new') return <p className="text-2xl font-extrabold">{newLabel}</p>;
  if (outcome.kind === 'recognized')
    return <p className="text-2xl font-extrabold text-accent">✓ Riconosciuto</p>;
  const fired = [...new Set(outcome.fired)].map(eventLabel);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-2xl font-extrabold text-danger">✗ Non riconosciuto</p>
      <p className="text-sm text-muted">{`Scattati: ${fired.length > 0 ? fired.join(', ') : 'nessuno'}`}</p>
    </div>
  );
}
```

`record-wizard.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@omnicanvas/ui';
import type { Frame, GestureName, Hand } from '@omnicanvas/gesture';
import { downloadRecording } from '@/lib/gesture-lab/download';
import { evaluateRecording, recordingOutcome } from '@/lib/gesture-lab/evaluate';
import { GESTURE_CATALOG, gestureByName } from '@/lib/gesture-lab/gesture-catalog';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import type { LabSettings } from '@/lib/gesture-lab/settings';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { saveRecordingAction } from './actions';
import { LIVE_MESSAGES } from './lab-messages';
import { OutcomeView } from './outcome-view';
import { ScreenHeader } from './screen-header';
import { useLabAction } from './use-lab-action';

const COUNTDOWN = 3;
const RECORD_MS = 4_000;
const NO_FRAMES = 'Nessun fotogramma registrato: la fotocamera era accesa e la mano in vista?';

type Choice = GestureName | 'new';
type Step =
  | { n: 1 }
  | { n: 2 }
  // count 0 = registrazione in corso
  | { n: 3; count: number }
  | { n: 4; clip: Recording; saved: boolean };

const TITLES = {
  1: 'Quale gesto registri?',
  2: 'Mettiti in posizione',
  3: 'Registrazione',
  4: 'Esito',
} as const;

type Props = {
  live: LiveStatus;
  hand: Hand | null;
  settings: LabSettings;
  // Mano e palco: restano montati e si mostrano dal passo 2 (il <video> non deve smontarsi).
  scene: ReactNode;
  capture: (ms: number) => Promise<Frame[]>;
  onStartCamera: () => void;
  onRecorded: (clip: Recording) => void;
  onReview: () => void;
  onSaved: (summary: RecordingSummary) => void;
  onScene: (visible: boolean) => void;
  onAdvanced: () => void;
  onExit: () => void;
};

export function RecordWizard({
  live,
  hand,
  settings,
  scene,
  capture,
  onStartCamera,
  onRecorded,
  onReview,
  onSaved,
  onScene,
  onAdvanced,
  onExit,
}: Props) {
  const [step, setStep] = useState<Step>({ n: 1 });
  const [choice, setChoice] = useState<Choice | null>(null);
  const [newName, setNewName] = useState('');
  const [note, setNote] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, message, setMessage, run } = useLabAction();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cambia a ogni «Annulla» e allo smontaggio: un conto o una cattura vecchi si ignorano.
  const attempt = useRef(0);

  const sceneVisible = step.n >= 2;
  useEffect(() => {
    onScene(sceneVisible);
    return () => onScene(false);
  }, [sceneVisible, onScene]);

  useEffect(
    () => () => {
      attempt.current += 1;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const outcome = useMemo(
    () =>
      step.n === 4
        ? recordingOutcome(step.clip.expect, evaluateRecording(step.clip, settings))
        : null,
    [step, settings],
  );

  const known = choice && choice !== 'new' ? gestureByName(choice) : null;

  // La fotocamera parte su un'azione di chi usa la pagina, mai da sola in un ciclo: se il
  // riconoscimento non c'è, ritentare non serve.
  function toPosition() {
    setStep({ n: 2 });
    if (live === 'off' || live === 'no_camera') onStartCamera();
  }

  function choose(next: Choice) {
    setChoice(next);
    if (next !== 'new') toPosition();
  }

  async function record(id: number) {
    setStep({ n: 3, count: 0 });
    setCapturing(true);
    let frames: Frame[] = [];
    try {
      frames = await capture(RECORD_MS);
    } catch {
      frames = [];
    }
    setCapturing(false);
    if (attempt.current !== id) return;
    if (frames.length === 0) {
      toPosition();
      setNotice(NO_FRAMES);
      return;
    }
    const expect = known ? known.event : null;
    const clip: Recording = {
      expect,
      armed: expect !== 'GESTURES_TOGGLE',
      frames,
      label: known ? known.label : newName.trim(),
    };
    setMessage(null);
    setStep({ n: 4, clip, saved: false });
    onRecorded(clip);
  }

  function start() {
    setNotice(null);
    const id = ++attempt.current;
    const tick = (n: number) => {
      if (attempt.current !== id) return;
      if (n === 0) {
        void record(id);
        return;
      }
      setStep({ n: 3, count: n });
      timer.current = setTimeout(() => tick(n - 1), 1_000);
    };
    tick(COUNTDOWN);
  }

  function cancel() {
    attempt.current += 1;
    if (timer.current) clearTimeout(timer.current);
    toPosition();
  }

  async function save(clip: Recording) {
    const result = await run(() =>
      saveRecordingAction({
        label: clip.label ?? '',
        expect: clip.expect,
        description: note.trim(),
        armed: clip.armed,
        frames: clip.frames,
      }),
    );
    if (!result?.ok) return;
    onSaved(result.value);
    setStep({ n: 4, clip, saved: true });
  }

  function again() {
    setChoice(null);
    setNewName('');
    setNote('');
    setMessage(null);
    setStep({ n: 1 });
  }

  function back() {
    if (step.n === 1) onExit();
    else if (step.n === 2) setStep({ n: 1 });
    else if (step.n === 3) cancel();
    else toPosition();
  }

  const liveMessage = LIVE_MESSAGES[live];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader
        title={TITLES[step.n]}
        onBack={back}
        onAdvanced={step.n === 2 ? onAdvanced : undefined}
      />
      <div hidden={!sceneVisible} className="flex min-h-0 flex-1 flex-col">
        {scene}
      </div>

      {step.n === 1 && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GESTURE_CATALOG.map((g) => (
              <li key={g.name}>
                <Button
                  aria-label={g.label}
                  onClick={() => choose(g.name)}
                  className="w-full justify-start"
                >
                  {`${g.icon} ${g.label}`}
                </Button>
              </li>
            ))}
            <li>
              <Button
                aria-label="Gesto nuovo"
                onClick={() => choose('new')}
                className="w-full justify-start"
              >
                ＋ Gesto nuovo
              </Button>
            </li>
          </ul>
          {choice === 'new' && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm">
                Come lo chiami?
                <input
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="min-h-11 rounded-tile border border-line bg-stage px-3"
                />
              </label>
              <Button variant="accent" disabled={newName.trim() === ''} onClick={toPosition}>
                Avanti
              </Button>
            </div>
          )}
        </div>
      )}

      {step.n === 2 && (
        <div className="flex shrink-0 flex-col gap-2">
          <p aria-live="polite" className={hand ? 'font-semibold text-accent' : 'text-muted'}>
            {hand ? '✓ mano vista' : 'Mostra la mano alla fotocamera'}
          </p>
          {known && <p className="text-sm">{`Come si fa: ${known.howTo}`}</p>}
          {liveMessage && <p className="text-xs text-muted">{liveMessage}</p>}
          {notice && <p className="text-sm text-danger">{notice}</p>}
          <Button variant="accent" disabled={live !== 'on' || capturing} onClick={start}>
            Inizia
          </Button>
        </div>
      )}

      {step.n === 3 && (
        <div className="flex shrink-0 flex-col items-center gap-2">
          {step.count > 0 ? (
            <p aria-live="polite" className="text-6xl font-extrabold tabular-nums">
              {step.count}
            </p>
          ) : (
            <>
              <p aria-live="polite" className="font-semibold">
                Registrazione…
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  ref={(el) => {
                    el?.animate?.([{ width: '0%' }, { width: '100%' }], {
                      duration: RECORD_MS,
                      fill: 'forwards',
                    });
                  }}
                  className="h-full w-0 bg-accent"
                />
              </div>
            </>
          )}
          <Button onClick={cancel}>Annulla</Button>
        </div>
      )}

      {step.n === 4 && (
        <div className="flex shrink-0 flex-col gap-2">
          {outcome && <OutcomeView outcome={outcome} />}
          {step.saved ? (
            <>
              <p className="font-semibold">Salvato</p>
              <Button variant="accent" onClick={again}>
                Registra un altro
              </Button>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                Nota (facoltativa)
                <textarea
                  maxLength={500}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="rounded-tile border border-line bg-stage px-3 py-2"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" disabled={busy} onClick={() => void save(step.clip)}>
                  Salva nell&apos;archivio
                </Button>
                <Button onClick={onReview}>▶ Rivedi</Button>
                <Button onClick={toPosition}>↺ Rifai</Button>
                {message && (
                  <Button
                    onClick={() =>
                      downloadRecording(
                        { ...step.clip, description: note.trim() },
                        step.clip.expect,
                        step.clip.label,
                      )
                    }
                  >
                    Scarica JSON
                  </Button>
                )}
              </div>
              {message && <p className="text-sm text-danger">{message}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

Note per chi implementa:

- `record` legge `known` e `newName` dalla chiusura del render in cui è partito `start`:
  durante il conto alla rovescia la scelta non può cambiare (il passo 1 non è visibile),
  quindi va bene.
- La lint `react-hooks` può segnalare `timer.current` nella pulizia: è lo stesso schema di
  `record-panel.tsx:49-54`, già accettato.

- [ ] **Step 4: Verificare che passi**

Run: `npx vitest run tests/unit/gesture-lab-record-wizard.test.tsx`
Expected: PASS, 14 test.

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/app/dev/gesture-lab/screen-header.tsx apps/web/src/app/dev/gesture-lab/outcome-view.tsx apps/web/src/app/dev/gesture-lab/record-wizard.tsx apps/web/src/app/dev/gesture-lab/lab-messages.ts tests/unit/gesture-lab-record-wizard.test.tsx
git add apps/web/src/app/dev/gesture-lab/screen-header.tsx apps/web/src/app/dev/gesture-lab/outcome-view.tsx apps/web/src/app/dev/gesture-lab/record-wizard.tsx apps/web/src/app/dev/gesture-lab/lab-messages.ts tests/unit/gesture-lab-record-wizard.test.tsx
git commit -m "feat(gesture-lab): guided four-step recording with an immediate outcome

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rigioca, elenco e rigioco

**Files:**

- Modify: `apps/web/src/lib/gesture-lab/use-gesture-lab.ts` (aggiunge `progress`)
- Create: `apps/web/src/app/dev/gesture-lab/replay-screen.tsx`
- Test: `tests/unit/use-gesture-lab.test.tsx` (un test nuovo), `tests/unit/gesture-lab-replay-screen.test.tsx`

**Interfaces:**

- Consumes: `OutcomeView`, `ScreenHeader` (Task 7), `useLabAction` (Task 6), catalogo,
  `evaluateRecording`, `getRecordingAction`, `deleteRecordingAction`, `parseRecording`,
  `downloadRecording`, `Menu` di `@omnicanvas/ui`
- Produces:
  - `useGestureLab(...).progress: number` — 0 dopo `loadRecording`, poi `t` del fotogramma
    rigiocato diviso `t` dell'ultimo (1 a fine rigioco).
  - `ReplayScreen(props: { userId: string; recordings: RecordingSummary[]; onRemoved: (id: string) => void; id: string | null; scene: ReactNode; settings: LabSettings; recording: Recording | null; playing: boolean; progress: number; onLoad: (recording: Recording) => void; onPlay: () => void; onPause: () => void; onOpen: (id: string) => void; onList: () => void; onExit: () => void; onScene: (visible: boolean) => void; onAdvanced: () => void })`
    — `onRemoved`, `onLoad` e `onScene` devono essere stabili (il Lab li passa con
    `useCallback` o come setter di `useState`): entrano nelle dipendenze di un effetto.

- [ ] **Step 1: Scrivere i test che falliscono**

In `tests/unit/use-gesture-lab.test.tsx`, dentro `describe('useGestureLab replay', …)`:

```tsx
it('reports how far the replay has gone', () => {
  const { result } = setup();
  act(() => result.current.loadRecording(recording));
  expect(result.current.progress).toBe(0);
  act(() => result.current.play());
  expect(result.current.progress).toBe(0);
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(result.current.progress).toBe(0.5);
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(result.current.progress).toBe(1);
  act(() => result.current.loadRecording(recording));
  expect(result.current.progress).toBe(0);
});
```

(`recording` del file ha fotogrammi a 0, 100, 200 ms.)

`tests/unit/gesture-lab-replay-screen.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Frame } from '@omnicanvas/gesture';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import { DEFAULT_LAB_SETTINGS, type LabSettings } from '@/lib/gesture-lab/settings';
import { hand } from '../fixtures/hands';

const actions = vi.hoisted(() => ({ getRecordingAction: vi.fn(), deleteRecordingAction: vi.fn() }));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);
const download = vi.hoisted(() => ({ downloadRecording: vi.fn() }));
vi.mock('@/lib/gesture-lab/download', () => download);

const { ReplayScreen } = await import('@/app/dev/gesture-lab/replay-screen');

const thumbUp: Frame[] = Array.from({ length: 40 }, (_, i) => ({
  t: i * 33,
  hands: [hand('thumb_up')],
}));
const clip: Recording = { expect: 'CONFIRM', armed: true, frames: thumbUp, label: 'Pollice su' };
const row = (over: Partial<RecordingSummary>): RecordingSummary => ({
  id: 'r1',
  label: 'Pollice su',
  expect: 'CONFIRM',
  description: 'luce bassa',
  authorId: 'me',
  authorName: 'Sean',
  createdAt: '2026-10-06T10:00:00Z',
  ...over,
});
const recordings = [
  row({}),
  row({
    id: 'r2',
    label: 'Swipe a sinistra',
    expect: 'FOCUS_NEXT',
    authorId: 'luca',
    authorName: 'Luca',
    description: '',
  }),
  row({
    id: 'r3',
    label: 'V',
    expect: null,
    authorId: 'luca',
    authorName: 'Luca',
    description: '',
  }),
];

type HarnessProps = { id: string | null; settings?: LabSettings };

function setup(initial: HarnessProps) {
  const spies = {
    onRemoved: vi.fn(),
    onOpen: vi.fn(),
    onList: vi.fn(),
    onExit: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onScene: vi.fn(),
    onAdvanced: vi.fn(),
  };
  // Il rigioco vero sta nel Lab: qui basta tenere la registrazione caricata.
  function Harness({ id, settings = DEFAULT_LAB_SETTINGS }: HarnessProps) {
    const [recording, setRecording] = useState<Recording | null>(null);
    return (
      <ReplayScreen
        userId="me"
        recordings={recordings}
        id={id}
        scene={<div data-testid="scene" />}
        settings={settings}
        recording={recording}
        playing={false}
        progress={0}
        onLoad={setRecording}
        {...spies}
      />
    );
  }
  const view = render(<Harness {...initial} />);
  return { ...spies, rerender: (next: HarnessProps) => view.rerender(<Harness {...next} />) };
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  download.downloadRecording.mockReset();
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReplayScreen list', () => {
  it('lists the recordings with gesture, author and note, scene hidden', () => {
    const ctx = setup({ id: null });
    expect(screen.getByRole('button', { name: /👍 Pollice su.*Sean.*luce bassa/ })).toBeTruthy();
    expect(screen.getByTestId('scene').parentElement!.hidden).toBe(true);
    expect(ctx.onScene).toHaveBeenLastCalledWith(false);
  });

  it('filters by gesture', () => {
    setup({ id: null });
    expect(screen.getByRole('button', { name: 'Tutti' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Swipe a sinistra' }));
    expect(screen.queryByRole('button', { name: /Sean/ })).toBeNull();
    expect(screen.getByRole('button', { name: /👉 Swipe a sinistra.*Luca/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gesti nuovi' }));
    expect(screen.getByRole('button', { name: /V.*Luca/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Swipe a sinistra.*Luca/ })).toBeNull();
  });

  it('opens a recording through the URL', () => {
    const ctx = setup({ id: null });
    fireEvent.click(screen.getByRole('button', { name: /Swipe a sinistra.*Luca/ }));
    expect(ctx.onOpen).toHaveBeenCalledWith('r2');
  });

  it('loads a recording from a JSON file', async () => {
    const ctx = setup({ id: null });
    const file = new File([JSON.stringify(clip)], 'clip.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Carica un file JSON'), { target: { files: [file] } });
    });
    expect(screen.getByText('✓ Riconosciuto')).toBeTruthy();
    expect(ctx.onScene).toHaveBeenLastCalledWith(true);
  });
});

describe('ReplayScreen replay', () => {
  it('loads the recording of the URL and shows its outcome at once', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    expect(actions.getRecordingAction).toHaveBeenCalledWith('r1');
    expect(screen.getByText('✓ Riconosciuto')).toBeTruthy();
    expect(screen.getByText('Atteso: Pollice su')).toBeTruthy();
    expect(screen.getByTestId('scene').parentElement!.hidden).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Rigioca' }));
    expect(ctx.onPlay).toHaveBeenCalled();
  });

  it('recomputes the outcome when the settings change', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    ctx.rerender({
      id: 'r1',
      settings: {
        ...DEFAULT_LAB_SETTINGS,
        dictionary: { ...DEFAULT_LAB_SETTINGS.dictionary, thumb_up_hold: null },
      },
    });
    expect(screen.getByText('✗ Non riconosciuto')).toBeTruthy();
  });

  it('offers delete only on own recordings, and returns to the list after it', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    actions.deleteRecordingAction.mockResolvedValue({ ok: true, value: null });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));
    });
    expect(actions.deleteRecordingAction).toHaveBeenCalledWith('r1');
    expect(ctx.onRemoved).toHaveBeenCalledWith('r1');
    expect(ctx.onList).toHaveBeenCalled();
  });

  it('downloads someone else’s recording but does not delete it', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: { ...clip, label: 'Swipe' } });
    setup({ id: 'r2' });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    expect(screen.queryByRole('button', { name: 'Elimina' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Scarica JSON' }));
    expect(download.downloadRecording).toHaveBeenCalled();
  });

  it('drops a recording that no longer exists and goes back to the list', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: false, error: 'not_found' });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    expect(ctx.onRemoved).toHaveBeenCalledWith('r1');
    expect(ctx.onList).toHaveBeenCalled();
    expect(screen.getByText(/Non più disponibile/)).toBeTruthy();
  });

  it('pauses and goes back to the archive', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: '‹ Archivio' }));
    expect(ctx.onPause).toHaveBeenCalled();
    expect(ctx.onList).toHaveBeenCalled();
  });
});
```

Nel test «not_found» il componente resta con `id: 'r1'` (il Harness non cambia URL): il
messaggio deve vedersi anche in quello stato, quindi la schermata senza registrazione
caricata mostra il messaggio d'errore.

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/use-gesture-lab.test.tsx tests/unit/gesture-lab-replay-screen.test.tsx`
Expected: FAIL: `progress` è `undefined`; import di `replay-screen` non risolto.

- [ ] **Step 3: Implementare**

In `use-gesture-lab.ts`:

```ts
const [progress, setProgress] = useState(0);
```

In `loadRecording`, accanto a `setFired([])`: `setProgress(0);`

In `play`, prima di `createReplayer`:

```ts
const last = recording.frames[recording.frames.length - 1]?.t ?? 0;
```

e dentro `onFrame`, dopo `out.events.forEach(onEvent);`:

```ts
setProgress(last > 0 ? frame.t / last : 1);
```

Aggiungere `progress` all'oggetto restituito.

`apps/web/src/app/dev/gesture-lab/replay-screen.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Menu } from '@omnicanvas/ui';
import type { GestureEvent } from '@omnicanvas/gesture';
import { downloadRecording } from '@/lib/gesture-lab/download';
import { evaluateRecording, recordingOutcome } from '@/lib/gesture-lab/evaluate';
import { gestureForEvent } from '@/lib/gesture-lab/gesture-catalog';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';
import { parseRecording, type Recording } from '@/lib/gesture-lab/recording';
import type { LabSettings } from '@/lib/gesture-lab/settings';
import { deleteRecordingAction, getRecordingAction } from './actions';
import { OutcomeView } from './outcome-view';
import { ScreenHeader } from './screen-header';
import { useLabAction } from './use-lab-action';

type Props = {
  userId: string;
  recordings: RecordingSummary[];
  onRemoved: (id: string) => void;
  id: string | null;
  scene: ReactNode;
  settings: LabSettings;
  recording: Recording | null;
  playing: boolean;
  progress: number;
  onLoad: (recording: Recording) => void;
  onPlay: () => void;
  onPause: () => void;
  onOpen: (id: string) => void;
  onList: () => void;
  onExit: () => void;
  onScene: (visible: boolean) => void;
  onAdvanced: () => void;
};

// Filtro dell'elenco: l'evento atteso, oppure «new» per i gesti nuovi (expect nullo).
const NEW = 'new';
type FilterKey = GestureEvent['type'] | typeof NEW;
const filterKey = (expect: GestureEvent['type'] | null): FilterKey => expect ?? NEW;
const filterLabel = (key: FilterKey) =>
  key === NEW ? 'Gesti nuovi' : (gestureForEvent(key)?.label ?? key);

const titleOf = (r: { label?: string; expect: GestureEvent['type'] | null }) => {
  const gesture = gestureForEvent(r.expect);
  return `${gesture?.icon ?? '✳️'} ${r.label || gesture?.label || 'Gesto nuovo'}`;
};

const date = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

export function ReplayScreen({
  userId,
  recordings,
  onRemoved,
  id,
  scene,
  settings,
  recording,
  playing,
  progress,
  onLoad,
  onPlay,
  onPause,
  onOpen,
  onList,
  onExit,
  onScene,
  onAdvanced,
}: Props) {
  const { busy, message, run } = useLabAction();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  // Una registrazione aperta da file non ha id: si rigioca senza passare dall'URL.
  const [fromFile, setFromFile] = useState(false);
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const showing = recording !== null && (id !== null ? loadedId === id : fromFile);

  useEffect(() => {
    onScene(showing);
    return () => onScene(false);
  }, [showing, onScene]);

  // Aprendo un link con l'id, la registrazione arriva dal server.
  useEffect(() => {
    if (id === null || id === loadedId) return;
    let cancelled = false;
    void run(() => getRecordingAction(id)).then((result) => {
      if (cancelled || !result) return;
      if (result.ok) {
        onLoad(result.value);
        setLoadedId(id);
      } else if (result.error === 'not_found') {
        onRemoved(id);
        onList();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadedId, run, onLoad, onRemoved, onList]);

  const outcome = useMemo(
    () =>
      recording ? recordingOutcome(recording.expect, evaluateRecording(recording, settings)) : null,
    [recording, settings],
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseRecording(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid recording');
      setFileError(null);
      onLoad(parsed);
      setLoadedId(null);
      setFromFile(true);
    } catch {
      setFileError('Questo file non è una registrazione del laboratorio.');
    }
  }

  async function remove(recordingId: string) {
    if (!window.confirm('Eliminare questa registrazione?')) return;
    const result = await run(() => deleteRecordingAction(recordingId));
    if (result && (result.ok || result.error === 'not_found')) {
      onRemoved(recordingId);
      onList();
    }
  }

  function backToArchive() {
    onPause();
    if (id === null) setFromFile(false);
    else onList();
  }

  if (showing && recording && outcome) {
    const summary = id ? recordings.find((r) => r.id === id) : undefined;
    const mine = summary?.authorId === userId;
    const expected = gestureForEvent(recording.expect);
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <ScreenHeader
          title={titleOf(recording)}
          onBack={backToArchive}
          backLabel="Archivio"
          onAdvanced={onAdvanced}
        />
        <div className="flex min-h-0 flex-1 flex-col">{scene}</div>
        <div className="flex shrink-0 flex-col gap-2">
          <OutcomeView outcome={outcome} newLabel="Gesto nuovo: nessun confronto" />
          {recording.expect && (
            <p className="text-sm text-muted">{`Atteso: ${expected?.label ?? recording.expect}`}</p>
          )}
          <div
            role="progressbar"
            aria-label="Avanzamento del rigioco"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-2 w-full overflow-hidden rounded-full bg-line"
          >
            <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {playing ? (
              <Button onClick={onPause}>Pausa</Button>
            ) : (
              <Button variant="accent" onClick={onPlay}>
                Rigioca
              </Button>
            )}
            <Menu label="⋯" triggerLabel="Altre azioni">
              <Button
                variant="quiet"
                onClick={() => downloadRecording(recording, recording.expect, recording.label)}
              >
                Scarica JSON
              </Button>
              {mine && id && (
                <Button variant="quiet" disabled={busy} onClick={() => void remove(id)}>
                  Elimina
                </Button>
              )}
            </Menu>
          </div>
          {message && <p className="text-sm text-danger">{message}</p>}
        </div>
      </div>
    );
  }

  const keys = [...new Set(recordings.map((r) => filterKey(r.expect)))];
  const visible =
    filter === null ? recordings : recordings.filter((r) => filterKey(r.expect) === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader title="Rigioca" onBack={onExit} />
      {/* La scena resta montata anche qui: nascosta, si riapre senza perdere il <video>. */}
      <div hidden className="flex min-h-0 flex-col">
        {scene}
      </div>
      {id !== null && busy && <p className="text-sm text-muted">Carico la registrazione…</p>}
      {message && <p className="text-sm text-danger">{message}</p>}
      {recordings.length === 0 ? (
        <p className="text-sm text-muted">
          Nessuna registrazione. Registrane una da «Registra un gesto».
        </p>
      ) : (
        <div role="group" aria-label="Filtra per gesto" className="flex flex-wrap gap-2">
          {[null, ...keys].map((key) => (
            <Button
              key={key ?? 'all'}
              variant={filter === key ? 'accent' : 'pill'}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {key === null ? 'Tutti' : filterLabel(key)}
            </Button>
          ))}
        </div>
      )}
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(r.id)}
              className="flex min-h-11 w-full flex-col items-start rounded-tile border border-line bg-surface px-3 py-2 text-left hover:border-accent"
            >
              <span className="font-semibold">{titleOf(r)}</span>
              <span className="text-xs text-muted">{`${r.authorName} · ${date(r.createdAt)}`}</span>
              {r.description && <span className="text-xs">{r.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      <label className="shrink-0 cursor-pointer text-sm text-muted underline">
        Carica un file JSON…
        <input
          type="file"
          accept="application/json"
          aria-label="Carica un file JSON"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>
      {fileError && <p className="text-sm text-danger">{fileError}</p>}
    </div>
  );
}
```

Attenzione: qui la scena è in due posti diversi (rigioco e elenco), quindi passando
dall'uno all'altro si rimonta. Nel rigioco non c'è video (la fotocamera è ferma), il canvas
si ridisegna da solo: va bene. Il nodo nascosto nell'elenco serve solo a non lasciare
`videoRef` vuoto se un altro componente lo usa; se la lint o i test lo trovano superfluo, si
può togliere.

- [ ] **Step 4: Verificare che passino**

Run: `npx vitest run tests/unit/use-gesture-lab.test.tsx tests/unit/gesture-lab-replay-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/lib/gesture-lab/use-gesture-lab.ts apps/web/src/app/dev/gesture-lab/replay-screen.tsx tests/unit/use-gesture-lab.test.tsx tests/unit/gesture-lab-replay-screen.test.tsx
git add apps/web/src/lib/gesture-lab/use-gesture-lab.ts apps/web/src/app/dev/gesture-lab/replay-screen.tsx tests/unit/use-gesture-lab.test.tsx tests/unit/gesture-lab-replay-screen.test.tsx
git commit -m "feat(gesture-lab): replay screen with gesture filter, immediate outcome and progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: La pagina nuova, via i vecchi pannelli

**Files:**

- Create: `apps/web/src/app/dev/gesture-lab/home-screen.tsx`
- Create: `apps/web/src/app/dev/gesture-lab/try-screen.tsx`
- Create: `apps/web/src/app/dev/gesture-lab/lab-scene.tsx`
- Rewrite: `apps/web/src/app/dev/gesture-lab/lab.tsx`
- Modify: `apps/web/src/lib/gesture-lab/use-gesture-lab.ts:53` (`fired` tipizzato)
- Modify: `apps/web/src/app/dev/gesture-lab/lab-controls.tsx` (via `LabControls`)
- Modify: `apps/web/src/app/dev/gesture-lab/preset-panel.tsx` (via l'`h2` «Preset»: il titolo
  ora è quello della sezione di Avanzate)
- Delete: `lab-tabs.tsx`, `server-panels.tsx`, `record-panel.tsx`, `archive-panel.tsx`,
  `replay-panel.tsx`, `hand-panel.tsx`
- Delete test: `tests/unit/gesture-lab-server-panels.test.tsx`,
  `tests/unit/gesture-lab-record.test.tsx`, `tests/unit/gesture-lab-hand.test.tsx`; in
  `tests/unit/gesture-lab-ui.test.tsx` togliere il blocco `describe('ReplayPanel', …)`
  (coperto da `gesture-lab-replay-screen.test.tsx`)
- Rewrite test: `tests/unit/gesture-lab-layout.test.tsx`

**Interfaces:**

- Consumes: tutto quanto sopra.
- Produces:
  - `HomeScreen(props: { canArchive: boolean; onGo: (view: LabView) => void })`
  - `TryScreen(props: { scene: ReactNode; live: LiveStatus; armed: boolean; onStart: () => void; onStop: () => void; onBack: () => void; onAdvanced: () => void })`
  - `LabScene(props: { areaRef: React.RefObject<HTMLDivElement | null>; hand: ReactNode; stage: ReactNode })`
  - `useGestureLab(...).fired: GestureEvent['type'][]`

- [ ] **Step 1: Scrivere il test che fallisce**

Riscrivere `tests/unit/gesture-lab-layout.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { labStage } from '@/lib/gesture-lab/lab-stage';

// La schermata viene dall'URL: il mock legge la query impostata dal test.
const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const hook = vi.hoisted(() => ({ startLive: vi.fn(), stopLive: vi.fn(), pause: vi.fn() }));
// Il layout non dipende dalla webcam: il hook resta fermo in 'off'.
vi.mock('@/lib/gesture-lab/use-gesture-lab', () => ({
  useGestureLab: () => ({
    settings: DEFAULT_LAB_SETTINGS,
    setSettings: vi.fn(),
    stage: labStage(),
    dispatch: vi.fn(),
    log: [],
    view: null,
    hand: null,
    armed: false,
    cursor: null,
    live: 'off',
    startLive: hook.startLive,
    stopLive: hook.stopLive,
    recording: null,
    loadRecording: vi.fn(),
    playing: false,
    progress: 0,
    play: vi.fn(),
    pause: hook.pause,
    fired: [],
    capture: vi.fn(),
  }),
}));

vi.mock('@/app/dev/gesture-lab/actions', () => ({
  saveRecordingAction: vi.fn(),
  getRecordingAction: vi.fn(),
  deleteRecordingAction: vi.fn(),
  savePresetAction: vi.fn(),
  deletePresetAction: vi.fn(),
}));

const { Lab } = await import('@/app/dev/gesture-lab/lab');

const archive = { userId: 'me', recordings: [], presets: [] };

beforeEach(() => {
  nav.search = '';
  window.history.replaceState(null, '', '/dev/gesture-lab');
  Object.values(hook).forEach((fn) => fn.mockReset());
});
afterEach(cleanup);

describe('gesture lab home', () => {
  it('offers only «Prova» without the archive', () => {
    render(<Lab archive={null} />);
    expect(screen.getByText('Cosa vuoi fare?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Prova le gesture/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Registra un gesto/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Rigioca dall'archivio/ })).toBeNull();
  });

  it('offers the three choices to a lab admin', () => {
    render(<Lab archive={archive} />);
    expect(screen.getByRole('button', { name: /Registra un gesto/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Rigioca dall'archivio/ })).toBeTruthy();
  });

  it('puts the chosen screen in the URL', () => {
    render(<Lab archive={archive} />);
    fireEvent.click(screen.getByRole('button', { name: /Registra un gesto/ }));
    expect(window.location.search).toBe('?vista=registra');
  });

  it('stops the camera on the home', () => {
    render(<Lab archive={null} />);
    expect(hook.stopLive).toHaveBeenCalled();
  });

  it('falls back to the home for an unknown or forbidden screen', () => {
    nav.search = '?vista=boh';
    render(<Lab archive={archive} />);
    expect(screen.getByText('Cosa vuoi fare?')).toBeTruthy();
    cleanup();
    nav.search = '?vista=registra';
    render(<Lab archive={null} />);
    expect(screen.getByText('Cosa vuoi fare?')).toBeTruthy();
  });
});

describe('gesture lab try screen', () => {
  it('starts the camera and shows the hand and the stage, nothing technical', () => {
    nav.search = '?vista=prova';
    const { container } = render(<Lab archive={null} />);
    expect(hook.startLive).toHaveBeenCalledTimes(1);
    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Avvia fotocamera' })).toBeTruthy();
    expect(screen.queryByText('Taratura')).toBeNull();
    expect(screen.queryByText(/FOCUS_NEXT/)).toBeNull();
  });

  it('opens the advanced panel from the gear, with the technical sections', () => {
    nav.search = '?vista=prova';
    render(<Lab archive={archive} />);
    fireEvent.click(screen.getByRole('button', { name: 'Avanzate' }));
    const panel = screen.getByRole('complementary', { name: 'Avanzate' });
    expect(within(panel).getByText('Taratura')).toBeTruthy();
    expect(within(panel).getByText('Preset')).toBeTruthy();
  });

  it('goes back to the home', () => {
    nav.search = '?vista=prova';
    render(<Lab archive={null} />);
    fireEvent.click(screen.getByRole('button', { name: '‹ Indietro' }));
    expect(window.location.search).toBe('');
  });
});

describe('gesture lab other screens', () => {
  it('starts the recording from the gesture choice', () => {
    nav.search = '?vista=registra';
    render(<Lab archive={archive} />);
    expect(screen.getByRole('heading', { name: 'Quale gesto registri?' })).toBeTruthy();
  });

  it('opens the replay list and stops the camera', () => {
    nav.search = '?vista=rigioca';
    render(<Lab archive={archive} />);
    expect(screen.getByRole('heading', { name: 'Rigioca' })).toBeTruthy();
    expect(hook.stopLive).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/gesture-lab-layout.test.tsx`
Expected: FAIL: non c'è «Cosa vuoi fare?» (la pagina è ancora quella vecchia).

- [ ] **Step 3: Implementare**

In `use-gesture-lab.ts:53`:

```ts
const [fired, setFired] = useState<GestureEvent['type'][]>([]);
```

`home-screen.tsx`:

```tsx
import type { LabView } from '@/lib/gesture-lab/lab-view';

const CHOICES = [
  { view: 'prova', title: 'Prova le gesture', hint: 'Fotocamera e palco.', archive: false },
  {
    view: 'registra',
    title: 'Registra un gesto',
    hint: 'Guidato, un passo alla volta.',
    archive: true,
  },
  { view: 'rigioca', title: "Rigioca dall'archivio", hint: 'Anche senza webcam.', archive: true },
] as const satisfies readonly { view: LabView; title: string; hint: string; archive: boolean }[];

// La pagina iniziale: tre scelte grandi, impilate su telefono e affiancate su schermo largo.
export function HomeScreen({
  canArchive,
  onGo,
}: {
  canArchive: boolean;
  onGo: (view: LabView) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4">
      <h1 className="text-2xl font-extrabold">Laboratorio gesture</h1>
      <p className="text-muted">Cosa vuoi fare?</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CHOICES.filter((c) => canArchive || !c.archive).map((c) => (
          <button
            key={c.view}
            type="button"
            onClick={() => onGo(c.view)}
            className="flex min-h-24 flex-col items-start gap-1 rounded-panel border border-line bg-surface p-4 text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-lg font-extrabold">{c.title}</span>
            <span className="text-sm text-muted">{c.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

`try-screen.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button } from '@omnicanvas/ui';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { LIVE_MESSAGES } from './lab-messages';
import { ScreenHeader } from './screen-header';

type Props = {
  scene: ReactNode;
  live: LiveStatus;
  armed: boolean;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
  onAdvanced: () => void;
};

export function TryScreen({ scene, live, armed, onStart, onStop, onBack, onAdvanced }: Props) {
  const message = LIVE_MESSAGES[live];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader title="Prova le gesture" onBack={onBack} onAdvanced={onAdvanced} />
      <div className="flex min-h-0 flex-1 flex-col">{scene}</div>
      {message && <p className="shrink-0 text-sm text-muted">{message}</p>}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {live === 'on' ? (
          <Button onClick={onStop}>Ferma fotocamera</Button>
        ) : (
          <Button variant="accent" disabled={live === 'loading'} onClick={onStart}>
            Avvia fotocamera
          </Button>
        )}
        <span className="text-sm text-muted">{armed ? 'Gesture attive' : 'Gesture in pausa'}</span>
      </div>
    </div>
  );
}
```

`lab-scene.tsx` (le classi seguono la tabella della spec §2; `max-lg:landscape:` è il
telefono orizzontale, così non si scontra con le regole del computer):

```tsx
import type { ReactNode } from 'react';

type Props = {
  areaRef: React.RefObject<HTMLDivElement | null>;
  hand: ReactNode;
  stage: ReactNode;
};

// Mano e palco secondo lo schermo (spec §2): telefono verticale mano sopra e palco sotto,
// telefono orizzontale affiancati, computer palco grande sopra e mano sotto.
export function LabScene({ areaRef, hand, stage }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 max-lg:landscape:flex-row">
      <div className="flex h-[38dvh] shrink-0 justify-center max-lg:landscape:h-auto max-lg:landscape:w-1/2 lg:order-2 lg:h-[35%]">
        {hand}
      </div>
      <div
        ref={areaRef}
        className="relative flex min-h-[200px] flex-1 flex-col overflow-hidden lg:order-1"
      >
        {stage}
      </div>
    </div>
  );
}
```

`lab.tsx`, riscritto:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cx } from '@omnicanvas/ui';
import type { Frame } from '@omnicanvas/gesture';
import { StageBoard } from '@/app/room/[code]/stage-board';
import type { LabArchive, RecordingSummary } from '@/lib/gesture-lab/lab-store';
import { useLabView } from '@/lib/gesture-lab/lab-view';
import { effectiveTuning } from '@/lib/gesture-lab/settings';
import { useGestureLab } from '@/lib/gesture-lab/use-gesture-lab';
import { AdvancedPanel } from './advanced-panel';
import { Diagnostics } from './diagnostics';
import { HandView } from './hand-view';
import { HomeScreen } from './home-screen';
import { LabScene } from './lab-scene';
import { PresetSection } from './preset-panel';
import { RecordWizard } from './record-wizard';
import { ReplayScreen } from './replay-screen';
import { TryScreen } from './try-screen';

// Solo nel browser: le impostazioni vengono da localStorage, il server non le conosce.
const subscribe = () => () => {};
export function Lab({ archive }: { archive: LabArchive | null }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? <LabClient archive={archive} /> : null;
}

function LabClient({ archive }: { archive: LabArchive | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<{ raw: Frame; processed: Frame } | null>(null);
  const lab = useGestureLab({ videoRef, areaRef, framesRef });
  const { view, id, go } = useLabView(archive !== null);
  // Registrazioni e preset vivono qui: restano cambiando schermata o chiudendo Avanzate.
  const [recordings, setRecordings] = useState<RecordingSummary[]>(archive?.recordings ?? []);
  const [presets, setPresets] = useState(archive?.presets ?? []);
  const [advanced, setAdvanced] = useState(false);
  const [screenScene, setScreenScene] = useState(false);
  const sceneVisible = view === 'prova' || screenScene;
  const showAdvanced = advanced && sceneVisible;

  // La fotocamera segue la schermata: parte entrando in Prova, si ferma tornando alla pagina
  // iniziale o aprendo Rigioca; Registra la accende da sé al passo 2. Il rigioco si ferma
  // sempre cambiando schermata. Si legge il hook da un ref: l'effetto dipende solo dalla vista.
  const labRef = useRef(lab);
  useEffect(() => {
    labRef.current = lab;
  });
  useEffect(() => {
    const current = labRef.current;
    current.pause();
    if (view === 'prova') {
      if (current.live === 'off') void current.startLive();
    } else if (view !== 'registra') {
      current.stopLive();
    }
  }, [view]);

  const removeRecording = useCallback(
    (recordingId: string) => setRecordings((list) => list.filter((r) => r.id !== recordingId)),
    [],
  );
  const addRecording = useCallback(
    (summary: RecordingSummary) => setRecordings((list) => [summary, ...list]),
    [],
  );
  const openAdvanced = useCallback(() => setAdvanced(true), []);
  const toHome = useCallback(() => go('home'), [go]);
  const toList = useCallback(() => go('rigioca'), [go]);
  const openRecording = useCallback((recordingId: string) => go('rigioca', recordingId), [go]);

  const scene = (
    <LabScene
      areaRef={areaRef}
      hand={
        <HandView
          videoRef={videoRef}
          framesRef={framesRef}
          view={lab.view}
          lastEvent={lab.fired.at(-1) ?? null}
          feedback={lab.settings.toggles.feedback}
          idle={lab.live !== 'on' && !lab.playing}
          replaying={lab.playing}
        />
      }
      stage={<StageBoard stage={lab.stage} assetUrls={{}} dispatch={lab.dispatch} />}
    />
  );

  return (
    <main
      className={cx(
        'flex h-dvh flex-col gap-3 overflow-hidden bg-bg p-4 text-fg',
        showAdvanced && 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)]',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {view === 'home' && <HomeScreen canArchive={archive !== null} onGo={go} />}
        {view === 'prova' && (
          <TryScreen
            scene={scene}
            live={lab.live}
            armed={lab.armed}
            onStart={() => void lab.startLive()}
            onStop={lab.stopLive}
            onBack={toHome}
            onAdvanced={openAdvanced}
          />
        )}
        {view === 'registra' && archive && (
          <RecordWizard
            live={lab.live}
            hand={lab.hand}
            settings={lab.settings}
            scene={scene}
            capture={lab.capture}
            onStartCamera={() => void lab.startLive()}
            onRecorded={lab.loadRecording}
            onReview={lab.play}
            onSaved={addRecording}
            onScene={setScreenScene}
            onAdvanced={openAdvanced}
            onExit={toHome}
          />
        )}
        {view === 'rigioca' && archive && (
          <ReplayScreen
            userId={archive.userId}
            recordings={recordings}
            onRemoved={removeRecording}
            id={id}
            scene={scene}
            settings={lab.settings}
            recording={lab.recording}
            playing={lab.playing}
            progress={lab.progress}
            onLoad={lab.loadRecording}
            onPlay={lab.play}
            onPause={lab.pause}
            onOpen={openRecording}
            onList={toList}
            onExit={toHome}
            onScene={setScreenScene}
            onAdvanced={openAdvanced}
          />
        )}
      </div>
      <AdvancedPanel
        open={showAdvanced}
        onClose={() => setAdvanced(false)}
        settings={lab.settings}
        onChange={lab.setSettings}
        diagnostics={
          <Diagnostics
            view={lab.view}
            hand={lab.hand}
            tuning={effectiveTuning(lab.settings)}
            log={lab.log}
          />
        }
        presets={
          archive ? (
            <PresetSection
              userId={archive.userId}
              presets={presets}
              onPresetsChange={setPresets}
              settings={lab.settings}
              onApply={lab.setSettings}
            />
          ) : null
        }
      />
      {lab.cursor && (
        <div
          aria-hidden
          style={{ left: lab.cursor.x, top: lab.cursor.y }}
          className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
            lab.cursor.grabbing ? 'h-8 w-8 border-accent bg-accent/30' : 'h-5 w-5 border-fg'
          }`}
        />
      )}
    </main>
  );
}
```

Poi:

- in `lab-controls.tsx` eliminare `LabControls` e l'import di `Button` e `DEFAULT_LAB_SETTINGS`
  se non servono più;
- in `preset-panel.tsx` eliminare `<h2 …>Preset</h2>`;
- eliminare i sei file e i tre test elencati sopra, e il blocco `ReplayPanel` in
  `gesture-lab-ui.test.tsx` (con il suo import).

```bash
git rm apps/web/src/app/dev/gesture-lab/lab-tabs.tsx apps/web/src/app/dev/gesture-lab/server-panels.tsx apps/web/src/app/dev/gesture-lab/record-panel.tsx apps/web/src/app/dev/gesture-lab/archive-panel.tsx apps/web/src/app/dev/gesture-lab/replay-panel.tsx apps/web/src/app/dev/gesture-lab/hand-panel.tsx tests/unit/gesture-lab-server-panels.test.tsx tests/unit/gesture-lab-record.test.tsx tests/unit/gesture-lab-hand.test.tsx
```

- [ ] **Step 4: Verificare che passi tutto**

Run: `npx vitest run tests/unit/gesture-lab-layout.test.tsx`
Expected: PASS, 10 test.

Run: `npm run typecheck && npm run lint && npx vitest run tests/unit`
Expected: tutto verde. Se `grep -rn "lab-tabs\|server-panels\|record-panel\|archive-panel\|replay-panel\|hand-panel" apps tests --include=*.ts --include=*.tsx`
trova ancora qualcosa, toglierlo.

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/web/src/app/dev/gesture-lab apps/web/src/lib/gesture-lab/use-gesture-lab.ts tests/unit/gesture-lab-layout.test.tsx tests/unit/gesture-lab-ui.test.tsx
git add -A apps/web/src/app/dev/gesture-lab apps/web/src/lib/gesture-lab/use-gesture-lab.ts tests/unit
git commit -m "feat(gesture-lab): simple home with one screen at a time, old panels removed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Documentazione, verifica completa, staging

**Files:**

- Modify: `docs/GESTURE-LAB.md`
- Modify: `CLAUDE.md` (sezione «Stato attuale»)

- [ ] **Step 1: Aggiornare `docs/GESTURE-LAB.md`**

Aggiungere la spec nuova all'elenco in testa e una sezione «Come si usa» dopo «Dove si apre»:

```markdown
## Come si usa

La pagina iniziale offre tre scelte; ognuna ha il suo indirizzo, quindi il tasto indietro
del telefono torna alla scelta prima.

- **Prova le gesture** (`?vista=prova`): fotocamera, mano col nome del gesto riconosciuto,
  palco con due finestre.
- **Registra un gesto** (`?vista=registra`, solo admin): si sceglie il gesto, ci si mette in
  posizione, 3-2-1 e 4 secondi di registrazione, poi l'esito. Il nome si compone da solo; la
  nota è facoltativa.
- **Rigioca dall'archivio** (`?vista=rigioca`, solo admin): elenco filtrabile per gesto;
  aprendo una registrazione l'esito si legge subito, «Rigioca» la riproduce sul palco. Il link
  `?vista=rigioca&id=…` apre direttamente quella registrazione: si può mandare a un altro
  admin.

Il tecnico (taratura, correzioni, dizionario, preset, diagnostica, «Copia come codice») sta
in **Avanzate**, col ⚙ in Prova, al passo «Mettiti in posizione» e nel rigioco. Su telefono
verticale sale dal basso: toccare la maniglia lo porta a schermo intero e indietro.
```

Le frasi «Con login di un admin compaiono Registra, Archivio e Preset» diventano «Con login
di un admin compaiono Registra, Rigioca e, in Avanzate, i Preset».

- [ ] **Step 2: Aggiornare `CLAUDE.md`**

Nella sezione «Stato attuale», dopo la frase su `slice/gesture-lab-staging`, aggiungere:

```markdown
Redesign del laboratorio (spec `docs/specs/2026-10-06-gesture-lab-redesign-design.md`, piano
`docs/plans/2026-10-07-gesture-lab-redesign.md`): pagina iniziale con Prova, Registra a passi
e Rigioca, tecnico in «Avanzate», usabile da telefono.
```

- [ ] **Step 3: Verifica completa**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm test`
Run: `npm run build`
Expected: tutto verde. I test in `tests/db` richiedono Supabase locale: se in questa
macchina non gira (Docker spento), dirlo nel rapporto e affidarsi alla CI (`db`).

- [ ] **Step 4: Commit**

```bash
git add docs/GESTURE-LAB.md CLAUDE.md
git commit -m "docs(gesture-lab): how the simple lab works, project status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Deploy su staging e verifica a mano**

```bash
npx vercel deploy --yes
npx vercel alias set <url-del-deploy> omnicanvas-staging.vercel.app
```

Checklist su `https://omnicanvas-staging.vercel.app/dev/gesture-lab` (login admin prima):

- Computer 1920x1080: pagina iniziale con tre scelte affiancate; Prova con palco grande
  sopra e mano sotto; ⚙ apre la colonna a destra di 320 px e il palco si stringe; chiusa, il
  palco torna largo; nessuno scroll di pagina.
- iPhone verticale: tre scelte impilate; Prova con mano sopra e palco sotto; Avanzate sale
  a metà, toccare la maniglia porta a schermo intero e indietro; bottoni comodi col pollice;
  la barra di Safari non copre i comandi.
- iPhone orizzontale: mano a sinistra, palco a destra; Avanzate entra da destra sopra il
  palco.
- Registra dal telefono (Lorenzo): pollice su → «✓ Riconosciuto» → salva → compare in
  Rigioca col nome «Pollice su».
- Rigioca senza webcam (Sean): apre la registrazione, l'esito si legge prima di premere
  «Rigioca»; tasto indietro torna all'elenco.

Riportare nel rapporto finale l'esito di ogni voce; quello che non si è potuto provare va
scritto come non provato.

---

## Copertura della spec

| Spec                                                                                                                       | Task                          |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| §1.1 pagina iniziale, solo «Prova» senza archivio                                                                          | 9                             |
| §1.2 Prova, fotocamera in entrata, palco a due finestre, messaggi                                                          | 3, 4, 9                       |
| §1.3 Registra a quattro passi, gesto nuovo col nome, esito, nota, Salva/Rivedi/Rifai, «Registra un altro», zero fotogrammi | 7                             |
| §1.4 Rigioca: elenco con filtro, file JSON, rigioco con esito, avanzamento, menu ⋯                                         | 8                             |
| §1.5 Avanzate: dove si apre, sezioni chiuse, Copia come codice, Ripristina                                                 | 5, 6, 9                       |
| §2 disposizione per schermo, 44 px, `dvh`, maniglia col click                                                              | 5, 9, 10                      |
| §3.1 struttura dei file, vecchi pannelli eliminati                                                                         | 4-9                           |
| §3.2 navigazione con `pushState`, vista sconosciuta o non permessa                                                         | 3, 9                          |
| §3.3 fotocamera per schermata                                                                                              | 7, 9                          |
| §3.4 catalogo, `label` e `description`                                                                                     | 1, 7                          |
| §3.5 `evaluateRecording`                                                                                                   | 2, 7, 8                       |
| §4 test                                                                                                                    | tutti; verifica a mano nel 10 |
