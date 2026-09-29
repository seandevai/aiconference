// Picture-in-Picture: API standard (Chrome, Safari recente) o modalità WebKit (iOS).
export type PipDocLike = { pictureInPictureEnabled?: boolean };
export type PipVideoLike = {
  readyState?: number;
  addEventListener?: (type: 'loadedmetadata', listener: () => void) => void;
  removeEventListener?: (type: 'loadedmetadata', listener: () => void) => void;
  requestPictureInPicture?: () => Promise<unknown>;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
};
export type PipMode = 'standard' | 'webkit' | null;

export function pipMode(doc: PipDocLike, video: PipVideoLike): PipMode {
  if (doc.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
    return 'standard';
  }
  if (video.webkitSupportsPresentationMode?.('picture-in-picture')) return 'webkit';
  return null;
}

// WebKit (iPhone) dice se il PiP è possibile solo quando il video ha già un media player:
// appena entrati in call il video è vuoto e la risposta è «no». Si richiede ai metadati.
export function watchPipSupport(
  doc: PipDocLike,
  video: PipVideoLike,
  onChange: (supported: boolean) => void,
): () => void {
  const check = () => onChange(pipMode(doc, video) !== null);
  check();
  video.addEventListener?.('loadedmetadata', check);
  return () => video.removeEventListener?.('loadedmetadata', check);
}

const HAVE_METADATA = 1;
const METADATA_WAIT_MS = 3_000;

// Il browser rifiuta il PiP di un video senza metadati: appena entrati in call il video
// può non averli ancora. Si aspetta poco, dentro la finestra di attivazione del clic.
function metadataReady(video: PipVideoLike): Promise<void> {
  if (video.readyState === undefined || video.readyState >= HAVE_METADATA) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener?.('loadedmetadata', done);
      resolve();
    };
    const timer = setTimeout(done, METADATA_WAIT_MS);
    video.addEventListener?.('loadedmetadata', done);
  });
}

export async function openPip(doc: PipDocLike, video: PipVideoLike): Promise<boolean> {
  const mode = pipMode(doc, video);
  if (mode === 'standard') {
    await metadataReady(video);
    await video.requestPictureInPicture!();
    return true;
  }
  if (mode === 'webkit') {
    video.webkitSetPresentationMode!('picture-in-picture');
    return true;
  }
  return false;
}
