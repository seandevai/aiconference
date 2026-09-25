'use client';

import { useRouter } from 'next/navigation';
import { useCall } from '@/lib/call/use-call';
import { cameraButtonLabel, micButtonLabel } from '@/lib/call/labels';
import { phaseMessage, type CallPhase } from '@/lib/call/phase';
import { useStage } from '@/lib/stage/use-stage';
import { leaveRoomAction } from './actions';
import { StageArea } from './stage-area';
import { VideoTile } from './video-tile';

type Props = { joinCode: string; role: 'host' | 'guest' };

const LIVE_PHASES: CallPhase[] = ['connecting', 'connected', 'reconnecting'];

export function RoomCall({ joinCode, role }: Props) {
  const router = useRouter();
  const { state, session, toggleMic, toggleCamera, startAudio, retry, leave, attachVideo } =
    useCall(joinCode);
  const stageApi = useStage({ joinCode, role, session, roster: state.roster });
  const local = state.roster.find((entry) => entry.isLocal);
  const message = phaseMessage(state.phase);
  const live = LIVE_PHASES.includes(state.phase);

  async function handleLeave() {
    await leave();
    await leaveRoomAction(joinCode);
    if (role === 'host') router.push('/dashboard');
  }

  return (
    <>
      <div className="relative flex min-h-0 flex-1">
        <aside
          aria-label="Partecipanti"
          className="absolute right-2 top-2 z-10 w-16 lg:static lg:w-48 lg:border-r lg:border-neutral-800 lg:p-3"
        >
          <ul className="flex flex-col gap-2">
            {state.roster.map((entry) => (
              <VideoTile key={entry.identity} entry={entry} attachVideo={attachVideo} />
            ))}
          </ul>
        </aside>

        <section
          aria-label="Palco"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 pr-20 lg:p-4"
        >
          {message && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 text-sm text-neutral-300"
            >
              <span>{message}</span>
              {state.phase === 'failed' && (
                <button
                  onClick={retry}
                  className="rounded bg-neutral-100 px-3 py-1 text-neutral-900"
                >
                  Riprova
                </button>
              )}
              {(state.phase === 'left' || state.phase === 'forbidden') && (
                <a href={`/room/${joinCode}`} className="underline">
                  Rientra
                </a>
              )}
            </div>
          )}
          {state.mediaError && live && (
            <p className="mt-2 text-sm text-amber-300">{state.mediaError}</p>
          )}
          {state.audioBlocked && live && (
            <button
              onClick={startAudio}
              className="mt-2 rounded bg-neutral-100 px-3 py-1 text-sm text-neutral-900"
            >
              Attiva l&apos;audio
            </button>
          )}
          {live && (
            <StageArea
              joinCode={joinCode}
              role={role}
              stage={stageApi.stage}
              ready={stageApi.ready}
              assetUrls={stageApi.assetUrls}
              dispatch={stageApi.dispatch}
              addImage={stageApi.addImage}
            />
          )}
        </section>
      </div>

      {live && (
        <nav
          aria-label="Controlli della chiamata"
          className="flex items-center justify-center gap-2 border-t border-neutral-800 px-4 py-2"
        >
          <button
            onClick={toggleMic}
            aria-pressed={!local?.micOn}
            className="rounded bg-neutral-800 px-3 py-2 text-sm"
          >
            {micButtonLabel(local?.micOn ?? false)}
          </button>
          <button
            onClick={toggleCamera}
            aria-pressed={!local?.camOn}
            className="rounded bg-neutral-800 px-3 py-2 text-sm"
          >
            {cameraButtonLabel(local?.camOn ?? false)}
          </button>
          <button onClick={handleLeave} className="rounded bg-red-600 px-3 py-2 text-sm">
            Esci
          </button>
        </nav>
      )}
    </>
  );
}
