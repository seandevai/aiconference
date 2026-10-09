import type { ReactNode } from 'react';
import { cx } from '@omnicanvas/ui';
import { poseMetrics, type Hand, type RecognizerView, type Tuning } from '@omnicanvas/gesture';
import type { LogEntry } from '@/lib/gesture-lab/event-log';
import { EventList } from './event-list';

const FINGER_LABELS = {
  index: 'Indice',
  middle: 'Medio',
  ring: 'Anulare',
  pinky: 'Mignolo',
} as const;

const NO_HAND = 'Nessuna mano in vista.';

const percent = (value: number) => `${Math.min(100, Math.max(0, value * 100))}%`;

type Props = {
  view: RecognizerView | null;
  hand: Hand | null;
  tuning: Tuning;
  log: LogEntry[];
  // In «Avanzate» la colonna è stretta: i riquadri stanno sempre uno sotto l'altro.
  stacked?: boolean;
};

// Una barra da 0 a 1 con le soglie segnate. Un valore fuori scala si ferma al bordo, il numero
// resta scritto: è quello che serve a tarare.
function Meter({ label, value, marks }: { label: string; value: number | null; marks: number[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums">{value === null ? '–' : value.toFixed(2)}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value ?? 0}
        className="relative h-2 rounded-full bg-line"
      >
        <div
          data-fill
          style={{ width: percent(value ?? 0) }}
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
        />
        {marks.map((mark) => (
          <span
            key={mark}
            data-mark
            style={{ left: percent(mark) }}
            className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 bg-fg"
          />
        ))}
      </div>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-tile border border-line bg-surface p-3"
    >
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  );
}

// Il banco di prova: posa, dita ed eventi dal vivo, gli stessi numeri che usa il riconoscitore.
export function BenchPanel({ view, hand, tuning, log, stacked = false }: Props) {
  const metrics = hand ? poseMetrics(hand) : null;
  return (
    <div className={cx('grid min-h-0 gap-3 text-xs text-fg', !stacked && 'lg:grid-cols-3')}>
      <Tile title="Posa">
        <h3 className="text-sm font-semibold text-muted">Posa</h3>
        {view ? (
          <>
            <Row label="Grezza">{view.rawPose}</Row>
            <Row label="Stabile">{view.pose}</Row>
            <Row label="Stato">{view.armed ? 'armato' : 'in pausa'}</Row>
            <Row label="Pausa">{`${Math.round(view.cooldownLeftMs)} ms`}</Row>
            {view.dragging && <Row label="Trascinamento">in corso</Row>}
          </>
        ) : (
          <p className="text-muted">{NO_HAND}</p>
        )}
        <Meter label="Hold" value={view?.hold ? view.hold.progress : null} marks={[]} />
      </Tile>
      <Tile title="Dita">
        <h3 className="text-sm font-semibold text-muted">Dita</h3>
        {!metrics && <p className="text-muted">{NO_HAND}</p>}
        {(Object.keys(FINGER_LABELS) as (keyof typeof FINGER_LABELS)[]).map((finger) => (
          <Meter
            key={finger}
            label={FINGER_LABELS[finger]}
            value={metrics ? metrics.fingers[finger] : null}
            marks={[tuning.pose.folded, tuning.pose.extended]}
          />
        ))}
        <Meter label="Pinch" value={metrics ? metrics.pinch : null} marks={[tuning.pose.pinchOn]} />
        {metrics && <Row label="Pollice">{metrics.thumbExtended ? 'esteso' : 'chiuso'}</Row>}
      </Tile>
      <Tile title="Eventi">
        <EventList entries={log} />
      </Tile>
    </div>
  );
}
