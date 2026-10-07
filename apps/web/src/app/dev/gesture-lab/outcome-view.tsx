import type { Outcome } from '@/lib/gesture-lab/evaluate';
import { eventLabel } from '@/lib/gesture-lab/gesture-catalog';

// L'esito grande, uguale al passo 4 di Registra e nel rigioco.
export function OutcomeView({
  outcome,
  newLabel = 'Registrato',
}: {
  outcome: Outcome;
  newLabel?: string;
}) {
  if (outcome.kind === 'new') return <p className="text-2xl font-extrabold">{newLabel}</p>;
  if (outcome.kind === 'recognized')
    return <p className="text-2xl font-extrabold text-accent">✓ Riconosciuto</p>;
  const fired = [...new Set(outcome.fired)].map(eventLabel);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-2xl font-extrabold text-danger">✗ Non riconosciuto</p>
      <p className="text-sm text-muted">{`Scattati: ${fired.length > 0 ? fired.join(', ') : 'nessuno'}`}</p>
    </div>
  );
}
