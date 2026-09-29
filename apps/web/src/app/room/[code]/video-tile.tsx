'use client';

import { useEffect, useRef } from 'react';
import type { RosterEntry } from '@omnicanvas/realtime';
import { FaceTile } from '@omnicanvas/ui';
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

  const face = (
    <FaceTile
      name={entry.name}
      speaking={entry.speaking}
      micOn={entry.micOn}
      className="h-full w-full"
    >
      {entry.camOn ? (
        // Sempre muto: l'audio remoto suona dagli elementi gestiti da packages/realtime.
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
        />
      ) : undefined}
    </FaceTile>
  );

  return (
    <li
      aria-label={tileLabel(entry)}
      title={entry.name}
      className="h-10 w-14 shrink-0 lg:h-12 lg:w-16 phone-landscape:aspect-video phone-landscape:h-auto phone-landscape:w-full"
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Mostra ${entry.name} a tutto schermo`}
          className="block h-full w-full rounded-tile focus-visible:outline-2 focus-visible:outline-accent"
        >
          {face}
        </button>
      ) : (
        face
      )}
    </li>
  );
}
