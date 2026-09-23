const FALLBACK = '/dashboard';

// Accetta solo percorsi interni: niente "//host", "/\host" o schemi, che il browser
// interpreterebbe come un altro sito (open redirect).
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return FALLBACK;
  if (next.startsWith('//') || next.startsWith('/\\')) return FALLBACK;
  return next;
}
