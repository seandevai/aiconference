# Slice 3 — Palco: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'host costruisce un palco di finestre a slot magnetici (una grande, fino a
tre piccole) e ci porta contenuti dal vassoio col mouse. Gli ospiti vedono lo stesso
palco in tempo reale, anche se entrano tardi, si ricollegano o l'host ricarica la
pagina; da telefono seguono la finestra in primo piano e possono sbirciare le altre.
Le immagini passano da browser a browser, mai dal nostro storage.

**Architecture:** `packages/canvas` contiene modello, riduttore puro
`applyCommand(stage, command)`, schemi Zod, logica di sincronizzazione a scrittore
unico, formato dei pacchetti immagine e contenuti di prova: niente React, niente
vendor. L'host è l'unico scrittore: applica il comando, incrementa `version`, lo invia
sul canale `stage`. Gli ospiti applicano lo stesso comando; se vedono un buco di
versione chiedono all'host uno snapshot (`stage-sync` → `stage-snapshot` in byte).
L'host salva lo snapshot in KV tramite `POST /room/[code]/stage` (solo host, verificato
dal server); chi entra tardi o l'host che ricarica partono da `GET`. I byte delle
immagini viaggiano sul topic `asset` e restano in memoria.

**Tech Stack:** Zod 4.6, `@upstash/redis` 1.39, in locale Redis 7 con
`hiett/serverless-redis-http:0.0.10` (stessa API REST di Upstash), React 19 con
drag & drop HTML5, Vitest, Playwright.

**Spec:** `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (§2.2 palco, §2.5 mobile,
§4.3 piani di stato, §4.4 modello del palco, §8 slice 3). Leggere anche
`docs/adr/0009-palco-a-finestre.md`, `docs/ARCHITECTURE.md` §2-3 e `docs/DATA-MODEL.md`
«Stato effimero».

## Global Constraints

- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Nessun `any` senza commento.
- `packages/canvas` non importa React, LiveKit, Next o Supabase: riceve comandi e non sa da dove arrivano (mouse, gesto o agente).
- Il riduttore è puro: non muta l'input e restituisce **lo stesso oggetto** quando il comando non cambia nulla. Il livello di sincronizzazione usa questa identità per non incrementare `version`.
- Un solo scrittore: l'host. Un ospite non invia mai comandi di palco; chi riceve accetta messaggi di palco solo dall'identità con ruolo `host` nel roster (attributo firmato dal server).
- Tutto ciò che arriva dalla rete (DataChannel, byte, corpo della route) passa da uno schema Zod prima di toccare lo stato. Un messaggio non valido si ignora senza eccezioni.
- Stato di palco solo in memoria, DataChannel e KV con TTL. Mai in Postgres, mai nei log. I byte delle immagini mai in KV né su storage.
- Ogni comando del palco ha un bottone o un menu, oltre al drag & drop (regola 6).
- Nessun segreto sotto `NEXT_PUBLIC_`. `KV_REST_API_TOKEN` solo server.
- Variabile d'ambiente nuova → `docs/ENVIRONMENT.md` e `.env.example` nello stesso commit.
- Identificatori e commit in inglese; commenti e testi UI in italiano. Commit `<tipo>(<ambito>): <cosa>`, ambiti `canvas`, `web`, `ci`.
- Branch `slice/3-palco` da `slice/2-call`. Test DB ed e2e girano nel Codespace e in CI.

## Review Focus

1. Comando di palco inviato da un ospite (o da chiunque non sia l'host del roster) → ignorato dagli altri. Test nel task 3.6 (logica di accettazione) ed e2e 3.8.
2. Ospite che riceve la versione N+2 senza la N+1 → chiede lo snapshot e si riallinea, non applica comandi fuori ordine. Test nel task 3.4.
3. L'host ricarica la pagina a metà riunione → riparte dallo snapshot in KV, gli ospiti si riallineano e i comandi successivi continuano la numerazione. E2E nel task 3.8.
4. Snapshot malformato o gigante verso la route → 400/413, niente scrittura in KV; un ospite che prova a scrivere → 403. Test nel task 3.5.
5. Contenuto con testo lungo o tabella enorme → rifiutato dallo schema prima di entrare nel palco, così un comando resta sotto i 15 KB del DataChannel. Test nel task 3.3.

## Mappa dei file

```
packages/canvas/
  package.json, tsconfig.json         nuovo
  src/types.ts                        Slot, Content, StageWindow, Stage, StageCommand
  src/reducer.ts                      emptyStage(), applyCommand(), orderedWindows()
  src/schema.ts                       contentSchema, stageSchema, parseStage(), parseStageMessage()
  src/samples.ts                      sampleContent(): contenuti di prova
  src/sync.ts                         writeCommand(), followMessage()
  src/assets.ts                       packAsset(), unpackAsset(), imageAssetIds()
  src/slots.ts                        nearestSlot()
  src/index.ts
apps/web/
  package.json, next.config.ts        modifica: @omnicanvas/canvas, @upstash/redis
  src/env-schema.ts, src/env.ts       modifica: KV
  src/lib/kv/kv.ts                    createKv(), KvLike
  src/lib/stage/snapshot-store.ts     loadStage(), saveStage()
  src/lib/stage/stage-access.ts       readStage(), writeStage()
  src/lib/stage/peek.ts               peekNeighbor()
  src/lib/stage/sample-image.ts       sampleImage()
  src/lib/stage/use-stage.ts          hook: scrittore/lettore, KV, immagini
  src/lib/call/use-call.ts            modifica: espone la sessione
  src/app/room/[code]/stage/route.ts  GET e POST dello snapshot
  src/app/room/[code]/stage-area.tsx  host: barra, palco, vassoio; ospite: palco o mobile
  src/app/room/[code]/stage-board.tsx palco a slot, drag & drop
  src/app/room/[code]/window-view.tsx una finestra
  src/app/room/[code]/content-view.tsx grafico, testo, tabella, immagine
  src/app/room/[code]/tray.tsx        vassoio e contenuti di prova
  src/app/room/[code]/mobile-stage.tsx vista mobile A
  src/app/room/[code]/room-call.tsx   modifica: monta StageArea
.devcontainer/start-services.sh       modifica: Redis + SRH
.github/workflows/ci.yml              modifica: Redis + SRH nel job e2e, env di build
e2e/helpers.ts                        modifica: opzioni del contesto ospite
e2e/stage.spec.ts                     nuovo
tests/unit/stage-reducer.test.ts, stage-schema.test.ts, stage-sync.test.ts,
  stage-assets.test.ts, stage-slots.test.ts, snapshot-store.test.ts, stage-peek.test.ts   nuovi
tests/unit/env.test.ts, devcontainer.test.ts   modifica
tests/db/stage-access.test.ts         nuovo
docs/ARCHITECTURE.md, ENVIRONMENT.md, BACKLOG.md, CLAUDE.md   modifica
```

---

### Task 3.1: KV — variabili e Redis locale con API Upstash

**Files:**
- Modify: `apps/web/src/env-schema.ts`, `apps/web/src/env.ts`, `tests/unit/env.test.ts`
- Modify: `.devcontainer/start-services.sh`, `tests/unit/devcontainer.test.ts`
- Modify: `.github/workflows/ci.yml`, `docs/ENVIRONMENT.md`

**Interfaces:**
- Produces: `ServerEnv.KV_REST_API_URL: string` (URL), `ServerEnv.KV_REST_API_TOKEN: string`. In locale: `http://localhost:8079`, token `local_kv_token`.

- [ ] **Step 1: branch**

```bash
git checkout slice/2-call
git checkout -b slice/3-palco
```

- [ ] **Step 2: test che falliscono**

In `tests/unit/env.test.ts` aggiungi a `serverOk`:

```ts
  KV_REST_API_URL: 'http://localhost:8079',
  KV_REST_API_TOKEN: 'local_kv_token',
```

e in fondo al `describe`:

```ts
  it('names a missing kv token', () => {
    const { KV_REST_API_TOKEN: _omitted, ...incomplete } = serverOk;
    expect(() => parseServerEnv(incomplete)).toThrow(/KV_REST_API_TOKEN/);
  });

  it('rejects a kv url that is not a url', () => {
    expect(() => parseServerEnv({ ...serverOk, KV_REST_API_URL: 'localhost' })).toThrow(
      /KV_REST_API_URL/,
    );
  });
```

In `tests/unit/devcontainer.test.ts` aggiungi:

```ts
  it('starts a local Upstash-compatible KV', () => {
    const script = read('.devcontainer/start-services.sh');
    expect(script).toContain('redis:7-alpine');
    expect(script).toContain('hiett/serverless-redis-http:0.0.10');
    expect(script).toContain('ensure KV_REST_API_URL');
    expect(script).toContain('ensure KV_REST_API_TOKEN');
  });
```

Run: `npx vitest run tests/unit/env.test.ts tests/unit/devcontainer.test.ts`
Expected: FAIL sui tre test nuovi.

- [ ] **Step 3: schema**

In `apps/web/src/env-schema.ts`, dentro `serverSchema`:

```ts
  // Stato di sessione (snapshot del palco). In locale: Redis + serverless-redis-http.
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().min(1),
```

In `apps/web/src/env.ts`, dentro `parseServerEnv({ … })`:

```ts
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
```

- [ ] **Step 4: script dei servizi**

In `.devcontainer/start-services.sh`, dopo il blocco di LiveKit:

```bash
# KV con la stessa API REST di Upstash: Redis più serverless-redis-http.
docker network inspect kv >/dev/null 2>&1 || docker network create kv >/dev/null
if ! docker ps --format '{{.Names}}' | grep -qx kv-srh; then
  docker rm -f kv-redis kv-srh >/dev/null 2>&1 || true
  docker run -d --name kv-redis --network kv redis:7-alpine
  docker run -d --name kv-srh --network kv -p 8079:80 \
    -e SRH_MODE=env -e SRH_TOKEN=local_kv_token \
    -e SRH_CONNECTION_STRING=redis://kv-redis:6379 \
    hiett/serverless-redis-http:0.0.10
fi
```

e in fondo:

```bash
ensure KV_REST_API_URL "http://localhost:8079"
ensure KV_REST_API_TOKEN local_kv_token
```

- [ ] **Step 5: verifica**

Run: `npx vitest run tests/unit/env.test.ts tests/unit/devcontainer.test.ts`
Expected: PASS.

- [ ] **Step 6: CI**

In `.github/workflows/ci.yml`, step `Build app`, `env`:

```yaml
          KV_REST_API_URL: http://127.0.0.1:8079
          KV_REST_API_TOKEN: dummy
```

Nel job `e2e`, dopo `Start LiveKit`:

```yaml
      - name: Start KV
        run: |
          docker network create kv
          docker run -d --name kv-redis --network kv redis:7-alpine
          docker run -d --name kv-srh --network kv -p 8079:80 \
            -e SRH_MODE=env -e SRH_TOKEN=local_kv_token \
            -e SRH_CONNECTION_STRING=redis://kv-redis:6379 \
            hiett/serverless-redis-http:0.0.10
```

e in `Write .env.local`:

```bash
            echo "KV_REST_API_URL=http://localhost:8079"
            echo "KV_REST_API_TOKEN=local_kv_token"
```

- [ ] **Step 7: documentazione e commit**

In `docs/ENVIRONMENT.md`, dopo il paragrafo su LiveKit locale:

```markdown
KV in locale (Codespace e CI): Redis 7 dietro `serverless-redis-http`, che espone la
stessa API REST di Upstash. URL `http://localhost:8079`, token `local_kv_token`.
```

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: verde. Nel Codespace: `bash .devcontainer/start-services.sh` e
`curl -s -H "Authorization: Bearer local_kv_token" -H "Content-Type: application/json" -X POST localhost:8079 -d '["PING"]'` → `{"result":"PONG"}`.

```bash
git add apps/web/src/env-schema.ts apps/web/src/env.ts tests/unit .devcontainer .github/workflows/ci.yml docs/ENVIRONMENT.md
git commit -m "feat(web): kv env and local upstash-compatible redis in codespace and ci"
```

---

### Task 3.2: `packages/canvas` — modello e riduttore

**Files:**
- Create: `packages/canvas/package.json`, `packages/canvas/tsconfig.json`, `packages/canvas/src/types.ts`, `packages/canvas/src/reducer.ts`, `packages/canvas/src/index.ts`
- Delete: `packages/canvas/README.md`
- Modify: `apps/web/package.json`, `apps/web/next.config.ts`
- Test: `tests/unit/stage-reducer.test.ts`

**Interfaces:**
- Produces:
  - `SLOTS = ['main', 'side-1', 'side-2', 'side-3']`, `type Slot`
  - `type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp'`
  - `type Content` (unione su `kind`: `chart` `{ title; labels; values }`, `text` `{ title; body }`, `table` `{ title; columns; rows }`, `image` `{ title; assetId; mime; alt }`; campo opzionale `archived?: boolean`)
  - `type StageWindow = { id; title; slot: Slot; contents: Content[] }`
  - `type Stage = { windows: StageWindow[]; focusedId: string | null; tray: Content[]; negotiation: null; version: number }`
  - `type StageCommand` = `TRAY_ADD {content}` · `WINDOW_CREATE {windowId, title}` · `WINDOW_ARCHIVE {windowId}` · `WINDOW_MOVE {windowId, slot}` · `FOCUS {windowId}` · `FOCUS_NEXT` · `FOCUS_PREV` · `CONTENT_PLACE {contentId, windowId}` · `CONTENT_REMOVE {contentId}`
  - `MAX_WINDOWS = 4`, `MAX_TRAY = 50`, `MAX_CONTENTS_PER_WINDOW = 12`
  - `emptyStage(): Stage`, `applyCommand(stage, command): Stage`, `orderedWindows(stage): StageWindow[]`

`negotiation` resta `null` fino alla slice 7, che ne allarga il tipo.

- [ ] **Step 1: pacchetto**

`packages/canvas/package.json`:

```json
{
  "name": "@omnicanvas/canvas",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^4.6.5" }
}
```

`packages/canvas/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`packages/canvas/src/types.ts`:

```ts
// Modello del palco (spec §4.4, ADR-0009). Nessuna dipendenza da React o dalla rete.

export const SLOTS = ['main', 'side-1', 'side-2', 'side-3'] as const;
export type Slot = (typeof SLOTS)[number];

export const MAX_WINDOWS = 4;
export const MAX_TRAY = 50;
export const MAX_CONTENTS_PER_WINDOW = 12;

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export type ChartData = { title: string; labels: string[]; values: number[] };
export type TextData = { title: string; body: string };
export type TableData = { title: string; columns: string[]; rows: string[][] };
// Solo il riferimento: i byte viaggiano peer to peer e restano in memoria.
export type ImageRef = { title: string; assetId: string; mime: ImageMime; alt: string };

export type Content =
  | { id: string; kind: 'chart'; data: ChartData; archived?: boolean }
  | { id: string; kind: 'text'; data: TextData; archived?: boolean }
  | { id: string; kind: 'table'; data: TableData; archived?: boolean }
  | { id: string; kind: 'image'; data: ImageRef; archived?: boolean };

export type StageWindow = { id: string; title: string; slot: Slot; contents: Content[] };

export type Stage = {
  windows: StageWindow[];
  // Sempre la finestra nello slot 'main', o null se il palco è vuoto.
  focusedId: string | null;
  tray: Content[];
  negotiation: null;
  version: number;
};

export type StageCommand =
  | { type: 'TRAY_ADD'; content: Content }
  | { type: 'WINDOW_CREATE'; windowId: string; title: string }
  | { type: 'WINDOW_ARCHIVE'; windowId: string }
  | { type: 'WINDOW_MOVE'; windowId: string; slot: Slot }
  | { type: 'FOCUS'; windowId: string }
  | { type: 'FOCUS_NEXT' }
  | { type: 'FOCUS_PREV' }
  | { type: 'CONTENT_PLACE'; contentId: string; windowId: string }
  | { type: 'CONTENT_REMOVE'; contentId: string };
```

```bash
git rm packages/canvas/README.md
```

- [ ] **Step 2: test che falliscono**

`tests/unit/stage-reducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENTS_PER_WINDOW,
  applyCommand,
  emptyStage,
  orderedWindows,
  type Content,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';

const text = (id: string, title = 'Nota'): Content => ({
  id,
  kind: 'text',
  data: { title, body: 'corpo' },
});

function run(commands: StageCommand[], from: Stage = emptyStage()): Stage {
  return commands.reduce(applyCommand, from);
}

const threeWindows = run([
  { type: 'WINDOW_CREATE', windowId: 'A', title: 'A' },
  { type: 'WINDOW_CREATE', windowId: 'B', title: 'B' },
  { type: 'WINDOW_CREATE', windowId: 'C', title: 'C' },
]);

const slotOf = (stage: Stage, id: string) => stage.windows.find((w) => w.id === id)?.slot;

describe('applyCommand', () => {
  it('adds content to the tray once', () => {
    const once = applyCommand(emptyStage(), { type: 'TRAY_ADD', content: text('t1') });
    expect(once.tray.map((c) => c.id)).toEqual(['t1']);
    expect(applyCommand(once, { type: 'TRAY_ADD', content: text('t1') })).toBe(once);
  });

  it('puts the first window in main and the next ones at the side', () => {
    expect(threeWindows.windows.map((w) => [w.id, w.slot])).toEqual([
      ['A', 'main'],
      ['B', 'side-1'],
      ['C', 'side-2'],
    ]);
    expect(threeWindows.focusedId).toBe('A');
  });

  it('refuses a fifth window and duplicate ids', () => {
    const four = applyCommand(threeWindows, { type: 'WINDOW_CREATE', windowId: 'D', title: 'D' });
    expect(four.windows).toHaveLength(4);
    expect(applyCommand(four, { type: 'WINDOW_CREATE', windowId: 'E', title: 'E' })).toBe(four);
    expect(applyCommand(four, { type: 'WINDOW_CREATE', windowId: 'A', title: 'A2' })).toBe(four);
  });

  it('swaps windows when moving onto an occupied slot', () => {
    const moved = applyCommand(threeWindows, { type: 'WINDOW_MOVE', windowId: 'C', slot: 'main' });
    expect(slotOf(moved, 'C')).toBe('main');
    expect(slotOf(moved, 'A')).toBe('side-2');
    expect(moved.focusedId).toBe('C');
  });

  it('moves to an empty slot without touching the others', () => {
    const moved = applyCommand(threeWindows, { type: 'WINDOW_MOVE', windowId: 'B', slot: 'side-3' });
    expect(slotOf(moved, 'B')).toBe('side-3');
    expect(slotOf(moved, 'A')).toBe('main');
  });

  it('focuses a side window by swapping it with main', () => {
    const focused = applyCommand(threeWindows, { type: 'FOCUS', windowId: 'B' });
    expect(focused.focusedId).toBe('B');
    expect(slotOf(focused, 'A')).toBe('side-1');
    expect(applyCommand(focused, { type: 'FOCUS', windowId: 'B' })).toBe(focused);
  });

  it('rotates focus forward and backward', () => {
    const next = applyCommand(threeWindows, { type: 'FOCUS_NEXT' });
    expect(orderedWindows(next).map((w) => w.id)).toEqual(['B', 'C', 'A']);
    const prev = applyCommand(threeWindows, { type: 'FOCUS_PREV' });
    expect(orderedWindows(prev).map((w) => w.id)).toEqual(['C', 'A', 'B']);
    const single = run([{ type: 'WINDOW_CREATE', windowId: 'A', title: 'A' }]);
    expect(applyCommand(single, { type: 'FOCUS_NEXT' })).toBe(single);
  });

  it('places content from the tray into a window, clearing the archived flag', () => {
    const stage = run(
      [{ type: 'TRAY_ADD', content: { ...text('t1'), archived: true } }, { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' }],
      threeWindows,
    );
    expect(stage.tray).toEqual([]);
    expect(stage.windows.find((w) => w.id === 'A')?.contents).toEqual([text('t1')]);
  });

  it('moves content between windows', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: text('t1') },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'B' },
      ],
      threeWindows,
    );
    expect(stage.windows.find((w) => w.id === 'A')?.contents).toEqual([]);
    expect(stage.windows.find((w) => w.id === 'B')?.contents.map((c) => c.id)).toEqual(['t1']);
  });

  it('ignores placing into a full window or an unknown target', () => {
    const fill: StageCommand[] = Array.from({ length: MAX_CONTENTS_PER_WINDOW }, (_, i) => [
      { type: 'TRAY_ADD', content: text(`c${i}`) } as const,
      { type: 'CONTENT_PLACE', contentId: `c${i}`, windowId: 'A' } as const,
    ]).flat();
    const full = run([...fill, { type: 'TRAY_ADD', content: text('extra') }], threeWindows);
    expect(applyCommand(full, { type: 'CONTENT_PLACE', contentId: 'extra', windowId: 'A' })).toBe(full);
    expect(applyCommand(full, { type: 'CONTENT_PLACE', contentId: 'extra', windowId: 'Z' })).toBe(full);
    expect(applyCommand(full, { type: 'CONTENT_PLACE', contentId: 'nope', windowId: 'B' })).toBe(full);
  });

  it('sends removed content back to the tray as archived', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: text('t1') },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' },
        { type: 'CONTENT_REMOVE', contentId: 't1' },
      ],
      threeWindows,
    );
    expect(stage.tray).toEqual([{ ...text('t1'), archived: true }]);
  });

  it('archives the main window, promoting the first side window', () => {
    const stage = run(
      [
        { type: 'TRAY_ADD', content: text('t1') },
        { type: 'CONTENT_PLACE', contentId: 't1', windowId: 'A' },
        { type: 'WINDOW_ARCHIVE', windowId: 'A' },
      ],
      threeWindows,
    );
    expect(stage.windows.map((w) => [w.id, w.slot])).toEqual([
      ['B', 'main'],
      ['C', 'side-2'],
    ]);
    expect(stage.focusedId).toBe('B');
    expect(stage.tray).toEqual([{ ...text('t1'), archived: true }]);
  });

  it('empties focus when the last window is archived', () => {
    const one = run([{ type: 'WINDOW_CREATE', windowId: 'A', title: 'A' }]);
    expect(applyCommand(one, { type: 'WINDOW_ARCHIVE', windowId: 'A' }).focusedId).toBeNull();
  });

  it('never mutates its input', () => {
    const before = structuredClone(threeWindows);
    run([{ type: 'FOCUS_NEXT' }, { type: 'WINDOW_ARCHIVE', windowId: 'B' }], threeWindows);
    expect(threeWindows).toEqual(before);
  });
});
```

Run: `npx vitest run tests/unit/stage-reducer.test.ts`
Expected: FAIL, `@omnicanvas/canvas` non risolto.

- [ ] **Step 3: riduttore**

`packages/canvas/src/reducer.ts`:

```ts
import {
  MAX_CONTENTS_PER_WINDOW,
  MAX_TRAY,
  MAX_WINDOWS,
  SLOTS,
  type Content,
  type Slot,
  type Stage,
  type StageCommand,
  type StageWindow,
} from './types';

export function emptyStage(): Stage {
  return { windows: [], focusedId: null, tray: [], negotiation: null, version: 0 };
}

const slotIndex = (slot: Slot) => SLOTS.indexOf(slot);

export function orderedWindows(stage: Stage): StageWindow[] {
  return [...stage.windows].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot));
}

// focusedId è sempre la finestra nello slot 'main': lo ricalcoliamo a ogni cambio.
function withWindows(stage: Stage, windows: StageWindow[]): Stage {
  return { ...stage, windows, focusedId: windows.find((w) => w.slot === 'main')?.id ?? null };
}

function unarchive(content: Content): Content {
  if (!content.archived) return content;
  const copy = { ...content };
  delete copy.archived;
  return copy;
}

function containsContent(stage: Stage, contentId: string): boolean {
  return (
    stage.tray.some((c) => c.id === contentId) ||
    stage.windows.some((w) => w.contents.some((c) => c.id === contentId))
  );
}

function moveWindow(stage: Stage, windowId: string, slot: Slot): Stage {
  const target = stage.windows.find((w) => w.id === windowId);
  if (!target || target.slot === slot) return stage;
  const occupant = stage.windows.find((w) => w.slot === slot);
  return withWindows(
    stage,
    stage.windows.map((w) =>
      w === target ? { ...w, slot } : w === occupant ? { ...w, slot: target.slot } : w,
    ),
  );
}

function rotate(stage: Stage, shift: 1 | -1): Stage {
  const ordered = orderedWindows(stage);
  if (ordered.length < 2) return stage;
  const slots = ordered.map((w) => w.slot);
  const n = ordered.length;
  const nextSlot = new Map(ordered.map((w, k) => [w.id, slots[(k - shift + n) % n]!]));
  return withWindows(
    stage,
    stage.windows.map((w) => ({ ...w, slot: nextSlot.get(w.id) ?? w.slot })),
  );
}

export function applyCommand(stage: Stage, command: StageCommand): Stage {
  switch (command.type) {
    case 'TRAY_ADD': {
      if (stage.tray.length >= MAX_TRAY || containsContent(stage, command.content.id)) return stage;
      return { ...stage, tray: [...stage.tray, command.content] };
    }

    case 'WINDOW_CREATE': {
      if (stage.windows.length >= MAX_WINDOWS) return stage;
      if (stage.windows.some((w) => w.id === command.windowId)) return stage;
      const free = SLOTS.find((slot) => !stage.windows.some((w) => w.slot === slot));
      if (!free) return stage;
      return withWindows(stage, [
        ...stage.windows,
        { id: command.windowId, title: command.title, slot: free, contents: [] },
      ]);
    }

    case 'WINDOW_ARCHIVE': {
      const target = stage.windows.find((w) => w.id === command.windowId);
      if (!target) return stage;
      let windows = stage.windows.filter((w) => w !== target);
      if (target.slot === 'main' && windows.length > 0) {
        const promoted = [...windows].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot))[0]!;
        windows = windows.map((w) => (w === promoted ? { ...w, slot: 'main' as const } : w));
      }
      const archived = target.contents.map((c) => ({ ...c, archived: true }));
      return withWindows({ ...stage, tray: [...stage.tray, ...archived] }, windows);
    }

    case 'WINDOW_MOVE':
      return moveWindow(stage, command.windowId, command.slot);

    case 'FOCUS':
      return moveWindow(stage, command.windowId, 'main');

    case 'FOCUS_NEXT':
      return rotate(stage, 1);

    case 'FOCUS_PREV':
      return rotate(stage, -1);

    case 'CONTENT_PLACE': {
      const target = stage.windows.find((w) => w.id === command.windowId);
      if (!target || target.contents.some((c) => c.id === command.contentId)) return stage;
      if (target.contents.length >= MAX_CONTENTS_PER_WINDOW) return stage;
      const fromTray = stage.tray.find((c) => c.id === command.contentId);
      const fromWindow = stage.windows
        .flatMap((w) => w.contents)
        .find((c) => c.id === command.contentId);
      const content = fromTray ?? fromWindow;
      if (!content) return stage;
      const placed = unarchive(content);
      return withWindows(
        { ...stage, tray: stage.tray.filter((c) => c.id !== command.contentId) },
        stage.windows.map((w) =>
          w === target
            ? { ...w, contents: [...w.contents, placed] }
            : { ...w, contents: w.contents.filter((c) => c.id !== command.contentId) },
        ),
      );
    }

    case 'CONTENT_REMOVE': {
      const content = stage.windows.flatMap((w) => w.contents).find((c) => c.id === command.contentId);
      if (!content) return stage;
      return withWindows(
        { ...stage, tray: [...stage.tray, { ...content, archived: true }] },
        stage.windows.map((w) => ({
          ...w,
          contents: w.contents.filter((c) => c.id !== command.contentId),
        })),
      );
    }
  }
}
```

`packages/canvas/src/index.ts`:

```ts
export * from './types';
export { applyCommand, emptyStage, orderedWindows } from './reducer';
```

Run: `npm install`, poi `npx vitest run tests/unit/stage-reducer.test.ts`
Expected: PASS (14 test).

- [ ] **Step 4: collega l'app e commit**

In `apps/web/package.json`, `dependencies`: `"@omnicanvas/canvas": "^0.0.0"`. In
`apps/web/next.config.ts`: `transpilePackages: ["@omnicanvas/realtime", "@omnicanvas/canvas"]`.
Poi `npm install`.

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: verde.

```bash
git add -A packages/canvas apps/web/package.json apps/web/next.config.ts package-lock.json tests/unit/stage-reducer.test.ts
git commit -m "feat(canvas): stage model and pure reducer with magnetic slots"
```

---

### Task 3.3: Schemi e contenuti di prova

**Files:**
- Create: `packages/canvas/src/schema.ts`, `packages/canvas/src/samples.ts`
- Modify: `packages/canvas/src/index.ts`
- Test: `tests/unit/stage-schema.test.ts`

**Interfaces:**
- Consumes: tipi del task 3.2.
- Produces:
  - `LIMITS = { title: 80, body: 3000, labels: 24, label: 40, columns: 10, rows: 30, cell: 200, alt: 200 }`
  - `contentSchema`, `commandSchema`, `stageSchema`, `stageMessageSchema` (Zod)
  - `type StageMessage = { type: 'command'; version: number; command: StageCommand } | { type: 'snapshot'; stage: Stage }`
  - `parseStage(value: unknown): Stage | null`, `parseStageMessage(value: unknown): StageMessage | null`
  - `sampleContent(kind: 'chart' | 'text' | 'table', id: string): Content`

- [ ] **Step 1: test che falliscono**

`tests/unit/stage-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  applyCommand,
  emptyStage,
  parseStage,
  parseStageMessage,
  sampleContent,
} from '@omnicanvas/canvas';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('stage schemas', () => {
  it('accepts a command message with a valid content', () => {
    const message = {
      type: 'command',
      version: 1,
      command: { type: 'TRAY_ADD', content: sampleContent('text', id(1)) },
    };
    expect(parseStageMessage(message)).toEqual(message);
  });

  it('accepts every sample content', () => {
    for (const kind of ['chart', 'text', 'table'] as const) {
      const message = { type: 'command', version: 1, command: { type: 'TRAY_ADD', content: sampleContent(kind, id(2)) } };
      expect(parseStageMessage(message)).not.toBeNull();
    }
  });

  it('rejects unknown commands and kinds', () => {
    expect(parseStageMessage({ type: 'command', version: 1, command: { type: 'DELETE_ALL' } })).toBeNull();
    expect(
      parseStageMessage({
        type: 'command',
        version: 1,
        command: { type: 'TRAY_ADD', content: { id: id(3), kind: 'video', data: {} } },
      }),
    ).toBeNull();
  });

  it('rejects content that would not fit a data message', () => {
    const long = { ...sampleContent('text', id(4)), data: { title: 'x', body: 'y'.repeat(LIMITS.body + 1) } };
    expect(parseStageMessage({ type: 'command', version: 1, command: { type: 'TRAY_ADD', content: long } })).toBeNull();
    const table = sampleContent('table', id(5));
    const huge = { ...table, data: { ...table.data, rows: Array.from({ length: LIMITS.rows + 1 }, () => ['a', 'b']) } };
    expect(parseStageMessage({ type: 'command', version: 1, command: { type: 'TRAY_ADD', content: huge } })).toBeNull();
  });

  it('rejects ids that are not uuids and non-finite chart values', () => {
    expect(parseStageMessage({ type: 'command', version: 1, command: { type: 'FOCUS', windowId: 'x' } })).toBeNull();
    const chart = sampleContent('chart', id(6));
    const bad = { ...chart, data: { ...chart.data, values: [1, Number.NaN, 3, 4] } };
    expect(parseStageMessage({ type: 'command', version: 1, command: { type: 'TRAY_ADD', content: bad } })).toBeNull();
  });

  it('round-trips a stage and rejects two windows in the same slot', () => {
    const stage = [
      { type: 'WINDOW_CREATE', windowId: id(10), title: 'Finestra 1' } as const,
      { type: 'TRAY_ADD', content: sampleContent('chart', id(11)) } as const,
    ].reduce(applyCommand, emptyStage());
    expect(parseStage(stage)).toEqual(stage);
    const clash = {
      ...stage,
      windows: [
        ...stage.windows,
        { id: id(12), title: 'Finestra 2', slot: 'main', contents: [] },
      ],
    };
    expect(parseStage(clash)).toBeNull();
    expect(parseStage('not a stage')).toBeNull();
  });
});
```

Run: `npx vitest run tests/unit/stage-schema.test.ts`
Expected: FAIL, `LIMITS`/`parseStage` non esportati.

- [ ] **Step 2: schemi**

`packages/canvas/src/schema.ts`:

```ts
import { z } from 'zod';
import { MAX_CONTENTS_PER_WINDOW, MAX_WINDOWS, SLOTS, type Stage, type StageCommand } from './types';

// Limiti scelti perché un comando TRAY_ADD resti sotto i 15 KB del DataChannel.
export const LIMITS = {
  title: 80,
  body: 3000,
  labels: 24,
  label: 40,
  columns: 10,
  rows: 30,
  cell: 200,
  alt: 200,
} as const;

// Il vassoio può superare MAX_TRAY con gli archiviati: il tetto qui è più largo.
const MAX_TRAY_IN_SNAPSHOT = 100;

const id = z.uuid();
const title = z.string().min(1).max(LIMITS.title);
const slot = z.enum(SLOTS);
const archived = z.boolean().optional();

export const contentSchema = z.discriminatedUnion('kind', [
  z.object({
    id,
    kind: z.literal('chart'),
    archived,
    data: z
      .object({
        title,
        labels: z.array(z.string().max(LIMITS.label)).max(LIMITS.labels),
        values: z.array(z.number()).max(LIMITS.labels),
      })
      .refine((d) => d.labels.length === d.values.length, 'labels and values differ in length'),
  }),
  z.object({
    id,
    kind: z.literal('text'),
    archived,
    data: z.object({ title, body: z.string().max(LIMITS.body) }),
  }),
  z.object({
    id,
    kind: z.literal('table'),
    archived,
    data: z.object({
      title,
      columns: z.array(z.string().max(LIMITS.cell)).min(1).max(LIMITS.columns),
      rows: z
        .array(z.array(z.string().max(LIMITS.cell)).max(LIMITS.columns))
        .max(LIMITS.rows),
    }),
  }),
  z.object({
    id,
    kind: z.literal('image'),
    archived,
    data: z.object({
      title,
      assetId: id,
      mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
      alt: z.string().max(LIMITS.alt),
    }),
  }),
]);

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TRAY_ADD'), content: contentSchema }),
  z.object({ type: z.literal('WINDOW_CREATE'), windowId: id, title }),
  z.object({ type: z.literal('WINDOW_ARCHIVE'), windowId: id }),
  z.object({ type: z.literal('WINDOW_MOVE'), windowId: id, slot }),
  z.object({ type: z.literal('FOCUS'), windowId: id }),
  z.object({ type: z.literal('FOCUS_NEXT') }),
  z.object({ type: z.literal('FOCUS_PREV') }),
  z.object({ type: z.literal('CONTENT_PLACE'), contentId: id, windowId: id }),
  z.object({ type: z.literal('CONTENT_REMOVE'), contentId: id }),
]);

export const stageSchema = z
  .object({
    windows: z
      .array(
        z.object({
          id,
          title,
          slot,
          contents: z.array(contentSchema).max(MAX_CONTENTS_PER_WINDOW),
        }),
      )
      .max(MAX_WINDOWS),
    focusedId: id.nullable(),
    tray: z.array(contentSchema).max(MAX_TRAY_IN_SNAPSHOT),
    negotiation: z.null(),
    version: z.number().int().min(0),
  })
  .refine((s) => new Set(s.windows.map((w) => w.slot)).size === s.windows.length, 'slot clash');

export const stageMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('command'), version: z.number().int().min(1), command: commandSchema }),
  z.object({ type: z.literal('snapshot'), stage: stageSchema }),
]);

export type StageMessage =
  | { type: 'command'; version: number; command: StageCommand }
  | { type: 'snapshot'; stage: Stage };

// Zod con exactOptionalPropertyTypes produce `archived?: boolean | undefined`:
// la forma è la stessa, il cast documenta che lo schema è la fonte di verità.
export function parseStage(value: unknown): Stage | null {
  const result = stageSchema.safeParse(value);
  return result.success ? (result.data as Stage) : null;
}

export function parseStageMessage(value: unknown): StageMessage | null {
  const result = stageMessageSchema.safeParse(value);
  return result.success ? (result.data as StageMessage) : null;
}
```

`packages/canvas/src/samples.ts`:

```ts
import type { Content } from './types';

// Contenuti di prova per usare il palco prima che esista l'agente (slice 4).
export function sampleContent(kind: 'chart' | 'text' | 'table', id: string): Content {
  switch (kind) {
    case 'chart':
      return {
        id,
        kind,
        data: { title: 'Vendite per trimestre', labels: ['T1', 'T2', 'T3', 'T4'], values: [120, 150, 90, 180] },
      };
    case 'text':
      return {
        id,
        kind,
        data: {
          title: 'Proposta Acme',
          body: 'Tre fasi: analisi, prototipo, rilascio. Primo rilascio entro otto settimane.',
        },
      };
    case 'table':
      return {
        id,
        kind,
        data: {
          title: 'Piano di lavoro',
          columns: ['Fase', 'Settimane'],
          rows: [
            ['Analisi', '2'],
            ['Prototipo', '4'],
            ['Rilascio', '2'],
          ],
        },
      };
  }
}
```

Aggiungi a `packages/canvas/src/index.ts`:

```ts
export {
  LIMITS,
  commandSchema,
  contentSchema,
  parseStage,
  parseStageMessage,
  stageMessageSchema,
  stageSchema,
  type StageMessage,
} from './schema';
export { sampleContent } from './samples';
```

- [ ] **Step 3: verifica e commit**

Run: `npx vitest run tests/unit/stage-schema.test.ts && npm run typecheck && npm run lint`
Expected: PASS (6 test), typecheck e lint puliti.

```bash
git add packages/canvas/src tests/unit/stage-schema.test.ts
git commit -m "feat(canvas): zod schemas bounded for the data channel, sample contents"
```

---

### Task 3.4: Sincronizzazione, pacchetti immagine, slot più vicino

**Files:**
- Create: `packages/canvas/src/sync.ts`, `packages/canvas/src/assets.ts`, `packages/canvas/src/slots.ts`
- Modify: `packages/canvas/src/index.ts`
- Test: `tests/unit/stage-sync.test.ts`, `tests/unit/stage-assets.test.ts`, `tests/unit/stage-slots.test.ts`

**Interfaces:**
- Consumes: `applyCommand`, `Stage`, `StageCommand`, `StageMessage`, `ImageMime`.
- Produces:
  - `writeCommand(stage, command): { stage: Stage; message: StageMessage } | null`
  - `followMessage(stage, message): { stage: Stage; outOfSync: boolean }`
  - `type AssetHeader = { assetId: string; mime: ImageMime }`, `MAX_ASSET_BYTES = 5 * 1024 * 1024`
  - `packAsset(header, bytes): Uint8Array<ArrayBuffer>`, `unpackAsset(packed: Uint8Array): { header: AssetHeader; bytes: Uint8Array } | null`, `imageAssetIds(stage): string[]`
  - `type Rect = { x: number; y: number; width: number; height: number }`, `nearestSlot(point: { x: number; y: number }, rects: Partial<Record<Slot, Rect>>): Slot | null`

- [ ] **Step 1: test che falliscono**

`tests/unit/stage-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyStage, followMessage, writeCommand, type Stage } from '@omnicanvas/canvas';

const create = (windowId: string) => ({ type: 'WINDOW_CREATE', windowId, title: windowId }) as const;

describe('single-writer sync', () => {
  it('bumps the version and emits a message only when the stage changes', () => {
    const first = writeCommand(emptyStage(), create('A'));
    expect(first?.stage.version).toBe(1);
    expect(first?.message).toEqual({ type: 'command', version: 1, command: create('A') });
    expect(writeCommand(first!.stage, create('A'))).toBeNull();
  });

  it('applies the next version in order', () => {
    const writer = writeCommand(emptyStage(), create('A'))!;
    const follower = followMessage(emptyStage(), writer.message);
    expect(follower).toEqual({ stage: writer.stage, outOfSync: false });
  });

  it('ignores duplicates and old versions', () => {
    const writer = writeCommand(emptyStage(), create('A'))!;
    const stage = followMessage(emptyStage(), writer.message).stage;
    expect(followMessage(stage, writer.message)).toEqual({ stage, outOfSync: false });
  });

  it('flags a gap instead of applying out of order', () => {
    const one = writeCommand(emptyStage(), create('A'))!;
    const two = writeCommand(one.stage, create('B'))!;
    const result = followMessage(emptyStage(), two.message);
    expect(result.outOfSync).toBe(true);
    expect(result.stage).toEqual(emptyStage());
  });

  it('adopts a snapshot from the writer even when its version is lower', () => {
    const ahead: Stage = { ...emptyStage(), version: 9 };
    const snapshot: Stage = { ...emptyStage(), version: 3 };
    expect(followMessage(ahead, { type: 'snapshot', stage: snapshot })).toEqual({
      stage: snapshot,
      outOfSync: false,
    });
  });
});
```

`tests/unit/stage-assets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_ASSET_BYTES,
  applyCommand,
  emptyStage,
  imageAssetIds,
  packAsset,
  sampleContent,
  unpackAsset,
} from '@omnicanvas/canvas';

const assetId = '00000000-0000-4000-8000-000000000001';

describe('asset packets', () => {
  it('round-trips header and bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    const unpacked = unpackAsset(packAsset({ assetId, mime: 'image/png' }, bytes));
    expect(unpacked?.header).toEqual({ assetId, mime: 'image/png' });
    expect([...unpacked!.bytes]).toEqual([1, 2, 3, 250]);
  });

  it('returns null for truncated or forged packets', () => {
    const packed = packAsset({ assetId, mime: 'image/png' }, new Uint8Array([1]));
    expect(unpackAsset(packed.slice(0, 3))).toBeNull();
    expect(unpackAsset(new Uint8Array([0, 0, 0, 2, 123, 125]))).toBeNull();
    expect(unpackAsset(new Uint8Array([0, 0, 255, 255, 1]))).toBeNull();
  });

  it('refuses images over the size limit', () => {
    expect(() => packAsset({ assetId, mime: 'image/png' }, new Uint8Array(MAX_ASSET_BYTES + 1))).toThrow(
      /too large/,
    );
  });

  it('lists the image assets referenced by a stage', () => {
    const image = {
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'image' as const,
      data: { title: 'Schema', assetId, mime: 'image/png' as const, alt: 'schema' },
    };
    const stage = [
      { type: 'TRAY_ADD', content: image } as const,
      { type: 'TRAY_ADD', content: sampleContent('text', '00000000-0000-4000-8000-000000000003') } as const,
    ].reduce(applyCommand, emptyStage());
    expect(imageAssetIds(stage)).toEqual([assetId]);
  });
});
```

`tests/unit/stage-slots.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nearestSlot } from '@omnicanvas/canvas';

const rects = {
  main: { x: 0, y: 0, width: 600, height: 400 },
  'side-1': { x: 620, y: 0, width: 200, height: 120 },
  'side-2': { x: 620, y: 140, width: 200, height: 120 },
};

describe('nearestSlot', () => {
  it('snaps to the slot whose centre is closest to the drop point', () => {
    expect(nearestSlot({ x: 300, y: 200 }, rects)).toBe('main');
    expect(nearestSlot({ x: 700, y: 60 }, rects)).toBe('side-1');
    expect(nearestSlot({ x: 610, y: 210 }, rects)).toBe('side-2');
  });

  it('returns null when no slot is on screen', () => {
    expect(nearestSlot({ x: 0, y: 0 }, {})).toBeNull();
  });
});
```

Run: `npx vitest run tests/unit/stage-sync.test.ts tests/unit/stage-assets.test.ts tests/unit/stage-slots.test.ts`
Expected: FAIL, funzioni non esportate.

- [ ] **Step 2: implementa**

`packages/canvas/src/sync.ts`:

```ts
import { applyCommand } from './reducer';
import type { StageMessage } from './schema';
import type { Stage, StageCommand } from './types';

// Scrittore unico (ARCHITECTURE §3.1): solo chi scrive incrementa version.
export function writeCommand(
  stage: Stage,
  command: StageCommand,
): { stage: Stage; message: StageMessage } | null {
  const next = applyCommand(stage, command);
  if (next === stage) return null;
  const version = stage.version + 1;
  return { stage: { ...next, version }, message: { type: 'command', version, command } };
}

export function followMessage(
  stage: Stage,
  message: StageMessage,
): { stage: Stage; outOfSync: boolean } {
  // Lo snapshot dello scrittore vince sempre: dopo una sua ripartenza la versione può calare.
  if (message.type === 'snapshot') return { stage: message.stage, outOfSync: false };
  if (message.version <= stage.version) return { stage, outOfSync: false };
  if (message.version !== stage.version + 1) return { stage, outOfSync: true };
  return {
    stage: { ...applyCommand(stage, message.command), version: message.version },
    outOfSync: false,
  };
}
```

`packages/canvas/src/assets.ts`:

```ts
import { z } from 'zod';
import type { ImageMime, Stage } from './types';

export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_HEADER_BYTES = 1024;

export type AssetHeader = { assetId: string; mime: ImageMime };

const headerSchema = z.object({
  assetId: z.uuid(),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

// Formato: 4 byte big-endian con la lunghezza dell'header, header JSON, byte dell'immagine.
export function packAsset(header: AssetHeader, bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    throw new Error(`image is too large: ${bytes.byteLength} bytes, max ${MAX_ASSET_BYTES}`);
  }
  const head = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(4 + head.byteLength + bytes.byteLength);
  new DataView(out.buffer).setUint32(0, head.byteLength);
  out.set(head, 4);
  out.set(bytes, 4 + head.byteLength);
  return out;
}

export function unpackAsset(packed: Uint8Array): { header: AssetHeader; bytes: Uint8Array } | null {
  if (packed.byteLength < 4) return null;
  const length = new DataView(packed.buffer, packed.byteOffset, packed.byteLength).getUint32(0);
  if (length === 0 || length > MAX_HEADER_BYTES || 4 + length > packed.byteLength) return null;
  try {
    const parsed = headerSchema.safeParse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(packed.subarray(4, 4 + length))),
    );
    if (!parsed.success) return null;
    const bytes = packed.subarray(4 + length);
    if (bytes.byteLength > MAX_ASSET_BYTES) return null;
    return { header: parsed.data, bytes };
  } catch {
    return null;
  }
}

export function imageAssetIds(stage: Stage): string[] {
  const all = [...stage.tray, ...stage.windows.flatMap((w) => w.contents)];
  return [...new Set(all.flatMap((c) => (c.kind === 'image' ? [c.data.assetId] : [])))];
}
```

`packages/canvas/src/slots.ts`:

```ts
import { SLOTS, type Slot } from './types';

export type Rect = { x: number; y: number; width: number; height: number };

// Aggancio magnetico: il rilascio va allo slot con il centro più vicino.
export function nearestSlot(
  point: { x: number; y: number },
  rects: Partial<Record<Slot, Rect>>,
): Slot | null {
  let best: Slot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of SLOTS) {
    const rect = rects[slot];
    if (!rect) continue;
    const dx = point.x - (rect.x + rect.width / 2);
    const dy = point.y - (rect.y + rect.height / 2);
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = slot;
      bestDistance = distance;
    }
  }
  return best;
}
```

Aggiungi a `packages/canvas/src/index.ts`:

```ts
export { followMessage, writeCommand } from './sync';
export { MAX_ASSET_BYTES, imageAssetIds, packAsset, unpackAsset, type AssetHeader } from './assets';
export { nearestSlot, type Rect } from './slots';
```

- [ ] **Step 3: verifica e commit**

Run: `npx vitest run tests/unit/stage-sync.test.ts tests/unit/stage-assets.test.ts tests/unit/stage-slots.test.ts && npm run typecheck && npm run lint`
Expected: PASS (11 test), puliti.

```bash
git add packages/canvas/src tests/unit/stage-sync.test.ts tests/unit/stage-assets.test.ts tests/unit/stage-slots.test.ts
git commit -m "feat(canvas): single-writer sync, image packets, nearest slot"
```

---

### Task 3.5: Snapshot in KV — store, accesso e route

**Files:**
- Create: `apps/web/src/lib/kv/kv.ts`, `apps/web/src/lib/stage/snapshot-store.ts`, `apps/web/src/lib/stage/stage-access.ts`, `apps/web/src/app/room/[code]/stage/route.ts`
- Modify: `apps/web/package.json`
- Test: `tests/unit/snapshot-store.test.ts`, `tests/db/stage-access.test.ts`

**Interfaces:**
- Consumes: `parseStage`, `Stage` (3.3); `resolveParticipant`, `ResolveParticipantInput` (slice 2); `readGuestParticipantId`.
- Produces:
  - `type KvLike = { get<T>(key: string): Promise<T | null>; set(key: string, value: unknown, options: { ex: number }): Promise<unknown> }`, `createKv(): KvLike`
  - `STAGE_TTL_SECONDS = 43_200`, `stageKey(roomId): string`, `loadStage(kv, roomId): Promise<Stage | null>`, `saveStage(kv, roomId, stage): Promise<'saved' | 'stale'>`
  - `MAX_STAGE_BODY_BYTES = 262_144`, `type StageAccessResult = { status: number; body: unknown }`
  - `readStage(admin, kv, input): Promise<StageAccessResult>` — 200 `{ stage }`, 204, 403, 404, 410
  - `writeStage(admin, kv, input, rawBody: string): Promise<StageAccessResult>` — 200 `{ version }`, 400, 403 `host_only`, 409, 413, 404, 410
  - HTTP `GET` / `POST /room/<code>/stage`, `Cache-Control: no-store`

- [ ] **Step 1: dipendenza**

```bash
npm install --workspace=apps/web @upstash/redis@1.39.0
```

- [ ] **Step 2: test che falliscono**

`tests/unit/snapshot-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand, emptyStage, type Stage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';
import { STAGE_TTL_SECONDS, loadStage, saveStage, stageKey } from '@/lib/stage/snapshot-store';

class MemoryKv implements KvLike {
  readonly data = new Map<string, unknown>();
  readonly ttl = new Map<string, number>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T | undefined) ?? null;
  }
  async set(key: string, value: unknown, options: { ex: number }) {
    this.data.set(key, structuredClone(value));
    this.ttl.set(key, options.ex);
    return 'OK';
  }
}

const roomId = '22222222-2222-4222-8222-222222222222';
const stageAt = (version: number): Stage => ({
  ...applyCommand(emptyStage(), {
    type: 'WINDOW_CREATE',
    windowId: '00000000-0000-4000-8000-000000000001',
    title: 'Finestra 1',
  }),
  version,
});

describe('snapshot store', () => {
  it('saves with the session ttl and loads it back', async () => {
    const kv = new MemoryKv();
    expect(await saveStage(kv, roomId, stageAt(3))).toBe('saved');
    expect(kv.ttl.get(stageKey(roomId))).toBe(STAGE_TTL_SECONDS);
    expect(await loadStage(kv, roomId)).toEqual(stageAt(3));
  });

  it('refuses to go back in version', async () => {
    const kv = new MemoryKv();
    await saveStage(kv, roomId, stageAt(5));
    expect(await saveStage(kv, roomId, stageAt(4))).toBe('stale');
    expect((await loadStage(kv, roomId))?.version).toBe(5);
  });

  it('treats a corrupted value as missing', async () => {
    const kv = new MemoryKv();
    kv.data.set(stageKey(roomId), { windows: 'nope' });
    expect(await loadStage(kv, roomId)).toBeNull();
  });

  it('keys the snapshot by room', () => {
    expect(stageKey(roomId)).toBe(`room:${roomId}:stage`);
  });
});
```

`tests/db/stage-access.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { MAX_STAGE_BODY_BYTES, readStage, writeStage } from '@/lib/stage/stage-access';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

class MemoryKv implements KvLike {
  readonly data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T | undefined) ?? null;
  }
  async set(key: string, value: unknown) {
    this.data.set(key, structuredClone(value));
    return 'OK';
  }
}

const stage = {
  ...applyCommand(emptyStage(), {
    type: 'WINDOW_CREATE',
    windowId: '00000000-0000-4000-8000-000000000001',
    title: 'Finestra 1',
  }),
  version: 1,
};

describe('stage access', () => {
  let host: TestUser;
  let stranger: TestUser;
  let joinCode: string;
  let guestId: string;
  const kv = new MemoryKv();

  beforeAll(async () => {
    host = await createTestUser('stage-host');
    stranger = await createTestUser('stage-stranger');
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Palco' });
    if (!room.ok) throw new Error('setup failed');
    joinCode = room.joinCode;
    await joinRoom(admin, { joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    const guest = await joinRoom(admin, { joinCode, userId: null, displayName: 'Cliente', language: 'en' });
    if (guest.kind !== 'joined') throw new Error('guest join failed');
    guestId = guest.participantId;
  });

  const asHost = () => ({ joinCode, userId: host.id, guestParticipantId: () => null });
  const asGuest = () => ({ joinCode, userId: null, guestParticipantId: () => guestId });

  it('answers 204 before the host saved anything', async () => {
    expect(await readStage(admin, kv, asGuest())).toEqual({ status: 204, body: null });
  });

  it('lets the host write and a guest read', async () => {
    expect(await writeStage(admin, kv, asHost(), JSON.stringify(stage))).toEqual({
      status: 200,
      body: { version: 1 },
    });
    expect(await readStage(admin, kv, asGuest())).toEqual({ status: 200, body: { stage } });
  });

  it('refuses writes from a guest', async () => {
    expect(await writeStage(admin, kv, asGuest(), JSON.stringify(stage))).toEqual({
      status: 403,
      body: { error: 'host_only' },
    });
  });

  it('refuses a stranger both ways', async () => {
    const stranger_ = { joinCode, userId: stranger.id, guestParticipantId: () => null };
    expect((await readStage(admin, kv, stranger_)).status).toBe(403);
    expect((await writeStage(admin, kv, stranger_, JSON.stringify(stage))).status).toBe(403);
  });

  it('rejects malformed, oversized and stale snapshots', async () => {
    expect((await writeStage(admin, kv, asHost(), '{not json')).status).toBe(400);
    expect((await writeStage(admin, kv, asHost(), JSON.stringify({ windows: 1 }))).status).toBe(400);
    expect((await writeStage(admin, kv, asHost(), 'x'.repeat(MAX_STAGE_BODY_BYTES + 1))).status).toBe(413);
    expect(await writeStage(admin, kv, asHost(), JSON.stringify({ ...stage, version: 0 }))).toEqual({
      status: 409,
      body: { error: 'stale_version' },
    });
  });

  it('reports unknown and ended rooms', async () => {
    expect((await readStage(admin, kv, { joinCode: 'ZZZZZZZZ', userId: host.id, guestParticipantId: () => null })).status).toBe(404);
    const ended = await createRoomForUser(await signedInClient(host), host.id, { title: 'Finita' });
    if (!ended.ok) throw new Error('setup failed');
    await joinRoom(admin, { joinCode: ended.joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    await admin.from('rooms').update({ status: 'closed' }).eq('id', ended.id);
    expect(
      (await readStage(admin, kv, { joinCode: ended.joinCode, userId: host.id, guestParticipantId: () => null })).status,
    ).toBe(410);
  });
});
```

Run: `npx vitest run tests/unit/snapshot-store.test.ts` (locale) e, nel Codespace, `npx vitest run tests/db/stage-access.test.ts`
Expected: FAIL, moduli inesistenti.

- [ ] **Step 3: KV e store**

`apps/web/src/lib/kv/kv.ts`:

```ts
import 'server-only';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/env';

// Il sottoinsieme di Redis che usiamo: basta per sostituirlo nei test con una Map.
export type KvLike = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options: { ex: number }): Promise<unknown>;
};

export function createKv(): KvLike {
  const env = serverEnv();
  return new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
}
```

`apps/web/src/lib/stage/snapshot-store.ts`:

```ts
import { parseStage, type Stage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';

// Durata massima di una sessione, come il cookie ospite: poi lo snapshot sparisce da solo.
export const STAGE_TTL_SECONDS = 12 * 60 * 60;

export function stageKey(roomId: string): string {
  return `room:${roomId}:stage`;
}

export async function loadStage(kv: KvLike, roomId: string): Promise<Stage | null> {
  const raw = await kv.get<unknown>(stageKey(roomId));
  return raw === null ? null : parseStage(raw);
}

export async function saveStage(kv: KvLike, roomId: string, stage: Stage): Promise<'saved' | 'stale'> {
  const current = await loadStage(kv, roomId);
  if (current && current.version > stage.version) return 'stale';
  await kv.set(stageKey(roomId), stage, { ex: STAGE_TTL_SECONDS });
  return 'saved';
}
```

`kv.ts` importa `server-only` ma `snapshot-store.ts` ne importa solo il tipo: il test
unitario non tocca `server-only`.

- [ ] **Step 4: accesso**

`apps/web/src/lib/stage/stage-access.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { parseStage } from '@omnicanvas/canvas';
import type { KvLike } from '@/lib/kv/kv';
import { resolveParticipant, type ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
import { loadStage, saveStage } from './snapshot-store';

export const MAX_STAGE_BODY_BYTES = 256 * 1024;

export type StageAccessResult = { status: number; body: unknown };

const REFUSALS: Record<'not_found' | 'ended' | 'forbidden', StageAccessResult> = {
  not_found: { status: 404, body: { error: 'room_not_found' } },
  ended: { status: 410, body: { error: 'room_ended' } },
  forbidden: { status: 403, body: { error: 'not_a_participant' } },
};

type Admin = SupabaseClient<Database>;

export async function readStage(
  admin: Admin,
  kv: KvLike,
  input: ResolveParticipantInput,
): Promise<StageAccessResult> {
  const resolved = await resolveParticipant(admin, input);
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  const stage = await loadStage(kv, resolved.room.id);
  return stage ? { status: 200, body: { stage } } : { status: 204, body: null };
}

// Solo l'host scrive: è l'unico scrittore del palco (ADR-0009).
export async function writeStage(
  admin: Admin,
  kv: KvLike,
  input: ResolveParticipantInput,
  rawBody: string,
): Promise<StageAccessResult> {
  const resolved = await resolveParticipant(admin, input);
  if (resolved.kind !== 'ok') return REFUSALS[resolved.kind];
  if (resolved.participant.role !== 'host') return { status: 403, body: { error: 'host_only' } };

  if (new TextEncoder().encode(rawBody).byteLength > MAX_STAGE_BODY_BYTES) {
    return { status: 413, body: { error: 'stage_too_large' } };
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid_stage' } };
  }
  const stage = parseStage(json);
  if (!stage) return { status: 400, body: { error: 'invalid_stage' } };

  const result = await saveStage(kv, resolved.room.id, stage);
  return result === 'saved'
    ? { status: 200, body: { version: stage.version } }
    : { status: 409, body: { error: 'stale_version' } };
}
```

- [ ] **Step 5: route**

`apps/web/src/app/room/[code]/stage/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createKv } from '@/lib/kv/kv';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import type { ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
import { readStage, writeStage, type StageAccessResult } from '@/lib/stage/stage-access';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

type Context = { params: Promise<{ code: string }> };

async function who(code: string): Promise<ResolveParticipantInput> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  return {
    joinCode: code,
    userId: auth.user?.id ?? null,
    guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
  };
}

function respond({ status, body }: StageAccessResult) {
  const headers = { 'Cache-Control': 'no-store' };
  return status === 204
    ? new Response(null, { status, headers })
    : NextResponse.json(body, { status, headers });
}

export async function GET(_request: Request, { params }: Context) {
  const { code } = await params;
  return respond(await readStage(createAdminSupabase(), createKv(), await who(code)));
}

export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  return respond(
    await writeStage(createAdminSupabase(), createKv(), await who(code), await request.text()),
  );
}
```

- [ ] **Step 6: verifica e commit**

Run: `npx vitest run tests/unit/snapshot-store.test.ts && npm run typecheck && npm run lint`
Expected: PASS (4 test). Nel Codespace: `npx vitest run tests/db/stage-access.test.ts` → PASS (6 test), poi `npm run test:db` tutto verde.

```bash
git add apps/web/src/lib/kv apps/web/src/lib/stage "apps/web/src/app/room/[code]/stage" apps/web/package.json package-lock.json tests/unit/snapshot-store.test.ts tests/db/stage-access.test.ts
git commit -m "feat(web): stage snapshot in kv, host-only writes, participant reads"
```

---

### Task 3.6: Hook del palco

**Files:**
- Create: `apps/web/src/lib/stage/peek.ts`, `apps/web/src/lib/stage/sample-image.ts`, `apps/web/src/lib/stage/use-stage.ts`
- Modify: `apps/web/src/lib/call/use-call.ts`
- Test: `tests/unit/stage-peek.test.ts`

**Interfaces:**
- Consumes: tutto `@omnicanvas/canvas`; `RealtimeSession`, `RosterEntry`.
- Produces:
  - `useCall(...)` restituisce anche `session: RealtimeSession | null`
  - `peekNeighbor(stage: Stage, fromId: string | null, direction: 1 | -1): string | null`
  - `isFromHost(roster: RosterEntry[], identity: string): boolean`
  - `sampleImage(): Promise<Uint8Array<ArrayBuffer>>` (PNG 480×270 disegnato nel browser)
  - `useStage({ joinCode, role, session, roster }): { stage: Stage; ready: boolean; assetUrls: Record<string, string>; dispatch(command: StageCommand): void; addImage(bytes: Uint8Array, mime: ImageMime, title: string, alt: string): void }`

Canali: `stage` (comandi, host → tutti), `stage-sync` (ospite → host), `asset-request`
(ospite → host). Topic byte: `stage-snapshot` (host → uno o tutti), `asset` (host →
uno o tutti).

- [ ] **Step 1: test che fallisce**

`tests/unit/stage-peek.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import { isFromHost, peekNeighbor } from '@/lib/stage/peek';

const stage = [
  { type: 'WINDOW_CREATE', windowId: 'A', title: 'A' } as const,
  { type: 'WINDOW_CREATE', windowId: 'B', title: 'B' } as const,
  { type: 'WINDOW_CREATE', windowId: 'C', title: 'C' } as const,
].reduce(applyCommand, emptyStage());

const entry = (identity: string, role: 'host' | 'guest'): RosterEntry => ({
  identity,
  name: identity,
  role,
  language: 'it',
  isLocal: false,
  micOn: true,
  camOn: true,
  speaking: false,
});

describe('peekNeighbor', () => {
  it('walks the windows in slot order and wraps around', () => {
    expect(peekNeighbor(stage, 'A', 1)).toBe('B');
    expect(peekNeighbor(stage, 'C', 1)).toBe('A');
    expect(peekNeighbor(stage, 'A', -1)).toBe('C');
  });

  it('starts from the focused window when nothing is shown', () => {
    expect(peekNeighbor(stage, null, 1)).toBe('B');
    expect(peekNeighbor(emptyStage(), null, 1)).toBeNull();
  });
});

describe('isFromHost', () => {
  const roster = [entry('h', 'host'), entry('g', 'guest')];

  it('accepts only the identity whose signed role is host', () => {
    expect(isFromHost(roster, 'h')).toBe(true);
    expect(isFromHost(roster, 'g')).toBe(false);
    expect(isFromHost(roster, 'unknown')).toBe(false);
  });
});
```

Run: `npx vitest run tests/unit/stage-peek.test.ts`
Expected: FAIL.

- [ ] **Step 2: `peek.ts`**

```ts
import { orderedWindows, type Stage } from '@omnicanvas/canvas';
import type { RosterEntry } from '@omnicanvas/realtime';

export function peekNeighbor(stage: Stage, fromId: string | null, direction: 1 | -1): string | null {
  const ordered = orderedWindows(stage);
  if (ordered.length === 0) return null;
  const start = ordered.findIndex((w) => w.id === (fromId ?? stage.focusedId));
  const index = ((start < 0 ? 0 : start) + direction + ordered.length) % ordered.length;
  return ordered[index]?.id ?? null;
}

// Il ruolo è un attributo firmato dal server nel token LiveKit: non si può falsificare.
export function isFromHost(roster: RosterEntry[], identity: string): boolean {
  return roster.some((entry) => entry.identity === identity && entry.role === 'host');
}
```

Run: `npx vitest run tests/unit/stage-peek.test.ts`
Expected: PASS (3 test).

- [ ] **Step 3: sessione esposta da `useCall`**

In `apps/web/src/lib/call/use-call.ts`:

1. dopo `const [state, setState] = useState<CallState>(initialState);` aggiungi
   `const [session, setSession] = useState<RealtimeSession | null>(null);`
2. dopo `sessionRef.current = session;` dentro `connect` aggiungi
   `setSession(session);` (la variabile locale si chiama `session`: rinominala in
   `live` dentro `connect` per non oscurare lo stato — `const live = await connectToRoom(...)`
   e aggiorna tutti gli usi dentro `connect`)
3. dentro `onDisconnected`, dopo `sessionRef.current = null;`, aggiungi
   `if (!lifecycle.stopped) setSession(null);`
4. in `leave`, dopo `sessionRef.current = null;`, aggiungi `setSession(null);`
5. nel `return` aggiungi `session`.

Run: `npm run typecheck && npm run lint`
Expected: puliti.

- [ ] **Step 4: immagine di prova**

`apps/web/src/lib/stage/sample-image.ts`:

```ts
'use client';

// Immagine di prova disegnata nel browser: prova il percorso peer to peer senza agente.
export async function sampleImage(): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 270;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2d canvas not available');
  const gradient = context.createLinearGradient(0, 0, 480, 270);
  gradient.addColorStop(0, '#0f766e');
  gradient.addColorStop(1, '#1e3a8a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 480, 270);
  context.fillStyle = '#ffffff';
  context.font = 'bold 32px sans-serif';
  context.fillText('Schema di prova', 32, 140);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png'),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
```

- [ ] **Step 5: hook**

`apps/web/src/lib/stage/use-stage.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';
import {
  emptyStage,
  followMessage,
  imageAssetIds,
  packAsset,
  parseStage,
  parseStageMessage,
  unpackAsset,
  writeCommand,
  type ImageMime,
  type Stage,
  type StageCommand,
} from '@omnicanvas/canvas';
import { isFromHost } from './peek';

const PERSIST_DELAY_MS = 1_000;
const SYNC_THROTTLE_MS = 1_000;
const ASSET_RETRY_MS = 3_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type Options = {
  joinCode: string;
  role: 'host' | 'guest';
  session: RealtimeSession | null;
  roster: RosterEntry[];
};

export function useStage({ joinCode, role, session, roster }: Options) {
  const [stage, setStage] = useState<Stage>(emptyStage);
  const [ready, setReady] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const stageRef = useRef(stage);
  const rosterRef = useRef(roster);
  const assetsRef = useRef(new Map<string, { mime: ImageMime; bytes: Uint8Array }>());
  const urlsRef = useRef<string[]>([]);
  const requestedRef = useRef(new Map<string, number>());

  const hostIdentity = roster.find((e) => e.role === 'host' && !e.isLocal)?.identity ?? null;

  useEffect(() => {
    rosterRef.current = roster;
  }, [roster]);

  const commit = useCallback((next: Stage) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  const storeAsset = useCallback((assetId: string, mime: ImageMime, bytes: Uint8Array) => {
    if (assetsRef.current.has(assetId)) return;
    assetsRef.current.set(assetId, { mime, bytes });
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: mime }));
    urlsRef.current.push(url);
    setAssetUrls((current) => ({ ...current, [assetId]: url }));
  }, []);

  // Snapshot in KV: l'host riparte da lì, l'ospite lo usa solo se è più avanti di lui.
  useEffect(() => {
    let cancelled = false;
    void fetch(`/room/${joinCode}/stage`, { cache: 'no-store' })
      .then(async (response) =>
        response.status === 200
          ? parseStage(((await response.json()) as { stage?: unknown }).stage)
          : null,
      )
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        if (stored && (role === 'host' || stored.version > stageRef.current.version)) commit(stored);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [joinCode, role, commit]);

  // L'host salva lo snapshot un secondo dopo l'ultimo cambiamento.
  useEffect(() => {
    if (role !== 'host' || !ready || stage.version === 0) return;
    const timer = setTimeout(() => {
      void fetch(`/room/${joinCode}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageRef.current),
      }).catch(() => {});
    }, PERSIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [role, ready, stage.version, joinCode]);

  // Host: risponde alle richieste di snapshot e di immagini, e si annuncia a ogni connessione.
  useEffect(() => {
    if (role !== 'host' || !session || !ready) return;
    const sendSnapshot = (to?: string[]) =>
      void session
        .sendBytes('stage-snapshot', encoder.encode(JSON.stringify(stageRef.current)), to)
        .catch(() => {});
    sendSnapshot();
    const offSync = session.onData('stage-sync', (_payload, from) => sendSnapshot([from]));
    const offAsset = session.onData('asset-request', (payload, from) => {
      const assetId = (payload as { assetId?: unknown } | null)?.assetId;
      const asset = typeof assetId === 'string' ? assetsRef.current.get(assetId) : undefined;
      if (!asset || typeof assetId !== 'string') return;
      void session.sendBytes('asset', packAsset({ assetId, mime: asset.mime }, asset.bytes), [from]).catch(() => {});
    });
    return () => {
      offSync();
      offAsset();
    };
  }, [role, session, ready]);

  // Ospite: accetta solo messaggi dell'host, chiede lo snapshot quando perde il filo.
  useEffect(() => {
    if (role !== 'guest' || !session || !hostIdentity) return;
    let lastSync = 0;
    const requestSync = () => {
      const now = Date.now();
      if (now - lastSync < SYNC_THROTTLE_MS) return;
      lastSync = now;
      void session.sendData('stage-sync', {}, [hostIdentity]).catch(() => {});
    };
    const fromHost = (identity: string) => isFromHost(rosterRef.current, identity);

    const offCommand = session.onData('stage', (payload, from) => {
      if (!fromHost(from)) return;
      const message = parseStageMessage(payload);
      if (!message) return;
      const result = followMessage(stageRef.current, message);
      if (result.stage !== stageRef.current) commit(result.stage);
      if (result.outOfSync) requestSync();
    });
    const offSnapshot = session.onBytes('stage-snapshot', (bytes, from) => {
      if (!fromHost(from)) return;
      try {
        const snapshot = parseStage(JSON.parse(decoder.decode(bytes)));
        if (snapshot) commit(snapshot);
      } catch {
        // Snapshot illeggibile: si aspetta il prossimo.
      }
    });
    const offAsset = session.onBytes('asset', (bytes, from) => {
      if (!fromHost(from)) return;
      const asset = unpackAsset(bytes);
      if (asset) storeAsset(asset.header.assetId, asset.header.mime, asset.bytes);
    });
    requestSync();
    return () => {
      offCommand();
      offSnapshot();
      offAsset();
    };
  }, [role, session, hostIdentity, commit, storeAsset]);

  // Ospite: chiede all'host le immagini che il palco cita e che non ha ancora.
  useEffect(() => {
    if (role !== 'guest' || !session || !hostIdentity) return;
    const now = Date.now();
    for (const assetId of imageAssetIds(stage)) {
      if (assetsRef.current.has(assetId)) continue;
      if (now - (requestedRef.current.get(assetId) ?? 0) < ASSET_RETRY_MS) continue;
      requestedRef.current.set(assetId, now);
      void session.sendData('asset-request', { assetId }, [hostIdentity]).catch(() => {});
    }
  }, [role, session, hostIdentity, stage]);

  // I blob URL restano validi finché la pagina vive: si liberano all'uscita.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const dispatch = useCallback(
    (command: StageCommand) => {
      if (role !== 'host' || !ready) return;
      const result = writeCommand(stageRef.current, command);
      if (!result) return;
      commit(result.stage);
      // Se l'invio fallisce, gli ospiti vedranno un buco di versione e chiederanno lo snapshot.
      void session?.sendData('stage', result.message).catch(() => {});
    },
    [role, ready, session, commit],
  );

  const addImage = useCallback(
    (bytes: Uint8Array, mime: ImageMime, title: string, alt: string) => {
      const assetId = crypto.randomUUID();
      storeAsset(assetId, mime, bytes);
      void session?.sendBytes('asset', packAsset({ assetId, mime }, bytes)).catch(() => {});
      dispatch({
        type: 'TRAY_ADD',
        content: { id: crypto.randomUUID(), kind: 'image', data: { title, assetId, mime, alt } },
      });
    },
    [session, storeAsset, dispatch],
  );

  return { stage, ready, assetUrls, dispatch, addImage };
}
```

- [ ] **Step 6: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: verde. Se `react-hooks/refs` o `react-hooks/set-state-in-effect` segnalano
una riga, sposta la lettura del ref dentro un callback o un effetto: non disattivare
la regola.

```bash
git add apps/web/src/lib/stage apps/web/src/lib/call/use-call.ts tests/unit/stage-peek.test.ts
git commit -m "feat(web): stage hook with single writer, snapshot sync and peer images"
```

---

### Task 3.7: Interfaccia del palco

**Files:**
- Create: `apps/web/src/app/room/[code]/content-view.tsx`, `window-view.tsx`, `stage-board.tsx`, `tray.tsx`, `mobile-stage.tsx`, `stage-area.tsx`
- Modify: `apps/web/src/app/room/[code]/room-call.tsx`

**Interfaces:**
- Consumes: `useStage` (3.6), `useCall().session`, tipi e funzioni di `@omnicanvas/canvas`, `peekNeighbor`, `sampleImage`.
- Produces (testi e ruoli ARIA usati dall'e2e 3.8):
  - regione `Finestra in primo piano`; regioni `Finestra laterale 1..3`; mobile mentre si sbircia: regione `Finestra che stai guardando` e bottone «Torna all'host»
  - ogni finestra è un `article` con `aria-label` = titolo; titoli «Finestra N»
  - host: bottoni «Nuova finestra», «Finestra precedente», «Finestra successiva», «Metti in primo piano», «Archivia finestra», «Rimetti nel vassoio»; sezione `Vassoio`; select `Metti «<titolo>» in una finestra`; bottoni «Aggiungi grafico di prova», «Aggiungi testo di prova», «Aggiungi tabella di prova», «Aggiungi immagine di prova»
  - ospite mobile: bottoni «Finestra precedente», «Finestra successiva»
  - immagine: `<img alt="…">`, finché mancano i byte il testo «Immagine in arrivo…»

- [ ] **Step 1: contenuti**

`apps/web/src/app/room/[code]/content-view.tsx`:

```tsx
import type { ChartData, Content } from '@omnicanvas/canvas';

function ChartView({ data }: { data: ChartData }) {
  const max = Math.max(1, ...data.values);
  const barWidth = 100 / Math.max(1, data.values.length);
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox="0 0 100 60" role="img" aria-label={data.title} className="h-32 w-full">
        {data.values.map((value, i) => {
          const height = (Math.max(0, value) / max) * 50;
          return (
            <g key={i}>
              <rect
                x={i * barWidth + barWidth * 0.15}
                y={55 - height}
                width={barWidth * 0.7}
                height={height}
                className="fill-emerald-400"
              >
                <title>{`${data.labels[i] ?? ''}: ${value}`}</title>
              </rect>
              <text x={i * barWidth + barWidth / 2} y={59} textAnchor="middle" className="fill-neutral-400 text-[4px]">
                {data.labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-sm font-medium">{data.title}</figcaption>
    </figure>
  );
}

export function ContentView({ content, assetUrl }: { content: Content; assetUrl: string | null }) {
  switch (content.kind) {
    case 'text':
      return (
        <div>
          <h3 className="text-sm font-medium">{content.data.title}</h3>
          <p className="whitespace-pre-wrap text-sm text-neutral-300">{content.data.body}</p>
        </div>
      );
    case 'chart':
      return <ChartView data={content.data} />;
    case 'table':
      return (
        <table className="w-full text-left text-sm">
          <caption className="text-left font-medium">{content.data.title}</caption>
          <thead>
            <tr>
              {content.data.columns.map((column, i) => (
                <th key={i} className="border-b border-neutral-700 py-1 pr-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.data.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="py-1 pr-2 text-neutral-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'image':
      return (
        <figure className="flex flex-col gap-1">
          {assetUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL in memoria, niente ottimizzazione
            <img src={assetUrl} alt={content.data.alt} className="max-h-64 w-full rounded object-contain" />
          ) : (
            <div className="flex h-32 items-center justify-center rounded bg-neutral-800 text-sm text-neutral-400">
              Immagine in arrivo…
            </div>
          )}
          <figcaption className="text-sm font-medium">{content.data.title}</figcaption>
        </figure>
      );
  }
}
```

Se ESLint segnala che la regola `@next/next/no-img-element` non esiste (il plugin Next
non è configurato), togli il commento `eslint-disable`: lascia solo il commento
italiano sopra l'`<img>`.

- [ ] **Step 2: finestra**

`apps/web/src/app/room/[code]/window-view.tsx`:

```tsx
import type { StageCommand, StageWindow } from '@omnicanvas/canvas';
import { ContentView } from './content-view';

export const DRAG_TYPE = 'application/x-omnicanvas';
export type DragItem = { type: 'content' | 'window'; id: string };

type Props = {
  window: StageWindow;
  assetUrls: Record<string, string>;
  dispatch?: ((command: StageCommand) => void) | undefined;
};

export function WindowView({ window, assetUrls, dispatch }: Props) {
  const editable = Boolean(dispatch);
  const startDrag = (item: DragItem) => (event: React.DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <article aria-label={window.title} className="flex h-full flex-col gap-2 rounded border border-neutral-700 bg-neutral-900 p-2">
      <header
        draggable={editable}
        onDragStart={editable ? startDrag({ type: 'window', id: window.id }) : undefined}
        className={`flex items-center justify-between gap-2 ${editable ? 'cursor-grab' : ''}`}
      >
        <h2 className="truncate text-sm font-medium">{window.title}</h2>
        {dispatch && (
          <div className="flex gap-1">
            {window.slot !== 'main' && (
              <button
                onClick={() => dispatch({ type: 'FOCUS', windowId: window.id })}
                className="rounded bg-neutral-800 px-2 py-0.5 text-xs"
              >
                Metti in primo piano
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'WINDOW_ARCHIVE', windowId: window.id })}
              className="rounded bg-neutral-800 px-2 py-0.5 text-xs"
            >
              Archivia finestra
            </button>
          </div>
        )}
      </header>
      {window.contents.length === 0 ? (
        <p className="text-xs text-neutral-500">Finestra vuota</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-3 overflow-auto">
          {window.contents.map((content) => (
            <li
              key={content.id}
              draggable={editable}
              onDragStart={editable ? startDrag({ type: 'content', id: content.id }) : undefined}
              className="flex flex-col gap-1"
            >
              <ContentView
                content={content}
                assetUrl={content.kind === 'image' ? (assetUrls[content.data.assetId] ?? null) : null}
              />
              {dispatch && (
                <button
                  onClick={() => dispatch({ type: 'CONTENT_REMOVE', contentId: content.id })}
                  className="w-fit rounded bg-neutral-800 px-2 py-0.5 text-xs"
                >
                  Rimetti nel vassoio
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
```

- [ ] **Step 3: palco a slot**

`apps/web/src/app/room/[code]/stage-board.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { SLOTS, nearestSlot, type Rect, type Slot, type Stage, type StageCommand } from '@omnicanvas/canvas';
import { DRAG_TYPE, WindowView, type DragItem } from './window-view';

const SLOT_LABELS: Record<Slot, string> = {
  main: 'Finestra in primo piano',
  'side-1': 'Finestra laterale 1',
  'side-2': 'Finestra laterale 2',
  'side-3': 'Finestra laterale 3',
};

type Props = {
  stage: Stage;
  assetUrls: Record<string, string>;
  dispatch?: ((command: StageCommand) => void) | undefined;
};

function readDragItem(event: React.DragEvent): DragItem | null {
  try {
    const item = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as Partial<DragItem>;
    return (item.type === 'content' || item.type === 'window') && typeof item.id === 'string'
      ? { type: item.type, id: item.id }
      : null;
  } catch {
    return null;
  }
}

export function StageBoard({ stage, assetUrls, dispatch }: Props) {
  const slotElements = useRef<Partial<Record<Slot, HTMLDivElement | null>>>({});

  function handleDrop(event: React.DragEvent) {
    if (!dispatch) return;
    event.preventDefault();
    const item = readDragItem(event);
    if (!item) return;
    const rects: Partial<Record<Slot, Rect>> = {};
    for (const slot of SLOTS) {
      const box = slotElements.current[slot]?.getBoundingClientRect();
      if (box) rects[slot] = { x: box.x, y: box.y, width: box.width, height: box.height };
    }
    const slot = nearestSlot({ x: event.clientX, y: event.clientY }, rects);
    if (!slot) return;
    if (item.type === 'window') {
      dispatch({ type: 'WINDOW_MOVE', windowId: item.id, slot });
      return;
    }
    const target = stage.windows.find((w) => w.slot === slot);
    if (target) dispatch({ type: 'CONTENT_PLACE', contentId: item.id, windowId: target.id });
  }

  const renderSlot = (slot: Slot, className: string) => {
    const window = stage.windows.find((w) => w.slot === slot);
    return (
      <div
        key={slot}
        role="region"
        aria-label={SLOT_LABELS[slot]}
        ref={(element) => {
          slotElements.current[slot] = element;
        }}
        className={className}
      >
        {window ? (
          <WindowView window={window} assetUrls={assetUrls} dispatch={dispatch} />
        ) : (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-neutral-800 text-xs text-neutral-600">
            {slot === 'main' ? 'Nessuna finestra' : 'Slot libero'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onDragOver={(event) => {
        if (dispatch) event.preventDefault();
      }}
      onDrop={handleDrop}
      className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[3fr_1fr]"
    >
      {renderSlot('main', 'min-h-48 lg:min-h-0')}
      <div className="grid gap-2 lg:grid-rows-3">
        {(['side-1', 'side-2', 'side-3'] as const).map((slot) => renderSlot(slot, 'min-h-24'))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: vassoio**

`apps/web/src/app/room/[code]/tray.tsx`:

```tsx
'use client';

import { sampleContent, type Stage, type StageCommand } from '@omnicanvas/canvas';
import { sampleImage } from '@/lib/stage/sample-image';
import { DRAG_TYPE, type DragItem } from './window-view';

type Props = {
  stage: Stage;
  dispatch: (command: StageCommand) => void;
  addImage: (bytes: Uint8Array, mime: 'image/png', title: string, alt: string) => void;
};

const KIND_LABELS = { chart: 'grafico', text: 'testo', table: 'tabella', image: 'immagine' } as const;

export function Tray({ stage, dispatch, addImage }: Props) {
  const addSample = (kind: 'chart' | 'text' | 'table') =>
    dispatch({ type: 'TRAY_ADD', content: sampleContent(kind, crypto.randomUUID()) });

  return (
    <section aria-label="Vassoio" className="flex flex-col gap-2 rounded border border-neutral-800 p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-400">Contenuti di prova:</span>
        <button onClick={() => addSample('chart')} className="rounded bg-neutral-800 px-2 py-1">
          Aggiungi grafico di prova
        </button>
        <button onClick={() => addSample('text')} className="rounded bg-neutral-800 px-2 py-1">
          Aggiungi testo di prova
        </button>
        <button onClick={() => addSample('table')} className="rounded bg-neutral-800 px-2 py-1">
          Aggiungi tabella di prova
        </button>
        <button
          onClick={() =>
            void sampleImage().then((bytes) =>
              addImage(bytes, 'image/png', 'Schema di prova', 'Schema di prova'),
            )
          }
          className="rounded bg-neutral-800 px-2 py-1"
        >
          Aggiungi immagine di prova
        </button>
      </div>
      {stage.tray.length === 0 ? (
        <p className="text-xs text-neutral-500">Il vassoio è vuoto: qui arriva ciò che produce l&apos;agente.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {stage.tray.map((content) => (
            <li
              key={content.id}
              draggable
              onDragStart={(event) => {
                const item: DragItem = { type: 'content', id: content.id };
                event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
              }}
              className="flex cursor-grab flex-col gap-1 rounded bg-neutral-900 p-2 text-xs"
            >
              <span className="font-medium">{content.data.title}</span>
              <span className="text-neutral-500">
                {KIND_LABELS[content.kind]}
                {content.archived ? ' · archiviato' : ''}
              </span>
              <select
                aria-label={`Metti «${content.data.title}» in una finestra`}
                value=""
                disabled={stage.windows.length === 0}
                onChange={(event) => {
                  if (event.target.value) {
                    dispatch({ type: 'CONTENT_PLACE', contentId: content.id, windowId: event.target.value });
                  }
                }}
                className="rounded bg-neutral-800 px-1 py-0.5"
              >
                <option value="">Metti in…</option>
                {stage.windows.map((window) => (
                  <option key={window.id} value={window.id}>
                    {window.title}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: vista mobile A**

`apps/web/src/app/room/[code]/mobile-stage.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import type { Stage } from '@omnicanvas/canvas';
import { peekNeighbor } from '@/lib/stage/peek';
import { WindowView } from './window-view';

const SWIPE_PX = 50;

export function MobileStage({ stage, assetUrls }: { stage: Stage; assetUrls: Record<string, string> }) {
  // Lo sbirciare vale finché l'host non cambia finestra: poi si torna a seguirlo.
  const [peek, setPeek] = useState<{ id: string; focus: string | null } | null>(null);
  const touchStart = useRef<number | null>(null);

  const peekId = peek && peek.focus === stage.focusedId ? peek.id : null;
  const shownId = peekId ?? stage.focusedId;
  const shown = stage.windows.find((w) => w.id === shownId) ?? null;

  const step = (direction: 1 | -1) => {
    const next = peekNeighbor(stage, shownId, direction);
    if (!next) return;
    setPeek(next === stage.focusedId ? null : { id: next, focus: stage.focusedId });
  };

  if (!shown) {
    return <p className="text-sm text-neutral-500">L&apos;host non ha ancora aperto finestre.</p>;
  }

  return (
    <div
      role="region"
      aria-label={peekId ? 'Finestra che stai guardando' : 'Finestra in primo piano'}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < SWIPE_PX) return;
        step(end < start ? 1 : -1);
      }}
      className="flex h-full flex-col gap-2"
    >
      {stage.windows.length > 1 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <button onClick={() => step(-1)} className="rounded bg-neutral-800 px-2 py-1">
            Finestra precedente
          </button>
          {peekId && (
            <button onClick={() => setPeek(null)} className="rounded bg-neutral-100 px-2 py-1 text-neutral-900">
              Torna all&apos;host
            </button>
          )}
          <button onClick={() => step(1)} className="rounded bg-neutral-800 px-2 py-1">
            Finestra successiva
          </button>
        </div>
      )}
      <WindowView window={shown} assetUrls={assetUrls} />
    </div>
  );
}
```

- [ ] **Step 6: area del palco**

`apps/web/src/app/room/[code]/stage-area.tsx`:

```tsx
'use client';

import { MAX_WINDOWS, type ImageMime, type Stage, type StageCommand } from '@omnicanvas/canvas';
import { MobileStage } from './mobile-stage';
import { StageBoard } from './stage-board';
import { Tray } from './tray';

type Props = {
  role: 'host' | 'guest';
  stage: Stage;
  ready: boolean;
  assetUrls: Record<string, string>;
  dispatch: (command: StageCommand) => void;
  addImage: (bytes: Uint8Array, mime: ImageMime, title: string, alt: string) => void;
};

export function StageArea({ role, stage, ready, assetUrls, dispatch, addImage }: Props) {
  if (!ready) return <p className="text-sm text-neutral-500">Caricamento del palco…</p>;

  if (role === 'guest') {
    return (
      <>
        <div className="hidden h-full lg:flex">
          <StageBoard stage={stage} assetUrls={assetUrls} />
        </div>
        <div className="h-full lg:hidden">
          <MobileStage stage={stage} assetUrls={assetUrls} />
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() =>
            dispatch({
              type: 'WINDOW_CREATE',
              windowId: crypto.randomUUID(),
              title: `Finestra ${stage.windows.length + 1}`,
            })
          }
          disabled={stage.windows.length >= MAX_WINDOWS}
          className="rounded bg-neutral-100 px-2 py-1 text-neutral-900 disabled:opacity-40"
        >
          Nuova finestra
        </button>
        <button
          onClick={() => dispatch({ type: 'FOCUS_PREV' })}
          disabled={stage.windows.length < 2}
          className="rounded bg-neutral-800 px-2 py-1 disabled:opacity-40"
        >
          Finestra precedente
        </button>
        <button
          onClick={() => dispatch({ type: 'FOCUS_NEXT' })}
          disabled={stage.windows.length < 2}
          className="rounded bg-neutral-800 px-2 py-1 disabled:opacity-40"
        >
          Finestra successiva
        </button>
      </div>
      <StageBoard stage={stage} assetUrls={assetUrls} dispatch={dispatch} />
      <Tray stage={stage} dispatch={dispatch} addImage={addImage} />
    </div>
  );
}
```

- [ ] **Step 7: monta il palco nella call**

In `apps/web/src/app/room/[code]/room-call.tsx`:

```tsx
import { useStage } from '@/lib/stage/use-stage';
import { StageArea } from './stage-area';
```

Dentro `RoomCall`, dopo `useCall`, estrai anche `session` e aggiungi:

```tsx
  const stageApi = useStage({ joinCode, role, session, roster: state.roster });
```

Nella `<section aria-label="Palco" …>` aggiungi `flex flex-col gap-2 overflow-auto`
alla `className` e sostituisci il commento `{/* slice 3: finestre, slot, vassoio */}` con:

```tsx
          {live && (
            <StageArea
              role={role}
              stage={stageApi.stage}
              ready={stageApi.ready}
              assetUrls={stageApi.assetUrls}
              dispatch={stageApi.dispatch}
              addImage={stageApi.addImage}
            />
          )}
```

- [ ] **Step 8: verifica**

Run: `npm run typecheck && npm run lint && npm run test:unit` e la build di produzione
con le variabili di CI.
Expected: verde.

Prova manuale nel Codespace (script Playwright usa-e-getta in `scratch/`, come nella
slice 2): host aggiunge testo e immagine di prova, crea due finestre, trascina il testo
nella prima e l'immagine nella seconda, mette in primo piano la seconda; ospite desktop
e ospite a 390px vedono lo stesso palco; screenshot a 1280 e a 390 letti e senza
sovrapposizioni.

- [ ] **Step 9: commit**

```bash
git add "apps/web/src/app/room/[code]"
git commit -m "feat(web): stage ui with magnetic slots, tray, drag and drop and mobile follow"
```

---

### Task 3.8: E2E del palco

**Files:**
- Modify: `e2e/helpers.ts`
- Create: `e2e/stage.spec.ts`

**Interfaces:**
- Produces: `joinAsAnonymousGuest(browser, roomUrl, name?, contextOptions?: BrowserContextOptions)`.

- [ ] **Step 1: helper**

In `e2e/helpers.ts` cambia la firma e la prima riga di `joinAsAnonymousGuest`:

```ts
import { expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
```

```ts
export async function joinAsAnonymousGuest(
  browser: Browser,
  roomUrl: string,
  name = 'Cliente',
  contextOptions: BrowserContextOptions = {},
): Promise<Page> {
  const context = await browser.newContext(contextOptions);
```

- [ ] **Step 2: test**

`e2e/stage.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

const main = (page: Page) => page.getByRole('region', { name: 'Finestra in primo piano' });

async function placeInto(host: Page, contentTitle: string, windowTitle: string) {
  await host
    .getByRole('combobox', { name: `Metti «${contentTitle}» in una finestra` })
    .selectOption({ label: windowTitle });
}

async function buildTextWindow(host: Page) {
  await host.getByRole('button', { name: 'Aggiungi testo di prova' }).click();
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await placeInto(host, 'Proposta Acme', 'Finestra 1');
  await expect(main(host)).toContainText('Proposta Acme');
}

test('host builds the stage and the guest follows live', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);

  await buildTextWindow(host);
  await expect(main(guest)).toContainText('Proposta Acme', { timeout: 20_000 });

  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await host.getByRole('article', { name: 'Finestra 2' }).getByRole('button', { name: 'Metti in primo piano' }).click();
  await expect(main(host).getByRole('article', { name: 'Finestra 2' })).toBeVisible();
  await expect(main(guest).getByRole('article', { name: 'Finestra 2' })).toBeVisible({ timeout: 20_000 });
});

test('a late guest and a reloading host land on the same stage', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  await buildTextWindow(host);

  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(main(guest)).toContainText('Proposta Acme', { timeout: 20_000 });

  // L'host salva lo snapshot un secondo dopo l'ultimo comando.
  await host.waitForTimeout(2_000);
  await host.reload();
  await expect(main(host)).toContainText('Proposta Acme', { timeout: 20_000 });

  await host.getByRole('button', { name: 'Aggiungi grafico di prova' }).click();
  await placeInto(host, 'Vendite per trimestre', 'Finestra 1');
  await expect(main(guest)).toContainText('Vendite per trimestre', { timeout: 20_000 });
});

test('images travel peer to peer, also to a guest who joins later', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);

  await host.getByRole('button', { name: 'Aggiungi immagine di prova' }).click();
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await placeInto(host, 'Schema di prova', 'Finestra 1');

  const loaded = (page: Page) =>
    expect
      .poll(
        () =>
          main(page)
            .getByRole('img', { name: 'Schema di prova' })
            .evaluate((img) => (img as HTMLImageElement).naturalWidth)
            .catch(() => 0),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);

  await loaded(guest);
  const late = await joinAsAnonymousGuest(browser, roomUrl, 'Ritardo');
  await loaded(late);
});

test('guests cannot touch the stage', async ({ browser }) => {
  const { roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  // getByText trova anche la vista nascosta (desktop o mobile): si filtra sulla visibile.
  await expect(
    guest.getByText(/Nessuna finestra|L'host non ha ancora aperto finestre/).filter({ visible: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByRole('button', { name: 'Nuova finestra' })).toHaveCount(0);
  await expect(guest.getByRole('region', { name: 'Vassoio' })).toHaveCount(0);
});

test('on a phone the guest follows the host and can peek', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const phone = await joinAsAnonymousGuest(browser, roomUrl, 'Telefono', {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  await buildTextWindow(host);
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await expect(main(phone).getByRole('article', { name: 'Finestra 1' })).toBeVisible({ timeout: 20_000 });

  await phone.getByRole('button', { name: 'Finestra successiva' }).click();
  const peeking = phone.getByRole('region', { name: 'Finestra che stai guardando' });
  await expect(peeking.getByRole('article', { name: 'Finestra 2' })).toBeVisible();
  await expect(phone.getByRole('button', { name: "Torna all'host" })).toBeVisible();

  await host.getByRole('button', { name: 'Finestra successiva' }).click();
  await expect(main(phone).getByRole('article', { name: 'Finestra 2' })).toBeVisible({ timeout: 20_000 });
  await expect(phone.getByRole('button', { name: "Torna all'host" })).toHaveCount(0);
});
```

- [ ] **Step 3: verifica (Codespace) e CI**

Run: `CI=1 npm run test:e2e -- --reporter=line`, due volte di fila.
Expected: 20 test passati entrambe le volte (10 per progetto).

```bash
git add e2e
git commit -m "test(web): stage sync, late join, host reload, peer images, mobile follow"
git push -u origin slice/3-palco
gh pr create --base slice/2-call --head slice/3-palco --title "Slice 3: palco" --body "$(cat <<'EOF'
Palco a slot magnetici: packages/canvas con riduttore puro, schemi Zod e sync a
scrittore unico; snapshot in KV scritto solo dall'host; immagini peer to peer;
vassoio con contenuti di prova; drag & drop e bottoni; vista mobile che segue l'host.

Impilata su #3 (slice 2). Piano: docs/plans/2026-09-25-slice-3-palco.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: CI verde.

---

### Task 3.9: Chiusura della slice 3

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, `CLAUDE.md`

- [ ] **Step 1: architettura**

In `docs/ARCHITECTURE.md` §3.1 sostituisci il blocco di codice e il paragrafo che segue
con:

````markdown
```
host (unico scrittore)
  comando → applyCommand → version+1 → sendData('stage', { type: 'command', version, command })
         → dopo 1 s senza comandi: POST /room/<code>/stage (solo host) → KV room:{id}:stage
ospiti
  onData('stage') solo dall'identità con ruolo host → followMessage → stesso stato
  buco di versione → sendData('stage-sync') all'host → sendBytes('stage-snapshot') al richiedente
entrata tardiva o ripartenza
  GET /room/<code>/stage → snapshot in KV; l'host riparte da lì e lo ritrasmette a tutti
```

Niente CRDT, niente merge. Chi non è scrittore non invia comandi di palco; chi riceve
scarta i messaggi che non vengono dall'host del roster (ruolo firmato nel token).
Tutto ciò che arriva dalla rete passa dagli schemi Zod di `packages/canvas`.
````

In §3.2 aggiungi in fondo: «Il formato del pacchetto è `packAsset`: 4 byte di
lunghezza, header JSON `{ assetId, mime }`, byte. Se l'host ricarica la pagina perde i
byte delle immagini: il riferimento resta nel palco e mostra "Immagine in arrivo…".»

- [ ] **Step 2: backlog**

In `docs/BACKLOG.md`, slice 3: spunta le voci fatte. Aggiungi ai debiti:

```markdown
- [ ] L'host che ricarica perde i byte delle immagini: recuperarli da un ospite che li ha
- [ ] Contenuto `file` (documenti caricati) non ancora supportato dal palco
- [ ] `room:{id}:presence` in KV non serve finché LiveKit dà la presence: rivedere
- [ ] Contenuti di prova nel vassoio: nasconderli quando arriva l'agente (slice 4)
```

- [ ] **Step 3: stato e commit**

In `CLAUDE.md`, «Stato attuale» e «Ripresa»: slice 3 su `slice/3-palco` (PR #4), prossimo
passo slice 4 con le tre decisioni aperte (vendor STT, parola chiave, provider immagini).

Run: `npm run typecheck && npm run lint && npm run test:unit`; nel Codespace
`npm run test:db && CI=1 npm run test:e2e`.
Expected: verde.

```bash
git add docs CLAUDE.md
git commit -m "docs: close slice 3"
git push
```
