import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

// Nessuna vetrina per ora (spec accesso-dashboard §1): chi entra va dove serve.
export default async function Home() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? '/dashboard' : '/login');
}
