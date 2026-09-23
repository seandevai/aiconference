import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@omnicanvas/db';
import { clientEnv } from '@/env';

export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            for (const { name, value, options } of items) store.set(name, value, options);
          } catch {
            // Chiamato da un Server Component: i cookie li rinfresca il proxy.
          }
        },
      },
    },
  );
}

export async function currentUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
