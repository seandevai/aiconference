'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@omnicanvas/ui';
import type { Frame, GestureEvent } from '@omnicanvas/gesture';
import type { LabResult, RecordingSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import type { RecordingInput } from '@/lib/gesture-lab/recording-schema';
import { LAB_MESSAGES } from './lab-messages';

const COUNTDOWN = 3;
const RECORD_MS = 4_000;
const EVENTS: GestureEvent['type'][] = [
  'GESTURES_TOGGLE',
  'AGENT_ACTIVATE',
  'CONFIRM',
  'REJECT',
  'GRAB',
  'FOCUS_NEXT',
  'FOCUS_PREV',
  'WINDOW_ARCHIVE',
  'WINDOW_CREATE',
];

type Phase =
  | { kind: 'idle' }
  | { kind: 'countdown'; n: number }
  | { kind: 'recording' }
  | { kind: 'done'; clip: Recording };

type Props = {
  live: boolean;
  capture: (ms: number) => Promise<Frame[]>;
  onRecorded: (clip: Recording) => void;
  onSave: (input: RecordingInput) => Promise<LabResult<RecordingSummary>>;
};

export function RecordPanel({ live, capture, onRecorded, onSave }: Props) {
  const [label, setLabel] = useState('');
  const [expect, setExpect] = useState<GestureEvent['type'] | ''>('');
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const busy = phase.kind === 'countdown' || phase.kind === 'recording';

  async function record() {
    setPhase({ kind: 'recording' });
    let frames: Frame[];
    try {
      frames = await capture(RECORD_MS);
    } catch {
      frames = [];
    }
    if (frames.length === 0) {
      setPhase({ kind: 'idle' });
      setMessage('Nessun fotogramma registrato: la webcam era accesa e la mano in vista?');
      return;
    }
    const clip: Recording = {
      expect: expect || null,
      armed: expect !== 'GESTURES_TOGGLE',
      frames,
      label: label.trim(),
    };
    setPhase({ kind: 'done', clip });
    onRecorded(clip);
  }

  function start() {
    setMessage(null);
    const tick = (n: number) => {
      if (n === 0) {
        void record();
        return;
      }
      setPhase({ kind: 'countdown', n });
      timer.current = setTimeout(() => tick(n - 1), 1_000);
    };
    tick(COUNTDOWN);
  }

  async function save(clip: Recording) {
    // Il ref blocca il secondo click prima che lo stato «saving» arrivi al bottone.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await onSave({
        label: label.trim(),
        expect: clip.expect,
        description: description.trim(),
        armed: clip.armed,
        frames: clip.frames,
      });
      if (result.ok) {
        setPhase({ kind: 'idle' });
        setMessage('Registrazione salvata.');
      } else {
        setMessage(LAB_MESSAGES[result.error]);
      }
    } catch {
      setMessage(LAB_MESSAGES.failed);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function download(clip: Recording) {
    const json = JSON.stringify({ ...clip, description: description.trim() });
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    const slug =
      label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') || 'gesture';
    link.download = `${clip.expect ?? 'NUOVA'}-${slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <h2 className="text-sm font-semibold text-muted">Registra</h2>
      <label className="flex flex-col gap-1 text-xs">
        Nome della gesture
        <input
          aria-label="Nome della gesture"
          maxLength={60}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-tile border border-line bg-stage px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Evento atteso
        <select
          aria-label="Evento atteso"
          value={expect}
          onChange={(e) => setExpect(e.target.value as GestureEvent['type'] | '')}
          className="rounded-tile border border-line bg-stage px-2 py-1"
        >
          <option value="">Gesture nuova</option>
          {EVENTS.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Descrizione
        <textarea
          aria-label="Descrizione"
          maxLength={500}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-tile border border-line bg-stage px-2 py-1"
        />
      </label>
      <Button variant="accent" disabled={!live || label.trim() === '' || busy} onClick={start}>
        Registra
      </Button>
      {!live && <p className="text-xs text-muted">Accendi la webcam per registrare.</p>}
      {phase.kind === 'countdown' && (
        <p aria-live="polite" className="text-2xl font-extrabold">
          {phase.n}
        </p>
      )}
      {phase.kind === 'recording' && <p aria-live="polite">Registrazione in corso…</p>}
      {phase.kind === 'done' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={saving} onClick={() => void save(phase.clip)}>
            Salva
          </Button>
          <Button size="sm" onClick={() => download(phase.clip)}>
            Scarica JSON
          </Button>
          <Button size="sm" onClick={() => setPhase({ kind: 'idle' })}>
            Scarta
          </Button>
        </div>
      )}
      {message && <p className="text-xs">{message}</p>}
    </section>
  );
}
