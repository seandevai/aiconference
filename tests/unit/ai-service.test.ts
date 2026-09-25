import { describe, expect, it, vi } from 'vitest';
import {
  ProviderError,
  RATE_LIMITS,
  executeAgent,
  type AiLedger,
  type GenerateAdapter,
  type RecordEntry,
} from '@omnicanvas/ai';

const request = {
  roomId: 'r',
  participantId: 'p',
  workspaceId: 'w',
  prompt: 'grafico delle vendite',
};

function ledger(balance: number, recent = { participant: 0, workspace: 0 }) {
  const records: RecordEntry[] = [];
  let current = balance;
  const port: AiLedger = {
    reserve: vi.fn(async (_w, credits) => {
      if (current < credits) return false;
      current -= credits;
      return true;
    }),
    record: vi.fn(async (entry) => {
      records.push(entry);
      current += entry.reserved - entry.charged;
    }),
    recentRequests: vi.fn(async () => recent),
  };
  return { port, records, balance: () => current };
}

function adapter(behaviour: 'ok' | ProviderError): GenerateAdapter {
  return {
    provider: 'anthropic',
    model: 'claude-opus-5',
    reserveCredits: 20,
    generate: vi.fn(async () => {
      if (behaviour !== 'ok') throw behaviour;
      return {
        content: { kind: 'text' as const, title: 'Vendite', body: 'In crescita.' },
        model: 'claude-opus-5',
        inputTokens: 1_000,
        outputTokens: 400,
      };
    }),
  };
}

describe('executeAgent', () => {
  it('reserves, calls the provider, records the request and charges the real cost', async () => {
    const l = ledger(100);
    const a = adapter('ok');
    const result = await executeAgent({ ledger: l.port, adapter: a, now: () => 0 }, request);
    expect(result).toEqual({
      ok: true,
      content: { kind: 'text', title: 'Vendite', body: 'In crescita.' },
      charged: 2,
    });
    expect(l.port.reserve).toHaveBeenCalledWith('w', 20);
    expect(l.records).toHaveLength(1);
    expect(l.records[0]).toMatchObject({
      success: true,
      errorCode: null,
      inputTokens: 1_000,
      outputTokens: 400,
      reserved: 20,
      charged: 2,
      operation: 'agent_generate',
      provider: 'anthropic',
      model: 'claude-opus-5',
    });
    expect(l.balance()).toBe(98);
  });

  it('never calls the provider without enough credits', async () => {
    const l = ledger(5);
    const a = adapter('ok');
    expect(await executeAgent({ ledger: l.port, adapter: a }, request)).toEqual({
      ok: false,
      reason: 'quota_exceeded',
    });
    expect(a.generate).not.toHaveBeenCalled();
    expect(l.records).toEqual([]);
  });

  it('stops at the participant and workspace rate limits before reserving', async () => {
    for (const recent of [
      { participant: RATE_LIMITS.perParticipantPerMinute, workspace: 0 },
      { participant: 0, workspace: RATE_LIMITS.perWorkspacePerMinute },
    ]) {
      const l = ledger(100, recent);
      const a = adapter('ok');
      expect(await executeAgent({ ledger: l.port, adapter: a }, request)).toEqual({
        ok: false,
        reason: 'rate_limited',
      });
      expect(l.port.reserve).not.toHaveBeenCalled();
      expect(a.generate).not.toHaveBeenCalled();
    }
  });

  it('records a failed call, gives the reservation back and reports the code', async () => {
    const l = ledger(100);
    const result = await executeAgent(
      { ledger: l.port, adapter: adapter(new ProviderError('timeout')) },
      request,
    );
    expect(result).toEqual({ ok: false, reason: 'provider_failed', code: 'timeout' });
    expect(l.records[0]).toMatchObject({
      success: false,
      errorCode: 'timeout',
      reserved: 20,
      charged: 0,
      inputTokens: null,
    });
    expect(l.balance()).toBe(100);
  });

  it('treats unexpected errors as provider errors, without leaking their message', async () => {
    const l = ledger(100);
    const a: GenerateAdapter = {
      ...adapter('ok'),
      generate: vi.fn(async () => {
        throw new Error('secret prompt text');
      }),
    };
    const result = await executeAgent({ ledger: l.port, adapter: a }, request);
    expect(result).toEqual({ ok: false, reason: 'provider_failed', code: 'provider_error' });
    expect(JSON.stringify(l.records)).not.toContain('secret');
  });

  it('measures latency with the injected clock', async () => {
    const l = ledger(100);
    let t = 1_000;
    await executeAgent({ ledger: l.port, adapter: adapter('ok'), now: () => (t += 250) }, request);
    expect(l.records[0]?.latencyMs).toBe(250);
  });
});
