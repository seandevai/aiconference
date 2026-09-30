import { beforeAll, describe, expect, it } from 'vitest';
import { loadDashboard } from '@/lib/dashboard/load-dashboard';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

describe('loadDashboard', () => {
  let host: TestUser;
  let stranger: TestUser;
  let roomId: string;

  beforeAll(async () => {
    host = await createTestUser('dash-host');
    stranger = await createTestUser('dash-stranger');
    const { data: ws } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', host.id)
      .single();
    const room = await createRoomForUser(await signedInClient(host), host.id, {
      title: 'Kickoff Ferretti',
    });
    if (!room.ok) throw new Error('setup failed');
    roomId = room.id;
    const joined = await joinRoom(admin, {
      joinCode: room.joinCode,
      userId: host.id,
      displayName: 'Giulia',
      language: 'it',
    });
    if (joined.kind !== 'joined') throw new Error('join failed');
    await admin.rpc('grant_credits', { p_workspace: ws!.id, p_credits: 100 });
    await admin.rpc('ai_reserve_credits', { p_workspace: ws!.id, p_credits: 10 });
    await admin.rpc('ai_record_request', {
      p_room: roomId,
      p_participant: joined.participantId,
      p_workspace: ws!.id,
      p_provider: 'fake',
      p_model: 'fake-1',
      p_operation: 'agent_generate',
      p_input_tokens: 10,
      p_output_tokens: 5,
      p_latency_ms: 1,
      p_success: true,
      // supabase gen types rende non nullabili i parametri delle funzioni: null è valido in SQL.
      p_error_code: null as unknown as string,
      p_cost_usd: 0.001,
      p_reserved: 10,
      p_charged: 3,
    });
  });

  it('reads rooms, balance, monthly use and per-room credits for the host', async () => {
    const data = await loadDashboard(await signedInClient(host), host.id, new Date());
    expect(data.rooms?.map((r) => r.title)).toEqual(['Kickoff Ferretti']);
    expect(data.credits).toEqual({ balance: 97, usedThisMonth: 3 });
    expect(data.creditsByRoom).toEqual({ [roomId]: 3 });
    expect(data.displayName).not.toBe('');
  });

  it('shows a stranger none of it', async () => {
    const data = await loadDashboard(await signedInClient(stranger), stranger.id, new Date());
    expect(data.rooms).toEqual([]);
    expect(data.credits).toEqual({ balance: 0, usedThisMonth: 0 });
    expect(data.creditsByRoom).toEqual({});
  });
});
