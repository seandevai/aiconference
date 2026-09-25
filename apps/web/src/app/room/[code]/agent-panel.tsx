'use client';

import { useState } from 'react';
import type { StageCommand } from '@omnicanvas/canvas';
import { toStageContent } from '@/lib/stage/agent-messages';
import { useAgent } from '@/lib/stage/use-agent';

// Finché non arriva lo STT (slice 4B) la richiesta si scrive: è anche la via per chi
// non ha microfono. Il risultato va nel vassoio, come per ogni contenuto dell'agente.
export function AgentPanel({
  joinCode,
  dispatch,
}: {
  joinCode: string;
  dispatch: (command: StageCommand) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const agent = useAgent({
    joinCode,
    onContent: (content) => {
      dispatch({ type: 'TRAY_ADD', content: toStageContent(content, crypto.randomUUID()) });
      setPrompt('');
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-800 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded bg-emerald-500 px-2 py-1 font-medium text-neutral-950"
        >
          ✨ Chiedi all&apos;agente
        </button>
        {agent.usage && (
          <span className="text-neutral-400">
            Crediti: {agent.usage.balance} · agente in questa stanza: {agent.usage.roomCredits}
          </span>
        )}
      </div>
      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (prompt.trim()) void agent.ask(prompt);
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label className="flex flex-1 flex-col gap-1">
            Cosa ti serve?
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={500}
              placeholder="Es. un grafico delle vendite per trimestre"
              className="rounded bg-neutral-900 px-2 py-1"
            />
          </label>
          <button
            type="submit"
            disabled={agent.busy || !prompt.trim()}
            className="self-end rounded bg-neutral-100 px-3 py-1 text-neutral-900 disabled:opacity-40"
          >
            Invia
          </button>
        </form>
      )}
      {agent.busy && <p className="text-neutral-300">L&apos;agente sta lavorando…</p>}
      {agent.error && <p className="text-amber-300">{agent.error}</p>}
    </div>
  );
}
