import Link from 'next/link';
import type { ReactNode } from 'react';
import { groupRooms, pastMeta, type DashboardRoom } from '@/lib/dashboard/model';
import { CopyLinkButton } from './copy-link-button';

type Props = {
  rooms: DashboardRoom[];
  creditsByRoom: Record<string, number>;
  now: Date;
};

const linkButton =
  'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function MeetingList({ rooms, creditsByRoom, now }: Props) {
  if (rooms.length === 0) return <FirstMeeting />;
  const groups = groupRooms(rooms, now);

  return (
    <div className="flex flex-col gap-6">
      {groups.live.length > 0 && (
        <Group title="In corso">
          {groups.live.map((room) => (
            <Row key={room.id} room={room} live>
              <CopyLinkButton path={`/room/${room.joinCode}`} />
              <Link
                href={`/room/${room.joinCode}`}
                className={`${linkButton} bg-accent text-on-accent`}
              >
                Rientra<span className="sr-only"> in {room.title}</span>
              </Link>
            </Row>
          ))}
        </Group>
      )}
      {groups.ready.length > 0 && (
        <Group title="Pronte">
          {groups.ready.map((room) => (
            <Row key={room.id} room={room}>
              <CopyLinkButton path={`/room/${room.joinCode}`} />
              <Link
                href={`/room/${room.joinCode}`}
                className={`${linkButton} bg-raised text-fg hover:bg-line`}
              >
                Apri<span className="sr-only"> {room.title}</span>
              </Link>
            </Row>
          ))}
        </Group>
      )}
      {groups.past.length > 0 && (
        <Group title="Passate">
          {groups.past.map((room) => (
            <Row key={room.id} room={room}>
              <span className="tabular text-xs text-muted">
                {pastMeta(room, creditsByRoom[room.id] ?? 0)}
              </span>
            </Row>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <ul className="flex flex-col divide-y divide-line">{children}</ul>
    </section>
  );
}

function Row({
  room,
  live = false,
  children,
}: {
  room: DashboardRoom;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {live && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
      <span className="min-w-0 flex-1 truncate font-semibold">{room.title}</span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </li>
  );
}

function FirstMeeting() {
  return (
    <section className="flex flex-col gap-3 rounded-panel bg-stage p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Prima riunione</h2>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
        <li>Crea la riunione con un titolo che ritroverai.</li>
        <li>Manda il link al cliente: entra dal browser, senza account.</li>
        <li>In riunione chiedi all&apos;agente un grafico, un testo o una tabella.</li>
      </ol>
    </section>
  );
}
