import { useId, type ComponentPropsWithRef } from 'react';
import { cx } from './cx';

type Props = ComponentPropsWithRef<'input'> & { label: string; error?: string | null };

// Etichetta sempre visibile sopra il campo: il segnaposto non la sostituisce mai.
export function TextField({ label, error, className, id, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cx(
          'min-h-11 rounded-tile border bg-stage px-3 text-sm text-fg placeholder:text-muted',
          'motion-safe:transition-colors hover:border-muted focus-visible:border-accent focus-visible:outline-none',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
