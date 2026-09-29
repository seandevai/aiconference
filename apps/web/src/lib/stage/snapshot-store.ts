import { parseStage, type Stage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';

// Durata massima di una sessione, come il cookie ospite: poi lo snapshot sparisce da solo.
export const STAGE_TTL_SECONDS = 12 * 60 * 60;

export function stageKey(roomId: string): string {
  return `room:${roomId}:stage`;
}

export async function loadStage(kv: KvLike, roomId: string): Promise<Stage | null> {
  const raw = await kv.get<unknown>(stageKey(roomId));
  return raw === null ? null : parseStage(raw);
}

export async function saveStage(
  kv: KvLike,
  roomId: string,
  stage: Stage,
): Promise<'saved' | 'stale'> {
  const current = await loadStage(kv, roomId);
  if (current && current.version > stage.version) return 'stale';
  await kv.set(stageKey(roomId), stage, { ex: STAGE_TTL_SECONDS });
  return 'saved';
}
