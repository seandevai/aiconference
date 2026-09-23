'use client';

import { useActionState } from 'react';
import { createRoomAction, type CreateRoomState } from './actions';

const initialState: CreateRoomState = { error: null };

export function CreateRoomForm() {
  const [state, formAction, pending] = useActionState(createRoomAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="title"
        required
        maxLength={120}
        placeholder="Titolo della riunione"
        className="flex-1 rounded bg-neutral-900 px-3 py-2"
      />
      <button disabled={pending} className="rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-50">
        Crea stanza
      </button>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
