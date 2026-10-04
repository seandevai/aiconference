import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import type { RoomKeysKv } from '@/lib/kv/kv';
import { STAGE_TTL_SECONDS, stageKey } from '@/lib/stage/snapshot-store';
import { resolveParticipant, type ResolveParticipantInput } from './resolve-participant';
import { capAt, extendEndsAt, isExtendMinutes, kvTtlSeconds } from './timer';

export type LifecycleResult = { status: number; body: unknown };

type Admin = SupabaseClient<Database>;

const ENDED: LifecycleResult = { status: 410, body: { error: 'room_ended' } };
const HOST_ONLY: LifecycleResult = { status: 403, body: { error: 'host_only' } };
const REFUSALS: Record<'not_found' | 'ended' | 'forbidden', LifecycleResult> = {
  not_found: { status: 404, body: { error: 'room_not_found' } },
  ended: ENDED,
  forbidden: { status: 403, body: { error: 'not_a_participant' } },
};

// Scrittura condizionata sulla scadenza letta: due proroghe partite dalla stessa scadenza
// ne applicano una sola. Restituisce la scadenza in vigore dopo il tentativo.
export async function writeExtension(
  admin: Admin,
  roomId: string,
  previousEndsAt: string,
  nextEndsAt: string,
): Promise<string> {
  const { data, error } = await admin
    .from('rooms')
    .update({ ends_at: nextEndsAt })
    .eq('id', roomId)
    .eq('status', 'active')
    .eq('ends_at', previousEndsAt)
    .select('ends_at')
    .maybeSingle();
  if (error) throw error;
  if (data?.ends_at) return new Date(data.ends_at).toISOString();
  const { data: current, error: readError } = await admin
    .from('rooms')
    .select('ends_at')
    .eq('id', roomId)
    .single();
  if (readError) throw readError;
  if (!current.ends_at) throw new Error('room lost its deadline');
  return new Date(current.ends_at).toISOString();
}

// Proroga riservata all'host. Nessun costo e nessun ledger: non chiama provider.
export async function extendRoom(
  admin: Admin,
  kv: RoomKeysKv,
  input: ResolveParticipantInput,
  minutes: unknown,
  now: Date = new Date(),
): Promise<LifecycleResult> {
  if (!isExtendMinutes(minutes)) return { status: 400, body: { error: 'invalid_minutes' } };
  const resolved = await resolveParticipant(admin, input, now);
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  if (resolved.participant.role !== 'host') return HOST_ONLY;
  const { room } = resolved;
  if (room.status !== 'active' || !room.startedAt || !room.endsAt) return ENDED;

  const next = extendEndsAt({ startedAt: room.startedAt, endsAt: room.endsAt }, minutes, now);
  if (!next.ok) {
    return next.reason === 'expired' ? ENDED : { status: 409, body: { error: 'cap_reached' } };
  }
  const endsAt = await writeExtension(admin, room.id, room.endsAt, next.endsAt.toISOString());
  await kv.expire(stageKey(room.id), kvTtlSeconds(endsAt, now, STAGE_TTL_SECONDS));
  return {
    status: 200,
    body: { endsAt, capAt: capAt(room.startedAt).toISOString(), serverNow: now.toISOString() },
  };
}

// Chiusura da parte dell'host, a mano o allo zero. Idempotente: una stanza già chiusa
// risponde 200 senza toccare nulla.
export async function closeRoomAsHost(
  admin: Admin,
  kv: RoomKeysKv,
  input: ResolveParticipantInput,
  closeLive: (roomId: string) => Promise<void>,
  now: Date = new Date(),
): Promise<LifecycleResult> {
  const resolved = await resolveParticipant(admin, input, now);
  if (resolved.kind === 'ended') return { status: 200, body: { closed: true } };
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  if (resolved.participant.role !== 'host') return HOST_ONLY;
  const { room } = resolved;

  const { data, error } = await admin
    .from('rooms')
    .update({ status: 'closed', ended_at: now.toISOString() })
    .eq('id', room.id)
    .eq('status', 'active')
    .select('id');
  if (error) throw error;
  if ((data ?? []).length === 0) return { status: 200, body: { closed: true } };

  // La stanza è già chiusa e un nuovo tentativo non farebbe nulla: un errore del KV non deve
  // impedire di chiudere la stanza realtime, altrimenti gli ospiti restano connessi.
  try {
    await kv.del(stageKey(room.id));
  } catch (cause) {
    console.warn('room close: stage key not deleted', {
      roomId: room.id,
      error: cause instanceof Error ? cause.name : 'unknown',
    });
  }
  try {
    await closeLive(room.id);
  } catch (cause) {
    // Solo metadati (regola 1). La stanza vuota la chiude comunque l'emptyTimeout di LiveKit.
    console.warn('room close: realtime room not closed', {
      roomId: room.id,
      error: cause instanceof Error ? cause.name : 'unknown',
    });
  }
  return { status: 200, body: { closed: true } };
}
