import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { executeAgent, type GenerateAdapter } from '@omnicanvas/ai';
import { resolveParticipant, type ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
import { createSupabaseLedger } from './ledger';

export const MAX_PROMPT_CHARS = 500;

type Admin = SupabaseClient<Database>;
type Result = { status: number; body: unknown };

const REFUSALS: Record<'not_found' | 'ended' | 'forbidden', Result> = {
  not_found: { status: 404, body: { error: 'room_not_found' } },
  ended: { status: 410, body: { error: 'room_ended' } },
  forbidden: { status: 403, body: { error: 'not_a_participant' } },
};

// Solo l'host attiva l'agente e paga il workspace della stanza (spec §2.3).
export async function resolveHost(admin: Admin, input: ResolveParticipantInput) {
  const resolved = await resolveParticipant(admin, input);
  if (resolved.kind !== 'ok') return { refusal: REFUSALS[resolved.kind] } as const;
  if (resolved.participant.role !== 'host') {
    return { refusal: { status: 403, body: { error: 'host_only' } } } as const;
  }
  const { data: room, error } = await admin
    .from('rooms')
    .select('workspace_id')
    .eq('id', resolved.room.id)
    .single();
  if (error) throw error;
  return {
    roomId: resolved.room.id,
    participantId: resolved.participant.id,
    workspaceId: room.workspace_id,
    language: resolved.participant.language,
  } as const;
}

export async function runAgentRequest(
  admin: Admin,
  adapter: GenerateAdapter | null,
  input: ResolveParticipantInput,
  prompt: string,
): Promise<Result> {
  const host = await resolveHost(admin, input);
  if ('refusal' in host) return host.refusal;

  const trimmed = prompt.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PROMPT_CHARS) {
    return { status: 400, body: { error: 'invalid_prompt' } };
  }
  if (!adapter) return { status: 503, body: { error: 'agent_unavailable' } };

  const result = await executeAgent(
    { ledger: createSupabaseLedger(admin), adapter },
    {
      roomId: host.roomId,
      participantId: host.participantId,
      workspaceId: host.workspaceId,
      prompt: trimmed,
    },
  );
  if (result.ok) return { status: 200, body: { content: result.content, charged: result.charged } };
  if (result.reason === 'provider_failed') {
    return { status: 502, body: { error: 'provider_failed', code: result.code } };
  }
  if (result.reason === 'quota_exceeded') return { status: 402, body: { error: 'quota_exceeded' } };
  return { status: 429, body: { error: 'rate_limited' } };
}

export async function readAgentUsage(
  admin: Admin,
  input: ResolveParticipantInput,
): Promise<Result> {
  const host = await resolveHost(admin, input);
  if ('refusal' in host) return host.refusal;
  const [{ data: workspace, error }, { data: rows, error: rowsError }] = await Promise.all([
    admin.from('workspaces').select('credits_balance').eq('id', host.workspaceId).single(),
    admin
      .from('credit_ledger')
      .select('delta, ai_requests!inner(room_id)')
      .eq('ai_requests.room_id', host.roomId),
  ]);
  if (error) throw error;
  if (rowsError) throw rowsError;
  const roomCredits = (rows ?? []).reduce((sum, row) => sum - row.delta, 0);
  return { status: 200, body: { balance: workspace.credits_balance, roomCredits } };
}
