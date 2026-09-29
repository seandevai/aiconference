import { describe, expect, it } from 'vitest';
import { parseClientEnv, parseServerEnv } from '@/env-schema';

const clientOk = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_LIVEKIT_URL: 'ws://localhost:7880',
};

const serverOk = {
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  GUEST_SESSION_SECRET: 'x'.repeat(32),
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'secret',
  KV_REST_API_URL: 'http://localhost:8079',
  KV_REST_API_TOKEN: 'local_kv_token',
  AI_PROVIDER: 'fake',
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

  it('accepts a wss livekit url', () => {
    expect(
      parseClientEnv({ ...clientOk, NEXT_PUBLIC_LIVEKIT_URL: 'wss://demo.livekit.cloud' })
        .NEXT_PUBLIC_LIVEKIT_URL,
    ).toBe('wss://demo.livekit.cloud');
  });

  it('rejects an http livekit url', () => {
    expect(() =>
      parseClientEnv({ ...clientOk, NEXT_PUBLIC_LIVEKIT_URL: 'https://demo.livekit.cloud' }),
    ).toThrow(/NEXT_PUBLIC_LIVEKIT_URL/);
  });

  it('names a missing livekit secret', () => {
    const { LIVEKIT_API_SECRET: _omitted, ...incomplete } = serverOk;
    expect(() => parseServerEnv(incomplete)).toThrow(/LIVEKIT_API_SECRET/);
  });

  it('names a missing kv token', () => {
    const { KV_REST_API_TOKEN: _omitted, ...incomplete } = serverOk;
    expect(() => parseServerEnv(incomplete)).toThrow(/KV_REST_API_TOKEN/);
  });

  it('rejects a kv url that is not a url', () => {
    expect(() => parseServerEnv({ ...serverOk, KV_REST_API_URL: 'localhost' })).toThrow(
      /KV_REST_API_URL/,
    );
  });

  it('requires the anthropic key only when the provider is anthropic', () => {
    expect(() => parseServerEnv({ ...serverOk, AI_PROVIDER: 'anthropic' })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    expect(
      parseServerEnv({ ...serverOk, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-x' })
        .AI_PROVIDER,
    ).toBe('anthropic');
    expect(parseServerEnv({ ...serverOk, AI_PROVIDER: 'fake' }).AI_PROVIDER).toBe('fake');
  });

  it('rejects an unknown ai provider', () => {
    expect(() => parseServerEnv({ ...serverOk, AI_PROVIDER: 'openai' })).toThrow(/AI_PROVIDER/);
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
