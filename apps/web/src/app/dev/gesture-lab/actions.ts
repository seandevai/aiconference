'use server';

import type { Recording } from '@/lib/gesture-lab/recording';
import { gestureLabEnabled, labAccess } from '@/lib/gesture-lab/access';
import {
  fetchRecording,
  insertPreset,
  insertRecording,
  isLabAdmin,
  removePreset,
  removeRecording,
  type Author,
  type LabClient,
  type LabResult,
  type PresetSummary,
  type RecordingSummary,
} from '@/lib/gesture-lab/lab-store';
import { parsePresetInput, parseRecordingInput } from '@/lib/gesture-lab/recording-schema';
import { createServerSupabase } from '@/lib/supabase/server';

// Ogni action ricontrolla l'admin prima di toccare i dati: l'RLS è la seconda barriera.
async function labAdmin(): Promise<{ supabase: LabClient; author: Author } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const isAdmin = await isLabAdmin(supabase);
  const access = labAccess({
    nodeEnv: process.env.NODE_ENV,
    enabled: gestureLabEnabled(),
    isAdmin,
  });
  if (access !== 'admin') return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', data.user.id)
    .maybeSingle();
  const name = profile?.display_name || data.user.email?.split('@')[0] || 'admin';
  return { supabase, author: { id: data.user.id, name: name.slice(0, 80) } };
}

const notAllowed = { ok: false, error: 'not_allowed' } as const;

export async function saveRecordingAction(input: unknown): Promise<LabResult<RecordingSummary>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  const parsed = parseRecordingInput(input);
  if (!parsed) return { ok: false, error: 'invalid' };
  const saved = await insertRecording(ctx.supabase, ctx.author, parsed);
  return saved ? { ok: true, value: saved } : { ok: false, error: 'failed' };
}

export async function getRecordingAction(id: string): Promise<LabResult<Recording>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  const recording = await fetchRecording(ctx.supabase, id);
  return recording ? { ok: true, value: recording } : { ok: false, error: 'not_found' };
}

export async function deleteRecordingAction(id: string): Promise<LabResult<null>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  return (await removeRecording(ctx.supabase, id))
    ? { ok: true, value: null }
    : { ok: false, error: 'not_found' };
}

export async function savePresetAction(input: unknown): Promise<LabResult<PresetSummary>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  const parsed = parsePresetInput(input);
  if (!parsed) return { ok: false, error: 'invalid' };
  const saved = await insertPreset(ctx.supabase, ctx.author, parsed);
  return saved ? { ok: true, value: saved } : { ok: false, error: 'failed' };
}

export async function deletePresetAction(id: string): Promise<LabResult<null>> {
  const ctx = await labAdmin();
  if (!ctx) return notAllowed;
  return (await removePreset(ctx.supabase, id))
    ? { ok: true, value: null }
    : { ok: false, error: 'not_found' };
}
