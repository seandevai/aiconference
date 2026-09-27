// Fotocamera anteriore o posteriore. Nessun riferimento al vendor: si testa senza dispositivi.
export type FacingMode = 'user' | 'environment';

export function nextFacingMode(current: FacingMode): FacingMode {
  return current === 'user' ? 'environment' : 'user';
}

export function countVideoInputs(devices: readonly { kind: string }[]): number {
  return devices.filter((device) => device.kind === 'videoinput').length;
}

// La scelta vale anche a camera spenta: alla riaccensione si usa questa.
export function createCameraPreference() {
  let current: FacingMode = 'user';
  return {
    get: () => current,
    toggle: () => (current = nextFacingMode(current)),
  };
}
