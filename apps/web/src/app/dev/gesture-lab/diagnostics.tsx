import { poseMetrics, type Hand, type RecognizerView, type Tuning } from '@omnicanvas/gesture';
import type { LogEntry } from '@/lib/gesture-lab/event-log';
import { EventList } from './event-list';

const FINGER_LABELS = {
  index: 'Indice',
  middle: 'Medio',
  ring: 'Anulare',
  pinky: 'Mignolo',
} as const;

type Props = { view: RecognizerView | null; hand: Hand | null; tuning: Tuning; log: LogEntry[] };

// Quello che serve a tarare: posa grezza e stabile, numeri delle dita, eventi in ordine.
export function Diagnostics({ view, hand, tuning, log }: Props) {
  const metrics = hand ? poseMetrics(hand) : null;
  return (
    <div className="flex flex-col gap-3 text-xs text-fg">
      {view ? (
        <p className="text-muted">
          {`Posa grezza: ${view.rawPose} · stabile: ${view.pose} · ${view.armed ? 'armato' : 'in pausa'} · pausa ${Math.round(view.cooldownLeftMs)} ms`}
        </p>
      ) : (
        <p className="text-muted">Nessuna mano in vista.</p>
      )}
      {metrics && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {(Object.keys(FINGER_LABELS) as (keyof typeof FINGER_LABELS)[]).map((finger) => (
            <div key={finger} className="flex justify-between">
              <dt>{FINGER_LABELS[finger]}</dt>
              <dd className="tabular-nums">
                {metrics.fingers[finger].toFixed(2)}{' '}
                <span className="text-muted">{`(> ${tuning.pose.extended} esteso, < ${tuning.pose.folded} piegato)`}</span>
              </dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt>Pinch</dt>
            <dd className="tabular-nums">
              {metrics.pinch.toFixed(2)}{' '}
              <span className="text-muted">{`(< ${tuning.pose.pinchOn})`}</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Pollice</dt>
            <dd>{metrics.thumbExtended ? 'esteso' : 'chiuso'}</dd>
          </div>
        </dl>
      )}
      <EventList entries={log} />
    </div>
  );
}
