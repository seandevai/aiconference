'use client';

import { sampleContent, type Stage, type StageCommand } from '@omnicanvas/canvas';
import { Button } from '@omnicanvas/ui';
import { sampleImage } from '@/lib/stage/sample-image';
import { DRAG_TYPE, type DragItem } from './window-view';

type Props = {
  stage: Stage;
  dispatch: (command: StageCommand) => void;
  addImage: (bytes: Uint8Array, mime: 'image/png', title: string, alt: string) => void;
  showSamples: boolean;
};

const KIND_LABELS = {
  chart: 'grafico',
  text: 'testo',
  table: 'tabella',
  image: 'immagine',
} as const;

export function Tray({ stage, dispatch, addImage, showSamples }: Props) {
  const addSample = (kind: 'chart' | 'text' | 'table') =>
    dispatch({ type: 'TRAY_ADD', content: sampleContent(kind, crypto.randomUUID()) });

  return (
    <section aria-label="Vassoio" className="flex min-h-0 flex-col gap-2">
      {showSamples && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Contenuti di prova:</span>
          <Button size="sm" onClick={() => addSample('chart')}>
            Aggiungi grafico di prova
          </Button>
          <Button size="sm" onClick={() => addSample('text')}>
            Aggiungi testo di prova
          </Button>
          <Button size="sm" onClick={() => addSample('table')}>
            Aggiungi tabella di prova
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void sampleImage().then((bytes) =>
                addImage(bytes, 'image/png', 'Schema di prova', 'Schema di prova'),
              )
            }
          >
            Aggiungi immagine di prova
          </Button>
        </div>
      )}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Vassoio</h2>
      {stage.tray.length === 0 ? (
        <p className="text-xs text-muted">
          Il vassoio è vuoto: qui arriva ciò che produce l&apos;agente.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 overflow-auto">
          {stage.tray.map((content) => (
            <li
              key={content.id}
              data-drag-type="content"
              data-drag-id={content.id}
              draggable
              onDragStart={(event) => {
                const item: DragItem = { type: 'content', id: content.id };
                event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
              }}
              className="flex cursor-grab flex-col gap-1 rounded-tile bg-raised p-2 text-xs"
            >
              <span className="font-medium">{content.data.title}</span>
              <span className="text-muted">
                {KIND_LABELS[content.kind]}
                {content.archived ? ' · archiviato' : ''}
              </span>
              <select
                aria-label={`Metti «${content.data.title}» in una finestra`}
                value=""
                disabled={stage.windows.length === 0}
                onChange={(event) => {
                  if (event.target.value) {
                    dispatch({
                      type: 'CONTENT_PLACE',
                      contentId: content.id,
                      windowId: event.target.value,
                    });
                  }
                }}
                className="rounded-full bg-bg px-2 py-1 text-xs text-fg"
              >
                <option value="">Metti in…</option>
                {stage.windows.map((window) => (
                  <option key={window.id} value={window.id}>
                    {window.title}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
