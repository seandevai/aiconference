import { redirect } from 'next/navigation';
import { Logo, StatusBanner } from '@omnicanvas/ui';
import { loadDashboard } from '@/lib/dashboard/load-dashboard';
import { createServerSupabase } from '@/lib/supabase/server';
import { CreditsCard } from './credits-card';
import { MeetingList } from './meeting-list';
import { NewMeeting } from './new-meeting';
import { ProfileCard } from './profile-card';
import { ProfileMenu } from './profile-menu';

// Impianto «Agenda» (spec accesso-dashboard §3).
export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/dashboard');

  const now = new Date();
  const data = await loadDashboard(supabase, auth.user.id, now);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Logo />
        <span className="flex-1" />
        <ProfileMenu displayName={data.displayName} />
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Le tue riunioni</h1>
          <NewMeeting defaultOpen={data.rooms?.length === 0} />
          <section aria-label="Riunioni" className="rounded-panel bg-surface p-4">
            {data.rooms ? (
              <MeetingList rooms={data.rooms} creditsByRoom={data.creditsByRoom} now={now} />
            ) : (
              <StatusBanner tone="error" live="alert">
                Non riesco a caricare le riunioni. Ricarica la pagina.
              </StatusBanner>
            )}
          </section>
        </div>
        <aside className="flex flex-col gap-4">
          <CreditsCard credits={data.credits} now={now} />
          <ProfileCard displayName={data.displayName} />
        </aside>
      </main>
    </div>
  );
}
