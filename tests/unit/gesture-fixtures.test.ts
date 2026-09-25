import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRecognizer, type Frame, type GestureEvent } from '@omnicanvas/gesture';

const dir = new URL('../fixtures/gestures/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

type Recording = { expect: GestureEvent['type']; armed: boolean; frames: Frame[] };

describe.skipIf(files.length === 0)('recorded gestures', () => {
  for (const file of files) {
    it(`${file} produces ${file.split('.')[0]}`, () => {
      const recording = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Recording;
      const recognizer = createRecognizer({ armed: recording.armed });
      const events = recording.frames.flatMap((frame) => recognizer.push(frame)).map((e) => e.type);
      expect(events).toContain(recording.expect);
    });
  }
});

it('keeps the recordings folder in the repository', () => {
  expect(readdirSync(dir)).toContain('README.md');
});
