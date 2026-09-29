import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { LIMITS } from '@omnicanvas/canvas';
import { agentOutputSchema, toAgentContent } from './agent-schema';
import { creditsFor, estimateCostUsd } from './pricing';
import { ProviderError, type GenerateAdapter, type ProviderUsage } from './types';

export const AGENT_MODEL = 'claude-opus-5';
const MAX_TOKENS = 4_000;

// Istruzioni fisse: niente dati variabili qui, così il prefisso resta identico fra le richieste.
const SYSTEM_PROMPT = `Sei l'agente di OmniCanvas, dentro una riunione fra un consulente e il suo cliente.
Il consulente ti chiede un contenuto da mostrare sul palco condiviso. Produci un solo contenuto:
- "chart" per numeri da confrontare (etichette e valori della stessa lunghezza, al massimo ${LIMITS.labels});
- "table" per righe e colonne (al massimo ${LIMITS.columns} colonne e ${LIMITS.rows} righe);
- "text" per tutto il resto (al massimo ${LIMITS.body} caratteri, frasi brevi).
Titolo breve (al massimo ${LIMITS.title} caratteri). Scrivi nella lingua della richiesta.
Se mancano i dati, usa valori plausibili ed esplicitalo nel titolo con "(esempio)".`;

function mapApiError(error: unknown): ProviderError {
  if (error instanceof Anthropic.RateLimitError) return new ProviderError('rate_limited');
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('timeout');
  if (error instanceof Anthropic.APIConnectionError) return new ProviderError('network');
  return new ProviderError('provider_error');
}

export function createAnthropicAdapter(options: {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): GenerateAdapter {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: options.timeoutMs ?? 45_000,
    maxRetries: 1,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

  return {
    provider: 'anthropic',
    model: AGENT_MODEL,
    // Caso peggiore: circa 2.000 token di input e tutti i MAX_TOKENS di output.
    reserveCredits: creditsFor(estimateCostUsd(AGENT_MODEL, 2_000, MAX_TOKENS)),
    async generate(prompt) {
      let response;
      try {
        // create e non parse: un output troncato deve arrivare come max_tokens con i token
        // spesi, non come eccezione del parser.
        response = await client.beta.messages.create({
          model: AGENT_MODEL,
          max_tokens: MAX_TOKENS,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(agentOutputSchema) },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        });
      } catch (error) {
        throw mapApiError(error);
      }

      const usage: ProviderUsage = {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      if (response.stop_reason === 'refusal') throw new ProviderError('refusal', usage);
      if (response.stop_reason === 'max_tokens') throw new ProviderError('max_tokens', usage);

      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new ProviderError('invalid_output', usage);
      }
      const parsed = agentOutputSchema.safeParse(json);
      if (!parsed.success) throw new ProviderError('invalid_output', usage);
      return { content: toAgentContent(parsed.data, usage), ...usage };
    },
  };
}
