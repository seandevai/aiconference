// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { labStage } from '@/lib/gesture-lab/lab-stage';

// La schermata viene dall'URL: il mock legge la query impostata dal test.
const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// Schermo largo o telefono: il banco esiste solo da `lg` in su.
const media = vi.hoisted(() => ({ wide: true }));
const state = vi.hoisted(() => ({
  cursor: null as null | { x: number; y: number; grabbing: boolean },
}));

const hook = vi.hoisted(() => ({ startLive: vi.fn(), stopLive: vi.fn(), pause: vi.fn() }));
// Il layout non dipende dalla webcam: il hook resta fermo in 'off'.
vi.mock('@/lib/gesture-lab/use-gesture-lab', () => ({
  useGestureLab: () => ({
    settings: DEFAULT_LAB_SETTINGS,
    setSettings: vi.fn(),
    stage: labStage(),
    dispatch: vi.fn(),
    log: [],
    view: null,
    hand: null,
    armed: false,
    cursor: state.cursor,
    live: 'off',
    startLive: hook.startLive,
    stopLive: hook.stopLive,
    recording: null,
    loadRecording: vi.fn(),
    playing: false,
    progress: 0,
    play: vi.fn(),
    pause: hook.pause,
    fired: [],
    capture: vi.fn(),
  }),
}));

vi.mock('@/app/dev/gesture-lab/actions', () => ({
  saveRecordingAction: vi.fn(),
  getRecordingAction: vi.fn(),
  deleteRecordingAction: vi.fn(),
  savePresetAction: vi.fn(),
  deletePresetAction: vi.fn(),
}));

const { Lab } = await import('@/app/dev/gesture-lab/lab');

const archive = { userId: 'me', recordings: [], presets: [] };

beforeEach(() => {
  nav.search = '';
  window.history.replaceState(null, '', '/dev/gesture-lab');
  Object.values(hook).forEach((fn) => fn.mockReset());
  media.wide = true;
  state.cursor = null;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 64rem)' ? media.wide : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('gesture lab home', () => {
  it('offers only «Prova» without the archive', () => {
    render(<Lab archive={null} />);
    expect(screen.getByText('Cosa vuoi fare?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Prova le gesture/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Registra un gesto/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Rigioca dall'archivio/ })).toBeNull();
  });

  it('offers the three choices to a lab admin', () => {
    render(<Lab archive={archive} />);
    expect(screen.getByRole('button', { name: /Registra un gesto/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Rigioca dall'archivio/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Banco di prova/ })).toBeTruthy();
  });

  it('puts the chosen screen in the URL', () => {
    render(<Lab archive={archive} />);
    fireEvent.click(screen.getByRole('button', { name: /Registra un gesto/ }));
    expect(window.location.search).toBe('?vista=registra');
  });

  it('stops the camera on the home', () => {
    render(<Lab archive={null} />);
    expect(hook.stopLive).toHaveBeenCalled();
  });

  it('falls back to the home for an unknown or forbidden screen', () => {
    nav.search = '?vista=boh';
    render(<Lab archive={archive} />);
    expect(screen.getByText('Cosa vuoi fare?')).toBeTruthy();
    cleanup();
    nav.search = '?vista=registra';
    render(<Lab archive={null} />);
    expect(screen.getByText('Cosa vuoi fare?')).toBeTruthy();
  });
});

describe('gesture lab try screen', () => {
  it('starts the camera and shows the hand and the stage, nothing technical', () => {
    nav.search = '?vista=prova';
    const { container } = render(<Lab archive={null} />);
    expect(hook.startLive).toHaveBeenCalledTimes(1);
    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Avvia fotocamera' })).toBeTruthy();
    expect(screen.queryByText('Taratura')).toBeNull();
    expect(screen.queryByText(/FOCUS_NEXT/)).toBeNull();
  });

  it('opens the advanced panel from the gear, with the technical sections', () => {
    nav.search = '?vista=prova';
    render(<Lab archive={archive} />);
    fireEvent.click(screen.getByRole('button', { name: 'Avanzate' }));
    const panel = screen.getByRole('complementary', { name: 'Avanzate' });
    expect(within(panel).getByText('Taratura')).toBeTruthy();
    expect(within(panel).getByText('Preset')).toBeTruthy();
  });

  it('stops the camera when leaving for another screen, whose video is a new element', () => {
    nav.search = '?vista=prova';
    const { rerender } = render(<Lab archive={archive} />);
    hook.stopLive.mockReset();
    nav.search = '?vista=registra';
    rerender(<Lab archive={archive} />);
    expect(hook.stopLive).toHaveBeenCalled();
  });

  it('goes back to the home', () => {
    nav.search = '?vista=prova';
    render(<Lab archive={null} />);
    fireEvent.click(screen.getByRole('button', { name: '‹ Indietro' }));
    expect(window.location.search).toBe('');
  });
});

describe('gesture lab other screens', () => {
  it('starts the recording from the gesture choice', () => {
    nav.search = '?vista=registra';
    render(<Lab archive={archive} />);
    expect(screen.getByRole('heading', { name: 'Quale gesto registri?' })).toBeTruthy();
  });

  it('opens the replay list and stops the camera', () => {
    nav.search = '?vista=rigioca';
    render(<Lab archive={archive} />);
    expect(screen.getByRole('heading', { name: 'Rigioca' })).toBeTruthy();
    expect(hook.stopLive).toHaveBeenCalled();
  });
});

describe('gesture lab bench', () => {
  it('offers the bench only on a wide screen, also without the archive', () => {
    render(<Lab archive={null} />);
    const bench = screen.getByRole('button', { name: /Banco di prova/ });
    expect(bench.className).toContain('max-lg:hidden');
  });

  it('starts the camera and shows hand and numbers, without the stage', () => {
    nav.search = '?vista=banco';
    render(<Lab archive={null} />);
    expect(hook.startLive).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Banco di prova' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dita' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Avanzate' })).toBeTruthy();
  });

  it('goes back to the home when opened on a phone', () => {
    media.wide = false;
    nav.search = '?vista=banco';
    window.history.replaceState(null, '', '/dev/gesture-lab?vista=banco');
    render(<Lab archive={null} />);
    expect(window.location.search).toBe('');
  });

  // Il ritorno sostituisce la voce: il tasto indietro non deve riportare al banco.
  it('replaces the history entry when sending a phone back home', () => {
    media.wide = false;
    nav.search = '?vista=banco';
    window.history.replaceState(null, '', '/dev/gesture-lab?vista=banco');
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    render(<Lab archive={null} />);
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(null, '', '/dev/gesture-lab');
    push.mockRestore();
    replace.mockRestore();
  });

  it('does not start the camera when the bench is opened on a phone', () => {
    media.wide = false;
    nav.search = '?vista=banco';
    render(<Lab archive={null} />);
    expect(hook.startLive).not.toHaveBeenCalled();
  });

  it('hides the cursor where the stage is not visible', () => {
    state.cursor = { x: 10, y: 10, grabbing: false };
    nav.search = '?vista=banco';
    const { container } = render(<Lab archive={null} />);
    const cursor = container.querySelector('[data-lab-cursor]') as HTMLElement;
    expect(cursor.className).toContain('lg:hidden');
  });
});

describe('gesture lab phone stage', () => {
  it('starts every screen with the hand, even after showing the stage elsewhere', () => {
    nav.search = '?vista=prova';
    const { rerender } = render(<Lab archive={archive} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostra il palco' }));
    expect(screen.getByRole('button', { name: 'Nascondi il palco' })).toBeTruthy();
    nav.search = '?vista=rigioca';
    rerender(<Lab archive={archive} />);
    nav.search = '?vista=prova';
    rerender(<Lab archive={archive} />);
    expect(screen.getByRole('button', { name: 'Mostra il palco' })).toBeTruthy();
  });

  it('has no numbers in the try screen', () => {
    nav.search = '?vista=prova';
    render(<Lab archive={archive} />);
    expect(screen.queryByRole('region', { name: 'Dita' })).toBeNull();
  });
});
