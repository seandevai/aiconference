import { describe, expect, it } from 'vitest';
import { applyCommand, emptyStage, type Stage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';
import { STAGE_TTL_SECONDS, loadStage, saveStage, stageKey } from '@/lib/stage/snapshot-store';

class MemoryKv implements KvLike {
  readonly data = new Map<string, unknown>();
  readonly ttl = new Map<string, number>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T | undefined) ?? null;
  }
  async set(key: string, value: unknown, options: { ex: number }) {
    this.data.set(key, structuredClone(value));
    this.ttl.set(key, options.ex);
    return 'OK';
  }
}

const roomId = '22222222-2222-4222-8222-222222222222';
const stageAt = (version: number): Stage => ({
  ...applyCommand(emptyStage(), {
    type: 'WINDOW_CREATE',
    windowId: '00000000-0000-4000-8000-000000000001',
    title: 'Finestra 1',
  }),
  version,
});

describe('snapshot store', () => {
  it('uses the ttl it is given', async () => {
    const kv = new MemoryKv();
    await saveStage(kv, roomId, stageAt(1), 720);
    expect(kv.ttl.get(stageKey(roomId))).toBe(720);
  });

  it('saves with the session ttl and loads it back', async () => {
    const kv = new MemoryKv();
    expect(await saveStage(kv, roomId, stageAt(3))).toBe('saved');
    expect(kv.ttl.get(stageKey(roomId))).toBe(STAGE_TTL_SECONDS);
    expect(await loadStage(kv, roomId)).toEqual(stageAt(3));
  });

  it('refuses to go back in version', async () => {
    const kv = new MemoryKv();
    await saveStage(kv, roomId, stageAt(5));
    expect(await saveStage(kv, roomId, stageAt(4))).toBe('stale');
    expect((await loadStage(kv, roomId))?.version).toBe(5);
  });

  it('treats a corrupted value as missing', async () => {
    const kv = new MemoryKv();
    kv.data.set(stageKey(roomId), { windows: 'nope' });
    expect(await loadStage(kv, roomId)).toBeNull();
  });

  it('keys the snapshot by room', () => {
    expect(stageKey(roomId)).toBe(`room:${roomId}:stage`);
  });
});
