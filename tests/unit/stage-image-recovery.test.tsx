// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyStage, packAsset, sha256Hex, type Stage } from '@omnicanvas/canvas';
import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';
import { useStage } from '@/lib/stage/use-stage';

const ASSET = '20000000-0000-4000-8000-000000000001';
const BYTES = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

const person = (identity: string, role: 'host' | 'guest', isLocal: boolean): RosterEntry => ({
  identity,
  name: identity,
  role,
  language: 'it',
  isLocal,
  micOn: true,
  camOn: false,
  speaking: false,
});

type DataHandler = (payload: unknown, from: string) => void;
type BytesHandler = (bytes: Uint8Array, from: string) => void;

function fakeSession() {
  const data = new Map<string, Set<DataHandler>>();
  const bytes = new Map<string, Set<BytesHandler>>();
  const on = <T,>(map: Map<string, Set<T>>, channel: string, handler: T) => {
    const set = map.get(channel) ?? new Set<T>();
    map.set(channel, set);
    set.add(handler);
    return () => set.delete(handler);
  };
  return {
    sendData: vi.fn(async () => {}),
    sendBytes: vi.fn(async () => {}),
    onData: (channel: string, handler: DataHandler) => on(data, channel, handler),
    onBytes: (channel: string, handler: BytesHandler) => on(bytes, channel, handler),
    deliverData: (channel: string, payload: unknown, from: string) =>
      data.get(channel)?.forEach((h) => h(payload, from)),
    deliverBytes: (channel: string, payload: Uint8Array, from: string) =>
      bytes.get(channel)?.forEach((h) => h(payload, from)),
  };
}

async function stageWithImage(): Promise<Stage> {
  return {
    ...emptyStage(),
    version: 3,
    tray: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'image',
        data: {
          title: 'Schema',
          assetId: ASSET,
          mime: 'image/png',
          alt: '',
          sha256: await sha256Hex(BYTES),
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderHost(session: ReturnType<typeof fakeSession>) {
  const stored = await stageWithImage();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ stage: stored }), { status: 200 })),
  );
  const hook = renderHook(() =>
    useStage({
      joinCode: 'ABCD2345',
      role: 'host',
      session: session as unknown as RealtimeSession,
      roster: [person('host', 'host', true), person('guest', 'guest', false)],
    }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return hook;
}

describe('host that reloaded the page', () => {
  it('asks the guests for the image bytes it lost', async () => {
    const session = fakeSession();
    await renderHost(session);
    expect(session.sendData).toHaveBeenCalledWith('asset-request', { assetId: ASSET });
  });

  it('takes the bytes from a guest when the hash matches', async () => {
    const session = fakeSession();
    const { result } = await renderHost(session);
    await act(async () => {
      session.deliverBytes(
        'asset',
        packAsset({ assetId: ASSET, mime: 'image/png' }, BYTES),
        'guest',
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.assetUrls[ASSET]).toBe('blob:x');
  });

  it('refuses bytes that do not match the hash', async () => {
    const session = fakeSession();
    const { result } = await renderHost(session);
    const forged = new Uint8Array([9, 9, 9]);
    await act(async () => {
      session.deliverBytes(
        'asset',
        packAsset({ assetId: ASSET, mime: 'image/png' }, forged),
        'guest',
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.assetUrls[ASSET]).toBeUndefined();
  });
});

describe('guest holding the bytes', () => {
  it('sends them to the host that asks, and to no one else', async () => {
    const session = fakeSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    renderHook(() =>
      useStage({
        joinCode: 'ABCD2345',
        role: 'guest',
        session: session as unknown as RealtimeSession,
        roster: [person('guest', 'guest', true), person('host', 'host', false)],
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // L'ospite ha ricevuto immagine e palco dall'host prima che questo ricaricasse.
    await act(async () => {
      session.deliverBytes(
        'asset',
        packAsset({ assetId: ASSET, mime: 'image/png' }, BYTES),
        'host',
      );
      session.deliverBytes(
        'stage-snapshot',
        new TextEncoder().encode(JSON.stringify(await stageWithImage())),
        'host',
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    session.sendBytes.mockClear();

    session.deliverData('asset-request', { assetId: ASSET }, 'other-guest');
    expect(session.sendBytes).not.toHaveBeenCalled();

    session.deliverData('asset-request', { assetId: ASSET }, 'host');
    expect(session.sendBytes).toHaveBeenCalledWith('asset', expect.any(Uint8Array), ['host']);
  });
});
