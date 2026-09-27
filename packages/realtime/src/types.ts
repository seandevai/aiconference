// Confine del realtime (ARCHITECTURE §7): niente in questo file nomina LiveKit.
// Il giorno in cui si cambia vendor si riscrivono server.ts e livekit-session.ts.

export type ParticipantRole = 'host' | 'guest';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

// Perché una sessione è finita. Solo 'network' giustifica una riconnessione automatica.
export type DisconnectCause = 'client' | 'replaced' | 'removed' | 'room_closed' | 'network';

export type RosterEntry = {
  identity: string;
  name: string;
  role: ParticipantRole;
  language: string;
  isLocal: boolean;
  micOn: boolean;
  camOn: boolean;
  speaking: boolean;
};

export type Unsubscribe = () => void;

export interface RealtimeSession {
  readonly localIdentity: string;
  getStatus(): ConnectionStatus;
  getRoster(): RosterEntry[];
  isAudioBlocked(): boolean;
  onStatusChange(handler: (status: ConnectionStatus) => void): Unsubscribe;
  onRosterChange(handler: (roster: RosterEntry[]) => void): Unsubscribe;
  onAudioBlockedChange(handler: (blocked: boolean) => void): Unsubscribe;
  onDisconnected(handler: (cause: DisconnectCause) => void): Unsubscribe;
  // Da chiamare dentro un click: i browser bloccano l'audio senza un gesto dell'utente.
  startAudio(): Promise<void>;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
  // Vero se il dispositivo ha almeno due fotocamere (tipicamente un telefono).
  canSwitchCamera(): Promise<boolean>;
  // Anteriore ↔ posteriore. A camera spenta cambia solo la scelta per la riaccensione.
  switchCamera(): Promise<void>;
  attachVideo(identity: string, element: HTMLVideoElement): Unsubscribe;
  // Messaggi piccoli (≤ 15 KB di JSON). Per le immagini c'è sendBytes.
  sendData(channel: string, payload: unknown, to?: string[]): Promise<void>;
  onData(channel: string, handler: (payload: unknown, from: string) => void): Unsubscribe;
  sendBytes(topic: string, bytes: Uint8Array, to?: string[]): Promise<void>;
  onBytes(topic: string, handler: (bytes: Uint8Array, from: string) => void): Unsubscribe;
  disconnect(): Promise<void>;
}
