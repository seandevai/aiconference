// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Frame } from '@omnicanvas/gesture';
import { useGestureLab, type LabRefs } from '@/lib/gesture-lab/use-gesture-lab';
import type { Recording } from '@/lib/gesture-lab/recording';
import { hand } from '../fixtures/hands';

const runnerMock = vi.hoisted(() => ({
  startGestures: vi.fn(),
}));
vi.mock('@omnicanvas/gesture/runner', () => runnerMock);

const frame = (t: number): Frame => ({ t, hands: [hand('fist')] });
const recording: Recording = {
  expect: 'FOCUS_NEXT',
  armed: true,
  frames: [frame(0), frame(100), frame(200)],
};

function setup() {
  const video = document.createElement('video');
  // happy-dom rifiuta uno stream finto: srcObject diventa una proprietà semplice.
  Object.defineProperty(video, 'srcObject', { writable: true, value: null });
  const refs: LabRefs = {
    videoRef: { current: video },
    areaRef: { current: document.createElement('div') },
    framesRef: { current: null },
  };
  const hook = renderHook(() => useGestureLab(refs));
  return { ...hook, refs, video };
}

function fakeStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

beforeEach(() => {
  vi.useFakeTimers();
  runnerMock.startGestures.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useGestureLab replay', () => {
  it('resumes after pause from the next frame instead of restarting', () => {
    const { result, refs } = setup();
    act(() => result.current.loadRecording(recording));
    act(() => result.current.play());
    expect(refs.framesRef.current?.raw.t).toBe(0);
    act(() => result.current.pause());
    expect(result.current.playing).toBe(false);
    act(() => result.current.play());
    // Il fotogramma 0 non viene rigiocato: si riparte dal successivo.
    expect(refs.framesRef.current?.raw.t).toBe(100);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(refs.framesRef.current?.raw.t).toBe(200);
    expect(result.current.playing).toBe(false);
  });

  it('starts again from the top after the recording ends', () => {
    const { result, refs } = setup();
    act(() => result.current.loadRecording(recording));
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.playing).toBe(false);
    act(() => result.current.play());
    expect(refs.framesRef.current?.raw.t).toBe(0);
  });

  it('starts from the top when a new recording is loaded', () => {
    const { result, refs } = setup();
    act(() => result.current.loadRecording(recording));
    act(() => result.current.play());
    act(() => result.current.pause());
    act(() => result.current.loadRecording(recording));
    act(() => result.current.play());
    expect(refs.framesRef.current?.raw.t).toBe(0);
  });
});

describe('useGestureLab live', () => {
  it('stops the camera when the recognizer cannot start', async () => {
    const { track, stream } = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const { result, video } = setup();
    video.play = vi.fn().mockResolvedValue(undefined);
    runnerMock.startGestures.mockRejectedValue(new Error('no model'));
    await act(async () => {
      await result.current.startLive();
    });
    expect(result.current.live).toBe('unavailable');
    expect(track.stop).toHaveBeenCalled();
  });

  it('stops the camera when the video cannot play', async () => {
    const { track, stream } = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const { result, video } = setup();
    video.play = vi.fn().mockRejectedValue(new Error('blocked'));
    await act(async () => {
      await result.current.startLive();
    });
    expect(result.current.live).toBe('no_camera');
    expect(track.stop).toHaveBeenCalled();
  });

  it('releases everything when stopped while still loading', async () => {
    const { track, stream } = fakeStream();
    let release: (s: MediaStream) => void = () => {};
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(() => new Promise<MediaStream>((r) => (release = r))) },
    });
    const { result, video } = setup();
    video.play = vi.fn().mockResolvedValue(undefined);
    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = result.current.startLive();
    });
    expect(result.current.live).toBe('loading');
    act(() => result.current.stopLive());
    await act(async () => {
      release(stream);
      await started;
    });
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.live).toBe('off');
    expect(runnerMock.startGestures).not.toHaveBeenCalled();
  });

  it('stops a runner that finishes loading after the hook was unmounted', async () => {
    const { track, stream } = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const runner = { stop: vi.fn(), setArmed: vi.fn(), reconfigure: vi.fn() };
    let finish: (r: typeof runner) => void = () => {};
    runnerMock.startGestures.mockImplementation(() => new Promise((r) => (finish = r)));
    const { result, video, unmount } = setup();
    video.play = vi.fn().mockResolvedValue(undefined);
    let started: Promise<void> = Promise.resolve();
    await act(async () => {
      started = result.current.startLive();
      await vi.dynamicImportSettled();
    });
    unmount();
    await act(async () => {
      finish(runner);
      await started;
    });
    expect(runner.stop).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });
});
