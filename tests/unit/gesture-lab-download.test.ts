import { describe, expect, it } from 'vitest';
import { recordingFileName } from '@/lib/gesture-lab/download';

describe('recordingFileName', () => {
  it('strips accents and punctuation from the label', () => {
    expect(recordingFileName('FOCUS_NEXT', 'Perché sì')).toBe('FOCUS_NEXT-perche-si.json');
  });

  it('falls back to a generic slug when nothing is left', () => {
    expect(recordingFileName('CONFIRM', '???')).toBe('CONFIRM-gesture.json');
    expect(recordingFileName('CONFIRM', undefined)).toBe('CONFIRM-gesture.json');
  });

  it('trims dashes and marks a new gesture', () => {
    expect(recordingFileName(null, '  --due dita a V--  ')).toBe('NUOVA-due-dita-a-v.json');
  });
});
