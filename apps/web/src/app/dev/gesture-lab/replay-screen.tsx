'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Menu } from '@omnicanvas/ui';
import type { GestureEvent } from '@omnicanvas/gesture';
import { downloadRecording } from '@/lib/gesture-lab/download';
import { evaluateRecording, recordingOutcome } from '@/lib/gesture-lab/evaluate';
import { gestureForEvent } from '@/lib/gesture-lab/gesture-catalog';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';
import { parseRecording, type Recording } from '@/lib/gesture-lab/recording';
import type { LabSettings } from '@/lib/gesture-lab/settings';
import { deleteRecordingAction, getRecordingAction } from './actions';
import { OutcomeView } from './outcome-view';
import { ScreenHeader } from './screen-header';
import { useLabAction } from './use-lab-action';

type Props = {
  userId: string;
  recordings: RecordingSummary[];
  onRemoved: (id: string) => void;
  id: string | null;
  scene: ReactNode;
  settings: LabSettings;
  recording: Recording | null;
  playing: boolean;
  progress: number;
  onLoad: (recording: Recording) => void;
  onPlay: () => void;
  onPause: () => void;
  onOpen: (id: string) => void;
  onList: () => void;
  onExit: () => void;
  onScene: (visible: boolean) => void;
  onAdvanced: () => void;
};

// Filtro dell'elenco: l'evento atteso, oppure «new» per i gesti nuovi (expect nullo).
const NEW = 'new';
type FilterKey = GestureEvent['type'] | typeof NEW;
const filterKey = (expect: GestureEvent['type'] | null): FilterKey => expect ?? NEW;
const filterLabel = (key: FilterKey) =>
  key === NEW ? 'Gesti nuovi' : (gestureForEvent(key)?.label ?? key);

const titleOf = (r: { label?: string; expect: GestureEvent['type'] | null }) => {
  const gesture = gestureForEvent(r.expect);
  return `${gesture?.icon ?? '✳️'} ${r.label || gesture?.label || 'Gesto nuovo'}`;
};

const date = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

export function ReplayScreen({
  userId,
  recordings,
  onRemoved,
  id,
  scene,
  settings,
  recording,
  playing,
  progress,
  onLoad,
  onPlay,
  onPause,
  onOpen,
  onList,
  onExit,
  onScene,
  onAdvanced,
}: Props) {
  const { busy, message, run } = useLabAction();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  // Una registrazione aperta da file non ha id: si rigioca senza passare dall'URL.
  const [fromFile, setFromFile] = useState(false);
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const showing = recording !== null && (id !== null ? loadedId === id : fromFile);

  useEffect(() => {
    onScene(showing);
    return () => onScene(false);
  }, [showing, onScene]);

  // Aprendo un link con l'id, la registrazione arriva dal server.
  useEffect(() => {
    if (id === null || id === loadedId) return;
    let cancelled = false;
    void run(() => getRecordingAction(id)).then((result) => {
      if (cancelled || !result) return;
      if (result.ok) {
        onLoad(result.value);
        setLoadedId(id);
      } else if (result.error === 'not_found') {
        onRemoved(id);
        onList();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadedId, run, onLoad, onRemoved, onList]);

  const outcome = useMemo(
    () =>
      recording ? recordingOutcome(recording.expect, evaluateRecording(recording, settings)) : null,
    [recording, settings],
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseRecording(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid recording');
      setFileError(null);
      onLoad(parsed);
      setLoadedId(null);
      setFromFile(true);
    } catch {
      setFileError('Questo file non è una registrazione del laboratorio.');
    }
  }

  async function remove(recordingId: string) {
    if (!window.confirm('Eliminare questa registrazione?')) return;
    const result = await run(() => deleteRecordingAction(recordingId));
    if (result && (result.ok || result.error === 'not_found')) {
      onRemoved(recordingId);
      onList();
    }
  }

  function backToArchive() {
    onPause();
    if (id === null) setFromFile(false);
    else onList();
  }

  if (showing && recording && outcome) {
    const summary = id ? recordings.find((r) => r.id === id) : undefined;
    const mine = summary?.authorId === userId;
    const expected = gestureForEvent(recording.expect);
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <ScreenHeader
          title={titleOf(recording)}
          onBack={backToArchive}
          backLabel="Archivio"
          onAdvanced={onAdvanced}
        />
        <div className="flex min-h-0 flex-1 flex-col">{scene}</div>
        <div className="flex shrink-0 flex-col gap-2">
          <OutcomeView outcome={outcome} newLabel="Gesto nuovo: nessun confronto" />
          {recording.expect && (
            <p className="text-sm text-muted">{`Atteso: ${expected?.label ?? recording.expect}`}</p>
          )}
          <div
            role="progressbar"
            aria-label="Avanzamento del rigioco"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-2 w-full overflow-hidden rounded-full bg-line"
          >
            <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {playing ? (
              <Button onClick={onPause}>Pausa</Button>
            ) : (
              <Button variant="accent" onClick={onPlay}>
                Rigioca
              </Button>
            )}
            <Menu label="⋯" triggerLabel="Altre azioni">
              <Button
                variant="quiet"
                onClick={() => downloadRecording(recording, recording.expect, recording.label)}
              >
                Scarica JSON
              </Button>
              {mine && id && (
                <Button variant="quiet" disabled={busy} onClick={() => void remove(id)}>
                  Elimina
                </Button>
              )}
            </Menu>
          </div>
          {message && <p className="text-sm text-danger">{message}</p>}
        </div>
      </div>
    );
  }

  const keys = [...new Set(recordings.map((r) => filterKey(r.expect)))];
  const visible =
    filter === null ? recordings : recordings.filter((r) => filterKey(r.expect) === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader title="Rigioca" onBack={onExit} />
      {/* La scena resta montata anche qui, nascosta: il palco non riparte da capo. */}
      <div hidden className="flex min-h-0 flex-col">
        {scene}
      </div>
      {id !== null && busy && <p className="text-sm text-muted">Carico la registrazione…</p>}
      {message && <p className="text-sm text-danger">{message}</p>}
      {recordings.length === 0 ? (
        <p className="text-sm text-muted">
          Nessuna registrazione. Registrane una da «Registra un gesto».
        </p>
      ) : (
        <div role="group" aria-label="Filtra per gesto" className="flex flex-wrap gap-2">
          {[null, ...keys].map((key) => (
            <Button
              key={key ?? 'all'}
              variant={filter === key ? 'accent' : 'pill'}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {key === null ? 'Tutti' : filterLabel(key)}
            </Button>
          ))}
        </div>
      )}
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(r.id)}
              className="flex min-h-11 w-full flex-col items-start rounded-tile border border-line bg-surface px-3 py-2 text-left hover:border-accent"
            >
              <span className="font-semibold">{titleOf(r)}</span>
              <span className="text-xs text-muted">{`${r.authorName} · ${date(r.createdAt)}`}</span>
              {r.description && <span className="text-xs">{r.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      <label className="shrink-0 cursor-pointer text-sm text-muted underline">
        Carica un file JSON…
        <input
          type="file"
          accept="application/json"
          aria-label="Carica un file JSON"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>
      {fileError && <p className="text-sm text-danger">{fileError}</p>}
    </div>
  );
}
