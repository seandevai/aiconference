import 'server-only';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { ParticipantRole } from './types';

// Basta per entrare: una volta connesso, LiveKit rinnova il token da solo.
export const ROOM_TOKEN_TTL_SECONDS = 10 * 60;

export type RoomTokenInput = {
  roomId: string;
  participantId: string;
  displayName: string;
  role: ParticipantRole;
  language: string;
};

export type LiveKitCredentials = { apiKey: string; apiSecret: string };

// L'identità è l'id di room_participants: la sceglie il server, il client non può falsificarla.
// Ruolo e lingua viaggiano come attributi firmati; canUpdateOwnMetadata=false impedisce
// al client di riscriverli, così un ospite non può dichiararsi host.
export async function createRoomToken(
  input: RoomTokenInput,
  credentials: LiveKitCredentials,
): Promise<string> {
  const token = new AccessToken(credentials.apiKey, credentials.apiSecret, {
    identity: input.participantId,
    name: input.displayName,
    ttl: ROOM_TOKEN_TTL_SECONDS,
    attributes: { role: input.role, language: input.language },
  });
  token.addGrant({
    roomJoin: true,
    room: input.roomId,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
  });
  return token.toJwt();
}

// Chiude la stanza per tutti: LiveKit scollega i partecipanti con causa «room_closed».
// L'URL può essere ws(s)://: l'SDK lo converte in http(s):// per le chiamate di servizio.
export async function closeRoom(
  roomId: string,
  config: LiveKitCredentials & { url: string },
): Promise<void> {
  await new RoomServiceClient(config.url, config.apiKey, config.apiSecret).deleteRoom(roomId);
}
