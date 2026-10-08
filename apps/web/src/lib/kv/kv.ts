import 'server-only';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/env';

// Il sottoinsieme di Redis che usiamo: basta per sostituirlo nei test con una Map.
export type KvLike = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options: { ex: number }): Promise<unknown>;
};

// Contatori a scadenza, per i limiti di richieste.
export type CounterKv = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

// Chiavi della stanza: la proroga ne sposta la scadenza, la chiusura le toglie.
export type RoomKeysKv = {
  expire(key: string, seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
};

export function createKv(): KvLike & CounterKv & RoomKeysKv {
  const env = serverEnv();
  return new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
}
