'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// La schermata del laboratorio sta nell'URL (?vista=…): il tasto indietro del telefono e del
// browser torna alla schermata prima. Registra e Rigioca parlano col server: senza archivio
// non esistono.
export type LabView = 'home' | 'prova' | 'banco' | 'registra' | 'rigioca';

const VIEWS: readonly LabView[] = ['prova', 'banco', 'registra', 'rigioca'];
// Da qui in su c'è spazio per il banco (Tailwind `lg`).
export const WIDE_SCREEN_QUERY = '(min-width: 64rem)';

const ARCHIVE_VIEWS: readonly LabView[] = ['registra', 'rigioca'];

export function resolveView(
  params: Pick<URLSearchParams, 'get'>,
  hasArchive: boolean,
): { view: LabView; id: string | null } {
  const raw = params.get('vista');
  const view = VIEWS.find((v) => v === raw);
  if (!view || (ARCHIVE_VIEWS.includes(view) && !hasArchive)) return { view: 'home', id: null };
  return { view, id: view === 'rigioca' ? params.get('id') || null : null };
}

export function viewSearch(view: LabView, id?: string | null): string {
  if (view === 'home') return '';
  const params = new URLSearchParams({ vista: view });
  if (view === 'rigioca' && id) params.set('id', id);
  return `?${params.toString()}`;
}

export function useLabView(hasArchive: boolean) {
  const params = useSearchParams();
  const current = resolveView(params, hasArchive);
  // pushState aggiorna useSearchParams senza rifare la pagina server: webcam e palco restano.
  // replace: un rinvio automatico sostituisce la voce, così il tasto indietro non ci ricade.
  const go = useCallback(
    (view: LabView, id?: string | null, options: { replace?: boolean } = {}) => {
      const url = `${window.location.pathname}${viewSearch(view, id)}`;
      if (options.replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    },
    [],
  );
  return { ...current, go };
}
