// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
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
  }),
}));

const { Lab } = await import('@/app/dev/gesture-lab/lab');

afterEach(cleanup);

describe('gesture lab layout', () => {
  it('keeps the hand view and the events beside the stage, the controls in the side column', () => {
    render(<Lab />);
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
});
