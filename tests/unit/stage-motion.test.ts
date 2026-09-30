import { describe, expect, it, vi } from 'vitest';
import type { Content, Stage, StageWindow } from '@omnicanvas/canvas';
import { commitStage, motionAllowed, stageChanges } from '@/lib/stage/motion';

const chart = (id: string): Content => ({
  id,
  kind: 'chart',
  data: { title: 'Ricavi', labels: ['a'], values: [1] },
});
const win = (id: string, slot: StageWindow['slot'], contents: Content[] = []): StageWindow => ({
  id,
  title: id,
  slot,
  contents,
});
const stage = (windows: StageWindow[], version = 3): Stage => ({
  windows,
  focusedId: windows.find((w) => w.slot === 'main')?.id ?? null,
  tray: [],
  negotiation: null,
  version,
});

describe('stageChanges', () => {
  it('marks the window that received a content it did not have', () => {
    const prev = stage([win('w1', 'main')]);
    const next = stage([win('w1', 'main', [chart('c1')])]);
    expect(stageChanges(prev, next)).toEqual({ born: ['w1'], moved: [] });
  });

  it('ignores contents the window already had', () => {
    const prev = stage([win('w1', 'main', [chart('c1')])]);
    const next = stage([win('w1', 'main', [chart('c1')])]);
    expect(stageChanges(prev, next)).toEqual({ born: [], moved: [] });
  });

  it('marks a window whose slot changed as moved', () => {
    const prev = stage([win('w1', 'main'), win('w2', 'side-1')]);
    const next = stage([win('w1', 'side-1'), win('w2', 'main')]);
    expect(stageChanges(prev, next).moved.sort()).toEqual(['w1', 'w2']);
  });

  it('does not treat a new or an archived window as moved', () => {
    const prev = stage([win('w1', 'main'), win('w2', 'side-1')]);
    const next = stage([win('w1', 'main'), win('w3', 'side-2')]);
    expect(stageChanges(prev, next)).toEqual({ born: [], moved: [] });
  });

  it('counts a content moved to another window as born there', () => {
    const prev = stage([win('w1', 'main', [chart('c1')]), win('w2', 'side-1')]);
    const next = stage([win('w1', 'main'), win('w2', 'side-1', [chart('c1')])]);
    expect(stageChanges(prev, next)).toEqual({ born: ['w2'], moved: [] });
  });
});

type FakeDoc = {
  visibilityState: DocumentVisibilityState;
  startViewTransition?: (callback: () => void) => unknown;
};
const fakeWin = (reduce: boolean) =>
  ({ matchMedia: (q: string) => ({ matches: reduce && q.includes('reduce') }) }) as unknown as Window;

describe('motionAllowed', () => {
  it('needs the API, a visible page and no reduced motion', () => {
    const doc = { visibilityState: 'visible', startViewTransition: vi.fn() } as FakeDoc;
    expect(motionAllowed(doc as unknown as Document, fakeWin(false))).toBe(true);
    expect(motionAllowed(doc as unknown as Document, fakeWin(true))).toBe(false);
    expect(
      motionAllowed({ ...doc, visibilityState: 'hidden' } as unknown as Document, fakeWin(false)),
    ).toBe(false);
    expect(
      motionAllowed({ visibilityState: 'visible' } as unknown as Document, fakeWin(false)),
    ).toBe(false);
  });
});

describe('commitStage', () => {
  const moved = () => ({
    prev: stage([win('w1', 'main'), win('w2', 'side-1')]),
    next: stage([win('w1', 'side-1'), win('w2', 'main')]),
  });

  it('renders inside a view transition when a window moved', () => {
    const pending: Array<() => void> = [];
    const doc = {
      visibilityState: 'visible',
      startViewTransition: (cb: () => void) => pending.push(cb),
    };
    const render = vi.fn();
    commitStage({
      ...moved(),
      doc: doc as unknown as Document,
      win: fakeWin(false),
      render,
      onBorn: vi.fn(),
    });
    expect(render).not.toHaveBeenCalled();
    pending[0]!();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('renders at once without the API or with reduced motion', () => {
    for (const [doc, reduce] of [
      [{ visibilityState: 'visible' }, false],
      [{ visibilityState: 'visible', startViewTransition: vi.fn() }, true],
    ] as const) {
      const render = vi.fn();
      commitStage({
        ...moved(),
        doc: doc as unknown as Document,
        win: fakeWin(reduce),
        render,
        onBorn: vi.fn(),
      });
      expect(render).toHaveBeenCalledTimes(1);
    }
  });

  it('renders at once when nothing moved, and reports the births', () => {
    const start = vi.fn();
    const render = vi.fn();
    const onBorn = vi.fn();
    commitStage({
      prev: stage([win('w1', 'main')]),
      next: stage([win('w1', 'main', [chart('c1')])]),
      doc: { visibilityState: 'visible', startViewTransition: start } as unknown as Document,
      win: fakeWin(false),
      render,
      onBorn,
    });
    expect(start).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
    expect(onBorn).toHaveBeenCalledWith(['w1']);
  });

  it('animates nothing on the first load of the stage', () => {
    const start = vi.fn();
    const onBorn = vi.fn();
    const render = vi.fn();
    commitStage({
      prev: stage([], 0),
      next: stage([win('w1', 'main', [chart('c1')]), win('w2', 'side-1')], 9),
      doc: { visibilityState: 'visible', startViewTransition: start } as unknown as Document,
      win: fakeWin(false),
      render,
      onBorn,
    });
    expect(start).not.toHaveBeenCalled();
    expect(onBorn).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
