const MAX_LENGTH = 40;

// Il form chiede il nome, ma il controllo vale solo se lo rifà il server.
export function parseDisplayName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_LENGTH ? name : null;
}
