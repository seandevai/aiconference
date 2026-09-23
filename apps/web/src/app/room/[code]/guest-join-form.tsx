'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/lib/rooms/languages';
import { joinAsGuestAction, type GuestJoinState } from './actions';

const initialState: GuestJoinState = { error: null };

export function GuestJoinForm({ joinCode }: { joinCode: string }) {
  const [state, formAction, pending] = useActionState(
    joinAsGuestAction.bind(null, joinCode),
    initialState,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-xl font-semibold">Entra nella riunione</h1>
        <label className="flex flex-col gap-1 text-sm">
          Il tuo nome
          <input name="display_name" required maxLength={40} className="rounded bg-neutral-900 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          In che lingua vuoi leggere gli altri?
          <select name="language" defaultValue="it" className="rounded bg-neutral-900 px-3 py-2">
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {LANGUAGE_LABELS[language]}
              </option>
            ))}
          </select>
        </label>
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <button disabled={pending} className="rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-50">
          Entra
        </button>
        <p className="text-sm text-neutral-400">
          Conduci tu la riunione?{' '}
          <Link className="underline" href={`/login?next=${encodeURIComponent(`/room/${joinCode}`)}`}>
            Accedi come host
          </Link>
        </p>
      </form>
    </main>
  );
}
