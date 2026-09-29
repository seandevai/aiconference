'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentContent } from '@omnicanvas/ai';
import { agentErrorMessage } from './agent-messages';

type Usage = { balance: number; roomCredits: number };

export function useAgent({
  joinCode,
  onContent,
}: {
  joinCode: string;
  onContent: (content: AgentContent) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const refreshUsage = useCallback(async () => {
    const response = await fetch(`/room/${joinCode}/agent`, { cache: 'no-store' }).catch(
      () => null,
    );
    if (response?.ok) setUsage((await response.json()) as Usage);
  }, [joinCode]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/room/${joinCode}/agent`, { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<Usage>) : null))
      .catch(() => null)
      .then((initial) => {
        if (!cancelled && initial) setUsage(initial);
      });
    return () => {
      cancelled = true;
    };
  }, [joinCode]);

  const ask = useCallback(
    async (prompt: string) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/room/${joinCode}/agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          content?: AgentContent;
          code?: string;
        };
        if (response.ok && body.content) onContent(body.content);
        else setError(agentErrorMessage(response.status, body.code));
      } catch {
        setError(agentErrorMessage(0));
      } finally {
        setBusy(false);
        void refreshUsage();
      }
    },
    [joinCode, onContent, refreshUsage],
  );

  return { busy, error, usage, ask };
}
