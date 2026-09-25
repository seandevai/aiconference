import type { AgentContent } from '@omnicanvas/ai';
import type { Content } from '@omnicanvas/canvas';

export function agentErrorMessage(status: number, code?: string): string {
  if (status === 402) return 'Crediti esauriti: chiedi una ricarica per usare ancora l’agente.';
  if (status === 429) return 'Troppe richieste in poco tempo: aspetta un minuto e riprova.';
  if (status === 503) return 'L’agente non è configurato su questo ambiente.';
  if (status === 400) return 'Scrivi una richiesta di al massimo 500 caratteri.';
  if (status === 403) return 'Solo l’host può chiamare l’agente.';
  if (status === 502 && code === 'refusal')
    return 'L’agente non può rispondere a questa richiesta: riformulala.';
  if (status === 502) return 'L’agente non è riuscito a rispondere: riprova tra poco.';
  return 'Problema di rete: controlla la connessione e riprova.';
}

export function toStageContent(content: AgentContent, id: string): Content {
  const { kind, ...data } = content;
  return { id, kind, data } as Content;
}
