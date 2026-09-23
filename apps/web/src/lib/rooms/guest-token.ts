import { createHmac, timingSafeEqual } from 'node:crypto';

export const GUEST_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function guestCookieName(roomId: string): string {
  return `oc_guest_${roomId}`;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

// Formato: participantId.roomId.expiresAtSeconds.signature
export function signGuestToken(
  { participantId, roomId }: { participantId: string; roomId: string },
  secret: string,
  now: number = Date.now(),
): string {
  const expiresAt = Math.floor(now / 1000) + GUEST_TOKEN_TTL_SECONDS;
  const payload = `${participantId}.${roomId}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyGuestToken(
  token: string,
  roomId: string,
  secret: string,
  now: number = Date.now(),
): string | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [participantId, tokenRoomId, expiresAtRaw, signature] = parts as [string, string, string, string];

  const expected = Buffer.from(sign(`${participantId}.${tokenRoomId}.${expiresAtRaw}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  if (tokenRoomId !== roomId) return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 < now) return null;
  return participantId;
}
