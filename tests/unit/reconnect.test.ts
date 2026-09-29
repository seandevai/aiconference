import { describe, expect, it, vi } from 'vitest';
import {
  RECONNECT_DELAYS_MS,
  createReconnector,
  reconnectDelay,
  shouldReconnect,
} from '../../packages/realtime/src/reconnect';

function manualClock() {
  const pending: { fn: () => void; ms: number; cancelled: boolean }[] = [];
  return {
    schedule: (fn: () => void, ms: number) => {
      const item = { fn, ms, cancelled: false };
      pending.push(item);
      return () => {
        item.cancelled = true;
      };
    },
    delays: () => pending.map((p) => p.ms),
    active: () => pending.filter((p) => !p.cancelled),
    async fireNext() {
      const next = pending.find((p) => !p.cancelled);
      if (!next) throw new Error('nothing scheduled');
      next.cancelled = true;
      next.fn();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

describe('reconnect policy', () => {
  it('reconnects only after a network loss', () => {
    expect(shouldReconnect('network')).toBe(true);
    for (const cause of ['client', 'replaced', 'removed', 'room_closed'] as const) {
      expect(shouldReconnect(cause)).toBe(false);
    }
  });

  it('backs off and then gives up', () => {
    expect(RECONNECT_DELAYS_MS.map((_, i) => reconnectDelay(i))).toEqual([
      1000, 2000, 4000, 8000, 16000,
    ]);
    expect(reconnectDelay(5)).toBeNull();
  });
});

describe('createReconnector', () => {
  it('ignores disconnects that are not network losses', () => {
    const clock = manualClock();
    const connect = vi.fn(async () => {});
    const reconnector = createReconnector({ connect, onGiveUp: vi.fn(), schedule: clock.schedule });
    reconnector.handleDisconnect('client');
    reconnector.handleDisconnect('room_closed');
    expect(clock.active()).toHaveLength(0);
  });

  it('reconnects after the first delay and stops on success', async () => {
    const clock = manualClock();
    const connect = vi.fn(async () => {});
    const reconnector = createReconnector({ connect, onGiveUp: vi.fn(), schedule: clock.schedule });
    reconnector.handleDisconnect('network');
    expect(clock.delays()).toEqual([1000]);
    await clock.fireNext();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(clock.active()).toHaveLength(0);
  });

  it('walks the backoff and gives up once', async () => {
    const clock = manualClock();
    const connect = vi.fn(async () => {
      throw new Error('offline');
    });
    const onGiveUp = vi.fn();
    const reconnector = createReconnector({ connect, onGiveUp, schedule: clock.schedule });
    reconnector.handleDisconnect('network');
    for (let i = 0; i < 5; i += 1) await clock.fireNext();
    expect(clock.delays()).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(connect).toHaveBeenCalledTimes(5);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it('does not stack timers on repeated disconnects', () => {
    const clock = manualClock();
    const reconnector = createReconnector({
      connect: vi.fn(async () => {}),
      onGiveUp: vi.fn(),
      schedule: clock.schedule,
    });
    reconnector.handleDisconnect('network');
    reconnector.handleDisconnect('network');
    expect(clock.active()).toHaveLength(1);
  });

  it('retries immediately on demand, resetting the backoff', async () => {
    const clock = manualClock();
    const connect = vi.fn(async () => {});
    const reconnector = createReconnector({ connect, onGiveUp: vi.fn(), schedule: clock.schedule });
    reconnector.handleDisconnect('network');
    reconnector.retryNow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(clock.active()).toHaveLength(0);
  });

  it('does nothing after cancel', async () => {
    const clock = manualClock();
    const connect = vi.fn(async () => {});
    const reconnector = createReconnector({ connect, onGiveUp: vi.fn(), schedule: clock.schedule });
    reconnector.handleDisconnect('network');
    reconnector.cancel();
    reconnector.handleDisconnect('network');
    reconnector.retryNow();
    expect(clock.active()).toHaveLength(0);
    expect(connect).not.toHaveBeenCalled();
  });
});
