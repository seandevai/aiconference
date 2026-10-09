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

  it('reports how far the replay has gone', () => {
    const { result } = setup();
    act(() => result.current.loadRecording(recording));
    expect(result.current.progress).toBe(0);
    act(() => result.current.play());
    expect(result.current.progress).toBe(0);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.progress).toBe(0.5);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.progress).toBe(1);
    act(() => result.current.loadRecording(recording));
    expect(result.current.progress).toBe(0);
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

  async function startWithRunner() {
    const { stream } = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const runner = { stop: vi.fn(), setArmed: vi.fn(), reconfigure: vi.fn() };
    let finish: (r: typeof runner) => void = () => {};
    runnerMock.startGestures.mockImplementation(() => new Promise((r) => (finish = r)));
    const hook = setup();
    hook.video.play = vi.fn().mockResolvedValue(undefined);
    let started: Promise<void> = Promise.resolve();
    await act(async () => {
      started = hook.result.current.startLive();
      await vi.dynamicImportSettled();
    });
    return {
      ...hook,
      runner,
      finish: (r = runner) =>
        act(async () => {
          finish(r);
          await started;
        }),
    };
  }

  it('does not reconfigure the recognizer for UI-only toggles', async () => {
    const { result, runner, finish } = await startWithRunner();
    await finish();
    runner.reconfigure.mockClear();
    act(() =>
      result.current.setSettings((s) => ({ ...s, toggles: { ...s.toggles, smoothCursor: true } })),
    );
    expect(runner.reconfigure).not.toHaveBeenCalled();
    act(() =>
      result.current.setSettings((s) => ({ ...s, toggles: { ...s.toggles, stablePoses: true } })),
    );
    expect(runner.reconfigure).toHaveBeenCalledTimes(1);
    expect(runner.reconfigure.mock.calls[0]![0].tuning.stability.frames).toBe(3);
  });

  it('applies settings changed while the webcam was loading', async () => {
    const { result, runner, finish } = await startWithRunner();
    act(() =>
      result.current.setSettings((s) => ({ ...s, toggles: { ...s.toggles, stablePoses: true } })),
    );
    await finish();
    expect(runner.reconfigure).toHaveBeenLastCalledWith(
      expect.objectContaining({ tuning: expect.objectContaining({ stability: { frames: 3 } }) }),
    );
  });

  it('captures the raw frames for a while, with times starting at zero', async () => {
    const { stream } = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const { result, video } = setup();
    video.play = vi.fn().mockResolvedValue(undefined);
    let onFrame: ((raw: Frame, processed: Frame, view: null) => void) | undefined;
    runnerMock.startGestures.mockImplementation(async (_video, options) => {
      onFrame = options.onFrame;
      return { stop: vi.fn(), reconfigure: vi.fn() };
    });
    await act(async () => {
      await result.current.startLive();
    });
    act(() => onFrame!(frame(500), frame(500), null));
    let captured: Promise<Frame[]> | undefined;
    act(() => {
      captured = result.current.capture(1_000);
    });
    act(() => onFrame!(frame(1_000), frame(1_000), null));
    act(() => onFrame!(frame(1_100), frame(1_100), null));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const frames = await captured!;
    expect(frames.map((f) => f.t)).toEqual([0, 100]);
    // Dopo la registrazione i fotogrammi non si accumulano più.
    act(() => onFrame!(frame(1_200), frame(1_200), null));
    expect(frames).toHaveLength(2);
  });

  it('ignores a capture while another is running', async () => {
    const { stream } = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const { result, video } = setup();
    video.play = vi.fn().mockResolvedValue(undefined);
    let onFrame: ((raw: Frame, processed: Frame, view: null) => void) | undefined;
    runnerMock.startGestures.mockImplementation(async (_video, options) => {
      onFrame = options.onFrame;
      return { stop: vi.fn(), reconfigure: vi.fn() };
    });
    await act(async () => {
      await result.current.startLive();
    });
    let firstCapture: Promise<Frame[]> | undefined;
    act(() => {
      firstCapture = result.current.capture(1_000);
    });
    act(() => onFrame!(frame(100), frame(100), null));
    let secondCapture: Promise<Frame[]> | undefined;
    act(() => {
      secondCapture = result.current.capture(1_000);
    });
    act(() => onFrame!(frame(200), frame(200), null));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const firstFrames = await firstCapture!;
    const secondFrames = await secondCapture!;
    // La seconda cattura risolve a [] subito.
    expect(secondFrames).toEqual([]);
    // La prima cattura ottiene comunque i suoi fotogrammi con tempi riallineati a 0.
    expect(firstFrames.map((f) => f.t)).toEqual([0, 100]);
  });
});
