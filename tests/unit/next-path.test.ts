import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/auth/next-path';

describe('safeNextPath', () => {
  it('keeps a same-origin path', () => {
    expect(safeNextPath('/room/ABCD2345')).toBe('/room/ABCD2345');
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['https://evil.example'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
  ])('falls back to /dashboard for %s', (value) => {
    expect(safeNextPath(value)).toBe('/dashboard');
  });
});
