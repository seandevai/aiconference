'use server';

import { redirect } from 'next/navigation';
import { parseDisplayName } from '@/lib/auth/display-name';
import { authErrorMessage } from '@/lib/auth/error-message';
import { safeNextPath } from '@/lib/auth/next-path';
import { createServerSupabase } from '@/lib/supabase/server';

export type AuthState = { error: string | null; info: string | null };

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    next: safeNextPath(String(formData.get('next') ?? '')),
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.code), info: null };
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  const displayName = parseDisplayName(String(formData.get('display_name') ?? ''));
  if (!displayName) {
    return { error: 'Scrivi il tuo nome, al massimo 40 caratteri.', info: null };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) return { error: authErrorMessage(error.code), info: null };
  // Con la conferma email attiva (cloud) non c'è ancora una sessione.
  if (!data.session) {
    return { error: null, info: "Ti abbiamo mandato un'email: conferma l'indirizzo, poi accedi." };
  }
  redirect(next);
}

export async function signOut(): Promise<never> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}
