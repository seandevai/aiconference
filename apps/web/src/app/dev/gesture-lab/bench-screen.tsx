import type { ReactNode } from 'react';
import { Button } from '@omnicanvas/ui';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { LIVE_MESSAGES } from './lab-messages';
import { ScreenHeader } from './screen-header';

type Props = {
  scene: ReactNode;
  live: LiveStatus;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
  onAdvanced: () => void;
};

// Il banco di prova (solo computer): la mano dal vivo e i numeri che spiegano cosa vede il
// riconoscitore. Niente palco: per l'effetto sulle finestre c'è Prova.
export function BenchScreen({ scene, live, onStart, onStop, onBack, onAdvanced }: Props) {
  const message = LIVE_MESSAGES[live];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader title="Banco di prova" onBack={onBack} onAdvanced={onAdvanced} />
      <div className="flex min-h-0 flex-1 flex-col">{scene}</div>
      {message && <p className="shrink-0 text-sm text-muted">{message}</p>}
      <div className="flex shrink-0 items-center gap-2">
        {live === 'on' ? (
          <Button onClick={onStop}>Ferma fotocamera</Button>
        ) : (
          <Button variant="accent" disabled={live === 'loading'} onClick={onStart}>
            Avvia fotocamera
          </Button>
        )}
      </div>
    </div>
  );
}
