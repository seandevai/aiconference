// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FaceTile, Panel, StatusBanner, faceInitial } from '@omnicanvas/ui';

afterEach(cleanup);

describe('Panel', () => {
  it('renders the requested element with its label', () => {
    render(
      <Panel as="section" aria-label="Laboratorio">
        x
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Laboratorio' }).className).toContain('bg-surface');
  });
  it('uses the darker stage tone for the stage', () => {
    render(
      <Panel tone="stage" data-testid="p">
        x
      </Panel>,
    );
    expect(screen.getByTestId('p').className).toContain('bg-stage');
  });
  it('lights the stage from above and gives it grain when asked', () => {
    render(
      <Panel tone="stage" lit data-testid="p">
        x
      </Panel>,
    );
    const cls = screen.getByTestId('p').className;
    expect(cls).toContain('stage-light');
    expect(cls).toContain('grain');
  });
  it('keeps other stage-toned panels (the dashboard) plain', () => {
    render(
      <Panel tone="stage" data-testid="plain">
        x
      </Panel>,
    );
    const cls = screen.getByTestId('plain').className;
    expect(cls).not.toContain('grain');
    expect(cls).not.toContain('stage-light');
  });
  it('gives surfaces a thin edge of light', () => {
    render(<Panel data-testid="s">x</Panel>);
    expect(screen.getByTestId('s').className).toContain('shadow-edge');
  });
});

describe('FaceTile', () => {
  it('shows the initial when there is no video', () => {
    render(<FaceTile name="anna" speaking={false} micOn />);
    expect(screen.getByText('A')).toBeTruthy();
  });
  it('never shows an empty initial, even for a blank name', () => {
    expect(faceInitial('   ')).toBe('?');
    expect(faceInitial('')).toBe('?');
  });
  it('rings the tile in lime while that person speaks', () => {
    const { container } = render(<FaceTile name="Anna" speaking micOn />);
    const tile = container.firstElementChild!;
    expect(tile.getAttribute('data-speaking')).toBe('true');
    expect(tile.className).toContain('ring-accent');
  });
  it('shows the video instead of the initial when given', () => {
    render(
      <FaceTile name="Anna" speaking={false} micOn>
        <video data-testid="v" />
      </FaceTile>,
    );
    expect(screen.getByTestId('v')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
  });
  it('lets the glow follow the voice while speaking, only when motion is welcome', () => {
    const { container } = render(<FaceTile name="Anna" speaking micOn level={0.6} />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.getPropertyValue('--level')).toBe('0.6');
    expect(tile.className).toContain('motion-safe:voice-glow');
    expect(tile.className).toContain('ring-accent');
  });
  it('has no voice glow when silent', () => {
    const { container } = render(<FaceTile name="Anna" speaking={false} micOn level={0.6} />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.getPropertyValue('--level')).toBe('');
    expect(tile.className).not.toContain('voice-glow');
  });
  it('marks a muted microphone without adding an accessible name', () => {
    const { container } = render(<FaceTile name="Anna" speaking={false} micOn={false} />);
    expect(container.querySelector('[data-muted]')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('StatusBanner', () => {
  it('announces connection messages politely', () => {
    render(<StatusBanner>Connessione persa, riprovo…</StatusBanner>);
    expect(screen.getByRole('status').textContent).toContain('Connessione persa');
  });
  it('uses an alert for errors', () => {
    render(
      <StatusBanner tone="error" live="alert">
        Camera non disponibile
      </StatusBanner>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('can stay silent, so two statuses never compete', () => {
    render(<StatusBanner live="none">L&apos;agente sta lavorando…</StatusBanner>);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('renders its action next to the message', () => {
    render(
      <StatusBanner action={<button>Riprova</button>}>Non riesco a ricollegarmi.</StatusBanner>,
    );
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy();
  });
});
