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
  const minutes = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
  );
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
