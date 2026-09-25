import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import type { AiLedger } from '@omnicanvas/ai';

// Le funzioni dei crediti sono eseguibili solo dal service role (migrazione 0004).
export function createSupabaseLedger(admin: SupabaseClient<Database>): AiLedger {
  return {
    async reserve(workspaceId, credits) {
      const { data, error } = await admin.rpc('ai_reserve_credits', {
        p_workspace: workspaceId,
        p_credits: credits,
      });
      if (error) throw error;
      return data === true;
    },

    async record(entry) {
      const { error } = await admin.rpc('ai_record_request', {
        p_room: entry.roomId,
        p_participant: entry.participantId,
        p_workspace: entry.workspaceId,
        p_provider: entry.provider,
        p_model: entry.model,
        p_operation: entry.operation,
        // supabase gen types rende non nullabili i parametri delle funzioni: null è valido in SQL.
        p_input_tokens: entry.inputTokens as number,
        p_output_tokens: entry.outputTokens as number,
        p_latency_ms: entry.latencyMs,
        p_success: entry.success,
        p_error_code: entry.errorCode as string,
        p_cost_usd: entry.costUsd,
        p_reserved: entry.reserved,
        p_charged: entry.charged,
      });
      if (error) throw error;
    },

    async recentRequests({ participantId, workspaceId, sinceMs }) {
      const since = new Date(Date.now() - sinceMs).toISOString();
      const [participant, workspace] = await Promise.all([
        admin
          .from('ai_requests')
          .select('id', { count: 'exact', head: true })
          .eq('participant_id', participantId)
          .gte('created_at', since),
        admin
          .from('ai_requests')
          .select('id', { count: 'exact', head: true })
          .eq('payer_workspace_id', workspaceId)
          .gte('created_at', since),
      ]);
      if (participant.error) throw participant.error;
      if (workspace.error) throw workspace.error;
      return { participant: participant.count ?? 0, workspace: workspace.count ?? 0 };
    },
  };
}
