// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  applyCommand,
  emptyStage,
  findScreen,
  screenStartCommands,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import { ScreenShareCancelled, type RealtimeSession } from '@omnicanvas/realtime';
import {
  SCREEN_SHARE_ERROR,
  SCREEN_STOP_ERROR,
  SCREEN_TRAY_FULL,
  useScreenShare,
} from '@/lib/stage/use-screen-share';

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

function fakeSession(canShare = true) {
  const ended = new Set<() => void>();
  const endNatively = () => ended.forEach((handler) => handler());
  const session = {
    localIdentity: 'host-1',
    canShareScreen: () => canShare,
    startScreenShare: vi.fn(async () => {}),
    stopScreenShare: vi.fn(async () => endNatively()),
    onScreenShareEnded: (handler: () => void) => {
      ended.add(handler);
      return () => ended.delete(handler);
    },
  };
  return { session, endNatively };
}

function setup(options: { role?: 'host' | 'guest'; initial?: Stage; canShare?: boolean } = {}) {
  const fake = fakeSession(options.canShare);
  const hook = renderHook(() => {
    const [stage, setStage] = useState(options.initial ?? emptyStage());
    const dispatch = useCallback(
      (command: StageCommand) => setStage((s) => applyCommand(s, command)),
      [],
    );
    const share = useScreenShare({
      session: fake.session as unknown as RealtimeSession,
      role: options.role ?? 'host',
      stage,
      ready: true,
      dispatch,
      newId,
    });
    return { stage, dispatch, share };
  });
  return { ...fake, hook };
}

describe('useScreenShare', () => {
  it('puts the screen on the stage when the host starts sharing', async () => {
    const { hook } = setup();
    await act(() => hook.result.current.share.start());
    expect(hook.result.current.share.sharing).toBe(true);
    expect(findScreen(hook.result.current.stage)?.data).toEqual({
      title: 'Schermo',
      owner: 'host-1',
    });
  });

  it('takes the screen away when the browser stops sharing', async () => {
    const { hook, endNatively } = setup();
    await act(() => hook.result.current.share.start());
    act(() => endNatively());
    expect(hook.result.current.share.sharing).toBe(false);
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('stops from the dock button', async () => {
    const { hook, session } = setup();
    await act(() => hook.result.current.share.start());
    await act(async () => hook.result.current.share.stop());
    expect(session.stopScreenShare).toHaveBeenCalled();
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('says nothing when the host closes the picker', async () => {
    const { hook, session } = setup();
    session.startScreenShare.mockRejectedValueOnce(new ScreenShareCancelled());
    await act(() => hook.result.current.share.start());
    expect(hook.result.current.share.error).toBeNull();
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('shows an error for any other failure', async () => {
    const { hook, session } = setup();
    session.startScreenShare.mockRejectedValueOnce(new Error('NotReadableError'));
    await act(() => hook.result.current.share.start());
    expect(hook.result.current.share.error).toBe(SCREEN_SHARE_ERROR);
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('opens the picker once even if clicked twice', async () => {
    const { hook, session } = setup();
    await act(async () => {
      void hook.result.current.share.start();
      await hook.result.current.share.start();
    });
    expect(session.startScreenShare).toHaveBeenCalledTimes(1);
  });

  it('clears a screen left on the stage by a reload', () => {
    const left = screenStartCommands(emptyStage(), {
      owner: 'host-1',
      contentId: newId(),
      windowId: newId(),
    }).reduce(applyCommand, emptyStage());
    const { hook } = setup({ initial: left });
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('stops sharing when the host closes the screen window by hand', async () => {
    const { hook, session } = setup();
    await act(() => hook.result.current.share.start());
    const windowId = hook.result.current.stage.focusedId!;
    act(() => hook.result.current.dispatch({ type: 'WINDOW_ARCHIVE', windowId }));
    expect(session.stopScreenShare).toHaveBeenCalled();
  });

  it('stops sharing when the screen could not enter the stage', async () => {
    const full: Stage = {
      ...emptyStage(),
      tray: Array.from({ length: 50 }, () => ({
        id: newId(),
        kind: 'text' as const,
        data: { title: 'x', body: '' },
      })),
    };
    const { hook, session } = setup({ initial: full });
    await act(() => hook.result.current.share.start());
    expect(session.stopScreenShare).toHaveBeenCalled();
    expect(hook.result.current.share.sharing).toBe(false);
    expect(hook.result.current.stage.windows).toEqual([]);
    expect(hook.result.current.share.error).toBe(SCREEN_TRAY_FULL);
  });

  it('tries the stop again once when it fails', async () => {
    vi.useFakeTimers();
    try {
      const { hook, session } = setup();
      await act(() => hook.result.current.share.start());
      session.stopScreenShare.mockRejectedValueOnce(new Error('busy'));
      await act(async () => hook.result.current.share.stop());
      expect(session.stopScreenShare).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(session.stopScreenShare).toHaveBeenCalledTimes(2);
      expect(hook.result.current.share.sharing).toBe(false);
      expect(hook.result.current.share.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks to stop from the browser when the stop keeps failing', async () => {
    vi.useFakeTimers();
    try {
      const { hook, session } = setup();
      await act(() => hook.result.current.share.start());
      session.stopScreenShare.mockRejectedValue(new Error('busy'));
      await act(async () => hook.result.current.share.stop());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(session.stopScreenShare).toHaveBeenCalledTimes(2);
      expect(hook.result.current.share.error).toBe(SCREEN_STOP_ERROR);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops a share that starts on a session no longer current', async () => {
    const old = fakeSession();
    const fresh = fakeSession();
    let release!: () => void;
    old.session.startScreenShare.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const hook = renderHook(
      ({ session }: { session: RealtimeSession }) => {
        const [stage, setStage] = useState(emptyStage());
        const dispatch = useCallback(
          (command: StageCommand) => setStage((s) => applyCommand(s, command)),
          [],
        );
        return {
          stage,
          share: useScreenShare({ session, role: 'host', stage, ready: true, dispatch, newId }),
        };
      },
      { initialProps: { session: old.session as unknown as RealtimeSession } },
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.share.start();
    });
    hook.rerender({ session: fresh.session as unknown as RealtimeSession });
    await act(async () => {
      release();
      await pending;
    });
    expect(old.session.stopScreenShare).toHaveBeenCalled();
    expect(findScreen(hook.result.current.stage)).toBeNull();
    expect(hook.result.current.share.sharing).toBe(false);
  });

  it('stops a share that starts after the call has closed', async () => {
    const { session } = fakeSession();
    let release!: () => void;
    session.startScreenShare.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const dispatch = vi.fn();
    const hook = renderHook(() =>
      useScreenShare({
        session: session as unknown as RealtimeSession,
        role: 'host',
        stage: emptyStage(),
        ready: true,
        dispatch,
        newId,
      }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.start();
    });
    hook.unmount();
    release();
    await pending;
    expect(session.stopScreenShare).toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('is not available to guests or where the browser cannot share', () => {
    expect(setup({ role: 'guest' }).hook.result.current.share.available).toBe(false);
    expect(setup({ canShare: false }).hook.result.current.share.available).toBe(false);
  });
});
