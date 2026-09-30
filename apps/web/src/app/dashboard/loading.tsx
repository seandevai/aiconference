export default function Loading() {
  return (
    <div aria-busy="true" className="flex min-h-dvh flex-col bg-bg">
      <span className="sr-only">Caricamento delle riunioni…</span>
      <div className="mx-auto h-16 w-full max-w-6xl px-4 sm:px-6" />
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <div className="h-8 w-56 rounded-tile bg-raised/60 motion-safe:animate-pulse" />
          <div className="h-11 w-44 rounded-full bg-raised/60 motion-safe:animate-pulse" />
          <div className="h-64 rounded-panel bg-surface motion-safe:animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-28 rounded-panel bg-stage motion-safe:animate-pulse" />
          <div className="h-20 rounded-panel bg-surface motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
