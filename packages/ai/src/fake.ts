import type { AgentContent, GenerateAdapter } from './types';

// Per sviluppo, CI ed e2e: nessuna rete, nessun costo, risposta deterministica.
export function createFakeAdapter(): GenerateAdapter {
  return {
    provider: 'fake',
    model: 'fake-1',
    reserveCredits: 1,
    async generate(prompt) {
      const title = prompt.trim().slice(0, 60) || 'Richiesta';
      const content: AgentContent = /grafic|chart/i.test(prompt)
        ? { kind: 'chart', title, labels: ['T1', 'T2', 'T3', 'T4'], values: [12, 18, 9, 21] }
        : { kind: 'text', title, body: 'Contenuto di prova generato senza modello.' };
      return { content, model: 'fake-1', inputTokens: prompt.length, outputTokens: 20 };
    },
  };
}
