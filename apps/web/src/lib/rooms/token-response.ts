import type { RoomTokenResult } from './room-token';

export type TokenResponseBody =
  { url: string; token: string } | { error: 'room_not_found' | 'room_ended' | 'not_a_participant' };

export function toTokenResponse(result: RoomTokenResult): {
  status: number;
  body: TokenResponseBody;
} {
  switch (result.kind) {
    case 'ok':
      return { status: 200, body: { url: result.url, token: result.token } };
    case 'not_found':
      return { status: 404, body: { error: 'room_not_found' } };
    case 'ended':
      return { status: 410, body: { error: 'room_ended' } };
    case 'forbidden':
      return { status: 403, body: { error: 'not_a_participant' } };
  }
}
