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
      [
        room({ id: 'c', status: 'closed' }),
        room({ id: 'p', status: 'purged' }),
        room({ id: 'u', status: 'weird' }),
      ],
      now,
    );
    expect(groups.past.map((r) => r.id).sort()).toEqual(['c', 'p', 'u']);
  });

  it('orders each group from the newest', () => {
    const groups = groupRooms(
      [
        room({ id: 'old', createdAt: '2026-09-01T00:00:00Z' }),
        room({ id: 'new', createdAt: '2026-09-20T00:00:00Z' }),
      ],
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
    expect(monthStart(new Date('2026-09-30T23:59:00Z')).toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    );
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
    const r = room({
      status: 'closed',
      createdAt: '2026-09-29T08:00:00Z',
      startedAt: '2026-09-29T08:00:00Z',
      endedAt: '2026-09-29T08:48:00Z',
    });
    expect(pastMeta(r, 36)).toBe('29 set · 48 min · 36 crediti');
    expect(pastMeta(room({ status: 'active', startedAt: '2026-09-29T08:00:00Z' }), 0)).toBe(
      '29 set',
    );
  });
});
