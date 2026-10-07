'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Unsubscribe } from '@omnicanvas/realtime';

type AttachScreen = (identity: string, element: HTMLVideoElement) => Unsubscribe;

// Il palco non conosce la sessione: il context porta solo la funzione che aggancia il video.
export const ScreenAttachContext = createContext<AttachScreen | null>(null);

export function ScreenView({ owner, title }: { owner: string; title: string }) {
  const attach = useContext(ScreenAttachContext);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!attach || !video) return;
    const detach = attach(owner, video);
    // Nuovo aggancio, nuovo primo fotogramma da attendere.
    return () => {
      detach();
      setLive(false);
    };
  }, [attach, owner]);

  return (
    <figure className="relative flex flex-col gap-1">
      <video
        ref={videoRef}
        aria-label={title}
        autoPlay
        playsInline
        muted
        onLoadedData={() => setLive(true)}
        // Il flusso si svuota quando la traccia viene tolta: torna il segnaposto.
        onEmptied={() => setLive(false)}
        className="max-h-[60vh] w-full rounded-tile bg-bg object-contain"
      />
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center rounded-tile bg-bg text-sm text-muted">
          Schermo in arrivo…
        </div>
      )}
      <figcaption className="text-sm font-medium">{title}</figcaption>
    </figure>
  );
}
