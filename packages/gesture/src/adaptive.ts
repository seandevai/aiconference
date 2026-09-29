export const FPS_LADDER = [30, 20, 15, 10] as const;

// Il video vince sempre (ADR-0005): se l'inferenza supera il budget, prima cade il gesto
// a due mani (tracking doppio), poi la frequenza. Quando torna la calma si risale.
export function createAdaptiveController(
  options: {
    targetFps?: number;
    minFps?: number;
    budgetRatio?: number;
    window?: number;
    recoverAfter?: number;
  } = {},
) {
  const targetFps = options.targetFps ?? 30;
  const minFps = options.minFps ?? 10;
  const budgetRatio = options.budgetRatio ?? 0.5;
  const window = options.window ?? 30;
  const recoverAfter = options.recoverAfter ?? 90;

  let fps: number = targetFps;
  let twoHands = true;
  let samples: number[] = [];
  let calm = 0;

  const state = () => ({ fps, twoHands });

  return {
    current: state,
    record(inferenceMs: number): { fps: number; twoHands: boolean } | null {
      samples.push(inferenceMs);
      if (samples.length < window) return null;
      const average = samples.reduce((a, b) => a + b, 0) / samples.length;
      samples = [];
      const budget = (1000 / fps) * budgetRatio;

      if (average > budget) {
        calm = 0;
        if (twoHands) {
          twoHands = false;
          return state();
        }
        const lower = FPS_LADDER.find((step) => step < fps && step >= minFps);
        if (lower === undefined) return null;
        fps = lower;
        return state();
      }

      if (average < budget / 2) {
        calm += window;
        if (calm < recoverAfter) return null;
        calm = 0;
        const higher = [...FPS_LADDER].reverse().find((step) => step > fps && step <= targetFps);
        if (higher !== undefined) {
          fps = higher;
          return state();
        }
        if (!twoHands) {
          twoHands = true;
          return state();
        }
        return null;
      }

      calm = 0;
      return null;
    },
  };
}
