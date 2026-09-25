import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

async function workspaceOf(user: TestUser): Promise<string> {
  const { data } = await admin.from('workspaces').select('id').eq('owner_id', user.id).single();
  return data!.id;
}

async function balance(workspaceId: string): Promise<number> {
  const { data } = await admin.from('workspaces').select('credits_balance').eq('id', workspaceId).single();
  return data!.credits_balance;
}

describe('ai ledger', () => {
  let host: TestUser;
  let stranger: TestUser;
  let workspaceId: string;
  let roomId: string;
  let participantId: string;

  beforeAll(async () => {
    host = await createTestUser('ledger-host');
    stranger = await createTestUser('ledger-stranger');
    workspaceId = await workspaceOf(host);
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Ledger' });
    if (!room.ok) throw new Error('setup failed');
    roomId = room.id;
    const joined = await joinRoom(admin, { joinCode: room.joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    if (joined.kind !== 'joined') throw new Error('join failed');
    participantId = joined.participantId;
  });

  it('grants credits with a ledger row', async () => {
    const { data, error } = await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 100 });
    expect(error).toBeNull();
    expect(data).toBe(100);
    const { data: rows } = await admin.from('credit_ledger').select('delta, reason').eq('workspace_id', workspaceId);
    expect(rows).toEqual([{ delta: 100, reason: 'manual_grant' }]);
  });

  it('reserves only when the balance is enough, never going below zero', async () => {
    expect((await admin.rpc('ai_reserve_credits', { p_workspace: workspaceId, p_credits: 60 })).data).toBe(true);
    expect((await admin.rpc('ai_reserve_credits', { p_workspace: workspaceId, p_credits: 60 })).data).toBe(false);
    expect(await balance(workspaceId)).toBe(40);
  });

  it('records a request, charges the real cost and returns the rest of the reservation', async () => {
    const { data: requestId, error } = await admin.rpc('ai_record_request', {
      p_room: roomId,
      p_participant: participantId,
      p_workspace: workspaceId,
      p_provider: 'fake',
      p_model: 'fake-1',
      p_operation: 'agent_generate',
      p_input_tokens: 100,
      p_output_tokens: 50,
      p_latency_ms: 12,
      p_success: true,
      p_error_code: null,
      p_cost_usd: 0.0123,
      p_reserved: 60,
      p_charged: 2,
    });
    expect(error).toBeNull();
    expect(await balance(workspaceId)).toBe(98);
    const { data: ledger } = await admin.from('credit_ledger').select('delta, reason, ai_request_id').eq('ai_request_id', requestId!);
    expect(ledger).toEqual([{ delta: -2, reason: 'ai_request', ai_request_id: requestId }]);
  });

  it('lets workspace members read their requests and ledger, and nobody else', async () => {
    const mine = await signedInClient(host);
    expect((await mine.from('ai_requests').select('id').eq('payer_workspace_id', workspaceId)).data).toHaveLength(1);
    expect((await mine.from('credit_ledger').select('id').eq('workspace_id', workspaceId)).data).toHaveLength(2);
    const other = await signedInClient(stranger);
    expect((await other.from('ai_requests').select('id').eq('payer_workspace_id', workspaceId)).data).toEqual([]);
    expect((await other.from('credit_ledger').select('id').eq('workspace_id', workspaceId)).data).toEqual([]);
  });

  it('refuses writes and credit functions to authenticated users', async () => {
    const mine = await signedInClient(host);
    const insert = await mine.from('credit_ledger').insert({ workspace_id: workspaceId, delta: 1000, reason: 'manual_grant' });
    expect(insert.error).not.toBeNull();
    for (const [fn, args] of [
      ['grant_credits', { p_workspace: workspaceId, p_credits: 1000 }],
      ['ai_reserve_credits', { p_workspace: workspaceId, p_credits: -1000 }],
    ] as const) {
      const { error } = await mine.rpc(fn, args);
      expect(error, fn).not.toBeNull();
    }
    expect(await balance(workspaceId)).toBe(98);
  });

  it('rejects non-positive grants and reservations', async () => {
    expect((await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 0 })).error).not.toBeNull();
    expect((await admin.rpc('ai_reserve_credits', { p_workspace: workspaceId, p_credits: -5 })).error).not.toBeNull();
  });
});
