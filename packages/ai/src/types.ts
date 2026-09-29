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
