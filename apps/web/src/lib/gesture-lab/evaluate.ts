import { createPipeline, type GestureEvent } from '@omnicanvas/gesture';
import type { Recording } from './recording';
import { effectiveTuning, type LabSettings } from './settings';

// Esito immediato: la registrazione passa tutta, senza attese, nella stessa pipeline del
// rigioco. MOVE e DROP accompagnano un trascinamento e non sono gesti: restano fuori.
export function evaluateRecording(
  recording: Pick<Recording, 'frames' | 'armed'>,
  settings: LabSettings,
): GestureEvent['type'][] {
  const pipeline = createPipeline({
    tuning: effectiveTuning(settings),
    dictionary: settings.dictionary,
    armed: recording.armed,
  });
  return recording.frames
    .flatMap((frame) => pipeline.push(frame).events.map((event) => event.type))
    .filter((type) => type !== 'MOVE' && type !== 'DROP');
}

export type Outcome =
  { kind: 'new' } | { kind: 'recognized' } | { kind: 'missed'; fired: GestureEvent['type'][] };

export function recordingOutcome(
  expect: GestureEvent['type'] | null,
  fired: GestureEvent['type'][],
): Outcome {
  if (expect === null) return { kind: 'new' };
  return fired.includes(expect) ? { kind: 'recognized' } : { kind: 'missed', fired };
}
