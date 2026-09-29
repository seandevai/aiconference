import { parseClientEnv, parseServerEnv, type ServerEnv } from './env-schema';

// Le NEXT_PUBLIC_ vanno lette una per una: Next le sostituisce a build time solo così.
export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
});

let cachedServerEnv: ServerEnv | undefined;

// Chiamata solo da moduli server-only. Pigra per non rompere la build del client.
export function serverEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  });
  return cachedServerEnv;
}
