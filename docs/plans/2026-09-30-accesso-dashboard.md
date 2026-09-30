# Accesso e dashboard nella veste Nod — piano di implementazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, task per task. I passi usano le caselle
> (`- [ ]`) per il tracciamento.

**Obiettivo:** portare `/`, `/login`, `/signup` e `/dashboard` nella veste Nod, con la
dashboard «Agenda» (riunioni per stato, crediti, profilo) e nessuna migrazione.

**Architettura:** tre componenti di presentazione nuovi in `packages/ui` (`TextField`,
`Menu`, `Button` con `size="icon"` e `variant="overlay"`); logica pura della dashboard in
`apps/web/src/lib/dashboard/model.ts`; lettura dati in
`apps/web/src/lib/dashboard/load-dashboard.ts` con il client Supabase dell'utente (RLS
esistente); pagine server in `apps/web/src/app/`, pezzi interattivi come client component
accanto alla pagina.

**Stack:** Next.js 16 App Router, React 19 (`useActionState`), Tailwind v4, Supabase JS,
Vitest (happy-dom e Testing Library per i componenti), Playwright.

**Spec:** `docs/specs/2026-09-30-accesso-dashboard-design.md`

Branch: `slice/accesso-dashboard` (creato da `slice/redesign-call`, contiene la spec). Dopo il
merge della PR #9 va riallineato su `main` con `git rebase main`.

## Vincoli globali

- Nessun contenuto di riunione su disco o nei log: solo titoli, stati, date, numeri (regola 1).
- Autorizzazione lato server: ogni server action rilegge l'utente con `supabase.auth.getUser()`;
  niente service role nelle pagine (regole 2 e 3).
- Nessuna migrazione, nessuna policy nuova: se un passo sembra richiederla, fermarsi e chiedere.
- Colori solo dai token (`bg`, `surface`, `stage`, `raised`, `line`, `fg`, `muted`, `accent`,
  `on-accent`, `danger`): niente esadecimali, niente `neutral-*` nelle schermate toccate.
- Testi dell'interfaccia in italiano; codice, test e commit in inglese; commenti in italiano.
- Pulsanti alti almeno 44px (`min-h-11` o `h-11`) su tutto ciò che si tocca da telefono.
- `packages/ui` non importa da `apps/web` né legge dati.
- Titolo riunione: 1-120 caratteri (come `createRoomForUser`); nome: 1-40 (`parseDisplayName`).
- Soglia «In corso»: 12 ore da `started_at`.
- Numeri dei crediti con separatore delle migliaia sempre («1.240»); date in `Europe/Rome`
  («29 set»); inizio mese in UTC.

## Focus della revisione

1. **Stanza `active` vecchia di giorni** (oggi è la norma: nessuno chiude): deve finire fra le
   Passate, non restare «In corso». Test in Task 2.
2. **Ricariche manuali nel ledger** (`manual_grant`, delta positivo): non contano come consumo
   del mese né per riunione. Test in Task 2 e Task 3.
3. **Appunti negati** (HTTP, permesso rifiutato, browser vecchio): «Copia link» deve mostrare
   il link selezionabile invece di fallire in silenzio. Test in Task 5.
4. **Nome vuoto o di soli spazi nel profilo**: errore sotto il campo, il valore scritto resta,
   il nome salvato non cambia. Test in Task 6.
5. **Titolo lungo 120 caratteri** in una riga della lista: si tronca senza spingere fuori le
   azioni. Test in Task 5 (classi `min-w-0 truncate` sul titolo, `shrink-0` sulle azioni).

## Mappa dei file

| File | Responsabilità |
|---|---|
| `packages/ui/src/text-field.tsx` | etichetta, input, errore accessibile |
| `packages/ui/src/menu.tsx` | pulsante con pannello, Esc e clic fuori |
| `packages/ui/src/button.tsx` | + `size="icon"`, + `variant="overlay"` |
| `apps/web/src/app/room/[code]/spotlight-view.tsx` | ✕ con `size="icon" variant="overlay"` |
| `apps/web/src/lib/dashboard/model.ts` | `groupRooms`, `formatDuration`, `creditsByRoom`, `monthStart`, `formatCredits`, `formatDay`, `pastMeta` |
| `apps/web/src/lib/dashboard/load-dashboard.ts` | query Supabase → `DashboardData` |
| `apps/web/src/app/page.tsx` | reindirizzamento |
| `apps/web/src/app/(auth)/auth-form.tsx` | modulo «Sobrio» |
| `apps/web/src/app/dashboard/page.tsx` | pagina «Agenda» |
| `apps/web/src/app/dashboard/loading.tsx` | sagoma di caricamento |
| `apps/web/src/app/dashboard/meeting-list.tsx` | gruppi e righe, stato «Prima riunione» |
| `apps/web/src/app/dashboard/copy-link-button.tsx` | copia con ripiego |
| `apps/web/src/app/dashboard/new-meeting.tsx` | pulsante e modulo inline |
| `apps/web/src/app/dashboard/credits-card.tsx` | saldo e consumo del mese |
| `apps/web/src/app/dashboard/profile-card.tsx` | nome e modifica sul posto |
| `apps/web/src/app/dashboard/profile-menu.tsx` | menu con nome ed «Esci» |
| `apps/web/src/app/dashboard/actions.ts` | + `updateDisplayName` |
| `apps/web/src/app/dashboard/create-room-form.tsx` | eliminato (assorbito da `new-meeting.tsx`) |
| `tests/unit/ui-forms.test.tsx` | `TextField`, `Menu`, `Button` icon/overlay |
| `tests/unit/dashboard-model.test.ts` | funzioni pure |
| `tests/db/dashboard-data.test.ts` | `loadDashboard` su Supabase con RLS |
| `tests/unit/auth-form.test.tsx` | modulo di accesso |
| `tests/unit/dashboard-ui.test.tsx` | lista, copia, nuova riunione, profilo |
| `e2e/helpers.ts`, `e2e/dashboard.spec.ts`, `e2e/screenshots.spec.ts` | percorsi reali |

---

### Task 1: `TextField`, `Menu`, `Button` icon e overlay

**Files:**
- Create: `packages/ui/src/text-field.tsx`, `packages/ui/src/menu.tsx`
- Modify: `packages/ui/src/button.tsx`, `packages/ui/src/index.ts`,
  `apps/web/src/app/room/[code]/spotlight-view.tsx`
- Test: `tests/unit/ui-forms.test.tsx`

**Interfaces:**
- Produces:
  - `TextField(props: ComponentPropsWithRef<'input'> & { label: string; error?: string | null })`
  - `Menu(props: { label: ReactNode; triggerLabel: string; children: ReactNode; align?: 'start' | 'end' })`
    — `triggerLabel` è il nome accessibile del pulsante.
  - `ButtonProps['size']` accetta `'sm' | 'md' | 'icon'`; `ButtonProps['variant']` accetta
    anche `'overlay'`.

- [ ] **Passo 1: scrivere i test**

```tsx
// tests/unit/ui-forms.test.tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Menu, TextField } from '@omnicanvas/ui';

afterEach(cleanup);

describe('TextField', () => {
  it('names the input with its label', () => {
    render(<TextField label="Email" name="email" />);
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
  });

  it('announces the error and ties it to the input', () => {
    render(<TextField label="Nome" name="n" error="Scrivi il tuo nome." />);
    const input = screen.getByRole('textbox', { name: 'Nome' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(errorId)?.textContent).toBe('Scrivi il tuo nome.');
  });

  it('stays valid without an error', () => {
    render(<TextField label="Nome" name="n" />);
    const input = screen.getByRole('textbox', { name: 'Nome' });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('Menu', () => {
  const renderMenu = () =>
    render(
      <Menu label="Giulia" triggerLabel="Menu di Giulia">
        <button type="button">Esci</button>
      </Menu>,
    );

  it('opens and closes from its button', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Menu di Giulia' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Esci' })).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Esci' })).toBeTruthy();
  });

  it('closes with Escape and gives focus back to its button', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Menu di Giulia' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Esci' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on a click outside', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Menu di Giulia' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: 'Esci' })).toBeNull();
  });
});

describe('Button sizes and variants', () => {
  it('makes a round 44px icon button without conflicting paddings', () => {
    render(
      <Button size="icon" aria-label="Chiudi">
        x
      </Button>,
    );
    const cls = screen.getByRole('button', { name: 'Chiudi' }).className;
    expect(cls).toContain('h-11');
    expect(cls).toContain('w-11');
    expect(cls).not.toContain('px-4');
  });

  it('has a translucent overlay variant for buttons over video', () => {
    render(<Button variant="overlay">Chiudi</Button>);
    const cls = screen.getByRole('button', { name: 'Chiudi' }).className;
    expect(cls).toContain('bg-bg/80');
    expect(cls).not.toContain('bg-raised');
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Run: `npx vitest run tests/unit/ui-forms.test.tsx`
Expected: FAIL, `TextField` e `Menu` non esportati.

- [ ] **Passo 3: implementare**

```tsx
// packages/ui/src/text-field.tsx
import { useId, type ComponentPropsWithRef } from 'react';
import { cx } from './cx';

type Props = ComponentPropsWithRef<'input'> & { label: string; error?: string | null };

// Etichetta sempre visibile sopra il campo: il segnaposto non la sostituisce mai.
export function TextField({ label, error, className, id, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cx(
          'min-h-11 rounded-tile border bg-stage px-3 text-sm text-fg placeholder:text-muted',
          'motion-safe:transition-colors hover:border-muted focus-visible:border-accent focus-visible:outline-none',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
```

```tsx
// packages/ui/src/menu.tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';

type Props = {
  label: ReactNode;
  triggerLabel: string;
  children: ReactNode;
  align?: 'start' | 'end';
};

// Menu minimo senza librerie: si chiude con Esc (il focus torna al pulsante) e col clic fuori.
export function Menu({ label, triggerLabel, children, align = 'end' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-raised px-3 text-sm font-semibold text-fg hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {label}
      </button>
      {open && (
        <div
          className={cx(
            'absolute top-full z-30 mt-2 flex min-w-44 flex-col gap-1 rounded-panel border border-line bg-surface p-2',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
```

In `packages/ui/src/button.tsx` sostituire le mappe e il tipo:

```tsx
export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'pill' | 'accent' | 'exit' | 'quiet' | 'overlay';
  size?: 'sm' | 'md' | 'icon';
};

const VARIANTS = {
  pill: 'bg-raised text-fg hover:bg-line',
  accent: 'bg-accent text-on-accent hover:brightness-95',
  exit: 'bg-fg text-bg hover:brightness-90',
  quiet: 'bg-transparent text-muted hover:text-fg',
  // Sopra un video: il fondo lascia intravedere l'immagine.
  overlay: 'bg-bg/80 text-fg hover:bg-bg',
} as const;

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  // 44px di altezza minima: il pollice su telefono (spec §3).
  md: 'min-h-11 px-4 py-2 text-sm',
  // Tondo, senza testo visibile: il nome va in aria-label o in uno span sr-only.
  icon: 'h-11 w-11 p-0',
} as const;
```

In `packages/ui/src/index.ts` aggiungere:

```ts
export { TextField } from './text-field';
export { Menu } from './menu';
```

In `apps/web/src/app/room/[code]/spotlight-view.tsx` il pulsante di chiusura diventa:

```tsx
      <Button
        ref={closeRef}
        onClick={onClose}
        aria-label="Chiudi tutto schermo"
        size="icon"
        variant="overlay"
        className="absolute left-3 top-3"
      >
        <Icon name="close" className="h-5 w-5" />
      </Button>
```

- [ ] **Passo 4: verificare**

Run: `npx vitest run tests/unit/ui-forms.test.tsx tests/unit/ui-button.test.tsx tests/unit/ui-icons.test.tsx`
Expected: PASS. Poi `npm run typecheck` e `npm run lint`: puliti.

- [ ] **Passo 5: commit**

```bash
git add packages/ui tests/unit/ui-forms.test.tsx "apps/web/src/app/room/[code]/spotlight-view.tsx"
git commit -m "feat(ui): TextField, Menu, icon and overlay buttons; spotlight close uses them"
```

---

### Task 2: logica pura della dashboard

**Files:**
- Create: `apps/web/src/lib/dashboard/model.ts`
- Test: `tests/unit/dashboard-model.test.ts`

**Interfaces:**
- Produces (tutto da `@/lib/dashboard/model`):

```ts
export type DashboardRoom = {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};
export type RoomGroups = { live: DashboardRoom[]; ready: DashboardRoom[]; past: DashboardRoom[] };
export const LIVE_WINDOW_MS: number; // 12 ore
export function groupRooms(rooms: DashboardRoom[], now: Date): RoomGroups;
export function formatDuration(startedAt: string | null, endedAt: string | null): string | null;
export function creditsByRoom(rows: Array<{ room_id: string; credit_ledger: Array<{ delta: number }> }>): Record<string, number>;
export function monthStart(now: Date): Date;
export function formatCredits(value: number): string;
export function formatDay(iso: string): string;
export function pastMeta(room: DashboardRoom, credits: number): string;
```

- [ ] **Passo 1: scrivere i test**

```ts
// tests/unit/dashboard-model.test.ts
import { describe, expect, it } from 'vitest';
import {
  creditsByRoom,
  formatCredits,
  formatDay,
  formatDuration,
  groupRooms,
  monthStart,
  pastMeta,
  type DashboardRoom,
} from '@/lib/dashboard/model';

const now = new Date('2026-09-30T10:00:00Z');
const room = (over: Partial<DashboardRoom>): DashboardRoom => ({
  id: 'r',
  title: 'Riunione',
  joinCode: 'ABCD2345',
  status: 'created',
  startedAt: null,
  endedAt: null,
  createdAt: '2026-09-29T08:00:00Z',
  ...over,
});

describe('groupRooms', () => {
  it('puts rooms nobody has entered among the ready ones', () => {
    const groups = groupRooms([room({ id: 'a' })], now);
    expect(groups.ready.map((r) => r.id)).toEqual(['a']);
  });

  it('keeps a room live only within 12 hours from its start', () => {
    const fresh = room({ id: 'fresh', status: 'active', startedAt: '2026-09-30T09:00:00Z' });
    const stale = room({ id: 'stale', status: 'active', startedAt: '2026-09-28T09:00:00Z' });
    const groups = groupRooms([fresh, stale], now);
    expect(groups.live.map((r) => r.id)).toEqual(['fresh']);
    expect(groups.past.map((r) => r.id)).toEqual(['stale']);
  });

  it('treats an active room without a start time as past', () => {
    const groups = groupRooms([room({ id: 'x', status: 'active' })], now);
    expect(groups.past.map((r) => r.id)).toEqual(['x']);
  });

  it('puts closed, purged and unknown statuses among the past ones', () => {
    const groups = groupRooms(
      [room({ id: 'c', status: 'closed' }), room({ id: 'p', status: 'purged' }), room({ id: 'u', status: 'weird' })],
      now,
    );
    expect(groups.past.map((r) => r.id).sort()).toEqual(['c', 'p', 'u']);
  });

  it('orders each group from the newest', () => {
    const groups = groupRooms(
      [room({ id: 'old', createdAt: '2026-09-01T00:00:00Z' }), room({ id: 'new', createdAt: '2026-09-20T00:00:00Z' })],
      now,
    );
    expect(groups.ready.map((r) => r.id)).toEqual(['new', 'old']);
  });
});

describe('formatDuration', () => {
  it('shows minutes under an hour', () => {
    expect(formatDuration('2026-09-29T10:00:00Z', '2026-09-29T10:48:10Z')).toBe('48 min');
  });
  it('shows hours and padded minutes above an hour', () => {
    expect(formatDuration('2026-09-29T10:00:00Z', '2026-09-29T11:05:00Z')).toBe('1 h 05');
  });
  it('shows nothing when a bound is missing or the order is wrong', () => {
    expect(formatDuration(null, '2026-09-29T11:00:00Z')).toBeNull();
    expect(formatDuration('2026-09-29T11:00:00Z', null)).toBeNull();
    expect(formatDuration('2026-09-29T11:00:00Z', '2026-09-29T10:00:00Z')).toBeNull();
  });
});

describe('creditsByRoom', () => {
  it('sums what each room spent, as a positive number', () => {
    expect(
      creditsByRoom([
        { room_id: 'a', credit_ledger: [{ delta: -2 }] },
        { room_id: 'a', credit_ledger: [{ delta: -3 }] },
        { room_id: 'b', credit_ledger: [] },
      ]),
    ).toEqual({ a: 5 });
  });
  it('ignores positive deltas, which are never consumption', () => {
    expect(creditsByRoom([{ room_id: 'a', credit_ledger: [{ delta: 10 }] }])).toEqual({});
  });
});

describe('monthStart', () => {
  it('is the first instant of the month in UTC', () => {
    expect(monthStart(new Date('2026-09-30T23:59:00Z')).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('formatting', () => {
  it('always groups thousands in credits', () => {
    expect(formatCredits(1240)).toBe('1.240');
    expect(formatCredits(36)).toBe('36');
  });
  it('writes the day in Italian, Rome time', () => {
    expect(formatDay('2026-09-29T22:30:00Z')).toBe('30 set');
  });
  it('joins date, duration and credits for a past meeting, skipping what is missing', () => {
    const r = room({ status: 'closed', createdAt: '2026-09-29T08:00:00Z', startedAt: '2026-09-29T08:00:00Z', endedAt: '2026-09-29T08:48:00Z' });
    expect(pastMeta(r, 36)).toBe('29 set · 48 min · 36 crediti');
    expect(pastMeta(room({ status: 'active', startedAt: '2026-09-29T08:00:00Z' }), 0)).toBe('29 set');
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Run: `npx vitest run tests/unit/dashboard-model.test.ts`
Expected: FAIL, modulo `@/lib/dashboard/model` inesistente.

- [ ] **Passo 3: implementare**

```ts
// apps/web/src/lib/dashboard/model.ts
// Logica pura della dashboard: niente Supabase, niente React. Solo metadati (regola 1).

export type DashboardRoom = {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type RoomGroups = { live: DashboardRoom[]; ready: DashboardRoom[]; past: DashboardRoom[] };

// Oggi nessuno chiude una stanza (arriva con la slice 8): oltre questa soglia una stanza
// «active» si considera finita. Dopo la slice 8 resta per chi chiude la scheda e basta.
export const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

const LIVE_STATUSES = new Set(['active', 'closing']);

function isLive(room: DashboardRoom, now: Date): boolean {
  if (!LIVE_STATUSES.has(room.status) || !room.startedAt) return false;
  return now.getTime() - new Date(room.startedAt).getTime() < LIVE_WINDOW_MS;
}

export function groupRooms(rooms: DashboardRoom[], now: Date): RoomGroups {
  const sorted = [...rooms].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: RoomGroups = { live: [], ready: [], past: [] };
  for (const room of sorted) {
    if (room.status === 'created') groups.ready.push(room);
    else if (isLive(room, now)) groups.live.push(room);
    else groups.past.push(room);
  }
  return groups;
}

export function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const minutes = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function creditsByRoom(
  rows: Array<{ room_id: string; credit_ledger: Array<{ delta: number }> }>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    for (const entry of row.credit_ledger) {
      if (entry.delta < 0) totals[row.room_id] = (totals[row.room_id] ?? 0) - entry.delta;
    }
  }
  return totals;
}

export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// In italiano Intl non raggruppa i numeri di quattro cifre: «always» lo forza.
const creditFormat = new Intl.NumberFormat('it-IT', { useGrouping: 'always' });
export function formatCredits(value: number): string {
  return creditFormat.format(value);
}

const dayFormat = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Rome',
});
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso)).replace('.', '');
}

export function pastMeta(room: DashboardRoom, credits: number): string {
  const parts = [formatDay(room.startedAt ?? room.createdAt)];
  const duration = formatDuration(room.startedAt, room.endedAt);
  if (duration) parts.push(duration);
  if (credits > 0) parts.push(`${formatCredits(credits)} crediti`);
  return parts.join(' · ');
}
```

Se TypeScript rifiuta `useGrouping: 'always'` (lib ES più vecchia di ES2023), aggiungere
`"ES2023.Intl"` a `lib` nel `tsconfig.json` di `apps/web` invece di un cast.

- [ ] **Passo 4: verificare**

Run: `npx vitest run tests/unit/dashboard-model.test.ts`
Expected: PASS. Poi `npm run typecheck`.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/lib/dashboard/model.ts tests/unit/dashboard-model.test.ts
git commit -m "feat(dashboard): pure model — groups with 12h live window, durations, credits"
```

---

### Task 3: lettura dei dati con la RLS

**Files:**
- Create: `apps/web/src/lib/dashboard/load-dashboard.ts`
- Test: `tests/db/dashboard-data.test.ts` (gira nel job `db` della CI e nel Codespace)

**Interfaces:**
- Consumes: `DashboardRoom`, `creditsByRoom`, `monthStart` da Task 2.
- Produces:

```ts
export type DashboardData = {
  displayName: string;
  rooms: DashboardRoom[] | null;            // null = lettura fallita
  credits: { balance: number; usedThisMonth: number } | null; // null = lettura fallita
  creditsByRoom: Record<string, number>;
};
export async function loadDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date,
): Promise<DashboardData>;
```

- [ ] **Passo 1: scrivere il test**

```ts
// tests/db/dashboard-data.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { loadDashboard } from '@/lib/dashboard/load-dashboard';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

describe('loadDashboard', () => {
  let host: TestUser;
  let stranger: TestUser;
  let roomId: string;

  beforeAll(async () => {
    host = await createTestUser('dash-host');
    stranger = await createTestUser('dash-stranger');
    const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', host.id).single();
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Kickoff Ferretti' });
    if (!room.ok) throw new Error('setup failed');
    roomId = room.id;
    const joined = await joinRoom(admin, { joinCode: room.joinCode, userId: host.id, displayName: 'Giulia', language: 'it' });
    if (joined.kind !== 'joined') throw new Error('join failed');
    await admin.rpc('grant_credits', { p_workspace: ws!.id, p_credits: 100 });
    await admin.rpc('ai_reserve_credits', { p_workspace: ws!.id, p_credits: 10 });
    await admin.rpc('ai_record_request', {
      p_room: roomId,
      p_participant: joined.participantId,
      p_workspace: ws!.id,
      p_provider: 'fake',
      p_model: 'fake-1',
      p_operation: 'agent_generate',
      p_input_tokens: 10,
      p_output_tokens: 5,
      p_latency_ms: 1,
      p_success: true,
      p_error_code: null as unknown as string,
      p_cost_usd: 0.001,
      p_reserved: 10,
      p_charged: 3,
    });
  });

  it('reads rooms, balance, monthly use and per-room credits for the host', async () => {
    const data = await loadDashboard(await signedInClient(host), host.id, new Date());
    expect(data.rooms?.map((r) => r.title)).toEqual(['Kickoff Ferretti']);
    expect(data.credits).toEqual({ balance: 97, usedThisMonth: 3 });
    expect(data.creditsByRoom).toEqual({ [roomId]: 3 });
    expect(data.displayName).not.toBe('');
  });

  it('shows a stranger none of it', async () => {
    const data = await loadDashboard(await signedInClient(stranger), stranger.id, new Date());
    expect(data.rooms).toEqual([]);
    expect(data.credits).toEqual({ balance: 0, usedThisMonth: 0 });
    expect(data.creditsByRoom).toEqual({});
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Run (nel Codespace o dove gira Supabase locale): `npx vitest run tests/db/dashboard-data.test.ts`
Expected: FAIL, modulo `@/lib/dashboard/load-dashboard` inesistente. Sul PC senza Supabase il
test fallisce per l'env mancante: va eseguito nel Codespace o lasciato alla CI (job `db`).

- [ ] **Passo 3: implementare**

```ts
// apps/web/src/lib/dashboard/load-dashboard.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { creditsByRoom, monthStart, type DashboardRoom } from './model';

export type DashboardData = {
  displayName: string;
  rooms: DashboardRoom[] | null;
  credits: { balance: number; usedThisMonth: number } | null;
  creditsByRoom: Record<string, number>;
};

// Tutto con il client dell'utente: la RLS decide cosa si vede, qui nessun filtro di sicurezza.
export async function loadDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date,
): Promise<DashboardData> {
  const [profile, roomsResult, membership] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    supabase
      .from('rooms')
      .select('id, title, join_code, status, started_at, ended_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle(),
  ]);

  const rooms: DashboardRoom[] | null = roomsResult.error
    ? null
    : roomsResult.data.map((row) => ({
        id: row.id,
        title: row.title,
        joinCode: row.join_code,
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        createdAt: row.created_at,
      }));

  return {
    displayName: profile.data?.display_name ?? '',
    rooms,
    credits: await readCredits(supabase, membership.data?.workspace_id ?? null, now),
    creditsByRoom: await readRoomCredits(supabase, rooms ?? []),
  };
}

async function readCredits(
  supabase: SupabaseClient<Database>,
  workspaceId: string | null,
  now: Date,
): Promise<DashboardData['credits']> {
  if (!workspaceId) return { balance: 0, usedThisMonth: 0 };
  const [workspace, ledger] = await Promise.all([
    supabase.from('workspaces').select('credits_balance').eq('id', workspaceId).single(),
    supabase
      .from('credit_ledger')
      .select('delta')
      .eq('workspace_id', workspaceId)
      .lt('delta', 0)
      .gte('created_at', monthStart(now).toISOString()),
  ]);
  if (workspace.error || ledger.error) return null;
  return {
    balance: workspace.data.credits_balance,
    usedThisMonth: ledger.data.reduce((sum, row) => sum - row.delta, 0),
  };
}

async function readRoomCredits(
  supabase: SupabaseClient<Database>,
  rooms: DashboardRoom[],
): Promise<Record<string, number>> {
  if (rooms.length === 0) return {};
  const { data, error } = await supabase
    .from('ai_requests')
    .select('room_id, credit_ledger(delta)')
    .in(
      'room_id',
      rooms.map((room) => room.id),
    );
  return error ? {} : creditsByRoom(data);
}
```

Nota per lo straniero del test: `workspace_members` gli restituisce il suo workspace
personale (saldo 0), quindi `credits` vale `{ balance: 0, usedThisMonth: 0 }`.

- [ ] **Passo 4: verificare**

Run: `npx vitest run tests/db/dashboard-data.test.ts` nel Codespace. Expected: PASS.
Sul PC: `npm run typecheck`; il test db lo conferma la CI.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/lib/dashboard/load-dashboard.ts tests/db/dashboard-data.test.ts
git commit -m "feat(dashboard): load rooms and credits through RLS"
```

---

### Task 4: `/` che reindirizza e accesso «Sobrio»

**Files:**
- Modify: `apps/web/src/app/page.tsx`, `apps/web/src/app/(auth)/auth-form.tsx`
- Test: `tests/unit/auth-form.test.tsx`

**Interfaces:**
- Consumes: `TextField` (Task 1), `Button`, `Logo`, `StatusBanner` da `@omnicanvas/ui`.
- Produces: stessi export di oggi (`AuthForm` con `mode`, `action`, `next`). Nomi accessibili
  stabili per gli e2e: campi «Nome», «Email», «Password»; pulsanti «Registrati» ed «Entra».

- [ ] **Passo 1: scrivere il test**

```tsx
// tests/unit/auth-form.test.tsx
// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/app/(auth)/auth-form';

afterEach(cleanup);
const noop = vi.fn(async () => ({ error: null, info: null }));

describe('AuthForm', () => {
  it('shows the Nod logo, the fields and the privacy promise on login', () => {
    render(<AuthForm mode="login" action={noop} next="/dashboard" />);
    expect(screen.getByRole('img', { name: 'Nod' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.queryByLabelText('Nome')).toBeNull();
    expect(screen.getByRole('button', { name: 'Entra' })).toBeTruthy();
    expect(screen.getByText(/Niente di ciò che si dice in riunione resta sui nostri server/)).toBeTruthy();
  });

  it('asks for the name on signup and links back to login keeping next', () => {
    render(<AuthForm mode="signup" action={noop} next="/room/ABCD2345" />);
    expect(screen.getByLabelText('Nome')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Registrati' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Accedi' }).getAttribute('href')).toBe(
      '/login?next=%2Froom%2FABCD2345',
    );
  });

  it('uses only theme tokens, never the prototype greys', () => {
    const { container } = render(<AuthForm mode="login" action={noop} next="/dashboard" />);
    expect(container.innerHTML).not.toMatch(/neutral-|emerald-|red-4/);
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Run: `npx vitest run tests/unit/auth-form.test.tsx`
Expected: FAIL (niente logo, niente promessa, classi `neutral-*`).

- [ ] **Passo 3: implementare**

```tsx
// apps/web/src/app/(auth)/auth-form.tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, Logo, StatusBanner, TextField } from '@omnicanvas/ui';
import type { AuthState } from './actions';

type Props = {
  mode: 'login' | 'signup';
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next: string;
};

const initialState: AuthState = { error: null, info: null };

// Versione «Sobrio» (spec accesso-dashboard §2): logo e modulo al centro, nient'altro.
export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === 'signup';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-fg">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
        <Logo className="mb-4" />
        <h1 className="text-2xl font-extrabold tracking-tight">
          {isSignup ? 'Crea un account' : 'Accedi'}
        </h1>
        <input type="hidden" name="next" value={next} />
        {isSignup && <TextField label="Nome" name="display_name" required maxLength={40} autoComplete="name" />}
        <TextField label="Email" name="email" type="email" required autoComplete="email" />
        <TextField
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
        />
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.info && <StatusBanner>{state.info}</StatusBanner>}
        <Button type="submit" variant="accent" disabled={pending} className="w-full">
          {pending ? (isSignup ? 'Registrazione…' : 'Accesso…') : isSignup ? 'Registrati' : 'Entra'}
        </Button>
        <p className="text-sm text-muted">
          {isSignup ? 'Hai già un account? ' : 'Non hai un account? '}
          <Link
            className="font-semibold text-fg underline"
            href={`/${isSignup ? 'login' : 'signup'}?next=${encodeURIComponent(next)}`}
          >
            {isSignup ? 'Accedi' : 'Registrati'}
          </Link>
        </p>
        <p className="text-xs text-muted">
          Niente di ciò che si dice in riunione resta sui nostri server.
        </p>
      </form>
    </main>
  );
}
```

Attenzione: nella pagina di registrazione il collegamento «Accedi» e il titolo «Crea un
account» non collidono con il pulsante «Registrati»; nella pagina di login il collegamento
«Registrati» è un link, non un pulsante, quindi `getByRole('button', { name: 'Registrati' })`
negli e2e trova solo il pulsante della registrazione.

```tsx
// apps/web/src/app/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

// Nessuna vetrina per ora (spec accesso-dashboard §1): chi entra va dove serve.
export default async function Home() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? '/dashboard' : '/login');
}
```

- [ ] **Passo 4: verificare**

Run: `npx vitest run tests/unit/auth-form.test.tsx` → PASS; `npm run typecheck`; `npm run lint`.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/app/page.tsx "apps/web/src/app/(auth)/auth-form.tsx" tests/unit/auth-form.test.tsx
git commit -m "feat(auth): Nod look for login and signup; / redirects by session"
```

---

### Task 5: lista delle riunioni, «Copia link», «Nuova riunione»

**Files:**
- Create: `apps/web/src/app/dashboard/meeting-list.tsx`,
  `apps/web/src/app/dashboard/copy-link-button.tsx`,
  `apps/web/src/app/dashboard/new-meeting.tsx`
- Test: `tests/unit/dashboard-ui.test.tsx`

**Interfaces:**
- Consumes: `DashboardRoom`, `groupRooms`, `pastMeta` (Task 2); `TextField` (Task 1);
  `createRoomAction` e `CreateRoomState` da `./actions` (esistenti).
- Produces:
  - `MeetingList(props: { rooms: DashboardRoom[]; creditsByRoom: Record<string, number>; appUrl: string; now: Date })`
  - `CopyLinkButton(props: { url: string })`
  - `NewMeeting(props: { defaultOpen: boolean })` — pulsante «Nuova riunione» (solo apre),
    modulo con `TextField` «Titolo della riunione», «Crea», «Annulla».

- [ ] **Passo 1: scrivere i test**

```tsx
// tests/unit/dashboard-ui.test.tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRoom } from '@/lib/dashboard/model';

vi.mock('@/app/dashboard/actions', () => ({
  createRoomAction: vi.fn(async () => ({ error: null })),
  updateDisplayName: vi.fn(async () => ({ error: null, saved: true })),
}));

const { MeetingList } = await import('@/app/dashboard/meeting-list');
const { CopyLinkButton } = await import('@/app/dashboard/copy-link-button');
const { NewMeeting } = await import('@/app/dashboard/new-meeting');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const now = new Date('2026-09-30T10:00:00Z');
const room = (over: Partial<DashboardRoom>): DashboardRoom => ({
  id: over.id ?? 'r',
  title: 'Riunione',
  joinCode: 'ABCD2345',
  status: 'created',
  startedAt: null,
  endedAt: null,
  createdAt: '2026-09-29T08:00:00Z',
  ...over,
});

describe('MeetingList', () => {
  it('hides empty groups and offers the link only for live and ready meetings', () => {
    render(
      <MeetingList
        now={now}
        appUrl="https://nod.test"
        creditsByRoom={{ past: 36 }}
        rooms={[
          room({ id: 'live', title: 'Kickoff Ferretti', status: 'active', startedAt: '2026-09-30T09:40:00Z' }),
          room({ id: 'past', title: 'Demo Ormea', status: 'closed', startedAt: '2026-09-29T08:00:00Z', endedAt: '2026-09-29T08:48:00Z' }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'In corso' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pronte' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Passate' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Copia link/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Rientra/ }).getAttribute('href')).toBe('/room/ABCD2345');
    expect(screen.getByText('29 set · 48 min · 36 crediti')).toBeTruthy();
  });

  it('keeps long titles inside the row', () => {
    render(<MeetingList now={now} appUrl="https://nod.test" creditsByRoom={{}} rooms={[room({ title: 'x'.repeat(120) })]} />);
    const title = screen.getByText('x'.repeat(120));
    expect(title.className).toContain('truncate');
    expect(title.className).toContain('min-w-0');
  });

  it('shows the first-meeting steps when there are no meetings', () => {
    render(<MeetingList now={now} appUrl="https://nod.test" creditsByRoom={{}} rooms={[]} />);
    expect(screen.getByRole('heading', { name: 'Prima riunione' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('CopyLinkButton', () => {
  it('confirms after copying', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyLinkButton url="https://nod.test/room/ABCD2345" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Link copiato' })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith('https://nod.test/room/ABCD2345');
  });

  it('shows the link to copy by hand when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) } });
    render(<CopyLinkButton url="https://nod.test/room/ABCD2345" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia link' }));
    const field = await screen.findByRole('textbox', { name: 'Link della riunione' });
    expect((field as HTMLInputElement).value).toBe('https://nod.test/room/ABCD2345');
    expect(field.hasAttribute('readonly')).toBe(true);
  });

  it('falls back also when there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', {});
    render(<CopyLinkButton url="https://nod.test/room/ABCD2345" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copia link' }));
    expect(await screen.findByRole('textbox', { name: 'Link della riunione' })).toBeTruthy();
  });
});

describe('NewMeeting', () => {
  it('opens the title field from the button and never closes it from there', () => {
    render(<NewMeeting defaultOpen={false} />);
    expect(screen.queryByLabelText('Titolo della riunione')).toBeNull();
    const open = screen.getByRole('button', { name: 'Nuova riunione' });
    fireEvent.click(open);
    fireEvent.click(open);
    expect(screen.getByLabelText('Titolo della riunione')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByLabelText('Titolo della riunione')).toBeNull();
  });

  it('starts open for a new user', () => {
    render(<NewMeeting defaultOpen />);
    expect(screen.getByLabelText('Titolo della riunione')).toBeTruthy();
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Run: `npx vitest run tests/unit/dashboard-ui.test.tsx`
Expected: FAIL, moduli inesistenti.

- [ ] **Passo 3: implementare**

```tsx
// apps/web/src/app/dashboard/copy-link-button.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@omnicanvas/ui';

// Senza appunti (HTTP, permesso negato) il link compare già selezionato: mai un errore muto.
export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === 'manual') fieldRef.current?.select();
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('manual');
    }
  }

  if (state === 'manual') {
    return (
      <input
        ref={fieldRef}
        readOnly
        aria-label="Link della riunione"
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="min-h-11 w-56 rounded-tile border border-line bg-stage px-3 text-xs text-fg"
      />
    );
  }
  return (
    <Button size="md" onClick={() => void copy()}>
      {state === 'copied' ? 'Link copiato' : 'Copia link'}
    </Button>
  );
}
```

```tsx
// apps/web/src/app/dashboard/meeting-list.tsx
import Link from 'next/link';
import { groupRooms, pastMeta, type DashboardRoom } from '@/lib/dashboard/model';
import { CopyLinkButton } from './copy-link-button';

type Props = {
  rooms: DashboardRoom[];
  creditsByRoom: Record<string, number>;
  appUrl: string;
  now: Date;
};

const linkButton =
  'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function MeetingList({ rooms, creditsByRoom, appUrl, now }: Props) {
  if (rooms.length === 0) return <FirstMeeting />;
  const groups = groupRooms(rooms, now);

  return (
    <div className="flex flex-col gap-6">
      {groups.live.length > 0 && (
        <Group title="In corso">
          {groups.live.map((room) => (
            <Row key={room.id} room={room} live>
              <CopyLinkButton url={`${appUrl}/room/${room.joinCode}`} />
              <Link href={`/room/${room.joinCode}`} className={`${linkButton} bg-accent text-on-accent`}>
                Rientra<span className="sr-only"> in {room.title}</span>
              </Link>
            </Row>
          ))}
        </Group>
      )}
      {groups.ready.length > 0 && (
        <Group title="Pronte">
          {groups.ready.map((room) => (
            <Row key={room.id} room={room}>
              <CopyLinkButton url={`${appUrl}/room/${room.joinCode}`} />
              <Link href={`/room/${room.joinCode}`} className={`${linkButton} bg-raised text-fg hover:bg-line`}>
                Apri<span className="sr-only"> {room.title}</span>
              </Link>
            </Row>
          ))}
        </Group>
      )}
      {groups.past.length > 0 && (
        <Group title="Passate">
          {groups.past.map((room) => (
            <Row key={room.id} room={room}>
              <span className="tabular text-xs text-muted">{pastMeta(room, creditsByRoom[room.id] ?? 0)}</span>
            </Row>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <ul className="flex flex-col divide-y divide-line">{children}</ul>
    </section>
  );
}

function Row({ room, live = false, children }: { room: DashboardRoom; live?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {live && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
      <span className="min-w-0 flex-1 truncate font-semibold">{room.title}</span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </li>
  );
}

function FirstMeeting() {
  return (
    <section className="flex flex-col gap-3 rounded-panel bg-stage p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Prima riunione</h2>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
        <li>Crea la riunione con un titolo che ritroverai.</li>
        <li>Manda il link al cliente: entra dal browser, senza account.</li>
        <li>In riunione chiedi all&apos;agente un grafico, un testo o una tabella.</li>
      </ol>
    </section>
  );
}
```

```tsx
// apps/web/src/app/dashboard/new-meeting.tsx
'use client';

import { useActionState, useState } from 'react';
import { Button, Icon, TextField } from '@omnicanvas/ui';
import { createRoomAction, type CreateRoomState } from './actions';

const initialState: CreateRoomState = { error: null };

// Il pulsante apre soltanto: cliccarlo due volte non richiude il modulo (e2e più stabili).
export function NewMeeting({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction, pending] = useActionState(createRoomAction, initialState);

  return (
    <div className="flex flex-col gap-3">
      <Button variant="accent" onClick={() => setOpen(true)} aria-expanded={open}>
        <Icon name="plus" /> Nuova riunione
      </Button>
      {open && (
        <form action={formAction} className="flex flex-col gap-2 rounded-panel bg-surface p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Titolo della riunione"
              name="title"
              required
              maxLength={120}
              autoFocus
              error={state.error}
              placeholder="Es. Kickoff con Ferretti Arredi"
            />
          </div>
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? 'Creazione…' : 'Crea'}
          </Button>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Annulla
          </Button>
        </form>
      )}
    </div>
  );
}
```

`create-room-form.tsx` resta finché la pagina lo usa: lo elimina il Task 6.

- [ ] **Passo 4: verificare**

Run: `npx vitest run tests/unit/dashboard-ui.test.tsx` → PASS; `npm run typecheck` e
`npm run lint` puliti.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/app/dashboard/meeting-list.tsx apps/web/src/app/dashboard/copy-link-button.tsx apps/web/src/app/dashboard/new-meeting.tsx tests/unit/dashboard-ui.test.tsx
git commit -m "feat(dashboard): meeting groups, copy link with fallback, inline new meeting"
```

---

### Task 6: crediti, profilo, menu e pagina «Agenda»

**Files:**
- Create: `apps/web/src/app/dashboard/credits-card.tsx`,
  `apps/web/src/app/dashboard/profile-card.tsx`,
  `apps/web/src/app/dashboard/profile-menu.tsx`,
  `apps/web/src/app/dashboard/loading.tsx`
- Modify: `apps/web/src/app/dashboard/actions.ts`, `apps/web/src/app/dashboard/page.tsx`
- Delete: `apps/web/src/app/dashboard/create-room-form.tsx`
- Test: `tests/unit/dashboard-ui.test.tsx` (aggiungere i blocchi sotto)

**Interfaces:**
- Consumes: Task 1-5.
- Produces:
  - `updateDisplayName(prev: ProfileState, formData: FormData): Promise<ProfileState>` con
    `type ProfileState = { error: string | null; saved: boolean }`
  - `CreditsCard(props: { credits: { balance: number; usedThisMonth: number } | null; now: Date })`
  - `ProfileCard(props: { displayName: string })`
  - `ProfileMenu(props: { displayName: string })`

- [ ] **Passo 1: aggiungere i test**

In `tests/unit/dashboard-ui.test.tsx`, dopo gli import dinamici esistenti:

```tsx
const { CreditsCard } = await import('@/app/dashboard/credits-card');
const { ProfileCard } = await import('@/app/dashboard/profile-card');
const actions = await import('@/app/dashboard/actions');
```

e in fondo:

```tsx
describe('CreditsCard', () => {
  it('shows the balance and this month use', () => {
    render(<CreditsCard now={now} credits={{ balance: 1240, usedThisMonth: 129 }} />);
    expect(screen.getByText('1.240')).toBeTruthy();
    expect(screen.getByText('129 usati a settembre')).toBeTruthy();
  });
  it('shows a dash when credits could not be read', () => {
    render(<CreditsCard now={now} credits={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('ProfileCard', () => {
  it('edits the name in place and keeps what was typed when the server refuses it', async () => {
    vi.mocked(actions.updateDisplayName).mockResolvedValueOnce({
      error: 'Scrivi il tuo nome, al massimo 40 caratteri.',
      saved: false,
    });
    render(<ProfileCard displayName="Giulia Rinaldi" />);
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
    const field = screen.getByLabelText('Nome') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.submit(field.form!);
    expect(await screen.findByText('Scrivi il tuo nome, al massimo 40 caratteri.')).toBeTruthy();
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('   ');
  });
});
```

- [ ] **Passo 2: eseguire e verificare che fallisca**

Run: `npx vitest run tests/unit/dashboard-ui.test.tsx`
Expected: FAIL sui due blocchi nuovi (moduli inesistenti).

- [ ] **Passo 3: implementare**

In `apps/web/src/app/dashboard/actions.ts` aggiungere (lasciando `createRoomAction` com'è):

```ts
import { revalidatePath } from 'next/cache';
import { parseDisplayName } from '@/lib/auth/display-name';

export type ProfileState = { error: string | null; saved: boolean };

export async function updateDisplayName(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?next=/dashboard');

  const name = parseDisplayName(String(formData.get('display_name') ?? ''));
  if (!name) return { error: 'Scrivi il tuo nome, al massimo 40 caratteri.', saved: false };

  // La policy «user updates own profile» limita comunque la riga a quella dell'utente.
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', data.user.id);
  if (error) return { error: 'Non sono riuscito a salvare il nome. Riprova.', saved: false };
  revalidatePath('/dashboard');
  return { error: null, saved: true };
}
```

```tsx
// apps/web/src/app/dashboard/profile-card.tsx
'use client';

import { useActionState, useState } from 'react';
import { Button, TextField } from '@omnicanvas/ui';
import { updateDisplayName, type ProfileState } from './actions';

const initialState: ProfileState = { error: null, saved: false };

export function ProfileCard({ displayName }: { displayName: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [state, formAction, pending] = useActionState(
    async (prev: ProfileState, formData: FormData) => {
      const next = await updateDisplayName(prev, formData);
      if (next.saved) setEditing(false);
      return next;
    },
    initialState,
  );

  return (
    <section className="flex flex-col gap-2 rounded-panel bg-surface p-4">
      <h2 className="text-xs font-semibold text-muted">Profilo</h2>
      {editing ? (
        <form action={formAction} className="flex flex-col gap-2">
          <TextField
            label="Nome"
            name="display_name"
            maxLength={40}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={state.error}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? 'Salvataggio…' : 'Salva'}
            </Button>
            <Button variant="quiet" onClick={() => setEditing(false)}>
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-semibold">{displayName}</span>
          <Button variant="quiet" onClick={() => { setDraft(displayName); setEditing(true); }}>
            Modifica
          </Button>
        </div>
      )}
    </section>
  );
}
```

```tsx
// apps/web/src/app/dashboard/credits-card.tsx
import { Panel } from '@omnicanvas/ui';
import { formatCredits } from '@/lib/dashboard/model';

const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' });

export function CreditsCard({
  credits,
  now,
}: {
  credits: { balance: number; usedThisMonth: number } | null;
  now: Date;
}) {
  return (
    <Panel as="section" tone="stage" aria-label="Crediti" className="flex flex-col gap-1 p-4">
      <h2 className="text-xs font-semibold text-muted">Saldo</h2>
      <p className="tabular text-3xl font-extrabold tracking-tight">
        {credits ? formatCredits(credits.balance) : '—'}
      </p>
      {credits && (
        <p className="tabular text-xs text-muted">
          {`${formatCredits(credits.usedThisMonth)} usati a ${monthName.format(now)}`}
        </p>
      )}
    </Panel>
  );
}
```

```tsx
// apps/web/src/app/dashboard/profile-menu.tsx
import { Menu, faceInitial } from '@omnicanvas/ui';
import { signOut } from '@/app/(auth)/actions';

export function ProfileMenu({ displayName }: { displayName: string }) {
  return (
    <Menu
      triggerLabel={`Menu di ${displayName}`}
      label={
        <>
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-xs font-extrabold">
            {faceInitial(displayName)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
        </>
      }
    >
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center rounded-tile px-3 text-left text-sm hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
        >
          Esci
        </button>
      </form>
    </Menu>
  );
}
```

```tsx
// apps/web/src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { Logo, StatusBanner } from '@omnicanvas/ui';
import { clientEnv } from '@/env';
import { loadDashboard } from '@/lib/dashboard/load-dashboard';
import { createServerSupabase } from '@/lib/supabase/server';
import { CreditsCard } from './credits-card';
import { MeetingList } from './meeting-list';
import { NewMeeting } from './new-meeting';
import { ProfileCard } from './profile-card';
import { ProfileMenu } from './profile-menu';

// Impianto «Agenda» (spec accesso-dashboard §3).
export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/dashboard');

  const now = new Date();
  const data = await loadDashboard(supabase, auth.user.id, now);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Logo />
        <span className="flex-1" />
        <ProfileMenu displayName={data.displayName} />
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Le tue riunioni</h1>
          <NewMeeting defaultOpen={data.rooms?.length === 0} />
          <section aria-label="Riunioni" className="rounded-panel bg-surface p-4">
            {data.rooms ? (
              <MeetingList
                rooms={data.rooms}
                creditsByRoom={data.creditsByRoom}
                appUrl={clientEnv.NEXT_PUBLIC_APP_URL}
                now={now}
              />
            ) : (
              <StatusBanner tone="error" live="alert">
                Non riesco a caricare le riunioni. Ricarica la pagina.
              </StatusBanner>
            )}
          </section>
        </div>
        <aside className="flex flex-col gap-4">
          <CreditsCard credits={data.credits} now={now} />
          <ProfileCard displayName={data.displayName} />
        </aside>
      </main>
    </div>
  );
}
```

Nota: «Nuova riunione» sta sopra l'elenco e non nella barra come nello schema della spec,
perché il modulo inline ha bisogno della larghezza della colonna. Se in revisione degli
screenshot Sean lo vuole nella barra, spostare solo il pulsante e lasciare il modulo dove è.

```tsx
// apps/web/src/app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div aria-busy="true" className="flex min-h-dvh flex-col bg-bg">
      <span className="sr-only">Caricamento delle riunioni…</span>
      <div className="mx-auto h-16 w-full max-w-6xl px-4 sm:px-6" />
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <div className="h-8 w-56 rounded-tile bg-raised/60 motion-safe:animate-pulse" />
          <div className="h-11 w-44 rounded-full bg-raised/60 motion-safe:animate-pulse" />
          <div className="h-64 rounded-panel bg-surface motion-safe:animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-28 rounded-panel bg-stage motion-safe:animate-pulse" />
          <div className="h-20 rounded-panel bg-surface motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
```

Eliminare il vecchio modulo: `git rm apps/web/src/app/dashboard/create-room-form.tsx`.

- [ ] **Passo 4: verificare**

Run: `npm test` (i `tests/db` passano solo con Supabase), `npm run typecheck`, `npm run lint`.
Expected: unit e componenti PASS, typecheck e lint puliti.

- [ ] **Passo 5: commit**

```bash
git add -A apps/web/src/app/dashboard tests/unit/dashboard-ui.test.tsx
git commit -m "feat(dashboard): Agenda page with credits, profile and menu"
```

---

### Task 7: e2e, screenshot e documenti

**Files:**
- Modify: `e2e/helpers.ts`, `e2e/screenshots.spec.ts`, `docs/BACKLOG.md`, `CLAUDE.md`
- Create: `e2e/dashboard.spec.ts`

**Interfaces:**
- Produces in `e2e/helpers.ts`: `signUpHost(browser: Browser): Promise<{ host: Page; email: string }>`;
  `signUpHostWithRoom` lo usa (secondo uso: l'astrazione è giustificata).

- [ ] **Passo 1: aggiornare gli helper**

In `e2e/helpers.ts` sostituire `signUpHostWithRoom` con:

```ts
export async function signUpHost(browser: Browser): Promise<{ host: Page; email: string }> {
  const context = await browser.newContext();
  opened.push(context);
  const host = await context.newPage();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

  await host.goto('/signup');
  await host.getByLabel('Nome').fill('Sean');
  await host.getByLabel('Email').fill(email);
  await host.getByLabel('Password').fill('e2e-password-123');
  await host.getByRole('button', { name: 'Registrati' }).click();
  // Il server di sviluppo sotto carico (e2e in parallelo con i media) può metterci qualche secondo.
  await expect(host).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  return { host, email };
}

export async function signUpHostWithRoom(
  browser: Browser,
  title = 'Kickoff Acme',
): Promise<{ host: Page; roomUrl: string; email: string }> {
  const { host, email } = await signUpHost(browser);
  await host.getByRole('button', { name: 'Nuova riunione' }).click();
  await host.getByLabel('Titolo della riunione').fill(title);
  await host.getByRole('button', { name: 'Crea', exact: true }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{8}$/, { timeout: 15_000 });
  return { host, roomUrl: host.url(), email };
}
```

- [ ] **Passo 2: scrivere il nuovo spec**

```ts
// e2e/dashboard.spec.ts
import { expect, test } from '@playwright/test';
import { closeParticipants, signUpHost, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

test('the root page sends visitors to login and hosts to their meetings', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  const { host } = await signUpHost(browser);
  await host.goto('/');
  await expect(host).toHaveURL(/\/dashboard$/);
  await expect(host.getByRole('heading', { name: 'Prima riunione' })).toBeVisible();
});

test('a started meeting is live on the dashboard with its link', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser, 'Kickoff Ferretti');
  await host.goto('/dashboard');
  await expect(host.getByRole('heading', { name: 'In corso' })).toBeVisible();
  await expect(host.getByText('Kickoff Ferretti')).toBeVisible();
  await expect(host.getByRole('link', { name: /Rientra/ })).toBeVisible();
});

test('the host renames themselves from the profile card', async ({ browser }) => {
  const { host } = await signUpHost(browser);
  await host.getByRole('button', { name: 'Modifica' }).click();
  await host.getByLabel('Nome').fill('Giulia Rinaldi');
  await host.getByRole('button', { name: 'Salva' }).click();
  await expect(host.getByRole('button', { name: 'Menu di Giulia Rinaldi' })).toBeVisible();

  await host.getByRole('button', { name: 'Modifica' }).click();
  await host.getByLabel('Nome').fill('   ');
  await host.getByRole('button', { name: 'Salva' }).click();
  await expect(host.getByText('Scrivi il tuo nome, al massimo 40 caratteri.')).toBeVisible();
  await host.reload();
  await expect(host.getByRole('button', { name: 'Menu di Giulia Rinaldi' })).toBeVisible();
});

test('the host signs out from the profile menu', async ({ browser }) => {
  const { host } = await signUpHost(browser);
  await host.getByRole('button', { name: 'Menu di Sean' }).click();
  await host.getByRole('button', { name: 'Esci' }).click();
  await host.goto('/dashboard');
  await expect(host).toHaveURL(/\/login\?next=%2Fdashboard$/);
});
```

Nota: il campo «Nome» ha `maxLength` ma non `required`, apposta: così lo spazio vuoto
arriva al server, che è l'unico controllo che conta.

- [ ] **Passo 3: screenshot di revisione**

In `e2e/screenshots.spec.ts` aggiungere `signUpHost` all'import e, in fondo:

```ts
test('access and dashboard screenshots', async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  await page.screenshot({ path: 'test-results/screenshots/login-desktop.png' });

  const { host: fresh } = await signUpHost(browser);
  await fresh.setViewportSize({ width: 1280, height: 800 });
  await fresh.screenshot({ path: 'test-results/screenshots/dashboard-empty.png' });

  const { host } = await signUpHostWithRoom(browser, 'Kickoff Ferretti Arredi');
  await host.goto('/dashboard');
  for (const [name, size] of [
    ['dashboard-desktop', { width: 1440, height: 900 }],
    ['dashboard-phone', { width: 390, height: 844 }],
  ] as const) {
    await host.setViewportSize(size);
    await host.waitForTimeout(300);
    await host.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
});
```

- [ ] **Passo 4: verificare**

Nel Codespace: `npm run test:e2e` → tutti PASS (i vecchi spec usano gli helper aggiornati).
Poi `SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=desktop` e guardare
le quattro immagini nuove in `test-results/screenshots/`. Sul PC senza Supabase gli e2e li
conferma la CI (job `e2e`).

- [ ] **Passo 5: documenti**

In `docs/BACKLOG.md`, sezione «Redesign (Nod) — 29/09», spuntare la voce del sotto-progetto 3
e dalla voce «Revisione finale (minori)» togliere la ✕ dello spotlight e `font-medium` (risolti).
In `CLAUDE.md`, «Stato attuale», aggiungere una riga: accesso e dashboard «Agenda» su
`slice/accesso-dashboard`, spec `docs/specs/2026-09-30-accesso-dashboard-design.md`.

- [ ] **Passo 6: commit**

```bash
git add e2e docs/BACKLOG.md CLAUDE.md
git commit -m "test(e2e): dashboard journeys and screenshots; docs for access and dashboard"
```
