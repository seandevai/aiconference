// Nessuna dipendenza da finestre, stanze o rete: il pacchetto riceve landmark ed emette eventi.

export type Landmark = { x: number; y: number; z: number };
// 21 punti con gli indici di MediaPipe: 0 polso, 1-4 pollice, 5-8 indice,
// 9-12 medio, 13-16 anulare, 17-20 mignolo.
export type Hand = { landmarks: Landmark[] };
export type Frame = { t: number; hands: Hand[] };
export type Point = { x: number; y: number };

export type Pose = 'open_palm' | 'index_up' | 'pinch' | 'thumb_up' | 'thumb_down' | 'fist' | 'none';

export type GestureName =
  | 'open_palm_hold'
  | 'index_up_hold'
  | 'thumb_up_hold'
  | 'thumb_down_hold'
  | 'pinch_drag'
  | 'swipe_left'
  | 'swipe_right'
  | 'flick_up'
  | 'two_hands_spread';

export type GestureCommand =
  | 'GESTURES_TOGGLE'
  | 'AGENT_ACTIVATE'
  | 'CONFIRM'
  | 'REJECT'
  | 'DRAG'
  | 'FOCUS_NEXT'
  | 'FOCUS_PREV'
  | 'WINDOW_ARCHIVE'
  | 'WINDOW_CREATE';

// ADR-0010: provvisorio e configurabile. null spegne il gesto.
export type Dictionary = Record<GestureName, GestureCommand | null>;

export type DiscreteGestureEvent = {
  type:
    | 'AGENT_ACTIVATE'
    | 'CONFIRM'
    | 'REJECT'
    | 'FOCUS_NEXT'
    | 'FOCUS_PREV'
    | 'WINDOW_ARCHIVE'
    | 'WINDOW_CREATE';
};

export type GestureEvent =
  | { type: 'GESTURES_TOGGLE'; armed: boolean }
  | DiscreteGestureEvent
  | { type: 'GRAB' | 'MOVE' | 'DROP'; x: number; y: number };
