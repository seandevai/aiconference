'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// La schermata del laboratorio sta nell'URL (?vista=…): il tasto indietro del telefono e del
// browser torna alla schermata prima. Registra e Rigioca parlano col server: senza archivio
// non esistono.
export type LabView = 'home' | 'prova' | 'registra' | 'rigioca';

const VIEWS: readonly LabView[] = ['prova', 'registra', 'rigioca'];
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
  const go = useCallback((view: LabView, id?: string | null) => {
    window.history.pushState(null, '', `${window.location.pathname}${viewSearch(view, id)}`);
  }, []);
  return { ...current, go };
}
