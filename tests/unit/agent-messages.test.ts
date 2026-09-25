import { describe, expect, it } from 'vitest';
import { agentErrorMessage, toStageContent } from '@/lib/stage/agent-messages';

describe('agent messages', () => {
  it('explains each refusal with what to do', () => {
    expect(agentErrorMessage(402)).toBe(
      'Crediti esauriti: chiedi una ricarica per usare ancora l’agente.',
    );
    expect(agentErrorMessage(429)).toMatch(/Troppe richieste/);
    expect(agentErrorMessage(503)).toMatch(/non è configurato/);
    expect(agentErrorMessage(502, 'refusal')).toMatch(/non può rispondere/);
    expect(agentErrorMessage(502, 'invalid_output')).toMatch(/riprova/i);
    expect(agentErrorMessage(400)).toMatch(/500 caratteri/);
    expect(agentErrorMessage(0)).toMatch(/rete/);
  });

  it('turns agent output into stage content with the given id', () => {
    expect(toStageContent({ kind: 'text', title: 'T', body: 'B' }, 'id-1')).toEqual({
      id: 'id-1',
      kind: 'text',
      data: { title: 'T', body: 'B' },
    });
    expect(
      toStageContent({ kind: 'chart', title: 'C', labels: ['a'], values: [1] }, 'id-2'),
    ).toEqual({
      id: 'id-2',
      kind: 'chart',
      data: { title: 'C', labels: ['a'], values: [1] },
    });
  });
});
