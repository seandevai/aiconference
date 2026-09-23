'use server';

import { redirect } from 'next/navigation';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { createServerSupabase } from '@/lib/supabase/server';

export type CreateRoomState = { error: string | null };

const MESSAGES = {
  INVALID_TITLE: 'Dai un titolo alla stanza (massimo 120 caratteri).',
  NO_WORKSPACE: 'Il tuo account non ha un workspace. Contatta il supporto.',
  JOIN_CODE_COLLISION: 'Non siamo riusciti a generare un codice libero. Riprova.',
} as const;

export async function createRoomAction(
  _prev: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?next=/dashboard');

  const result = await createRoomForUser(supabase, data.user.id, {
    title: String(formData.get('title') ?? ''),
  });
  if (!result.ok) return { error: MESSAGES[result.error] };
  redirect(`/room/${result.joinCode}`);
}
