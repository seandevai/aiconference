'use client';

import { useState } from 'react';
import type { Frame } from '@omnicanvas/gesture';
import type { LabArchive, PresetSummary } from '@/lib/gesture-lab/lab-store';
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
import { LAB_MESSAGES } from './lab-messages';
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

  async function open(id: string) {
    setBusy(true);
    const result = await getRecordingAction(id);
    setBusy(false);
    if (result.ok) {
      setMessage(null);
      onLoad(result.value);
      return;
    }
    setMessage(LAB_MESSAGES[result.error]);
    if (result.error === 'not_found') setRecordings((list) => list.filter((r) => r.id !== id));
  }

  async function removeRecording(id: string) {
    if (!window.confirm('Eliminare questa registrazione?')) return;
    setBusy(true);
    const result = await deleteRecordingAction(id);
    setBusy(false);
    if (result.ok || result.error === 'not_found')
      setRecordings((list) => list.filter((r) => r.id !== id));
    setMessage(result.ok ? null : LAB_MESSAGES[result.error]);
  }

  async function savePreset(name: string) {
    setBusy(true);
    const result = await savePresetAction({ name, settings });
    setBusy(false);
    if (!result.ok) {
      setMessage(LAB_MESSAGES[result.error]);
      return false;
    }
    setMessage(null);
    setPresets((list) => [result.value, ...list]);
    return true;
  }

  async function removePreset(id: string) {
    if (!window.confirm('Eliminare questo preset?')) return;
    setBusy(true);
    const result = await deletePresetAction(id);
    setBusy(false);
    if (result.ok || result.error === 'not_found')
      setPresets((list) => list.filter((p) => p.id !== id));
    setMessage(result.ok ? null : LAB_MESSAGES[result.error]);
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
