// Unico file del browser che nomina Deepgram (ADR-0011).
export function deepgramUrl(options: { model: string; language: string }): string {
  const params = new URLSearchParams({
    model: options.model,
    language: options.language,
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    interim_results: 'true',
    smart_format: 'true',
    endpointing: '500',
    // Richiede interim_results: segnala la fine della frase anche col rumore di fondo.
    utterance_end_ms: '1500',
  });
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

export type DeepgramEvent =
  | { type: 'transcript'; text: string; isFinal: boolean; speechFinal: boolean }
  | { type: 'utterance_end' };

export function parseDeepgramMessage(raw: string): DeepgramEvent | null {
  let message: {
    type?: unknown;
    is_final?: unknown;
    speech_final?: unknown;
    channel?: { alternatives?: { transcript?: unknown }[] };
  };
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (message.type === 'UtteranceEnd') return { type: 'utterance_end' };
  if (message.type !== 'Results') return null;
  const text = message.channel?.alternatives?.[0]?.transcript;
  if (typeof text !== 'string') return null;
  return {
    type: 'transcript',
    text,
    isFinal: message.is_final === true,
    speechFinal: message.speech_final === true,
  };
}
