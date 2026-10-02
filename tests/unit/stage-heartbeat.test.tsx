// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';
import { useStage } from '@/lib/stage/use-stage';

const host: RosterEntry = {
  identity: 'host',
  name: 'Sean',
  role: 'host',
  language: 'it',
  isLocal: true,
  micOn: true,
  camOn: true,
  speaking: false,
};

function fakeSession() {
  return {
    sendData: vi.fn(async () => {}),
    sendBytes: vi.fn(async () => {}),
    onData: () => () => {},
    onBytes: () => () => {},
  } as unknown as RealtimeSession & { sendData: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('host heartbeat', () => {
  it('announces the stage version every few seconds', async () => {
    const session = fakeSession();
    renderHook(() => useStage({ joinCode: 'ABCD2345', role: 'host', session, roster: [host] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const beats = () =>
      session.sendData.mock.calls.filter(
        ([channel, payload]) =>
          channel === 'stage' && (payload as { type?: string }).type === 'heartbeat',
      );
    expect(beats()).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(beats()).toEqual([['stage', { type: 'heartbeat', version: 0 }]]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(beats()).toHaveLength(2);
  });
});
