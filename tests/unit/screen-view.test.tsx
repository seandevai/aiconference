// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, emptyStage, screenStartCommands } from '@omnicanvas/canvas';
import { ScreenAttachContext, ScreenView } from '@/app/room/[code]/screen-view';
import { WindowView } from '@/app/room/[code]/window-view';

afterEach(cleanup);

describe('ScreenView', () => {
  it('attaches the owner screen and waits for the first frame', () => {
    const detach = vi.fn();
    const attach = vi.fn(() => detach);
    const { unmount } = render(
      <ScreenAttachContext.Provider value={attach}>
        <ScreenView owner="host-1" title="Schermo" />
      </ScreenAttachContext.Provider>,
    );
    expect(attach).toHaveBeenCalledWith('host-1', expect.any(HTMLVideoElement));
    expect(screen.getByText('Schermo in arrivo…')).toBeTruthy();
    fireEvent.loadedData(screen.getByLabelText('Schermo'));
    expect(screen.queryByText('Schermo in arrivo…')).toBeNull();
    unmount();
    expect(detach).toHaveBeenCalled();
  });

  it('shows the placeholder without a session', () => {
    render(<ScreenView owner="host-1" title="Schermo" />);
    expect(screen.getByText('Schermo in arrivo…')).toBeTruthy();
  });
});

describe('WindowView with the screen', () => {
  it('has no «Rimetti nel vassoio» for the screen', () => {
    const stage = screenStartCommands(emptyStage(), {
      owner: 'host-1',
      contentId: '00000000-0000-4000-8000-0000000000a1',
      windowId: '10000000-0000-4000-8000-0000000000a1',
    }).reduce(applyCommand, emptyStage());
    render(<WindowView window={stage.windows[0]!} assetUrls={{}} dispatch={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Rimetti nel vassoio' })).toBeNull();
  });
});
