import { describe, expect, it } from 'vitest';
import {
  countVideoInputs,
  createCameraController,
  nextFacingMode,
  type FacingMode,
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
});

// Imita LiveKit: riaccendere una traccia esistente la riprende con la direzione vecchia.
function fakeCamera() {
  const state = { enabled: false, facing: null as FacingMode | null, fail: false };
  return {
    state,
    ops: {
      isEnabled: () => state.enabled,
      async setEnabled(on: boolean, facing: FacingMode) {
        state.enabled = on;
        if (on && state.facing === null) state.facing = facing;
      },
      async restart(facing: FacingMode) {
        if (state.fail) throw new Error('getUserMedia failed');
        state.facing = facing;
      },
    },
  };
}

describe('createCameraController', () => {
  it('starts with the front camera', async () => {
    const camera = fakeCamera();
    await createCameraController(camera.ops).setEnabled(true);
    expect(camera.state.facing).toBe('user');
  });

  it('switches a live camera', async () => {
    const camera = fakeCamera();
    const controller = createCameraController(camera.ops);
    await controller.setEnabled(true);
    await controller.switchCamera();
    expect(camera.state.facing).toBe('environment');
  });

  it('applies a switch made while the camera was off when it comes back', async () => {
    const camera = fakeCamera();
    const controller = createCameraController(camera.ops);
    await controller.setEnabled(true);
    await controller.setEnabled(false);
    await controller.switchCamera();
    await controller.setEnabled(true);
    expect(camera.state.facing).toBe('environment');
  });

  it('keeps the current side when the switch fails', async () => {
    const camera = fakeCamera();
    const controller = createCameraController(camera.ops);
    await controller.setEnabled(true);
    camera.state.fail = true;
    await expect(controller.switchCamera()).rejects.toThrow();
    camera.state.fail = false;
    await controller.switchCamera();
    expect(camera.state.facing).toBe('environment');
  });

  it('reports the side actually on camera, not the pending choice', async () => {
    const camera = fakeCamera();
    const controller = createCameraController(camera.ops);
    expect(controller.facing()).toBe('user');
    await controller.setEnabled(true);
    await controller.setEnabled(false);
    await controller.switchCamera();
    expect(controller.facing()).toBe('user');
    await controller.setEnabled(true);
    expect(controller.facing()).toBe('environment');
  });
});
