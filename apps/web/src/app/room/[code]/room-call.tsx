'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, StatusBanner } from '@omnicanvas/ui';
import { useCall } from '@/lib/call/use-call';
import { closeRoomRequest, extendRoomRequest, latestEndsAt } from '@/lib/call/room-timer-requests';
import { useRoomTimer, useTimerEnd } from '@/lib/call/use-room-timer';
import { guestShouldStay, type ExtendMinutes } from '@/lib/rooms/timer';
import { cameraButtonLabel, micButtonLabel } from '@/lib/call/labels';
import { phaseMessage, type CallPhase } from '@/lib/call/phase';
import { isMirrored } from '@/lib/call/mirror';
import { openPip, watchPipSupport } from '@/lib/call/pip';
import { nextLastSpeaker, pipTarget, resolveSpotlight } from '@/lib/call/spotlight';
import { useStage } from '@/lib/stage/use-stage';
import { leaveRoomAction } from './actions';
import { PipVideo } from './pip-video';
import { SpotlightView } from './spotlight-view';
import { StageArea } from './stage-area';
import { RoomTimerNotice, RoomTimerPill } from './room-timer';
import { VideoTile } from './video-tile';

type Props = { joinCode: string; role: 'host' | 'guest'; showSamples: boolean };

const LIVE_PHASES: CallPhase[] = ['connecting', 'connected', 'reconnecting'];

export function RoomCall({ joinCode, role, showSamples }: Props) {
  const router = useRouter();
  const {
    state,
    session,
    toggleMic,
    toggleCamera,
    switchCamera,
    startAudio,
    retry,
    leave,
    end,
    attachVideo,
  } = useCall(joinCode);
  const stageApi = useStage({ joinCode, role, session, roster: state.roster });
  const { timer, applyTiming } = useRoomTimer({
    timing: state.timing,
    session,
    roster: state.roster,
  });
  const [extending, setExtending] = useState(false);
  const [extendFailed, setExtendFailed] = useState(false);
  const local = state.roster.find((entry) => entry.isLocal);
  const message = phaseMessage(state.phase);
  const live = LIVE_PHASES.includes(state.phase);
  // Host: chiude la stanza per tutti (dalla slice 8 il pacchetto si compone prima).
  // Ospite: chiede al server se l'host ha prorogato e il messaggio si è perso.
  const finish = useCallback(async () => {
    if (role === 'host') {
      await closeRoomRequest(joinCode);
      await end();
      return;
    }
    const latest = await latestEndsAt(joinCode);
    if (timer && latest && guestShouldStay(timer.endsAt, latest.endsAt)) {
      applyTiming(latest.endsAt, latest.capAt);
      return;
    }
    await end();
  }, [role, joinCode, end, timer, applyTiming]);

  useTimerEnd(timer?.phase ?? null, live, () => void finish());

  async function handleExtend(minutes: ExtendMinutes) {
    setExtending(true);
    setExtendFailed(false);
    const next = await extendRoomRequest(joinCode, minutes);
    setExtending(false);
    if (!next) {
      setExtendFailed(true);
      return;
    }
    applyTiming(next.endsAt, next.capAt);
    void session?.sendData('room-timer', next).catch(() => {});
  }

  const [selected, setSelected] = useState<string | null>(null);
  const spotlight = resolveSpotlight(selected, state.roster);
  // Chi esce chiude lo spotlight: senza azzerare, rientrando lo riaprirebbe.
  if (selected !== null && spotlight === null) setSelected(null);
  const spotlightEntry = state.roster.find((entry) => entry.identity === spotlight);
  const closeSpotlight = useCallback(() => setSelected(null), []);
  const [speaker, setSpeaker] = useState<{ roster: typeof state.roster; id: string | null }>({
    roster: state.roster,
    id: null,
  });
  // Aggiornato durante il render quando cambia il roster: niente effetto in più.
  if (speaker.roster !== state.roster) {
    setSpeaker({ roster: state.roster, id: nextLastSpeaker(speaker.id, state.roster) });
  }
  const pipIdentity = pipTarget(state.roster, spotlight, speaker.id);
  const pipEntry = state.roster.find((entry) => entry.identity === pipIdentity);
  const pipRef = useRef<HTMLVideoElement>(null);
  const [pipSupported, setPipSupported] = useState(false);
  useEffect(() => {
    const video = pipRef.current;
    if (!video) return;
    return watchPipSupport(document, video, setPipSupported);
  }, [live]);

  async function handleLeave() {
    await leave();
    await leaveRoomAction(joinCode);
    if (role === 'host') router.push('/dashboard');
  }

  return (
    <>
      <aside
        aria-label="Partecipanti"
        className="flex min-w-0 max-w-[60vw] items-center overflow-x-auto px-3 py-1.5 [grid-area:faces] phone-landscape:max-w-none phone-landscape:overflow-x-hidden phone-landscape:w-24 phone-landscape:items-start phone-landscape:overflow-y-auto phone-landscape:p-2"
      >
        <ul className="flex gap-2 phone-landscape:w-full phone-landscape:flex-col">
          {state.roster.map((entry) => (
            <VideoTile
              key={entry.identity}
              entry={entry}
              attachVideo={attachVideo}
              onSelect={entry.isLocal ? undefined : () => setSelected(entry.identity)}
              mirrored={isMirrored(entry, state.cameraFacing)}
            />
          ))}
        </ul>
      </aside>

      <div className="relative flex min-h-0 [grid-area:main]">
        <section
          aria-label="Palco"
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-3 pb-2 lg:px-4"
        >
          {message && (
            <StatusBanner
              tone={state.phase === 'failed' ? 'error' : 'info'}
              action={
                state.phase === 'failed' ? (
                  <Button size="sm" onClick={retry}>
                    Riprova
                  </Button>
                ) : state.phase === 'left' || state.phase === 'forbidden' ? (
                  <a href={`/room/${joinCode}`} className="text-sm underline">
                    Rientra
                  </a>
                ) : undefined
              }
            >
              {message}
            </StatusBanner>
          )}
          {state.mediaError && live && (
            <StatusBanner tone="error" live="alert">
              {state.mediaError}
            </StatusBanner>
          )}
          {timer && live && (
            <RoomTimerNotice
              role={role}
              timer={timer}
              extending={extending}
              onExtend={(minutes) => void handleExtend(minutes)}
              onEndNow={() => void finish()}
            />
          )}
          {extendFailed && live && (
            <StatusBanner tone="error" live="alert">
              Non sono riuscito a prorogare la riunione. Riprova.
            </StatusBanner>
          )}
          {state.audioBlocked && live && (
            <StatusBanner
              tone="warning"
              live="none"
              action={
                <Button size="sm" variant="accent" onClick={startAudio}>
                  Attiva l&apos;audio
                </Button>
              }
            >
              Il browser ha fermato l&apos;audio della call.
            </StatusBanner>
          )}
          {live && (
            <StageArea
              joinCode={joinCode}
              session={session}
              cameraOn={local?.camOn ?? false}
              role={role}
              showSamples={showSamples}
              stage={stageApi.stage}
              ready={stageApi.ready}
              assetUrls={stageApi.assetUrls}
              dispatch={stageApi.dispatch}
              addImage={stageApi.addImage}
            />
          )}
        </section>

        {live && spotlightEntry && (
          <SpotlightView
            entry={spotlightEntry}
            local={local}
            mirrorSelf={local ? isMirrored(local, state.cameraFacing) : false}
            attachVideo={attachVideo}
            onClose={closeSpotlight}
          />
        )}
      </div>

      {live && (
        <PipVideo
          identity={pipIdentity}
          name={pipEntry?.name ?? ''}
          camOn={pipEntry?.camOn ?? false}
          attachVideo={attachVideo}
          videoRef={pipRef}
        />
      )}

      {live ? (
        <nav
          aria-label="Controlli della chiamata"
          className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 [grid-area:dock] phone-landscape:py-1"
        >
          {role === 'host' && timer && <RoomTimerPill timer={timer} />}
          <Button onClick={toggleMic} aria-pressed={!local?.micOn}>
            {micButtonLabel(local?.micOn ?? false)}
          </Button>
          <Button onClick={toggleCamera} aria-pressed={!local?.camOn}>
            {cameraButtonLabel(local?.camOn ?? false)}
          </Button>
          {state.canSwitchCamera && <Button onClick={switchCamera}>Gira fotocamera</Button>}
          {pipSupported && pipIdentity && (
            <Button
              onClick={() => {
                if (pipRef.current) void openPip(document, pipRef.current).catch(() => {});
              }}
            >
              Riquadro
            </Button>
          )}
          <Button variant="exit" onClick={handleLeave}>
            Esci
          </Button>
        </nav>
      ) : (
        <div className="[grid-area:dock]" />
      )}
    </>
  );
}
