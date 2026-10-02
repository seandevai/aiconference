// 32 byte di chiave in base64url senza padding: 43 caratteri.
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// La chiave va dopo «#»: il browser non manda mai il frammento al server (ADR-0008).
export function bundleLink(origin: string, bundleId: string, key: string): string {
  return `${origin.replace(/\/+$/, '')}/p/${encodeURIComponent(bundleId)}#${key}`;
}

// Da `location.hash` della pagina di download. null se manca o non è una chiave.
export function keyFromFragment(hash: string): string | null {
  const key = hash.startsWith('#') ? hash.slice(1) : hash;
  return KEY_PATTERN.test(key) ? key : null;
}
