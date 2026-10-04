// @vitest-environment happy-dom
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomTimerNotice, RoomTimerPill } from '@/app/room/[code]/room-timer';
import { useTimerEnd, type RoomTimerView } from '@/lib/call/use-room-timer';
import type { TimerPhase } from '@/lib/rooms/timer';

afterEach(cleanup);

const view = (over: Partial<RoomTimerView>): RoomTimerView => ({
  endsAt: '2026-10-04T11:00:00Z',
  capAt: '2026-10-04T13:00:00Z',
  remainingSeconds: 42 * 60,
  phase: 'normal',
  extendOptions: [15, 30],
  ...over,
});

const handlers = () => ({ onExtend: vi.fn(), onEndNow: vi.fn() });

describe('RoomTimerPill', () => {
  it('shows the time left', () => {
    render(<RoomTimerPill timer={view({})} />);
    expect(screen.getByText('42 min')).toBeTruthy();
    expect(screen.getByLabelText('Tempo rimasto')).toBeTruthy();
  });
});

describe('RoomTimerNotice', () => {
  it('shows nothing to the host before five minutes', () => {
    const { container } = render(
      <RoomTimerNotice role="host" timer={view({})} extending={false} {...handlers()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('offers the host both extensions and ending now at five minutes', () => {
    const h = handlers();
    render(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 299, phase: 'warning' })}
        extending={false}
        {...h}
      />,
    );
    expect(screen.getByText('La riunione termina fra 4:59')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+30 min' }));
    expect(h.onExtend).toHaveBeenCalledWith(30);
    fireEvent.click(screen.getByRole('button', { name: 'Termina ora' }));
    expect(h.onEndNow).toHaveBeenCalled();
  });

  it('hides an extension past the cap and says so when none is left', () => {
    const { rerender } = render(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 200, phase: 'warning', extendOptions: [15] })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(screen.queryByRole('button', { name: '+30 min' })).toBeNull();
    expect(screen.getByRole('button', { name: '+15 min' })).toBeTruthy();
    rerender(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 200, phase: 'warning', extendOptions: [] })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(screen.queryByRole('button', { name: '+15 min' })).toBeNull();
    expect(screen.getByText(/Hai raggiunto il massimo di 3 ore/)).toBeTruthy();
  });

  it('disables the extensions while one is in flight', () => {
    render(
      <RoomTimerNotice
        role="host"
        timer={view({ remainingSeconds: 200, phase: 'warning' })}
        extending
        {...handlers()}
      />,
    );
    expect((screen.getByRole('button', { name: '+15 min' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('warns a guest only in the last minute', () => {
    const { container, rerender } = render(
      <RoomTimerNotice
        role="guest"
        timer={view({ remainingSeconds: 200, phase: 'warning' })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(container.textContent).toBe('');
    rerender(
      <RoomTimerNotice
        role="guest"
        timer={view({ remainingSeconds: 42, phase: 'last-minute' })}
        extending={false}
        {...handlers()}
      />,
    );
    expect(screen.getByText('La riunione sta per terminare · 0:42')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('useTimerEnd', () => {
  it('fires once when the phase reaches over, and again after an extension', () => {
    const onEnd = vi.fn();
    const { rerender } = renderHook(({ phase }) => useTimerEnd(phase, true, onEnd), {
      initialProps: { phase: 'last-minute' as TimerPhase },
    });
    expect(onEnd).not.toHaveBeenCalled();
    rerender({ phase: 'over' });
    rerender({ phase: 'over' });
    expect(onEnd).toHaveBeenCalledTimes(1);
    rerender({ phase: 'normal' });
    rerender({ phase: 'over' });
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the call is not live', () => {
    const onEnd = vi.fn();
    renderHook(() => useTimerEnd('over', false, onEnd));
    expect(onEnd).not.toHaveBeenCalled();
  });
});
