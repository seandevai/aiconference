import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import {
  STT_COMMAND_MAX_SECONDS,
  creditsFor,
  executeMetered,
  sttSessionCostUsd,
} from '@omnicanvas/ai';
import { resolveHost } from '@/lib/ai/agent-request';
import { createSupabaseLedger } from '@/lib/ai/ledger';
import type { ResolveParticipantInput } from '@/lib/rooms/resolve-participant';

export type SttConfig =
  | {
      provider: 'deepgram';
      model: string;
      grant(): Promise<{ accessToken: string; expiresIn: number }>;
    }
  | { provider: 'fake'; model: 'fake-stt' }
  | null;

// Ciò che "dice" l'host in sviluppo, CI ed e2e: nessun microfono, nessun costo.
export const FAKE_TRANSCRIPT = 'Fammi un grafico delle vendite';

// Lingue monolingue di Nova-3 che offriamo all'ingresso; le altre ricadono sull'inglese.
const LANGUAGES = new Set(['it', 'en', 'es', 'fr', 'de', 'pt', 'nl']);

type Result = { status: number; body: unknown };

export async function runSttToken(
  admin: SupabaseClient<Database>,
  config: SttConfig,
  input: ResolveParticipantInput,
): Promise<Result> {
  const host = await resolveHost(admin, input);
  if ('refusal' in host) return host.refusal;
  if (!config) return { status: 503, body: { error: 'stt_unavailable' } };

  const costUsd = sttSessionCostUsd(config.model);
  const result = await executeMetered({ ledger: createSupabaseLedger(admin) }, host, {
    operation: 'stt_session',
    provider: config.provider,
    model: config.model,
    reserveCredits: creditsFor(costUsd),
    async run() {
      const token = config.provider === 'deepgram' ? await config.grant() : null;
      return { value: token, usage: null, costUsd };
    },
  });

  if (!result.ok) {
    if (result.reason === 'quota_exceeded') {
      return { status: 402, body: { error: 'quota_exceeded' } };
    }
    if (result.reason === 'rate_limited') return { status: 429, body: { error: 'rate_limited' } };
    return { status: 502, body: { error: 'stt_failed' } };
  }
  if (config.provider === 'fake') {
    return {
      status: 200,
      body: { provider: 'fake', transcript: FAKE_TRANSCRIPT, maxSeconds: STT_COMMAND_MAX_SECONDS },
    };
  }
  return {
    status: 200,
    body: {
      provider: 'deepgram',
      // Col provider deepgram run() restituisce sempre il token.
      token: result.value!.accessToken,
      model: config.model,
      language: LANGUAGES.has(host.language) ? host.language : 'en',
      maxSeconds: STT_COMMAND_MAX_SECONDS,
    },
  };
}
