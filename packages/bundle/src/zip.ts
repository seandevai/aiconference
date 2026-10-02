import type { BundleFile } from './collect';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Data DOS fissa (1/1/1980): il pacchetto non dice quando si è tenuta la riunione.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
// Bit 11: nomi in UTF-8.
const UTF8_FLAG = 0x0800;

// ZIP senza compressione (metodo STORE): i contenuti sono piccoli e le immagini già
// compresse, e così non serve una libreria. Niente ZIP64: il pacchetto resta ben sotto i 4 GB.
export function zipFiles(files: BundleFile[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({
    name: encoder.encode(file.name),
    bytes: file.bytes,
    crc: crc32(file.bytes),
    offset: 0,
  }));

  const localSize = entries.reduce(
    (sum, e) => sum + 30 + e.name.byteLength + e.bytes.byteLength,
    0,
  );
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.byteLength, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let at = 0;

  for (const entry of entries) {
    entry.offset = at;
    view.setUint32(at, 0x04034b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, UTF8_FLAG, true);
    view.setUint16(at + 8, 0, true);
    view.setUint16(at + 10, DOS_TIME, true);
    view.setUint16(at + 12, DOS_DATE, true);
    view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.bytes.byteLength, true);
    view.setUint32(at + 22, entry.bytes.byteLength, true);
    view.setUint16(at + 26, entry.name.byteLength, true);
    view.setUint16(at + 28, 0, true);
    out.set(entry.name, at + 30);
    out.set(entry.bytes, at + 30 + entry.name.byteLength);
    at += 30 + entry.name.byteLength + entry.bytes.byteLength;
  }

  const centralStart = at;
  for (const entry of entries) {
    view.setUint32(at, 0x02014b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, 20, true);
    view.setUint16(at + 8, UTF8_FLAG, true);
    view.setUint16(at + 10, 0, true);
    view.setUint16(at + 12, DOS_TIME, true);
    view.setUint16(at + 14, DOS_DATE, true);
    view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.bytes.byteLength, true);
    view.setUint32(at + 24, entry.bytes.byteLength, true);
    view.setUint16(at + 28, entry.name.byteLength, true);
    // Campo extra, commento, disco, attributi interni ed esterni: tutti a zero.
    view.setUint32(at + 42, entry.offset, true);
    out.set(entry.name, at + 46);
    at += 46 + entry.name.byteLength;
  }

  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, at - centralStart, true);
  view.setUint32(at + 16, centralStart, true);
  return out;
}
