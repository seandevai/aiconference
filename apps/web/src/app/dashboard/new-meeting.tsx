'use client';

import { useActionState, useState } from 'react';
import { Button, Icon, TextField } from '@omnicanvas/ui';
import { createRoomAction, type CreateRoomState } from './actions';

const initialState: CreateRoomState = { error: null };

// Il pulsante apre soltanto: cliccarlo due volte non richiude il modulo (e2e più stabili).
export function NewMeeting({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction, pending] = useActionState(createRoomAction, initialState);

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="accent"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="self-start"
      >
        <Icon name="plus" /> Nuova riunione
      </Button>
      {open && (
        <form
          action={formAction}
          className="flex flex-col gap-2 rounded-panel bg-surface p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <TextField
              label="Titolo della riunione"
              name="title"
              required
              maxLength={120}
              autoFocus
              error={state.error}
              placeholder="Es. Kickoff con Ferretti Arredi"
            />
          </div>
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? 'Creazione…' : 'Crea'}
          </Button>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Annulla
          </Button>
        </form>
      )}
    </div>
  );
}
