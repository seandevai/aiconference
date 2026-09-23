import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Firma il cookie dell'ospite senza account: corto = falsificabile.
  GUEST_SESSION_SECRET: z
    .string()
    .min(32)
    .refine((value) => !value.startsWith('sostituisci'), {
      message: 'GUEST_SESSION_SECRET must not be the .env.example placeholder value',
    }),
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
