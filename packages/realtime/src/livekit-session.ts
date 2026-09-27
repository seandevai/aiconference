import {
  ConnectionState,
  DisconnectReason,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from 'livekit-client';
import { countVideoInputs, createCameraPreference } from './camera';
import { assertChannel, decodeData, encodeData } from './data-codec';
import { sortRoster, toRosterEntry } from './roster';
import type {
  ConnectionStatus,
  DisconnectCause,
  RealtimeSession,
  RosterEntry,
  Unsubscribe,
} from './types';

function toStatus(state: ConnectionState): ConnectionStatus {
  switch (state) {
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return 'reconnecting';
    default:
      return 'disconnected';
  }
}

function toCause(reason: DisconnectReason | undefined): DisconnectCause {
  switch (reason) {
    case DisconnectReason.CLIENT_INITIATED:
      return 'client';
    case DisconnectReason.DUPLICATE_IDENTITY:
      return 'replaced';
    case DisconnectReason.PARTICIPANT_REMOVED:
      return 'removed';
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return 'room_closed';
    default:
      return 'network';
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function subscribe<T>(set: Set<T>, handler: T): Unsubscribe {
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

export async function connectToRoom(url: string, token: string): Promise<RealtimeSession> {
  // In background il video remoto deve continuare: il PiP lo mostra sopra le altre app.
  const room = new Room({ adaptiveStream: { pauseVideoInBackground: false }, dynacast: true });
  const facing = createCameraPreference();

  // L'audio remoto suona da elementi <audio> nascosti: la UI mostra solo i video.
  const audioSink = document.createElement('div');
  audioSink.hidden = true;
  document.body.append(audioSink);

  const statusHandlers = new Set<(status: ConnectionStatus) => void>();
  const rosterHandlers = new Set<(roster: RosterEntry[]) => void>();
  const audioHandlers = new Set<(blocked: boolean) => void>();
  const disconnectHandlers = new Set<(cause: DisconnectCause) => void>();
  const dataHandlers = new Map<string, Set<(payload: unknown, from: string) => void>>();
  const byteHandlers = new Map<string, Set<(bytes: Uint8Array, from: string) => void>>();

  const participant = (identity: string): Participant | undefined =>
    identity === room.localParticipant.identity
      ? room.localParticipant
      : room.remoteParticipants.get(identity);

  const roster = (): RosterEntry[] =>
    sortRoster([
      toRosterEntry(room.localParticipant, true),
      ...[...room.remoteParticipants.values()].map((p) => toRosterEntry(p, false)),
    ]);

  const emitRoster = () => {
    const snapshot = roster();
    rosterHandlers.forEach((handler) => handler(snapshot));
  };

  room
    .on(RoomEvent.ConnectionStateChanged, (state) =>
      statusHandlers.forEach((handler) => handler(toStatus(state))),
    )
    .on(RoomEvent.ParticipantConnected, emitRoster)
    .on(RoomEvent.ParticipantDisconnected, emitRoster)
    .on(RoomEvent.TrackPublished, emitRoster)
    .on(RoomEvent.TrackUnpublished, emitRoster)
    .on(RoomEvent.TrackMuted, emitRoster)
    .on(RoomEvent.TrackUnmuted, emitRoster)
    .on(RoomEvent.LocalTrackPublished, emitRoster)
    .on(RoomEvent.LocalTrackUnpublished, emitRoster)
    .on(RoomEvent.ActiveSpeakersChanged, emitRoster)
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) audioSink.append(track.attach());
      emitRoster();
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((element) => element.remove());
      emitRoster();
    })
    .on(RoomEvent.AudioPlaybackStatusChanged, () =>
      audioHandlers.forEach((handler) => handler(!room.canPlaybackAudio)),
    )
    .on(RoomEvent.DataReceived, (payload, sender, _kind, topic) => {
      if (!sender || !topic) return;
      const handlers = dataHandlers.get(topic);
      if (!handlers) return;
      const decoded = decodeData(payload);
      if (decoded === undefined) return;
      handlers.forEach((handler) => handler(decoded, sender.identity));
    })
    .on(RoomEvent.Disconnected, (reason) => {
      audioSink.remove();
      disconnectHandlers.forEach((handler) => handler(toCause(reason)));
    });

  try {
    await room.connect(url, token);
  } catch (error) {
    audioSink.remove();
    throw error;
  }

  const recipients = (to: string[] | undefined) => (to ? { destinationIdentities: to } : {});

  return {
    localIdentity: room.localParticipant.identity,
    getStatus: () => toStatus(room.state),
    getRoster: roster,
    isAudioBlocked: () => !room.canPlaybackAudio,
    onStatusChange: (handler) => subscribe(statusHandlers, handler),
    onRosterChange: (handler) => subscribe(rosterHandlers, handler),
    onAudioBlockedChange: (handler) => subscribe(audioHandlers, handler),
    onDisconnected: (handler) => subscribe(disconnectHandlers, handler),

    async startAudio() {
      await room.startAudio();
    },

    async setMicrophoneEnabled(enabled) {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      emitRoster();
    },

    async setCameraEnabled(enabled) {
      await room.localParticipant.setCameraEnabled(
        enabled,
        enabled ? { facingMode: facing.get() } : undefined,
      );
      emitRoster();
    },

    async canSwitchCamera() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return countVideoInputs(devices) >= 2;
    },

    async switchCamera() {
      const facingMode = facing.toggle();
      if (!room.localParticipant.isCameraEnabled) return;
      const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (track instanceof LocalVideoTrack) await track.restartTrack({ facingMode });
    },

    attachVideo(identity, element) {
      let attached: Track | undefined;
      // La traccia può arrivare dopo il montaggio della tessera: si riprova a ogni sottoscrizione.
      const tryAttach = () => {
        const track = participant(identity)?.getTrackPublication(Track.Source.Camera)?.track;
        if (!track || track === attached) return;
        attached?.detach(element);
        track.attach(element);
        attached = track;
      };
      tryAttach();
      room.on(RoomEvent.TrackSubscribed, tryAttach).on(RoomEvent.LocalTrackPublished, tryAttach);
      return () => {
        room
          .off(RoomEvent.TrackSubscribed, tryAttach)
          .off(RoomEvent.LocalTrackPublished, tryAttach);
        attached?.detach(element);
      };
    },

    async sendData(channel, payload, to) {
      assertChannel(channel);
      await room.localParticipant.publishData(encodeData(payload), {
        reliable: true,
        topic: channel,
        ...recipients(to),
      });
    },

    onData(channel, handler) {
      assertChannel(channel);
      const handlers = dataHandlers.get(channel) ?? new Set();
      dataHandlers.set(channel, handlers);
      return subscribe(handlers, handler);
    },

    async sendBytes(topic, bytes, to) {
      assertChannel(topic);
      await room.localParticipant.sendBytes(bytes, { topic, ...recipients(to) });
    },

    onBytes(topic, handler) {
      assertChannel(topic);
      let handlers = byteHandlers.get(topic);
      if (!handlers) {
        const created = new Set<(bytes: Uint8Array, from: string) => void>();
        handlers = created;
        byteHandlers.set(topic, created);
        // LiveKit accetta un solo handler per topic: lo registriamo una volta e smistiamo.
        room.registerByteStreamHandler(topic, (reader, { identity }) => {
          void reader.readAll().then((chunks) => {
            const bytes = concat(chunks);
            created.forEach((fn) => fn(bytes, identity));
          });
        });
      }
      const unsubscribe = subscribe(handlers, handler);
      return () => {
        unsubscribe();
        if (handlers.size === 0) {
          room.unregisterByteStreamHandler(topic);
          byteHandlers.delete(topic);
        }
      };
    },

    async disconnect() {
      await room.disconnect();
    },
  };
}
