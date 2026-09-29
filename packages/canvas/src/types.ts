// Modello del palco (spec §4.4, ADR-0009). Nessuna dipendenza da React o dalla rete.

export const SLOTS = ['main', 'side-1', 'side-2', 'side-3'] as const;
export type Slot = (typeof SLOTS)[number];

export const MAX_WINDOWS = 4;
export const MAX_TRAY = 50;
export const MAX_CONTENTS_PER_WINDOW = 12;

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export type ChartData = { title: string; labels: string[]; values: number[] };
export type TextData = { title: string; body: string };
export type TableData = { title: string; columns: string[]; rows: string[][] };
// Solo il riferimento: i byte viaggiano peer to peer e restano in memoria.
export type ImageRef = { title: string; assetId: string; mime: ImageMime; alt: string };

export type Content =
  | { id: string; kind: 'chart'; data: ChartData; archived?: boolean }
  | { id: string; kind: 'text'; data: TextData; archived?: boolean }
  | { id: string; kind: 'table'; data: TableData; archived?: boolean }
  | { id: string; kind: 'image'; data: ImageRef; archived?: boolean };

export type StageWindow = { id: string; title: string; slot: Slot; contents: Content[] };

export type Stage = {
  windows: StageWindow[];
  // Sempre la finestra nello slot 'main', o null se il palco è vuoto.
  focusedId: string | null;
  tray: Content[];
  negotiation: null;
  version: number;
};

export type StageCommand =
  | { type: 'TRAY_ADD'; content: Content }
  | { type: 'WINDOW_CREATE'; windowId: string; title: string }
  | { type: 'WINDOW_ARCHIVE'; windowId: string }
  | { type: 'WINDOW_MOVE'; windowId: string; slot: Slot }
  | { type: 'FOCUS'; windowId: string }
  | { type: 'FOCUS_NEXT' }
  | { type: 'FOCUS_PREV' }
  | { type: 'CONTENT_PLACE'; contentId: string; windowId: string }
  | { type: 'CONTENT_REMOVE'; contentId: string };
