// Condivisione dello schermo senza nominare il vendor: si testa senza browser.

export class ScreenShareCancelled extends Error {
  constructor() {
    super('screen share cancelled');
    this.name = 'ScreenShareCancelled';
  }
}

type NavigatorLike = { mediaDevices?: { getDisplayMedia?: unknown } } | undefined;

// I telefoni non hanno getDisplayMedia: lì il pulsante non compare.
export function supportsScreenShare(nav: NavigatorLike): boolean {
  return typeof nav?.mediaDevices?.getDisplayMedia === 'function';
}

// Chrome usa NotAllowedError sia per il selettore annullato sia per il divieto del sistema
// operativo; il secondo lo dice nel messaggio («by system»).
export function isShareCancel(error: unknown): boolean {
  return (
    error instanceof Error && error.name === 'NotAllowedError' && !/system/i.test(error.message)
  );
}
