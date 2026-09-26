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

export type ProviderUsage = { model: string; inputTokens: number; outputTokens: number };

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

// Il task 4B.9 lo allarga con la proposta d'immagine.
export type AgentOutcome = AgentContent;

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
  operation: AiOperation;
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
