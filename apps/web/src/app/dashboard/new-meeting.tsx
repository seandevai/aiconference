'use client';

import { useActionState, useState } from 'react';
import { Button, Icon, TextField } from '@omnicanvas/ui';
import { DEFAULT_PLANNED_MINUTES, PLANNED_MINUTES, type PlannedMinutes } from '@/lib/rooms/timer';
import { createRoomAction, type CreateRoomState } from './actions';

const DURATION_LABELS: Record<PlannedMinutes, string> = {
  30: '30 minuti',
  45: '45 minuti',
  60: '1 ora',
  90: '1 ora e 30',
};

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
          <div className="flex flex-col gap-1">
            <label htmlFor="planned-minutes" className="text-xs font-semibold text-muted">
              Durata
            </label>
            <select
              id="planned-minutes"
              name="planned_minutes"
              defaultValue={DEFAULT_PLANNED_MINUTES}
              className="min-h-11 rounded-tile border border-line bg-stage px-3 text-sm text-fg hover:border-muted focus-visible:border-accent focus-visible:outline-none"
            >
              {PLANNED_MINUTES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {DURATION_LABELS[minutes]}
                </option>
              ))}
            </select>
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
