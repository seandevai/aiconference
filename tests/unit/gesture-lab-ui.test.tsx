// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CorrectionControls,
  DictionaryControls,
  TuningControls,
} from '@/app/dev/gesture-lab/lab-controls';
import { EventList } from '@/app/dev/gesture-lab/event-list';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';

afterEach(cleanup);

describe('lab controls', () => {
  it('turns a correction on', () => {
    const onChange = vi.fn();
    render(<CorrectionControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Filtro anti-tremolio'));
    expect(onChange.mock.calls[0]![0].tuning.smoothing.enabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Cursore fluido a 60fps'));
    expect(onChange.mock.calls[1]![0].toggles.smoothCursor).toBe(true);
  });

  it('changes a threshold with its slider', () => {
    const onChange = vi.fn();
    render(<TuningControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Attesa del gesto (ms)'), { target: { value: '600' } });
    expect(onChange.mock.calls[0]![0].tuning.timings.holdMs).toBe(600);
  });

  it('turns a gesture off in the dictionary, and offers drag only to the pinch', () => {
    const onChange = vi.fn();
    render(<DictionaryControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Palmo aperto'), { target: { value: '' } });
    expect(onChange.mock.calls[0]![0].dictionary.open_palm_hold).toBeNull();
    const pinch = screen.getByLabelText('Pinch e trascina') as HTMLSelectElement;
    expect([...pinch.options].map((o) => o.value)).toEqual(['DRAG', '']);
    const swipe = screen.getByLabelText('Swipe a sinistra') as HTMLSelectElement;
    expect([...swipe.options].map((o) => o.value)).not.toContain('DRAG');
  });
});

describe('EventList', () => {
  it('lists entries, newest first', () => {
    render(
      <EventList
        entries={[
          { t: 2_000, label: 'FOCUS_NEXT' },
          { t: 1_000, label: 'Gesture attive' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('FOCUS_NEXT');
    expect(items[1]).toContain('Gesture attive');
  });
});
