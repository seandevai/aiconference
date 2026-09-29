import { contentSchema } from '@omnicanvas/canvas';
import { z } from 'zod';
import { ProviderError, type AgentContent, type ProviderUsage } from './types';

// Forma chiesta al modello. I limiti di lunghezza non stanno qui (lo structured output
// non li garantisce): li applica toAgentContent con lo schema del palco.
export const agentOutputSchema = z.object({
  content: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('chart'),
      title: z.string(),
      labels: z.array(z.string()),
      values: z.array(z.number()),
    }),
    z.object({ kind: z.literal('text'), title: z.string(), body: z.string() }),
    z.object({
      kind: z.literal('table'),
      title: z.string(),
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    }),
  ]),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

const PROBE_ID = '00000000-0000-4000-8000-000000000000';

export function toAgentContent(output: AgentOutput, usage: ProviderUsage): AgentContent {
  const { kind, ...data } = output.content;
  const checked = contentSchema.safeParse({ id: PROBE_ID, kind, data });
  if (!checked.success) throw new ProviderError('invalid_output', usage);
  return output.content;
}
