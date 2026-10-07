import type { LabError } from '@/lib/gesture-lab/lab-store';
import type { LiveStatus } from '@/lib/gesture-lab/use-gesture-lab';

export const LAB_MESSAGES: Record<LabError, string> = {
  not_allowed: 'Non hai i permessi del laboratorio, o la sessione è scaduta. Ricarica la pagina.',
  invalid: 'Dati non validi: controlla nome e descrizione, e che la registrazione non sia vuota.',
  not_found: 'Non più disponibile: forse è stata eliminata.',
  failed: 'Non sono riuscito a salvare. Riprova, oppure scarica il JSON.',
};

// Errore imprevisto (azione lanciata o rete caduta): non è detto che si stesse salvando.
export const UNEXPECTED_MESSAGE = 'Operazione non riuscita. Riprova.';

// Stato della fotocamera e del riconoscimento, detto a chi usa la pagina.
export const LIVE_MESSAGES: Record<LiveStatus, string | null> = {
  off: null,
  loading: 'Avvio della fotocamera e del riconoscimento…',
  on: null,
  no_camera:
    'Fotocamera non disponibile: consenti la fotocamera nel browser. Il rigioco funziona lo stesso.',
  unavailable:
    'Riconoscimento delle mani non disponibile su questo dispositivo. Il rigioco funziona lo stesso.',
};
