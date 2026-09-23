import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { clientEnv, serverEnv } from '@/env';

// Bypassa RLS. Solo in route e action server che hanno già verificato chi chiede.
export function createAdminSupabase() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
