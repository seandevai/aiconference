import { describe, expect, it } from 'vitest';
import {
  GUEST_TOKEN_TTL_SECONDS,
  guestCookieName,
  signGuestToken,
  verifyGuestToken,
} from '@/lib/rooms/guest-token';

const secret = 'a'.repeat(64);
const now = 1_790_000_000_000;
const participantId = '11111111-1111-4111-8111-111111111111';
const roomId = '22222222-2222-4222-8222-222222222222';

describe('guest token', () => {
  const token = signGuestToken({ participantId, roomId }, secret, now);

  it('round-trips to the participant id', () => {
    expect(verifyGuestToken(token, roomId, secret, now)).toBe(participantId);
  });

  it('rejects another room', () => {
    expect(verifyGuestToken(token, '33333333-3333-4333-8333-333333333333', secret, now)).toBeNull();
  });

  it('rejects another secret', () => {
    expect(verifyGuestToken(token, roomId, 'b'.repeat(64), now)).toBeNull();
  });

  it('rejects a tampered participant', () => {
    const [, ...rest] = token.split('.');
    const forged = ['44444444-4444-4444-8444-444444444444', ...rest].join('.');
    expect(verifyGuestToken(forged, roomId, secret, now)).toBeNull();
  });

  it('expires', () => {
    const later = now + (GUEST_TOKEN_TTL_SECONDS + 1) * 1000;
    expect(verifyGuestToken(token, roomId, secret, later)).toBeNull();
  });

  it.each(['', 'garbage', 'a.b.c', 'a.b.c.d.e'])('rejects malformed %s', (bad) => {
    expect(verifyGuestToken(bad, roomId, secret, now)).toBeNull();
  });

  it('names the cookie per room', () => {
    expect(guestCookieName(roomId)).toBe(`oc_guest_${roomId}`);
  });
});
