'use client';

import { useEffect, useRef } from 'react';
import type { RosterEntry } from '@omnicanvas/realtime';
import { Button, faceInitial } from '@omnicanvas/ui';

type Props = {
  entry: RosterEntry;
  local: RosterEntry | undefined;
  mirrorSelf: boolean;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  onClose: () => void;
};

// Una persona a tutto schermo dentro l'app: i controlli della call restano sotto.
export function SpotlightView({ entry, local, mirrorSelf, attachVideo, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Il focus va su ✕ all'apertura e torna alla tessera alla chiusura.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    if (!entry.camOn || !videoRef.current) return;
    return attachVideo(entry.identity, videoRef.current);
  }, [attachVideo, entry.identity, entry.camOn]);

  useEffect(() => {
    if (!local?.camOn || !selfRef.current) return;
    return attachVideo(local.identity, selfRef.current);
  }, [attachVideo, local?.identity, local?.camOn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      // Non modale: i controlli della call, fuori dal dialog, restano usabili.
      role="dialog"
      aria-label={`${entry.name} a tutto schermo`}
      className="absolute inset-0 z-20 bg-stage"
    >
      {entry.camOn ? (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      ) : (
        <span
          className="flex h-full items-center justify-center text-6xl font-extrabold"
          aria-hidden
        >
          {faceInitial(entry.name)}
        </span>
      )}
      <span className="absolute bottom-3 left-3 rounded-full bg-bg/80 px-3 py-1 text-sm font-semibold">
        {entry.name}
      </span>
      {local?.camOn && (
        <video
          ref={selfRef}
          autoPlay
          playsInline
          muted
          aria-hidden
          className={`absolute right-3 top-3 w-24 rounded-tile object-cover phone-landscape:w-32 ${
            mirrorSelf ? '-scale-x-100' : ''
          }`}
        />
      )}
      <Button
        ref={closeRef}
        onClick={onClose}
        aria-label="Chiudi tutto schermo"
        className="absolute left-3 top-3 bg-bg/80 text-lg"
      >
        ✕
      </Button>
    </div>
  );
}
