# Durata della stanza — piano di implementazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, task per task. I passi usano le caselle
> (`- [ ]`) per il tracciamento.

**Obiettivo:** l'host sceglie la durata della riunione alla creazione, la proroga con un click
dopo l'avviso a −5 minuti, e allo zero la stanza si chiude per tutti; dopo la scadenza il
server non emette più token. Sostituisce il job di purga per presence.

**Architettura:** logica pura in `apps/web/src/lib/rooms/timer.ts` (scadenza, proroga, tetto,
fasi, TTL). Il server applica la scadenza in modo pigro: `resolveParticipant` e `joinRoom`
leggono `rooms.ends_at` e trattano la stanza come chiusa dopo il margine. Due route nuove
(`/room/[code]/extend`, `/room/[code]/close`) con la logica in
`apps/web/src/lib/rooms/room-lifecycle.ts`. Il client riceve `endsAt`, `capAt` e
`serverNow` con il token; un hook calcola tempo e fase, un componente mostra pill, avviso e
banner; allo zero l'host chiude la stanza e l'ospite verifica col server prima di uscire.

**Stack:** Next.js 16 App Router, React 19, Supabase JS (service role nelle route), Upstash
Redis, `livekit-server-sdk` (`RoomServiceClient`), Vitest (happy-dom, Testing Library).

**Spec:** `docs/specs/2026-10-04-timer-stanza-design.md`

Branch: `slice/timer-stanza` (già creato da `main`, contiene la spec).

## Vincoli globali

- Nessun contenuto di riunione su disco o nei log: nei log solo id stanza e nome dell'errore
  (regola 1).
- Autorizzazione server-side: proroga e chiusura solo per chi `resolveParticipant` riconosce
  come host (regola 2). `ends_at` non è scrivibile dal client: policy di insert con
  `ends_at is null`, nessuna policy di update (regola 2).
- LiveKit solo in `packages/realtime`: `closeRoom` vive in `packages/realtime/src/server.ts`.
- Durate ammesse: `30, 45, 60, 90` minuti, predefinita `60`. Proroghe: `15, 30` minuti.
- Tetto: `ROOM_MAX_MINUTES = 180` da `started_at`. Margine: `ROOM_EXPIRY_GRACE_SECONDS = 120`.
- Avviso host da `300` secondi, banner ospite da `60` secondi.
- Canale dati: `room-timer`, payload `{ endsAt: string; capAt: string }`, accettato solo
  dall'host (`isFromHost`).
- Testi dell'interfaccia in italiano; codice, test e commit in inglese; commenti in italiano.
- Pulsanti alti almeno 44px (`Button` lo è già); colori solo dai token (`bg`, `surface`,
  `stage`, `raised`, `line`, `fg`, `muted`, `accent`, `danger`).
- Errori delle route: `410 room_ended`, `404 room_not_found`, `403 not_a_participant`,
  `403 host_only`, `409 cap_reached`, `400 invalid_minutes` (si allinea la spec, che diceva
  `not_the_host`, nel Task 8).

## Focus della revisione

1. **Doppio click o due schede dell'host sulla proroga:** una sola proroga applicata.
   Test su `writeExtension` con `ends_at` già spostato (Task 4).
2. **Ospite che perde il messaggio `room-timer`:** allo zero non esce se il server dice che
   la stanza è stata prorogata. Test su `guestShouldStay` (Task 1) e su `useTimerEnd` (Task 6).
3. **Stanze già `active` prima della migrazione:** ricevono `ends_at = started_at + 60 min`
   dal backfill; una stanza con `ends_at` nullo non è mai «finita» per `isRoomOver`, e la
   dashboard tiene la finestra di 12 ore. Test in Task 1 e Task 7.
4. **Orologio del PC sbagliato di minuti:** fasi calcolate con lo scarto del server. Test su
   `useRoomTimer` con `offsetMs` (Task 5).
5. **Ospite che manda un `room-timer` falso:** ignorato. Test su `useRoomTimer` (Task 5).

## Mappa dei file

| File | Responsabilità |
|---|---|
| `apps/web/src/lib/rooms/timer.ts` | costanti e funzioni pure del timer |
| `supabase/migrations/0006_room_timer.sql` | colonne, backfill, policy di insert |
| `packages/db/src/database.types.ts` | tipi di `rooms` con le colonne nuove |
| `apps/web/src/lib/rooms/create-room.ts` | `plannedMinutes` alla creazione |
| `apps/web/src/lib/rooms/resolve-participant.ts` | stanza con tempi, `isRoomOver` |
| `apps/web/src/lib/rooms/join-room.ts` | `isRoomOver` all'ingresso |
| `apps/web/src/lib/rooms/room-token.ts` | attivazione con `ends_at`, tempi nel risultato |
| `apps/web/src/lib/rooms/token-response.ts` | tempi nel corpo della risposta |
| `apps/web/src/app/room/[code]/page.tsx` | `isRoomOver` per l'anonimo |
| `apps/web/src/lib/stage/snapshot-store.ts`, `stage-access.ts` | TTL del palco da `ends_at` |
| `packages/realtime/src/server.ts` | `closeRoom` |
| `apps/web/src/lib/kv/kv.ts` | tipo `RoomKeysKv` (`expire`, `del`) |
| `apps/web/src/lib/rooms/requester.ts` | chi chiede, per le route della stanza |
| `apps/web/src/lib/rooms/room-lifecycle.ts` | `extendRoom`, `writeExtension`, `closeRoomAsHost` |
| `apps/web/src/app/room/[code]/extend/route.ts`, `close/route.ts` | route sottili |
| `apps/web/src/lib/call/use-call.ts` | tempi dal token, `end()` |
| `apps/web/src/lib/call/use-room-timer.ts` | `useRoomTimer`, `useTimerEnd` |
| `apps/web/src/lib/call/room-timer-requests.ts` | fetch di proroga, chiusura, tempi aggiornati |
| `apps/web/src/app/room/[code]/room-timer.tsx` | pill, avviso host, banner ospite |
| `apps/web/src/app/room/[code]/room-call.tsx` | collegamento di timer, proroga, chiusura |
| `apps/web/src/app/dashboard/new-meeting.tsx`, `actions.ts` | selettore della durata |
| `apps/web/src/lib/dashboard/model.ts`, `load-dashboard.ts` | stanza scaduta fra le passate |

---

### Task 1: logica pura del timer

**Files:**
- Create: `apps/web/src/lib/rooms/timer.ts`
- Test: `tests/unit/room-timer.test.ts`

**Interfaces:**
- Produces (tutti esportati da `@/lib/rooms/timer`):
  - `PLANNED_MINUTES: readonly [30, 45, 60, 90]`, `type PlannedMinutes`, `DEFAULT_PLANNED_MINUTES = 60`
  - `EXTEND_MINUTES: readonly [15, 30]`, `type ExtendMinutes`
  - `ROOM_MAX_MINUTES = 180`, `ROOM_EXPIRY_GRACE_SECONDS = 120`, `WARNING_SECONDS = 300`, `LAST_MINUTE_SECONDS = 60`
  - `ENDED_STATUSES: ReadonlySet<string>`
  - `isPlannedMinutes(v: unknown): v is PlannedMinutes`, `isExtendMinutes(v: unknown): v is ExtendMinutes`
  - `isRoomOver(room: { status: string; endsAt: string | null }, now: Date): boolean`
  - `activationEndsAt(startedAt: Date, plannedMinutes: number): Date`
  - `capAt(startedAt: string): Date`
  - `extendEndsAt(room: { startedAt: string; endsAt: string }, minutes: ExtendMinutes, now: Date): { ok: true; endsAt: Date } | { ok: false; reason: 'expired' | 'cap_reached' }`
  - `extendOptions(endsAt: string, capAt: string): ExtendMinutes[]`
  - `kvTtlSeconds(endsAt: string | null, now: Date, fallbackSeconds: number): number`
  - `type TimerPhase = 'normal' | 'warning' | 'last-minute' | 'over'`
  - `remainingSeconds(endsAt: string, nowMs: number): number`
  - `timerPhase(remaining: number): TimerPhase`
  - `formatRemaining(remaining: number): string`
  - `type RoomTimerMessage = { endsAt: string; capAt: string }`, `parseTimerMessage(payload: unknown): RoomTimerMessage | null`
  - `guestShouldStay(currentEndsAt: string, latestEndsAt: string | null): boolean`

- [ ] **Step 1: Write the failing test**

`tests/unit/room-timer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  activationEndsAt,
  capAt,
  extendEndsAt,
  extendOptions,
  formatRemaining,
  guestShouldStay,
  isExtendMinutes,
  isPlannedMinutes,
  isRoomOver,
  kvTtlSeconds,
  parseTimerMessage,
  remainingSeconds,
  timerPhase,
} from '@/lib/rooms/timer';

const at = (iso: string) => new Date(iso);

describe('isRoomOver', () => {
  it('is over for ended statuses whatever the time', () => {
    for (const status of ['closing', 'closed', 'purged']) {
      expect(isRoomOver({ status, endsAt: null }, at('2026-10-04T10:00:00Z'))).toBe(true);
    }
  });

  it('is never over by time when ends_at is missing', () => {
    expect(isRoomOver({ status: 'active', endsAt: null }, at('2030-01-01T00:00:00Z'))).toBe(false);
  });

  it('keeps the room open through the grace period, then closes it', () => {
    const room = { status: 'active', endsAt: '2026-10-04T10:00:00.000Z' };
    expect(isRoomOver(room, at('2026-10-04T10:00:00Z'))).toBe(false);
    expect(isRoomOver(room, at('2026-10-04T10:02:00Z'))).toBe(false);
    expect(isRoomOver(room, at('2026-10-04T10:02:01Z'))).toBe(true);
  });
});

describe('durations', () => {
  it('accepts only the planned and extension values', () => {
    expect([30, 45, 60, 90].every(isPlannedMinutes)).toBe(true);
    expect([0, 15, 61, '60', null].some(isPlannedMinutes)).toBe(false);
    expect([15, 30].every(isExtendMinutes)).toBe(true);
    expect([10, 45, '15'].some(isExtendMinutes)).toBe(false);
  });

  it('sets the deadline from the first entry', () => {
    expect(activationEndsAt(at('2026-10-04T10:00:00Z'), 45).toISOString()).toBe(
      '2026-10-04T10:45:00.000Z',
    );
  });

  it('caps a room at three hours from its start', () => {
    expect(capAt('2026-10-04T10:00:00Z').toISOString()).toBe('2026-10-04T13:00:00.000Z');
  });
});

describe('extendEndsAt', () => {
  const room = { startedAt: '2026-10-04T10:00:00Z', endsAt: '2026-10-04T11:00:00Z' };

  it('adds the minutes to the current deadline', () => {
    const result = extendEndsAt(room, 30, at('2026-10-04T10:56:00Z'));
    expect(result).toEqual({ ok: true, endsAt: at('2026-10-04T11:30:00Z') });
  });

  it('refuses once the deadline has passed', () => {
    expect(extendEndsAt(room, 15, at('2026-10-04T11:00:00Z'))).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('refuses to go past the cap, but allows reaching it exactly', () => {
    const late = { startedAt: '2026-10-04T10:00:00Z', endsAt: '2026-10-04T12:45:00Z' };
    expect(extendEndsAt(late, 15, at('2026-10-04T12:40:00Z'))).toEqual({
      ok: true,
      endsAt: at('2026-10-04T13:00:00Z'),
    });
    expect(extendEndsAt(late, 30, at('2026-10-04T12:40:00Z'))).toEqual({
      ok: false,
      reason: 'cap_reached',
    });
  });

  it('offers only the extensions that fit under the cap', () => {
    expect(extendOptions('2026-10-04T12:00:00Z', '2026-10-04T13:00:00Z')).toEqual([15, 30]);
    expect(extendOptions('2026-10-04T12:45:00Z', '2026-10-04T13:00:00Z')).toEqual([15]);
    expect(extendOptions('2026-10-04T12:50:00Z', '2026-10-04T13:00:00Z')).toEqual([]);
  });
});

describe('kvTtlSeconds', () => {
  it('lasts until the deadline plus the grace period', () => {
    expect(kvTtlSeconds('2026-10-04T11:00:00Z', at('2026-10-04T10:00:00Z'), 999)).toBe(3720);
  });

  it('never drops under a minute', () => {
    expect(kvTtlSeconds('2026-10-04T10:00:00Z', at('2026-10-04T11:00:00Z'), 999)).toBe(60);
  });

  it('falls back when the room has no deadline yet', () => {
    expect(kvTtlSeconds(null, at('2026-10-04T10:00:00Z'), 999)).toBe(999);
  });
});

describe('countdown', () => {
  it('counts whole seconds left, never below zero', () => {
    const endsAt = '2026-10-04T10:00:00Z';
    expect(remainingSeconds(endsAt, Date.parse('2026-10-04T09:59:58.500Z'))).toBe(2);
    expect(remainingSeconds(endsAt, Date.parse('2026-10-04T10:00:05Z'))).toBe(0);
  });

  it('moves through the phases at 5 minutes, 1 minute and zero', () => {
    expect(timerPhase(301)).toBe('normal');
    expect(timerPhase(300)).toBe('warning');
    expect(timerPhase(61)).toBe('warning');
    expect(timerPhase(60)).toBe('last-minute');
    expect(timerPhase(1)).toBe('last-minute');
    expect(timerPhase(0)).toBe('over');
  });

  it('shows minutes when far, minutes and seconds when close', () => {
    expect(formatRemaining(42 * 60)).toBe('42 min');
    expect(formatRemaining(41 * 60 + 1)).toBe('42 min');
    expect(formatRemaining(300)).toBe('5:00');
    expect(formatRemaining(252)).toBe('4:12');
    expect(formatRemaining(7)).toBe('0:07');
  });
});

describe('parseTimerMessage', () => {
  it('accepts two valid dates and nothing else', () => {
    expect(
      parseTimerMessage({ endsAt: '2026-10-04T11:00:00.000Z', capAt: '2026-10-04T13:00:00.000Z' }),
    ).toEqual({ endsAt: '2026-10-04T11:00:00.000Z', capAt: '2026-10-04T13:00:00.000Z' });
    expect(parseTimerMessage({ endsAt: 'domani', capAt: '2026-10-04T13:00:00Z' })).toBeNull();
    expect(parseTimerMessage({ endsAt: '2026-10-04T11:00:00Z' })).toBeNull();
    expect(parseTimerMessage('2026-10-04T11:00:00Z')).toBeNull();
    expect(parseTimerMessage(null)).toBeNull();
  });
});

describe('guestShouldStay', () => {
  it('stays only if the server moved the deadline later', () => {
    expect(guestShouldStay('2026-10-04T11:00:00Z', '2026-10-04T11:15:00Z')).toBe(true);
    expect(guestShouldStay('2026-10-04T11:00:00Z', '2026-10-04T11:00:00Z')).toBe(false);
    expect(guestShouldStay('2026-10-04T11:00:00Z', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/room-timer.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/rooms/timer"`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/rooms/timer.ts`:

```ts
// Durata della stanza (spec 2026-10-04): funzioni pure, usate da route, client e dashboard.
// Niente Supabase, niente React: si testano con un orologio fisso.

export const PLANNED_MINUTES = [30, 45, 60, 90] as const;
export type PlannedMinutes = (typeof PLANNED_MINUTES)[number];
export const DEFAULT_PLANNED_MINUTES: PlannedMinutes = 60;

export const EXTEND_MINUTES = [15, 30] as const;
export type ExtendMinutes = (typeof EXTEND_MINUTES)[number];

// Tetto ai costi per riunione: nessuna stanza vive oltre 3 ore dal primo ingresso.
export const ROOM_MAX_MINUTES = 180;
// Assorbe gli scarti d'orologio fra client e server: non è tempo di riunione in più.
export const ROOM_EXPIRY_GRACE_SECONDS = 120;
export const WARNING_SECONDS = 300;
export const LAST_MINUTE_SECONDS = 60;

const MINUTE_MS = 60_000;
const MIN_KV_TTL_SECONDS = 60;

export const ENDED_STATUSES: ReadonlySet<string> = new Set(['closing', 'closed', 'purged']);

export function isPlannedMinutes(value: unknown): value is PlannedMinutes {
  return (PLANNED_MINUTES as readonly unknown[]).includes(value);
}

export function isExtendMinutes(value: unknown): value is ExtendMinutes {
  return (EXTEND_MINUTES as readonly unknown[]).includes(value);
}

// Chiusa per stato, oppure scaduta: ends_at passato da più del margine.
export function isRoomOver(room: { status: string; endsAt: string | null }, now: Date): boolean {
  if (ENDED_STATUSES.has(room.status)) return true;
  if (room.endsAt === null) return false;
  return now.getTime() > Date.parse(room.endsAt) + ROOM_EXPIRY_GRACE_SECONDS * 1000;
}

export function activationEndsAt(startedAt: Date, plannedMinutes: number): Date {
  return new Date(startedAt.getTime() + plannedMinutes * MINUTE_MS);
}

export function capAt(startedAt: string): Date {
  return new Date(Date.parse(startedAt) + ROOM_MAX_MINUTES * MINUTE_MS);
}

export type ExtendResult =
  | { ok: true; endsAt: Date }
  | { ok: false; reason: 'expired' | 'cap_reached' };

export function extendEndsAt(
  room: { startedAt: string; endsAt: string },
  minutes: ExtendMinutes,
  now: Date,
): ExtendResult {
  const current = Date.parse(room.endsAt);
  if (now.getTime() >= current) return { ok: false, reason: 'expired' };
  const next = current + minutes * MINUTE_MS;
  if (next > capAt(room.startedAt).getTime()) return { ok: false, reason: 'cap_reached' };
  return { ok: true, endsAt: new Date(next) };
}

export function extendOptions(endsAt: string, cap: string): ExtendMinutes[] {
  const room = Date.parse(endsAt);
  return EXTEND_MINUTES.filter((minutes) => room + minutes * MINUTE_MS <= Date.parse(cap));
}

// Lo stato in KV scade da solo con la stanza: nessun job deve cancellarlo.
export function kvTtlSeconds(endsAt: string | null, now: Date, fallbackSeconds: number): number {
  if (endsAt === null) return fallbackSeconds;
  const seconds = Math.ceil((Date.parse(endsAt) - now.getTime()) / 1000) + ROOM_EXPIRY_GRACE_SECONDS;
  return Math.max(MIN_KV_TTL_SECONDS, seconds);
}

export type TimerPhase = 'normal' | 'warning' | 'last-minute' | 'over';

export function remainingSeconds(endsAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - nowMs) / 1000));
}

export function timerPhase(remaining: number): TimerPhase {
  if (remaining <= 0) return 'over';
  if (remaining <= LAST_MINUTE_SECONDS) return 'last-minute';
  if (remaining <= WARNING_SECONDS) return 'warning';
  return 'normal';
}

export function formatRemaining(remaining: number): string {
  if (remaining > WARNING_SECONDS) return `${Math.ceil(remaining / 60)} min`;
  const minutes = Math.floor(remaining / 60);
  return `${minutes}:${String(remaining % 60).padStart(2, '0')}`;
}

export type RoomTimerMessage = { endsAt: string; capAt: string };

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

// Arriva da un altro partecipante: si valida sempre, come i messaggi del palco.
export function parseTimerMessage(payload: unknown): RoomTimerMessage | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { endsAt, capAt: cap } = payload as Record<string, unknown>;
  return isIsoDate(endsAt) && isIsoDate(cap) ? { endsAt, capAt: cap } : null;
}

// L'ospite allo zero chiede al server: resta solo se la scadenza è stata spostata più in là.
export function guestShouldStay(currentEndsAt: string, latestEndsAt: string | null): boolean {
  return latestEndsAt !== null && Date.parse(latestEndsAt) > Date.parse(currentEndsAt);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/room-timer.test.ts`
Expected: PASS, tutti i test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/rooms/timer.ts tests/unit/room-timer.test.ts
git commit -m "feat(rooms): pure room timer logic — deadline, cap, phases, ttl"
```

---

### Task 2: migrazione, tipi e durata alla creazione

**Files:**
- Create: `supabase/migrations/0006_room_timer.sql`
- Modify: `packages/db/src/database.types.ts` (blocco `rooms`, righe 227-270 circa)
- Modify: `apps/web/src/lib/rooms/create-room.ts`
- Test: `tests/db/rls-rooms.test.ts`, `tests/db/create-room.test.ts`

**Interfaces:**
- Consumes: `isPlannedMinutes`, `DEFAULT_PLANNED_MINUTES` (Task 1)
- Produces:
  - colonne `rooms.planned_minutes: number` (not null, default 60), `rooms.ends_at: string | null`
  - `createRoomForUser(supabase, userId, input: { title: string; plannedMinutes?: unknown }, nextCode?)` con il nuovo errore `'INVALID_DURATION'` in `CreateRoomResult`

- [ ] **Step 1: Write the failing tests**

In `tests/db/rls-rooms.test.ts`, dentro il `describe` esistente, dopo gli altri `it`:

```ts
  it('refuses a deadline written by the client', async () => {
    const client = await signedInClient(host);
    const { error } = await client.from('rooms').insert({
      workspace_id: await workspaceOf(host),
      created_by: host.id,
      title: 'Furbo',
      join_code: generateJoinCode(),
      ends_at: '2099-01-01T00:00:00Z',
    });
    expect(error).not.toBeNull();
  });

  it('accepts only the planned durations', async () => {
    const client = await signedInClient(host);
    const workspaceId = await workspaceOf(host);
    const bad = await client.from('rooms').insert({
      workspace_id: workspaceId,
      created_by: host.id,
      title: 'Venti',
      join_code: generateJoinCode(),
      planned_minutes: 20,
    });
    expect(bad.error).not.toBeNull();
    const good = await client
      .from('rooms')
      .insert({
        workspace_id: workspaceId,
        created_by: host.id,
        title: 'Quarantacinque',
        join_code: generateJoinCode(),
        planned_minutes: 45,
      })
      .select('planned_minutes, ends_at')
      .single();
    expect(good.error).toBeNull();
    expect(good.data).toEqual({ planned_minutes: 45, ends_at: null });
  });
```

In `tests/db/create-room.test.ts`, dentro il `describe`:

```ts
  it('stores the chosen duration, 60 minutes when none is given', async () => {
    const client = await signedInClient(host);
    const chosen = await createRoomForUser(client, host.id, { title: 'Breve', plannedMinutes: 30 });
    const fallback = await createRoomForUser(client, host.id, { title: 'Standard' });
    if (!chosen.ok || !fallback.ok) throw new Error('create failed');
    const { data } = await admin
      .from('rooms')
      .select('id, planned_minutes, ends_at')
      .in('id', [chosen.id, fallback.id]);
    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    expect(byId.get(chosen.id)).toMatchObject({ planned_minutes: 30, ends_at: null });
    expect(byId.get(fallback.id)).toMatchObject({ planned_minutes: 60, ends_at: null });
  });

  it('refuses a duration outside the list', async () => {
    const client = await signedInClient(host);
    expect(
      await createRoomForUser(client, host.id, { title: 'Lunga', plannedMinutes: 240 }),
    ).toEqual({ ok: false, error: 'INVALID_DURATION' });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

I test su DB girano nel job `db` della CI o nel Codespace (Docker locale non disponibile).
Prima il typecheck, che fallisce subito anche in locale:

Run: `npm run typecheck`
Expected: FAIL, `Object literal may only specify known properties, and 'ends_at' does not exist` (e `planned_minutes`, `plannedMinutes`).

Nel Codespace: `npx vitest run tests/db/rls-rooms.test.ts tests/db/create-room.test.ts`
Expected: FAIL sulle colonne mancanti.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0006_room_timer.sql`:

```sql
-- Durata della stanza (spec 2026-10-04, ADR-0014): l'host sceglie la durata alla creazione,
-- il server fissa la scadenza al primo ingresso e la sposta solo con una proroga.
-- Nessuna tabella nuova: cambia la policy di insert di rooms, che resta senza update.

alter table public.rooms
  add column planned_minutes integer not null default 60
    check (planned_minutes in (30, 45, 60, 90)),
  add column ends_at timestamptz;

-- Le stanze già aperte ricevono la durata predefinita: senza scadenza resterebbero aperte
-- per sempre, perché la purga per presence non esiste più.
update public.rooms
  set ends_at = started_at + interval '60 minutes'
  where status = 'active' and started_at is not null and ends_at is null;

-- Il client sceglie la durata, mai la scadenza: ends_at lo scrive solo il server.
drop policy "member creates rooms in own workspaces" on public.rooms;
create policy "member creates rooms in own workspaces"
  on public.rooms for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_workspace_member(workspace_id)
    and status = 'created'
    and guest_credit_cap is null
    and ends_at is null
  );
```

- [ ] **Step 4: Update the database types**

In `packages/db/src/database.types.ts`, blocco `rooms`, aggiungere in ordine alfabetico:
- `Row`: `ends_at: string | null;` dopo `created_by`, e `planned_minutes: number;` dopo `join_code`
- `Insert`: `ends_at?: string | null;` e `planned_minutes?: number;` nelle stesse posizioni
- `Update`: `ends_at?: string | null;` e `planned_minutes?: number;` nelle stesse posizioni

Nel Codespace, dopo `npx supabase db reset`, confrontare con `npm run db:types`: se il file
generato differisce solo nell'ordine, tenere il generato.

- [ ] **Step 5: Accept the duration in `createRoomForUser`**

In `apps/web/src/lib/rooms/create-room.ts`:

```ts
import { DEFAULT_PLANNED_MINUTES, isPlannedMinutes } from './timer';
```

Tipo del risultato:

```ts
export type CreateRoomResult =
  | { ok: true; id: string; joinCode: string }
  | { ok: false; error: 'INVALID_TITLE' | 'INVALID_DURATION' | 'NO_WORKSPACE' | 'JOIN_CODE_COLLISION' };
```

Firma e controllo, subito dopo il controllo del titolo:

```ts
export async function createRoomForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { title: string; plannedMinutes?: unknown },
  nextCode: () => string = generateJoinCode,
): Promise<CreateRoomResult> {
  const title = titleSchema.safeParse(input.title);
  if (!title.success) return { ok: false, error: 'INVALID_TITLE' };
  const plannedMinutes = input.plannedMinutes ?? DEFAULT_PLANNED_MINUTES;
  if (!isPlannedMinutes(plannedMinutes)) return { ok: false, error: 'INVALID_DURATION' };
```

E nell'insert, accanto a `title: title.data,`:

```ts
        planned_minutes: plannedMinutes,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run typecheck`
Expected: PASS.

Nel Codespace: `npx supabase db reset && npx vitest run tests/db/rls-rooms.test.ts tests/db/create-room.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0006_room_timer.sql packages/db/src/database.types.ts apps/web/src/lib/rooms/create-room.ts tests/db/rls-rooms.test.ts tests/db/create-room.test.ts
git commit -m "feat(db): room planned duration and server-only deadline"
```

---

### Task 3: scadenza applicata dal server

**Files:**
- Modify: `apps/web/src/lib/rooms/resolve-participant.ts`
- Modify: `apps/web/src/lib/rooms/join-room.ts`
- Modify: `apps/web/src/lib/rooms/room-token.ts`
- Modify: `apps/web/src/lib/rooms/token-response.ts`
- Modify: `apps/web/src/app/room/[code]/page.tsx:57-62`
- Modify: `apps/web/src/lib/stage/snapshot-store.ts`, `apps/web/src/lib/stage/stage-access.ts`
- Test: `tests/db/room-token.test.ts`, `tests/db/join-room.test.ts`, `tests/unit/token-response.test.ts`, `tests/unit/snapshot-store.test.ts`

**Interfaces:**
- Consumes: `isRoomOver`, `activationEndsAt`, `capAt`, `kvTtlSeconds` (Task 1); colonne del Task 2
- Produces:
  - `resolveParticipant(admin, input, now?: Date)`; nel risultato `ok`,
    `room: ResolvedRoom` con `type ResolvedRoom = { id: string; status: string; plannedMinutes: number; startedAt: string | null; endsAt: string | null }`
  - `issueRoomToken(admin, input, config, now?: Date)`; risultato `ok` =
    `{ kind: 'ok'; url: string; token: string; endsAt: string; capAt: string; serverNow: string }`
  - corpo 200 del token: `{ url, token, endsAt, capAt, serverNow }` (stringhe ISO)
  - `saveStage(kv, roomId, stage, ttlSeconds = STAGE_TTL_SECONDS)`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/token-response.test.ts` sostituire il primo `it`:

```ts
  it('returns url, token and the room timing on success', () => {
    expect(
      toTokenResponse({
        kind: 'ok',
        url: 'ws://lk',
        token: 'jwt',
        endsAt: '2026-10-04T11:00:00.000Z',
        capAt: '2026-10-04T13:00:00.000Z',
        serverNow: '2026-10-04T10:00:00.000Z',
      }),
    ).toEqual({
      status: 200,
      body: {
        url: 'ws://lk',
        token: 'jwt',
        endsAt: '2026-10-04T11:00:00.000Z',
        capAt: '2026-10-04T13:00:00.000Z',
        serverNow: '2026-10-04T10:00:00.000Z',
      },
    });
  });
```

In `tests/unit/snapshot-store.test.ts`, nel `describe`:

```ts
  it('uses the ttl it is given', async () => {
    const kv = new MemoryKv();
    await saveStage(kv, roomId, stageAt(1), 720);
    expect(kv.ttl.get(stageKey(roomId))).toBe(720);
  });
```

In `tests/db/room-token.test.ts`, nel `describe`, dopo il primo `it`:

```ts
  it('sets the deadline at activation and returns the timing', async () => {
    const created = await createRoomForUser(await signedInClient(host), host.id, {
      title: 'Timer',
      plannedMinutes: 30,
    });
    if (!created.ok) throw new Error('setup failed');
    await joinedId(created.joinCode, host.id, 'Sean');
    const now = new Date();
    const result = await issueRoomToken(
      admin,
      { joinCode: created.joinCode, userId: host.id, guestParticipantId: noGuest },
      config,
      now,
    );
    if (result.kind !== 'ok') throw new Error(`expected ok, got ${result.kind}`);
    const { data } = await admin
      .from('rooms')
      .select('started_at, ends_at')
      .eq('id', created.id)
      .single();
    const startedAt = Date.parse(data!.started_at!);
    expect(Date.parse(data!.ends_at!) - startedAt).toBe(30 * 60_000);
    expect(result.endsAt).toBe(new Date(data!.ends_at!).toISOString());
    expect(Date.parse(result.capAt) - startedAt).toBe(180 * 60_000);
    expect(result.serverNow).toBe(now.toISOString());
  });

  it('keeps the first deadline when a second token comes later', async () => {
    const created = await roomOf(host, 'Secondo token');
    await joinedId(created.joinCode, host.id, 'Sean');
    const input = { joinCode: created.joinCode, userId: host.id, guestParticipantId: noGuest };
    const first = await issueRoomToken(admin, input, config);
    const second = await issueRoomToken(admin, input, config, new Date(Date.now() + 60_000));
    if (first.kind !== 'ok' || second.kind !== 'ok') throw new Error('expected ok');
    expect(second.endsAt).toBe(first.endsAt);
  });

  it('refuses a token once the deadline and the grace period are over', async () => {
    const created = await roomOf(host, 'Scaduta');
    await joinedId(created.joinCode, host.id, 'Sean');
    await admin
      .from('rooms')
      .update({
        status: 'active',
        started_at: new Date(Date.now() - 70 * 60_000).toISOString(),
        ends_at: new Date(Date.now() - 3 * 60_000).toISOString(),
      })
      .eq('id', created.id);
    const result = await issueRoomToken(
      admin,
      { joinCode: created.joinCode, userId: host.id, guestParticipantId: noGuest },
      config,
    );
    expect(result).toEqual({ kind: 'ended' });
  });
```

In `tests/db/join-room.test.ts`, nel `describe` principale (usare l'host e gli helper già
presenti nel file):

```ts
  it('reports an expired room as ended', async () => {
    const created = await createRoomForUser(await signedInClient(host), host.id, {
      title: 'Scaduta',
    });
    if (!created.ok) throw new Error('setup failed');
    await admin
      .from('rooms')
      .update({
        status: 'active',
        started_at: new Date(Date.now() - 70 * 60_000).toISOString(),
        ends_at: new Date(Date.now() - 3 * 60_000).toISOString(),
      })
      .eq('id', created.id);
    const result = await joinRoom(admin, {
      joinCode: created.joinCode,
      userId: null,
      displayName: 'Cliente',
      language: 'en',
    });
    expect(result).toEqual({ kind: 'ended' });
  });
```

(Se `join-room.test.ts` chiama l'host con un altro nome, usare quello; importare
`createRoomForUser` e `signedInClient` se mancano.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/token-response.test.ts tests/unit/snapshot-store.test.ts`
Expected: FAIL (`endsAt` assente dal corpo; TTL 43200 invece di 720).

Nel Codespace: `npx vitest run tests/db/room-token.test.ts tests/db/join-room.test.ts`
Expected: FAIL (`result.endsAt` undefined; stanza scaduta che risponde `ok`/`joined`).

- [ ] **Step 3: `resolveParticipant` with timing**

In `apps/web/src/lib/rooms/resolve-participant.ts`, rimuovere la costante locale
`ENDED_STATUSES` e:

```ts
import { isRoomOver } from './timer';

export type ResolvedRoom = {
  id: string;
  status: string;
  plannedMinutes: number;
  startedAt: string | null;
  endsAt: string | null;
};

export type ResolveParticipantResult =
  | { kind: 'ok'; room: ResolvedRoom; participant: ResolvedParticipant }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'forbidden' };
```

Firma e lettura della stanza:

```ts
export async function resolveParticipant(
  admin: SupabaseClient<Database>,
  input: ResolveParticipantInput,
  now: Date = new Date(),
): Promise<ResolveParticipantResult> {
  if (!isValidJoinCode(input.joinCode)) return { kind: 'not_found' };

  const { data: row, error } = await admin
    .from('rooms')
    .select('id, status, planned_minutes, started_at, ends_at')
    .eq('join_code', input.joinCode)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { kind: 'not_found' };
  const room: ResolvedRoom = {
    id: row.id,
    status: row.status,
    plannedMinutes: row.planned_minutes,
    startedAt: row.started_at,
    endsAt: row.ends_at,
  };
  if (isRoomOver(room, now)) return { kind: 'ended' };
```

Il resto della funzione resta uguale (usa `room.id`, e nel `return` finale `room`).
Rinominare `row` della query dei partecipanti in `participantRow` per non scontrarsi col
nome nuovo.

- [ ] **Step 4: `joinRoom` with the deadline**

In `apps/web/src/lib/rooms/join-room.ts`, rimuovere `ENDED_STATUSES` e:

```ts
import { isRoomOver } from './timer';
```

```ts
    .select('id, title, join_code, status, created_by, ends_at')
```

```ts
  if (isRoomOver({ status: room.status, endsAt: room.ends_at }, new Date())) {
    return { kind: 'ended' };
  }
```

- [ ] **Step 5: activation with `ends_at` in `issueRoomToken`**

`apps/web/src/lib/rooms/room-token.ts`, file completo:

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { createRoomToken, type LiveKitCredentials } from '@omnicanvas/realtime/server';
import {
  resolveParticipant,
  type ResolvedRoom,
  type ResolveParticipantInput,
} from './resolve-participant';
import { activationEndsAt, capAt } from './timer';

export type LiveKitConfig = LiveKitCredentials & { url: string };

export type RoomTokenResult =
  | { kind: 'ok'; url: string; token: string; endsAt: string; capAt: string; serverNow: string }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'forbidden' };

type Admin = SupabaseClient<Database>;

// CREATA → ATTIVA al primo token (ARCHITECTURE §10): il timer parte qui, non alla creazione.
// Il filtro su status rende idempotente la scrittura quando più partecipanti entrano insieme;
// si rilegge sempre, così chi perde la gara riceve la scadenza di chi l'ha vinta.
async function activate(
  admin: Admin,
  room: ResolvedRoom,
  now: Date,
): Promise<{ startedAt: string; endsAt: string }> {
  if (room.status === 'created') {
    const { error } = await admin
      .from('rooms')
      .update({
        status: 'active',
        started_at: now.toISOString(),
        ends_at: activationEndsAt(now, room.plannedMinutes).toISOString(),
      })
      .eq('id', room.id)
      .eq('status', 'created');
    if (error) throw error;
  } else if (room.startedAt && room.endsAt) {
    return { startedAt: room.startedAt, endsAt: room.endsAt };
  }
  const { data, error } = await admin
    .from('rooms')
    .select('started_at, ends_at')
    .eq('id', room.id)
    .single();
  if (error) throw error;
  if (!data.started_at || !data.ends_at) throw new Error('active room without deadline');
  return { startedAt: data.started_at, endsAt: data.ends_at };
}

export async function issueRoomToken(
  admin: Admin,
  input: ResolveParticipantInput,
  config: LiveKitConfig,
  now: Date = new Date(),
): Promise<RoomTokenResult> {
  const resolved = await resolveParticipant(admin, input, now);
  if (resolved.kind !== 'ok') return resolved;
  const { room, participant } = resolved;
  const timing = await activate(admin, room, now);

  const token = await createRoomToken(
    {
      roomId: room.id,
      participantId: participant.id,
      displayName: participant.displayName,
      role: participant.role,
      language: participant.language,
    },
    { apiKey: config.apiKey, apiSecret: config.apiSecret },
  );
  return {
    kind: 'ok',
    url: config.url,
    token,
    endsAt: new Date(timing.endsAt).toISOString(),
    capAt: capAt(timing.startedAt).toISOString(),
    serverNow: now.toISOString(),
  };
}
```

- [ ] **Step 6: timing in the token response**

`apps/web/src/lib/rooms/token-response.ts`:

```ts
import type { RoomTokenResult } from './room-token';

export type TokenGrantBody = {
  url: string;
  token: string;
  endsAt: string;
  capAt: string;
  serverNow: string;
};

export type TokenResponseBody =
  | TokenGrantBody
  | { error: 'room_not_found' | 'room_ended' | 'not_a_participant' };

export function toTokenResponse(result: RoomTokenResult): {
  status: number;
  body: TokenResponseBody;
} {
  switch (result.kind) {
    case 'ok': {
      const { url, token, endsAt, capAt, serverNow } = result;
      return { status: 200, body: { url, token, endsAt, capAt, serverNow } };
    }
    case 'not_found':
      return { status: 404, body: { error: 'room_not_found' } };
    case 'ended':
      return { status: 410, body: { error: 'room_ended' } };
    case 'forbidden':
      return { status: 403, body: { error: 'not_a_participant' } };
  }
}
```

- [ ] **Step 7: the anonymous page path**

In `apps/web/src/app/room/[code]/page.tsx`:

```ts
import { isRoomOver } from '@/lib/rooms/timer';
```

```ts
  const { data: room } = await admin
    .from('rooms')
    .select('id, title, status, ends_at')
    .eq('join_code', code)
    .maybeSingle();
  if (!room) notFound();
  if (isRoomOver({ status: room.status, endsAt: room.ends_at }, new Date())) {
    return <RoomEnded />;
  }
```

- [ ] **Step 8: stage TTL from the deadline**

In `apps/web/src/lib/stage/snapshot-store.ts`, il commento della costante diventa
`// Solo per le stanze senza scadenza: le altre usano kvTtlSeconds(ends_at).` e:

```ts
export async function saveStage(
  kv: KvLike,
  roomId: string,
  stage: Stage,
  ttlSeconds: number = STAGE_TTL_SECONDS,
): Promise<'saved' | 'stale'> {
  const current = await loadStage(kv, roomId);
  if (current && current.version > stage.version) return 'stale';
  await kv.set(stageKey(roomId), stage, { ex: ttlSeconds });
  return 'saved';
}
```

In `apps/web/src/lib/stage/stage-access.ts`:

```ts
import { kvTtlSeconds } from '@/lib/rooms/timer';
import { STAGE_TTL_SECONDS, loadStage, saveStage } from './snapshot-store';
```

```ts
  const result = await saveStage(
    kv,
    resolved.room.id,
    stage,
    kvTtlSeconds(resolved.room.endsAt, new Date(), STAGE_TTL_SECONDS),
  );
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: PASS.

Nel Codespace: `npx vitest run tests/db`
Expected: PASS, compresi `stage-access` e `agent-request` (passano da `resolveParticipant`).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/rooms apps/web/src/lib/stage apps/web/src/app/room/[code]/page.tsx tests/unit/token-response.test.ts tests/unit/snapshot-store.test.ts tests/db/room-token.test.ts tests/db/join-room.test.ts
git commit -m "feat(rooms): enforce the room deadline server-side and return it with the token"
```

---

### Task 4: proroga e chiusura lato server

**Files:**
- Modify: `packages/realtime/src/server.ts`
- Modify: `apps/web/src/lib/kv/kv.ts`
- Create: `apps/web/src/lib/rooms/requester.ts`
- Modify: `apps/web/src/app/room/[code]/stage/route.ts`
- Create: `apps/web/src/lib/rooms/room-lifecycle.ts`
- Create: `apps/web/src/app/room/[code]/extend/route.ts`
- Create: `apps/web/src/app/room/[code]/close/route.ts`
- Test: `tests/unit/realtime-close-room.test.ts`, `tests/db/room-lifecycle.test.ts`

**Interfaces:**
- Consumes: `resolveParticipant(admin, input, now)` e `ResolvedRoom` (Task 3);
  `isExtendMinutes`, `extendEndsAt`, `capAt`, `kvTtlSeconds` (Task 1); `stageKey`,
  `STAGE_TTL_SECONDS` da `@/lib/stage/snapshot-store`
- Produces:
  - `closeRoom(roomId: string, config: LiveKitCredentials & { url: string }): Promise<void>` da `@omnicanvas/realtime/server`
  - `type RoomKeysKv = { expire(key: string, seconds: number): Promise<unknown>; del(...keys: string[]): Promise<unknown> }`
  - `requesterOf(code: string): Promise<ResolveParticipantInput>` da `@/lib/rooms/requester`
  - `type LifecycleResult = { status: number; body: unknown }`
  - `extendRoom(admin, kv: RoomKeysKv, input, minutes: unknown, now?: Date): Promise<LifecycleResult>`; corpo 200 `{ endsAt: string; capAt: string; serverNow: string }`
  - `writeExtension(admin, roomId: string, previousEndsAt: string, nextEndsAt: string): Promise<string>` (restituisce l'`ends_at` corrente, ISO)
  - `closeRoomAsHost(admin, kv: RoomKeysKv, input, closeLive: (roomId: string) => Promise<void>, now?: Date): Promise<LifecycleResult>`; corpo 200 `{ closed: true }`
  - `POST /room/[code]/extend` (corpo `{ minutes }`), `POST /room/[code]/close`

- [ ] **Step 1: Write the failing tests**

`tests/unit/realtime-close-room.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

// vi.mock sale in cima al file: i finti vanno creati con vi.hoisted.
const { deleteRoom, RoomServiceClient } = vi.hoisted(() => {
  const deleteRoom = vi.fn(async () => {});
  const RoomServiceClient = vi.fn(function () {
    return { deleteRoom };
  });
  return { deleteRoom, RoomServiceClient };
});

vi.mock('livekit-server-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('livekit-server-sdk')>()),
  RoomServiceClient,
}));

const { closeRoom } = await import('@omnicanvas/realtime/server');

describe('closeRoom', () => {
  it('deletes the realtime room with the server credentials', async () => {
    await closeRoom('room-1', { url: 'ws://localhost:7880', apiKey: 'devkey', apiSecret: 'secret' });
    expect(RoomServiceClient).toHaveBeenCalledWith('ws://localhost:7880', 'devkey', 'secret');
    expect(deleteRoom).toHaveBeenCalledWith('room-1');
  });
});
```

`tests/db/room-lifecycle.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RoomKeysKv } from '@/lib/kv/kv';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { closeRoomAsHost, extendRoom, writeExtension } from '@/lib/rooms/room-lifecycle';
import { issueRoomToken } from '@/lib/rooms/room-token';
import { stageKey } from '@/lib/stage/snapshot-store';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

const config = { url: 'ws://localhost:7880', apiKey: 'devkey', apiSecret: 'secret' };

class MemoryKeys implements RoomKeysKv {
  readonly expired = new Map<string, number>();
  readonly deleted: string[] = [];
  async expire(key: string, seconds: number) {
    this.expired.set(key, seconds);
    return 1;
  }
  async del(...keys: string[]) {
    this.deleted.push(...keys);
    return keys.length;
  }
}

describe('room lifecycle', () => {
  let host: TestUser;

  beforeAll(async () => {
    host = await createTestUser('lifecycle-host');
  });

  // Stanza attiva da 30 minuti pianificati, con host e un ospite anonimo dentro.
  async function liveRoom() {
    const created = await createRoomForUser(await signedInClient(host), host.id, {
      title: 'Timer',
      plannedMinutes: 30,
    });
    if (!created.ok) throw new Error('setup failed');
    const joinCode = created.joinCode;
    await joinRoom(admin, { joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    const guest = await joinRoom(admin, {
      joinCode,
      userId: null,
      displayName: 'Cliente',
      language: 'en',
    });
    if (guest.kind !== 'joined') throw new Error('guest join failed');
    const asHost = { joinCode, userId: host.id, guestParticipantId: () => null };
    const token = await issueRoomToken(admin, asHost, config);
    if (token.kind !== 'ok') throw new Error('activation failed');
    return {
      id: created.id,
      endsAt: token.endsAt,
      asHost,
      asGuest: { joinCode, userId: null, guestParticipantId: () => guest.participantId },
    };
  }

  const minutesAfter = (iso: string, minutes: number) =>
    new Date(Date.parse(iso) + minutes * 60_000).toISOString();

  describe('extendRoom', () => {
    it('moves the deadline and the stage ttl for the host', async () => {
      const room = await liveRoom();
      const kv = new MemoryKeys();
      const result = await extendRoom(admin, kv, room.asHost, 15);
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ endsAt: minutesAfter(room.endsAt, 15) });
      const { data } = await admin.from('rooms').select('ends_at').eq('id', room.id).single();
      expect(new Date(data!.ends_at!).toISOString()).toBe(minutesAfter(room.endsAt, 15));
      expect(kv.expired.get(stageKey(room.id))).toBeGreaterThan(44 * 60);
    });

    it('refuses a guest', async () => {
      const room = await liveRoom();
      expect(await extendRoom(admin, new MemoryKeys(), room.asGuest, 15)).toEqual({
        status: 403,
        body: { error: 'host_only' },
      });
    });

    it('refuses minutes outside the list', async () => {
      const room = await liveRoom();
      expect(await extendRoom(admin, new MemoryKeys(), room.asHost, 20)).toEqual({
        status: 400,
        body: { error: 'invalid_minutes' },
      });
    });

    it('stops at three hours', async () => {
      const room = await liveRoom();
      const kv = new MemoryKeys();
      // 30 pianificati + 5 × 30 = 180: la sesta proroga supera il tetto.
      for (let i = 0; i < 5; i++) {
        expect((await extendRoom(admin, kv, room.asHost, 30)).status).toBe(200);
      }
      expect(await extendRoom(admin, kv, room.asHost, 15)).toEqual({
        status: 409,
        body: { error: 'cap_reached' },
      });
    });

    it('refuses after the deadline, even inside the grace period', async () => {
      const room = await liveRoom();
      const justAfter = new Date(Date.parse(room.endsAt) + 1_000);
      expect(await extendRoom(admin, new MemoryKeys(), room.asHost, 15, justAfter)).toEqual({
        status: 410,
        body: { error: 'room_ended' },
      });
    });
  });

  describe('writeExtension', () => {
    it('applies one extension when two start from the same deadline', async () => {
      const room = await liveRoom();
      const first = await writeExtension(
        admin,
        room.id,
        room.endsAt,
        minutesAfter(room.endsAt, 15),
      );
      const second = await writeExtension(
        admin,
        room.id,
        room.endsAt,
        minutesAfter(room.endsAt, 15),
      );
      expect(first).toBe(minutesAfter(room.endsAt, 15));
      expect(second).toBe(minutesAfter(room.endsAt, 15));
      const { data } = await admin.from('rooms').select('ends_at').eq('id', room.id).single();
      expect(new Date(data!.ends_at!).toISOString()).toBe(minutesAfter(room.endsAt, 15));
    });
  });

  describe('closeRoomAsHost', () => {
    it('closes the room, clears its keys and the realtime room', async () => {
      const room = await liveRoom();
      const kv = new MemoryKeys();
      const closeLive = vi.fn(async () => {});
      expect(await closeRoomAsHost(admin, kv, room.asHost, closeLive)).toEqual({
        status: 200,
        body: { closed: true },
      });
      const { data } = await admin
        .from('rooms')
        .select('status, ended_at')
        .eq('id', room.id)
        .single();
      expect(data?.status).toBe('closed');
      expect(data?.ended_at).not.toBeNull();
      expect(kv.deleted).toEqual([stageKey(room.id)]);
      expect(closeLive).toHaveBeenCalledWith(room.id);
    });

    it('answers 200 again without doing anything twice', async () => {
      const room = await liveRoom();
      const closeLive = vi.fn(async () => {});
      await closeRoomAsHost(admin, new MemoryKeys(), room.asHost, closeLive);
      expect(await closeRoomAsHost(admin, new MemoryKeys(), room.asHost, closeLive)).toEqual({
        status: 200,
        body: { closed: true },
      });
      expect(closeLive).toHaveBeenCalledTimes(1);
    });

    it('refuses a guest', async () => {
      const room = await liveRoom();
      expect(await closeRoomAsHost(admin, new MemoryKeys(), room.asGuest, vi.fn())).toEqual({
        status: 403,
        body: { error: 'host_only' },
      });
    });

    it('still closes the room when the realtime service fails', async () => {
      const room = await liveRoom();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const closeLive = vi.fn(async () => {
        throw new Error('unreachable');
      });
      expect((await closeRoomAsHost(admin, new MemoryKeys(), room.asHost, closeLive)).status).toBe(
        200,
      );
      const { data } = await admin.from('rooms').select('status').eq('id', room.id).single();
      expect(data?.status).toBe('closed');
      expect(warn).toHaveBeenCalledWith('room close: realtime room not closed', {
        roomId: room.id,
        error: 'Error',
      });
      warn.mockRestore();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/realtime-close-room.test.ts`
Expected: FAIL, `closeRoom is not a function`.

Run: `npm run typecheck`
Expected: FAIL, `Module '"@/lib/rooms/room-lifecycle"' not found` (e `RoomKeysKv`).

- [ ] **Step 3: `closeRoom` in the realtime boundary**

In `packages/realtime/src/server.ts`, import:

```ts
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
```

In fondo al file:

```ts
// Chiude la stanza per tutti: LiveKit scollega i partecipanti con causa «room_closed».
// L'URL può essere ws(s)://: l'SDK lo converte in http(s):// per le chiamate di servizio.
export async function closeRoom(
  roomId: string,
  config: LiveKitCredentials & { url: string },
): Promise<void> {
  await new RoomServiceClient(config.url, config.apiKey, config.apiSecret).deleteRoom(roomId);
}
```

- [ ] **Step 4: KV type for room keys**

In `apps/web/src/lib/kv/kv.ts`, dopo `CounterKv`:

```ts
// Chiavi della stanza: la proroga ne sposta la scadenza, la chiusura le toglie.
export type RoomKeysKv = {
  expire(key: string, seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
};

export function createKv(): KvLike & CounterKv & RoomKeysKv {
```

- [ ] **Step 5: `requesterOf`, shared by the room routes**

`apps/web/src/lib/rooms/requester.ts` (terzo uso dello stesso codice: si estrae ora):

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { readGuestParticipantId } from './guest-cookie';
import type { ResolveParticipantInput } from './resolve-participant';

// Chi chiede, per le route della stanza: utente con sessione o ospite col cookie firmato.
export async function requesterOf(code: string): Promise<ResolveParticipantInput> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  return {
    joinCode: code,
    userId: auth.user?.id ?? null,
    guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
  };
}
```

In `apps/web/src/app/room/[code]/stage/route.ts`: eliminare la funzione `who` e gli import
ormai inutili (`cookies`, `readGuestParticipantId`, `ResolveParticipantInput`,
`createServerSupabase`), importare `requesterOf` da `@/lib/rooms/requester` e sostituire
`await who(code)` con `await requesterOf(code)` nei due handler.

- [ ] **Step 6: `room-lifecycle.ts`**

`apps/web/src/lib/rooms/room-lifecycle.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import type { RoomKeysKv } from '@/lib/kv/kv';
import { STAGE_TTL_SECONDS, stageKey } from '@/lib/stage/snapshot-store';
import { resolveParticipant, type ResolveParticipantInput } from './resolve-participant';
import { capAt, extendEndsAt, isExtendMinutes, kvTtlSeconds } from './timer';

export type LifecycleResult = { status: number; body: unknown };

type Admin = SupabaseClient<Database>;

const ENDED: LifecycleResult = { status: 410, body: { error: 'room_ended' } };
const HOST_ONLY: LifecycleResult = { status: 403, body: { error: 'host_only' } };
const REFUSALS: Record<'not_found' | 'ended' | 'forbidden', LifecycleResult> = {
  not_found: { status: 404, body: { error: 'room_not_found' } },
  ended: ENDED,
  forbidden: { status: 403, body: { error: 'not_a_participant' } },
};

// Scrittura condizionata sulla scadenza letta: due proroghe partite dalla stessa scadenza
// ne applicano una sola. Restituisce la scadenza in vigore dopo il tentativo.
export async function writeExtension(
  admin: Admin,
  roomId: string,
  previousEndsAt: string,
  nextEndsAt: string,
): Promise<string> {
  const { data, error } = await admin
    .from('rooms')
    .update({ ends_at: nextEndsAt })
    .eq('id', roomId)
    .eq('status', 'active')
    .eq('ends_at', previousEndsAt)
    .select('ends_at')
    .maybeSingle();
  if (error) throw error;
  if (data?.ends_at) return new Date(data.ends_at).toISOString();
  const { data: current, error: readError } = await admin
    .from('rooms')
    .select('ends_at')
    .eq('id', roomId)
    .single();
  if (readError) throw readError;
  if (!current.ends_at) throw new Error('room lost its deadline');
  return new Date(current.ends_at).toISOString();
}

// Proroga riservata all'host. Nessun costo e nessun ledger: non chiama provider.
export async function extendRoom(
  admin: Admin,
  kv: RoomKeysKv,
  input: ResolveParticipantInput,
  minutes: unknown,
  now: Date = new Date(),
): Promise<LifecycleResult> {
  if (!isExtendMinutes(minutes)) return { status: 400, body: { error: 'invalid_minutes' } };
  const resolved = await resolveParticipant(admin, input, now);
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  if (resolved.participant.role !== 'host') return HOST_ONLY;
  const { room } = resolved;
  if (room.status !== 'active' || !room.startedAt || !room.endsAt) return ENDED;

  const next = extendEndsAt({ startedAt: room.startedAt, endsAt: room.endsAt }, minutes, now);
  if (!next.ok) {
    return next.reason === 'expired' ? ENDED : { status: 409, body: { error: 'cap_reached' } };
  }
  const endsAt = await writeExtension(admin, room.id, room.endsAt, next.endsAt.toISOString());
  await kv.expire(stageKey(room.id), kvTtlSeconds(endsAt, now, STAGE_TTL_SECONDS));
  return {
    status: 200,
    body: { endsAt, capAt: capAt(room.startedAt).toISOString(), serverNow: now.toISOString() },
  };
}

// Chiusura da parte dell'host, a mano o allo zero. Idempotente: una stanza già chiusa
// risponde 200 senza toccare nulla.
export async function closeRoomAsHost(
  admin: Admin,
  kv: RoomKeysKv,
  input: ResolveParticipantInput,
  closeLive: (roomId: string) => Promise<void>,
  now: Date = new Date(),
): Promise<LifecycleResult> {
  const resolved = await resolveParticipant(admin, input, now);
  if (resolved.kind === 'ended') return { status: 200, body: { closed: true } };
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  if (resolved.participant.role !== 'host') return HOST_ONLY;
  const { room } = resolved;

  const { data, error } = await admin
    .from('rooms')
    .update({ status: 'closed', ended_at: now.toISOString() })
    .eq('id', room.id)
    .eq('status', 'active')
    .select('id');
  if (error) throw error;
  if ((data ?? []).length === 0) return { status: 200, body: { closed: true } };

  await kv.del(stageKey(room.id));
  try {
    await closeLive(room.id);
  } catch (cause) {
    // Solo metadati (regola 1). La stanza vuota la chiude comunque l'emptyTimeout di LiveKit.
    console.warn('room close: realtime room not closed', {
      roomId: room.id,
      error: cause instanceof Error ? cause.name : 'unknown',
    });
  }
  return { status: 200, body: { closed: true } };
}
```

- [ ] **Step 7: the two routes**

`apps/web/src/app/room/[code]/extend/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createKv } from '@/lib/kv/kv';
import { requesterOf } from '@/lib/rooms/requester';
import { extendRoom } from '@/lib/rooms/room-lifecycle';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const payload = (await request.json().catch(() => null)) as { minutes?: unknown } | null;
  const { status, body } = await extendRoom(
    createAdminSupabase(),
    createKv(),
    await requesterOf(code),
    payload?.minutes,
  );
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
```

`apps/web/src/app/room/[code]/close/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { closeRoom } from '@omnicanvas/realtime/server';
import { clientEnv, serverEnv } from '@/env';
import { createKv } from '@/lib/kv/kv';
import { requesterOf } from '@/lib/rooms/requester';
import { closeRoomAsHost } from '@/lib/rooms/room-lifecycle';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const env = serverEnv();
  const livekit = {
    url: clientEnv.NEXT_PUBLIC_LIVEKIT_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
  };
  const { status, body } = await closeRoomAsHost(
    createAdminSupabase(),
    createKv(),
    await requesterOf(code),
    (roomId) => closeRoom(roomId, livekit),
  );
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run typecheck && npx vitest run tests/unit/realtime-close-room.test.ts`
Expected: PASS.

Nel Codespace: `npx vitest run tests/db/room-lifecycle.test.ts tests/db/stage-access.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/realtime/src/server.ts apps/web/src/lib/kv/kv.ts apps/web/src/lib/rooms/requester.ts apps/web/src/lib/rooms/room-lifecycle.ts "apps/web/src/app/room/[code]/stage/route.ts" "apps/web/src/app/room/[code]/extend/route.ts" "apps/web/src/app/room/[code]/close/route.ts" tests/unit/realtime-close-room.test.ts tests/db/room-lifecycle.test.ts
git commit -m "feat(rooms): host-only extend and close routes"
```

---

### Task 5: tempi nel client e `useRoomTimer`

**Files:**
- Modify: `apps/web/src/lib/call/use-call.ts`
- Create: `apps/web/src/lib/call/use-room-timer.ts`
- Test: `tests/unit/use-room-timer.test.tsx`

**Interfaces:**
- Consumes: `TokenGrantBody` (Task 3); `remainingSeconds`, `timerPhase`, `extendOptions`,
  `parseTimerMessage`, `TimerPhase`, `ExtendMinutes` (Task 1); `isFromHost` da `@/lib/stage/peek`
- Produces:
  - `type RoomTiming = { endsAt: string; capAt: string; offsetMs: number }` (da `use-call.ts`)
  - `CallState.timing: RoomTiming | null`
  - `useCall(...)` restituisce anche `end: () => Promise<void>` (come `leave`, ma fase `'ended'`)
  - `useRoomTimer({ timing, session, roster }): { timer: RoomTimerView | null; applyTiming: (endsAt: string, capAt: string) => void }`
  - `type RoomTimerView = { endsAt: string; capAt: string; remainingSeconds: number; phase: TimerPhase; extendOptions: ExtendMinutes[] }`

- [ ] **Step 1: Write the failing test**

`tests/unit/use-room-timer.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';
import { useRoomTimer } from '@/lib/call/use-room-timer';

const entry = (identity: string, role: 'host' | 'guest', isLocal: boolean): RosterEntry => ({
  identity,
  name: identity,
  role,
  language: 'it',
  isLocal,
  micOn: true,
  camOn: true,
  speaking: false,
});
const roster = [entry('me', 'guest', true), entry('host', 'host', false), entry('other', 'guest', false)];

function fakeSession() {
  const handlers = new Map<string, (payload: unknown, from: string) => void>();
  const session = {
    onData: (channel: string, handler: (payload: unknown, from: string) => void) => {
      handlers.set(channel, handler);
      return () => handlers.delete(channel);
    },
  } as unknown as RealtimeSession;
  return { session, emit: (channel: string, payload: unknown, from: string) => handlers.get(channel)?.(payload, from) };
}

const NOW = Date.parse('2026-10-04T10:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRoomTimer', () => {
  it('is empty until the token brings the timing', () => {
    const { result } = renderHook(() => useRoomTimer({ timing: null, session: null, roster }));
    expect(result.current.timer).toBeNull();
  });

  it('counts down and changes phase', async () => {
    const timing = { endsAt: '2026-10-04T10:05:30Z', capAt: '2026-10-04T13:00:00Z', offsetMs: 0 };
    const { result } = renderHook(() => useRoomTimer({ timing, session: null, roster }));
    expect(result.current.timer).toMatchObject({ remainingSeconds: 330, phase: 'normal' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(result.current.timer).toMatchObject({ remainingSeconds: 299, phase: 'warning' });
  });

  it('corrects a wrong local clock with the server offset', () => {
    // Il PC è 4 minuti indietro: per il server mancano 1:30, non 5:30.
    const timing = {
      endsAt: '2026-10-04T10:05:30Z',
      capAt: '2026-10-04T13:00:00Z',
      offsetMs: 4 * 60_000,
    };
    const { result } = renderHook(() => useRoomTimer({ timing, session: null, roster }));
    expect(result.current.timer).toMatchObject({ remainingSeconds: 90, phase: 'warning' });
  });

  it('follows an extension announced by the host and ignores one from a guest', () => {
    const { session, emit } = fakeSession();
    const timing = { endsAt: '2026-10-04T10:04:00Z', capAt: '2026-10-04T13:00:00Z', offsetMs: 0 };
    const { result } = renderHook(() => useRoomTimer({ timing, session, roster }));
    act(() => emit('room-timer', { endsAt: '2026-10-04T12:00:00Z', capAt: '2026-10-04T13:00:00Z' }, 'other'));
    expect(result.current.timer?.endsAt).toBe('2026-10-04T10:04:00Z');
    act(() => emit('room-timer', { endsAt: '2026-10-04T10:19:00Z', capAt: '2026-10-04T13:00:00Z' }, 'host'));
    expect(result.current.timer).toMatchObject({ endsAt: '2026-10-04T10:19:00Z', phase: 'normal' });
  });

  it('lists only the extensions under the cap', () => {
    const timing = { endsAt: '2026-10-04T12:45:00Z', capAt: '2026-10-04T13:00:00Z', offsetMs: 0 };
    const { result } = renderHook(() => useRoomTimer({ timing, session: null, roster }));
    expect(result.current.timer?.extendOptions).toEqual([15]);
  });

  it('takes the new timing from the host own extension', () => {
    const timing = { endsAt: '2026-10-04T10:04:00Z', capAt: '2026-10-04T13:00:00Z', offsetMs: 0 };
    const { result } = renderHook(() => useRoomTimer({ timing, session: null, roster }));
    act(() => result.current.applyTiming('2026-10-04T10:34:00Z', '2026-10-04T13:00:00Z'));
    expect(result.current.timer).toMatchObject({ endsAt: '2026-10-04T10:34:00Z', phase: 'normal' });
  });

  it('starts over from a new token, after a reconnection', () => {
    const first = { endsAt: '2026-10-04T10:04:00Z', capAt: '2026-10-04T13:00:00Z', offsetMs: 0 };
    const { result, rerender } = renderHook(({ timing }) => useRoomTimer({ timing, session: null, roster }), {
      initialProps: { timing: first },
    });
    act(() => result.current.applyTiming('2026-10-04T10:19:00Z', '2026-10-04T13:00:00Z'));
    const second = { endsAt: '2026-10-04T10:34:00Z', capAt: '2026-10-04T13:00:00Z', offsetMs: 0 };
    rerender({ timing: second });
    expect(result.current.timer?.endsAt).toBe('2026-10-04T10:34:00Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/use-room-timer.test.tsx`
Expected: FAIL, `Failed to resolve import "@/lib/call/use-room-timer"`.

- [ ] **Step 3: timing and `end()` in `useCall`**

In `apps/web/src/lib/call/use-call.ts`:

```ts
import type { TokenGrantBody } from '@/lib/rooms/token-response';
```

```ts
// Scadenza della stanza e scarto fra l'orologio del server e quello di questo browser.
export type RoomTiming = { endsAt: string; capAt: string; offsetMs: number };

export type CallState = {
  phase: CallPhase;
  roster: RosterEntry[];
  audioBlocked: boolean;
  mediaError: string | null;
  canSwitchCamera: boolean;
  cameraFacing: FacingMode;
  timing: RoomTiming | null;
};
```

```ts
async function fetchRoomToken(joinCode: string): Promise<TokenGrantBody> {
  const response = await fetch(`/room/${joinCode}/token`, { method: 'POST', cache: 'no-store' });
  // 4xx è una risposta definitiva: non ha senso riprovare. 5xx e rete sì.
  if (isTokenRefusal(response.status)) throw new TokenRefusedError(response.status);
  if (!response.ok) throw new Error(`room token failed with status ${response.status}`);
  return (await response.json()) as TokenGrantBody;
}
```

In `initialState` aggiungere `timing: null,`. In `connect`, il tipo diventa
`let credentials: TokenGrantBody;` e subito dopo `if (lifecycle.stopped) return;`:

```ts
      patch({
        timing: {
          endsAt: credentials.endsAt,
          capAt: credentials.capAt,
          offsetMs: Date.parse(credentials.serverNow) - Date.now(),
        },
      });
```

Sostituire `leave` con una funzione comune e due callback:

```ts
  const stop = useCallback(async (phase: 'left' | 'ended') => {
    if (lifecycleRef.current) lifecycleRef.current.stopped = true;
    reconnectorRef.current?.cancel();
    await sessionRef.current?.disconnect();
    sessionRef.current = null;
    setSession(null);
    setState((s) => ({ ...s, phase, roster: [] }));
  }, []);

  const leave = useCallback(() => stop('left'), [stop]);
  // Allo zero del timer: stessa uscita, ma la riunione è finita per tutti.
  const end = useCallback(() => stop('ended'), [stop]);
```

E aggiungere `end` all'oggetto restituito, dopo `leave`.

- [ ] **Step 4: `useRoomTimer`**

`apps/web/src/lib/call/use-room-timer.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';
import {
  extendOptions,
  parseTimerMessage,
  remainingSeconds,
  timerPhase,
  type ExtendMinutes,
  type TimerPhase,
} from '@/lib/rooms/timer';
import { isFromHost } from '@/lib/stage/peek';
import type { RoomTiming } from './use-call';

export type RoomTimerView = {
  endsAt: string;
  capAt: string;
  remainingSeconds: number;
  phase: TimerPhase;
  extendOptions: ExtendMinutes[];
};

type Args = { timing: RoomTiming | null; session: RealtimeSession | null; roster: RosterEntry[] };

const TICK_MS = 1_000;

export function useRoomTimer({ timing, session, roster }: Args) {
  // Il token porta i tempi; proroghe e messaggi dell'host li aggiornano. Un token nuovo
  // (riconnessione) riparte da sé: si confronta l'origine durante il render, senza effetti.
  const [latest, setLatest] = useState({ from: timing, value: timing });
  if (latest.from !== timing) setLatest({ from: timing, value: timing });
  const value = latest.from === timing ? latest.value : timing;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const applyTiming = useCallback((endsAt: string, capAt: string) => {
    setLatest((current) =>
      current.value ? { ...current, value: { ...current.value, endsAt, capAt } } : current,
    );
  }, []);

  const rosterRef = useRef(roster);
  useEffect(() => {
    rosterRef.current = roster;
  }, [roster]);

  useEffect(() => {
    if (!session) return;
    return session.onData('room-timer', (payload, from) => {
      // Solo l'host proroga: un messaggio da un ospite non sposta la scadenza di nessuno.
      if (!isFromHost(rosterRef.current, from)) return;
      const message = parseTimerMessage(payload);
      if (message) applyTiming(message.endsAt, message.capAt);
    });
  }, [session, applyTiming]);

  if (!value) return { timer: null, applyTiming };
  const remaining = remainingSeconds(value.endsAt, nowMs + value.offsetMs);
  const timer: RoomTimerView = {
    endsAt: value.endsAt,
    capAt: value.capAt,
    remainingSeconds: remaining,
    phase: timerPhase(remaining),
    extendOptions: extendOptions(value.endsAt, value.capAt),
  };
  return { timer, applyTiming };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/use-room-timer.test.tsx tests/unit/call-phase.test.ts tests/unit/call-reconnect-attach.test.tsx && npm run typecheck && npm run lint`
Expected: PASS. Se `call-reconnect-attach` simula la risposta del token senza i tempi,
aggiungere al corpo finto `endsAt`, `capAt` e `serverNow` (stringhe ISO qualsiasi).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/call/use-call.ts apps/web/src/lib/call/use-room-timer.ts tests/unit/use-room-timer.test.tsx
git commit -m "feat(call): room timing from the token and the countdown hook"
```

---

### Task 6: avviso, proroga e chiusura nella call

**Files:**
- Create: `apps/web/src/lib/call/room-timer-requests.ts`
- Modify: `apps/web/src/lib/call/use-room-timer.ts` (+ `useTimerEnd`)
- Create: `apps/web/src/app/room/[code]/room-timer.tsx`
- Modify: `apps/web/src/app/room/[code]/room-call.tsx`
- Test: `tests/unit/room-timer-ui.test.tsx`, `tests/unit/room-timer-requests.test.ts`

**Interfaces:**
- Consumes: `useRoomTimer`, `RoomTimerView` (Task 5); `end()` di `useCall` (Task 5);
  `formatRemaining`, `guestShouldStay`, `ROOM_MAX_MINUTES`, `ExtendMinutes`, `TimerPhase`
  (Task 1); route del Task 4
- Produces:
  - `extendRoomRequest(joinCode: string, minutes: ExtendMinutes): Promise<{ endsAt: string; capAt: string } | null>`
  - `closeRoomRequest(joinCode: string): Promise<void>`
  - `latestEndsAt(joinCode: string): Promise<{ endsAt: string; capAt: string } | null>`
  - `useTimerEnd(phase: TimerPhase | null, active: boolean, onEnd: () => void): void`
  - `RoomTimerPill`, `RoomTimerNotice` (componenti)

- [ ] **Step 1: Write the failing tests**

`tests/unit/room-timer-requests.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeRoomRequest, extendRoomRequest, latestEndsAt } from '@/lib/call/room-timer-requests';

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('room timer requests', () => {
  it('posts the extension and returns the new timing', async () => {
    const fetchMock = vi.fn(async () =>
      json(200, { endsAt: 'e', capAt: 'c', serverNow: 'n' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await extendRoomRequest('ABCD2345', 15)).toEqual({ endsAt: 'e', capAt: 'c' });
    expect(fetchMock).toHaveBeenCalledWith('/room/ABCD2345/extend', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 15 }),
    });
  });

  it('returns null when the extension is refused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'cap_reached' })));
    expect(await extendRoomRequest('ABCD2345', 30)).toBeNull();
  });

  it('closes without throwing on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await expect(closeRoomRequest('ABCD2345')).resolves.toBeUndefined();
  });

  it('reads the latest deadline from a fresh token, null when the room is over', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { url: 'u', token: 't', endsAt: 'e', capAt: 'c', serverNow: 'n' })));
    expect(await latestEndsAt('ABCD2345')).toEqual({ endsAt: 'e', capAt: 'c' });
    vi.stubGlobal('fetch', vi.fn(async () => json(410, { error: 'room_ended' })));
    expect(await latestEndsAt('ABCD2345')).toBeNull();
  });
});
```

`tests/unit/room-timer-ui.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomTimerNotice, RoomTimerPill } from '@/app/room/[code]/room-timer';
import { useTimerEnd, type RoomTimerView } from '@/lib/call/use-room-timer';
import type { TimerPhase } from '@/lib/rooms/timer';

afterEach(cleanup);

const view = (over: Partial<RoomTimerView>): RoomTimerView => ({
  endsAt: '2026-10-04T11:00:00Z',
  capAt: '2026-10-04T13:00:00Z',
  remainingSeconds: 42 * 60,
  phase: 'normal',
  extendOptions: [15, 30],
  ...over,
});

const handlers = () => ({ onExtend: vi.fn(), onEndNow: vi.fn() });

describe('RoomTimerPill', () => {
  it('shows the time left', () => {
    render(<RoomTimerPill timer={view({})} />);
    expect(screen.getByText('42 min')).toBeTruthy();
    expect(screen.getByLabelText('Tempo rimasto')).toBeTruthy();
  });
});

describe('RoomTimerNotice', () => {
  it('shows nothing to the host before five minutes', () => {
    const { container } = render(
      <RoomTimerNotice role="host" timer={view({})} extending={false} {...handlers()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('offers the host both extensions and ending now at five minutes', () => {
    const h = handlers();
    render(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 299, phase: 'warning' })}
        extending={false}
        {...h}
      />,
    );
    expect(screen.getByText('La riunione termina fra 4:59')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+30 min' }));
    expect(h.onExtend).toHaveBeenCalledWith(30);
    fireEvent.click(screen.getByRole('button', { name: 'Termina ora' }));
    expect(h.onEndNow).toHaveBeenCalled();
  });

  it('hides an extension past the cap and says so when none is left', () => {
    const { rerender } = render(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 200, phase: 'warning', extendOptions: [15] })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(screen.queryByRole('button', { name: '+30 min' })).toBeNull();
    expect(screen.getByRole('button', { name: '+15 min' })).toBeTruthy();
    rerender(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 200, phase: 'warning', extendOptions: [] })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(screen.queryByRole('button', { name: '+15 min' })).toBeNull();
    expect(screen.getByText(/Hai raggiunto il massimo di 3 ore/)).toBeTruthy();
  });

  it('disables the extensions while one is in flight', () => {
    render(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 200, phase: 'warning' })}
        extending
        {...handlers()}
      />,
    );
    expect((screen.getByRole('button', { name: '+15 min' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('warns a guest only in the last minute', () => {
    const { container, rerender } = render(
      <RoomTimerNotice
        role="guest"
        timer={view({ remainingSeconds: 200, phase: 'warning' })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(container.textContent).toBe('');
    rerender(
      <RoomTimerNotice
        role="guest"
        timer={view({ remainingSeconds: 42, phase: 'last-minute' })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(screen.getByText('La riunione sta per terminare · 0:42')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('useTimerEnd', () => {
  it('fires once when the phase reaches over, and again after an extension', () => {
    const onEnd = vi.fn();
    const { rerender } = renderHook(({ phase }) => useTimerEnd(phase, true, onEnd), {
      initialProps: { phase: 'last-minute' as TimerPhase },
    });
    expect(onEnd).not.toHaveBeenCalled();
    rerender({ phase: 'over' });
    rerender({ phase: 'over' });
    expect(onEnd).toHaveBeenCalledTimes(1);
    rerender({ phase: 'normal' });
    rerender({ phase: 'over' });
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the call is not live', () => {
    const onEnd = vi.fn();
    renderHook(() => useTimerEnd('over', false, onEnd));
    expect(onEnd).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/room-timer-ui.test.tsx tests/unit/room-timer-requests.test.ts`
Expected: FAIL, import non risolti (`room-timer`, `room-timer-requests`, `useTimerEnd`).

- [ ] **Step 3: requests**

`apps/web/src/lib/call/room-timer-requests.ts`:

```ts
import type { ExtendMinutes } from '@/lib/rooms/timer';

type Timing = { endsAt: string; capAt: string };

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: 'POST',
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });

// null se il server rifiuta (tetto, stanza finita) o la rete manca: chi chiama mostra l'errore.
export async function extendRoomRequest(
  joinCode: string,
  minutes: ExtendMinutes,
): Promise<Timing | null> {
  try {
    const response = await post(`/room/${joinCode}/extend`, { minutes });
    if (!response.ok) return null;
    const { endsAt, capAt } = (await response.json()) as Timing;
    return { endsAt, capAt };
  } catch {
    return null;
  }
}

// Non lancia mai: se la chiusura non arriva, la scadenza lato server chiude comunque.
export async function closeRoomRequest(joinCode: string): Promise<void> {
  try {
    await post(`/room/${joinCode}/close`);
  } catch {
    // Rete assente: ci pensa la scadenza pigra.
  }
}

// L'ospite allo zero chiede un token nuovo solo per leggere la scadenza in vigore.
export async function latestEndsAt(joinCode: string): Promise<Timing | null> {
  try {
    const response = await post(`/room/${joinCode}/token`);
    if (!response.ok) return null;
    const { endsAt, capAt } = (await response.json()) as Timing;
    return { endsAt, capAt };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: `useTimerEnd`**

In fondo a `apps/web/src/lib/call/use-room-timer.ts`:

```ts
// Chiama onEnd una volta quando il timer arriva a zero; di nuovo solo se una proroga lo
// ha fatto ripartire e torna a zero.
export function useTimerEnd(phase: TimerPhase | null, active: boolean, onEnd: () => void) {
  const firedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);
  useEffect(() => {
    if (phase !== 'over') {
      firedRef.current = false;
      return;
    }
    if (!active || firedRef.current) return;
    firedRef.current = true;
    onEndRef.current();
  }, [phase, active]);
}
```

- [ ] **Step 5: the component**

`apps/web/src/app/room/[code]/room-timer.tsx`:

```tsx
'use client';

import { Button, StatusBanner } from '@omnicanvas/ui';
import type { RoomTimerView } from '@/lib/call/use-room-timer';
import { ROOM_MAX_MINUTES, formatRemaining, type ExtendMinutes } from '@/lib/rooms/timer';

export function RoomTimerPill({ timer }: { timer: RoomTimerView }) {
  return (
    <span
      aria-label="Tempo rimasto"
      className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold tabular-nums text-fg"
    >
      {formatRemaining(timer.remainingSeconds)}
    </span>
  );
}

type NoticeProps = {
  role: 'host' | 'guest';
  timer: RoomTimerView;
  extending: boolean;
  onExtend: (minutes: ExtendMinutes) => void;
  onEndNow: () => void;
};

// Non blocca nulla: la call continua sotto. L'host vede l'avviso a −5 minuti, l'ospite
// solo nell'ultimo minuto, senza pulsanti (solo l'host proroga).
export function RoomTimerNotice({ role, timer, extending, onExtend, onEndNow }: NoticeProps) {
  const left = formatRemaining(timer.remainingSeconds);
  if (role === 'guest') {
    if (timer.phase !== 'last-minute') return null;
    return <StatusBanner tone="warning">{`La riunione sta per terminare · ${left}`}</StatusBanner>;
  }
  if (timer.phase !== 'warning' && timer.phase !== 'last-minute') return null;
  const capNote =
    timer.extendOptions.length === 0
      ? ` · Hai raggiunto il massimo di ${ROOM_MAX_MINUTES / 60} ore.`
      : '';
  return (
    <StatusBanner
      tone="warning"
      action={
        <span className="flex flex-wrap gap-2">
          {timer.extendOptions.map((minutes) => (
            <Button key={minutes} size="sm" disabled={extending} onClick={() => onExtend(minutes)}>
              {`+${minutes} min`}
            </Button>
          ))}
          <Button size="sm" variant="exit" onClick={onEndNow}>
            Termina ora
          </Button>
        </span>
      }
    >
      {`La riunione termina fra ${left}${capNote}`}
    </StatusBanner>
  );
}
```

Un'unica stringa: `getByText` la trova intera. `Button` accetta già `size="sm"` e
`variant="exit"` (usati in `room-call.tsx`).

- [ ] **Step 6: wire it into `RoomCall`**

In `apps/web/src/app/room/[code]/room-call.tsx`, import:

```ts
import { closeRoomRequest, extendRoomRequest, latestEndsAt } from '@/lib/call/room-timer-requests';
import { useRoomTimer, useTimerEnd } from '@/lib/call/use-room-timer';
import { guestShouldStay, type ExtendMinutes } from '@/lib/rooms/timer';
import { RoomTimerNotice, RoomTimerPill } from './room-timer';
```

Da `useCall` prendere anche `end`. Dopo `const stageApi = ...`:

```ts
  const { timer, applyTiming } = useRoomTimer({
    timing: state.timing,
    session,
    roster: state.roster,
  });
  const [extending, setExtending] = useState(false);
  const [extendFailed, setExtendFailed] = useState(false);
```

Dopo `const live = ...` (serve `live`):

```ts
  // Host: chiude la stanza per tutti (dalla slice 8 il pacchetto si compone prima).
  // Ospite: chiede al server se l'host ha prorogato e il messaggio si è perso.
  const finish = useCallback(async () => {
    if (role === 'host') {
      await closeRoomRequest(joinCode);
      await end();
      return;
    }
    const latest = await latestEndsAt(joinCode);
    if (timer && latest && guestShouldStay(timer.endsAt, latest.endsAt)) {
      applyTiming(latest.endsAt, latest.capAt);
      return;
    }
    await end();
  }, [role, joinCode, end, timer, applyTiming]);

  useTimerEnd(timer?.phase ?? null, live, () => void finish());

  async function handleExtend(minutes: ExtendMinutes) {
    setExtending(true);
    setExtendFailed(false);
    const next = await extendRoomRequest(joinCode, minutes);
    setExtending(false);
    if (!next) {
      setExtendFailed(true);
      return;
    }
    applyTiming(next.endsAt, next.capAt);
    void session?.sendData('room-timer', next).catch(() => {});
  }
```

Nella `<section aria-label="Palco">`, subito dopo il blocco `{state.audioBlocked && live && (...)}`:

```tsx
          {timer && live && (
            <RoomTimerNotice
              role={role}
              timer={timer}
              extending={extending}
              onExtend={(minutes) => void handleExtend(minutes)}
              onEndNow={() => void finish()}
            />
          )}
          {extendFailed && live && (
            <StatusBanner tone="error" live="alert">
              Non sono riuscito a prorogare la riunione. Riprova.
            </StatusBanner>
          )}
```

Nel `<nav aria-label="Controlli della chiamata">`, come primo figlio:

```tsx
          {role === 'host' && timer && <RoomTimerPill timer={timer} />}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit && npm run typecheck && npm run lint`
Expected: PASS, compresi i test esistenti di `call-layout` e `call-minor-fixes` (se
simulano `useCall`, aggiungere `end: vi.fn()` e `timing: null` ai valori finti).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/call apps/web/src/app/room/[code]/room-timer.tsx apps/web/src/app/room/[code]/room-call.tsx tests/unit/room-timer-ui.test.tsx tests/unit/room-timer-requests.test.ts
git commit -m "feat(call): countdown, five-minute warning, extension and close at zero"
```

---

### Task 7: durata alla creazione e dashboard

**Files:**
- Modify: `apps/web/src/app/dashboard/new-meeting.tsx`
- Modify: `apps/web/src/app/dashboard/actions.ts`
- Modify: `apps/web/src/lib/dashboard/model.ts`, `apps/web/src/lib/dashboard/load-dashboard.ts`
- Test: `tests/unit/dashboard-model.test.ts`, `tests/unit/dashboard-ui.test.tsx`

**Interfaces:**
- Consumes: `PLANNED_MINUTES`, `DEFAULT_PLANNED_MINUTES`, `isRoomOver` (Task 1);
  `createRoomForUser` con `plannedMinutes` e `INVALID_DURATION` (Task 2)
- Produces: `DashboardRoom.endsAt: string | null`; campo `planned_minutes` nel form

- [ ] **Step 1: Write the failing tests**

In `tests/unit/dashboard-model.test.ts`, nella factory `room` aggiungere `endsAt: null,`
dopo `endedAt: null,`; poi nel `describe('groupRooms')`:

```ts
  it('moves an active room past its deadline among the past ones', () => {
    const expired = room({
      id: 'expired',
      status: 'active',
      startedAt: '2026-09-30T08:00:00Z',
      endsAt: '2026-09-30T09:00:00Z',
    });
    const running = room({
      id: 'running',
      status: 'active',
      startedAt: '2026-09-30T09:30:00Z',
      endsAt: '2026-09-30T10:30:00Z',
    });
    const groups = groupRooms([expired, running], now);
    expect(groups.live.map((r) => r.id)).toEqual(['running']);
    expect(groups.past.map((r) => r.id)).toEqual(['expired']);
  });
```

In `tests/unit/dashboard-ui.test.tsx`, nella factory `room` aggiungere `endsAt: null,`; poi
nel `describe` di `NewMeeting` (o in uno nuovo):

```tsx
describe('NewMeeting duration', () => {
  it('offers the four durations with one hour preselected', () => {
    render(<NewMeeting defaultOpen />);
    const select = screen.getByLabelText('Durata') as HTMLSelectElement;
    expect(select.name).toBe('planned_minutes');
    expect(select.value).toBe('60');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      '30 minuti',
      '45 minuti',
      '1 ora',
      '1 ora e 30',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/dashboard-model.test.ts tests/unit/dashboard-ui.test.tsx`
Expected: FAIL (`expired` fra le live; `Unable to find a label with the text of: Durata`).

- [ ] **Step 3: model and loader**

In `apps/web/src/lib/dashboard/model.ts`:

```ts
import { isRoomOver } from '@/lib/rooms/timer';
```

In `DashboardRoom` aggiungere `endsAt: string | null;` dopo `endedAt`. Il commento di
`LIVE_WINDOW_MS` diventa: `// Per le stanze senza scadenza (create prima del timer): oltre
questa soglia una stanza «active» si considera finita.` E `isLive`:

```ts
function isLive(room: DashboardRoom, now: Date): boolean {
  if (!LIVE_STATUSES.has(room.status) || !room.startedAt) return false;
  if (isRoomOver(room, now)) return false;
  return now.getTime() - new Date(room.startedAt).getTime() < LIVE_WINDOW_MS;
}
```

In `apps/web/src/lib/dashboard/load-dashboard.ts`: la select diventa
`'id, title, join_code, status, started_at, ended_at, ends_at, created_at'` e nella
mappatura delle righe si aggiunge `endsAt: row.ends_at,` dopo `endedAt: row.ended_at,`.

- [ ] **Step 4: the duration select**

In `apps/web/src/app/dashboard/new-meeting.tsx`:

```ts
import { DEFAULT_PLANNED_MINUTES, PLANNED_MINUTES, type PlannedMinutes } from '@/lib/rooms/timer';

const DURATION_LABELS: Record<PlannedMinutes, string> = {
  30: '30 minuti',
  45: '45 minuti',
  60: '1 ora',
  90: '1 ora e 30',
};
```

Nel `<form>`, fra il `div` del titolo e il pulsante «Crea»:

```tsx
          <div className="flex flex-col gap-1">
            <label htmlFor="planned-minutes" className="text-xs font-semibold text-muted">
              Durata
            </label>
            <select
              id="planned-minutes"
              name="planned_minutes"
              defaultValue={DEFAULT_PLANNED_MINUTES}
              className="min-h-11 rounded-tile border border-line bg-stage px-3 text-sm text-fg hover:border-muted focus-visible:border-accent focus-visible:outline-none"
            >
              {PLANNED_MINUTES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {DURATION_LABELS[minutes]}
                </option>
              ))}
            </select>
          </div>
```

In `apps/web/src/app/dashboard/actions.ts`, in `MESSAGES`:

```ts
  INVALID_DURATION: 'Scegli una durata fra quelle proposte.',
```

e la chiamata:

```ts
  const result = await createRoomForUser(supabase, data.user.id, {
    title: String(formData.get('title') ?? ''),
    plannedMinutes: Number(formData.get('planned_minutes') ?? DEFAULT_PLANNED_MINUTES),
  });
```

con `import { DEFAULT_PLANNED_MINUTES } from '@/lib/rooms/timer';`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit && npm run typecheck && npm run lint`
Expected: PASS.

Nel Codespace: `npx vitest run tests/db/dashboard-data.test.ts`
Expected: PASS (se il test confronta le righe con `toEqual`, aggiungere `endsAt: null`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard apps/web/src/lib/dashboard tests/unit/dashboard-model.test.ts tests/unit/dashboard-ui.test.tsx
git commit -m "feat(dashboard): choose the meeting duration, expired rooms among the past ones"
```

---

### Task 8: documenti, ADR e verifica finale

**Files:**
- Create: `docs/adr/0014-durata-della-stanza.md`
- Modify: `docs/ARCHITECTURE.md` (§10), `docs/DATA-MODEL.md` (tabella `rooms`),
  `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (§4.9),
  `docs/specs/2026-10-04-timer-stanza-design.md` (§3.3), `docs/BACKLOG.md`, `CLAUDE.md`
  («Stato attuale»)

**Interfaces:**
- Consumes: tutto il codice dei Task 1-7 (solo per descriverlo)
- Produces: documentazione allineata

- [ ] **Step 1: ADR-0014**

`docs/adr/0014-durata-della-stanza.md` (seguire il formato degli ADR esistenti, per esempio
`0008-pacchetto-cifrato-lato-client.md`):

```markdown
# ADR-0014 — Durata della stanza al posto della purga per presence

Data: 04/10/2026. Stato: accettata.

## Contesto

Il ciclo di vita prevedeva un job che purgava le stanze senza presence da N minuti
(spec v3 §4.9). Serviva una presence in KV che nessun codice scrive, un cron frequente
(Vercel Hobby lo esegue una volta al giorno) e non dava all'host alcun controllo sul
tempo, né un tetto ai costi per riunione.

## Decisione

L'host sceglie la durata alla creazione (30, 45, 60, 90 minuti). Al primo ingresso il
server fissa `rooms.ends_at`. A −5 minuti l'host può prorogare di 15 o 30 minuti, fino a
3 ore dall'inizio. Allo zero il browser dell'host chiude la stanza; se l'host manca, la
stanza scade: ogni route tratta `now > ends_at + 2 minuti` come chiusa, il KV scade per
TTL, LiveKit chiude la stanza vuota.

## Conseguenze

- Nessun cron, nessuna presence in KV.
- Un client modificato può restare connesso a una stanza LiveKit scaduta fino
  all'`emptyTimeout`: nessun dato di sessione resta sui nostri server. Il cron di riserva
  con `closeRoom` è in backlog.
- Le stanze scadute senza chiusura restano `active` in Postgres: lo stato reale si legge
  con `isRoomOver`.
- Niente crediti a minuto: l'economia resta rinviata a dopo l'MVP.
```

- [ ] **Step 2: architecture, data model, specs**

- `docs/ARCHITECTURE.md` §10: sostituire il blocco del ciclo di vita e il paragrafo sotto
  con il blocco di §2 della spec `2026-10-04-timer-stanza-design.md` e una riga di rimando
  ad ADR-0014.
- `docs/DATA-MODEL.md`, tabella `rooms`: aggiungere
  `| planned_minutes | integer | 30, 45, 60, 90; predefinito 60 |` e
  `| ends_at | timestamptz | fissato al primo ingresso, spostato solo dalle proroghe |`;
  la nota sull'indice `(status, started_at)` per il job di purga diventa «indice storico,
  nessun job lo usa più».
- `docs/specs/2026-09-23-omnicanvas-mvp-design.md` §4.9: sostituire «PURGATA» e il
  paragrafo del job con il rimando ad ADR-0014.
- `docs/specs/2026-10-04-timer-stanza-design.md` §3.3: `not_the_host` → `host_only`;
  `remainingExtendMinutes` → `capAt` nella risposta (il client calcola le proroghe che
  restano con `extendOptions`); aggiungere `400 invalid_minutes`; in §4.3 aggiungere che
  l'ospite allo zero chiede un token nuovo e resta se la scadenza è stata spostata.

- [ ] **Step 3: backlog and project state**

In `docs/BACKLOG.md`, sezione slice 8: sostituire «Job di purga delle stanze abbandonate» e
«Test: dopo la purga i dati di sessione non esistono» con:

```markdown
- [x] Durata della stanza al posto della purga (ADR-0014, `slice/timer-stanza`)
- [ ] Pacchetto composto dal browser dell'host prima di `close`, anche allo zero del timer
```

E in una sezione «Dopo il timer»:

```markdown
- [ ] Cron di riserva: `closeRoom` sulle stanze `active` con `ends_at` passato (piano Vercel Pro
      o servizio esterno)
- [ ] Pulizia delle stanze CREATE mai aperte
- [ ] `close` chiude anche le righe aperte di `room_participants` (oggi restano con `left_at` nullo)
- [ ] Rimuovere `room:{id}:presence` dai documenti: nessun codice la usa e non serve più
- [ ] Il cookie dell'ospite resta di 12 ore: innocuo (la stanza scaduta rifiuta il token),
      ma si può legare a `ends_at` quando la scadenza è nota all'ingresso
```

In `CLAUDE.md`, «Stato attuale»: una riga sul timer della stanza su `slice/timer-stanza`
(spec `docs/specs/2026-10-04-timer-stanza-design.md`, ADR-0014).

- [ ] **Step 4: full verification**

Run: `npm run verify`
Expected: typecheck, lint e test unitari verdi.

Run: `npm run build`
Expected: build completata, route `/room/[code]/extend` e `/room/[code]/close` elencate.

Nel Codespace: `npx supabase db reset && npm run test:db && npm run test:e2e`
Expected: tutto verde; lo smoke crea la riunione con la durata predefinita senza modifiche.

- [ ] **Step 5: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: room timer replaces the presence purge (ADR-0014)"
```

---

## Verifica a mano (dopo il merge su staging)

1. Creare una riunione da 30 minuti; entrare come host e da un'altra finestra come ospite.
2. Nel Codespace, accorciare la scadenza: `update rooms set ends_at = now() + interval '4 minutes' where join_code = '…';`, poi ricaricare la pagina dell'host.
3. Host: pill «4:…», avviso con «+15 min», «+30 min», «Termina ora». Premere «+15 min»:
   l'avviso sparisce, l'ospite non vede nulla.
4. Riaccorciare a 50 secondi: l'ospite vede il banner, allo zero entrambi vedono «Questa
   riunione è terminata»; la riga è `closed`; `/room/<code>` mostra la pagina di fine.
