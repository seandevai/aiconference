import { createHash } from 'node:crypto';
import type { CounterKv } from '@/lib/kv/kv';

type RateLimit = { readonly name: string; readonly max: number; readonly windowSeconds: number };

// Il token si chiede all'ingresso e a ogni riconnessione: 30 al minuto bastano a chiunque
// stia in una call, e fermano chi martella la route.
export const TOKEN_RATE_LIMIT = { name: 'token', max: 30, windowSeconds: 60 } as const;

// Il form dell'ospite è pubblico e scrive una riga: pochi invii al minuto per indirizzo.
export const GUEST_JOIN_RATE_LIMIT = { name: 'guest-join', max: 10, windowSeconds: 60 } as const;

export type RateDecision = { ok: true } | { ok: false; retryAfterSeconds: number };

// Finestra fissa: una chiave per limite, soggetto e finestra, che scade con la finestra.
async function allowRequest(
  kv: CounterKv,
  limit: RateLimit,
  subject: string,
  now: number,
): Promise<RateDecision> {
  const windowMs = limit.windowSeconds * 1000;
  const window = Math.floor(now / windowMs);
  const key = `ratelimit:${limit.name}:${subject}:${window}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, limit.windowSeconds);
  if (count <= limit.max) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.ceil(((window + 1) * windowMs - now) / 1000) };
}

export function allowTokenRequest(
  kv: CounterKv,
  subject: string,
  now: number = Date.now(),
): Promise<RateDecision> {
  return allowRequest(kv, TOKEN_RATE_LIMIT, subject, now);
}

export function allowGuestJoin(
  kv: CounterKv,
  subject: string,
  now: number = Date.now(),
): Promise<RateDecision> {
  return allowRequest(kv, GUEST_JOIN_RATE_LIMIT, subject, now);
}

// L'account se c'è; per gli ospiti anonimi l'IP, ma solo come hash: in KV niente indirizzi.
export function tokenRateSubject(userId: string | null, ip: string | null): string {
  if (userId) return `u:${userId}`;
  if (!ip) return 'ip:unknown';
  return `ip:${createHash('sha256').update(ip).digest('hex')}`;
}
