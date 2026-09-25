// Ricarica manuale (spec §6: nell'MVP i crediti si caricano a mano).
// Uso: npm run credits:grant -- persona@esempio.it 500
import { createClient } from '@supabase/supabase-js';

const [email, raw] = process.argv.slice(2);
const credits = Number(raw);
if (!email || !Number.isInteger(credits) || credits <= 0) {
  console.error('usage: npm run credits:grant -- <email> <positive credits>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const user = users.users.find((u) => u.email === email);
if (!user) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}
const { data: workspace, error: wsError } = await admin
  .from('workspaces')
  .select('id')
  .eq('owner_id', user.id)
  .single();
if (wsError) throw wsError;
const { data: balance, error } = await admin.rpc('grant_credits', {
  p_workspace: workspace.id,
  p_credits: credits,
});
if (error) throw error;
console.log(`granted ${credits} credits to ${email}: balance ${balance}`);
