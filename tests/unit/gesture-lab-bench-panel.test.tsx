// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, poseMetrics, type RecognizerView } from '@omnicanvas/gesture';
import { BenchPanel } from '@/app/dev/gesture-lab/bench-panel';
import { hand } from '../fixtures/hands';

const view = (over: Partial<RecognizerView> = {}): RecognizerView => ({
  rawPose: 'fist',
  pose: 'thumb_up',
  hold: { pose: 'thumb_up', progress: 0.5 },
  armed: true,
  cooldownLeftMs: 120,
  dragging: false,
  ...over,
});

const pct = (n: number) => `${Math.min(100, Math.max(0, n * 100))}%`;

afterEach(cleanup);

describe('BenchPanel', () => {
  it('shows the pose tile: raw and stable pose, hold, pause', () => {
    render(<BenchPanel view={view()} hand={hand('thumb_up')} tuning={DEFAULT_TUNING} log={[]} />);
    const tile = screen.getByRole('region', { name: 'Posa' });
    expect(within(tile).getByText('fist')).toBeTruthy();
    expect(within(tile).getByText('thumb_up')).toBeTruthy();
    expect(within(tile).getByText('armato')).toBeTruthy();
    expect(within(tile).getByText('120 ms')).toBeTruthy();
    const holdMeter = within(tile).getByRole('meter', { name: 'Hold' });
    expect(holdMeter.getAttribute('aria-valuenow')).toBe('0.5');
    expect((holdMeter.querySelector('[data-fill]') as HTMLElement).style.width).toBe('50%');
  });

  it('shows each finger against the folded and extended thresholds', () => {
    const h = hand('thumb_up');
    const metrics = poseMetrics(h);
    render(<BenchPanel view={view()} hand={h} tuning={DEFAULT_TUNING} log={[]} />);
    const tile = screen.getByRole('region', { name: 'Dita' });
    const index = within(tile).getByRole('meter', { name: 'Indice' });
    expect(Number(index.getAttribute('aria-valuenow'))).toBeCloseTo(metrics.fingers.index, 5);
    const marks = [...index.querySelectorAll('[data-mark]')].map(
      (m) => (m as HTMLElement).style.left,
    );
    expect(marks).toEqual([pct(DEFAULT_TUNING.pose.folded), pct(DEFAULT_TUNING.pose.extended)]);
    const pinch = within(tile).getByRole('meter', { name: 'Pinch' });
    expect((pinch.querySelector('[data-mark]') as HTMLElement).style.left).toBe(
      pct(DEFAULT_TUNING.pose.pinchOn),
    );
    expect(within(tile).getByText(metrics.thumbExtended ? 'esteso' : 'chiuso')).toBeTruthy();
  });

  it('stops an out-of-scale bar at the edge and still writes the number', () => {
    const h = hand('open_palm');
    // Dito più lungo del normale: il rapporto supera 1.
    const stretched = {
      landmarks: h.landmarks.map((p, i) => (i === 8 ? { ...p, y: p.y - 0.5 } : p)),
    };
    const value = poseMetrics(stretched).fingers.index;
    expect(value).toBeGreaterThan(1);
    render(<BenchPanel view={view()} hand={stretched} tuning={DEFAULT_TUNING} log={[]} />);
    const index = screen.getByRole('meter', { name: 'Indice' });
    expect((index.querySelector('[data-fill]') as HTMLElement).style.width).toBe('100%');
    expect(screen.getByText(value.toFixed(2))).toBeTruthy();
  });

  it('lists the events, most recent first', () => {
    render(
      <BenchPanel
        view={view()}
        hand={hand('thumb_up')}
        tuning={DEFAULT_TUNING}
        log={[
          { t: 2_000, label: 'CONFIRM' },
          { t: 1_000, label: 'FOCUS_NEXT' },
        ]}
      />,
    );
    const items = within(screen.getByRole('region', { name: 'Eventi' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['CONFIRM2.0 s', 'FOCUS_NEXT1.0 s']);
  });

  it('says when no hand is in view and leaves the bars empty', () => {
    render(<BenchPanel view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} />);
    expect(screen.getAllByText('Nessuna mano in vista.').length).toBeGreaterThan(0);
    for (const meter of screen.getAllByRole('meter')) {
      expect((meter.querySelector('[data-fill]') as HTMLElement).style.width).toBe('0%');
    }
  });

  it('lays the tiles in three columns on a wide screen, stacked in «Avanzate»', () => {
    const { container, rerender } = render(
      <BenchPanel view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} />,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('lg:grid-cols-3');
    // Una riga alta quanto lo spazio: ogni riquadro scorre dentro di sé.
    expect((container.firstElementChild as HTMLElement).className).toContain('h-full');
    rerender(<BenchPanel view={null} hand={null} tuning={DEFAULT_TUNING} log={[]} stacked />);
    expect((container.firstElementChild as HTMLElement).className).not.toContain('lg:grid-cols-3');
  });
});
