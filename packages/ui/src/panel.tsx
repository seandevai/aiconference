import type { HTMLAttributes } from 'react';
import { cx } from './cx';

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'nav';
  tone?: 'surface' | 'stage';
  // Luce dall'alto e grana: solo il palco della call (spec 2026-09-30, §1, §5).
  lit?: boolean;
};

export function Panel({
  as: Tag = 'div',
  tone = 'surface',
  lit = false,
  className,
  ...rest
}: PanelProps) {
  return (
    <Tag
      className={cx(
        'rounded-panel',
        tone === 'surface' ? 'bg-surface shadow-edge' : 'bg-stage',
        lit && 'stage-light grain',
        className,
      )}
      {...rest}
    />
  );
}
