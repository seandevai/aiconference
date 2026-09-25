'use client';

import { gestureStatusMessage, type GestureStatus } from '@/lib/stage/gesture-actions';

type Props = {
  status: GestureStatus;
  armed: boolean;
  cursor: { x: number; y: number; grabbing: boolean } | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggle: () => void;
};

// ✋ è il click equivalente del palmo aperto (ADR-0010). Il video resta invisibile:
// serve solo a MediaPipe, nel browser.
export function GestureControl({ status, armed, cursor, videoRef, onToggle }: Props) {
  const message = gestureStatusMessage(status, armed);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button onClick={onToggle} aria-pressed={armed} className="rounded bg-neutral-800 px-2 py-1">
        {armed ? '✋ Metti in pausa le gesture' : '✋ Attiva le gesture'}
      </button>
      {message && <span className="text-neutral-400">{message}</span>}
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      />
      {cursor && (
        <div
          aria-hidden
          style={{ left: cursor.x, top: cursor.y }}
          className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
            cursor.grabbing
              ? 'h-8 w-8 border-emerald-400 bg-emerald-400/30'
              : 'h-5 w-5 border-neutral-100'
          }`}
        />
      )}
    </div>
  );
}
