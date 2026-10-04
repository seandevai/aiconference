import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { createRoomToken, type LiveKitCredentials } from '@omnicanvas/realtime/server';
import {
  resolveParticipant,
  type ResolvedRoom,
  type ResolveParticipantInput,
} from './resolve-participant';
import { activationEndsAt, capAt } from './timer';

export type LiveKitConfig = LiveKitCredentials & { url: string };

export type RoomTokenResult =
  | { kind: 'ok'; url: string; token: string; endsAt: string; capAt: string; serverNow: string }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'forbidden' };

type Admin = SupabaseClient<Database>;

// CREATA → ATTIVA al primo token (ARCHITECTURE §10): il timer parte qui, non alla creazione.
// Il filtro su status rende idempotente la scrittura quando più partecipanti entrano insieme;
// si rilegge sempre, così chi perde la gara riceve la scadenza di chi l'ha vinta.
async function activate(
  admin: Admin,
  room: ResolvedRoom,
  now: Date,
): Promise<{ startedAt: string; endsAt: string }> {
  if (room.status === 'created') {
    const { error } = await admin
      .from('rooms')
      .update({
        status: 'active',
        started_at: now.toISOString(),
        ends_at: activationEndsAt(now, room.plannedMinutes).toISOString(),
      })
      .eq('id', room.id)
      .eq('status', 'created');
    if (error) throw error;
  } else if (room.startedAt && room.endsAt) {
    return { startedAt: room.startedAt, endsAt: room.endsAt };
  }
  const { data, error } = await admin
    .from('rooms')
    .select('started_at, ends_at')
    .eq('id', room.id)
    .single();
  if (error) throw error;
  if (!data.started_at || !data.ends_at) throw new Error('active room without deadline');
  return { startedAt: data.started_at, endsAt: data.ends_at };
}

export async function issueRoomToken(
  admin: Admin,
  input: ResolveParticipantInput,
  config: LiveKitConfig,
  now: Date = new Date(),
): Promise<RoomTokenResult> {
  const resolved = await resolveParticipant(admin, input, now);
  if (resolved.kind !== 'ok') return resolved;
  const { room, participant } = resolved;
  const timing = await activate(admin, room, now);

  const token = await createRoomToken(
    {
      roomId: room.id,
      participantId: participant.id,
      displayName: participant.displayName,
      role: participant.role,
      language: participant.language,
    },
    { apiKey: config.apiKey, apiSecret: config.apiSecret },
  );
  return {
    kind: 'ok',
    url: config.url,
    token,
    endsAt: new Date(timing.endsAt).toISOString(),
    capAt: capAt(timing.startedAt).toISOString(),
    serverNow: now.toISOString(),
  };
}
