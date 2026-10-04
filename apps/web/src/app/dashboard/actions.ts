'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseDisplayName } from '@/lib/auth/display-name';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { createServerSupabase } from '@/lib/supabase/server';

export type CreateRoomState = { error: string | null };

const MESSAGES = {
  INVALID_DURATION: 'Scegli una durata valida (30, 45, 60 o 90 minuti).',
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

export type ProfileState = { error: string | null; saved: boolean };

export async function updateDisplayName(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?next=/dashboard');

  const name = parseDisplayName(String(formData.get('display_name') ?? ''));
  if (!name) return { error: 'Scrivi il tuo nome, al massimo 40 caratteri.', saved: false };

  // La policy «user updates own profile» limita comunque la riga a quella dell'utente.
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', data.user.id);
  if (error) return { error: 'Non sono riuscito a salvare il nome. Riprova.', saved: false };
  revalidatePath('/dashboard');
  return { error: null, saved: true };
}
