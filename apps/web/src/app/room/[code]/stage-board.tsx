'use client';

import { useRef } from 'react';
import {
  SLOTS,
  nearestSlot,
  type Rect,
  type Slot,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import { DRAG_TYPE, WindowView, type DragItem } from './window-view';

const SLOT_LABELS: Record<Slot, string> = {
  main: 'Finestra in primo piano',
  'side-1': 'Finestra laterale 1',
  'side-2': 'Finestra laterale 2',
  'side-3': 'Finestra laterale 3',
};

type Props = {
  stage: Stage;
  assetUrls: Record<string, string>;
  dispatch?: ((command: StageCommand) => void) | undefined;
};

function readDragItem(event: React.DragEvent): DragItem | null {
  try {
    const item = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as Partial<DragItem>;
    return (item.type === 'content' || item.type === 'window') && typeof item.id === 'string'
      ? { type: item.type, id: item.id }
      : null;
  } catch {
    return null;
  }
}

export function StageBoard({ stage, assetUrls, dispatch }: Props) {
  const slotElements = useRef<Partial<Record<Slot, HTMLDivElement | null>>>({});

  function handleDrop(event: React.DragEvent) {
    if (!dispatch) return;
    event.preventDefault();
    const item = readDragItem(event);
    if (!item) return;
    const rects: Partial<Record<Slot, Rect>> = {};
    for (const slot of SLOTS) {
      const box = slotElements.current[slot]?.getBoundingClientRect();
      if (box) rects[slot] = { x: box.x, y: box.y, width: box.width, height: box.height };
    }
    const slot = nearestSlot({ x: event.clientX, y: event.clientY }, rects);
    if (!slot) return;
    if (item.type === 'window') {
      dispatch({ type: 'WINDOW_MOVE', windowId: item.id, slot });
      return;
    }
    const target = stage.windows.find((w) => w.slot === slot);
    if (target) dispatch({ type: 'CONTENT_PLACE', contentId: item.id, windowId: target.id });
  }

  const renderSlot = (slot: Slot, className: string) => {
    const window = stage.windows.find((w) => w.slot === slot);
    return (
      <div
        key={slot}
        role="region"
        aria-label={SLOT_LABELS[slot]}
        ref={(element) => {
          slotElements.current[slot] = element;
        }}
        className={className}
      >
        {window ? (
          <WindowView window={window} assetUrls={assetUrls} dispatch={dispatch} />
        ) : (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-neutral-800 text-xs text-neutral-600">
            {slot === 'main' ? 'Nessuna finestra' : 'Slot libero'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onDragOver={(event) => {
        if (dispatch) event.preventDefault();
      }}
      onDrop={handleDrop}
      className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[3fr_1fr]"
    >
      {renderSlot('main', 'min-h-48 lg:min-h-0')}
      <div className="grid gap-2 lg:grid-rows-3">
        {(['side-1', 'side-2', 'side-3'] as const).map((slot) => renderSlot(slot, 'min-h-24'))}
      </div>
    </div>
  );
}
