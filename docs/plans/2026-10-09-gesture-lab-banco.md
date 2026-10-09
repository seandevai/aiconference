# Banco di prova e mano al centro sul telefono — piano di implementazione

> **Per gli agenti:** SOTTO-SKILL OBBLIGATORIA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, task per task. I passi usano le caselle
> (`- [ ]`) per tenere traccia.

**Obiettivo:** su PC una quarta schermata «Banco di prova» con scheletro dal vivo e numeri in tre
riquadri (anche in Registra); sul telefono la mano a tutto spazio in Prova, Registra e Rigioca,
col palco a richiesta; scheletro sempre acceso.

**Architettura:** una sola pagina client (`lab.tsx`) con un solo `useGestureLab`, come oggi.
`LabScene` riceve una variante (`stage` | `bench`) e lo stato «palco aperto» dal genitore; PC e
telefono li distingue il CSS (`lg`). Un nuovo `BenchPanel` sostituisce `Diagnostics` e serve sia
al banco sia ad «Avanzate». La vista `banco` entra in `lab-view.ts`; solo il ritorno alla pagina
iniziale dal telefono usa `matchMedia`.

**Stack:** Next.js 16 (App Router), React 19, Tailwind 4 (breakpoint predefiniti: `lg` = 64rem),
Vitest + Testing Library (happy-dom), `@omnicanvas/gesture`, `@omnicanvas/ui`.

**Spec:** `docs/specs/2026-10-09-gesture-lab-banco-design.md`. Leggere spec e piano. Mockup in
`.superpowers/brainstorm/24238-1791534810/content/` (fuori da git).

**Branch:** `slice/gesture-lab-banco` (la spec è già il primo commit).

## Vincoli globali

- La call non cambia: niente modifiche a `apps/web/src/app/room/`, `packages/gesture`,
  `packages/canvas`, `apps/web/src/lib/stage/stage-gesture-handler.ts`.
- Server, tabelle, migrazioni e `actions.ts` del laboratorio non cambiano.
- Regola 1: si salvano solo i punti della mano; nessun video, nessuna immagine.
- Regola 5: test prima del codice, visti rossi e poi verdi.
- Regola 6: il bottone del palco è il click equivalente del guardare l'effetto del gesto.
- Bottoni alti almeno 44 px (`Button` `size="md"` di default, oppure `min-h-11`).
- Testi dell'interfaccia e commenti in italiano; codice, commit ed errori tecnici in inglese.
- Prima di ogni commit: `npx prettier --write` sui file toccati; `npm run typecheck` e
  `npm run lint` verdi.
- I test si lanciano con `npx vitest run <file>`; quelli in `tests/db` richiedono Supabase
  locale e qui non servono.

## Review Focus

- **Impostazioni salvate prima di oggi** (`localStorage` `gesture-lab:v1` e preset sul server con
  `toggles.feedback`): devono caricarsi senza errori e senza perdere gli altri interruttori →
  test in Task 1.
- **Valori delle dita fuori scala** (`fingerRatio` può superare 1): la barra si ferma al bordo,
  il numero resta scritto → test in Task 2.
- **`?vista=banco` aperto dal telefono** (link condiviso o tasto indietro): si torna alla pagina
  iniziale, non a una schermata senza palco né numeri → test in Task 4.
- **Palco nascosto mentre le gesture agiscono:** il palco resta montato, quindi aprendolo si vede
  l'effetto; il cursore non deve comparire in un angolo quando il palco non si vede → test in
  Task 3 (palco montato) e Task 4 (cursore).
- **Cambio di schermata col palco aperto sul telefono:** la nuova schermata riparte con la mano
  → test in Task 4.

---

### Task 1: scheletro sempre acceso

**Files:**
- Modify: `apps/web/src/lib/gesture-lab/settings.ts:14-23,50-62`
- Modify: `apps/web/src/app/dev/gesture-lab/lab-controls.tsx:53-58`
- Modify: `apps/web/src/app/dev/gesture-lab/hand-view.tsx`
- Modify: `apps/web/src/app/dev/gesture-lab/lab.tsx:83`
- Test: `tests/unit/gesture-lab-settings.test.ts`, `tests/unit/gesture-lab-hand-view.test.tsx`,
  `tests/unit/gesture-lab-advanced.test.tsx:7-10`, `tests/unit/gesture-lab-presets.test.tsx:16-19`

**Interfaces:**
- Produces: `LabToggles = { smoothCursor: boolean; stablePoses: boolean }`; `HandView` senza
  la prop `feedback`.

- [ ] **Step 1: aggiornare i test delle impostazioni**

In `tests/unit/gesture-lab-settings.test.ts`:

```ts
// 'starts from today defaults, with every correction off'
expect(DEFAULT_LAB_SETTINGS.toggles).toEqual({ smoothCursor: false, stablePoses: false });

// 'round-trips through storage'
toggles: { smoothCursor: true, stablePoses: false },
```

e sostituire il blocco `describe('parseLabSettings', …)` con:

```ts
describe('parseLabSettings', () => {
  it('falls back to the defaults for anything it does not understand', () => {
    expect(parseLabSettings(null)).toEqual(DEFAULT_LAB_SETTINGS);
    expect(parseLabSettings({ toggles: { smoothCursor: 'yes' } })).toEqual(DEFAULT_LAB_SETTINGS);
  });

  it('keeps valid toggles', () => {
    const settings = parseLabSettings({ toggles: { smoothCursor: true } });
    expect(settings.toggles.smoothCursor).toBe(true);
  });

  // Impostazioni salvate prima del 09/10: lo scheletro ora è sempre acceso.
  it('ignores the old feedback toggle and keeps the others', () => {
    const settings = parseLabSettings({
      toggles: { feedback: true, smoothCursor: true, stablePoses: true },
    });
    expect(settings.toggles).toEqual({ smoothCursor: true, stablePoses: true });
  });
});
```

In `tests/unit/gesture-lab-advanced.test.tsx` e `tests/unit/gesture-lab-presets.test.tsx`
sostituire `feedback: true` con `smoothCursor: true` (servono solo impostazioni diverse dai
predefiniti).

- [ ] **Step 2: aggiornare i test di `HandView`**

In `tests/unit/gesture-lab-hand-view.test.tsx`: togliere `feedback={false}` da `renderHand`,
togliere `feedback: true` dal test dell'anello e rinominarlo
`'shows the hold ring with the gesture name'`, rinominare
`'draws the hand during a replay even with feedback off, and says there is no video'` in
`'draws the hand during a replay and says there is no video'`, e sostituire l'ultimo test con:

```ts
  it('draws the live hand without any toggle', () => {
    renderHand();
    expect(drawing.drawHands).toHaveBeenCalled();
  });
```

- [ ] **Step 3: vederli rossi**

Run: `npx vitest run tests/unit/gesture-lab-settings.test.ts tests/unit/gesture-lab-hand-view.test.tsx`
Expected: FAIL (`toggles` ha ancora `feedback`; `drawHands` non chiamato senza `feedback`).

- [ ] **Step 4: implementare**

`settings.ts`:

```ts
export type LabToggles = { smoothCursor: boolean; stablePoses: boolean };
```

```ts
  toggles: { smoothCursor: false, stablePoses: false },
```

e in `parseLabSettings` togliere la riga `feedback: bool(toggles.feedback, d.feedback),`
(un `feedback` salvato viene semplicemente ignorato).

`lab-controls.tsx`: togliere il `<Toggle label="Riscontro durante il gesto" … />`.

`hand-view.tsx`: togliere `feedback` da `Props` e dalla firma; il disegno è sempre attivo e
l'anello dipende solo da `view.hold`:

```tsx
  useEffect(() => {
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
  }, [framesRef]);
```

```tsx
  const holding = view?.hold ? gestureForHold(view.hold.pose) : null;
```

Aggiornare il commento sulla prop `replaying` («Nel rigioco non c'è video: lo dice
l'etichetta.») e togliere la variabile `drawing`.

`lab.tsx`: togliere `feedback={lab.settings.toggles.feedback}`. Nel commento di
`use-gesture-lab.ts:81` sostituire «(cursore fluido, feedback)» con «(cursore fluido)».

- [ ] **Step 5: vederli verdi**

Run: `npx vitest run tests/unit/gesture-lab-settings.test.ts tests/unit/gesture-lab-hand-view.test.tsx tests/unit/gesture-lab-advanced.test.tsx tests/unit/gesture-lab-presets.test.tsx`
Expected: PASS. Poi `npm run typecheck` (nessun altro uso di `toggles.feedback`).

- [ ] **Step 6: commit**

```bash
git add apps/web/src/lib/gesture-lab/settings.ts apps/web/src/lib/gesture-lab/use-gesture-lab.ts apps/web/src/app/dev/gesture-lab/lab-controls.tsx apps/web/src/app/dev/gesture-lab/hand-view.tsx apps/web/src/app/dev/gesture-lab/lab.tsx tests/unit/gesture-lab-settings.test.ts tests/unit/gesture-lab-hand-view.test.tsx tests/unit/gesture-lab-advanced.test.tsx tests/unit/gesture-lab-presets.test.tsx
git commit -m "feat(gesture-lab): hand skeleton always on, drop the feedback toggle"
```

---

### Task 2: `BenchPanel`, i tre riquadri

**Files:**
- Create: `apps/web/src/app/dev/gesture-lab/bench-panel.tsx`
- Delete: `apps/web/src/app/dev/gesture-lab/diagnostics.tsx`
- Modify: `apps/web/src/app/dev/gesture-lab/lab.tsx` (import e uso in `AdvancedPanel`)
- Test: `tests/unit/gesture-lab-bench-panel.test.tsx` (nuovo); togliere il blocco
  `describe('Diagnostics', …)` e il suo import da `tests/unit/gesture-lab-hand-view.test.tsx`

**Interfaces:**
- Consumes: `poseMetrics(hand)` e `type Tuning`, `type RecognizerView`, `type Hand` da
  `@omnicanvas/gesture`; `type LogEntry` da `@/lib/gesture-lab/event-log`; `EventList`.
- Produces:
  ```ts
  export function BenchPanel(props: {
    view: RecognizerView | null;
    hand: Hand | null;
    tuning: Tuning;
    log: LogEntry[];
    stacked?: boolean; // true in «Avanzate»: riquadri sempre uno sotto l'altro
  }): JSX.Element
  ```
  Ogni barra è un `div` con `role="meter"`, `aria-label` (nome), `aria-valuemin={0}`,
  `aria-valuemax={1}`, `aria-valuenow` (valore vero, non tagliato), una parte piena con
  `data-fill` e `style.width` in percentuale tagliata fra 0 e 100, e una tacca per soglia con
  `data-mark` e `style.left` in percentuale.

- [ ] **Step 1: scrivere il test**

`tests/unit/gesture-lab-bench-panel.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, poseMetrics, type RecognizerView } from '@omnicanvas/gesture';
import { BenchPanel } from '@/app/dev/gesture-lab/bench-panel';
import { hand } from '../fixtures/hands';

const view = (over: Partial<RecognizerView> = {}): RecognizerView => ({
  rawPose: 'fist',
  pose: 'thumb_up',
  hold: { pose: 'thumb_up', progress: 0.5 },
  armed: true,
  cooldownLeftMs: 120,
  dragging: false,
  ...over,
});

const pct = (n: number) => `${Math.min(100, Math.max(0, n * 100))}%`;

afterEach(cleanup);

describe('BenchPanel', () => {
  it('shows the pose tile: raw and stable pose, hold, pause', () => {
    render(<BenchPanel view={view()} hand={hand('thumb_up')} tuning={DEFAULT_TUNING} log={[]} />);
    const tile = screen.getByRole('region', { name: 'Posa' });
    expect(within(tile).getByText('fist')).toBeTruthy();
    expect(within(tile).getByText('thumb_up')).toBeTruthy();
    expect(within(tile).getByText('armato')).toBeTruthy();
    expect(within(tile).getByText('120 ms')).toBeTruthy();
    const holdMeter = within(tile).getByRole('meter', { name: 'Hold' });
    expect(holdMeter.getAttribute('aria-valuenow')).toBe('0.5');
    expect((holdMeter.querySelector('[data-fill]') as HTMLElement).style.width).toBe('50%');
  });

  it('shows each finger against the folded and extended thresholds', () => {
    const h = hand('thumb_up');
    const metrics = poseMetrics(h);
    render(<BenchPanel view={view()} hand={h} tuning={DEFAULT_TUNING} log={[]} />);
    const tile = screen.getByRole('region', { name: 'Dita' });
    const index = within(tile).getByRole('meter', { name: 'Indice' });
    expect(Number(index.getAttribute('aria-valuenow'))).toBeCloseTo(metrics.fingers.index, 5);
    const marks = [...index.querySelectorAll('[data-mark]')].map(
      (m) => (m as HTMLElement).style.left,
    );
    expect(marks).toEqual([pct(DEFAULT_TUNING.pose.folded), pct(DEFAULT_TUNING.pose.extended)]);
    const pinch = within(tile).getByRole('meter', { name: 'Pinch' });
    expect((pinch.querySelector('[data-mark]') as HTMLElement).style.left).toBe(
      pct(DEFAULT_TUNING.pose.pinchOn),
    );
    expect(within(tile).getByText(metrics.thumbExtended ? 'esteso' : 'chiuso')).toBeTruthy();
  });

  it('stops an out-of-scale bar at the edge and still writes the number', () => {
    const h = hand('open_palm');
    // Dito più lungo del normale: il rapporto supera 1.
    const stretched = {
      landmarks: h.landmarks.map((p, i) => (i === 8 ? { ...p, y: p.y - 0.5 } : p)),
    };
    const value = poseMetrics(stretched).fingers.index;
    expect(value).toBeGreaterThan(1);
    render(<BenchPanel view={view()} hand={stretched} tuning={DEFAULT_TUNING} log={[]} />);
    const index = screen.getByRole('meter', { name: 'Indice' });
    expect((index.querySelector('[data-fill]') as HTMLElement).style.width).toBe('100%');
    expect(screen.getByText(value.toFixed(2))).toBeTruthy();
  });

  it('lists the events, most recent first', () => {
    render(
      <BenchPanel
        view={view()}
        hand={hand('thumb_up')}
        tuning={DEFAULT_TUNING}
        log={[
          { t: 2_000, label: 'CONFIRM' },
          { t: 1_000, label: 'FOCUS_NEXT' },
        ]}
      />,
    );
    const items = within(screen.getByRole('region', { name: 'Eventi' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['CONFIRM2.0 s', 'FOCUS_NEXT1.0 s']);
  });

  it('says when no hand is in view and leaves the bars empty', () => {
    render(<BenchPanel view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} />);
    expect(screen.getAllByText('Nessuna mano in vista.').length).toBeGreaterThan(0);
    for (const meter of screen.getAllByRole('meter')) {
      expect((meter.querySelector('[data-fill]') as HTMLElement).style.width).toBe('0%');
    }
  });

  it('lays the tiles in three columns on a wide screen, stacked in «Avanzate»', () => {
    const { container, rerender } = render(
      <BenchPanel view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} />,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('lg:grid-cols-3');
    rerender(<BenchPanel view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} stacked />);
    expect((container.firstElementChild as HTMLElement).className).not.toContain('lg:grid-cols-3');
  });
});
```

Se il dito allungato del terzo test non supera 1 con la fixture, aumentare lo spostamento
(`- 0.8`) finché `expect(value).toBeGreaterThan(1)` passa: quell'asserzione protegge il test.

- [ ] **Step 2: vederlo rosso**

Run: `npx vitest run tests/unit/gesture-lab-bench-panel.test.tsx`
Expected: FAIL («Failed to resolve import "@/app/dev/gesture-lab/bench-panel"»).

- [ ] **Step 3: implementare `bench-panel.tsx`**

```tsx
import type { ReactNode } from 'react';
import { cx } from '@omnicanvas/ui';
import { poseMetrics, type Hand, type RecognizerView, type Tuning } from '@omnicanvas/gesture';
import type { LogEntry } from '@/lib/gesture-lab/event-log';
import { EventList } from './event-list';

const FINGER_LABELS = {
  index: 'Indice',
  middle: 'Medio',
  ring: 'Anulare',
  pinky: 'Mignolo',
} as const;

const NO_HAND = 'Nessuna mano in vista.';

const percent = (value: number) => `${Math.min(100, Math.max(0, value * 100))}%`;

type Props = {
  view: RecognizerView | null;
  hand: Hand | null;
  tuning: Tuning;
  log: LogEntry[];
  // In «Avanzate» la colonna è stretta: i riquadri stanno sempre uno sotto l'altro.
  stacked?: boolean;
};

// Una barra da 0 a 1 con le soglie segnate. Un valore fuori scala si ferma al bordo, il numero
// resta scritto: è quello che serve a tarare.
function Meter({ label, value, marks }: { label: string; value: number | null; marks: number[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums">{value === null ? '–' : value.toFixed(2)}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value ?? 0}
        className="relative h-2 rounded-full bg-line"
      >
        <div
          data-fill
          style={{ width: percent(value ?? 0) }}
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
        />
        {marks.map((mark) => (
          <span
            key={mark}
            data-mark
            style={{ left: percent(mark) }}
            className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 bg-fg"
          />
        ))}
      </div>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-tile border border-line bg-surface p-3"
    >
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  );
}

// Il banco di prova: posa, dita ed eventi dal vivo, gli stessi numeri che il riconoscitore usa.
export function BenchPanel({ view, hand, tuning, log, stacked = false }: Props) {
  const metrics = hand ? poseMetrics(hand) : null;
  return (
    <div className={cx('grid min-h-0 gap-3 text-xs text-fg', !stacked && 'lg:grid-cols-3')}>
      <Tile title="Posa">
        <h3 className="text-sm font-semibold text-muted">Posa</h3>
        {view ? (
          <>
            <Row label="Grezza">{view.rawPose}</Row>
            <Row label="Stabile">{view.pose}</Row>
            <Row label="Stato">{view.armed ? 'armato' : 'in pausa'}</Row>
            <Row label="Pausa">{`${Math.round(view.cooldownLeftMs)} ms`}</Row>
            {view.dragging && <Row label="Trascinamento">in corso</Row>}
          </>
        ) : (
          <p className="text-muted">{NO_HAND}</p>
        )}
        <Meter label="Hold" value={view?.hold ? view.hold.progress : null} marks={[]} />
      </Tile>
      <Tile title="Dita">
        <h3 className="text-sm font-semibold text-muted">Dita</h3>
        {!metrics && <p className="text-muted">{NO_HAND}</p>}
        {(Object.keys(FINGER_LABELS) as (keyof typeof FINGER_LABELS)[]).map((finger) => (
          <Meter
            key={finger}
            label={FINGER_LABELS[finger]}
            value={metrics ? metrics.fingers[finger] : null}
            marks={[tuning.pose.folded, tuning.pose.extended]}
          />
        ))}
        <Meter label="Pinch" value={metrics ? metrics.pinch : null} marks={[tuning.pose.pinchOn]} />
        {metrics && <Row label="Pollice">{metrics.thumbExtended ? 'esteso' : 'chiuso'}</Row>}
      </Tile>
      <Tile title="Eventi">
        <EventList entries={log} />
      </Tile>
    </div>
  );
}
```

`EventList` ha già il suo titolo «Eventi» (`h2`): nel riquadro Eventi non si aggiunge un `h3`.

- [ ] **Step 4: usare `BenchPanel` in «Avanzate» e togliere `Diagnostics`**

In `lab.tsx` sostituire l'import di `Diagnostics` con
`import { BenchPanel } from './bench-panel';` e il valore di `diagnostics`:

```tsx
        diagnostics={
          <BenchPanel
            view={lab.view}
            hand={lab.hand}
            tuning={effectiveTuning(lab.settings)}
            log={lab.log}
            stacked
          />
        }
```

Cancellare `apps/web/src/app/dev/gesture-lab/diagnostics.tsx` e, in
`tests/unit/gesture-lab-hand-view.test.tsx`, la riga
`const { Diagnostics } = await import('@/app/dev/gesture-lab/diagnostics');`, il blocco
`describe('Diagnostics', …)` e gli import rimasti inutilizzati (`DEFAULT_TUNING`, `hand` se non
usati altrove nel file).

- [ ] **Step 5: vederlo verde**

Run: `npx vitest run tests/unit/gesture-lab-bench-panel.test.tsx tests/unit/gesture-lab-hand-view.test.tsx tests/unit/gesture-lab-layout.test.tsx`
Expected: PASS. Poi `npm run typecheck` e `npm run lint`.

- [ ] **Step 6: commit**

```bash
git add apps/web/src/app/dev/gesture-lab/bench-panel.tsx apps/web/src/app/dev/gesture-lab/diagnostics.tsx apps/web/src/app/dev/gesture-lab/lab.tsx tests/unit/gesture-lab-bench-panel.test.tsx tests/unit/gesture-lab-hand-view.test.tsx
git commit -m "feat(gesture-lab): bench panel with pose, finger and event tiles"
```

---

### Task 3: `LabScene` a due varianti e palco a richiesta sul telefono

**Files:**
- Modify: `apps/web/src/app/dev/gesture-lab/lab-scene.tsx` (riscritto)
- Test: `tests/unit/gesture-lab-scene.test.tsx` (nuovo)

**Interfaces:**
- Produces:
  ```ts
  export type SceneVariant = 'stage' | 'bench';
  // Classi che nascondono il palco dove non si vede: le usa anche il cursore in lab.tsx.
  export function stageHiddenClass(variant: SceneVariant, stageShown: boolean): string;
  export function LabScene(props: {
    areaRef: React.RefObject<HTMLDivElement | null>;
    variant: SceneVariant;
    hand: ReactNode;
    stage: ReactNode;
    panel: ReactNode;          // mostrato solo nella variante bench, da lg in su
    stageShown: boolean;       // solo telefono: palco al posto della mano
    onToggleStage: () => void;
  }): JSX.Element
  ```
  Regole di visibilità (classi Tailwind):
  - mano: `max-lg:hidden` se `stageShown`; su `lg` nella variante `stage` sta sotto (`lg:order-2
    lg:h-[35%]`), nella variante `bench` prende lo spazio (`lg:flex-1`).
  - palco (`ref={areaRef}`): `stageHiddenClass(variant, stageShown)`; resta sempre montato.
  - pannello: solo se `variant === 'bench'`, con `max-lg:hidden`.
  - bottone «Mostra il palco» / «Nascondi il palco»: `lg:hidden`, `aria-pressed={stageShown}`.

- [ ] **Step 1: scrivere il test**

`tests/unit/gesture-lab-scene.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LabScene, stageHiddenClass, type SceneVariant } from '@/app/dev/gesture-lab/lab-scene';

function renderScene(variant: SceneVariant, stageShown = false) {
  const onToggleStage = vi.fn();
  render(
    <LabScene
      areaRef={{ current: null }}
      variant={variant}
      hand={<p>mano</p>}
      stage={<p>palco</p>}
      panel={<p>numeri</p>}
      stageShown={stageShown}
      onToggleStage={onToggleStage}
    />,
  );
  const box = (text: string) => screen.getByText(text).parentElement as HTMLElement;
  return { onToggleStage, box };
}

afterEach(cleanup);

describe('stageHiddenClass', () => {
  it('hides the stage on phones until asked, and always in the bench on a wide screen', () => {
    expect(stageHiddenClass('stage', false)).toBe('max-lg:hidden');
    expect(stageHiddenClass('stage', true)).toBe('');
    expect(stageHiddenClass('bench', false)).toBe('max-lg:hidden lg:hidden');
    expect(stageHiddenClass('bench', true)).toBe('lg:hidden');
  });
});

describe('LabScene', () => {
  it('keeps the stage mounted even while hidden, so gestures still move the windows', () => {
    const { box } = renderScene('stage');
    expect(screen.getByText('palco')).toBeTruthy();
    expect(box('palco').className).toContain('max-lg:hidden');
  });

  it('shows the hand on phones and the stage on request, with a named button', () => {
    const { onToggleStage, box } = renderScene('stage');
    expect(box('mano').className).not.toContain('max-lg:hidden');
    const button = screen.getByRole('button', { name: 'Mostra il palco' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).toContain('lg:hidden');
    fireEvent.click(button);
    expect(onToggleStage).toHaveBeenCalledTimes(1);
  });

  it('swaps hand and stage on phones once the stage is shown', () => {
    const { box } = renderScene('stage', true);
    expect(box('mano').className).toContain('max-lg:hidden');
    expect(box('palco').className).not.toContain('max-lg:hidden');
    expect(screen.getByRole('button', { name: 'Nascondi il palco' })).toBeTruthy();
  });

  it('puts the numbers under the hand in the bench, never on phones', () => {
    const { box } = renderScene('bench');
    expect(box('numeri').className).toContain('max-lg:hidden');
    expect(box('palco').className).toContain('lg:hidden');
  });

  it('has no numbers in the stage variant', () => {
    renderScene('stage');
    expect(screen.queryByText('numeri')).toBeNull();
  });
});
```

- [ ] **Step 2: vederlo rosso**

Run: `npx vitest run tests/unit/gesture-lab-scene.test.tsx`
Expected: FAIL (`stageHiddenClass` non esiste, nessun bottone «Mostra il palco»).

- [ ] **Step 3: implementare `lab-scene.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Button, cx } from '@omnicanvas/ui';

export type SceneVariant = 'stage' | 'bench';

type Props = {
  areaRef: React.RefObject<HTMLDivElement | null>;
  variant: SceneVariant;
  hand: ReactNode;
  stage: ReactNode;
  panel: ReactNode;
  stageShown: boolean;
  onToggleStage: () => void;
};

// Dove il palco non si vede: sul telefono finché non lo si chiede, nel banco su schermo largo.
// Resta montato comunque: finestre e fuoco non si perdono e le gesture continuano ad agire.
export function stageHiddenClass(variant: SceneVariant, stageShown: boolean): string {
  return cx(!stageShown && 'max-lg:hidden', variant === 'bench' && 'lg:hidden');
}

// Mano, palco e numeri secondo lo schermo (spec 09/10). Telefono: la mano a tutto spazio, il
// palco al suo posto a richiesta. Computer: palco grande e mano sotto (stage), oppure mano
// sopra e numeri sotto (bench).
export function LabScene({
  areaRef,
  variant,
  hand,
  stage,
  panel,
  stageShown,
  onToggleStage,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Button
        aria-pressed={stageShown}
        onClick={onToggleStage}
        className="shrink-0 self-start lg:hidden"
      >
        {stageShown ? 'Nascondi il palco' : 'Mostra il palco'}
      </Button>
      <div
        className={cx(
          'flex min-h-0 flex-1 justify-center',
          stageShown && 'max-lg:hidden',
          variant === 'stage' ? 'lg:order-2 lg:h-[35%] lg:flex-none' : 'lg:flex-1',
        )}
      >
        {hand}
      </div>
      <div
        ref={areaRef}
        className={cx(
          'relative flex min-h-[200px] flex-1 flex-col overflow-hidden lg:order-1',
          stageHiddenClass(variant, stageShown),
        )}
      >
        {stage}
      </div>
      {variant === 'bench' && (
        <div className="min-h-0 shrink-0 max-lg:hidden lg:order-3 lg:max-h-[40%]">{panel}</div>
      )}
    </div>
  );
}
```

Nota: `cx` di `@omnicanvas/ui` è `parts.filter(Boolean).join(' ')`: `cx(false, false)` dà `''`, come
vuole il test di `stageHiddenClass`.

- [ ] **Step 4: vederlo verde**

Run: `npx vitest run tests/unit/gesture-lab-scene.test.tsx`
Expected: PASS.

Poi, perché il typecheck resti verde, in `lab.tsx` passare a `LabScene` le prop minime che il
Task 4 sostituirà: `variant="stage"`, `panel={null}`, `stageShown={false}`,
`onToggleStage={() => {}}`. Run: `npm run typecheck` e `npx vitest run tests/unit/gesture-lab-layout.test.tsx`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add apps/web/src/app/dev/gesture-lab/lab-scene.tsx apps/web/src/app/dev/gesture-lab/lab.tsx tests/unit/gesture-lab-scene.test.tsx
git commit -m "feat(gesture-lab): scene variants, hand first on phones with the stage on request"
```

---

### Task 4: la vista «Banco di prova» e il cablaggio in `lab.tsx`

**Files:**
- Modify: `apps/web/src/lib/gesture-lab/lab-view.ts`
- Modify: `apps/web/src/app/dev/gesture-lab/home-screen.tsx`
- Create: `apps/web/src/app/dev/gesture-lab/bench-screen.tsx`
- Modify: `apps/web/src/app/dev/gesture-lab/lab.tsx`
- Modify: `docs/GESTURE-LAB.md`, `docs/BACKLOG.md`, `CLAUDE.md` (stato attuale)
- Test: `tests/unit/gesture-lab-view.test.ts`, `tests/unit/gesture-lab-layout.test.tsx`

**Interfaces:**
- Consumes: `LabScene`, `SceneVariant`, `stageHiddenClass` (Task 3); `BenchPanel` (Task 2).
- Produces: `LabView = 'home' | 'prova' | 'banco' | 'registra' | 'rigioca'`;
  `BenchScreen` con le stesse prop di `TryScreen` meno `armed`
  (`scene`, `live`, `onStart`, `onStop`, `onBack`, `onAdvanced`); costante
  `WIDE_SCREEN_QUERY = '(min-width: 64rem)'` esportata da `lab-view.ts`.

- [ ] **Step 1: test della vista**

In `tests/unit/gesture-lab-view.test.ts` aggiungere a `describe('resolveView', …)`:

```ts
  it('opens the bench without the archive', () => {
    expect(resolveView(params('?vista=banco'), false)).toEqual({ view: 'banco', id: null });
  });
```

e a `describe('viewSearch', …)`:

```ts
  it('writes the bench view', () => {
    expect(viewSearch('banco')).toBe('?vista=banco');
  });
```

- [ ] **Step 2: test della pagina**

In `tests/unit/gesture-lab-layout.test.tsx`:

1. Sotto il mock di `next/navigation` aggiungere un `matchMedia` controllabile:

```ts
const media = vi.hoisted(() => ({ wide: true }));
```

e in `beforeEach`:

```ts
  media.wide = true;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 64rem)' ? media.wide : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
```

con `afterEach(() => { cleanup(); vi.unstubAllGlobals(); });` al posto di `afterEach(cleanup)`.

2. Nel mock di `useGestureLab` rendere `cursor` controllabile: aggiungere
   `const state = vi.hoisted(() => ({ cursor: null as null | { x: number; y: number; grabbing: boolean } }));`
   e usare `cursor: state.cursor`; in `beforeEach` `state.cursor = null;`.

3. Aggiornare `'offers the three choices to a lab admin'` aggiungendo
   `expect(screen.getByRole('button', { name: /Banco di prova/ })).toBeTruthy();`, e aggiungere:

```tsx
describe('gesture lab bench', () => {
  it('offers the bench only on a wide screen, also without the archive', () => {
    render(<Lab archive={null} />);
    const bench = screen.getByRole('button', { name: /Banco di prova/ });
    expect(bench.className).toContain('max-lg:hidden');
  });

  it('starts the camera and shows hand and numbers, without the stage', () => {
    nav.search = '?vista=banco';
    render(<Lab archive={null} />);
    expect(hook.startLive).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Banco di prova' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dita' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Avanzate' })).toBeTruthy();
  });

  it('goes back to the home when opened on a phone', () => {
    media.wide = false;
    nav.search = '?vista=banco';
    window.history.replaceState(null, '', '/dev/gesture-lab?vista=banco');
    render(<Lab archive={null} />);
    expect(window.location.search).toBe('');
  });

  it('hides the cursor where the stage is not visible', () => {
    state.cursor = { x: 10, y: 10, grabbing: false };
    nav.search = '?vista=banco';
    const { container } = render(<Lab archive={null} />);
    const cursor = container.querySelector('[data-lab-cursor]') as HTMLElement;
    expect(cursor.className).toContain('lg:hidden');
  });
});

describe('gesture lab phone stage', () => {
  it('starts every screen with the hand, even after showing the stage elsewhere', () => {
    nav.search = '?vista=prova';
    const { rerender } = render(<Lab archive={archive} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostra il palco' }));
    expect(screen.getByRole('button', { name: 'Nascondi il palco' })).toBeTruthy();
    nav.search = '?vista=rigioca';
    rerender(<Lab archive={archive} />);
    nav.search = '?vista=prova';
    rerender(<Lab archive={archive} />);
    expect(screen.getByRole('button', { name: 'Mostra il palco' })).toBeTruthy();
  });

  it('uses the bench scene in the recording, the stage scene in the try screen', () => {
    nav.search = '?vista=prova';
    render(<Lab archive={archive} />);
    expect(screen.queryByRole('region', { name: 'Dita' })).toBeNull();
  });
});
```

(La scena di Registra compare dal passo 2: il controllo che usi la variante `bench` sta nel
controllo a mano; qui basta che Prova non abbia i numeri.)

- [ ] **Step 3: vederli rossi**

Run: `npx vitest run tests/unit/gesture-lab-view.test.ts tests/unit/gesture-lab-layout.test.tsx`
Expected: FAIL (vista `banco` sconosciuta, nessun «Banco di prova», nessun `data-lab-cursor`).

- [ ] **Step 4: `lab-view.ts`**

```ts
export type LabView = 'home' | 'prova' | 'banco' | 'registra' | 'rigioca';

const VIEWS: readonly LabView[] = ['prova', 'banco', 'registra', 'rigioca'];

// Da qui in su c'è spazio per il banco (Tailwind `lg`).
export const WIDE_SCREEN_QUERY = '(min-width: 64rem)';
```

Il resto resta com'è: `banco` non è in `ARCHIVE_VIEWS`.

- [ ] **Step 5: `home-screen.tsx`**

Aggiungere a `CHOICES`, dopo «Prova», la scelta col campo `wideOnly`:

```ts
const CHOICES = [
  { view: 'prova', title: 'Prova le gesture', hint: 'Fotocamera e palco.', archive: false, wideOnly: false },
  {
    view: 'banco',
    title: 'Banco di prova',
    hint: 'Scheletro e numeri dal vivo.',
    archive: false,
    wideOnly: true,
  },
  { view: 'registra', title: 'Registra un gesto', hint: 'Guidato, un passo alla volta.', archive: true, wideOnly: false },
  { view: 'rigioca', title: "Rigioca dall'archivio", hint: 'Anche senza webcam.', archive: true, wideOnly: false },
] as const satisfies readonly {
  view: LabView;
  title: string;
  hint: string;
  archive: boolean;
  wideOnly: boolean;
}[];
```

(formattare con prettier), la griglia in `sm:grid-cols-2 lg:grid-cols-4`, e sul bottone
`className={cx('flex min-h-24 …', c.wideOnly && 'max-lg:hidden')}` importando `cx` da
`@omnicanvas/ui`. Aggiornare il commento: «quattro scelte su schermo largo, tre sul telefono».

- [ ] **Step 6: `bench-screen.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Button } from '@omnicanvas/ui';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { LIVE_MESSAGES } from './lab-messages';
import { ScreenHeader } from './screen-header';

type Props = {
  scene: ReactNode;
  live: LiveStatus;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
  onAdvanced: () => void;
};

// Il banco di prova (solo computer): la mano dal vivo e i numeri che spiegano cosa vede il
// riconoscitore. Niente palco: per l'effetto sulle finestre c'è Prova.
export function BenchScreen({ scene, live, onStart, onStop, onBack, onAdvanced }: Props) {
  const message = LIVE_MESSAGES[live];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader title="Banco di prova" onBack={onBack} onAdvanced={onAdvanced} />
      <div className="flex min-h-0 flex-1 flex-col">{scene}</div>
      {message && <p className="shrink-0 text-sm text-muted">{message}</p>}
      <div className="flex shrink-0 items-center gap-2">
        {live === 'on' ? (
          <Button onClick={onStop}>Ferma fotocamera</Button>
        ) : (
          <Button variant="accent" disabled={live === 'loading'} onClick={onStart}>
            Avvia fotocamera
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `lab.tsx`**

1. Import: `BenchScreen`, `BenchPanel` (già da Task 2), `stageHiddenClass` e `type SceneVariant`
   da `./lab-scene`, `WIDE_SCREEN_QUERY` da `@/lib/gesture-lab/lab-view`.
2. Stato del palco sul telefono: si azzera a ogni cambio di schermata, anche tornando a una
   già vista. Si usa il modo di React per adattare lo stato a una prop durante il render
   (niente `useEffect` con `setState`, che il lint segnala):

```tsx
  // Sul telefono il palco si apre a richiesta; ogni schermata riparte con la mano.
  const [stageShown, setStageShown] = useState(false);
  const [stageView, setStageView] = useState(view);
  if (stageView !== view) {
    setStageView(view);
    setStageShown(false);
  }
  const toggleStage = useCallback(() => setStageShown((shown) => !shown), []);
  const variant: SceneVariant = view === 'banco' || view === 'registra' ? 'bench' : 'stage';
```

3. `sceneVisible` include il banco: `const sceneVisible = view === 'prova' || view === 'banco' || screenScene;`
4. La fotocamera parte anche nel banco: `if (view === 'prova' || view === 'banco') void current.startLive();`
   e aggiornare il commento sopra l'effetto («…riparte entrando in Prova o nel banco…»).
5. Il banco non esiste sul telefono:

```tsx
  // Il banco serve spazio: aperto dal telefono (link o tasto indietro) si torna all'inizio.
  useEffect(() => {
    if (view !== 'banco') return;
    const wide = window.matchMedia(WIDE_SCREEN_QUERY);
    const check = () => {
      if (!wide.matches) go('home');
    };
    check();
    wide.addEventListener('change', check);
    return () => wide.removeEventListener('change', check);
  }, [view, go]);
```

6. La scena:

```tsx
  const scene = (
    <LabScene
      areaRef={areaRef}
      variant={variant}
      stageShown={stageShown}
      onToggleStage={toggleStage}
      hand={
        <HandView
          videoRef={videoRef}
          framesRef={framesRef}
          view={lab.view}
          lastEvent={lab.fired[lab.fired.length - 1] ?? null}
          idle={lab.live !== 'on' && !lab.playing}
          replaying={lab.playing}
        />
      }
      stage={<StageBoard stage={lab.stage} assetUrls={{}} dispatch={lab.dispatch} />}
      panel={
        <BenchPanel
          view={lab.view}
          hand={lab.hand}
          tuning={effectiveTuning(lab.settings)}
          log={lab.log}
        />
      }
    />
  );
```

7. La schermata, dopo quella di Prova:

```tsx
        {view === 'banco' && (
          <BenchScreen
            scene={scene}
            live={lab.live}
            onStart={() => void lab.startLive()}
            onStop={lab.stopLive}
            onBack={toHome}
            onAdvanced={openAdvanced}
          />
        )}
```

8. Il cursore si vede solo dove si vede il palco:

```tsx
      {lab.cursor && (
        <div
          aria-hidden
          data-lab-cursor
          style={{ left: lab.cursor.x, top: lab.cursor.y }}
          className={cx(
            'pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2',
            lab.cursor.grabbing ? 'h-8 w-8 border-accent bg-accent/30' : 'h-5 w-5 border-fg',
            stageHiddenClass(variant, stageShown),
          )}
        />
      )}
```

Nella schermata iniziale e in Registra al passo 1 la scena non è visibile e il cursore resta
come oggi.

- [ ] **Step 8: vederli verdi**

Run: `npx vitest run tests/unit/gesture-lab-view.test.ts tests/unit/gesture-lab-layout.test.tsx tests/unit/gesture-lab-record-wizard.test.tsx tests/unit/gesture-lab-replay-screen.test.tsx`
Expected: PASS. Poi la suite unitaria intera: `npx vitest run tests/unit`, e
`npm run typecheck`, `npm run lint`, `npm run build` (con le variabili pubbliche segnaposto se
manca `.env.local`, come nei task precedenti del laboratorio).

- [ ] **Step 9: documentazione**

- `docs/GESTURE-LAB.md`: una sezione «Banco di prova (computer)» con cosa mostrano i tre
  riquadri (tacche = soglie di `tuning.pose`) e una riga sul telefono («mano a tutto spazio,
  “Mostra il palco” per vedere l'effetto»); togliere ogni riferimento a «Riscontro durante il
  gesto».
- `docs/BACKLOG.md`: nella sezione del laboratorio una voce spuntata «Banco di prova su PC e mano
  al centro sul telefono (spec `docs/specs/2026-10-09-gesture-lab-banco-design.md`)» e una voce
  aperta «Controllo a mano del banco: 1920x1080 e iPhone verticale/orizzontale».
- `CLAUDE.md`, «Stato attuale»: una frase sul banco su `slice/gesture-lab-banco`, con la spec.

- [ ] **Step 10: commit**

```bash
git add apps/web/src/lib/gesture-lab/lab-view.ts apps/web/src/app/dev/gesture-lab/home-screen.tsx apps/web/src/app/dev/gesture-lab/bench-screen.tsx apps/web/src/app/dev/gesture-lab/lab.tsx tests/unit/gesture-lab-view.test.ts tests/unit/gesture-lab-layout.test.tsx docs/GESTURE-LAB.md docs/BACKLOG.md CLAUDE.md
git commit -m "feat(gesture-lab): bench screen on wide screens, phone screens start with the hand"
```

---

## Controllo a mano (dopo il deploy su staging)

1. 1920x1080: pagina iniziale con quattro scelte; Banco: scheletro sopra, tre riquadri sotto,
   barre che si muovono con le dita, tacche alle soglie, eventi in cima; Registra dal passo 2:
   scheletro e riquadri, niente palco; Prova e Rigioca come prima.
2. iPhone verticale e orizzontale: tre scelte (niente banco); Prova, Registra, Rigioca con la
   mano a tutto spazio, «Mostra il palco» apre il palco, una gesture fatta col palco chiuso si
   vede aprendolo; `?vista=banco` torna alla pagina iniziale.
3. Impostazioni salvate prima di oggi: la pagina si apre, cursore fluido e pose stabili restano
   come erano.
