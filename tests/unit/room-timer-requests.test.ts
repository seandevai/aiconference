import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeRoomRequest, extendRoomRequest, latestEndsAt } from '@/lib/call/room-timer-requests';

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('room timer requests', () => {
  it('posts the extension and returns the new timing', async () => {
    const fetchMock = vi.fn(async () =>
      json(200, { endsAt: 'e', capAt: 'c', serverNow: 'n' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await extendRoomRequest('ABCD2345', 15)).toEqual({ endsAt: 'e', capAt: 'c' });
    expect(fetchMock).toHaveBeenCalledWith('/room/ABCD2345/extend', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 15 }),
    });
  });

  it('returns null when the extension is refused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'cap_reached' })));
    expect(await extendRoomRequest('ABCD2345', 30)).toBeNull();
  });

  it('closes without throwing on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await expect(closeRoomRequest('ABCD2345')).resolves.toBeUndefined();
  });

  it('bounds the close and the deadline read with an abort signal', async () => {
    const fetchMock = vi.fn(async () => json(200, { endsAt: 'e', capAt: 'c' }));
    vi.stubGlobal('fetch', fetchMock);
    await closeRoomRequest('ABCD2345');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/room/ABCD2345/close',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await latestEndsAt('ABCD2345');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/room/ABCD2345/token',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reads the latest deadline from a fresh token, null when the room is over', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { url: 'u', token: 't', endsAt: 'e', capAt: 'c', serverNow: 'n' })));
    expect(await latestEndsAt('ABCD2345')).toEqual({ endsAt: 'e', capAt: 'c' });
    vi.stubGlobal('fetch', vi.fn(async () => json(410, { error: 'room_ended' })));
    expect(await latestEndsAt('ABCD2345')).toBeNull();
  });
});
