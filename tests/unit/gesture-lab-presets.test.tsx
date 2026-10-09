// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAB_SETTINGS, type LabSettings } from '@/lib/gesture-lab/settings';
import type { PresetSummary } from '@/lib/gesture-lab/lab-store';

const actions = vi.hoisted(() => ({ savePresetAction: vi.fn(), deletePresetAction: vi.fn() }));
vi.mock('@/app/dev/gesture-lab/actions', () => actions);

const { PresetSection } = await import('@/app/dev/gesture-lab/preset-panel');

const preset = (over: Partial<PresetSummary>): PresetSummary => ({
  id: 'p1',
  name: 'morbido',
  settings: {
    ...DEFAULT_LAB_SETTINGS,
    toggles: { ...DEFAULT_LAB_SETTINGS.toggles, smoothCursor: true },
  },
  authorId: 'luca',
  authorName: 'Luca',
  createdAt: '2026-10-06T10:00:00Z',
  ...over,
});
const theirs = preset({});
const mine = preset({ id: 'p2', name: 'mio', authorId: 'me', authorName: 'Sean' });

function Harness({ onApply }: { onApply: (settings: LabSettings) => void }) {
  const [presets, setPresets] = useState([mine, theirs]);
  return (
    <PresetSection
      userId="me"
      presets={presets}
      onPresetsChange={setPresets}
      settings={DEFAULT_LAB_SETTINGS}
      onApply={onApply}
    />
  );
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PresetSection', () => {
  it('applies a preset', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Applica morbido' }));
    expect(onApply).toHaveBeenCalledWith(theirs.settings);
  });

  it('saves the current settings and lists the new preset first', async () => {
    const saved = preset({ id: 'p3', name: 'nuovo', authorId: 'me' });
    actions.savePresetAction.mockResolvedValue({ ok: true, value: saved });
    render(<Harness onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'nuovo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    });
    expect(actions.savePresetAction).toHaveBeenCalledWith({
      name: 'nuovo',
      settings: DEFAULT_LAB_SETTINGS,
    });
    expect(screen.getAllByRole('listitem')[0]!.textContent).toMatch(/nuovo/);
  });

  it('offers delete only on own presets, and drops one that is already gone', async () => {
    actions.deletePresetAction.mockResolvedValue({ ok: false, error: 'not_found' });
    render(<Harness onApply={vi.fn()} />);
    const [own, other] = screen.getAllByRole('listitem');
    expect(within(other!).queryByRole('button', { name: 'Elimina' })).toBeNull();
    await act(async () => {
      fireEvent.click(within(own!).getByRole('button', { name: 'Elimina' }));
    });
    expect(actions.deletePresetAction).toHaveBeenCalledWith('p2');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText(/Non più disponibile/)).toBeTruthy();
  });

  it('recovers when saving rejects', async () => {
    actions.savePresetAction.mockRejectedValue(new Error('network'));
    render(<Harness onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'x' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    });
    expect(screen.getByText('Operazione non riuscita. Riprova.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Salva taratura' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('saves once on a double click', async () => {
    let resolve: (value: unknown) => void = () => {};
    actions.savePresetAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<Harness onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome del preset'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva taratura' }));
    expect(actions.savePresetAction).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, value: preset({ id: 'p9', name: 'x' }) }));
  });
});
