import { describe, expect, it, vi } from 'vitest';
import { avatarInitial, startAvatarStream } from '@/lib/call/pip-avatar';

describe('avatarInitial', () => {
  it('uses the first letter, upper case', () => {
    expect(avatarInitial('anna rossi')).toBe('A');
  });
  it('falls back to a question mark for an empty name', () => {
    expect(avatarInitial('  ')).toBe('?');
  });
});

describe('startAvatarStream', () => {
  function fakeCanvas() {
    const ctx = {
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    };
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      captureStream: vi.fn(() => stream),
    };
    return { canvas, ctx, track, stream };
  }

  it('draws initial and name and returns the canvas stream', () => {
    const { canvas, ctx, stream } = fakeCanvas();
    const avatar = startAvatarStream(canvas, 'Anna');
    expect(avatar?.stream).toBe(stream);
    const texts = ctx.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual(['A', 'Anna']);
    avatar?.stop();
  });

  it('keeps drawing, since a still canvas sends no frames, and stops cleanly', () => {
    vi.useFakeTimers();
    const { canvas, ctx, track } = fakeCanvas();
    const avatar = startAvatarStream(canvas, 'Anna');
    vi.advanceTimersByTime(2_000);
    expect(ctx.fillText.mock.calls.length).toBeGreaterThan(2);
    avatar?.stop();
    const drawn = ctx.fillText.mock.calls.length;
    vi.advanceTimersByTime(2_000);
    expect(ctx.fillText.mock.calls.length).toBe(drawn);
    expect(track.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('returns null where the browser cannot capture a canvas', () => {
    const { canvas } = fakeCanvas();
    expect(startAvatarStream({ ...canvas, captureStream: undefined }, 'Anna')).toBeNull();
  });
});
