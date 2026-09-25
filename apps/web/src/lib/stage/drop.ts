import { SLOTS, type Rect, type Slot, type Stage, type StageCommand } from '@omnicanvas/canvas';

export type DragItem = { type: 'content' | 'window'; id: string };

// Mouse e mano finiscono qui: il palco non sa da dove arriva il rilascio.
export function resolveDrop(stage: Stage, item: DragItem, slot: Slot): StageCommand | null {
  if (item.type === 'window') return { type: 'WINDOW_MOVE', windowId: item.id, slot };
  const target = stage.windows.find((w) => w.slot === slot);
  return target ? { type: 'CONTENT_PLACE', contentId: item.id, windowId: target.id } : null;
}

export function slotRectsFromDom(root: ParentNode = document): Partial<Record<Slot, Rect>> {
  const rects: Partial<Record<Slot, Rect>> = {};
  for (const slot of SLOTS) {
    const box = root.querySelector(`[data-slot="${slot}"]`)?.getBoundingClientRect();
    if (box) rects[slot] = { x: box.x, y: box.y, width: box.width, height: box.height };
  }
  return rects;
}

export function dragItemAt(x: number, y: number): DragItem | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drag-id]');
  const type = element?.dataset.dragType;
  const id = element?.dataset.dragId;
  return (type === 'content' || type === 'window') && id ? { type, id } : null;
}
