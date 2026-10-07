import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { createAdaptiveController } from './adaptive';
import { createPipeline } from './pipeline';
import type { RecognizerView } from './recognizer';
import type { Tuning } from './tuning';
import type { Dictionary, Frame, GestureEvent } from './types';

// Scaricati una volta: il modello gira nel browser, frame e landmark non escono mai.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type GestureRunner = {
  setArmed(armed: boolean): void;
  reconfigure(next: { tuning?: Tuning; dictionary?: Dictionary }): void;
  stop(): void;
};

async function createLandmarker(): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const base = { runningMode: 'VIDEO' as const, numHands: 2 };
  try {
    return await HandLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
    });
  } catch {
    return HandLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' },
    });
  }
}

export async function startGestures(
  video: HTMLVideoElement,
  options: {
    onEvent(event: GestureEvent): void;
    // Fotogramma grezzo (quello da registrare), quello usato dal riconoscitore e la sua vista.
    onFrame?(raw: Frame, processed: Frame, view: RecognizerView): void;
    armed?: boolean;
    dictionary?: Dictionary;
    tuning?: Tuning;
  },
): Promise<GestureRunner> {
  const landmarker = await createLandmarker();
  const pipeline = createPipeline({
    ...(options.dictionary ? { dictionary: options.dictionary } : {}),
    ...(options.tuning ? { tuning: options.tuning } : {}),
    armed: options.armed ?? false,
  });
  const adaptive = createAdaptiveController();
  let stopped = false;
  let lastRun = 0;
  let handle = 0;

  const tick = (now: number) => {
    if (stopped) return;
    const { fps } = adaptive.current();
    if (now - lastRun >= 1000 / fps && video.readyState >= 2) {
      lastRun = now;
      const started = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const change = adaptive.record(performance.now() - started);
      if (change) {
        pipeline.setTwoHands(change.twoHands);
        void landmarker.setOptions({ numHands: change.twoHands ? 2 : 1 });
      }
      const frame: Frame = {
        t: now,
        hands: result.landmarks.map((points) => ({
          landmarks: points.map(({ x, y, z }) => ({ x, y, z })),
        })),
      };
      const out = pipeline.push(frame);
      options.onFrame?.(frame, out.frame, out.view);
      for (const event of out.events) options.onEvent(event);
    }
    handle = video.requestVideoFrameCallback(tick);
  };
  handle = video.requestVideoFrameCallback(tick);

  return {
    setArmed(armed) {
      pipeline.setArmed(armed);
    },
    reconfigure(next) {
      pipeline.reconfigure(next);
    },
    stop() {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
      landmarker.close();
    },
  };
}
