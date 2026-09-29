import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'pill' | 'accent' | 'exit' | 'quiet';
  size?: 'sm' | 'md';
};

const VARIANTS = {
  pill: 'bg-raised text-fg hover:bg-line',
  accent: 'bg-accent text-on-accent hover:brightness-95',
  exit: 'bg-fg text-bg hover:brightness-90',
  quiet: 'bg-transparent text-muted hover:text-fg',
} as const;

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  // 44px di altezza minima: il pollice su telefono (spec §3).
  md: 'min-h-11 px-4 py-2 text-sm',
} as const;

export function Button({
  variant = 'pill',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold',
        'motion-safe:transition-colors motion-safe:duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}
