const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o password non corretti.',
  user_already_exists: 'Esiste già un account con questa email. Prova ad accedere.',
  email_not_confirmed: "Conferma l'email dal link che ti abbiamo mandato, poi accedi.",
  weak_password: 'Password troppo debole: usa almeno 8 caratteri.',
};

export function authErrorMessage(code: string | undefined): string {
  const key = code ?? 'unknown';
  return MESSAGES[key] ?? `Accesso non riuscito (${key}). Riprova tra poco.`;
}
