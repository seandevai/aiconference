import 'server-only';
import { DEEPGRAM_MODEL, grantDeepgramToken } from '@omnicanvas/stt/server';
import { serverEnv } from '@/env';
import type { SttConfig } from './stt-token';

export function sttConfig(): SttConfig {
  const env = serverEnv();
  if (env.AI_PROVIDER === 'fake') return { provider: 'fake', model: 'fake-stt' };
  const apiKey = env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;
  return {
    provider: 'deepgram',
    model: DEEPGRAM_MODEL,
    grant: () => grantDeepgramToken({ apiKey }),
  };
}
