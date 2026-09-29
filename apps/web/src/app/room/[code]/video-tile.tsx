'use client';

import { useEffect, useRef } from 'react';
import type { RosterEntry } from '@omnicanvas/realtime';
import { tileLabel } from '@/lib/call/labels';

type Props = {
  entry: RosterEntry;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  onSelect?: (() => void) | undefined;
  mirrored?: boolean;
};

export function VideoTile({ entry, attachVideo, onSelect, mirrored = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!entry.camOn || !videoRef.current) return;
    return attachVideo(entry.identity, videoRef.current);
  }, [attachVideo, entry.identity, entry.camOn]);

  const face = entry.camOn ? (
    // Sempre muto: l'audio remoto suona dagli elementi gestiti da packages/realtime.
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
    />
  ) : (
    <span className="flex h-full items-center justify-center text-sm font-medium" aria-hidden>
      {entry.name.slice(0, 1).toUpperCase()}
    </span>
  );

  return (
    <li
      aria-label={tileLabel(entry)}
      className={`relative aspect-[3/4] overflow-hidden rounded bg-neutral-800 phone-landscape:aspect-video lg:aspect-video ${
        entry.speaking ? 'ring-2 ring-emerald-400' : ''
      }`}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Mostra ${entry.name} a tutto schermo`}
          className="block h-full w-full"
        >
          {face}
        </button>
      ) : (
        face
      )}
      <span
        className="absolute inset-x-0 bottom-0 hidden truncate bg-black/50 px-1 text-[10px] lg:block"
        aria-hidden
      >
        {entry.name}
        {entry.micOn ? '' : ' · muto'}
      </span>
    </li>
  );
}
