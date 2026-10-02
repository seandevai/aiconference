import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { isValidJoinCode } from './join-code';
import { isLanguage } from './languages';

export type RoomSummary = { id: string; title: string; joinCode: string };

export type JoinRoomInput = {
  joinCode: string;
  userId: string | null;
  displayName: string;
  language: string;
  // Dal cookie firmato dell'ospite anonimo, se l'ha già: chi reinvia il form riusa la sua riga.
  // Una funzione perché il cookie dipende dalla stanza, nota solo qui dentro.
  guestParticipantId?: (roomId: string) => string | null;
};

export type JoinRoomResult =
  | { kind: 'joined'; role: 'host' | 'guest'; participantId: string; room: RoomSummary }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'invalid'; field: 'displayName' | 'language' };

const ENDED_STATUSES = new Set(['closing', 'closed', 'purged']);
const MAX_NAME_LENGTH = 40;

type Admin = SupabaseClient<Database>;

// Usa il service role: l'ospite non ha sessione. Ogni controllo di accesso è qui.
export async function joinRoom(admin: Admin, input: JoinRoomInput): Promise<JoinRoomResult> {
  if (!isValidJoinCode(input.joinCode)) return { kind: 'not_found' };

  const { data: room, error } = await admin
    .from('rooms')
    .select('id, title, join_code, status, created_by')
    .eq('join_code', input.joinCode)
    .maybeSingle();
  if (error) throw error;
  if (!room) return { kind: 'not_found' };
  if (ENDED_STATUSES.has(room.status)) return { kind: 'ended' };

  const summary: RoomSummary = { id: room.id, title: room.title, joinCode: room.join_code };
  const role = input.userId !== null && input.userId === room.created_by ? 'host' : 'guest';

  if (input.userId !== null) {
    const { data: open } = await admin
      .from('room_participants')
      .select('id')
      .eq('room_id', room.id)
      .eq('user_id', input.userId)
      .is('left_at', null)
      .limit(1)
      .maybeSingle();
    if (open) return { kind: 'joined', role, participantId: open.id, room: summary };
  }

  const displayName = input.displayName.trim();
  if (displayName.length === 0 || displayName.length > MAX_NAME_LENGTH) {
    return { kind: 'invalid', field: 'displayName' };
  }
  if (!isLanguage(input.language)) return { kind: 'invalid', field: 'language' };

  const previous = input.userId === null ? input.guestParticipantId?.(room.id) : null;
  if (previous) {
    const { data: reused, error: reuseError } = await admin
      .from('room_participants')
      .update({ display_name: displayName, language: input.language })
      .eq('id', previous)
      .eq('room_id', room.id)
      .is('user_id', null)
      .is('left_at', null)
      .select('id')
      .maybeSingle();
    if (reuseError) throw reuseError;
    if (reused) return { kind: 'joined', role, participantId: reused.id, room: summary };
  }

  const { data: inserted, error: insertError } = await admin
    .from('room_participants')
    .insert({
      room_id: room.id,
      user_id: input.userId,
      role,
      display_name: displayName,
      language: input.language,
    })
    .select('id')
    .single();
  if (insertError || !inserted) throw insertError ?? new Error('participant insert returned nothing');

  return { kind: 'joined', role, participantId: inserted.id, room: summary };
}

export async function findActiveParticipant(
  admin: Admin,
  roomId: string,
  participantId: string,
): Promise<{ role: 'host' | 'guest'; displayName: string } | null> {
  const { data } = await admin
    .from('room_participants')
    .select('role, display_name')
    .eq('id', participantId)
    .eq('room_id', roomId)
    .is('left_at', null)
    .maybeSingle();
  if (!data) return null;
  return { role: data.role === 'host' ? 'host' : 'guest', displayName: data.display_name };
}
