# Slice 0 e 1 — Fondamenta, auth, stanza: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'host si registra, crea una stanza e condivide un link; un ospite entra da
quel link **senza account**, scegliendo nome e lingua, e si ritrova nella shell della
stanza (colonna volti più palco vuoto), anche dopo un refresh.

**Architecture:** monorepo npm workspaces. Next.js App Router in `apps/web`, Supabase
Postgres con RLS deny by default, tipi del DB in `packages/db`. La logica di stanza
vive in funzioni che ricevono un client Supabase (testabili contro il DB locale); le
server action sono gusci sottili. L'ospite senza account è identificato da una riga
in `room_participants` e da un cookie httpOnly firmato con HMAC.

**Tech Stack:** Node ≥ 22, Next.js (ultima stabile), React, TypeScript strict,
Tailwind, Supabase (`@supabase/supabase-js`, `@supabase/ssr`, CLI locale su Docker),
Zod, Vitest, Playwright.

**Spec:** `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (§2.1 ruoli, §2.5 mobile,
§4.10 autorizzazione, §8 slice 0-1). Leggere anche `docs/ARCHITECTURE.md` §11 e
`docs/DATA-MODEL.md`.

## Global Constraints

- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (da `tsconfig.base.json`).
- Nessun `any` senza commento che spieghi perché è inevitabile.
- Nuova tabella → policy RLS **nella stessa migrazione**, e un test che prova l'accesso da utente non autorizzato aspettandosi zero righe.
- Policy RLS sempre `to authenticated`; `anon` non ha policy e vede zero righe.
- Nessun segreto sotto `NEXT_PUBLIC_`. `SUPABASE_SERVICE_ROLE_KEY` e `GUEST_SESSION_SECRET` solo in moduli con `import 'server-only'`.
- Nessun contenuto di riunione in Postgres o nei log. Titolo stanza, nome visualizzato e lingua sono metadati.
- Variabile d'ambiente nuova → `docs/ENVIRONMENT.md` e `.env.example` nello stesso commit.
- Identificatori, commit e messaggi d'errore tecnici in inglese; commenti e testi UI in italiano.
- Commit: `<tipo>(<ambito>): <cosa>`, ambiti `web`, `db`, `ui`, `ci`.
- Branch: `slice/0-fondamenta` per i task 0.x, `slice/1-auth-stanza` per i task 1.x. Merge in `main` a fine slice.
- Test unitari in `tests/unit/` (niente rete, niente DB). Test sul DB in `tests/db/` (richiedono `npx supabase start`). E2E in `e2e/`.

## Mappa dei file

```
tsconfig.base.json                    modifica: via composite/declaration (niente project references)
tsconfig.json                         nuovo: typecheck di tests/, e2e/, config root
package.json                          modifica: script typecheck, test:unit, test:db
eslint.config.mjs                     nuovo
.prettierrc                           nuovo
vitest.config.ts                      nuovo: alias @ e server-only, carica .env.local
tests/stubs/server-only.ts            nuovo: stub vuoto per vitest
.github/workflows/ci.yml              modifica: test:unit, job db con Supabase locale
apps/web/                             nuovo, scaffolding Next.js
  tsconfig.json, package.json
  src/env-schema.ts                   schemi Zod puri (testabili)
  src/env.ts                          clientEnv e serverEnv() a runtime
  src/proxy.ts                        refresh sessione Supabase (Next 16; su 15 middleware.ts)
  src/lib/supabase/server.ts          client con cookie, currentUser()
  src/lib/supabase/admin.ts           service role, server-only
  src/lib/supabase/browser.ts         client browser
  src/lib/auth/next-path.ts           safeNextPath(): niente open redirect
  src/lib/auth/error-message.ts       authErrorMessage(): errori in italiano
  src/lib/rooms/join-code.ts          generazione e validazione codice
  src/lib/rooms/languages.ts          lingue supportate
  src/lib/rooms/create-room.ts        createRoomForUser()
  src/lib/rooms/join-room.ts          joinRoom()
  src/lib/rooms/guest-token.ts        firma e verifica del cookie ospite
  src/app/(auth)/actions.ts           signIn, signUp, signOut
  src/app/(auth)/auth-form.tsx        form condiviso login/registrazione
  src/app/(auth)/login/page.tsx
  src/app/(auth)/signup/page.tsx
  src/app/dashboard/page.tsx          elenco stanze e creazione
  src/app/dashboard/actions.ts        createRoomAction
  src/app/dashboard/create-room-form.tsx
  src/app/room/[code]/page.tsx        ingresso: host, ospite registrato, ospite anonimo
  src/app/room/[code]/actions.ts      joinAsGuestAction
  src/app/room/[code]/guest-join-form.tsx
  src/app/room/[code]/room-shell.tsx  colonna volti + palco, desktop e mobile
  src/app/room/[code]/ended.tsx
packages/db/                          nuovo: tipi generati del DB
  package.json, tsconfig.json, src/index.ts, src/database.types.ts
supabase/config.toml                  nuovo (supabase init)
supabase/migrations/0001_profiles_workspaces.sql
supabase/migrations/0002_rooms.sql
tests/unit/smoke.test.ts, env.test.ts, next-path.test.ts, auth-error.test.ts,
          join-code.test.ts, guest-token.test.ts
tests/db/helpers.ts, rls-workspaces.test.ts, rls-rooms.test.ts,
        create-room.test.ts, join-room.test.ts
playwright.config.ts, e2e/host-guest.spec.ts
docs/ENVIRONMENT.md, .env.example     modifica: GUEST_SESSION_SECRET
```

---

## Slice 0 — Fondamenta

Prima di iniziare: `git checkout -b slice/0-fondamenta`.

### Task 0.1: Tooling del workspace

**Files:**
- Modify: `tsconfig.base.json`, `package.json`
- Create: `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`, `tests/stubs/server-only.ts`, `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:db`; alias `@/…` → `apps/web/src/…` valido nei test.

- [ ] **Step 1: togli le project references dalla base**

Nessun package emette `.d.ts`: `composite` e `declaration` farebbero solo attrito con
Next (`noEmit`). In `tsconfig.base.json` rimuovi le righe `"declaration"`,
`"declarationMap"`, `"composite"`, `"incremental"` e aggiungi `"noEmit": true`. Il blocco
finale di `compilerOptions` diventa:

```json
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "noEmit": true
```

- [ ] **Step 2: crea `tsconfig.json` alla radice**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "@/*": ["apps/web/src/*"] }
  },
  "include": ["tests/**/*.ts", "e2e/**/*.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 3: installa le dipendenze di sviluppo**

```bash
npm install -D typescript@latest @types/node@22 eslint@latest @eslint/js typescript-eslint \
  eslint-plugin-react-hooks prettier@latest vitest@latest
```

- [ ] **Step 4: aggiorna gli script in `package.json`**

Sostituisci `typecheck`, `test` e aggiungi `test:unit`, `test:db`:

```json
    "typecheck": "tsc -p tsconfig.json && npm run typecheck --workspaces --if-present",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:db": "vitest run tests/db",
    "verify": "npm run typecheck && npm run lint && npm run test:unit",
```

- [ ] **Step 5: scrivi `eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'packages/db/src/database.types.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Step 6: scrivi `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 7: scrivi `tests/stubs/server-only.ts` e `vitest.config.ts`**

`tests/stubs/server-only.ts`:

```ts
// In vitest il pacchetto `server-only` lancerebbe: qui lo sostituiamo con un modulo vuoto.
export {};
```

`vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Carica .env.local: i test in tests/db leggono URL e chiavi di Supabase locale.
    env: loadEnv('test', process.cwd(), ''),
    // I test sul DB condividono utenti e tabelle: niente parallelismo fra file.
    fileParallelism: false,
  },
});
```

- [ ] **Step 8: scrivi il test di fumo**

`tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('tooling', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: verifica**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: nessun errore, `1 passed`.

- [ ] **Step 10: commit**

```bash
git add -A
git commit -m "chore(ci): workspace tooling with eslint, prettier, vitest unit/db split"
```

---

### Task 0.2: Applicazione Next.js

**Files:**
- Create: `apps/web/` (scaffolding), poi sovrascrivi `apps/web/tsconfig.json`, `apps/web/src/app/page.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: tooling del task 0.1.
- Produces: `npm run dev` su `:3000`; `npm run typecheck --workspace=apps/web`.

- [ ] **Step 1: scaffolding non interattivo, senza install e senza ESLint proprio**

Il lint è quello della radice. Se lo scaffolding crea `apps/web/.git` o
`apps/web/package-lock.json`, cancellali: repository e lockfile sono quelli della
radice.

```bash
npx create-next-app@latest apps/web --typescript --tailwind --no-eslint --app \
  --src-dir --import-alias "@/*" --use-npm --skip-install --yes
npm install
```

- [ ] **Step 2: annota la versione di Next**

Run: `npx --workspace=apps/web next --version`
Se è ≥ 16 il file di intercettazione si chiama `src/proxy.ts` ed esporta `proxy`
(task 1.1). Se è 15, `src/middleware.ts` ed esporta `middleware`. Scrivi la versione
nel messaggio di commit.

- [ ] **Step 3: sostituisci `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "allowJs": false,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

- [ ] **Step 4: aggiungi lo script di typecheck in `apps/web/package.json`**

Nel blocco `scripts` aggiungi `"typecheck": "tsc --noEmit"` e togli lo script `lint`
se lo scaffolding lo ha creato.

- [ ] **Step 5: pagina iniziale minima**

Sostituisci `apps/web/src/app/page.tsx`:

```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-2xl font-semibold">OmniCanvas</h1>
      <p className="max-w-md text-center text-neutral-400">
        Videochiamate con un palco generativo. Nessun contenuto resta sui nostri server.
      </p>
      <div className="flex gap-3">
        <Link className="rounded bg-neutral-100 px-4 py-2 text-neutral-900" href="/login">
          Accedi
        </Link>
        <Link className="rounded border border-neutral-700 px-4 py-2" href="/signup">
          Registrati
        </Link>
      </div>
    </main>
  );
}
```

Cancella gli asset d'esempio in `apps/web/public/` che la pagina non usa più.

- [ ] **Step 6: verifica**

Run: `npm run typecheck && npm run lint`
Expected: nessun errore. Se `noUnusedLocals` o `exactOptionalPropertyTypes` segnalano il
boilerplate, correggi il boilerplate, non le regole.

Run: `npm run dev`, apri `http://localhost:3000`
Expected: titolo "OmniCanvas" e due bottoni. Ferma con Ctrl+C.

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "feat(web): Next.js App Router scaffold with strict TypeScript (next <versione>)"
```

---

### Task 0.3: Validazione delle variabili d'ambiente

**Files:**
- Create: `apps/web/src/env-schema.ts`, `apps/web/src/env.ts`, `tests/unit/env.test.ts`
- Modify: `docs/ENVIRONMENT.md`, `.env.example`

**Interfaces:**
- Produces: `parseClientEnv(raw): ClientEnv`, `parseServerEnv(raw): ServerEnv` in
  `@/env-schema`; `clientEnv` e `serverEnv(): ServerEnv` in `@/env`.
  `ServerEnv = { SUPABASE_SERVICE_ROLE_KEY: string; GUEST_SESSION_SECRET: string }`.

Gli schemi stanno in un file puro: `env.ts` legge `process.env` all'import e
romperebbe i test.

- [ ] **Step 1: scrivi il test che fallisce**

`tests/unit/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseClientEnv, parseServerEnv } from '@/env-schema';

const clientOk = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
};

const serverOk = {
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  GUEST_SESSION_SECRET: 'x'.repeat(32),
};

describe('env', () => {
  it('accepts a valid client env', () => {
    expect(parseClientEnv(clientOk).NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
  });

  it('names the missing client variable', () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _omitted, ...incomplete } = clientOk;
    expect(() => parseClientEnv(incomplete)).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('rejects a malformed url', () => {
    expect(() => parseClientEnv({ ...clientOk, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('accepts a valid server env', () => {
    expect(parseServerEnv(serverOk).GUEST_SESSION_SECRET).toHaveLength(32);
  });

  it('rejects a short guest session secret', () => {
    expect(() => parseServerEnv({ ...serverOk, GUEST_SESSION_SECRET: 'short' })).toThrow(
      /GUEST_SESSION_SECRET/,
    );
  });
});
```

- [ ] **Step 2: verifica che fallisca**

Run: `npx vitest run tests/unit/env.test.ts`
Expected: FAIL, `Failed to resolve import "@/env-schema"`.

- [ ] **Step 3: installa Zod e implementa**

```bash
npm install zod --workspace=apps/web
```

`apps/web/src/env-schema.ts`:

```ts
import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Firma il cookie dell'ospite senza account: corto = falsificabile.
  GUEST_SESSION_SECRET: z.string().min(32),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

type RawEnv = Record<string, string | undefined>;

function parse<T>(schema: z.ZodType<T>, raw: RawEnv, scope: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing ${scope} env: ${names}`);
  }
  return result.data;
}

export function parseClientEnv(raw: RawEnv): ClientEnv {
  return parse(clientSchema, raw, 'client');
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  return parse(serverSchema, raw, 'server');
}
```

`apps/web/src/env.ts`:

```ts
import { parseClientEnv, parseServerEnv, type ServerEnv } from './env-schema';

// Le NEXT_PUBLIC_ vanno lette una per una: Next le sostituisce a build time solo così.
export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

let cachedServerEnv: ServerEnv | undefined;

// Chiamata solo da moduli server-only. Pigra per non rompere la build del client.
export function serverEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET,
  });
  return cachedServerEnv;
}
```

- [ ] **Step 4: verifica che passi**

Run: `npx vitest run tests/unit/env.test.ts`
Expected: `5 passed`.

- [ ] **Step 5: documenta la variabile nuova**

In `docs/ENVIRONMENT.md`, tabella "Server, segrete", aggiungi dopo
`SUPABASE_SERVICE_ROLE_KEY`:

```markdown
| `GUEST_SESSION_SECRET` | firma HMAC del cookie dell'ospite senza account. Almeno 32 caratteri |
```

In `.env.example`, dopo `SUPABASE_SERVICE_ROLE_KEY=…`:

```bash
# Firma il cookie dell'ospite senza account. Genera con: openssl rand -hex 32
GUEST_SESSION_SECRET=sostituisci_con_64_caratteri_esadecimali_casuali_0000000000000000
```

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "feat(web): zod env validation with fail-fast on startup, GUEST_SESSION_SECRET"
```

---

### Task 0.4: Supabase locale, `packages/db`, migrazione 0001

**Files:**
- Create: `supabase/config.toml` (via CLI), `supabase/migrations/0001_profiles_workspaces.sql`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`, `packages/db/src/database.types.ts` (generato)
- Create: `tests/db/helpers.ts`, `tests/db/rls-workspaces.test.ts`
- Modify: `.github/workflows/ci.yml`, `package.json` (script `db:types`)

**Interfaces:**
- Produces: tabelle `profiles`, `workspaces`, `workspace_members`; funzione SQL
  `public.is_workspace_member(ws uuid) returns boolean`; tipo `Database` da
  `@omnicanvas/db`; helper di test `admin`, `createTestUser(prefix): Promise<TestUser>`,
  `signedInClient(user): Promise<SupabaseClient<Database>>`, `anonClient()`,
  con `TestUser = { id: string; email: string; password: string }`.

Prerequisito: Docker Desktop acceso.

- [ ] **Step 1: inizializza e avvia Supabase locale**

```bash
npm install -D supabase
npx supabase init
npx supabase start
npx supabase status -o env
```

Copia i valori in `.env.local` (crealo da `.env.example`):
`API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`. Genera `GUEST_SESSION_SECRET` con
`openssl rand -hex 32`. Verifica in `supabase/config.toml` che sotto `[auth.email]`
ci sia `enable_confirmations = false` (default locale: la registrazione dà subito una
sessione).

- [ ] **Step 2: scrivi gli helper dei test DB**

`tests/db/helpers.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';

const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing: run "npx supabase start" and fill .env.local`);
  return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, noSession);

export type TestUser = { id: string; email: string; password: string };

export async function createTestUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${crypto.randomUUID()}@test.local`;
  const password = 'test-password-123';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  return { id: data.user.id, email, password };
}

export async function signedInClient(user: TestUser): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return client;
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, noSession);
}
```

- [ ] **Step 3: crea `packages/db` con un tipo provvisorio**

`packages/db/package.json`:

```json
{
  "name": "@omnicanvas/db",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

`packages/db/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`packages/db/src/index.ts`:

```ts
export type { Database } from './database.types';
```

`packages/db/src/database.types.ts` (verrà sovrascritto al passo 7):

```ts
// Generato da `npm run db:types`. Non modificare a mano.
export type Database = Record<string, never>;
```

Installa e collega:

```bash
npm install @supabase/supabase-js
npm install @omnicanvas/db@* --workspace=apps/web
```

In `package.json` alla radice, sostituisci lo script `db:types`:

```json
    "db:types": "supabase gen types typescript --local > packages/db/src/database.types.ts",
```

- [ ] **Step 4: scrivi il test RLS che fallisce**

`tests/db/rls-workspaces.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, createTestUser, signedInClient, type TestUser } from './helpers';

describe('RLS on profiles, workspaces, workspace_members', () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createTestUser('alice');
    bob = await createTestUser('bob');
  });

  it('signup creates profile, free workspace with zero credits, owner membership', async () => {
    const client = await signedInClient(alice);
    const { data: workspaces } = await client.from('workspaces').select('id, plan, credits_balance');
    expect(workspaces).toHaveLength(1);
    expect(workspaces?.[0]?.plan).toBe('free');
    expect(workspaces?.[0]?.credits_balance).toBe(0);

    const { data: members } = await client.from('workspace_members').select('role');
    expect(members).toEqual([{ role: 'owner' }]);

    const { data: profiles } = await client.from('profiles').select('id');
    expect(profiles).toEqual([{ id: alice.id }]);
  });

  it('a user never sees another user workspace, membership or profile', async () => {
    const client = await signedInClient(bob);
    const { data: aliceWs } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', alice.id)
      .single();

    const { data: ws } = await client.from('workspaces').select('id').eq('id', aliceWs!.id);
    expect(ws).toHaveLength(0);

    const { data: members } = await client
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', alice.id);
    expect(members).toHaveLength(0);

    const { data: profiles } = await client.from('profiles').select('id').eq('id', alice.id);
    expect(profiles).toHaveLength(0);
  });

  it('a user cannot change credits on their own workspace', async () => {
    const client = await signedInClient(alice);
    const { data: ws } = await client.from('workspaces').select('id').single();
    await client.from('workspaces').update({ credits_balance: 999 }).eq('id', ws!.id);
    const { data: after } = await admin
      .from('workspaces')
      .select('credits_balance')
      .eq('id', ws!.id)
      .single();
    expect(after?.credits_balance).toBe(0);
  });

  it('anon reads nothing', async () => {
    const client = anonClient();
    for (const table of ['profiles', 'workspaces', 'workspace_members'] as const) {
      const { data } = await client.from(table).select('*');
      expect(data).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 5: verifica che fallisca**

Run: `npm run test:db -- tests/db/rls-workspaces.test.ts`
Expected: FAIL, errori `relation "public.workspaces" does not exist` o risultati `null`.

- [ ] **Step 6: scrivi la migrazione**

`supabase/migrations/0001_profiles_workspaces.sql`:

```sql
-- Metadati soli (ADR-0001). Nessuna colonna contiene contenuto di riunione.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  -- Solo 'free' nell'MVP: gli altri piani arrivano con Stripe (spec §6).
  plan text not null default 'free' check (plan in ('free')),
  -- Cache del saldo: la verità sarà credit_ledger (slice 4). Si parte da zero.
  credits_balance integer not null default 0 check (credits_balance >= 0),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- Una policy su workspace_members che interroga workspace_members va in ricorsione.
-- La funzione security definer legge senza RLS e spezza il ciclo.
create function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "user reads own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "user updates own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "member reads own workspaces"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

-- Nessuna policy di update su workspaces: piano e crediti li cambia solo il service role.

create policy "member reads memberships of own workspaces"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Alla registrazione: profilo, workspace personale, membership owner.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  insert into public.workspaces (name, owner_id)
  values ('Il mio workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 7: applica e genera i tipi**

```bash
npx supabase db reset
npm run db:types
```

Expected: `packages/db/src/database.types.ts` contiene `workspaces`, `profiles`,
`workspace_members` e `is_workspace_member`.

- [ ] **Step 8: verifica che passi**

Run: `npm run test:db -- tests/db/rls-workspaces.test.ts && npm run typecheck`
Expected: `4 passed`, typecheck pulito.

- [ ] **Step 9: CI — unit nel job esistente, DB in un job nuovo**

In `.github/workflows/ci.yml`, job `verify`, sostituisci il passo `Test` con:

```yaml
      - name: Unit tests
        run: npm run test:unit
```

Aggiungi il job, allo stesso livello di `verify`:

```yaml
  db:
    name: RLS e integrazione su Supabase locale
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install
        run: npm ci

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: supabase start

      - name: Export env
        run: |
          eval "$(supabase status -o env)"
          echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL" >> "$GITHUB_ENV"
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY" >> "$GITHUB_ENV"
          echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" >> "$GITHUB_ENV"
          echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> "$GITHUB_ENV"
          echo "GUEST_SESSION_SECRET=$(openssl rand -hex 32)" >> "$GITHUB_ENV"

      - name: DB tests
        run: npm run test:db
```

- [ ] **Step 10: commit**

```bash
git add -A
git commit -m "feat(db): profiles/workspaces schema with RLS, signup trigger, generated types"
```

---

### Task 0.5: Preview su Vercel e chiusura della slice 0

Richiede Sean: servono account Supabase Cloud e Vercel. Entrambi i free tier bastano.

**Files:**
- Modify: `docs/BACKLOG.md`, `CLAUDE.md`

- [ ] **Step 1: progetto Supabase Cloud (Sean)**

Crea un progetto dalla dashboard Supabase (regione UE, es. Francoforte). Poi:

```bash
npx supabase login
npx supabase link --project-ref <ref-del-progetto>
npx supabase db push
```

In Authentication → URL Configuration imposta Site URL all'URL di preview Vercel
quando ce l'hai (passo 3).

- [ ] **Step 2: progetto Vercel (Sean)**

```bash
npx vercel link
```

In Settings → General del progetto imposta **Root Directory** = `apps/web`. Poi,
per l'ambiente Preview:

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
npx vercel env add NEXT_PUBLIC_APP_URL preview
npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
npx vercel env add GUEST_SESSION_SECRET preview
```

- [ ] **Step 3: deploy di preview**

Run: `npx vercel deploy`
Expected: URL di preview che mostra la pagina "OmniCanvas".

- [ ] **Step 4: verifica completa**

Run: `npm run verify && npm run test:db`
Expected: tutto verde.

- [ ] **Step 5: aggiorna backlog e stato**

In `docs/BACKLOG.md` spunta le voci della slice 0. In `CLAUDE.md`, sezione "Stato
attuale", scrivi: slice 0 completata, prossima slice 1.

- [ ] **Step 6: merge**

```bash
git add -A
git commit -m "docs: close slice 0"
git checkout main
git merge --no-ff slice/0-fondamenta -m "Merge slice/0-fondamenta"
```

---

## Slice 1 — Auth e stanza

Prima di iniziare: `git checkout -b slice/1-auth-stanza`.

### Task 1.1: Client Supabase, sessione, login e registrazione

**Files:**
- Create: `apps/web/src/lib/supabase/server.ts`, `admin.ts`, `browser.ts`
- Create: `apps/web/src/proxy.ts` (o `middleware.ts`, vedi task 0.2)
- Create: `apps/web/src/lib/auth/next-path.ts`, `apps/web/src/lib/auth/error-message.ts`
- Create: `apps/web/src/app/(auth)/actions.ts`, `auth-form.tsx`, `login/page.tsx`, `signup/page.tsx`
- Test: `tests/unit/next-path.test.ts`, `tests/unit/auth-error.test.ts`

**Interfaces:**
- Consumes: `clientEnv`, `serverEnv()` (task 0.3); `Database` (task 0.4).
- Produces: `createServerSupabase(): Promise<SupabaseClient<Database>>`,
  `currentUser(): Promise<User | null>`, `createAdminSupabase(): SupabaseClient<Database>`,
  `safeNextPath(next: string | null | undefined): string`,
  `authErrorMessage(code: string | undefined): string`,
  server action `signOut(): Promise<never>`.

- [ ] **Step 1: scrivi i test che falliscono**

`tests/unit/next-path.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/auth/next-path';

describe('safeNextPath', () => {
  it('keeps a same-origin path', () => {
    expect(safeNextPath('/room/ABCD2345')).toBe('/room/ABCD2345');
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['https://evil.example'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
  ])('falls back to /dashboard for %s', (value) => {
    expect(safeNextPath(value)).toBe('/dashboard');
  });
});
```

`tests/unit/auth-error.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '@/lib/auth/error-message';

describe('authErrorMessage', () => {
  it('explains wrong credentials', () => {
    expect(authErrorMessage('invalid_credentials')).toBe('Email o password non corretti.');
  });

  it('explains an existing account', () => {
    expect(authErrorMessage('user_already_exists')).toBe(
      'Esiste già un account con questa email. Prova ad accedere.',
    );
  });

  it('explains an unconfirmed email', () => {
    expect(authErrorMessage('email_not_confirmed')).toBe(
      "Conferma l'email dal link che ti abbiamo mandato, poi accedi.",
    );
  });

  it('explains a weak password', () => {
    expect(authErrorMessage('weak_password')).toBe(
      'Password troppo debole: usa almeno 8 caratteri.',
    );
  });

  it('never returns a generic message for unknown codes', () => {
    expect(authErrorMessage('something_new')).toBe(
      'Accesso non riuscito (something_new). Riprova tra poco.',
    );
    expect(authErrorMessage(undefined)).toBe(
      'Accesso non riuscito (unknown). Riprova tra poco.',
    );
  });
});
```

- [ ] **Step 2: verifica che falliscano**

Run: `npx vitest run tests/unit/next-path.test.ts tests/unit/auth-error.test.ts`
Expected: FAIL, moduli non trovati.

- [ ] **Step 3: implementa le due funzioni pure**

`apps/web/src/lib/auth/next-path.ts`:

```ts
const FALLBACK = '/dashboard';

// Accetta solo percorsi interni: niente "//host", "/\host" o schemi, che il browser
// interpreterebbe come un altro sito (open redirect).
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return FALLBACK;
  if (next.startsWith('//') || next.startsWith('/\\')) return FALLBACK;
  return next;
}
```

`apps/web/src/lib/auth/error-message.ts`:

```ts
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o password non corretti.',
  user_already_exists: 'Esiste già un account con questa email. Prova ad accedere.',
  email_not_confirmed: "Conferma l'email dal link che ti abbiamo mandato, poi accedi.",
  weak_password: 'Password troppo debole: usa almeno 8 caratteri.',
};

export function authErrorMessage(code: string | undefined): string {
  const key = code ?? 'unknown';
  return MESSAGES[key] ?? `Accesso non riuscito (${key}). Riprova tra poco.`;
}
```

- [ ] **Step 4: verifica che passino**

Run: `npx vitest run tests/unit/next-path.test.ts tests/unit/auth-error.test.ts`
Expected: `13 passed`.

- [ ] **Step 5: installa e scrivi i client Supabase**

```bash
npm install @supabase/supabase-js @supabase/ssr server-only --workspace=apps/web
```

`apps/web/src/lib/supabase/server.ts`:

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@omnicanvas/db';
import { clientEnv } from '@/env';

export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            for (const { name, value, options } of items) store.set(name, value, options);
          } catch {
            // Chiamato da un Server Component: i cookie li rinfresca il proxy.
          }
        },
      },
    },
  );
}

export async function currentUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
```

`apps/web/src/lib/supabase/admin.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { clientEnv, serverEnv } from '@/env';

// Bypassa RLS. Solo in route e action server che hanno già verificato chi chiede.
export function createAdminSupabase() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

`apps/web/src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@omnicanvas/db';
import { clientEnv } from '@/env';

export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

- [ ] **Step 6: rinfresco della sessione**

`apps/web/src/proxy.ts` (Next ≥ 16; su Next 15 chiamalo `middleware.ts` e rinomina
la funzione esportata in `middleware`):

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clientEnv } from '@/env';

// Rinfresca il token di sessione a ogni richiesta. Non autorizza nulla:
// i controlli stanno nelle pagine e nelle action.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          for (const { name, value } of items) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of items) response.cookies.set(name, value, options);
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 7: server action di autenticazione**

`apps/web/src/app/(auth)/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { authErrorMessage } from '@/lib/auth/error-message';
import { safeNextPath } from '@/lib/auth/next-path';
import { createServerSupabase } from '@/lib/supabase/server';

export type AuthState = { error: string | null; info: string | null };

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    next: safeNextPath(String(formData.get('next') ?? '')),
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.code), info: null };
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  const displayName = String(formData.get('display_name') ?? '').trim();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) return { error: authErrorMessage(error.code), info: null };
  // Con la conferma email attiva (cloud) non c'è ancora una sessione.
  if (!data.session) {
    return { error: null, info: "Ti abbiamo mandato un'email: conferma l'indirizzo, poi accedi." };
  }
  redirect(next);
}

export async function signOut(): Promise<never> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}
```

- [ ] **Step 8: form e pagine**

`apps/web/src/app/(auth)/auth-form.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { AuthState } from './actions';

type Props = {
  mode: 'login' | 'signup';
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next: string;
};

const initialState: AuthState = { error: null, info: null };

export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === 'signup';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-xl font-semibold">{isSignup ? 'Crea un account' : 'Accedi'}</h1>
        <input type="hidden" name="next" value={next} />
        {isSignup && (
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input name="display_name" required maxLength={40} className="rounded bg-neutral-900 px-3 py-2" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className="rounded bg-neutral-900 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            className="rounded bg-neutral-900 px-3 py-2"
          />
        </label>
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        {state.info && <p role="status" className="text-sm text-emerald-400">{state.info}</p>}
        <button disabled={pending} className="rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-50">
          {isSignup ? 'Registrati' : 'Entra'}
        </button>
        <p className="text-sm text-neutral-400">
          {isSignup ? 'Hai già un account? ' : 'Non hai un account? '}
          <Link className="underline" href={`/${isSignup ? 'login' : 'signup'}?next=${encodeURIComponent(next)}`}>
            {isSignup ? 'Accedi' : 'Registrati'}
          </Link>
        </p>
      </form>
    </main>
  );
}
```

`apps/web/src/app/(auth)/login/page.tsx`:

```tsx
import { safeNextPath } from '@/lib/auth/next-path';
import { signIn } from '../actions';
import { AuthForm } from '../auth-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="login" action={signIn} next={safeNextPath(next)} />;
}
```

`apps/web/src/app/(auth)/signup/page.tsx`:

```tsx
import { safeNextPath } from '@/lib/auth/next-path';
import { signUp } from '../actions';
import { AuthForm } from '../auth-form';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" action={signUp} next={safeNextPath(next)} />;
}
```

- [ ] **Step 9: verifica e prova manuale**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: tutto verde.

Prova: `npm run dev`, registrati su `/signup` → finisci su `/dashboard` (404 per ora,
è il task 1.4). In Supabase Studio (`http://127.0.0.1:54323`) esistono una riga in
`profiles`, una in `workspaces`, una in `workspace_members`. Esci cancellando i
cookie, accedi su `/login` con password sbagliata → "Email o password non corretti."

- [ ] **Step 10: commit**

```bash
git add -A
git commit -m "feat(web): supabase clients, session proxy, signup and login with explicit errors"
```

---

### Task 1.2: Migrazione 0002 — rooms e room_participants

**Files:**
- Create: `supabase/migrations/0002_rooms.sql`, `tests/db/rls-rooms.test.ts`
- Modify: `packages/db/src/database.types.ts` (rigenerato)

**Interfaces:**
- Consumes: `is_workspace_member(uuid)` e helper di test (task 0.4).
- Produces: tabelle `rooms` e `room_participants` come in `docs/DATA-MODEL.md`.

- [ ] **Step 1: scrivi il test che fallisce**

`tests/db/rls-rooms.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { generateJoinCode } from '@/lib/rooms/join-code';
import { admin, anonClient, createTestUser, signedInClient, type TestUser } from './helpers';

// Il DB locale non si azzera fra un'esecuzione e l'altra: codici sempre nuovi.

async function workspaceOf(user: TestUser): Promise<string> {
  const { data, error } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (error || !data) throw error ?? new Error('workspace not found');
  return data.id;
}

describe('RLS on rooms and room_participants', () => {
  let host: TestUser;
  let stranger: TestUser;
  let roomId: string;

  beforeAll(async () => {
    host = await createTestUser('host');
    stranger = await createTestUser('stranger');
    const client = await signedInClient(host);
    const { data, error } = await client
      .from('rooms')
      .insert({
        workspace_id: await workspaceOf(host),
        created_by: host.id,
        title: 'Kickoff',
        join_code: generateJoinCode(),
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('insert failed');
    roomId = data.id;
    await admin.from('room_participants').insert({
      room_id: roomId,
      user_id: host.id,
      role: 'host',
      display_name: 'Host',
      language: 'it',
    });
  });

  it('the creator sees the room and its participants', async () => {
    const client = await signedInClient(host);
    const { data: rooms } = await client.from('rooms').select('id').eq('id', roomId);
    expect(rooms).toHaveLength(1);
    const { data: participants } = await client
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId);
    expect(participants).toEqual([{ role: 'host' }]);
  });

  it('a user of another workspace sees nothing', async () => {
    const client = await signedInClient(stranger);
    const { data: rooms } = await client.from('rooms').select('id').eq('id', roomId);
    expect(rooms).toHaveLength(0);
    const { data: participants } = await client
      .from('room_participants')
      .select('id')
      .eq('room_id', roomId);
    expect(participants).toHaveLength(0);
  });

  it('anon sees nothing', async () => {
    const client = anonClient();
    const { data: rooms } = await client.from('rooms').select('id');
    expect(rooms).toHaveLength(0);
    const { data: participants } = await client.from('room_participants').select('id');
    expect(participants).toHaveLength(0);
  });

  it('a user cannot create a room in a workspace they do not belong to', async () => {
    const client = await signedInClient(stranger);
    const { error } = await client.from('rooms').insert({
      workspace_id: await workspaceOf(host),
      created_by: stranger.id,
      title: 'Intrusion',
      join_code: generateJoinCode(),
    });
    expect(error?.code).toBe('42501');
  });

  it('a user cannot create a room that is already active', async () => {
    const client = await signedInClient(host);
    const { error } = await client.from('rooms').insert({
      workspace_id: await workspaceOf(host),
      created_by: host.id,
      title: 'Shortcut',
      join_code: generateJoinCode(),
      status: 'active',
    });
    expect(error?.code).toBe('42501');
  });

  it('users cannot write participants directly', async () => {
    const client = await signedInClient(host);
    const { error } = await client.from('room_participants').insert({
      room_id: roomId,
      role: 'guest',
      display_name: 'Fake',
      language: 'it',
    });
    expect(error?.code).toBe('42501');
  });

  it('a room has at most one host', async () => {
    const { error } = await admin.from('room_participants').insert({
      room_id: roomId,
      user_id: stranger.id,
      role: 'host',
      display_name: 'Second host',
      language: 'it',
    });
    expect(error?.code).toBe('23505');
  });
});
```

- [ ] **Step 2: verifica che fallisca**

Run: `npm run test:db -- tests/db/rls-rooms.test.ts`
Expected: FAIL, `relation "public.rooms" does not exist` (e typecheck rosso finché
i tipi non vengono rigenerati: è atteso).

- [ ] **Step 3: scrivi la migrazione**

`supabase/migrations/0002_rooms.sql`:

```sql
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 120),
  join_code text not null unique,
  status text not null default 'created'
    check (status in ('created', 'active', 'closing', 'closed', 'purged')),
  -- Valorizzato = «offro io» attivo: tetto di crediti per ospite (spec §2.6, slice 7).
  guest_credit_cap integer check (guest_credit_cap is null or guest_credit_cap >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_status_started_at_idx on public.rooms (status, started_at);

create table public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  -- Null = ospite senza account.
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('host', 'guest')),
  display_name text not null check (char_length(display_name) between 1 and 40),
  language text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_seconds integer
);

create index room_participants_room_id_idx on public.room_participants (room_id);
create unique index room_participants_one_host_idx
  on public.room_participants (room_id) where role = 'host';

alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;

create policy "member reads rooms of own workspaces"
  on public.rooms for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "member creates rooms in own workspaces"
  on public.rooms for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_workspace_member(workspace_id)
    and status = 'created'
    and guest_credit_cap is null
  );

-- Nessuna policy di update/delete su rooms: gli stati li cambia il server (service role).

create policy "member reads participants of own workspace rooms"
  on public.room_participants for select to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id and public.is_workspace_member(r.workspace_id)
    )
  );

-- Nessuna policy di insert/update su room_participants: l'ingresso passa dal server.
```

- [ ] **Step 4: applica, rigenera i tipi, verifica**

```bash
npx supabase db reset
npm run db:types
npm run test:db
npm run typecheck
```

Expected: `rls-workspaces` 4 passed, `rls-rooms` 7 passed, typecheck pulito.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "feat(db): rooms and room_participants with RLS, one host per room"
```

---

### Task 1.3: Join code e lingue supportate

**Files:**
- Create: `apps/web/src/lib/rooms/join-code.ts`, `apps/web/src/lib/rooms/languages.ts`, `tests/unit/join-code.test.ts`

Nota: il task 1.2 usa già `generateJoinCode()` nel suo test. Se esegui i task in
ordine, nel task 1.2 crea subito `join-code.ts` con il codice del passo 3 qui sotto;
questo task aggiunge poi test e lingue.

**Interfaces:**
- Produces: `generateJoinCode(): string`, `isValidJoinCode(value: string): boolean`,
  `SUPPORTED_LANGUAGES` (tupla readonly), `type Language`, `isLanguage(v: string): v is Language`,
  `LANGUAGE_LABELS: Record<Language, string>`.

- [ ] **Step 1: scrivi il test che fallisce**

`tests/unit/join-code.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateJoinCode, isValidJoinCode } from '@/lib/rooms/join-code';
import { isLanguage } from '@/lib/rooms/languages';

describe('join code', () => {
  it('has 8 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateJoinCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it('does not repeat over a thousand draws', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateJoinCode()));
    expect(codes.size).toBe(1000);
  });

  it('validates the format', () => {
    expect(isValidJoinCode(generateJoinCode())).toBe(true);
    expect(isValidJoinCode('abc')).toBe(false);
    expect(isValidJoinCode('OIL01234')).toBe(false);
    expect(isValidJoinCode('abcdefgh')).toBe(false);
  });
});

describe('languages', () => {
  it('accepts supported languages only', () => {
    expect(isLanguage('it')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('xx')).toBe(false);
  });
});
```

- [ ] **Step 2: verifica che fallisca**

Run: `npx vitest run tests/unit/join-code.test.ts`
Expected: FAIL, moduli non trovati.

- [ ] **Step 3: implementa**

`apps/web/src/lib/rooms/join-code.ts`:

```ts
import { randomInt } from 'node:crypto';

// Niente O, I, L, 0, 1: si confondono quando il codice si legge ad alta voce.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function isValidJoinCode(value: string): boolean {
  return value.length === LENGTH && [...value].every((char) => ALPHABET.includes(char));
}
```

`apps/web/src/lib/rooms/languages.ts`:

```ts
// Lingue dei sottotitoli (slice 6). Si allarga quando il provider di traduzione è scelto.
export const SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'fr', 'de'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
```

- [ ] **Step 4: verifica che passi**

Run: `npx vitest run tests/unit/join-code.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "feat(web): join code with unambiguous alphabet, supported languages"
```

---

### Task 1.4: Creazione stanza e dashboard

**Files:**
- Create: `apps/web/src/lib/rooms/create-room.ts`, `tests/db/create-room.test.ts`
- Create: `apps/web/src/app/dashboard/actions.ts`, `apps/web/src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `generateJoinCode()` (1.3), `createServerSupabase()`, `currentUser()`, `signOut()` (1.1).
- Produces:
  ```ts
  type CreateRoomResult =
    | { ok: true; id: string; joinCode: string }
    | { ok: false; error: 'INVALID_TITLE' | 'NO_WORKSPACE' | 'JOIN_CODE_COLLISION' };
  createRoomForUser(
    supabase: SupabaseClient<Database>,
    userId: string,
    input: { title: string },
    nextCode?: () => string,
  ): Promise<CreateRoomResult>
  ```

La funzione riceve il client autenticato: la RLS fa da secondo cancello anche qui.

- [ ] **Step 1: scrivi il test che fallisce**

`tests/db/create-room.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { generateJoinCode } from '@/lib/rooms/join-code';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

describe('createRoomForUser', () => {
  let host: TestUser;

  beforeAll(async () => {
    host = await createTestUser('creator');
  });

  it('creates a room in the user workspace', async () => {
    const client = await signedInClient(host);
    const result = await createRoomForUser(client, host.id, { title: '  Kickoff Acme  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data } = await admin
      .from('rooms')
      .select('title, status, created_by, join_code')
      .eq('id', result.id)
      .single();
    expect(data).toEqual({
      title: 'Kickoff Acme',
      status: 'created',
      created_by: host.id,
      join_code: result.joinCode,
    });
  });

  it('rejects an empty title', async () => {
    const client = await signedInClient(host);
    expect(await createRoomForUser(client, host.id, { title: '   ' })).toEqual({
      ok: false,
      error: 'INVALID_TITLE',
    });
  });

  it('retries on a join code collision', async () => {
    const client = await signedInClient(host);
    const first = await createRoomForUser(client, host.id, { title: 'First' });
    if (!first.ok) throw new Error('setup failed');

    const fresh = generateJoinCode();
    const codes = [first.joinCode, fresh];
    const second = await createRoomForUser(client, host.id, { title: 'Second' }, () => codes.shift()!);
    expect(second).toMatchObject({ ok: true, joinCode: fresh });
  });

  it('gives up after three collisions', async () => {
    const client = await signedInClient(host);
    const first = await createRoomForUser(client, host.id, { title: 'Taken' });
    if (!first.ok) throw new Error('setup failed');
    const result = await createRoomForUser(client, host.id, { title: 'Stuck' }, () => first.joinCode);
    expect(result).toEqual({ ok: false, error: 'JOIN_CODE_COLLISION' });
  });
});
```

- [ ] **Step 2: verifica che fallisca**

Run: `npm run test:db -- tests/db/create-room.test.ts`
Expected: FAIL, modulo `@/lib/rooms/create-room` non trovato.

- [ ] **Step 3: implementa**

`apps/web/src/lib/rooms/create-room.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@omnicanvas/db';
import { generateJoinCode } from './join-code';

const titleSchema = z.string().trim().min(1).max(120);
const MAX_ATTEMPTS = 3;
const UNIQUE_VIOLATION = '23505';

export type CreateRoomResult =
  | { ok: true; id: string; joinCode: string }
  | { ok: false; error: 'INVALID_TITLE' | 'NO_WORKSPACE' | 'JOIN_CODE_COLLISION' };

export async function createRoomForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { title: string },
  nextCode: () => string = generateJoinCode,
): Promise<CreateRoomResult> {
  const title = titleSchema.safeParse(input.title);
  if (!title.success) return { ok: false, error: 'INVALID_TITLE' };

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  if (!membership) return { ok: false, error: 'NO_WORKSPACE' };

  // Collisione improbabile ma possibile: si ritenta con un codice nuovo.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        workspace_id: membership.workspace_id,
        created_by: userId,
        title: title.data,
        join_code: nextCode(),
      })
      .select('id, join_code')
      .single();
    if (data) return { ok: true, id: data.id, joinCode: data.join_code };
    if (error?.code !== UNIQUE_VIOLATION) throw error ?? new Error('room insert returned nothing');
  }
  return { ok: false, error: 'JOIN_CODE_COLLISION' };
}
```

- [ ] **Step 4: verifica che passi**

Run: `npm run test:db -- tests/db/create-room.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: server action e dashboard**

`apps/web/src/app/dashboard/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { createServerSupabase } from '@/lib/supabase/server';

export type CreateRoomState = { error: string | null };

const MESSAGES = {
  INVALID_TITLE: 'Dai un titolo alla stanza (massimo 120 caratteri).',
  NO_WORKSPACE: 'Il tuo account non ha un workspace. Contatta il supporto.',
  JOIN_CODE_COLLISION: 'Non siamo riusciti a generare un codice libero. Riprova.',
} as const;

export async function createRoomAction(
  _prev: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?next=/dashboard');

  const result = await createRoomForUser(supabase, data.user.id, {
    title: String(formData.get('title') ?? ''),
  });
  if (!result.ok) return { error: MESSAGES[result.error] };
  redirect(`/room/${result.joinCode}`);
}
```

`apps/web/src/app/dashboard/create-room-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { createRoomAction, type CreateRoomState } from './actions';

const initialState: CreateRoomState = { error: null };

export function CreateRoomForm() {
  const [state, formAction, pending] = useActionState(createRoomAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="title"
        required
        maxLength={120}
        placeholder="Titolo della riunione"
        className="flex-1 rounded bg-neutral-900 px-3 py-2"
      />
      <button disabled={pending} className="rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-50">
        Crea stanza
      </button>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
```

`apps/web/src/app/dashboard/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/(auth)/actions';
import { createServerSupabase } from '@/lib/supabase/server';
import { CreateRoomForm } from './create-room-form';

const STATUS_LABELS: Record<string, string> = {
  created: 'pronta',
  active: 'in corso',
  closing: 'in chiusura',
  closed: 'terminata',
  purged: 'terminata',
};

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/dashboard');

  // La RLS filtra già per workspace: nessun filtro a mano.
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, title, join_code, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 bg-neutral-950 p-6 text-neutral-100">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Le tue stanze</h1>
        <form action={signOut}>
          <button className="text-sm text-neutral-400 underline">Esci</button>
        </form>
      </header>
      <CreateRoomForm />
      <ul className="flex flex-col divide-y divide-neutral-800">
        {(rooms ?? []).map((room) => (
          <li key={room.id} className="flex items-center justify-between py-3">
            <Link href={`/room/${room.join_code}`} className="font-medium underline">
              {room.title}
            </Link>
            <span className="text-sm text-neutral-400">
              {room.join_code} · {STATUS_LABELS[room.status] ?? room.status}
            </span>
          </li>
        ))}
        {rooms?.length === 0 && <li className="py-3 text-neutral-500">Nessuna stanza ancora.</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: verifica e prova manuale**

Run: `npm run typecheck && npm run lint`
Expected: pulito.

Prova: accedi, crea "Kickoff Acme" → redirect a `/room/<codice>` (404 per ora, è il
task 1.7). Torna su `/dashboard`: la stanza è in lista con stato "pronta".

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "feat(web): room creation with collision retry, workspace dashboard"
```

---

### Task 1.5: Cookie dell'ospite firmato

**Files:**
- Create: `apps/web/src/lib/rooms/guest-token.ts`, `tests/unit/guest-token.test.ts`

**Interfaces:**
- Produces:
  ```ts
  signGuestToken(p: { participantId: string; roomId: string }, secret: string, now?: number): string
  verifyGuestToken(token: string, roomId: string, secret: string, now?: number): string | null // participantId
  guestCookieName(roomId: string): string
  GUEST_TOKEN_TTL_SECONDS: number // 12 ore
  ```

Il cookie non è un permesso in sé: dice solo "questo browser è il partecipante X di
questa stanza". Il server ricontrolla la riga a ogni ingresso.

- [ ] **Step 1: scrivi il test che fallisce**

`tests/unit/guest-token.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  GUEST_TOKEN_TTL_SECONDS,
  guestCookieName,
  signGuestToken,
  verifyGuestToken,
} from '@/lib/rooms/guest-token';

const secret = 'a'.repeat(64);
const now = 1_790_000_000_000;
const participantId = '11111111-1111-4111-8111-111111111111';
const roomId = '22222222-2222-4222-8222-222222222222';

describe('guest token', () => {
  const token = signGuestToken({ participantId, roomId }, secret, now);

  it('round-trips to the participant id', () => {
    expect(verifyGuestToken(token, roomId, secret, now)).toBe(participantId);
  });

  it('rejects another room', () => {
    expect(verifyGuestToken(token, '33333333-3333-4333-8333-333333333333', secret, now)).toBeNull();
  });

  it('rejects another secret', () => {
    expect(verifyGuestToken(token, roomId, 'b'.repeat(64), now)).toBeNull();
  });

  it('rejects a tampered participant', () => {
    const [, ...rest] = token.split('.');
    const forged = ['44444444-4444-4444-8444-444444444444', ...rest].join('.');
    expect(verifyGuestToken(forged, roomId, secret, now)).toBeNull();
  });

  it('expires', () => {
    const later = now + (GUEST_TOKEN_TTL_SECONDS + 1) * 1000;
    expect(verifyGuestToken(token, roomId, secret, later)).toBeNull();
  });

  it.each(['', 'garbage', 'a.b.c', 'a.b.c.d.e'])('rejects malformed %s', (bad) => {
    expect(verifyGuestToken(bad, roomId, secret, now)).toBeNull();
  });

  it('names the cookie per room', () => {
    expect(guestCookieName(roomId)).toBe(`oc_guest_${roomId}`);
  });
});
```

- [ ] **Step 2: verifica che fallisca**

Run: `npx vitest run tests/unit/guest-token.test.ts`
Expected: FAIL, modulo non trovato.

- [ ] **Step 3: implementa**

`apps/web/src/lib/rooms/guest-token.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export const GUEST_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function guestCookieName(roomId: string): string {
  return `oc_guest_${roomId}`;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

// Formato: participantId.roomId.expiresAtSeconds.signature
export function signGuestToken(
  { participantId, roomId }: { participantId: string; roomId: string },
  secret: string,
  now: number = Date.now(),
): string {
  const expiresAt = Math.floor(now / 1000) + GUEST_TOKEN_TTL_SECONDS;
  const payload = `${participantId}.${roomId}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyGuestToken(
  token: string,
  roomId: string,
  secret: string,
  now: number = Date.now(),
): string | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [participantId, tokenRoomId, expiresAtRaw, signature] = parts as [string, string, string, string];

  const expected = Buffer.from(sign(`${participantId}.${tokenRoomId}.${expiresAtRaw}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  if (tokenRoomId !== roomId) return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 < now) return null;
  return participantId;
}
```

- [ ] **Step 4: verifica che passi**

Run: `npx vitest run tests/unit/guest-token.test.ts`
Expected: `10 passed`.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "feat(web): HMAC-signed guest session token bound to room with expiry"
```

---

### Task 1.6: Ingresso in stanza — `joinRoom`

**Files:**
- Create: `apps/web/src/lib/rooms/join-room.ts`, `tests/db/join-room.test.ts`

**Interfaces:**
- Consumes: `isValidJoinCode()`, `isLanguage()` (1.3); client admin tipizzato.
- Produces:
  ```ts
  type RoomSummary = { id: string; title: string; joinCode: string };
  type JoinRoomInput = {
    joinCode: string;
    userId: string | null;      // null = ospite senza account
    displayName: string;
    language: string;
  };
  type JoinRoomResult =
    | { kind: 'joined'; role: 'host' | 'guest'; participantId: string; room: RoomSummary }
    | { kind: 'not_found' }
    | { kind: 'ended' }
    | { kind: 'invalid'; field: 'displayName' | 'language' };
  joinRoom(admin: SupabaseClient<Database>, input: JoinRoomInput): Promise<JoinRoomResult>
  findActiveParticipant(admin, roomId: string, participantId: string):
    Promise<{ role: 'host' | 'guest'; displayName: string } | null>
  ```

Regole: chi ha creato la stanza entra come `host`; ogni altro come `guest`. Un
utente registrato che rientra riusa la propria riga aperta invece di crearne una
nuova. Le stanze `closing`, `closed`, `purged` sono terminate.

- [ ] **Step 1: scrivi il test che fallisce**

`tests/db/join-room.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { findActiveParticipant, joinRoom } from '@/lib/rooms/join-room';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

describe('joinRoom', () => {
  let host: TestUser;
  let registeredGuest: TestUser;
  let joinCode: string;
  let roomId: string;

  beforeAll(async () => {
    host = await createTestUser('join-host');
    registeredGuest = await createTestUser('join-guest');
    const created = await createRoomForUser(await signedInClient(host), host.id, { title: 'Demo' });
    if (!created.ok) throw new Error('setup failed');
    joinCode = created.joinCode;
    roomId = created.id;
  });

  const base = { displayName: 'Marco', language: 'en' };

  it('the creator joins as host, once', async () => {
    const first = await joinRoom(admin, { ...base, joinCode, userId: host.id });
    expect(first).toMatchObject({ kind: 'joined', role: 'host', room: { id: roomId, title: 'Demo', joinCode } });

    const again = await joinRoom(admin, { ...base, joinCode, userId: host.id });
    expect(again.kind === 'joined' && first.kind === 'joined' && again.participantId).toBe(
      first.kind === 'joined' && first.participantId,
    );
  });

  it('an anonymous visitor joins as guest with name and language', async () => {
    const result = await joinRoom(admin, { joinCode, userId: null, displayName: '  Cliente  ', language: 'en' });
    expect(result).toMatchObject({ kind: 'joined', role: 'guest' });
    if (result.kind !== 'joined') return;

    const { data } = await admin
      .from('room_participants')
      .select('user_id, role, display_name, language')
      .eq('id', result.participantId)
      .single();
    expect(data).toEqual({ user_id: null, role: 'guest', display_name: 'Cliente', language: 'en' });
  });

  it('a registered non-creator joins as guest and reuses the open row', async () => {
    const first = await joinRoom(admin, { ...base, joinCode, userId: registeredGuest.id });
    const again = await joinRoom(admin, { ...base, joinCode, userId: registeredGuest.id });
    expect(first).toMatchObject({ kind: 'joined', role: 'guest' });
    expect(again.kind === 'joined' && again.participantId).toBe(first.kind === 'joined' && first.participantId);
  });

  it('rejects an empty name and an unsupported language', async () => {
    expect(await joinRoom(admin, { joinCode, userId: null, displayName: ' ', language: 'it' })).toEqual({
      kind: 'invalid',
      field: 'displayName',
    });
    expect(await joinRoom(admin, { joinCode, userId: null, displayName: 'Ok', language: 'xx' })).toEqual({
      kind: 'invalid',
      field: 'language',
    });
  });

  it('reports unknown and malformed codes as not found', async () => {
    expect(await joinRoom(admin, { ...base, joinCode: 'ZZZZZZZZ', userId: null })).toEqual({ kind: 'not_found' });
    expect(await joinRoom(admin, { ...base, joinCode: 'nope', userId: null })).toEqual({ kind: 'not_found' });
  });

  it('refuses ended rooms', async () => {
    const created = await createRoomForUser(await signedInClient(host), host.id, { title: 'Old' });
    if (!created.ok) throw new Error('setup failed');
    await admin.from('rooms').update({ status: 'closed' }).eq('id', created.id);
    expect(await joinRoom(admin, { ...base, joinCode: created.joinCode, userId: null })).toEqual({ kind: 'ended' });
  });

  it('finds an active participant only in its own room', async () => {
    const result = await joinRoom(admin, { joinCode, userId: null, displayName: 'Anna', language: 'it' });
    if (result.kind !== 'joined') throw new Error('setup failed');
    expect(await findActiveParticipant(admin, roomId, result.participantId)).toEqual({
      role: 'guest',
      displayName: 'Anna',
    });
    expect(
      await findActiveParticipant(admin, '00000000-0000-4000-8000-000000000000', result.participantId),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: verifica che fallisca**

Run: `npm run test:db -- tests/db/join-room.test.ts`
Expected: FAIL, modulo `@/lib/rooms/join-room` non trovato.

- [ ] **Step 3: implementa**

`apps/web/src/lib/rooms/join-room.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { isValidJoinCode } from './join-code';
import { isLanguage } from './languages';

export type RoomSummary = { id: string; title: string; joinCode: string };

export type JoinRoomInput = {
  joinCode: string;
  userId: string | null;
  displayName: string;
  language: string;
};

export type JoinRoomResult =
  | { kind: 'joined'; role: 'host' | 'guest'; participantId: string; room: RoomSummary }
  | { kind: 'not_found' }
  | { kind: 'ended' }
  | { kind: 'invalid'; field: 'displayName' | 'language' };

const ENDED_STATUSES = new Set(['closing', 'closed', 'purged']);
const MAX_NAME_LENGTH = 40;

type Admin = SupabaseClient<Database>;

// Usa il service role: l'ospite non ha sessione. Ogni controllo di accesso è qui.
export async function joinRoom(admin: Admin, input: JoinRoomInput): Promise<JoinRoomResult> {
  if (!isValidJoinCode(input.joinCode)) return { kind: 'not_found' };

  const { data: room, error } = await admin
    .from('rooms')
    .select('id, title, join_code, status, created_by')
    .eq('join_code', input.joinCode)
    .maybeSingle();
  if (error) throw error;
  if (!room) return { kind: 'not_found' };
  if (ENDED_STATUSES.has(room.status)) return { kind: 'ended' };

  const summary: RoomSummary = { id: room.id, title: room.title, joinCode: room.join_code };
  const role = input.userId !== null && input.userId === room.created_by ? 'host' : 'guest';

  if (input.userId !== null) {
    const { data: open } = await admin
      .from('room_participants')
      .select('id')
      .eq('room_id', room.id)
      .eq('user_id', input.userId)
      .is('left_at', null)
      .limit(1)
      .maybeSingle();
    if (open) return { kind: 'joined', role, participantId: open.id, room: summary };
  }

  const displayName = input.displayName.trim();
  if (displayName.length === 0 || displayName.length > MAX_NAME_LENGTH) {
    return { kind: 'invalid', field: 'displayName' };
  }
  if (!isLanguage(input.language)) return { kind: 'invalid', field: 'language' };

  const { data: inserted, error: insertError } = await admin
    .from('room_participants')
    .insert({
      room_id: room.id,
      user_id: input.userId,
      role,
      display_name: displayName,
      language: input.language,
    })
    .select('id')
    .single();
  if (insertError || !inserted) throw insertError ?? new Error('participant insert returned nothing');

  return { kind: 'joined', role, participantId: inserted.id, room: summary };
}

export async function findActiveParticipant(
  admin: Admin,
  roomId: string,
  participantId: string,
): Promise<{ role: 'host' | 'guest'; displayName: string } | null> {
  const { data } = await admin
    .from('room_participants')
    .select('role, display_name')
    .eq('id', participantId)
    .eq('room_id', roomId)
    .is('left_at', null)
    .maybeSingle();
  if (!data) return null;
  return { role: data.role === 'host' ? 'host' : 'guest', displayName: data.display_name };
}
```

- [ ] **Step 4: verifica che passi**

Run: `npm run test:db -- tests/db/join-room.test.ts`
Expected: `7 passed`.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "feat(web): joinRoom with host/guest roles, reuse of open rows, ended rooms"
```

---

### Task 1.7: Pagina della stanza, form ospite, shell

**Files:**
- Create: `apps/web/src/app/room/[code]/page.tsx`, `actions.ts`, `guest-join-form.tsx`, `room-shell.tsx`, `ended.tsx`

**Interfaces:**
- Consumes: `joinRoom`, `findActiveParticipant` (1.6), `signGuestToken`,
  `verifyGuestToken`, `guestCookieName`, `GUEST_TOKEN_TTL_SECONDS` (1.5),
  `currentUser`, `createServerSupabase`, `createAdminSupabase` (1.1), `serverEnv` (0.3),
  `SUPPORTED_LANGUAGES`, `LANGUAGE_LABELS` (1.3).
- Produces: `RoomShell({ title, role, displayName })` con due regioni accessibili,
  `aria-label="Partecipanti"` e `aria-label="Palco"`, in cui le slice 2 e 3 innestano
  video e palco.

Ordine dei controlli nella pagina, tutti server-side:
1. formato del codice → `notFound()`;
2. utente autenticato → `joinRoom` con il suo id (host o ospite registrato);
3. anonimo con cookie valido e riga aperta → shell;
4. anonimo senza cookie → form ospite.

- [ ] **Step 1: server action dell'ospite**

`apps/web/src/app/room/[code]/actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/env';
import { GUEST_TOKEN_TTL_SECONDS, guestCookieName, signGuestToken } from '@/lib/rooms/guest-token';
import { joinRoom } from '@/lib/rooms/join-room';
import { createAdminSupabase } from '@/lib/supabase/admin';

export type GuestJoinState = { error: string | null };

export async function joinAsGuestAction(
  joinCode: string,
  _prev: GuestJoinState,
  formData: FormData,
): Promise<GuestJoinState> {
  const result = await joinRoom(createAdminSupabase(), {
    joinCode,
    userId: null,
    displayName: String(formData.get('display_name') ?? ''),
    language: String(formData.get('language') ?? ''),
  });

  switch (result.kind) {
    case 'invalid':
      return {
        error:
          result.field === 'displayName'
            ? 'Scrivi un nome da mostrare agli altri (massimo 40 caratteri).'
            : 'Scegli una lingua dalla lista.',
      };
    case 'not_found':
      return { error: 'Questa stanza non esiste. Controlla il link che hai ricevuto.' };
    case 'ended':
      return { error: 'Questa riunione è terminata.' };
    case 'joined': {
      const store = await cookies();
      store.set(
        guestCookieName(result.room.id),
        signGuestToken({ participantId: result.participantId, roomId: result.room.id }, serverEnv().GUEST_SESSION_SECRET),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: `/room/${joinCode}`,
          maxAge: GUEST_TOKEN_TTL_SECONDS,
        },
      );
      redirect(`/room/${joinCode}`);
    }
  }
}
```

- [ ] **Step 2: form dell'ospite**

`apps/web/src/app/room/[code]/guest-join-form.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/lib/rooms/languages';
import { joinAsGuestAction, type GuestJoinState } from './actions';

const initialState: GuestJoinState = { error: null };

export function GuestJoinForm({ joinCode }: { joinCode: string }) {
  const [state, formAction, pending] = useActionState(
    joinAsGuestAction.bind(null, joinCode),
    initialState,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-xl font-semibold">Entra nella riunione</h1>
        <label className="flex flex-col gap-1 text-sm">
          Il tuo nome
          <input name="display_name" required maxLength={40} className="rounded bg-neutral-900 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          In che lingua vuoi leggere gli altri?
          <select name="language" defaultValue="it" className="rounded bg-neutral-900 px-3 py-2">
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {LANGUAGE_LABELS[language]}
              </option>
            ))}
          </select>
        </label>
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <button disabled={pending} className="rounded bg-neutral-100 px-4 py-2 text-neutral-900 disabled:opacity-50">
          Entra
        </button>
        <p className="text-sm text-neutral-400">
          Conduci tu la riunione?{' '}
          <Link className="underline" href={`/login?next=${encodeURIComponent(`/room/${joinCode}`)}`}>
            Accedi come host
          </Link>
        </p>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: shell della stanza e pagina "terminata"**

`apps/web/src/app/room/[code]/room-shell.tsx`:

```tsx
type Props = { title: string; role: 'host' | 'guest'; displayName: string };

// Desktop: colonna volti stretta a sinistra, palco al resto (ADR-0009).
// Mobile: il palco occupa quasi tutto, i volti restano piccoli a lato (spec §2.5).
export function RoomShell({ title, role, displayName }: Props) {
  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>{displayName}</span>
          <span className="rounded bg-neutral-800 px-2 py-0.5">{role === 'host' ? 'Host' : 'Ospite'}</span>
          <span className="hidden sm:inline">· nessun contenuto viene conservato</span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          aria-label="Partecipanti"
          className="absolute right-2 top-2 z-10 flex w-16 flex-col gap-2 lg:static lg:w-48 lg:border-r lg:border-neutral-800 lg:p-3"
        >
          {/* slice 2: tessere video */}
        </aside>

        <section aria-label="Palco" className="min-h-0 flex-1 p-2 lg:p-4">
          {/* slice 3: finestre, slot, vassoio */}
        </section>
      </div>
    </div>
  );
}
```

`apps/web/src/app/room/[code]/ended.tsx`:

```tsx
export function RoomEnded() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-xl font-semibold">Questa riunione è terminata</h1>
      <p className="text-neutral-400">Se c&apos;era un pacchetto, trovi il link nel messaggio dell&apos;host.</p>
    </main>
  );
}
```

- [ ] **Step 4: la pagina**

`apps/web/src/app/room/[code]/page.tsx`:

```tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { serverEnv } from '@/env';
import { guestCookieName, verifyGuestToken } from '@/lib/rooms/guest-token';
import { isValidJoinCode } from '@/lib/rooms/join-code';
import { findActiveParticipant, joinRoom } from '@/lib/rooms/join-room';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { RoomEnded } from './ended';
import { GuestJoinForm } from './guest-join-form';
import { RoomShell } from './room-shell';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isValidJoinCode(code)) notFound();

  const admin = createAdminSupabase();
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  // Utente registrato: host se ha creato la stanza, altrimenti ospite con account.
  if (auth.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', auth.user.id)
      .single();
    const displayName = profile?.display_name?.trim().slice(0, 40) || 'Utente';
    const result = await joinRoom(admin, {
      joinCode: code,
      userId: auth.user.id,
      displayName,
      // La scelta della lingua per gli utenti registrati arriva con i sottotitoli (slice 6).
      language: 'it',
    });
    if (result.kind === 'not_found') notFound();
    if (result.kind === 'ended') return <RoomEnded />;
    if (result.kind === 'invalid') throw new Error(`profile invalid for join: ${result.field}`);
    return (
      <RoomShell title={result.room.title} role={result.role} displayName={displayName} />
    );
  }

  // Anonimo: rientra se ha un cookie valido e la sua riga è ancora aperta.
  const { data: room } = await admin
    .from('rooms')
    .select('id, title, status')
    .eq('join_code', code)
    .maybeSingle();
  if (!room) notFound();
  if (['closing', 'closed', 'purged'].includes(room.status)) return <RoomEnded />;

  const token = (await cookies()).get(guestCookieName(room.id))?.value;
  const participantId = token
    ? verifyGuestToken(token, room.id, serverEnv().GUEST_SESSION_SECRET)
    : null;
  const participant = participantId
    ? await findActiveParticipant(admin, room.id, participantId)
    : null;
  if (participant) {
    return <RoomShell title={room.title} role={participant.role} displayName={participant.displayName} />;
  }

  return <GuestJoinForm joinCode={code} />;
}
```

- [ ] **Step 5: verifica e prova manuale**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: pulito.

Prova con `npm run dev`:
1. Da host: crea una stanza → shell con badge "Host".
2. In una finestra anonima apri lo stesso link → form. Invia con nome vuoto (togli
   `required` dagli strumenti del browser) → "Scrivi un nome…". Nome "Cliente",
   lingua English → shell con badge "Ospite".
3. Refresh nella finestra anonima → resta nella shell, nessuna riga nuova in
   `room_participants` (controlla in Studio).
4. `/room/ZZZZZZZZ` → 404. `/room/abc` → 404.
5. In Studio metti la stanza a `closed` → entrambe le finestre, al refresh, mostrano
   "Questa riunione è terminata".
6. DevTools a 390px di larghezza → il palco occupa lo schermo, la colonna volti è
   una striscia stretta in alto a destra.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "feat(web): room page with host, registered guest and anonymous guest entry"
```

---

### Task 1.8: Smoke end-to-end host + ospite

**Files:**
- Create: `playwright.config.ts`, `e2e/host-guest.spec.ts`

**Interfaces:**
- Produces: il test che protegge il percorso principale da qui in avanti.

- [ ] **Step 1: installa Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: configurazione**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: scrivi lo smoke**

`e2e/host-guest.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('host creates a room, anonymous guest joins and survives a reload', async ({ browser }) => {
  const host = await browser.newPage();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

  await host.goto('/signup');
  await host.getByLabel('Nome').fill('Sean');
  await host.getByLabel('Email').fill(email);
  await host.getByLabel('Password').fill('e2e-password-123');
  await host.getByRole('button', { name: 'Registrati' }).click();
  await expect(host).toHaveURL(/\/dashboard$/);

  await host.getByPlaceholder('Titolo della riunione').fill('Kickoff Acme');
  await host.getByRole('button', { name: 'Crea stanza' }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{8}$/);
  await expect(host.getByText('Host', { exact: true })).toBeVisible();
  const roomUrl = host.url();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(roomUrl);
  await guest.getByLabel('Il tuo nome').fill('Cliente');
  await guest.getByLabel('In che lingua vuoi leggere gli altri?').selectOption('en');
  await guest.getByRole('button', { name: 'Entra' }).click();

  await expect(guest.getByText('Ospite', { exact: true })).toBeVisible();
  await expect(guest.getByRole('region', { name: 'Palco' })).toBeAttached();
  await expect(guest.getByRole('complementary', { name: 'Partecipanti' })).toBeAttached();

  await guest.reload();
  await expect(guest.getByText('Ospite', { exact: true })).toBeVisible();

  await guestContext.close();
});

test('unknown room code shows 404', async ({ page }) => {
  const response = await page.goto('/room/ZZZZZZZZ');
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 4: verifica**

Prerequisiti: `npx supabase start` e `.env.local` compilato.
Run: `npm run test:e2e`
Expected: `4 passed` (2 test × 2 progetti, desktop e mobile).

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "test(web): e2e smoke for host signup, room creation, anonymous guest join"
```

---

### Task 1.9: Chiusura della slice 1

**Files:**
- Modify: `docs/BACKLOG.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: verifica completa**

Run: `npm run verify && npm run test:db && npm run test:e2e`
Expected: tutto verde.

- [ ] **Step 2: nessun segreto nel bundle**

```bash
npm run build
grep -rEl "SERVICE_ROLE|GUEST_SESSION_SECRET|sk-ant|LIVEKIT_API_SECRET" apps/web/.next/static/ && echo "SECRET IN BUNDLE" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: DoD della slice**

Esegui `/dod` e rispondi punto per punto. Controlla in particolare: nessuna
policy RLS senza test, `createAdminSupabase` importato solo da file server
(`grep -rn "supabase/admin" apps/web/src` → solo `page.tsx` e `actions.ts` della
stanza).

- [ ] **Step 4: aggiorna documenti**

- `docs/BACKLOG.md`: spunta le voci della slice 1.
- `README.md`: slice 0 e 1 "fatta", slice 2 "in corso".
- `CLAUDE.md` "Stato attuale": slice 1 completata, prossimo passo il piano della
  slice 2 con `writing-plans` (vendor LiveKit già deciso; spike CPU e iOS dentro la
  slice).

- [ ] **Step 5: preview e merge**

```bash
git add -A
git commit -m "docs: close slice 1"
npx supabase db push
npx vercel deploy
```

Prova sul deploy di preview il percorso del task 1.7 (host + ospite da telefono
vero). Poi:

```bash
git checkout main
git merge --no-ff slice/1-auth-stanza -m "Merge slice/1-auth-stanza"
```

- [ ] **Step 6: riporta**

File toccati, comandi eseguiti, test ed esito, limitazioni note, prossimi tre passi.

---

## Limitazioni note, volute

- Gli utenti registrati entrano con lingua `it`: la scelta arriva con i sottotitoli
  (slice 6).
- `left_at` non viene mai valorizzato: l'uscita arriva con la presence della slice 2.
  Fino ad allora un ospite con cookie valido rientra sempre nella stessa riga.
- Nessun reset della password né cambio email: vanno nel backlog se servono prima
  della demo.
- Lo stato della stanza non passa mai ad `active`: lo farà il primo join realtime
  (slice 2).

## Piani successivi

Un piano per slice, scritto all'inizio della slice (`/slice N` lo pretende):

| Slice | Da decidere prima di scrivere il piano |
|---|---|
| 2 Call | nulla: LiveKit Cloud free tier |
| 3 Palco | nulla |
| 4 Agente | vendor STT, nome della parola chiave, modello LLM, provider immagini |
| 5 Gesture | esito dello spike CPU della slice 2 |

`packages/gesture` può partire in parallelo già durante la slice 1 con un piano
proprio, se c'è una seconda persona o una sessione dedicata.
