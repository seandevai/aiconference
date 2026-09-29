'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { AuthState } from './actions';

type Props = {
  mode: 'login' | 'signup';
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next: string;
};

const initialState: AuthState = { error: null, info: null };

export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === 'signup';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-xl font-semibold">{isSignup ? 'Crea un account' : 'Accedi'}</h1>
        <input type="hidden" name="next" value={next} />
        {isSignup && (
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input name="display_name" required maxLength={40} className="rounded bg-neutral-900 px-3 py-2" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className="rounded bg-neutral-900 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            className="rounded bg-neutral-900 px-3 py-2"
          />
        </label>
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        {state.info && <p role="status" className="text-sm text-emerald-400">{state.info}</p>}
        <button disabled={pending} className="rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-50">
          {isSignup ? 'Registrati' : 'Entra'}
        </button>
        <p className="text-sm text-neutral-400">
          {isSignup ? 'Hai già un account? ' : 'Non hai un account? '}
          <Link className="underline" href={`/${isSignup ? 'login' : 'signup'}?next=${encodeURIComponent(next)}`}>
            {isSignup ? 'Accedi' : 'Registrati'}
          </Link>
        </p>
      </form>
    </main>
  );
}
