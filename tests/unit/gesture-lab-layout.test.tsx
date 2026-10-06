// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { labStage } from '@/lib/gesture-lab/lab-stage';

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
    startLive: vi.fn(),
    stopLive: vi.fn(),
    recording: null,
    loadRecording: vi.fn(),
    playing: false,
    play: vi.fn(),
    pause: vi.fn(),
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

afterEach(cleanup);

describe('gesture lab layout', () => {
  it('keeps the hand view and the events beside the stage, the controls in the side column', () => {
    render(<Lab archive={null} />);
    const stageColumn = screen.getByRole('heading', { name: 'Laboratorio gesture' }).parentElement!;
    const side = screen.getByRole('complementary');

    expect(stageColumn.contains(screen.getByRole('heading', { name: 'Eventi' }))).toBe(true);
    expect(stageColumn.querySelector('video')).not.toBeNull();
    expect(side.contains(screen.getByRole('button', { name: 'Avvia la webcam' }))).toBe(true);
    expect(side.contains(screen.getByRole('button', { name: 'Ripristina predefiniti' }))).toBe(
      true,
    );
    expect(side.querySelector('video')).toBeNull();
  });

  it('shows the server panels only to a lab admin', () => {
    render(<Lab archive={null} />);
    expect(screen.queryByRole('tab', { name: 'Registra' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Archivio' })).toBeNull();
    cleanup();
    render(<Lab archive={archive} />);
    const side = screen.getByRole('complementary');
    expect(within(side).getByRole('tab', { name: 'Registra' })).toBeTruthy();
    expect(within(side).getByRole('tab', { name: 'Archivio' })).toBeTruthy();
    expect(within(side).getByRole('tab', { name: 'Taratura' })).toBeTruthy();
  });

  it('says what to do when the camera is off, instead of an empty black box', () => {
    render(<Lab archive={null} />);
    expect(screen.getByText(/Webcam spenta/)).toBeTruthy();
  });

  it('keeps the replay above the tabs and shows one tab at a time', () => {
    render(<Lab archive={archive} />);
    const side = screen.getByRole('complementary');
    expect(within(side).getByRole('heading', { name: 'Rigioco' })).toBeTruthy();
    // Si parte da Registra: Archivio e Taratura restano nascosti.
    expect(within(side).getByRole('heading', { name: 'Registra' })).toBeTruthy();
    expect(within(side).queryByRole('heading', { name: 'Archivio' })).toBeNull();
    expect(within(side).queryByRole('button', { name: 'Ripristina predefiniti' })).toBeNull();

    fireEvent.click(within(side).getByRole('tab', { name: 'Archivio' }));
    expect(within(side).getByRole('heading', { name: 'Archivio' })).toBeTruthy();
    expect(within(side).getByRole('heading', { name: 'Preset' })).toBeTruthy();
    expect(within(side).queryByRole('heading', { name: 'Registra' })).toBeNull();
    expect(within(side).getByRole('tab', { name: 'Archivio' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    fireEvent.click(within(side).getByRole('tab', { name: 'Taratura' }));
    expect(within(side).getByRole('button', { name: 'Ripristina predefiniti' })).toBeTruthy();
  });

  it('keeps what was typed when switching tabs', () => {
    render(<Lab archive={archive} />);
    fireEvent.change(screen.getByLabelText('Nome della gesture'), { target: { value: 'V' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Archivio' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Registra' }));
    expect((screen.getByLabelText('Nome della gesture') as HTMLInputElement).value).toBe('V');
  });
});
