import { z } from 'zod';
import type { ImageMime, Stage } from './types';

export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_HEADER_BYTES = 1024;

export type AssetHeader = { assetId: string; mime: ImageMime };

const headerSchema = z.object({
  assetId: z.uuid(),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

// Formato: 4 byte big-endian con la lunghezza dell'header, header JSON, byte dell'immagine.
export function packAsset(header: AssetHeader, bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    throw new Error(`image is too large: ${bytes.byteLength} bytes, max ${MAX_ASSET_BYTES}`);
  }
  const head = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(4 + head.byteLength + bytes.byteLength);
  new DataView(out.buffer).setUint32(0, head.byteLength);
  out.set(head, 4);
  out.set(bytes, 4 + head.byteLength);
  return out;
}

export function unpackAsset(packed: Uint8Array): { header: AssetHeader; bytes: Uint8Array } | null {
  if (packed.byteLength < 4) return null;
  const length = new DataView(packed.buffer, packed.byteOffset, packed.byteLength).getUint32(0);
  if (length === 0 || length > MAX_HEADER_BYTES || 4 + length > packed.byteLength) return null;
  try {
    const parsed = headerSchema.safeParse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(packed.subarray(4, 4 + length))),
    );
    if (!parsed.success) return null;
    const bytes = packed.subarray(4 + length);
    if (bytes.byteLength > MAX_ASSET_BYTES) return null;
    return { header: parsed.data, bytes };
  } catch {
    return null;
  }
}

// Impronta dei byte di un'immagine, in esadecimale. Web Crypto: c'è nel browser e in Node.
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Le impronte delle immagini sul palco, per verificare byte arrivati da un ospite.
export function imageHashes(stage: Stage): Map<string, string> {
  const all = [...stage.tray, ...stage.windows.flatMap((w) => w.contents)];
  return new Map(
    all.flatMap((c) =>
      c.kind === 'image' && c.data.sha256 ? [[c.data.assetId, c.data.sha256] as const] : [],
    ),
  );
}

export function imageAssetIds(stage: Stage): string[] {
  const all = [...stage.tray, ...stage.windows.flatMap((w) => w.contents)];
  return [...new Set(all.flatMap((c) => (c.kind === 'image' ? [c.data.assetId] : [])))];
}
