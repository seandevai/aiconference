import { describe, expect, it } from 'vitest';
import { stageCounter } from '@/lib/stage/stage-counter';

const win = (id: string) => ({ id }) as never;

describe('stageCounter', () => {
  it('says which window is in front and how many there are', () => {
    expect(stageCounter({ windows: [win('a'), win('b'), win('c')], focusedId: 'b' })).toBe(
      'Finestra 2 di 3',
    );
  });
  it('is empty without windows', () => {
    expect(stageCounter({ windows: [], focusedId: null })).toBeNull();
  });
  it('falls back to the first window when the focus is unknown', () => {
    expect(stageCounter({ windows: [win('a'), win('b')], focusedId: 'zzz' })).toBe(
      'Finestra 1 di 2',
    );
  });
});
