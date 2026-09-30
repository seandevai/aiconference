'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';

type Props = {
  label: ReactNode;
  triggerLabel: string;
  children: ReactNode;
  align?: 'start' | 'end';
};

// Menu minimo senza librerie: si chiude con Esc (il focus torna al pulsante) e col clic fuori.
export function Menu({ label, triggerLabel, children, align = 'end' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-raised px-3 text-sm font-semibold text-fg hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {label}
      </button>
      {open && (
        <div
          className={cx(
            'absolute top-full z-30 mt-2 flex min-w-44 flex-col gap-1 rounded-panel border border-line bg-surface p-2',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
