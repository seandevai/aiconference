import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { createRoomToken, type LiveKitCredentials } from '@omnicanvas/realtime/server';
import { resolveParticipant, type ResolveParticipantInput } from './resolve-participant';

export type LiveKitConfig = LiveKitCredentials & { url: string };

export type RoomTokenResult =
  | { kind: 'ok'; url: string; token: string }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'forbidden' };

export async function issueRoomToken(
  admin: SupabaseClient<Database>,
  input: ResolveParticipantInput,
  config: LiveKitConfig,
): Promise<RoomTokenResult> {
  const resolved = await resolveParticipant(admin, input);
  if (resolved.kind !== 'ok') return resolved;
  const { room, participant } = resolved;

  // CREATA → ATTIVA al primo token (ARCHITECTURE §10). Il filtro su status rende
  // idempotente la scrittura quando più partecipanti entrano insieme.
  if (room.status === 'created') {
    const { error } = await admin
      .from('rooms')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', room.id)
      .eq('status', 'created');
    if (error) throw error;
  }

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
  return { kind: 'ok', url: config.url, token };
}
