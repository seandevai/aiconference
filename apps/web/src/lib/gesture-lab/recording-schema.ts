import { z } from 'zod';
import type { Frame, GestureEvent } from '@omnicanvas/gesture';
import { isGestureEventType, parseRecording } from './recording';
import { parseLabSettings, type LabSettings } from './settings';

// Quello che il server accetta dal laboratorio. Le server action di Next leggono al massimo
// 1 MB: i frame serializzati restano sotto 900.000 byte (il database ferma a 1 MB).
export const MAX_FRAMES_BYTES = 900_000;

export type RecordingInput = {
  label: string;
  expect: GestureEvent['type'] | null;
  description: string;
  armed: boolean;
  frames: Frame[];
};
export type PresetInput = { name: string; settings: LabSettings };

const texts = z.object({
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500),
  armed: z.boolean(),
});

export function parseRecordingInput(value: unknown): RecordingInput | null {
  const base = texts.safeParse(value);
  if (!base.success) return null;
  const { expect, frames } = value as { expect?: unknown; frames?: unknown };
  if (expect !== null && !isGestureEventType(expect)) return null;
  const recording = parseRecording({ expect, armed: base.data.armed, frames });
  if (!recording) return null;
  if (new TextEncoder().encode(JSON.stringify(recording.frames)).length > MAX_FRAMES_BYTES)
    return null;
  return { ...base.data, expect: recording.expect, frames: recording.frames };
}

const presetName = z.string().trim().min(1).max(60);

export function parsePresetInput(value: unknown): PresetInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const { name, settings } = value as { name?: unknown; settings?: unknown };
  const parsed = presetName.safeParse(name);
  return parsed.success ? { name: parsed.data, settings: parseLabSettings(settings) } : null;
}
