import { describe, expect, it } from 'vitest';
import { parseClientEnv, parseServerEnv } from '@/env-schema';

const clientOk = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
};

const serverOk = {
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  GUEST_SESSION_SECRET: 'x'.repeat(32),
};

describe('env', () => {
  it('accepts a valid client env', () => {
    expect(parseClientEnv(clientOk).NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
  });

  it('names the missing client variable', () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _omitted, ...incomplete } = clientOk;
    expect(() => parseClientEnv(incomplete)).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('rejects a malformed url', () => {
    expect(() => parseClientEnv({ ...clientOk, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('accepts a valid server env', () => {
    expect(parseServerEnv(serverOk).GUEST_SESSION_SECRET).toHaveLength(32);
  });

  it('rejects a short guest session secret', () => {
    expect(() => parseServerEnv({ ...serverOk, GUEST_SESSION_SECRET: 'short' })).toThrow(
      /GUEST_SESSION_SECRET/,
    );
  });

  it('rejects the .env.example placeholder', () => {
    expect(() =>
      parseServerEnv({
        ...serverOk,
        GUEST_SESSION_SECRET: 'sostituisci_con_64_caratteri_esadecimali_casuali_0000000000000000',
      }),
    ).toThrow(/GUEST_SESSION_SECRET/);
  });
});
