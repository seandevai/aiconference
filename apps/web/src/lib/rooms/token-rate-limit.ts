import { createHash } from 'node:crypto';
import type { CounterKv } from '@/lib/kv/kv';

// Il token si chiede all'ingresso e a ogni riconnessione: 30 al minuto bastano a chiunque
// stia in una call, e fermano chi martella la route.
export const TOKEN_RATE_LIMIT = { max: 30, windowSeconds: 60 } as const;

export type RateDecision = { ok: true } | { ok: false; retryAfterSeconds: number };

// Finestra fissa: una chiave per soggetto e minuto, che scade con il minuto.
export async function allowTokenRequest(
  kv: CounterKv,
  subject: string,
  now: number = Date.now(),
): Promise<RateDecision> {
  const windowMs = TOKEN_RATE_LIMIT.windowSeconds * 1000;
  const window = Math.floor(now / windowMs);
  const key = `ratelimit:token:${subject}:${window}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, TOKEN_RATE_LIMIT.windowSeconds);
  if (count <= TOKEN_RATE_LIMIT.max) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.ceil(((window + 1) * windowMs - now) / 1000) };
}

// L'account se c'è; per gli ospiti anonimi l'IP, ma solo come hash: in KV niente indirizzi.
export function tokenRateSubject(userId: string | null, ip: string | null): string {
  if (userId) return `u:${userId}`;
  if (!ip) return 'ip:unknown';
  return `ip:${createHash('sha256').update(ip).digest('hex')}`;
}
