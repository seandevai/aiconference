import type { RoomTokenResult } from './room-token';

export type TokenGrantBody = {
  url: string;
  token: string;
  endsAt: string;
  capAt: string;
  serverNow: string;
};

export type TokenResponseBody =
  | TokenGrantBody
  | { error: 'room_not_found' | 'room_ended' | 'not_a_participant' };

export function toTokenResponse(result: RoomTokenResult): {
  status: number;
  body: TokenResponseBody;
} {
  switch (result.kind) {
    case 'ok': {
      const { url, token, endsAt, capAt, serverNow } = result;
      return { status: 200, body: { url, token, endsAt, capAt, serverNow } };
    }
    case 'not_found':
      return { status: 404, body: { error: 'room_not_found' } };
    case 'ended':
      return { status: 410, body: { error: 'room_ended' } };
    case 'forbidden':
      return { status: 403, body: { error: 'not_a_participant' } };
  }
}
