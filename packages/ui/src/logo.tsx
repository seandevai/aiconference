import { cx } from './cx';

// Segnaposto finché non arriva l'SVG definitivo di Sean: la finestra con le quattro
// maniglie e la scritta «nod». Sostituirlo tocca solo questo file.
export function Logo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Nod" className={cx('inline-flex items-center gap-1.5', className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
        <rect
          x="5"
          y="6"
          width="14"
          height="12"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle cx="3" cy="3" r="1.8" fill="currentColor" />
        <circle cx="21" cy="3" r="1.8" fill="currentColor" />
        <circle cx="3" cy="21" r="1.8" fill="currentColor" />
        <circle cx="21" cy="21" r="1.8" fill="currentColor" />
      </svg>
      <span aria-hidden className="text-lg font-extrabold tracking-tight">
        nod
      </span>
    </span>
  );
}
