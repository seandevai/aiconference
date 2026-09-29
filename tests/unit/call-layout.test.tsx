// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, emptyStage } from '@omnicanvas/canvas';
import type { RosterEntry } from '@omnicanvas/realtime';
import { MobileStage } from '@/app/room/[code]/mobile-stage';
import { VideoTile } from '@/app/room/[code]/video-tile';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/room/[code]/actions', () => ({ leaveRoomAction: vi.fn() }));
vi.mock('@/lib/stage/use-stage', () => ({
  useStage: () => ({
    stage: emptyStage(),
    ready: false,
    assetUrls: {},
    dispatch: vi.fn(),
    addImage: vi.fn(),
  }),
}));

const person = (i: number, over: Partial<RosterEntry> = {}): RosterEntry => ({
  identity: `p${i}`,
  name: `Persona ${i}`,
  role: i === 0 ? 'host' : 'guest',
  language: 'it',
  isLocal: i === 1,
  micOn: true,
  camOn: false,
  speaking: false,
  ...over,
});

vi.mock('@/lib/call/use-call', () => ({
  useCall: () => ({
    state: {
      phase: 'connected',
      roster: Array.from({ length: 6 }, (_, i) => person(i)),
      audioBlocked: false,
      mediaError: null,
      canSwitchCamera: false,
      cameraFacing: 'user',
    },
    session: null,
    toggleMic: vi.fn(),
    toggleCamera: vi.fn(),
    switchCamera: vi.fn(),
    startAudio: vi.fn(),
    retry: vi.fn(),
    leave: vi.fn(),
    attachVideo: () => () => {},
  }),
}));

afterEach(cleanup);

const twoWindows = () =>
  applyCommand(
    applyCommand(emptyStage(), {
      type: 'WINDOW_CREATE',
      windowId: '00000000-0000-4000-8000-000000000001',
      title: 'Ricavi',
    }),
    { type: 'WINDOW_CREATE', windowId: '00000000-0000-4000-8000-000000000002', title: 'Proposta' },
  );

describe('phone touch targets (spec §3: at least 44px)', () => {
  it('keeps the phone stage buttons thumb-sized', () => {
    render(<MobileStage stage={twoWindows()} assetUrls={{}} />);
    for (const name of ['Finestra precedente', 'Finestra successiva']) {
      expect(screen.getByRole('button', { name }).className).toContain('min-h-11');
    }
  });

  it('keeps the face tiles thumb-sized in portrait', () => {
    render(
      <ul>
        <VideoTile entry={person(2)} attachVideo={() => () => {}} onSelect={() => {}} />
      </ul>,
    );
    expect(screen.getByRole('listitem').className).toMatch(/(^|\s)h-11(\s|$)/);
  });
});

describe('faces strip with many people', () => {
  it('scrolls sideways inside itself instead of pushing the page wider', async () => {
    const { RoomCall } = await import('@/app/room/[code]/room-call');
    render(<RoomCall joinCode="ABCD2345" role="guest" showSamples={false} />);
    const faces = screen.getByRole('complementary', { name: 'Partecipanti' });
    expect(faces.className).toContain('overflow-x-auto');
    expect(faces.className).toContain('min-w-0');
  });
});
