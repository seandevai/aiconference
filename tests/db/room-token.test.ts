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

  it('sets the deadline at activation and returns the timing', async () => {
    const created = await createRoomForUser(await signedInClient(host), host.id, {
      title: 'Timer',
      plannedMinutes: 30,
    });
    if (!created.ok) throw new Error('setup failed');
    await joinedId(created.joinCode, host.id, 'Sean');
    const now = new Date();
    const result = await issueRoomToken(
      admin,
      { joinCode: created.joinCode, userId: host.id, guestParticipantId: noGuest },
      config,
      now,
    );
    if (result.kind !== 'ok') throw new Error(`expected ok, got ${result.kind}`);
    const { data } = await admin
      .from('rooms')
      .select('started_at, ends_at')
      .eq('id', created.id)
      .single();
    const startedAt = Date.parse(data!.started_at!);
    expect(Date.parse(data!.ends_at!) - startedAt).toBe(30 * 60_000);
    expect(result.endsAt).toBe(new Date(data!.ends_at!).toISOString());
    expect(Date.parse(result.capAt) - startedAt).toBe(180 * 60_000);
    expect(result.serverNow).toBe(now.toISOString());
  });

  it('keeps the first deadline when a second token comes later', async () => {
    const created = await roomOf(host, 'Secondo token');
    await joinedId(created.joinCode, host.id, 'Sean');
    const input = { joinCode: created.joinCode, userId: host.id, guestParticipantId: noGuest };
    const first = await issueRoomToken(admin, input, config);
    const second = await issueRoomToken(admin, input, config, new Date(Date.now() + 60_000));
    if (first.kind !== 'ok' || second.kind !== 'ok') throw new Error('expected ok');
    expect(second.endsAt).toBe(first.endsAt);
  });

  it('repairs an active room that has started_at but no deadline', async () => {
    const created = await createRoomForUser(await signedInClient(host), host.id, {
      title: 'Senza scadenza',
      plannedMinutes: 30,
    });
    if (!created.ok) throw new Error('setup failed');
    await joinedId(created.joinCode, host.id, 'Sean');
    const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    await admin
      .from('rooms')
      .update({ status: 'active', started_at: startedAt, ends_at: null })
      .eq('id', created.id);
    const result = await issueRoomToken(
      admin,
      { joinCode: created.joinCode, userId: host.id, guestParticipantId: noGuest },
      config,
    );
    if (result.kind !== 'ok') throw new Error(`expected ok, got ${result.kind}`);
    expect(result.endsAt).toBe(new Date(Date.parse(startedAt) + 30 * 60_000).toISOString());
    const { data } = await admin.from('rooms').select('ends_at').eq('id', created.id).single();
    expect(new Date(data!.ends_at!).toISOString()).toBe(result.endsAt);
  });

  it('refuses a token once the deadline and the grace period are over', async () => {
    const created = await roomOf(host, 'Scaduta');
    await joinedId(created.joinCode, host.id, 'Sean');
    await admin
      .from('rooms')
      .update({
        status: 'active',
        started_at: new Date(Date.now() - 70 * 60_000).toISOString(),
        ends_at: new Date(Date.now() - 3 * 60_000).toISOString(),
      })
      .eq('id', created.id);
    const result = await issueRoomToken(
      admin,
      { joinCode: created.joinCode, userId: host.id, guestParticipantId: noGuest },
      config,
    );
    expect(result).toEqual({ kind: 'ended' });
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
