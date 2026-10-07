import { describe, expect, it } from 'vitest';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';
import { parsePresetInput, parseRecordingInput } from '@/lib/gesture-lab/recording-schema';
import { hand } from '../fixtures/hands';

const input = {
  label: '  due dita a V  ',
  expect: null,
  description: 'indice e medio aperti',
  armed: true,
  frames: [{ t: 0, hands: [hand('fist')] }],
};

describe('parseRecordingInput', () => {
  it('accepts a valid recording and trims the texts', () => {
    expect(parseRecordingInput(input)).toEqual({ ...input, label: 'due dita a V' });
  });

  it('keeps only t and landmarks in the frames', () => {
    const dirty = {
      ...input,
      frames: [{ t: 0, image: 'data:x', hands: [{ ...hand('fist'), photo: 'data:y' }] }],
    };
    expect(parseRecordingInput(dirty)?.frames).toEqual(input.frames);
  });

  it('accepts a known expected event', () => {
    expect(parseRecordingInput({ ...input, expect: 'FOCUS_NEXT' })?.expect).toBe('FOCUS_NEXT');
  });

  it('refuses a missing or too long label, a long description, an unknown event', () => {
    expect(parseRecordingInput({ ...input, label: '   ' })).toBeNull();
    expect(parseRecordingInput({ ...input, label: 'x'.repeat(61) })).toBeNull();
    expect(parseRecordingInput({ ...input, description: 'x'.repeat(501) })).toBeNull();
    expect(parseRecordingInput({ ...input, expect: 'DANCE' })).toBeNull();
  });

  it('refuses broken frames', () => {
    expect(parseRecordingInput({ ...input, frames: [] })).toBeNull();
    expect(parseRecordingInput({ ...input, frames: [{ t: 'x', hands: [] }] })).toBeNull();
  });

  it('refuses frames heavier than the limit', () => {
    const frame = { t: 0, hands: [hand('fist'), hand('fist')] };
    const frames = Array.from({ length: 1_900 }, (_, i) => ({ ...frame, t: i }));
    expect(parseRecordingInput({ ...input, frames })).toBeNull();
  });
});

describe('parsePresetInput', () => {
  it('accepts a name and normalizes the settings', () => {
    expect(parsePresetInput({ name: ' morbido ', settings: {} })).toEqual({
      name: 'morbido',
      settings: DEFAULT_LAB_SETTINGS,
    });
  });

  it('refuses an empty or too long name', () => {
    expect(parsePresetInput({ name: '', settings: {} })).toBeNull();
    expect(parsePresetInput({ name: 'x'.repeat(61), settings: {} })).toBeNull();
  });
});
