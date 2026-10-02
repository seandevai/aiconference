import { describe, expect, it } from 'vitest';
import { emptyStage, type Content, type Stage } from '@omnicanvas/canvas';
import {
  bundleLink,
  collectFiles,
  crc32,
  keyFromFragment,
  openBundle,
  sealBundle,
  zipFiles,
  type BundleFile,
} from '@omnicanvas/bundle';

const text = (n: number, extra: Partial<Content> = {}): Content =>
  ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    kind: 'text',
    data: { title: `Nota ${n}`, body: `Testo ${n}` },
    ...extra,
  }) as Content;

const stageWith = (windows: Content[][], tray: Content[]): Stage => ({
  ...emptyStage(),
  windows: windows.map((contents, i) => ({
    id: `10000000-0000-4000-8000-00000000000${i}`,
    title: `Finestra ${i + 1}`,
    slot: (['main', 'side-1', 'side-2', 'side-3'] as const)[i]!,
    contents,
  })),
  tray,
});

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('collectFiles', () => {
  it('turns every content into a file: windows, tray and archived ones', () => {
    const stage = stageWith([[text(1)]], [text(2), text(3, { archived: true })]);
    const { files, missing } = collectFiles(stage, new Map());
    expect(files.map((f) => f.name)).toEqual(['01-nota-1.md', '02-nota-2.md', '03-nota-3.md']);
    expect(decode(files[0]!.bytes)).toBe('# Nota 1\n\nTesto 1\n');
    expect(missing).toEqual([]);
  });

  it('writes charts and tables as CSV, quoting what needs quoting', () => {
    const chart: Content = {
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'chart',
      data: { title: 'Vendite', labels: ['Q1', 'Q2, bis'], values: [10, 12.5] },
    };
    const table: Content = {
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'table',
      data: { title: 'Piano "B"', columns: ['Voce', 'Nota'], rows: [['a', 'riga\ndue']] },
    };
    const { files } = collectFiles(stageWith([], [chart, table]), new Map());
    expect(files[0]).toMatchObject({ name: '01-vendite.csv', mime: 'text/csv' });
    expect(decode(files[0]!.bytes)).toBe('Etichetta,Valore\r\nQ1,10\r\n"Q2, bis",12.5\r\n');
    expect(files[1]!.name).toBe('02-piano-b.csv');
    expect(decode(files[1]!.bytes)).toBe('Voce,Nota\r\na,"riga\ndue"\r\n');
  });

  it('takes image bytes from memory and reports the ones it does not have', () => {
    const image = (n: number): Content => ({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      kind: 'image',
      data: {
        title: `Schema ${n}`,
        assetId: `20000000-0000-4000-8000-00000000000${n}`,
        mime: 'image/png',
        alt: '',
      },
    });
    const bytes = new Uint8Array([1, 2, 3]);
    const assets = new Map([
      ['20000000-0000-4000-8000-000000000001', { mime: 'image/png' as const, bytes }],
    ]);
    const { files, missing } = collectFiles(stageWith([], [image(1), image(2)]), assets);
    expect(files).toEqual([{ name: '01-schema-1.png', mime: 'image/png', bytes }]);
    expect(missing).toEqual(['Schema 2']);
  });

  it('keeps names safe and unique', () => {
    const odd = { ...text(1), data: { title: '../../Èlite: Q1/Q2?', body: '' } } as Content;
    const { files } = collectFiles(stageWith([], [odd]), new Map());
    expect(files[0]!.name).toBe('01-elite-q1-q2.md');
  });
});

// Lettore minimo per i test: indice centrale del ZIP, solo metodo STORE.
function readZip(zip: Uint8Array): { name: string; bytes: Uint8Array; crc: number }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    expect(view.getUint16(at + 10, true)).toBe(0);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decode(zip.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + localExtra;
    out.push({ name, bytes: zip.subarray(start, start + size), crc });
    at += 46 + nameLength + extra + comment;
  }
  return out;
}

describe('zipFiles', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
  });

  it('stores every file so any unzip tool reads it back', () => {
    const files: BundleFile[] = [
      { name: '01-nota.md', mime: 'text/markdown', bytes: new TextEncoder().encode('# Nota\n') },
      { name: '02-perché.csv', mime: 'text/csv', bytes: new TextEncoder().encode('a,b\r\n') },
    ];
    const entries = readZip(zipFiles(files));
    expect(entries.map((e) => e.name)).toEqual(['01-nota.md', '02-perché.csv']);
    expect(decode(entries[0]!.bytes)).toBe('# Nota\n');
    expect(entries[1]!.crc).toBe(crc32(files[1]!.bytes));
  });

  it('does not record when the meeting happened', () => {
    const files: BundleFile[] = [
      { name: 'a.md', mime: 'text/markdown', bytes: new Uint8Array([1]) },
    ];
    expect(zipFiles(files)).toEqual(zipFiles(files));
  });
});

describe('sealBundle and openBundle', () => {
  const files: BundleFile[] = [
    { name: '01-nota.md', mime: 'text/markdown', bytes: new TextEncoder().encode('# Nota\n') },
  ];

  it('round-trips a single file with its name and type', async () => {
    const { blob, key } = await sealBundle(files);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const opened = await openBundle(blob, key);
    expect(opened).toEqual({ name: '01-nota.md', mime: 'text/markdown', bytes: files[0]!.bytes });
  });

  it('zips more than one file', async () => {
    const two = [...files, { ...files[0]!, name: '02-altra.md' }];
    const { blob, key } = await sealBundle(two);
    const opened = await openBundle(blob, key);
    expect(opened.mime).toBe('application/zip');
    expect(opened.name).toMatch(/\.zip$/);
    expect(readZip(opened.bytes).map((e) => e.name)).toEqual(['01-nota.md', '02-altra.md']);
  });

  it('leaves nothing readable in the blob the server stores', async () => {
    const secret = [
      {
        name: 'riservato.md',
        mime: 'text/markdown',
        bytes: new TextEncoder().encode('margine 42%'),
      },
    ];
    const { blob, key } = await sealBundle(secret);
    const visible = new TextDecoder('latin1').decode(blob);
    expect(visible).not.toContain('margine');
    expect(visible).not.toContain('riservato');
    expect(visible).not.toContain(key);
  });

  it('uses a fresh key and IV every time', async () => {
    const a = await sealBundle(files);
    const b = await sealBundle(files);
    expect(a.key).not.toBe(b.key);
    expect(a.blob).not.toEqual(b.blob);
  });

  it('refuses a wrong key or a tampered blob', async () => {
    const { blob, key } = await sealBundle(files);
    const other = await sealBundle(files);
    await expect(openBundle(blob, other.key)).rejects.toThrow();
    const tampered = blob.slice();
    tampered[tampered.length - 1]! ^= 1;
    await expect(openBundle(tampered, key)).rejects.toThrow();
  });

  it('refuses an empty bundle', async () => {
    await expect(sealBundle([])).rejects.toThrow();
  });
});

describe('bundleLink and keyFromFragment', () => {
  const key = 'A'.repeat(43);

  it('keeps the key in the fragment, which the browser never sends to the server', () => {
    const link = bundleLink('https://nod.example', 'b1', key);
    expect(link).toBe(`https://nod.example/p/b1#${key}`);
    const url = new URL(link);
    expect(url.pathname + url.search).not.toContain(key);
    expect(url.hash).toBe(`#${key}`);
  });

  it('reads the key back from location.hash and rejects anything else', () => {
    expect(keyFromFragment(`#${key}`)).toBe(key);
    expect(keyFromFragment('')).toBeNull();
    expect(keyFromFragment('#corta')).toBeNull();
    expect(keyFromFragment(`#${key}x`)).toBeNull();
  });
});
