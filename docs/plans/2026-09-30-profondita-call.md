# Profondità della call e del palco — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dare a palco, finestre e volti luce, materia e quattro momenti animati (finestre vive,
nascita, aggancio, voce) senza cambiare layout né aggiungere dipendenze.

**Architecture:** la materia sta in token e utility CSS di `packages/ui/src/theme.css`. I
momenti partono da funzioni pure in `apps/web/src/lib/stage/` (`stageChanges`, `commitStage`,
`tiltFromPoint`) e da un campionatore del livello audio in `packages/realtime`. Le animazioni
sono CSS sotto `motion-safe:` e View Transitions native; senza API o con movimento ridotto lo
stato si aggiorna subito, come oggi.

**Tech Stack:** Next.js 16, React 19 (`flushSync`), Tailwind v4 (`@theme`, `@theme inline`,
`@utility`, varianti `data-*` e `motion-safe:`), View Transitions API, LiveKit
(`room.activeSpeakers`, `audioLevel`), Vitest + happy-dom + Testing Library, Playwright.

**Spec:** `docs/specs/2026-09-30-profondita-call-design.md`

## Global Constraints

- Nessuna nuova dipendenza di runtime.
- Durate fra 150 e 600 ms; nessuna animazione in loop quando nessuno fa niente.
- Solo `transform`, `opacity`, `filter` e `box-shadow` nelle animazioni.
- Con `prefers-reduced-motion: reduce`: nessuna inclinazione, nascita e aggancio istantanei,
  alone fisso su chi parla.
- Telefono dell'ospite: niente inclinazione, niente aggancio; nascita e voce sì.
- Nessun colore nuovo; il lime solo su ciò che è vivo. Niente esadecimali nelle schermate
  (solo in `theme.css`).
- LiveKit solo in `packages/realtime`; `packages/ui` non legge dati.
- Il livello audio è un numero in memoria: non va in log, Postgres, KV o file (regola 1).
- Gli e2e esistenti passano senza modifiche.
- Codice, nomi e commit in inglese; commenti e documentazione in italiano.

## Review Focus

1. **Primo caricamento del palco** (ospite che entra a riunione avviata, host che ricarica):
   niente nascita né aggancio su tutte le finestre; si anima solo ciò che cambia dopo. Test in
   Task 2 (`prev.version === 0`).
2. **Due aggiornamenti ravvicinati durante una View Transition** (l'agente piazza un contenuto
   mentre una finestra si sposta): lo stato finale è l'ultimo, mai uno vecchio. Test in Task 2
   (`render` legge sempre l'ultimo stato).
3. **Ospite su desktop**: `StageBoard` e `MobileStage` stanno entrambi nel DOM (uno nascosto):
   lo stesso `view-transition-name` due volte fa fallire la transizione. Solo `StageBoard`
   assegna il nome. Test in Task 2.
4. **Trascinamento che esce dal palco o viene annullato**: lo slot non resta illuminato. Test in
   Task 3 (`dragLeave` fuori dal palco, `dragEnd`).
5. **Livello audio quando nessuno parla più o la sessione si chiude**: l'alone torna a zero e il
   timer si ferma. Test in Task 5 (mappa vuota emessa una volta, poi silenzio).

---

## File

| File | Responsabilità |
|---|---|
| `packages/ui/src/theme.css` | token `glow`, ombre, utility `stage-light`, `grain`, `window-tilt`, `voice-glow`, animazione `birth` |
| `packages/ui/src/panel.tsx` | tono `stage` con luce e grana, filo di luce sulle superfici |
| `packages/ui/src/face-tile.tsx` | prop `level`, alone che segue la voce |
| `apps/web/src/app/globals.css` | regole delle View Transitions |
| `apps/web/src/lib/stage/motion.ts` | `stageChanges`, `motionAllowed`, `commitStage` |
| `apps/web/src/lib/stage/tilt.ts` | `tiltFromPoint`, `tiltEnabled`, hook `useStageTilt` |
| `apps/web/src/lib/stage/use-stage.ts` | `commit` passa da `commitStage`; stato `born` |
| `apps/web/src/lib/stage/use-gestures.ts` | opzione `onPointer` per la mano |
| `apps/web/src/app/room/[code]/window-view.tsx` | `born`, `transitionName`, ombre e inclinazione |
| `apps/web/src/app/room/[code]/stage-board.tsx` | slot illuminato, `born`, ref dell'inclinazione |
| `apps/web/src/app/room/[code]/stage-area.tsx` | collega `born`, inclinazione e slot della mano |
| `apps/web/src/app/room/[code]/mobile-stage.tsx` | `born` |
| `apps/web/src/app/room/[code]/room-call.tsx`, `video-tile.tsx` | livello audio verso `FaceTile` |
| `apps/web/src/lib/call/use-audio-level.ts` | hook per un singolo volto |
| `packages/realtime/src/audio-levels.ts` | `quantizeLevel`, `createLevelTracker` |
| `packages/realtime/src/types.ts`, `livekit-session.ts` | `AudioLevels`, `onAudioLevels` |

---

### Task 1: Materia (token, luce, grana, ombre)

**Files:**
- Modify: `packages/ui/src/theme.css`
- Modify: `packages/ui/src/panel.tsx`
- Test: `tests/unit/ui-theme.test.ts`, `tests/unit/ui-surfaces.test.tsx`

**Interfaces:**
- Produces: token `--color-glow`; classi `shadow-window`, `shadow-window-active`,
  `shadow-edge`, `stage-light`, `grain`, `window-tilt`, `voice-glow`, `animate-birth`. Le
  variabili `--tilt-x`, `--tilt-y` (in [-1, 1]) e `--level` (in [0, 1]) sono lette da queste
  classi; chi non le imposta ottiene 0.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/ui-theme.test.ts`, dentro `describe('theme tokens', …)`, aggiungere:

```ts
  it('defines the depth tokens and utilities of the 30/09 spec', () => {
    expect(css).toMatch(/--color-glow:\s*rgb\(200 242 90 \/ 0\.45\)/);
    for (const name of ['shadow-window', 'shadow-window-active', 'shadow-edge']) {
      expect(css).toContain(`--${name}:`);
    }
    for (const utility of ['stage-light', 'grain', 'window-tilt', 'voice-glow']) {
      expect(css).toContain(`@utility ${utility}`);
    }
    expect(css).toContain('--animate-birth:');
    expect(css).toContain('@keyframes birth');
  });

  it('moves the windows only for a fine pointer and when motion is welcome', () => {
    const tilt = css.slice(css.indexOf('@utility window-tilt'));
    expect(tilt).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/,
    );
  });
```

In `tests/unit/ui-surfaces.test.tsx`, dentro `describe('Panel', …)`, aggiungere:

```ts
  it('lights the stage from above and gives it grain', () => {
    render(
      <Panel tone="stage" data-testid="p">
        x
      </Panel>,
    );
    const cls = screen.getByTestId('p').className;
    expect(cls).toContain('stage-light');
    expect(cls).toContain('grain');
  });
  it('gives surfaces a thin edge of light', () => {
    render(<Panel data-testid="s">x</Panel>);
    expect(screen.getByTestId('s').className).toContain('shadow-edge');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/ui-theme.test.ts tests/unit/ui-surfaces.test.tsx`
Expected: FAIL — `--color-glow` non trovato; `stage-light` e `shadow-edge` assenti.

- [ ] **Step 3: Implement**

In `packages/ui/src/theme.css`, dentro il blocco `@theme` esistente, dopo `--color-danger`:

```css
  /* Alone lime di ciò che è vivo (spec 2026-09-30, §1). */
  --color-glow: rgb(200 242 90 / 0.45);
```

e, sempre dentro `@theme`, dopo `--font-sans`:

```css
  --animate-birth: birth 600ms cubic-bezier(0.2, 0.9, 0.25, 1.15);

  @keyframes birth {
    0% {
      opacity: 0;
      transform: perspective(900px) translateZ(-220px) scale(0.92);
      filter: blur(6px);
    }
    40% {
      opacity: 1;
      transform: none;
      filter: blur(0);
      box-shadow:
        0 0 0 2px var(--color-accent),
        0 0 50px 4px var(--color-glow);
    }
    100% {
      transform: none;
    }
  }
```

In fondo al file:

```css
/* Ombre risolte dove si usano (inline): leggono --tilt-x e --tilt-y dell'antenato, così
   l'ombra si sposta con l'inclinazione. Senza inclinazione valgono 0. */
@theme inline {
  --shadow-window:
    inset 0 1px 0 rgb(255 255 255 / 0.07),
    calc(var(--tilt-x, 0) * -10px) calc(14px + var(--tilt-y, 0) * -6px) 28px -12px
      rgb(8 8 6 / 0.75);
  --shadow-window-active:
    inset 0 1px 0 rgb(255 255 255 / 0.07), 0 0 0 1px rgb(200 242 90 / 0.15),
    0 0 30px -8px rgb(200 242 90 / 0.35),
    calc(var(--tilt-x, 0) * -10px) calc(14px + var(--tilt-y, 0) * -6px) 28px -12px
      rgb(8 8 6 / 0.75);
  --shadow-edge: inset 0 1px 0 rgb(255 255 255 / 0.04);
}

/* Palco illuminato dall'alto: da stage verso un grigio più scuro, nessun colore nuovo. */
@utility stage-light {
  background: radial-gradient(
    110% 80% at 50% -10%,
    color-mix(in srgb, var(--color-stage) 80%, white) 0%,
    var(--color-stage) 55%,
    color-mix(in srgb, var(--color-stage) 70%, black) 100%
  );
}

/* Grana leggera sopra il palco: rompe il piatto digitale, non intercetta il puntatore. */
@utility grain {
  position: relative;
  isolation: isolate;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0.08;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
  }
}

/* Finestre vive: inclinazione e riflesso seguono --tilt-x/--tilt-y. Solo con un puntatore
   fine e senza movimento ridotto; altrimenti la finestra resta piatta. */
@utility window-tilt {
  position: relative;
  @media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
    transform: perspective(900px) rotateX(calc(var(--tilt-y, 0) * -4deg))
      rotateY(calc(var(--tilt-x, 0) * 5deg));
    transition:
      transform 250ms ease-out,
      box-shadow 250ms ease-out;
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background: radial-gradient(
        60% 50% at calc(50% + var(--tilt-x, 0) * 40%) calc(var(--tilt-y, 0) * 30%),
        rgb(255 255 255 / 0.07),
        transparent 70%
      );
    }
  }
}

/* Alone di chi parla: cresce con --level (0-1). */
@utility voice-glow {
  box-shadow:
    0 0 0 2px var(--color-accent),
    0 0 calc(6px + var(--level, 0) * 18px) calc(var(--level, 0) * 5px) var(--color-glow);
  transition: box-shadow 90ms linear;
}
```

In `packages/ui/src/panel.tsx`, sostituire la riga `className={cx(…)}`:

```tsx
      className={cx(
        'rounded-panel',
        tone === 'surface' ? 'bg-surface shadow-edge' : 'bg-stage stage-light grain',
        className,
      )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/ui-theme.test.ts tests/unit/ui-surfaces.test.tsx`
Expected: PASS. Poi `npm run build -w apps/web` (o `npm run build`): la build CSS di Tailwind
accetta `@utility` con `@media` e `&::before` annidati.
Expected: build completata senza errori CSS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/theme.css packages/ui/src/panel.tsx tests/unit/ui-theme.test.ts tests/unit/ui-surfaces.test.tsx
git commit -m "feat(ui): depth tokens, stage light, grain and window shadows"
```

---

### Task 2: Nascita e aggancio (motion, View Transitions)

**Files:**
- Create: `apps/web/src/lib/stage/motion.ts`
- Modify: `apps/web/src/lib/stage/use-stage.ts` (funzione `commit` e valore restituito)
- Modify: `apps/web/src/app/room/[code]/window-view.tsx`
- Modify: `apps/web/src/app/room/[code]/stage-board.tsx`
- Modify: `apps/web/src/app/room/[code]/mobile-stage.tsx`
- Modify: `apps/web/src/app/room/[code]/stage-area.tsx`, `room-call.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `tests/unit/stage-motion.test.ts`, `tests/unit/stage-polish.test.tsx`

**Interfaces:**
- Consumes: `animate-birth`, `shadow-window`, `shadow-window-active`, `window-tilt` (Task 1).
- Produces:
  - `stageChanges(prev: Stage, next: Stage): { born: string[]; moved: string[] }`
  - `motionAllowed(doc: Document, win: Window): boolean`
  - `commitStage(options: { prev: Stage; next: Stage; doc: Document; win: Window; render: () => void; onBorn: (windowIds: string[]) => void }): void`
  - `useStage(...)` restituisce anche `born: string[]`.
  - `WindowView` accetta `born?: boolean` e `transitionName?: boolean`.
  - `StageBoard` accetta `born?: string[]`; `MobileStage` accetta `born?: string[]`;
    `StageArea` accetta `born: string[]`.

- [ ] **Step 1: Write the failing tests for the pure functions**

Create `tests/unit/stage-motion.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Content, Stage, StageWindow } from '@omnicanvas/canvas';
import { commitStage, motionAllowed, stageChanges } from '@/lib/stage/motion';

const chart = (id: string): Content => ({
  id,
  kind: 'chart',
  data: { title: 'Ricavi', labels: ['a'], values: [1] },
});
const win = (id: string, slot: StageWindow['slot'], contents: Content[] = []): StageWindow => ({
  id,
  title: id,
  slot,
  contents,
});
const stage = (windows: StageWindow[], version = 3): Stage => ({
  windows,
  focusedId: windows.find((w) => w.slot === 'main')?.id ?? null,
  tray: [],
  negotiation: null,
  version,
});

describe('stageChanges', () => {
  it('marks the window that received a content it did not have', () => {
    const prev = stage([win('w1', 'main')]);
    const next = stage([win('w1', 'main', [chart('c1')])]);
    expect(stageChanges(prev, next)).toEqual({ born: ['w1'], moved: [] });
  });

  it('ignores contents the window already had', () => {
    const prev = stage([win('w1', 'main', [chart('c1')])]);
    const next = stage([win('w1', 'main', [chart('c1')])]);
    expect(stageChanges(prev, next)).toEqual({ born: [], moved: [] });
  });

  it('marks a window whose slot changed as moved', () => {
    const prev = stage([win('w1', 'main'), win('w2', 'side-1')]);
    const next = stage([win('w1', 'side-1'), win('w2', 'main')]);
    expect(stageChanges(prev, next).moved.sort()).toEqual(['w1', 'w2']);
  });

  it('does not treat a new or an archived window as moved', () => {
    const prev = stage([win('w1', 'main'), win('w2', 'side-1')]);
    const next = stage([win('w1', 'main'), win('w3', 'side-2')]);
    expect(stageChanges(prev, next)).toEqual({ born: [], moved: [] });
  });

  it('counts a content moved to another window as born there', () => {
    const prev = stage([win('w1', 'main', [chart('c1')]), win('w2', 'side-1')]);
    const next = stage([win('w1', 'main'), win('w2', 'side-1', [chart('c1')])]);
    expect(stageChanges(prev, next)).toEqual({ born: ['w2'], moved: [] });
  });
});

type FakeDoc = {
  visibilityState: DocumentVisibilityState;
  startViewTransition?: (callback: () => void) => unknown;
};
const fakeWin = (reduce: boolean) =>
  ({ matchMedia: (q: string) => ({ matches: reduce && q.includes('reduce') }) }) as unknown as Window;

describe('motionAllowed', () => {
  it('needs the API, a visible page and no reduced motion', () => {
    const doc = { visibilityState: 'visible', startViewTransition: vi.fn() } as FakeDoc;
    expect(motionAllowed(doc as unknown as Document, fakeWin(false))).toBe(true);
    expect(motionAllowed(doc as unknown as Document, fakeWin(true))).toBe(false);
    expect(
      motionAllowed({ ...doc, visibilityState: 'hidden' } as unknown as Document, fakeWin(false)),
    ).toBe(false);
    expect(
      motionAllowed({ visibilityState: 'visible' } as unknown as Document, fakeWin(false)),
    ).toBe(false);
  });
});

describe('commitStage', () => {
  const moved = () => ({
    prev: stage([win('w1', 'main'), win('w2', 'side-1')]),
    next: stage([win('w1', 'side-1'), win('w2', 'main')]),
  });

  it('renders inside a view transition when a window moved', () => {
    const pending: Array<() => void> = [];
    const doc = {
      visibilityState: 'visible',
      startViewTransition: (cb: () => void) => pending.push(cb),
    };
    const render = vi.fn();
    commitStage({
      ...moved(),
      doc: doc as unknown as Document,
      win: fakeWin(false),
      render,
      onBorn: vi.fn(),
    });
    expect(render).not.toHaveBeenCalled();
    pending[0]!();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('renders at once without the API or with reduced motion', () => {
    for (const [doc, reduce] of [
      [{ visibilityState: 'visible' }, false],
      [{ visibilityState: 'visible', startViewTransition: vi.fn() }, true],
    ] as const) {
      const render = vi.fn();
      commitStage({
        ...moved(),
        doc: doc as unknown as Document,
        win: fakeWin(reduce),
        render,
        onBorn: vi.fn(),
      });
      expect(render).toHaveBeenCalledTimes(1);
    }
  });

  it('renders at once when nothing moved, and reports the births', () => {
    const start = vi.fn();
    const render = vi.fn();
    const onBorn = vi.fn();
    commitStage({
      prev: stage([win('w1', 'main')]),
      next: stage([win('w1', 'main', [chart('c1')])]),
      doc: { visibilityState: 'visible', startViewTransition: start } as unknown as Document,
      win: fakeWin(false),
      render,
      onBorn,
    });
    expect(start).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
    expect(onBorn).toHaveBeenCalledWith(['w1']);
  });

  it('animates nothing on the first load of the stage', () => {
    const start = vi.fn();
    const onBorn = vi.fn();
    const render = vi.fn();
    commitStage({
      prev: stage([], 0),
      next: stage([win('w1', 'main', [chart('c1')]), win('w2', 'side-1')], 9),
      doc: { visibilityState: 'visible', startViewTransition: start } as unknown as Document,
      win: fakeWin(false),
      render,
      onBorn,
    });
    expect(start).not.toHaveBeenCalled();
    expect(onBorn).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/stage-motion.test.ts`
Expected: FAIL — modulo `@/lib/stage/motion` non trovato.

- [ ] **Step 3: Implement `motion.ts`**

Create `apps/web/src/lib/stage/motion.ts`:

```ts
import { flushSync } from 'react-dom';
import type { Stage } from '@omnicanvas/canvas';

export type StageChanges = { born: string[]; moved: string[] };

const NO_CHANGES: StageChanges = { born: [], moved: [] };

// Confronta due stati del palco: non sa se il comando è arrivato da mouse, mano, agente
// o dall'host remoto. born = finestre con un contenuto che prima non avevano;
// moved = finestre presenti in entrambi con slot diverso.
export function stageChanges(prev: Stage, next: Stage): StageChanges {
  const before = new Map(prev.windows.map((w) => [w.id, w]));
  const born: string[] = [];
  const moved: string[] = [];
  for (const window of next.windows) {
    const old = before.get(window.id);
    const had = new Set(old?.contents.map((c) => c.id) ?? []);
    if (window.contents.some((c) => !had.has(c.id))) born.push(window.id);
    if (old && old.slot !== window.slot) moved.push(window.id);
  }
  return { born, moved };
}

export function motionAllowed(doc: Document, win: Window): boolean {
  return (
    typeof doc.startViewTransition === 'function' &&
    doc.visibilityState === 'visible' &&
    !win.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type CommitOptions = {
  prev: Stage;
  next: Stage;
  doc: Document;
  win: Window;
  // Deve disegnare l'ultimo stato noto, non `next`: una transizione può partire dopo
  // un aggiornamento più recente.
  render: () => void;
  onBorn: (windowIds: string[]) => void;
};

export function commitStage({ prev, next, doc, win, render, onBorn }: CommitOptions): void {
  // Primo caricamento (snapshot o palco vuoto): si mostra com'è, senza animare tutto.
  const changes = prev.version === 0 ? NO_CHANGES : stageChanges(prev, next);
  if (changes.born.length > 0) onBorn(changes.born);
  if (changes.moved.length > 0 && motionAllowed(doc, win)) {
    doc.startViewTransition(() => flushSync(render));
    return;
  }
  render();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/stage-motion.test.ts`
Expected: PASS (10 test).

- [ ] **Step 5: Write the failing UI tests**

In `tests/unit/stage-polish.test.tsx`, aggiungere in fondo (gli import `StageArea`,
`WindowView`, `applyCommand`, `emptyStage`, `render`, `screen` ci sono già; aggiungere
`import { StageBoard } from '@/app/room/[code]/stage-board';` e
`import { MobileStage } from '@/app/room/[code]/mobile-stage';`):

```tsx
describe('window birth and move animations', () => {
  const ID = '00000000-0000-4000-8000-000000000001';

  it('marks a window as just born only when told so', () => {
    const [window] = withWindow().windows;
    const { rerender } = render(<WindowView window={window!} assetUrls={{}} born />);
    expect(screen.getByRole('article').hasAttribute('data-born')).toBe(true);
    expect(screen.getByRole('article').className).toContain('motion-safe:data-born:animate-birth');
    rerender(<WindowView window={window!} assetUrls={{}} />);
    expect(screen.getByRole('article').hasAttribute('data-born')).toBe(false);
  });

  it('names each window for view transitions on the board only', () => {
    const stage = withWindow();
    const { unmount } = render(<StageBoard stage={stage} assetUrls={{}} born={[ID]} />);
    const article = screen.getByRole('article');
    expect(article.style.getPropertyValue('view-transition-name')).toBe(`win-${ID}`);
    expect(article.hasAttribute('data-born')).toBe(true);
    unmount();
    render(<MobileStage stage={stage} assetUrls={{}} born={[ID]} />);
    const mobile = screen.getByRole('article');
    expect(mobile.style.getPropertyValue('view-transition-name')).toBe('');
    expect(mobile.hasAttribute('data-born')).toBe(true);
  });

  it('gives windows depth: shadow, active glow and tilt', () => {
    const [window] = withWindow().windows;
    render(<WindowView window={window!} assetUrls={{}} />);
    const cls = screen.getByRole('article').className;
    expect(cls).toContain('window-tilt');
    expect(cls).toContain(window!.slot === 'main' ? 'shadow-window-active' : 'shadow-window');
  });
});
```

Nota: se happy-dom non espone `view-transition-name` con `style.getPropertyValue`, leggere
l'attributo `style` (`article.getAttribute('style')`) e verificare che contenga
`view-transition-name: win-<id>`; la verifica resta la stessa.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/stage-polish.test.tsx`
Expected: FAIL — `data-born` assente, prop `born` sconosciuta, nessun nome di transizione.

- [ ] **Step 7: Implement the UI**

`apps/web/src/app/room/[code]/window-view.tsx`:

- aggiungere a `Props`:

```ts
  // Contenuto appena arrivato: la finestra sale dal fondo con un lampo (spec 30/09, §2).
  born?: boolean;
  // Solo il palco a slot dà il nome alla finestra: due nomi uguali nel DOM annullano
  // la View Transition (l'ospite su desktop ha anche MobileStage, nascosta).
  transitionName?: boolean;
```

- firma: `export function WindowView({ window, assetUrls, dispatch, born = false, transitionName = false }: Props)`
- sostituire l'apertura di `<article …>` con:

```tsx
    <article
      aria-label={window.title}
      data-born={born ? '' : undefined}
      style={transitionName ? { viewTransitionName: `win-${window.id}` } : undefined}
      className={`@container window-tilt flex h-full flex-col gap-2 rounded-tile border bg-raised p-3 motion-safe:transition-colors motion-safe:data-born:animate-birth ${
        window.slot === 'main' ? 'border-accent shadow-window-active' : 'border-line shadow-window'
      }`}
    >
```

`apps/web/src/app/room/[code]/stage-board.tsx`:

- `Props` aggiunge `born?: string[] | undefined;`
- firma: `export function StageBoard({ stage, assetUrls, dispatch, born = [] }: Props)`
- dentro `renderSlot`, la `WindowView` diventa:

```tsx
          <WindowView
            window={window}
            assetUrls={assetUrls}
            dispatch={dispatch}
            born={born.includes(window.id)}
            transitionName
          />
```

`apps/web/src/app/room/[code]/mobile-stage.tsx`:

- props: `{ stage, assetUrls, born = [] }: { stage: Stage; assetUrls: Record<string, string>; born?: string[] }`
- `<WindowView window={shown} assetUrls={assetUrls} born={born.includes(shown.id)} />`

`apps/web/src/app/room/[code]/stage-area.tsx`:

- `Props` aggiunge `born: string[];`
- ramo ospite: `<StageBoard stage={stage} assetUrls={assetUrls} born={born} />` e
  `<MobileStage stage={stage} assetUrls={assetUrls} born={born} />` (destrutturare `born` da
  `props`).
- `HostStage`: destrutturare `born` e passare `born={born}` alla sua `StageBoard`.

`apps/web/src/app/room/[code]/room-call.tsx`: a `<StageArea …>` aggiungere
`born={stageApi.born}`.

In `tests/unit/stage-polish.test.tsx`, il test esistente «stage while loading» passa ora anche
`born={[]}` a `StageArea`.

`apps/web/src/lib/stage/use-stage.ts`:

- import: `import { commitStage } from './motion';`
- costante: `const BORN_MS = 600;`
- sostituire `commit` con:

```ts
  const [born, setBorn] = useState<string[]>([]);
  const bornTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  const markBorn = useCallback((ids: string[]) => {
    setBorn((current) => [...new Set([...current, ...ids])]);
    const timer = setTimeout(() => {
      bornTimersRef.current.delete(timer);
      setBorn((current) => current.filter((id) => !ids.includes(id)));
    }, BORN_MS);
    bornTimersRef.current.add(timer);
  }, []);

  useEffect(() => {
    const timers = bornTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const commit = useCallback(
    (next: Stage) => {
      const prev = stageRef.current;
      stageRef.current = next;
      commitStage({
        prev,
        next,
        doc: document,
        win: window,
        // Sempre l'ultimo stato: una View Transition può partire dopo un aggiornamento nuovo.
        render: () => setStage(stageRef.current),
        onBorn: markBorn,
      });
    },
    [markBorn],
  );
```

- aggiungere `born` all'oggetto restituito da `useStage`.

`apps/web/src/app/globals.css`, in fondo:

```css
/* Aggancio (spec 2026-09-30, §2): solo le finestre si muovono, con un piccolo rimbalzo.
   La pagina non fa dissolvenza. */
::view-transition-group(*) {
  animation-duration: 400ms;
  animation-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
}
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

- [ ] **Step 8: Run tests, typecheck and lint**

Run: `npx vitest run tests/unit/stage-motion.test.ts tests/unit/stage-polish.test.tsx && npm run typecheck && npm run lint`
Expected: PASS; nessun errore di tipo (TypeScript 5.9 conosce `startViewTransition` e
`viewTransitionName`).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/stage/motion.ts apps/web/src/lib/stage/use-stage.ts apps/web/src/app/room/[code]/window-view.tsx apps/web/src/app/room/[code]/stage-board.tsx apps/web/src/app/room/[code]/mobile-stage.tsx apps/web/src/app/room/[code]/stage-area.tsx apps/web/src/app/room/[code]/room-call.tsx apps/web/src/app/globals.css tests/unit/stage-motion.test.ts tests/unit/stage-polish.test.tsx
git commit -m "feat(stage): windows rise when content arrives and glide to their new slot"
```

---

### Task 3: Slot illuminato durante il trascinamento

**Files:**
- Modify: `apps/web/src/app/room/[code]/stage-board.tsx`
- Modify: `apps/web/src/app/room/[code]/stage-area.tsx`
- Test: `tests/unit/stage-polish.test.tsx`

**Interfaces:**
- Consumes: `nearestSlot`, `slotRectsFromDom` (esistenti); `gestures.cursor`
  (`{ x; y; grabbing } | null`, esistente in `useGestures`).
- Produces: `StageBoard` accetta `hotSlot?: Slot | null` (slot della mano, ha la precedenza);
  lo slot illuminato ha `data-hot`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/stage-polish.test.tsx` aggiungere (import `fireEvent` da
`@testing-library/react`, `vi` c'è già):

```tsx
describe('slot under the dragged item', () => {
  const slotOf = (name: string) => screen.getByRole('region', { name });

  it('lights the slot the hand is over', () => {
    render(<StageBoard stage={withWindow()} assetUrls={{}} dispatch={vi.fn()} hotSlot="side-1" />);
    expect(slotOf('Finestra laterale 1').hasAttribute('data-hot')).toBe(true);
    expect(slotOf('Finestra in primo piano').hasAttribute('data-hot')).toBe(false);
  });

  it('lights a slot while dragging with the mouse and clears it on drop, leave and end', () => {
    const { container } = render(
      <StageBoard stage={withWindow()} assetUrls={{}} dispatch={vi.fn()} />,
    );
    const board = container.firstElementChild as HTMLElement;
    const hot = () => container.querySelectorAll('[data-hot]').length;

    fireEvent.dragOver(board, { clientX: 10, clientY: 10 });
    expect(hot()).toBe(1);
    fireEvent.drop(board, { clientX: 10, clientY: 10 });
    expect(hot()).toBe(0);

    fireEvent.dragOver(board, { clientX: 10, clientY: 10 });
    fireEvent.dragLeave(board, { relatedTarget: document.body });
    expect(hot()).toBe(0);

    fireEvent.dragOver(board, { clientX: 10, clientY: 10 });
    fireEvent.dragEnd(board);
    expect(hot()).toBe(0);
  });

  it('never lights a slot for a guest, who cannot drop', () => {
    const { container } = render(<StageBoard stage={withWindow()} assetUrls={{}} />);
    fireEvent.dragOver(container.firstElementChild as HTMLElement, { clientX: 10, clientY: 10 });
    expect(container.querySelectorAll('[data-hot]').length).toBe(0);
  });
});
```

Nota: in happy-dom tutti i rettangoli valgono zero, quindi `nearestSlot` sceglie il primo slot
(`main`): basta per verificare che uno slot si accenda e si spenga.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/stage-polish.test.tsx`
Expected: FAIL — nessun `data-hot`.

- [ ] **Step 3: Implement**

`apps/web/src/app/room/[code]/stage-board.tsx`:

- import: `import { useState } from 'react';`
- `Props` aggiunge `hotSlot?: Slot | null | undefined;`
- nel corpo:

```tsx
  const [dragSlot, setDragSlot] = useState<Slot | null>(null);
  // La mano ha la precedenza: durante un pizzico il mouse è fermo.
  const hot = hotSlot ?? dragSlot;
```

- `handleDrop` chiama `setDragSlot(null)` come prima istruzione.
- il `<div>` di ogni slot aggiunge `data-hot={hot === slot ? '' : undefined}` e alla sua classe
  (sia `min-h-48 lg:min-h-0` sia `min-h-24`, passate da `renderSlot`) si aggiunge, dentro
  `renderSlot`:

```tsx
        className={`${className} rounded-tile motion-safe:transition-colors data-hot:bg-accent/5 data-hot:outline data-hot:outline-1 data-hot:outline-dashed data-hot:outline-accent/60`}
```

- il contenitore:

```tsx
    <div
      ref={boardRef}
      onDragOver={(event) => {
        if (!dispatch) return;
        event.preventDefault();
        const slot = nearestSlot({ x: event.clientX, y: event.clientY }, slotRectsFromDom());
        if (slot !== dragSlot) setDragSlot(slot);
      }}
      onDragLeave={(event) => {
        // Uscire da un figlio verso un altro figlio non conta: solo l'uscita dal palco.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragSlot(null);
      }}
      onDragEnd={() => setDragSlot(null)}
      onDrop={handleDrop}
      className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[3fr_1fr]"
    >
```

  (`boardRef` arriva nel Task 4; in questo task omettere `ref={boardRef}`.)

`apps/web/src/app/room/[code]/stage-area.tsx`, in `HostStage`:

- import: `import { nearestSlot } from '@omnicanvas/canvas';` (unire all'import esistente) e
  `import { slotRectsFromDom } from '@/lib/stage/drop';`
- prima del `return`:

```tsx
  const cursor = gestures.cursor;
  const handSlot = cursor?.grabbing ? nearestSlot(cursor, slotRectsFromDom()) : null;
```

- `<StageBoard … hotSlot={handSlot} />`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/stage-polish.test.tsx tests/unit/stage-drop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/room/[code]/stage-board.tsx apps/web/src/app/room/[code]/stage-area.tsx tests/unit/stage-polish.test.tsx
git commit -m "feat(stage): light the slot under the dragged window, by mouse or hand"
```

---

### Task 4: Finestre vive (inclinazione con mouse e mano)

**Files:**
- Create: `apps/web/src/lib/stage/tilt.ts`
- Modify: `apps/web/src/lib/stage/use-gestures.ts`
- Modify: `apps/web/src/app/room/[code]/stage-board.tsx`, `stage-area.tsx`
- Test: `tests/unit/stage-tilt.test.tsx`

**Interfaces:**
- Consumes: utility `window-tilt` (Task 1) che legge `--tilt-x`, `--tilt-y`.
- Produces:
  - `tiltFromPoint(rect: { left: number; top: number; width: number; height: number }, point: { x: number; y: number }): { x: number; y: number }`
  - `tiltEnabled(win: Window): boolean`
  - `useStageTilt(): { ref: React.RefObject<HTMLDivElement | null>; pointAt: (point: { x: number; y: number } | null) => void }`
  - `useGestures` accetta `onPointer?: (point: { x: number; y: number } | null) => void`.
  - `StageBoard` accetta `boardRef?: React.Ref<HTMLDivElement>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/stage-tilt.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tiltEnabled, tiltFromPoint, useStageTilt } from '@/lib/stage/tilt';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rect = { left: 100, top: 50, width: 200, height: 100 };

describe('tiltFromPoint', () => {
  it('is zero in the centre and ±1 on the edges', () => {
    expect(tiltFromPoint(rect, { x: 200, y: 100 })).toEqual({ x: 0, y: 0 });
    expect(tiltFromPoint(rect, { x: 100, y: 50 })).toEqual({ x: -1, y: -1 });
    expect(tiltFromPoint(rect, { x: 300, y: 150 })).toEqual({ x: 1, y: 1 });
  });
  it('stays within ±1 outside the stage', () => {
    expect(tiltFromPoint(rect, { x: 900, y: -400 })).toEqual({ x: 1, y: -1 });
  });
  it('is zero for a stage with no size', () => {
    expect(tiltFromPoint({ left: 0, top: 0, width: 0, height: 0 }, { x: 5, y: 5 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('tiltEnabled', () => {
  it('asks for a fine pointer and motion welcome in one query', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    expect(tiltEnabled({ matchMedia } as unknown as Window)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
  });
});

describe('useStageTilt', () => {
  function Probe({ onReady }: { onReady: (api: ReturnType<typeof useStageTilt>) => void }) {
    const api = useStageTilt();
    onReady(api);
    return <div ref={api.ref} data-testid="board" />;
  }

  it('writes the tilt as CSS variables once per frame, and resets it', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let api!: ReturnType<typeof useStageTilt>;
    const { getByTestId } = render(<Probe onReady={(a) => (api = a)} />);
    const board = getByTestId('board');
    board.getBoundingClientRect = () => ({ ...rect, right: 300, bottom: 150, x: 100, y: 50, toJSON: () => ({}) });

    act(() => {
      api.pointAt({ x: 250, y: 100 });
      api.pointAt({ x: 300, y: 150 });
    });
    expect(frames).toHaveLength(1);
    act(() => frames[0]!(0));
    expect(board.style.getPropertyValue('--tilt-x')).toBe('1.000');
    expect(board.style.getPropertyValue('--tilt-y')).toBe('1.000');

    act(() => api.pointAt(null));
    act(() => frames[1]!(0));
    expect(board.style.getPropertyValue('--tilt-x')).toBe('0.000');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/stage-tilt.test.tsx`
Expected: FAIL — modulo `@/lib/stage/tilt` non trovato.

- [ ] **Step 3: Implement `tilt.ts`**

Create `apps/web/src/lib/stage/tilt.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Box = { left: number; top: number; width: number; height: number };

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

// Posizione del puntatore sul palco → inclinazione in [-1, 1] su entrambi gli assi.
export function tiltFromPoint(rect: Box, point: Point): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp(((point.x - rect.left) / rect.width) * 2 - 1),
    y: clamp(((point.y - rect.top) / rect.height) * 2 - 1),
  };
}

export function tiltEnabled(win: Window): boolean {
  return win.matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
  ).matches;
}

// Scrive --tilt-x e --tilt-y sul palco al massimo una volta per frame, senza render di
// React. Mouse e mano passano da pointAt; null riporta le finestre piatte.
export function useStageTilt() {
  const ref = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<Point | null>(null);

  const pointAt = useCallback((point: Point | null) => {
    pendingRef.current = point;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = ref.current;
      if (!element) return;
      const pending = pendingRef.current;
      const tilt = pending ? tiltFromPoint(element.getBoundingClientRect(), pending) : { x: 0, y: 0 };
      element.style.setProperty('--tilt-x', tilt.x.toFixed(3));
      element.style.setProperty('--tilt-y', tilt.y.toFixed(3));
    });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !tiltEnabled(window)) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') pointAt({ x: event.clientX, y: event.clientY });
    };
    const leave = () => pointAt(null);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    return () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [pointAt]);

  return { ref, pointAt };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/stage-tilt.test.tsx`
Expected: PASS (5 test).

- [ ] **Step 5: Wire mouse and hand**

`apps/web/src/lib/stage/use-gestures.ts`:

- `Options` aggiunge:

```ts
  // Posizione della mano sullo schermo durante un pizzico (null al rilascio): inclina il palco.
  onPointer?: ((point: { x: number; y: number } | null) => void) | undefined;
```

- destrutturare `onPointer` nella firma e metterlo in `handlersRef` accanto a `dispatch` e
  `onAgent` (anche nell'effetto che aggiorna `handlersRef`).
- in `onEvent`, nel ramo `'x' in event`: dopo il calcolo di `point`, nel caso `DROP` chiamare
  `handlersRef.current.onPointer?.(null)` prima di `setCursor(null)`; negli altri casi chiamare
  `handlersRef.current.onPointer?.(point)` prima di `setCursor(…)`.

`apps/web/src/app/room/[code]/stage-board.tsx`:

- `Props` aggiunge `boardRef?: React.Ref<HTMLDivElement> | undefined;`
- il contenitore riceve `ref={boardRef}`.

`apps/web/src/app/room/[code]/stage-area.tsx`:

- import: `import { useStageTilt } from '@/lib/stage/tilt';`
- `HostStage`: `const tilt = useStageTilt();` prima di `useGestures`; passare
  `onPointer: tilt.pointAt` a `useGestures`; `<StageBoard … boardRef={tilt.ref} />`.
- ramo ospite: estrarre un componente `GuestBoard` nello stesso file, perché gli hook non
  stanno dopo il `return` condizionale:

```tsx
function GuestBoard({ stage, assetUrls, born }: Pick<Props, 'stage' | 'assetUrls' | 'born'>) {
  const tilt = useStageTilt();
  return <StageBoard stage={stage} assetUrls={assetUrls} born={born} boardRef={tilt.ref} />;
}
```

  e usarlo al posto della `StageBoard` dell'ospite.

- [ ] **Step 6: Run the stage tests, typecheck and lint**

Run: `npx vitest run tests/unit/stage-tilt.test.tsx tests/unit/stage-polish.test.tsx tests/unit/gesture-actions.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/stage/tilt.ts apps/web/src/lib/stage/use-gestures.ts apps/web/src/app/room/[code]/stage-board.tsx apps/web/src/app/room/[code]/stage-area.tsx tests/unit/stage-tilt.test.tsx
git commit -m "feat(stage): windows tilt toward the pointer or the pinching hand"
```

---

### Task 5: Alone della voce

**Files:**
- Create: `packages/realtime/src/audio-levels.ts`
- Modify: `packages/realtime/src/types.ts`, `packages/realtime/src/livekit-session.ts`
- Create: `apps/web/src/lib/call/use-audio-level.ts`
- Modify: `packages/ui/src/face-tile.tsx`
- Modify: `apps/web/src/app/room/[code]/video-tile.tsx`, `room-call.tsx`
- Test: `tests/unit/audio-levels.test.ts`, `tests/unit/ui-surfaces.test.tsx`, `tests/unit/call-audio-level.test.tsx`

**Interfaces:**
- Consumes: utility `voice-glow` (Task 1), che legge `--level`.
- Produces:
  - `type AudioLevels = Record<string, number>` (in `types.ts`, esportato dal pacchetto)
  - `RealtimeSession.onAudioLevels(handler: (levels: AudioLevels) => void): Unsubscribe`
  - `AUDIO_LEVEL_INTERVAL_MS = 125`, `quantizeLevel(raw: number): number`,
    `createLevelTracker(): (speakers: ReadonlyArray<{ identity: string; audioLevel: number }>) => AudioLevels | null`
  - `useAudioLevel(subscribe: RealtimeSession['onAudioLevels'] | undefined, identity: string): number`
  - `FaceTile` accetta `level?: number`; `VideoTile` accetta `onAudioLevels?: RealtimeSession['onAudioLevels']`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/audio-levels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLevelTracker, quantizeLevel } from '../../packages/realtime/src/audio-levels';

describe('quantizeLevel', () => {
  it('lifts quiet speech and rounds to tenths', () => {
    // La voce normale sta fra 0,05 e 0,3: la radice la porta a metà scala.
    expect(quantizeLevel(0.09)).toBe(0.3);
    expect(quantizeLevel(0.25)).toBe(0.5);
    expect(quantizeLevel(1)).toBe(1);
  });
  it('stays within 0 and 1 for any input', () => {
    expect(quantizeLevel(-1)).toBe(0);
    expect(quantizeLevel(Number.NaN)).toBe(0);
    expect(quantizeLevel(4)).toBe(1);
  });
});

describe('createLevelTracker', () => {
  it('emits only when a level changes', () => {
    const track = createLevelTracker();
    expect(track([{ identity: 'a', audioLevel: 0.25 }])).toEqual({ a: 0.5 });
    expect(track([{ identity: 'a', audioLevel: 0.26 }])).toBeNull();
    expect(track([{ identity: 'a', audioLevel: 0.64 }])).toEqual({ a: 0.8 });
  });
  it('drops who stopped speaking once, then stays silent', () => {
    const track = createLevelTracker();
    track([{ identity: 'a', audioLevel: 0.25 }]);
    expect(track([])).toEqual({});
    expect(track([])).toBeNull();
  });
  it('leaves out speakers whose level rounds to zero', () => {
    const track = createLevelTracker();
    expect(track([{ identity: 'a', audioLevel: 0.001 }])).toBeNull();
  });
});
```

Create `tests/unit/call-audio-level.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioLevels } from '@omnicanvas/realtime';
import { useAudioLevel } from '@/lib/call/use-audio-level';

afterEach(cleanup);

describe('useAudioLevel', () => {
  it('follows the level of one person and falls to zero when absent', () => {
    let emit: (levels: AudioLevels) => void = () => {};
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((handler: (levels: AudioLevels) => void) => {
      emit = handler;
      return unsubscribe;
    });
    const { result, unmount } = renderHook(() => useAudioLevel(subscribe, 'anna'));
    expect(result.current).toBe(0);
    act(() => emit({ anna: 0.6, marco: 0.2 }));
    expect(result.current).toBe(0.6);
    act(() => emit({ marco: 0.4 }));
    expect(result.current).toBe(0);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
  it('stays at zero without a session', () => {
    const { result } = renderHook(() => useAudioLevel(undefined, 'anna'));
    expect(result.current).toBe(0);
  });
});
```

In `tests/unit/ui-surfaces.test.tsx`, dentro `describe('FaceTile', …)`:

```tsx
  it('lets the glow follow the voice while speaking, only when motion is welcome', () => {
    const { container } = render(<FaceTile name="Anna" speaking micOn level={0.6} />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.getPropertyValue('--level')).toBe('0.6');
    expect(tile.className).toContain('motion-safe:voice-glow');
    expect(tile.className).toContain('ring-accent');
  });
  it('has no voice glow when silent', () => {
    const { container } = render(<FaceTile name="Anna" speaking={false} micOn level={0.6} />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.getPropertyValue('--level')).toBe('');
    expect(tile.className).not.toContain('voice-glow');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/audio-levels.test.ts tests/unit/call-audio-level.test.tsx tests/unit/ui-surfaces.test.tsx`
Expected: FAIL — moduli `audio-levels` e `use-audio-level` non trovati; `--level` assente.

- [ ] **Step 3: Implement the realtime part**

`packages/realtime/src/types.ts`: dopo `RosterEntry`:

```ts
// Volume di chi parla, 0-1 a passi di 0,1. Chi non compare è in silenzio. Solo in memoria.
export type AudioLevels = Record<string, number>;
```

e nell'interfaccia `RealtimeSession`, dopo `onDisconnected`:

```ts
  // Circa 8 volte al secondo, solo quando qualcosa cambia (alone della voce).
  onAudioLevels(handler: (levels: AudioLevels) => void): Unsubscribe;
```

Create `packages/realtime/src/audio-levels.ts`:

```ts
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
```

`packages/realtime/src/livekit-session.ts`:

- import: `import { AUDIO_LEVEL_INTERVAL_MS, createLevelTracker } from './audio-levels';` e
  `AudioLevels` nell'import dei tipi.
- accanto agli altri `Set` di handler:

```ts
  const levelHandlers = new Set<(levels: AudioLevels) => void>();
  const trackLevels = createLevelTracker();
  // Si campiona solo se qualcuno ascolta; il numero non lascia mai la memoria.
  const levelTimer = setInterval(() => {
    if (levelHandlers.size === 0) return;
    const levels = trackLevels(
      room.activeSpeakers.map((p) => ({ identity: p.identity, audioLevel: p.audioLevel })),
    );
    if (levels) levelHandlers.forEach((handler) => handler(levels));
  }, AUDIO_LEVEL_INTERVAL_MS);
```

- nell'handler di `RoomEvent.Disconnected` e nel `catch` di `room.connect`, prima di
  `audioSink.remove()`: `clearInterval(levelTimer);`
- nell'oggetto restituito, dopo `onDisconnected`:
  `onAudioLevels: (handler) => subscribe(levelHandlers, handler),`

- [ ] **Step 4: Implement the UI part**

Create `apps/web/src/lib/call/use-audio-level.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import type { RealtimeSession } from '@omnicanvas/realtime';

// Un volto alla volta: si ridisegna solo la tessera di chi cambia volume, non la call.
export function useAudioLevel(
  subscribe: RealtimeSession['onAudioLevels'] | undefined,
  identity: string,
): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!subscribe) return;
    const unsubscribe = subscribe((levels) => setLevel(levels[identity] ?? 0));
    return () => {
      unsubscribe();
      setLevel(0);
    };
  }, [subscribe, identity]);
  return level;
}
```

`packages/ui/src/face-tile.tsx`:

- `Props` aggiunge `level?: number;` (commento: `// 0-1: l'alone di chi parla segue la voce.`)
- firma con `level`; il `<div>` diventa:

```tsx
    <div
      data-speaking={speaking ? 'true' : 'false'}
      style={speaking && level !== undefined ? ({ '--level': String(level) } as CSSProperties) : undefined}
      className={cx(
        'relative overflow-hidden rounded-tile bg-raised',
        'motion-safe:transition-shadow motion-safe:duration-200',
        speaking ? 'ring-2 ring-accent' : 'ring-0',
        speaking && level !== undefined && 'motion-safe:voice-glow',
        className,
      )}
    >
```

  con `import type { CSSProperties, ReactNode } from 'react';`. Se `cx` non accetta `false`,
  usare `speaking && level !== undefined ? 'motion-safe:voice-glow' : undefined`.

`apps/web/src/app/room/[code]/video-tile.tsx`:

- import: `import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';` e
  `import { useAudioLevel } from '@/lib/call/use-audio-level';`
- `Props` aggiunge `onAudioLevels?: RealtimeSession['onAudioLevels'] | undefined;`
- nel corpo: `const level = useAudioLevel(onAudioLevels, entry.identity);`
- `<FaceTile … level={level}>`

`apps/web/src/app/room/[code]/room-call.tsx`: a ogni `<VideoTile …>` aggiungere
`onAudioLevels={session?.onAudioLevels}`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/audio-levels.test.ts tests/unit/call-audio-level.test.tsx tests/unit/ui-surfaces.test.tsx tests/unit/roster.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/realtime/src/audio-levels.ts packages/realtime/src/types.ts packages/realtime/src/livekit-session.ts apps/web/src/lib/call/use-audio-level.ts packages/ui/src/face-tile.tsx apps/web/src/app/room/[code]/video-tile.tsx apps/web/src/app/room/[code]/room-call.tsx tests/unit/audio-levels.test.ts tests/unit/call-audio-level.test.tsx tests/unit/ui-surfaces.test.tsx
git commit -m "feat(call): the speaker's glow follows their voice"
```

---

### Task 6: Screenshot, documentazione, verifica completa

**Files:**
- Modify: `e2e/screenshots.spec.ts`
- Modify: `docs/BACKLOG.md`, `CLAUDE.md`

- [ ] **Step 1: Screenshot del palco con finestre**

In `e2e/screenshots.spec.ts`, nel test `redesign screenshots`, dopo il clic su «Aggiungi grafico
di prova», aggiungere una seconda finestra così il palco mostra luce, ombre e l'alone
dell'attiva:

```ts
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
```

e aggiungere alla lista `shots`, come primo elemento:

```ts
    ['depth-host-1440', host, { width: 1440, height: 900 }],
```

- [ ] **Step 2: Documentazione**

`docs/BACKLOG.md`: nella sezione del redesign, segnare «Profondità (A)» come in corso su
`slice/profondita` e aggiungere come voci future «Spazio» (scena 3D) e «Olografico» (WebGL,
dopo lo spike CPU), scia dell'agente al lavoro, accensione all'ingresso in call.

`CLAUDE.md`, sezione «Stato attuale»: sostituire la frase su `slice/redesign-call` (PR #9) e
`slice/accesso-dashboard` con: redesign della call e del palco (PR #9) e accesso e dashboard
(PR #10) in `main` dal 30/09; profondità della call (luce, grana, finestre vive, nascita,
aggancio, alone della voce) su `slice/profondita`, spec
`docs/specs/2026-09-30-profondita-call-design.md`.

- [ ] **Step 3: Full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto verde. Gli e2e girano in CI (job `e2e`) alla PR; nessuno va modificato.

- [ ] **Step 4: Commit**

```bash
git add e2e/screenshots.spec.ts docs/BACKLOG.md CLAUDE.md
git commit -m "docs: depth slice status; screenshot of the lit stage"
```
