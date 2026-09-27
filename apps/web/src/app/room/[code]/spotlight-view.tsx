'use client';

import { useEffect, useRef } from 'react';
import type { RosterEntry } from '@omnicanvas/realtime';

type Props = {
  entry: RosterEntry;
  local: RosterEntry | undefined;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  onClose: () => void;
};

// Una persona a tutto schermo dentro l'app: i controlli della call restano sotto.
export function SpotlightView({ entry, local, attachVideo, onClose }: Props) {
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
      className="absolute inset-0 z-20 bg-black"
    >
      {entry.camOn ? (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      ) : (
        <span className="flex h-full items-center justify-center text-6xl font-medium" aria-hidden>
          {entry.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-sm">
        {entry.name}
      </span>
      {local?.camOn && (
        <video
          ref={selfRef}
          autoPlay
          playsInline
          muted
          aria-hidden
          className="absolute right-2 top-2 w-24 rounded object-cover phone-landscape:w-32"
        />
      )}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Chiudi tutto schermo"
        className="absolute left-2 top-2 rounded-full bg-black/60 px-3 py-1 text-lg"
      >
        ✕
      </button>
    </div>
  );
}
