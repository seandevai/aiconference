'use client';

import { useState } from 'react';
import { Button } from '@omnicanvas/ui';
import type { PresetSummary } from '@/lib/gesture-lab/lab-store';
import type { LabSettings } from '@/lib/gesture-lab/settings';
import { deletePresetAction, savePresetAction } from './actions';
import { useLabAction } from './use-lab-action';

type Props = {
  userId: string;
  presets: PresetSummary[];
  busy: boolean;
  onSave: (name: string) => Promise<boolean>;
  onApply: (preset: PresetSummary) => void;
  onDelete: (id: string) => void;
};

export function PresetPanel({ userId, presets, busy, onSave, onApply, onDelete }: Props) {
  const [name, setName] = useState('');

  async function save() {
    if (await onSave(name)) setName('');
  }

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <div className="flex gap-2">
        <input
          aria-label="Nome del preset"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-tile border border-line bg-stage px-2 py-1 text-xs"
        />
        <Button size="sm" disabled={busy || name.trim() === ''} onClick={() => void save()}>
          Salva taratura
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {presets.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className="flex-1">{`${p.name} · ${p.authorName}`}</span>
            <Button size="sm" aria-label={`Applica ${p.name}`} onClick={() => onApply(p)}>
              Applica
            </Button>
            {p.authorId === userId && (
              <Button size="sm" disabled={busy} onClick={() => onDelete(p.id)}>
                Elimina
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

type SectionProps = {
  userId: string;
  presets: PresetSummary[];
  onPresetsChange: (next: PresetSummary[]) => void;
  settings: LabSettings;
  onApply: (settings: LabSettings) => void;
};

// La sezione Preset di Avanzate: l'elenco lo tiene il Lab, così resta chiudendo il pannello.
export function PresetSection({
  userId,
  presets,
  onPresetsChange,
  settings,
  onApply,
}: SectionProps) {
  const { busy, message, run } = useLabAction();

  async function save(name: string) {
    const result = await run(() => savePresetAction({ name, settings }));
    if (!result?.ok) return false;
    onPresetsChange([result.value, ...presets]);
    return true;
  }

  async function remove(id: string) {
    if (!window.confirm('Eliminare questo preset?')) return;
    const result = await run(() => deletePresetAction(id));
    if (result && (result.ok || result.error === 'not_found'))
      onPresetsChange(presets.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="text-xs text-danger">{message}</p>}
      <PresetPanel
        userId={userId}
        presets={presets}
        busy={busy}
        onSave={save}
        onApply={(preset) => onApply(preset.settings)}
        onDelete={(id) => void remove(id)}
      />
    </div>
  );
}
