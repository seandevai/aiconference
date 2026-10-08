import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@omnicanvas/db';
import { DEFAULT_PLANNED_MINUTES, isPlannedMinutes } from './timer';
import { generateJoinCode } from './join-code';

const titleSchema = z.string().trim().min(1).max(120);
const MAX_ATTEMPTS = 3;
const UNIQUE_VIOLATION = '23505';

export type CreateRoomResult =
  | { ok: true; id: string; joinCode: string }
  | { ok: false; error: 'INVALID_TITLE' | 'INVALID_DURATION' | 'NO_WORKSPACE' | 'JOIN_CODE_COLLISION' };

export async function createRoomForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { title: string; plannedMinutes?: unknown },
  nextCode: () => string = generateJoinCode,
): Promise<CreateRoomResult> {
  const title = titleSchema.safeParse(input.title);
  if (!title.success) return { ok: false, error: 'INVALID_TITLE' };
  const plannedMinutes = input.plannedMinutes ?? DEFAULT_PLANNED_MINUTES;
  if (!isPlannedMinutes(plannedMinutes)) return { ok: false, error: 'INVALID_DURATION' };

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  if (!membership) return { ok: false, error: 'NO_WORKSPACE' };

  // Collisione improbabile ma possibile: si ritenta con un codice nuovo.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        workspace_id: membership.workspace_id,
        created_by: userId,
        title: title.data,
        join_code: nextCode(),
        planned_minutes: plannedMinutes,
      })
      .select('id, join_code')
      .single();
    if (data) return { ok: true, id: data.id, joinCode: data.join_code };
    if (error?.code !== UNIQUE_VIOLATION) throw error ?? new Error('room insert returned nothing');
  }
  return { ok: false, error: 'JOIN_CODE_COLLISION' };
}
