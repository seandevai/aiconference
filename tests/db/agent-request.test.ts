import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createFakeAdapter, type GenerateAdapter } from '@omnicanvas/ai';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { MAX_PROMPT_CHARS, readAgentUsage, runAgentRequest } from '@/lib/ai/agent-request';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

// Adapter che costa: 2 crediti riservati, 1.000 token in ingresso e 400 in uscita su Opus 5 = 2 crediti.
function paidAdapter(): GenerateAdapter {
  return {
    provider: 'test',
    model: 'claude-opus-5',
    reserveCredits: 2,
    generate: vi.fn(async (prompt: string) => ({
      content: { kind: 'text' as const, title: prompt.slice(0, 20), body: 'ok' },
      model: 'claude-opus-5',
      inputTokens: 1_000,
      outputTokens: 400,
    })),
  };
}

describe('runAgentRequest', () => {
  let host: TestUser;
  let joinCode: string;
  let workspaceId: string;
  let guestId: string;

  beforeAll(async () => {
    host = await createTestUser('agent-host');
    const { data: ws } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', host.id)
      .single();
    workspaceId = ws!.id;
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Agente' });
    if (!room.ok) throw new Error('setup failed');
    joinCode = room.joinCode;
    await joinRoom(admin, { joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    const guest = await joinRoom(admin, {
      joinCode,
      userId: null,
      displayName: 'Cliente',
      language: 'en',
    });
    if (guest.kind !== 'joined') throw new Error('guest join failed');
    guestId = guest.participantId;
  });

  const asHost = () => ({ joinCode, userId: host.id, guestParticipantId: () => null });

  it('stops at the quota without calling the provider', async () => {
    const adapter = paidAdapter();
    expect(await runAgentRequest(admin, adapter, asHost(), 'grafico')).toEqual({
      status: 402,
      body: { error: 'quota_exceeded' },
    });
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('charges N calls exactly and shows them in the usage counter', async () => {
    await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 10 });
    const adapter = paidAdapter();
    for (let i = 0; i < 3; i += 1) {
      const result = await runAgentRequest(admin, adapter, asHost(), `richiesta ${i}`);
      expect(result.status).toBe(200);
    }
    expect(await readAgentUsage(admin, asHost())).toEqual({
      status: 200,
      body: { balance: 4, roomCredits: 6 },
    });
    const { count } = await admin
      .from('ai_requests')
      .select('id', { count: 'exact', head: true })
      .eq('payer_workspace_id', workspaceId);
    expect(count).toBe(3);
  });

  it('refuses guests before anything else', async () => {
    const adapter = paidAdapter();
    const asGuest = { joinCode, userId: null, guestParticipantId: () => guestId };
    expect(await runAgentRequest(admin, adapter, asGuest, 'grafico')).toEqual({
      status: 403,
      body: { error: 'host_only' },
    });
    expect((await readAgentUsage(admin, asGuest)).status).toBe(403);
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('validates the prompt and reports a missing provider', async () => {
    expect((await runAgentRequest(admin, paidAdapter(), asHost(), '   ')).status).toBe(400);
    expect(
      (await runAgentRequest(admin, paidAdapter(), asHost(), 'x'.repeat(MAX_PROMPT_CHARS + 1)))
        .status,
    ).toBe(400);
    expect(await runAgentRequest(admin, null, asHost(), 'grafico')).toEqual({
      status: 503,
      body: { error: 'agent_unavailable' },
    });
  });

  it('works end to end with the fake adapter at no cost', async () => {
    const before = (await readAgentUsage(admin, asHost())).body as { balance: number };
    const result = await runAgentRequest(admin, createFakeAdapter(), asHost(), 'Fammi un grafico');
    expect(result).toMatchObject({ status: 200, body: { content: { kind: 'chart' }, charged: 0 } });
    expect((await readAgentUsage(admin, asHost())).body).toMatchObject({ balance: before.balance });
  });
});
