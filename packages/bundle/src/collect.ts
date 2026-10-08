import type { Content, ImageMime, Stage } from '@omnicanvas/canvas';

export type BundleFile = { name: string; mime: string; bytes: Uint8Array };

export type AssetBytes = { mime: ImageMime; bytes: Uint8Array };

const IMAGE_EXTENSIONS: Record<ImageMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const encoder = new TextEncoder();

// Nomi portabili su ogni sistema: niente accenti, separatori o percorsi.
function slug(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return base || 'contenuto';
}

// RFC 4180: virgolette se servono, righe chiuse da CRLF.
function csv(rows: (string | number)[][]): Uint8Array {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return encoder.encode(rows.map((row) => `${row.map(cell).join(',')}\r\n`).join(''));
}

function toFile(
  content: Content,
  prefix: string,
  assets: ReadonlyMap<string, AssetBytes>,
): BundleFile | null {
  const name = `${prefix}-${slug(content.data.title)}`;
  switch (content.kind) {
    case 'text':
      return {
        name: `${name}.md`,
        mime: 'text/markdown',
        bytes: encoder.encode(`# ${content.data.title}\n\n${content.data.body}\n`),
      };
    case 'chart':
      return {
        name: `${name}.csv`,
        mime: 'text/csv',
        bytes: csv([
          ['Etichetta', 'Valore'],
          ...content.data.labels.map((label, i) => [label, content.data.values[i] ?? '']),
        ]),
      };
    case 'table':
      return {
        name: `${name}.csv`,
        mime: 'text/csv',
        bytes: csv([content.data.columns, ...content.data.rows]),
      };
    case 'image': {
      const asset = assets.get(content.data.assetId);
      if (!asset) return null;
      return {
        name: `${name}.${IMAGE_EXTENSIONS[asset.mime]}`,
        mime: asset.mime,
        bytes: asset.bytes,
      };
    }
    // Mai raggiunto: collectFiles scarta lo schermo prima; serve all'esaustività.
    case 'screen':
      return null;
  }
}

// Tutto ciò che è stato prodotto: finestre, vassoio e archiviati (spec §2.8). Le immagini
// vengono dalla memoria del browser; quelle perse (host che ha ricaricato) si segnalano.
export function collectFiles(
  stage: Stage,
  assets: ReadonlyMap<string, AssetBytes>,
): { files: BundleFile[]; missing: string[] } {
  const seen = new Set<string>();
  const contents: Content[] = [];
  for (const content of [...stage.windows.flatMap((w) => w.contents), ...stage.tray]) {
    // Lo schermo condiviso non entra mai nel pacchetto (ADR-0015).
    if (content.kind === 'screen' || seen.has(content.id)) continue;
    seen.add(content.id);
    contents.push(content);
  }

  const files: BundleFile[] = [];
  const missing: string[] = [];
  for (const content of contents) {
    const file = toFile(content, String(files.length + 1).padStart(2, '0'), assets);
    if (file) files.push(file);
    else missing.push(content.data.title);
  }
  return { files, missing };
}
