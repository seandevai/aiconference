// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING } from '@omnicanvas/gesture';

const drawing = vi.hoisted(() => ({ drawHands: vi.fn() }));
vi.mock('@/lib/gesture-lab/hand-drawing', () => drawing);

const { HandPanel } = await import('@/app/dev/gesture-lab/hand-panel');

function renderPanel(props: { feedback: boolean; replaying: boolean }) {
  render(
    <HandPanel
      videoRef={{ current: null }}
      framesRef={{ current: null }}
      view={null}
      hand={null}
      tuning={DEFAULT_TUNING}
      idle={false}
      {...props}
    />,
  );
}

beforeEach(() => {
  drawing.drawHands.mockReset();
  // Un solo giro del ciclo di disegno basta a sapere se disegna.
  let calls = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    if (calls++ === 0) cb(0);
    return calls;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HandPanel during a replay', () => {
  it('draws the hand even with the feedback toggle off, and says there is no video', () => {
    renderPanel({ feedback: false, replaying: true });
    expect(drawing.drawHands).toHaveBeenCalled();
    expect(screen.getByText(/solo i punti della mano/)).toBeTruthy();
  });

  it('draws nothing live when the feedback toggle is off', () => {
    renderPanel({ feedback: false, replaying: false });
    expect(drawing.drawHands).not.toHaveBeenCalled();
    expect(screen.queryByText(/solo i punti della mano/)).toBeNull();
  });
});
