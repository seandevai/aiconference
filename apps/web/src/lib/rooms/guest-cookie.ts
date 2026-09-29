import 'server-only';
import { serverEnv } from '@/env';
import { guestCookieName, verifyGuestToken } from './guest-token';

export type CookieReader = { get(name: string): { value: string } | undefined };

export function readGuestParticipantId(store: CookieReader, roomId: string): string | null {
  const token = store.get(guestCookieName(roomId))?.value;
  return token ? verifyGuestToken(token, roomId, serverEnv().GUEST_SESSION_SECRET) : null;
}
