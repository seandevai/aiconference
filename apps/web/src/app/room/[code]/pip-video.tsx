'use client';

import { useEffect, type RefObject } from 'react';
import { openPip } from '@/lib/call/pip';

type Props = {
  identity: string | null;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
};

// Video dedicato al PiP: renderizzato ma invisibile (display:none impedirebbe il PiP).
export function PipVideo({ identity, attachVideo, videoRef }: Props) {
  useEffect(() => {
    const video = videoRef.current;
    if (!identity || !video) return;
    return attachVideo(identity, video);
  }, [attachVideo, identity, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // iOS Safari: entra da solo in PiP quando l'app va in background.
    video.setAttribute('autopictureinpicture', '');
    // Chrome Android: le app di videochiamata possono entrare in PiP uscendo dall'app.
    const action = 'enterpictureinpicture' as MediaSessionAction;
    try {
      navigator.mediaSession?.setActionHandler(action, () => {
        void openPip(document, video);
      });
    } catch {
      // Azione non supportata: resta il pulsante «Riquadro».
    }
    return () => {
      try {
        navigator.mediaSession?.setActionHandler(action, null);
      } catch {
        // idem
      }
    };
  }, [videoRef]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      aria-hidden
      className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
    />
  );
}
