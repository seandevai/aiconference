import { describe, expect, it, vi } from 'vitest';
import { openPip, pipMode, watchPipSupport } from '@/lib/call/pip';

describe('pipMode', () => {
  it('uses the standard API when the document allows it', () => {
    const video = { requestPictureInPicture: vi.fn() };
    expect(pipMode({ pictureInPictureEnabled: true }, video)).toBe('standard');
  });

  it('falls back to the WebKit presentation mode', () => {
    const video = {
      webkitSupportsPresentationMode: (mode: string) => mode === 'picture-in-picture',
      webkitSetPresentationMode: vi.fn(),
    };
    expect(pipMode({ pictureInPictureEnabled: false }, video)).toBe('webkit');
  });

  it('reports no support', () => {
    expect(pipMode({}, {})).toBeNull();
  });
});

describe('openPip', () => {
  it('opens with the standard API', async () => {
    const video = { requestPictureInPicture: vi.fn().mockResolvedValue({}) };
    await expect(openPip({ pictureInPictureEnabled: true }, video)).resolves.toBe(true);
    expect(video.requestPictureInPicture).toHaveBeenCalledOnce();
  });

  it('opens with WebKit', async () => {
    const video = {
      webkitSupportsPresentationMode: () => true,
      webkitSetPresentationMode: vi.fn(),
    };
    await expect(openPip({}, video)).resolves.toBe(true);
    expect(video.webkitSetPresentationMode).toHaveBeenCalledWith('picture-in-picture');
  });

  it('waits for the video metadata before asking, as the browser requires', async () => {
    const listeners: Record<string, () => void> = {};
    const video = {
      readyState: 0,
      requestPictureInPicture: vi.fn().mockResolvedValue({}),
      addEventListener: (type: string, listener: () => void) => {
        listeners[type] = listener;
      },
      removeEventListener: vi.fn(),
    };
    const opening = openPip({ pictureInPictureEnabled: true }, video);
    await Promise.resolve();
    expect(video.requestPictureInPicture).not.toHaveBeenCalled();
    video.readyState = 1;
    listeners.loadedmetadata?.();
    await expect(opening).resolves.toBe(true);
    expect(video.requestPictureInPicture).toHaveBeenCalledOnce();
  });

  it('does nothing without support', async () => {
    await expect(openPip({}, {})).resolves.toBe(false);
  });
});

describe('watchPipSupport', () => {
  it('checks again once the video has media, as WebKit answers only then', () => {
    const listeners: Record<string, () => void> = {};
    let hasPlayer = false;
    const video = {
      webkitSupportsPresentationMode: (mode: string) => hasPlayer && mode === 'picture-in-picture',
      addEventListener: (type: string, listener: () => void) => {
        listeners[type] = listener;
      },
      removeEventListener: vi.fn(),
    };
    const onChange = vi.fn();
    const stop = watchPipSupport({}, video, onChange);
    expect(onChange).toHaveBeenLastCalledWith(false);
    hasPlayer = true;
    listeners.loadedmetadata?.();
    expect(onChange).toHaveBeenLastCalledWith(true);
    stop();
    expect(video.removeEventListener).toHaveBeenCalledWith('loadedmetadata', listeners.loadedmetadata);
  });
});
