import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { findActiveParticipant, joinRoom } from '@/lib/rooms/join-room';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

describe('joinRoom', () => {
  let host: TestUser;
  let registeredGuest: TestUser;
  let joinCode: string;
  let roomId: string;

  beforeAll(async () => {
    host = await createTestUser('join-host');
    registeredGuest = await createTestUser('join-guest');
    const created = await createRoomForUser(await signedInClient(host), host.id, { title: 'Demo' });
    if (!created.ok) throw new Error('setup failed');
    joinCode = created.joinCode;
    roomId = created.id;
  });

  const base = { displayName: 'Marco', language: 'en' };

  it('the creator joins as host, once', async () => {
    const first = await joinRoom(admin, { ...base, joinCode, userId: host.id });
    expect(first).toMatchObject({ kind: 'joined', role: 'host', room: { id: roomId, title: 'Demo', joinCode } });

    const again = await joinRoom(admin, { ...base, joinCode, userId: host.id });
    expect(again.kind === 'joined' && first.kind === 'joined' && again.participantId).toBe(
      first.kind === 'joined' && first.participantId,
    );
  });

  it('an anonymous visitor joins as guest with name and language', async () => {
    const result = await joinRoom(admin, { joinCode, userId: null, displayName: '  Cliente  ', language: 'en' });
    expect(result).toMatchObject({ kind: 'joined', role: 'guest' });
    if (result.kind !== 'joined') return;

    const { data } = await admin
      .from('room_participants')
      .select('user_id, role, display_name, language')
      .eq('id', result.participantId)
      .single();
    expect(data).toEqual({ user_id: null, role: 'guest', display_name: 'Cliente', language: 'en' });
  });

  it('a registered non-creator joins as guest and reuses the open row', async () => {
    const first = await joinRoom(admin, { ...base, joinCode, userId: registeredGuest.id });
    const again = await joinRoom(admin, { ...base, joinCode, userId: registeredGuest.id });
    expect(first).toMatchObject({ kind: 'joined', role: 'guest' });
    expect(again.kind === 'joined' && again.participantId).toBe(first.kind === 'joined' && first.participantId);
  });

  it('rejects an empty name and an unsupported language', async () => {
    expect(await joinRoom(admin, { joinCode, userId: null, displayName: ' ', language: 'it' })).toEqual({
      kind: 'invalid',
      field: 'displayName',
    });
    expect(await joinRoom(admin, { joinCode, userId: null, displayName: 'Ok', language: 'xx' })).toEqual({
      kind: 'invalid',
      field: 'language',
    });
  });

  it('reports unknown and malformed codes as not found', async () => {
    expect(await joinRoom(admin, { ...base, joinCode: 'ZZZZZZZZ', userId: null })).toEqual({ kind: 'not_found' });
    expect(await joinRoom(admin, { ...base, joinCode: 'nope', userId: null })).toEqual({ kind: 'not_found' });
  });

  it('refuses ended rooms', async () => {
    const created = await createRoomForUser(await signedInClient(host), host.id, { title: 'Old' });
    if (!created.ok) throw new Error('setup failed');
    await admin.from('rooms').update({ status: 'closed' }).eq('id', created.id);
    expect(await joinRoom(admin, { ...base, joinCode: created.joinCode, userId: null })).toEqual({ kind: 'ended' });
  });

  it('finds an active participant only in its own room', async () => {
    const result = await joinRoom(admin, { joinCode, userId: null, displayName: 'Anna', language: 'it' });
    if (result.kind !== 'joined') throw new Error('setup failed');
    expect(await findActiveParticipant(admin, roomId, result.participantId)).toEqual({
      role: 'guest',
      displayName: 'Anna',
    });
    expect(
      await findActiveParticipant(admin, '00000000-0000-4000-8000-000000000000', result.participantId),
    ).toBeNull();
  });
});
