import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { creditsByRoom, monthStart, type DashboardRoom } from './model';

export type DashboardData = {
  displayName: string;
  rooms: DashboardRoom[] | null;
  credits: { balance: number; usedThisMonth: number } | null;
  creditsByRoom: Record<string, number>;
};

// Tutto con il client dell'utente: la RLS decide cosa si vede, qui nessun filtro di sicurezza.
export async function loadDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date,
): Promise<DashboardData> {
  const [profile, roomsResult, membership] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    supabase
      .from('rooms')
      .select('id, title, join_code, status, started_at, ended_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle(),
  ]);

  const rooms: DashboardRoom[] | null = roomsResult.error
    ? null
    : roomsResult.data.map((row) => ({
        id: row.id,
        title: row.title,
        joinCode: row.join_code,
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        createdAt: row.created_at,
      }));

  return {
    displayName: profile.data?.display_name ?? '',
    rooms,
    credits: await readCredits(supabase, membership.data?.workspace_id ?? null, now),
    creditsByRoom: await readRoomCredits(supabase, rooms ?? []),
  };
}

async function readCredits(
  supabase: SupabaseClient<Database>,
  workspaceId: string | null,
  now: Date,
): Promise<DashboardData['credits']> {
  if (!workspaceId) return { balance: 0, usedThisMonth: 0 };
  const [workspace, ledger] = await Promise.all([
    supabase.from('workspaces').select('credits_balance').eq('id', workspaceId).single(),
    supabase
      .from('credit_ledger')
      .select('delta')
      .eq('workspace_id', workspaceId)
      .lt('delta', 0)
      .gte('created_at', monthStart(now).toISOString()),
  ]);
  if (workspace.error || ledger.error) return null;
  return {
    balance: workspace.data.credits_balance,
    usedThisMonth: ledger.data.reduce((sum, row) => sum - row.delta, 0),
  };
}

async function readRoomCredits(
  supabase: SupabaseClient<Database>,
  rooms: DashboardRoom[],
): Promise<Record<string, number>> {
  if (rooms.length === 0) return {};
  const { data, error } = await supabase
    .from('ai_requests')
    .select('room_id, credit_ledger(delta)')
    .in(
      'room_id',
      rooms.map((room) => room.id),
    );
  return error ? {} : creditsByRoom(data);
}
