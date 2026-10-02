'use client';

import { useEffect, type RefObject } from 'react';
import { openPip } from '@/lib/call/pip';
import { startAvatarStream } from '@/lib/call/pip-avatar';

type Props = {
  identity: string | null;
  name: string;
  camOn: boolean;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
};

// Video dedicato al PiP: renderizzato ma invisibile (display:none impedirebbe il PiP).
export function PipVideo({ identity, name, camOn, attachVideo, videoRef }: Props) {
  useEffect(() => {
    const video = videoRef.current;
    if (!identity || !video) return;
    if (camOn) return attachVideo(identity, video);
    // Camera spenta: iniziale e nome al posto del video, così il PiP resta disponibile.
    const avatar = startAvatarStream(document.createElement('canvas'), name);
    if (!avatar) return;
    video.srcObject = avatar.stream as MediaStream;
    void video.play().catch(() => {});
    return () => {
      avatar.stop();
      if (video.srcObject === avatar.stream) video.srcObject = null;
    };
  }, [attachVideo, identity, name, camOn, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // iOS Safari: entra da solo in PiP quando l'app va in background.
    video.setAttribute('autopictureinpicture', '');
    // Chrome Android: le app di videochiamata possono entrare in PiP uscendo dall'app.
    const action = 'enterpictureinpicture' as MediaSessionAction;
    try {
      navigator.mediaSession?.setActionHandler(action, () => {
        // Il browser può rifiutare (gesto mancante, permessi): resta il pulsante.
        void openPip(document, video).catch(() => {});
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
