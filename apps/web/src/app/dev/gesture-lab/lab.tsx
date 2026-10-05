'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@omnicanvas/ui';
import { StageBoard } from '@/app/room/[code]/stage-board';
import type { Frame } from '@omnicanvas/gesture';
import { effectiveTuning, labCode } from '@/lib/gesture-lab/settings';
import { useGestureLab } from '@/lib/gesture-lab/use-gesture-lab';
import { EventList } from './event-list';
import { HandPanel } from './hand-panel';
import { LabControls } from './lab-controls';
import { ReplayPanel } from './replay-panel';

const LIVE_MESSAGES = {
  off: null,
  loading: 'Avvio della webcam e del riconoscimento…',
  on: null,
  no_camera:
    'Webcam non disponibile: consenti la fotocamera nel browser. Il rigioco funziona lo stesso.',
  unavailable:
    'Riconoscimento delle mani non disponibile su questo dispositivo. Il rigioco funziona lo stesso.',
} as const;

// Solo nel browser: le impostazioni vengono da localStorage, il server non le conosce.
const subscribe = () => () => {};
export function Lab() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? <LabClient /> : null;
}

function LabClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<{ raw: Frame; processed: Frame } | null>(null);
  const lab = useGestureLab({ videoRef, areaRef, framesRef });
  const [code, setCode] = useState<string | null>(null);
  const message = LIVE_MESSAGES[lab.live];

  async function copyCode() {
    const text = labCode(lab.settings);
    try {
      await navigator.clipboard.writeText(text);
      setCode(null);
    } catch {
      setCode(text);
    }
  }

  return (
    <main className="grid min-h-dvh grid-cols-1 gap-4 bg-bg p-4 text-fg lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-h-0 flex-col gap-2">
        <h1 className="text-lg font-extrabold">Laboratorio gesture</h1>
        <div ref={areaRef} className="relative min-h-[480px] flex-1">
          <StageBoard stage={lab.stage} assetUrls={{}} dispatch={lab.dispatch} />
        </div>
        {lab.cursor && (
          <div
            aria-hidden
            style={{ left: lab.cursor.x, top: lab.cursor.y }}
            className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
              lab.cursor.grabbing ? 'h-8 w-8 border-accent bg-accent/30' : 'h-5 w-5 border-fg'
            }`}
          />
        )}
      </section>

      <aside className="flex flex-col gap-4 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {lab.live === 'on' ? (
            <Button onClick={lab.stopLive}>Ferma la webcam</Button>
          ) : (
            <Button
              variant="accent"
              disabled={lab.live === 'loading'}
              onClick={() => void lab.startLive()}
            >
              Avvia la webcam
            </Button>
          )}
          <span className="self-center text-xs text-muted">
            {lab.armed ? 'Gesture attive' : 'Gesture in pausa'}
          </span>
        </div>
        {message && <p className="text-xs text-muted">{message}</p>}
        <HandPanel
          videoRef={videoRef}
          framesRef={framesRef}
          hand={lab.hand}
          view={lab.view}
          tuning={effectiveTuning(lab.settings)}
          feedback={lab.settings.toggles.feedback}
        />
        <ReplayPanel
          recording={lab.recording}
          playing={lab.playing}
          fired={lab.fired}
          onLoad={lab.loadRecording}
          onPlay={lab.play}
          onPause={lab.pause}
        />
        <EventList entries={lab.log} />
        <LabControls settings={lab.settings} onChange={lab.setSettings} />
        <Button onClick={() => void copyCode()}>Copia come codice</Button>
        {code && (
          <textarea
            readOnly
            value={code}
            rows={12}
            className="rounded-tile border border-line bg-stage p-2 font-mono text-xs"
          />
        )}
      </aside>
    </main>
  );
}
