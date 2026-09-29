import { describe, expect, it } from 'vitest';
import { parseDisplayName } from '@/lib/auth/display-name';

describe('parseDisplayName', () => {
  it('trims the name', () => {
    expect(parseDisplayName('  Anna  ')).toBe('Anna');
  });
  it('rejects a blank name', () => {
    expect(parseDisplayName('   ')).toBeNull();
  });
  it('rejects a name over 40 characters, the form limit', () => {
    expect(parseDisplayName('x'.repeat(41))).toBeNull();
    expect(parseDisplayName('x'.repeat(40))).toBe('x'.repeat(40));
  });
});
