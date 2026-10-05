import type { LogEntry } from '@/lib/gesture-lab/event-log';

export function EventList({ entries }: { entries: LogEntry[] }) {
  return (
    <section className="flex flex-col gap-1 text-xs text-fg">
      <h2 className="text-sm font-semibold text-muted">Eventi</h2>
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry, i) => (
          <li key={`${entry.t}-${i}`} className="flex justify-between gap-2">
            <span>{entry.label}</span>
            <span className="tabular-nums text-muted">{(entry.t / 1000).toFixed(1)} s</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
