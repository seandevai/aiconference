import { describe, expect, it } from 'vitest';
import type { CounterKv } from '@/lib/kv/kv';
import {
  TOKEN_RATE_LIMIT,
  allowTokenRequest,
  tokenRateSubject,
} from '@/lib/rooms/token-rate-limit';

class MemoryCounter implements CounterKv {
  readonly counts = new Map<string, number>();
  readonly ttl = new Map<string, number>();
  async incr(key: string) {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
  async expire(key: string, seconds: number) {
    this.ttl.set(key, seconds);
    return 1;
  }
}

const start = Date.UTC(2026, 8, 29, 10, 0, 0);

describe('allowTokenRequest', () => {
  it('allows up to the limit in one minute, then asks to wait', async () => {
    const kv = new MemoryCounter();
    for (let i = 0; i < TOKEN_RATE_LIMIT.max; i++) {
      expect(await allowTokenRequest(kv, 'u:1', start + i)).toEqual({ ok: true });
    }
    expect(await allowTokenRequest(kv, 'u:1', start + 20_000)).toEqual({
      ok: false,
      retryAfterSeconds: 40,
    });
  });

  it('starts again in the next minute', async () => {
    const kv = new MemoryCounter();
    for (let i = 0; i <= TOKEN_RATE_LIMIT.max; i++) await allowTokenRequest(kv, 'u:1', start);
    expect(await allowTokenRequest(kv, 'u:1', start + 60_000)).toEqual({ ok: true });
  });

  it('counts each subject on its own', async () => {
    const kv = new MemoryCounter();
    for (let i = 0; i <= TOKEN_RATE_LIMIT.max; i++) await allowTokenRequest(kv, 'u:1', start);
    expect(await allowTokenRequest(kv, 'u:2', start)).toEqual({ ok: true });
  });

  it('lets the counter expire with the window', async () => {
    const kv = new MemoryCounter();
    await allowTokenRequest(kv, 'u:1', start);
    expect([...kv.ttl.values()]).toEqual([TOKEN_RATE_LIMIT.windowSeconds]);
  });
});

describe('tokenRateSubject', () => {
  it('uses the account when signed in', () => {
    expect(tokenRateSubject('user-1', '203.0.113.7')).toBe('u:user-1');
  });
  it('uses a hash of the address for anonymous guests, never the address itself', () => {
    const subject = tokenRateSubject(null, '203.0.113.7');
    expect(subject).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(subject).not.toContain('203.0.113.7');
  });
  it('still limits when the address is unknown', () => {
    expect(tokenRateSubject(null, null)).toBe('ip:unknown');
  });
});
