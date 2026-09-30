// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyStage } from '@omnicanvas/canvas';
import type { RealtimeSession } from '@omnicanvas/realtime';
import { useGestures } from '@/lib/stage/use-gestures';

afterEach(cleanup);

describe('useGestures when the camera goes away', () => {
  it('lets go of the hand: the stage stops tilting and no slot stays lit', () => {
    const onPointer = vi.fn();
    const session = { localIdentity: 'me', attachVideo: vi.fn(() => () => {}) } as unknown as RealtimeSession;
    const props = {
      session,
      cameraOn: true,
      stage: emptyStage(),
      dispatch: vi.fn(),
      onAgent: vi.fn(),
      areaRef: { current: null },
      onPointer,
    };
    const { result, rerender } = renderHook((p: typeof props) => useGestures(p), {
      initialProps: props,
    });
    rerender({ ...props, cameraOn: false });
    expect(onPointer).toHaveBeenLastCalledWith(null);
    expect(result.current.cursor).toBeNull();
  });
});
