import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENTS_PER_WINDOW,
  applyCommand,
  closeNegotiation,
  emptyStage,
  finishAgentEdit,
  negotiatedEdit,
  openNegotiation,
  parseStage,
  startAgentEdit,
  type Content,
  type Stage,
} from '@omnicanvas/canvas';

const W = '10000000-0000-4000-8000-000000000001';
const C = '00000000-0000-4000-8000-000000000001';
const FORK = '00000000-0000-4000-8000-0000000000f1';
const GUEST = 'guest-1';

const note: Content = { id: C, kind: 'text', data: { title: 'Offerta', body: 'Prezzo 100' } };
const edit = (body: string) => ({ kind: 'text' as const, data: { title: 'Offerta', body } });

function stageWithNote(contents: Content[] = [note]): Stage {
  let stage = applyCommand(emptyStage(), {
    type: 'WINDOW_CREATE',
    windowId: W,
    title: 'Finestra 1',
  });
  for (const content of contents) {
    stage = applyCommand(stage, { type: 'TRAY_ADD', content });
    stage = applyCommand(stage, { type: 'CONTENT_PLACE', contentId: content.id, windowId: W });
  }
  return stage;
}

const open = (stage = stageWithNote(), maxEdits = 3) =>
  openNegotiation(stage, { contentId: C, guestId: GUEST, maxEdits, hostPays: false });

const bodyOf = (stage: Stage, id = C) => {
  const content = stage.windows.flatMap((w) => w.contents).find((c) => c.id === id);
  return content?.kind === 'text' ? content.data.body : undefined;
};

describe('openNegotiation', () => {
  it('snapshots the original and hands the turn to the guest, with a cap', () => {
    const stage = open();
    expect(stage.negotiation).toEqual({
      contentId: C,
      snapshot: note,
      guestId: GUEST,
      editsLeft: 3,
      hostPays: false,
      agentBusy: false,
    });
  });

  it('refuses a content that is not on the stage, a second negotiation, or no edits at all', () => {
    const base = stageWithNote();
    const elsewhere = openNegotiation(base, {
      contentId: FORK,
      guestId: GUEST,
      maxEdits: 3,
      hostPays: false,
    });
    expect(elsewhere).toBe(base);
    const once = open(base);
    expect(open(once)).toBe(once);
    expect(open(base, 0)).toBe(base);
  });
});

describe('negotiatedEdit', () => {
  it('lets only the guest with the turn edit, within the cap', () => {
    let stage = open(stageWithNote(), 2);
    expect(negotiatedEdit(stage, 'someone-else', edit('Prezzo 80'))).toBe(stage);
    stage = negotiatedEdit(stage, GUEST, edit('Prezzo 90'));
    stage = negotiatedEdit(stage, GUEST, edit('Prezzo 80'));
    expect(bodyOf(stage)).toBe('Prezzo 80');
    expect(stage.negotiation?.editsLeft).toBe(0);
    expect(negotiatedEdit(stage, GUEST, edit('Prezzo 70'))).toBe(stage);
  });

  it('refuses an edit of another kind', () => {
    const stage = open();
    const chart = { kind: 'chart' as const, data: { title: 'x', labels: [], values: [] } };
    expect(negotiatedEdit(stage, GUEST, chart)).toBe(stage);
  });

  it('does nothing without a negotiation', () => {
    const stage = stageWithNote();
    expect(negotiatedEdit(stage, GUEST, edit('Prezzo 80'))).toBe(stage);
  });
});

describe('agent in the queue', () => {
  it('blocks manual edits while the agent works, and counts its result as an edit', () => {
    let stage = startAgentEdit(open(), GUEST);
    expect(stage.negotiation?.agentBusy).toBe(true);
    expect(negotiatedEdit(stage, GUEST, edit('Prezzo 90'))).toBe(stage);
    expect(startAgentEdit(stage, GUEST)).toBe(stage);
    stage = finishAgentEdit(stage, edit('Prezzo 85'));
    expect(bodyOf(stage)).toBe('Prezzo 85');
    expect(stage.negotiation).toMatchObject({ agentBusy: false, editsLeft: 2 });
  });

  it('gives the edit back when the agent fails', () => {
    const stage = finishAgentEdit(startAgentEdit(open(), GUEST), null);
    expect(stage.negotiation).toMatchObject({ agentBusy: false, editsLeft: 3 });
    expect(bodyOf(stage)).toBe('Prezzo 100');
  });

  it('does not start the agent with no edits left', () => {
    const stage = open(stageWithNote(), 1);
    const spent = negotiatedEdit(stage, GUEST, edit('Prezzo 90'));
    expect(startAgentEdit(spent, GUEST)).toBe(spent);
  });
});

describe('closeNegotiation', () => {
  const edited = () => negotiatedEdit(open(), GUEST, edit('Prezzo 80'));

  it('keep: the proposal stays, the negotiation ends', () => {
    const stage = closeNegotiation(edited(), 'keep', FORK);
    expect(stage.negotiation).toBeNull();
    expect(bodyOf(stage)).toBe('Prezzo 80');
  });

  it('revert: the original comes back', () => {
    const stage = closeNegotiation(edited(), 'revert', FORK);
    expect(stage.negotiation).toBeNull();
    expect(bodyOf(stage)).toBe('Prezzo 100');
  });

  it('side: original and proposal next to each other, the proposal points to the original', () => {
    const stage = closeNegotiation(edited(), 'side', FORK);
    expect(stage.negotiation).toBeNull();
    expect(stage.windows[0]!.contents.map((c) => c.id)).toEqual([C, FORK]);
    expect(bodyOf(stage, C)).toBe('Prezzo 100');
    expect(bodyOf(stage, FORK)).toBe('Prezzo 80');
    expect(stage.windows[0]!.contents[1]!.forkOf).toBe(C);
  });

  it('side: the proposal goes to the tray when the window is full', () => {
    const fillers = Array.from({ length: MAX_CONTENTS_PER_WINDOW - 1 }, (_, i) => ({
      ...note,
      id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
    }));
    let stage = open(stageWithNote([note, ...fillers]));
    stage = negotiatedEdit(stage, GUEST, edit('Prezzo 80'));
    stage = closeNegotiation(stage, 'side', FORK);
    expect(stage.windows[0]!.contents).toHaveLength(MAX_CONTENTS_PER_WINDOW);
    expect(stage.tray.map((c) => [c.id, c.forkOf, c.archived])).toEqual([[FORK, C, undefined]]);
  });

  it('never more than two versions of the same content', () => {
    const sided = closeNegotiation(edited(), 'side', FORK);
    let again = openNegotiation(sided, {
      contentId: C,
      guestId: GUEST,
      maxEdits: 3,
      hostPays: false,
    });
    again = negotiatedEdit(again, GUEST, edit('Prezzo 70'));
    const other = '00000000-0000-4000-8000-0000000000f2';
    expect(closeNegotiation(again, 'side', other)).toBe(again);
    expect(closeNegotiation(again, 'keep', other).negotiation).toBeNull();
  });

  it('does nothing without a negotiation, or while the agent works', () => {
    const plain = stageWithNote();
    expect(closeNegotiation(plain, 'keep', FORK)).toBe(plain);
    const busy = startAgentEdit(open(), GUEST);
    expect(closeNegotiation(busy, 'keep', FORK)).toBe(busy);
  });
});

describe('host commands during a negotiation', () => {
  it('cannot move, remove or archive the negotiated content', () => {
    const stage = open();
    expect(applyCommand(stage, { type: 'CONTENT_REMOVE', contentId: C })).toBe(stage);
    expect(applyCommand(stage, { type: 'WINDOW_ARCHIVE', windowId: W })).toBe(stage);
    const W2 = '10000000-0000-4000-8000-000000000002';
    const two = applyCommand(stage, { type: 'WINDOW_CREATE', windowId: W2, title: 'Finestra 2' });
    expect(applyCommand(two, { type: 'CONTENT_PLACE', contentId: C, windowId: W2 })).toBe(two);
  });

  it('can still work on the rest of the stage', () => {
    const stage = open();
    const W2 = '10000000-0000-4000-8000-000000000002';
    expect(
      applyCommand(stage, { type: 'WINDOW_CREATE', windowId: W2, title: 'Finestra 2' }).windows,
    ).toHaveLength(2);
  });
});

describe('snapshot with a negotiation', () => {
  it('survives the snapshot schema, so late guests see it', () => {
    const stage = { ...negotiatedEdit(open(), GUEST, edit('Prezzo 80')), version: 4 };
    expect(parseStage(JSON.parse(JSON.stringify(stage)))).toEqual(stage);
    const sided = { ...closeNegotiation(stage, 'side', FORK), version: 5 };
    expect(parseStage(JSON.parse(JSON.stringify(sided)))).toEqual(sided);
  });
});
