'use client';

import { Button } from '@omnicanvas/ui';
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
    <div
      className={`flex flex-col gap-1.5 rounded-tile border p-2 text-xs motion-safe:transition-colors ${
        armed ? 'border-accent' : 'border-line'
      }`}
    >
      <Button size="sm" onClick={onToggle} aria-pressed={armed} variant={armed ? 'accent' : 'pill'}>
        {armed ? '✋ Metti in pausa le gesture' : '✋ Attiva le gesture'}
      </Button>
      {message && <span className="text-muted">{message}</span>}
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
            cursor.grabbing ? 'h-8 w-8 border-accent bg-accent/30' : 'h-5 w-5 border-fg'
          }`}
        />
      )}
    </div>
  );
}
