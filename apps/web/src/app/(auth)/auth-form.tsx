'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, Logo, StatusBanner, TextField } from '@omnicanvas/ui';
import type { AuthState } from './actions';

type Props = {
  mode: 'login' | 'signup';
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next: string;
};

const initialState: AuthState = { error: null, info: null };

// Versione «Sobrio» (spec accesso-dashboard §2): logo e modulo al centro, nient'altro.
export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === 'signup';
  const submitLabel = isSignup ? 'Registrati' : 'Entra';
  const pendingLabel = isSignup ? 'Registrazione…' : 'Accesso…';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-fg">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
        <Logo className="mb-4" />
        <h1 className="text-2xl font-extrabold tracking-tight">
          {isSignup ? 'Crea un account' : 'Accedi'}
        </h1>
        <input type="hidden" name="next" value={next} />
        {isSignup && (
          <TextField label="Nome" name="display_name" required maxLength={40} autoComplete="name" />
        )}
        <TextField label="Email" name="email" type="email" required autoComplete="email" />
        <TextField
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
        />
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.info && <StatusBanner>{state.info}</StatusBanner>}
        <Button type="submit" variant="accent" disabled={pending} className="w-full">
          {pending ? pendingLabel : submitLabel}
        </Button>
        <p className="text-sm text-muted">
          {isSignup ? 'Hai già un account? ' : 'Non hai un account? '}
          <Link
            className="font-semibold text-fg underline"
            href={`/${isSignup ? 'login' : 'signup'}?next=${encodeURIComponent(next)}`}
          >
            {isSignup ? 'Accedi' : 'Registrati'}
          </Link>
        </p>
        <p className="text-xs text-muted">
          Niente di ciò che si dice in riunione resta sui nostri server.
        </p>
      </form>
    </main>
  );
}
