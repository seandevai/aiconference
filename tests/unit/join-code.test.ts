import { describe, expect, it } from 'vitest';
import { generateJoinCode, isValidJoinCode, normalizeJoinCode } from '@/lib/rooms/join-code';
import { isLanguage } from '@/lib/rooms/languages';

describe('join code', () => {
  it('has 8 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateJoinCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it('does not repeat over a thousand draws', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateJoinCode()));
    expect(codes.size).toBe(1000);
  });

  it('validates the format', () => {
    expect(isValidJoinCode(generateJoinCode())).toBe(true);
    expect(isValidJoinCode('abc')).toBe(false);
    expect(isValidJoinCode('OIL01234')).toBe(false);
    expect(isValidJoinCode('abcdefgh')).toBe(false);
  });
});

describe('normalizeJoinCode', () => {
  it('accepts a code typed by hand: lower case, spaces, dashes', () => {
    expect(normalizeJoinCode('abcd-2345')).toBe('ABCD2345');
    expect(normalizeJoinCode(' abcd 2345 ')).toBe('ABCD2345');
  });
  it('decodes what the address bar encodes', () => {
    expect(normalizeJoinCode('abcd%202345')).toBe('ABCD2345');
  });
  it('leaves a canonical code as it is', () => {
    expect(normalizeJoinCode('ABCD2345')).toBe('ABCD2345');
  });
  it('does not crash on a broken escape', () => {
    expect(normalizeJoinCode('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('languages', () => {
  it('accepts supported languages only', () => {
    expect(isLanguage('it')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('xx')).toBe(false);
  });
});
