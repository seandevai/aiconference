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
