import { describe, expect, it } from 'vitest';
import { DEFAULT_DICTIONARY, GESTURE_NAMES } from '@omnicanvas/gesture';
import {
  GESTURE_CATALOG,
  eventLabel,
  gestureByName,
  gestureForEvent,
  gestureForHold,
} from '@/lib/gesture-lab/gesture-catalog';
import { isGestureEventType } from '@/lib/gesture-lab/recording';

describe('gesture catalog', () => {
  it('describes the nine gestures, in Italian, once each', () => {
    expect(GESTURE_CATALOG.map((g) => g.name)).toEqual([...GESTURE_NAMES]);
    for (const g of GESTURE_CATALOG) {
      expect(g.label).not.toMatch(/_/);
      expect(g.howTo.length).toBeGreaterThan(10);
      expect(g.effect.length).toBeGreaterThan(3);
    }
  });

  it('expects the event of the default dictionary, with drag opening on GRAB', () => {
    for (const g of GESTURE_CATALOG) {
      const command = DEFAULT_DICTIONARY[g.name];
      expect(g.event).toBe(command === 'DRAG' ? 'GRAB' : command);
      expect(isGestureEventType(g.event)).toBe(true);
    }
  });

  it('goes from event to gesture and back', () => {
    for (const g of GESTURE_CATALOG) {
      expect(gestureForEvent(g.event)).toBe(g);
      expect(gestureByName(g.name)).toBe(g);
    }
    expect(gestureForEvent(null)).toBeNull();
    expect(gestureForEvent('MOVE')).toBeNull();
  });

  it('names the hold gesture of a pose, and nothing for the others', () => {
    expect(gestureForHold('thumb_up')?.name).toBe('thumb_up_hold');
    expect(gestureForHold('open_palm')?.name).toBe('open_palm_hold');
    expect(gestureForHold('fist')).toBeNull();
  });

  it('reads an event as the gesture name, or as its code when no gesture makes it', () => {
    expect(eventLabel('CONFIRM')).toBe('Pollice su');
    expect(eventLabel('DROP')).toBe('DROP');
  });
});
