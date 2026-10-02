import {
  MAX_CONTENTS_PER_WINDOW,
  MAX_TRAY,
  MAX_WINDOWS,
  SLOTS,
  type Content,
  type Slot,
  type Stage,
  type StageCommand,
  type StageWindow,
} from './types';

export function emptyStage(): Stage {
  return { windows: [], focusedId: null, tray: [], negotiation: null, version: 0 };
}

const slotIndex = (slot: Slot) => SLOTS.indexOf(slot);

export function orderedWindows(stage: Stage): StageWindow[] {
  return [...stage.windows].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot));
}

// focusedId è sempre la finestra nello slot 'main': lo ricalcoliamo a ogni cambio.
function withWindows(stage: Stage, windows: StageWindow[]): Stage {
  return { ...stage, windows, focusedId: windows.find((w) => w.slot === 'main')?.id ?? null };
}

function unarchive(content: Content): Content {
  if (!content.archived) return content;
  const copy = { ...content };
  delete copy.archived;
  return copy;
}

function containsContent(stage: Stage, contentId: string): boolean {
  return (
    stage.tray.some((c) => c.id === contentId) ||
    stage.windows.some((w) => w.contents.some((c) => c.id === contentId))
  );
}

function moveWindow(stage: Stage, windowId: string, slot: Slot): Stage {
  const target = stage.windows.find((w) => w.id === windowId);
  if (!target || target.slot === slot) return stage;
  const occupant = stage.windows.find((w) => w.slot === slot);
  return withWindows(
    stage,
    stage.windows.map((w) =>
      w === target ? { ...w, slot } : w === occupant ? { ...w, slot: target.slot } : w,
    ),
  );
}

function rotate(stage: Stage, shift: 1 | -1): Stage {
  const ordered = orderedWindows(stage);
  if (ordered.length < 2) return stage;
  const slots = ordered.map((w) => w.slot);
  const n = ordered.length;
  const nextSlot = new Map(ordered.map((w, k) => [w.id, slots[(k - shift + n) % n]!]));
  return withWindows(
    stage,
    stage.windows.map((w) => ({ ...w, slot: nextSlot.get(w.id) ?? w.slot })),
  );
}

// Durante una negoziazione il contenuto negoziato ha un altro scrittore: l'host non lo
// sposta, non lo toglie e non archivia la finestra che lo contiene.
function touchesNegotiated(stage: Stage, command: StageCommand): boolean {
  const contentId = stage.negotiation?.contentId;
  if (!contentId) return false;
  switch (command.type) {
    case 'CONTENT_PLACE':
    case 'CONTENT_REMOVE':
      return command.contentId === contentId;
    case 'WINDOW_ARCHIVE':
      return stage.windows.some(
        (w) => w.id === command.windowId && w.contents.some((c) => c.id === contentId),
      );
    default:
      return false;
  }
}

export function applyCommand(stage: Stage, command: StageCommand): Stage {
  if (touchesNegotiated(stage, command)) return stage;
  switch (command.type) {
    case 'TRAY_ADD': {
      if (stage.tray.length >= MAX_TRAY || containsContent(stage, command.content.id)) return stage;
      return { ...stage, tray: [...stage.tray, command.content] };
    }

    case 'WINDOW_CREATE': {
      if (stage.windows.length >= MAX_WINDOWS) return stage;
      if (stage.windows.some((w) => w.id === command.windowId)) return stage;
      const free = SLOTS.find((slot) => !stage.windows.some((w) => w.slot === slot));
      if (!free) return stage;
      return withWindows(stage, [
        ...stage.windows,
        { id: command.windowId, title: command.title, slot: free, contents: [] },
      ]);
    }

    case 'WINDOW_ARCHIVE': {
      const target = stage.windows.find((w) => w.id === command.windowId);
      if (!target) return stage;
      let windows = stage.windows.filter((w) => w !== target);
      if (target.slot === 'main' && windows.length > 0) {
        const promoted = [...windows].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot))[0]!;
        windows = windows.map((w) => (w === promoted ? { ...w, slot: 'main' as const } : w));
      }
      const archived = target.contents.map((c) => ({ ...c, archived: true }));
      return withWindows({ ...stage, tray: [...stage.tray, ...archived] }, windows);
    }

    case 'WINDOW_MOVE':
      return moveWindow(stage, command.windowId, command.slot);

    case 'FOCUS':
      return moveWindow(stage, command.windowId, 'main');

    case 'FOCUS_NEXT':
      return rotate(stage, 1);

    case 'FOCUS_PREV':
      return rotate(stage, -1);

    case 'CONTENT_PLACE': {
      const target = stage.windows.find((w) => w.id === command.windowId);
      if (!target || target.contents.some((c) => c.id === command.contentId)) return stage;
      if (target.contents.length >= MAX_CONTENTS_PER_WINDOW) return stage;
      const fromTray = stage.tray.find((c) => c.id === command.contentId);
      const fromWindow = stage.windows
        .flatMap((w) => w.contents)
        .find((c) => c.id === command.contentId);
      const content = fromTray ?? fromWindow;
      if (!content) return stage;
      const placed = unarchive(content);
      return withWindows(
        { ...stage, tray: stage.tray.filter((c) => c.id !== command.contentId) },
        stage.windows.map((w) =>
          w === target
            ? { ...w, contents: [...w.contents, placed] }
            : { ...w, contents: w.contents.filter((c) => c.id !== command.contentId) },
        ),
      );
    }

    case 'CONTENT_REMOVE': {
      const content = stage.windows
        .flatMap((w) => w.contents)
        .find((c) => c.id === command.contentId);
      if (!content) return stage;
      return withWindows(
        { ...stage, tray: [...stage.tray, { ...content, archived: true }] },
        stage.windows.map((w) => ({
          ...w,
          contents: w.contents.filter((c) => c.id !== command.contentId),
        })),
      );
    }
  }
}
