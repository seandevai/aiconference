import { Icon, Logo } from '@omnicanvas/ui';
import { RoomCall } from './room-call';

type Props = {
  joinCode: string;
  title: string;
  role: 'host' | 'guest';
  displayName: string;
  showSamples: boolean;
};

// Griglia della stanza: barra alta, volti, palco, controlli (spec redesign §2-3).
export function RoomShell({ joinCode, title, role, displayName, showSamples }: Props) {
  return (
    // Griglia a quattro aree: in orizzontale su telefono la barra sparisce e i volti
    // diventano la colonna a destra (spec §3).
    <div
      className={[
        'grid h-dvh grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] bg-bg text-fg',
        "[grid-template-areas:'banner_faces'_'main_main'_'dock_dock']",
        'phone-landscape:grid-rows-[minmax(0,1fr)_auto]',
        "phone-landscape:[grid-template-areas:'main_faces'_'dock_faces']",
      ].join(' ')}
    >
      <header className="flex min-w-0 items-center gap-3 px-4 py-2 [grid-area:banner] phone-landscape:hidden">
        <Logo />
        <h1 className="hidden truncate text-sm font-semibold sm:block">{title}</h1>
        <span className="hidden items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-muted md:inline-flex">
          <Icon name="lock" className="h-3.5 w-3.5" /> Niente viene conservato
        </span>
        <span className="hidden truncate text-xs text-muted lg:inline">{displayName}</span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-semibold">
          {role === 'host' ? 'Host' : 'Ospite'}
        </span>
      </header>

      <RoomCall joinCode={joinCode} role={role} showSamples={showSamples} />
    </div>
  );
}
