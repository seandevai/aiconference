import type { ReactNode } from 'react';
import { cx } from './cx';

type Props = {
  tone?: 'info' | 'warning' | 'error';
  // «none» per i messaggi che non devono competere con lo stato della connessione.
  live?: 'status' | 'alert' | 'none';
  action?: ReactNode;
  children: ReactNode;
};

const TONES = {
  info: 'border-line text-fg',
  warning: 'border-accent text-fg',
  error: 'border-danger text-danger',
} as const;

export function StatusBanner({ tone = 'info', live = 'status', action, children }: Props) {
  return (
    <div
      role={live === 'none' ? undefined : live}
      className={cx(
        'flex flex-wrap items-center gap-3 rounded-tile border bg-surface px-3 py-2 text-sm',
        TONES[tone],
      )}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
