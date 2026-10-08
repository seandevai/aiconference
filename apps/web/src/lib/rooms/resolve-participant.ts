import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import type { ParticipantRole } from '@omnicanvas/realtime';
import { isValidJoinCode } from './join-code';
import { isRoomOver } from './timer';

export type ResolveParticipantInput = {
  joinCode: string;
  userId: string | null;
  // Letto solo se chi chiede non ha sessione: il nome del cookie dipende dall'id stanza.
  guestParticipantId: (roomId: string) => string | null;
};

export type ResolvedParticipant = {
  id: string;
  role: ParticipantRole;
  displayName: string;
  language: string;
};

export type ResolvedRoom = {
  id: string;
  status: string;
  plannedMinutes: number;
  startedAt: string | null;
  endsAt: string | null;
};

export type ResolveParticipantResult =
  | { kind: 'ok'; room: ResolvedRoom; participant: ResolvedParticipant }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'forbidden' };

// Trova la riga aperta di chi chiede. Usa il service role: ogni controllo è qui.
export async function resolveParticipant(
  admin: SupabaseClient<Database>,
  input: ResolveParticipantInput,
  now: Date = new Date(),
): Promise<ResolveParticipantResult> {
  if (!isValidJoinCode(input.joinCode)) return { kind: 'not_found' };

  const { data: row, error } = await admin
    .from('rooms')
    .select('id, status, planned_minutes, started_at, ends_at')
    .eq('join_code', input.joinCode)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { kind: 'not_found' };
  const room: ResolvedRoom = {
    id: row.id,
    status: row.status,
    plannedMinutes: row.planned_minutes,
    startedAt: row.started_at,
    endsAt: row.ends_at,
  };
  if (isRoomOver(room, now)) return { kind: 'ended' };

  let query = admin
    .from('room_participants')
    .select('id, role, display_name, language')
    .eq('room_id', room.id)
    .is('left_at', null);

  if (input.userId !== null) {
    query = query.eq('user_id', input.userId);
  } else {
    const guestId = input.guestParticipantId(room.id);
    if (!guestId) return { kind: 'forbidden' };
    // user_id null: un cookie da ospite non apre mai la riga di un account.
    query = query.eq('id', guestId).is('user_id', null);
  }

  const { data: participantRow, error: rowError } = await query.limit(1).maybeSingle();
  if (rowError) throw rowError;
  if (!participantRow) return { kind: 'forbidden' };

  return {
    kind: 'ok',
    room,
    participant: {
      id: participantRow.id,
      role: participantRow.role === 'host' ? 'host' : 'guest',
      displayName: participantRow.display_name,
      language: participantRow.language,
    },
  };
}
