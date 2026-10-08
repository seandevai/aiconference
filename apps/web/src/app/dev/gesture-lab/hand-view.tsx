'use client';

import { useEffect, useRef, useState } from 'react';
import type { Frame, GestureEvent, RecognizerView } from '@omnicanvas/gesture';
import { gestureByName, gestureForEvent, gestureForHold } from '@/lib/gesture-lab/gesture-catalog';
import { drawHands } from '@/lib/gesture-lab/hand-drawing';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  framesRef: React.RefObject<{ raw: Frame; processed: Frame } | null>;
  view: RecognizerView | null;
  // L'ultimo evento scattato: il suo gesto resta scritto finché non ne scatta un altro.
  lastEvent: GestureEvent['type'] | null;
  feedback: boolean;
  // Né fotocamera né rigioco: al posto del riquadro nero si dice cosa succede.
  idle: boolean;
  // Nel rigioco non c'è video (si salvano solo i punti): lo scheletro si disegna sempre.
  replaying: boolean;
};

const RING = 2 * Math.PI * 11;

// La mano grande col nome del gesto riconosciuto. I numeri stanno in Avanzate → Diagnostica.
export function HandView({
  videoRef,
  framesRef,
  view,
  lastEvent,
  feedback,
  idle,
  replaying,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Scheletro e video condividono la proporzione dello stream (640x480 finché è ignota).
  const [size, setSize] = useState({ w: 640, h: 480 });
  const drawing = feedback || replaying;

  useEffect(() => {
    if (!drawing) {
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let frame = 0;
    const styles = getComputedStyle(document.documentElement);
    const colors = {
      raw: styles.getPropertyValue('--color-muted').trim() || 'gray',
      processed: styles.getPropertyValue('--color-accent').trim() || 'lime',
    };
    const loop = () => {
      if (canvasRef.current) drawHands(canvasRef.current, framesRef.current, colors);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [drawing, framesRef]);

  const shown = view?.dragging ? gestureByName('pinch_drag') : gestureForEvent(lastEvent);
  const holding = feedback && view?.hold ? gestureForHold(view.hold.pose) : null;
  const progress = view?.hold?.progress ?? 0;

  return (
    <section
      aria-label="La tua mano"
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
      className="relative h-full max-w-full overflow-hidden rounded-tile bg-stage"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth && videoHeight) setSize({ w: videoWidth, h: videoHeight });
        }}
        className="h-full w-full -scale-x-100 object-contain"
      />
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {idle && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
          Fotocamera spenta.
        </p>
      )}
      {replaying && (
        <p className="absolute bottom-2 left-2 rounded-full bg-surface px-3 py-1 text-xs text-muted">
          Rigioco: solo i punti della mano, nessun video
        </p>
      )}
      <div className="absolute inset-x-2 top-2 flex flex-col items-start gap-1">
        {shown && (
          <p
            aria-live="polite"
            className="rounded-full bg-surface px-3 py-1 text-lg font-extrabold"
          >
            {`${shown.icon} ${shown.label} `}
            <span className="text-sm font-semibold text-muted">{`→ ${shown.effect}`}</span>
          </p>
        )}
        {holding && (
          <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-label="Attesa del gesto">
              <circle cx="14" cy="14" r="11" fill="none" className="stroke-line" strokeWidth="3" />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                className="stroke-accent"
                strokeWidth="3"
                strokeDasharray={`${RING * progress} ${RING}`}
                transform="rotate(-90 14 14)"
              />
            </svg>
            <span className="text-base font-semibold">{holding.label}</span>
          </div>
        )}
      </div>
    </section>
  );
}
