import { describe, expect, it } from 'vitest';
import { LOG_LIMIT, appendEvent, type LogEntry } from '@/lib/gesture-lab/event-log';

describe('appendEvent', () => {
  it('writes discrete events and the armed state in words', () => {
    let log: LogEntry[] = [];
    log = appendEvent(log, { type: 'GESTURES_TOGGLE', armed: true }, 10);
    log = appendEvent(log, { type: 'FOCUS_NEXT' }, 20);
    expect(log).toEqual([
      { t: 20, label: 'FOCUS_NEXT' },
      { t: 10, label: 'Gesture attive' },
    ]);
  });

  it('groups a drag into one line', () => {
    let log: LogEntry[] = [];
    log = appendEvent(log, { type: 'GRAB', x: 0.1, y: 0.1 }, 0);
    log = appendEvent(log, { type: 'MOVE', x: 0.2, y: 0.1 }, 33);
    log = appendEvent(log, { type: 'MOVE', x: 0.3, y: 0.1 }, 66);
    log = appendEvent(log, { type: 'DROP', x: 0.3, y: 0.1 }, 99);
    expect(log).toEqual([{ t: 0, label: 'Trascinamento → rilascio' }]);
  });

  it('keeps the latest entries only', () => {
    let log: LogEntry[] = [];
    for (let i = 0; i < LOG_LIMIT + 5; i++) log = appendEvent(log, { type: 'FOCUS_PREV' }, i);
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]!.t).toBe(LOG_LIMIT + 4);
  });
});
