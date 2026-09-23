import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';

const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing: run "npx supabase start" and fill .env.local`);
  return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, noSession);

export type TestUser = { id: string; email: string; password: string };

export async function createTestUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${crypto.randomUUID()}@test.local`;
  const password = 'test-password-123';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  return { id: data.user.id, email, password };
}

export async function signedInClient(user: TestUser): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return client;
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, noSession);
}
