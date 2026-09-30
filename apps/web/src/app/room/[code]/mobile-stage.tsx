'use client';

import { useRef, useState } from 'react';
import type { Stage } from '@omnicanvas/canvas';
import { Button, Icon, Panel } from '@omnicanvas/ui';
import { peekNeighbor } from '@/lib/stage/peek';
import { WindowView } from './window-view';

const SWIPE_PX = 50;

export function MobileStage({
  stage,
  assetUrls,
}: {
  stage: Stage;
  assetUrls: Record<string, string>;
}) {
  // Lo sbirciare vale finché l'host non cambia finestra: poi si torna a seguirlo.
  const [peek, setPeek] = useState<{ id: string; focus: string | null } | null>(null);
  const touchStart = useRef<number | null>(null);

  const peekId = peek && peek.focus === stage.focusedId ? peek.id : null;
  const shownId = peekId ?? stage.focusedId;
  const shown = stage.windows.find((w) => w.id === shownId) ?? null;

  const step = (direction: 1 | -1) => {
    const next = peekNeighbor(stage, shownId, direction);
    if (!next) return;
    setPeek(next === stage.focusedId ? null : { id: next, focus: stage.focusedId });
  };

  if (!shown) {
    return <p className="text-sm text-muted">L&apos;host non ha ancora aperto finestre.</p>;
  }

  return (
    <div
      role="region"
      aria-label={peekId ? 'Finestra che stai guardando' : 'Finestra in primo piano'}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < SWIPE_PX) return;
        step(end < start ? 1 : -1);
      }}
      className="flex h-full flex-col gap-2"
    >
      {stage.windows.length > 1 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <Button onClick={() => step(-1)}>
            <Icon name="chevron-left" /> Finestra precedente
          </Button>
          {peekId && (
            <Button variant="accent" onClick={() => setPeek(null)}>
              Torna all&apos;host
            </Button>
          )}
          <Button onClick={() => step(1)}>
            Finestra successiva <Icon name="chevron-right" />
          </Button>
        </div>
      )}
      <Panel tone="stage" className="flex min-h-0 flex-1 flex-col p-2">
        <WindowView window={shown} assetUrls={assetUrls} />
      </Panel>
      {stage.windows.length > 1 && (
        <div aria-hidden className="flex justify-center gap-1.5">
          {stage.windows.map((w) => (
            <span
              key={w.id}
              className={`h-1.5 w-1.5 rounded-full ${w.id === shownId ? 'bg-accent' : 'bg-line'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
