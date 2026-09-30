// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Menu, TextField } from '@omnicanvas/ui';

afterEach(cleanup);

describe('TextField', () => {
  it('names the input with its label', () => {
    render(<TextField label="Email" name="email" />);
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
  });

  it('announces the error and ties it to the input', () => {
    render(<TextField label="Nome" name="n" error="Scrivi il tuo nome." />);
    const input = screen.getByRole('textbox', { name: 'Nome' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(errorId)?.textContent).toBe('Scrivi il tuo nome.');
  });

  it('stays valid without an error', () => {
    render(<TextField label="Nome" name="n" />);
    const input = screen.getByRole('textbox', { name: 'Nome' });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('Menu', () => {
  const renderMenu = () =>
    render(
      <Menu label="Giulia" triggerLabel="Menu di Giulia">
        <button type="button">Esci</button>
      </Menu>,
    );

  it('opens and closes from its button', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Menu di Giulia' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Esci' })).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Esci' })).toBeTruthy();
  });

  it('closes with Escape and gives focus back to its button', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Menu di Giulia' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Esci' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on a click outside', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Menu di Giulia' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: 'Esci' })).toBeNull();
  });
});

describe('Button sizes and variants', () => {
  it('makes a round 44px icon button without conflicting paddings', () => {
    render(
      <Button size="icon" aria-label="Chiudi">
        x
      </Button>,
    );
    const cls = screen.getByRole('button', { name: 'Chiudi' }).className;
    expect(cls).toContain('h-11');
    expect(cls).toContain('w-11');
    expect(cls).not.toContain('px-4');
  });

  it('has a translucent overlay variant for buttons over video', () => {
    render(<Button variant="overlay">Chiudi</Button>);
    const cls = screen.getByRole('button', { name: 'Chiudi' }).className;
    expect(cls).toContain('bg-bg/80');
    expect(cls).not.toContain('bg-raised');
  });
});
