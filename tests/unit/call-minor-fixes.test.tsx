// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RosterEntry } from '@omnicanvas/realtime';

vi.mock('@/lib/call/pip', () => ({
  openPip: vi.fn(),
}));

import { openPip } from '@/lib/call/pip';
import { PipVideo } from '@/app/room/[code]/pip-video';
import { SpotlightView } from '@/app/room/[code]/spotlight-view';
import { VideoTile } from '@/app/room/[code]/video-tile';

afterEach(cleanup);

const entry: RosterEntry = {
  identity: 'p1',
  name: 'Cliente',
  role: 'guest',
  language: 'en',
  isLocal: false,
  micOn: false,
  camOn: false,
  speaking: false,
};
const attachVideo = () => () => {};

describe('PipVideo', () => {
  it('handles a refused PiP request from the Media Session handler', () => {
    let handler: (() => void) | null = null;
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: {
        setActionHandler: (_action: string, fn: (() => void) | null) => {
          handler = fn;
        },
      },
    });
    const refused = Promise.reject(new Error('NotAllowedError'));
    const caught = vi.spyOn(refused, 'catch');
    vi.mocked(openPip).mockReturnValueOnce(refused);
    render(
      <PipVideo
        identity={null}
        name="Cliente"
        camOn={false}
        attachVideo={attachVideo}
        videoRef={createRef<HTMLVideoElement>()}
      />,
    );
    expect(handler).not.toBeNull();
    (handler as unknown as () => void)();
    expect(openPip).toHaveBeenCalledOnce();
    expect(caught).toHaveBeenCalledOnce();
    // Nel caso il componente non lo gestisca, il test non lascia rifiuti in giro.
    refused.then(undefined, () => {});
  });
});

describe('SpotlightView', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <SpotlightView
        entry={entry}
        local={undefined}
        mirrorSelf={false}
        attachVideo={attachVideo}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores Escape while the user is typing in a field', () => {
    const onClose = vi.fn();
    render(
      <>
        <input aria-label="Richiesta all'agente" />
        <SpotlightView
          entry={entry}
          local={undefined}
          mirrorSelf={false}
          attachVideo={attachVideo}
          onClose={onClose}
        />
      </>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps a long name inside the pill', () => {
    const name = 'Maria Antonietta Bartolomei della Rovere';
    render(
      <SpotlightView
        entry={{ ...entry, name }}
        local={undefined}
        mirrorSelf={false}
        attachVideo={attachVideo}
        onClose={() => {}}
      />,
    );
    const pill = screen.getByText(name, { selector: 'span:not([aria-hidden])' });
    expect(pill.className).toContain('truncate');
    expect(pill.className).toMatch(/max-w-/);
    expect(pill.getAttribute('title')).toBe(name);
  });
});

describe('VideoTile', () => {
  it('keeps the microphone state in the name of the spotlight button', () => {
    render(
      <ul>
        <VideoTile entry={entry} attachVideo={attachVideo} onSelect={() => {}} />
      </ul>,
    );
    expect(
      screen.getByRole('button', { name: 'Mostra Cliente a tutto schermo, microfono spento' }),
    ).toBeTruthy();
  });
});
