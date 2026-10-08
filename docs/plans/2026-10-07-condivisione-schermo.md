# Condivisione dello schermo — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'host condivide lo schermo con un click e tutti lo vedono in una finestra del palco, che sparisce quando la condivisione finisce.

**Architecture:** nuovo tipo di contenuto `screen` nel modello del palco (`packages/canvas`), creato e tolto con i comandi esistenti. `packages/realtime` pubblica e aggancia la traccia schermo, e il token LiveKit permette lo schermo solo all'host. In `apps/web` un hook tiene l'invariante «schermo sul palco ⇔ host in condivisione», mentre un context porta l'aggancio del video fino alla finestra.

**Tech Stack:** TypeScript strict (`exactOptionalPropertyTypes`), zod, React 19 / Next.js (App Router), livekit-client 2.22, livekit-server-sdk, Vitest + Testing Library (happy-dom), Playwright.

**Spec:** `docs/specs/2026-10-07-condivisione-schermo-design.md` · ADR-0015

## Global Constraints

- Branch `slice/condivisione-schermo`. Commit in inglese, documentazione e commenti in italiano.
- LiveKit solo in `packages/realtime`; `types.ts`, `camera.ts` e il nuovo `screen.ts` non nominano il vendor.
- `packages/canvas` non sa da dove arriva un comando: niente comandi nuovi, solo `TRAY_ADD`, `WINDOW_CREATE`, `CONTENT_PLACE`, `FOCUS`, `CONTENT_REMOVE`, `WINDOW_ARCHIVE`.
- Il contenuto `screen` porta solo `{ title, owner }`: mai fotogrammi o byte (regola 1).
- Solo l'host condivide: imposto da `canPublishSources` nel token, non solo dalla UI (regola 2).
- Niente audio dello schermo: `setScreenShareEnabled(true, { audio: false })`.
- Il pacchetto non contiene mai `screen`, nemmeno fra i «mancanti».
- Testi della UI: «Condividi schermo», «Interrompi condivisione», «Schermo» (titolo della finestra), «Schermo in arrivo…», «Non riesco a condividere lo schermo.».
- Nessun gesto nuovo (ADR-0010 invariato).
- Comandi: `npm run typecheck`, `npm run lint`, `npx vitest run tests/unit`, `npm run test:e2e` (solo nel Codespace o in CI: in locale Docker è spento).

## Review Focus

1. **Palco con il vassoio pieno (50 contenuti):** lo schermo non può entrare. Ci si aspetta che non resti né una finestra vuota né uno schermo invisibile e che la condivisione si fermi da sola per l'invariante. Test nei Task 2 e 5.
2. **Finestra in primo piano con 12 contenuti e palco pieno:** `CONTENT_PLACE` fallisce e lo schermo resta nel vassoio. Ci si aspetta che `screenEndCommands` lo trovi anche lì e lo tolga, senza contenuti `screen` orfani. Test nel Task 2.
3. **Doppio click su «Condividi schermo» mentre il selettore è aperto:** non deve aprire due selettori né creare due finestre. Test nel Task 5.
4. **Ospite che riceve uno snapshot con lo schermo prima della traccia:** finestra con «Schermo in arrivo…», nessun errore. Test nel Task 6.
5. **Gesto o mouse che spostano la finestra «Schermo» fra gli slot:** deve restare tale e quale, perché `WINDOW_MOVE` e `FOCUS` non toccano i contenuti. Test nel Task 1.

---

## File

| File | Responsabilità |
|---|---|
| `packages/canvas/src/types.ts` | tipo `ScreenRef` e variante `screen` di `Content` |
| `packages/canvas/src/schema.ts` | variante `screen` di `contentSchema` |
| `packages/canvas/src/reducer.ts` | un solo schermo, mai nel vassoio |
| `packages/canvas/src/negotiation.ts` | `screen` non si negozia |
| `packages/canvas/src/screen.ts` (nuovo) | `findScreen`, `screenStartCommands`, `screenEndCommands` |
| `packages/bundle/src/collect.ts` | salta `screen` |
| `packages/realtime/src/server.ts` | sorgenti pubblicabili per ruolo |
| `packages/realtime/src/screen.ts` (nuovo) | `ScreenShareCancelled`, `supportsScreenShare`, `isShareCancel` |
| `packages/realtime/src/types.ts` | cinque membri nuovi di `RealtimeSession` |
| `packages/realtime/src/livekit-session.ts` | implementazione LiveKit |
| `apps/web/src/lib/stage/use-screen-share.ts` (nuovo) | stato della condivisione e invariante |
| `apps/web/src/app/room/[code]/screen-view.tsx` (nuovo) | context di aggancio e `<video>` dello schermo |
| `apps/web/src/app/room/[code]/content-view.tsx` | caso `screen` |
| `apps/web/src/app/room/[code]/window-view.tsx` | niente «Rimetti nel vassoio» per lo schermo |
| `apps/web/src/app/room/[code]/stage-area.tsx` | fornisce il context |
| `apps/web/src/app/room/[code]/room-call.tsx` | pulsante nel dock, banner d'errore |
| `e2e/screen-share.spec.ts` (nuovo), `playwright.config.ts` | percorso host → ospite |

---

### Task 1: il tipo `screen` nel modello del palco

**Files:**
- Modify: `packages/canvas/src/types.ts`, `packages/canvas/src/schema.ts`, `packages/canvas/src/reducer.ts`, `packages/canvas/src/negotiation.ts`, `packages/bundle/src/collect.ts`, `apps/web/src/app/room/[code]/content-view.tsx`
- Test: `tests/unit/stage-screen.test.ts` (nuovo), `tests/unit/bundle.test.ts`

**Interfaces:**
- Produces: `type ScreenRef = { title: string; owner: string }`; variante `Content` con `kind: 'screen'; data: ScreenRef`; `LIMITS.owner = 128`.

- [ ] **Step 1: scrivere il test che fallisce**

`tests/unit/stage-screen.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  emptyStage,
  openNegotiation,
  parseStage,
  type Content,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';

const W = '10000000-0000-4000-8000-000000000001';
const W2 = '10000000-0000-4000-8000-000000000002';
const S = '00000000-0000-4000-8000-0000000000a1';
const S2 = '00000000-0000-4000-8000-0000000000b2';
const N = '00000000-0000-4000-8000-000000000001';

const screen = (id = S): Content => ({
  id,
  kind: 'screen',
  data: { title: 'Schermo', owner: 'host-1' },
});
const note: Content = { id: N, kind: 'text', data: { title: 'Nota', body: 'x' } };

const run = (commands: StageCommand[], from: Stage = emptyStage()): Stage =>
  commands.reduce(applyCommand, from);

const withScreenWindow = () =>
  run([
    { type: 'TRAY_ADD', content: screen() },
    { type: 'WINDOW_CREATE', windowId: W, title: 'Schermo' },
    { type: 'CONTENT_PLACE', contentId: S, windowId: W },
  ]);

describe('screen content', () => {
  it('validates in a stage snapshot', () => {
    expect(parseStage(withScreenWindow())).not.toBeNull();
  });

  it('rejects an empty owner', () => {
    const stage = withScreenWindow();
    const broken = {
      ...stage,
      windows: [{ ...stage.windows[0]!, contents: [{ ...screen(), data: { title: 'Schermo', owner: '' } }] }],
    };
    expect(parseStage(broken)).toBeNull();
  });

  it('allows a single screen on the stage', () => {
    const stage = applyCommand(withScreenWindow(), { type: 'TRAY_ADD', content: screen(S2) });
    expect(stage.tray).toEqual([]);
  });

  it('is dropped, not archived, when removed from its window', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: note },
        { type: 'CONTENT_PLACE', contentId: N, windowId: W },
        { type: 'CONTENT_REMOVE', contentId: S },
      ],
      withScreenWindow(),
    );
    expect(stage.windows[0]!.contents.map((c) => c.id)).toEqual([N]);
    expect(stage.tray).toEqual([]);
  });

  it('is dropped, not archived, when its window is archived', () => {
    const stage = applyCommand(withScreenWindow(), { type: 'WINDOW_ARCHIVE', windowId: W });
    expect(stage.windows).toEqual([]);
    expect(stage.tray).toEqual([]);
  });

  it('is dropped from the tray too', () => {
    const stage = run([
      { type: 'TRAY_ADD', content: screen() },
      { type: 'CONTENT_REMOVE', contentId: S },
    ]);
    expect(stage.tray).toEqual([]);
  });

  it('stays as it is when its window moves between slots', () => {
    const stage = run(
      [
        { type: 'WINDOW_CREATE', windowId: W2, title: 'Altra' },
        { type: 'WINDOW_MOVE', windowId: W, slot: 'side-1' },
      ],
      withScreenWindow(),
    );
    const moved = stage.windows.find((w) => w.id === W)!;
    expect(moved.slot).toBe('side-1');
    expect(moved.contents).toEqual([screen()]);
  });

  it('cannot be negotiated', () => {
    const stage = withScreenWindow();
    expect(
      openNegotiation(stage, { contentId: S, guestId: 'g', maxEdits: 3, hostPays: false }),
    ).toBe(stage);
  });
});
```

Gli id devono essere uuid validi per lo schema.

In `tests/unit/bundle.test.ts`, dentro `describe('collectFiles', ...)`:

```ts
  it('never puts the shared screen in the bundle, not even among the missing', () => {
    const live = {
      id: '00000000-0000-4000-8000-0000000000a1',
      kind: 'screen',
      data: { title: 'Schermo', owner: 'host-1' },
    } as Content;
    const { files, missing } = collectFiles(stageWith([[live, text(1)]], []), new Map());
    expect(files.map((f) => f.name)).toEqual(['01-nota-1.md']);
    expect(missing).toEqual([]);
  });
```

(Controlla il nome atteso con gli altri test del file: `slug('Nota 1')` produce `nota-1`.)

- [ ] **Step 2: eseguire i test e vederli fallire**

Run: `npx vitest run tests/unit/stage-screen.test.ts tests/unit/bundle.test.ts`
Atteso: FAIL. `parseStage` restituisce `null` per il `kind` sconosciuto, il reducer archivia nel vassoio, il bundle mette lo schermo fra i mancanti.

- [ ] **Step 3: implementare**

`packages/canvas/src/types.ts`, sotto `ImageRef`:

```ts
// Riferimento a una traccia dal vivo: chi condivide. Nessun fotogramma passa dal palco.
export type ScreenRef = { title: string; owner: string };
```

e in `Content`:

```ts
  | (ContentBase & { kind: 'image'; data: ImageRef })
  | (ContentBase & { kind: 'screen'; data: ScreenRef });
```

`packages/canvas/src/schema.ts`: in `LIMITS` aggiungi `owner: 128,`. In `contentSchema`, dopo la variante `image`:

```ts
  z.object({
    id,
    kind: z.literal('screen'),
    archived,
    forkOf,
    data: z.object({ title, owner: z.string().min(1).max(LIMITS.owner) }),
  }),
```

`packages/canvas/src/reducer.ts`:

```ts
const isScreen = (content: Content) => content.kind === 'screen';

function hasScreen(stage: Stage): boolean {
  return [...stage.tray, ...stage.windows.flatMap((w) => w.contents)].some(isScreen);
}
```

- `TRAY_ADD`: dopo il controllo esistente, `if (isScreen(command.content) && hasScreen(stage)) return stage;`
- `WINDOW_ARCHIVE`: `const archived = target.contents.filter((c) => !isScreen(c)).map((c) => ({ ...c, archived: true }));`
- `CONTENT_REMOVE`, sostituisci il caso:

```ts
    case 'CONTENT_REMOVE': {
      // Lo schermo condiviso non va mai nel vassoio: finita la traccia non resta nulla.
      const inTray = stage.tray.find((c) => c.id === command.contentId);
      if (inTray) {
        return isScreen(inTray)
          ? { ...stage, tray: stage.tray.filter((c) => c !== inTray) }
          : stage;
      }
      const content = stage.windows
        .flatMap((w) => w.contents)
        .find((c) => c.id === command.contentId);
      if (!content) return stage;
      const tray = isScreen(content) ? stage.tray : [...stage.tray, { ...content, archived: true }];
      return withWindows(
        { ...stage, tray },
        stage.windows.map((w) => ({
          ...w,
          contents: w.contents.filter((c) => c.id !== command.contentId),
        })),
      );
    }
```

`packages/canvas/src/negotiation.ts`, in `openNegotiation` dopo `if (!content) return stage;`:

```ts
  // Lo schermo è una traccia dal vivo dell'host: non c'è nulla da proporre.
  if (content.kind === 'screen') return stage;
```

`packages/bundle/src/collect.ts`, nel ciclo di `collectFiles`:

```ts
  for (const content of [...stage.windows.flatMap((w) => w.contents), ...stage.tray]) {
    // Lo schermo condiviso non entra mai nel pacchetto (ADR-0015).
    if (content.kind === 'screen' || seen.has(content.id)) continue;
```

In `toFile` aggiungi `case 'screen': return null;`: serve all'esaustività dello switch e non viene mai raggiunto.

`apps/web/src/app/room/[code]/content-view.tsx`, caso provvisorio che il Task 6 sostituirà:

```tsx
    case 'screen':
      return (
        <div className="flex h-32 items-center justify-center rounded-tile bg-bg text-sm text-muted">
          Schermo in arrivo…
        </div>
      );
```

- [ ] **Step 4: eseguire i test**

Run: `npx vitest run tests/unit/stage-screen.test.ts tests/unit/bundle.test.ts tests/unit/stage-reducer.test.ts tests/unit/stage-negotiation.test.ts && npm run typecheck`
Atteso: PASS, typecheck pulito.

- [ ] **Step 5: commit**

```bash
git add packages/canvas packages/bundle apps/web/src/app/room/[code]/content-view.tsx tests/unit/stage-screen.test.ts tests/unit/bundle.test.ts
git commit -m "feat(canvas): screen content, one per stage, never in the tray or the bundle"
```

---

### Task 2: comandi di avvio e fine

**Files:**
- Create: `packages/canvas/src/screen.ts`
- Modify: `packages/canvas/src/index.ts`
- Test: `tests/unit/stage-screen-commands.test.ts`

**Interfaces:**
- Consumes: variante `screen` (Task 1).
- Produces:
  - `findScreen(stage: Stage): Content | null`
  - `screenStartCommands(stage: Stage, ids: { owner: string; contentId: string; windowId: string }): StageCommand[]`
  - `screenEndCommands(stage: Stage): StageCommand[]`
  - `SCREEN_TITLE = 'Schermo'`

- [ ] **Step 1: scrivere il test che fallisce**

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENTS_PER_WINDOW,
  MAX_TRAY,
  applyCommand,
  emptyStage,
  findScreen,
  screenEndCommands,
  screenStartCommands,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';

const ids = {
  owner: 'host-1',
  contentId: '00000000-0000-4000-8000-0000000000a1',
  windowId: '10000000-0000-4000-8000-0000000000a1',
};
const win = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const run = (commands: StageCommand[], from: Stage = emptyStage()): Stage =>
  commands.reduce(applyCommand, from);
const start = (stage: Stage) => run(screenStartCommands(stage, ids), stage);

describe('screenStartCommands', () => {
  it('opens a «Schermo» window in the main slot', () => {
    const stage = start(run([{ type: 'WINDOW_CREATE', windowId: win(1), title: 'Uno' }]));
    const shown = stage.windows.find((w) => w.id === ids.windowId)!;
    expect(shown.slot).toBe('main');
    expect(shown.title).toBe('Schermo');
    expect(shown.contents).toEqual([
      { id: ids.contentId, kind: 'screen', data: { title: 'Schermo', owner: 'host-1' } },
    ]);
  });

  it('uses the focused window when the stage is full', () => {
    const full = run([1, 2, 3, 4].map((n) => ({ type: 'WINDOW_CREATE', windowId: win(n), title: `F${n}` }) as const));
    const stage = start(full);
    expect(stage.windows).toHaveLength(4);
    const focused = stage.windows.find((w) => w.id === stage.focusedId)!;
    expect(focused.contents.map((c) => c.kind)).toEqual(['screen']);
  });

  it('does nothing when the tray is full', () => {
    const tray = Array.from({ length: MAX_TRAY }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      kind: 'text' as const,
      data: { title: 'x', body: '' },
    }));
    expect(screenStartCommands({ ...emptyStage(), tray }, ids)).toEqual([]);
  });

  it('does nothing when a screen is already there', () => {
    const once = start(emptyStage());
    expect(screenStartCommands(once, { ...ids, contentId: win(9), windowId: win(8) })).toEqual([]);
  });
});

describe('screenEndCommands', () => {
  it('archives the window when the screen was alone in it', () => {
    const stage = run(screenEndCommands(start(emptyStage())), start(emptyStage()));
    expect(stage.windows).toEqual([]);
    expect(findScreen(stage)).toBeNull();
  });

  it('removes only the screen when the window holds other contents', () => {
    const note = { id: '00000000-0000-4000-8000-000000000001', kind: 'text', data: { title: 'N', body: '' } } as const;
    const full = run([1, 2, 3, 4].map((n) => ({ type: 'WINDOW_CREATE', windowId: win(n), title: `F${n}` }) as const));
    const withNote = run([{ type: 'TRAY_ADD', content: note }, { type: 'CONTENT_PLACE', contentId: note.id, windowId: full.focusedId! }], full);
    const sharing = start(withNote);
    const stage = run(screenEndCommands(sharing), sharing);
    expect(stage.windows).toHaveLength(4);
    expect(stage.windows.find((w) => w.id === full.focusedId)!.contents.map((c) => c.id)).toEqual([note.id]);
  });

  it('clears a screen left in the tray when the focused window was full', () => {
    const full = run([1, 2, 3, 4].map((n) => ({ type: 'WINDOW_CREATE', windowId: win(n), title: `F${n}` }) as const));
    let crowded = full;
    for (let i = 0; i < MAX_CONTENTS_PER_WINDOW; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      crowded = run([{ type: 'TRAY_ADD', content: { id, kind: 'text', data: { title: 'x', body: '' } } }, { type: 'CONTENT_PLACE', contentId: id, windowId: full.focusedId! }], crowded);
    }
    const stuck = start(crowded);
    expect(findScreen(stuck)?.id).toBe(ids.contentId);
    expect(findScreen(run(screenEndCommands(stuck), stuck))).toBeNull();
  });

  it('does nothing without a screen', () => {
    expect(screenEndCommands(emptyStage())).toEqual([]);
  });
});
```

Applica Prettier al file prima del commit: alcune righe superano la larghezza.

- [ ] **Step 2: eseguire il test e vederlo fallire**

Run: `npx vitest run tests/unit/stage-screen-commands.test.ts`
Atteso: FAIL, `findScreen is not a function`.

- [ ] **Step 3: implementare**

`packages/canvas/src/screen.ts`:

```ts
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
```

`packages/canvas/src/index.ts`: `export { SCREEN_TITLE, findScreen, screenEndCommands, screenStartCommands } from './screen';`

- [ ] **Step 4: eseguire il test**

Run: `npx vitest run tests/unit/stage-screen-commands.test.ts && npm run typecheck`
Atteso: PASS.

- [ ] **Step 5: commit**

```bash
git add packages/canvas/src/screen.ts packages/canvas/src/index.ts tests/unit/stage-screen-commands.test.ts
git commit -m "feat(canvas): start and end commands for the shared screen"
```

---

### Task 3: lo schermo solo all'host nel token

**Files:**
- Modify: `packages/realtime/src/server.ts`
- Test: `tests/unit/livekit-token.test.ts`

**Interfaces:**
- Consumes: `RoomTokenInput.role` esistente.
- Produces: claim `video.canPublishSources`, che vale `['camera','microphone']` per l'ospite e `['camera','microphone','screen_share']` per l'host.

- [ ] **Step 1: scrivere il test che fallisce**

In `tests/unit/livekit-token.test.ts`:

```ts
  it('lets only the host publish a screen', async () => {
    const verify = async (role: 'host' | 'guest') =>
      new TokenVerifier('devkey', 'secret').verify(
        await createRoomToken({ ...input, role }, credentials),
      );
    expect((await verify('guest')).video?.canPublishSources).toEqual(['camera', 'microphone']);
    expect((await verify('host')).video?.canPublishSources).toEqual([
      'camera',
      'microphone',
      'screen_share',
    ]);
  });
```

- [ ] **Step 2: eseguire il test e vederlo fallire**

Run: `npx vitest run tests/unit/livekit-token.test.ts`
Atteso: FAIL, `canPublishSources` è `undefined`.

- [ ] **Step 3: implementare**

In `server.ts`: `import { AccessToken, TrackSource } from 'livekit-server-sdk';`. Poi:

```ts
// Sorgenti per ruolo: lo schermo lo pubblica solo l'host (ADR-0015). Lo verifica LiveKit,
// non la UI.
const PUBLISH_SOURCES: Record<ParticipantRole, TrackSource[]> = {
  guest: [TrackSource.CAMERA, TrackSource.MICROPHONE],
  host: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
};
```

Nel grant: `canPublishSources: PUBLISH_SOURCES[input.role],`.

- [ ] **Step 4: eseguire il test**

Run: `npx vitest run tests/unit/livekit-token.test.ts && npm run typecheck`
Atteso: PASS.

- [ ] **Step 5: commit**

```bash
git add packages/realtime/src/server.ts tests/unit/livekit-token.test.ts
git commit -m "feat(realtime): only the host token may publish a screen"
```

---

### Task 4: condivisione nella sessione realtime

**Files:**
- Create: `packages/realtime/src/screen.ts`
- Modify: `packages/realtime/src/types.ts`, `packages/realtime/src/livekit-session.ts`, `packages/realtime/src/index.ts`
- Test: `tests/unit/realtime-screen.test.ts`

**Interfaces:**
- Produces, su `RealtimeSession`:
  - `canShareScreen(): boolean`
  - `startScreenShare(): Promise<void>` (rifiuta con `ScreenShareCancelled` se l'utente annulla)
  - `stopScreenShare(): Promise<void>`
  - `onScreenShareEnded(handler: () => void): Unsubscribe`
  - `attachScreen(identity: string, element: HTMLVideoElement): Unsubscribe`
- Esportati da `@omnicanvas/realtime`: `ScreenShareCancelled`, `supportsScreenShare`, `isShareCancel`.

- [ ] **Step 1: scrivere il test che fallisce**

```ts
import { describe, expect, it } from 'vitest';
import { ScreenShareCancelled, isShareCancel, supportsScreenShare } from '@omnicanvas/realtime';

describe('screen share helpers', () => {
  it('needs getDisplayMedia', () => {
    expect(supportsScreenShare({ mediaDevices: { getDisplayMedia: () => {} } })).toBe(true);
    expect(supportsScreenShare({ mediaDevices: {} })).toBe(false);
    expect(supportsScreenShare(undefined)).toBe(false);
  });

  it('tells a cancelled picker from a system refusal', () => {
    expect(isShareCancel(new DOMException('Permission denied', 'NotAllowedError'))).toBe(true);
    expect(
      isShareCancel(new DOMException('Permission denied by system', 'NotAllowedError')),
    ).toBe(false);
    expect(isShareCancel(new DOMException('Could not start', 'NotReadableError'))).toBe(false);
    expect(isShareCancel('boom')).toBe(false);
  });

  it('names the cancellation', () => {
    expect(new ScreenShareCancelled().name).toBe('ScreenShareCancelled');
  });
});
```

- [ ] **Step 2: eseguire il test e vederlo fallire**

Run: `npx vitest run tests/unit/realtime-screen.test.ts`
Atteso: FAIL, export mancanti.

- [ ] **Step 3: implementare**

`packages/realtime/src/screen.ts`:

```ts
// Condivisione dello schermo senza nominare il vendor: si testa senza browser.

export class ScreenShareCancelled extends Error {
  constructor() {
    super('screen share cancelled');
    this.name = 'ScreenShareCancelled';
  }
}

type NavigatorLike = { mediaDevices?: { getDisplayMedia?: unknown } } | undefined;

// I telefoni non hanno getDisplayMedia: lì il pulsante non compare.
export function supportsScreenShare(nav: NavigatorLike): boolean {
  return typeof nav?.mediaDevices?.getDisplayMedia === 'function';
}

// Chrome usa NotAllowedError sia per il selettore annullato sia per il divieto del sistema
// operativo; il secondo lo dice nel messaggio («by system»).
export function isShareCancel(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotAllowedError' && !/system/i.test(error.message);
}
```

`types.ts`, in `RealtimeSession` dopo `attachVideo`:

```ts
  // Condivisione dello schermo: solo l'host (lo impone il token), senza audio.
  canShareScreen(): boolean;
  // Rifiuta con ScreenShareCancelled se chi condivide chiude il selettore del browser.
  startScreenShare(): Promise<void>;
  stopScreenShare(): Promise<void>;
  // Anche quando si ferma dal pulsante del browser.
  onScreenShareEnded(handler: () => void): Unsubscribe;
  attachScreen(identity: string, element: HTMLVideoElement): Unsubscribe;
```

`index.ts`: `export { ScreenShareCancelled, isShareCancel, supportsScreenShare } from './screen';`

`livekit-session.ts`:
1. `import { ScreenShareCancelled, isShareCancel, supportsScreenShare } from './screen';`
2. Accanto agli altri insiemi di handler: `const screenEndedHandlers = new Set<() => void>();`
3. Dove si registrano gli eventi della stanza:

```ts
  // Stop dalla UI o dal pulsante del browser: LiveKit toglie la pubblicazione in entrambi i casi.
  room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
    if (publication.source === Track.Source.ScreenShare) {
      screenEndedHandlers.forEach((handler) => handler());
    }
  });
```

4. Estrai il corpo di `attachVideo` in una funzione locale, con la sorgente come parametro (seconda implementazione, quindi l'astrazione è giustificata):

```ts
  const attachSource = (identity: string, source: Track.Source, element: HTMLVideoElement) => {
    let attached: Track | undefined;
    // La traccia può arrivare dopo il montaggio della tessera: si riprova a ogni sottoscrizione.
    const tryAttach = () => {
      const track = participant(identity)?.getTrackPublication(source)?.track;
      if (!track || track === attached) return;
      attached?.detach(element);
      track.attach(element);
      attached = track;
    };
    tryAttach();
    room.on(RoomEvent.TrackSubscribed, tryAttach).on(RoomEvent.LocalTrackPublished, tryAttach);
    return () => {
      room
        .off(RoomEvent.TrackSubscribed, tryAttach)
        .off(RoomEvent.LocalTrackPublished, tryAttach);
      attached?.detach(element);
    };
  };
```

e nell'oggetto sessione:

```ts
    attachVideo(identity, element) {
      return attachSource(identity, Track.Source.Camera, element);
    },

    canShareScreen() {
      return supportsScreenShare(globalThis.navigator);
    },

    async startScreenShare() {
      try {
        await room.localParticipant.setScreenShareEnabled(true, { audio: false });
      } catch (error) {
        throw isShareCancel(error) ? new ScreenShareCancelled() : error;
      }
    },

    async stopScreenShare() {
      await room.localParticipant.setScreenShareEnabled(false);
    },

    onScreenShareEnded(handler) {
      screenEndedHandlers.add(handler);
      return () => {
        screenEndedHandlers.delete(handler);
      };
    },

    attachScreen(identity, element) {
      return attachSource(identity, Track.Source.ScreenShare, element);
    },
```

Verifica sul sorgente di `livekit-client` 2.22.3 (`LocalParticipant.setTrackEnabled`) che l'errore di `getDisplayMedia` venga rilanciato e non inghiottito. Se viene inghiottito, il fallimento si vede come `setScreenShareEnabled` che restituisce `undefined`: in quel caso lancia `new ScreenShareCancelled()`.

- [ ] **Step 4: eseguire i test**

Run: `npx vitest run tests/unit/realtime-screen.test.ts && npm run typecheck && npx vitest run tests/unit`
Atteso: PASS. I fake di sessione nei test usano `as unknown as RealtimeSession`, quindi non si rompono.

- [ ] **Step 5: commit**

```bash
git add packages/realtime tests/unit/realtime-screen.test.ts
git commit -m "feat(realtime): publish, stop and attach the host screen"
```

---

### Task 5: hook `useScreenShare` con l'invariante

**Files:**
- Create: `apps/web/src/lib/stage/use-screen-share.ts`
- Test: `tests/unit/use-screen-share.test.tsx`

**Interfaces:**
- Consumes: `findScreen`, `screenStartCommands`, `screenEndCommands` (Task 2); `RealtimeSession` (Task 4); `ScreenShareCancelled`.
- Produces: `useScreenShare(options: { session: RealtimeSession | null; role: 'host' | 'guest'; stage: Stage; ready: boolean; dispatch: (command: StageCommand) => void; newId?: () => string }): { available: boolean; sharing: boolean; error: string | null; start(): Promise<void>; stop(): void }` e `SCREEN_SHARE_ERROR`.

- [ ] **Step 1: scrivere il test che fallisce**

```tsx
// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  applyCommand,
  emptyStage,
  findScreen,
  screenStartCommands,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import { ScreenShareCancelled, type RealtimeSession } from '@omnicanvas/realtime';
import { SCREEN_SHARE_ERROR, useScreenShare } from '@/lib/stage/use-screen-share';

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

function fakeSession(canShare = true) {
  const ended = new Set<() => void>();
  const endNatively = () => ended.forEach((handler) => handler());
  const session = {
    localIdentity: 'host-1',
    canShareScreen: () => canShare,
    startScreenShare: vi.fn(async () => {}),
    stopScreenShare: vi.fn(async () => endNatively()),
    onScreenShareEnded: (handler: () => void) => {
      ended.add(handler);
      return () => ended.delete(handler);
    },
  };
  return { session, endNatively };
}

function setup(options: { role?: 'host' | 'guest'; initial?: Stage; canShare?: boolean } = {}) {
  const fake = fakeSession(options.canShare);
  const hook = renderHook(() => {
    const [stage, setStage] = useState(options.initial ?? emptyStage());
    const dispatch = useCallback(
      (command: StageCommand) => setStage((s) => applyCommand(s, command)),
      [],
    );
    const share = useScreenShare({
      session: fake.session as unknown as RealtimeSession,
      role: options.role ?? 'host',
      stage,
      ready: true,
      dispatch,
      newId,
    });
    return { stage, dispatch, share };
  });
  return { ...fake, hook };
}

describe('useScreenShare', () => {
  it('puts the screen on the stage when the host starts sharing', async () => {
    const { hook } = setup();
    await act(() => hook.result.current.share.start());
    expect(hook.result.current.share.sharing).toBe(true);
    expect(findScreen(hook.result.current.stage)?.data).toEqual({ title: 'Schermo', owner: 'host-1' });
  });

  it('takes the screen away when the browser stops sharing', async () => {
    const { hook, endNatively } = setup();
    await act(() => hook.result.current.share.start());
    act(() => endNatively());
    expect(hook.result.current.share.sharing).toBe(false);
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('stops from the dock button', async () => {
    const { hook, session } = setup();
    await act(() => hook.result.current.share.start());
    await act(async () => hook.result.current.share.stop());
    expect(session.stopScreenShare).toHaveBeenCalled();
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('says nothing when the host closes the picker', async () => {
    const { hook, session } = setup();
    session.startScreenShare.mockRejectedValueOnce(new ScreenShareCancelled());
    await act(() => hook.result.current.share.start());
    expect(hook.result.current.share.error).toBeNull();
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('shows an error for any other failure', async () => {
    const { hook, session } = setup();
    session.startScreenShare.mockRejectedValueOnce(new Error('NotReadableError'));
    await act(() => hook.result.current.share.start());
    expect(hook.result.current.share.error).toBe(SCREEN_SHARE_ERROR);
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('opens the picker once even if clicked twice', async () => {
    const { hook, session } = setup();
    await act(async () => {
      void hook.result.current.share.start();
      await hook.result.current.share.start();
    });
    expect(session.startScreenShare).toHaveBeenCalledTimes(1);
  });

  it('clears a screen left on the stage by a reload', () => {
    const left = screenStartCommands(emptyStage(), {
      owner: 'host-1',
      contentId: newId(),
      windowId: newId(),
    }).reduce(applyCommand, emptyStage());
    const { hook } = setup({ initial: left });
    expect(findScreen(hook.result.current.stage)).toBeNull();
  });

  it('stops sharing when the host closes the screen window by hand', async () => {
    const { hook, session } = setup();
    await act(() => hook.result.current.share.start());
    const windowId = hook.result.current.stage.focusedId!;
    act(() => hook.result.current.dispatch({ type: 'WINDOW_ARCHIVE', windowId }));
    expect(session.stopScreenShare).toHaveBeenCalled();
  });

  it('stops sharing when the screen could not enter the stage', async () => {
    const full: Stage = {
      ...emptyStage(),
      tray: Array.from({ length: 50 }, () => ({
        id: newId(),
        kind: 'text' as const,
        data: { title: 'x', body: '' },
      })),
    };
    const { hook, session } = setup({ initial: full });
    await act(() => hook.result.current.share.start());
    expect(session.stopScreenShare).toHaveBeenCalled();
    expect(hook.result.current.share.sharing).toBe(false);
    expect(hook.result.current.stage.windows).toEqual([]);
  });

  it('is not available to guests or where the browser cannot share', () => {
    expect(setup({ role: 'guest' }).hook.result.current.share.available).toBe(false);
    expect(setup({ canShare: false }).hook.result.current.share.available).toBe(false);
  });
});
```

- [ ] **Step 2: eseguire il test e vederlo fallire**

Run: `npx vitest run tests/unit/use-screen-share.test.tsx`
Atteso: FAIL, il modulo non esiste.

- [ ] **Step 3: implementare**

`apps/web/src/lib/stage/use-screen-share.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  findScreen,
  screenEndCommands,
  screenStartCommands,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import { ScreenShareCancelled, type RealtimeSession } from '@omnicanvas/realtime';

export const SCREEN_SHARE_ERROR = 'Non riesco a condividere lo schermo.';

type Options = {
  session: RealtimeSession | null;
  role: 'host' | 'guest';
  stage: Stage;
  ready: boolean;
  dispatch: (command: StageCommand) => void;
  newId?: () => string;
};

const randomId = () => crypto.randomUUID();

export function useScreenShare({ session, role, stage, ready, dispatch, newId = randomId }: Options) {
  // La sessione su cui si condivide: una sessione nuova (dopo una caduta) non condivide.
  const [sharedOn, setSharedOn] = useState<RealtimeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickingRef = useRef(false);
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const isHost = role === 'host';
  const sharing = session !== null && sharedOn === session;
  const available = isHost && session !== null && session.canShareScreen();

  useEffect(() => {
    if (!session || !isHost) return;
    return session.onScreenShareEnded(() =>
      setSharedOn((current) => (current === session ? null : current)),
    );
  }, [session, isHost]);

  // Invariante: lo schermo è sul palco se e solo se l'host condivide (spec §1).
  const onStage = findScreen(stage) !== null;
  useEffect(() => {
    if (!isHost || !ready) return;
    if (onStage && !sharing) screenEndCommands(stageRef.current).forEach(dispatch);
    if (!onStage && sharing) void session?.stopScreenShare().catch(() => {});
  }, [isHost, ready, onStage, sharing, session, dispatch]);

  const start = useCallback(async () => {
    if (!session || !isHost || sharing || pickingRef.current) return;
    pickingRef.current = true;
    setError(null);
    try {
      await session.startScreenShare();
    } catch (cause) {
      if (!(cause instanceof ScreenShareCancelled)) setError(SCREEN_SHARE_ERROR);
      return;
    } finally {
      pickingRef.current = false;
    }
    setSharedOn(session);
    screenStartCommands(stageRef.current, {
      owner: session.localIdentity,
      contentId: newId(),
      windowId: newId(),
    }).forEach(dispatch);
  }, [session, isHost, sharing, dispatch, newId]);

  const stop = useCallback(() => {
    void session?.stopScreenShare().catch(() => {});
  }, [session]);

  return { available, sharing, error, start, stop };
}
```

Nota sul `return` nel `catch` con `finally`: `pickingRef` torna `false` in ogni caso. Il `return` ferma l'avvio quando l'avvio fallisce.

- [ ] **Step 4: eseguire il test**

Run: `npx vitest run tests/unit/use-screen-share.test.tsx && npm run typecheck && npm run lint`
Atteso: PASS. Se il test «stops sharing when the screen could not enter the stage» fallisce perché `sharing` resta `true`, verifica che il fake `stopScreenShare` chiami gli handler di fine: è lui a simulare LiveKit.

- [ ] **Step 5: commit**

```bash
git add apps/web/src/lib/stage/use-screen-share.ts tests/unit/use-screen-share.test.tsx
git commit -m "feat(stage): screen share hook keeps the screen on stage only while sharing"
```

---

### Task 6: finestra, dock e banner

**Files:**
- Create: `apps/web/src/app/room/[code]/screen-view.tsx`
- Modify: `apps/web/src/app/room/[code]/content-view.tsx`, `apps/web/src/app/room/[code]/window-view.tsx`, `apps/web/src/app/room/[code]/stage-area.tsx`, `apps/web/src/app/room/[code]/room-call.tsx`
- Test: `tests/unit/screen-view.test.tsx`

**Interfaces:**
- Consumes: `useScreenShare` (Task 5), `RealtimeSession.attachScreen` (Task 4).
- Produces: `ScreenAttachContext`, `ScreenView({ owner, title })`.

- [ ] **Step 1: scrivere il test che fallisce**

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, emptyStage, screenStartCommands } from '@omnicanvas/canvas';
import { ScreenAttachContext, ScreenView } from '@/app/room/[code]/screen-view';
import { WindowView } from '@/app/room/[code]/window-view';

afterEach(cleanup);

describe('ScreenView', () => {
  it('attaches the owner screen and waits for the first frame', () => {
    const detach = vi.fn();
    const attach = vi.fn(() => detach);
    const { unmount } = render(
      <ScreenAttachContext.Provider value={attach}>
        <ScreenView owner="host-1" title="Schermo" />
      </ScreenAttachContext.Provider>,
    );
    expect(attach).toHaveBeenCalledWith('host-1', expect.any(HTMLVideoElement));
    expect(screen.getByText('Schermo in arrivo…')).toBeTruthy();
    fireEvent.loadedData(screen.getByLabelText('Schermo'));
    expect(screen.queryByText('Schermo in arrivo…')).toBeNull();
    unmount();
    expect(detach).toHaveBeenCalled();
  });

  it('shows the placeholder without a session', () => {
    render(<ScreenView owner="host-1" title="Schermo" />);
    expect(screen.getByText('Schermo in arrivo…')).toBeTruthy();
  });
});

describe('WindowView with the screen', () => {
  it('has no «Rimetti nel vassoio» for the screen', () => {
    const stage = screenStartCommands(emptyStage(), {
      owner: 'host-1',
      contentId: '00000000-0000-4000-8000-0000000000a1',
      windowId: '10000000-0000-4000-8000-0000000000a1',
    }).reduce(applyCommand, emptyStage());
    render(<WindowView window={stage.windows[0]!} assetUrls={{}} dispatch={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Rimetti nel vassoio' })).toBeNull();
  });
});
```

- [ ] **Step 2: eseguire il test e vederlo fallire**

Run: `npx vitest run tests/unit/screen-view.test.tsx`
Atteso: FAIL, il modulo `screen-view` non esiste.

- [ ] **Step 3: implementare**

`apps/web/src/app/room/[code]/screen-view.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Unsubscribe } from '@omnicanvas/realtime';

type AttachScreen = (identity: string, element: HTMLVideoElement) => Unsubscribe;

// Il palco non conosce la sessione: il context porta solo la funzione che aggancia il video.
export const ScreenAttachContext = createContext<AttachScreen | null>(null);

export function ScreenView({ owner, title }: { owner: string; title: string }) {
  const attach = useContext(ScreenAttachContext);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!attach || !video) return;
    return attach(owner, video);
  }, [attach, owner]);

  return (
    <figure className="relative flex flex-col gap-1">
      <video
        ref={videoRef}
        aria-label={title}
        autoPlay
        playsInline
        muted
        onLoadedData={() => setLive(true)}
        className="max-h-[60vh] w-full rounded-tile bg-bg object-contain"
      />
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center rounded-tile bg-bg text-sm text-muted">
          Schermo in arrivo…
        </div>
      )}
      <figcaption className="text-sm font-medium">{title}</figcaption>
    </figure>
  );
}
```

`content-view.tsx`: `import { ScreenView } from './screen-view';`, poi il caso:

```tsx
    case 'screen':
      return <ScreenView owner={content.data.owner} title={content.data.title} />;
```

`window-view.tsx`: la condizione del pulsante «Rimetti nel vassoio» diventa `{dispatch && content.kind !== 'screen' && (`. Commento sopra: `{/* Lo schermo si ferma dal dock: nel vassoio non ci va mai. */}`.

`stage-area.tsx`: avvolgi il contenuto restituito da `StageArea`, sia ramo ospite sia ramo host, ma non lo skeleton:

```tsx
import { ScreenAttachContext } from './screen-view';
...
export function StageArea(props: Props) {
  const { role, stage, ready, assetUrls, session } = props;
  if (!ready) return <StageSkeleton />;
  // Il metodo dell'oggetto sessione è stabile: niente funzioni nuove a ogni render, che
  // riaggancerebbero il video di continuo.
  const attachScreen = session?.attachScreen ?? null;
  return (
    <ScreenAttachContext.Provider value={attachScreen}>
      {role === 'guest' ? <GuestStage stage={stage} assetUrls={assetUrls} /> : <HostStage {...props} />}
    </ScreenAttachContext.Provider>
  );
}
```

Sposta il JSX del ramo ospite esistente, senza cambiarlo, in `function GuestStage({ stage, assetUrls }: { stage: Stage; assetUrls: Record<string, string> })`. L'oggetto sessione costruito in `connectToRoom` non usa `this` nei suoi metodi, quindi passare il metodo staccato è sicuro.

`room-call.tsx`:

```tsx
import { useScreenShare } from '@/lib/stage/use-screen-share';
...
  const stageApi = useStage({ joinCode, role, session, roster: state.roster });
  const screenShare = useScreenShare({
    session,
    role,
    stage: stageApi.stage,
    ready: stageApi.ready,
    dispatch: stageApi.dispatch,
  });
```

Banner, dopo quello di `state.mediaError`:

```tsx
          {screenShare.error && live && (
            <StatusBanner tone="error" live="alert">
              {screenShare.error}
            </StatusBanner>
          )}
```

Dock, dopo «Gira fotocamera»:

```tsx
          {screenShare.available && (
            <Button
              onClick={() => (screenShare.sharing ? screenShare.stop() : void screenShare.start())}
              aria-pressed={screenShare.sharing}
              disabled={!stageApi.ready}
            >
              {screenShare.sharing ? 'Interrompi condivisione' : 'Condividi schermo'}
            </Button>
          )}
```

- [ ] **Step 4: eseguire i test**

Run: `npx vitest run tests/unit && npm run typecheck && npm run lint`
Atteso: PASS. Controlla che `tests/unit/stage-polish.test.tsx` (che rende `StageArea`) passi ancora.

- [ ] **Step 5: commit**

```bash
git add apps/web/src/app/room/[code] tests/unit/screen-view.test.tsx
git commit -m "feat(call): share screen button, screen window and error banner"
```

---

### Task 7: e2e e documenti

**Files:**
- Create: `e2e/screen-share.spec.ts`
- Modify: `playwright.config.ts`, `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, `CLAUDE.md`

- [ ] **Step 1: scrivere l'e2e**

`playwright.config.ts`, negli `args`: aggiungi `'--auto-select-desktop-capture-source=Entire screen'`. Commento: `// Lo schermo condiviso: Chromium sceglie da solo senza aprire il selettore.`

`e2e/screen-share.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

test('the host shares the screen and the guest sees it on the stage', async ({ browser }, info) => {
  test.skip(info.project.name === 'mobile', "l'host non condivide da telefono");
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  const screenWindow = (page: typeof host) => page.getByRole('article', { name: 'Schermo' });

  await host.getByRole('button', { name: 'Condividi schermo' }).click();
  await expect(host.getByRole('button', { name: 'Interrompi condivisione' })).toBeVisible();
  await expect(screenWindow(guest)).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByText('Schermo in arrivo…')).toBeHidden({ timeout: 20_000 });

  await host.getByRole('button', { name: 'Interrompi condivisione' }).click();
  await expect(screenWindow(host)).toBeHidden();
  await expect(screenWindow(guest)).toBeHidden({ timeout: 20_000 });
});

test('a guest has no share button', async ({ browser }) => {
  const { roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(guest.getByRole('button', { name: 'Esci' })).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByRole('button', { name: 'Condividi schermo' })).toHaveCount(0);
});
```

Le finestre sono `article` con il titolo come nome: lo mostra `e2e/stage.spec.ts`.

- [ ] **Step 2: eseguire l'e2e**

Run (nel Codespace o in CI): `npm run test:e2e -- e2e/screen-share.spec.ts`
Atteso: PASS sul progetto `desktop`, saltato su `mobile`. Se Chromium headless non fornisce la sorgente schermo, il primo test fallisce con il banner «Non riesco a condividere lo schermo.». In quel caso aggiungi `'--use-fake-ui-for-media-stream'` (già presente) e `'--enable-usermedia-screen-capturing'`, e annota l'esito.

- [ ] **Step 3: documenti**

- `docs/ARCHITECTURE.md`, nella sezione del realtime: «Lo schermo condiviso è un contenuto `screen` del palco che porta solo l'identità di chi condivide. La traccia la pubblica solo l'host (grant per ruolo) e non entra mai nel pacchetto (ADR-0015).»
- `docs/BACKLOG.md`, sezione «ADVICES»: spunta i punti (1) «Gira fotocamera» su PC (PR #23) e (2) condivisione dello schermo, con il rimando alla spec.
- `CLAUDE.md`, «Stato attuale»: una frase sulla condivisione dello schermo su `slice/condivisione-schermo`, con spec e ADR-0015.

- [ ] **Step 4: verifica completa**

Run: `npm run typecheck && npm run lint && npx vitest run tests/unit && npm run build`
Atteso: tutto verde.

- [ ] **Step 5: commit**

```bash
git add e2e/screen-share.spec.ts playwright.config.ts docs/ARCHITECTURE.md docs/BACKLOG.md CLAUDE.md
git commit -m "test(e2e): host shares the screen, guest sees it; docs"
```

---

## Verifica manuale (Sean)

1. PC, Chrome: «Condividi schermo» → scegli una scheda → la finestra «Schermo» compare in primo piano, e un ospite su un altro dispositivo la vede.
2. Sposta la finestra in uno slot laterale, col mouse e col gesto: lo schermo continua.
3. Ferma dalla barra di Chrome «Interrompi condivisione»: la finestra sparisce per tutti.
4. Riavvia la condivisione e chiudi la finestra «Schermo» dal palco: la barra di Chrome sparisce.
5. Annulla il selettore: nessun messaggio.
6. Ricarica la pagina dell'host mentre condivide: dopo il caricamento la finestra non c'è.
7. Telefono come ospite: vede lo schermo, nessun pulsante di condivisione.
