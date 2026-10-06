'use client';

import { useState } from 'react';
import { Button } from '@omnicanvas/ui';
import { parseRecording, type Recording } from '@/lib/gesture-lab/recording';

type Props = {
  recording: Recording | null;
  playing: boolean;
  fired: string[];
  onLoad: (recording: Recording) => void;
  onPlay: () => void;
  onPause: () => void;
};

export function ReplayPanel({ recording, playing, fired, onLoad, onPlay, onPause }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseRecording(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid recording');
      setError(null);
      onLoad(parsed);
    } catch {
      setError('Questo file non è una registrazione del registratore di gesture.');
    }
  }

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <h2 className="text-sm font-semibold text-muted">Rigioco</h2>
      <label className="flex flex-col gap-1 text-xs">
        Registrazione da rigiocare
        <input
          type="file"
          accept="application/json"
          aria-label="Registrazione da rigiocare"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      {recording && (
        <>
          {recording.label && <p className="text-xs font-semibold">{recording.label}</p>}
          <p className="text-xs">
            {recording.expect
              ? `Atteso: ${recording.expect}`
              : 'Atteso: gesture nuova, nessun confronto'}
          </p>
          <p className="text-xs">{`Scattati: ${fired.length > 0 ? fired.join(', ') : 'nessuno'}`}</p>
          {playing ? (
            <Button size="sm" onClick={onPause}>
              Pausa
            </Button>
          ) : (
            <Button size="sm" onClick={onPlay}>
              Rigioca
            </Button>
          )}
        </>
      )}
    </section>
  );
}
