import { describe, expect, it } from 'vitest';
import { toTokenResponse } from '@/lib/rooms/token-response';

describe('toTokenResponse', () => {
  it('returns url and token on success', () => {
    expect(toTokenResponse({ kind: 'ok', url: 'ws://lk', token: 'jwt' })).toEqual({
      status: 200,
      body: { url: 'ws://lk', token: 'jwt' },
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
