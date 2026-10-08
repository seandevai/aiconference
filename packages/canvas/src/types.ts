// Modello del palco (spec §4.4, ADR-0009). Nessuna dipendenza da React o dalla rete.

export const SLOTS = ['main', 'side-1', 'side-2', 'side-3'] as const;
export type Slot = (typeof SLOTS)[number];

export const MAX_WINDOWS = 4;
export const MAX_TRAY = 50;
export const MAX_CONTENTS_PER_WINDOW = 12;
// Tetto massimo che l'host può fissare per una negoziazione.
export const MAX_NEGOTIATION_EDITS = 20;

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export type ChartData = { title: string; labels: string[]; values: number[] };
export type TextData = { title: string; body: string };
export type TableData = { title: string; columns: string[]; rows: string[][] };
// Solo il riferimento: i byte viaggiano peer to peer e restano in memoria.
export type ImageRef = { title: string; assetId: string; mime: ImageMime; alt: string };

// Riferimento a una traccia dal vivo: chi condivide. Nessun fotogramma passa dal palco.
export type ScreenRef = { title: string; owner: string };

// forkOf: la proposta dell'ospite affiancata all'originale punta all'originale (spec §2.6).
type ContentBase = { id: string; archived?: boolean; forkOf?: string };

export type Content =
  | (ContentBase & { kind: 'chart'; data: ChartData })
  | (ContentBase & { kind: 'text'; data: TextData })
  | (ContentBase & { kind: 'table'; data: TableData })
  | (ContentBase & { kind: 'image'; data: ImageRef })
  | (ContentBase & { kind: 'screen'; data: ScreenRef });

// Una modifica sostituisce i dati del contenuto, mai il tipo.
export type ContentEdit = {
  [K in Content['kind']]: Pick<Extract<Content, { kind: K }>, 'kind' | 'data'>;
}[Content['kind']];

// Negoziazione (spec §2.6): l'host la apre su un contenuto, l'ospite ha il turno di
// scrittura su quel contenuto finché l'host non la chiude. Il tetto lo rispetta anche
// il server; qui serve a non applicare modifiche oltre il tetto.
export type Negotiation = {
  contentId: string;
  snapshot: Content;
  guestId: string;
  editsLeft: number;
  hostPays: boolean;
  // Agente in coda: mentre lavora, niente modifiche a mano né altre richieste.
  agentBusy: boolean;
};

export type NegotiationOutcome = 'keep' | 'revert' | 'side';

export type StageWindow = { id: string; title: string; slot: Slot; contents: Content[] };

export type Stage = {
  windows: StageWindow[];
  // Sempre la finestra nello slot 'main', o null se il palco è vuoto.
  focusedId: string | null;
  tray: Content[];
  negotiation: Negotiation | null;
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
