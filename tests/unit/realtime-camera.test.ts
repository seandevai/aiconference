import { describe, expect, it } from 'vitest';
import {
  countVideoInputs,
  createCameraPreference,
  nextFacingMode,
} from '../../packages/realtime/src/camera';

describe('camera helpers', () => {
  it('alternates front and back', () => {
    expect(nextFacingMode('user')).toBe('environment');
    expect(nextFacingMode('environment')).toBe('user');
  });

  it('counts only video inputs', () => {
    expect(
      countVideoInputs([{ kind: 'audioinput' }, { kind: 'videoinput' }, { kind: 'videoinput' }]),
    ).toBe(2);
    expect(countVideoInputs([{ kind: 'audiooutput' }])).toBe(0);
  });

  it('remembers the direction chosen while the camera was off', () => {
    const preference = createCameraPreference();
    expect(preference.get()).toBe('user');
    expect(preference.toggle()).toBe('environment');
    expect(preference.get()).toBe('environment');
  });
});
