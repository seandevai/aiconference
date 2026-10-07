import { Button } from '@omnicanvas/ui';

type Props = {
  title: string;
  onBack: () => void;
  backLabel?: string;
  onAdvanced?: (() => void) | undefined;
};

// In cima a ogni schermata: si torna indietro, si legge dove si è, si aprono le Avanzate.
export function ScreenHeader({ title, onBack, backLabel = 'Indietro', onAdvanced }: Props) {
  return (
    <header className="flex shrink-0 items-center gap-2">
      <Button variant="quiet" onClick={onBack}>{`‹ ${backLabel}`}</Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h1>
      {onAdvanced && (
        <Button size="icon" aria-label="Avanzate" onClick={onAdvanced}>
          ⚙
        </Button>
      )}
    </header>
  );
}
