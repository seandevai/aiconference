// Picture-in-Picture: API standard (Chrome, Safari recente) o modalità WebKit (iOS).
export type PipDocLike = { pictureInPictureEnabled?: boolean };
export type PipVideoLike = {
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

export async function openPip(doc: PipDocLike, video: PipVideoLike): Promise<boolean> {
  const mode = pipMode(doc, video);
  if (mode === 'standard') {
    await video.requestPictureInPicture!();
    return true;
  }
  if (mode === 'webkit') {
    video.webkitSetPresentationMode!('picture-in-picture');
    return true;
  }
  return false;
}
