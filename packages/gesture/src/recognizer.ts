import { palmCenter, pinchPoint } from './geometry';
import { classifyPose } from './pose';
import type {
  Dictionary,
  Frame,
  GestureCommand,
  GestureEvent,
  GestureName,
  Point,
  Pose,
} from './types';

export const DEFAULT_DICTIONARY: Dictionary = {
  open_palm_hold: 'GESTURES_TOGGLE',
  index_up_hold: 'AGENT_ACTIVATE',
  pinch_drag: 'DRAG',
  swipe_left: 'FOCUS_NEXT',
  swipe_right: 'FOCUS_PREV',
  two_hands_spread: 'WINDOW_CREATE',
  thumb_up_hold: 'CONFIRM',
  thumb_down_hold: 'REJECT',
  flick_up: 'WINDOW_ARCHIVE',
};

export const TIMINGS = {
  holdMs: 1_000,
  cooldownMs: 800,
  // La mano deve restare ferma (in frazioni dell'immagine) perché un hold conti.
  stillness: 0.08,
  swipe: { distance: 0.25, withinMs: 400 },
  flick: { distance: 0.25, withinMs: 300 },
  spread: { distance: 0.2, withinMs: 600 },
} as const;

const HOLDS: Partial<Record<Pose, GestureName>> = {
  open_palm: 'open_palm_hold',
  index_up: 'index_up_hold',
  thumb_up: 'thumb_up_hold',
  thumb_down: 'thumb_down_hold',
};

export type Recognizer = {
  push(frame: Frame): GestureEvent[];
  setArmed(armed: boolean): void;
  setTwoHands(on: boolean): void;
  isArmed(): boolean;
};

type Sample = Point & { t: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function oldestWithin<T extends { t: number }>(
  samples: T[],
  t: number,
  withinMs: number,
): T | undefined {
  return samples.find((s) => t - s.t <= withinMs);
}

export function createRecognizer(
  options: { dictionary?: Dictionary; armed?: boolean; twoHands?: boolean } = {},
): Recognizer {
  const dictionary = options.dictionary ?? DEFAULT_DICTIONARY;
  let armed = options.armed ?? false;
  let twoHands = options.twoHands ?? true;

  let hold: { pose: Pose; start: number; anchor: Point; fired: boolean } | null = null;
  let pinching = false;
  let dragging: Point | null = null;
  let cooldownUntil = 0;
  let palms: Sample[] = [];
  let spreads: { t: number; d: number }[] = [];

  const resetMotion = () => {
    palms = [];
    spreads = [];
  };

  const fire = (name: GestureName, t: number, out: GestureEvent[]) => {
    const command: GestureCommand | null = dictionary[name];
    if (!command || command === 'DRAG' || t < cooldownUntil) return;
    if (command === 'GESTURES_TOGGLE') {
      armed = !armed;
      out.push({ type: 'GESTURES_TOGGLE', armed });
    } else {
      if (!armed) return;
      out.push({ type: command });
    }
    cooldownUntil = t + TIMINGS.cooldownMs;
    resetMotion();
  };

  return {
    push(frame) {
      const out: GestureEvent[] = [];
      const { t } = frame;
      const primary = frame.hands[0];

      if (!primary) {
        hold = null;
        pinching = false;
        resetMotion();
        if (dragging) out.push({ type: 'DROP', ...dragging });
        dragging = null;
        return out;
      }

      const pose = classifyPose(primary, pinching);
      pinching = pose === 'pinch';
      const center = palmCenter(primary);

      // Pinch-trascina-rilascia: un GRAB, un MOVE per frame, un DROP.
      const dragAllowed = armed && dictionary.pinch_drag === 'DRAG';
      if (dragging && !(pinching && dragAllowed)) {
        out.push({ type: 'DROP', ...dragging });
        dragging = null;
      } else if (pinching && dragAllowed) {
        const point = pinchPoint(primary);
        out.push({ type: dragging ? 'MOVE' : 'GRAB', ...point });
        dragging = point;
      }
      if (dragging) {
        hold = null;
        resetMotion();
        return out;
      }

      // Hold: stessa posa, mano ferma, per holdMs. Un solo evento per hold.
      const holdName = HOLDS[pose];
      if (!holdName) {
        hold = null;
      } else if (!hold || hold.pose !== pose || distance(hold.anchor, center) > TIMINGS.stillness) {
        hold = { pose, start: t, anchor: center, fired: false };
      } else if (!hold.fired && t - hold.start >= TIMINGS.holdMs) {
        hold.fired = true;
        fire(holdName, t, out);
      }

      // Movimenti: swipe e flick sul centro del palmo, due mani sulla loro distanza.
      palms = [...palms.filter((s) => t - s.t <= TIMINGS.spread.withinMs), { t, ...center }];
      const swipeFrom = oldestWithin(palms, t, TIMINGS.swipe.withinMs);
      if (swipeFrom) {
        const dx = center.x - swipeFrom.x;
        const dy = center.y - swipeFrom.y;
        if (Math.abs(dx) >= TIMINGS.swipe.distance && Math.abs(dy) < Math.abs(dx) / 2) {
          // Immagine verso destra = schermo (a specchio) verso sinistra.
          fire(dx > 0 ? 'swipe_left' : 'swipe_right', t, out);
        }
      }
      const flickFrom = oldestWithin(palms, t, TIMINGS.flick.withinMs);
      if (flickFrom && pose === 'open_palm') {
        const dx = center.x - flickFrom.x;
        const dy = center.y - flickFrom.y;
        if (dy <= -TIMINGS.flick.distance && Math.abs(dx) < Math.abs(dy) / 2)
          fire('flick_up', t, out);
      }

      const second = frame.hands[1];
      if (twoHands && second) {
        const d = distance(center, palmCenter(second));
        spreads = [...spreads.filter((s) => t - s.t <= TIMINGS.spread.withinMs), { t, d }];
        const from = oldestWithin(spreads, t, TIMINGS.spread.withinMs);
        if (from && d - from.d >= TIMINGS.spread.distance) fire('two_hands_spread', t, out);
      } else {
        spreads = [];
      }

      return out;
    },

    setArmed(value) {
      armed = value;
      if (!value) dragging = null;
    },

    setTwoHands(on) {
      twoHands = on;
      spreads = [];
    },

    isArmed: () => armed,
  };
}
