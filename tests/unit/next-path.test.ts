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
    ['/\t/evil.example'],
    ['/\n/evil.example'],
    ['/\r/evil.example'],
    ['/ok\\evil'],
    ['/.//evil.example'],
    ['/..//evil.example'],
    ['/a/../..//evil'],
  ])('falls back to /dashboard for %s', (value) => {
    expect(safeNextPath(value)).toBe('/dashboard');
  });

  it('takes the first element when next is an array', () => {
    expect(safeNextPath(['/room/ABCD2345', '//evil'])).toBe('/room/ABCD2345');
  });

  it('falls back to /dashboard when the first array element is unsafe', () => {
    expect(safeNextPath(['//evil'])).toBe('/dashboard');
  });
});
