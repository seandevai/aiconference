import { describe, expect, it, vi } from 'vitest';
import { openPip, pipMode } from '@/lib/call/pip';

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

  it('does nothing without support', async () => {
    await expect(openPip({}, {})).resolves.toBe(false);
  });
});
