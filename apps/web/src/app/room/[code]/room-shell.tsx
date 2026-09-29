import { RoomCall } from './room-call';

type Props = { joinCode: string; title: string; role: 'host' | 'guest'; displayName: string };

// Desktop: colonna volti stretta a sinistra, palco al resto (ADR-0009).
// Mobile: il palco occupa quasi tutto, i volti restano piccoli a lato (spec §2.5).
export function RoomShell({ joinCode, title, role, displayName }: Props) {
  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>{displayName}</span>
          <span className="rounded bg-neutral-800 px-2 py-0.5">
            {role === 'host' ? 'Host' : 'Ospite'}
          </span>
          <span className="hidden sm:inline">· nessun contenuto viene conservato</span>
        </div>
      </header>

      <RoomCall joinCode={joinCode} role={role} />
    </div>
  );
}
