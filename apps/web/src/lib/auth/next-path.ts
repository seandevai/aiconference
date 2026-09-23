const FALLBACK = '/dashboard';

// Accetta solo percorsi interni. Rifiuta subito caratteri di controllo (tab, \n, \r, ...)
// e backslash: il parser URL del browser li rimuove/normalizza prima di leggere l'host,
// quindi "/\t/evil.example" diventerebbe "//evil.example" e sfuggirebbe ai controlli sulla
// stringa grezza. Poi valida con URL: se l'origine risultante non è quella fittizia data
// in input, il valore puntava altrove (open redirect) e va scartato. Anche l'output va
// controllato: la normalizzazione WHATWG dei segmenti "." e ".." (es. "/.//evil.example" o
// "/a/../..//evil") può produrre un pathname che inizia per "//" pur partendo da un
// riferimento relativo che supera il controllo sull'origine — è comunque protocol-relative,
// quindi va scartato.
export function safeNextPath(next: string | string[] | null | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value) return FALLBACK;
  if (hasControlCharOrBackslash(value)) return FALLBACK;
  if (!value.startsWith('/') || value.startsWith('//')) return FALLBACK;

  const base = 'http://omnicanvas.invalid';
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== base) return FALLBACK;
  if (url.pathname.startsWith('//')) return FALLBACK;
  return url.pathname + url.search + url.hash;
}

function hasControlCharOrBackslash(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || value[i] === '\\') return true;
  }
  return false;
}
