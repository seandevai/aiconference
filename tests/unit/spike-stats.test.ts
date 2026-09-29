import { describe, expect, it } from 'vitest';
import { summarize } from '@/app/dev/spike-cpu/stats';

describe('summarize', () => {
  it('reports nearest-rank percentiles', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(summarize(samples)).toEqual({ count: 100, p50: 50, p95: 95 });
  });

  it('handles an empty run', () => {
    expect(summarize([])).toEqual({ count: 0, p50: 0, p95: 0 });
  });
});
