import type { DisconnectCause } from './types';

export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

export function shouldReconnect(cause: DisconnectCause): boolean {
  return cause === 'network';
}

export function reconnectDelay(attempt: number): number | null {
  return RECONNECT_DELAYS_MS[attempt] ?? null;
}

export type Schedule = (fn: () => void, ms: number) => () => void;

export type Reconnector = {
  handleDisconnect(cause: DisconnectCause): void;
  retryNow(): void;
  cancel(): void;
};

const timerSchedule: Schedule = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export function createReconnector(options: {
  connect: () => Promise<void>;
  onGiveUp: () => void;
  schedule?: Schedule;
}): Reconnector {
  const schedule = options.schedule ?? timerSchedule;
  let attempt = 0;
  let cancelTimer: (() => void) | null = null;
  let stopped = false;

  const clearTimer = () => {
    cancelTimer?.();
    cancelTimer = null;
  };

  const planNext = () => {
    const delay = reconnectDelay(attempt);
    if (delay === null) {
      options.onGiveUp();
      return;
    }
    cancelTimer = schedule(() => {
      cancelTimer = null;
      void run();
    }, delay);
  };

  const run = async () => {
    if (stopped) return;
    try {
      await options.connect();
      attempt = 0;
    } catch {
      if (stopped) return;
      attempt += 1;
      planNext();
    }
  };

  return {
    handleDisconnect(cause) {
      if (stopped || !shouldReconnect(cause) || cancelTimer) return;
      attempt = 0;
      planNext();
    },
    retryNow() {
      if (stopped) return;
      clearTimer();
      attempt = 0;
      void run();
    },
    cancel() {
      stopped = true;
      clearTimer();
    },
  };
}
