# Slice 4B — Voce dell'agente e immagini con conferma: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'host chiama l'agente con la voce, con la parola chiave, col gesto o col click;
dice che cosa gli serve, la richiesta arriva al modello come testo e il risultato entra nel
vassoio. Se l'agente propone un'immagine, l'host la conferma con ✓ o col pollice su e
l'immagine generata entra nel vassoio. Ogni passo che costa passa da `AIService`.

**Perché 4B:** chiude la riga 4 della spec (§8) dopo la 4A. Le tre decisioni che mancavano
sono prese: Deepgram Nova-3 (ADR-0011), openWakeWord con «Ehi Omnia» provvisorio
(ADR-0012), fal.ai FLUX schnell (ADR-0013).

**Fuori da questa slice, dichiarato:** la **modalità companion**. La spec (§8, note
sull'ordine) la ammette nella 4 solo se il flusso a comando è stabile, altrimenti dopo la 6
che condivide lo STT continuo; serve anche un tetto di spesa da decidere con Sean. Va in
`docs/BACKLOG.md` (task 4B.13). Anche il **VAD lato client** resta alla slice 6: nella
modalità a comando lo stream si apre solo dopo l'attivazione e la fine la segna
l'endpointing di Deepgram con un tetto di durata; il VAD serve quando lo STT è continuo
(sottotitoli, companion), come dice ADR-0006.

**Architecture:** `packages/ai` generalizza la catena della 4A in `executeMetered`
(rate limit → riserva → chiamata → registro → scalo) e ci appoggia tre operazioni:
`agent_generate` (esistente), `stt_session` (emissione del token STT) e `image`. Il
nuovo `packages/stt` contiene tutto ciò che tocca l'audio o il vendor STT: emissione del
token Deepgram (entry `./server`), microfono a 16 kHz, streaming verso Deepgram dal
browser, fine della richiesta, parola chiave openWakeWord in ONNX. L'audio non passa mai
dai nostri server: il server emette solo un token a vita breve. L'agente può rispondere con
una **proposta d'immagine** (titolo + descrizione), che resta nello stato locale dell'host
finché non viene confermata; la conferma chiama la route delle immagini, che restituisce i
byte al browser dell'host, e da lì seguono il percorso della slice 3 (`addImage`: byte
stream agli ospiti, mai sul nostro storage).

**Tech Stack:** Deepgram Nova-3 streaming (WebSocket `wss://api.deepgram.com/v1/listen`,
token da `POST /v1/auth/grant` con `ttl_seconds`), openWakeWord (modelli ONNX
`melspectrogram`, `embedding_model`, testa della parola chiave), `onnxruntime-web` nel
browser e `onnxruntime-node` nei test, Web Audio API (`AudioWorklet`), fal.ai
`fal-ai/flux/schnell` via REST (`https://fal.run/...`, `sync_mode: true`), Vitest,
Playwright.

**Spec:** `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (§2.3 agente, §3 promessa sui
dati, §4.5 flusso dell'agente, §4.7 richiesta AI, §6 economia, §7 sicurezza, §8 slice 4).
ADR da rileggere: 0001 (confine dei dati), 0005 e 0010 (ogni gesto ha il suo click;
`CONFIRM`/`REJECT`), 0006 (STT dal client, token a vita breve), 0011, 0012, 0013.
`docs/ARCHITECTURE.md` §6 (catena della richiesta AI) e il paragrafo sul trasferimento
immagini. Il piano 4A (`docs/plans/2026-09-26-slice-4a-agente-ledger.md`) per lo stile dei
test su DB e dell'adapter fake.

## Global Constraints

- Regola 1: audio, trascrizione, prompt, descrizione dell'immagine e byte dell'immagine **non** vanno in Postgres, nei log o in un file. `ai_requests` contiene solo metadati. Nessun `console.log` del testo trascritto, neanche in sviluppo.
- L'audio non raggiunge mai i nostri server (spec §3, ADR-0006): il browser parla direttamente con Deepgram. Il server emette solo il token, dopo aver verificato che chi lo chiede è l'host della stanza.
- Finché la parola chiave non scatta, nessun audio lascia il browser (spec §7). La parola chiave ascolta solo se l'host ha il microfono acceso nella call.
- Regola 4: token STT e immagini passano da `executeMetered`: quota controllata e crediti riservati **prima** del vendor, riga su `ai_requests` anche quando il vendor fallisce.
- `DEEPGRAM_API_KEY` e `FAL_KEY` solo server. Il browser riceve un JWT Deepgram con `ttl_seconds: 30`; nessuna chiave sotto `NEXT_PUBLIC_`.
- Confini: URL e SDK Deepgram solo in `packages/stt`; fal.ai solo in `packages/ai`. Il job CI `boundaries` lo verifica (task 4B.2 e 4B.10).
- Regola 6: ogni gesto ha il suo click. Indice alzato = ✨ + «🎙 Parla»; parola chiave = stessi due click; pollice su/giù = ✓/✗ sulla proposta.
- Solo l'host attiva l'agente, parla con lo STT dell'agente e conferma immagini; paga il workspace della stanza.
- Durata massima di una richiesta a voce: 30 s. Senza parole entro 7 s la sessione si chiude.
- Costo stimato: Nova-3 monolingue 0,0077 USD/min; una sessione si riserva e si addebita come 30 s (1 credito). FLUX schnell 0,003 USD per megapixel arrotondato per eccesso; `landscape_4_3` (1024×768) = 1 MP = 1 credito. 1 credito = 0,01 USD (4A).
- Rate limit: ogni operazione conta. Una richiesta a voce fa due righe (token + agente), quindi i limiti passano a **12/min per partecipante e 60/min per workspace** (dichiarato: tocca un limite di sicurezza).
- I modelli di parola chiave pre-addestrati di openWakeWord (es. `hey_jarvis`) sono CC BY-NC-SA 4.0: **solo sviluppo**, mai in produzione. `melspectrogram.onnx` ed `embedding_model.onnx` sono parte della libreria (Apache 2.0).
- Errori per l'utente in italiano, con cosa fare. Codici tecnici in inglese.
- Commit `<tipo>(<ambito>): <cosa>`, ambiti `ai`, `stt`, `web`, `ci`, `docs`. Branch `slice/4b-voce` da `slice/5-gesture`.

## Review Focus

1. **Microfono spento nella call** → la parola chiave non ascolta e il microfono del browser si chiude (indicatore del browser spento). Test nel task 4B.8 (`wakeWordShouldListen`).
2. **Token STT chiesto da un ospite o da un estraneo** → 403, nessuna chiamata a Deepgram, nessuna riga. Test nel task 4B.3.
3. **Host che resta muto dopo l'attivazione** → la sessione si chiude da sola dopo 7 s senza inviare nulla all'agente; parlato infinito → chiusa a 30 s con il testo raccolto fin lì. Test nel task 4B.4 (`commandStop`).
4. **Microfono negato o assente** → messaggio chiaro, la richiesta scritta resta disponibile, nessun token emesso inutilmente (il microfono si apre prima del token). Test nel task 4B.6 (`voiceErrorMessage`) e ordine delle chiamate nel task 4B.6.
5. **Il generatore d'immagini segnala contenuto non sicuro o restituisce un file troppo grande** → nessuna immagine nel vassoio, costo registrato, messaggio all'host. Test nel task 4B.10.

## Mappa dei file

```
packages/ai/src/
  types.ts                 AiOperation, ImageProposal, AgentOutcome, ProviderError con costUsd
  service.ts               executeMetered (generico) + executeAgent (lo usa)
  pricing.ts               IMAGE_PRICES_USD_PER_MP, STT_PRICES_USD_PER_MIN, sttSessionCostUsd
  agent-schema.ts          proposta d'immagine nello schema dell'agente
  anthropic.ts             prompt di sistema con "image"
  fake.ts                  proposta d'immagine nel fake
  fal.ts                   NUOVO: ImageAdapter fal.ai
  fake-image.ts            NUOVO: ImageAdapter fake (PNG 1×1)
  index.ts                 esporta le novità
packages/stt/              NUOVO package
  package.json, tsconfig.json, README.md
  src/server.ts            grantDeepgramToken (server-only)
  src/audio.ts             resampler, framer, toInt16 (puri)
  src/microphone.ts        openMicrophone (browser, AudioWorklet)
  src/deepgram.ts          deepgramUrl, parseDeepgramMessage (puri)
  src/command.ts           stato della richiesta a voce e commandStop (puri)
  src/listen.ts            listenForCommand (WebSocket + microfono), listenFake
  src/wakeword.ts          createWakeWordDetector (pipeline openWakeWord)
  src/index.ts             export browser
apps/web/
  next.config.ts           transpilePackages += @omnicanvas/stt
  src/env-schema.ts, src/env.ts        DEEPGRAM_API_KEY, FAL_KEY, FAL_IMAGE_MODEL
  src/lib/ai/agent-request.ts          resolveHost esportato con lingua; risposta proposta
  src/lib/ai/image-adapter.ts          NUOVO
  src/lib/ai/image-request.ts          NUOVO
  src/lib/voice/stt-config.ts          NUOVO
  src/lib/voice/stt-token.ts           NUOVO
  src/lib/voice/voice-messages.ts      NUOVO
  src/lib/voice/use-voice-request.ts   NUOVO
  src/lib/voice/wakeword-config.ts     NUOVO
  src/lib/voice/wake-gate.ts           NUOVO (wakeWordShouldListen, puro)
  src/lib/voice/use-wake-word.ts       NUOVO
  src/lib/stage/use-agent.ts           proposta + conferma
  src/lib/stage/agent-messages.ts      messaggi immagine
  src/lib/stage/gesture-actions.ts     CONFIRM/REJECT
  src/lib/stage/use-gestures.ts        onConfirm/onReject
  src/app/room/[code]/stt-token/route.ts   NUOVO
  src/app/room/[code]/image/route.ts       NUOVO
  src/app/room/[code]/agent-panel.tsx      🎙 Parla, proposta, parola chiave
  src/app/room/[code]/stage-area.tsx       useAgent sollevato in HostStage, micOn
  src/app/room/[code]/room-call.tsx        passa micOn
  public/models/wakeword/                  modelli ONNX (sviluppo: hey_jarvis)
tools/wakeword/            NUOVO: fixture audio e addestramento «Ehi Omnia»
tests/unit/                ai-metered, ai-fal, stt-grant, stt-audio, stt-deepgram,
                           stt-command, stt-listen, wakeword, wake-gate, voice-messages,
                           gesture-actions (aggiornato), env (aggiornato)
tests/db/                  stt-token.test.ts, image-request.test.ts
tests/fixtures/wakeword/   positive.wav, negative.wav
e2e/voice.spec.ts          NUOVO
.github/workflows/ci.yml   confini STT e fal
```

---

### Task 4B.1: `executeMetered` — la catena della 4A diventa generica

La 4A aveva una sola operazione. Adesso ne arrivano altre due: è la seconda
implementazione, il momento giusto per l'astrazione (CLAUDE.md).

**Files:**
- Modify: `packages/ai/src/types.ts`, `packages/ai/src/service.ts`, `packages/ai/src/pricing.ts`, `packages/ai/src/index.ts`
- Test: `tests/unit/ai-metered.test.ts` (nuovo); `tests/unit/ai-service.test.ts` e `tests/unit/ai-pricing.test.ts` devono restare verdi senza modifiche, salvo il valore di `RATE_LIMITS` se lo verificano.

**Interfaces:**
- Produces:
  - `type AiOperation = 'agent_generate' | 'image' | 'stt_session'`
  - `RecordEntry.operation: AiOperation`
  - `new ProviderError(code, usage?, costUsd?)` con `readonly costUsd: number | undefined`
  - `type MeteredCall<T> = { operation: AiOperation; provider: string; model: string; reserveCredits: number; run(): Promise<{ value: T; usage: ProviderUsage | null; costUsd: number }> }`
  - `type MeteredResult<T> = { ok: true; value: T; charged: number } | { ok: false; reason: 'quota_exceeded' | 'rate_limited' } | { ok: false; reason: 'provider_failed'; code: ProviderErrorCode }`
  - `executeMetered<T>(deps: { ledger: AiLedger; now?: () => number }, who: { roomId: string; participantId: string; workspaceId: string }, call: MeteredCall<T>): Promise<MeteredResult<T>>`
  - `RATE_LIMITS = { perParticipantPerMinute: 12, perWorkspacePerMinute: 60 }`
  - `IMAGE_PRICES_USD_PER_MP: Record<string, number>`, `STT_PRICES_USD_PER_MIN: Record<string, number>`, `STT_COMMAND_MAX_SECONDS = 30`, `sttSessionCostUsd(model: string): number`, `imageCostUsd(model: string, megapixels: number): number`

- [ ] **Step 1: Scrivere il test che fallisce**

`tests/unit/ai-metered.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  ProviderError,
  RATE_LIMITS,
  STT_COMMAND_MAX_SECONDS,
  creditsFor,
  executeMetered,
  imageCostUsd,
  sttSessionCostUsd,
  type AiLedger,
  type MeteredCall,
  type RecordEntry,
} from '@omnicanvas/ai';

const who = { roomId: 'r', participantId: 'p', workspaceId: 'w' };

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

function imageCall(run: MeteredCall<string>['run']): MeteredCall<string> {
  return { operation: 'image', provider: 'fal', model: 'fal-ai/flux/schnell', reserveCredits: 1, run };
}

describe('executeMetered', () => {
  it('charges a fixed-price call and records it without tokens', async () => {
    const l = ledger(5);
    const result = await executeMetered(
      { ledger: l.port, now: () => 0 },
      who,
      imageCall(async () => ({ value: 'bytes', usage: null, costUsd: 0.003 })),
    );
    expect(result).toEqual({ ok: true, value: 'bytes', charged: 1 });
    expect(l.balance()).toBe(4);
    expect(l.records[0]).toMatchObject({
      operation: 'image',
      provider: 'fal',
      model: 'fal-ai/flux/schnell',
      inputTokens: null,
      outputTokens: null,
      success: true,
      costUsd: 0.003,
      reserved: 1,
      charged: 1,
    });
  });

  it('does not run the call when the quota is exhausted', async () => {
    const run = vi.fn();
    const result = await executeMetered({ ledger: ledger(0).port }, who, imageCall(run));
    expect(result).toEqual({ ok: false, reason: 'quota_exceeded' });
    expect(run).not.toHaveBeenCalled();
  });

  it('counts every operation against the rate limit', async () => {
    const run = vi.fn();
    const l = ledger(100, { participant: RATE_LIMITS.perParticipantPerMinute, workspace: 0 });
    expect(await executeMetered({ ledger: l.port }, who, imageCall(run))).toEqual({
      ok: false,
      reason: 'rate_limited',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('charges what a failed call already cost and returns the rest', async () => {
    const l = ledger(5);
    const result = await executeMetered(
      { ledger: l.port },
      who,
      imageCall(async () => {
        throw new ProviderError('refusal', undefined, 0.003);
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'provider_failed', code: 'refusal' });
    expect(l.records[0]).toMatchObject({ success: false, errorCode: 'refusal', charged: 1 });
    expect(l.balance()).toBe(4);
  });

  it('refunds the whole reservation when a failure cost nothing', async () => {
    const l = ledger(5);
    await executeMetered(
      { ledger: l.port },
      who,
      imageCall(async () => {
        throw new Error('socket hang up');
      }),
    );
    expect(l.records[0]).toMatchObject({ errorCode: 'provider_error', charged: 0 });
    expect(l.balance()).toBe(5);
  });
});

describe('fixed prices', () => {
  it('prices a voice request as the maximum session length', () => {
    expect(STT_COMMAND_MAX_SECONDS).toBe(30);
    expect(sttSessionCostUsd('nova-3')).toBeCloseTo(0.00385, 6);
    expect(creditsFor(sttSessionCostUsd('nova-3'))).toBe(1);
    expect(sttSessionCostUsd('fake-stt')).toBe(0);
  });

  it('bills images per started megapixel', () => {
    expect(imageCostUsd('fal-ai/flux/schnell', 0.79)).toBeCloseTo(0.003, 6);
    expect(imageCostUsd('fal-ai/flux/schnell', 1.2)).toBeCloseTo(0.006, 6);
    expect(imageCostUsd('fake-image', 1)).toBe(0);
  });

  it('prices unknown models as the most expensive known one', () => {
    expect(imageCostUsd('mystery', 1)).toBeGreaterThanOrEqual(imageCostUsd('fal-ai/flux/schnell', 1));
    expect(sttSessionCostUsd('mystery')).toBeGreaterThanOrEqual(sttSessionCostUsd('nova-3'));
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/ai-metered.test.ts`
Expected: FAIL, `executeMetered` / `sttSessionCostUsd` non esportati.

- [ ] **Step 3: Tipi**

In `packages/ai/src/types.ts` sostituire la classe `ProviderError` e il campo `operation`:

```ts
export type AiOperation = 'agent_generate' | 'image' | 'stt_session';

// Porta solo un codice, i token spesi e, per i prezzi fissi, quanto è già costata la
// chiamata: il messaggio del provider può contenere pezzi del prompt.
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly usage: ProviderUsage | undefined;
  readonly costUsd: number | undefined;

  constructor(code: ProviderErrorCode, usage?: ProviderUsage, costUsd?: number) {
    super(`provider failed: ${code}`);
    this.name = 'ProviderError';
    this.code = code;
    this.usage = usage;
    this.costUsd = costUsd;
  }
}
```

e in `RecordEntry`: `operation: AiOperation;`

- [ ] **Step 4: Prezzi**

In fondo a `packages/ai/src/pricing.ts`:

```ts
// Prezzi di listino verificati a settembre 2026 (ADR-0011, ADR-0013).
export const STT_PRICES_USD_PER_MIN: Record<string, number> = {
  'nova-3': 0.0077,
  'fake-stt': 0,
};

export const IMAGE_PRICES_USD_PER_MP: Record<string, number> = {
  'fal-ai/flux/schnell': 0.003,
  'fake-image': 0,
};

// Il browser parla direttamente con Deepgram: non misuriamo i secondi reali, quindi una
// richiesta a voce si paga come la durata massima che il client consente.
export const STT_COMMAND_MAX_SECONDS = 30;

const maxOf = (table: Record<string, number>) => Math.max(...Object.values(table));

export function sttSessionCostUsd(model: string): number {
  const perMin = STT_PRICES_USD_PER_MIN[model] ?? maxOf(STT_PRICES_USD_PER_MIN);
  return (perMin * STT_COMMAND_MAX_SECONDS) / 60;
}

// fal fattura per megapixel iniziato.
export function imageCostUsd(model: string, megapixels: number): number {
  const perMp = IMAGE_PRICES_USD_PER_MP[model] ?? maxOf(IMAGE_PRICES_USD_PER_MP);
  return perMp * Math.max(1, Math.ceil(megapixels));
}
```

- [ ] **Step 5: `executeMetered` ed `executeAgent` sopra di esso**

Sostituire il contenuto di `packages/ai/src/service.ts`:

```ts
import { creditsFor, estimateCostUsd } from './pricing';
import {
  ProviderError,
  type AgentOutcome,
  type AiLedger,
  type AiOperation,
  type GenerateAdapter,
  type ProviderErrorCode,
  type ProviderUsage,
} from './types';

// Una richiesta a voce fa due righe (token STT + agente): i limiti contano ogni operazione.
export const RATE_LIMITS = { perParticipantPerMinute: 12, perWorkspacePerMinute: 60 } as const;

export type Payer = { roomId: string; participantId: string; workspaceId: string };

export type MeteredCall<T> = {
  operation: AiOperation;
  provider: string;
  model: string;
  // Crediti da riservare prima della chiamata: il costo massimo plausibile.
  reserveCredits: number;
  run(): Promise<{ value: T; usage: ProviderUsage | null; costUsd: number }>;
};

export type MeteredResult<T> =
  | { ok: true; value: T; charged: number }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limited' }
  | { ok: false; reason: 'provider_failed'; code: ProviderErrorCode };

// Catena di ARCHITECTURE §6: rate limit, quota (riserva), chiamata, misura, registro, scalo.
// Il contenuto attraversa questa funzione e non viene mai salvato.
export async function executeMetered<T>(
  deps: { ledger: AiLedger; now?: () => number },
  who: Payer,
  call: MeteredCall<T>,
): Promise<MeteredResult<T>> {
  const now = deps.now ?? Date.now;
  const { ledger } = deps;

  const recent = await ledger.recentRequests({
    participantId: who.participantId,
    workspaceId: who.workspaceId,
    sinceMs: 60_000,
  });
  if (
    recent.participant >= RATE_LIMITS.perParticipantPerMinute ||
    recent.workspace >= RATE_LIMITS.perWorkspacePerMinute
  ) {
    return { ok: false, reason: 'rate_limited' };
  }

  const reserved = call.reserveCredits;
  if (reserved > 0 && !(await ledger.reserve(who.workspaceId, reserved))) {
    return { ok: false, reason: 'quota_exceeded' };
  }

  const base = {
    roomId: who.roomId,
    participantId: who.participantId,
    workspaceId: who.workspaceId,
    provider: call.provider,
    operation: call.operation,
    reserved,
  };
  const started = now();
  try {
    const { value, usage, costUsd } = await call.run();
    const charged = creditsFor(costUsd);
    await ledger.record({
      ...base,
      model: usage?.model ?? call.model,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      latencyMs: now() - started,
      success: true,
      errorCode: null,
      costUsd,
      charged,
    });
    return { ok: true, value, charged };
  } catch (error) {
    const failure = error instanceof ProviderError ? error : null;
    const code: ProviderErrorCode = failure?.code ?? 'provider_error';
    const usage = failure?.usage;
    const costUsd =
      failure?.costUsd ??
      (usage ? estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens) : 0);
    await ledger.record({
      ...base,
      model: usage?.model ?? call.model,
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
}

export type AgentRequest = Payer & { prompt: string };

export type AgentResult =
  | { ok: true; content: AgentOutcome; charged: number }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limited' }
  | { ok: false; reason: 'provider_failed'; code: ProviderErrorCode };

export async function executeAgent(
  deps: { ledger: AiLedger; adapter: GenerateAdapter; now?: () => number },
  request: AgentRequest,
): Promise<AgentResult> {
  const { adapter } = deps;
  const result = await executeMetered(deps, request, {
    operation: 'agent_generate',
    provider: adapter.provider,
    model: adapter.model,
    reserveCredits: adapter.reserveCredits,
    async run() {
      const r = await adapter.generate(request.prompt);
      const usage = { model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
      return {
        value: r.content,
        usage,
        costUsd: estimateCostUsd(r.model, r.inputTokens, r.outputTokens),
      };
    },
  });
  return result.ok ? { ok: true, content: result.value, charged: result.charged } : result;
}
```

`AgentOutcome` arriva nel task 4B.9; fino ad allora aggiungere in `types.ts` l'alias
provvisorio `export type AgentOutcome = AgentContent;` (il task 4B.9 lo allarga).

In `packages/ai/src/index.ts`:

```ts
export * from './types';
export {
  IMAGE_PRICES_USD_PER_MP,
  PRICES_USD_PER_MTOK,
  STT_COMMAND_MAX_SECONDS,
  STT_PRICES_USD_PER_MIN,
  USD_PER_CREDIT,
  creditsFor,
  estimateCostUsd,
  imageCostUsd,
  sttSessionCostUsd,
} from './pricing';
export {
  RATE_LIMITS,
  executeAgent,
  executeMetered,
  type AgentRequest,
  type AgentResult,
  type MeteredCall,
  type MeteredResult,
  type Payer,
} from './service';
export { agentOutputSchema, toAgentContent, type AgentOutput } from './agent-schema';
export { AGENT_MODEL, createAnthropicAdapter } from './anthropic';
export { createFakeAdapter } from './fake';
```

- [ ] **Step 6: Verificare**

Run: `npx vitest run tests/unit/ai-metered.test.ts tests/unit/ai-service.test.ts tests/unit/ai-pricing.test.ts && npm run typecheck`
Expected: PASS. Se `ai-service.test.ts` verifica il valore numerico dei limiti, aggiornarlo a 12/60 e nient'altro.

- [ ] **Step 7: Commit**

```bash
git add packages/ai tests/unit/ai-metered.test.ts tests/unit/ai-service.test.ts
git commit -m "refactor(ai): generic metered call for agent, speech and image operations"
```

---

### Task 4B.2: `packages/stt` e il token Deepgram lato server

**Files:**
- Create: `packages/stt/package.json`, `packages/stt/tsconfig.json`, `packages/stt/src/server.ts`, `packages/stt/src/index.ts`
- Modify: `packages/stt/README.md`, `apps/web/next.config.ts`, `apps/web/src/env-schema.ts`, `apps/web/src/env.ts`, `.env.example`, `docs/ENVIRONMENT.md`, `.github/workflows/ci.yml`
- Test: `tests/unit/stt-grant.test.ts`, `tests/unit/env.test.ts`

**Interfaces:**
- Produces:
  - `@omnicanvas/stt/server`: `DEEPGRAM_MODEL = 'nova-3'`, `STT_TOKEN_TTL_SECONDS = 30`, `class SttGrantError extends Error { status: number }`, `grantDeepgramToken(options: { apiKey: string; fetch?: typeof fetch; ttlSeconds?: number }): Promise<{ accessToken: string; expiresIn: number }>`
  - `ServerEnv.DEEPGRAM_API_KEY?: string`, `ServerEnv.FAL_KEY?: string`, `ServerEnv.FAL_IMAGE_MODEL: 'fal-ai/flux/schnell'`

- [ ] **Step 1: Scrivere i test che falliscono**

`tests/unit/stt-grant.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { SttGrantError, grantDeepgramToken } from '@omnicanvas/stt/server';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('grantDeepgramToken', () => {
  it('asks for a 30 second token with the key in the header', async () => {
    const f = fakeFetch(200, { access_token: 'jwt', expires_in: 30 });
    expect(await grantDeepgramToken({ apiKey: 'dg-key', fetch: f })).toEqual({
      accessToken: 'jwt',
      expiresIn: 30,
    });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.deepgram.com/v1/auth/grant');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Token dg-key');
    // ttl_seconds, non ttl: un campo sbagliato viene ignorato e il token dura il default.
    expect(JSON.parse(init.body as string)).toEqual({ ttl_seconds: 30 });
  });

  it('turns vendor failures into a status-only error', async () => {
    await expect(
      grantDeepgramToken({ apiKey: 'k', fetch: fakeFetch(401, { err_msg: 'bad key' }) }),
    ).rejects.toEqual(new SttGrantError(401));
  });

  it('rejects a malformed answer', async () => {
    await expect(
      grantDeepgramToken({ apiKey: 'k', fetch: fakeFetch(200, { token: 'x' }) }),
    ).rejects.toEqual(new SttGrantError(502));
  });

  it('maps network errors to status 0', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(grantDeepgramToken({ apiKey: 'k', fetch: f })).rejects.toEqual(
      new SttGrantError(0),
    );
  });
});
```

In `tests/unit/env.test.ts` aggiungere (riusando l'oggetto di env valido già definito nel
file; se si chiama diversamente da `validServer`, adattare il nome):

```ts
describe('voice and image variables', () => {
  it('keeps Deepgram and fal optional: without them voice and images are off', () => {
    const env = parseServerEnv({ ...validServer, AI_PROVIDER: 'fake' });
    expect(env.DEEPGRAM_API_KEY).toBeUndefined();
    expect(env.FAL_KEY).toBeUndefined();
    expect(env.FAL_IMAGE_MODEL).toBe('fal-ai/flux/schnell');
  });

  it('accepts only image models with a known price', () => {
    expect(() =>
      parseServerEnv({ ...validServer, FAL_IMAGE_MODEL: 'fal-ai/something-new' }),
    ).toThrow(/FAL_IMAGE_MODEL/);
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/stt-grant.test.ts tests/unit/env.test.ts`
Expected: FAIL, `@omnicanvas/stt/server` non risolto; `FAL_IMAGE_MODEL` undefined.

- [ ] **Step 3: Il package**

`packages/stt/package.json`:

```json
{
  "name": "@omnicanvas/stt",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/server.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "server-only": "^0.0.1"
  }
}
```

`packages/stt/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`packages/stt/src/server.ts`:

```ts
import 'server-only';

export const DEEPGRAM_MODEL = 'nova-3';
// Basta per aprire il WebSocket: una connessione aperta resta viva dopo la scadenza.
export const STT_TOKEN_TTL_SECONDS = 30;

// Porta solo lo stato HTTP: il corpo dell'errore del vendor non serve e non va loggato.
export class SttGrantError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`stt grant failed: ${status}`);
    this.name = 'SttGrantError';
    this.status = status;
  }
}

export async function grantDeepgramToken(options: {
  apiKey: string;
  fetch?: typeof fetch;
  ttlSeconds?: number;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const send = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await send('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: options.ttlSeconds ?? STT_TOKEN_TTL_SECONDS }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new SttGrantError(0);
  }
  if (!response.ok) throw new SttGrantError(response.status);
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
  } | null;
  if (typeof body?.access_token !== 'string' || typeof body.expires_in !== 'number') {
    throw new SttGrantError(502);
  }
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}
```

`packages/stt/src/index.ts` (riempito dai task successivi):

```ts
// Entry per il browser. L'emissione dei token sta in ./server.
export {};
```

`packages/stt/README.md`:

```md
Microfono, parola chiave locale e streaming al vendor STT, tutto nel browser. L'audio non
passa dai nostri server: il server emette solo un token a vita breve (`./server`).
Vedi ADR-0006, ADR-0011 (Deepgram Nova-3) e ADR-0012 (openWakeWord).

Unico package che nomina Deepgram. Il VAD lato client arriva con la slice 6.
```

In `apps/web/next.config.ts` aggiungere `"@omnicanvas/stt"` a `transpilePackages`.
Aggiungere `"@omnicanvas/stt": "^0.0.0"` alle dipendenze di `apps/web/package.json`, poi
`npm install`.

- [ ] **Step 4: Variabili d'ambiente**

In `apps/web/src/env-schema.ts`, dentro `serverSchema` dopo `ANTHROPIC_API_KEY`:

```ts
    // Voce e immagini sono degradabili: senza chiave la richiesta scritta resta (ADR-0011, 0013).
    DEEPGRAM_API_KEY: z.string().min(1).optional(),
    FAL_KEY: z.string().min(1).optional(),
    // Solo modelli con un prezzo in IMAGE_PRICES_USD_PER_MP.
    FAL_IMAGE_MODEL: z.enum(['fal-ai/flux/schnell']).default('fal-ai/flux/schnell'),
```

In `apps/web/src/env.ts`, dentro `parseServerEnv({...})`:

```ts
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    FAL_KEY: process.env.FAL_KEY,
    FAL_IMAGE_MODEL: process.env.FAL_IMAGE_MODEL,
```

`.env.example`: togliere `OPENAI_API_KEY` (ADR-0013: nessun'altra funzione la usa; verificare
con `grep -rn OPENAI_API_KEY apps packages`, che deve restituire zero righe), aggiungere
`FAL_IMAGE_MODEL=fal-ai/flux/schnell`. In `docs/ENVIRONMENT.md`: togliere la riga
`OPENAI_API_KEY`, cambiare `FAL_KEY` in «generazione immagini (ADR-0013)», aggiungere
`FAL_IMAGE_MODEL` («modello fal; solo quelli con un prezzo nel listino di `packages/ai`»),
e alla riga `DEEPGRAM_API_KEY` aggiungere «(ADR-0011). Senza, la voce è spenta e resta la
richiesta scritta».

- [ ] **Step 5: Confini in CI**

In `.github/workflows/ci.yml`, job `boundaries`, dopo lo step dei provider AI:

```yaml
      - name: Vendor STT solo in packages/stt
        run: |
          hits=$(grep -rIl 'api\.deepgram\.com\|@deepgram/' \
                 --include='*.ts' --include='*.tsx' \
                 --exclude-dir=node_modules apps packages 2>/dev/null \
                 | grep -v '^packages/stt/' || true)
          if [ -n "$hits" ]; then
            echo "::error::Deepgram nominato fuori da packages/stt:"
            echo "$hits"
            exit 1
          fi
          echo "ok"
```

- [ ] **Step 6: Verificare**

Run: `npx vitest run tests/unit/stt-grant.test.ts tests/unit/env.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/stt apps/web/next.config.ts apps/web/package.json package-lock.json apps/web/src/env-schema.ts apps/web/src/env.ts .env.example docs/ENVIRONMENT.md .github/workflows/ci.yml tests/unit/stt-grant.test.ts tests/unit/env.test.ts
git commit -m "feat(stt): package stt with short-lived Deepgram token grant, env for voice and images"
```

---

### Task 4B.3: route del token STT, solo per l'host e a quota

**Files:**
- Modify: `apps/web/src/lib/ai/agent-request.ts` (esportare `resolveHost`, con lingua)
- Create: `apps/web/src/lib/voice/stt-config.ts`, `apps/web/src/lib/voice/stt-token.ts`, `apps/web/src/app/room/[code]/stt-token/route.ts`
- Test: `tests/db/stt-token.test.ts`

**Interfaces:**
- Consumes: `executeMetered`, `sttSessionCostUsd`, `creditsFor`, `STT_COMMAND_MAX_SECONDS` (4B.1); `grantDeepgramToken`, `DEEPGRAM_MODEL`, `SttGrantError` (4B.2).
- Produces:
  - `resolveHost(admin, input)` → `{ refusal: Result } | { roomId; participantId; workspaceId; language: string }`
  - `type SttConfig = { provider: 'deepgram'; model: string; grant(): Promise<{ accessToken: string; expiresIn: number }> } | { provider: 'fake'; model: 'fake-stt' } | null`
  - `sttConfig(): SttConfig`
  - `FAKE_TRANSCRIPT = 'Fammi un grafico delle vendite'`
  - `runSttToken(admin, config: SttConfig, input: ResolveParticipantInput): Promise<Result>` con body 200 `{ provider: 'deepgram'; token: string; model: string; language: string; maxSeconds: number } | { provider: 'fake'; transcript: string; maxSeconds: number }`
  - `POST /room/[code]/stt-token`

- [ ] **Step 1: Scrivere il test che fallisce**

`tests/db/stt-token.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { FAKE_TRANSCRIPT, runSttToken, type SttConfig } from '@/lib/voice/stt-token';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

function deepgram(grant: () => Promise<{ accessToken: string; expiresIn: number }>) {
  return { provider: 'deepgram', model: 'nova-3', grant: vi.fn(grant) } satisfies SttConfig;
}

describe('runSttToken', () => {
  let host: TestUser;
  let joinCode: string;
  let workspaceId: string;
  let guestId: string;

  beforeAll(async () => {
    host = await createTestUser('stt-host');
    const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', host.id).single();
    workspaceId = ws!.id;
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Voce' });
    if (!room.ok) throw new Error('setup failed');
    joinCode = room.joinCode;
    await joinRoom(admin, { joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    const guest = await joinRoom(admin, {
      joinCode,
      userId: null,
      displayName: 'Cliente',
      language: 'en',
    });
    if (guest.kind !== 'joined') throw new Error('guest join failed');
    guestId = guest.participantId;
  });

  const asHost = () => ({ joinCode, userId: host.id, guestParticipantId: () => null });

  it('refuses guests before any vendor call', async () => {
    const config = deepgram(async () => ({ accessToken: 'jwt', expiresIn: 30 }));
    const result = await runSttToken(admin, config, {
      joinCode,
      userId: null,
      guestParticipantId: () => guestId,
    });
    expect(result).toEqual({ status: 403, body: { error: 'host_only' } });
    expect(config.grant).not.toHaveBeenCalled();
  });

  it('says voice is off when no vendor is configured', async () => {
    expect(await runSttToken(admin, null, asHost())).toEqual({
      status: 503,
      body: { error: 'stt_unavailable' },
    });
  });

  it('stops at the quota without asking Deepgram for a token', async () => {
    const config = deepgram(async () => ({ accessToken: 'jwt', expiresIn: 30 }));
    expect(await runSttToken(admin, config, asHost())).toEqual({
      status: 402,
      body: { error: 'quota_exceeded' },
    });
    expect(config.grant).not.toHaveBeenCalled();
  });

  it('charges one credit and returns a token in the host language', async () => {
    await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 3 });
    const config = deepgram(async () => ({ accessToken: 'jwt', expiresIn: 30 }));
    expect(await runSttToken(admin, config, asHost())).toEqual({
      status: 200,
      body: { provider: 'deepgram', token: 'jwt', model: 'nova-3', language: 'it', maxSeconds: 30 },
    });
    const { data: rows } = await admin
      .from('ai_requests')
      .select('operation, provider, model, input_tokens, success')
      .eq('payer_workspace_id', workspaceId);
    expect(rows).toEqual([
      { operation: 'stt_session', provider: 'deepgram', model: 'nova-3', input_tokens: null, success: true },
    ]);
    const { data: ws } = await admin.from('workspaces').select('credits_balance').eq('id', workspaceId).single();
    expect(ws!.credits_balance).toBe(2);
  });

  it('records a failed grant and refunds it', async () => {
    const config = deepgram(async () => {
      throw new Error('vendor down');
    });
    expect(await runSttToken(admin, config, asHost())).toEqual({
      status: 502,
      body: { error: 'stt_failed' },
    });
    const { data: ws } = await admin.from('workspaces').select('credits_balance').eq('id', workspaceId).single();
    expect(ws!.credits_balance).toBe(2);
  });

  it('in fake mode returns a canned transcript for free', async () => {
    expect(await runSttToken(admin, { provider: 'fake', model: 'fake-stt' }, asHost())).toEqual({
      status: 200,
      body: { provider: 'fake', transcript: FAKE_TRANSCRIPT, maxSeconds: 30 },
    });
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/db/stt-token.test.ts` (serve Supabase locale: Codespace o CI job `db`)
Expected: FAIL, modulo `@/lib/voice/stt-token` mancante.

- [ ] **Step 3: `resolveHost` con la lingua**

In `apps/web/src/lib/ai/agent-request.ts` rendere `resolveHost` esportata e aggiungere la
lingua al valore di ritorno:

```ts
// Solo l'host attiva l'agente e paga il workspace della stanza (spec §2.3).
export async function resolveHost(admin: Admin, input: ResolveParticipantInput) {
  // ...corpo invariato fino al return...
  return {
    roomId: resolved.room.id,
    participantId: resolved.participant.id,
    workspaceId: room.workspace_id,
    language: resolved.participant.language,
  } as const;
}
```

In `runAgentRequest` la chiamata a `executeAgent` passa i campi uno per uno, quindi la
lingua non arriva al provider: lasciarla così.

- [ ] **Step 4: Configurazione e logica**

`apps/web/src/lib/voice/stt-config.ts`:

```ts
import 'server-only';
import { DEEPGRAM_MODEL, grantDeepgramToken } from '@omnicanvas/stt/server';
import { serverEnv } from '@/env';
import type { SttConfig } from './stt-token';

export function sttConfig(): SttConfig {
  const env = serverEnv();
  if (env.AI_PROVIDER === 'fake') return { provider: 'fake', model: 'fake-stt' };
  const apiKey = env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;
  return { provider: 'deepgram', model: DEEPGRAM_MODEL, grant: () => grantDeepgramToken({ apiKey }) };
}
```

`apps/web/src/lib/voice/stt-token.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import {
  STT_COMMAND_MAX_SECONDS,
  creditsFor,
  executeMetered,
  sttSessionCostUsd,
} from '@omnicanvas/ai';
import { resolveHost } from '@/lib/ai/agent-request';
import { createSupabaseLedger } from '@/lib/ai/ledger';
import type { ResolveParticipantInput } from '@/lib/rooms/resolve-participant';

export type SttConfig =
  | {
      provider: 'deepgram';
      model: string;
      grant(): Promise<{ accessToken: string; expiresIn: number }>;
    }
  | { provider: 'fake'; model: 'fake-stt' }
  | null;

// Ciò che "dice" l'host in sviluppo, CI ed e2e: nessun microfono, nessun costo.
export const FAKE_TRANSCRIPT = 'Fammi un grafico delle vendite';

// Lingue monolingue di Nova-3 che offriamo all'ingresso; le altre ricadono sull'inglese.
const LANGUAGES = new Set(['it', 'en', 'es', 'fr', 'de', 'pt', 'nl']);

type Result = { status: number; body: unknown };

export async function runSttToken(
  admin: SupabaseClient<Database>,
  config: SttConfig,
  input: ResolveParticipantInput,
): Promise<Result> {
  const host = await resolveHost(admin, input);
  if ('refusal' in host) return host.refusal;
  if (!config) return { status: 503, body: { error: 'stt_unavailable' } };

  const costUsd = sttSessionCostUsd(config.model);
  const result = await executeMetered(
    { ledger: createSupabaseLedger(admin) },
    host,
    {
      operation: 'stt_session',
      provider: config.provider,
      model: config.model,
      reserveCredits: creditsFor(costUsd),
      async run() {
        const token = config.provider === 'deepgram' ? await config.grant() : null;
        return { value: token, usage: null, costUsd };
      },
    },
  );

  if (!result.ok) {
    if (result.reason === 'quota_exceeded') return { status: 402, body: { error: 'quota_exceeded' } };
    if (result.reason === 'rate_limited') return { status: 429, body: { error: 'rate_limited' } };
    return { status: 502, body: { error: 'stt_failed' } };
  }
  if (config.provider === 'fake') {
    return {
      status: 200,
      body: { provider: 'fake', transcript: FAKE_TRANSCRIPT, maxSeconds: STT_COMMAND_MAX_SECONDS },
    };
  }
  return {
    status: 200,
    body: {
      provider: 'deepgram',
      token: result.value!.accessToken,
      model: config.model,
      language: LANGUAGES.has(host.language) ? host.language : 'en',
      maxSeconds: STT_COMMAND_MAX_SECONDS,
    },
  };
}
```

Nota: un errore del grant che non è `ProviderError` viene registrato come
`provider_error` con costo 0 dalla catena: la riserva torna intera, come vuole il test.

- [ ] **Step 5: La route**

`apps/web/src/app/room/[code]/stt-token/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { sttConfig } from '@/lib/voice/stt-config';
import { runSttToken } from '@/lib/voice/stt-token';

type Context = { params: Promise<{ code: string }> };

// Emette solo un token: l'audio va dal browser a Deepgram e non passa di qui (ADR-0006).
export async function POST(_request: Request, { params }: Context) {
  const { code } = await params;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  const result = await runSttToken(createAdminSupabase(), sttConfig(), {
    joinCode: code,
    userId: auth.user?.id ?? null,
    guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
```

- [ ] **Step 6: Verificare**

Run: `npx vitest run tests/db/stt-token.test.ts tests/db/agent-request.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/ai/agent-request.ts apps/web/src/lib/voice apps/web/src/app/room/[code]/stt-token tests/db/stt-token.test.ts
git commit -m "feat(web): host-only STT token route, metered as one credit per voice request"
```

---

### Task 4B.4: messaggi Deepgram e fine della richiesta a voce (puri)

**Files:**
- Create: `packages/stt/src/deepgram.ts`, `packages/stt/src/command.ts`
- Modify: `packages/stt/src/index.ts`
- Test: `tests/unit/stt-deepgram.test.ts`, `tests/unit/stt-command.test.ts`

**Interfaces:**
- Produces:
  - `deepgramUrl(options: { model: string; language: string }): string`
  - `type DeepgramEvent = { type: 'transcript'; text: string; isFinal: boolean; speechFinal: boolean } | { type: 'utterance_end' }`
  - `parseDeepgramMessage(raw: string): DeepgramEvent | null`
  - `COMMAND_LIMITS = { silenceMs: 7_000, maxMs: 30_000 }`
  - `type CommandState = { startedAt: number; finals: string[]; interim: string; ended: boolean }`
  - `startCommand(now: number): CommandState`
  - `onDeepgramEvent(state: CommandState, event: DeepgramEvent): CommandState`
  - `commandStop(state: CommandState, now: number, limits?: typeof COMMAND_LIMITS): 'speech_end' | 'silence' | 'max' | null`
  - `commandText(state: CommandState): string`

- [ ] **Step 1: Scrivere i test che falliscono**

`tests/unit/stt-deepgram.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deepgramUrl, parseDeepgramMessage } from '@omnicanvas/stt';

describe('deepgramUrl', () => {
  it('asks for raw 16 kHz PCM, interim results and endpointing', () => {
    const url = new URL(deepgramUrl({ model: 'nova-3', language: 'it' }));
    expect(url.origin + url.pathname).toBe('wss://api.deepgram.com/v1/listen');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      model: 'nova-3',
      language: 'it',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      interim_results: 'true',
      smart_format: 'true',
      endpointing: '500',
      utterance_end_ms: '1500',
    });
  });
});

describe('parseDeepgramMessage', () => {
  it('reads final and interim transcripts', () => {
    const raw = JSON.stringify({
      type: 'Results',
      is_final: true,
      speech_final: false,
      channel: { alternatives: [{ transcript: 'fammi un grafico' }] },
    });
    expect(parseDeepgramMessage(raw)).toEqual({
      type: 'transcript',
      text: 'fammi un grafico',
      isFinal: true,
      speechFinal: false,
    });
  });

  it('reads the end of an utterance', () => {
    expect(parseDeepgramMessage('{"type":"UtteranceEnd","last_word_end":2.1}')).toEqual({
      type: 'utterance_end',
    });
  });

  it('ignores metadata, unknown and broken messages', () => {
    expect(parseDeepgramMessage('{"type":"Metadata"}')).toBeNull();
    expect(parseDeepgramMessage('{"type":"Results"}')).toBeNull();
    expect(parseDeepgramMessage('not json')).toBeNull();
  });
});
```

`tests/unit/stt-command.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  COMMAND_LIMITS,
  commandStop,
  commandText,
  onDeepgramEvent,
  startCommand,
  type DeepgramEvent,
} from '@omnicanvas/stt';

const t = (text: string, isFinal: boolean, speechFinal = false): DeepgramEvent => ({
  type: 'transcript',
  text,
  isFinal,
  speechFinal,
});

describe('voice command', () => {
  it('ends when Deepgram marks the end of speech after some words', () => {
    let s = startCommand(0);
    s = onDeepgramEvent(s, t('fammi un', false));
    expect(commandStop(s, 1_000)).toBeNull();
    s = onDeepgramEvent(s, t('fammi un grafico', true));
    s = onDeepgramEvent(s, t('delle vendite', true, true));
    expect(commandStop(s, 2_000)).toBe('speech_end');
    expect(commandText(s)).toBe('fammi un grafico delle vendite');
  });

  it('also ends on UtteranceEnd, which arrives when endpointing misses', () => {
    let s = onDeepgramEvent(startCommand(0), t('riassumi', true));
    s = onDeepgramEvent(s, { type: 'utterance_end' });
    expect(commandStop(s, 3_000)).toBe('speech_end');
  });

  it('does not end on an utterance end before any word', () => {
    const s = onDeepgramEvent(startCommand(0), { type: 'utterance_end' });
    expect(commandStop(s, 1_000)).toBeNull();
  });

  it('gives up after the silence limit when nothing was said', () => {
    const s = startCommand(0);
    expect(commandStop(s, COMMAND_LIMITS.silenceMs - 1)).toBeNull();
    expect(commandStop(s, COMMAND_LIMITS.silenceMs)).toBe('silence');
    expect(commandText(s)).toBe('');
  });

  it('keeps listening past the silence limit once the host started talking', () => {
    const s = onDeepgramEvent(startCommand(0), t('allora', false));
    expect(commandStop(s, COMMAND_LIMITS.silenceMs + 1)).toBeNull();
  });

  it('cuts at the maximum length and keeps what was heard, interim included', () => {
    let s = onDeepgramEvent(startCommand(0), t('una tabella con', true));
    s = onDeepgramEvent(s, t('i costi', false));
    expect(commandStop(s, COMMAND_LIMITS.maxMs)).toBe('max');
    expect(commandText(s)).toBe('una tabella con i costi');
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/stt-deepgram.test.ts tests/unit/stt-command.test.ts`
Expected: FAIL, export mancanti.

- [ ] **Step 3: Implementare**

`packages/stt/src/deepgram.ts`:

```ts
// Unico file del browser che nomina Deepgram (ADR-0011).
export function deepgramUrl(options: { model: string; language: string }): string {
  const params = new URLSearchParams({
    model: options.model,
    language: options.language,
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    interim_results: 'true',
    smart_format: 'true',
    endpointing: '500',
    // Richiede interim_results: segnala la fine della frase anche col rumore di fondo.
    utterance_end_ms: '1500',
  });
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

export type DeepgramEvent =
  | { type: 'transcript'; text: string; isFinal: boolean; speechFinal: boolean }
  | { type: 'utterance_end' };

export function parseDeepgramMessage(raw: string): DeepgramEvent | null {
  let message: {
    type?: unknown;
    is_final?: unknown;
    speech_final?: unknown;
    channel?: { alternatives?: { transcript?: unknown }[] };
  };
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (message.type === 'UtteranceEnd') return { type: 'utterance_end' };
  if (message.type !== 'Results') return null;
  const text = message.channel?.alternatives?.[0]?.transcript;
  if (typeof text !== 'string') return null;
  return {
    type: 'transcript',
    text,
    isFinal: message.is_final === true,
    speechFinal: message.speech_final === true,
  };
}
```

`packages/stt/src/command.ts`:

```ts
import type { DeepgramEvent } from './deepgram';

// Senza parole entro silenceMs la sessione si chiude; mai oltre maxMs (costo fisso, 4B.1).
export const COMMAND_LIMITS = { silenceMs: 7_000, maxMs: 30_000 } as const;

export type CommandState = {
  startedAt: number;
  finals: string[];
  interim: string;
  ended: boolean;
};

export function startCommand(now: number): CommandState {
  return { startedAt: now, finals: [], interim: '', ended: false };
}

export function onDeepgramEvent(state: CommandState, event: DeepgramEvent): CommandState {
  if (event.type === 'utterance_end') {
    return { ...state, ended: state.finals.length > 0 || state.ended };
  }
  const text = event.text.trim();
  if (!event.isFinal) return { ...state, interim: text };
  const finals = text ? [...state.finals, text] : state.finals;
  return { ...state, finals, interim: '', ended: state.ended || (event.speechFinal && finals.length > 0) };
}

export function commandStop(
  state: CommandState,
  now: number,
  limits: { silenceMs: number; maxMs: number } = COMMAND_LIMITS,
): 'speech_end' | 'silence' | 'max' | null {
  if (state.ended) return 'speech_end';
  const elapsed = now - state.startedAt;
  if (elapsed >= limits.maxMs) return 'max';
  const heardAnything = state.finals.length > 0 || state.interim.length > 0;
  if (!heardAnything && elapsed >= limits.silenceMs) return 'silence';
  return null;
}

export function commandText(state: CommandState): string {
  return [...state.finals, state.interim].filter(Boolean).join(' ').trim();
}
```

`packages/stt/src/index.ts`:

```ts
// Entry per il browser. L'emissione dei token sta in ./server.
export { deepgramUrl, parseDeepgramMessage, type DeepgramEvent } from './deepgram';
export {
  COMMAND_LIMITS,
  commandStop,
  commandText,
  onDeepgramEvent,
  startCommand,
  type CommandState,
} from './command';
```

- [ ] **Step 4: Verificare**

Run: `npx vitest run tests/unit/stt-deepgram.test.ts tests/unit/stt-command.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stt/src tests/unit/stt-deepgram.test.ts tests/unit/stt-command.test.ts
git commit -m "feat(stt): Deepgram message parsing and end-of-command rules"
```

---

### Task 4B.5: microfono a 16 kHz e ascolto di una richiesta

**Files:**
- Create: `packages/stt/src/audio.ts`, `packages/stt/src/microphone.ts`, `packages/stt/src/listen.ts`
- Modify: `packages/stt/src/index.ts`
- Test: `tests/unit/stt-audio.test.ts`, `tests/unit/stt-listen.test.ts`

**Interfaces:**
- Consumes: `deepgramUrl`, `parseDeepgramMessage`, `startCommand`, `onDeepgramEvent`, `commandStop`, `commandText` (4B.4).
- Produces:
  - `SAMPLE_RATE = 16_000`, `FRAME_SAMPLES = 1_280`
  - `createResampler(inputRate: number): (input: Float32Array) => Float32Array`
  - `createFramer(size?: number): (samples: Float32Array) => Float32Array[]`
  - `toInt16(frame: Float32Array): Int16Array`
  - `class MicrophoneError extends Error { reason: 'denied' | 'missing' | 'unsupported' }`
  - `type Microphone = { onFrame(listener: (frame: Float32Array) => void): () => void; close(): Promise<void> }`
  - `openMicrophone(): Promise<Microphone>` (frame da 1280 campioni a 16 kHz, valori in [-1, 1])
  - `type SocketLike = { binaryType: string; readyState: number; send(data: ArrayBufferLike | string): void; close(): void; onopen: (() => void) | null; onmessage: ((event: { data: unknown }) => void) | null; onclose: (() => void) | null; onerror: (() => void) | null }`
  - `listenForCommand(options: { token: string; model: string; language: string; microphone: Microphone; onInterim?: (text: string) => void; signal?: AbortSignal; createSocket?: (url: string, protocols: string[]) => SocketLike; now?: () => number; tickMs?: number }): Promise<{ text: string; stop: 'speech_end' | 'silence' | 'max' | 'aborted' | 'error' }>`
  - `listenFake(transcript: string, options?: { onInterim?: (text: string) => void; delayMs?: number }): Promise<{ text: string; stop: 'speech_end' }>`

- [ ] **Step 1: Scrivere i test che falliscono**

`tests/unit/stt-audio.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FRAME_SAMPLES, createFramer, createResampler, toInt16 } from '@omnicanvas/stt';

describe('audio helpers', () => {
  it('downsamples 48 kHz to 16 kHz keeping the signal', () => {
    const resample = createResampler(48_000);
    const input = Float32Array.from({ length: 4_800 }, (_, i) => i / 4_800);
    const out = resample(input);
    expect(out.length).toBe(1_600);
    expect(out[800]).toBeCloseTo(input[2_400]!, 3);
  });

  it('keeps the phase across chunks of odd sizes', () => {
    const whole = createResampler(44_100)(new Float32Array(44_100).fill(0.5));
    const chunked = createResampler(44_100);
    let total = 0;
    for (let i = 0; i < 44_100; i += 128) total += chunked(new Float32Array(Math.min(128, 44_100 - i)).fill(0.5)).length;
    expect(Math.abs(total - whole.length)).toBeLessThanOrEqual(1);
    expect(Math.abs(total - 16_000)).toBeLessThanOrEqual(1);
  });

  it('cuts a stream into fixed frames and keeps the remainder', () => {
    const frame = createFramer();
    expect(frame(new Float32Array(1_000))).toHaveLength(0);
    const frames = frame(new Float32Array(2_000));
    expect(frames).toHaveLength(2);
    expect(frames.every((f) => f.length === FRAME_SAMPLES)).toBe(true);
    expect(frame(new Float32Array(439))).toHaveLength(0);
    expect(frame(new Float32Array(1))).toHaveLength(1);
  });

  it('converts to 16-bit PCM with clipping', () => {
    expect(Array.from(toInt16(Float32Array.from([0, 1, -1, 2, -2, 0.5])))).toEqual([
      0, 32767, -32768, 32767, -32768, 16384,
    ]);
  });
});
```

`tests/unit/stt-listen.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { listenFake, listenForCommand, type Microphone, type SocketLike } from '@omnicanvas/stt';

class FakeSocket implements SocketLike {
  binaryType = 'blob';
  readyState = 0;
  sent: (ArrayBufferLike | string)[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string, readonly protocols: string[]) {}
  send(data: ArrayBufferLike | string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  say(text: string, isFinal: boolean, speechFinal = false) {
    this.onmessage?.({
      data: JSON.stringify({
        type: 'Results',
        is_final: isFinal,
        speech_final: speechFinal,
        channel: { alternatives: [{ transcript: text }] },
      }),
    });
  }
}

function fakeMic() {
  let listener: ((frame: Float32Array) => void) | null = null;
  const mic: Microphone = {
    onFrame(l) {
      listener = l;
      return () => {
        listener = null;
      };
    },
    close: vi.fn(async () => {}),
  };
  return { mic, emit: (frame: Float32Array) => listener?.(frame), listening: () => listener !== null };
}

describe('listenForCommand', () => {
  it('streams PCM with the token as bearer protocol and returns the sentence', async () => {
    vi.useFakeTimers();
    let socket!: FakeSocket;
    const { mic, emit, listening } = fakeMic();
    const done = listenForCommand({
      token: 'jwt',
      model: 'nova-3',
      language: 'it',
      microphone: mic,
      now: () => Date.now(),
      tickMs: 100,
      createSocket: (url, protocols) => (socket = new FakeSocket(url, protocols)),
    });
    expect(socket.protocols).toEqual(['bearer', 'jwt']);
    emit(new Float32Array(1_280));
    expect(socket.sent).toHaveLength(0); // niente audio prima dell'apertura
    socket.open();
    emit(new Float32Array(1_280).fill(0.5));
    expect((socket.sent[0] as ArrayBuffer).byteLength).toBe(2_560);
    socket.say('fammi un grafico', true);
    socket.say('delle vendite', true, true);
    await vi.advanceTimersByTimeAsync(100);
    expect(await done).toEqual({ text: 'fammi un grafico delle vendite', stop: 'speech_end' });
    expect(socket.sent.at(-1)).toBe('{"type":"CloseStream"}');
    expect(socket.closed).toBe(true);
    expect(listening()).toBe(false);
    vi.useRealTimers();
  });

  it('closes without text after the silence limit', async () => {
    vi.useFakeTimers();
    let socket!: FakeSocket;
    const done = listenForCommand({
      token: 'jwt',
      model: 'nova-3',
      language: 'it',
      microphone: fakeMic().mic,
      now: () => Date.now(),
      createSocket: (url, protocols) => (socket = new FakeSocket(url, protocols)),
    });
    socket.open();
    await vi.advanceTimersByTimeAsync(7_500);
    expect(await done).toEqual({ text: '', stop: 'silence' });
    vi.useRealTimers();
  });

  it('stops when aborted and when the socket fails', async () => {
    const controller = new AbortController();
    let socket!: FakeSocket;
    const aborted = listenForCommand({
      token: 'jwt',
      model: 'nova-3',
      language: 'it',
      microphone: fakeMic().mic,
      signal: controller.signal,
      createSocket: (url, protocols) => (socket = new FakeSocket(url, protocols)),
    });
    controller.abort();
    expect(await aborted).toEqual({ text: '', stop: 'aborted' });

    const failed = listenForCommand({
      token: 'jwt',
      model: 'nova-3',
      language: 'it',
      microphone: fakeMic().mic,
      createSocket: (url, protocols) => (socket = new FakeSocket(url, protocols)),
    });
    socket.onerror?.();
    expect(await failed).toEqual({ text: '', stop: 'error' });
  });
});

describe('listenFake', () => {
  it('returns the canned sentence and shows it as interim first', async () => {
    const onInterim = vi.fn();
    expect(await listenFake('ciao', { onInterim, delayMs: 1 })).toEqual({
      text: 'ciao',
      stop: 'speech_end',
    });
    expect(onInterim).toHaveBeenCalledWith('ciao');
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/stt-audio.test.ts tests/unit/stt-listen.test.ts`
Expected: FAIL, export mancanti.

- [ ] **Step 3: Funzioni audio**

`packages/stt/src/audio.ts`:

```ts
// Deepgram e openWakeWord vogliono entrambi mono, 16 kHz; openWakeWord a blocchi di 80 ms.
export const SAMPLE_RATE = 16_000;
export const FRAME_SAMPLES = 1_280;

// Interpolazione lineare. La posizione frazionaria resta fra una chiamata e l'altra, così
// i blocchi da 128 campioni dell'AudioWorklet non introducono salti. Una posizione
// negativa (fino a -1) cade fra l'ultimo campione del blocco precedente e il primo di questo.
export function createResampler(inputRate: number): (input: Float32Array) => Float32Array {
  const step = inputRate / SAMPLE_RATE;
  let position = 0;
  let last = 0;
  return (input) => {
    const out: number[] = [];
    const at = (i: number) => (i < 0 ? last : input[i]!);
    while (position <= input.length - 1) {
      const i = Math.floor(position);
      const frac = position - i;
      const a = at(i);
      const b = i + 1 < input.length ? input[i + 1]! : a;
      out.push(a + (b - a) * frac);
      position += step;
    }
    position -= input.length;
    if (input.length > 0) last = input[input.length - 1]!;
    return Float32Array.from(out);
  };
}

export function createFramer(size = FRAME_SAMPLES): (samples: Float32Array) => Float32Array[] {
  let pending = new Float32Array(0);
  return (samples) => {
    const joined = new Float32Array(pending.length + samples.length);
    joined.set(pending);
    joined.set(samples, pending.length);
    const frames: Float32Array[] = [];
    let offset = 0;
    for (; offset + size <= joined.length; offset += size) frames.push(joined.slice(offset, offset + size));
    pending = joined.slice(offset);
    return frames;
  };
}

export function toInt16(frame: Float32Array): Int16Array {
  const out = new Int16Array(frame.length);
  for (let i = 0; i < frame.length; i += 1) {
    const v = Math.max(-1, Math.min(1, frame[i]!));
    out[i] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
  }
  return out;
}
```

- [ ] **Step 4: Microfono (browser)**

`packages/stt/src/microphone.ts`:

```ts
import { createFramer, createResampler } from './audio';

export class MicrophoneError extends Error {
  readonly reason: 'denied' | 'missing' | 'unsupported';

  constructor(reason: 'denied' | 'missing' | 'unsupported') {
    super(`microphone unavailable: ${reason}`);
    this.name = 'MicrophoneError';
    this.reason = reason;
  }
}

export type Microphone = {
  onFrame(listener: (frame: Float32Array) => void): () => void;
  close(): Promise<void>;
};

// L'AudioWorklet copia i blocchi da 128 campioni verso il thread principale; resample e
// taglio in frame stanno qui, dove si possono testare.
const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('omnicanvas-tap', Tap);
`;

export async function openMicrophone(): Promise<Microphone> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    throw new MicrophoneError('unsupported');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    throw new MicrophoneError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'missing');
  }

  const context = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
  await context.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const source = context.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(context, 'omnicanvas-tap');
  source.connect(tap);

  const resample = createResampler(context.sampleRate);
  const frame = createFramer();
  const listeners = new Set<(frame: Float32Array) => void>();
  tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
    for (const f of frame(resample(event.data))) listeners.forEach((l) => l(f));
  };

  return {
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      listeners.clear();
      tap.port.onmessage = null;
      source.disconnect();
      tap.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context.close();
    },
  };
}
```

- [ ] **Step 5: Ascolto di una richiesta**

`packages/stt/src/listen.ts`:

```ts
import { toInt16 } from './audio';
import { commandStop, commandText, onDeepgramEvent, startCommand } from './command';
import { deepgramUrl, parseDeepgramMessage } from './deepgram';
import type { Microphone } from './microphone';

export type SocketLike = {
  binaryType: string;
  readyState: number;
  send(data: ArrayBufferLike | string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
};

export type ListenStop = 'speech_end' | 'silence' | 'max' | 'aborted' | 'error';

const OPEN = 1;

// Il testo resta in memoria e torna al chiamante: niente log (regola 1).
export function listenForCommand(options: {
  token: string;
  model: string;
  language: string;
  microphone: Microphone;
  onInterim?: (text: string) => void;
  signal?: AbortSignal;
  createSocket?: (url: string, protocols: string[]) => SocketLike;
  now?: () => number;
  tickMs?: number;
}): Promise<{ text: string; stop: ListenStop }> {
  const now = options.now ?? Date.now;
  const create =
    options.createSocket ?? ((url, protocols) => new WebSocket(url, protocols) as unknown as SocketLike);

  return new Promise((resolve) => {
    let state = startCommand(now());
    let finished = false;
    // Il JWT temporaneo viaggia come sottoprotocollo: il browser non può mettere header.
    const socket = create(deepgramUrl({ model: options.model, language: options.language }), [
      'bearer',
      options.token,
    ]);
    socket.binaryType = 'arraybuffer';

    const unsubscribe = options.microphone.onFrame((frame) => {
      if (socket.readyState === OPEN) socket.send(toInt16(frame).buffer);
    });

    const finish = (stop: ListenStop) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      unsubscribe();
      options.signal?.removeEventListener('abort', onAbort);
      if (socket.readyState === OPEN) socket.send('{"type":"CloseStream"}');
      socket.close();
      resolve({ text: stop === 'aborted' || stop === 'error' ? '' : commandText(state), stop });
    };
    const onAbort = () => finish('aborted');

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const parsed = parseDeepgramMessage(event.data);
      if (!parsed) return;
      state = onDeepgramEvent(state, parsed);
      options.onInterim?.(commandText(state));
    };
    socket.onerror = () => finish('error');
    socket.onclose = () => finish(state.finals.length > 0 ? 'speech_end' : 'error');

    const timer = setInterval(() => {
      const stop = commandStop(state, now());
      if (stop) finish(stop);
    }, options.tickMs ?? 250);

    if (options.signal?.aborted) finish('aborted');
    else options.signal?.addEventListener('abort', onAbort);
  });
}

// Sviluppo, CI ed e2e: nessun microfono e nessun vendor.
export async function listenFake(
  transcript: string,
  options: { onInterim?: (text: string) => void; delayMs?: number } = {},
): Promise<{ text: string; stop: 'speech_end' }> {
  options.onInterim?.(transcript);
  await new Promise((r) => setTimeout(r, options.delayMs ?? 400));
  return { text: transcript, stop: 'speech_end' };
}
```

In `packages/stt/src/index.ts` aggiungere:

```ts
export { FRAME_SAMPLES, SAMPLE_RATE, createFramer, createResampler, toInt16 } from './audio';
export { MicrophoneError, openMicrophone, type Microphone } from './microphone';
export { listenFake, listenForCommand, type ListenStop, type SocketLike } from './listen';
```

- [ ] **Step 6: Verificare**

Run: `npx vitest run tests/unit/stt-audio.test.ts tests/unit/stt-listen.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Prova manuale con Deepgram vero (appena c'è la chiave)**

Nel Codespace, con `DEEPGRAM_API_KEY` in `.env.local` e `AI_PROVIDER=anthropic`: dal
browser dell'host, in console, `fetch('/room/<codice>/stt-token',{method:'POST'}).then(r=>r.json())`
deve restituire `provider: 'deepgram'` e un token. La prova completa (parlare e vedere il
testo) si fa nel task 4B.6. Se il WebSocket viene chiuso con 1008/401, provare il token
come parametro `access_token` nell'URL invece del sottoprotocollo (documentazione
Deepgram, «Using the Sec-WebSocket-Protocol»), aggiornare `listen.ts` e il test.

- [ ] **Step 8: Commit**

```bash
git add packages/stt/src tests/unit/stt-audio.test.ts tests/unit/stt-listen.test.ts
git commit -m "feat(stt): 16 kHz microphone frames and one-shot voice command over Deepgram"
```

---

### Task 4B.6: «🎙 Parla» nel pannello dell'agente

**Files:**
- Create: `apps/web/src/lib/voice/voice-messages.ts`, `apps/web/src/lib/voice/use-voice-request.ts`
- Modify: `apps/web/src/app/room/[code]/agent-panel.tsx`, `apps/web/src/app/room/[code]/stage-area.tsx`
- Test: `tests/unit/voice-messages.test.ts`, `e2e/voice.spec.ts`

**Interfaces:**
- Consumes: `POST /room/[code]/stt-token` (4B.3); `openMicrophone`, `MicrophoneError`, `listenForCommand`, `listenFake` (4B.5); `useAgent().ask` (4A).
- Produces:
  - `voiceErrorMessage(cause: { status?: number; mic?: 'denied' | 'missing' | 'unsupported'; stop?: 'silence' | 'error' }): string`
  - `useVoiceRequest({ joinCode, onText }): { state: 'idle' | 'starting' | 'listening'; interim: string; error: string | null; start(): Promise<void>; cancel(): void }`
  - `AgentPanel` prop nuova `listenRequest: number` (contatore: ogni incremento avvia l'ascolto; lo usano gesto e parola chiave)

- [ ] **Step 1: Scrivere i test che falliscono**

`tests/unit/voice-messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { voiceErrorMessage } from '@/lib/voice/voice-messages';

describe('voiceErrorMessage', () => {
  it('explains microphone problems and points to the written request', () => {
    expect(voiceErrorMessage({ mic: 'denied' })).toMatch(/permesso del microfono.*scrivi/i);
    expect(voiceErrorMessage({ mic: 'missing' })).toMatch(/nessun microfono.*scrivi/i);
    expect(voiceErrorMessage({ mic: 'unsupported' })).toMatch(/browser.*scrivi/i);
  });

  it('explains server refusals', () => {
    expect(voiceErrorMessage({ status: 402 })).toMatch(/Crediti esauriti/);
    expect(voiceErrorMessage({ status: 429 })).toMatch(/aspetta un minuto/);
    expect(voiceErrorMessage({ status: 503 })).toMatch(/voce non è attiva.*scrivi/i);
    expect(voiceErrorMessage({ status: 502 })).toMatch(/riprova/);
  });

  it('explains empty sessions', () => {
    expect(voiceErrorMessage({ stop: 'silence' })).toMatch(/Non ho sentito nulla/);
    expect(voiceErrorMessage({ stop: 'error' })).toMatch(/interrotto/);
  });
});
```

`e2e/voice.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { closeParticipants, grantCreditsTo, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

// In e2e AI_PROVIDER=fake: lo STT restituisce una frase fissa, senza microfono né vendor.
test('the host speaks a request and the chart lands in the tray', async ({ browser }) => {
  const { host, email } = await signUpHostWithRoom(browser);
  await grantCreditsTo(email, 20);
  await host.reload();

  await host.getByRole('button', { name: /Chiedi all'agente/ }).click({ timeout: 20_000 });
  await host.getByRole('button', { name: /Parla/ }).click();

  const tray = host.getByRole('region', { name: 'Vassoio' });
  await expect(tray.getByText('Fammi un grafico delle vendite')).toBeVisible({ timeout: 20_000 });
  await expect(tray.getByText('grafico', { exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/voice-messages.test.ts`
Expected: FAIL, modulo mancante. (L'e2e si verifica al passo 6.)

- [ ] **Step 3: Messaggi**

`apps/web/src/lib/voice/voice-messages.ts`:

```ts
const WRITE = 'Puoi sempre scrivere la richiesta qui sotto.';

export function voiceErrorMessage(cause: {
  status?: number;
  mic?: 'denied' | 'missing' | 'unsupported';
  stop?: 'silence' | 'error';
}): string {
  if (cause.mic === 'denied') return `Serve il permesso del microfono per parlare all'agente. ${WRITE}`;
  if (cause.mic === 'missing') return `Nessun microfono trovato. ${WRITE}`;
  if (cause.mic === 'unsupported') return `Questo browser non permette di parlare all'agente. ${WRITE}`;
  if (cause.status === 402) return 'Crediti esauriti: chiedi una ricarica per usare ancora l’agente.';
  if (cause.status === 429) return 'Troppe richieste in poco tempo: aspetta un minuto e riprova.';
  if (cause.status === 503) return `La voce non è attiva su questo ambiente. ${WRITE}`;
  if (cause.stop === 'silence') return 'Non ho sentito nulla: premi di nuovo «Parla» e fai la richiesta.';
  if (cause.stop === 'error') return 'L’ascolto si è interrotto: controlla la connessione e riprova.';
  return 'La trascrizione non è disponibile ora: riprova tra poco.';
}
```

- [ ] **Step 4: Hook**

Ordine voluto (Review Focus 4): **prima il microfono, poi il token**. Se il microfono è
negato non si chiede il token, quindi non si addebita nulla. Nel ramo `fake` il microfono
si apre lo stesso (Playwright lancia Chromium con `--use-fake-device-for-media-stream`) e
si chiude subito.

`apps/web/src/lib/voice/use-voice-request.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MicrophoneError,
  listenFake,
  listenForCommand,
  openMicrophone,
  type Microphone,
} from '@omnicanvas/stt';
import { voiceErrorMessage } from './voice-messages';

type TokenBody =
  | { provider: 'deepgram'; token: string; model: string; language: string }
  | { provider: 'fake'; transcript: string };

export function useVoiceRequest({
  joinCode,
  onText,
}: {
  joinCode: string;
  onText: (text: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'starting' | 'listening'>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  useEffect(() => cancel, [cancel]);

  const start = useCallback(async () => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setState('starting');
    setError(null);
    setInterim('');
    let microphone: Microphone | null = null;
    try {
      // Prima il microfono: se è negato non si chiede (e non si paga) il token.
      microphone = await openMicrophone();
      const response = await fetch(`/room/${joinCode}/stt-token`, { method: 'POST' });
      const body = (await response.json().catch(() => null)) as TokenBody | null;
      if (!response.ok || !body) {
        setError(voiceErrorMessage({ status: response.status }));
        return;
      }
      setState('listening');
      if (body.provider === 'fake') {
        const result = await listenFake(body.transcript, { onInterim: setInterim });
        if (!controller.signal.aborted) onText(result.text);
        return;
      }
      const result = await listenForCommand({
        token: body.token,
        model: body.model,
        language: body.language,
        microphone,
        signal: controller.signal,
        onInterim: setInterim,
      });
      if (result.stop === 'silence' || result.stop === 'error') {
        setError(voiceErrorMessage({ stop: result.stop }));
      } else if (result.text) {
        onText(result.text);
      }
    } catch (cause) {
      setError(
        cause instanceof MicrophoneError
          ? voiceErrorMessage({ mic: cause.reason })
          : voiceErrorMessage({ stop: 'error' }),
      );
    } finally {
      await microphone?.close();
      abortRef.current = null;
      setState('idle');
    }
  }, [joinCode, onText]);

  return { state, interim, error, start, cancel };
}
```

- [ ] **Step 5: Pannello e stage-area**

In `apps/web/src/app/room/[code]/agent-panel.tsx`:
- nuova prop `listenRequest: number`;
- dentro il componente:

```tsx
  const voice = useVoiceRequest({ joinCode, onText: (text) => void agent.ask(text) });
  const lastRequest = useRef(listenRequest);
  useEffect(() => {
    if (listenRequest === lastRequest.current) return;
    lastRequest.current = listenRequest;
    onOpenChange(true);
    void voice.start();
  }, [listenRequest, onOpenChange, voice]);
```

- dentro `{open && (...)}`, prima del `<form>`:

```tsx
        <div className="flex items-center gap-2">
          {voice.state === 'idle' ? (
            <button
              type="button"
              onClick={() => void voice.start()}
              disabled={agent.busy}
              className="rounded bg-neutral-100 px-3 py-1 text-neutral-900 disabled:opacity-40"
            >
              🎙 Parla
            </button>
          ) : (
            <button
              type="button"
              onClick={voice.cancel}
              className="rounded bg-red-500 px-3 py-1 text-neutral-950"
            >
              Ferma l&apos;ascolto
            </button>
          )}
          {voice.state === 'listening' && (
            <span role="status" className="text-neutral-300">
              Ti ascolto… {voice.interim}
            </span>
          )}
        </div>
```

- sotto il messaggio d'errore dell'agente: `{voice.error && <p className="text-amber-300">{voice.error}</p>}`.
- aggiornare il commento in testa: la richiesta si dice o si scrive.

In `apps/web/src/app/room/[code]/stage-area.tsx`, `HostStage`:

```tsx
  const [listenRequest, setListenRequest] = useState(0);
  const gestures = useGestures({
    // ...
    onAgent: () => setListenRequest((n) => n + 1),
    // ...
  });
  // ...
      <AgentPanel
        joinCode={joinCode}
        dispatch={dispatch}
        open={agentOpen}
        onOpenChange={setAgentOpen}
        listenRequest={listenRequest}
      />
```

(Il gesto «indice alzato» ora apre il pannello **e** avvia l'ascolto; il click
equivalente è ✨ seguito da «🎙 Parla».)

- [ ] **Step 6: Verificare**

Run: `npx vitest run tests/unit/voice-messages.test.ts && npm run typecheck && npm run lint && npm run test:e2e -- e2e/voice.spec.ts e2e/agent.spec.ts e2e/gestures.spec.ts`
Expected: PASS (e2e nel Codespace o in CI).

- [ ] **Step 7: Prova manuale con Deepgram vero**

Codespace con `DEEPGRAM_API_KEY`, `AI_PROVIDER=anthropic`, crediti caricati: ✨ → «🎙
Parla» → dire «fammi un grafico con le vendite di quattro trimestri» → il testo appare
mentre si parla, poi il grafico entra nel vassoio. Tacere 7 s → «Non ho sentito nulla».
Negare il microfono → messaggio, il campo scritto funziona. Annotare nel commit la latenza
percepita (fine frase → grafico).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/voice apps/web/src/app/room/[code]/agent-panel.tsx apps/web/src/app/room/[code]/stage-area.tsx tests/unit/voice-messages.test.ts e2e/voice.spec.ts
git commit -m "feat(web): speak a request to the agent, index-up gesture starts listening"
```

---

### Task 4B.7: parola chiave — pipeline openWakeWord in TypeScript

Si prova la pipeline con i modelli pubblici di openWakeWord (`hey_jarvis`, solo
sviluppo). Il modello «Ehi Omnia» arriva nel task 4B.12 e sostituisce solo un file.

**Files:**
- Create: `packages/stt/src/wakeword.ts`, `tools/wakeword/README.md`, `tools/wakeword/fetch-models.sh`, `tools/wakeword/make-fixtures.ps1`, `tests/fixtures/wakeword/positive.wav`, `tests/fixtures/wakeword/negative.wav`, `tests/fixtures/wav.ts`, `apps/web/public/models/wakeword/README.md`
- Modify: `packages/stt/src/index.ts`, `packages/stt/package.json`, root `package.json` (devDependency `onnxruntime-node`)
- Test: `tests/unit/wakeword.test.ts`

**Interfaces:**
- Consumes: `FRAME_SAMPLES` (4B.5).
- Produces:
  - `type OrtLike = { InferenceSession: { create(model: Uint8Array): Promise<OrtSession> }; Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown }`
  - `type WakeWordModels = { melspectrogram: Uint8Array; embedding: Uint8Array; keyword: Uint8Array }`
  - `createWakeWordDetector(ort: OrtLike, models: WakeWordModels): Promise<WakeWordDetector>`
  - `type WakeWordDetector = { push(frame: Float32Array): Promise<number>; reset(): void }` — `frame` = 1280 campioni a 16 kHz in [-1, 1]; restituisce il punteggio in [0, 1], 0 durante il riscaldamento (primi 16 embedding).

- [ ] **Step 1: Modelli e fixture**

`tools/wakeword/fetch-models.sh`:

```bash
#!/usr/bin/env bash
# Scarica i modelli pubblici di openWakeWord (release v0.5.1).
# melspectrogram ed embedding: Apache 2.0. hey_jarvis: CC BY-NC-SA 4.0, SOLO SVILUPPO.
set -euo pipefail
dest="$(dirname "$0")/../../apps/web/public/models/wakeword"
base="https://github.com/dscripka/openWakeWord/releases/download/v0.5.1"
mkdir -p "$dest"
for f in melspectrogram.onnx embedding_model.onnx hey_jarvis_v0.1.onnx; do
  curl -fsSL "$base/$f" -o "$dest/$f"
done
ls -l "$dest"
```

`tools/wakeword/make-fixtures.ps1` (Windows, voce inglese di sistema; 16 kHz mono 16 bit):

```powershell
Add-Type -AssemblyName System.Speech
$out = Join-Path $PSScriptRoot '..\..\tests\fixtures\wakeword'
New-Item -ItemType Directory -Force $out | Out-Null
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
function Say($text, $file) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SetOutputToWaveFile((Join-Path $out $file), $format)
  $s.Speak("... $text ...")
  $s.Dispose()
}
Say 'hey jarvis' 'positive.wav'
Say 'good morning everyone, shall we start with the quarterly numbers' 'negative.wav'
```

Eseguire `bash tools/wakeword/fetch-models.sh` e
`powershell -File tools/wakeword/make-fixtures.ps1`. I file `.onnx` e `.wav` vanno in git
(pochi MB; se `embedding_model.onnx` supera 2 MB lasciarlo comunque: serve ai test in CI).

`apps/web/public/models/wakeword/README.md`:

```md
Modelli ONNX della parola chiave (ADR-0012), serviti al browser.

- `melspectrogram.onnx`, `embedding_model.onnx`: openWakeWord v0.5.1, Apache 2.0.
- `hey_jarvis_v0.1.onnx`: openWakeWord v0.5.1, **CC BY-NC-SA 4.0, solo sviluppo**. Non
  deve mai essere il modello configurato in produzione.
- `ehi_omnia.onnx`: nostro (task 4B.12), quando c'è.

Scaricare con `tools/wakeword/fetch-models.sh`.
```

`tests/fixtures/wav.ts`:

```ts
import { readFileSync } from 'node:fs';

// Legge un WAV PCM 16 bit mono a 16 kHz e restituisce campioni in [-1, 1].
export function readWav16k(path: string): Float32Array {
  const buf = readFileSync(path);
  let offset = 12;
  while (offset < buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      if (buf.readUInt16LE(offset + 10) !== 1 || buf.readUInt32LE(offset + 12) !== 16_000) {
        throw new Error('expected mono 16 kHz');
      }
    }
    if (id === 'data') {
      const out = new Float32Array(size / 2);
      for (let i = 0; i < out.length; i += 1) out[i] = buf.readInt16LE(offset + 8 + i * 2) / 32768;
      return out;
    }
    offset += 8 + size;
  }
  throw new Error('no data chunk');
}
```

- [ ] **Step 2: Scrivere il test che fallisce**

`npm install -D onnxruntime-node` alla radice.

`tests/unit/wakeword.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import * as ort from 'onnxruntime-node';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  FRAME_SAMPLES,
  createWakeWordDetector,
  type OrtLike,
  type WakeWordDetector,
} from '@omnicanvas/stt';
import { readWav16k } from '../fixtures/wav';

const dir = 'apps/web/public/models/wakeword';
const load = (f: string) => new Uint8Array(readFileSync(`${dir}/${f}`));

async function maxScore(detector: WakeWordDetector, samples: Float32Array): Promise<number> {
  detector.reset();
  // Un secondo di silenzio prima e dopo: il riscaldamento non deve mangiare la frase.
  const padded = new Float32Array(samples.length + 32_000);
  padded.set(samples, 16_000);
  let max = 0;
  for (let i = 0; i + FRAME_SAMPLES <= padded.length; i += FRAME_SAMPLES) {
    max = Math.max(max, await detector.push(padded.subarray(i, i + FRAME_SAMPLES)));
  }
  return max;
}

describe('wake word detector', () => {
  let detector: WakeWordDetector;

  beforeAll(async () => {
    detector = await createWakeWordDetector(ort as unknown as OrtLike, {
      melspectrogram: load('melspectrogram.onnx'),
      embedding: load('embedding_model.onnx'),
      keyword: load('hey_jarvis_v0.1.onnx'),
    });
  });

  it('scores zero while warming up', async () => {
    detector.reset();
    for (let i = 0; i < 10; i += 1) {
      expect(await detector.push(new Float32Array(FRAME_SAMPLES))).toBe(0);
    }
  });

  it('refuses frames of the wrong size', async () => {
    await expect(detector.push(new Float32Array(100))).rejects.toThrow(/1280/);
  });

  it('separates the wake phrase from ordinary speech', async () => {
    const positive = await maxScore(detector, readWav16k('tests/fixtures/wakeword/positive.wav'));
    const negative = await maxScore(detector, readWav16k('tests/fixtures/wakeword/negative.wav'));
    expect(negative).toBeLessThan(0.2);
    expect(positive).toBeGreaterThan(Math.max(0.2, negative * 5));
  });
});
```

Se il punteggio positivo con la voce sintetica resta sotto 0,2 pur con la pipeline
corretta (verificarla contro l'implementazione Python di openWakeWord,
`openwakeword/utils.py`, classe `AudioFeatures`), **non abbassare la soglia per far
passare il test**: registrare «hey jarvis» con la propria voce in `positive.wav`
(16 kHz mono) e annotare nel commit da dove viene la fixture.

- [ ] **Step 3: Verificare che fallisca**

Run: `npx vitest run tests/unit/wakeword.test.ts`
Expected: FAIL, `createWakeWordDetector` non esportato.

- [ ] **Step 4: Implementare la pipeline**

`packages/stt/src/wakeword.ts`:

```ts
import { FRAME_SAMPLES } from './audio';

// Pipeline di openWakeWord (utils.py, AudioFeatures), riscritta per il browser:
// 80 ms di audio → melspectrogram (32 bande) → embedding da 96 su 76 frame mel →
// testa della parola chiave su 16 embedding → punteggio.
const MEL_CONTEXT_SAMPLES = 160 * 3;
const MEL_WINDOW = 76;
const EMBEDDINGS = 16;
const MEL_BANDS = 32;

type OrtSession = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown; dims: readonly number[] }>>;
};

export type OrtLike = {
  InferenceSession: { create(model: Uint8Array): Promise<OrtSession> };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
};

export type WakeWordModels = { melspectrogram: Uint8Array; embedding: Uint8Array; keyword: Uint8Array };

export type WakeWordDetector = { push(frame: Float32Array): Promise<number>; reset(): void };

async function runOne(ort: OrtLike, session: OrtSession, data: Float32Array, dims: number[]) {
  const out = await session.run({ [session.inputNames[0]!]: new ort.Tensor('float32', data, dims) });
  return out[session.outputNames[0]!]!;
}

export async function createWakeWordDetector(
  ort: OrtLike,
  models: WakeWordModels,
): Promise<WakeWordDetector> {
  const [mel, embed, keyword] = await Promise.all([
    ort.InferenceSession.create(models.melspectrogram),
    ort.InferenceSession.create(models.embedding),
    ort.InferenceSession.create(models.keyword),
  ]);

  let raw = new Float32Array(0);
  let melFrames: Float32Array[] = [];
  let embeddings: Float32Array[] = [];

  const reset = () => {
    raw = new Float32Array(0);
    // Come in Python: il buffer mel parte pieno di 1, così il primo embedding è calcolabile.
    melFrames = Array.from({ length: MEL_WINDOW }, () => new Float32Array(MEL_BANDS).fill(1));
    embeddings = [];
  };
  reset();

  return {
    reset,
    async push(frame) {
      if (frame.length !== FRAME_SAMPLES) {
        throw new Error(`wake word frames must be ${FRAME_SAMPLES} samples, got ${frame.length}`);
      }
      // Il modello mel vuole i valori int16 come float, non normalizzati.
      const joined = new Float32Array(raw.length + frame.length);
      joined.set(raw);
      joined.set(frame, raw.length);
      raw = joined.slice(-(FRAME_SAMPLES + MEL_CONTEXT_SAMPLES));
      const scaled = raw.map((v) => Math.max(-32768, Math.min(32767, Math.round(v * 32768))));

      const melOut = await runOne(ort, mel, scaled, [1, scaled.length]);
      const melData = melOut.data as Float32Array;
      const count = melData.length / MEL_BANDS;
      for (let i = 0; i < count; i += 1) {
        // Stessa trasformazione di openWakeWord: spec / 10 + 2.
        melFrames.push(melData.slice(i * MEL_BANDS, (i + 1) * MEL_BANDS).map((v) => v / 10 + 2));
      }
      melFrames = melFrames.slice(-MEL_WINDOW * 2);

      const window = new Float32Array(MEL_WINDOW * MEL_BANDS);
      melFrames.slice(-MEL_WINDOW).forEach((f, i) => window.set(f, i * MEL_BANDS));
      const embOut = await runOne(ort, embed, window, [1, MEL_WINDOW, MEL_BANDS, 1]);
      embeddings.push(Float32Array.from(embOut.data as Float32Array));
      if (embeddings.length > EMBEDDINGS) embeddings.shift();
      if (embeddings.length < EMBEDDINGS) return 0;

      const input = new Float32Array(EMBEDDINGS * 96);
      embeddings.forEach((e, i) => input.set(e, i * 96));
      const score = await runOne(ort, keyword, input, [1, EMBEDDINGS, 96]);
      return Number((score.data as Float32Array)[0] ?? 0);
    },
  };
}
```

In `packages/stt/src/index.ts`:

```ts
export {
  createWakeWordDetector,
  type OrtLike,
  type WakeWordDetector,
  type WakeWordModels,
} from './wakeword';
```

`tools/wakeword/README.md`:

```md
# Parola chiave (ADR-0012)

- `fetch-models.sh` scarica i modelli pubblici di openWakeWord in
  `apps/web/public/models/wakeword/` (hey_jarvis solo per sviluppo).
- `make-fixtures.ps1` genera le fixture audio dei test con la voce di sistema di Windows.
- L'addestramento di «Ehi Omnia» è descritto nel task 4B.12 del piano
  `docs/plans/2026-09-26-slice-4b-voce.md`.
```

- [ ] **Step 5: Verificare**

Run: `npx vitest run tests/unit/wakeword.test.ts && npm run typecheck && npm run lint`
Expected: PASS. Se il test di separazione fallisce, confrontare con `AudioFeatures` di
openWakeWord (in particolare: numero di frame mel per blocco, trasformazione `/10 + 2`,
finestra 76, forma `[1, 76, 32, 1]`) prima di toccare la fixture.

- [ ] **Step 6: Commit**

```bash
git add packages/stt tools/wakeword tests/fixtures/wakeword tests/fixtures/wav.ts tests/unit/wakeword.test.ts apps/web/public/models/wakeword package.json package-lock.json
git commit -m "feat(stt): openWakeWord pipeline in TypeScript, tested with the public dev model"
```

---

### Task 4B.8: parola chiave nella stanza

**Files:**
- Create: `apps/web/src/lib/voice/wakeword-config.ts`, `apps/web/src/lib/voice/wake-gate.ts`, `apps/web/src/lib/voice/use-wake-word.ts`
- Modify: `apps/web/package.json` (dipendenza `onnxruntime-web`), `apps/web/src/app/room/[code]/room-call.tsx`, `apps/web/src/app/room/[code]/stage-area.tsx`, `apps/web/src/app/room/[code]/agent-panel.tsx`
- Test: `tests/unit/wake-gate.test.ts`

**Interfaces:**
- Consumes: `openMicrophone` (4B.5), `createWakeWordDetector` (4B.7), `listenRequest` in `AgentPanel` (4B.6).
- Produces:
  - `WAKE_WORD: { label: string; keywordFile: string; threshold: number; cooldownMs: number; productionReady: boolean }`
  - `wakeWordShouldListen(input: { enabled: boolean; micOn: boolean; visible: boolean; commandActive: boolean }): boolean`
  - `useWakeWord({ enabled, micOn, commandActive, onWake }): { status: 'off' | 'loading' | 'listening' | 'unavailable' }`
  - `StageArea` prop nuova `micOn: boolean`

- [ ] **Step 1: Scrivere il test che fallisce**

`tests/unit/wake-gate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { wakeWordShouldListen } from '@/lib/voice/wake-gate';

const on = { enabled: true, micOn: true, visible: true, commandActive: false };

describe('wakeWordShouldListen', () => {
  it('listens only when the host wants it, the call mic is on and the tab is visible', () => {
    expect(wakeWordShouldListen(on)).toBe(true);
    expect(wakeWordShouldListen({ ...on, enabled: false })).toBe(false);
    expect(wakeWordShouldListen({ ...on, micOn: false })).toBe(false);
    expect(wakeWordShouldListen({ ...on, visible: false })).toBe(false);
  });

  it('pauses while a spoken request is in progress', () => {
    expect(wakeWordShouldListen({ ...on, commandActive: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/unit/wake-gate.test.ts`
Expected: FAIL, modulo mancante.

- [ ] **Step 3: Configurazione e porta**

`apps/web/src/lib/voice/wake-gate.ts`:

```ts
// Con il microfono della call spento l'host si aspetta di non essere ascoltato: la parola
// chiave si ferma e il microfono del browser si chiude (spec §7).
export function wakeWordShouldListen(input: {
  enabled: boolean;
  micOn: boolean;
  visible: boolean;
  commandActive: boolean;
}): boolean {
  return input.enabled && input.micOn && input.visible && !input.commandActive;
}
```

`apps/web/src/lib/voice/wakeword-config.ts`:

```ts
// Nome e modello sono configurazione (ADR-0012): cambiarli significa sostituire il file
// .onnx e queste righe. hey_jarvis è CC BY-NC-SA: solo sviluppo.
export const WAKE_WORD = {
  label: 'Hey Jarvis (modello di sviluppo)',
  keywordFile: '/models/wakeword/hey_jarvis_v0.1.onnx',
  threshold: 0.5,
  cooldownMs: 3_000,
  productionReady: false,
} as const;

export const WAKE_WORD_BACKBONE = {
  melspectrogram: '/models/wakeword/melspectrogram.onnx',
  embedding: '/models/wakeword/embedding_model.onnx',
} as const;
```

- [ ] **Step 4: Hook**

`npm install onnxruntime-web --workspace=apps/web`, poi leggere la versione installata
(`node -p "require('onnxruntime-web/package.json').version"`) e scriverla in `ORT_VERSION`.

`apps/web/src/lib/voice/use-wake-word.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { createWakeWordDetector, openMicrophone, type OrtLike } from '@omnicanvas/stt';
import { wakeWordShouldListen } from './wake-gate';
import { WAKE_WORD, WAKE_WORD_BACKBONE } from './wakeword-config';

// Stessa scelta di MediaPipe (packages/gesture/src/runner.ts): wasm dal CDN, versione fissata.
const ORT_VERSION = '<versione installata>';

async function bytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`model ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function useVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

export function useWakeWord(options: {
  enabled: boolean;
  micOn: boolean;
  commandActive: boolean;
  onWake: () => void;
}) {
  const visible = useVisible();
  const listen = wakeWordShouldListen({ ...options, visible });
  const [status, setStatus] = useState<'off' | 'loading' | 'listening' | 'unavailable'>('off');
  const onWakeRef = useRef(options.onWake);
  useEffect(() => {
    onWakeRef.current = options.onWake;
  }, [options.onWake]);

  useEffect(() => {
    if (!listen) {
      setStatus((s) => (s === 'unavailable' ? s : 'off'));
      return;
    }
    let cancelled = false;
    let close: (() => Promise<void>) | null = null;
    setStatus('loading');
    void (async () => {
      try {
        const ort = await import('onnxruntime-web');
        ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
        const [melspectrogram, embedding, keyword] = await Promise.all([
          bytes(WAKE_WORD_BACKBONE.melspectrogram),
          bytes(WAKE_WORD_BACKBONE.embedding),
          bytes(WAKE_WORD.keywordFile),
        ]);
        const detector = await createWakeWordDetector(ort as unknown as OrtLike, {
          melspectrogram,
          embedding,
          keyword,
        });
        const microphone = await openMicrophone();
        close = () => microphone.close();
        if (cancelled) return void close();
        let busy = false;
        let lastWake = 0;
        microphone.onFrame((frame) => {
          // Se l'inferenza resta indietro si salta un frame: meglio che accumulare ritardo.
          if (busy) return;
          busy = true;
          void detector
            .push(frame)
            .then((score) => {
              const now = Date.now();
              if (score >= WAKE_WORD.threshold && now - lastWake > WAKE_WORD.cooldownMs) {
                lastWake = now;
                detector.reset();
                onWakeRef.current();
              }
            })
            .finally(() => {
              busy = false;
            });
        });
        setStatus('listening');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      void close?.();
    };
  }, [listen]);

  return { status };
}
```

Nota: saltare i frame mentre l'inferenza è occupata altera la sequenza di embedding; se la
prova manuale mostra riconoscimenti persi su macchine lente, la soluzione è una coda di
al massimo 2 frame, non togliere il controllo `busy`.

- [ ] **Step 5: Collegare alla stanza**

`room-call.tsx`: passare `micOn={local?.micOn ?? false}` a `StageArea`.

`stage-area.tsx`: aggiungere `micOn: boolean` a `Props`, estrarlo in `HostStage` e
passarlo ad `AgentPanel` (`micOn={micOn}`).

`agent-panel.tsx`:
- prop nuova `micOn: boolean`;
- stato `const [wakeEnabled, setWakeEnabled] = useState(true);`
- hook:

```tsx
  const wake = useWakeWord({
    enabled: wakeEnabled,
    micOn,
    commandActive: voice.state !== 'idle' || agent.busy,
    onWake: () => {
      onOpenChange(true);
      void voice.start();
    },
  });
```

- nella riga dei bottoni, dopo il contatore dei crediti:

```tsx
        <button
          type="button"
          aria-pressed={wakeEnabled}
          onClick={() => setWakeEnabled((v) => !v)}
          className="rounded bg-neutral-800 px-2 py-1"
        >
          Parola chiave: {wakeEnabled ? 'attiva' : 'in pausa'}
        </button>
        <span className="text-neutral-400">
          {wake.status === 'listening' && `Di' «${WAKE_WORD.label}» per chiamare l'agente`}
          {wake.status === 'loading' && 'Avvio della parola chiave…'}
          {wake.status === 'unavailable' && 'Parola chiave non disponibile: usa ✨'}
          {wake.status === 'off' && wakeEnabled && !micOn && 'Microfono spento: la parola chiave non ascolta'}
        </span>
```

- [ ] **Step 6: Verificare**

Run: `npx vitest run tests/unit/wake-gate.test.ts && npm run typecheck && npm run lint && npm run build && npm run test:e2e -- e2e/voice.spec.ts e2e/agent.spec.ts`
Expected: PASS. La build deve riuscire con `onnxruntime-web` importato dinamicamente.

- [ ] **Step 7: Prova manuale**

Con microfono vero: dire «hey jarvis» → il pannello si apre e ascolta. Spegnere il
microfono nella call → l'indicatore del microfono del browser per la parola chiave si
spegne e il messaggio «Microfono spento» compare. Cambiare scheda → l'ascolto si ferma.
Lasciare la stanza aperta 10 minuti parlando normalmente: contare le attivazioni false e
annotarle nel commit. Guardare la CPU con le gesture accese (rischio 2 della spec).

- [ ] **Step 8: Commit**

```bash
git add apps/web tests/unit/wake-gate.test.ts package-lock.json
git commit -m "feat(web): local wake word opens the agent, only while the call mic is on"
```

---

### Task 4B.9: l'agente può proporre un'immagine

**Files:**
- Modify: `packages/ai/src/types.ts`, `packages/ai/src/agent-schema.ts`, `packages/ai/src/anthropic.ts`, `packages/ai/src/fake.ts`, `apps/web/src/lib/ai/agent-request.ts`, `apps/web/src/lib/stage/use-agent.ts`
- Test: `tests/unit/ai-anthropic.test.ts` (aggiungere), `tests/unit/ai-proposal.test.ts` (nuovo), `tests/db/agent-request.test.ts` (aggiungere)

**Interfaces:**
- Produces:
  - `type ImageProposal = { kind: 'image_proposal'; title: string; prompt: string }`
  - `type AgentOutcome = AgentContent | ImageProposal` (sostituisce l'alias del task 4B.1)
  - `GenerateResult.content: AgentOutcome`
  - `MAX_IMAGE_PROMPT_CHARS = 500`
  - body 200 della route dell'agente: `{ content: AgentContent; charged: number } | { proposal: ImageProposal; charged: number }`
  - `useAgent({ joinCode, onContent })` restituisce anche `proposal: ImageProposal | null` e `dismissProposal(): void`

- [ ] **Step 1: Scrivere i test che falliscono**

`tests/unit/ai-proposal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ProviderError, createFakeAdapter, toAgentContent } from '@omnicanvas/ai';

const usage = { model: 'm', inputTokens: 1, outputTokens: 1 };

describe('image proposals', () => {
  it('turns an image answer into a proposal, not stage content', () => {
    expect(
      toAgentContent(
        { content: { kind: 'image', title: 'Ufficio', prompt: 'a bright open-plan office' } },
        usage,
      ),
    ).toEqual({ kind: 'image_proposal', title: 'Ufficio', prompt: 'a bright open-plan office' });
  });

  it('rejects empty or oversized image descriptions', () => {
    expect(() =>
      toAgentContent({ content: { kind: 'image', title: 'X', prompt: '' } }, usage),
    ).toThrow(ProviderError);
    expect(() =>
      toAgentContent({ content: { kind: 'image', title: 'X', prompt: 'a'.repeat(501) } }, usage),
    ).toThrow(ProviderError);
  });

  it('the fake adapter proposes an image when asked for one', async () => {
    const { content } = await createFakeAdapter().generate("Fammi un'immagine di un ufficio");
    expect(content).toMatchObject({ kind: 'image_proposal' });
  });
});
```

In `tests/db/agent-request.test.ts` aggiungere (dopo i test esistenti; crediti già caricati):

```ts
  it('returns an image proposal without putting anything on the stage', async () => {
    await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 5 });
    const result = await runAgentRequest(admin, createFakeAdapter(), asHost(), 'Una foto del team');
    expect(result).toMatchObject({
      status: 200,
      body: { proposal: { kind: 'image_proposal', title: 'Una foto del team' } },
    });
  });
```

In `tests/unit/ai-anthropic.test.ts`, seguendo lo schema dei test esistenti (risposta del
modello finta passata tramite `fetch`), aggiungere un caso in cui il testo della risposta è
`{"content":{"kind":"image","title":"Ufficio","prompt":"a bright office"}}` e l'adapter
restituisce `content: { kind: 'image_proposal', title: 'Ufficio', prompt: 'a bright office' }`.

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/ai-proposal.test.ts tests/unit/ai-anthropic.test.ts`
Expected: FAIL.

- [ ] **Step 3: Tipi e schema**

`packages/ai/src/types.ts`: sostituire l'alias con

```ts
// Un'immagine costa e richiede tempo: l'agente la propone, l'host la conferma (spec §2.3).
export type ImageProposal = { kind: 'image_proposal'; title: string; prompt: string };
export type AgentOutcome = AgentContent | ImageProposal;
```

e in `GenerateResult`: `content: AgentOutcome;`.

`packages/ai/src/agent-schema.ts`: aggiungere al `discriminatedUnion`

```ts
    z.object({ kind: z.literal('image'), title: z.string(), prompt: z.string() }),
```

e sostituire `toAgentContent`:

```ts
export const MAX_IMAGE_PROMPT_CHARS = 500;

export function toAgentContent(output: AgentOutput, usage: ProviderUsage): AgentOutcome {
  if (output.content.kind === 'image') {
    const { title, prompt } = output.content;
    const trimmed = prompt.trim();
    if (!title.trim() || title.length > LIMITS.title || !trimmed || trimmed.length > MAX_IMAGE_PROMPT_CHARS) {
      throw new ProviderError('invalid_output', usage);
    }
    return { kind: 'image_proposal', title, prompt: trimmed };
  }
  const { kind, ...data } = output.content;
  const checked = contentSchema.safeParse({ id: PROBE_ID, kind, data });
  if (!checked.success) throw new ProviderError('invalid_output', usage);
  return output.content;
}
```

(importare `LIMITS` da `@omnicanvas/canvas` e `AgentOutcome` da `./types`; esportare
`MAX_IMAGE_PROMPT_CHARS` da `index.ts`.)

`packages/ai/src/anthropic.ts`, nel `SYSTEM_PROMPT`, dopo la riga di `"text"`:

```
- "image" solo se la richiesta chiede esplicitamente un'immagine, una foto o un'illustrazione: "prompt" descrive la scena in inglese per un generatore di immagini (al massimo 400 caratteri, niente testo da scrivere nell'immagine). L'immagine verrà generata solo dopo la conferma del consulente.
```

`packages/ai/src/fake.ts`:

```ts
      const content: AgentOutcome = /immagin|foto|image|illustra/i.test(prompt)
        ? { kind: 'image_proposal', title, prompt: `photo: ${prompt.trim().slice(0, 200)}` }
        : /grafic|chart/i.test(prompt)
          ? { kind: 'chart', title, labels: ['T1', 'T2', 'T3', 'T4'], values: [12, 18, 9, 21] }
          : { kind: 'text', title, body: 'Contenuto di prova generato senza modello.' };
```

- [ ] **Step 4: Route e hook**

`apps/web/src/lib/ai/agent-request.ts`, nel ramo di successo di `runAgentRequest`:

```ts
  if (result.ok) {
    return result.content.kind === 'image_proposal'
      ? { status: 200, body: { proposal: result.content, charged: result.charged } }
      : { status: 200, body: { content: result.content, charged: result.charged } };
  }
```

`apps/web/src/lib/stage/use-agent.ts`:
- `const [proposal, setProposal] = useState<ImageProposal | null>(null);`
- il body letto diventa `{ content?: AgentContent; proposal?: ImageProposal; code?: string }`;
- `if (response.ok && body.content) onContent(body.content); else if (response.ok && body.proposal) setProposal(body.proposal); else setError(...)`;
- restituire `{ busy, error, usage, ask, proposal, dismissProposal: () => setProposal(null), refreshUsage }`.

`AgentContent` in `use-agent.ts` e `agent-messages.ts` resta il tipo del contenuto del
palco: non cambia.

- [ ] **Step 5: Verificare**

Run: `npx vitest run tests/unit/ai-proposal.test.ts tests/unit/ai-anthropic.test.ts tests/unit/ai-service.test.ts tests/db/agent-request.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai apps/web/src/lib/ai/agent-request.ts apps/web/src/lib/stage/use-agent.ts tests/unit/ai-proposal.test.ts tests/unit/ai-anthropic.test.ts tests/db/agent-request.test.ts
git commit -m "feat(ai): agent can propose an image, kept out of the stage until confirmed"
```

---

### Task 4B.10: generazione con fal.ai e route delle immagini

**Files:**
- Create: `packages/ai/src/fal.ts`, `packages/ai/src/fake-image.ts`, `apps/web/src/lib/ai/image-adapter.ts`, `apps/web/src/lib/ai/image-request.ts`, `apps/web/src/app/room/[code]/image/route.ts`
- Modify: `packages/ai/src/index.ts`, `.github/workflows/ci.yml`
- Test: `tests/unit/ai-fal.test.ts`, `tests/db/image-request.test.ts`

**Interfaces:**
- Consumes: `executeMetered`, `imageCostUsd`, `creditsFor` (4B.1); `resolveHost` (4B.3); `MAX_IMAGE_PROMPT_CHARS` (4B.9); `MAX_ASSET_BYTES` da `@omnicanvas/canvas`.
- Produces:
  - `type ImageResult = { bytes: Uint8Array; mime: 'image/jpeg' | 'image/png'; model: string; costUsd: number }`
  - `type ImageAdapter = { provider: string; model: string; reserveCredits: number; generate(prompt: string): Promise<ImageResult> }`
  - `createFalImageAdapter(options: { apiKey: string; model: string; fetch?: typeof fetch; timeoutMs?: number }): ImageAdapter`
  - `createFakeImageAdapter(): ImageAdapter`
  - `imageAdapter(): ImageAdapter | null`
  - `runImageRequest(admin, adapter: ImageAdapter | null, input, prompt: string): Promise<{ status: 200; bytes: Uint8Array; mime: string; charged: number } | { status: number; body: unknown }>`
  - `POST /room/[code]/image` body `{ prompt }` → 200 con i byte dell'immagine, header `Content-Type` e `X-Credits-Charged`; errori JSON.

- [ ] **Step 1: Scrivere i test che falliscono**

`tests/unit/ai-fal.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ProviderError, createFakeImageAdapter, createFalImageAdapter } from '@omnicanvas/ai';

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function falFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const ok = (nsfw = false) => ({
  images: [{ url: `data:image/jpeg;base64,${PNG_1X1}`, width: 1024, height: 768, content_type: 'image/jpeg' }],
  has_nsfw_concepts: [nsfw],
});

describe('fal image adapter', () => {
  it('asks for one synchronous 4:3 jpeg and decodes the data URI', async () => {
    const f = falFetch(200, ok());
    const adapter = createFalImageAdapter({ apiKey: 'fal-key', model: 'fal-ai/flux/schnell', fetch: f });
    expect(adapter.reserveCredits).toBe(1);
    const result = await adapter.generate('a bright office');
    expect(result.mime).toBe('image/jpeg');
    expect(result.bytes.byteLength).toBe(Buffer.from(PNG_1X1, 'base64').byteLength);
    expect(result.costUsd).toBeCloseTo(0.003, 6);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fal.run/fal-ai/flux/schnell');
    expect(new Headers(init.headers).get('Authorization')).toBe('Key fal-key');
    expect(JSON.parse(init.body as string)).toEqual({
      prompt: 'a bright office',
      image_size: 'landscape_4_3',
      num_images: 1,
      sync_mode: true,
      output_format: 'jpeg',
      enable_safety_checker: true,
    });
  });

  it('refuses unsafe images but still reports their cost', async () => {
    const adapter = createFalImageAdapter({
      apiKey: 'k',
      model: 'fal-ai/flux/schnell',
      fetch: falFetch(200, ok(true)),
    });
    const error = await adapter.generate('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe('refusal');
    expect((error as ProviderError).costUsd).toBeCloseTo(0.003, 6);
  });

  it('refuses images larger than the stage accepts', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024).toString('base64');
    const adapter = createFalImageAdapter({
      apiKey: 'k',
      model: 'fal-ai/flux/schnell',
      fetch: falFetch(200, { images: [{ url: `data:image/jpeg;base64,${big}` }], has_nsfw_concepts: [false] }),
    });
    await expect(adapter.generate('x')).rejects.toMatchObject({ code: 'invalid_output' });
  });

  it('maps HTTP errors without leaking the body', async () => {
    const adapter = createFalImageAdapter({
      apiKey: 'k',
      model: 'fal-ai/flux/schnell',
      fetch: falFetch(429, { detail: 'prompt: a bright office' }),
    });
    const error = (await adapter.generate('x').catch((e: unknown) => e)) as ProviderError;
    expect(error.code).toBe('rate_limited');
    expect(error.message).not.toContain('office');
  });

  it('the fake adapter returns a small png for free', async () => {
    const result = await createFakeImageAdapter().generate('x');
    expect(result).toMatchObject({ mime: 'image/png', model: 'fake-image', costUsd: 0 });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });
});
```

`tests/db/image-request.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ProviderError, createFakeImageAdapter, type ImageAdapter } from '@omnicanvas/ai';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { joinRoom } from '@/lib/rooms/join-room';
import { runImageRequest } from '@/lib/ai/image-request';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

function paid(behaviour: 'ok' | ProviderError): ImageAdapter {
  return {
    provider: 'fal',
    model: 'fal-ai/flux/schnell',
    reserveCredits: 1,
    generate: vi.fn(async () => {
      if (behaviour !== 'ok') throw behaviour;
      return { bytes: new Uint8Array([1, 2, 3]), mime: 'image/jpeg' as const, model: 'fal-ai/flux/schnell', costUsd: 0.003 };
    }),
  };
}

describe('runImageRequest', () => {
  let host: TestUser;
  let joinCode: string;
  let workspaceId: string;
  let guestId: string;

  beforeAll(async () => {
    host = await createTestUser('image-host');
    const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', host.id).single();
    workspaceId = ws!.id;
    const room = await createRoomForUser(await signedInClient(host), host.id, { title: 'Immagini' });
    if (!room.ok) throw new Error('setup failed');
    joinCode = room.joinCode;
    await joinRoom(admin, { joinCode, userId: host.id, displayName: 'Sean', language: 'it' });
    const guest = await joinRoom(admin, { joinCode, userId: null, displayName: 'Cliente', language: 'en' });
    if (guest.kind !== 'joined') throw new Error('guest join failed');
    guestId = guest.participantId;
  });

  const asHost = () => ({ joinCode, userId: host.id, guestParticipantId: () => null });
  const balance = async () =>
    (await admin.from('workspaces').select('credits_balance').eq('id', workspaceId).single()).data!
      .credits_balance;

  it('refuses guests without generating', async () => {
    const adapter = paid('ok');
    const result = await runImageRequest(admin, adapter, { joinCode, userId: null, guestParticipantId: () => guestId }, 'x');
    expect(result).toEqual({ status: 403, body: { error: 'host_only' } });
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('validates the description', async () => {
    expect(await runImageRequest(admin, paid('ok'), asHost(), '  ')).toEqual({
      status: 400,
      body: { error: 'invalid_prompt' },
    });
  });

  it('stops at the quota before generating', async () => {
    const adapter = paid('ok');
    expect(await runImageRequest(admin, adapter, asHost(), 'office')).toEqual({
      status: 402,
      body: { error: 'quota_exceeded' },
    });
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('returns the bytes and charges one credit, recording no prompt', async () => {
    await admin.rpc('grant_credits', { p_workspace: workspaceId, p_credits: 3 });
    expect(await runImageRequest(admin, paid('ok'), asHost(), 'a bright office')).toEqual({
      status: 200,
      bytes: new Uint8Array([1, 2, 3]),
      mime: 'image/jpeg',
      charged: 1,
    });
    expect(await balance()).toBe(2);
    const { data: rows } = await admin
      .from('ai_requests')
      .select('*')
      .eq('payer_workspace_id', workspaceId)
      .eq('operation', 'image');
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('bright office');
  });

  it('charges a refused unsafe image and says so', async () => {
    expect(
      await runImageRequest(admin, paid(new ProviderError('refusal', undefined, 0.003)), asHost(), 'x'),
    ).toEqual({ status: 502, body: { error: 'provider_failed', code: 'refusal' } });
    expect(await balance()).toBe(1);
  });

  it('works with the fake adapter for free', async () => {
    const result = await runImageRequest(admin, createFakeImageAdapter(), asHost(), 'x');
    expect(result).toMatchObject({ status: 200, mime: 'image/png', charged: 0 });
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/ai-fal.test.ts tests/db/image-request.test.ts`
Expected: FAIL.

- [ ] **Step 3: Adapter**

In `packages/ai/src/types.ts`:

```ts
export type ImageResult = {
  bytes: Uint8Array;
  mime: 'image/jpeg' | 'image/png';
  model: string;
  costUsd: number;
};

export type ImageAdapter = {
  provider: string;
  model: string;
  reserveCredits: number;
  generate(prompt: string): Promise<ImageResult>;
};
```

`packages/ai/src/fal.ts`:

```ts
import 'server-only';
import { MAX_ASSET_BYTES } from '@omnicanvas/canvas';
import { creditsFor, imageCostUsd } from './pricing';
import { ProviderError, type ImageAdapter } from './types';

// landscape_4_3 = 1024×768: un megapixel iniziato, il taglio più economico che regge sul palco.
const IMAGE_SIZE = 'landscape_4_3';
const MEGAPIXELS = (1024 * 768) / 1_000_000;

function httpError(status: number): ProviderError {
  if (status === 429) return new ProviderError('rate_limited');
  return new ProviderError('provider_error');
}

export function createFalImageAdapter(options: {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): ImageAdapter {
  const send = options.fetch ?? fetch;
  const costUsd = imageCostUsd(options.model, MEGAPIXELS);
  return {
    provider: 'fal',
    model: options.model,
    reserveCredits: creditsFor(costUsd),
    async generate(prompt) {
      let response: Response;
      try {
        response = await send(`https://fal.run/${options.model}`, {
          method: 'POST',
          headers: { Authorization: `Key ${options.apiKey}`, 'Content-Type': 'application/json' },
          // sync_mode: l'immagine torna come data URI e non resta nella cronologia di fal.
          body: JSON.stringify({
            prompt,
            image_size: IMAGE_SIZE,
            num_images: 1,
            sync_mode: true,
            output_format: 'jpeg',
            enable_safety_checker: true,
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
        });
      } catch (error) {
        throw new ProviderError(error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network');
      }
      if (!response.ok) throw httpError(response.status);
      const body = (await response.json().catch(() => null)) as {
        images?: { url?: unknown }[];
        has_nsfw_concepts?: boolean[];
      } | null;
      // Generata e scartata: fal la fattura comunque.
      if (body?.has_nsfw_concepts?.[0]) throw new ProviderError('refusal', undefined, costUsd);
      const url = body?.images?.[0]?.url;
      const match = typeof url === 'string' ? /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(url) : null;
      if (!match) throw new ProviderError('invalid_output', undefined, costUsd);
      const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
      if (bytes.byteLength > MAX_ASSET_BYTES) throw new ProviderError('invalid_output', undefined, costUsd);
      return { bytes, mime: match[1] as 'image/jpeg' | 'image/png', model: options.model, costUsd };
    },
  };
}
```

`packages/ai/src/fake-image.ts`:

```ts
import type { ImageAdapter } from './types';

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Per sviluppo, CI ed e2e: nessuna rete, nessun costo.
export function createFakeImageAdapter(): ImageAdapter {
  return {
    provider: 'fake',
    model: 'fake-image',
    reserveCredits: 0,
    async generate() {
      return {
        bytes: Uint8Array.from(atob(PNG_1X1), (c) => c.charCodeAt(0)),
        mime: 'image/png',
        model: 'fake-image',
        costUsd: 0,
      };
    },
  };
}
```

In `packages/ai/src/index.ts`:

```ts
export { createFalImageAdapter } from './fal';
export { createFakeImageAdapter } from './fake-image';
```

- [ ] **Step 4: Lato web**

`apps/web/src/lib/ai/image-adapter.ts`:

```ts
import 'server-only';
import { createFakeImageAdapter, createFalImageAdapter, type ImageAdapter } from '@omnicanvas/ai';
import { serverEnv } from '@/env';

let cached: ImageAdapter | null | undefined;

export function imageAdapter(): ImageAdapter | null {
  if (cached !== undefined) return cached;
  const env = serverEnv();
  cached =
    env.AI_PROVIDER === 'fake'
      ? createFakeImageAdapter()
      : env.FAL_KEY
        ? createFalImageAdapter({ apiKey: env.FAL_KEY, model: env.FAL_IMAGE_MODEL })
        : null;
  return cached;
}
```

`apps/web/src/lib/ai/image-request.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@omnicanvas/db';
import { MAX_IMAGE_PROMPT_CHARS, executeMetered, type ImageAdapter } from '@omnicanvas/ai';
import type { ResolveParticipantInput } from '@/lib/rooms/resolve-participant';
import { resolveHost } from './agent-request';
import { createSupabaseLedger } from './ledger';

type Failure = { status: number; body: unknown };
type Success = { status: 200; bytes: Uint8Array; mime: string; charged: number };

// La descrizione e i byte restano in memoria: tornano al browser dell'host e basta.
export async function runImageRequest(
  admin: SupabaseClient<Database>,
  adapter: ImageAdapter | null,
  input: ResolveParticipantInput,
  prompt: string,
): Promise<Success | Failure> {
  const host = await resolveHost(admin, input);
  if ('refusal' in host) return host.refusal;
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_IMAGE_PROMPT_CHARS) {
    return { status: 400, body: { error: 'invalid_prompt' } };
  }
  if (!adapter) return { status: 503, body: { error: 'images_unavailable' } };

  const result = await executeMetered({ ledger: createSupabaseLedger(admin) }, host, {
    operation: 'image',
    provider: adapter.provider,
    model: adapter.model,
    reserveCredits: adapter.reserveCredits,
    async run() {
      const image = await adapter.generate(trimmed);
      return { value: image, usage: null, costUsd: image.costUsd };
    },
  });
  if (result.ok) {
    return { status: 200, bytes: result.value.bytes, mime: result.value.mime, charged: result.charged };
  }
  if (result.reason === 'provider_failed') {
    return { status: 502, body: { error: 'provider_failed', code: result.code } };
  }
  if (result.reason === 'quota_exceeded') return { status: 402, body: { error: 'quota_exceeded' } };
  return { status: 429, body: { error: 'rate_limited' } };
}
```

`apps/web/src/app/room/[code]/image/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { imageAdapter } from '@/lib/ai/image-adapter';
import { runImageRequest } from '@/lib/ai/image-request';
import { readGuestParticipantId } from '@/lib/rooms/guest-cookie';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

type Context = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const store = await cookies();
  const result = await runImageRequest(
    createAdminSupabase(),
    imageAdapter(),
    {
      joinCode: code,
      userId: auth.user?.id ?? null,
      guestParticipantId: (roomId) => readGuestParticipantId(store, roomId),
    },
    typeof body?.prompt === 'string' ? body.prompt : '',
  );
  if ('bytes' in result) {
    return new Response(result.bytes, {
      headers: {
        'Content-Type': result.mime,
        'Cache-Control': 'no-store',
        'X-Credits-Charged': String(result.charged),
      },
    });
  }
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
}
```

In `.github/workflows/ci.yml`, step «SDK dei provider AI solo in packages/ai», estendere il
pattern: `'@anthropic-ai/sdk\|from .openai.\|@fal-ai/\|fal\.run'`.

- [ ] **Step 5: Verificare**

Run: `npx vitest run tests/unit/ai-fal.test.ts tests/db/image-request.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai apps/web/src/lib/ai apps/web/src/app/room/[code]/image .github/workflows/ci.yml tests/unit/ai-fal.test.ts tests/db/image-request.test.ts
git commit -m "feat(ai): fal.ai FLUX schnell image generation behind the metered chain"
```

---

### Task 4B.11: conferma dell'immagine — ✓/✗ e pollice su/giù

**Files:**
- Modify: `apps/web/src/lib/stage/gesture-actions.ts`, `apps/web/src/lib/stage/use-gestures.ts`, `apps/web/src/lib/stage/agent-messages.ts`, `apps/web/src/lib/stage/use-agent.ts`, `apps/web/src/app/room/[code]/agent-panel.tsx`, `apps/web/src/app/room/[code]/stage-area.tsx`
- Test: `tests/unit/gesture-actions.test.ts`, `tests/unit/agent-messages.test.ts`, `e2e/voice.spec.ts`

**Interfaces:**
- Consumes: `proposal`, `dismissProposal` (4B.9); `POST /room/[code]/image` (4B.10); `addImage(bytes, mime, title, alt)` (slice 3).
- Produces:
  - `GestureAction` += `{ kind: 'confirm' } | { kind: 'reject' }`
  - `useGestures` opzioni nuove `onConfirm: () => void; onReject: () => void`
  - `useAgent` restituisce anche `generating: boolean` e `confirmProposal(addImage): Promise<void>`
  - `imageErrorMessage(status: number, code?: string): string`

- [ ] **Step 1: Scrivere i test che falliscono**

In `tests/unit/gesture-actions.test.ts` sostituire l'ultimo test:

```ts
  it('opens the agent on index up and turns thumbs into confirm and reject', () => {
    expect(gestureAction({ type: 'AGENT_ACTIVATE' }, one, newId)).toEqual({ kind: 'agent' });
    expect(gestureAction({ type: 'CONFIRM' }, one, newId)).toEqual({ kind: 'confirm' });
    expect(gestureAction({ type: 'REJECT' }, one, newId)).toEqual({ kind: 'reject' });
  });
```

In `tests/unit/agent-messages.test.ts` aggiungere:

```ts
import { imageErrorMessage } from '@/lib/stage/agent-messages';

describe('imageErrorMessage', () => {
  it('explains why an image did not arrive', () => {
    expect(imageErrorMessage(402)).toMatch(/Crediti esauriti/);
    expect(imageErrorMessage(502, 'refusal')).toMatch(/non può essere generata.*descrizione/);
    expect(imageErrorMessage(503)).toMatch(/immagini non sono attive/);
    expect(imageErrorMessage(502)).toMatch(/riprova/);
  });
});
```

In `e2e/voice.spec.ts` aggiungere:

```ts
test('an image is generated only after the host confirms it', async ({ browser }) => {
  const { host, email } = await signUpHostWithRoom(browser);
  await grantCreditsTo(email, 20);
  await host.reload();

  await host.getByRole('button', { name: /Chiedi all'agente/ }).click({ timeout: 20_000 });
  await host.getByLabel('Cosa ti serve?').fill("Fammi un'immagine di un ufficio luminoso");
  await host.getByRole('button', { name: 'Invia' }).click();

  const tray = host.getByRole('region', { name: 'Vassoio' });
  await expect(host.getByText(/Immagine proposta/)).toBeVisible({ timeout: 20_000 });
  await expect(tray.getByRole('img')).toHaveCount(0);

  await host.getByRole('button', { name: /Genera/ }).click();
  await expect(tray.getByRole('img', { name: /ufficio luminoso/ })).toBeVisible({ timeout: 20_000 });
  await expect(host.getByText(/Immagine proposta/)).toHaveCount(0);
});

test('a rejected image costs nothing and leaves no trace', async ({ browser }) => {
  const { host, email } = await signUpHostWithRoom(browser);
  await grantCreditsTo(email, 20);
  await host.reload();
  await host.getByRole('button', { name: /Chiedi all'agente/ }).click({ timeout: 20_000 });
  await host.getByLabel('Cosa ti serve?').fill('Una foto del team');
  await host.getByRole('button', { name: 'Invia' }).click();
  await host.getByRole('button', { name: /Scarta/ }).click({ timeout: 20_000 });
  await expect(host.getByText(/Immagine proposta/)).toHaveCount(0);
  await expect(host.getByRole('region', { name: 'Vassoio' }).getByRole('img')).toHaveCount(0);
});
```

(Il nome accessibile dell'immagine nel vassoio è l'`alt`: verificare in `tray.tsx` che le
immagini usino `alt={content.data.alt}`; se no, è un difetto della slice 3 da correggere
qui con una riga.)

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/unit/gesture-actions.test.ts tests/unit/agent-messages.test.ts`
Expected: FAIL.

- [ ] **Step 3: Gesture**

`gesture-actions.ts`:

```ts
export type GestureAction =
  | { kind: 'command'; command: StageCommand }
  | { kind: 'agent' }
  | { kind: 'confirm' }
  | { kind: 'reject' }
  | { kind: 'none' };
// ...
    case 'CONFIRM':
      return { kind: 'confirm' };
    case 'REJECT':
      return { kind: 'reject' };
```

`use-gestures.ts`: aggiungere `onConfirm: () => void; onReject: () => void;` a `Options`,
includerli in `handlersRef` (stesso schema di `onAgent`) e nel punto in cui si gestisce
`action.kind === 'agent'` aggiungere:

```ts
      else if (action.kind === 'confirm') handlers.onConfirm();
      else if (action.kind === 'reject') handlers.onReject();
```

(adattare ai nomi locali della funzione esistente: `const { dispatch: send, onAgent: agent } = handlersRef.current;` diventa `const { dispatch: send, onAgent: agent, onConfirm: confirm, onReject: reject } = handlersRef.current;`).

- [ ] **Step 4: Messaggi e conferma**

`agent-messages.ts`:

```ts
export function imageErrorMessage(status: number, code?: string): string {
  if (status === 402) return 'Crediti esauriti: chiedi una ricarica per generare immagini.';
  if (status === 429) return 'Troppe richieste in poco tempo: aspetta un minuto e riprova.';
  if (status === 503) return 'Le immagini non sono attive su questo ambiente.';
  if (status === 502 && code === 'refusal')
    return 'Questa immagine non può essere generata: cambia la descrizione e riprova.';
  if (status === 502) return 'L’immagine non è arrivata: riprova tra poco.';
  return 'Problema di rete: controlla la connessione e riprova.';
}
```

`use-agent.ts`, nuove parti:

```ts
  const [generating, setGenerating] = useState(false);

  const confirmProposal = useCallback(
    async (addImage: (bytes: Uint8Array, mime: ImageMime, title: string, alt: string) => void) => {
      if (!proposal || generating) return;
      setGenerating(true);
      setError(null);
      try {
        const response = await fetch(`/room/${joinCode}/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: proposal.prompt }),
        });
        const mime = response.headers.get('Content-Type') ?? '';
        if (response.ok && (mime === 'image/jpeg' || mime === 'image/png')) {
          addImage(new Uint8Array(await response.arrayBuffer()), mime, proposal.title, proposal.title);
          setProposal(null);
        } else {
          const body = (await response.json().catch(() => ({}))) as { code?: string };
          setError(imageErrorMessage(response.status, body.code));
        }
      } catch {
        setError(imageErrorMessage(0));
      } finally {
        setGenerating(false);
        void refreshUsage();
      }
    },
    [proposal, generating, joinCode, refreshUsage],
  );
```

e aggiungere `generating, confirmProposal` al valore restituito. Importare `ImageMime` da
`@omnicanvas/canvas` e `imageErrorMessage` da `./agent-messages`.

- [ ] **Step 5: Sollevare `useAgent` in `HostStage` e mostrare la proposta**

`useAgent` passa da `AgentPanel` a `HostStage`, perché anche i gesti devono poter
confermare. In `stage-area.tsx`:

```tsx
  const agent = useAgent({
    joinCode,
    onContent: (content) =>
      dispatch({ type: 'TRAY_ADD', content: toStageContent(content, crypto.randomUUID()) }),
  });
  const gestures = useGestures({
    session,
    cameraOn,
    stage,
    dispatch,
    onAgent: () => setListenRequest((n) => n + 1),
    onConfirm: () => void agent.confirmProposal(addImage),
    onReject: agent.dismissProposal,
    areaRef,
  });
  // ...
      <AgentPanel
        joinCode={joinCode}
        agent={agent}
        addImage={addImage}
        micOn={micOn}
        open={agentOpen}
        onOpenChange={setAgentOpen}
        listenRequest={listenRequest}
      />
```

`agent-panel.tsx`: togliere `dispatch` e la chiamata interna a `useAgent`; ricevere
`agent: ReturnType<typeof useAgent>` e `addImage`. Il `setPrompt('')` che stava in
`onContent` si sposta: svuotare il campo dopo `await agent.ask(prompt)` nell'`onSubmit`.
Sotto il form:

```tsx
      {agent.proposal && (
        <div role="group" aria-label="Immagine proposta" className="flex flex-col gap-1 rounded border border-amber-500/40 p-2">
          <p>
            Immagine proposta: <strong>{agent.proposal.title}</strong>
          </p>
          <p className="text-neutral-400">{agent.proposal.prompt}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void agent.confirmProposal(addImage)}
              disabled={agent.generating}
              className="rounded bg-emerald-500 px-3 py-1 text-neutral-950 disabled:opacity-40"
            >
              ✓ Genera (1 credito)
            </button>
            <button
              type="button"
              onClick={agent.dismissProposal}
              disabled={agent.generating}
              className="rounded bg-neutral-800 px-3 py-1 disabled:opacity-40"
            >
              ✗ Scarta
            </button>
          </div>
          {agent.generating && <p className="text-neutral-300">Genero l&apos;immagine…</p>}
          <p className="text-neutral-500">Anche col pollice su o giù, se le gesture sono attive.</p>
        </div>
      )}
```

Il costo mostrato «1 credito» vale per FLUX schnell; se `FAL_IMAGE_MODEL` cambia, il testo
va ricavato da `reserveCredits`. Per ora è una sola voce di listino: lasciare il testo
fisso e aggiungere al BACKLOG «mostrare il costo dell'immagine dal listino».

- [ ] **Step 6: Verificare**

Run: `npx vitest run tests/unit && npm run typecheck && npm run lint && npm run test:e2e`
Expected: PASS, tutti gli e2e (anche `agent.spec.ts` e `gestures.spec.ts`).

- [ ] **Step 7: Prova manuale con fal vero**

Con `FAL_KEY` e `AI_PROVIDER=anthropic`: «fammi un'immagine di una sala riunioni
moderna» → proposta → pollice su → immagine nel vassoio dell'host e, trascinata sul
palco, visibile all'ospite. Annotare latenza e crediti scalati. Provare pollice giù.

- [ ] **Step 8: Commit**

```bash
git add apps/web tests/unit/gesture-actions.test.ts tests/unit/agent-messages.test.ts e2e/voice.spec.ts
git commit -m "feat(web): confirm or discard a proposed image with a click or a thumb"
```

---

### Task 4B.12: addestrare «Ehi Omnia» (spike con timebox, 1 giorno)

Non è codice applicativo: produce un file `.onnx` e una misura. Il codice della stanza non
cambia, cambia `wakeword-config.ts`.

**Files:**
- Create: `tools/wakeword/ehi_omnia.yml`, `tools/wakeword/negative-phrases.txt`, `docs/spikes/2026-09-XX-parola-chiave-ehi-omnia.md` (data del giorno), `apps/web/public/models/wakeword/ehi_omnia.onnx`
- Modify: `apps/web/src/lib/voice/wakeword-config.ts`, `tools/wakeword/README.md`

- [ ] **Step 1: Configurazione dell'addestramento**

`tools/wakeword/negative-phrases.txt` (frasi vicine che non devono attivare):

```
e ogni
ehi uomini
ogni mattina
omnibus
insonnia
ehi tommaso
è in ombra
ehi Anna
ehi Omar
e poi
```

`tools/wakeword/ehi_omnia.yml`, sulla base di `examples/custom_model.yml` di
openWakeWord (notebook `automatic_model_training.ipynb`):

```yaml
model_name: ehi_omnia
target_phrase:
  - "ehi omnia"
  - "hey omnia"
custom_negative_phrases_file: negative-phrases.txt
n_samples: 20000
n_samples_val: 2000
tts_batch_size: 50
augmentation_batch_size: 16
augmentation_rounds: 1
# Voci italiane Piper per i positivi; il generatore inglese multi-speaker dà varietà di timbro.
piper_voices:
  - it_IT-riccardo-x_low
  - it_IT-paola-medium
steps: 50000
max_negative_weight: 1500
target_false_positives_per_hour: 0.2
```

(I nomi dei campi vanno allineati alla versione del notebook usata: se un campo non
esiste, toglierlo e annotarlo nel documento dello spike.)

- [ ] **Step 2: Addestrare**

Su Google Colab con GPU (gratuita) o nel Codespace (CPU, molto più lento): aprire il
notebook `automatic_model_training.ipynb` di openWakeWord, caricare i due file, generare i
campioni, addestrare, esportare `ehi_omnia.onnx`. Timebox: un giorno. Se il generatore di
campioni non accetta voci italiane, generare i positivi a parte con Piper
(`piper --model it_IT-paola-medium`) e con le voci italiane di sistema, e puntarci il
notebook.

- [ ] **Step 3: Misurare**

Nel documento dello spike, con la stessa pipeline del task 4B.7:
- 20 registrazioni reali di «Ehi Omnia» (almeno 4 voci diverse, microfono del portatile, a
  1 m): riconoscimenti su 20. Obiettivo ≥ 16.
- 1 ora di parlato italiano di riunione (registrazione propria o podcast): attivazioni
  false. Obiettivo ≤ 1.
- Soglia scelta e motivo.

- [ ] **Step 4: Sostituire il modello**

Se gli obiettivi sono raggiunti, in `wakeword-config.ts`:

```ts
export const WAKE_WORD = {
  label: 'Ehi Omnia',
  keywordFile: '/models/wakeword/ehi_omnia.onnx',
  threshold: 0.5, // valore misurato nello spike
  cooldownMs: 3_000,
  productionReady: true,
} as const;
```

Se non sono raggiunti: lasciare `hey_jarvis` in sviluppo, impostare la parola chiave «in
pausa» di default in produzione (`useState(WAKE_WORD.productionReady)` in
`agent-panel.tsx`), e scrivere nel documento dello spike cosa provare dopo. ✨, «🎙 Parla»
e indice alzato restano il modo affidabile (ADR-0012).

- [ ] **Step 5: Commit**

```bash
git add tools/wakeword docs/spikes apps/web/public/models/wakeword apps/web/src/lib/voice/wakeword-config.ts apps/web/src/app/room/[code]/agent-panel.tsx
git commit -m "feat(stt): Ehi Omnia wake word model with measured accuracy"
```

---

### Task 4B.13: chiusura della slice 4B

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, `CLAUDE.md`, `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (solo se qualcosa è cambiato rispetto alla spec)

- [ ] **Step 1: Documentazione**

- `ARCHITECTURE.md`: nel flusso dell'agente, token STT metered (1 credito), fine della
  richiesta con endpointing Deepgram e tetto 30 s, proposta d'immagine e conferma; nella
  catena AI, `executeMetered` con le tre operazioni; in `packages/stt`, entry `./server`.
- `BACKLOG.md`: spuntare «Parola chiave locale…» e «Immagini dietro conferma…»;
  aggiungere in «Dopo la slice 6»: «Modalità companion: STT continuo con VAD, tetto di
  spesa da decidere con Sean (spec §2.3)»; aggiungere «Mostrare il costo dell'immagine dal
  listino, non fisso» e «Misurare i secondi reali di STT (oggi si addebita il massimo)».
  Chiudere «CONFIRM/REJECT a gesto non fanno ancora nulla».
- `CLAUDE.md`, «Stato attuale»: slice 4B su `slice/4b-voce` (PR #7); decisioni aperte
  aggiornate (nome definitivo della parola chiave, traduzione, durata del link, prezzi).

- [ ] **Step 2: Definition of Done**

Invocare la skill `dod` e poi `costo`. Verificare in particolare:
- `grep -rn "console\.\(log\|info\|debug\)" packages/stt apps/web/src/lib/voice` → nessuna
  riga che stampi testo trascritto o descrizioni.
- `npm run verify && npm run test:db && npm run test:e2e && npm run build` verdi.
- CI verde sul push, job `boundaries` incluso.

- [ ] **Step 3: PR**

```bash
git push -u origin slice/4b-voce
"C:\Program Files\GitHub CLI\gh.exe" pr create --base slice/5-gesture --title "Slice 4B: voce dell'agente e immagini con conferma" --body-file <file con riepilogo, prove manuali, limitazioni>
```

La PR si impila su `slice/5-gesture`; il merge lo fa Sean.
