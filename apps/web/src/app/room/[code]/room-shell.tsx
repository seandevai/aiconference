type Props = { title: string; role: 'host' | 'guest'; displayName: string };

// Desktop: colonna volti stretta a sinistra, palco al resto (ADR-0009).
// Mobile: il palco occupa quasi tutto, i volti restano piccoli a lato (spec §2.5).
export function RoomShell({ title, role, displayName }: Props) {
  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>{displayName}</span>
          <span className="rounded bg-neutral-800 px-2 py-0.5">{role === 'host' ? 'Host' : 'Ospite'}</span>
          <span className="hidden sm:inline">· nessun contenuto viene conservato</span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          aria-label="Partecipanti"
          className="absolute right-2 top-2 z-10 flex w-16 flex-col gap-2 lg:static lg:w-48 lg:border-r lg:border-neutral-800 lg:p-3"
        >
          {/* slice 2: tessere video */}
        </aside>

        <section aria-label="Palco" className="min-h-0 flex-1 p-2 lg:p-4">
          {/* slice 3: finestre, slot, vassoio */}
        </section>
      </div>
    </div>
  );
}
