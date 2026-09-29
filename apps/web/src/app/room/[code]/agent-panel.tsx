'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@omnicanvas/ui';
import type { StageCommand } from '@omnicanvas/canvas';
import { toStageContent } from '@/lib/stage/agent-messages';
import { useAgent } from '@/lib/stage/use-agent';

// Finché non arriva lo STT (slice 4B) la richiesta si scrive: è anche la via per chi
// non ha microfono. Il risultato va nel vassoio, come per ogni contenuto dell'agente.
export function AgentPanel({
  joinCode,
  dispatch,
  focusRequest,
}: {
  joinCode: string;
  dispatch: (command: StageCommand) => void;
  // Cresce a ogni richiesta di attenzione (pulsante o gesto «indice alzato»).
  focusRequest: number;
}) {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const agent = useAgent({
    joinCode,
    onContent: (content) => {
      dispatch({ type: 'TRAY_ADD', content: toStageContent(content, crypto.randomUUID()) });
      setPrompt('');
    },
  });

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest]);

  return (
    <div className="flex flex-col gap-2">
      <Button variant="accent" size="sm" onClick={() => inputRef.current?.focus()}>
        <span aria-hidden>✦</span> Chiedi all&apos;agente
      </Button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim()) void agent.ask(prompt);
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          Cosa ti serve?
          <input
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={500}
            placeholder="Es. un grafico delle vendite per trimestre"
            className="rounded-tile border border-line bg-stage px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <Button type="submit" size="sm" disabled={agent.busy || !prompt.trim()}>
          Invia
        </Button>
      </form>
      {agent.busy && (
        // Niente role="status": quello è della connessione (un solo status per pagina).
        <div className="flex flex-col gap-1 text-xs text-accent">
          <span>L&apos;agente sta lavorando…</span>
          <span aria-hidden className="h-1 overflow-hidden rounded-full bg-raised">
            <span className="block h-full w-1/2 rounded-full bg-accent motion-safe:animate-pulse" />
          </span>
        </div>
      )}
      {agent.error && <p className="text-xs text-danger">{agent.error}</p>}
      {agent.usage && (
        <p className="tabular text-xs text-muted">
          Crediti: {agent.usage.balance} · agente in questa stanza: {agent.usage.roomCredits}
        </p>
      )}
    </div>
  );
}
