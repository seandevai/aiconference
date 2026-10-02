// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisconnectCause, RealtimeSession } from '@omnicanvas/realtime';

type FakeSession = RealtimeSession & { drop: (cause: DisconnectCause) => void };

const sessions: FakeSession[] = [];

function fakeSession(): FakeSession {
  let onDisconnected: ((cause: DisconnectCause) => void) | null = null;
  const session = {
    localIdentity: 'host',
    getStatus: () => 'connected',
    getRoster: () => [],
    isAudioBlocked: () => false,
    onStatusChange: () => () => {},
    onRosterChange: () => () => {},
    onAudioBlockedChange: () => () => {},
    onDisconnected: (handler: (cause: DisconnectCause) => void) => {
      onDisconnected = handler;
      return () => {};
    },
    startAudio: async () => {},
    setMicrophoneEnabled: async () => {},
    setCameraEnabled: async () => {},
    canSwitchCamera: async () => false,
    switchCamera: async () => {},
    cameraFacing: () => 'user',
    attachVideo: vi.fn(() => () => {}),
    sendData: async () => {},
    onData: () => () => {},
    sendBytes: async () => {},
    onBytes: () => () => {},
    disconnect: async () => {},
    drop: (cause: DisconnectCause) => onDisconnected?.(cause),
  } as unknown as FakeSession;
  sessions.push(session);
  return session;
}

vi.mock('@omnicanvas/realtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@omnicanvas/realtime')>()),
  connectToRoom: vi.fn(async () => fakeSession()),
}));

import { useCall } from '@/lib/call/use-call';

beforeEach(() => {
  sessions.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ url: 'ws://x', token: 't' }))),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useCall after a full reconnection', () => {
  it('gives the tiles a new attachVideo bound to the new session', async () => {
    const { result } = renderHook(() => useCall('ABCD2345'));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(sessions).toHaveLength(1);
    const before = result.current.attachVideo;

    await act(async () => {
      sessions[0]!.drop('network');
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(sessions).toHaveLength(2);

    // Le tessere rifanno l'effetto solo se la funzione cambia.
    expect(result.current.attachVideo).not.toBe(before);
    const element = document.createElement('video');
    result.current.attachVideo('guest', element);
    expect(sessions[1]!.attachVideo).toHaveBeenCalledWith('guest', element);
  });
});
