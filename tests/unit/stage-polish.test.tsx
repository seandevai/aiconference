// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import { StageArea } from '@/app/room/[code]/stage-area';
import { WindowView } from '@/app/room/[code]/window-view';
import { StageBoard } from '@/app/room/[code]/stage-board';
import { MobileStage } from '@/app/room/[code]/mobile-stage';

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
        born={[]}
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

describe('window birth and move animations', () => {
  const ID = '00000000-0000-4000-8000-000000000001';

  it('marks a window as just born only when told so', () => {
    const [window] = withWindow().windows;
    const { rerender } = render(<WindowView window={window!} assetUrls={{}} born />);
    expect(screen.getByRole('article').hasAttribute('data-born')).toBe(true);
    expect(screen.getByRole('article').className).toContain('motion-safe:data-born:animate-birth');
    rerender(<WindowView window={window!} assetUrls={{}} />);
    expect(screen.getByRole('article').hasAttribute('data-born')).toBe(false);
  });

  it('names each window for view transitions on the board only', () => {
    const stage = withWindow();
    const { unmount } = render(<StageBoard stage={stage} assetUrls={{}} born={[ID]} />);
    const article = screen.getByRole('article');
    expect(article.style.getPropertyValue('view-transition-name')).toBe(`win-${ID}`);
    expect(article.hasAttribute('data-born')).toBe(true);
    unmount();
    render(<MobileStage stage={stage} assetUrls={{}} born={[ID]} />);
    const mobile = screen.getByRole('article');
    expect(mobile.style.getPropertyValue('view-transition-name')).toBe('');
    expect(mobile.hasAttribute('data-born')).toBe(true);
  });

  it('gives windows depth: shadow, active glow and tilt', () => {
    const [window] = withWindow().windows;
    render(<WindowView window={window!} assetUrls={{}} />);
    const cls = screen.getByRole('article').className;
    expect(cls).toContain('window-tilt');
    // Un transition-property successivo cancellerebbe la transizione dell'inclinazione.
    expect(cls).not.toContain('transition-colors');
    expect(cls).toContain(window!.slot === 'main' ? 'shadow-window-active' : 'shadow-window');
  });
});

describe('slot under the dragged item', () => {
  const slotOf = (name: string) => screen.getByRole('region', { name });

  it('lights the slot the hand is over', () => {
    render(<StageBoard stage={withWindow()} assetUrls={{}} dispatch={vi.fn()} hotSlot="side-1" />);
    expect(slotOf('Finestra laterale 1').hasAttribute('data-hot')).toBe(true);
    expect(slotOf('Finestra in primo piano').hasAttribute('data-hot')).toBe(false);
  });

  it('lights a slot while dragging with the mouse and clears it on drop, leave and end', () => {
    const { container } = render(
      <StageBoard stage={withWindow()} assetUrls={{}} dispatch={vi.fn()} />,
    );
    const board = container.firstElementChild as HTMLElement;
    const hot = () => container.querySelectorAll('[data-hot]').length;
    // happy-dom non ha DragEvent: un MouseEvent porta le coordinate che il browser darebbe.
    const drag = (type: string, init: MouseEventInit = {}) =>
      fireEvent(board, new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
    const at = { clientX: 10, clientY: 10 };

    drag('dragover', at);
    expect(hot()).toBe(1);
    drag('drop', at);
    expect(hot()).toBe(0);

    drag('dragover', at);
    drag('dragleave', { relatedTarget: document.body });
    expect(hot()).toBe(0);

    drag('dragover', at);
    drag('dragend');
    expect(hot()).toBe(0);
  });

  it('never lights a slot for a guest, who cannot drop', () => {
    const { container } = render(<StageBoard stage={withWindow()} assetUrls={{}} />);
    fireEvent(
      container.firstElementChild as HTMLElement,
      new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    expect(container.querySelectorAll('[data-hot]').length).toBe(0);
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
        born={[]}
        dispatch={vi.fn()}
        addImage={vi.fn()}
      />,
    );
    const lab =screen.getByRole('region', { name: 'Laboratorio' });
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
