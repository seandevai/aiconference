import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { createAdaptiveController } from './adaptive';
import { createRecognizer } from './recognizer';
import type { Dictionary, Frame, GestureEvent } from './types';

// Scaricati una volta: il modello gira nel browser, frame e landmark non escono mai.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type GestureRunner = { setArmed(armed: boolean): void; stop(): void };

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
    onFrame?(frame: Frame): void;
    armed?: boolean;
    dictionary?: Dictionary;
  },
): Promise<GestureRunner> {
  const landmarker = await createLandmarker();
  const recognizer = createRecognizer({
    ...(options.dictionary ? { dictionary: options.dictionary } : {}),
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
        recognizer.setTwoHands(change.twoHands);
        void landmarker.setOptions({ numHands: change.twoHands ? 2 : 1 });
      }
      const frame: Frame = {
        t: now,
        hands: result.landmarks.map((points) => ({
          landmarks: points.map(({ x, y, z }) => ({ x, y, z })),
        })),
      };
      options.onFrame?.(frame);
      for (const event of recognizer.push(frame)) options.onEvent(event);
    }
    handle = video.requestVideoFrameCallback(tick);
  };
  handle = video.requestVideoFrameCallback(tick);

  return {
    setArmed(armed) {
      recognizer.setArmed(armed);
    },
    stop() {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
      landmarker.close();
    },
  };
}
