'use client';

import { useRef, useState } from 'react';
import { MAX_WINDOWS, type ImageMime, type Stage, type StageCommand } from '@omnicanvas/canvas';
import type { RealtimeSession } from '@omnicanvas/realtime';
import { Button, Icon, Panel } from '@omnicanvas/ui';
import { stageCounter } from '@/lib/stage/stage-counter';
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
  if (!ready) return <StageSkeleton />;

  if (role === 'guest') {
    const counter = stageCounter(stage);
    return (
      <>
        <Panel tone="stage" className="hidden h-full flex-col gap-2 p-2 lg:flex">
          {counter && <span className="tabular text-xs text-muted">{counter}</span>}
          <StageBoard stage={stage} assetUrls={assetUrls} />
        </Panel>
        <div className="h-full lg:hidden">
          <MobileStage stage={stage} assetUrls={assetUrls} />
        </div>
      </>
    );
  }

  return <HostStage {...props} />;
}

// La forma del palco (primo piano e tre laterali) mentre arriva lo stato: la pagina
// non salta quando compaiono le finestre.
function StageSkeleton() {
  return (
    // Niente regione propria: sta già dentro la sezione «Palco».
    <Panel
      tone="stage"
      data-testid="stage-skeleton"
      aria-busy="true"
      className="grid h-full min-h-48 gap-2 p-2 lg:grid-cols-[3fr_1fr]"
    >
      <span className="sr-only">Caricamento del palco…</span>
      <div data-skeleton className="rounded-tile bg-raised/60 motion-safe:animate-pulse" />
      <div className="hidden gap-2 lg:grid lg:grid-rows-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            data-skeleton
            className="rounded-tile bg-raised/40 motion-safe:animate-pulse"
          />
        ))}
      </div>
    </Panel>
  );
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
  const [agentFocus, setAgentFocus] = useState(0);
  const gestures = useGestures({
    session,
    cameraOn,
    stage,
    dispatch,
    onAgent: () => setAgentFocus((n) => n + 1),
    areaRef,
  });
  const counter = stageCounter(stage);

  return (
    <div ref={areaRef} className="flex h-full min-h-0 gap-3">
      <Panel
        as="section"
        aria-label="Laboratorio"
        className="flex w-60 shrink-0 flex-col gap-4 overflow-auto p-3 xl:w-70"
      >
        <AgentPanel joinCode={joinCode} dispatch={dispatch} focusRequest={agentFocus} />
        <Tray stage={stage} dispatch={dispatch} addImage={addImage} showSamples={showSamples} />
        <div className="mt-auto">
          <GestureControl
            status={gestures.status}
            armed={gestures.armed}
            cursor={gestures.cursor}
            videoRef={gestures.videoRef}
            onToggle={() => void gestures.toggle()}
          />
        </div>
      </Panel>

      <Panel tone="stage" className="flex min-w-0 flex-1 flex-col gap-2 p-2">
        <div className="flex items-center gap-2 text-xs">
          <Button
            size="sm"
            title="Finestra precedente"
            className="px-1.5"
            onClick={() => dispatch({ type: 'FOCUS_PREV' })}
            disabled={stage.windows.length < 2}
          >
            <Icon name="chevron-left" />
            <span className="sr-only">Finestra precedente</span>
          </Button>
          <Button
            size="sm"
            title="Finestra successiva"
            className="px-1.5"
            onClick={() => dispatch({ type: 'FOCUS_NEXT' })}
            disabled={stage.windows.length < 2}
          >
            <Icon name="chevron-right" />
            <span className="sr-only">Finestra successiva</span>
          </Button>
          {counter && <span className="tabular text-muted">{counter}</span>}
          <Button
            size="sm"
            className="ml-auto"
            onClick={() =>
              dispatch({
                type: 'WINDOW_CREATE',
                windowId: crypto.randomUUID(),
                title: `Finestra ${stage.windows.length + 1}`,
              })
            }
            disabled={stage.windows.length >= MAX_WINDOWS}
          >
            <Icon name="plus" /> Nuova finestra
          </Button>
        </div>
        <StageBoard stage={stage} assetUrls={assetUrls} dispatch={dispatch} />
      </Panel>
    </div>
  );
}
