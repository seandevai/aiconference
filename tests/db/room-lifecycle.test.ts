import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RoomKeysKv } from '@/lib/kv/kv';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { closeRoomAsHost, extendRoom, writeExtension } from '@/lib/rooms/room-lifecycle';
import { issueRoomToken } from '@/lib/rooms/room-token';
import { stageKey } from '@/lib/stage/snapshot-store';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

const config = { url: 'ws://localhost:7880', apiKey: 'devkey', apiSecret: 'secret' };

class MemoryKeys implements RoomKeysKv {
  readonly expired = new Map<string, number>();
  readonly deleted: string[] = [];
  async expire(key: string, seconds: number) {
    this.expired.set(key, seconds);
    return 1;
  }
  async del(...keys: string[]) {
    this.deleted.push(...keys);
    return keys.length;
  }
}

describe('room lifecycle', () => {
  let host: TestUser;

  beforeAll(async () => {
    host = await createTestUser('lifecycle-host');
  });

  // Stanza attiva da 30 minuti pianificati, con host e un ospite anonimo dentro.
  async function liveRoom() {
    const created = await createRoomForUser(await signedInClient(host), host.id, {
      title: 'Timer',
      plannedMinutes: 30,
    });
    if (!created.ok) throw new Error('setup failed');
    const joinCode = created.joinCode;
    await joinRoom(admin, { joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    const guest = await joinRoom(admin, {
      joinCode,
      userId: null,
      displayName: 'Cliente',
      language: 'en',
    });
    if (guest.kind !== 'joined') throw new Error('guest join failed');
    const asHost = { joinCode, userId: host.id, guestParticipantId: () => null };
    const token = await issueRoomToken(admin, asHost, config);
    if (token.kind !== 'ok') throw new Error('activation failed');
    return {
      id: created.id,
      endsAt: token.endsAt,
      asHost,
      asGuest: { joinCode, userId: null, guestParticipantId: () => guest.participantId },
    };
  }

  const minutesAfter = (iso: string, minutes: number) =>
    new Date(Date.parse(iso) + minutes * 60_000).toISOString();

  describe('extendRoom', () => {
    it('moves the deadline and the stage ttl for the host', async () => {
      const room = await liveRoom();
      const kv = new MemoryKeys();
      const result = await extendRoom(admin, kv, room.asHost, 15);
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ endsAt: minutesAfter(room.endsAt, 15) });
      const { data } = await admin.from('rooms').select('ends_at').eq('id', room.id).single();
      expect(new Date(data!.ends_at!).toISOString()).toBe(minutesAfter(room.endsAt, 15));
      expect(kv.expired.get(stageKey(room.id))).toBeGreaterThan(44 * 60);
    });

    it('refuses a guest', async () => {
      const room = await liveRoom();
      expect(await extendRoom(admin, new MemoryKeys(), room.asGuest, 15)).toEqual({
        status: 403,
        body: { error: 'host_only' },
      });
    });

    it('refuses minutes outside the list', async () => {
      const room = await liveRoom();
      expect(await extendRoom(admin, new MemoryKeys(), room.asHost, 20)).toEqual({
        status: 400,
        body: { error: 'invalid_minutes' },
      });
    });

    it('stops at three hours', async () => {
      const room = await liveRoom();
      const kv = new MemoryKeys();
      // 30 pianificati + 5 × 30 = 180: la sesta proroga supera il tetto.
      for (let i = 0; i < 5; i++) {
        expect((await extendRoom(admin, kv, room.asHost, 30)).status).toBe(200);
      }
      expect(await extendRoom(admin, kv, room.asHost, 15)).toEqual({
        status: 409,
        body: { error: 'cap_reached' },
      });
    });

    it('refuses after the deadline, even inside the grace period', async () => {
      const room = await liveRoom();
      const justAfter = new Date(Date.parse(room.endsAt) + 1_000);
      expect(await extendRoom(admin, new MemoryKeys(), room.asHost, 15, justAfter)).toEqual({
        status: 410,
        body: { error: 'room_ended' },
      });
    });
  });

  describe('writeExtension', () => {
    it('applies one extension when two start from the same deadline', async () => {
      const room = await liveRoom();
      const first = await writeExtension(
        admin,
        room.id,
        room.endsAt,
        minutesAfter(room.endsAt, 15),
      );
      const second = await writeExtension(
        admin,
        room.id,
        room.endsAt,
        minutesAfter(room.endsAt, 15),
      );
      expect(first).toBe(minutesAfter(room.endsAt, 15));
      expect(second).toBe(minutesAfter(room.endsAt, 15));
      const { data } = await admin.from('rooms').select('ends_at').eq('id', room.id).single();
      expect(new Date(data!.ends_at!).toISOString()).toBe(minutesAfter(room.endsAt, 15));
    });
  });

  describe('closeRoomAsHost', () => {
    it('closes the room, clears its keys and the realtime room', async () => {
      const room = await liveRoom();
      const kv = new MemoryKeys();
      const closeLive = vi.fn(async () => {});
      expect(await closeRoomAsHost(admin, kv, room.asHost, closeLive)).toEqual({
        status: 200,
        body: { closed: true },
      });
      const { data } = await admin
        .from('rooms')
        .select('status, ended_at')
        .eq('id', room.id)
        .single();
      expect(data?.status).toBe('closed');
      expect(data?.ended_at).not.toBeNull();
      expect(kv.deleted).toEqual([stageKey(room.id)]);
      expect(closeLive).toHaveBeenCalledWith(room.id);
    });

    it('answers 200 again without doing anything twice', async () => {
      const room = await liveRoom();
      const closeLive = vi.fn(async () => {});
      await closeRoomAsHost(admin, new MemoryKeys(), room.asHost, closeLive);
      expect(await closeRoomAsHost(admin, new MemoryKeys(), room.asHost, closeLive)).toEqual({
        status: 200,
        body: { closed: true },
      });
      expect(closeLive).toHaveBeenCalledTimes(1);
    });

    it('refuses a guest', async () => {
      const room = await liveRoom();
      expect(await closeRoomAsHost(admin, new MemoryKeys(), room.asGuest, vi.fn())).toEqual({
        status: 403,
        body: { error: 'host_only' },
      });
    });

    it('still closes the room when the realtime service fails', async () => {
      const room = await liveRoom();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const closeLive = vi.fn(async () => {
        throw new Error('unreachable');
      });
      expect((await closeRoomAsHost(admin, new MemoryKeys(), room.asHost, closeLive)).status).toBe(
        200,
      );
      const { data } = await admin.from('rooms').select('status').eq('id', room.id).single();
      expect(data?.status).toBe('closed');
      expect(warn).toHaveBeenCalledWith('room close: realtime room not closed', {
        roomId: room.id,
        error: 'Error',
      });
      warn.mockRestore();
    });
  });
});
