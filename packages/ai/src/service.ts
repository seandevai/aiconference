import { creditsFor, estimateCostUsd } from './pricing';
import {
  ProviderError,
  type AgentContent,
  type AiLedger,
  type GenerateAdapter,
  type ProviderErrorCode,
} from './types';

export const RATE_LIMITS = { perParticipantPerMinute: 6, perWorkspacePerMinute: 30 } as const;

export type AgentRequest = {
  roomId: string;
  participantId: string;
  workspaceId: string;
  prompt: string;
};

export type AgentResult =
  | { ok: true; content: AgentContent; charged: number }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limited' }
  | { ok: false; reason: 'provider_failed'; code: ProviderErrorCode };

// Catena di ARCHITECTURE §6: rate limit, quota (riserva), provider, misura, registro, scalo.
// Il prompt attraversa questa funzione e non viene mai salvato.
export async function executeAgent(
  deps: { ledger: AiLedger; adapter: GenerateAdapter; now?: () => number },
  request: AgentRequest,
): Promise<AgentResult> {
  const now = deps.now ?? Date.now;
  const { ledger, adapter } = deps;

  const recent = await ledger.recentRequests({
    participantId: request.participantId,
    workspaceId: request.workspaceId,
    sinceMs: 60_000,
  });
  if (
    recent.participant >= RATE_LIMITS.perParticipantPerMinute ||
    recent.workspace >= RATE_LIMITS.perWorkspacePerMinute
  ) {
    return { ok: false, reason: 'rate_limited' };
  }

  const reserved = adapter.reserveCredits;
  if (reserved > 0 && !(await ledger.reserve(request.workspaceId, reserved))) {
    return { ok: false, reason: 'quota_exceeded' };
  }

  const base = {
    roomId: request.roomId,
    participantId: request.participantId,
    workspaceId: request.workspaceId,
    provider: adapter.provider,
    operation: 'agent_generate' as const,
    reserved,
  };
  const started = now();
  try {
    const result = await adapter.generate(request.prompt);
    const costUsd = estimateCostUsd(result.model, result.inputTokens, result.outputTokens);
    const charged = creditsFor(costUsd);
    await ledger.record({
      ...base,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: now() - started,
      success: true,
      errorCode: null,
      costUsd,
      charged,
    });
    return { ok: true, content: result.content, charged };
  } catch (error) {
    const code: ProviderErrorCode = error instanceof ProviderError ? error.code : 'provider_error';
    const usage = error instanceof ProviderError ? error.usage : undefined;
    const costUsd = usage ? estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens) : 0;
    await ledger.record({
      ...base,
      model: usage?.model ?? adapter.model,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      latencyMs: now() - started,
      success: false,
      errorCode: code,
      costUsd,
      charged: creditsFor(costUsd),
    });
    return { ok: false, reason: 'provider_failed', code };
  }
}
