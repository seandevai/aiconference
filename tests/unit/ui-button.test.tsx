// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Logo } from '@omnicanvas/ui';

afterEach(cleanup);

describe('Button', () => {
  it('keeps its text as the accessible name', () => {
    render(<Button>Riquadro</Button>);
    expect(screen.getByRole('button', { name: 'Riquadro' })).toBeTruthy();
  });

  it('is a plain button by default, never a form submit by accident', () => {
    render(<Button>Esci</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('marks the accent variant with the lime background', () => {
    render(<Button variant="accent">Chiedi all&apos;agente</Button>);
    expect(screen.getByRole('button').className).toContain('bg-accent');
  });

  it('passes aria-pressed through for toggles', () => {
    render(<Button aria-pressed>Metti in pausa le gesture</Button>);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('merges extra classes', () => {
    render(<Button className="w-full">Invia</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });
});

describe('Logo', () => {
  it('is announced as Nod', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Nod' })).toBeTruthy();
  });
});
