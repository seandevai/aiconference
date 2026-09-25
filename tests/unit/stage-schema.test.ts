import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  applyCommand,
  emptyStage,
  parseStage,
  parseStageMessage,
  sampleContent,
} from '@omnicanvas/canvas';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('stage schemas', () => {
  it('accepts a command message with a valid content', () => {
    const message = {
      type: 'command',
      version: 1,
      command: { type: 'TRAY_ADD', content: sampleContent('text', id(1)) },
    };
    expect(parseStageMessage(message)).toEqual(message);
  });

  it('accepts every sample content', () => {
    for (const kind of ['chart', 'text', 'table'] as const) {
      const message = {
        type: 'command',
        version: 1,
        command: { type: 'TRAY_ADD', content: sampleContent(kind, id(2)) },
      };
      expect(parseStageMessage(message)).not.toBeNull();
    }
  });

  it('rejects unknown commands and kinds', () => {
    expect(
      parseStageMessage({ type: 'command', version: 1, command: { type: 'DELETE_ALL' } }),
    ).toBeNull();
    expect(
      parseStageMessage({
        type: 'command',
        version: 1,
        command: { type: 'TRAY_ADD', content: { id: id(3), kind: 'video', data: {} } },
      }),
    ).toBeNull();
  });

  it('rejects content that would not fit a data message', () => {
    const long = {
      ...sampleContent('text', id(4)),
      data: { title: 'x', body: 'y'.repeat(LIMITS.body + 1) },
    };
    expect(
      parseStageMessage({
        type: 'command',
        version: 1,
        command: { type: 'TRAY_ADD', content: long },
      }),
    ).toBeNull();
    const table = sampleContent('table', id(5));
    const huge = {
      ...table,
      data: { ...table.data, rows: Array.from({ length: LIMITS.rows + 1 }, () => ['a', 'b']) },
    };
    expect(
      parseStageMessage({
        type: 'command',
        version: 1,
        command: { type: 'TRAY_ADD', content: huge },
      }),
    ).toBeNull();
  });

  it('rejects ids that are not uuids and non-finite chart values', () => {
    expect(
      parseStageMessage({ type: 'command', version: 1, command: { type: 'FOCUS', windowId: 'x' } }),
    ).toBeNull();
    const chart = sampleContent('chart', id(6));
    const bad = { ...chart, data: { ...chart.data, values: [1, Number.NaN, 3, 4] } };
    expect(
      parseStageMessage({
        type: 'command',
        version: 1,
        command: { type: 'TRAY_ADD', content: bad },
      }),
    ).toBeNull();
  });

  it('round-trips a stage and rejects two windows in the same slot', () => {
    const stage = [
      { type: 'WINDOW_CREATE', windowId: id(10), title: 'Finestra 1' } as const,
      { type: 'TRAY_ADD', content: sampleContent('chart', id(11)) } as const,
    ].reduce(applyCommand, emptyStage());
    expect(parseStage(stage)).toEqual(stage);
    const clash = {
      ...stage,
      windows: [...stage.windows, { id: id(12), title: 'Finestra 2', slot: 'main', contents: [] }],
    };
    expect(parseStage(clash)).toBeNull();
    expect(parseStage('not a stage')).toBeNull();
  });
});
