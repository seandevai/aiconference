'use client';

import { Button } from '@omnicanvas/ui';
import type { RecordingSummary } from '@/lib/gesture-lab/lab-store';

type Props = {
  userId: string;
  recordings: RecordingSummary[];
  busy: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

const date = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

export function ArchivePanel({ userId, recordings, busy, onOpen, onDelete }: Props) {
  return (
    <section className="flex flex-col gap-2 text-sm text-fg">
      <h2 className="text-sm font-semibold text-muted">Archivio</h2>
      {recordings.length === 0 && <p className="text-xs text-muted">Nessuna registrazione.</p>}
      <ul className="flex flex-col gap-1">
        {recordings.map((r) => (
          <li key={r.id} aria-label={r.label} className="flex items-center gap-2 text-xs">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(r.id)}
              className="flex-1 text-left underline-offset-2 hover:underline"
            >
              {r.label}
            </button>
            <span className="text-muted">
              {`${r.expect ?? 'nuova'} · ${r.authorName} · ${date(r.createdAt)}`}
            </span>
            {r.authorId === userId && (
              <Button size="sm" disabled={busy} onClick={() => onDelete(r.id)}>
                Elimina
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
