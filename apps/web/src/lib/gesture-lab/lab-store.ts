import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@omnicanvas/db';
import type { GestureEvent } from '@omnicanvas/gesture';
import { isGestureEventType, parseRecording, type Recording } from './recording';
import type { PresetInput, RecordingInput } from './recording-schema';
import { parseLabSettings, type LabSettings } from './settings';

// Archivio del laboratorio su Supabase. Riceve il client dell'utente: le policy RLS fanno da
// seconda barriera dopo il controllo admin delle server action.

export type LabClient = SupabaseClient<Database>;
export type Author = { id: string; name: string };
export type RecordingSummary = {
  id: string;
  label: string;
  expect: GestureEvent['type'] | null;
  description: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};
export type PresetSummary = {
  id: string;
  name: string;
  settings: LabSettings;
  authorId: string;
  authorName: string;
  createdAt: string;
};
export type LabArchive = {
  userId: string;
  recordings: RecordingSummary[];
  presets: PresetSummary[];
};
export type LabError = 'not_allowed' | 'invalid' | 'not_found' | 'failed';
export type LabResult<T> = { ok: true; value: T } | { ok: false; error: LabError };

const SUMMARY = 'id, author_id, author_name, label, expect, description, created_at';
const PRESET = 'id, author_id, author_name, name, settings, created_at';

type RecordingRow = Pick<
  Database['public']['Tables']['gesture_recordings']['Row'],
  'id' | 'author_id' | 'author_name' | 'label' | 'expect' | 'description' | 'created_at'
>;
type PresetRow = Database['public']['Tables']['gesture_lab_presets']['Row'];

export function toRecordingSummary(row: RecordingRow): RecordingSummary {
  return {
    id: row.id,
    label: row.label,
    expect: isGestureEventType(row.expect) ? row.expect : null,
    description: row.description,
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: row.created_at,
  };
}

export function toPresetSummary(row: PresetRow): PresetSummary {
  return {
    id: row.id,
    name: row.name,
    settings: parseLabSettings(row.settings),
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: row.created_at,
  };
}

export async function isLabAdmin(supabase: LabClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_gesture_lab_admin', {} as never);
    return !error && data === true;
  } catch {
    // In locale senza Supabase: il laboratorio resta aperto, senza archivio.
    return false;
  }
}

export async function loadArchive(supabase: LabClient, userId: string): Promise<LabArchive> {
  const [recordings, presets] = await Promise.all([
    supabase
      .from('gesture_recordings')
      .select(SUMMARY)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('gesture_lab_presets')
      .select(PRESET)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  return {
    userId,
    recordings: (recordings.data ?? []).map(toRecordingSummary),
    presets: (presets.data ?? []).map(toPresetSummary),
  };
}

export async function insertRecording(
  supabase: LabClient,
  author: Author,
  input: RecordingInput,
): Promise<RecordingSummary | null> {
  const { data, error } = await supabase
    .from('gesture_recordings')
    .insert({
      author_id: author.id,
      author_name: author.name,
      label: input.label,
      expect: input.expect,
      description: input.description,
      armed: input.armed,
      frames: input.frames as unknown as Json,
    })
    .select(SUMMARY)
    .single();
  return error || !data ? null : toRecordingSummary(data);
}

export async function fetchRecording(supabase: LabClient, id: string): Promise<Recording | null> {
  const { data } = await supabase
    .from('gesture_recordings')
    .select('label, expect, armed, frames')
    .eq('id', id)
    .maybeSingle();
  return data ? parseRecording(data) : null;
}

export async function removeRecording(supabase: LabClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gesture_recordings')
    .delete()
    .eq('id', id)
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}

export async function insertPreset(
  supabase: LabClient,
  author: Author,
  input: PresetInput,
): Promise<PresetSummary | null> {
  const { data, error } = await supabase
    .from('gesture_lab_presets')
    .insert({
      author_id: author.id,
      author_name: author.name,
      name: input.name,
      settings: input.settings as unknown as Json,
    })
    .select(PRESET)
    .single();
  return error || !data ? null : toPresetSummary(data);
}

export async function removePreset(supabase: LabClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gesture_lab_presets')
    .delete()
    .eq('id', id)
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}
