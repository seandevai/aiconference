// Fotocamera anteriore o posteriore. Nessun riferimento al vendor: si testa senza dispositivi.
export type FacingMode = 'user' | 'environment';

export function nextFacingMode(current: FacingMode): FacingMode {
  return current === 'user' ? 'environment' : 'user';
}

export function countVideoInputs(devices: readonly { kind: string }[]): number {
  return devices.filter((device) => device.kind === 'videoinput').length;
}

export type CameraOps = {
  isEnabled(): boolean;
  setEnabled(on: boolean, facing: FacingMode): Promise<void>;
  restart(facing: FacingMode): Promise<void>;
};

// Il vendor, riaccendendo una traccia esistente, la riprende con la direzione di prima:
// la scelta fatta a camera spenta va riapplicata dopo la riaccensione.
export function createCameraController(ops: CameraOps) {
  let preferred: FacingMode = 'user';
  let applied: FacingMode = 'user';
  return {
    async setEnabled(on: boolean) {
      await ops.setEnabled(on, preferred);
      if (!on) return;
      if (applied !== preferred) await ops.restart(preferred);
      applied = preferred;
    },
    async switchCamera() {
      const next = nextFacingMode(preferred);
      if (ops.isEnabled()) {
        await ops.restart(next);
        applied = next;
      }
      // Solo dopo il successo: se la fotocamera non parte, la scelta resta quella vera.
      preferred = next;
    },
  };
}
