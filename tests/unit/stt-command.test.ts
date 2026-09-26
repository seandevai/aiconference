import { describe, expect, it } from 'vitest';
import {
  COMMAND_LIMITS,
  commandStop,
  commandText,
  onDeepgramEvent,
  startCommand,
  type DeepgramEvent,
} from '@omnicanvas/stt';

const t = (text: string, isFinal: boolean, speechFinal = false): DeepgramEvent => ({
  type: 'transcript',
  text,
  isFinal,
  speechFinal,
});

describe('voice command', () => {
  it('ends when Deepgram marks the end of speech after some words', () => {
    let s = startCommand(0);
    s = onDeepgramEvent(s, t('fammi un', false));
    expect(commandStop(s, 1_000)).toBeNull();
    s = onDeepgramEvent(s, t('fammi un grafico', true));
    s = onDeepgramEvent(s, t('delle vendite', true, true));
    expect(commandStop(s, 2_000)).toBe('speech_end');
    expect(commandText(s)).toBe('fammi un grafico delle vendite');
  });

  it('also ends on UtteranceEnd, which arrives when endpointing misses', () => {
    let s = onDeepgramEvent(startCommand(0), t('riassumi', true));
    s = onDeepgramEvent(s, { type: 'utterance_end' });
    expect(commandStop(s, 3_000)).toBe('speech_end');
  });

  it('does not end on an utterance end before any word', () => {
    const s = onDeepgramEvent(startCommand(0), { type: 'utterance_end' });
    expect(commandStop(s, 1_000)).toBeNull();
  });

  it('gives up after the silence limit when nothing was said', () => {
    const s = startCommand(0);
    expect(commandStop(s, COMMAND_LIMITS.silenceMs - 1)).toBeNull();
    expect(commandStop(s, COMMAND_LIMITS.silenceMs)).toBe('silence');
    expect(commandText(s)).toBe('');
  });

  it('keeps listening past the silence limit once the host started talking', () => {
    const s = onDeepgramEvent(startCommand(0), t('allora', false));
    expect(commandStop(s, COMMAND_LIMITS.silenceMs + 1)).toBeNull();
  });

  it('cuts at the maximum length and keeps what was heard, interim included', () => {
    let s = onDeepgramEvent(startCommand(0), t('una tabella con', true));
    s = onDeepgramEvent(s, t('i costi', false));
    expect(commandStop(s, COMMAND_LIMITS.maxMs)).toBe('max');
    expect(commandText(s)).toBe('una tabella con i costi');
  });
});
