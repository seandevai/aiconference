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
