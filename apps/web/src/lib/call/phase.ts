import type { ConnectionStatus, DisconnectCause } from '@omnicanvas/realtime';

export type CallPhase =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'replaced'
  | 'removed'
  | 'ended'
  | 'forbidden'
  | 'left';

export const MEDIA_ERROR_MESSAGE =
  'Microfono o camera non disponibili: controlla i permessi del browser. Puoi comunque seguire la riunione.';

export function phaseFromStatus(status: ConnectionStatus): CallPhase | null {
  return status === 'disconnected' ? null : status;
}

export function phaseAfterDisconnect(cause: DisconnectCause): CallPhase {
  switch (cause) {
    case 'client':
      return 'left';
    case 'replaced':
      return 'replaced';
    case 'removed':
      return 'removed';
    case 'room_closed':
      return 'ended';
    case 'network':
      return 'reconnecting';
  }
}

// 429 e 5xx sono passeggeri: il riconnettore aspetta e riprova. Gli altri 4xx no.
export function isTokenRefusal(httpStatus: number): boolean {
  return httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429;
}

export function tokenErrorPhase(httpStatus: number): CallPhase {
  return httpStatus === 410 ? 'ended' : 'forbidden';
}

const MESSAGES: Record<CallPhase, string | null> = {
  connecting: 'Connessione alla chiamata…',
  connected: null,
  reconnecting: 'Connessione persa, riprovo…',
  failed: 'Non riesco a ricollegarmi. Controlla la rete e riprova.',
  replaced: "Sei entrato da un'altra finestra: questa è stata scollegata.",
  removed: 'Sei stato rimosso dalla riunione.',
  ended: 'Questa riunione è terminata.',
  forbidden: 'Non risulti più in questa riunione. Ricarica la pagina per rientrare.',
  left: 'Sei uscito dalla riunione.',
};

export function phaseMessage(phase: CallPhase): string | null {
  return MESSAGES[phase];
}
