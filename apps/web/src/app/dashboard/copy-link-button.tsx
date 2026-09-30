'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@omnicanvas/ui';

// Senza appunti (HTTP, permesso negato) il link compare già selezionato: mai un errore muto.
export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === 'manual') fieldRef.current?.select();
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('manual');
    }
  }

  if (state === 'manual') {
    return (
      <input
        ref={fieldRef}
        readOnly
        aria-label="Link della riunione"
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="min-h-11 w-56 rounded-tile border border-line bg-stage px-3 text-xs text-fg"
      />
    );
  }
  return (
    <Button onClick={() => void copy()}>
      {state === 'copied' ? 'Link copiato' : 'Copia link'}
    </Button>
  );
}
