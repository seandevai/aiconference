import type { DeepgramEvent } from './deepgram';

// Senza parole entro silenceMs la sessione si chiude; mai oltre maxMs (costo fisso, 4B.1).
export const COMMAND_LIMITS = { silenceMs: 7_000, maxMs: 30_000 } as const;

export type CommandState = {
  startedAt: number;
  finals: string[];
  interim: string;
  ended: boolean;
};

export function startCommand(now: number): CommandState {
  return { startedAt: now, finals: [], interim: '', ended: false };
}

export function onDeepgramEvent(state: CommandState, event: DeepgramEvent): CommandState {
  if (event.type === 'utterance_end') {
    return { ...state, ended: state.ended || state.finals.length > 0 };
  }
  const text = event.text.trim();
  if (!event.isFinal) return { ...state, interim: text };
  const finals = text ? [...state.finals, text] : state.finals;
  return {
    ...state,
    finals,
    interim: '',
    ended: state.ended || (event.speechFinal && finals.length > 0),
  };
}

export function commandStop(
  state: CommandState,
  now: number,
  limits: { silenceMs: number; maxMs: number } = COMMAND_LIMITS,
): 'speech_end' | 'silence' | 'max' | null {
  if (state.ended) return 'speech_end';
  const elapsed = now - state.startedAt;
  if (elapsed >= limits.maxMs) return 'max';
  const heardAnything = state.finals.length > 0 || state.interim.length > 0;
  if (!heardAnything && elapsed >= limits.silenceMs) return 'silence';
  return null;
}

export function commandText(state: CommandState): string {
  return [...state.finals, state.interim].filter(Boolean).join(' ').trim();
}
