import { describe, expect, it } from 'vitest';
import { gestureLabEnabled, labAccess } from '@/lib/gesture-lab/access';

describe('labAccess', () => {
  it.each([
    ['development', false, false, 'open'],
    ['development', true, false, 'open'],
    ['development', false, true, 'admin'],
    ['production', false, false, 'hidden'],
    ['production', false, true, 'hidden'],
    ['production', true, false, 'hidden'],
    ['production', true, true, 'admin'],
    ['test', false, false, 'open'],
    [undefined, false, false, 'hidden'],
  ] as const)('nodeEnv %s, enabled %s, admin %s → %s', (nodeEnv, enabled, isAdmin, expected) => {
    expect(labAccess({ nodeEnv, enabled, isAdmin })).toBe(expected);
  });
});

describe('gestureLabEnabled', () => {
  it('is true only for the exact string "true"', () => {
    expect(gestureLabEnabled({ GESTURE_LAB_ENABLED: 'true' })).toBe(true);
    expect(gestureLabEnabled({ GESTURE_LAB_ENABLED: 'TRUE' })).toBe(false);
    expect(gestureLabEnabled({ GESTURE_LAB_ENABLED: '1' })).toBe(false);
    expect(gestureLabEnabled({})).toBe(false);
  });
});
