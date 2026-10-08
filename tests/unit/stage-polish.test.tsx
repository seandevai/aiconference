// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import { StageArea } from '@/app/room/[code]/stage-area';
import { WindowView } from '@/app/room/[code]/window-view';

afterEach(cleanup);

const withWindow = () =>
  applyCommand(emptyStage(), {
    type: 'WINDOW_CREATE',
    windowId: '00000000-0000-4000-8000-000000000001',
    title: 'Ricavi',
  });

describe('stage while loading', () => {
  it('shows the shape of the stage instead of a bare line of text', () => {
    render(
      <StageArea
        joinCode="ABCD2345"
        session={null}
        cameraOn={false}
        role="guest"
        showSamples={false}
        stage={emptyStage()}
        ready={false}
        assetUrls={{}}
        dispatch={vi.fn()}
        addImage={vi.fn()}
      />,
    );
    // Sta dentro la regione «Palco»: una seconda regione col nome simile la duplicherebbe.
    expect(screen.queryByRole('region')).toBeNull();
    const skeleton = screen.getByTestId('stage-skeleton');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.textContent).toContain('Caricamento del palco…');
    expect(skeleton.querySelectorAll('[data-skeleton]').length).toBeGreaterThanOrEqual(2);
  });
});

describe('window actions in a narrow slot', () => {
  it('keep their text as the accessible name even when only the icon shows', () => {
    const stage = withWindow();
    const window = { ...stage.windows[0]!, slot: 'side-1' as const };
    render(<WindowView window={window} assetUrls={{}} dispatch={vi.fn()} />);
    for (const name of ['Metti in primo piano', 'Archivia finestra']) {
      const button = screen.getByRole('button', { name });
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.querySelector('.sr-only')?.textContent).toBe(name);
    }
  });

  it('show the text again when the window is wide enough', () => {
    const stage = withWindow();
    render(<WindowView window={stage.windows[0]!} assetUrls={{}} dispatch={vi.fn()} />);
    const label = screen
      .getByRole('button', { name: 'Archivia finestra' })
      .querySelector('.sr-only');
    expect(label?.className).toContain('@xs:not-sr-only');
  });
});

describe('host layout below lg', () => {
  it('puts the lab under the stage instead of squeezing it', () => {
    // Il pannello dell'agente chiede il contatore al server: qui basta una risposta vuota.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(
      <StageArea
        joinCode="ABCD2345"
        session={null}
        cameraOn={false}
        role="host"
        showSamples={false}
        stage={withWindow()}
        ready
        assetUrls={{}}
        dispatch={vi.fn()}
        addImage={vi.fn()}
      />,
    );
    const lab = screen.getByRole('region', { name: 'Laboratorio' });
    expect(lab.className).toContain('w-full');
    expect(lab.className).toContain('order-last');
    expect(lab.className).toContain('lg:w-60');
    expect(lab.className).toContain('lg:order-none');
    // Con l'altezza limitata scorre tutto il laboratorio: i blocchi non si schiacciano uno sull'altro.
    expect(lab.className).toContain('max-lg:*:shrink-0');
    const area = lab.parentElement!;
    expect(area.className).toContain('flex-col');
    expect(area.className).toContain('lg:flex-row');
    vi.unstubAllGlobals();
  });
});
