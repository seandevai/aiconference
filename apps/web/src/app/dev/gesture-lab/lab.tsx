'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@omnicanvas/ui';
import { StageBoard } from '@/app/room/[code]/stage-board';
import type { Frame } from '@omnicanvas/gesture';
import type { LabArchive } from '@/lib/gesture-lab/lab-store';
import { effectiveTuning, labCode } from '@/lib/gesture-lab/settings';
import { useGestureLab } from '@/lib/gesture-lab/use-gesture-lab';
import { EventList } from './event-list';
import { HandPanel } from './hand-panel';
import { LabControls } from './lab-controls';
import { CARD, LabTabPanel, LabTabs, type LabTab } from './lab-tabs';
import { ReplayPanel } from './replay-panel';
import { ServerPanels } from './server-panels';

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
export function Lab({ archive }: { archive: LabArchive | null }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? <LabClient archive={archive} /> : null;
}

function LabClient({ archive }: { archive: LabArchive | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<{ raw: Frame; processed: Frame } | null>(null);
  const lab = useGestureLab({ videoRef, areaRef, framesRef });
  const [code, setCode] = useState<string | null>(null);
  // Registra e Archivio parlano col server: esistono solo per un admin del laboratorio.
  const tabs: LabTab[] = archive ? ['record', 'archive', 'tuning'] : ['tuning'];
  const [tab, setTab] = useState<LabTab>(tabs[0]!);
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
    // Su schermo largo la pagina è alta quanto lo schermo: il palco, la mano e gli eventi
    // restano sempre in vista, e solo la colonna dei comandi scorre.
    <main className="grid min-h-dvh grid-cols-1 gap-4 bg-bg p-4 text-fg lg:h-dvh lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col gap-2">
        <h1 className="text-lg font-extrabold">Laboratorio gesture</h1>
        {/* Il palco riempie lo spazio che gli resta e non esce mai sotto la mano. */}
        <div
          ref={areaRef}
          className="relative flex min-h-[320px] flex-1 flex-col overflow-hidden lg:min-h-0"
        >
          <StageBoard stage={lab.stage} assetUrls={{}} dispatch={lab.dispatch} />
        </div>
        <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2 lg:h-[38%]">
          <div className={`min-h-0 overflow-y-auto ${CARD}`}>
            <HandPanel
              videoRef={videoRef}
              framesRef={framesRef}
              hand={lab.hand}
              view={lab.view}
              tuning={effectiveTuning(lab.settings)}
              feedback={lab.settings.toggles.feedback}
              idle={lab.live !== 'on' && !lab.playing}
              replaying={lab.playing}
            />
          </div>
          <div className={`min-h-0 overflow-y-auto ${CARD}`}>
            <EventList entries={lab.log} />
          </div>
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

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
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
        {/* Il rigioco serve sia dopo una registrazione sia aprendo l'archivio: resta sopra le schede. */}
        <div className={CARD}>
          <ReplayPanel
            recording={lab.recording}
            playing={lab.playing}
            fired={lab.fired}
            onLoad={lab.loadRecording}
            onPlay={lab.play}
            onPause={lab.pause}
          />
        </div>
        {tabs.length > 1 && <LabTabs tabs={tabs} active={tab} onChange={setTab} />}
        {archive && (
          <ServerPanels
            archive={archive}
            live={lab.live === 'on'}
            capture={lab.capture}
            onLoad={lab.loadRecording}
            settings={lab.settings}
            onApplySettings={lab.setSettings}
            tab={tab}
          />
        )}
        <LabTabPanel tab="tuning" active={tab}>
          <div className={CARD}>
            <LabControls settings={lab.settings} onChange={lab.setSettings} />
          </div>
          <Button onClick={() => void copyCode()}>Copia come codice</Button>
          {code && (
            <textarea
              readOnly
              value={code}
              rows={12}
              className="rounded-tile border border-line bg-stage p-2 font-mono text-xs"
            />
          )}
        </LabTabPanel>
      </aside>
    </main>
  );
}
