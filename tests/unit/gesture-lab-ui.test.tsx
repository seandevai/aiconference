// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LabControls } from '@/app/dev/gesture-lab/lab-controls';
import { ReplayPanel } from '@/app/dev/gesture-lab/replay-panel';
import { EventList } from '@/app/dev/gesture-lab/event-list';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { hand } from '../fixtures/hands';

afterEach(cleanup);

describe('LabControls', () => {
  it('turns a correction on', () => {
    const onChange = vi.fn();
    render(<LabControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Filtro anti-tremolio'));
    expect(onChange.mock.calls[0]![0].tuning.smoothing.enabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Cursore fluido a 60fps'));
    expect(onChange.mock.calls[1]![0].toggles.smoothCursor).toBe(true);
  });

  it('changes a threshold with its slider', () => {
    const onChange = vi.fn();
    render(<LabControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Attesa del gesto (ms)'), { target: { value: '600' } });
    expect(onChange.mock.calls[0]![0].tuning.timings.holdMs).toBe(600);
  });

  it('turns a gesture off in the dictionary, and offers drag only to the pinch', () => {
    const onChange = vi.fn();
    render(<LabControls settings={DEFAULT_LAB_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Flick verso l’alto'), { target: { value: '' } });
    expect(onChange.mock.calls[0]![0].dictionary.flick_up).toBeNull();
    const pinch = screen.getByLabelText('Pinch e trascina') as HTMLSelectElement;
    expect([...pinch.options].map((o) => o.value)).toEqual(['DRAG', '']);
    const swipe = screen.getByLabelText('Swipe a sinistra') as HTMLSelectElement;
    expect([...swipe.options].map((o) => o.value)).not.toContain('DRAG');
  });

  it('resets to the defaults', () => {
    const onChange = vi.fn();
    const changed = {
      ...DEFAULT_LAB_SETTINGS,
      toggles: { ...DEFAULT_LAB_SETTINGS.toggles, feedback: true },
    };
    render(<LabControls settings={changed} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina predefiniti' }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_LAB_SETTINGS);
  });
});

describe('ReplayPanel', () => {
  const file = (content: string) =>
    new File([content], 'FOCUS_NEXT-test.json', { type: 'application/json' });

  it('loads a valid recording and shows what it expects', async () => {
    const onLoad = vi.fn();
    render(
      <ReplayPanel
        recording={null}
        playing={false}
        onLoad={onLoad}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        fired={[]}
      />,
    );
    const json = JSON.stringify({
      expect: 'FOCUS_NEXT',
      armed: true,
      frames: [{ t: 0, hands: [hand('fist')] }],
    });
    fireEvent.change(screen.getByLabelText('Registrazione da rigiocare'), {
      target: { files: [file(json)] },
    });
    await waitFor(() => expect(onLoad).toHaveBeenCalled());
    expect(onLoad.mock.calls[0]![0].expect).toBe('FOCUS_NEXT');
  });

  it('refuses a file that is not a recording', async () => {
    render(
      <ReplayPanel
        recording={null}
        playing={false}
        onLoad={vi.fn()}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        fired={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Registrazione da rigiocare'), {
      target: { files: [file('{"hello": 1}')] },
    });
    expect(
      await screen.findByText('Questo file non è una registrazione del registratore di gesture.'),
    ).toBeTruthy();
  });

  it('shows the expected event next to the fired ones', () => {
    render(
      <ReplayPanel
        recording={{ expect: 'FOCUS_NEXT', armed: true, frames: [{ t: 0, hands: [] }] }}
        playing={false}
        onLoad={vi.fn()}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        fired={['FOCUS_NEXT']}
      />,
    );
    expect(screen.getByText('Atteso: FOCUS_NEXT')).toBeTruthy();
    expect(screen.getByText('Scattati: FOCUS_NEXT')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rigioca' })).toBeTruthy();
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
