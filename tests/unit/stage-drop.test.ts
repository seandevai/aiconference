import { describe, expect, it } from 'vitest';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import { resolveDrop } from '@/lib/stage/drop';

const stage = [
  { type: 'WINDOW_CREATE', windowId: 'A', title: 'A' } as const,
  { type: 'WINDOW_CREATE', windowId: 'B', title: 'B' } as const,
].reduce(applyCommand, emptyStage());

describe('resolveDrop', () => {
  it('moves a window to the slot it was dropped on', () => {
    expect(resolveDrop(stage, { type: 'window', id: 'B' }, 'main')).toEqual({
      type: 'WINDOW_MOVE',
      windowId: 'B',
      slot: 'main',
    });
  });

  it('places content into the window that sits in the slot', () => {
    expect(resolveDrop(stage, { type: 'content', id: 'c1' }, 'side-1')).toEqual({
      type: 'CONTENT_PLACE',
      contentId: 'c1',
      windowId: 'B',
    });
  });

  it('does nothing when content is dropped on an empty slot', () => {
    expect(resolveDrop(stage, { type: 'content', id: 'c1' }, 'side-3')).toBeNull();
  });
});
