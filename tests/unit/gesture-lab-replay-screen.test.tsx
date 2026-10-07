// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Frame } from '@omnicanvas/gesture';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';
import type { Recording } from '@/lib/gesture-lab/recording';
import { DEFAULT_LAB_SETTINGS, type LabSettings } from '@/lib/gesture-lab/settings';
import { hand } from '../fixtures/hands';

const actions = vi.hoisted(() => ({
  getRecordingAction: vi.fn(),
  deleteRecordingAction: vi.fn(),
}));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);
const download = vi.hoisted(() => ({ downloadRecording: vi.fn() }));
vi.mock('@/lib/gesture-lab/download', () => download);

const { ReplayScreen } = await import('@/app/dev/gesture-lab/replay-screen');

const thumbUp: Frame[] = Array.from({ length: 40 }, (_, i) => ({
  t: i * 33,
  hands: [hand('thumb_up')],
}));
const clip: Recording = { expect: 'CONFIRM', armed: true, frames: thumbUp, label: 'Pollice su' };
const row = (over: Partial<RecordingSummary>): RecordingSummary => ({
  id: 'r1',
  label: 'Pollice su',
  expect: 'CONFIRM',
  description: 'luce bassa',
  authorId: 'me',
  authorName: 'Sean',
  createdAt: '2026-10-06T10:00:00Z',
  ...over,
});
const recordings = [
  row({}),
  row({
    id: 'r2',
    label: 'Swipe a sinistra',
    expect: 'FOCUS_NEXT',
    authorId: 'luca',
    authorName: 'Luca',
    description: '',
  }),
  row({
    id: 'r3',
    label: 'V',
    expect: null,
    authorId: 'luca',
    authorName: 'Luca',
    description: '',
  }),
];

type HarnessProps = { id: string | null; settings?: LabSettings };

function setup(initial: HarnessProps) {
  const spies = {
    onRemoved: vi.fn(),
    onOpen: vi.fn(),
    onList: vi.fn(),
    onExit: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onScene: vi.fn(),
    onAdvanced: vi.fn(),
  };
  // Il rigioco vero sta nel Lab: qui basta tenere la registrazione caricata.
  function Harness({ id, settings = DEFAULT_LAB_SETTINGS }: HarnessProps) {
    const [recording, setRecording] = useState<Recording | null>(null);
    return (
      <ReplayScreen
        userId="me"
        recordings={recordings}
        id={id}
        scene={<div data-testid="scene" />}
        settings={settings}
        recording={recording}
        playing={false}
        progress={0}
        onLoad={setRecording}
        {...spies}
      />
    );
  }
  const view = render(<Harness {...initial} />);
  return { ...spies, rerender: (next: HarnessProps) => view.rerender(<Harness {...next} />) };
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  download.downloadRecording.mockReset();
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReplayScreen list', () => {
  it('lists the recordings with gesture, author and note, scene hidden', () => {
    const ctx = setup({ id: null });
    expect(screen.getByRole('button', { name: /👍 Pollice su.*Sean.*luce bassa/ })).toBeTruthy();
    expect(screen.getByTestId('scene').parentElement!.hidden).toBe(true);
    expect(ctx.onScene).toHaveBeenLastCalledWith(false);
  });

  it('filters by gesture', () => {
    setup({ id: null });
    expect(screen.getByRole('button', { name: 'Tutti' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Swipe a sinistra' }));
    expect(screen.queryByRole('button', { name: /Sean/ })).toBeNull();
    expect(screen.getByRole('button', { name: /👈 Swipe a sinistra.*Luca/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gesti nuovi' }));
    expect(screen.getByRole('button', { name: /V.*Luca/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Swipe a sinistra.*Luca/ })).toBeNull();
  });

  it('opens a recording through the URL', () => {
    const ctx = setup({ id: null });
    fireEvent.click(screen.getByRole('button', { name: /Swipe a sinistra.*Luca/ }));
    expect(ctx.onOpen).toHaveBeenCalledWith('r2');
  });

  it('loads a recording from a JSON file', async () => {
    const ctx = setup({ id: null });
    const file = new File([JSON.stringify(clip)], 'clip.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Carica un file JSON'), {
        target: { files: [file] },
      });
    });
    expect(screen.getByText('✓ Riconosciuto')).toBeTruthy();
    expect(ctx.onScene).toHaveBeenLastCalledWith(true);
  });
});

describe('ReplayScreen replay', () => {
  it('loads the recording of the URL and shows its outcome at once', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    expect(actions.getRecordingAction).toHaveBeenCalledWith('r1');
    expect(screen.getByText('✓ Riconosciuto')).toBeTruthy();
    expect(screen.getByText('Atteso: Pollice su')).toBeTruthy();
    expect(screen.getByTestId('scene').parentElement!.hidden).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Rigioca' }));
    expect(ctx.onPlay).toHaveBeenCalled();
  });

  it('recomputes the outcome when the settings change', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    ctx.rerender({
      id: 'r1',
      settings: {
        ...DEFAULT_LAB_SETTINGS,
        dictionary: { ...DEFAULT_LAB_SETTINGS.dictionary, thumb_up_hold: null },
      },
    });
    expect(screen.getByText('✗ Non riconosciuto')).toBeTruthy();
  });

  it('offers delete only on own recordings, and returns to the list after it', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    actions.deleteRecordingAction.mockResolvedValue({ ok: true, value: null });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));
    });
    expect(actions.deleteRecordingAction).toHaveBeenCalledWith('r1');
    expect(ctx.onRemoved).toHaveBeenCalledWith('r1');
    expect(ctx.onList).toHaveBeenCalled();
  });

  it('downloads someone else’s recording but does not delete it', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: { ...clip, label: 'Swipe' } });
    setup({ id: 'r2' });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    expect(screen.queryByRole('button', { name: 'Elimina' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Scarica JSON' }));
    expect(download.downloadRecording).toHaveBeenCalled();
  });

  it('drops a recording that no longer exists and goes back to the list', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: false, error: 'not_found' });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    expect(ctx.onRemoved).toHaveBeenCalledWith('r1');
    expect(ctx.onList).toHaveBeenCalled();
    expect(screen.getByText(/Non più disponibile/)).toBeTruthy();
  });

  it('pauses and goes back to the archive', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: clip });
    const ctx = setup({ id: 'r1' });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: '‹ Archivio' }));
    expect(ctx.onPause).toHaveBeenCalled();
    expect(ctx.onList).toHaveBeenCalled();
  });
});
