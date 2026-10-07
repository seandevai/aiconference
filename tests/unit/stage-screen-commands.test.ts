import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENTS_PER_WINDOW,
  MAX_TRAY,
  applyCommand,
  emptyStage,
  findScreen,
  screenEndCommands,
  screenStartCommands,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';

const ids = {
  owner: 'host-1',
  contentId: '00000000-0000-4000-8000-0000000000a1',
  windowId: '10000000-0000-4000-8000-0000000000a1',
};
const win = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const run = (commands: StageCommand[], from: Stage = emptyStage()): Stage =>
  commands.reduce(applyCommand, from);
const start = (stage: Stage) => run(screenStartCommands(stage, ids), stage);

describe('screenStartCommands', () => {
  it('opens a «Schermo» window in the main slot', () => {
    const stage = start(run([{ type: 'WINDOW_CREATE', windowId: win(1), title: 'Uno' }]));
    const shown = stage.windows.find((w) => w.id === ids.windowId)!;
    expect(shown.slot).toBe('main');
    expect(shown.title).toBe('Schermo');
    expect(shown.contents).toEqual([
      { id: ids.contentId, kind: 'screen', data: { title: 'Schermo', owner: 'host-1' } },
    ]);
  });

  it('uses the focused window when the stage is full', () => {
    const full = run(
      [1, 2, 3, 4].map(
        (n) => ({ type: 'WINDOW_CREATE', windowId: win(n), title: `F${n}` }) as const,
      ),
    );
    const stage = start(full);
    expect(stage.windows).toHaveLength(4);
    const focused = stage.windows.find((w) => w.id === stage.focusedId)!;
    expect(focused.contents.map((c) => c.kind)).toEqual(['screen']);
  });

  it('does nothing when the tray is full', () => {
    const tray = Array.from({ length: MAX_TRAY }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      kind: 'text' as const,
      data: { title: 'x', body: '' },
    }));
    expect(screenStartCommands({ ...emptyStage(), tray }, ids)).toEqual([]);
  });

  it('does nothing when a screen is already there', () => {
    const once = start(emptyStage());
    expect(
      screenStartCommands(once, {
        ...ids,
        contentId: win(9),
        windowId: win(8),
      }),
    ).toEqual([]);
  });
});

describe('screenEndCommands', () => {
  it('archives the window when the screen was alone in it', () => {
    const stage = run(screenEndCommands(start(emptyStage())), start(emptyStage()));
    expect(stage.windows).toEqual([]);
    expect(findScreen(stage)).toBeNull();
  });

  it('removes only the screen when the window holds other contents', () => {
    const note = {
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'text',
      data: { title: 'N', body: '' },
    } as const;
    const full = run(
      [1, 2, 3, 4].map(
        (n) => ({ type: 'WINDOW_CREATE', windowId: win(n), title: `F${n}` }) as const,
      ),
    );
    const withNote = run(
      [
        { type: 'TRAY_ADD', content: note },
        { type: 'CONTENT_PLACE', contentId: note.id, windowId: full.focusedId! },
      ],
      full,
    );
    const sharing = start(withNote);
    const stage = run(screenEndCommands(sharing), sharing);
    expect(stage.windows).toHaveLength(4);
    expect(stage.windows.find((w) => w.id === full.focusedId)!.contents.map((c) => c.id)).toEqual([
      note.id,
    ]);
  });

  it('clears a screen left in the tray when the focused window was full', () => {
    const full = run(
      [1, 2, 3, 4].map(
        (n) => ({ type: 'WINDOW_CREATE', windowId: win(n), title: `F${n}` }) as const,
      ),
    );
    let crowded = full;
    for (let i = 0; i < MAX_CONTENTS_PER_WINDOW; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      crowded = run(
        [
          {
            type: 'TRAY_ADD',
            content: { id, kind: 'text', data: { title: 'x', body: '' } },
          },
          { type: 'CONTENT_PLACE', contentId: id, windowId: full.focusedId! },
        ],
        crowded,
      );
    }
    const stuck = start(crowded);
    expect(findScreen(stuck)?.id).toBe(ids.contentId);
    expect(findScreen(run(screenEndCommands(stuck), stuck))).toBeNull();
  });

  it('does nothing without a screen', () => {
    expect(screenEndCommands(emptyStage())).toEqual([]);
  });
});
