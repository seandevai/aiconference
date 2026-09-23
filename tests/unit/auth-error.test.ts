import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '@/lib/auth/error-message';

describe('authErrorMessage', () => {
  it('explains wrong credentials', () => {
    expect(authErrorMessage('invalid_credentials')).toBe('Email o password non corretti.');
  });

  it('explains an existing account', () => {
    expect(authErrorMessage('user_already_exists')).toBe(
      'Esiste già un account con questa email. Prova ad accedere.',
    );
  });

  it('explains an unconfirmed email', () => {
    expect(authErrorMessage('email_not_confirmed')).toBe(
      "Conferma l'email dal link che ti abbiamo mandato, poi accedi.",
    );
  });

  it('explains a weak password', () => {
    expect(authErrorMessage('weak_password')).toBe(
      'Password troppo debole: usa almeno 8 caratteri.',
    );
  });

  it('never returns a generic message for unknown codes', () => {
    expect(authErrorMessage('something_new')).toBe(
      'Accesso non riuscito (something_new). Riprova tra poco.',
    );
    expect(authErrorMessage(undefined)).toBe(
      'Accesso non riuscito (unknown). Riprova tra poco.',
    );
  });
});
