import type { LabView } from '@/lib/gesture-lab/lab-view';

const CHOICES = [
  { view: 'prova', title: 'Prova le gesture', hint: 'Fotocamera e palco.', archive: false },
  {
    view: 'registra',
    title: 'Registra un gesto',
    hint: 'Guidato, un passo alla volta.',
    archive: true,
  },
  { view: 'rigioca', title: "Rigioca dall'archivio", hint: 'Anche senza webcam.', archive: true },
] as const satisfies readonly { view: LabView; title: string; hint: string; archive: boolean }[];

// La pagina iniziale: tre scelte grandi, impilate su telefono e affiancate su schermo largo.
export function HomeScreen({
  canArchive,
  onGo,
}: {
  canArchive: boolean;
  onGo: (view: LabView) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4">
      <h1 className="text-2xl font-extrabold">Laboratorio gesture</h1>
      <p className="text-muted">Cosa vuoi fare?</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CHOICES.filter((c) => canArchive || !c.archive).map((c) => (
          <button
            key={c.view}
            type="button"
            onClick={() => onGo(c.view)}
            className="flex min-h-24 flex-col items-start gap-1 rounded-panel border border-line bg-surface p-4 text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-lg font-extrabold">{c.title}</span>
            <span className="text-sm text-muted">{c.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
