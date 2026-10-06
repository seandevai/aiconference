import type { LabError } from '@/lib/gesture-lab/lab-store';

export const LAB_MESSAGES: Record<LabError, string> = {
  not_allowed: 'Non hai i permessi del laboratorio, o la sessione è scaduta. Ricarica la pagina.',
  invalid: 'Dati non validi: controlla nome e descrizione, e che la registrazione non sia vuota.',
  not_found: 'Non più disponibile: forse è stata eliminata.',
  failed: 'Non sono riuscito a salvare. Riprova, oppure scarica il JSON.',
};
