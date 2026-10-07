import { fingerRatio, palmSize, pinchRatio, thumbExtended, type Finger } from './geometry';
import { DEFAULT_POSE_THRESHOLDS, type PoseThresholds } from './tuning';
import type { Hand, Pose } from './types';

export const PINCH_ON = DEFAULT_POSE_THRESHOLDS.pinchOn;
export const PINCH_OFF = DEFAULT_POSE_THRESHOLDS.pinchOff;

const FINGER_NAMES: Finger[] = ['index', 'middle', 'ring', 'pinky'];
const OTHERS: Finger[] = ['middle', 'ring', 'pinky'];

export function classifyPose(
  hand: Hand,
  wasPinching = false,
  thresholds: PoseThresholds = DEFAULT_POSE_THRESHOLDS,
): Pose {
  if (hand.landmarks.length < 21) return 'none';
  if (pinchRatio(hand) < (wasPinching ? thresholds.pinchOff : thresholds.pinchOn)) return 'pinch';

  const extended = (f: Finger) => fingerRatio(hand, f) > thresholds.extended;
  const folded = (f: Finger) => fingerRatio(hand, f) < thresholds.folded;
  const thumb = thumbExtended(hand);
  const fourExtended = extended('index') && OTHERS.every(extended);
  const fourFolded = folded('index') && OTHERS.every(folded);

  if (fourExtended && thumb) return 'open_palm';
  if (extended('index') && OTHERS.every(folded) && !thumb) return 'index_up';
  if (fourFolded && thumb) {
    const tip = hand.landmarks[4]!;
    const base = hand.landmarks[2]!;
    const margin = thresholds.thumbMargin * palmSize(hand);
    if (tip.y < base.y - margin) return 'thumb_up';
    if (tip.y > base.y + margin) return 'thumb_down';
  }
  if (fourFolded && !thumb) return 'fist';
  return 'none';
}

export type PoseMetrics = {
  fingers: Record<Finger, number>;
  pinch: number;
  thumbExtended: boolean;
};

// I numeri che decidono la posa, per il laboratorio: rapporti delle dita e del pinch.
export function poseMetrics(hand: Hand): PoseMetrics {
  const fingers = Object.fromEntries(
    FINGER_NAMES.map((f) => [f, fingerRatio(hand, f)]),
  ) as Record<Finger, number>;
  return { fingers, pinch: pinchRatio(hand), thumbExtended: thumbExtended(hand) };
}
