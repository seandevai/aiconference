import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReplayer, parseRecording } from '@/lib/gesture-lab/recording';
import { hand } from '../fixtures/hands';

const valid = {
  expect: 'FOCUS_NEXT',
  armed: true,
  frames: [
    { t: 0, hands: [hand('fist')] },
    { t: 33, hands: [] },
    { t: 66, hands: [hand('fist')] },
  ],
};

describe('parseRecording', () => {
  it('accepts a recorder file', () => {
    expect(parseRecording(valid)).toEqual(valid);
  });

  it('rejects anything else', () => {
    expect(parseRecording(null)).toBeNull();
    expect(parseRecording({ ...valid, expect: 'DANCE' })).toBeNull();
    expect(parseRecording({ ...valid, armed: 'yes' })).toBeNull();
    expect(parseRecording({ ...valid, frames: 'many' })).toBeNull();
    expect(
      parseRecording({
        ...valid,
        frames: [{ t: 0, hands: [{ landmarks: [{ x: 0, y: 0, z: 0 }] }] }],
      }),
    ).toBeNull();
    expect(parseRecording({ ...valid, frames: [{ t: 'zero', hands: [] }] })).toBeNull();
  });
});

describe('createReplayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays frames at their recorded times, pauses and resumes', () => {
    const seen: number[] = [];
    const onEnd = vi.fn();
    const replayer = createReplayer(valid.frames, (f) => seen.push(f.t), onEnd);
    replayer.play();
    expect(seen).toEqual([0]);
    vi.advanceTimersByTime(33);
    expect(seen).toEqual([0, 33]);
    replayer.pause();
    expect(replayer.isPlaying()).toBe(false);
    vi.advanceTimersByTime(500);
    expect(seen).toEqual([0, 33]);
    replayer.play();
    vi.advanceTimersByTime(33);
    expect(seen).toEqual([0, 33, 66]);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(replayer.isPlaying()).toBe(false);
  });

  it('starts over after reaching the end', () => {
    const seen: number[] = [];
    const replayer = createReplayer(
      valid.frames,
      (f) => seen.push(f.t),
      () => {},
    );
    replayer.play();
    vi.advanceTimersByTime(100);
    replayer.play();
    expect(seen).toEqual([0, 33, 66, 0]);
  });
});
