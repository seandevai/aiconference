import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-2xl font-semibold">OmniCanvas</h1>
      <p className="max-w-md text-center text-neutral-400">
        Videochiamate con un palco generativo. Nessun contenuto resta sui nostri server.
      </p>
      <div className="flex gap-3">
        <Link className="rounded bg-neutral-100 px-4 py-2 text-neutral-900" href="/login">
          Accedi
        </Link>
        <Link className="rounded border border-neutral-700 px-4 py-2" href="/signup">
          Registrati
        </Link>
      </div>
    </main>
  );
}
