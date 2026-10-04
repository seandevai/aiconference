import 'server-only';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { readGuestParticipantId } from './guest-cookie';
import type { ResolveParticipantInput } from './resolve-participant';

// Chi chiede, per le route della stanza: utente con sessione o ospite col cookie firmato.
export async function requesterOf(code: string): Promise<ResolveParticipantInput> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  return {
    joinCode: code,
    userId: auth.user?.id ?? null,
    guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
  };
}
