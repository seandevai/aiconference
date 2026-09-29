import { beforeAll, describe, expect, it } from 'vitest';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { MAX_STAGE_BODY_BYTES, readStage, writeStage } from '@/lib/stage/stage-access';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

class MemoryKv implements KvLike {
  readonly data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T | undefined) ?? null;
  }
  async set(key: string, value: unknown) {
    this.data.set(key, structuredClone(value));
    return 'OK';
  }
}

const stage = {
  ...applyCommand(emptyStage(), {
    type: 'WINDOW_CREATE',
    windowId: '00000000-0000-4000-8000-000000000001',
    title: 'Finestra 1',
  }),
  version: 1,
};

describe('stage access', () => {
  let host: TestUser;
  let stranger: TestUser;
  let joinCode: string;
  let guestId: string;
  const kv = new MemoryKv();

  beforeAll(async () => {
    host = await createTestUser('stage-host');
    stranger = await createTestUser('stage-stranger');
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Palco' });
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
  const asGuest = () => ({ joinCode, userId: null, guestParticipantId: () => guestId });

  it('answers 204 before the host saved anything', async () => {
    expect(await readStage(admin, kv, asGuest())).toEqual({ status: 204, body: null });
  });

  it('lets the host write and a guest read', async () => {
    expect(await writeStage(admin, kv, asHost(), JSON.stringify(stage))).toEqual({
      status: 200,
      body: { version: 1 },
    });
    expect(await readStage(admin, kv, asGuest())).toEqual({ status: 200, body: { stage } });
  });

  it('refuses writes from a guest', async () => {
    expect(await writeStage(admin, kv, asGuest(), JSON.stringify(stage))).toEqual({
      status: 403,
      body: { error: 'host_only' },
    });
  });

  it('refuses a stranger both ways', async () => {
    const stranger_ = { joinCode, userId: stranger.id, guestParticipantId: () => null };
    expect((await readStage(admin, kv, stranger_)).status).toBe(403);
    expect((await writeStage(admin, kv, stranger_, JSON.stringify(stage))).status).toBe(403);
  });

  it('rejects malformed, oversized and stale snapshots', async () => {
    expect((await writeStage(admin, kv, asHost(), '{not json')).status).toBe(400);
    expect((await writeStage(admin, kv, asHost(), JSON.stringify({ windows: 1 }))).status).toBe(
      400,
    );
    expect(
      (await writeStage(admin, kv, asHost(), 'x'.repeat(MAX_STAGE_BODY_BYTES + 1))).status,
    ).toBe(413);
    expect(await writeStage(admin, kv, asHost(), JSON.stringify({ ...stage, version: 0 }))).toEqual(
      {
        status: 409,
        body: { error: 'stale_version' },
      },
    );
  });

  it('reports unknown and ended rooms', async () => {
    expect(
      (
        await readStage(admin, kv, {
          joinCode: 'ZZZZZZZZ',
          userId: host.id,
          guestParticipantId: () => null,
        })
      ).status,
    ).toBe(404);
    const ended = await createRoomForUser(await signedInClient(host), host.id, { title: 'Finita' });
    if (!ended.ok) throw new Error('setup failed');
    await joinRoom(admin, {
      joinCode: ended.joinCode,
      userId: host.id,
      displayName: 'Sean',
      language: 'it',
    });
    await admin.from('rooms').update({ status: 'closed' }).eq('id', ended.id);
    expect(
      (
        await readStage(admin, kv, {
          joinCode: ended.joinCode,
          userId: host.id,
          guestParticipantId: () => null,
        })
      ).status,
    ).toBe(410);
  });
});
