import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import type { ParticipantRole } from '@omnicanvas/realtime';
import { isValidJoinCode } from './join-code';

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

export type ResolveParticipantResult =
  | { kind: 'ok'; room: { id: string; status: string }; participant: ResolvedParticipant }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'forbidden' };

const ENDED_STATUSES = new Set(['closing', 'closed', 'purged']);

// Trova la riga aperta di chi chiede. Usa il service role: ogni controllo è qui.
export async function resolveParticipant(
  admin: SupabaseClient<Database>,
  input: ResolveParticipantInput,
): Promise<ResolveParticipantResult> {
  if (!isValidJoinCode(input.joinCode)) return { kind: 'not_found' };

  const { data: room, error } = await admin
    .from('rooms')
    .select('id, status')
    .eq('join_code', input.joinCode)
    .maybeSingle();
  if (error) throw error;
  if (!room) return { kind: 'not_found' };
  if (ENDED_STATUSES.has(room.status)) return { kind: 'ended' };

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

  const { data: row, error: rowError } = await query.limit(1).maybeSingle();
  if (rowError) throw rowError;
  if (!row) return { kind: 'forbidden' };

  return {
    kind: 'ok',
    room,
    participant: {
      id: row.id,
      role: row.role === 'host' ? 'host' : 'guest',
      displayName: row.display_name,
      language: row.language,
    },
  };
}
