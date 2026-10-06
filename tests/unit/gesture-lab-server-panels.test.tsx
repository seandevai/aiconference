// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import type { LabArchive } from '@/lib/gesture-lab/lab-store';

const actions = vi.hoisted(() => ({
  saveRecordingAction: vi.fn(),
  getRecordingAction: vi.fn(),
  deleteRecordingAction: vi.fn(),
  savePresetAction: vi.fn(),
  deletePresetAction: vi.fn(),
}));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);

const { ServerPanels } = await import('@/app/dev/gesture-lab/server-panels');

const mine = {
  id: 'r1',
  label: 'V mia',
  expect: null,
  description: '',
  authorId: 'me',
  authorName: 'Sean',
  createdAt: '2026-10-06T10:00:00Z',
};
const theirs = { ...mine, id: 'r2', label: 'swipe di Luca', authorId: 'luca', authorName: 'Luca' };
const preset = {
  id: 'p1',
  name: 'morbido',
  settings: {
    ...DEFAULT_LAB_SETTINGS,
    toggles: { ...DEFAULT_LAB_SETTINGS.toggles, feedback: true },
  },
  authorId: 'luca',
  authorName: 'Luca',
  createdAt: '2026-10-06T10:00:00Z',
};
const archive: LabArchive = { userId: 'me', recordings: [mine, theirs], presets: [preset] };

function setup() {
  const onLoad = vi.fn();
  const onApplySettings = vi.fn();
  render(
    <ServerPanels
      archive={archive}
      live={false}
      capture={vi.fn()}
      onLoad={onLoad}
      settings={DEFAULT_LAB_SETTINGS}
      onApplySettings={onApplySettings}
    />,
  );
  return { onLoad, onApplySettings };
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ServerPanels', () => {
  it('loads an archived recording into the replay', async () => {
    const recording = { expect: null, armed: true, frames: [], label: 'swipe di Luca' };
    actions.getRecordingAction.mockResolvedValue({ ok: true, value: recording });
    const { onLoad } = setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'swipe di Luca' }));
    });
    expect(actions.getRecordingAction).toHaveBeenCalledWith('r2');
    expect(onLoad).toHaveBeenCalledWith(recording);
  });

  it('offers delete only on own recordings, and removes the entry', async () => {
    actions.deleteRecordingAction.mockResolvedValue({ ok: true, value: null });
    setup();
    const own = screen.getByRole('listitem', { name: 'V mia' });
    const other = screen.getByRole('listitem', { name: 'swipe di Luca' });
    expect(within(other).queryByRole('button', { name: 'Elimina' })).toBeNull();
    await act(async () => {
      fireEvent.click(within(own).getByRole('button', { name: 'Elimina' }));
    });
    expect(actions.deleteRecordingAction).toHaveBeenCalledWith('r1');
    expect(screen.queryByRole('listitem', { name: 'V mia' })).toBeNull();
  });

  it('drops an entry that no longer exists', async () => {
    actions.getRecordingAction.mockResolvedValue({ ok: false, error: 'not_found' });
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'swipe di Luca' }));
    });
    expect(screen.getByText(/Non più disponibile/)).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: 'swipe di Luca' })).toBeNull();
  });

  it('applies a preset', () => {
    const { onApplySettings } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Applica morbido' }));
    expect(onApplySettings).toHaveBeenCalledWith(preset.settings);
  });

  it('saves the current settings as a preset and lists it', async () => {
    const saved = { ...preset, id: 'p2', name: 'rapido', authorId: 'me', authorName: 'Sean' };
    actions.savePresetAction.mockResolvedValue({ ok: true, value: saved });
    setup();
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'rapido' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    });
    expect(actions.savePresetAction).toHaveBeenCalledWith({
      name: 'rapido',
      settings: DEFAULT_LAB_SETTINGS,
    });
    expect(screen.getByRole('button', { name: 'Applica rapido' })).toBeTruthy();
  });

  it('recovers when opening a recording rejects', async () => {
    actions.getRecordingAction.mockRejectedValue(new Error('network'));
    setup();
    const open = screen.getByRole('button', { name: 'swipe di Luca' });
    await act(async () => {
      fireEvent.click(open);
    });
    expect(screen.getByText('Operazione non riuscita. Riprova.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'swipe di Luca' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('recovers when saving a preset rejects', async () => {
    actions.savePresetAction.mockRejectedValue(new Error('network'));
    setup();
    const input = screen.getByLabelText('Nome del preset') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'rapido' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    });
    expect(screen.getByText('Operazione non riuscita. Riprova.')).toBeTruthy();
    expect(input.value).toBe('rapido');
    expect(
      (screen.getByRole('button', { name: 'Salva taratura' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
