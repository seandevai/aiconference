import type { ReactNode } from 'react';
import { Button } from '@omnicanvas/ui';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';
import { LIVE_MESSAGES } from './lab-messages';
import { ScreenHeader } from './screen-header';

type Props = {
  scene: ReactNode;
  live: LiveStatus;
  armed: boolean;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
  onAdvanced: () => void;
};

export function TryScreen({ scene, live, armed, onStart, onStop, onBack, onAdvanced }: Props) {
  const message = LIVE_MESSAGES[live];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ScreenHeader title="Prova le gesture" onBack={onBack} onAdvanced={onAdvanced} />
      <div className="flex min-h-0 flex-1 flex-col">{scene}</div>
      {message && <p className="shrink-0 text-sm text-muted">{message}</p>}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {live === 'on' ? (
          <Button onClick={onStop}>Ferma fotocamera</Button>
        ) : (
          <Button variant="accent" disabled={live === 'loading'} onClick={onStart}>
            Avvia fotocamera
          </Button>
        )}
        <span className="text-sm text-muted">{armed ? 'Gesture attive' : 'Gesture in pausa'}</span>
      </div>
    </div>
  );
}
