import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/(auth)/actions';
import { createServerSupabase } from '@/lib/supabase/server';
import { CreateRoomForm } from './create-room-form';

const STATUS_LABELS: Record<string, string> = {
  created: 'pronta',
  active: 'in corso',
  closing: 'in chiusura',
  closed: 'terminata',
  purged: 'terminata',
};

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/dashboard');

  // La RLS filtra già per workspace: nessun filtro a mano.
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, title, join_code, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 bg-neutral-950 p-6 text-neutral-100">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Le tue stanze</h1>
        <form action={signOut}>
          <button className="text-sm text-neutral-400 underline">Esci</button>
        </form>
      </header>
      <CreateRoomForm />
      <ul className="flex flex-col divide-y divide-neutral-800">
        {(rooms ?? []).map((room) => (
          <li key={room.id} className="flex items-center justify-between py-3">
            <Link href={`/room/${room.join_code}`} className="font-medium underline">
              {room.title}
            </Link>
            <span className="text-sm text-neutral-400">
              {room.join_code} · {STATUS_LABELS[room.status] ?? room.status}
            </span>
          </li>
        ))}
        {rooms?.length === 0 && <li className="py-3 text-neutral-500">Nessuna stanza ancora.</li>}
      </ul>
    </main>
  );
}
