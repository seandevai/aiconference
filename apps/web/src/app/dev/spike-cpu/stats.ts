export function summarize(samples: number[]): { count: number; p50: number; p95: number } {
  if (samples.length === 0) return { count: 0, p50: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
  return { count: sorted.length, p50: rank(50), p95: rank(95) };
}
