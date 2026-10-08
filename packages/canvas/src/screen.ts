import { MAX_TRAY, MAX_WINDOWS, type Content, type Stage, type StageCommand } from './types';

export const SCREEN_TITLE = 'Schermo';

// Lo schermo condiviso, ovunque sia: finestre o vassoio (se non è entrato in una finestra).
export function findScreen(stage: Stage): Content | null {
  const all = [...stage.windows.flatMap((w) => w.contents), ...stage.tray];
  return all.find((c) => c.kind === 'screen') ?? null;
}

// Avvio: finestra nuova in primo piano; a palco pieno, la finestra in primo piano.
export function screenStartCommands(
  stage: Stage,
  ids: { owner: string; contentId: string; windowId: string },
): StageCommand[] {
  // Vassoio pieno: lo schermo non entrerebbe, e una finestra vuota resterebbe sul palco.
  if (findScreen(stage) || stage.tray.length >= MAX_TRAY) return [];
  const add: StageCommand = {
    type: 'TRAY_ADD',
    content: { id: ids.contentId, kind: 'screen', data: { title: SCREEN_TITLE, owner: ids.owner } },
  };
  if (stage.windows.length < MAX_WINDOWS) {
    return [
      add,
      { type: 'WINDOW_CREATE', windowId: ids.windowId, title: SCREEN_TITLE },
      { type: 'CONTENT_PLACE', contentId: ids.contentId, windowId: ids.windowId },
      { type: 'FOCUS', windowId: ids.windowId },
    ];
  }
  return stage.focusedId
    ? [add, { type: 'CONTENT_PLACE', contentId: ids.contentId, windowId: stage.focusedId }]
    : [add];
}

// Fine: la finestra se lo schermo era solo, altrimenti solo lo schermo.
export function screenEndCommands(stage: Stage): StageCommand[] {
  const screen = findScreen(stage);
  if (!screen) return [];
  const window = stage.windows.find((w) => w.contents.some((c) => c.id === screen.id));
  return window && window.contents.length === 1
    ? [{ type: 'WINDOW_ARCHIVE', windowId: window.id }]
    : [{ type: 'CONTENT_REMOVE', contentId: screen.id }];
}
