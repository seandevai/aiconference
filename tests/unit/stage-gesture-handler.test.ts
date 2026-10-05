import { describe, expect, it, vi } from 'vitest';
import { applyCommand, emptyStage, type Stage } from '@omnicanvas/canvas';
import { createStageGestureHandler } from '@/lib/stage/stage-gesture-handler';

function stageWithWindow(): Stage {
  return applyCommand(emptyStage(), { type: 'WINDOW_CREATE', windowId: 'w1', title: 'Finestra 1' });
}

function setup(overrides: Partial<Parameters<typeof createStageGestureHandler>[0]> = {}) {
  const deps = {
    toScreen: (x: number, y: number) => ({ x: x * 1000, y: y * 500 }),
    getStage: stageWithWindow,
    dispatch: vi.fn(),
    onAgent: vi.fn(),
    onArmed: vi.fn(),
    onCursor: vi.fn(),
    newId: () => 'new-id',
    itemAt: vi.fn(() => ({ type: 'window' as const, id: 'w1' })),
    slotRects: () => ({ 'side-1': { x: 600, y: 0, width: 200, height: 200 } }),
    ...overrides,
  };
  return { deps, handle: createStageGestureHandler(deps) };
}

describe('createStageGestureHandler', () => {
  it('reports the armed state', () => {
    const { deps, handle } = setup();
    handle({ type: 'GESTURES_TOGGLE', armed: true });
    expect(deps.onArmed).toHaveBeenCalledWith(true);
  });

  it('grabs the item under the hand, moves the cursor and drops into the nearest slot', () => {
    const { deps, handle } = setup();
    handle({ type: 'GRAB', x: 0.1, y: 0.1 });
    expect(deps.itemAt).toHaveBeenCalledWith(100, 50);
    expect(deps.onCursor).toHaveBeenLastCalledWith({ x: 100, y: 50, grabbing: true });
    handle({ type: 'MOVE', x: 0.7, y: 0.2 });
    expect(deps.onCursor).toHaveBeenLastCalledWith({ x: 700, y: 100, grabbing: true });
    handle({ type: 'DROP', x: 0.7, y: 0.2 });
    expect(deps.onCursor).toHaveBeenLastCalledWith(null);
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: 'WINDOW_MOVE',
      windowId: 'w1',
      slot: 'side-1',
    });
  });

  it('shows a plain cursor when nothing is under the hand', () => {
    const { deps, handle } = setup({ itemAt: vi.fn(() => null) });
    handle({ type: 'GRAB', x: 0.5, y: 0.5 });
    expect(deps.onCursor).toHaveBeenLastCalledWith({ x: 500, y: 250, grabbing: false });
    handle({ type: 'DROP', x: 0.5, y: 0.5 });
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it('turns discrete gestures into stage commands or agent requests', () => {
    const { deps, handle } = setup();
    handle({ type: 'FOCUS_NEXT' });
    expect(deps.dispatch).toHaveBeenCalledWith({ type: 'FOCUS_NEXT' });
    handle({ type: 'WINDOW_CREATE' });
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: 'WINDOW_CREATE',
      windowId: 'new-id',
      title: 'Finestra 2',
    });
    handle({ type: 'AGENT_ACTIVATE' });
    expect(deps.onAgent).toHaveBeenCalled();
  });

  it('ignores pointer events outside the stage area', () => {
    const { deps, handle } = setup({ toScreen: () => null });
    handle({ type: 'GRAB', x: 0.5, y: 0.5 });
    expect(deps.onCursor).not.toHaveBeenCalled();
  });
});
