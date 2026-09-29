import type { HTMLAttributes } from 'react';
import { cx } from './cx';

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'nav';
  tone?: 'surface' | 'stage';
};

export function Panel({ as: Tag = 'div', tone = 'surface', className, ...rest }: PanelProps) {
  return (
    <Tag
      className={cx('rounded-panel', tone === 'surface' ? 'bg-surface' : 'bg-stage', className)}
      {...rest}
    />
  );
}
