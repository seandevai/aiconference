import { describe, expect, it } from 'vitest';
import { MAX_WINDOWS, applyCommand, emptyStage } from '@omnicanvas/canvas';
import { gestureAction, gestureStatusMessage } from '@/lib/stage/gesture-actions';

const newId = () => 'new-id';
const one = applyCommand(emptyStage(), {
  type: 'WINDOW_CREATE',
  windowId: 'A',
  title: 'Finestra 1',
});

describe('gestureAction', () => {
  it('turns focus gestures into stage commands', () => {
    expect(gestureAction({ type: 'FOCUS_NEXT' }, one, newId)).toEqual({
      kind: 'command',
      command: { type: 'FOCUS_NEXT' },
    });
    expect(gestureAction({ type: 'FOCUS_PREV' }, one, newId)).toEqual({
      kind: 'command',
      command: { type: 'FOCUS_PREV' },
    });
  });

  it('creates a numbered window while there is room', () => {
    expect(gestureAction({ type: 'WINDOW_CREATE' }, one, newId)).toEqual({
      kind: 'command',
      command: { type: 'WINDOW_CREATE', windowId: 'new-id', title: 'Finestra 2' },
    });
    let full = emptyStage();
    for (let i = 0; i < MAX_WINDOWS; i += 1)
      full = applyCommand(full, { type: 'WINDOW_CREATE', windowId: `w${i}`, title: `w${i}` });
    expect(gestureAction({ type: 'WINDOW_CREATE' }, full, newId)).toEqual({ kind: 'none' });
  });

  it('archives the focused window, if any', () => {
    expect(gestureAction({ type: 'WINDOW_ARCHIVE' }, one, newId)).toEqual({
      kind: 'command',
      command: { type: 'WINDOW_ARCHIVE', windowId: 'A' },
    });
    expect(gestureAction({ type: 'WINDOW_ARCHIVE' }, emptyStage(), newId)).toEqual({
      kind: 'none',
    });
  });

  it('opens the agent on index up and ignores confirmations for now', () => {
    expect(gestureAction({ type: 'AGENT_ACTIVATE' }, one, newId)).toEqual({ kind: 'agent' });
    expect(gestureAction({ type: 'CONFIRM' }, one, newId)).toEqual({ kind: 'none' });
    expect(gestureAction({ type: 'REJECT' }, one, newId)).toEqual({ kind: 'none' });
  });
});

describe('gestureStatusMessage', () => {
  it('always says that the mouse keeps working when gestures cannot run', () => {
    expect(gestureStatusMessage('no_camera', false)).toMatch(/Accendi la camera.*mouse/);
    expect(gestureStatusMessage('unavailable', false)).toMatch(/non disponibili.*mouse/);
  });

  it('explains how to switch on and off with the palm', () => {
    expect(gestureStatusMessage('on', true)).toBe(
      'Gesture attive: palmo aperto per un secondo per metterle in pausa.',
    );
    expect(gestureStatusMessage('on', false)).toBe(
      'Gesture in pausa: palmo aperto per un secondo per riattivarle.',
    );
    expect(gestureStatusMessage('loading', false)).toBe('Avvio del riconoscimento delle mani…');
    expect(gestureStatusMessage('off', false)).toBeNull();
  });
});
