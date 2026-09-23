import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@omnicanvas/db';
import { clientEnv } from '@/env';

export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
