'use client';

import { useRef, useState } from 'react';
import { MAX_WINDOWS, type ImageMime, type Stage, type StageCommand } from '@omnicanvas/canvas';
import type { RealtimeSession } from '@omnicanvas/realtime';
import { useGestures } from '@/lib/stage/use-gestures';
import { AgentPanel } from './agent-panel';
import { GestureControl } from './gesture-control';
import { MobileStage } from './mobile-stage';
import { StageBoard } from './stage-board';
import { Tray } from './tray';

type Props = {
  joinCode: string;
  session: RealtimeSession | null;
  cameraOn: boolean;
  role: 'host' | 'guest';
  showSamples: boolean;
  stage: Stage;
  ready: boolean;
  assetUrls: Record<string, string>;
  dispatch: (command: StageCommand) => void;
  addImage: (bytes: Uint8Array, mime: ImageMime, title: string, alt: string) => void;
};

export function StageArea(props: Props) {
  const { role, stage, ready, assetUrls } = props;
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

  return <HostStage {...props} />;
}

// Ramo dell'host: possiede gli hook di agente e gesture (solo l'host comanda il palco).
function HostStage({
  joinCode,
  session,
  cameraOn,
  showSamples,
  stage,
  assetUrls,
  dispatch,
  addImage,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const gestures = useGestures({
    session,
    cameraOn,
    stage,
    dispatch,
    onAgent: () => setAgentOpen(true),
    areaRef,
  });

  return (
    <div ref={areaRef} className="flex h-full min-h-0 flex-col gap-2">
      <AgentPanel
        joinCode={joinCode}
        dispatch={dispatch}
        open={agentOpen}
        onOpenChange={setAgentOpen}
      />
      <GestureControl
        status={gestures.status}
        armed={gestures.armed}
        cursor={gestures.cursor}
        videoRef={gestures.videoRef}
        onToggle={() => void gestures.toggle()}
      />
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
      <Tray stage={stage} dispatch={dispatch} addImage={addImage} showSamples={showSamples} />
    </div>
  );
}
