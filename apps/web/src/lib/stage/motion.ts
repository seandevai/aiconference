import { flushSync } from 'react-dom';
import type { Stage } from '@omnicanvas/canvas';

export type StageChanges = { born: string[]; moved: string[] };

const NO_CHANGES: StageChanges = { born: [], moved: [] };

// Confronta due stati del palco: non sa se il comando è arrivato da mouse, mano, agente
// o dall'host remoto. born = finestre con un contenuto che prima non avevano;
// moved = finestre presenti in entrambi con slot diverso.
export function stageChanges(prev: Stage, next: Stage): StageChanges {
  const before = new Map(prev.windows.map((w) => [w.id, w]));
  const born: string[] = [];
  const moved: string[] = [];
  for (const window of next.windows) {
    const old = before.get(window.id);
    const had = new Set(old?.contents.map((c) => c.id) ?? []);
    if (window.contents.some((c) => !had.has(c.id))) born.push(window.id);
    if (old && old.slot !== window.slot) moved.push(window.id);
  }
  return { born, moved };
}

export function motionAllowed(doc: Document, win: Window): boolean {
  return (
    typeof doc.startViewTransition === 'function' &&
    doc.visibilityState === 'visible' &&
    !win.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type CommitOptions = {
  prev: Stage;
  next: Stage;
  doc: Document;
  win: Window;
  // Deve disegnare l'ultimo stato noto, non `next`: una transizione può partire dopo
  // un aggiornamento più recente.
  render: () => void;
  onBorn: (windowIds: string[]) => void;
};

export function commitStage({ prev, next, doc, win, render, onBorn }: CommitOptions): void {
  // Primo caricamento (snapshot o palco vuoto): si mostra com'è, senza animare tutto.
  const changes = prev.version === 0 ? NO_CHANGES : stageChanges(prev, next);
  if (changes.born.length > 0) onBorn(changes.born);
  if (changes.moved.length > 0 && motionAllowed(doc, win)) {
    doc.startViewTransition(() => flushSync(render));
    return;
  }
  render();
}
