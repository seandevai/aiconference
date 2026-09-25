import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { parseStage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';
import { resolveParticipant, type ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
import { loadStage, saveStage } from './snapshot-store';

export const MAX_STAGE_BODY_BYTES = 256 * 1024;

export type StageAccessResult = { status: number; body: unknown };

const REFUSALS: Record<'not_found' | 'ended' | 'forbidden', StageAccessResult> = {
  not_found: { status: 404, body: { error: 'room_not_found' } },
  ended: { status: 410, body: { error: 'room_ended' } },
  forbidden: { status: 403, body: { error: 'not_a_participant' } },
};

type Admin = SupabaseClient<Database>;

export async function readStage(
  admin: Admin,
  kv: KvLike,
  input: ResolveParticipantInput,
): Promise<StageAccessResult> {
  const resolved = await resolveParticipant(admin, input);
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  const stage = await loadStage(kv, resolved.room.id);
  return stage ? { status: 200, body: { stage } } : { status: 204, body: null };
}

// Solo l'host scrive: è l'unico scrittore del palco (ADR-0009).
export async function writeStage(
  admin: Admin,
  kv: KvLike,
  input: ResolveParticipantInput,
  rawBody: string,
): Promise<StageAccessResult> {
  const resolved = await resolveParticipant(admin, input);
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  if (resolved.participant.role !== 'host') return { status: 403, body: { error: 'host_only' } };

  if (new TextEncoder().encode(rawBody).byteLength > MAX_STAGE_BODY_BYTES) {
    return { status: 413, body: { error: 'stage_too_large' } };
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid_stage' } };
  }
  const stage = parseStage(json);
  if (!stage) return { status: 400, body: { error: 'invalid_stage' } };

  const result = await saveStage(kv, resolved.room.id, stage);
  return result === 'saved'
    ? { status: 200, body: { version: stage.version } }
    : { status: 409, body: { error: 'stale_version' } };
}
