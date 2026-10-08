// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING, type RecognizerView } from '@omnicanvas/gesture';
import { hand } from '../fixtures/hands';

const drawing = vi.hoisted(() => ({ drawHands: vi.fn() }));
vi.mock('@/lib/gesture-lab/hand-drawing', () => drawing);

const { HandView } = await import('@/app/dev/gesture-lab/hand-view');
const { Diagnostics } = await import('@/app/dev/gesture-lab/diagnostics');

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
      feedback={false}
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

  it('shows the hold ring with the gesture name when feedback is on', () => {
    renderHand({
      view: view({ hold: { pose: 'thumb_up', progress: 0.5 } }),
      feedback: true,
    });
    expect(screen.getByLabelText('Attesa del gesto')).toBeTruthy();
    expect(screen.getByText('Pollice su')).toBeTruthy();
  });

  it('says the camera is off instead of a black box', () => {
    renderHand({ idle: true });
    expect(screen.getByText(/Fotocamera spenta/)).toBeTruthy();
  });

  it('draws the hand during a replay even with feedback off, and says there is no video', () => {
    renderHand({ replaying: true });
    expect(drawing.drawHands).toHaveBeenCalled();
    expect(screen.getByText(/nessun video/)).toBeTruthy();
  });

  it('draws nothing live when feedback is off', () => {
    renderHand();
    expect(drawing.drawHands).not.toHaveBeenCalled();
  });
});

describe('Diagnostics', () => {
  it('shows raw and stable pose, finger numbers and the events', () => {
    render(
      <Diagnostics
        view={view({ rawPose: 'fist' })}
        hand={hand('thumb_up')}
        tuning={DEFAULT_TUNING}
        log={[{ t: 1_200, label: 'CONFIRM' }]}
      />,
    );
    expect(screen.getByText(/Posa grezza: fist · stabile: thumb_up/)).toBeTruthy();
    expect(screen.getByText('Indice')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Eventi' })).toBeTruthy();
    expect(screen.getByText('CONFIRM')).toBeTruthy();
  });

  it('says when no hand is in view', () => {
    render(<Diagnostics view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} />);
    expect(screen.getByText('Nessuna mano in vista.')).toBeTruthy();
  });
});
