import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'pill' | 'accent' | 'exit' | 'quiet' | 'overlay';
  size?: 'sm' | 'md' | 'icon';
};

const VARIANTS = {
  pill: 'bg-raised text-fg hover:bg-line',
  accent: 'bg-accent text-on-accent hover:brightness-95',
  exit: 'bg-fg text-bg hover:brightness-90',
  quiet: 'bg-transparent text-muted hover:text-fg',
  // Sopra un video: il fondo lascia intravedere l'immagine.
  overlay: 'bg-bg/80 text-fg hover:bg-bg',
} as const;

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  // 44px di altezza minima: il pollice su telefono (spec §3).
  md: 'min-h-11 px-4 py-2 text-sm',
  // Tondo, senza testo visibile: il nome va in aria-label o in uno span sr-only.
  icon: 'h-11 w-11 p-0',
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
        // Cede appena sotto il dito: il clic si sente anche senza suono.
        'motion-safe:transition-[color,background-color,filter,transform] motion-safe:duration-150',
        'motion-safe:active:scale-[0.97] disabled:active:scale-100',
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
