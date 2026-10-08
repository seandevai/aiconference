// Nome del file scaricato: <evento atteso | NUOVA>-<nome senza accenti né simboli>.json
export function recordingFileName(expect: string | null, label: string | undefined): string {
  const slug = (label ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${expect ?? 'NUOVA'}-${slug || 'gesture'}.json`;
}

// Scarica un JSON dal browser: usato dal registratore e dal rigioco.
export function downloadRecording(
  data: object,
  expect: string | null,
  label: string | undefined,
): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = recordingFileName(expect, label);
  link.click();
  URL.revokeObjectURL(url);
}
