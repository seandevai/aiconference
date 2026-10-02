import {
  MAX_CONTENTS_PER_WINDOW,
  MAX_NEGOTIATION_EDITS,
  type Content,
  type ContentEdit,
  type NegotiationOutcome,
  type Stage,
} from './types';

// Negoziazione (spec §2.6), riduttori puri. Come applyCommand, una richiesta non valida
// restituisce lo stesso oggetto: chi chiama capisce che non è cambiato nulla.

function findContent(stage: Stage, contentId: string): Content | undefined {
  return stage.windows.flatMap((w) => w.contents).find((c) => c.id === contentId);
}

function replaceContent(stage: Stage, contentId: string, next: Content): Stage {
  return {
    ...stage,
    windows: stage.windows.map((w) =>
      w.contents.some((c) => c.id === contentId)
        ? { ...w, contents: w.contents.map((c) => (c.id === contentId ? next : c)) }
        : w,
    ),
  };
}

function withEdit(content: Content, edit: ContentEdit): Content | null {
  if (content.kind !== edit.kind) return null;
  return { ...content, data: edit.data } as Content;
}

export function openNegotiation(
  stage: Stage,
  options: { contentId: string; guestId: string; maxEdits: number; hostPays: boolean },
): Stage {
  if (stage.negotiation) return stage;
  if (!Number.isInteger(options.maxEdits)) return stage;
  if (options.maxEdits < 1 || options.maxEdits > MAX_NEGOTIATION_EDITS) return stage;
  // Si negozia ciò che è sul palco, non ciò che sta nel vassoio.
  const content = findContent(stage, options.contentId);
  if (!content) return stage;
  return {
    ...stage,
    negotiation: {
      contentId: content.id,
      snapshot: content,
      guestId: options.guestId,
      editsLeft: options.maxEdits,
      hostPays: options.hostPays,
      agentBusy: false,
    },
  };
}

// Modifica a mano dell'ospite che ha il turno. Consuma una modifica del tetto.
export function negotiatedEdit(stage: Stage, by: string, edit: ContentEdit): Stage {
  const negotiation = stage.negotiation;
  if (!negotiation || negotiation.guestId !== by) return stage;
  if (negotiation.agentBusy || negotiation.editsLeft < 1) return stage;
  return applyEdit(stage, edit);
}

function applyEdit(stage: Stage, edit: ContentEdit): Stage {
  const negotiation = stage.negotiation!;
  const current = findContent(stage, negotiation.contentId);
  const next = current && withEdit(current, edit);
  if (!next) return stage;
  return {
    ...replaceContent(stage, negotiation.contentId, next),
    negotiation: { ...negotiation, editsLeft: negotiation.editsLeft - 1, agentBusy: false },
  };
}

// L'ospite chiede all'agente: finché lavora, la coda è ferma.
export function startAgentEdit(stage: Stage, by: string): Stage {
  const negotiation = stage.negotiation;
  if (!negotiation || negotiation.guestId !== by) return stage;
  if (negotiation.agentBusy || negotiation.editsLeft < 1) return stage;
  return { ...stage, negotiation: { ...negotiation, agentBusy: true } };
}

// Risultato dell'agente: lo applica come una modifica. null se la richiesta è fallita,
// e allora la modifica non si consuma.
export function finishAgentEdit(stage: Stage, edit: ContentEdit | null): Stage {
  const negotiation = stage.negotiation;
  if (!negotiation?.agentBusy) return stage;
  if (edit) {
    const applied = applyEdit(stage, edit);
    if (applied !== stage) return applied;
  }
  return { ...stage, negotiation: { ...negotiation, agentBusy: false } };
}

// Mai più di due versioni dello stesso contenuto: affiancare è possibile solo se
// l'originale non è già una proposta e non ne ha già una accanto.
function hasOtherVersion(stage: Stage, content: Content): boolean {
  if (content.forkOf) return true;
  const all = [...stage.windows.flatMap((w) => w.contents), ...stage.tray];
  return all.some((c) => c.forkOf === content.id);
}

export function closeNegotiation(stage: Stage, outcome: NegotiationOutcome, forkId: string): Stage {
  const negotiation = stage.negotiation;
  if (!negotiation || negotiation.agentBusy) return stage;
  const proposal = findContent(stage, negotiation.contentId);
  if (!proposal) return stage;
  const closed: Stage = { ...stage, negotiation: null };

  switch (outcome) {
    case 'keep':
      return closed;

    case 'revert':
      return replaceContent(closed, negotiation.contentId, negotiation.snapshot);

    case 'side': {
      if (hasOtherVersion(stage, negotiation.snapshot)) return stage;
      if (findContent(stage, forkId) || stage.tray.some((c) => c.id === forkId)) return stage;
      const fork: Content = { ...proposal, id: forkId, forkOf: negotiation.contentId };
      delete fork.archived;
      const reverted = replaceContent(closed, negotiation.contentId, negotiation.snapshot);
      const window = reverted.windows.find((w) =>
        w.contents.some((c) => c.id === negotiation.contentId),
      )!;
      // Accanto all'originale se c'è posto, altrimenti nel vassoio, pronta da piazzare.
      if (window.contents.length >= MAX_CONTENTS_PER_WINDOW) {
        return { ...reverted, tray: [...reverted.tray, fork] };
      }
      return {
        ...reverted,
        windows: reverted.windows.map((w) => {
          if (w !== window) return w;
          const at = w.contents.findIndex((c) => c.id === negotiation.contentId) + 1;
          return { ...w, contents: [...w.contents.slice(0, at), fork, ...w.contents.slice(at)] };
        }),
      };
    }
  }
}
