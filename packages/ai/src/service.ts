import { creditsFor, estimateCostUsd } from './pricing';
import {
  ProviderError,
  type AgentOutcome,
  type AiLedger,
  type AiOperation,
  type GenerateAdapter,
  type ProviderErrorCode,
  type ProviderUsage,
} from './types';

// Una richiesta a voce fa due righe (token STT + agente): i limiti contano ogni operazione.
export const RATE_LIMITS = { perParticipantPerMinute: 12, perWorkspacePerMinute: 60 } as const;

export type Payer = { roomId: string; participantId: string; workspaceId: string };

export type MeteredCall<T> = {
  operation: AiOperation;
  provider: string;
  model: string;
  // Crediti da riservare prima della chiamata: il costo massimo plausibile.
  reserveCredits: number;
  run(): Promise<{ value: T; usage: ProviderUsage | null; costUsd: number }>;
};

export type MeteredResult<T> =
  | { ok: true; value: T; charged: number }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limited' }
  | { ok: false; reason: 'provider_failed'; code: ProviderErrorCode };

// Catena di ARCHITECTURE §6: rate limit, quota (riserva), chiamata, misura, registro, scalo.
// Il contenuto attraversa questa funzione e non viene mai salvato.
export async function executeMetered<T>(
  deps: { ledger: AiLedger; now?: () => number },
  who: Payer,
  call: MeteredCall<T>,
): Promise<MeteredResult<T>> {
  const now = deps.now ?? Date.now;
  const { ledger } = deps;

  const recent = await ledger.recentRequests({
    participantId: who.participantId,
    workspaceId: who.workspaceId,
    sinceMs: 60_000,
  });
  if (
    recent.participant >= RATE_LIMITS.perParticipantPerMinute ||
    recent.workspace >= RATE_LIMITS.perWorkspacePerMinute
  ) {
    return { ok: false, reason: 'rate_limited' };
  }

  const reserved = call.reserveCredits;
  if (reserved > 0 && !(await ledger.reserve(who.workspaceId, reserved))) {
    return { ok: false, reason: 'quota_exceeded' };
  }

  const base = {
    roomId: who.roomId,
    participantId: who.participantId,
    workspaceId: who.workspaceId,
    provider: call.provider,
    operation: call.operation,
    reserved,
  };
  const started = now();
  try {
    const { value, usage, costUsd } = await call.run();
    const charged = creditsFor(costUsd);
    await ledger.record({
      ...base,
      model: usage?.model ?? call.model,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      latencyMs: now() - started,
      success: true,
      errorCode: null,
      costUsd,
      charged,
    });
    return { ok: true, value, charged };
  } catch (error) {
    const failure = error instanceof ProviderError ? error : null;
    const code: ProviderErrorCode = failure?.code ?? 'provider_error';
    const usage = failure?.usage;
    const costUsd =
      failure?.costUsd ??
      (usage ? estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens) : 0);
    await ledger.record({
      ...base,
      model: usage?.model ?? call.model,
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

export type AgentRequest = Payer & { prompt: string };

export type AgentResult =
  | { ok: true; content: AgentOutcome; charged: number }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limited' }
  | { ok: false; reason: 'provider_failed'; code: ProviderErrorCode };

export async function executeAgent(
  deps: { ledger: AiLedger; adapter: GenerateAdapter; now?: () => number },
  request: AgentRequest,
): Promise<AgentResult> {
  const { adapter } = deps;
  const result = await executeMetered(deps, request, {
    operation: 'agent_generate',
    provider: adapter.provider,
    model: adapter.model,
    reserveCredits: adapter.reserveCredits,
    async run() {
      const r = await adapter.generate(request.prompt);
      const usage = { model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
      return {
        value: r.content,
        usage,
        costUsd: estimateCostUsd(r.model, r.inputTokens, r.outputTokens),
      };
    },
  });
  return result.ok ? { ok: true, content: result.value, charged: result.charged } : result;
}
