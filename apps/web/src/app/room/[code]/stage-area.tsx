'use client';

import { MAX_WINDOWS, type ImageMime, type Stage, type StageCommand } from '@omnicanvas/canvas';
import { AgentPanel } from './agent-panel';
import { MobileStage } from './mobile-stage';
import { StageBoard } from './stage-board';
import { Tray } from './tray';

type Props = {
  joinCode: string;
  role: 'host' | 'guest';
  stage: Stage;
  ready: boolean;
  assetUrls: Record<string, string>;
  dispatch: (command: StageCommand) => void;
  addImage: (bytes: Uint8Array, mime: ImageMime, title: string, alt: string) => void;
};

export function StageArea({ joinCode, role, stage, ready, assetUrls, dispatch, addImage }: Props) {
  if (!ready) return <p className="text-sm text-neutral-500">Caricamento del palco…</p>;

  if (role === 'guest') {
    return (
      <>
        <div className="hidden h-full lg:flex">
          <StageBoard stage={stage} assetUrls={assetUrls} />
        </div>
        <div className="h-full lg:hidden">
          <MobileStage stage={stage} assetUrls={assetUrls} />
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <AgentPanel joinCode={joinCode} dispatch={dispatch} />
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() =>
            dispatch({
              type: 'WINDOW_CREATE',
              windowId: crypto.randomUUID(),
              title: `Finestra ${stage.windows.length + 1}`,
            })
          }
          disabled={stage.windows.length >= MAX_WINDOWS}
          className="rounded bg-neutral-100 px-2 py-1 text-neutral-900 disabled:opacity-40"
        >
          Nuova finestra
        </button>
        <button
          onClick={() => dispatch({ type: 'FOCUS_PREV' })}
          disabled={stage.windows.length < 2}
          className="rounded bg-neutral-800 px-2 py-1 disabled:opacity-40"
        >
          Finestra precedente
        </button>
        <button
          onClick={() => dispatch({ type: 'FOCUS_NEXT' })}
          disabled={stage.windows.length < 2}
          className="rounded bg-neutral-800 px-2 py-1 disabled:opacity-40"
        >
          Finestra successiva
        </button>
      </div>
      <StageBoard stage={stage} assetUrls={assetUrls} dispatch={dispatch} />
      <Tray stage={stage} dispatch={dispatch} addImage={addImage} />
    </div>
  );
}
