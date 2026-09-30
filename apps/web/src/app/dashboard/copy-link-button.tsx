'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@omnicanvas/ui';

// Il link nasce dall'indirizzo che l'host sta usando: NEXT_PUBLIC_APP_URL nel Codespace e
// in CI vale localhost. Senza appunti (HTTP, permesso negato) il link compare selezionato e
// con il focus: mai un errore muto, mai il focus perso su <body>.
export function CopyLinkButton({ path }: { path: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === 'manual') {
      fieldRef.current?.focus();
      fieldRef.current?.select();
    }
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const url = () => new URL(path, window.location.origin).toString();

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url());
      setState('copied');
    } catch {
      setState('manual');
    }
  }

  return (
    <>
      <span aria-live="polite" className="sr-only">
        {state === 'copied' ? 'Link copiato' : ''}
      </span>
      {state === 'manual' ? (
        <input
          ref={fieldRef}
          readOnly
          aria-label="Link della riunione"
          value={url()}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 w-full max-w-56 rounded-tile border border-line bg-stage px-3 text-xs text-fg"
        />
      ) : (
        <Button onClick={() => void copy()}>
          {state === 'copied' ? 'Link copiato' : 'Copia link'}
        </Button>
      )}
    </>
  );
}
