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
