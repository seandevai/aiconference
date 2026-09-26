import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { FAKE_TRANSCRIPT, runSttToken, type SttConfig } from '@/lib/voice/stt-token';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

function deepgram(grant: () => Promise<{ accessToken: string; expiresIn: number }>) {
  return { provider: 'deepgram', model: 'nova-3', grant: vi.fn(grant) } satisfies SttConfig;
}

describe('runSttToken', () => {
  let host: TestUser;
  let joinCode: string;
  let workspaceId: string;
  let guestId: string;

  beforeAll(async () => {
    host = await createTestUser('stt-host');
    const { data: ws } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', host.id)
      .single();
    workspaceId = ws!.id;
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Voce' });
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
  const balance = async () =>
    (await admin.from('workspaces').select('credits_balance').eq('id', workspaceId).single()).data!
      .credits_balance;

  it('refuses guests before any vendor call', async () => {
    const config = deepgram(async () => ({ accessToken: 'jwt', expiresIn: 30 }));
    const result = await runSttToken(admin, config, {
      joinCode,
      userId: null,
      guestParticipantId: () => guestId,
    });
    expect(result).toEqual({ status: 403, body: { error: 'host_only' } });
    expect(config.grant).not.toHaveBeenCalled();
  });

  it('says voice is off when no vendor is configured', async () => {
    expect(await runSttToken(admin, null, asHost())).toEqual({
      status: 503,
      body: { error: 'stt_unavailable' },
    });
  });

  it('stops at the quota without asking Deepgram for a token', async () => {
    const config = deepgram(async () => ({ accessToken: 'jwt', expiresIn: 30 }));
    expect(await runSttToken(admin, config, asHost())).toEqual({
      status: 402,
      body: { error: 'quota_exceeded' },
    });
    expect(config.grant).not.toHaveBeenCalled();
  });

  it('charges one credit and returns a token in the host language', async () => {
    await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 3 });
    const config = deepgram(async () => ({ accessToken: 'jwt', expiresIn: 30 }));
    expect(await runSttToken(admin, config, asHost())).toEqual({
      status: 200,
      body: {
        provider: 'deepgram',
        token: 'jwt',
        model: 'nova-3',
        language: 'it',
        maxSeconds: 30,
      },
    });
    const { data: rows } = await admin
      .from('ai_requests')
      .select('operation, provider, model, input_tokens, success')
      .eq('payer_workspace_id', workspaceId);
    expect(rows).toEqual([
      {
        operation: 'stt_session',
        provider: 'deepgram',
        model: 'nova-3',
        input_tokens: null,
        success: true,
      },
    ]);
    expect(await balance()).toBe(2);
  });

  it('records a failed grant and refunds it', async () => {
    const config = deepgram(async () => {
      throw new Error('vendor down');
    });
    expect(await runSttToken(admin, config, asHost())).toEqual({
      status: 502,
      body: { error: 'stt_failed' },
    });
    expect(await balance()).toBe(2);
  });

  it('in fake mode returns a canned transcript for free', async () => {
    expect(await runSttToken(admin, { provider: 'fake', model: 'fake-stt' }, asHost())).toEqual({
      status: 200,
      body: { provider: 'fake', transcript: FAKE_TRANSCRIPT, maxSeconds: 30 },
    });
    expect(await balance()).toBe(2);
  });
});
