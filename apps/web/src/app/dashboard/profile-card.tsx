'use client';

import { useActionState, useState } from 'react';
import { Button, TextField } from '@omnicanvas/ui';
import { updateDisplayName, type ProfileState } from './actions';

const initialState: ProfileState = { error: null, saved: false };

export function ProfileCard({ displayName }: { displayName: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [state, formAction, pending] = useActionState(
    async (prev: ProfileState, formData: FormData) => {
      const next = await updateDisplayName(prev, formData);
      if (next.saved) setEditing(false);
      return next;
    },
    initialState,
  );

  function startEditing() {
    setDraft(displayName);
    setEditing(true);
  }

  return (
    <section className="flex flex-col gap-2 rounded-panel bg-surface p-4">
      <h2 className="text-xs font-semibold text-muted">Profilo</h2>
      {editing ? (
        <form action={formAction} className="flex flex-col gap-2">
          <TextField
            label="Nome"
            name="display_name"
            maxLength={40}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={state.error}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? 'Salvataggio…' : 'Salva'}
            </Button>
            <Button variant="quiet" onClick={() => setEditing(false)}>
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-semibold">{displayName}</span>
          <Button variant="quiet" onClick={startEditing}>
            Modifica
          </Button>
        </div>
      )}
    </section>
  );
}
