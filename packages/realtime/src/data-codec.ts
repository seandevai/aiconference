// I messaggi affidabili di LiveKit reggono circa 15 KB: oltre si usa sendBytes.
export const MAX_DATA_BYTES = 15_000;

const CHANNEL_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

export class PayloadTooLargeError extends Error {
  readonly bytes: number;

  constructor(bytes: number) {
    super(`data payload is ${bytes} bytes, max ${MAX_DATA_BYTES}: use sendBytes`);
    this.name = 'PayloadTooLargeError';
    this.bytes = bytes;
  }
}

export function assertChannel(channel: string): void {
  if (!CHANNEL_PATTERN.test(channel)) throw new Error(`invalid channel name: "${channel}"`);
}

export function encodeData(payload: unknown): Uint8Array<ArrayBuffer> {
  const json = JSON.stringify(payload);
  if (json === undefined) throw new Error('payload is not JSON-serializable');
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > MAX_DATA_BYTES) throw new PayloadTooLargeError(bytes.byteLength);
  return bytes;
}

// Un messaggio malformato da un altro partecipante non deve rompere chi lo riceve.
export function decodeData(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}
