import { describe, expect, it } from 'vitest';
import {
  AGENT_MODEL,
  ProviderError,
  createAnthropicAdapter,
  createFakeAdapter,
} from '@omnicanvas/ai';

type Captured = { url: string; body: Record<string, unknown>; headers: Headers };

function fakeFetch(status: number, payload: unknown, captured: Captured[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      headers: new Headers(init?.headers),
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'request-id': 'req_test' },
    });
  }) as typeof fetch;
}

function message(text: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: AGENT_MODEL,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 900, output_tokens: 300 },
    ...overrides,
  };
}

const chart = {
  content: { kind: 'chart', title: 'Vendite', labels: ['T1', 'T2'], values: [10, 20] },
};

describe('anthropic adapter', () => {
  it('asks claude-opus-5 for structured output with server-side fallbacks', async () => {
    const captured: Captured[] = [];
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(200, message(JSON.stringify(chart)), captured),
    });
    const result = await adapter.generate('grafico vendite per trimestre');
    expect(result).toEqual({
      content: { kind: 'chart', title: 'Vendite', labels: ['T1', 'T2'], values: [10, 20] },
      model: AGENT_MODEL,
      inputTokens: 900,
      outputTokens: 300,
    });
    const body = captured[0]!.body;
    expect(body.model).toBe('claude-opus-5');
    expect(body.fallbacks).toBe('default');
    expect(captured[0]!.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect((body.output_config as { format?: { type?: string } }).format?.type).toBe('json_schema');
  });

  it('reports a refusal before reading the content', async () => {
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(
        200,
        message('', {
          stop_reason: 'refusal',
          content: [],
          stop_details: { type: 'refusal', category: null, explanation: null },
        }),
      ),
    });
    await expect(adapter.generate('…')).rejects.toMatchObject({ code: 'refusal' });
  });

  it('reports truncated output as max_tokens, with the tokens spent', async () => {
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(200, message('{"content":{"kind":"te', { stop_reason: 'max_tokens' })),
    });
    const error = await adapter.generate('…').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({
      code: 'max_tokens',
      usage: { inputTokens: 900, outputTokens: 300 },
    });
  });

  it('rejects output beyond the stage limits as invalid_output, with the tokens spent', async () => {
    const huge = { content: { kind: 'text', title: 'Lungo', body: 'x'.repeat(5000) } };
    const adapter = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(200, message(JSON.stringify(huge))),
    });
    await expect(adapter.generate('…')).rejects.toMatchObject({
      code: 'invalid_output',
      usage: { outputTokens: 300 },
    });
  });

  it('maps rate limits and server errors to codes without the provider message', async () => {
    const limited = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(429, {
        type: 'error',
        error: { type: 'rate_limit_error', message: 'slow down' },
      }),
    });
    await expect(limited.generate('…')).rejects.toMatchObject({ code: 'rate_limited' });
    const broken = createAnthropicAdapter({
      apiKey: 'sk-test',
      fetch: fakeFetch(500, { type: 'error', error: { type: 'api_error', message: 'boom' } }),
    });
    const error = await broken.generate('…').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'provider_error' });
    expect((error as Error).message).not.toContain('boom');
  });
});

describe('fake adapter', () => {
  it('returns a deterministic chart when asked for one, text otherwise, at no cost', async () => {
    const fake = createFakeAdapter();
    expect(fake.provider).toBe('fake');
    expect((await fake.generate('Fammi un grafico delle vendite')).content.kind).toBe('chart');
    const text = await fake.generate('Riassumi la proposta');
    expect(text.content).toEqual({
      kind: 'text',
      title: 'Riassumi la proposta',
      body: expect.any(String),
    });
    expect(text.model).toBe('fake-1');
  });
});
