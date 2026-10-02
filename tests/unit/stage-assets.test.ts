import { describe, expect, it } from 'vitest';
import {
  MAX_ASSET_BYTES,
  applyCommand,
  contentSchema,
  emptyStage,
  imageAssetIds,
  imageHashes,
  packAsset,
  sampleContent,
  sha256Hex,
  unpackAsset,
} from '@omnicanvas/canvas';

const assetId = '00000000-0000-4000-8000-000000000001';

describe('asset packets', () => {
  it('round-trips header and bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    const unpacked = unpackAsset(packAsset({ assetId, mime: 'image/png' }, bytes));
    expect(unpacked?.header).toEqual({ assetId, mime: 'image/png' });
    expect([...unpacked!.bytes]).toEqual([1, 2, 3, 250]);
  });

  it('returns null for truncated or forged packets', () => {
    const packed = packAsset({ assetId, mime: 'image/png' }, new Uint8Array([1]));
    expect(unpackAsset(packed.slice(0, 3))).toBeNull();
    expect(unpackAsset(new Uint8Array([0, 0, 0, 2, 123, 125]))).toBeNull();
    expect(unpackAsset(new Uint8Array([0, 0, 255, 255, 1]))).toBeNull();
  });

  it('refuses images over the size limit', () => {
    expect(() =>
      packAsset({ assetId, mime: 'image/png' }, new Uint8Array(MAX_ASSET_BYTES + 1)),
    ).toThrow(/too large/);
  });

  it('lists the image assets referenced by a stage', () => {
    const image = {
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'image' as const,
      data: { title: 'Schema', assetId, mime: 'image/png' as const, alt: 'schema' },
    };
    const stage = [
      { type: 'TRAY_ADD', content: image } as const,
      {
        type: 'TRAY_ADD',
        content: sampleContent('text', '00000000-0000-4000-8000-000000000003'),
      } as const,
    ].reduce(applyCommand, emptyStage());
    expect(imageAssetIds(stage)).toEqual([assetId]);
  });
});

describe('image integrity', () => {
  it('hashes bytes with SHA-256 in hex', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('maps every image on the stage to its hash, when it has one', () => {
    const hash = 'a'.repeat(64);
    const image = (n: number, sha256?: string) => ({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      kind: 'image' as const,
      data: {
        title: 'x',
        assetId: `20000000-0000-4000-8000-00000000000${n}`,
        mime: 'image/png' as const,
        alt: '',
        ...(sha256 ? { sha256 } : {}),
      },
    });
    const stage = { ...emptyStage(), tray: [image(1, hash), image(2)] };
    expect(imageHashes(stage)).toEqual(new Map([['20000000-0000-4000-8000-000000000001', hash]]));
  });

  it('accepts a well formed hash in the content schema, and only that', () => {
    const content = {
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'image',
      data: {
        title: 'x',
        assetId: '20000000-0000-4000-8000-000000000001',
        mime: 'image/png',
        alt: '',
        sha256: 'b'.repeat(64),
      },
    };
    expect(contentSchema.safeParse(content).success).toBe(true);
    const bad = { ...content, data: { ...content.data, sha256: 'xyz' } };
    expect(contentSchema.safeParse(bad).success).toBe(false);
  });
});
