import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';

// Chiude la riga aperta di un partecipante. Idempotente: la seconda chiamata restituisce false.
export async function leaveRoom(
  admin: SupabaseClient<Database>,
  { roomId, participantId }: { roomId: string; participantId: string },
  now: Date = new Date(),
): Promise<boolean> {
  const { data: row, error } = await admin
    .from('room_participants')
    .select('joined_at')
    .eq('id', participantId)
    .eq('room_id', roomId)
    .is('left_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!row) return false;

  const durationSeconds = Math.max(
    0,
    Math.round((now.getTime() - new Date(row.joined_at).getTime()) / 1000),
  );
  const { data: updated, error: updateError } = await admin
    .from('room_participants')
    .update({ left_at: now.toISOString(), duration_seconds: durationSeconds })
    .eq('id', participantId)
    .is('left_at', null)
    .select('id');
  if (updateError) throw updateError;
  return (updated ?? []).length === 1;
}
