import { TokenVerifier } from 'livekit-server-sdk';
import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { issueRoomToken } from '@/lib/rooms/room-token';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

const config = { url: 'ws://localhost:7880', apiKey: 'devkey', apiSecret: 'secret' };
const verifier = new TokenVerifier('devkey', 'secret');
const noGuest = () => null;

async function roomOf(user: TestUser, title: string) {
  const created = await createRoomForUser(await signedInClient(user), user.id, { title });
  if (!created.ok) throw new Error('setup failed');
  return created;
}

async function joinedId(joinCode: string, userId: string | null, displayName = 'Cliente') {
  const result = await joinRoom(admin, { joinCode, userId, displayName, language: 'en' });
  if (result.kind !== 'joined') throw new Error('join failed');
  return result.participantId;
}

describe('issueRoomToken', () => {
  let host: TestUser;
  let stranger: TestUser;
  let room: { id: string; joinCode: string };
  let hostParticipant: string;
  let guestParticipant: string;
  let registeredGuestParticipant: string;

  beforeAll(async () => {
    host = await createTestUser('token-host');
    stranger = await createTestUser('token-stranger');
    const registeredGuest = await createTestUser('token-guest');
    room = await roomOf(host, 'Token');
    hostParticipant = await joinedId(room.joinCode, host.id, 'Sean');
    guestParticipant = await joinedId(room.joinCode, null);
    registeredGuestParticipant = await joinedId(room.joinCode, registeredGuest.id, 'Marco');
  });

  it('gives the host a token bound to its row and marks the room active', async () => {
    const result = await issueRoomToken(
      admin,
      { joinCode: room.joinCode, userId: host.id, guestParticipantId: noGuest },
      config,
    );
    expect(result).toMatchObject({ kind: 'ok', url: config.url });
    if (result.kind !== 'ok') return;
    const claims = await verifier.verify(result.token);
    expect(claims.sub).toBe(hostParticipant);
    expect(claims.video?.room).toBe(room.id);
    expect(claims.attributes).toEqual({ role: 'host', language: 'en' });

    const { data } = await admin.from('rooms').select('status, started_at').eq('id', room.id).single();
    expect(data?.status).toBe('active');
    expect(data?.started_at).not.toBeNull();
  });

  it('gives an anonymous guest with a valid cookie a guest token', async () => {
    const result = await issueRoomToken(
      admin,
      { joinCode: room.joinCode, userId: null, guestParticipantId: () => guestParticipant },
      config,
    );
    if (result.kind !== 'ok') throw new Error(`expected ok, got ${result.kind}`);
    const claims = await verifier.verify(result.token);
    expect(claims.sub).toBe(guestParticipant);
    expect(claims.attributes).toEqual({ role: 'guest', language: 'en' });
  });

  it('refuses an anonymous visitor without a cookie', async () => {
    const result = await issueRoomToken(
      admin,
      { joinCode: room.joinCode, userId: null, guestParticipantId: noGuest },
      config,
    );
    expect(result).toEqual({ kind: 'forbidden' });
  });

  it('refuses a guest cookie that points to a registered user row', async () => {
    const result = await issueRoomToken(
      admin,
      { joinCode: room.joinCode, userId: null, guestParticipantId: () => registeredGuestParticipant },
      config,
    );
    expect(result).toEqual({ kind: 'forbidden' });
  });

  it('refuses a guest id that belongs to another room', async () => {
    const other = await roomOf(host, 'Altra');
    const otherGuest = await joinedId(other.joinCode, null);
    const result = await issueRoomToken(
      admin,
      { joinCode: room.joinCode, userId: null, guestParticipantId: () => otherGuest },
      config,
    );
    expect(result).toEqual({ kind: 'forbidden' });
  });

  it('refuses a registered user who never entered the room', async () => {
    const result = await issueRoomToken(
      admin,
      { joinCode: room.joinCode, userId: stranger.id, guestParticipantId: noGuest },
      config,
    );
    expect(result).toEqual({ kind: 'forbidden' });
  });

  it('refuses a guest whose row was closed', async () => {
    const leaver = await joinedId(room.joinCode, null, 'Uscito');
    await admin
      .from('room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('id', leaver);
    const result = await issueRoomToken(
      admin,
      { joinCode: room.joinCode, userId: null, guestParticipantId: () => leaver },
      config,
    );
    expect(result).toEqual({ kind: 'forbidden' });
  });

  it('reports unknown codes and ended rooms', async () => {
    const unknown = await issueRoomToken(
      admin,
      { joinCode: 'ZZZZZZZZ', userId: host.id, guestParticipantId: noGuest },
      config,
    );
    expect(unknown).toEqual({ kind: 'not_found' });

    const ended = await roomOf(host, 'Finita');
    await joinedId(ended.joinCode, host.id, 'Sean');
    await admin.from('rooms').update({ status: 'closed' }).eq('id', ended.id);
    const result = await issueRoomToken(
      admin,
      { joinCode: ended.joinCode, userId: host.id, guestParticipantId: noGuest },
      config,
    );
    expect(result).toEqual({ kind: 'ended' });
  });
});
