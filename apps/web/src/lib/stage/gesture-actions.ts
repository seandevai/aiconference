import { MAX_WINDOWS, type Stage, type StageCommand } from '@omnicanvas/canvas';
import type { DiscreteGestureEvent } from '@omnicanvas/gesture';

export type GestureAction =
  { kind: 'command'; command: StageCommand } | { kind: 'agent' } | { kind: 'none' };
export type GestureStatus = 'off' | 'loading' | 'on' | 'no_camera' | 'unavailable';

export function gestureAction(
  event: DiscreteGestureEvent,
  stage: Stage,
  newId: () => string,
): GestureAction {
  switch (event.type) {
    case 'FOCUS_NEXT':
    case 'FOCUS_PREV':
      return { kind: 'command', command: { type: event.type } };
    case 'WINDOW_CREATE':
      return stage.windows.length < MAX_WINDOWS
        ? {
            kind: 'command',
            command: {
              type: 'WINDOW_CREATE',
              windowId: newId(),
              title: `Finestra ${stage.windows.length + 1}`,
            },
          }
        : { kind: 'none' };
    case 'WINDOW_ARCHIVE':
      return stage.focusedId
        ? { kind: 'command', command: { type: 'WINDOW_ARCHIVE', windowId: stage.focusedId } }
        : { kind: 'none' };
    case 'AGENT_ACTIVATE':
      return { kind: 'agent' };
    case 'CONFIRM':
    case 'REJECT':
      // Servono alle immagini con conferma (slice 4B).
      return { kind: 'none' };
  }
}

export function gestureStatusMessage(status: GestureStatus, armed: boolean): string | null {
  switch (status) {
    case 'off':
      return null;
    case 'loading':
      return 'Avvio del riconoscimento delle mani…';
    case 'no_camera':
      return 'Accendi la camera per usare le gesture: ogni comando resta disponibile col mouse.';
    case 'unavailable':
      return 'Gesture non disponibili su questo dispositivo: ogni comando resta disponibile col mouse.';
    case 'on':
      return armed
        ? 'Gesture attive: palmo aperto per un secondo per metterle in pausa.'
        : 'Gesture in pausa: palmo aperto per un secondo per riattivarle.';
  }
}
