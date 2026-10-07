import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  emptyStage,
  openNegotiation,
  parseStage,
  type Content,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';

const W = '10000000-0000-4000-8000-000000000001';
const W2 = '10000000-0000-4000-8000-000000000002';
const S = '00000000-0000-4000-8000-0000000000a1';
const S2 = '00000000-0000-4000-8000-0000000000b2';
const N = '00000000-0000-4000-8000-000000000001';

const screen = (id = S): Content => ({
  id,
  kind: 'screen',
  data: { title: 'Schermo', owner: 'host-1' },
});
const note: Content = { id: N, kind: 'text', data: { title: 'Nota', body: 'x' } };

const run = (commands: StageCommand[], from: Stage = emptyStage()): Stage =>
  commands.reduce(applyCommand, from);

const withScreenWindow = () =>
  run([
    { type: 'TRAY_ADD', content: screen() },
    { type: 'WINDOW_CREATE', windowId: W, title: 'Schermo' },
    { type: 'CONTENT_PLACE', contentId: S, windowId: W },
  ]);

describe('screen content', () => {
  it('validates in a stage snapshot', () => {
    expect(parseStage(withScreenWindow())).not.toBeNull();
  });

  it('rejects an empty owner', () => {
    const stage = withScreenWindow();
    const broken = {
      ...stage,
      windows: [
        {
          ...stage.windows[0]!,
          contents: [{ ...screen(), data: { title: 'Schermo', owner: '' } }],
        },
      ],
    };
    expect(parseStage(broken)).toBeNull();
  });

  it('allows a single screen on the stage', () => {
    const stage = applyCommand(withScreenWindow(), { type: 'TRAY_ADD', content: screen(S2) });
    expect(stage.tray).toEqual([]);
  });

  it('is dropped, not archived, when removed from its window', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: note },
        { type: 'CONTENT_PLACE', contentId: N, windowId: W },
        { type: 'CONTENT_REMOVE', contentId: S },
      ],
      withScreenWindow(),
    );
    expect(stage.windows[0]!.contents.map((c) => c.id)).toEqual([N]);
    expect(stage.tray).toEqual([]);
  });

  it('is dropped, not archived, when its window is archived', () => {
    const stage = applyCommand(withScreenWindow(), { type: 'WINDOW_ARCHIVE', windowId: W });
    expect(stage.windows).toEqual([]);
    expect(stage.tray).toEqual([]);
  });

  it('is dropped from the tray too', () => {
    const stage = run([
      { type: 'TRAY_ADD', content: screen() },
      { type: 'CONTENT_REMOVE', contentId: S },
    ]);
    expect(stage.tray).toEqual([]);
  });

  it('stays as it is when its window moves between slots', () => {
    const stage = run(
      [
        { type: 'WINDOW_CREATE', windowId: W2, title: 'Altra' },
        { type: 'WINDOW_MOVE', windowId: W, slot: 'side-1' },
      ],
      withScreenWindow(),
    );
    const moved = stage.windows.find((w) => w.id === W)!;
    expect(moved.slot).toBe('side-1');
    expect(moved.contents).toEqual([screen()]);
  });

  it('cannot be negotiated', () => {
    const stage = withScreenWindow();
    expect(
      openNegotiation(stage, { contentId: S, guestId: 'g', maxEdits: 3, hostPays: false }),
    ).toBe(stage);
  });
});
