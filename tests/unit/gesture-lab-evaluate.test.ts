import { describe, expect, it } from 'vitest';
import type { Frame } from '@omnicanvas/gesture';
import { evaluateRecording, recordingOutcome } from '@/lib/gesture-lab/evaluate';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { hand } from '../fixtures/hands';

const held = (pose: 'thumb_up' | 'open_palm'): Frame[] =>
  Array.from({ length: 40 }, (_, i) => ({ t: i * 33, hands: [hand(pose)] }));

describe('evaluateRecording', () => {
  it('returns the events a recording fires, all at once', () => {
    expect(
      evaluateRecording({ frames: held('thumb_up'), armed: true }, DEFAULT_LAB_SETTINGS),
    ).toEqual(['CONFIRM']);
  });

  it('starts disarmed when the recording says so', () => {
    expect(
      evaluateRecording({ frames: held('thumb_up'), armed: false }, DEFAULT_LAB_SETTINGS),
    ).toEqual([]);
    expect(
      evaluateRecording({ frames: held('open_palm'), armed: false }, DEFAULT_LAB_SETTINGS),
    ).toEqual(['GESTURES_TOGGLE']);
  });

  it('uses the given settings', () => {
    const off = {
      ...DEFAULT_LAB_SETTINGS,
      dictionary: { ...DEFAULT_LAB_SETTINGS.dictionary, thumb_up_hold: null },
    };
    expect(evaluateRecording({ frames: held('thumb_up'), armed: true }, off)).toEqual([]);
  });

  it('returns nothing for an empty recording', () => {
    expect(evaluateRecording({ frames: [], armed: true }, DEFAULT_LAB_SETTINGS)).toEqual([]);
  });

  it('leaves MOVE and DROP out: they are not gestures', () => {
    const drag: Frame[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        t: i * 33,
        hands: [hand('pinch', { x: 0.3 + i * 0.02, y: 0.5 })],
      })),
      ...Array.from({ length: 5 }, (_, i) => ({ t: 330 + i * 33, hands: [] })),
    ];
    const fired = evaluateRecording({ frames: drag, armed: true }, DEFAULT_LAB_SETTINGS);
    expect(fired).toContain('GRAB');
    expect(fired).not.toContain('MOVE');
    expect(fired).not.toContain('DROP');
  });
});

describe('recordingOutcome', () => {
  it('has no comparison for a new gesture', () => {
    expect(recordingOutcome(null, ['CONFIRM'])).toEqual({ kind: 'new' });
  });

  it('is recognized when the expected event is among the fired ones', () => {
    expect(recordingOutcome('CONFIRM', ['GESTURES_TOGGLE', 'CONFIRM'])).toEqual({
      kind: 'recognized',
    });
  });

  it('is missed otherwise, and says what fired', () => {
    expect(recordingOutcome('CONFIRM', ['REJECT'])).toEqual({ kind: 'missed', fired: ['REJECT'] });
  });
});
