'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeSession, RosterEntry } from '@omnicanvas/realtime';
import {
  extendOptions,
  parseTimerMessage,
  remainingSeconds,
  timerPhase,
  type ExtendMinutes,
  type TimerPhase,
} from '@/lib/rooms/timer';
import { isFromHost } from '@/lib/stage/peek';
import type { RoomTiming } from './use-call';

export type RoomTimerView = {
  endsAt: string;
  capAt: string;
  remainingSeconds: number;
  phase: TimerPhase;
  extendOptions: ExtendMinutes[];
};

type Args = { timing: RoomTiming | null; session: RealtimeSession | null; roster: RosterEntry[] };

const TICK_MS = 1_000;

export function useRoomTimer({ timing, session, roster }: Args) {
  // Il token porta i tempi; proroghe e messaggi dell'host li aggiornano. Un token nuovo
  // (riconnessione) riparte da sé: si confronta l'origine durante il render, senza effetti.
  const [latest, setLatest] = useState({ from: timing, value: timing });
  if (latest.from !== timing) setLatest({ from: timing, value: timing });
  const value = latest.from === timing ? latest.value : timing;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const applyTiming = useCallback((endsAt: string, capAt: string) => {
    setLatest((current) =>
      current.value ? { ...current, value: { ...current.value, endsAt, capAt } } : current,
    );
  }, []);

  const rosterRef = useRef(roster);
  useEffect(() => {
    rosterRef.current = roster;
  }, [roster]);

  useEffect(() => {
    if (!session) return;
    return session.onData('room-timer', (payload, from) => {
      // Solo l'host proroga: un messaggio da un ospite non sposta la scadenza di nessuno.
      if (!isFromHost(rosterRef.current, from)) return;
      const message = parseTimerMessage(payload);
      if (message) applyTiming(message.endsAt, message.capAt);
    });
  }, [session, applyTiming]);

  if (!value) return { timer: null, applyTiming };
  const remaining = remainingSeconds(value.endsAt, nowMs + value.offsetMs);
  const timer: RoomTimerView = {
    endsAt: value.endsAt,
    capAt: value.capAt,
    remainingSeconds: remaining,
    phase: timerPhase(remaining),
    extendOptions: extendOptions(value.endsAt, value.capAt),
  };
  return { timer, applyTiming };
}

// Chiama onEnd una volta quando il timer arriva a zero; di nuovo solo se una proroga lo
// ha fatto ripartire e torna a zero.
export function useTimerEnd(phase: TimerPhase | null, active: boolean, onEnd: () => void) {
  const firedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);
  useEffect(() => {
    if (phase !== 'over') {
      firedRef.current = false;
      return;
    }
    if (!active || firedRef.current) return;
    firedRef.current = true;
    onEndRef.current();
  }, [phase, active]);
}
