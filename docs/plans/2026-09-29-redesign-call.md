# Redesign della call e del palco (Nod) — piano di implementazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, task per task. I passi usano le caselle
> (`- [ ]`) per il tracciamento.

**Obiettivo:** dare alla call e al palco la veste «Palco» di Nod (antracite, lime, Manrope,
laboratorio dell'host a sinistra) senza cambiare nessun comportamento.

**Architettura:** i token vivono in `packages/ui/src/theme.css` dentro `@theme` di
Tailwind v4; `packages/ui` offre cinque componenti di sola presentazione (`Logo`, `Button`,
`Panel`, `FaceTile`, `StatusBanner`); le schermate in `apps/web/src/app/room/[code]/` si
ridisegnano sul posto. Il guscio della stanza diventa una griglia con quattro aree
(`banner`, `faces`, `main`, `dock`) che in orizzontale su telefono si ridispone.

**Stack:** Next.js 16 App Router, React 19, Tailwind v4, Vitest 5 (Vite 8, oxc),
Playwright, `next/font/google` (Manrope), happy-dom e Testing Library per i componenti.

**Spec:** `docs/specs/2026-09-29-redesign-call-design.md`

Branch: `slice/redesign-call` (già creato da `main`, contiene la spec).

## Vincoli globali

- Colori solo dai token: `bg #282828`, `surface #303030`, `stage #202020`, `raised #3a3a3a`,
  `line #3d3d3d`, `fg #ededed` (il token `text` della spec; si chiama `fg` per evitare la
  classe `text-text`), `muted #a6a6a6`, `accent #c8f25a`, `on-accent #202020`,
  `danger #ff6b6b`. Nessun esadecimale né classe `neutral-*`, `emerald-*`, `amber-*`,
  `red-*` nelle schermate toccate.
- Raggi: `rounded-tile` 10px (finestre, tessere), `rounded-panel` 14px (pannelli),
  `rounded-full` per le pillole.
- Carattere: Manrope via `next/font/google`, variabile `--font-manrope`.
- Il lime indica solo ciò che è vivo: chi parla, agente al lavoro, finestra in primo piano,
  gesture armate, azione principale dell'agente.
- Transizioni 150-200 ms con `motion-safe:`; nessuna animazione senza quel prefisso.
- `packages/ui` non importa da `apps/web`, `@omnicanvas/db`, `@omnicanvas/ai`,
  `@omnicanvas/realtime`.
- **Nomi accessibili invariati.** Gli e2e li usano; restano identici: banner, `Host` /
  `Ospite` (testo esatto), `complementary` «Partecipanti», `region` «Palco», «Vassoio»,
  «Finestra in primo piano», «Finestra che stai guardando», `article` con il titolo della
  finestra, pulsanti «Nuova finestra», «Finestra precedente», «Finestra successiva»,
  «Metti in primo piano», «Archivia finestra», «Torna all'host», «Chiedi all'agente»,
  «Invia», «✋ Attiva le gesture», «✋ Metti in pausa le gesture», «Disattiva/Attiva
  microfono», «Disattiva/Attiva camera», «Gira fotocamera», «Riquadro», «Esci», «Attiva
  l'audio», «Riprova», «Chiudi tutto schermo», «Mostra <nome> a tutto schermo», le quattro
  «Aggiungi … di prova», il campo «Cosa ti serve?», i combobox «Metti «…» in una
  finestra», i testi «Crediti: N», «Connessione persa, riprovo…» e i messaggi delle gesture.
- Un solo elemento con `role="status"` alla volta nella pagina (l'e2e usa
  `getByRole('status')` in modalità strict).
- Ogni gesto conserva il suo click equivalente (ADR-0005).
- Commenti in italiano, codice e messaggi di commit in inglese, commit con la riga
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Focus della revisione

1. **Portatile da 13" (1280×720)**: il laboratorio non deve schiacciare il palco sotto
   l'utilizzabile → sotto `xl` il laboratorio è largo 240px, da `xl` 280px (Task 5,
   screenshot a 1280×720 nel Task 7).
2. **Telefono in orizzontale**: la barra alta sparisce e i volti diventano una colonna a
   destra larga almeno 90px con «Esci» visibile → l'e2e esistente
   `mobile-call.spec.ts` resta verde (Task 4).
3. **Due `role="status"` insieme** (fase di connessione e agente al lavoro) romperebbero
   `getByRole('status')` → l'agente al lavoro non usa `role="status"`; test in Task 3 su
   `StatusBanner` con `live="none"` (Task 3, Task 5).
4. **Contrasto**: `muted` su `raised` e il testo sopra il lime devono stare sopra 4,5:1 →
   test che calcola i rapporti dai valori di `theme.css` (Task 1).
5. **Nome molto lungo o vuoto sulla tessera volto**: iniziale sempre visibile, mai
   stringa vuota → test su `FaceTile` con nome vuoto e con spazi (Task 3).

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `packages/ui/package.json`, `tsconfig.json` | nuovo pacchetto `@omnicanvas/ui` |
| `packages/ui/src/theme.css` | token Tailwind (`@theme`) |
| `packages/ui/src/cx.ts` | unione di classi |
| `packages/ui/src/logo.tsx` | segnaposto del logo |
| `packages/ui/src/button.tsx` | pulsante a pillola con varianti |
| `packages/ui/src/panel.tsx` | superficie di pannelli e barre |
| `packages/ui/src/face-tile.tsx` | riquadro del volto |
| `packages/ui/src/status-banner.tsx` | avvisi sopra il palco |
| `packages/ui/src/index.ts` | esportazioni |
| `apps/web/src/app/globals.css`, `layout.tsx` | import del tema, font, titolo |
| `apps/web/src/app/room/[code]/room-shell.tsx` | griglia della stanza e barra alta |
| `apps/web/src/app/room/[code]/room-call.tsx` | volti, palco, avvisi, controlli |
| `apps/web/src/app/room/[code]/video-tile.tsx` | tessera volto nella striscia |
| `apps/web/src/app/room/[code]/stage-area.tsx` | laboratorio e barra del palco |
| `apps/web/src/app/room/[code]/agent-panel.tsx`, `tray.tsx`, `gesture-control.tsx` | blocchi del laboratorio |
| `apps/web/src/app/room/[code]/stage-board.tsx`, `window-view.tsx`, `content-view.tsx` | palco e finestre |
| `apps/web/src/app/room/[code]/mobile-stage.tsx`, `spotlight-view.tsx` | telefono e spotlight |
| `apps/web/src/app/room/[code]/guest-join-form.tsx`, `ended.tsx` | pagine di passaggio |
| `apps/web/src/lib/stage/stage-counter.ts` | «Finestra N di M» (funzione pura) |
| `tests/unit/ui-*.test.tsx`, `tests/unit/stage-counter.test.ts` | test |
| `e2e/screenshots.spec.ts` | screenshot per la PR, solo a richiesta |

---

### Task 1: pacchetto `@omnicanvas/ui`, token, font

**File:**
- Crea: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/theme.css`,
  `packages/ui/src/index.ts`
- Modifica: `package.json` (devDependencies), `apps/web/package.json`,
  `apps/web/next.config.ts`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`,
  `vitest.config.ts`, `tsconfig.json`
- Test: `tests/unit/ui-theme.test.ts`

**Interfacce:**
- Produce: classi Tailwind `bg-bg`, `bg-surface`, `bg-stage`, `bg-raised`, `border-line`,
  `text-fg`, `text-muted`, `bg-accent`, `text-accent`, `ring-accent`, `border-accent`,
  `text-on-accent`, `text-danger`, `rounded-tile`, `rounded-panel`, `font-sans` (Manrope).
- Produce: import `@omnicanvas/ui` (da `packages/ui/src/index.ts`) e
  `@omnicanvas/ui/theme.css`.

- [ ] **Passo 1: dipendenze di sviluppo per i test dei componenti**

```bash
npm install -D happy-dom @testing-library/react @testing-library/dom
```

- [ ] **Passo 2: scrivere il test dei token (fallisce: il file non esiste)**

`tests/unit/ui-theme.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`token --color-${name} missing`);
  return match[1];
}

// Rapporto di contrasto WCAG 2.x fra due colori esadecimali.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme tokens', () => {
  it('defines every color of the spec', () => {
    expect(token('bg')).toBe('#282828');
    expect(token('surface')).toBe('#303030');
    expect(token('stage')).toBe('#202020');
    expect(token('raised')).toBe('#3a3a3a');
    expect(token('line')).toBe('#3d3d3d');
    expect(token('fg')).toBe('#ededed');
    expect(token('muted')).toBe('#a6a6a6');
    expect(token('accent')).toBe('#c8f25a');
    expect(token('on-accent')).toBe('#202020');
    expect(token('danger')).toBe('#ff6b6b');
  });

  it('keeps text readable on every surface (WCAG AA, 4.5:1)', () => {
    for (const surface of ['bg', 'surface', 'stage', 'raised']) {
      expect(contrast(token('fg'), token(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token('muted'), token(surface))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token('on-accent'), token('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('danger'), token('bg'))).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Passo 3: eseguire e verificare che fallisca**

Esegui: `npx vitest run tests/unit/ui-theme.test.ts`
Atteso: FAIL con `ENOENT` su `theme.css`.

- [ ] **Passo 4: creare il pacchetto**

`packages/ui/package.json`:

```json
{
  "name": "@omnicanvas/ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./theme.css": "./src/theme.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^19"
  }
}
```

`packages/ui/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`packages/ui/src/theme.css`:

```css
/* Token di Nod (spec 2026-09-29, §1). Unica fonte dei colori: nelle schermate niente
   esadecimali. Il token «text» della spec qui si chiama fg (classe text-fg). */
@theme {
  --color-bg: #282828;
  --color-surface: #303030;
  --color-stage: #202020;
  --color-raised: #3a3a3a;
  --color-line: #3d3d3d;
  --color-fg: #ededed;
  --color-muted: #a6a6a6;
  --color-accent: #c8f25a;
  --color-on-accent: #202020;
  --color-danger: #ff6b6b;

  --radius-tile: 10px;
  --radius-panel: 14px;

  --font-sans: var(--font-manrope), system-ui, sans-serif;
}
```

`packages/ui/src/index.ts` (per ora vuoto di componenti):

```ts
// Design system di Nod: solo presentazione, nessun dato (ARCHITECTURE, confini).
export {};
```

- [ ] **Passo 5: collegare il pacchetto all'app**

In `apps/web/package.json`, dentro `dependencies`, aggiungere in ordine alfabetico:

```json
    "@omnicanvas/ui": "^0.0.0",
```

In `apps/web/next.config.ts`:

```ts
  transpilePackages: [
    "@omnicanvas/realtime",
    "@omnicanvas/canvas",
    "@omnicanvas/ai",
    "@omnicanvas/gesture",
    "@omnicanvas/ui",
  ],
```

Poi `npm install` alla radice per creare il link del workspace.

`apps/web/src/app/globals.css` (sostituisce tutto il file):

```css
@import "tailwindcss";
@import "@omnicanvas/ui/theme.css";

/* Tailwind deve leggere le classi usate dentro packages/ui. */
@source "../../../../packages/ui/src";

/* Telefono in orizzontale: altezza bassa, non tablet né desktop. */
@custom-variant phone-landscape (@media (orientation: landscape) and (max-height: 500px));

body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
}

/* Cifre della stessa larghezza: i numeri dei grafici e dei crediti restano allineati. */
.tabular {
  font-variant-numeric: tabular-nums;
}
```

`apps/web/src/app/layout.tsx` (sostituisce tutto il file):

```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '600', '800'],
});

export const metadata: Metadata = {
  title: 'Nod',
  description:
    'Videochiamate con un palco generativo. Nessun contenuto resta sui nostri server.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Passo 6: preparare Vitest ai file `.tsx`**

In `vitest.config.ts` cambiare `include` e aggiungere la trasformazione JSX automatica:

```ts
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
```

(`oxc` sta allo stesso livello di `resolve` e `test`.) In `tsconfig.json` alla radice:

```json
  "compilerOptions": {
    "types": ["node"],
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["apps/web/src/*"] }
  },
  "include": ["tests/**/*.ts", "tests/**/*.tsx", "e2e/**/*.ts", "vitest.config.ts", "playwright.config.ts"]
```

- [ ] **Passo 7: verificare**

Esegui: `npx vitest run tests/unit/ui-theme.test.ts` → PASS (2 test).
Esegui: `npm run typecheck && npm run lint && npm run build` → tutto verde. Il build prova che
Tailwind risolve `@omnicanvas/ui/theme.css`.

- [ ] **Passo 8: commit**

```bash
git add packages/ui package.json package-lock.json apps/web/package.json apps/web/next.config.ts apps/web/src/app/globals.css apps/web/src/app/layout.tsx vitest.config.ts tsconfig.json tests/unit/ui-theme.test.ts
git commit -m "feat(ui): Nod design tokens, Manrope and the @omnicanvas/ui package"
```

---

### Task 2: `Logo` e `Button`

**File:**
- Crea: `packages/ui/src/cx.ts`, `packages/ui/src/logo.tsx`, `packages/ui/src/button.tsx`
- Modifica: `packages/ui/src/index.ts`
- Test: `tests/unit/ui-button.test.tsx`

**Interfacce:**
- Produce: `cx(...parts: Array<string | false | null | undefined>): string`
- Produce: `Logo({ className? }: { className?: string })` → `<span role="img" aria-label="Nod">`
- Produce: `Button(props: ButtonProps)` con
  `type ButtonProps = ComponentPropsWithRef<'button'> & { variant?: 'pill' | 'accent' | 'exit' | 'quiet'; size?: 'sm' | 'md' }`;
  predefiniti `variant='pill'`, `size='md'`, `type='button'`. Con React 19 `ref` è una prop
  normale e arriva al `<button>` tramite `...rest`.

- [ ] **Passo 1: scrivere i test**

`tests/unit/ui-button.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Logo } from '@omnicanvas/ui';

afterEach(cleanup);

describe('Button', () => {
  it('keeps its text as the accessible name', () => {
    render(<Button>Riquadro</Button>);
    expect(screen.getByRole('button', { name: 'Riquadro' })).toBeTruthy();
  });

  it('is a plain button by default, never a form submit by accident', () => {
    render(<Button>Esci</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('marks the accent variant with the lime background', () => {
    render(<Button variant="accent">Chiedi all&apos;agente</Button>);
    expect(screen.getByRole('button').className).toContain('bg-accent');
  });

  it('passes aria-pressed through for toggles', () => {
    render(<Button aria-pressed>✋ Metti in pausa le gesture</Button>);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('merges extra classes', () => {
    render(<Button className="w-full">Invia</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });
});

describe('Logo', () => {
  it('is announced as Nod', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Nod' })).toBeTruthy();
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Esegui: `npx vitest run tests/unit/ui-button.test.tsx`
Atteso: FAIL, `Button` e `Logo` non sono esportati.

- [ ] **Passo 3: implementare**

`packages/ui/src/cx.ts`:

```ts
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

`packages/ui/src/logo.tsx`:

```tsx
import { cx } from './cx';

// Segnaposto finché non arriva l'SVG definitivo di Sean: la finestra con le quattro
// maniglie e la scritta «nod». Sostituirlo tocca solo questo file.
export function Logo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Nod" className={cx('inline-flex items-center gap-1.5', className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
        <rect x="5" y="6" width="14" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="3" cy="3" r="1.8" fill="currentColor" />
        <circle cx="21" cy="3" r="1.8" fill="currentColor" />
        <circle cx="3" cy="21" r="1.8" fill="currentColor" />
        <circle cx="21" cy="21" r="1.8" fill="currentColor" />
      </svg>
      <span aria-hidden className="text-lg font-extrabold tracking-tight">
        nod
      </span>
    </span>
  );
}
```

`packages/ui/src/button.tsx`:

```tsx
import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'pill' | 'accent' | 'exit' | 'quiet';
  size?: 'sm' | 'md';
};

const VARIANTS = {
  pill: 'bg-raised text-fg hover:bg-line',
  accent: 'bg-accent text-on-accent hover:brightness-95',
  exit: 'bg-fg text-bg hover:brightness-90',
  quiet: 'bg-transparent text-muted hover:text-fg',
} as const;

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  // 44px di altezza minima: il pollice su telefono (spec §3).
  md: 'min-h-11 px-4 py-2 text-sm',
} as const;

export function Button({ variant = 'pill', size = 'md', type = 'button', className, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold',
        'motion-safe:transition-colors motion-safe:duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}
```

`packages/ui/src/index.ts`:

```ts
// Design system di Nod: solo presentazione, nessun dato (ARCHITECTURE, confini).
export { cx } from './cx';
export { Logo } from './logo';
export { Button, type ButtonProps } from './button';
```

- [ ] **Passo 4: verificare**

Esegui: `npx vitest run tests/unit/ui-button.test.tsx` → PASS (6 test).
Se fallisce con «React is not defined», il passo 6 del Task 1 non è stato applicato.
Esegui: `npm run typecheck && npm run lint`.

- [ ] **Passo 5: commit**

```bash
git add packages/ui/src tests/unit/ui-button.test.tsx
git commit -m "feat(ui): Logo placeholder and pill Button"
```

---

### Task 3: `Panel`, `FaceTile`, `StatusBanner`

**File:**
- Crea: `packages/ui/src/panel.tsx`, `packages/ui/src/face-tile.tsx`,
  `packages/ui/src/status-banner.tsx`
- Modifica: `packages/ui/src/index.ts`
- Test: `tests/unit/ui-surfaces.test.tsx`

**Interfacce:**
- Consuma: `cx` (Task 2).
- Produce: `Panel({ as?: 'div' | 'section' | 'nav', tone?: 'surface' | 'stage', className?, children, ...aria })`
  — `HTMLAttributes<HTMLElement>` più `as` e `tone`; predefiniti `as='div'`, `tone='surface'`.
- Produce: `FaceTile({ name: string; speaking: boolean; micOn: boolean; className?: string; children?: ReactNode })`
  — riquadro visivo, mai un landmark; `data-speaking` vale `"true"`/`"false"`.
- Produce: `faceInitial(name: string): string` — prima lettera maiuscola, `'?'` se vuoto.
- Produce: `StatusBanner({ tone?: 'info' | 'warning' | 'error'; live?: 'status' | 'alert' | 'none'; action?: ReactNode; children })`
  — predefiniti `tone='info'`, `live='status'`.

- [ ] **Passo 1: scrivere i test**

`tests/unit/ui-surfaces.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FaceTile, Panel, StatusBanner, faceInitial } from '@omnicanvas/ui';

afterEach(cleanup);

describe('Panel', () => {
  it('renders the requested element with its label', () => {
    render(<Panel as="section" aria-label="Laboratorio">x</Panel>);
    expect(screen.getByRole('region', { name: 'Laboratorio' }).className).toContain('bg-surface');
  });
  it('uses the darker stage tone for the stage', () => {
    render(<Panel tone="stage" data-testid="p">x</Panel>);
    expect(screen.getByTestId('p').className).toContain('bg-stage');
  });
});

describe('FaceTile', () => {
  it('shows the initial when there is no video', () => {
    render(<FaceTile name="anna" speaking={false} micOn />);
    expect(screen.getByText('A')).toBeTruthy();
  });
  it('never shows an empty initial, even for a blank name', () => {
    expect(faceInitial('   ')).toBe('?');
    expect(faceInitial('')).toBe('?');
  });
  it('rings the tile in lime while that person speaks', () => {
    const { container } = render(<FaceTile name="Anna" speaking micOn />);
    const tile = container.firstElementChild!;
    expect(tile.getAttribute('data-speaking')).toBe('true');
    expect(tile.className).toContain('ring-accent');
  });
  it('shows the video instead of the initial when given', () => {
    render(
      <FaceTile name="Anna" speaking={false} micOn>
        <video data-testid="v" />
      </FaceTile>,
    );
    expect(screen.getByTestId('v')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
  });
  it('marks a muted microphone without adding an accessible name', () => {
    const { container } = render(<FaceTile name="Anna" speaking={false} micOn={false} />);
    expect(container.querySelector('[data-muted]')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('StatusBanner', () => {
  it('announces connection messages politely', () => {
    render(<StatusBanner>Connessione persa, riprovo…</StatusBanner>);
    expect(screen.getByRole('status').textContent).toContain('Connessione persa');
  });
  it('uses an alert for errors', () => {
    render(<StatusBanner tone="error" live="alert">Camera non disponibile</StatusBanner>);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('can stay silent, so two statuses never compete', () => {
    render(<StatusBanner live="none">L&apos;agente sta lavorando…</StatusBanner>);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('renders its action next to the message', () => {
    render(<StatusBanner action={<button>Riprova</button>}>Non riesco a ricollegarmi.</StatusBanner>);
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy();
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Esegui: `npx vitest run tests/unit/ui-surfaces.test.tsx` → FAIL, componenti non esportati.

- [ ] **Passo 3: implementare**

`packages/ui/src/panel.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cx } from './cx';

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'nav';
  tone?: 'surface' | 'stage';
};

export function Panel({ as: Tag = 'div', tone = 'surface', className, ...rest }: PanelProps) {
  return (
    <Tag
      className={cx('rounded-panel', tone === 'surface' ? 'bg-surface' : 'bg-stage', className)}
      {...rest}
    />
  );
}
```

`packages/ui/src/face-tile.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from './cx';

export function faceInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

type Props = {
  name: string;
  speaking: boolean;
  micOn: boolean;
  className?: string;
  children?: ReactNode;
};

// Solo il riquadro: nome accessibile e ruolo li mette chi lo usa (la lista dei partecipanti).
export function FaceTile({ name, speaking, micOn, className, children }: Props) {
  return (
    <div
      data-speaking={speaking ? 'true' : 'false'}
      className={cx(
        'relative overflow-hidden rounded-tile bg-raised',
        'motion-safe:transition-shadow motion-safe:duration-200',
        speaking ? 'ring-2 ring-accent' : 'ring-0',
        className,
      )}
    >
      {children ?? (
        <span aria-hidden className="flex h-full w-full items-center justify-center font-extrabold">
          {faceInitial(name)}
        </span>
      )}
      {!micOn && (
        <span
          data-muted
          aria-hidden="true"
          className="absolute bottom-1 right-1 rounded-full bg-bg/80 px-1 text-[10px] leading-4 text-muted"
        >
          🔇
        </span>
      )}
    </div>
  );
}
```

`packages/ui/src/status-banner.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from './cx';

type Props = {
  tone?: 'info' | 'warning' | 'error';
  // «none» per i messaggi che non devono competere con lo stato della connessione.
  live?: 'status' | 'alert' | 'none';
  action?: ReactNode;
  children: ReactNode;
};

const TONES = {
  info: 'border-line text-fg',
  warning: 'border-accent text-fg',
  error: 'border-danger text-danger',
} as const;

export function StatusBanner({ tone = 'info', live = 'status', action, children }: Props) {
  return (
    <div
      role={live === 'none' ? undefined : live}
      className={cx(
        'flex flex-wrap items-center gap-3 rounded-tile border bg-surface px-3 py-2 text-sm',
        TONES[tone],
      )}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
```

`packages/ui/src/index.ts` — aggiungere:

```ts
export { Panel } from './panel';
export { FaceTile, faceInitial } from './face-tile';
export { StatusBanner } from './status-banner';
```

- [ ] **Passo 4: verificare**

Esegui: `npx vitest run tests/unit/ui-surfaces.test.tsx` → PASS (11 test).
Esegui: `npm run typecheck && npm run lint`.

- [ ] **Passo 5: commit**

```bash
git add packages/ui/src tests/unit/ui-surfaces.test.tsx
git commit -m "feat(ui): Panel, FaceTile and StatusBanner"
```

---

### Task 4: guscio della stanza — barra alta, volti, controlli

**File:**
- Modifica: `apps/web/src/app/room/[code]/room-shell.tsx`, `room-call.tsx`, `video-tile.tsx`
- Test: e2e esistenti (`e2e/host-guest.spec.ts`, `e2e/call.spec.ts`, `e2e/mobile-call.spec.ts`)

**Interfacce:**
- Consuma: `Logo`, `Button`, `FaceTile`, `StatusBanner` (Task 2-3).
- Produce: aree di griglia `banner`, `faces`, `main`, `dock` sulla radice di `RoomShell`;
  `RoomCall` restituisce figli diretti del frammento con `[grid-area:faces]`,
  `[grid-area:main]`, `[grid-area:dock]`.

- [ ] **Passo 1: griglia e barra alta in `room-shell.tsx`**

Sostituire il `return` di `RoomShell`:

```tsx
  return (
    // Griglia a quattro aree: in orizzontale su telefono la barra sparisce e i volti
    // diventano la colonna a destra (spec §3).
    <div
      className={[
        'grid h-dvh grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] bg-bg text-fg',
        "[grid-template-areas:'banner_faces'_'main_main'_'dock_dock']",
        'phone-landscape:grid-rows-[minmax(0,1fr)_auto]',
        "phone-landscape:[grid-template-areas:'main_faces'_'dock_faces']",
      ].join(' ')}
    >
      <header className="flex min-w-0 items-center gap-3 px-4 py-2 [grid-area:banner] phone-landscape:hidden">
        <Logo />
        <h1 className="hidden truncate text-sm font-semibold sm:block">{title}</h1>
        <span className="hidden items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-muted md:inline-flex">
          <span aria-hidden>🔒</span> Niente viene conservato
        </span>
        <span className="hidden truncate text-xs text-muted lg:inline">{displayName}</span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-semibold">
          {role === 'host' ? 'Host' : 'Ospite'}
        </span>
      </header>

      <RoomCall joinCode={joinCode} role={role} showSamples={showSamples} />
    </div>
  );
```

Aggiungere l'import `import { Logo } from '@omnicanvas/ui';` e aggiornare il commento sopra
la funzione: «Griglia della stanza: barra alta, volti, palco, controlli (spec redesign §2-3).»

- [ ] **Passo 2: `video-tile.tsx` su `FaceTile`**

Sostituire il corpo di `VideoTile` dal `const face =` in giù:

```tsx
  const face = (
    <FaceTile
      name={entry.name}
      speaking={entry.speaking}
      micOn={entry.micOn}
      className="h-full w-full"
    >
      {entry.camOn ? (
        // Sempre muto: l'audio remoto suona dagli elementi gestiti da packages/realtime.
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
        />
      ) : undefined}
    </FaceTile>
  );

  return (
    <li
      aria-label={tileLabel(entry)}
      title={entry.name}
      className="h-10 w-14 shrink-0 lg:h-12 lg:w-16 phone-landscape:aspect-video phone-landscape:h-auto phone-landscape:w-full"
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Mostra ${entry.name} a tutto schermo`}
          className="block h-full w-full rounded-tile focus-visible:outline-2 focus-visible:outline-accent"
        >
          {face}
        </button>
      ) : (
        face
      )}
    </li>
  );
```

Import: `import { FaceTile } from '@omnicanvas/ui';`. Il nome in sovrimpressione sparisce
dalla tessera: resta nel `title` e nel nome accessibile del `li` (`tileLabel`, invariato).

- [ ] **Passo 3: `room-call.tsx` — volti, palco, avvisi, controlli**

Nel `return` di `RoomCall`, il frammento diventa quattro figli diretti. Sostituire dal
`<div className="relative flex min-h-0 flex-1">` fino alla chiusura del `<nav>` con:

```tsx
      <aside
        aria-label="Partecipanti"
        className="flex items-center px-3 py-1.5 [grid-area:faces] phone-landscape:w-24 phone-landscape:items-start phone-landscape:overflow-y-auto phone-landscape:p-2"
      >
        <ul className="flex gap-2 phone-landscape:w-full phone-landscape:flex-col">
          {state.roster.map((entry) => (
            <VideoTile
              key={entry.identity}
              entry={entry}
              attachVideo={attachVideo}
              onSelect={entry.isLocal ? undefined : () => setSelected(entry.identity)}
              mirrored={isMirrored(entry, state.cameraFacing)}
            />
          ))}
        </ul>
      </aside>

      <div className="relative flex min-h-0 [grid-area:main]">
        <section
          aria-label="Palco"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-3 pb-2 lg:px-4"
        >
          {message && (
            <StatusBanner
              tone={state.phase === 'failed' ? 'error' : 'info'}
              action={
                state.phase === 'failed' ? (
                  <Button size="sm" onClick={retry}>
                    Riprova
                  </Button>
                ) : state.phase === 'left' || state.phase === 'forbidden' ? (
                  <a href={`/room/${joinCode}`} className="text-sm underline">
                    Rientra
                  </a>
                ) : undefined
              }
            >
              {message}
            </StatusBanner>
          )}
          {state.mediaError && live && (
            <StatusBanner tone="error" live="alert">
              {state.mediaError}
            </StatusBanner>
          )}
          {state.audioBlocked && live && (
            <StatusBanner
              tone="warning"
              live="none"
              action={
                <Button size="sm" variant="accent" onClick={startAudio}>
                  Attiva l&apos;audio
                </Button>
              }
            >
              Il browser ha fermato l&apos;audio della call.
            </StatusBanner>
          )}
          {live && (
            <StageArea
              joinCode={joinCode}
              session={session}
              cameraOn={local?.camOn ?? false}
              role={role}
              showSamples={showSamples}
              stage={stageApi.stage}
              ready={stageApi.ready}
              assetUrls={stageApi.assetUrls}
              dispatch={stageApi.dispatch}
              addImage={stageApi.addImage}
            />
          )}
        </section>
        {spotlightEntry && (
          <SpotlightView
            entry={spotlightEntry}
            local={local}
            mirrorSelf={local ? isMirrored(local, state.cameraFacing) : false}
            attachVideo={attachVideo}
            onClose={closeSpotlight}
          />
        )}
      </div>

      {live && (
        <PipVideo
          identity={pipIdentity}
          name={pipEntry?.name ?? ''}
          camOn={pipEntry?.camOn ?? false}
          attachVideo={attachVideo}
          videoRef={pipRef}
        />
      )}

      {live ? (
        <nav
          aria-label="Controlli della chiamata"
          className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 [grid-area:dock] phone-landscape:py-1"
        >
          <Button onClick={toggleMic} aria-pressed={!local?.micOn}>
            {micButtonLabel(local?.micOn ?? false)}
          </Button>
          <Button onClick={toggleCamera} aria-pressed={!local?.camOn}>
            {cameraButtonLabel(local?.camOn ?? false)}
          </Button>
          {state.canSwitchCamera && <Button onClick={switchCamera}>Gira fotocamera</Button>}
          {pipSupported && pipIdentity && (
            <Button
              onClick={() => {
                if (pipRef.current) void openPip(document, pipRef.current).catch(() => {});
              }}
            >
              Riquadro
            </Button>
          )}
          <Button variant="exit" onClick={handleLeave}>
            Esci
          </Button>
        </nav>
      ) : (
        <div className="[grid-area:dock]" />
      )}
```

Il blocco `<PipVideo …>` è quello di oggi (è `position: fixed`, non occupa celle).
Gli elementi che stavano dentro la vecchia `section` (messaggi, `StageArea`, spotlight)
sono gli stessi; cambia solo il contenitore. Import:
`import { Button, StatusBanner } from '@omnicanvas/ui';`.

- [ ] **Passo 4: verificare**

Esegui: `npm run typecheck && npm run lint && npm run test:unit`.
Esegui gli e2e nel Codespace (Docker locale non gira):
`npx playwright test e2e/host-guest.spec.ts e2e/call.spec.ts e2e/mobile-call.spec.ts`
Atteso: PASS. In particolare `mobile-call.spec.ts` verifica banner nascosto, colonna
«Partecipanti» a destra larga almeno 90px ed «Esci» visibile a 915×412.

- [ ] **Passo 5: commit**

```bash
git add "apps/web/src/app/room/[code]/room-shell.tsx" "apps/web/src/app/room/[code]/room-call.tsx" "apps/web/src/app/room/[code]/video-tile.tsx"
git commit -m "feat(call): Nod shell — top bar with faces, status banners, pill controls"
```

---

### Task 5: laboratorio dell'host e barra del palco

**File:**
- Crea: `apps/web/src/lib/stage/stage-counter.ts`
- Modifica: `apps/web/src/app/room/[code]/stage-area.tsx`, `agent-panel.tsx`, `tray.tsx`,
  `gesture-control.tsx`, `stage-board.tsx`, `window-view.tsx`, `content-view.tsx`
- Test: `tests/unit/stage-counter.test.ts`, e2e `e2e/stage.spec.ts`, `e2e/agent.spec.ts`,
  `e2e/gestures.spec.ts`

**Interfacce:**
- Produce: `stageCounter(stage: Pick<Stage, 'windows' | 'focusedId'>): string | null` —
  `"Finestra 2 di 3"`, `null` se non ci sono finestre.
- Modifica: `AgentPanel` perde `open`/`onOpenChange` e riceve `focusRequest: number`
  (ogni incremento porta il cursore nel campo). `StageArea` tiene `const [agentFocus, setAgentFocus] = useState(0)`
  e il gesto «agente» fa `setAgentFocus((n) => n + 1)`.

- [ ] **Passo 1: test del contatore**

`tests/unit/stage-counter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stageCounter } from '@/lib/stage/stage-counter';

const win = (id: string) => ({ id }) as never;

describe('stageCounter', () => {
  it('says which window is in front and how many there are', () => {
    expect(stageCounter({ windows: [win('a'), win('b'), win('c')], focusedId: 'b' })).toBe(
      'Finestra 2 di 3',
    );
  });
  it('is empty without windows', () => {
    expect(stageCounter({ windows: [], focusedId: null })).toBeNull();
  });
  it('falls back to the first window when the focus is unknown', () => {
    expect(stageCounter({ windows: [win('a'), win('b')], focusedId: 'zzz' })).toBe(
      'Finestra 1 di 2',
    );
  });
});
```

Esegui: `npx vitest run tests/unit/stage-counter.test.ts` → FAIL (modulo mancante).

- [ ] **Passo 2: implementare il contatore**

`apps/web/src/lib/stage/stage-counter.ts`:

```ts
import type { Stage } from '@omnicanvas/canvas';

// «Finestra N di M» nella barra del palco: la finestra in primo piano fra quelle aperte.
export function stageCounter(stage: Pick<Stage, 'windows' | 'focusedId'>): string | null {
  const total = stage.windows.length;
  if (total === 0) return null;
  const index = stage.windows.findIndex((w) => w.id === stage.focusedId);
  return `Finestra ${index === -1 ? 1 : index + 1} di ${total}`;
}
```

Esegui di nuovo → PASS (3 test).

- [ ] **Passo 3: `agent-panel.tsx` con campo sempre visibile**

Sostituire la firma e il `return`:

```tsx
export function AgentPanel({
  joinCode,
  dispatch,
  focusRequest,
}: {
  joinCode: string;
  dispatch: (command: StageCommand) => void;
  // Cresce a ogni richiesta di attenzione (pulsante o gesto «indice alzato»).
  focusRequest: number;
}) {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const agent = useAgent({
    joinCode,
    onContent: (content) => {
      dispatch({ type: 'TRAY_ADD', content: toStageContent(content, crypto.randomUUID()) });
      setPrompt('');
    },
  });

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest]);

  return (
    <div className="flex flex-col gap-2">
      <Button variant="accent" size="sm" onClick={() => inputRef.current?.focus()}>
        <span aria-hidden>✦</span> Chiedi all&apos;agente
      </Button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim()) void agent.ask(prompt);
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          Cosa ti serve?
          <input
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={500}
            placeholder="Es. un grafico delle vendite per trimestre"
            className="rounded-tile border border-line bg-stage px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <Button type="submit" size="sm" disabled={agent.busy || !prompt.trim()}>
          Invia
        </Button>
      </form>
      {agent.busy && (
        // Niente role="status": quello è della connessione (un solo status per pagina).
        <div className="flex flex-col gap-1 text-xs text-accent">
          <span>L&apos;agente sta lavorando…</span>
          <span aria-hidden className="h-1 overflow-hidden rounded-full bg-raised">
            <span className="block h-full w-1/2 rounded-full bg-accent motion-safe:animate-pulse" />
          </span>
        </div>
      )}
      {agent.error && <p className="text-xs text-danger">{agent.error}</p>}
      {agent.usage && (
        <p className="tabular text-xs text-muted">
          Crediti: {agent.usage.balance} · agente in questa stanza: {agent.usage.roomCredits}
        </p>
      )}
    </div>
  );
}
```

Import: `useEffect, useRef, useState` da `react`, `Button` da `@omnicanvas/ui`. L'e2e fa
«Chiedi all'agente» → compila «Cosa ti serve?» → «Invia»: il pulsante ora porta il cursore
nel campo invece di aprirlo, e il flusso resta valido.

- [ ] **Passo 4: `gesture-control.tsx`**

Sostituire il `<div className="flex flex-wrap items-center gap-2 text-xs">` e il suo
pulsante con:

```tsx
    <div
      className={`flex flex-col gap-1.5 rounded-tile border p-2 text-xs motion-safe:transition-colors ${
        armed ? 'border-accent' : 'border-line'
      }`}
    >
      <Button size="sm" onClick={onToggle} aria-pressed={armed} variant={armed ? 'accent' : 'pill'}>
        {armed ? '✋ Metti in pausa le gesture' : '✋ Attiva le gesture'}
      </Button>
      {message && <span className="text-muted">{message}</span>}
```

(il resto del componente — video invisibile e cursore — resta com'è; nel cursore sostituire
eventuali classi `emerald-*`/`neutral-*` con `border-accent`/`bg-accent/30`/`border-fg`).

- [ ] **Passo 5: `tray.tsx`**

Classi da sostituire (la struttura e i nomi restano identici):

| Elemento | Nuove classi |
|---|---|
| `section` «Vassoio» | `flex min-h-0 flex-col gap-2` |
| etichetta «Contenuti di prova:» | `text-muted` |
| i quattro pulsanti di prova | `<Button size="sm">` con lo stesso testo |
| testo del vassoio vuoto | `text-xs text-muted` |
| `ul` | `flex flex-col gap-2 overflow-auto` |
| `li` del contenuto | `flex cursor-grab flex-col gap-1 rounded-tile bg-raised p-2 text-xs` |
| sottotitolo del tipo | `text-muted` |
| `select` «Metti in…» | `rounded-full bg-bg px-2 py-1 text-xs text-fg` |

Aggiungere sopra la lista un titoletto
`<h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Vassoio</h2>`.

- [ ] **Passo 6: `stage-area.tsx` — laboratorio e barra del palco**

Nel ramo host (`HostStage`) sostituire lo stato dell'agente e il `return`:

```tsx
  const [agentFocus, setAgentFocus] = useState(0);
  const gestures = useGestures({
    session,
    cameraOn,
    stage,
    dispatch,
    onAgent: () => setAgentFocus((n) => n + 1),
    areaRef,
  });
  const counter = stageCounter(stage);

  return (
    <div ref={areaRef} className="flex h-full min-h-0 gap-3">
      <Panel
        as="section"
        aria-label="Laboratorio"
        className="flex w-60 shrink-0 flex-col gap-4 overflow-auto p-3 xl:w-70"
      >
        <AgentPanel joinCode={joinCode} dispatch={dispatch} focusRequest={agentFocus} />
        <Tray stage={stage} dispatch={dispatch} addImage={addImage} showSamples={showSamples} />
        <div className="mt-auto">
          <GestureControl
            status={gestures.status}
            armed={gestures.armed}
            cursor={gestures.cursor}
            videoRef={gestures.videoRef}
            onToggle={() => void gestures.toggle()}
          />
        </div>
      </Panel>

      <Panel tone="stage" className="flex min-w-0 flex-1 flex-col gap-2 p-2">
        <div className="flex items-center gap-2 text-xs">
          <Button size="sm" onClick={() => dispatch({ type: 'FOCUS_PREV' })} disabled={stage.windows.length < 2}>
            Finestra precedente
          </Button>
          <Button size="sm" onClick={() => dispatch({ type: 'FOCUS_NEXT' })} disabled={stage.windows.length < 2}>
            Finestra successiva
          </Button>
          {counter && <span className="tabular text-muted">{counter}</span>}
          <Button
            size="sm"
            className="ml-auto"
            onClick={() =>
              dispatch({
                type: 'WINDOW_CREATE',
                windowId: crypto.randomUUID(),
                title: `Finestra ${stage.windows.length + 1}`,
              })
            }
            disabled={stage.windows.length >= MAX_WINDOWS}
          >
            <span aria-hidden>＋</span> Nuova finestra
          </Button>
        </div>
        <StageBoard stage={stage} assetUrls={assetUrls} dispatch={dispatch} />
      </Panel>
    </div>
  );
```

`w-70` è 280px con la scala di Tailwind v4 (70 × 0,25rem = 17,5rem). Import:
`Button, Panel` da `@omnicanvas/ui`, `stageCounter` da `@/lib/stage/stage-counter`.
Nel ramo ospite di `StageArea` sostituire il caricamento e il blocco `if (role === 'guest')`:

```tsx
  if (!ready) return <p className="text-sm text-muted">Caricamento del palco…</p>;

  if (role === 'guest') {
    const counter = stageCounter(stage);
    return (
      <>
        <Panel tone="stage" className="hidden h-full flex-col gap-2 p-2 lg:flex">
          {counter && <span className="tabular text-xs text-muted">{counter}</span>}
          <StageBoard stage={stage} assetUrls={assetUrls} />
        </Panel>
        <div className="h-full lg:hidden">
          <MobileStage stage={stage} assetUrls={assetUrls} />
        </div>
      </>
    );
  }
```

- [ ] **Passo 7: palco e finestre**

`stage-board.tsx`: lo slot vuoto diventa
`flex h-full items-center justify-center rounded-tile border border-dashed border-line text-xs text-muted`;
la griglia resta `grid min-h-0 flex-1 gap-2 lg:grid-cols-[3fr_1fr]`.

`window-view.tsx`: l'`article` prende
`` `flex h-full flex-col gap-2 rounded-tile border bg-raised p-3 ${window.slot === 'main' ? 'border-accent' : 'border-line'}` ``
(bordo lime sulla finestra in primo piano); `h2` → `truncate text-sm font-semibold`;
i pulsanti «Metti in primo piano» e «Archivia finestra» diventano `<Button size="sm">`;
«Finestra vuota» → `text-xs text-muted`; gli altri pulsanti interni allo stesso modo.

`content-view.tsx`: barre del grafico `className="fill-fg"` tranne l'ultima
`i === data.values.length - 1 ? 'fill-accent' : 'fill-fg'`; etichette `fill-muted`;
testi `text-muted` al posto di `text-neutral-300`/`400`; bordi tabella `border-line`;
segnaposto immagine `rounded-tile bg-bg text-muted`; `figure` e `table` prendono anche la
classe `tabular`.

- [ ] **Passo 8: verificare**

Esegui: `npm run typecheck && npm run lint && npm run test:unit`.
Nel Codespace: `npx playwright test e2e/stage.spec.ts e2e/agent.spec.ts e2e/gestures.spec.ts` → PASS.
Controlla anche che `grep -rnE "neutral-|emerald-|amber-|red-[0-9]" "apps/web/src/app/room/[code]"`
elenchi solo file dei Task 6-7.

- [ ] **Passo 9: commit**

```bash
git add apps/web/src/lib/stage/stage-counter.ts tests/unit/stage-counter.test.ts "apps/web/src/app/room/[code]"
git commit -m "feat(stage): host lab with agent, tray and gestures; stage bar with window counter"
```

---

### Task 6: ospite su telefono, spotlight

**File:**
- Modifica: `apps/web/src/app/room/[code]/mobile-stage.tsx`, `spotlight-view.tsx`
- Test: `e2e/mobile-call.spec.ts`, `e2e/stage.spec.ts` (sbirciare e «Torna all'host»)

**Interfacce:**
- Consuma: `Button`, `Panel` (Task 2-3).

- [ ] **Passo 1: `mobile-stage.tsx`**

Il contenitore `role="region"` prende `flex h-full flex-col gap-2`; la finestra mostrata va
dentro `<Panel tone="stage" className="flex min-h-0 flex-1 flex-col p-2">`. Sotto la
finestra, i puntini (solo con più di una finestra):

```tsx
      {stage.windows.length > 1 && (
        <div aria-hidden className="flex justify-center gap-1.5">
          {stage.windows.map((w) => (
            <span
              key={w.id}
              className={`h-1.5 w-1.5 rounded-full ${w.id === shownId ? 'bg-accent' : 'bg-line'}`}
            />
          ))}
        </div>
      )}
```

I tre pulsanti («Finestra precedente», «Torna all'host», «Finestra successiva») diventano
`<Button size="sm">`, «Torna all'host» con `variant="accent"`. Il messaggio senza finestre
prende `text-sm text-muted`.

- [ ] **Passo 2: `spotlight-view.tsx`**

Il dialog prende `absolute inset-0 z-20 bg-stage`; la pillola del nome
`absolute bottom-3 left-3 rounded-full bg-bg/80 px-3 py-1 text-sm font-semibold`;
l'iniziale senza video `text-6xl font-extrabold`; il proprio riquadro
`rounded-tile` al posto di `rounded`; «✕» (nome «Chiudi tutto schermo») diventa
`<Button ref={closeRef} aria-label="Chiudi tutto schermo" className="absolute left-3 top-3 bg-bg/80 text-lg">✕</Button>`
(il `ref` arriva al `<button>`: vedi l'interfaccia di `Button` nel Task 2).

- [ ] **Passo 3: verificare**

Esegui: `npm run typecheck && npm run lint`.
Nel Codespace: `npx playwright test e2e/mobile-call.spec.ts e2e/stage.spec.ts` → PASS.

- [ ] **Passo 4: commit**

```bash
git add "apps/web/src/app/room/[code]/mobile-stage.tsx" "apps/web/src/app/room/[code]/spotlight-view.tsx"
git commit -m "feat(call): Nod look for the phone stage and the spotlight"
```

---

### Task 7: pagine di passaggio, screenshot, documenti

**File:**
- Modifica: `apps/web/src/app/room/[code]/guest-join-form.tsx`, `ended.tsx`, `docs/BACKLOG.md`,
  `CLAUDE.md`
- Crea: `e2e/screenshots.spec.ts`

- [ ] **Passo 1: pagine di passaggio sui token**

`ended.tsx` e `guest-join-form.tsx`: `bg-neutral-950 text-neutral-100` → `bg-bg text-fg`;
campi `rounded bg-neutral-900` → `rounded-tile border border-line bg-surface`;
`text-neutral-400` → `text-muted`; errore `text-red-400` → `text-danger`; pulsante
«Entra» → `<Button type="submit" variant="accent" disabled={pending}>` (stesso testo);
in cima al form e alla pagina finale `<Logo className="mb-4" />`.

- [ ] **Passo 2: screenshot a richiesta**

`e2e/screenshots.spec.ts`:

```ts
import { test } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

// Solo con SCREENSHOTS=1: immagini per la revisione della PR, non confronti di pixel.
test.skip(!process.env.SCREENSHOTS, 'screenshots only on request');
test.afterEach(closeParticipants);

test('redesign screenshots', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  const { host, roomUrl } = await signUpHostWithRoom(browser, 'Kickoff Acme');
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await host.getByRole('button', { name: 'Aggiungi grafico di prova' }).click();
  const guest = await joinAsAnonymousGuest(browser, roomUrl, 'Cliente');

  const shots: Array<[string, typeof host, { width: number; height: number }]> = [
    ['host-desktop-1440', host, { width: 1440, height: 900 }],
    ['host-laptop-1280', host, { width: 1280, height: 720 }],
    ['guest-desktop', guest, { width: 1440, height: 900 }],
    ['guest-phone-portrait', guest, { width: 390, height: 844 }],
    ['guest-phone-landscape', guest, { width: 844, height: 390 }],
  ];
  for (const [name, page, size] of shots) {
    await page.setViewportSize(size);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }
});
```

Esegui nel Codespace: `SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=desktop`
e allega le cinque immagini alla PR.

- [ ] **Passo 3: suite completa**

Esegui: `npm run typecheck && npm run lint && npm run test:unit && npm run build`, poi nel
Codespace `npm run test:e2e`. Tutto verde.

- [ ] **Passo 4: documenti**

`docs/BACKLOG.md`, nuova sezione «Redesign (Nod)»: voci fatte per la call e il palco; aperte
«logo definitivo in SVG (Sean)», «dashboard, login, registrazione nel nuovo stile
(sotto-progetto 3)», «ADR sulla rinomina del codice in Nod». `CLAUDE.md`, «Stato attuale»:
redesign della call su `slice/redesign-call` con il numero della PR.

- [ ] **Passo 5: commit**

```bash
git add "apps/web/src/app/room/[code]/guest-join-form.tsx" "apps/web/src/app/room/[code]/ended.tsx" e2e/screenshots.spec.ts docs/BACKLOG.md CLAUDE.md
git commit -m "feat(call): Nod look for join and ended pages, review screenshots, docs"
```
