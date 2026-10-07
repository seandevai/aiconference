// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Frame } from '@omnicanvas/gesture';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { hand } from '../fixtures/hands';

const actions = vi.hoisted(() => ({ saveRecordingAction: vi.fn() }));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);
const download = vi.hoisted(() => ({ downloadRecording: vi.fn() }));
vi.mock('@/lib/gesture-lab/download', () => download);

const { RecordWizard } = await import('@/app/dev/gesture-lab/record-wizard');

const held = (pose: 'thumb_up' | 'open_palm'): Frame[] =>
  Array.from({ length: 40 }, (_, i) => ({ t: i * 33, hands: [hand(pose)] }));
const summary = {
  id: 'r1',
  label: 'Pollice su',
  expect: 'CONFIRM' as const,
  description: '',
  authorId: 'me',
  authorName: 'Sean',
  createdAt: '2026-10-07T10:00:00Z',
};

function setup(over: { live?: LiveStatus; capture?: (ms: number) => Promise<Frame[]> } = {}) {
  const props = {
    live: over.live ?? ('on' as LiveStatus),
    hand: hand('thumb_up'),
    settings: DEFAULT_LAB_SETTINGS,
    scene: <div data-testid="scene" />,
    capture: over.capture ?? vi.fn().mockResolvedValue(held('thumb_up')),
    onStartCamera: vi.fn(),
    onRecorded: vi.fn(),
    onReview: vi.fn(),
    onSaved: vi.fn(),
    onScene: vi.fn(),
    onAdvanced: vi.fn(),
    onExit: vi.fn(),
  };
  const view = render(<RecordWizard {...props} />);
  return {
    ...props,
    rerender: (next: Partial<typeof props>) => view.rerender(<RecordWizard {...props} {...next} />),
    unmount: view.unmount,
  };
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

async function recordGesture(name: string, over: Parameters<typeof setup>[0] = {}) {
  const ctx = setup(over);
  fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
  await act(async () => {
    vi.advanceTimersByTime(3_000);
  });
  return ctx;
}

beforeEach(() => {
  vi.useFakeTimers();
  actions.saveRecordingAction.mockReset();
  download.downloadRecording.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RecordWizard', () => {
  it('walks gesture, position, countdown and outcome in order', async () => {
    const ctx = setup({ live: 'off' });
    expect(heading()).toBe('Quale gesto registri?');
    expect(screen.getByTestId('scene').parentElement!.hidden).toBe(true);
    expect(ctx.onScene).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    expect(heading()).toBe('Mettiti in posizione');
    expect(ctx.onStartCamera).toHaveBeenCalledTimes(1);
    expect(ctx.onScene).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/Come si fa: Pugno chiuso col pollice in su/)).toBeTruthy();
    expect(screen.getByText('✓ mano vista')).toBeTruthy();
    const start = screen.getByRole('button', { name: 'Inizia' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);

    ctx.rerender({ live: 'on' });
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    expect(screen.getByText('3')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(ctx.capture).toHaveBeenCalledWith(4_000);
    expect(heading()).toBe('Esito');
    expect(screen.getByText('✓ Riconosciuto')).toBeTruthy();
    expect(ctx.onRecorded).toHaveBeenCalledWith({
      expect: 'CONFIRM',
      armed: true,
      frames: held('thumb_up'),
      label: 'Pollice su',
    });
  });

  it('goes back one step at a time, and leaves from the first', () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    fireEvent.click(screen.getByRole('button', { name: '‹ Indietro' }));
    expect(heading()).toBe('Quale gesto registri?');
    fireEvent.click(screen.getByRole('button', { name: '‹ Indietro' }));
    expect(ctx.onExit).toHaveBeenCalled();
  });

  it('asks a name for a new gesture and saves it without an expected event', async () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Gesto nuovo' }));
    const next = screen.getByRole('button', { name: 'Avanti' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Come lo chiami?'), { target: { value: ' V ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('Registrato')).toBeTruthy();

    actions.saveRecordingAction.mockResolvedValue({ ok: true, value: summary });
    fireEvent.change(screen.getByLabelText('Nota (facoltativa)'), {
      target: { value: ' due dita ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    });
    expect(actions.saveRecordingAction).toHaveBeenCalledWith({
      label: 'V',
      expect: null,
      description: 'due dita',
      armed: true,
      frames: held('thumb_up'),
    });
    expect(ctx.onSaved).toHaveBeenCalledWith(summary);
    expect(screen.getByText('Salvato')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Registra un altro' }));
    expect(heading()).toBe('Quale gesto registri?');
  });

  it('names a known gesture by itself', async () => {
    await recordGesture('Pollice su');
    actions.saveRecordingAction.mockResolvedValue({ ok: true, value: summary });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    });
    expect(actions.saveRecordingAction.mock.calls[0]![0]).toMatchObject({
      label: 'Pollice su',
      expect: 'CONFIRM',
      description: '',
    });
  });

  it('saves once on a double click', async () => {
    await recordGesture('Pollice su');
    let resolve: (value: unknown) => void = () => {};
    actions.saveRecordingAction.mockReturnValue(new Promise((r) => (resolve = r)));
    fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    expect(actions.saveRecordingAction).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, value: summary }));
  });

  it('keeps the clip and offers the JSON when saving fails', async () => {
    await recordGesture('Pollice su');
    actions.saveRecordingAction.mockResolvedValue({ ok: false, error: 'failed' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Salva nell'archivio" }));
    });
    expect(screen.getByText(/Non sono riuscito a salvare/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Scarica JSON' }));
    expect(download.downloadRecording).toHaveBeenCalled();
  });

  it('reviews the clip and redoes it from the position step', async () => {
    const ctx = await recordGesture('Pollice su');
    fireEvent.click(screen.getByRole('button', { name: /Rivedi/ }));
    expect(ctx.onReview).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Rifai/ }));
    expect(heading()).toBe('Mettiti in posizione');
  });

  it('says the outcome when the gesture was not recognized', async () => {
    await recordGesture('Pollice giù');
    expect(screen.getByText('✗ Non riconosciuto')).toBeTruthy();
    expect(screen.getByText('Scattati: Pollice su')).toBeTruthy();
  });

  it('goes back to the position step when no frame was recorded', async () => {
    await recordGesture('Pollice su', { capture: vi.fn().mockResolvedValue([]) });
    expect(heading()).toBe('Mettiti in posizione');
    expect(screen.getByText(/Nessun fotogramma registrato/)).toBeTruthy();
  });

  it('records the open palm disarmed, like the recorder', async () => {
    const ctx = await recordGesture('Palmo aperto', {
      capture: vi.fn().mockResolvedValue(held('open_palm')),
    });
    expect(ctx.onRecorded.mock.calls[0]![0]).toMatchObject({
      expect: 'GESTURES_TOGGLE',
      armed: false,
    });
  });

  it('cancels the countdown without capturing', async () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(ctx.capture).not.toHaveBeenCalled();
    expect(heading()).toBe('Mettiti in posizione');
  });

  it('waits for a cancelled capture to end before starting again', async () => {
    let finish: (frames: Frame[]) => void = () => {};
    const capture = vi.fn().mockReturnValue(new Promise<Frame[]>((r) => (finish = r)));
    await recordGesture('Pollice su', { capture });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect((screen.getByRole('button', { name: 'Inizia' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => finish(held('thumb_up')));
    expect(heading()).toBe('Mettiti in posizione');
    expect((screen.getByRole('button', { name: 'Inizia' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('captures nothing when the screen is left during the countdown', async () => {
    const ctx = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inizia' }));
    ctx.unmount();
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(ctx.capture).not.toHaveBeenCalled();
  });

  it('does not try the camera again when hand recognition is unavailable', () => {
    const ctx = setup({ live: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Pollice su' }));
    expect(ctx.onStartCamera).not.toHaveBeenCalled();
    expect(screen.getByText(/Riconoscimento delle mani non disponibile/)).toBeTruthy();
  });
});
