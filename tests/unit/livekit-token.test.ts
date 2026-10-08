import { TokenVerifier } from 'livekit-server-sdk';
import { describe, expect, it } from 'vitest';
import { ROOM_TOKEN_TTL_SECONDS, createRoomToken } from '@omnicanvas/realtime/server';

const credentials = { apiKey: 'devkey', apiSecret: 'secret' };
const input = {
  roomId: '22222222-2222-4222-8222-222222222222',
  participantId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Cliente',
  role: 'guest' as const,
  language: 'en',
};

describe('createRoomToken', () => {
  it('binds identity, name and room to the participant row', async () => {
    const claims = await new TokenVerifier('devkey', 'secret').verify(
      await createRoomToken(input, credentials),
    );
    expect(claims.sub).toBe(input.participantId);
    expect(claims.name).toBe('Cliente');
    expect(claims.video?.room).toBe(input.roomId);
    expect(claims.video?.roomJoin).toBe(true);
  });

  it('signs role and language as attributes the client cannot rewrite', async () => {
    const claims = await new TokenVerifier('devkey', 'secret').verify(
      await createRoomToken(input, credentials),
    );
    expect(claims.attributes).toEqual({ role: 'guest', language: 'en' });
    expect(claims.video?.canUpdateOwnMetadata).toBe(false);
    expect(claims.video?.canPublish).toBe(true);
    expect(claims.video?.canPublishData).toBe(true);
  });

  it('expires after ten minutes', async () => {
    const claims = await new TokenVerifier('devkey', 'secret').verify(
      await createRoomToken(input, credentials),
    );
    expect(ROOM_TOKEN_TTL_SECONDS).toBe(600);
    expect((claims.exp ?? 0) - (claims.nbf ?? 0)).toBe(600);
  });

  it('is rejected with another secret', async () => {
    const token = await createRoomToken(input, credentials);
    await expect(new TokenVerifier('devkey', 'other-secret').verify(token)).rejects.toThrow();
  });

  it('lets only the host publish a screen', async () => {
    const verify = async (role: 'host' | 'guest') =>
      new TokenVerifier('devkey', 'secret').verify(
        await createRoomToken({ ...input, role }, credentials),
      );
    expect((await verify('guest')).video?.canPublishSources).toEqual(['camera', 'microphone']);
    expect((await verify('host')).video?.canPublishSources).toEqual([
      'camera',
      'microphone',
      'screen_share',
    ]);
  });
});
