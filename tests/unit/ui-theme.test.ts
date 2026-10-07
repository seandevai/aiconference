import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`token --color-${name} missing`);
  return match[1];
}

// Rapporto di contrasto WCAG 2.x fra due colori esadecimali.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme tokens', () => {
  it('defines every color of the spec', () => {
    expect(token('bg')).toBe('#282828');
    expect(token('surface')).toBe('#303030');
    expect(token('stage')).toBe('#202020');
    expect(token('raised')).toBe('#3a3a3a');
    expect(token('line')).toBe('#3d3d3d');
    expect(token('fg')).toBe('#ededed');
    expect(token('muted')).toBe('#a6a6a6');
    expect(token('accent')).toBe('#c8f25a');
    expect(token('on-accent')).toBe('#202020');
    expect(token('danger')).toBe('#ff6b6b');
  });

  it('keeps text readable on every surface (WCAG AA, 4.5:1)', () => {
    for (const surface of ['bg', 'surface', 'stage', 'raised']) {
      expect(contrast(token('fg'), token(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token('muted'), token(surface))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token('on-accent'), token('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('danger'), token('bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('defines the depth tokens and utilities of the 30/09 spec', () => {
    expect(css).toMatch(/--color-glow:\s*rgb\(200 242 90 \/ 0\.45\)/);
    for (const name of ['shadow-window', 'shadow-window-active', 'shadow-edge']) {
      expect(css).toContain(`--${name}:`);
    }
    for (const utility of ['stage-light', 'grain', 'window-tilt', 'voice-glow']) {
      expect(css).toContain(`@utility ${utility}`);
    }
    expect(css).toContain('--animate-birth:');
    expect(css).toContain('@keyframes birth');
  });

  it('eases the tilt and the border in one transition list', () => {
    const tilt = css.slice(css.indexOf('@utility window-tilt'), css.indexOf('@utility voice-glow'));
    expect(tilt).toMatch(/transition:[^;]*transform[^;]*box-shadow[^;]*border-color/);
  });

  it('keeps clicks working while a window glides to its slot', () => {
    const globals = readFileSync(
      new URL('../../apps/web/src/app/globals.css', import.meta.url),
      'utf8',
    );
    expect(globals).toMatch(/::view-transition\s*\{\s*pointer-events:\s*none;/);
  });

  it('moves the windows only for a fine pointer and when motion is welcome', () => {
    const tilt = css.slice(css.indexOf('@utility window-tilt'));
    expect(tilt).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/,
    );
  });

  it('keeps danger and accent readable as text on the panels (WCAG AA, 4.5:1)', () => {
    for (const surface of ['surface', 'stage']) {
      expect(contrast(token('danger'), token(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token('accent'), token(surface))).toBeGreaterThanOrEqual(4.5);
    }
    // Su raised danger scende a 4.1: niente testo di errore sulle tessere.
    expect(contrast(token('accent'), token('raised'))).toBeGreaterThanOrEqual(4.5);
  });
});
