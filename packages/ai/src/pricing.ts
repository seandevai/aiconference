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
