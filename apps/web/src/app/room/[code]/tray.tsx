'use client';

import { sampleContent, type Stage, type StageCommand } from '@omnicanvas/canvas';
import { sampleImage } from '@/lib/stage/sample-image';
import { DRAG_TYPE, type DragItem } from './window-view';

type Props = {
  stage: Stage;
  dispatch: (command: StageCommand) => void;
  addImage: (bytes: Uint8Array, mime: 'image/png', title: string, alt: string) => void;
};

const KIND_LABELS = {
  chart: 'grafico',
  text: 'testo',
  table: 'tabella',
  image: 'immagine',
} as const;

export function Tray({ stage, dispatch, addImage }: Props) {
  const addSample = (kind: 'chart' | 'text' | 'table') =>
    dispatch({ type: 'TRAY_ADD', content: sampleContent(kind, crypto.randomUUID()) });

  return (
    <section
      aria-label="Vassoio"
      className="flex flex-col gap-2 rounded border border-neutral-800 p-2"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-400">Contenuti di prova:</span>
        <button onClick={() => addSample('chart')} className="rounded bg-neutral-800 px-2 py-1">
          Aggiungi grafico di prova
        </button>
        <button onClick={() => addSample('text')} className="rounded bg-neutral-800 px-2 py-1">
          Aggiungi testo di prova
        </button>
        <button onClick={() => addSample('table')} className="rounded bg-neutral-800 px-2 py-1">
          Aggiungi tabella di prova
        </button>
        <button
          onClick={() =>
            void sampleImage().then((bytes) =>
              addImage(bytes, 'image/png', 'Schema di prova', 'Schema di prova'),
            )
          }
          className="rounded bg-neutral-800 px-2 py-1"
        >
          Aggiungi immagine di prova
        </button>
      </div>
      {stage.tray.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Il vassoio è vuoto: qui arriva ciò che produce l&apos;agente.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
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
              className="flex cursor-grab flex-col gap-1 rounded bg-neutral-900 p-2 text-xs"
            >
              <span className="font-medium">{content.data.title}</span>
              <span className="text-neutral-500">
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
                className="rounded bg-neutral-800 px-1 py-0.5"
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
