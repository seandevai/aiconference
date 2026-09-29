'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, Logo } from '@omnicanvas/ui';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/lib/rooms/languages';
import { joinAsGuestAction, type GuestJoinState } from './actions';

const initialState: GuestJoinState = { error: null };

export function GuestJoinForm({ joinCode }: { joinCode: string }) {
  const [state, formAction, pending] = useActionState(
    joinAsGuestAction.bind(null, joinCode),
    initialState,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-fg">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
        <Logo className="mb-4" />
        <h1 className="text-xl font-extrabold">Entra nella riunione</h1>
        <label className="flex flex-col gap-1 text-sm">
          Il tuo nome
          <input
            name="display_name"
            required
            maxLength={40}
            className="rounded-tile border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          In che lingua vuoi leggere gli altri?
          <select
            name="language"
            defaultValue="it"
            className="rounded-tile border border-line bg-surface px-3 py-2"
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {LANGUAGE_LABELS[language]}
              </option>
            ))}
          </select>
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" variant="accent" disabled={pending}>
          Entra
        </Button>
        <p className="text-sm text-muted">
          Conduci tu la riunione?{' '}
          <Link
            className="underline"
            href={`/login?next=${encodeURIComponent(`/room/${joinCode}`)}`}
          >
            Accedi come host
          </Link>
        </p>
      </form>
    </main>
  );
}
