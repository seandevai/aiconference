import { describe, expect, it } from 'vitest';
import { emptyStage, followMessage, writeCommand, type Stage } from '@omnicanvas/canvas';

const create = (windowId: string) =>
  ({ type: 'WINDOW_CREATE', windowId, title: windowId }) as const;

describe('single-writer sync', () => {
  it('bumps the version and emits a message only when the stage changes', () => {
    const first = writeCommand(emptyStage(), create('A'));
    expect(first?.stage.version).toBe(1);
    expect(first?.message).toEqual({ type: 'command', version: 1, command: create('A') });
    expect(writeCommand(first!.stage, create('A'))).toBeNull();
  });

  it('applies the next version in order', () => {
    const writer = writeCommand(emptyStage(), create('A'))!;
    const follower = followMessage(emptyStage(), writer.message);
    expect(follower).toEqual({ stage: writer.stage, outOfSync: false });
  });

  it('ignores duplicates and old versions', () => {
    const writer = writeCommand(emptyStage(), create('A'))!;
    const stage = followMessage(emptyStage(), writer.message).stage;
    expect(followMessage(stage, writer.message)).toEqual({ stage, outOfSync: false });
  });

  it('flags a gap instead of applying out of order', () => {
    const one = writeCommand(emptyStage(), create('A'))!;
    const two = writeCommand(one.stage, create('B'))!;
    const result = followMessage(emptyStage(), two.message);
    expect(result.outOfSync).toBe(true);
    expect(result.stage).toEqual(emptyStage());
  });

  it('adopts a snapshot from the writer even when its version is lower', () => {
    const ahead: Stage = { ...emptyStage(), version: 9 };
    const snapshot: Stage = { ...emptyStage(), version: 3 };
    expect(followMessage(ahead, { type: 'snapshot', stage: snapshot })).toEqual({
      stage: snapshot,
      outOfSync: false,
    });
  });
});
