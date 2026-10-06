'use client';

import { useState } from 'react';
import { Button } from '@omnicanvas/ui';
import type { PresetSummary } from '@/lib/gesture-lab/lab-store';

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
      <h2 className="text-sm font-semibold text-muted">Preset</h2>
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
