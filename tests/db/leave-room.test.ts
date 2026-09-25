import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { leaveRoom } from '@/lib/rooms/leave-room';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

describe('leaveRoom', () => {
  let host: TestUser;
  let room: { id: string; joinCode: string };

  beforeAll(async () => {
    host = await createTestUser('leave-host');
    const created = await createRoomForUser(await signedInClient(host), host.id, { title: 'Esci' });
    if (!created.ok) throw new Error('setup failed');
    room = created;
  });

  async function joinAnonymous() {
    const result = await joinRoom(admin, {
      joinCode: room.joinCode,
      userId: null,
      displayName: 'Cliente',
      language: 'en',
    });
    if (result.kind !== 'joined') throw new Error('join failed');
    return result.participantId;
  }

  it('closes the row with its duration, once', async () => {
    const participantId = await joinAnonymous();
    const { data: row } = await admin
      .from('room_participants')
      .select('joined_at')
      .eq('id', participantId)
      .single();
    const later = new Date(new Date(row!.joined_at).getTime() + 90_000);

    expect(await leaveRoom(admin, { roomId: room.id, participantId }, later)).toBe(true);
    const { data } = await admin
      .from('room_participants')
      .select('left_at, duration_seconds')
      .eq('id', participantId)
      .single();
    expect(data?.left_at).not.toBeNull();
    expect(data?.duration_seconds).toBe(90);

    expect(await leaveRoom(admin, { roomId: room.id, participantId }, later)).toBe(false);
  });

  it('does nothing for a row of another room', async () => {
    const participantId = await joinAnonymous();
    const otherRoomId = '00000000-0000-4000-8000-000000000000';
    expect(await leaveRoom(admin, { roomId: otherRoomId, participantId })).toBe(false);
  });

  it('lets the host come back as host after leaving', async () => {
    const first = await joinRoom(admin, {
      joinCode: room.joinCode,
      userId: host.id,
      displayName: 'Sean',
      language: 'it',
    });
    if (first.kind !== 'joined') throw new Error('join failed');
    expect(await leaveRoom(admin, { roomId: room.id, participantId: first.participantId })).toBe(
      true,
    );

    const again = await joinRoom(admin, {
      joinCode: room.joinCode,
      userId: host.id,
      displayName: 'Sean',
      language: 'it',
    });
    expect(again).toMatchObject({ kind: 'joined', role: 'host' });
    expect(again.kind === 'joined' && again.participantId).not.toBe(first.participantId);
  });
});
