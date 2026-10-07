// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioLevels } from '@omnicanvas/realtime';
import { useAudioLevel } from '@/lib/call/use-audio-level';

afterEach(cleanup);

describe('useAudioLevel', () => {
  it('follows the level of one person and falls to zero when absent', () => {
    let emit: (levels: AudioLevels) => void = () => {};
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((handler: (levels: AudioLevels) => void) => {
      emit = handler;
      return unsubscribe;
    });
    const { result, unmount } = renderHook(() => useAudioLevel(subscribe, 'anna'));
    expect(result.current).toBe(0);
    act(() => emit({ anna: 0.6, marco: 0.2 }));
    expect(result.current).toBe(0.6);
    act(() => emit({ marco: 0.4 }));
    expect(result.current).toBe(0);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
  it('stays at zero without a session', () => {
    const { result } = renderHook(() => useAudioLevel(undefined, 'anna'));
    expect(result.current).toBe(0);
  });
});
