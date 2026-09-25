import 'server-only';
import { createAnthropicAdapter, createFakeAdapter, type GenerateAdapter } from '@omnicanvas/ai';
import { serverEnv } from '@/env';

let cached: GenerateAdapter | null | undefined;

export function agentAdapter(): GenerateAdapter | null {
  if (cached !== undefined) return cached;
  const env = serverEnv();
  cached =
    env.AI_PROVIDER === 'fake'
      ? createFakeAdapter()
      : env.ANTHROPIC_API_KEY
        ? createAnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY })
        : null;
  return cached;
}
