import { fingerRatio, palmSize, pinchRatio, thumbExtended, type Finger } from './geometry';
import type { Hand, Pose } from './types';

export const PINCH_ON = 0.25;
export const PINCH_OFF = 0.35;

const EXTENDED = 1.6;
const FOLDED = 1.2;
const OTHERS: Finger[] = ['middle', 'ring', 'pinky'];

export function classifyPose(hand: Hand, wasPinching = false): Pose {
  if (hand.landmarks.length < 21) return 'none';
  if (pinchRatio(hand) < (wasPinching ? PINCH_OFF : PINCH_ON)) return 'pinch';

  const extended = (f: Finger) => fingerRatio(hand, f) > EXTENDED;
  const folded = (f: Finger) => fingerRatio(hand, f) < FOLDED;
  const thumb = thumbExtended(hand);
  const fourExtended = extended('index') && OTHERS.every(extended);
  const fourFolded = folded('index') && OTHERS.every(folded);

  if (fourExtended && thumb) return 'open_palm';
  if (extended('index') && OTHERS.every(folded) && !thumb) return 'index_up';
  if (fourFolded && thumb) {
    const tip = hand.landmarks[4]!;
    const base = hand.landmarks[2]!;
    const margin = 0.3 * palmSize(hand);
    if (tip.y < base.y - margin) return 'thumb_up';
    if (tip.y > base.y + margin) return 'thumb_down';
  }
  if (fourFolded && !thumb) return 'fist';
  return 'none';
}
