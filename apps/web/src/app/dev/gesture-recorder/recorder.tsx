'use client';

import { useRef, useState } from 'react';
import type { Frame, GestureEvent } from '@omnicanvas/gesture';

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

export function Recorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [expected, setExpected] = useState<GestureEvent['type']>('FOCUS_NEXT');
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seen, setSeen] = useState<string[]>([]);
  const [download, setDownload] = useState<string | null>(null);

  async function record() {
    setState('recording');
    setSeen([]);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();
    const frames: Frame[] = [];
    const armed = expected !== 'GESTURES_TOGGLE';
    const { startGestures } = await import('@omnicanvas/gesture/runner');
    const runner = await startGestures(video, {
      armed,
      onFrame: (frame) => frames.push(frame),
      onEvent: (event) => setSeen((current) => [...current, event.type]),
    });
    setTimeout(() => {
      runner.stop();
      stream.getTracks().forEach((track) => track.stop());
      const t0 = frames[0]?.t ?? 0;
      const json = JSON.stringify({
        expect: expected,
        armed,
        frames: frames.map((f) => ({ ...f, t: f.t - t0 })),
      });
      setDownload(URL.createObjectURL(new Blob([json], { type: 'application/json' })));
      setState('done');
    }, 4_000);
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-xl font-semibold">Registratore di gesture</h1>
      <p className="text-sm text-neutral-400">
        4 secondi di landmark, niente immagini. Il file va in tests/fixtures/gestures/.
      </p>
      <label className="flex w-fit flex-col gap-1 text-sm">
        Evento atteso
        <select
          value={expected}
          onChange={(e) => setExpected(e.target.value as GestureEvent['type'])}
          className="rounded bg-neutral-900 px-2 py-1"
        >
          {EVENTS.map((event) => (
            <option key={event}>{event}</option>
          ))}
        </select>
      </label>
      <button
        onClick={() => void record()}
        disabled={state === 'recording'}
        className="w-fit rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-40"
      >
        {state === 'recording' ? 'Registro…' : 'Registra 4 secondi'}
      </button>
      <video ref={videoRef} muted playsInline className="w-80 -scale-x-100 rounded" />
      {seen.length > 0 && <p className="text-sm">Eventi riconosciuti: {seen.join(', ')}</p>}
      {download && (
        <a href={download} download={`${expected}-registrazione.json`} className="w-fit underline">
          Scarica la registrazione
        </a>
      )}
    </main>
  );
}
