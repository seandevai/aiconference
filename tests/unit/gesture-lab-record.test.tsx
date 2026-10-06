// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordPanel } from '@/app/dev/gesture-lab/record-panel';
import { hand } from '../fixtures/hands';

const frames = [{ t: 0, hands: [hand('fist')] }];
const summary = {
  id: 'r1',
  label: 'V',
  expect: null,
  description: '',
  authorId: 'u1',
  authorName: 'Luca',
  createdAt: '2026-10-06T10:00:00Z',
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function recordClip(props: Partial<Parameters<typeof RecordPanel>[0]> = {}) {
  const capture = vi.fn().mockResolvedValue(frames);
  const onRecorded = vi.fn();
  const onSave = vi.fn().mockResolvedValue({ ok: true, value: summary });
  render(<RecordPanel live capture={capture} onRecorded={onRecorded} onSave={onSave} {...props} />);
  fireEvent.change(screen.getByLabelText('Nome della gesture'), { target: { value: ' V ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
  expect(screen.getByText('3')).toBeTruthy();
  await act(async () => {
    vi.advanceTimersByTime(3_000);
  });
  return { capture, onRecorded, onSave };
}

describe('RecordPanel', () => {
  it('needs the camera and a name before recording', () => {
    render(<RecordPanel live={false} capture={vi.fn()} onRecorded={vi.fn()} onSave={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Registra' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('counts down, records four seconds and hands the clip to the replay', async () => {
    const { capture, onRecorded } = await recordClip();
    expect(capture).toHaveBeenCalledWith(4_000);
    expect(onRecorded).toHaveBeenCalledWith({ expect: null, armed: true, frames, label: 'V' });
    expect(screen.getByRole('button', { name: 'Salva' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scarica JSON' })).toBeTruthy();
  });

  it('saves once even on a double click', async () => {
    const { onSave } = await recordClip();
    let resolve: (value: unknown) => void = () => {};
    onSave.mockReturnValue(new Promise((r) => (resolve = r)));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      label: 'V',
      expect: null,
      description: '',
      armed: true,
      frames,
    });
    await act(async () => resolve({ ok: true, value: summary }));
    expect(screen.getByText('Registrazione salvata.')).toBeTruthy();
  });

  it('keeps the clip and offers the download when saving fails', async () => {
    const { onSave } = await recordClip();
    onSave.mockResolvedValue({ ok: false, error: 'failed' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    });
    expect(screen.getByText(/Non sono riuscito a salvare/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scarica JSON' })).toBeTruthy();
  });

  it('says so when no frame was recorded', async () => {
    await recordClip({ capture: vi.fn().mockResolvedValue([]) });
    expect(screen.getByText(/Nessun fotogramma registrato/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Salva' })).toBeNull();
  });

  it('records GESTURES_TOGGLE disarmed, like the recorder', async () => {
    const capture = vi.fn().mockResolvedValue(frames);
    const onRecorded = vi.fn();
    render(<RecordPanel live capture={capture} onRecorded={onRecorded} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome della gesture'), { target: { value: 'palmo' } });
    fireEvent.change(screen.getByLabelText('Evento atteso'), {
      target: { value: 'GESTURES_TOGGLE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(onRecorded.mock.calls[0]![0]).toMatchObject({
      expect: 'GESTURES_TOGGLE',
      armed: false,
    });
  });
});
