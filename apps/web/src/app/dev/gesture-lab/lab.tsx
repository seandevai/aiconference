'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cx } from '@omnicanvas/ui';
import type { Frame } from '@omnicanvas/gesture';
import { StageBoard } from '@/app/room/[code]/stage-board';
import type { LabArchive, RecordingSummary } from '@/lib/gesture-lab/lab-store';
import { WIDE_SCREEN_QUERY, useLabView } from '@/lib/gesture-lab/lab-view';
import { effectiveTuning } from '@/lib/gesture-lab/settings';
import { useGestureLab } from '@/lib/gesture-lab/use-gesture-lab';
import { AdvancedPanel } from './advanced-panel';
import { BenchPanel } from './bench-panel';
import { BenchScreen } from './bench-screen';
import { HandView } from './hand-view';
import { HomeScreen } from './home-screen';
import { LabScene, stageHiddenClass, type SceneVariant } from './lab-scene';
import { PresetSection } from './preset-panel';
import { RecordWizard } from './record-wizard';
import { ReplayScreen } from './replay-screen';
import { TryScreen } from './try-screen';

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
  const { view, id, go } = useLabView(archive !== null);
  // Registrazioni e preset vivono qui: restano cambiando schermata o chiudendo Avanzate.
  const [recordings, setRecordings] = useState<RecordingSummary[]>(archive?.recordings ?? []);
  const [presets, setPresets] = useState(archive?.presets ?? []);
  const [advanced, setAdvanced] = useState(false);
  const [screenScene, setScreenScene] = useState(false);
  const sceneVisible = view === 'prova' || view === 'banco' || screenScene;
  // Sul telefono il palco si apre a richiesta; ogni schermata riparte con la mano.
  const [stageShown, setStageShown] = useState(false);
  const [stageView, setStageView] = useState(view);
  if (stageView !== view) {
    setStageView(view);
    setStageShown(false);
  }
  const toggleStage = useCallback(() => setStageShown((shown) => !shown), []);
  const variant: SceneVariant = view === 'banco' || view === 'registra' ? 'bench' : 'stage';
  const showAdvanced = advanced && sceneVisible;

  // La fotocamera segue la schermata. Ogni schermata ha il suo <video>: cambiando schermata lo
  // stream resterebbe su un elemento staccato (che il browser mette in pausa), quindi si ferma
  // sempre e riparte entrando in Prova o nel banco; Registra la accende da sé al passo 2. Anche il rigioco
  // si ferma. Il hook si legge da un ref: l'effetto dipende solo dalla vista.
  const labRef = useRef(lab);
  useEffect(() => {
    labRef.current = lab;
  });
  useEffect(() => {
    const current = labRef.current;
    current.pause();
    current.stopLive();
    if (view === 'prova' || view === 'banco') void current.startLive();
  }, [view]);

  // Il banco serve spazio: aperto dal telefono (link o tasto indietro) si torna all'inizio.
  useEffect(() => {
    if (view !== 'banco') return;
    const wide = window.matchMedia(WIDE_SCREEN_QUERY);
    const check = () => {
      if (!wide.matches) go('home');
    };
    check();
    wide.addEventListener('change', check);
    return () => wide.removeEventListener('change', check);
  }, [view, go]);

  const removeRecording = useCallback(
    (recordingId: string) => setRecordings((list) => list.filter((r) => r.id !== recordingId)),
    [],
  );
  const addRecording = useCallback(
    (summary: RecordingSummary) => setRecordings((list) => [summary, ...list]),
    [],
  );
  const openAdvanced = useCallback(() => setAdvanced(true), []);
  const toHome = useCallback(() => go('home'), [go]);
  const toList = useCallback(() => go('rigioca'), [go]);
  const openRecording = useCallback((recordingId: string) => go('rigioca', recordingId), [go]);

  const scene = (
    <LabScene
      areaRef={areaRef}
      variant={variant}
      stageShown={stageShown}
      onToggleStage={toggleStage}
      hand={
        <HandView
          videoRef={videoRef}
          framesRef={framesRef}
          view={lab.view}
          lastEvent={lab.fired[lab.fired.length - 1] ?? null}
          idle={lab.live !== 'on' && !lab.playing}
          replaying={lab.playing}
        />
      }
      stage={<StageBoard stage={lab.stage} assetUrls={{}} dispatch={lab.dispatch} />}
      panel={
        <BenchPanel
          view={lab.view}
          hand={lab.hand}
          tuning={effectiveTuning(lab.settings)}
          log={lab.log}
        />
      }
    />
  );

  return (
    <main
      className={cx(
        'flex h-dvh flex-col gap-3 overflow-hidden bg-bg p-4 text-fg',
        showAdvanced && 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)]',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {view === 'home' && <HomeScreen canArchive={archive !== null} onGo={go} />}
        {view === 'prova' && (
          <TryScreen
            scene={scene}
            live={lab.live}
            armed={lab.armed}
            onStart={() => void lab.startLive()}
            onStop={lab.stopLive}
            onBack={toHome}
            onAdvanced={openAdvanced}
          />
        )}
        {view === 'banco' && (
          <BenchScreen
            scene={scene}
            live={lab.live}
            onStart={() => void lab.startLive()}
            onStop={lab.stopLive}
            onBack={toHome}
            onAdvanced={openAdvanced}
          />
        )}
        {view === 'registra' && archive && (
          <RecordWizard
            live={lab.live}
            hand={lab.hand}
            settings={lab.settings}
            scene={scene}
            capture={lab.capture}
            onStartCamera={() => void lab.startLive()}
            onRecorded={lab.loadRecording}
            onReview={lab.play}
            onSaved={addRecording}
            onScene={setScreenScene}
            onAdvanced={openAdvanced}
            onExit={toHome}
          />
        )}
        {view === 'rigioca' && archive && (
          <ReplayScreen
            userId={archive.userId}
            recordings={recordings}
            onRemoved={removeRecording}
            id={id}
            scene={scene}
            settings={lab.settings}
            recording={lab.recording}
            playing={lab.playing}
            progress={lab.progress}
            onLoad={lab.loadRecording}
            onPlay={lab.play}
            onPause={lab.pause}
            onOpen={openRecording}
            onList={toList}
            onExit={toHome}
            onScene={setScreenScene}
            onAdvanced={openAdvanced}
          />
        )}
      </div>
      <AdvancedPanel
        open={showAdvanced}
        onClose={() => setAdvanced(false)}
        settings={lab.settings}
        onChange={lab.setSettings}
        diagnostics={
          <BenchPanel
            view={lab.view}
            hand={lab.hand}
            tuning={effectiveTuning(lab.settings)}
            log={lab.log}
            stacked
          />
        }
        presets={
          archive ? (
            <PresetSection
              userId={archive.userId}
              presets={presets}
              onPresetsChange={setPresets}
              settings={lab.settings}
              onApply={lab.setSettings}
            />
          ) : null
        }
      />
      {lab.cursor && (
        <div
          aria-hidden
          data-lab-cursor
          style={{ left: lab.cursor.x, top: lab.cursor.y }}
          className={cx(
            'pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2',
            lab.cursor.grabbing ? 'h-8 w-8 border-accent bg-accent/30' : 'h-5 w-5 border-fg',
            stageHiddenClass(variant, stageShown),
          )}
        />
      )}
    </main>
  );
}
