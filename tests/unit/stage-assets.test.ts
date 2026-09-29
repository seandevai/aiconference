import { describe, expect, it } from 'vitest';
import {
  MAX_ASSET_BYTES,
  applyCommand,
  emptyStage,
  imageAssetIds,
  packAsset,
  sampleContent,
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
