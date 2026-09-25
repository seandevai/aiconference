import type { StageCommand, StageWindow } from '@omnicanvas/canvas';
import { ContentView } from './content-view';

export const DRAG_TYPE = 'application/x-omnicanvas';
export type DragItem = { type: 'content' | 'window'; id: string };

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
      className="flex h-full flex-col gap-2 rounded border border-neutral-700 bg-neutral-900 p-2"
    >
      <header
        draggable={editable}
        onDragStart={editable ? startDrag({ type: 'window', id: window.id }) : undefined}
        className={`flex items-center justify-between gap-2 ${editable ? 'cursor-grab' : ''}`}
      >
        <h2 className="truncate text-sm font-medium">{window.title}</h2>
        {dispatch && (
          <div className="flex gap-1">
            {window.slot !== 'main' && (
              <button
                onClick={() => dispatch({ type: 'FOCUS', windowId: window.id })}
                className="rounded bg-neutral-800 px-2 py-0.5 text-xs"
              >
                Metti in primo piano
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'WINDOW_ARCHIVE', windowId: window.id })}
              className="rounded bg-neutral-800 px-2 py-0.5 text-xs"
            >
              Archivia finestra
            </button>
          </div>
        )}
      </header>
      {window.contents.length === 0 ? (
        <p className="text-xs text-neutral-500">Finestra vuota</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-3 overflow-auto">
          {window.contents.map((content) => (
            <li
              key={content.id}
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
                <button
                  onClick={() => dispatch({ type: 'CONTENT_REMOVE', contentId: content.id })}
                  className="w-fit rounded bg-neutral-800 px-2 py-0.5 text-xs"
                >
                  Rimetti nel vassoio
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
