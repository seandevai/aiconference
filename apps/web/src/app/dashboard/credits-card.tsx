import { Panel } from '@omnicanvas/ui';
import { formatCredits } from '@/lib/dashboard/model';

const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' });

export function CreditsCard({
  credits,
  now,
}: {
  credits: { balance: number; usedThisMonth: number } | null;
  now: Date;
}) {
  return (
    <Panel as="section" tone="stage" aria-label="Crediti" className="flex flex-col gap-1 p-4">
      <h2 className="text-xs font-semibold text-muted">Saldo</h2>
      <p className="tabular text-3xl font-extrabold tracking-tight">
        {credits ? formatCredits(credits.balance) : '—'}
      </p>
      {credits && (
        <p className="tabular text-xs text-muted">
          {`${formatCredits(credits.usedThisMonth)} usati a ${monthName.format(now)}`}
        </p>
      )}
    </Panel>
  );
}
