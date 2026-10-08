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
