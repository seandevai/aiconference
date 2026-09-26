import 'server-only';

export const DEEPGRAM_MODEL = 'nova-3';
// Basta per aprire il WebSocket: una connessione aperta resta viva dopo la scadenza.
export const STT_TOKEN_TTL_SECONDS = 30;

// Porta solo lo stato HTTP: il corpo dell'errore del vendor non serve e non va loggato.
export class SttGrantError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`stt grant failed: ${status}`);
    this.name = 'SttGrantError';
    this.status = status;
  }
}

export async function grantDeepgramToken(options: {
  apiKey: string;
  fetch?: typeof fetch;
  ttlSeconds?: number;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const send = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await send('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: options.ttlSeconds ?? STT_TOKEN_TTL_SECONDS }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new SttGrantError(0);
  }
  if (!response.ok) throw new SttGrantError(response.status);
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
  } | null;
  if (typeof body?.access_token !== 'string' || typeof body.expires_in !== 'number') {
    throw new SttGrantError(502);
  }
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}
