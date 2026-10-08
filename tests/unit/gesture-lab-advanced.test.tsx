// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdvancedPanel } from '@/app/dev/gesture-lab/advanced-panel';
import { DEFAULT_LAB_SETTINGS, labCode, type LabSettings } from '@/lib/gesture-lab/settings';

const changed: LabSettings = {
  ...DEFAULT_LAB_SETTINGS,
  toggles: { ...DEFAULT_LAB_SETTINGS.toggles, feedback: true },
};

function renderPanel(props: Partial<Parameters<typeof AdvancedPanel>[0]> = {}) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(
    <AdvancedPanel
      open
      onClose={onClose}
      settings={changed}
      onChange={onChange}
      diagnostics={<p>diagnostica di prova</p>}
      presets={null}
      {...props}
    />,
  );
  return { onChange, onClose };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdvancedPanel', () => {
  it('renders nothing while closed', () => {
    renderPanel({ open: false });
    expect(screen.queryByRole('complementary', { name: 'Avanzate' })).toBeNull();
  });

  it('opens with every section closed', () => {
    renderPanel();
    const panel = screen.getByRole('complementary', { name: 'Avanzate' });
    const sections = panel.querySelectorAll('details');
    expect([...sections].map((d) => d.querySelector('summary')!.textContent)).toEqual([
      'Taratura',
      'Correzioni',
      'Dizionario',
      'Diagnostica',
    ]);
    expect([...sections].every((d) => !(d as HTMLDetailsElement).open)).toBe(true);
  });

  it('adds the presets section only when given', () => {
    renderPanel({ presets: <p>preset di prova</p> });
    expect(within(screen.getByRole('complementary')).getByText('Preset')).toBeTruthy();
  });

  it('toggles half and full height by tapping the handle', () => {
    renderPanel();
    const panel = screen.getByRole('complementary', { name: 'Avanzate' });
    expect(panel.dataset.size).toBe('half');
    fireEvent.click(screen.getByRole('button', { name: 'Ingrandisci il pannello' }));
    expect(panel.dataset.size).toBe('full');
    fireEvent.click(screen.getByRole('button', { name: 'Riduci il pannello' }));
    expect(panel.dataset.size).toBe('half');
  });

  it('goes full height when the handle is dragged up', () => {
    renderPanel();
    const handle = screen.getByRole('button', { name: 'Ingrandisci il pannello' });
    fireEvent.pointerDown(handle, { clientY: 500 });
    fireEvent.pointerUp(handle, { clientY: 300 });
    // Dopo il rilascio il browser manda anche un click: non deve annullare il trascinamento.
    fireEvent.click(handle);
    expect(screen.getByRole('complementary').dataset.size).toBe('full');
  });

  it('resets to the defaults', () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina predefiniti' }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_LAB_SETTINGS);
  });

  it('copies the settings as code, or shows them when the clipboard refuses', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copia come codice' }));
    });
    expect(writeText).toHaveBeenCalledWith(labCode(changed));
    expect(screen.queryByRole('textbox')).toBeNull();

    writeText.mockRejectedValue(new Error('denied'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copia come codice' }));
    });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(labCode(changed));
  });

  it('closes', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi le impostazioni avanzate' }));
    expect(onClose).toHaveBeenCalled();
  });
});
