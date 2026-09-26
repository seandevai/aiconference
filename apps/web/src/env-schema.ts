import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Il browser apre un WebSocket: http/https qui è un errore di configurazione.
  NEXT_PUBLIC_LIVEKIT_URL: z.string().regex(/^wss?:\/\/\S+$/),
});

const serverSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // Firma il cookie dell'ospite senza account: corto = falsificabile.
    GUEST_SESSION_SECRET: z
      .string()
      .min(32)
      .refine((value) => !value.startsWith('sostituisci'), {
        message: 'GUEST_SESSION_SECRET must not be the .env.example placeholder value',
      }),
    // Firmano i token di stanza. In locale valgono devkey/secret di `livekit-server --dev`.
    LIVEKIT_API_KEY: z.string().min(1),
    LIVEKIT_API_SECRET: z.string().min(1),
    // Stato di sessione (snapshot del palco). In locale: Redis + serverless-redis-http.
    KV_REST_API_URL: z.string().url(),
    KV_REST_API_TOKEN: z.string().min(1),
    // 'fake' in sviluppo, CI ed e2e: nessuna chiamata a pagamento.
    AI_PROVIDER: z.enum(['anthropic', 'fake']).default('anthropic'),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    // Voce e immagini sono degradabili: senza chiave la richiesta scritta resta (ADR-0011, 0013).
    DEEPGRAM_API_KEY: z.string().min(1).optional(),
    FAL_KEY: z.string().min(1).optional(),
    // Solo modelli con un prezzo in IMAGE_PRICES_USD_PER_MP.
    FAL_IMAGE_MODEL: z.enum(['fal-ai/flux/schnell']).default('fal-ai/flux/schnell'),
  })
  .refine((env) => env.AI_PROVIDER !== 'anthropic' || Boolean(env.ANTHROPIC_API_KEY), {
    message: 'ANTHROPIC_API_KEY is required when AI_PROVIDER is anthropic',
    path: ['ANTHROPIC_API_KEY'],
  });

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

type RawEnv = Record<string, string | undefined>;

function parse<T>(schema: z.ZodType<T>, raw: RawEnv, scope: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing ${scope} env: ${names}`);
  }
  return result.data;
}

export function parseClientEnv(raw: RawEnv): ClientEnv {
  return parse(clientSchema, raw, 'client');
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  return parse(serverSchema, raw, 'server');
}
