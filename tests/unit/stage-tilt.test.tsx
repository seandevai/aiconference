// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tiltEnabled, tiltFromPoint, useStageTilt } from '@/lib/stage/tilt';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rect = { left: 100, top: 50, width: 200, height: 100 };

describe('tiltFromPoint', () => {
  it('is zero in the centre and ±1 on the edges', () => {
    expect(tiltFromPoint(rect, { x: 200, y: 100 })).toEqual({ x: 0, y: 0 });
    expect(tiltFromPoint(rect, { x: 100, y: 50 })).toEqual({ x: -1, y: -1 });
    expect(tiltFromPoint(rect, { x: 300, y: 150 })).toEqual({ x: 1, y: 1 });
  });
  it('stays within ±1 outside the stage', () => {
    expect(tiltFromPoint(rect, { x: 900, y: -400 })).toEqual({ x: 1, y: -1 });
  });
  it('is zero for a stage with no size', () => {
    expect(tiltFromPoint({ left: 0, top: 0, width: 0, height: 0 }, { x: 5, y: 5 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('tiltEnabled', () => {
  it('asks for a fine pointer and motion welcome in one query', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    expect(tiltEnabled({ matchMedia } as unknown as Window)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
  });
});

describe('useStageTilt', () => {
  function Probe({ onReady }: { onReady: (api: ReturnType<typeof useStageTilt>) => void }) {
    const api = useStageTilt();
    onReady(api);
    return <div ref={api.ref} data-testid="board" />;
  }

  it('writes the tilt as CSS variables once per frame, and resets it', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let api!: ReturnType<typeof useStageTilt>;
    const { getByTestId } = render(<Probe onReady={(a) => (api = a)} />);
    const board = getByTestId('board');
    board.getBoundingClientRect = () => ({ ...rect, right: 300, bottom: 150, x: 100, y: 50, toJSON: () => ({}) });

    act(() => {
      api.pointAt({ x: 250, y: 100 });
      api.pointAt({ x: 300, y: 150 });
    });
    expect(frames).toHaveLength(1);
    act(() => frames[0]!(0));
    expect(board.style.getPropertyValue('--tilt-x')).toBe('1.000');
    expect(board.style.getPropertyValue('--tilt-y')).toBe('1.000');

    act(() => api.pointAt(null));
    act(() => frames[1]!(0));
    expect(board.style.getPropertyValue('--tilt-x')).toBe('0.000');
  });
});
