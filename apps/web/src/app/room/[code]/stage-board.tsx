'use client';

import { nearestSlot, type Slot, type Stage, type StageCommand } from '@omnicanvas/canvas';
import { resolveDrop, slotRectsFromDom } from '@/lib/stage/drop';
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
  born?: string[] | undefined;
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

export function StageBoard({ stage, assetUrls, dispatch, born = [] }: Props) {
  function handleDrop(event: React.DragEvent) {
    if (!dispatch) return;
    event.preventDefault();
    const item = readDragItem(event);
    if (!item) return;
    const slot = nearestSlot({ x: event.clientX, y: event.clientY }, slotRectsFromDom());
    const command = slot ? resolveDrop(stage, item, slot) : null;
    if (command) dispatch(command);
  }

  const renderSlot = (slot: Slot, className: string) => {
    const window = stage.windows.find((w) => w.slot === slot);
    return (
      <div
        key={slot}
        role="region"
        aria-label={SLOT_LABELS[slot]}
        data-slot={slot}
        className={className}
      >
        {window ? (
          <WindowView
            window={window}
            assetUrls={assetUrls}
            dispatch={dispatch}
            born={born.includes(window.id)}
            transitionName
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-tile border border-dashed border-line text-xs text-muted">
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
