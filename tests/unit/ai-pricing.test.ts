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
