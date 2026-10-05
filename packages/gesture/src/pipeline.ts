import { createHandSmoother, type HandSmoother } from './filter';
import { DEFAULT_DICTIONARY, createRecognizer, type RecognizerView } from './recognizer';
import { DEFAULT_TUNING, type Tuning } from './tuning';
import type { Dictionary, Frame, GestureEvent } from './types';

export type PipelineOutput = { frame: Frame; events: GestureEvent[]; view: RecognizerView };

export type Pipeline = {
  push(frame: Frame): PipelineOutput;
  setArmed(armed: boolean): void;
  setTwoHands(on: boolean): void;
  isArmed(): boolean;
  reconfigure(next: { tuning?: Tuning; dictionary?: Dictionary }): void;
};

const smootherFor = (tuning: Tuning): HandSmoother | null =>
  tuning.smoothing.enabled
    ? createHandSmoother({ minCutoff: tuning.smoothing.minCutoff, beta: tuning.smoothing.beta })
    : null;

// Una sola catena per webcam e rigioco: stesso comportamento dal vivo e su registrazione.
export function createPipeline(
  options: { tuning?: Tuning; dictionary?: Dictionary; armed?: boolean; twoHands?: boolean } = {},
): Pipeline {
  let tuning = options.tuning ?? DEFAULT_TUNING;
  let dictionary = options.dictionary ?? DEFAULT_DICTIONARY;
  let twoHands = options.twoHands ?? true;
  let recognizer = createRecognizer({
    tuning,
    dictionary,
    armed: options.armed ?? false,
    twoHands,
  });
  let smoother = smootherFor(tuning);

  return {
    push(frame) {
      const processed = smoother ? smoother.smooth(frame) : frame;
      const events = recognizer.push(processed);
      return { frame: processed, events, view: recognizer.view() };
    },
    setArmed(armed) {
      recognizer.setArmed(armed);
    },
    setTwoHands(on) {
      twoHands = on;
      recognizer.setTwoHands(on);
    },
    isArmed: () => recognizer.isArmed(),
    // Si ricomincia da capo (hold, movimenti, filtro), tenendo solo lo stato armato.
    reconfigure(next) {
      tuning = next.tuning ?? tuning;
      dictionary = next.dictionary ?? dictionary;
      recognizer = createRecognizer({ tuning, dictionary, armed: recognizer.isArmed(), twoHands });
      smoother = smootherFor(tuning);
    },
  };
}
