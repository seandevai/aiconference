import { describe, expect, it } from 'vitest';
import { toTokenResponse } from '@/lib/rooms/token-response';

describe('toTokenResponse', () => {
  it('returns url, token and the room timing on success', () => {
    expect(
      toTokenResponse({
        kind: 'ok',
        url: 'ws://lk',
        token: 'jwt',
        endsAt: '2026-10-04T11:00:00.000Z',
        capAt: '2026-10-04T13:00:00.000Z',
        serverNow: '2026-10-04T10:00:00.000Z',
      }),
    ).toEqual({
      status: 200,
      body: {
        url: 'ws://lk',
        token: 'jwt',
        endsAt: '2026-10-04T11:00:00.000Z',
        capAt: '2026-10-04T13:00:00.000Z',
        serverNow: '2026-10-04T10:00:00.000Z',
      },
    });
  });

  it('maps each refusal to its own status', () => {
    expect(toTokenResponse({ kind: 'not_found' })).toEqual({
      status: 404,
      body: { error: 'room_not_found' },
    });
    expect(toTokenResponse({ kind: 'ended' })).toEqual({
      status: 410,
      body: { error: 'room_ended' },
    });
    expect(toTokenResponse({ kind: 'forbidden' })).toEqual({
      status: 403,
      body: { error: 'not_a_participant' },
    });
  });
});
