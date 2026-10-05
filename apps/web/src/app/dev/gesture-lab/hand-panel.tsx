'use client';

import { useEffect, useRef } from 'react';
import {
  poseMetrics,
  type Frame,
  type Hand,
  type RecognizerView,
  type Tuning,
} from '@omnicanvas/gesture';
import { drawHands } from '@/lib/gesture-lab/hand-drawing';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  framesRef: React.RefObject<{ raw: Frame; processed: Frame } | null>;
  view: RecognizerView | null;
  hand: Hand | null;
  tuning: Tuning;
  feedback: boolean;
};

const FINGER_LABELS = {
  index: 'Indice',
  middle: 'Medio',
  ring: 'Anulare',
  pinky: 'Mignolo',
} as const;

export function HandPanel({ videoRef, framesRef, view, hand, tuning, feedback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!feedback) {
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
  }, [feedback, framesRef]);

  const metrics = hand ? poseMetrics(hand) : null;
  const progress = view?.hold?.progress ?? 0;

  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-tile bg-stage">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {feedback && view && (
          <div className="absolute left-2 top-2 flex items-center gap-2 rounded-full bg-surface px-3 py-1">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-label="Attesa del gesto">
              <circle cx="14" cy="14" r="11" fill="none" className="stroke-line" strokeWidth="3" />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                className="stroke-accent"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 11 * progress} ${2 * Math.PI * 11}`}
                transform="rotate(-90 14 14)"
              />
            </svg>
            <span className="text-base font-semibold">{view.pose}</span>
          </div>
        )}
      </div>
      {view && (
        <p className="text-xs text-muted">
          {`Posa grezza: ${view.rawPose} · stabile: ${view.pose} · ${view.armed ? 'armato' : 'in pausa'} · pausa ${Math.round(view.cooldownLeftMs)} ms`}
        </p>
      )}
      {metrics && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          {(Object.keys(FINGER_LABELS) as (keyof typeof FINGER_LABELS)[]).map((finger) => (
            <div key={finger} className="flex justify-between">
              <dt>{FINGER_LABELS[finger]}</dt>
              <dd className="tabular-nums">
                {metrics.fingers[finger].toFixed(2)}{' '}
                <span className="text-muted">{`(> ${tuning.pose.extended} esteso, < ${tuning.pose.folded} piegato)`}</span>
              </dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt>Pinch</dt>
            <dd className="tabular-nums">
              {metrics.pinch.toFixed(2)}{' '}
              <span className="text-muted">{`(< ${tuning.pose.pinchOn})`}</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Pollice</dt>
            <dd>{metrics.thumbExtended ? 'esteso' : 'chiuso'}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
