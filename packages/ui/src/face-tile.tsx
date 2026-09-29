import type { ReactNode } from 'react';
import { cx } from './cx';

export function faceInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

type Props = {
  name: string;
  speaking: boolean;
  micOn: boolean;
  className?: string;
  children?: ReactNode;
};

// Solo il riquadro: nome accessibile e ruolo li mette chi lo usa (la lista dei partecipanti).
export function FaceTile({ name, speaking, micOn, className, children }: Props) {
  return (
    <div
      data-speaking={speaking ? 'true' : 'false'}
      className={cx(
        'relative overflow-hidden rounded-tile bg-raised',
        'motion-safe:transition-shadow motion-safe:duration-200',
        speaking ? 'ring-2 ring-accent' : 'ring-0',
        className,
      )}
    >
      {children ?? (
        <span aria-hidden className="flex h-full w-full items-center justify-center font-extrabold">
          {faceInitial(name)}
        </span>
      )}
      {!micOn && (
        <span
          data-muted
          aria-hidden="true"
          className="absolute bottom-1 right-1 rounded-full bg-bg/80 px-1 text-[10px] leading-4 text-muted"
        >
          🔇
        </span>
      )}
    </div>
  );
}
