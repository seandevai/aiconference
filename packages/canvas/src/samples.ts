import type { Content } from './types';

// Contenuti di prova per usare il palco prima che esista l'agente (slice 4).
export function sampleContent(kind: 'chart' | 'text' | 'table', id: string): Content {
  switch (kind) {
    case 'chart':
      return {
        id,
        kind,
        data: {
          title: 'Vendite per trimestre',
          labels: ['T1', 'T2', 'T3', 'T4'],
          values: [120, 150, 90, 180],
        },
      };
    case 'text':
      return {
        id,
        kind,
        data: {
          title: 'Proposta Acme',
          body: 'Tre fasi: analisi, prototipo, rilascio. Primo rilascio entro otto settimane.',
        },
      };
    case 'table':
      return {
        id,
        kind,
        data: {
          title: 'Piano di lavoro',
          columns: ['Fase', 'Settimane'],
          rows: [
            ['Analisi', '2'],
            ['Prototipo', '4'],
            ['Rilascio', '2'],
          ],
        },
      };
  }
}
