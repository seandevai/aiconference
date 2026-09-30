import type { StageCommand, StageWindow } from '@omnicanvas/canvas';
import type { DragItem } from '@/lib/stage/drop';
import { Button, Icon, type IconName } from '@omnicanvas/ui';
import { ContentView } from './content-view';

export type { DragItem };

export const DRAG_TYPE = 'application/x-omnicanvas';

type Props = {
  window: StageWindow;
  assetUrls: Record<string, string>;
  dispatch?: ((command: StageCommand) => void) | undefined;
};

// Negli slot laterali stretti resta solo l'icona; il testo passa ai lettori di schermo
// e torna visibile quando la finestra è larga almeno 20rem (container query).
function WindowAction({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button size="sm" title={label} onClick={onClick} className="min-w-7">
      <Icon name={icon} className="h-3.5 w-3.5" />
      <span className="sr-only @xs:not-sr-only">{label}</span>
    </Button>
  );
}

export function WindowView({ window, assetUrls, dispatch }: Props) {
  const editable = Boolean(dispatch);
  const startDrag = (item: DragItem) => (event: React.DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <article
      aria-label={window.title}
      className={`@container flex h-full flex-col gap-2 rounded-tile border bg-raised p-3 motion-safe:transition-colors ${
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
        <h2 className="min-w-0 truncate text-sm font-semibold">{window.title}</h2>
        {dispatch && (
          <div className="flex shrink-0 gap-1">
            {window.slot !== 'main' && (
              <WindowAction
                icon="focus"
                label="Metti in primo piano"
                onClick={() => dispatch({ type: 'FOCUS', windowId: window.id })}
              />
            )}
            <WindowAction
              icon="archive"
              label="Archivia finestra"
              onClick={() => dispatch({ type: 'WINDOW_ARCHIVE', windowId: window.id })}
            />
          </div>
        )}
      </header>
      {window.contents.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-tile border border-dashed border-line text-xs text-muted">
          {editable ? 'Finestra vuota: trascina qui un contenuto dal vassoio' : 'Finestra vuota'}
        </p>
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
                <div className="w-fit">
                  <WindowAction
                    icon="to-tray"
                    label="Rimetti nel vassoio"
                    onClick={() => dispatch({ type: 'CONTENT_REMOVE', contentId: content.id })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
