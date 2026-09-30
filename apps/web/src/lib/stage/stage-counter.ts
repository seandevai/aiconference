import type { Stage } from '@omnicanvas/canvas';

// «Finestra N di M» nella barra del palco: la finestra in primo piano fra quelle aperte.
export function stageCounter(stage: Pick<Stage, 'windows' | 'focusedId'>): string | null {
  const total = stage.windows.length;
  if (total === 0) return null;
  const index = stage.windows.findIndex((w) => w.id === stage.focusedId);
  return `Finestra ${index === -1 ? 1 : index + 1} di ${total}`;
}
