// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecognizerView } from '@omnicanvas/gesture';

const drawing = vi.hoisted(() => ({ drawHands: vi.fn() }));
vi.mock('@/lib/gesture-lab/hand-drawing', () => drawing);

const { HandView } = await import('@/app/dev/gesture-lab/hand-view');

const view = (over: Partial<RecognizerView> = {}): RecognizerView => ({
  rawPose: 'thumb_up',
  pose: 'thumb_up',
  hold: null,
  armed: true,
  cooldownLeftMs: 0,
  dragging: false,
  ...over,
});

function renderHand(props: Partial<Parameters<typeof HandView>[0]> = {}) {
  render(
    <HandView
      videoRef={{ current: null }}
      framesRef={{ current: null }}
      view={null}
      lastEvent={null}
      idle={false}
      replaying={false}
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

describe('HandView', () => {
  it('names the last recognized gesture and what it does on the stage', () => {
    renderHand({ view: view(), lastEvent: 'CONFIRM' });
    expect(screen.getByText(/Pollice su/)).toBeTruthy();
    expect(screen.getByText('→ conferma')).toBeTruthy();
    expect(screen.queryByText(/CONFIRM/)).toBeNull();
  });

  it('names the drag while the pinch holds a window', () => {
    renderHand({ view: view({ dragging: true }), lastEvent: 'CONFIRM' });
    expect(screen.getByText(/Pinch e trascina/)).toBeTruthy();
  });

  it('shows the hold ring with the gesture name', () => {
    renderHand({
      view: view({ hold: { pose: 'thumb_up', progress: 0.5 } }),
    });
    expect(screen.getByLabelText('Attesa del gesto')).toBeTruthy();
    expect(screen.getByText('Pollice su')).toBeTruthy();
  });

  it('says the camera is off instead of a black box', () => {
    renderHand({ idle: true });
    expect(screen.getByText(/Fotocamera spenta/)).toBeTruthy();
  });

  it('draws the hand during a replay and says there is no video', () => {
    renderHand({ replaying: true });
    expect(drawing.drawHands).toHaveBeenCalled();
    expect(screen.getByText(/nessun video/)).toBeTruthy();
  });

  it('draws the live hand without any toggle', () => {
    renderHand();
    expect(drawing.drawHands).toHaveBeenCalled();
  });
});
