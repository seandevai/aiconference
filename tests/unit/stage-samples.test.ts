import { describe, expect, it } from 'vitest';
import { showSampleContent } from '@/lib/stage/sample-content';

describe('showSampleContent', () => {
  it('shows the test contents only with the fake provider (CI, e2e)', () => {
    expect(showSampleContent('fake')).toBe(true);
  });
  it('hides them with the real agent: no fake data in front of a client', () => {
    expect(showSampleContent('anthropic')).toBe(false);
  });
});
