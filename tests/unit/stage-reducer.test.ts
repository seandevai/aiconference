import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENTS_PER_WINDOW,
  applyCommand,
  emptyStage,
  orderedWindows,
  type Content,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';

const text = (id: string, title = 'Nota'): Content => ({
  id,
  kind: 'text',
  data: { title, body: 'corpo' },
});

function run(commands: StageCommand[], from: Stage = emptyStage()): Stage {
  return commands.reduce(applyCommand, from);
}

const threeWindows = run([
  { type: 'WINDOW_CREATE', windowId: 'A', title: 'A' },
  { type: 'WINDOW_CREATE', windowId: 'B', title: 'B' },
  { type: 'WINDOW_CREATE', windowId: 'C', title: 'C' },
]);

const slotOf = (stage: Stage, id: string) => stage.windows.find((w) => w.id === id)?.slot;

describe('applyCommand', () => {
  it('adds content to the tray once', () => {
    const once = applyCommand(emptyStage(), { type: 'TRAY_ADD', content: text('t1') });
    expect(once.tray.map((c) => c.id)).toEqual(['t1']);
    expect(applyCommand(once, { type: 'TRAY_ADD', content: text('t1') })).toBe(once);
  });

  it('puts the first window in main and the next ones at the side', () => {
    expect(threeWindows.windows.map((w) => [w.id, w.slot])).toEqual([
      ['A', 'main'],
      ['B', 'side-1'],
      ['C', 'side-2'],
    ]);
    expect(threeWindows.focusedId).toBe('A');
  });

  it('refuses a fifth window and duplicate ids', () => {
    const four = applyCommand(threeWindows, { type: 'WINDOW_CREATE', windowId: 'D', title: 'D' });
    expect(four.windows).toHaveLength(4);
    expect(applyCommand(four, { type: 'WINDOW_CREATE', windowId: 'E', title: 'E' })).toBe(four);
    expect(applyCommand(four, { type: 'WINDOW_CREATE', windowId: 'A', title: 'A2' })).toBe(four);
  });

  it('swaps windows when moving onto an occupied slot', () => {
    const moved = applyCommand(threeWindows, { type: 'WINDOW_MOVE', windowId: 'C', slot: 'main' });
    expect(slotOf(moved, 'C')).toBe('main');
    expect(slotOf(moved, 'A')).toBe('side-2');
    expect(moved.focusedId).toBe('C');
  });

  it('moves to an empty slot without touching the others', () => {
    const moved = applyCommand(threeWindows, {
      type: 'WINDOW_MOVE',
      windowId: 'B',
      slot: 'side-3',
    });
    expect(slotOf(moved, 'B')).toBe('side-3');
    expect(slotOf(moved, 'A')).toBe('main');
  });

  it('focuses a side window by swapping it with main', () => {
    const focused = applyCommand(threeWindows, { type: 'FOCUS', windowId: 'B' });
    expect(focused.focusedId).toBe('B');
    expect(slotOf(focused, 'A')).toBe('side-1');
    expect(applyCommand(focused, { type: 'FOCUS', windowId: 'B' })).toBe(focused);
  });

  it('rotates focus forward and backward', () => {
    const next = applyCommand(threeWindows, { type: 'FOCUS_NEXT' });
    expect(orderedWindows(next).map((w) => w.id)).toEqual(['B', 'C', 'A']);
    const prev = applyCommand(threeWindows, { type: 'FOCUS_PREV' });
    expect(orderedWindows(prev).map((w) => w.id)).toEqual(['C', 'A', 'B']);
    const single = run([{ type: 'WINDOW_CREATE', windowId: 'A', title: 'A' }]);
    expect(applyCommand(single, { type: 'FOCUS_NEXT' })).toBe(single);
  });

  it('places content from the tray into a window, clearing the archived flag', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: { ...text('t1'), archived: true } },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' },
      ],
      threeWindows,
    );
    expect(stage.tray).toEqual([]);
    expect(stage.windows.find((w) => w.id === 'A')?.contents).toEqual([text('t1')]);
  });

  it('moves content between windows', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: text('t1') },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'B' },
      ],
      threeWindows,
    );
    expect(stage.windows.find((w) => w.id === 'A')?.contents).toEqual([]);
    expect(stage.windows.find((w) => w.id === 'B')?.contents.map((c) => c.id)).toEqual(['t1']);
  });

  it('ignores placing into a full window or an unknown target', () => {
    const fill: StageCommand[] = Array.from({ length: MAX_CONTENTS_PER_WINDOW }, (_, i) => [
      { type: 'TRAY_ADD', content: text(`c${i}`) } as const,
      { type: 'CONTENT_PLACE', contentId: `c${i}`, windowId: 'A' } as const,
    ]).flat();
    const full = run([...fill, { type: 'TRAY_ADD', content: text('extra') }], threeWindows);
    expect(applyCommand(full, { type: 'CONTENT_PLACE', contentId: 'extra', windowId: 'A' })).toBe(
      full,
    );
    expect(applyCommand(full, { type: 'CONTENT_PLACE', contentId: 'extra', windowId: 'Z' })).toBe(
      full,
    );
    expect(applyCommand(full, { type: 'CONTENT_PLACE', contentId: 'nope', windowId: 'B' })).toBe(
      full,
    );
  });

  it('sends removed content back to the tray as archived', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: text('t1') },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' },
        { type: 'CONTENT_REMOVE', contentId: 't1' },
      ],
      threeWindows,
    );
    expect(stage.tray).toEqual([{ ...text('t1'), archived: true }]);
  });

  it('archives the main window, promoting the first side window', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: text('t1') },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' },
        { type: 'WINDOW_ARCHIVE', windowId: 'A' },
      ],
      threeWindows,
    );
    expect(stage.windows.map((w) => [w.id, w.slot])).toEqual([
      ['B', 'main'],
      ['C', 'side-2'],
    ]);
    expect(stage.focusedId).toBe('B');
    expect(stage.tray).toEqual([{ ...text('t1'), archived: true }]);
  });

  it('empties focus when the last window is archived', () => {
    const one = run([{ type: 'WINDOW_CREATE', windowId: 'A', title: 'A' }]);
    expect(applyCommand(one, { type: 'WINDOW_ARCHIVE', windowId: 'A' }).focusedId).toBeNull();
  });

  it('never mutates its input', () => {
    const before = structuredClone(threeWindows);
    run([{ type: 'FOCUS_NEXT' }, { type: 'WINDOW_ARCHIVE', windowId: 'B' }], threeWindows);
    expect(threeWindows).toEqual(before);
  });
});
