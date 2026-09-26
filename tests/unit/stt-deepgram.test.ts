import { describe, expect, it } from 'vitest';
import { deepgramUrl, parseDeepgramMessage } from '@omnicanvas/stt';

describe('deepgramUrl', () => {
  it('asks for raw 16 kHz PCM, interim results and endpointing', () => {
    const url = new URL(deepgramUrl({ model: 'nova-3', language: 'it' }));
    expect(url.origin + url.pathname).toBe('wss://api.deepgram.com/v1/listen');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      model: 'nova-3',
      language: 'it',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      interim_results: 'true',
      smart_format: 'true',
      endpointing: '500',
      utterance_end_ms: '1500',
    });
  });
});

describe('parseDeepgramMessage', () => {
  it('reads final and interim transcripts', () => {
    const raw = JSON.stringify({
      type: 'Results',
      is_final: true,
      speech_final: false,
      channel: { alternatives: [{ transcript: 'fammi un grafico' }] },
    });
    expect(parseDeepgramMessage(raw)).toEqual({
      type: 'transcript',
      text: 'fammi un grafico',
      isFinal: true,
      speechFinal: false,
    });
  });

  it('reads the end of an utterance', () => {
    expect(parseDeepgramMessage('{"type":"UtteranceEnd","last_word_end":2.1}')).toEqual({
      type: 'utterance_end',
    });
  });

  it('ignores metadata, unknown and broken messages', () => {
    expect(parseDeepgramMessage('{"type":"Metadata"}')).toBeNull();
    expect(parseDeepgramMessage('{"type":"Results"}')).toBeNull();
    expect(parseDeepgramMessage('not json')).toBeNull();
  });
});
