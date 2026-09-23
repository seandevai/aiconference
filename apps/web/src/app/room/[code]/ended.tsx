export function RoomEnded() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-xl font-semibold">Questa riunione è terminata</h1>
      <p className="text-neutral-400">Se c&apos;era un pacchetto, trovi il link nel messaggio dell&apos;host.</p>
    </main>
  );
}
