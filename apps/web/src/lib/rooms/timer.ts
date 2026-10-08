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
