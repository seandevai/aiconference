import {
  nearestSlot,
  type Rect,
  type Slot,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import type { GestureEvent } from '@omnicanvas/gesture';
import { dragItemAt, resolveDrop, slotRectsFromDom, type DragItem } from './drop';
import { gestureAction } from './gesture-actions';

export type StageCursor = { x: number; y: number; grabbing: boolean };

export type StageGestureDeps = {
  // Punto normalizzato (vista specchio) → coordinate dello schermo; null fuori dall'area.
  toScreen(x: number, y: number): { x: number; y: number } | null;
  getStage(): Stage;
  dispatch(command: StageCommand): void;
  onAgent(): void;
  onArmed(armed: boolean): void;
  onCursor(cursor: StageCursor | null): void;
  newId?: () => string;
  itemAt?: (x: number, y: number) => DragItem | null;
  slotRects?: () => Partial<Record<Slot, Rect>>;
};

// Eventi delle mani → comandi del palco. La usano la call e il laboratorio gesture: mano,
// mouse e agente finiscono nello stesso dispatch.
export function createStageGestureHandler(deps: StageGestureDeps): (event: GestureEvent) => void {
  const itemAt = deps.itemAt ?? dragItemAt;
  const slotRects = deps.slotRects ?? (() => slotRectsFromDom());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  let dragging: DragItem | null = null;

  return (event) => {
    if (event.type === 'GESTURES_TOGGLE') {
      deps.onArmed(event.armed);
      return;
    }
    if ('x' in event) {
      const point = deps.toScreen(event.x, event.y);
      if (!point) return;
      if (event.type === 'GRAB') dragging = itemAt(point.x, point.y);
      if (event.type === 'DROP') {
        const item = dragging;
        dragging = null;
        deps.onCursor(null);
        const slot = nearestSlot(point, slotRects());
        const command = item && slot ? resolveDrop(deps.getStage(), item, slot) : null;
        if (command) deps.dispatch(command);
        return;
      }
      deps.onCursor({ ...point, grabbing: dragging !== null });
      return;
    }
    const action = gestureAction(event, deps.getStage(), newId);
    if (action.kind === 'command') deps.dispatch(action.command);
    if (action.kind === 'agent') deps.onAgent();
  };
}
