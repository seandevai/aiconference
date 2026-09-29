import type { StageCommand, StageWindow } from '@omnicanvas/canvas';
import type { DragItem } from '@/lib/stage/drop';
import { Button } from '@omnicanvas/ui';
import { ContentView } from './content-view';

export type { DragItem };

export const DRAG_TYPE = 'application/x-omnicanvas';

type Props = {
  window: StageWindow;
  assetUrls: Record<string, string>;
  dispatch?: ((command: StageCommand) => void) | undefined;
};

export function WindowView({ window, assetUrls, dispatch }: Props) {
  const editable = Boolean(dispatch);
  const startDrag = (item: DragItem) => (event: React.DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <article
      aria-label={window.title}
      className={`flex h-full flex-col gap-2 rounded-tile border bg-raised p-3 ${
        window.slot === 'main' ? 'border-accent' : 'border-line'
      }`}
    >
      <header
        data-drag-type="window"
        data-drag-id={window.id}
        draggable={editable}
        onDragStart={editable ? startDrag({ type: 'window', id: window.id }) : undefined}
        className={`flex items-center justify-between gap-2 ${editable ? 'cursor-grab' : ''}`}
      >
        <h2 className="truncate text-sm font-semibold">{window.title}</h2>
        {dispatch && (
          <div className="flex gap-1">
            {window.slot !== 'main' && (
              <Button size="sm" onClick={() => dispatch({ type: 'FOCUS', windowId: window.id })}>
                Metti in primo piano
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => dispatch({ type: 'WINDOW_ARCHIVE', windowId: window.id })}
            >
              Archivia finestra
            </Button>
          </div>
        )}
      </header>
      {window.contents.length === 0 ? (
        <p className="text-xs text-muted">Finestra vuota</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-3 overflow-auto">
          {window.contents.map((content) => (
            <li
              key={content.id}
              data-drag-type="content"
              data-drag-id={content.id}
              draggable={editable}
              onDragStart={editable ? startDrag({ type: 'content', id: content.id }) : undefined}
              className="flex flex-col gap-1"
            >
              <ContentView
                content={content}
                assetUrl={
                  content.kind === 'image' ? (assetUrls[content.data.assetId] ?? null) : null
                }
              />
              {dispatch && (
                <Button
                  size="sm"
                  className="w-fit"
                  onClick={() => dispatch({ type: 'CONTENT_REMOVE', contentId: content.id })}
                >
                  Rimetti nel vassoio
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
