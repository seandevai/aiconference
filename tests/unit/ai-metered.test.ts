import { describe, expect, it, vi } from 'vitest';
import {
  ProviderError,
  RATE_LIMITS,
  STT_COMMAND_MAX_SECONDS,
  creditsFor,
  executeMetered,
  imageCostUsd,
  sttSessionCostUsd,
  type AiLedger,
  type MeteredCall,
  type RecordEntry,
} from '@omnicanvas/ai';

const who = { roomId: 'r', participantId: 'p', workspaceId: 'w' };

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

function imageCall(run: MeteredCall<string>['run']): MeteredCall<string> {
  return {
    operation: 'image',
    provider: 'fal',
    model: 'fal-ai/flux/schnell',
    reserveCredits: 1,
    run,
  };
}

describe('executeMetered', () => {
  it('charges a fixed-price call and records it without tokens', async () => {
    const l = ledger(5);
    const result = await executeMetered(
      { ledger: l.port, now: () => 0 },
      who,
      imageCall(async () => ({ value: 'bytes', usage: null, costUsd: 0.003 })),
    );
    expect(result).toEqual({ ok: true, value: 'bytes', charged: 1 });
    expect(l.balance()).toBe(4);
    expect(l.records[0]).toMatchObject({
      operation: 'image',
      provider: 'fal',
      model: 'fal-ai/flux/schnell',
      inputTokens: null,
      outputTokens: null,
      success: true,
      costUsd: 0.003,
      reserved: 1,
      charged: 1,
    });
  });

  it('does not run the call when the quota is exhausted', async () => {
    const run = vi.fn();
    const result = await executeMetered({ ledger: ledger(0).port }, who, imageCall(run));
    expect(result).toEqual({ ok: false, reason: 'quota_exceeded' });
    expect(run).not.toHaveBeenCalled();
  });

  it('counts every operation against the rate limit', async () => {
    const run = vi.fn();
    const l = ledger(100, { participant: RATE_LIMITS.perParticipantPerMinute, workspace: 0 });
    expect(await executeMetered({ ledger: l.port }, who, imageCall(run))).toEqual({
      ok: false,
      reason: 'rate_limited',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('allows twelve requests a minute per participant', () => {
    // Una richiesta a voce fa due righe (token + agente): con 6 ne resterebbero 3 al minuto.
    expect(RATE_LIMITS).toEqual({ perParticipantPerMinute: 12, perWorkspacePerMinute: 60 });
  });

  it('charges what a failed call already cost and returns the rest', async () => {
    const l = ledger(5);
    const result = await executeMetered(
      { ledger: l.port },
      who,
      imageCall(async () => {
        throw new ProviderError('refusal', undefined, 0.003);
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'provider_failed', code: 'refusal' });
    expect(l.records[0]).toMatchObject({ success: false, errorCode: 'refusal', charged: 1 });
    expect(l.balance()).toBe(4);
  });

  it('refunds the whole reservation when a failure cost nothing', async () => {
    const l = ledger(5);
    await executeMetered(
      { ledger: l.port },
      who,
      imageCall(async () => {
        throw new Error('socket hang up');
      }),
    );
    expect(l.records[0]).toMatchObject({ errorCode: 'provider_error', charged: 0 });
    expect(l.balance()).toBe(5);
  });
});

describe('fixed prices', () => {
  it('prices a voice request as the maximum session length', () => {
    expect(STT_COMMAND_MAX_SECONDS).toBe(30);
    expect(sttSessionCostUsd('nova-3')).toBeCloseTo(0.00385, 6);
    expect(creditsFor(sttSessionCostUsd('nova-3'))).toBe(1);
    expect(sttSessionCostUsd('fake-stt')).toBe(0);
  });

  it('bills images per started megapixel', () => {
    expect(imageCostUsd('fal-ai/flux/schnell', 0.79)).toBeCloseTo(0.003, 6);
    expect(imageCostUsd('fal-ai/flux/schnell', 1.2)).toBeCloseTo(0.006, 6);
    expect(imageCostUsd('fake-image', 1)).toBe(0);
  });

  it('prices unknown models as the most expensive known one', () => {
    expect(imageCostUsd('mystery', 1)).toBeGreaterThanOrEqual(
      imageCostUsd('fal-ai/flux/schnell', 1),
    );
    expect(sttSessionCostUsd('mystery')).toBeGreaterThanOrEqual(sttSessionCostUsd('nova-3'));
  });
});
