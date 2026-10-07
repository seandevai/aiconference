'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@omnicanvas/ui';
import type { Frame, GestureName, Hand } from '@omnicanvas/gesture';
import { downloadRecording } from '@/lib/gesture-lab/download';
import { evaluateRecording, recordingOutcome } from '@/lib/gesture-lab/evaluate';
import { GESTURE_CATALOG, gestureByName } from '@/lib/gesture-lab/gesture-catalog';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import type { LabSettings } from '@/lib/gesture-lab/settings';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { saveRecordingAction } from './actions';
import { LIVE_MESSAGES } from './lab-messages';
import { OutcomeView } from './outcome-view';
import { ScreenHeader } from './screen-header';
import { useLabAction } from './use-lab-action';

const COUNTDOWN = 3;
const RECORD_MS = 4_000;
const NO_FRAMES = 'Nessun fotogramma registrato: la fotocamera era accesa e la mano in vista?';

type Choice = GestureName | 'new';
type Step =
  | { n: 1 }
  | { n: 2 }
  // count 0 = registrazione in corso
  | { n: 3; count: number }
  | { n: 4; clip: Recording; saved: boolean };

const TITLES = {
  1: 'Quale gesto registri?',
  2: 'Mettiti in posizione',
  3: 'Registrazione',
  4: 'Esito',
} as const;

type Props = {
  live: LiveStatus;
  hand: Hand | null;
  settings: LabSettings;
  // Mano e palco: restano montati e si mostrano dal passo 2 (il <video> non deve smontarsi).
  scene: ReactNode;
  capture: (ms: number) => Promise<Frame[]>;
  onStartCamera: () => void;
  onRecorded: (clip: Recording) => void;
  onReview: () => void;
  onSaved: (summary: RecordingSummary) => void;
  onScene: (visible: boolean) => void;
  onAdvanced: () => void;
  onExit: () => void;
};

export function RecordWizard({
  live,
  hand,
  settings,
  scene,
  capture,
  onStartCamera,
  onRecorded,
  onReview,
  onSaved,
  onScene,
  onAdvanced,
  onExit,
}: Props) {
  const [step, setStep] = useState<Step>({ n: 1 });
  const [choice, setChoice] = useState<Choice | null>(null);
  const [newName, setNewName] = useState('');
  const [note, setNote] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, message, setMessage, run } = useLabAction();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cambia a ogni «Annulla» e allo smontaggio: un conto o una cattura vecchi si ignorano.
  const attempt = useRef(0);

  const sceneVisible = step.n >= 2;
  useEffect(() => {
    onScene(sceneVisible);
    return () => onScene(false);
  }, [sceneVisible, onScene]);

  useEffect(
    () => () => {
      attempt.current += 1;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const outcome = useMemo(
    () =>
      step.n === 4
        ? recordingOutcome(step.clip.expect, evaluateRecording(step.clip, settings))
        : null,
    [step, settings],
  );

  const known = choice && choice !== 'new' ? gestureByName(choice) : null;

  // La fotocamera parte su un'azione di chi usa la pagina, mai da sola in un ciclo: se il
  // riconoscimento non c'è, ritentare non serve.
  function toPosition() {
    setStep({ n: 2 });
    if (live === 'off' || live === 'no_camera') onStartCamera();
  }

  function choose(next: Choice) {
    setChoice(next);
    if (next !== 'new') toPosition();
  }

  async function record(id: number) {
    setStep({ n: 3, count: 0 });
    setCapturing(true);
    let frames: Frame[];
    try {
      frames = await capture(RECORD_MS);
    } catch {
      frames = [];
    }
    setCapturing(false);
    if (attempt.current !== id) return;
    if (frames.length === 0) {
      toPosition();
      setNotice(NO_FRAMES);
      return;
    }
    const expect = known ? known.event : null;
    const clip: Recording = {
      expect,
      armed: expect !== 'GESTURES_TOGGLE',
      frames,
      label: known ? known.label : newName.trim(),
    };
    setMessage(null);
    setStep({ n: 4, clip, saved: false });
    onRecorded(clip);
  }

  function start() {
    setNotice(null);
    const id = ++attempt.current;
    const tick = (n: number) => {
      if (attempt.current !== id) return;
      if (n === 0) {
        void record(id);
        return;
      }
      setStep({ n: 3, count: n });
      timer.current = setTimeout(() => tick(n - 1), 1_000);
    };
    tick(COUNTDOWN);
  }

  function cancel() {
    attempt.current += 1;
    if (timer.current) clearTimeout(timer.current);
    toPosition();
  }

  async function save(clip: Recording) {
    const result = await run(() =>
      saveRecordingAction({
        label: clip.label ?? '',
        expect: clip.expect,
        description: note.trim(),
        armed: clip.armed,
        frames: clip.frames,
      }),
    );
    if (!result?.ok) return;
    onSaved(result.value);
    setStep({ n: 4, clip, saved: true });
  }

  function again() {
    setChoice(null);
    setNewName('');
    setNote('');
    setMessage(null);
    setStep({ n: 1 });
  }

  function back() {
    if (step.n === 1) onExit();
    else if (step.n === 2) setStep({ n: 1 });
    else if (step.n === 3) cancel();
    else toPosition();
  }

  const liveMessage = LIVE_MESSAGES[live];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader
        title={TITLES[step.n]}
        onBack={back}
        onAdvanced={step.n === 2 ? onAdvanced : undefined}
      />
      <div hidden={!sceneVisible} className="flex min-h-0 flex-1 flex-col">
        {scene}
      </div>

      {step.n === 1 && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GESTURE_CATALOG.map((g) => (
              <li key={g.name}>
                <Button
                  aria-label={g.label}
                  onClick={() => choose(g.name)}
                  className="w-full justify-start"
                >
                  {`${g.icon} ${g.label}`}
                </Button>
              </li>
            ))}
            <li>
              <Button
                aria-label="Gesto nuovo"
                onClick={() => choose('new')}
                className="w-full justify-start"
              >
                ＋ Gesto nuovo
              </Button>
            </li>
          </ul>
          {choice === 'new' && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm">
                Come lo chiami?
                <input
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="min-h-11 rounded-tile border border-line bg-stage px-3"
                />
              </label>
              <Button variant="accent" disabled={newName.trim() === ''} onClick={toPosition}>
                Avanti
              </Button>
            </div>
          )}
        </div>
      )}

      {step.n === 2 && (
        <div className="flex shrink-0 flex-col gap-2">
          <p aria-live="polite" className={hand ? 'font-semibold text-accent' : 'text-muted'}>
            {hand ? '✓ mano vista' : 'Mostra la mano alla fotocamera'}
          </p>
          {known && <p className="text-sm">{`Come si fa: ${known.howTo}`}</p>}
          {liveMessage && <p className="text-xs text-muted">{liveMessage}</p>}
          {notice && <p className="text-sm text-danger">{notice}</p>}
          <Button variant="accent" disabled={live !== 'on' || capturing} onClick={start}>
            Inizia
          </Button>
        </div>
      )}

      {step.n === 3 && (
        <div className="flex shrink-0 flex-col items-center gap-2">
          {step.count > 0 ? (
            <p aria-live="polite" className="text-6xl font-extrabold tabular-nums">
              {step.count}
            </p>
          ) : (
            <>
              <p aria-live="polite" className="font-semibold">
                Registrazione…
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  ref={(el) => {
                    el?.animate?.([{ width: '0%' }, { width: '100%' }], {
                      duration: RECORD_MS,
                      fill: 'forwards',
                    });
                  }}
                  className="h-full w-0 bg-accent"
                />
              </div>
            </>
          )}
          <Button onClick={cancel}>Annulla</Button>
        </div>
      )}

      {step.n === 4 && (
        <div className="flex shrink-0 flex-col gap-2">
          {outcome && <OutcomeView outcome={outcome} />}
          {step.saved ? (
            <>
              <p className="font-semibold">Salvato</p>
              <Button variant="accent" onClick={again}>
                Registra un altro
              </Button>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                Nota (facoltativa)
                <textarea
                  maxLength={500}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="rounded-tile border border-line bg-stage px-3 py-2"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" disabled={busy} onClick={() => void save(step.clip)}>
                  Salva nell&apos;archivio
                </Button>
                <Button onClick={onReview}>▶ Rivedi</Button>
                <Button onClick={toPosition}>↺ Rifai</Button>
                {message && (
                  <Button
                    onClick={() =>
                      downloadRecording(
                        { ...step.clip, description: note.trim() },
                        step.clip.expect,
                        step.clip.label,
                      )
                    }
                  >
                    Scarica JSON
                  </Button>
                )}
              </div>
              {message && <p className="text-sm text-danger">{message}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
