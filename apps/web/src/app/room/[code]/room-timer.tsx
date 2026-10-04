'use client';

import { Button, StatusBanner } from '@omnicanvas/ui';
import type { RoomTimerView } from '@/lib/call/use-room-timer';
import { ROOM_MAX_MINUTES, formatRemaining, type ExtendMinutes } from '@/lib/rooms/timer';

export function RoomTimerPill({ timer }: { timer: RoomTimerView }) {
  return (
    <span
      aria-label="Tempo rimasto"
      className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold tabular-nums text-fg"
    >
      {formatRemaining(timer.remainingSeconds)}
    </span>
  );
}

type NoticeProps = {
  role: 'host' | 'guest';
  timer: RoomTimerView;
  extending: boolean;
  onExtend: (minutes: ExtendMinutes) => void;
  onEndNow: () => void;
};

// Non blocca nulla: la call continua sotto. L'host vede l'avviso a −5 minuti, l'ospite
// solo nell'ultimo minuto, senza pulsanti (solo l'host proroga).
export function RoomTimerNotice({ role, timer, extending, onExtend, onEndNow }: NoticeProps) {
  const left = formatRemaining(timer.remainingSeconds);
  if (role === 'guest') {
    if (timer.phase !== 'last-minute') return null;
    return <StatusBanner tone="warning">{`La riunione sta per terminare · ${left}`}</StatusBanner>;
  }
  if (timer.phase !== 'warning' && timer.phase !== 'last-minute') return null;
  const capNote =
    timer.extendOptions.length === 0
      ? ` · Hai raggiunto il massimo di ${ROOM_MAX_MINUTES / 60} ore.`
      : '';
  return (
    <StatusBanner
      tone="warning"
      action={
        <span className="flex flex-wrap gap-2">
          {timer.extendOptions.map((minutes) => (
            <Button key={minutes} size="sm" disabled={extending} onClick={() => onExtend(minutes)}>
              {`+${minutes} min`}
            </Button>
          ))}
          <Button size="sm" variant="exit" onClick={onEndNow}>
            Termina ora
          </Button>
        </span>
      }
    >
      {`La riunione termina fra ${left}${capNote}`}
    </StatusBanner>
  );
}
