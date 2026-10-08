import { palmCenter, pinchPoint } from './geometry';
import { classifyPose } from './pose';
import { DEFAULT_TUNING, type Tuning } from './tuning';
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

export const GESTURE_NAMES = Object.keys(DEFAULT_DICTIONARY) as readonly GestureName[];

export const GESTURE_COMMANDS: readonly GestureCommand[] = [
  'GESTURES_TOGGLE',
  'AGENT_ACTIVATE',
  'CONFIRM',
  'REJECT',
  'DRAG',
  'FOCUS_NEXT',
  'FOCUS_PREV',
  'WINDOW_ARCHIVE',
  'WINDOW_CREATE',
];

// Compatibilità: i tempi predefiniti, gli stessi di DEFAULT_TUNING.
export const TIMINGS = DEFAULT_TUNING.timings;

const HOLDS: Partial<Record<Pose, GestureName>> = {
  open_palm: 'open_palm_hold',
  index_up: 'index_up_hold',
  thumb_up: 'thumb_up_hold',
  thumb_down: 'thumb_down_hold',
};

// Cosa sta «pensando» il riconoscitore: il laboratorio ci disegna sopra anello e posa.
export type RecognizerView = {
  rawPose: Pose;
  pose: Pose;
  hold: { pose: Pose; progress: number } | null;
  armed: boolean;
  cooldownLeftMs: number;
  dragging: boolean;
};

export type Recognizer = {
  push(frame: Frame): GestureEvent[];
  setArmed(armed: boolean): void;
  setTwoHands(on: boolean): void;
  isArmed(): boolean;
  view(): RecognizerView;
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
  options: { dictionary?: Dictionary; armed?: boolean; twoHands?: boolean; tuning?: Tuning } = {},
): Recognizer {
  const dictionary = options.dictionary ?? DEFAULT_DICTIONARY;
  const { timings, pose: thresholds, stability } = options.tuning ?? DEFAULT_TUNING;
  // I campioni del palmo servono a swipe, flick e due mani: si tiene la finestra più lunga.
  const motionWindowMs = Math.max(
    timings.swipe.withinMs,
    timings.flick.withinMs,
    timings.spread.withinMs,
  );
  let armed = options.armed ?? false;
  let twoHands = options.twoHands ?? true;

  let hold: { pose: Pose; start: number; anchor: Point; fired: boolean } | null = null;
  let rawPinching = false;
  let dragging: Point | null = null;
  let cooldownUntil = 0;
  let palms: Sample[] = [];
  let spreads: { t: number; d: number }[] = [];
  let rawPose: Pose = 'none';
  let stable: { pose: Pose; candidate: Pose; count: number } = {
    pose: 'none',
    candidate: 'none',
    count: 0,
  };
  let lastT = 0;

  const resetMotion = () => {
    palms = [];
    spreads = [];
  };

  // Una posa nuova vale dopo `stability.frames` fotogrammi uguali di fila.
  const stabilize = (next: Pose): Pose => {
    if (next === stable.candidate) stable.count += 1;
    else stable = { pose: stable.pose, candidate: next, count: 1 };
    if (stable.count >= stability.frames) stable.pose = next;
    return stable.pose;
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
    cooldownUntil = t + timings.cooldownMs;
    resetMotion();
  };

  return {
    push(frame) {
      const out: GestureEvent[] = [];
      const { t } = frame;
      lastT = t;
      const primary = frame.hands[0];

      if (!primary) {
        hold = null;
        rawPinching = false;
        rawPose = 'none';
        stable = { pose: 'none', candidate: 'none', count: 0 };
        resetMotion();
        if (dragging) out.push({ type: 'DROP', ...dragging });
        dragging = null;
        return out;
      }

      rawPose = classifyPose(primary, rawPinching, thresholds);
      rawPinching = rawPose === 'pinch';
      const pose = stabilize(rawPose);
      const pinching = pose === 'pinch';
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
      } else if (!hold || hold.pose !== pose || distance(hold.anchor, center) > timings.stillness) {
        hold = { pose, start: t, anchor: center, fired: false };
      } else if (!hold.fired && t - hold.start >= timings.holdMs) {
        hold.fired = true;
        fire(holdName, t, out);
      }

      // Movimenti: swipe e flick sul centro del palmo, due mani sulla loro distanza.
      palms = [...palms.filter((s) => t - s.t <= motionWindowMs), { t, ...center }];
      const swipeFrom = oldestWithin(palms, t, timings.swipe.withinMs);
      if (swipeFrom) {
        const dx = center.x - swipeFrom.x;
        const dy = center.y - swipeFrom.y;
        if (Math.abs(dx) >= timings.swipe.distance && Math.abs(dy) < Math.abs(dx) / 2) {
          // Immagine verso destra = schermo (a specchio) verso sinistra.
          fire(dx > 0 ? 'swipe_left' : 'swipe_right', t, out);
        }
      }
      const flickFrom = oldestWithin(palms, t, timings.flick.withinMs);
      if (flickFrom && pose === 'open_palm') {
        const dx = center.x - flickFrom.x;
        const dy = center.y - flickFrom.y;
        if (dy <= -timings.flick.distance && Math.abs(dx) < Math.abs(dy) / 2)
          fire('flick_up', t, out);
      }

      const second = frame.hands[1];
      if (twoHands && second) {
        const d = distance(center, palmCenter(second));
        spreads = [...spreads.filter((s) => t - s.t <= timings.spread.withinMs), { t, d }];
        const from = oldestWithin(spreads, t, timings.spread.withinMs);
        if (from && d - from.d >= timings.spread.distance) fire('two_hands_spread', t, out);
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

    view() {
      return {
        rawPose,
        pose: stable.pose,
        hold:
          hold && !hold.fired
            ? { pose: hold.pose, progress: Math.min(1, (lastT - hold.start) / timings.holdMs) }
            : null,
        armed,
        cooldownLeftMs: Math.max(0, cooldownUntil - lastT),
        dragging: dragging !== null,
      };
    },
  };
}
