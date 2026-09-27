# Call da telefono — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** da telefono la call si adatta all'orizzontale, un tocco su un volto lo porta a
tutto schermo, la fotocamera si gira, e in background il video di chi parla resta in PiP.

**Architecture:** layout orizzontale solo in CSS (variante Tailwind `phone-landscape`).
Spotlight e scelta del video PiP sono funzioni pure in `apps/web/src/lib/call/`, usate da
`RoomCall`. Il cambio fotocamera entra in `RealtimeSession` (`packages/realtime`, unico
posto che conosce LiveKit). Il PiP usa un `<video>` dedicato, con ingresso automatico dove
il browser lo permette e un pulsante ovunque.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, livekit-client 2.22, Picture-in-Picture
API, Media Session API, Vitest, Playwright.

**Spec:** `docs/specs/2026-09-27-mobile-call-design.md`. Contesto: spec MVP §2.5,
ADR-0005 (ogni gesto ha il suo click), `docs/ARCHITECTURE.md` §7 (confine del realtime).

## Global Constraints

- LiveKit solo in `packages/realtime`; `types.ts` non nomina LiveKit.
- Nessun contenuto di riunione su disco o nei log (regola 1).
- Ogni gesto ha il suo click: tocco sul volto ↔ pulsante accessibile; PiP automatico ↔
  pulsante «Riquadro».
- Etichette UI in italiano: «Mostra <nome> a tutto schermo», «<nome> a tutto schermo»,
  «Chiudi tutto schermo», «Gira fotocamera», «Riquadro».
- La variante `phone-landscape` = `(orientation: landscape) and (max-height: 500px)`.
- Codice, commit e messaggi di errore in inglese; commenti in italiano.
- Test unitari: `npx vitest run <file>`. E2E: nel Codespace, worktree
  `/workspaces/aiconf-mobile` (Supabase locale), `npx playwright test <file>`.

## Review Focus

- La persona in spotlight esce dalla stanza → la sovrapposizione si chiude (Task 2 unit,
  Task 3 e2e).
- Tocco sul proprio volto → non succede nulla, nessun pulsante sulla propria tessera
  (Task 2 unit, Task 3 e2e).
- L'ultimo che ha parlato esce mentre il PiP è aperto → il PiP passa al primo remoto con
  la camera accesa (Task 2 unit).
- Si parla da soli (solo il locale parla) → il PiP non mostra se stessi (Task 2 unit).
- Fotocamera girata mentre è spenta → alla riaccensione usa la nuova direzione (Task 4
  unit sulla preferenza, controllo a mano nella checklist del Task 6).

---

### Task 1: layout orizzontale da telefono

**Files:**
- Modify: `apps/web/src/app/globals.css` (dopo `@import "tailwindcss";`)
- Modify: `apps/web/src/app/room/[code]/room-shell.tsx` (header)
- Modify: `apps/web/src/app/room/[code]/room-call.tsx` (aside, section, nav)
- Modify: `apps/web/src/app/room/[code]/video-tile.tsx` (aspect ratio)
- Test: `e2e/mobile-call.spec.ts`

**Interfaces:**
- Produces: variante CSS `phone-landscape:` usata dai Task 3 e 5.

- [ ] **Step 1: Scrivere l'e2e che fallisce**

`e2e/mobile-call.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

const tiles = (page: Page) =>
  page.getByRole('complementary', { name: 'Partecipanti' }).getByRole('listitem');

const phoneLandscape = {
  viewport: { width: 915, height: 412 },
  isMobile: true,
  hasTouch: true,
};

test('phone in landscape hides the header and keeps faces on the right', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone layout only');
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl, 'Cliente', phoneLandscape);
  await expect(tiles(guest)).toHaveCount(2, { timeout: 30_000 });
  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });

  await expect(guest.getByRole('banner')).toBeHidden();
  const faces = await guest.getByRole('complementary', { name: 'Partecipanti' }).boundingBox();
  expect(faces).not.toBeNull();
  expect(faces!.x).toBeGreaterThan(915 / 2);
  expect(faces!.width).toBeGreaterThanOrEqual(90);
  await expect(guest.getByRole('button', { name: 'Esci' })).toBeInViewport();
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run (Codespace): `npx playwright test e2e/mobile-call.spec.ts --project=mobile`
Expected: FAIL su `getByRole('banner')` ancora visibile.

- [ ] **Step 3: Variante e classi**

`globals.css`, subito dopo `@import "tailwindcss";`:

```css
/* Telefono in orizzontale: altezza bassa, non tablet né desktop. */
@custom-variant phone-landscape (@media (orientation: landscape) and (max-height: 500px));
```

`room-shell.tsx`, header:

```tsx
<header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2 phone-landscape:hidden">
```

`room-call.tsx`:

```tsx
<aside
  aria-label="Partecipanti"
  className="absolute right-2 top-2 z-10 w-16 phone-landscape:bottom-2 phone-landscape:w-24 phone-landscape:overflow-y-auto lg:static lg:w-48 lg:border-r lg:border-neutral-800 lg:p-3"
>
```

```tsx
<section
  aria-label="Palco"
  className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 pr-20 phone-landscape:pr-28 lg:p-4"
>
```

```tsx
<nav
  aria-label="Controlli della chiamata"
  className="flex items-center justify-center gap-2 border-t border-neutral-800 px-4 py-2 phone-landscape:py-1"
>
```

`video-tile.tsx`, `<li>`:

```tsx
className={`relative aspect-[3/4] overflow-hidden rounded bg-neutral-800 phone-landscape:aspect-video lg:aspect-video ${
  entry.speaking ? 'ring-2 ring-emerald-400' : ''
}`}
```

- [ ] **Step 4: Verificare**

Run (Codespace): `npx playwright test e2e/mobile-call.spec.ts --project=mobile` → PASS.
Run (locale): `npm run typecheck && npm run lint` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css "apps/web/src/app/room/[code]/room-shell.tsx" "apps/web/src/app/room/[code]/room-call.tsx" "apps/web/src/app/room/[code]/video-tile.tsx" e2e/mobile-call.spec.ts
git commit -m "feat(call): phone landscape layout with faces column on the right"
```

---

### Task 2: logica di spotlight e di scelta del video PiP

**Files:**
- Create: `apps/web/src/lib/call/spotlight.ts`
- Test: `tests/unit/call-spotlight.test.ts`

**Interfaces:**
- Consumes: `RosterEntry` da `@omnicanvas/realtime`.
- Produces:
  - `resolveSpotlight(selected: string | null, roster: readonly RosterEntry[]): string | null`
  - `nextLastSpeaker(previous: string | null, roster: readonly RosterEntry[]): string | null`
  - `pipTarget(roster: readonly RosterEntry[], spotlight: string | null, lastSpeaker: string | null): string | null`

- [ ] **Step 1: Test che fallisce**

`tests/unit/call-spotlight.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';
import { nextLastSpeaker, pipTarget, resolveSpotlight } from '@/lib/call/spotlight';

const entry = (identity: string, over: Partial<RosterEntry> = {}): RosterEntry => ({
  identity,
  name: identity,
  role: 'guest',
  language: 'it',
  isLocal: false,
  micOn: true,
  camOn: true,
  speaking: false,
  ...over,
});

const me = entry('me', { isLocal: true });
const host = entry('host', { role: 'host' });
const ana = entry('ana');

describe('resolveSpotlight', () => {
  it('keeps a remote participant who is still in the room', () => {
    expect(resolveSpotlight('ana', [host, me, ana])).toBe('ana');
  });
  it('closes when the participant has left', () => {
    expect(resolveSpotlight('ana', [host, me])).toBeNull();
  });
  it('never spotlights the local participant', () => {
    expect(resolveSpotlight('me', [host, me])).toBeNull();
  });
  it('stays closed when nothing is selected', () => {
    expect(resolveSpotlight(null, [host, me])).toBeNull();
  });
});

describe('nextLastSpeaker', () => {
  it('picks the remote participant who is speaking', () => {
    expect(nextLastSpeaker(null, [host, me, { ...ana, speaking: true }])).toBe('ana');
  });
  it('ignores the local participant speaking', () => {
    expect(nextLastSpeaker('host', [host, { ...me, speaking: true }, ana])).toBe('host');
  });
  it('keeps the previous speaker during silence', () => {
    expect(nextLastSpeaker('ana', [host, me, ana])).toBe('ana');
  });
  it('forgets a previous speaker who has left', () => {
    expect(nextLastSpeaker('ana', [host, me])).toBeNull();
  });
});

describe('pipTarget', () => {
  it('prefers the spotlight', () => {
    expect(pipTarget([host, me, ana], 'ana', 'host')).toBe('ana');
  });
  it('then the last speaker', () => {
    expect(pipTarget([host, me, ana], null, 'ana')).toBe('ana');
  });
  it('then the first remote with the camera on, host first', () => {
    expect(pipTarget([host, me, ana], null, null)).toBe('host');
    expect(pipTarget([{ ...host, camOn: false }, me, ana], null, null)).toBe('ana');
  });
  it('falls back when the last speaker has left', () => {
    expect(pipTarget([host, me], null, 'ana')).toBe('host');
  });
  it('never shows the local participant', () => {
    expect(pipTarget([me], null, 'me')).toBeNull();
  });
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx vitest run tests/unit/call-spotlight.test.ts`
Expected: FAIL, modulo `@/lib/call/spotlight` non trovato.

- [ ] **Step 3: Implementazione**

`apps/web/src/lib/call/spotlight.ts`:

```ts
import type { RosterEntry } from '@omnicanvas/realtime';

const remote = (roster: readonly RosterEntry[], identity: string | null) =>
  identity ? roster.find((entry) => entry.identity === identity && !entry.isLocal) : undefined;

// Chi è a tutto schermo: solo un remoto ancora presente. Se esce, lo spotlight si chiude.
export function resolveSpotlight(
  selected: string | null,
  roster: readonly RosterEntry[],
): string | null {
  return remote(roster, selected)?.identity ?? null;
}

// L'ultimo remoto che ha parlato: resta tale nei silenzi, si dimentica se esce.
export function nextLastSpeaker(
  previous: string | null,
  roster: readonly RosterEntry[],
): string | null {
  const speaking = roster.find((entry) => entry.speaking && !entry.isLocal);
  return speaking?.identity ?? remote(roster, previous)?.identity ?? null;
}

// Il video del PiP: spotlight, poi chi ha parlato per ultimo, poi il primo remoto con la
// camera accesa (il roster mette l'host per primo). Mai se stessi.
export function pipTarget(
  roster: readonly RosterEntry[],
  spotlight: string | null,
  lastSpeaker: string | null,
): string | null {
  return (
    remote(roster, spotlight)?.identity ??
    remote(roster, lastSpeaker)?.identity ??
    roster.find((entry) => !entry.isLocal && entry.camOn)?.identity ??
    null
  );
}
```

- [ ] **Step 4: Verificare**

Run: `npx vitest run tests/unit/call-spotlight.test.ts` → PASS (13 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/call/spotlight.ts tests/unit/call-spotlight.test.ts
git commit -m "feat(call): spotlight and picture-in-picture target selection"
```

---

### Task 3: tocco sul volto → tutto schermo

**Files:**
- Create: `apps/web/src/app/room/[code]/spotlight-view.tsx`
- Modify: `apps/web/src/app/room/[code]/video-tile.tsx`
- Modify: `apps/web/src/app/room/[code]/room-call.tsx`
- Test: `e2e/mobile-call.spec.ts` (aggiunta)

**Interfaces:**
- Consumes: `resolveSpotlight` (Task 2), `attachVideo` da `useCall`.
- Produces: in `RoomCall` la costante `spotlight: string | null`, usata dal Task 5.
  `VideoTile` accetta `onSelect?: () => void`.

- [ ] **Step 1: E2E che fallisce**

Aggiungere a `e2e/mobile-call.spec.ts`:

```ts
test('tapping a face opens it full screen and closes when that person leaves', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'one run is enough');
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });

  // La propria tessera non si apre.
  await expect(host.getByRole('button', { name: /^Mostra Sean/ })).toHaveCount(0);

  await host.getByRole('button', { name: 'Mostra Cliente a tutto schermo' }).click();
  const dialog = host.getByRole('dialog', { name: 'Cliente a tutto schermo' });
  await expect(dialog).toBeVisible();
  await expect(host.getByRole('button', { name: 'Esci' })).toBeVisible();

  await host.getByRole('button', { name: 'Chiudi tutto schermo' }).click();
  await expect(dialog).toBeHidden();

  await host.getByRole('button', { name: 'Mostra Cliente a tutto schermo' }).click();
  await host.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await host.getByRole('button', { name: 'Mostra Cliente a tutto schermo' }).click();
  await guest.getByRole('button', { name: 'Esci' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run (Codespace): `npx playwright test e2e/mobile-call.spec.ts --project=mobile -g "full screen"`
Expected: FAIL, pulsante «Mostra Cliente a tutto schermo» non trovato.

- [ ] **Step 3: Tessera selezionabile**

`video-tile.tsx`, nuova prop e contenuto avvolto in un pulsante solo se `onSelect` c'è:

```tsx
type Props = {
  entry: RosterEntry;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  onSelect?: () => void;
};

export function VideoTile({ entry, attachVideo, onSelect }: Props) {
  // ...videoRef e useEffect invariati...

  const face = entry.camOn ? (
    // Sempre muto: l'audio remoto suona dagli elementi gestiti da packages/realtime.
    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full items-center justify-center text-sm font-medium" aria-hidden>
      {entry.name.slice(0, 1).toUpperCase()}
    </span>
  );

  return (
    <li aria-label={tileLabel(entry)} className={/* classi del Task 1 invariate */}>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Mostra ${entry.name} a tutto schermo`}
          className="block h-full w-full"
        >
          {face}
        </button>
      ) : (
        face
      )}
      {/* <span> del nome invariato */}
    </li>
  );
}
```

- [ ] **Step 4: Sovrapposizione**

`spotlight-view.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { RosterEntry } from '@omnicanvas/realtime';

type Props = {
  entry: RosterEntry;
  local: RosterEntry | undefined;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  onClose: () => void;
};

// Una persona a tutto schermo dentro l'app: i controlli della call restano sotto.
export function SpotlightView({ entry, local, attachVideo, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const selfRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!entry.camOn || !videoRef.current) return;
    return attachVideo(entry.identity, videoRef.current);
  }, [attachVideo, entry.identity, entry.camOn]);

  useEffect(() => {
    if (!local?.camOn || !selfRef.current) return;
    return attachVideo(local.identity, selfRef.current);
  }, [attachVideo, local?.identity, local?.camOn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.name} a tutto schermo`}
      className="absolute inset-0 z-20 bg-black"
    >
      {entry.camOn ? (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      ) : (
        <span className="flex h-full items-center justify-center text-6xl font-medium" aria-hidden>
          {entry.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-sm">
        {entry.name}
      </span>
      {local?.camOn && (
        <video
          ref={selfRef}
          autoPlay
          playsInline
          muted
          aria-hidden
          className="absolute right-2 top-2 w-24 rounded object-cover phone-landscape:w-32"
        />
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi tutto schermo"
        className="absolute left-2 top-2 rounded-full bg-black/60 px-3 py-1 text-lg"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Collegare in `RoomCall`**

`room-call.tsx`: import `useCallback, useState` da `react`, `resolveSpotlight` da
`@/lib/call/spotlight`, `SpotlightView` da `./spotlight-view`. Dopo `const live = ...`:

```tsx
const [selected, setSelected] = useState<string | null>(null);
const spotlight = resolveSpotlight(selected, state.roster);
// Chi esce chiude lo spotlight: senza azzerare, rientrando lo riaprirebbe.
if (selected !== null && spotlight === null) setSelected(null);
const spotlightEntry = state.roster.find((entry) => entry.identity === spotlight);
const closeSpotlight = useCallback(() => setSelected(null), []);
```

Nell'`<ul>` delle tessere:

```tsx
<VideoTile
  key={entry.identity}
  entry={entry}
  attachVideo={attachVideo}
  onSelect={entry.isLocal ? undefined : () => setSelected(entry.identity)}
/>
```

Come ultimo figlio del `<div className="relative flex min-h-0 flex-1">`:

```tsx
{live && spotlightEntry && (
  <SpotlightView
    entry={spotlightEntry}
    local={local}
    attachVideo={attachVideo}
    onClose={closeSpotlight}
  />
)}
```

- [ ] **Step 6: Verificare**

Run (Codespace): `npx playwright test e2e/mobile-call.spec.ts e2e/call.spec.ts` → PASS
(anche `call.spec.ts`, che cerca le tessere per `listitem`).
Run (locale): `npm run typecheck && npm run lint` → nessun errore.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/room/[code]/spotlight-view.tsx" "apps/web/src/app/room/[code]/video-tile.tsx" "apps/web/src/app/room/[code]/room-call.tsx" e2e/mobile-call.spec.ts
git commit -m "feat(call): tap a face to show that participant full screen"
```

---

### Task 4: gira fotocamera

**Files:**
- Create: `packages/realtime/src/camera.ts`
- Modify: `packages/realtime/src/types.ts` (interfaccia `RealtimeSession`)
- Modify: `packages/realtime/src/livekit-session.ts` (`setCameraEnabled`, nuovi metodi)
- Modify: `apps/web/src/lib/call/use-call.ts` (`CallState.canSwitchCamera`, `switchCamera`)
- Modify: `apps/web/src/app/room/[code]/room-call.tsx` (pulsante)
- Test: `tests/unit/realtime-camera.test.ts`, `e2e/mobile-call.spec.ts` (aggiunta)

**Interfaces:**
- Produces:
  - `type FacingMode = 'user' | 'environment'`
  - `nextFacingMode(current: FacingMode): FacingMode`
  - `countVideoInputs(devices: readonly { kind: string }[]): number`
  - `createCameraPreference(): { get(): FacingMode; toggle(): FacingMode }`
  - `RealtimeSession.canSwitchCamera(): Promise<boolean>`
  - `RealtimeSession.switchCamera(): Promise<void>`
  - `useCall(...)` restituisce anche `switchCamera: () => void`; `CallState` ha
    `canSwitchCamera: boolean`.

- [ ] **Step 1: Test che fallisce**

`tests/unit/realtime-camera.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  countVideoInputs,
  createCameraPreference,
  nextFacingMode,
} from '../../packages/realtime/src/camera';

describe('camera helpers', () => {
  it('alternates front and back', () => {
    expect(nextFacingMode('user')).toBe('environment');
    expect(nextFacingMode('environment')).toBe('user');
  });

  it('counts only video inputs', () => {
    expect(
      countVideoInputs([{ kind: 'audioinput' }, { kind: 'videoinput' }, { kind: 'videoinput' }]),
    ).toBe(2);
    expect(countVideoInputs([{ kind: 'audiooutput' }])).toBe(0);
  });

  it('remembers the direction chosen while the camera was off', () => {
    const preference = createCameraPreference();
    expect(preference.get()).toBe('user');
    expect(preference.toggle()).toBe('environment');
    expect(preference.get()).toBe('environment');
  });
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx vitest run tests/unit/realtime-camera.test.ts`
Expected: FAIL, modulo `camera` non trovato.

- [ ] **Step 3: `camera.ts`**

```ts
// Fotocamera anteriore o posteriore. Nessun riferimento al vendor: si testa senza dispositivi.
export type FacingMode = 'user' | 'environment';

export function nextFacingMode(current: FacingMode): FacingMode {
  return current === 'user' ? 'environment' : 'user';
}

export function countVideoInputs(devices: readonly { kind: string }[]): number {
  return devices.filter((device) => device.kind === 'videoinput').length;
}

// La scelta vale anche a camera spenta: alla riaccensione si usa questa.
export function createCameraPreference() {
  let current: FacingMode = 'user';
  return {
    get: () => current,
    toggle: () => (current = nextFacingMode(current)),
  };
}
```

Run: `npx vitest run tests/unit/realtime-camera.test.ts` → PASS.

- [ ] **Step 4: Interfaccia e sessione LiveKit**

`types.ts`, in `RealtimeSession` dopo `setCameraEnabled`:

```ts
  // Vero se il dispositivo ha almeno due fotocamere (tipicamente un telefono).
  canSwitchCamera(): Promise<boolean>;
  // Anteriore ↔ posteriore. A camera spenta cambia solo la scelta per la riaccensione.
  switchCamera(): Promise<void>;
```

`livekit-session.ts`: import `LocalVideoTrack` da `livekit-client` e
`countVideoInputs, createCameraPreference` da `./camera`. In `connectToRoom`, dopo
`const room = ...`:

```ts
  const facing = createCameraPreference();
```

Sostituire `setCameraEnabled` e aggiungere i due metodi:

```ts
    async setCameraEnabled(enabled) {
      await room.localParticipant.setCameraEnabled(
        enabled,
        enabled ? { facingMode: facing.get() } : undefined,
      );
      emitRoster();
    },

    async canSwitchCamera() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return countVideoInputs(devices) >= 2;
    },

    async switchCamera() {
      const facingMode = facing.toggle();
      if (!room.localParticipant.isCameraEnabled) return;
      const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (track instanceof LocalVideoTrack) await track.restartTrack({ facingMode });
    },
```

- [ ] **Step 5: Hook e pulsante**

`use-call.ts`: `CallState` guadagna `canSwitchCamera: boolean` (`initialState`: `false`).
Dopo il `patch({ mediaError: ... })` in `connect`:

```ts
      const canSwitchCamera = await live.canSwitchCamera().catch(() => false);
      patch({ canSwitchCamera });
```

Nuova callback, restituita insieme alle altre:

```ts
  const switchCamera = useCallback(() => {
    sessionRef.current
      ?.switchCamera()
      .catch(() => setState((s) => ({ ...s, mediaError: MEDIA_ERROR_MESSAGE })));
  }, []);
```

`room-call.tsx`: prendere `switchCamera` da `useCall`; nella `<nav>`, dopo il pulsante
della camera:

```tsx
          {state.canSwitchCamera && (
            <button onClick={switchCamera} className="rounded bg-neutral-800 px-3 py-2 text-sm">
              Gira fotocamera
            </button>
          )}
```

- [ ] **Step 6: E2E**

Aggiungere a `e2e/mobile-call.spec.ts` (Chromium finto ha una sola fotocamera):

```ts
test('switch camera is hidden on a device with a single camera', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser);
  await expect(tiles(host)).toHaveCount(1, { timeout: 30_000 });
  await expect(host.getByRole('button', { name: 'Disattiva camera' })).toBeVisible();
  await expect(host.getByRole('button', { name: 'Gira fotocamera' })).toHaveCount(0);
});
```

- [ ] **Step 7: Verificare**

Run: `npx vitest run tests/unit/realtime-camera.test.ts` → PASS.
Run: `npm run typecheck && npm run lint` → nessun errore.
Run (Codespace): `npx playwright test e2e/mobile-call.spec.ts e2e/call.spec.ts` → PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/realtime/src/camera.ts packages/realtime/src/types.ts packages/realtime/src/livekit-session.ts apps/web/src/lib/call/use-call.ts "apps/web/src/app/room/[code]/room-call.tsx" tests/unit/realtime-camera.test.ts e2e/mobile-call.spec.ts
git commit -m "feat(realtime): switch between front and back camera on phones"
```

---

### Task 5: Picture-in-Picture di chi parla

**Files:**
- Create: `apps/web/src/lib/call/pip.ts`
- Create: `apps/web/src/app/room/[code]/pip-video.tsx`
- Modify: `packages/realtime/src/livekit-session.ts` (opzioni della `Room`)
- Modify: `apps/web/src/app/room/[code]/room-call.tsx`
- Test: `tests/unit/call-pip.test.ts`, `e2e/mobile-call.spec.ts` (aggiunta)

**Interfaces:**
- Consumes: `nextLastSpeaker`, `pipTarget` (Task 2), `spotlight` in `RoomCall` (Task 3).
- Produces:
  - `type PipMode = 'standard' | 'webkit' | null`
  - `pipMode(doc: PipDocLike, video: PipVideoLike): PipMode`
  - `openPip(doc: PipDocLike, video: PipVideoLike): Promise<boolean>`
  - `PipVideo({ identity, attachVideo, videoRef })`

- [ ] **Step 1: Test che fallisce**

`tests/unit/call-pip.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { openPip, pipMode } from '@/lib/call/pip';

describe('pipMode', () => {
  it('uses the standard API when the document allows it', () => {
    const video = { requestPictureInPicture: vi.fn() };
    expect(pipMode({ pictureInPictureEnabled: true }, video)).toBe('standard');
  });

  it('falls back to the WebKit presentation mode', () => {
    const video = {
      webkitSupportsPresentationMode: (mode: string) => mode === 'picture-in-picture',
      webkitSetPresentationMode: vi.fn(),
    };
    expect(pipMode({ pictureInPictureEnabled: false }, video)).toBe('webkit');
  });

  it('reports no support', () => {
    expect(pipMode({}, {})).toBeNull();
  });
});

describe('openPip', () => {
  it('opens with the standard API', async () => {
    const video = { requestPictureInPicture: vi.fn().mockResolvedValue({}) };
    await expect(openPip({ pictureInPictureEnabled: true }, video)).resolves.toBe(true);
    expect(video.requestPictureInPicture).toHaveBeenCalledOnce();
  });

  it('opens with WebKit', async () => {
    const video = {
      webkitSupportsPresentationMode: () => true,
      webkitSetPresentationMode: vi.fn(),
    };
    await expect(openPip({}, video)).resolves.toBe(true);
    expect(video.webkitSetPresentationMode).toHaveBeenCalledWith('picture-in-picture');
  });

  it('does nothing without support', async () => {
    await expect(openPip({}, {})).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire e vedere il fallimento**

Run: `npx vitest run tests/unit/call-pip.test.ts`
Expected: FAIL, modulo `@/lib/call/pip` non trovato.

- [ ] **Step 3: `pip.ts`**

```ts
// Picture-in-Picture: API standard (Chrome, Safari recente) o modalità WebKit (iOS).
export type PipDocLike = { pictureInPictureEnabled?: boolean };
export type PipVideoLike = {
  requestPictureInPicture?: () => Promise<unknown>;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
};
export type PipMode = 'standard' | 'webkit' | null;

export function pipMode(doc: PipDocLike, video: PipVideoLike): PipMode {
  if (doc.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
    return 'standard';
  }
  if (video.webkitSupportsPresentationMode?.('picture-in-picture')) return 'webkit';
  return null;
}

export async function openPip(doc: PipDocLike, video: PipVideoLike): Promise<boolean> {
  const mode = pipMode(doc, video);
  if (mode === 'standard') {
    await video.requestPictureInPicture!();
    return true;
  }
  if (mode === 'webkit') {
    video.webkitSetPresentationMode!('picture-in-picture');
    return true;
  }
  return false;
}
```

Run: `npx vitest run tests/unit/call-pip.test.ts` → PASS.

- [ ] **Step 4: LiveKit non ferma il video in background**

`livekit-session.ts`:

```ts
  // In background il video remoto deve continuare: il PiP lo mostra sopra le altre app.
  const room = new Room({ adaptiveStream: { pauseVideoInBackground: false }, dynacast: true });
```

- [ ] **Step 5: `PipVideo`**

`pip-video.tsx`:

```tsx
'use client';

import { useEffect, type RefObject } from 'react';
import { openPip } from '@/lib/call/pip';

type Props = {
  identity: string | null;
  attachVideo: (identity: string, element: HTMLVideoElement) => () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
};

// Video dedicato al PiP: renderizzato ma invisibile (display:none impedirebbe il PiP).
export function PipVideo({ identity, attachVideo, videoRef }: Props) {
  useEffect(() => {
    const video = videoRef.current;
    if (!identity || !video) return;
    return attachVideo(identity, video);
  }, [attachVideo, identity, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // iOS Safari: entra da solo in PiP quando l'app va in background.
    video.setAttribute('autopictureinpicture', '');
    // Chrome Android: le app di videochiamata possono entrare in PiP uscendo dall'app.
    const action = 'enterpictureinpicture' as MediaSessionAction;
    try {
      navigator.mediaSession?.setActionHandler(action, () => {
        void openPip(document, video);
      });
    } catch {
      // Azione non supportata: resta il pulsante «Riquadro».
    }
    return () => {
      try {
        navigator.mediaSession?.setActionHandler(action, null);
      } catch {
        // idem
      }
    };
  }, [videoRef]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      aria-hidden
      className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
    />
  );
}
```

- [ ] **Step 6: Collegare in `RoomCall`**

`room-call.tsx`: import `useEffect, useRef` da `react`, `nextLastSpeaker, pipTarget` da
`@/lib/call/spotlight`, `openPip, pipMode` da `@/lib/call/pip`, `PipVideo` da
`./pip-video`. Dopo le righe dello spotlight (Task 3):

```tsx
const [speaker, setSpeaker] = useState<{ roster: typeof state.roster; id: string | null }>({
  roster: state.roster,
  id: null,
});
// Aggiornato durante il render quando cambia il roster: niente effetto in più.
if (speaker.roster !== state.roster) {
  setSpeaker({ roster: state.roster, id: nextLastSpeaker(speaker.id, state.roster) });
}
const pipIdentity = pipTarget(state.roster, spotlight, speaker.id);
const pipRef = useRef<HTMLVideoElement>(null);
const [pipSupported, setPipSupported] = useState(false);
useEffect(() => {
  if (pipRef.current) setPipSupported(pipMode(document, pipRef.current) !== null);
}, [live]);
```

Dentro il blocco `{live && ...}` prima della `<nav>` (anche il `<video>` deve esistere solo
in call):

```tsx
{live && <PipVideo identity={pipIdentity} attachVideo={attachVideo} videoRef={pipRef} />}
```

Nella `<nav>`, dopo «Gira fotocamera»:

```tsx
          {pipSupported && pipIdentity && (
            <button
              onClick={() => {
                if (pipRef.current) void openPip(document, pipRef.current).catch(() => {});
              }}
              className="rounded bg-neutral-800 px-3 py-2 text-sm"
            >
              Riquadro
            </button>
          )}
```

- [ ] **Step 7: E2E**

Aggiungere a `e2e/mobile-call.spec.ts` (Chromium desktop supporta l'API standard):

```ts
test('picture-in-picture button opens the video of the other participant', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'headless PiP needs desktop Chromium');
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  await joinAsAnonymousGuest(browser, roomUrl);
  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });

  await host.getByRole('button', { name: 'Riquadro' }).click();
  await expect
    .poll(() => host.evaluate(() => document.pictureInPictureElement !== null), {
      timeout: 10_000,
    })
    .toBe(true);
});
```

Se il Chromium headless rifiuta il PiP, sostituire l'asserzione con la sola visibilità del
pulsante e annotarlo nel commit: il PiP vero si verifica a mano (Task 6).

- [ ] **Step 8: Verificare**

Run: `npx vitest run tests/unit` → tutti PASS.
Run: `npm run typecheck && npm run lint` → nessun errore.
Run (Codespace): `npx playwright test e2e/mobile-call.spec.ts e2e/call.spec.ts e2e/stage.spec.ts` → PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/call/pip.ts "apps/web/src/app/room/[code]/pip-video.tsx" packages/realtime/src/livekit-session.ts "apps/web/src/app/room/[code]/room-call.tsx" tests/unit/call-pip.test.ts e2e/mobile-call.spec.ts
git commit -m "feat(call): picture-in-picture of the active speaker, automatic where supported"
```

---

### Task 6: checklist su telefono, preview, chiusura

**Files:**
- Create: `docs/spikes/2026-09-27-spike-mobile-call.md`
- Modify: `docs/BACKLOG.md` (sezione «Mobile — richieste dal primo test»)
- Modify: `CLAUDE.md` (Stato attuale)

- [ ] **Step 1: Checklist**

`docs/spikes/2026-09-27-spike-mobile-call.md`:

```markdown
# Spike call da telefono — orizzontale, tutto schermo, fotocamera, PiP

Spec: `docs/specs/2026-09-27-mobile-call-design.md`. Preview: `omnicanvas-staging.vercel.app`.
Da fare su un iPhone (Safari) e un Android (Chrome), host da desktop.

| # | azione | atteso | iPhone | Android |
|---|---|---|---|---|
| 1 | ruota in orizzontale | header nascosto, palco a sinistra, volti a destra, «Esci» visibile | | |
| 2 | torna in verticale | layout di prima | | |
| 3 | tocca il volto dell'host | host a tutto schermo, tuo riquadro in alto, controlli sotto | | |
| 4 | ruota con lo spotlight aperto | resta aperto e leggibile | | |
| 5 | «✕» | torna alla vista normale | | |
| 6 | «Gira fotocamera» | l'host ti vede con la fotocamera posteriore | | |
| 7 | «Disattiva camera», «Gira fotocamera», «Attiva camera» | riparte con l'altra fotocamera | | |
| 8 | «Riquadro» | finestrella con l'host | | |
| 9 | vai alla home con la call aperta | PiP automatico con l'host (se no: annotare) | | |
| 10 | in PiP, parla un altro ospite | il PiP passa a lui | | |
| 11 | in PiP 30 s, poi rientra | la call è ancora connessa; l'host ti ha sentito | | |

## Risultati

Modello, versione del sistema, browser, data, esiti. Ogni controllo fallito diventa una
voce nel BACKLOG con il sintomo esatto.
```

- [ ] **Step 2: Preview**

```bash
npx vercel deploy --yes
npx vercel alias set <url-del-deploy> omnicanvas-staging.vercel.app
```

Verificare: `curl -s -o /dev/null -w "%{http_code}" https://omnicanvas-staging.vercel.app/login` → `200`.

- [ ] **Step 3: BACKLOG e CLAUDE.md**

In `docs/BACKLOG.md` spuntare le quattro voci mobile con il riferimento al piano
(`docs/plans/2026-09-27-mobile-call.md`). In `CLAUDE.md`, «Stato attuale»: aggiungere
`slice/mobile-call` fra i branch impilati (da `slice/5-gesture`) e il passo «Sean esegue
`docs/spikes/2026-09-27-spike-mobile-call.md`».

- [ ] **Step 4: Verifica finale e commit**

Run: `npm run verify` → PASS.

```bash
git add docs/spikes/2026-09-27-spike-mobile-call.md docs/BACKLOG.md CLAUDE.md
git commit -m "docs: mobile call phone checklist, backlog and resume notes"
git push -u origin slice/mobile-call
```

Poi riallineare `slice/4b-voce`: `git rebase slice/mobile-call` sul branch della voce
(i due commit di backlog e `.gitignore` sono già su entrambi e git li salta).
