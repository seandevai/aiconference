import { z } from 'zod';
import {
  MAX_CONTENTS_PER_WINDOW,
  MAX_NEGOTIATION_EDITS,
  MAX_WINDOWS,
  SLOTS,
  type Stage,
  type StageCommand,
} from './types';

// Limiti scelti perché un comando TRAY_ADD resti sotto i 15 KB del DataChannel.
export const LIMITS = {
  title: 80,
  body: 3000,
  labels: 24,
  label: 40,
  columns: 10,
  rows: 30,
  cell: 200,
  alt: 200,
  owner: 128,
} as const;

// Il vassoio può superare MAX_TRAY con gli archiviati: il tetto qui è più largo.
const MAX_TRAY_IN_SNAPSHOT = 100;

const id = z.uuid();
const title = z.string().min(1).max(LIMITS.title);
const slot = z.enum(SLOTS);
const archived = z.boolean().optional();
const forkOf = id.optional();

export const contentSchema = z.discriminatedUnion('kind', [
  z.object({
    id,
    kind: z.literal('chart'),
    archived,
    forkOf,
    data: z
      .object({
        title,
        labels: z.array(z.string().max(LIMITS.label)).max(LIMITS.labels),
        values: z.array(z.number()).max(LIMITS.labels),
      })
      .refine((d) => d.labels.length === d.values.length, 'labels and values differ in length'),
  }),
  z.object({
    id,
    kind: z.literal('text'),
    archived,
    forkOf,
    data: z.object({ title, body: z.string().max(LIMITS.body) }),
  }),
  z.object({
    id,
    kind: z.literal('table'),
    archived,
    forkOf,
    data: z.object({
      title,
      columns: z.array(z.string().max(LIMITS.cell)).min(1).max(LIMITS.columns),
      rows: z.array(z.array(z.string().max(LIMITS.cell)).max(LIMITS.columns)).max(LIMITS.rows),
    }),
  }),
  z.object({
    id,
    kind: z.literal('image'),
    archived,
    forkOf,
    data: z.object({
      title,
      assetId: id,
      mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
      alt: z.string().max(LIMITS.alt),
    }),
  }),
  z.object({
    id,
    kind: z.literal('screen'),
    archived,
    forkOf,
    data: z.object({ title, owner: z.string().min(1).max(LIMITS.owner) }),
  }),
]);

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TRAY_ADD'), content: contentSchema }),
  z.object({ type: z.literal('WINDOW_CREATE'), windowId: id, title }),
  z.object({ type: z.literal('WINDOW_ARCHIVE'), windowId: id }),
  z.object({ type: z.literal('WINDOW_MOVE'), windowId: id, slot }),
  z.object({ type: z.literal('FOCUS'), windowId: id }),
  z.object({ type: z.literal('FOCUS_NEXT') }),
  z.object({ type: z.literal('FOCUS_PREV') }),
  z.object({ type: z.literal('CONTENT_PLACE'), contentId: id, windowId: id }),
  z.object({ type: z.literal('CONTENT_REMOVE'), contentId: id }),
]);

export const stageSchema = z
  .object({
    windows: z
      .array(
        z.object({
          id,
          title,
          slot,
          contents: z.array(contentSchema).max(MAX_CONTENTS_PER_WINDOW),
        }),
      )
      .max(MAX_WINDOWS),
    focusedId: id.nullable(),
    tray: z.array(contentSchema).max(MAX_TRAY_IN_SNAPSHOT),
    negotiation: z
      .object({
        contentId: id,
        snapshot: contentSchema,
        guestId: z.string().min(1).max(128),
        editsLeft: z.number().int().min(0).max(MAX_NEGOTIATION_EDITS),
        hostPays: z.boolean(),
        agentBusy: z.boolean(),
      })
      .nullable(),
    version: z.number().int().min(0),
  })
  .refine((s) => new Set(s.windows.map((w) => w.slot)).size === s.windows.length, 'slot clash');

export const stageMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('command'),
    version: z.number().int().min(1),
    command: commandSchema,
  }),
  z.object({ type: z.literal('snapshot'), stage: stageSchema }),
  // Battito dello scrittore: chi ha perso l'ultimo comando se ne accorge senza aspettare il successivo.
  z.object({ type: z.literal('heartbeat'), version: z.number().int().min(0) }),
]);

export type StageMessage =
  | { type: 'command'; version: number; command: StageCommand }
  | { type: 'snapshot'; stage: Stage }
  | { type: 'heartbeat'; version: number };

// Zod con exactOptionalPropertyTypes produce `archived?: boolean | undefined`:
// la forma è la stessa, il cast documenta che lo schema è la fonte di verità.
export function parseStage(value: unknown): Stage | null {
  const result = stageSchema.safeParse(value);
  return result.success ? (result.data as Stage) : null;
}

export function parseStageMessage(value: unknown): StageMessage | null {
  const result = stageMessageSchema.safeParse(value);
  return result.success ? (result.data as StageMessage) : null;
}
