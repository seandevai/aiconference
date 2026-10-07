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
    cursor: null,
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
});
afterEach(cleanup);

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
