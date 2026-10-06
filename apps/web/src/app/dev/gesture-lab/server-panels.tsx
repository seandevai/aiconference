'use client';

import { useState } from 'react';
import type { Frame } from '@omnicanvas/gesture';
import type { LabArchive, LabResult, PresetSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import type { LabSettings } from '@/lib/gesture-lab/settings';
import {
  deletePresetAction,
  deleteRecordingAction,
  getRecordingAction,
  savePresetAction,
  saveRecordingAction,
} from './actions';
import { ArchivePanel } from './archive-panel';
import { LAB_MESSAGES, UNEXPECTED_MESSAGE } from './lab-messages';
import { PresetPanel } from './preset-panel';
import { RecordPanel } from './record-panel';

type Props = {
  archive: LabArchive;
  live: boolean;
  capture: (ms: number) => Promise<Frame[]>;
  onLoad: (recording: Recording) => void;
  settings: LabSettings;
  onApplySettings: (settings: LabSettings) => void;
};

// Pannelli che parlano col server: esistono solo per un admin del laboratorio.
export function ServerPanels({ archive, live, capture, onLoad, settings, onApplySettings }: Props) {
  const [recordings, setRecordings] = useState(archive.recordings);
  const [presets, setPresets] = useState(archive.presets);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Esegue un'azione col lab occupato; se lancia, mostra l'errore e sblocca i pulsanti.
  async function run<T>(action: () => Promise<LabResult<T>>): Promise<LabResult<T> | null> {
    setBusy(true);
    try {
      return await action();
    } catch {
      setMessage(UNEXPECTED_MESSAGE);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    const result = await run(() => getRecordingAction(id));
    if (!result) return;
    if (result.ok) {
      setMessage(null);
      onLoad(result.value);
      return;
    }
    setMessage(LAB_MESSAGES[result.error]);
    if (result.error === 'not_found') setRecordings((list) => list.filter((r) => r.id !== id));
  }

  async function remove(
    question: string,
    action: () => Promise<LabResult<null>>,
    drop: () => void,
  ) {
    if (!window.confirm(question)) return;
    const result = await run(action);
    if (!result) return;
    if (result.ok || result.error === 'not_found') drop();
    setMessage(result.ok ? null : LAB_MESSAGES[result.error]);
  }

  const removeRecording = (id: string) =>
    remove(
      'Eliminare questa registrazione?',
      () => deleteRecordingAction(id),
      () => setRecordings((list) => list.filter((r) => r.id !== id)),
    );

  const removePreset = (id: string) =>
    remove(
      'Eliminare questo preset?',
      () => deletePresetAction(id),
      () => setPresets((list) => list.filter((p) => p.id !== id)),
    );

  async function savePreset(name: string) {
    const result = await run(() => savePresetAction({ name, settings }));
    if (!result) return false;
    if (!result.ok) {
      setMessage(LAB_MESSAGES[result.error]);
      return false;
    }
    setMessage(null);
    setPresets((list) => [result.value, ...list]);
    return true;
  }

  return (
    <>
      <RecordPanel
        live={live}
        capture={capture}
        onRecorded={onLoad}
        onSave={async (input) => {
          const result = await saveRecordingAction(input);
          if (result.ok) setRecordings((list) => [result.value, ...list]);
          return result;
        }}
      />
      <ArchivePanel
        userId={archive.userId}
        recordings={recordings}
        busy={busy}
        onOpen={(id) => void open(id)}
        onDelete={(id) => void removeRecording(id)}
      />
      <PresetPanel
        userId={archive.userId}
        presets={presets}
        busy={busy}
        onSave={savePreset}
        onApply={(preset: PresetSummary) => onApplySettings(preset.settings)}
        onDelete={(id) => void removePreset(id)}
      />
      {message && <p className="text-xs text-danger">{message}</p>}
    </>
  );
}
