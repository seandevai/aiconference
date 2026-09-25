# Slice 4A — Agente a comando e ledger: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'host preme ✨, scrive che cosa gli serve e un grafico, un testo o una tabella
arrivano nel vassoio. Ogni richiesta passa da `AIService`: pagante, quota **prima** del
provider, rate limit, riga su `ai_requests` e scalo sul ledger anche quando il provider
fallisce. L'host vede i suoi crediti e quanto ha speso l'agente nella stanza. I crediti
si caricano a mano.

**Perché 4A:** la slice 4 della spec dipende da tre decisioni aperte (§12: vendor STT,
nome e modello della parola chiave, provider di immagini). Questa metà non ne dipende:
il provider del testo è Anthropic (`ANTHROPIC_API_KEY` è già nel contratto env per
«agente, riassunti»). La slice 4B aggiungerà parola chiave, STT a comando, immagini con
conferma e modalità companion. Fino ad allora la richiesta si **scrive**: è anche il
percorso per chi non ha microfono.

**Architecture:** `packages/ai` è l'unico punto che conosce chiavi, modelli e prezzi.
`AIService.execute` riceve porte iniettate: `AiLedger` (riserva crediti, registra la
richiesta, conta le richieste recenti) e `GenerateAdapter` (provider). La riserva è
atomica in Postgres (`ai_reserve_credits`), la registrazione pure (`ai_record_request`:
riga su `ai_requests`, riga su `credit_ledger`, conguaglio del saldo). Il provider
Anthropic usa structured output con Zod e i fallback lato server. Un adapter `fake`
deterministico serve a sviluppo, CI ed e2e, dove non si spendono soldi.

**Tech Stack:** `@anthropic-ai/sdk` 0.128 (`client.beta.messages.parse`,
`betaZodOutputFormat`, beta `server-side-fallback-2026-07-01`), modello `claude-opus-5`,
Zod 4.6, Supabase (funzioni SQL, RLS), Vitest, Playwright.

**Spec:** `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (§2.3 agente, §4.5 flusso,
§4.7 richiesta AI, §6 economia, §8 slice 4). Leggere `docs/ARCHITECTURE.md` §6 (catena
della richiesta AI), §13 (telemetria senza contenuto) e `docs/DATA-MODEL.md`
(`ai_requests`, `credit_ledger`).

## Global Constraints

- Regola 1: il prompt e l'output **non** vanno in Postgres, nei log o in un file. `ai_requests` contiene solo metadati: provider, modello, operazione, token, latenza, esito, codice d'errore, costo.
- Regola 4: nessuna chiamata al provider fuori da `AIService`; quota controllata e crediti riservati **prima** della chiamata; scrittura sul ledger a ogni chiamata, anche fallita.
- `@anthropic-ai/sdk` solo in `packages/ai` (il job CI `boundaries` lo verifica). `ANTHROPIC_API_KEY` solo server.
- Nuova tabella → RLS nella stessa migrazione, test da utente non autorizzato. Le funzioni che toccano i crediti non sono eseguibili da `anon` né `authenticated`.
- Modello `claude-opus-5` con `fallbacks: 'default'` (beta `server-side-fallback-2026-07-01`): se il modello rifiuta, il server ripiega su un altro modello. `stop_reason: 'refusal'` si controlla prima di leggere l'output.
- Unità: 1 credito = 0,01 USD stimati. Costo stimato con i prezzi di listino per milione di token (Opus 5: 5 USD input, 25 USD output). L'economia vera si decide dopo l'MVP (spec §6).
- Solo l'host attiva l'agente; paga il workspace della stanza. Pagante dell'ospite e «offro io» arrivano con la negoziazione (slice 7).
- Errori mostrati all'utente in italiano, con cosa fare. Codici tecnici in inglese.
- Commit `<tipo>(<ambito>): <cosa>`, ambiti `ai`, `db`, `web`, `ci`. Branch `slice/4a-agente` da `slice/3-palco`.

## Review Focus

1. Due richieste contemporanee con crediti per una sola → la seconda riceve 402 senza chiamare il provider; il saldo non va mai sotto zero. Test nel task 4.1 (riserva atomica) e 4.4.
2. Un utente autenticato che chiama via PostgREST `ai_reserve_credits`, `ai_record_request` o `grant_credits` per regalarsi crediti → rifiutato. Test nel task 4.1.
3. Il provider fallisce (errore, timeout, rifiuto) → la richiesta è registrata con `success = false` e codice, la riserva torna al workspace, l'host vede un messaggio chiaro. Test nel task 4.2.
4. L'output del modello non rispetta i limiti del palco (testo troppo lungo, tabella enorme) → scartato come `invalid_output` e registrato, niente nel vassoio. Test nel task 4.3.
5. Un ospite chiama la route dell'agente → 403, nessuna chiamata, nessuna riga. Test nel task 4.5.

## Mappa dei file

```
supabase/migrations/0004_ai_ledger.sql      ai_requests, credit_ledger, RLS, funzioni crediti
packages/db/src/database.types.ts           rigenerato
packages/ai/
  package.json, tsconfig.json               nuovo
  src/pricing.ts                            costo stimato e crediti
  src/types.ts                              AgentContent, porte, errori
  src/agent-schema.ts                       schema Zod dell'output del modello
  src/service.ts                            AIService.execute
  src/anthropic.ts                          adapter Anthropic
  src/fake.ts                               adapter deterministico per sviluppo e test
  src/index.ts
apps/web/
  src/env-schema.ts, src/env.ts             modifica: AI_PROVIDER, ANTHROPIC_API_KEY
  src/lib/ai/ledger.ts                      AiLedger su Supabase
  src/lib/ai/agent-request.ts               runAgentRequest, readAgentUsage
  src/app/room/[code]/agent/route.ts        POST richiesta, GET contatore
  src/lib/stage/use-agent.ts                hook: invio, stato, contatore
  src/app/room/[code]/agent-panel.tsx       ✨, campo, contatore
  src/app/room/[code]/stage-area.tsx        modifica: monta il pannello
scripts/grant-credits.mjs                   ricarica manuale
e2e/helpers.ts, e2e/agent.spec.ts           crediti di test, e2e dell'agente
playwright.config.ts                        modifica: carica .env.local
tests/db/ai-ledger.test.ts, agent-request.test.ts
tests/unit/ai-pricing.test.ts, ai-service.test.ts, ai-anthropic.test.ts, env.test.ts
.github/workflows/ci.yml, .devcontainer/start-services.sh, docs/*
```

---

### Task 4.1: Migrazione 0004 — ledger, richieste e funzioni dei crediti

**Files:**
- Create: `supabase/migrations/0004_ai_ledger.sql`, `tests/db/ai-ledger.test.ts`
- Modify: `packages/db/src/database.types.ts` (rigenerato)

**Interfaces:**
- Produces (SQL, eseguibili solo dal service role):
  - `ai_reserve_credits(p_workspace uuid, p_credits integer) returns boolean` — toglie i crediti solo se bastano, in un solo `update`
  - `ai_record_request(p_room uuid, p_participant uuid, p_workspace uuid, p_provider text, p_model text, p_operation text, p_input_tokens integer, p_output_tokens integer, p_latency_ms integer, p_success boolean, p_error_code text, p_cost_usd numeric, p_reserved integer, p_charged integer) returns uuid` — riga su `ai_requests`, riga su `credit_ledger` (`delta = -p_charged`), saldo `+ p_reserved - p_charged`
  - `grant_credits(p_workspace uuid, p_credits integer, p_reason text default 'manual_grant') returns integer` — nuovo saldo

- [ ] **Step 1: branch e test che falliscono**

```bash
git checkout slice/3-palco
git checkout -b slice/4a-agente
```

`tests/db/ai-ledger.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

async function workspaceOf(user: TestUser): Promise<string> {
  const { data } = await admin.from('workspaces').select('id').eq('owner_id', user.id).single();
  return data!.id;
}

async function balance(workspaceId: string): Promise<number> {
  const { data } = await admin.from('workspaces').select('credits_balance').eq('id', workspaceId).single();
  return data!.credits_balance;
}

describe('ai ledger', () => {
  let host: TestUser;
  let stranger: TestUser;
  let workspaceId: string;
  let roomId: string;
  let participantId: string;

  beforeAll(async () => {
    host = await createTestUser('ledger-host');
    stranger = await createTestUser('ledger-stranger');
    workspaceId = await workspaceOf(host);
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Ledger' });
    if (!room.ok) throw new Error('setup failed');
    roomId = room.id;
    const joined = await joinRoom(admin, { joinCode: room.joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    if (joined.kind !== 'joined') throw new Error('join failed');
    participantId = joined.participantId;
  });

  it('grants credits with a ledger row', async () => {
    const { data, error } = await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 100 });
    expect(error).toBeNull();
    expect(data).toBe(100);
    const { data: rows } = await admin.from('credit_ledger').select('delta, reason').eq('workspace_id', workspaceId);
    expect(rows).toEqual([{ delta: 100, reason: 'manual_grant' }]);
  });

  it('reserves only when the balance is enough, never going below zero', async () => {
    expect((await admin.rpc('ai_reserve_credits', { p_workspace: workspaceId, p_credits: 60 })).data).toBe(true);
    expect((await admin.rpc('ai_reserve_credits', { p_workspace: workspaceId, p_credits: 60 })).data).toBe(false);
    expect(await balance(workspaceId)).toBe(40);
  });

  it('records a request, charges the real cost and returns the rest of the reservation', async () => {
    const { data: requestId, error } = await admin.rpc('ai_record_request', {
      p_room: roomId,
      p_participant: participantId,
      p_workspace: workspaceId,
      p_provider: 'fake',
      p_model: 'fake-1',
      p_operation: 'agent_generate',
      p_input_tokens: 100,
      p_output_tokens: 50,
      p_latency_ms: 12,
      p_success: true,
      p_error_code: null,
      p_cost_usd: 0.0123,
      p_reserved: 60,
      p_charged: 2,
    });
    expect(error).toBeNull();
    expect(await balance(workspaceId)).toBe(98);
    const { data: ledger } = await admin.from('credit_ledger').select('delta, reason, ai_request_id').eq('ai_request_id', requestId!);
    expect(ledger).toEqual([{ delta: -2, reason: 'ai_request', ai_request_id: requestId }]);
  });

  it('lets workspace members read their requests and ledger, and nobody else', async () => {
    const mine = await signedInClient(host);
    expect((await mine.from('ai_requests').select('id').eq('payer_workspace_id', workspaceId)).data).toHaveLength(1);
    expect((await mine.from('credit_ledger').select('id').eq('workspace_id', workspaceId)).data).toHaveLength(2);
    const other = await signedInClient(stranger);
    expect((await other.from('ai_requests').select('id').eq('payer_workspace_id', workspaceId)).data).toEqual([]);
    expect((await other.from('credit_ledger').select('id').eq('workspace_id', workspaceId)).data).toEqual([]);
  });

  it('refuses writes and credit functions to authenticated users', async () => {
    const mine = await signedInClient(host);
    const insert = await mine.from('credit_ledger').insert({ workspace_id: workspaceId, delta: 1000, reason: 'manual_grant' });
    expect(insert.error).not.toBeNull();
    for (const [fn, args] of [
      ['grant_credits', { p_workspace: workspaceId, p_credits: 1000 }],
      ['ai_reserve_credits', { p_workspace: workspaceId, p_credits: -1000 }],
    ] as const) {
      const { error } = await mine.rpc(fn, args);
      expect(error, fn).not.toBeNull();
    }
    expect(await balance(workspaceId)).toBe(98);
  });

  it('rejects non-positive grants and reservations', async () => {
    expect((await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 0 })).error).not.toBeNull();
    expect((await admin.rpc('ai_reserve_credits', { p_workspace: workspaceId, p_credits: -5 })).error).not.toBeNull();
  });
});
```

Run (Codespace): `npx vitest run tests/db/ai-ledger.test.ts`
Expected: FAIL, le funzioni non esistono.

- [ ] **Step 2: migrazione**

`supabase/migrations/0004_ai_ledger.sql`:

```sql
-- Registro dei costi e ledger dei crediti (DATA-MODEL). Solo metadati: mai prompt né output.

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid references public.room_participants(id) on delete set null,
  payer_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  on_behalf_of_guest boolean not null default false,
  provider text not null,
  model text not null,
  operation text not null check (operation in ('agent_generate', 'image', 'translate', 'companion_eval', 'summarize_pdf', 'stt_session')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  units numeric,
  latency_ms integer not null check (latency_ms >= 0),
  success boolean not null,
  error_code text,
  cost_usd_estimated numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_requests_payer_created_idx on public.ai_requests (payer_workspace_id, created_at);
create index ai_requests_room_idx on public.ai_requests (room_id);
create index ai_requests_participant_created_idx on public.ai_requests (participant_id, created_at);
create index ai_requests_guest_cap_idx on public.ai_requests (room_id, participant_id) where on_behalf_of_guest;

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  delta integer not null check (delta <> 0 or reason = 'ai_request'),
  reason text not null check (reason in ('ai_request', 'manual_grant', 'manual_adjust')),
  ai_request_id uuid references public.ai_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_ledger_workspace_created_idx on public.credit_ledger (workspace_id, created_at);

alter table public.ai_requests enable row level security;
alter table public.credit_ledger enable row level security;

-- Sola lettura per i membri del workspace pagante. Nessuna policy di scrittura:
-- scrive solo il service role, attraverso le funzioni qui sotto.
create policy "members read ai requests of own workspaces"
  on public.ai_requests for select to authenticated
  using (public.is_workspace_member(payer_workspace_id));

create policy "members read ledger of own workspaces"
  on public.credit_ledger for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Riserva atomica: un solo update condizionale, così due richieste contemporanee non
-- possono spendere gli stessi crediti.
create function public.ai_reserve_credits(p_workspace uuid, p_credits integer)
returns boolean
language plpgsql
as $$
begin
  if p_credits <= 0 then
    raise exception 'credits to reserve must be positive';
  end if;
  update public.workspaces
    set credits_balance = credits_balance - p_credits
    where id = p_workspace and credits_balance >= p_credits;
  return found;
end;
$$;

create function public.ai_record_request(
  p_room uuid,
  p_participant uuid,
  p_workspace uuid,
  p_provider text,
  p_model text,
  p_operation text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer,
  p_success boolean,
  p_error_code text,
  p_cost_usd numeric,
  p_reserved integer,
  p_charged integer
)
returns uuid
language plpgsql
as $$
declare
  v_request uuid;
begin
  if p_reserved < 0 or p_charged < 0 then
    raise exception 'reserved and charged credits must not be negative';
  end if;
  insert into public.ai_requests (
    room_id, participant_id, payer_workspace_id, provider, model, operation,
    input_tokens, output_tokens, latency_ms, success, error_code, cost_usd_estimated
  ) values (
    p_room, p_participant, p_workspace, p_provider, p_model, p_operation,
    p_input_tokens, p_output_tokens, p_latency_ms, p_success, p_error_code, p_cost_usd
  ) returning id into v_request;

  insert into public.credit_ledger (workspace_id, delta, reason, ai_request_id)
    values (p_workspace, -p_charged, 'ai_request', v_request);

  -- Conguaglio: la riserva torna, si scala il costo reale. Se il costo supera la
  -- riserva il saldo può toccare zero ma non scendere sotto (vincolo della tabella).
  update public.workspaces
    set credits_balance = greatest(0, credits_balance + p_reserved - p_charged)
    where id = p_workspace;

  return v_request;
end;
$$;

create function public.grant_credits(p_workspace uuid, p_credits integer, p_reason text default 'manual_grant')
returns integer
language plpgsql
as $$
declare
  v_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'credits to grant must be positive';
  end if;
  insert into public.credit_ledger (workspace_id, delta, reason)
    values (p_workspace, p_credits, p_reason);
  update public.workspaces
    set credits_balance = credits_balance + p_credits
    where id = p_workspace
    returning credits_balance into v_balance;
  return v_balance;
end;
$$;

-- Postgres dà EXECUTE a PUBLIC per default: via PostgREST un utente potrebbe
-- regalarsi crediti. Solo il service role può chiamarle.
revoke execute on function public.ai_reserve_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.ai_record_request(uuid, uuid, uuid, text, text, text, integer, integer, integer, boolean, text, numeric, integer, integer) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.ai_reserve_credits(uuid, integer) to service_role;
grant execute on function public.ai_record_request(uuid, uuid, uuid, text, text, text, integer, integer, integer, boolean, text, numeric, integer, integer) to service_role;
grant execute on function public.grant_credits(uuid, integer, text) to service_role;
```

Run (Codespace): `npx supabase db reset && npm run db:types && npx prettier --write packages/db/src/database.types.ts`
Expected: quattro migrazioni applicate; i tipi includono `ai_requests`, `credit_ledger` e le tre funzioni.

- [ ] **Step 3: verifica e commit**

Run (Codespace): `npx vitest run tests/db/ai-ledger.test.ts && npm run test:db`
Expected: PASS (6 test), tutta la suite DB verde. Copia in locale `packages/db/src/database.types.ts` (`gh codespace cp`), poi `npm run typecheck`.

```bash
git add supabase/migrations/0004_ai_ledger.sql packages/db/src/database.types.ts tests/db/ai-ledger.test.ts
git commit -m "feat(db): ai requests and credit ledger with atomic reservation, service-role only"
```

---

### Task 4.2: `packages/ai` — prezzi, tipi e `AIService`

**Files:**
- Create: `packages/ai/package.json`, `packages/ai/tsconfig.json`, `packages/ai/src/pricing.ts`, `packages/ai/src/types.ts`, `packages/ai/src/service.ts`, `packages/ai/src/index.ts`
- Delete: `packages/ai/README.md`
- Test: `tests/unit/ai-pricing.test.ts`, `tests/unit/ai-service.test.ts`

**Interfaces:**
- Produces:
  - `PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }>`, `estimateCostUsd(model, inputTokens, outputTokens): number`, `creditsFor(costUsd): number` (arrotonda per eccesso, minimo 1 se il costo è > 0), `USD_PER_CREDIT = 0.01`
  - `type AgentContent = { kind: 'chart'; title; labels; values } | { kind: 'text'; title; body } | { kind: 'table'; title; columns; rows }`
  - `class ProviderError extends Error { code: ProviderErrorCode }` con `ProviderErrorCode = 'refusal' | 'max_tokens' | 'rate_limited' | 'timeout' | 'network' | 'invalid_output' | 'provider_error'`
  - `type GenerateAdapter = { provider: string; model: string; reserveCredits: number; generate(prompt: string): Promise<{ content: AgentContent; model: string; inputTokens: number; outputTokens: number }> }`
  - `type AiLedger = { reserve(workspaceId: string, credits: number): Promise<boolean>; record(entry: RecordEntry): Promise<void>; recentRequests(input: { participantId: string; workspaceId: string; sinceMs: number }): Promise<{ participant: number; workspace: number }> }`
  - `type RecordEntry = { roomId; participantId; workspaceId; provider; model; operation: 'agent_generate'; inputTokens: number | null; outputTokens: number | null; latencyMs; success; errorCode: string | null; costUsd; reserved; charged }`
  - `RATE_LIMITS = { perParticipantPerMinute: 6, perWorkspacePerMinute: 30 }`
  - `executeAgent(deps: { ledger: AiLedger; adapter: GenerateAdapter; now?: () => number }, request: { roomId; participantId; workspaceId; prompt }): Promise<AgentResult>` con `AgentResult = { ok: true; content: AgentContent; charged: number } | { ok: false; reason: 'quota_exceeded' | 'rate_limited' | 'provider_failed'; code?: ProviderErrorCode }`

- [ ] **Step 1: pacchetto**

`packages/ai/package.json`:

```json
{
  "name": "@omnicanvas/ai",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.128.0",
    "server-only": "^0.0.1",
    "zod": "^4.6.5"
  }
}
```

`packages/ai/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

```bash
git rm packages/ai/README.md
npm install
```

- [ ] **Step 2: test che falliscono**

`tests/unit/ai-pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { USD_PER_CREDIT, creditsFor, estimateCostUsd } from '@omnicanvas/ai';

describe('pricing', () => {
  it('estimates cost from list prices per million tokens', () => {
    expect(estimateCostUsd('claude-opus-5', 1_000_000, 0)).toBeCloseTo(5);
    expect(estimateCostUsd('claude-opus-5', 0, 1_000_000)).toBeCloseTo(25);
    expect(estimateCostUsd('claude-opus-5', 1_000, 400)).toBeCloseTo(0.015);
  });

  it('prices an unknown model at the most expensive known rate', () => {
    expect(estimateCostUsd('mystery-model', 1_000_000, 0)).toBeGreaterThanOrEqual(5);
  });

  it('costs nothing for the fake provider', () => {
    expect(estimateCostUsd('fake-1', 5_000, 5_000)).toBe(0);
  });

  it('rounds credits up and never charges zero for a paid call', () => {
    expect(USD_PER_CREDIT).toBe(0.01);
    expect(creditsFor(0)).toBe(0);
    expect(creditsFor(0.0001)).toBe(1);
    expect(creditsFor(0.015)).toBe(2);
    expect(creditsFor(0.02)).toBe(2);
  });
});
```

`tests/unit/ai-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  ProviderError,
  RATE_LIMITS,
  executeAgent,
  type AiLedger,
  type GenerateAdapter,
  type RecordEntry,
} from '@omnicanvas/ai';

const request = { roomId: 'r', participantId: 'p', workspaceId: 'w', prompt: 'grafico delle vendite' };

function ledger(balance: number, recent = { participant: 0, workspace: 0 }) {
  const records: RecordEntry[] = [];
  let current = balance;
  const port: AiLedger = {
    reserve: vi.fn(async (_w, credits) => {
      if (current < credits) return false;
      current -= credits;
      return true;
    }),
    record: vi.fn(async (entry) => {
      records.push(entry);
      current += entry.reserved - entry.charged;
    }),
    recentRequests: vi.fn(async () => recent),
  };
  return { port, records, balance: () => current };
}

function adapter(behaviour: 'ok' | ProviderError): GenerateAdapter {
  return {
    provider: 'anthropic',
    model: 'claude-opus-5',
    reserveCredits: 20,
    generate: vi.fn(async () => {
      if (behaviour !== 'ok') throw behaviour;
      return {
        content: { kind: 'text', title: 'Vendite', body: 'In crescita.' },
        model: 'claude-opus-5',
        inputTokens: 1_000,
        outputTokens: 400,
      };
    }),
  };
}

describe('executeAgent', () => {
  it('reserves, calls the provider, records the request and charges the real cost', async () => {
    const l = ledger(100);
    const a = adapter('ok');
    const result = await executeAgent({ ledger: l.port, adapter: a, now: () => 0 }, request);
    expect(result).toEqual({ ok: true, content: { kind: 'text', title: 'Vendite', body: 'In crescita.' }, charged: 2 });
    expect(l.port.reserve).toHaveBeenCalledWith('w', 20);
    expect(l.records).toHaveLength(1);
    expect(l.records[0]).toMatchObject({
      success: true,
      errorCode: null,
      inputTokens: 1_000,
      outputTokens: 400,
      reserved: 20,
      charged: 2,
      operation: 'agent_generate',
      provider: 'anthropic',
      model: 'claude-opus-5',
    });
    expect(l.balance()).toBe(98);
  });

  it('never calls the provider without enough credits', async () => {
    const l = ledger(5);
    const a = adapter('ok');
    expect(await executeAgent({ ledger: l.port, adapter: a }, request)).toEqual({ ok: false, reason: 'quota_exceeded' });
    expect(a.generate).not.toHaveBeenCalled();
    expect(l.records).toEqual([]);
  });

  it('stops at the participant and workspace rate limits before reserving', async () => {
    for (const recent of [
      { participant: RATE_LIMITS.perParticipantPerMinute, workspace: 0 },
      { participant: 0, workspace: RATE_LIMITS.perWorkspacePerMinute },
    ]) {
      const l = ledger(100, recent);
      const a = adapter('ok');
      expect(await executeAgent({ ledger: l.port, adapter: a }, request)).toEqual({ ok: false, reason: 'rate_limited' });
      expect(l.port.reserve).not.toHaveBeenCalled();
      expect(a.generate).not.toHaveBeenCalled();
    }
  });

  it('records a failed call, gives the reservation back and reports the code', async () => {
    const l = ledger(100);
    const result = await executeAgent({ ledger: l.port, adapter: adapter(new ProviderError('timeout')) }, request);
    expect(result).toEqual({ ok: false, reason: 'provider_failed', code: 'timeout' });
    expect(l.records[0]).toMatchObject({ success: false, errorCode: 'timeout', reserved: 20, charged: 0, inputTokens: null });
    expect(l.balance()).toBe(100);
  });

  it('treats unexpected errors as provider errors, without leaking their message', async () => {
    const l = ledger(100);
    const a: GenerateAdapter = { ...adapter('ok'), generate: vi.fn(async () => { throw new Error('secret prompt text'); }) };
    const result = await executeAgent({ ledger: l.port, adapter: a }, request);
    expect(result).toEqual({ ok: false, reason: 'provider_failed', code: 'provider_error' });
    expect(JSON.stringify(l.records)).not.toContain('secret');
  });

  it('measures latency with the injected clock', async () => {
    const l = ledger(100);
    let t = 1_000;
    await executeAgent({ ledger: l.port, adapter: adapter('ok'), now: () => (t += 250) }, request);
    expect(l.records[0]?.latencyMs).toBe(250);
  });
});
```

Run: `npx vitest run tests/unit/ai-pricing.test.ts tests/unit/ai-service.test.ts`
Expected: FAIL, `@omnicanvas/ai` non risolto.

- [ ] **Step 3: implementa**

`packages/ai/src/pricing.ts`:

```ts
// Prezzi di listino per milione di token (USD). L'economia vera si decide dopo l'MVP:
// qui serve solo una stima onesta per il ledger.
export const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'fake-1': { input: 0, output: 0 },
};

export const USD_PER_CREDIT = 0.01;

// Un modello sconosciuto (es. un fallback nuovo) si paga come il più caro: meglio
// sovrastimare che regalare crediti.
const FALLBACK_PRICE = Object.values(PRICES_USD_PER_MTOK).reduce((max, price) =>
  price.input + price.output > max.input + max.output ? price : max,
);

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES_USD_PER_MTOK[model] ?? FALLBACK_PRICE;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export function creditsFor(costUsd: number): number {
  if (costUsd <= 0) return 0;
  return Math.max(1, Math.ceil(Number((costUsd / USD_PER_CREDIT).toFixed(6))));
}
```

`packages/ai/src/types.ts`:

```ts
export type AgentContent =
  | { kind: 'chart'; title: string; labels: string[]; values: number[] }
  | { kind: 'text'; title: string; body: string }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] };

export type ProviderErrorCode =
  | 'refusal'
  | 'max_tokens'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'invalid_output'
  | 'provider_error';

// Porta solo un codice: il messaggio del provider può contenere pezzi del prompt.
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super(`provider failed: ${code}`);
    this.name = 'ProviderError';
    this.code = code;
  }
}

export type GenerateResult = {
  content: AgentContent;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type GenerateAdapter = {
  provider: string;
  model: string;
  // Crediti da riservare prima della chiamata: il costo massimo plausibile.
  reserveCredits: number;
  generate(prompt: string): Promise<GenerateResult>;
};

export type RecordEntry = {
  roomId: string;
  participantId: string;
  workspaceId: string;
  provider: string;
  model: string;
  operation: 'agent_generate';
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
  costUsd: number;
  reserved: number;
  charged: number;
};

export type AiLedger = {
  reserve(workspaceId: string, credits: number): Promise<boolean>;
  record(entry: RecordEntry): Promise<void>;
  recentRequests(input: {
    participantId: string;
    workspaceId: string;
    sinceMs: number;
  }): Promise<{ participant: number; workspace: number }>;
};
```

`packages/ai/src/service.ts`:

```ts
import { creditsFor, estimateCostUsd } from './pricing';
import {
  ProviderError,
  type AgentContent,
  type AiLedger,
  type GenerateAdapter,
  type ProviderErrorCode,
} from './types';

export const RATE_LIMITS = { perParticipantPerMinute: 6, perWorkspacePerMinute: 30 } as const;

export type AgentRequest = { roomId: string; participantId: string; workspaceId: string; prompt: string };

export type AgentResult =
  | { ok: true; content: AgentContent; charged: number }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limited' }
  | { ok: false; reason: 'provider_failed'; code: ProviderErrorCode };

// Catena di ARCHITECTURE §6: rate limit, quota (riserva), provider, misura, registro, scalo.
// Il prompt attraversa questa funzione e non viene mai salvato.
export async function executeAgent(
  deps: { ledger: AiLedger; adapter: GenerateAdapter; now?: () => number },
  request: AgentRequest,
): Promise<AgentResult> {
  const now = deps.now ?? Date.now;
  const { ledger, adapter } = deps;

  const recent = await ledger.recentRequests({
    participantId: request.participantId,
    workspaceId: request.workspaceId,
    sinceMs: 60_000,
  });
  if (
    recent.participant >= RATE_LIMITS.perParticipantPerMinute ||
    recent.workspace >= RATE_LIMITS.perWorkspacePerMinute
  ) {
    return { ok: false, reason: 'rate_limited' };
  }

  const reserved = adapter.reserveCredits;
  if (reserved > 0 && !(await ledger.reserve(request.workspaceId, reserved))) {
    return { ok: false, reason: 'quota_exceeded' };
  }

  const base = {
    roomId: request.roomId,
    participantId: request.participantId,
    workspaceId: request.workspaceId,
    provider: adapter.provider,
    operation: 'agent_generate' as const,
    reserved,
  };
  const started = now();
  try {
    const result = await adapter.generate(request.prompt);
    const costUsd = estimateCostUsd(result.model, result.inputTokens, result.outputTokens);
    const charged = creditsFor(costUsd);
    await ledger.record({
      ...base,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: now() - started,
      success: true,
      errorCode: null,
      costUsd,
      charged,
    });
    return { ok: true, content: result.content, charged };
  } catch (error) {
    const code: ProviderErrorCode = error instanceof ProviderError ? error.code : 'provider_error';
    await ledger.record({
      ...base,
      model: adapter.model,
      inputTokens: null,
      outputTokens: null,
      latencyMs: now() - started,
      success: false,
      errorCode: code,
      costUsd: 0,
      charged: 0,
    });
    return { ok: false, reason: 'provider_failed', code };
  }
}
```

`packages/ai/src/index.ts`:

```ts
export * from './types';
export { PRICES_USD_PER_MTOK, USD_PER_CREDIT, creditsFor, estimateCostUsd } from './pricing';
export { RATE_LIMITS, executeAgent, type AgentRequest, type AgentResult } from './service';
```

Nota: un errore dopo che il provider ha già consumato token (es. `invalid_output`) non
ha i token nel percorso d'errore; il task 4.3 li porta dentro `ProviderError` con
`usage`, e questo test si estende lì.

- [ ] **Step 4: verifica e commit**

Run: `npx vitest run tests/unit/ai-pricing.test.ts tests/unit/ai-service.test.ts && npm run typecheck && npm run lint`
Expected: PASS (10 test), puliti.

```bash
git add -A packages/ai package-lock.json tests/unit/ai-pricing.test.ts tests/unit/ai-service.test.ts
git commit -m "feat(ai): AIService with rate limit, credit reservation and ledger on every call"
```

---

### Task 4.3: Adapter Anthropic e adapter fake

**Files:**
- Create: `packages/ai/src/agent-schema.ts`, `packages/ai/src/anthropic.ts`, `packages/ai/src/fake.ts`
- Modify: `packages/ai/src/types.ts`, `packages/ai/src/service.ts`, `packages/ai/src/index.ts`, `tests/unit/ai-service.test.ts`
- Test: `tests/unit/ai-anthropic.test.ts`

**Interfaces:**
- Consumes: `LIMITS` e `contentSchema` di `@omnicanvas/canvas`; `ProviderError`, `GenerateAdapter`.
- Produces:
  - `ProviderError` accetta un secondo argomento opzionale `usage?: { model: string; inputTokens: number; outputTokens: number }`; `executeAgent` lo usa per addebitare i token consumati anche quando l'output è da scartare
  - `agentOutputSchema` (Zod), `toAgentContent(output): AgentContent` — valida contro i limiti del palco, altrimenti `ProviderError('invalid_output', usage)`
  - `AGENT_MODEL = 'claude-opus-5'`, `createAnthropicAdapter(options: { apiKey: string; fetch?: typeof fetch; timeoutMs?: number }): GenerateAdapter`
  - `createFakeAdapter(): GenerateAdapter` — provider `fake`, modello `fake-1`, `reserveCredits: 1`, contenuto deterministico dalla richiesta

- [ ] **Step 1: test che falliscono**

`tests/unit/ai-anthropic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AGENT_MODEL, ProviderError, createAnthropicAdapter, createFakeAdapter } from '@omnicanvas/ai';

type Captured = { url: string; body: Record<string, unknown>; headers: Headers };

function fakeFetch(status: number, payload: unknown, captured: Captured[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      headers: new Headers(init?.headers),
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'request-id': 'req_test' },
    });
  }) as typeof fetch;
}

function message(text: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: AGENT_MODEL,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 900, output_tokens: 300 },
    ...overrides,
  };
}

const chart = { content: { kind: 'chart', title: 'Vendite', labels: ['T1', 'T2'], values: [10, 20] } };

describe('anthropic adapter', () => {
  it('asks claude-opus-5 for structured output with server-side fallbacks', async () => {
    const captured: Captured[] = [];
    const adapter = createAnthropicAdapter({ apiKey: 'sk-test', fetch: fakeFetch(200, message(JSON.stringify(chart)), captured) });
    const result = await adapter.generate('grafico vendite per trimestre');
    expect(result).toEqual({
      content: { kind: 'chart', title: 'Vendite', labels: ['T1', 'T2'], values: [10, 20] },
      model: AGENT_MODEL,
      inputTokens: 900,
      outputTokens: 300,
    });
    const body = captured[0]!.body;
    expect(body.model).toBe('claude-opus-5');
    expect(body.fallbacks).toBe('default');
    expect(captured[0]!.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect((body.output_config as { format?: { type?: string } }).format?.type).toBe('json_schema');
  });

  it('reports a refusal before reading the content', async () => {
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(200, message('', { stop_reason: 'refusal', content: [], stop_details: { type: 'refusal', category: null, explanation: null } })),
    });
    await expect(adapter.generate('…')).rejects.toMatchObject({ code: 'refusal' });
  });

  it('reports truncated output as max_tokens, with the tokens spent', async () => {
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(200, message('{"content":{"kind":"te', { stop_reason: 'max_tokens' })),
    });
    const error = await adapter.generate('…').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: 'max_tokens', usage: { inputTokens: 900, outputTokens: 300 } });
  });

  it('rejects output beyond the stage limits as invalid_output, with the tokens spent', async () => {
    const huge = { content: { kind: 'text', title: 'Lungo', body: 'x'.repeat(5000) } };
    const adapter = createAnthropicAdapter({ apiKey: 'sk-test', fetch: fakeFetch(200, message(JSON.stringify(huge))) });
    await expect(adapter.generate('…')).rejects.toMatchObject({ code: 'invalid_output', usage: { outputTokens: 300 } });
  });

  it('maps rate limits and server errors to codes without the provider message', async () => {
    const limited = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }),
    });
    await expect(limited.generate('…')).rejects.toMatchObject({ code: 'rate_limited' });
    const broken = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(500, { type: 'error', error: { type: 'api_error', message: 'boom' } }),
    });
    const error = await broken.generate('…').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'provider_error' });
    expect((error as Error).message).not.toContain('boom');
  });
});

describe('fake adapter', () => {
  it('returns a deterministic chart when asked for one, text otherwise, at no cost', async () => {
    const fake = createFakeAdapter();
    expect(fake.provider).toBe('fake');
    expect((await fake.generate('Fammi un grafico delle vendite')).content.kind).toBe('chart');
    const text = await fake.generate('Riassumi la proposta');
    expect(text.content).toEqual({ kind: 'text', title: 'Riassumi la proposta', body: expect.any(String) });
    expect(text.model).toBe('fake-1');
  });
});
```

In `tests/unit/ai-service.test.ts` aggiungi:

```ts
  it('charges the tokens spent even when the output has to be thrown away', async () => {
    const l = ledger(100);
    const spent = new ProviderError('invalid_output', { model: 'claude-opus-5', inputTokens: 1_000, outputTokens: 400 });
    const result = await executeAgent({ ledger: l.port, adapter: adapter(spent) }, request);
    expect(result).toEqual({ ok: false, reason: 'provider_failed', code: 'invalid_output' });
    expect(l.records[0]).toMatchObject({ success: false, inputTokens: 1_000, outputTokens: 400, charged: 2 });
    expect(l.balance()).toBe(98);
  });
```

Run: `npx vitest run tests/unit/ai-anthropic.test.ts tests/unit/ai-service.test.ts`
Expected: FAIL.

- [ ] **Step 2: errore con uso e servizio**

In `packages/ai/src/types.ts` sostituisci la classe:

```ts
export type ProviderUsage = { model: string; inputTokens: number; outputTokens: number };

// Porta solo un codice e i token spesi: il messaggio del provider può contenere pezzi del prompt.
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly usage: ProviderUsage | undefined;

  constructor(code: ProviderErrorCode, usage?: ProviderUsage) {
    super(`provider failed: ${code}`);
    this.name = 'ProviderError';
    this.code = code;
    this.usage = usage;
  }
}
```

In `packages/ai/src/service.ts`, nel `catch`, sostituisci il blocco con:

```ts
  } catch (error) {
    const code: ProviderErrorCode = error instanceof ProviderError ? error.code : 'provider_error';
    const usage = error instanceof ProviderError ? error.usage : undefined;
    const costUsd = usage ? estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens) : 0;
    await ledger.record({
      ...base,
      model: usage?.model ?? adapter.model,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      latencyMs: now() - started,
      success: false,
      errorCode: code,
      costUsd,
      charged: creditsFor(costUsd),
    });
    return { ok: false, reason: 'provider_failed', code };
  }
```

- [ ] **Step 3: schema dell'output**

Aggiungi `"@omnicanvas/canvas": "^0.0.0"` alle `dependencies` di `packages/ai/package.json`, poi `npm install`.

`packages/ai/src/agent-schema.ts`:

```ts
import { contentSchema } from '@omnicanvas/canvas';
import { z } from 'zod';
import { ProviderError, type AgentContent, type ProviderUsage } from './types';

// Forma chiesta al modello. I limiti di lunghezza non stanno qui (lo structured output
// non li garantisce): li applica toAgentContent con lo schema del palco.
export const agentOutputSchema = z.object({
  content: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('chart'), title: z.string(), labels: z.array(z.string()), values: z.array(z.number()) }),
    z.object({ kind: z.literal('text'), title: z.string(), body: z.string() }),
    z.object({ kind: z.literal('table'), title: z.string(), columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  ]),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

const PROBE_ID = '00000000-0000-4000-8000-000000000000';

export function toAgentContent(output: AgentOutput, usage: ProviderUsage): AgentContent {
  const { kind, ...data } = output.content;
  const checked = contentSchema.safeParse({ id: PROBE_ID, kind, data });
  if (!checked.success) throw new ProviderError('invalid_output', usage);
  return output.content;
}
```

- [ ] **Step 4: adapter Anthropic**

`packages/ai/src/anthropic.ts`:

```ts
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { LIMITS } from '@omnicanvas/canvas';
import { agentOutputSchema, toAgentContent } from './agent-schema';
import { creditsFor, estimateCostUsd } from './pricing';
import { ProviderError, type GenerateAdapter, type ProviderUsage } from './types';

export const AGENT_MODEL = 'claude-opus-5';
const MAX_TOKENS = 4_000;

// Istruzioni fisse: niente dati variabili qui, così il prefisso resta identico fra le richieste.
const SYSTEM_PROMPT = `Sei l'agente di OmniCanvas, dentro una riunione fra un consulente e il suo cliente.
Il consulente ti chiede un contenuto da mostrare sul palco condiviso. Produci un solo contenuto:
- "chart" per numeri da confrontare (etichette e valori della stessa lunghezza, al massimo ${LIMITS.labels});
- "table" per righe e colonne (al massimo ${LIMITS.columns} colonne e ${LIMITS.rows} righe);
- "text" per tutto il resto (al massimo ${LIMITS.body} caratteri, frasi brevi).
Titolo breve (al massimo ${LIMITS.title} caratteri). Scrivi nella lingua della richiesta.
Se mancano i dati, usa valori plausibili ed esplicitalo nel titolo con "(esempio)".`;

function mapApiError(error: unknown): ProviderError {
  if (error instanceof Anthropic.RateLimitError) return new ProviderError('rate_limited');
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('timeout');
  if (error instanceof Anthropic.APIConnectionError) return new ProviderError('network');
  return new ProviderError('provider_error');
}

export function createAnthropicAdapter(options: {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): GenerateAdapter {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: options.timeoutMs ?? 45_000,
    maxRetries: 1,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

  return {
    provider: 'anthropic',
    model: AGENT_MODEL,
    // Caso peggiore: circa 2.000 token di input e tutti i MAX_TOKENS di output.
    reserveCredits: creditsFor(estimateCostUsd(AGENT_MODEL, 2_000, MAX_TOKENS)),
    async generate(prompt) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model: AGENT_MODEL,
          max_tokens: MAX_TOKENS,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(agentOutputSchema) },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        });
      } catch (error) {
        throw mapApiError(error);
      }

      const usage: ProviderUsage = {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      if (response.stop_reason === 'refusal') throw new ProviderError('refusal', usage);
      if (response.stop_reason === 'max_tokens') throw new ProviderError('max_tokens', usage);
      const parsed = response.parsed_output;
      if (!parsed) throw new ProviderError('invalid_output', usage);
      return { content: toAgentContent(parsed, usage), ...usage };
    },
  };
}
```

Se `tsc` segnala che `fallbacks` o `output_config.effort` non esistono nei parametri di
`beta.messages.parse`, controlla `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts`
(`fallbacks?: BetaFallbacksParam`, `BetaOutputConfig`) e usa i nomi esatti; non usare `any`.
Se `parse` solleva un errore quando l'output è troncato prima di arrivare a
`stop_reason`, intercettalo e rilancia `ProviderError('max_tokens')`: il test lo verifica.

- [ ] **Step 5: adapter fake**

`packages/ai/src/fake.ts`:

```ts
import type { AgentContent, GenerateAdapter } from './types';

// Per sviluppo, CI ed e2e: nessuna rete, nessun costo, risposta deterministica.
export function createFakeAdapter(): GenerateAdapter {
  return {
    provider: 'fake',
    model: 'fake-1',
    reserveCredits: 1,
    async generate(prompt) {
      const title = prompt.trim().slice(0, 60) || 'Richiesta';
      const content: AgentContent = /grafic|chart/i.test(prompt)
        ? { kind: 'chart', title, labels: ['T1', 'T2', 'T3', 'T4'], values: [12, 18, 9, 21] }
        : { kind: 'text', title, body: 'Contenuto di prova generato senza modello.' };
      return { content, model: 'fake-1', inputTokens: prompt.length, outputTokens: 20 };
    },
  };
}
```

Aggiungi a `packages/ai/src/index.ts`:

```ts
export { agentOutputSchema, toAgentContent, type AgentOutput } from './agent-schema';
export { AGENT_MODEL, createAnthropicAdapter } from './anthropic';
export { createFakeAdapter } from './fake';
```

`index.ts` ora importa `anthropic.ts`, che importa `server-only`: nei test Vitest c'è già
l'alias allo stub; in `apps/web` il package si importa solo da moduli server.

- [ ] **Step 6: verifica e commit**

Run: `npx vitest run tests/unit/ai-anthropic.test.ts tests/unit/ai-service.test.ts tests/unit/ai-pricing.test.ts && npm run typecheck && npm run lint`
Expected: PASS (17 test), puliti.

Run: `grep -rIl '@anthropic-ai/sdk' --include='*.ts' --include='*.tsx' apps packages | grep -v '^packages/ai/'`
Expected: nessun output.

```bash
git add packages/ai package-lock.json tests/unit/ai-anthropic.test.ts tests/unit/ai-service.test.ts
git commit -m "feat(ai): anthropic adapter with structured output and fallbacks, fake adapter"
```

---

### Task 4.4: Ledger su Supabase, richiesta dell'agente e variabili

**Files:**
- Create: `apps/web/src/lib/ai/ledger.ts`, `apps/web/src/lib/ai/agent-request.ts`
- Modify: `apps/web/src/env-schema.ts`, `apps/web/src/env.ts`, `tests/unit/env.test.ts`, `apps/web/package.json`, `apps/web/next.config.ts`, `.env.example`, `docs/ENVIRONMENT.md`, `.devcontainer/start-services.sh`, `.github/workflows/ci.yml`
- Test: `tests/db/agent-request.test.ts`

**Interfaces:**
- Consumes: `executeAgent`, `GenerateAdapter`, `AiLedger`, `RecordEntry` (4.2-4.3); `resolveParticipant` (slice 2).
- Produces:
  - `ServerEnv.AI_PROVIDER: 'anthropic' | 'fake'`, `ServerEnv.ANTHROPIC_API_KEY?: string` (obbligatoria se `AI_PROVIDER = 'anthropic'`)
  - `createSupabaseLedger(admin): AiLedger`
  - `MAX_PROMPT_CHARS = 500`
  - `runAgentRequest(admin, adapter: GenerateAdapter | null, input: ResolveParticipantInput, prompt: string): Promise<{ status: number; body: unknown }>` — 200 `{ content, charged }`, 400 `invalid_prompt`, 402 `quota_exceeded`, 403 `host_only`/`not_a_participant`, 404, 410, 429 `rate_limited`, 502 `provider_failed` + `code`, 503 `agent_unavailable`
  - `readAgentUsage(admin, input): Promise<{ status: number; body: unknown }>` — 200 `{ balance, roomCredits }` solo per l'host

- [ ] **Step 1: test che falliscono**

In `tests/unit/env.test.ts`, aggiungi a `serverOk` la riga `AI_PROVIDER: 'fake',` e in fondo:

```ts
  it('requires the anthropic key only when the provider is anthropic', () => {
    expect(() => parseServerEnv({ ...serverOk, AI_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(parseServerEnv({ ...serverOk, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-x' }).AI_PROVIDER).toBe('anthropic');
    expect(parseServerEnv({ ...serverOk, AI_PROVIDER: 'fake' }).AI_PROVIDER).toBe('fake');
  });

  it('rejects an unknown ai provider', () => {
    expect(() => parseServerEnv({ ...serverOk, AI_PROVIDER: 'openai' })).toThrow(/AI_PROVIDER/);
  });
```

`tests/db/agent-request.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createFakeAdapter, type GenerateAdapter } from '@omnicanvas/ai';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { MAX_PROMPT_CHARS, readAgentUsage, runAgentRequest } from '@/lib/ai/agent-request';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

// Adapter che costa: 2 crediti riservati, 1.000 token in ingresso e 400 in uscita su Opus 5 = 2 crediti.
function paidAdapter(): GenerateAdapter {
  return {
    provider: 'test',
    model: 'claude-opus-5',
    reserveCredits: 2,
    generate: vi.fn(async (prompt: string) => ({
      content: { kind: 'text' as const, title: prompt.slice(0, 20), body: 'ok' },
      model: 'claude-opus-5',
      inputTokens: 1_000,
      outputTokens: 400,
    })),
  };
}

describe('runAgentRequest', () => {
  let host: TestUser;
  let joinCode: string;
  let workspaceId: string;
  let guestId: string;

  beforeAll(async () => {
    host = await createTestUser('agent-host');
    const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', host.id).single();
    workspaceId = ws!.id;
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Agente' });
    if (!room.ok) throw new Error('setup failed');
    joinCode = room.joinCode;
    await joinRoom(admin, { joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    const guest = await joinRoom(admin, { joinCode, userId: null, displayName: 'Cliente', language: 'en' });
    if (guest.kind !== 'joined') throw new Error('guest join failed');
    guestId = guest.participantId;
  });

  const asHost = () => ({ joinCode, userId: host.id, guestParticipantId: () => null });

  it('stops at the quota without calling the provider', async () => {
    const adapter = paidAdapter();
    expect(await runAgentRequest(admin, adapter, asHost(), 'grafico')).toEqual({ status: 402, body: { error: 'quota_exceeded' } });
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('charges N calls exactly and shows them in the usage counter', async () => {
    await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 10 });
    const adapter = paidAdapter();
    for (let i = 0; i < 3; i += 1) {
      const result = await runAgentRequest(admin, adapter, asHost(), `richiesta ${i}`);
      expect(result.status).toBe(200);
    }
    expect(await readAgentUsage(admin, asHost())).toEqual({ status: 200, body: { balance: 4, roomCredits: 6 } });
    const { count } = await admin.from('ai_requests').select('id', { count: 'exact', head: true }).eq('payer_workspace_id', workspaceId);
    expect(count).toBe(3);
  });

  it('refuses guests before anything else', async () => {
    const adapter = paidAdapter();
    const asGuest = { joinCode, userId: null, guestParticipantId: () => guestId };
    expect(await runAgentRequest(admin, adapter, asGuest, 'grafico')).toEqual({ status: 403, body: { error: 'host_only' } });
    expect((await readAgentUsage(admin, asGuest)).status).toBe(403);
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('validates the prompt and reports a missing provider', async () => {
    expect((await runAgentRequest(admin, paidAdapter(), asHost(), '   ')).status).toBe(400);
    expect((await runAgentRequest(admin, paidAdapter(), asHost(), 'x'.repeat(MAX_PROMPT_CHARS + 1))).status).toBe(400);
    expect(await runAgentRequest(admin, null, asHost(), 'grafico')).toEqual({ status: 503, body: { error: 'agent_unavailable' } });
  });

  it('works end to end with the fake adapter at no cost', async () => {
    const before = (await readAgentUsage(admin, asHost())).body as { balance: number };
    const result = await runAgentRequest(admin, createFakeAdapter(), asHost(), 'Fammi un grafico');
    expect(result).toMatchObject({ status: 200, body: { content: { kind: 'chart' }, charged: 0 } });
    expect((await readAgentUsage(admin, asHost())).body).toMatchObject({ balance: before.balance });
  });
});
```

Run: `npx vitest run tests/unit/env.test.ts` (locale) e nel Codespace `npx vitest run tests/db/agent-request.test.ts`
Expected: FAIL.

- [ ] **Step 2: variabili**

In `apps/web/src/env-schema.ts` sostituisci `serverSchema` con un oggetto più un
controllo incrociato:

```ts
const serverSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // Firma il cookie dell'ospite senza account: corto = falsificabile.
    GUEST_SESSION_SECRET: z
      .string()
      .min(32)
      .refine((value) => !value.startsWith('sostituisci'), {
        message: 'GUEST_SESSION_SECRET must not be the .env.example placeholder value',
      }),
    // Firmano i token di stanza. In locale valgono devkey/secret di `livekit-server --dev`.
    LIVEKIT_API_KEY: z.string().min(1),
    LIVEKIT_API_SECRET: z.string().min(1),
    // Stato di sessione (snapshot del palco). In locale: Redis + serverless-redis-http.
    KV_REST_API_URL: z.string().url(),
    KV_REST_API_TOKEN: z.string().min(1),
    // 'fake' in sviluppo, CI ed e2e: nessuna chiamata a pagamento.
    AI_PROVIDER: z.enum(['anthropic', 'fake']).default('anthropic'),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
  })
  .refine((env) => env.AI_PROVIDER !== 'anthropic' || Boolean(env.ANTHROPIC_API_KEY), {
    message: 'ANTHROPIC_API_KEY is required when AI_PROVIDER is anthropic',
    path: ['ANTHROPIC_API_KEY'],
  });
```

In `apps/web/src/env.ts`, dentro `parseServerEnv({ … })`:

```ts
    AI_PROVIDER: process.env.AI_PROVIDER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
```

In `.env.example`, sotto `ANTHROPIC_API_KEY=sk-ant-finta`:

```bash
# 'anthropic' in preview e produzione; 'fake' in sviluppo, CI ed e2e (nessun costo).
AI_PROVIDER=fake
```

In `docs/ENVIRONMENT.md`, tabella delle server: riga
`| AI_PROVIDER | 'anthropic' o 'fake'; con 'fake' l'agente risponde senza modello e senza costi |`.

In `.devcontainer/start-services.sh` in fondo: `ensure AI_PROVIDER fake`. In CI, `Build app`
→ `AI_PROVIDER: fake`; `Write .env.local` → `echo "AI_PROVIDER=fake"`.

Run: `npx vitest run tests/unit/env.test.ts`
Expected: PASS.

- [ ] **Step 3: ledger e richiesta**

In `apps/web/package.json`, `dependencies`: `"@omnicanvas/ai": "^0.0.0"`; in
`next.config.ts` aggiungi `"@omnicanvas/ai"` a `transpilePackages`. Poi `npm install`.

`apps/web/src/lib/ai/ledger.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import type { AiLedger } from '@omnicanvas/ai';

// Le funzioni dei crediti sono eseguibili solo dal service role (migrazione 0004).
export function createSupabaseLedger(admin: SupabaseClient<Database>): AiLedger {
  return {
    async reserve(workspaceId, credits) {
      const { data, error } = await admin.rpc('ai_reserve_credits', {
        p_workspace: workspaceId,
        p_credits: credits,
      });
      if (error) throw error;
      return data === true;
    },

    async record(entry) {
      const { error } = await admin.rpc('ai_record_request', {
        p_room: entry.roomId,
        p_participant: entry.participantId,
        p_workspace: entry.workspaceId,
        p_provider: entry.provider,
        p_model: entry.model,
        p_operation: entry.operation,
        p_input_tokens: entry.inputTokens,
        p_output_tokens: entry.outputTokens,
        p_latency_ms: entry.latencyMs,
        p_success: entry.success,
        p_error_code: entry.errorCode,
        p_cost_usd: entry.costUsd,
        p_reserved: entry.reserved,
        p_charged: entry.charged,
      });
      if (error) throw error;
    },

    async recentRequests({ participantId, workspaceId, sinceMs }) {
      const since = new Date(Date.now() - sinceMs).toISOString();
      const [participant, workspace] = await Promise.all([
        admin.from('ai_requests').select('id', { count: 'exact', head: true }).eq('participant_id', participantId).gte('created_at', since),
        admin.from('ai_requests').select('id', { count: 'exact', head: true }).eq('payer_workspace_id', workspaceId).gte('created_at', since),
      ]);
      if (participant.error) throw participant.error;
      if (workspace.error) throw workspace.error;
      return { participant: participant.count ?? 0, workspace: workspace.count ?? 0 };
    },
  };
}
```

Se i tipi generati rendono `p_error_code`, `p_input_tokens` o `p_output_tokens` non
nullabili, è un limite del generatore sui parametri delle funzioni: passa il valore con
un cast locale commentato (`as unknown as string`), non cambiare la funzione SQL.

`apps/web/src/lib/ai/agent-request.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { executeAgent, type GenerateAdapter } from '@omnicanvas/ai';
import { resolveParticipant, type ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
import { createSupabaseLedger } from './ledger';

export const MAX_PROMPT_CHARS = 500;

type Admin = SupabaseClient<Database>;
type Result = { status: number; body: unknown };

const REFUSALS: Record<'not_found' | 'ended' | 'forbidden', Result> = {
  not_found: { status: 404, body: { error: 'room_not_found' } },
  ended: { status: 410, body: { error: 'room_ended' } },
  forbidden: { status: 403, body: { error: 'not_a_participant' } },
};

// Solo l'host attiva l'agente e paga il workspace della stanza (spec §2.3).
async function resolveHost(admin: Admin, input: ResolveParticipantInput) {
  const resolved = await resolveParticipant(admin, input);
  if (resolved.kind !== 'ok') return { refusal: REFUSALS[resolved.kind] } as const;
  if (resolved.participant.role !== 'host') {
    return { refusal: { status: 403, body: { error: 'host_only' } } } as const;
  }
  const { data: room, error } = await admin.from('rooms').select('workspace_id').eq('id', resolved.room.id).single();
  if (error) throw error;
  return { roomId: resolved.room.id, participantId: resolved.participant.id, workspaceId: room.workspace_id } as const;
}

export async function runAgentRequest(
  admin: Admin,
  adapter: GenerateAdapter | null,
  input: ResolveParticipantInput,
  prompt: string,
): Promise<Result> {
  const host = await resolveHost(admin, input);
  if ('refusal' in host) return host.refusal;

  const trimmed = prompt.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PROMPT_CHARS) {
    return { status: 400, body: { error: 'invalid_prompt' } };
  }
  if (!adapter) return { status: 503, body: { error: 'agent_unavailable' } };

  const result = await executeAgent(
    { ledger: createSupabaseLedger(admin), adapter },
    { roomId: host.roomId, participantId: host.participantId, workspaceId: host.workspaceId, prompt: trimmed },
  );
  if (result.ok) return { status: 200, body: { content: result.content, charged: result.charged } };
  if (result.reason === 'quota_exceeded') return { status: 402, body: { error: 'quota_exceeded' } };
  if (result.reason === 'rate_limited') return { status: 429, body: { error: 'rate_limited' } };
  return { status: 502, body: { error: 'provider_failed', code: result.code } };
}

export async function readAgentUsage(admin: Admin, input: ResolveParticipantInput): Promise<Result> {
  const host = await resolveHost(admin, input);
  if ('refusal' in host) return host.refusal;
  const [{ data: workspace, error }, { data: rows, error: rowsError }] = await Promise.all([
    admin.from('workspaces').select('credits_balance').eq('id', host.workspaceId).single(),
    admin.from('credit_ledger').select('delta, ai_requests!inner(room_id)').eq('ai_requests.room_id', host.roomId),
  ]);
  if (error) throw error;
  if (rowsError) throw rowsError;
  const roomCredits = (rows ?? []).reduce((sum, row) => sum - row.delta, 0);
  return { status: 200, body: { balance: workspace.credits_balance, roomCredits } };
}
```

Se la join `ai_requests!inner(room_id)` non è tipizzata dal generatore, calcola
`roomCredits` in due query: gli id di `ai_requests` della stanza, poi la somma di
`credit_ledger.delta` con `.in('ai_request_id', ids)`.

- [ ] **Step 4: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit`; nel Codespace
`npx vitest run tests/db/agent-request.test.ts && npm run test:db`.
Expected: verde (5 test nuovi sul DB).

```bash
git add apps/web/src/lib/ai apps/web/src/env-schema.ts apps/web/src/env.ts apps/web/package.json apps/web/next.config.ts package-lock.json tests/unit/env.test.ts tests/db/agent-request.test.ts .env.example docs/ENVIRONMENT.md .devcontainer/start-services.sh .github/workflows/ci.yml
git commit -m "feat(web): agent request through AIService, supabase ledger, host usage counter"
```

---

### Task 4.5: Route dell'agente

**Files:**
- Create: `apps/web/src/lib/ai/adapter.ts`, `apps/web/src/app/room/[code]/agent/route.ts`

**Interfaces:**
- Consumes: `runAgentRequest`, `readAgentUsage` (4.4); `createAnthropicAdapter`, `createFakeAdapter`; `serverEnv`.
- Produces: `agentAdapter(): GenerateAdapter | null`; HTTP `POST /room/<code>/agent` `{ prompt }` e `GET /room/<code>/agent`, `Cache-Control: no-store`.

La route sta sotto `/room/<code>` come le altre (cookie ospite). Il 403 agli ospiti è
già provato nel task 4.4.

- [ ] **Step 1: adapter scelto dall'ambiente**

`apps/web/src/lib/ai/adapter.ts`:

```ts
import 'server-only';
import { createAnthropicAdapter, createFakeAdapter, type GenerateAdapter } from '@omnicanvas/ai';
import { serverEnv } from '@/env';

let cached: GenerateAdapter | null | undefined;

export function agentAdapter(): GenerateAdapter | null {
  if (cached !== undefined) return cached;
  const env = serverEnv();
  cached =
    env.AI_PROVIDER === 'fake'
      ? createFakeAdapter()
      : env.ANTHROPIC_API_KEY
        ? createAnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY })
        : null;
  return cached;
}
```

- [ ] **Step 2: route**

`apps/web/src/app/room/[code]/agent/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { agentAdapter } from '@/lib/ai/adapter';
import { readAgentUsage, runAgentRequest } from '@/lib/ai/agent-request';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import type { ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
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

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(_request: Request, { params }: Context) {
  const { code } = await params;
  const { status, body } = await readAgentUsage(createAdminSupabase(), await who(code));
  return NextResponse.json(body, { status, headers: noStore });
}

// Il prompt resta in memoria per la durata della richiesta: niente log, niente disco.
export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  let prompt = '';
  try {
    const body = (await request.json()) as { prompt?: unknown };
    prompt = typeof body.prompt === 'string' ? body.prompt : '';
  } catch {
    prompt = '';
  }
  const { status, body } = await runAgentRequest(createAdminSupabase(), agentAdapter(), await who(code), prompt);
  return NextResponse.json(body, { status, headers: noStore });
}
```

- [ ] **Step 3: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit` e la build con le variabili di CI.
Expected: verde; `grep -rEl "ANTHROPIC_API_KEY|sk-ant" apps/web/.next/static/` → nessun output.

```bash
git add apps/web/src/lib/ai/adapter.ts "apps/web/src/app/room/[code]/agent"
git commit -m "feat(web): agent route for requests and the host usage counter"
```

---

### Task 4.6: ✨ e contatore nell'interfaccia dell'host

**Files:**
- Create: `apps/web/src/lib/stage/use-agent.ts`, `apps/web/src/lib/stage/agent-messages.ts`, `apps/web/src/app/room/[code]/agent-panel.tsx`
- Modify: `apps/web/src/app/room/[code]/stage-area.tsx`
- Test: `tests/unit/agent-messages.test.ts`

**Interfaces:**
- Consumes: `POST`/`GET /room/<code>/agent`; `dispatch` di `useStage`; `AgentContent`; `Content` di canvas.
- Produces:
  - `agentErrorMessage(status: number, code?: string): string`
  - `toStageContent(content: AgentContent, id: string): Content`
  - `useAgent({ joinCode, onContent }): { busy: boolean; error: string | null; usage: { balance: number; roomCredits: number } | null; ask(prompt: string): Promise<void> }`
  - UI: bottone «✨ Chiedi all'agente», campo `Cosa ti serve?`, bottone «Invia», stato «L'agente sta lavorando…», contatore «Crediti: N · agente in questa stanza: M»

- [ ] **Step 1: test che fallisce**

`tests/unit/agent-messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { agentErrorMessage, toStageContent } from '@/lib/stage/agent-messages';

describe('agent messages', () => {
  it('explains each refusal with what to do', () => {
    expect(agentErrorMessage(402)).toBe('Crediti esauriti: chiedi una ricarica per usare ancora l’agente.');
    expect(agentErrorMessage(429)).toMatch(/Troppe richieste/);
    expect(agentErrorMessage(503)).toMatch(/non è configurato/);
    expect(agentErrorMessage(502, 'refusal')).toMatch(/non può rispondere/);
    expect(agentErrorMessage(502, 'invalid_output')).toMatch(/riprova/i);
    expect(agentErrorMessage(400)).toMatch(/500 caratteri/);
    expect(agentErrorMessage(0)).toMatch(/rete/);
  });

  it('turns agent output into stage content with the given id', () => {
    expect(toStageContent({ kind: 'text', title: 'T', body: 'B' }, 'id-1')).toEqual({
      id: 'id-1',
      kind: 'text',
      data: { title: 'T', body: 'B' },
    });
    expect(toStageContent({ kind: 'chart', title: 'C', labels: ['a'], values: [1] }, 'id-2')).toEqual({
      id: 'id-2',
      kind: 'chart',
      data: { title: 'C', labels: ['a'], values: [1] },
    });
  });
});
```

Run: `npx vitest run tests/unit/agent-messages.test.ts`
Expected: FAIL.

- [ ] **Step 2: messaggi e conversione**

`apps/web/src/lib/stage/agent-messages.ts`:

```ts
import type { AgentContent } from '@omnicanvas/ai';
import type { Content } from '@omnicanvas/canvas';

export function agentErrorMessage(status: number, code?: string): string {
  if (status === 402) return 'Crediti esauriti: chiedi una ricarica per usare ancora l’agente.';
  if (status === 429) return 'Troppe richieste in poco tempo: aspetta un minuto e riprova.';
  if (status === 503) return 'L’agente non è configurato su questo ambiente.';
  if (status === 400) return 'Scrivi una richiesta di al massimo 500 caratteri.';
  if (status === 403) return 'Solo l’host può chiamare l’agente.';
  if (status === 502 && code === 'refusal') return 'L’agente non può rispondere a questa richiesta: riformulala.';
  if (status === 502) return 'L’agente non è riuscito a rispondere: riprova tra poco.';
  return 'Problema di rete: controlla la connessione e riprova.';
}

export function toStageContent(content: AgentContent, id: string): Content {
  const { kind, ...data } = content;
  return { id, kind, data } as Content;
}
```

`import type` di `@omnicanvas/ai` sparisce in compilazione: il client non riceve
`@anthropic-ai/sdk` né `server-only`.

Run: `npx vitest run tests/unit/agent-messages.test.ts`
Expected: PASS.

- [ ] **Step 3: hook**

`apps/web/src/lib/stage/use-agent.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentContent } from '@omnicanvas/ai';
import { agentErrorMessage } from './agent-messages';

type Usage = { balance: number; roomCredits: number };

export function useAgent({ joinCode, onContent }: { joinCode: string; onContent: (content: AgentContent) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const refreshUsage = useCallback(async () => {
    const response = await fetch(`/room/${joinCode}/agent`, { cache: 'no-store' }).catch(() => null);
    if (response?.ok) setUsage((await response.json()) as Usage);
  }, [joinCode]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const ask = useCallback(
    async (prompt: string) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/room/${joinCode}/agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const body = (await response.json().catch(() => ({}))) as { content?: AgentContent; code?: string };
        if (response.ok && body.content) onContent(body.content);
        else setError(agentErrorMessage(response.status, body.code));
      } catch {
        setError(agentErrorMessage(0));
      } finally {
        setBusy(false);
        void refreshUsage();
      }
    },
    [joinCode, onContent, refreshUsage],
  );

  return { busy, error, usage, ask };
}
```

- [ ] **Step 4: pannello**

`apps/web/src/app/room/[code]/agent-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { StageCommand } from '@omnicanvas/canvas';
import { toStageContent } from '@/lib/stage/agent-messages';
import { useAgent } from '@/lib/stage/use-agent';

// Finché non arriva lo STT (slice 4B) la richiesta si scrive: è anche la via per chi
// non ha microfono. Il risultato va nel vassoio, come per ogni contenuto dell'agente.
export function AgentPanel({ joinCode, dispatch }: { joinCode: string; dispatch: (command: StageCommand) => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const agent = useAgent({
    joinCode,
    onContent: (content) => {
      dispatch({ type: 'TRAY_ADD', content: toStageContent(content, crypto.randomUUID()) });
      setPrompt('');
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-800 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="rounded bg-emerald-500 px-2 py-1 font-medium text-neutral-950">
          ✨ Chiedi all&apos;agente
        </button>
        {agent.usage && (
          <span className="text-neutral-400">
            Crediti: {agent.usage.balance} · agente in questa stanza: {agent.usage.roomCredits}
          </span>
        )}
      </div>
      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (prompt.trim()) void agent.ask(prompt);
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label className="flex flex-1 flex-col gap-1">
            Cosa ti serve?
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={500}
              placeholder="Es. un grafico delle vendite per trimestre"
              className="rounded bg-neutral-900 px-2 py-1"
            />
          </label>
          <button type="submit" disabled={agent.busy || !prompt.trim()} className="self-end rounded bg-neutral-100 px-3 py-1 text-neutral-900 disabled:opacity-40">
            Invia
          </button>
        </form>
      )}
      {agent.busy && <p className="text-neutral-300">L&apos;agente sta lavorando…</p>}
      {agent.error && <p className="text-amber-300">{agent.error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: montalo per l'host**

In `apps/web/src/app/room/[code]/stage-area.tsx` aggiungi la prop `joinCode: string` a
`Props`, importa `AgentPanel` e, nel ramo host, inserisci `<AgentPanel joinCode={joinCode} dispatch={dispatch} />`
subito prima della barra con «Nuova finestra». In `room-call.tsx` passa `joinCode={joinCode}`
a `<StageArea … />`.

- [ ] **Step 6: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit` e build con variabili di CI.
Expected: verde; `grep -rEl "ANTHROPIC|sk-ant|@anthropic-ai" apps/web/.next/static/` → nessun output.

Prova manuale nel Codespace (`AI_PROVIDER=fake`, crediti concessi con `grant_credits`):
host preme ✨, chiede «grafico vendite», il grafico arriva nel vassoio e il contatore
scende di 0 (fake gratuito); con 0 crediti e adapter a pagamento compare «Crediti
esauriti…». Screenshot a 1280 letto.

```bash
git add apps/web/src/lib/stage/use-agent.ts apps/web/src/lib/stage/agent-messages.ts "apps/web/src/app/room/[code]" tests/unit/agent-messages.test.ts
git commit -m "feat(web): agent button with typed request, tray delivery and credit counter"
```

---

### Task 4.7: Ricarica manuale dei crediti ed e2e

**Files:**
- Create: `scripts/grant-credits.mjs`, `e2e/agent.spec.ts`
- Modify: `package.json`, `playwright.config.ts`, `e2e/helpers.ts`

**Interfaces:**
- Produces: `npm run credits:grant -- <email> <crediti>`; `grantCreditsTo(email: string, credits: number): Promise<void>` in `e2e/helpers.ts`; `signUpHostWithRoom` restituisce anche `email`.

- [ ] **Step 1: script**

`scripts/grant-credits.mjs`:

```js
// Ricarica manuale (spec §6: nell'MVP i crediti si caricano a mano).
// Uso: npm run credits:grant -- persona@esempio.it 500
import { createClient } from '@supabase/supabase-js';

const [email, raw] = process.argv.slice(2);
const credits = Number(raw);
if (!email || !Number.isInteger(credits) || credits <= 0) {
  console.error('usage: npm run credits:grant -- <email> <positive credits>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const user = users.users.find((u) => u.email === email);
if (!user) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}
const { data: workspace, error: wsError } = await admin.from('workspaces').select('id').eq('owner_id', user.id).single();
if (wsError) throw wsError;
const { data: balance, error } = await admin.rpc('grant_credits', { p_workspace: workspace.id, p_credits: credits });
if (error) throw error;
console.log(`granted ${credits} credits to ${email}: balance ${balance}`);
```

In `package.json`, `scripts`: `"credits:grant": "node --env-file=.env.local scripts/grant-credits.mjs"`.

- [ ] **Step 2: e2e con crediti**

In `playwright.config.ts`, in cima:

```ts
import { loadEnvConfig } from '@next/env';

// Gli e2e concedono crediti con il service role: leggono lo stesso .env.local dell'app.
loadEnvConfig(process.cwd());
```

In `e2e/helpers.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export async function grantCreditsTo(email: string, credits: number): Promise<void> {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`no test user ${email}`);
  const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', user.id).single();
  const { error } = await admin.rpc('grant_credits', { p_workspace: ws!.id, p_credits: credits });
  if (error) throw error;
}
```

e fai restituire a `signUpHostWithRoom` anche `email` (`return { host, roomUrl: host.url(), email };`).

`e2e/agent.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { closeParticipants, grantCreditsTo, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

test('the host asks the agent and the content lands in the tray', async ({ browser }) => {
  const { host, email } = await signUpHostWithRoom(browser);
  await grantCreditsTo(email, 20);
  await host.reload();

  await expect(host.getByText(/Crediti: 20/)).toBeVisible({ timeout: 20_000 });
  await host.getByRole('button', { name: /Chiedi all'agente/ }).click();
  await host.getByLabel('Cosa ti serve?').fill('Fammi un grafico delle vendite');
  await host.getByRole('button', { name: 'Invia' }).click();

  const tray = host.getByRole('region', { name: 'Vassoio' });
  await expect(tray.getByText('Fammi un grafico delle vendite')).toBeVisible({ timeout: 20_000 });
  await expect(tray.getByText('grafico', { exact: true })).toBeVisible();
});

test('without credits the agent says so and nothing reaches the tray', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser);
  await host.getByRole('button', { name: /Chiedi all'agente/ }).click({ timeout: 20_000 });
  await host.getByLabel('Cosa ti serve?').fill('Riassumi la proposta');
  await host.getByRole('button', { name: 'Invia' }).click();
  await expect(host.getByText(/Crediti esauriti/)).toBeVisible({ timeout: 20_000 });
  await expect(host.getByRole('region', { name: 'Vassoio' }).getByText('Riassumi la proposta')).toHaveCount(0);
});

test('guests do not see the agent', async ({ browser }) => {
  const { roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(guest.getByRole('button', { name: /Chiedi all'agente/ })).toHaveCount(0);
});
```

L'adapter `fake` riserva 1 credito: senza crediti la riserva fallisce e il test del 402
è reale anche senza modello.

- [ ] **Step 3: verifica e commit**

Run (Codespace): `CI=1 npm run test:e2e -- --reporter=line`, due volte.
Expected: 26 test passati entrambe le volte.

Run (Codespace): `npm run credits:grant -- <email di un utente di prova> 50` → `granted 50 credits …`.

```bash
git add scripts/grant-credits.mjs package.json playwright.config.ts e2e
git commit -m "test(web): agent e2e with fake provider, manual credit grant script"
git push -u origin slice/4a-agente
gh pr create --base slice/3-palco --head slice/4a-agente --title "Slice 4A: agente e ledger" --body "$(cat <<'EOF'
Agente a comando dal bottone ✨ con richiesta scritta: AIService con rate limit,
riserva atomica dei crediti prima del provider, riga su ai_requests e scalo sul ledger
anche in caso d'errore. Adapter Anthropic (claude-opus-5, structured output, fallback
lato server) e adapter fake per sviluppo ed e2e. Contatore crediti per l'host,
ricarica manuale.

Impilata su #4 (slice 3). Piano: docs/plans/2026-09-26-slice-4a-agente-ledger.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: CI verde.

---

### Task 4.8: Chiusura della slice 4A

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, `docs/DATA-MODEL.md`, `CLAUDE.md`

- [ ] **Step 1: documenti**

`docs/ARCHITECTURE.md` §6: sotto il blocco della catena aggiungi «Implementazione:
`packages/ai/src/service.ts` (`executeAgent`) con porte `AiLedger` e `GenerateAdapter`.
La quota è una riserva atomica (`ai_reserve_credits`) prima della chiamata; dopo, un
conguaglio (`ai_record_request`) registra la richiesta, scala il costo reale e restituisce
il resto. 1 credito = 0,01 USD stimati. Adapter: `anthropic` (claude-opus-5, structured
output, `fallbacks: 'default'`) e `fake` per sviluppo, CI ed e2e.»

`docs/DATA-MODEL.md`: sotto `credit_ledger` aggiungi «Funzioni `ai_reserve_credits`,
`ai_record_request`, `grant_credits`: eseguibili solo dal service role (migrazione 0004).»

`docs/BACKLOG.md`, slice 4: spunta migrazione (ora 0004), `AIService`, ledger e rate
limit, `manual_grant`, `agent_generate`, contatore, test di accounting. Lascia aperte,
con «(slice 4B, serve la decisione di Sean)»: parola chiave, token STT, `packages/stt`,
immagini con conferma, modalità companion. Aggiungi ai debiti:

```markdown
- [ ] Richiesta scritta all'agente: tenerla anche dopo lo STT come via senza microfono?
- [ ] Contenuti di prova nel vassoio: toglierli quando `AI_PROVIDER=anthropic` è attivo
- [ ] Prezzi in `packages/ai/src/pricing.ts` scritti a mano: aggiornarli se cambia il listino
```

`CLAUDE.md`: slice 4A su `slice/4a-agente` (PR #5); prossimo passo slice 4B con le tre
decisioni, oppure slice 5 (gesture) che non ne dipende.

- [ ] **Step 2: verifica e commit**

Run: `npm run typecheck && npm run lint && npm run test:unit`; nel Codespace `npm run test:db && CI=1 npm run test:e2e`.
Expected: verde.

```bash
git add docs CLAUDE.md
git commit -m "docs: close slice 4a"
git push
```
