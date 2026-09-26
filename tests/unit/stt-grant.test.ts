import { describe, expect, it, vi } from 'vitest';
import { SttGrantError, grantDeepgramToken } from '@omnicanvas/stt/server';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('grantDeepgramToken', () => {
  it('asks for a 30 second token with the key in the header', async () => {
    const f = fakeFetch(200, { access_token: 'jwt', expires_in: 30 });
    expect(await grantDeepgramToken({ apiKey: 'dg-key', fetch: f })).toEqual({
      accessToken: 'jwt',
      expiresIn: 30,
    });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.deepgram.com/v1/auth/grant');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Token dg-key');
    // ttl_seconds, non ttl: un campo sbagliato viene ignorato e il token dura il default.
    expect(JSON.parse(init.body as string)).toEqual({ ttl_seconds: 30 });
  });

  it('turns vendor failures into a status-only error', async () => {
    await expect(
      grantDeepgramToken({ apiKey: 'k', fetch: fakeFetch(401, { err_msg: 'bad key' }) }),
    ).rejects.toEqual(new SttGrantError(401));
  });

  it('rejects a malformed answer', async () => {
    await expect(
      grantDeepgramToken({ apiKey: 'k', fetch: fakeFetch(200, { token: 'x' }) }),
    ).rejects.toEqual(new SttGrantError(502));
  });

  it('maps network errors to status 0', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(grantDeepgramToken({ apiKey: 'k', fetch: f })).rejects.toEqual(
      new SttGrantError(0),
    );
  });
});
