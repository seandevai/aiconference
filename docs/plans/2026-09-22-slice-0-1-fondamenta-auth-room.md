# Piano — Slice 0 e 1: fondamenta, auth, stanza

> **Obsoleto.** Scritto sulla spec v1/v2. Va riscritto sulla v3 prima della slice 0.

> **Per chi esegue:** usare `superpowers:subagent-driven-development` (consigliato) o
> `superpowers:executing-plans` per eseguire task per task. I passi hanno checkbox.

**Obiettivo:** un utente si registra, entra, crea una stanza, la condivide con un
link, e un secondo utente entra nella shell della stanza. Senza video: quello è la
slice 2.

**Architettura:** monorepo npm workspaces, Next.js App Router con TypeScript strict,
Supabase Postgres con RLS deny by default, autorizzazione sempre server-side.

**Stack:** Next.js 15, React 19, TypeScript 5.7 strict, Tailwind, shadcn/ui,
Supabase (`@supabase/ssr`), Zod, Vitest, Playwright.

**Spec:** `docs/specs/2026-09-22-omnicanvas-mvp-design.md`
**Decisioni vincolanti:** `docs/adr/0001-confine-dei-dati.md`

## Vincoli globali

Valgono per ogni task di questo piano, non si ripetono task per task.

- TypeScript `strict: true` più `noUncheckedIndexedAccess` ed `exactOptionalPropertyTypes`.
- Nessun `any` senza commento che spieghi perché è inevitabile.
- Ogni tabella nuova ha la policy RLS **nella stessa migrazione** che la crea.
- Ogni policy RLS ha un test che prova l'accesso da utente non autorizzato e si
  aspetta zero righe.
- Nessun segreto sotto `NEXT_PUBLIC_`. `SUPABASE_SERVICE_ROLE_KEY` solo in route
  server, mai importata in un componente client.
- Nessun contenuto di riunione in Postgres o nei log. Solo metadati.
- Ogni variabile d'ambiente nuova va in `docs/ENVIRONMENT.md` e `.env.example` nello
  stesso commit.
- Commit: `<tipo>(<ambito>): <cosa cambia>`. Ambiti: `web`, `db`, `ui`, `ci`.
- Documentazione aggiornata nello stesso commit che cambia il comportamento.

## File toccati

```
package.json                          workspace root, già scritto
tsconfig.base.json                    già scritto
eslint.config.mjs                     nuovo, flat config
vitest.config.ts                      nuovo
apps/web/                             applicazione Next.js
  package.json, tsconfig.json, next.config.ts
  src/env.ts                          validazione Zod delle variabili
  src/lib/supabase/client.ts          client browser
  src/lib/supabase/server.ts          client server con cookie
  src/lib/supabase/admin.ts           service role, solo server
  src/app/(auth)/login/page.tsx
  src/app/(auth)/signup/page.tsx
  src/app/(app)/dashboard/page.tsx
  src/app/(app)/rooms/actions.ts      server action creazione stanza
  src/app/room/[code]/page.tsx        ingresso da link
  src/app/room/[code]/room-shell.tsx  layout 35/65
  src/lib/rooms/join-code.ts          generazione codice
supabase/migrations/
  0001_profiles_workspaces.sql
  0002_rooms.sql
tests/
  env.test.ts
  join-code.test.ts
  rls-profiles.test.ts
  rls-rooms.test.ts
  rooms-actions.test.ts
e2e/signup-create-join.spec.ts
```

---

### Task 0.1 — Tooling del workspace

**File:**
- Crea: `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc`, `.editorconfig`
- Modifica: `package.json` (dipendenze)

**Produce:** `npm run typecheck`, `npm run lint`, `npm test` eseguibili e verdi su
repository vuoto.

- [ ] **Passo 1: installa le dipendenze di sviluppo**

```bash
npm install -D typescript@^5.7 @types/node@^22 eslint@^9 @eslint/js typescript-eslint \
  prettier@^3 vitest@^2 @vitest/coverage-v8
```

- [ ] **Passo 2: scrivi `eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Passo 3: scrivi `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
```

- [ ] **Passo 4: scrivi `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 90
}
```

- [ ] **Passo 5: test di fumo del tooling**

Crea `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('tooling', () => {
  it('esegue i test', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Passo 6: verifica**

Esegui: `npm run lint && npm test`
Atteso: lint pulito, 1 test passato.

- [ ] **Passo 7: commit**

```bash
git add -A
git commit -m "chore(ci): tooling workspace con eslint, prettier, vitest"
```

---

### Task 0.2 — Applicazione Next.js

**File:**
- Crea: `apps/web/` tramite scaffolding
- Modifica: `apps/web/tsconfig.json` per estendere la base

**Consuma:** tooling del task 0.1.
**Produce:** `npm run dev` che serve l'app su `:3000`.

- [ ] **Passo 1: scaffolding non interattivo**

```bash
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Passo 2: estendi la config TypeScript di base**

In `apps/web/tsconfig.json`, aggiungi in cima:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- [ ] **Passo 3: verifica che l'app parta**

Esegui: `npm run dev`
Atteso: pagina di default su `http://localhost:3000`. Fermare con Ctrl+C.

- [ ] **Passo 4: verifica typecheck strict**

Esegui: `npm run typecheck`
Atteso: nessun errore. Se `noUnusedLocals` segnala il boilerplate, ripulire il
boilerplate invece di abbassare la regola.

- [ ] **Passo 5: commit**

```bash
git add -A
git commit -m "feat(web): scaffolding Next.js App Router con TypeScript strict"
```

---

### Task 0.3 — Validazione delle variabili d'ambiente

**File:**
- Crea: `apps/web/src/env.ts`, `tests/env.test.ts`

**Produce:** `env` tipizzato, e un fallimento immediato all'avvio se manca una
variabile invece di un errore oscuro a metà richiesta.

**Interfacce:**
- Produce: `parseServerEnv(raw: Record<string, string | undefined>): ServerEnv` e
  `parseClientEnv(raw): ClientEnv`. I task successivi importano `env` da `@/env`.

- [ ] **Passo 1: scrivi il test che fallisce**

`tests/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseServerEnv, parseClientEnv } from '../apps/web/src/env';

const clientOk = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
};

describe('env', () => {
  it('accetta un ambiente client valido', () => {
    expect(parseClientEnv(clientOk).NEXT_PUBLIC_SUPABASE_URL).toBe('https://x.supabase.co');
  });

  it('fallisce se manca una variabile client', () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _omessa, ...incompleto } = clientOk;
    expect(() => parseClientEnv(incompleto)).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('fallisce se la URL non è una URL', () => {
    expect(() => parseClientEnv({ ...clientOk, NEXT_PUBLIC_SUPABASE_URL: 'non-una-url' }))
      .toThrow();
  });

  it('accetta un ambiente server valido', () => {
    const out = parseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      CRON_SECRET: 'x'.repeat(32),
    });
    expect(out.CRON_SECRET).toHaveLength(32);
  });

  it('rifiuta un CRON_SECRET corto', () => {
    expect(() => parseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      CRON_SECRET: 'corto',
    })).toThrow();
  });
});
```

- [ ] **Passo 2: verifica che fallisca**

Esegui: `npx vitest run tests/env.test.ts`
Atteso: FAIL, modulo `env` non trovato.

- [ ] **Passo 3: implementazione minima**

`apps/web/src/env.ts`:

```ts
import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(32),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T>(schema: z.ZodType<T>, raw: unknown, scope: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Variabili ${scope} non valide o mancanti: ${missing}`);
  }
  return result.data;
}

export function parseClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  return parse(clientSchema, raw, 'client');
}

export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  return parse(serverSchema, raw, 'server');
}

export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
```

Installa Zod: `npm install zod --workspace=apps/web`

- [ ] **Passo 4: verifica che passi**

Esegui: `npx vitest run tests/env.test.ts`
Atteso: 5 test passati.

- [ ] **Passo 5: commit**

```bash
git add -A
git commit -m "feat(web): validazione Zod delle variabili d'ambiente con fallimento all'avvio"
```

---

### Task 0.4 — Supabase e migrazione 0001

**File:**
- Crea: `supabase/migrations/0001_profiles_workspaces.sql`, `tests/rls-profiles.test.ts`
- Modifica: `.env.local` (non versionato)

**Produce:** tabelle `profiles`, `workspaces`, `workspace_members` con RLS attiva, e
un workspace creato automaticamente a ogni registrazione.

> Nota: il progetto Supabase si può provisionare dal Marketplace Vercel con
> `vercel integration add supabase`, così le variabili arrivano già in
> `vercel env pull`. In alternativa, crearlo a mano dalla dashboard.

- [ ] **Passo 1: crea il progetto e prendi le credenziali**

Installa la CLI: `npm install -D supabase`
Poi `npx supabase init` e `npx supabase start` per l'ambiente locale.
Copia URL, anon key e service role key in `.env.local`.

- [ ] **Passo 2: scrivi la migrazione**

`supabase/migrations/0001_profiles_workspaces.sql`:

```sql
-- profiles estende auth.users, non duplica credenziali
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
  plan text not null default 'free' check (plan in ('free','creator','pro','team')),
  credits_balance integer not null default 100 check (credits_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index on public.workspace_members (user_id);

-- RLS: deny by default su tutte
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "utente legge il proprio profilo"
  on public.profiles for select using (id = auth.uid());

create policy "utente aggiorna il proprio profilo"
  on public.profiles for update using (id = auth.uid());

create policy "membro legge i workspace a cui appartiene"
  on public.workspaces for select using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspaces.id and m.user_id = auth.uid()
    )
  );

create policy "owner aggiorna il proprio workspace"
  on public.workspaces for update using (owner_id = auth.uid());

create policy "membro legge le membership dei propri workspace"
  on public.workspace_members for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id and m.user_id = auth.uid()
    )
  );

-- alla registrazione: profilo, workspace personale, membership owner
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  nuovo_workspace uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (name, owner_id)
  values ('Il mio workspace', new.id)
  returning id into nuovo_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (nuovo_workspace, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Passo 3: scrivi il test RLS che deve fallire l'accesso**

`tests/rls-profiles.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, service, { auth: { persistSession: false } });

async function creaUtente(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password-di-test-123',
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

async function clientAutenticato(email: string) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: 'password-di-test-123',
  });
  if (error) throw error;
  return c;
}

describe('RLS su profiles e workspaces', () => {
  const emailA = `a-${Date.now()}@test.local`;
  const emailB = `b-${Date.now()}@test.local`;

  beforeAll(async () => {
    await creaUtente(emailA);
    await creaUtente(emailB);
  });

  it('la registrazione crea profilo, workspace e membership owner', async () => {
    const a = await clientAutenticato(emailA);
    const { data } = await a.from('workspaces').select('id, name, plan');
    expect(data).toHaveLength(1);
    expect(data![0]!.plan).toBe('free');
  });

  it('un utente non vede il workspace di un altro', async () => {
    const b = await clientAutenticato(emailB);
    const { data: suoi } = await b.from('workspaces').select('id');
    const { data: tutti } = await admin.from('workspaces').select('id');
    expect(tutti!.length).toBeGreaterThan(suoi!.length);
    expect(suoi).toHaveLength(1);
  });

  it('un client anonimo non legge nessun profilo', async () => {
    const anonimo = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await anonimo.from('profiles').select('id');
    expect(data).toHaveLength(0);
  });
});
```

- [ ] **Passo 4: verifica che fallisca**

Esegui: `npx vitest run tests/rls-profiles.test.ts`
Atteso: FAIL, le tabelle non esistono ancora.

- [ ] **Passo 5: applica la migrazione**

```bash
npx supabase db reset
```

- [ ] **Passo 6: verifica che passi**

Esegui: `npx vitest run tests/rls-profiles.test.ts`
Atteso: 3 test passati.

- [ ] **Passo 7: commit**

```bash
git add -A
git commit -m "feat(db): schema profiles/workspaces con RLS e trigger di registrazione"
```

---

### Task 1.1 — Client Supabase e auth

**File:**
- Crea: `apps/web/src/lib/supabase/client.ts`, `server.ts`, `admin.ts`
- Crea: `apps/web/src/app/(auth)/login/page.tsx`, `signup/page.tsx`
- Crea: `apps/web/src/middleware.ts`

**Consuma:** `clientEnv` dal task 0.3, schema dal task 0.4.
**Produce:** `createBrowserSupabase()`, `createServerSupabase()`,
`createAdminSupabase()`, e `requireUser()` che lancia se non autenticato.

- [ ] **Passo 1: installa**

```bash
npm install @supabase/supabase-js @supabase/ssr --workspace=apps/web
```

- [ ] **Passo 2: client server con cookie**

`apps/web/src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv } from '@/env';

export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          for (const { name, value, options } of items) {
            store.set(name, value, options);
          }
        },
      },
    },
  );
}

export async function requireUser() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('UNAUTHENTICATED');
  }
  return { supabase, user: data.user };
}
```

- [ ] **Passo 3: client admin, solo server**

`apps/web/src/lib/supabase/admin.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { clientEnv } from '@/env';

// Bypassa RLS. Usare solo dove è davvero necessario: ledger e job di purga.
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mancante');
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}
```

Installa la guardia: `npm install server-only --workspace=apps/web`

- [ ] **Passo 4: pagine di login e registrazione**

Form con email e password, server action che chiama `signInWithPassword` e
`signUp`. Gli errori vanno mostrati in italiano e in chiaro: credenziali errate,
email già registrata, email non confermata. Nessun messaggio generico.

- [ ] **Passo 5: prova manuale**

Registrati con una email nuova, conferma, entra. Verifica in Supabase Studio che
esistano una riga in `profiles`, una in `workspaces` e una in `workspace_members`.

- [ ] **Passo 6: commit**

```bash
git add -A
git commit -m "feat(web): client Supabase server e browser, flusso di registrazione e login"
```

---

### Task 1.2 — Migrazione 0002: rooms

**File:**
- Crea: `supabase/migrations/0002_rooms.sql`, `tests/rls-rooms.test.ts`

**Consuma:** schema del task 0.4.
**Produce:** tabelle `rooms` e `room_participants` con RLS.

- [ ] **Passo 1: scrivi il test RLS**

`tests/rls-rooms.test.ts`, stessa forma del task 0.4. Casi obbligatori:

1. Il creatore vede la stanza appena creata.
2. Un utente di un altro workspace **non** la vede: risultato zero righe.
3. Un client anonimo non vede nessuna stanza.
4. Un utente non può inserire una stanza in un workspace di cui non è membro.

- [ ] **Passo 2: verifica che fallisca**

Esegui: `npx vitest run tests/rls-rooms.test.ts`
Atteso: FAIL, tabella inesistente.

- [ ] **Passo 3: scrivi la migrazione**

```sql
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  join_code text not null unique,
  status text not null default 'created'
    check (status in ('created','active','closing','closed','purged')),
  started_at timestamptz,
  ended_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.rooms (join_code);
create index on public.rooms (status, started_at);

create table public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_seconds integer
);

create index on public.room_participants (room_id);

alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;

create policy "membro legge le stanze del proprio workspace"
  on public.rooms for select using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = rooms.workspace_id and m.user_id = auth.uid()
    )
  );

create policy "membro crea stanze nel proprio workspace"
  on public.rooms for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = rooms.workspace_id and m.user_id = auth.uid()
    )
  );

create policy "creatore aggiorna la propria stanza"
  on public.rooms for update using (created_by = auth.uid());

create policy "partecipante legge le presenze delle stanze che può vedere"
  on public.room_participants for select using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members m on m.workspace_id = r.workspace_id
      where r.id = room_participants.room_id and m.user_id = auth.uid()
    )
  );
```

- [ ] **Passo 4: applica e verifica**

Esegui: `npx supabase db reset && npx vitest run tests/rls-rooms.test.ts`
Atteso: 4 test passati.

- [ ] **Passo 5: commit**

```bash
git add -A
git commit -m "feat(db): schema rooms e room_participants con policy RLS"
```

---

### Task 1.3 — Generazione del join code

**File:**
- Crea: `apps/web/src/lib/rooms/join-code.ts`, `tests/join-code.test.ts`

**Produce:** `generateJoinCode(): string` e `isValidJoinCode(v: string): boolean`.

- [ ] **Passo 1: scrivi il test**

```ts
import { describe, it, expect } from 'vitest';
import { generateJoinCode, isValidJoinCode } from '../apps/web/src/lib/rooms/join-code';

describe('join code', () => {
  it('ha lunghezza 8', () => {
    expect(generateJoinCode()).toHaveLength(8);
  });

  it('usa solo caratteri non ambigui', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateJoinCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it('non si ripete su mille generazioni', () => {
    const set = new Set(Array.from({ length: 1000 }, generateJoinCode));
    expect(set.size).toBe(1000);
  });

  it('valida il formato', () => {
    expect(isValidJoinCode(generateJoinCode())).toBe(true);
    expect(isValidJoinCode('abc')).toBe(false);
    expect(isValidJoinCode('OIL01234')).toBe(false);
  });
});
```

- [ ] **Passo 2: verifica che fallisca**

Esegui: `npx vitest run tests/join-code.test.ts`
Atteso: FAIL, modulo inesistente.

- [ ] **Passo 3: implementa**

```ts
import { randomInt } from 'node:crypto';

// Niente O, I, L, 0, 1: si confondono quando il codice viene letto ad alta voce.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LUNGHEZZA = 8;

export function generateJoinCode(): string {
  let out = '';
  for (let i = 0; i < LUNGHEZZA; i++) {
    out += ALFABETO[randomInt(ALFABETO.length)];
  }
  return out;
}

export function isValidJoinCode(value: string): boolean {
  if (value.length !== LUNGHEZZA) return false;
  return [...value].every((c) => ALFABETO.includes(c));
}
```

- [ ] **Passo 4: verifica che passi**

Esegui: `npx vitest run tests/join-code.test.ts`
Atteso: 4 test passati.

- [ ] **Passo 5: commit**

```bash
git add -A
git commit -m "feat(web): generazione join code con alfabeto non ambiguo"
```

---

### Task 1.4 — Creazione stanza e dashboard

**File:**
- Crea: `apps/web/src/app/(app)/rooms/actions.ts`, `apps/web/src/app/(app)/dashboard/page.tsx`
- Crea: `tests/rooms-actions.test.ts`

**Consuma:** `requireUser()` dal task 1.1, `generateJoinCode()` dal task 1.3.
**Produce:** `createRoom(input: { title: string }): Promise<{ id: string; joinCode: string }>`.

- [ ] **Passo 1: scrivi i test**

Casi obbligatori:

1. Un utente autenticato crea una stanza nel proprio workspace e riceve id e codice.
2. Il titolo vuoto viene rifiutato con un errore leggibile.
3. Un utente non autenticato riceve `UNAUTHENTICATED`.
4. Una collisione di `join_code` viene ritentata invece di fallire.

- [ ] **Passo 2: verifica che falliscano**

Esegui: `npx vitest run tests/rooms-actions.test.ts`
Atteso: FAIL.

- [ ] **Passo 3: implementa la server action**

```ts
'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { generateJoinCode } from '@/lib/rooms/join-code';

const schema = z.object({
  title: z.string().trim().min(1, 'Serve un titolo').max(120),
});

export async function createRoom(input: { title: string }) {
  const { supabase, user } = await requireUser();
  const { title } = schema.parse(input);

  const { data: membership, error: errMembership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  if (errMembership || !membership) throw new Error('NO_WORKSPACE');

  // La collisione è improbabile ma possibile: si ritenta, non si esplode.
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        workspace_id: membership.workspace_id,
        created_by: user.id,
        title,
        join_code: joinCode,
      })
      .select('id, join_code')
      .single();

    if (!error && data) return { id: data.id, joinCode: data.join_code };
    if (error && error.code !== '23505') throw error;
  }
  throw new Error('JOIN_CODE_COLLISION');
}
```

- [ ] **Passo 4: verifica che passino**

Esegui: `npx vitest run tests/rooms-actions.test.ts`
Atteso: 4 test passati.

- [ ] **Passo 5: dashboard**

Elenco delle stanze del workspace con titolo, stato e codice, più un form di
creazione. La lista arriva da un Server Component che legge con il client server:
la RLS fa già il filtro, non serve filtrare a mano per workspace.

- [ ] **Passo 6: prova manuale**

Entra, crea una stanza, vedila comparire nella lista con il suo codice.

- [ ] **Passo 7: commit**

```bash
git add -A
git commit -m "feat(web): creazione stanza con server action e dashboard workspace"
```

---

### Task 1.5 — Ingresso da link e shell della stanza

**File:**
- Crea: `apps/web/src/app/room/[code]/page.tsx`, `room-shell.tsx`

**Consuma:** `isValidJoinCode()` dal task 1.3, client server dal task 1.1.
**Produce:** la shell 35/65 in cui la slice 2 innesterà il video e la slice 3 il canvas.

- [ ] **Passo 1: pagina di ingresso con controllo server-side**

La pagina è un Server Component. Nell'ordine:

1. Valida il formato del codice. Se non è valido, 404 senza toccare il database.
2. Cerca la stanza per `join_code`.
3. Se non esiste: pagina "stanza non trovata", non un 500.
4. Se `status` è `closed` o `purged`: pagina "questa riunione è terminata".
5. Se l'utente non è autenticato: redirect al login con `?next=` che riporta qui.
6. Registra una riga in `room_participants`.
7. Rende `RoomShell`.

Il controllo di autorizzazione sta qui, sul server. Il codice di invito da solo non
è un permesso: la slice 2 aggiungerà l'emissione del token realtime solo dopo questi
stessi controlli.

- [ ] **Passo 2: shell 35/65**

`room-shell.tsx`, client component:

```tsx
'use client';

export function RoomShell({ title }: { title: string }) {
  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h1 className="text-sm font-medium">{title}</h1>
        <span className="text-xs text-neutral-500">nessun dato viene registrato</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label="Partecipanti"
          className="min-h-0 flex-1 p-4 lg:basis-3/4"
        >
          {/* slice 2: griglia video */}
        </section>

        <aside
          aria-label="AI Canvas"
          className="min-h-0 shrink-0 border-t border-neutral-800 p-4 lg:basis-1/4 lg:border-l lg:border-t-0"
        >
          {/* slice 3: asset generati */}
        </aside>
      </div>
    </div>
  );
}
```

Sotto `lg` le due colonne si impilano: su mobile un pannello al 25% della larghezza
è inutilizzabile.

- [ ] **Passo 3: prova manuale**

Crea una stanza, copia il link, aprilo in una finestra anonima. Verifica il redirect
al login, poi il ritorno alla stanza dopo l'accesso. Prova anche un codice
inventato e una stanza chiusa.

- [ ] **Passo 4: commit**

```bash
git add -A
git commit -m "feat(web): ingresso stanza da link con controlli server-side e shell 35/65"
```

---

### Task 1.6 — Smoke end-to-end

**File:**
- Crea: `e2e/signup-create-join.spec.ts`, `playwright.config.ts`

**Produce:** il test che protegge il percorso principale da qui in avanti.

- [ ] **Passo 1: installa Playwright**

```bash
npm install -D @playwright/test && npx playwright install chromium
```

- [ ] **Passo 2: scrivi lo smoke**

Percorso: registrazione, login, creazione stanza, copia del codice, apertura del
link in un secondo contesto autenticato, shell visibile con entrambe le regioni
`Partecipanti` e `AI Canvas` presenti nel DOM.

- [ ] **Passo 3: verifica**

Esegui: `npm run test:e2e`
Atteso: 1 test passato.

- [ ] **Passo 4: commit**

```bash
git add -A
git commit -m "test(web): smoke end-to-end registrazione, creazione stanza, ingresso"
```

---

### Task 1.7 — Chiusura della slice

- [ ] **Passo 1: verifica completa**

Esegui: `npm run verify && npm run test:e2e`
Atteso: tutto verde.

- [ ] **Passo 2: controllo che nessun segreto sia nel bundle**

```bash
npm run build
grep -rEl "SERVICE_ROLE|sk-ant|LIVEKIT_API_SECRET" apps/web/.next/static/ && echo "SEGRETO NEL BUNDLE" || echo "pulito"
```
Atteso: `pulito`.

- [ ] **Passo 3: aggiorna il backlog**

Spunta le voci fatte in `docs/BACKLOG.md` e sposta in `CLAUDE.md` lo stato attuale:
slice 1 completata, prossima slice 2 video.

- [ ] **Passo 4: merge in main**

```bash
git checkout main
git merge --no-ff slice/1-auth-room
```

- [ ] **Passo 5: riporta**

File toccati, comandi eseguiti, test ed esito, limitazioni note, prossimi tre passi.

---

## Cosa questo piano non fa

Nessun video, nessun AI Canvas funzionante, nessun accounting, nessun bundle. La
shell della stanza è un contenitore vuoto con due regioni. È voluto: le slice
successive innestano dentro un guscio che si sa già reggere auth e permessi.
