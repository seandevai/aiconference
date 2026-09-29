import { Logo } from '@omnicanvas/ui';

export function RoomEnded() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg p-6 text-fg">
      <Logo className="mb-4" />
      <h1 className="text-xl font-extrabold">Questa riunione è terminata</h1>
      <p className="text-muted">
        Se c&apos;era un pacchetto, trovi il link nel messaggio dell&apos;host.
      </p>
    </main>
  );
}
