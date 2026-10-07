import { applyCommand, emptyStage, sampleContent, type Stage } from '@omnicanvas/canvas';

const KINDS = ['chart', 'text', 'table'] as const;

// Palco di prova costruito con comandi veri: tre finestre, ognuna col suo contenuto d'esempio.
export function labStage(): Stage {
  let stage = emptyStage();
  KINDS.forEach((kind, i) => {
    const windowId = `lab-window-${i + 1}`;
    const contentId = `lab-content-${i + 1}`;
    stage = applyCommand(stage, { type: 'WINDOW_CREATE', windowId, title: `Finestra ${i + 1}` });
    stage = applyCommand(stage, { type: 'TRAY_ADD', content: sampleContent(kind, contentId) });
    stage = applyCommand(stage, { type: 'CONTENT_PLACE', contentId, windowId });
  });
  return stage;
}
