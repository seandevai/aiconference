import type { BundleFile } from './collect';
import { zipFiles } from './zip';

// Formato del blob che arriva allo storage: versione (1 byte), IV (12 byte), cifrato AES-GCM.
// Dentro il cifrato: 4 byte di lunghezza, header JSON { name, mime }, byte del file.
// Nome e tipo stanno dentro: il server vede solo la dimensione (ADR-0008).
const FORMAT_VERSION = 1;
const IV_BYTES = 12;
const KEY_BITS = 256;
const ZIP_NAME = 'nod-riunione.zip';

export type OpenedBundle = { name: string; mime: string; bytes: Uint8Array };

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function envelope(file: OpenedBundle): Uint8Array<ArrayBuffer> {
  const head = new TextEncoder().encode(JSON.stringify({ name: file.name, mime: file.mime }));
  const out = new Uint8Array(4 + head.byteLength + file.bytes.byteLength);
  new DataView(out.buffer).setUint32(0, head.byteLength);
  out.set(head, 4);
  out.set(file.bytes, 4 + head.byteLength);
  return out;
}

function unwrap(plain: Uint8Array): OpenedBundle {
  const length = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0);
  const head = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + length))) as {
    name?: unknown;
    mime?: unknown;
  };
  if (typeof head.name !== 'string' || typeof head.mime !== 'string') {
    throw new Error('bundle header is malformed');
  }
  return { name: head.name, mime: head.mime, bytes: plain.slice(4 + length) };
}

// Un file resta com'è, più file diventano uno ZIP (spec §2.8). La chiave nasce qui,
// nel browser dell'host, e torna solo al chiamante: finisce nel frammento del link.
export async function sealBundle(files: BundleFile[]): Promise<{ blob: Uint8Array; key: string }> {
  if (files.length === 0) throw new Error('bundle has no files');
  const single = files.length === 1 ? files[0]! : null;
  const plain = envelope(
    single ?? { name: ZIP_NAME, mime: 'application/zip', bytes: zipFiles(files) },
  );

  const cryptoKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: KEY_BITS }, true, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const version = new Uint8Array([FORMAT_VERSION]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: version }, cryptoKey, plain),
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', cryptoKey));

  const blob = new Uint8Array(1 + IV_BYTES + cipher.byteLength);
  blob.set(version, 0);
  blob.set(iv, 1);
  blob.set(cipher, 1 + IV_BYTES);
  return { blob, key: toBase64Url(raw) };
}

// Chiave sbagliata o blob alterato: AES-GCM rifiuta, e qui si propaga l'errore.
export async function openBundle(blob: Uint8Array, key: string): Promise<OpenedBundle> {
  if (blob.byteLength <= 1 + IV_BYTES || blob[0] !== FORMAT_VERSION) {
    throw new Error('bundle format is not supported');
  }
  const cryptoKey = await crypto.subtle.importKey('raw', fromBase64Url(key), 'AES-GCM', false, [
    'decrypt',
  ]);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: blob.slice(1, 1 + IV_BYTES), additionalData: blob.slice(0, 1) },
    cryptoKey,
    blob.slice(1 + IV_BYTES),
  );
  return unwrap(new Uint8Array(plain));
}
