'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { applyCommand } from '@omnicanvas/canvas';
import {
  createPipeline,
  type Frame,
  type GestureEvent,
  type Hand,
  type Pipeline,
  type RecognizerView,
} from '@omnicanvas/gesture';
import type { GestureRunner } from '@omnicanvas/gesture/runner';
import { followPoint } from '@/lib/stage/cursor-motion';
import { createStageGestureHandler, type StageCursor } from '@/lib/stage/stage-gesture-handler';
import { appendEvent, type LogEntry } from './event-log';
import { labStage } from './lab-stage';
import { createReplayer, type Recording } from './recording';
import { effectiveTuning, loadLabSettings, saveLabSettings, type LabSettings } from './settings';

const CURSOR_HALF_LIFE_MS = 60;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export type LiveStatus = 'off' | 'loading' | 'on' | 'no_camera' | 'unavailable';

// I ref del video, dell'area del palco e dei frame li crea chi disegna (Lab): se li possedesse l'hook,
// ogni valore restituito sarebbe «contaminato» e il lint li vieterebbe nel render.
export type LabRefs = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  areaRef: React.RefObject<HTMLDivElement | null>;
  framesRef: React.RefObject<{ raw: Frame; processed: Frame } | null>;
};

export function useGestureLab({ videoRef, areaRef, framesRef }: LabRefs) {
  const [settings, setSettings] = useState<LabSettings>(() => loadLabSettings(safeStorage()));
  const [stage, dispatch] = useReducer(applyCommand, undefined, labStage);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [view, setView] = useState<RecognizerView | null>(null);
  const [hand, setHand] = useState<Hand | null>(null);
  const [armed, setArmed] = useState(false);
  const [target, setTarget] = useState<StageCursor | null>(null);
  const [smoothed, setSmoothed] = useState<StageCursor | null>(null);
  const [live, setLive] = useState<LiveStatus>('off');
  const [recording, setRecording] = useState<Recording | null>(null);
  const [playing, setPlaying] = useState(false);
  const [fired, setFired] = useState<string[]>([]);

  const runnerRef = useRef<GestureRunner | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const replayerRef = useRef<ReturnType<typeof createReplayer> | null>(null);
  const stageRef = useRef(stage);
  const startRef = useRef(0);
  const pipelineRef = useRef<Pipeline | null>(null);
  // Cambia a ogni stop, avvio del rigioco o smontaggio: gli avvii in corso lo controllano dopo ogni await.
  const generationRef = useRef(0);
  const handlerRef = useRef<((event: GestureEvent) => void) | null>(null);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Le impostazioni più recenti, per chi parte mentre la webcam sta ancora caricando.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    saveLabSettings(safeStorage(), settings);
  }, [settings]);

  // Si riconfigura solo se cambia la taratura effettiva o il dizionario: gli interruttori della sola
  // interfaccia (cursore fluido, feedback) non devono ricostruire il riconoscitore e perdere un trascinamento.
  const configKey = JSON.stringify({
    tuning: effectiveTuning(settings),
    dictionary: settings.dictionary,
  });
  useEffect(() => {
    const next = JSON.parse(configKey) as Parameters<GestureRunner['reconfigure']>[0];
    runnerRef.current?.reconfigure(next);
    pipelineRef.current?.reconfigure(next);
  }, [configKey]);

  // Il gestore si costruisce in un effetto: legge i ref solo quando un evento arriva, mai durante il render.
  useEffect(() => {
    handlerRef.current = createStageGestureHandler({
      toScreen: (x, y) => {
        const box = areaRef.current?.getBoundingClientRect();
        return box ? { x: box.left + x * box.width, y: box.top + y * box.height } : null;
      },
      getStage: () => stageRef.current,
      dispatch,
      onAgent: () =>
        setLog((current) =>
          appendEvent(current, { type: 'AGENT_ACTIVATE' }, performance.now() - startRef.current),
        ),
      onArmed: setArmed,
      onCursor: (cursor) => {
        setTarget(cursor);
        // Dopo un rilascio il cursore fluido riparte dal prossimo bersaglio, non dal vecchio punto.
        if (!cursor) setSmoothed(null);
      },
    });
    return () => {
      handlerRef.current = null;
    };
  }, [areaRef]);

  const onEvent = useCallback((event: GestureEvent) => {
    // AGENT_ACTIVATE lo scrive onAgent: qui si evita la riga doppia.
    if (event.type !== 'AGENT_ACTIVATE')
      setLog((current) => appendEvent(current, event, performance.now() - startRef.current));
    if (event.type !== 'GRAB' && event.type !== 'MOVE' && event.type !== 'DROP')
      setFired((current) => [...current, event.type]);
    handlerRef.current?.(event);
  }, []);

  // Cursore fluido: insegue il bersaglio a 60fps. Lo stato cambia solo dentro il frame di animazione.
  useEffect(() => {
    if (!settings.toggles.smoothCursor || !target) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      setSmoothed((current) =>
        current
          ? {
              ...followPoint(current, target, now - last, CURSOR_HALF_LIFE_MS),
              grabbing: target.grabbing,
            }
          : target,
      );
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [target, settings.toggles.smoothCursor]);

  // Senza inseguimento il cursore salta come nella call: si ricava dal bersaglio durante il render.
  const cursor = settings.toggles.smoothCursor && target ? (smoothed ?? target) : target;

  const stopLive = useCallback(() => {
    generationRef.current += 1;
    runnerRef.current?.stop();
    runnerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    framesRef.current = null;
    setHand(null);
    setLive('off');
  }, [framesRef]);

  const startLive = useCallback(async () => {
    replayerRef.current?.pause();
    setPlaying(false);
    const video = videoRef.current;
    if (!video) return;
    const generation = ++generationRef.current;
    const cancelled = () => generationRef.current !== generation;
    const releaseStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      video.srcObject = null;
    };
    setLive('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      if (cancelled()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
    } catch {
      if (cancelled()) return;
      releaseStream();
      setLive('no_camera');
      return;
    }
    if (cancelled()) {
      releaseStream();
      return;
    }
    let runner: GestureRunner;
    try {
      const { startGestures } = await import('@omnicanvas/gesture/runner');
      if (cancelled()) {
        releaseStream();
        return;
      }
      startRef.current = performance.now();
      runner = await startGestures(video, {
        armed: true,
        tuning: effectiveTuning(settings),
        dictionary: settings.dictionary,
        onEvent,
        onFrame: (raw, processed, nextView) => {
          framesRef.current = { raw, processed };
          setView(nextView);
          setHand(processed.hands[0] ?? null);
        },
      });
    } catch {
      if (cancelled()) return;
      releaseStream();
      setLive('unavailable');
      return;
    }
    if (cancelled()) {
      runner.stop();
      releaseStream();
      return;
    }
    runnerRef.current = runner;
    // Le impostazioni cambiate durante il caricamento non erano ancora arrivate al riconoscitore.
    const latest = settingsRef.current;
    runner.reconfigure({ tuning: effectiveTuning(latest), dictionary: latest.dictionary });
    setArmed(true);
    setLive('on');
  }, [onEvent, settings, videoRef, framesRef]);

  const loadRecording = useCallback((next: Recording) => {
    replayerRef.current?.pause();
    replayerRef.current = null;
    pipelineRef.current = null;
    setPlaying(false);
    setRecording(next);
    setFired([]);
  }, []);

  const play = useCallback(() => {
    if (!recording) return;
    stopLive();
    // Un replayer esiste solo dopo «Pausa»: si riprende dal fotogramma successivo.
    if (!replayerRef.current) {
      const pipeline: Pipeline = createPipeline({
        tuning: effectiveTuning(settings),
        dictionary: settings.dictionary,
        armed: recording.armed,
      });
      pipelineRef.current = pipeline;
      setFired([]);
      startRef.current = performance.now();
      replayerRef.current = createReplayer(
        recording.frames,
        (frame) => {
          const out = pipeline.push(frame);
          framesRef.current = { raw: frame, processed: out.frame };
          setView(out.view);
          setHand(out.frame.hands[0] ?? null);
          out.events.forEach(onEvent);
        },
        () => {
          replayerRef.current = null;
          pipelineRef.current = null;
          setPlaying(false);
        },
      );
    }
    replayerRef.current.play();
    setPlaying(true);
  }, [recording, settings, onEvent, stopLive, framesRef]);

  const pause = useCallback(() => {
    replayerRef.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(
    () => () => {
      generationRef.current += 1;
      replayerRef.current?.pause();
      runnerRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return {
    settings,
    setSettings,
    stage,
    dispatch,
    log,
    view,
    hand,
    armed,
    cursor,
    live,
    startLive,
    stopLive,
    recording,
    loadRecording,
    playing,
    play,
    pause,
    fired,
  };
}
