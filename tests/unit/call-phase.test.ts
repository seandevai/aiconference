import { describe, expect, it } from 'vitest';
import {
  MEDIA_ERROR_MESSAGE,
  phaseAfterDisconnect,
  phaseFromStatus,
  phaseMessage,
  isTokenRefusal,
  tokenErrorPhase,
  type CallPhase,
} from '@/lib/call/phase';

describe('call phase', () => {
  it('follows the live connection status', () => {
    expect(phaseFromStatus('connecting')).toBe('connecting');
    expect(phaseFromStatus('connected')).toBe('connected');
    expect(phaseFromStatus('reconnecting')).toBe('reconnecting');
    // La fine della sessione la decide l'evento di disconnessione, che ne conosce la causa.
    expect(phaseFromStatus('disconnected')).toBeNull();
  });

  it('maps each disconnect cause', () => {
    expect(phaseAfterDisconnect('client')).toBe('left');
    expect(phaseAfterDisconnect('replaced')).toBe('replaced');
    expect(phaseAfterDisconnect('removed')).toBe('removed');
    expect(phaseAfterDisconnect('room_closed')).toBe('ended');
    expect(phaseAfterDisconnect('network')).toBe('reconnecting');
  });

  it('treats a closed room as ended and any other refusal as forbidden', () => {
    expect(tokenErrorPhase(410)).toBe('ended');
    expect(tokenErrorPhase(403)).toBe('forbidden');
    expect(tokenErrorPhase(404)).toBe('forbidden');
  });

  it('says what happened and what to do, except when all is well', () => {
    const phases: CallPhase[] = [
      'connecting',
      'reconnecting',
      'failed',
      'replaced',
      'removed',
      'ended',
      'forbidden',
      'left',
    ];
    for (const phase of phases) expect(phaseMessage(phase)).toMatch(/\S/);
    expect(phaseMessage('connected')).toBeNull();
    expect(phaseMessage('ended')).toBe('Questa riunione è terminata.');
    expect(phaseMessage('reconnecting')).toBe('Connessione persa, riprovo…');
    expect(MEDIA_ERROR_MESSAGE).toMatch(/permessi/);
  });
});

describe('isTokenRefusal', () => {
  it('treats a client error as a refusal: retrying would not help', () => {
    expect(isTokenRefusal(403)).toBe(true);
    expect(isTokenRefusal(410)).toBe(true);
  });
  it('treats too many requests as temporary: the reconnector waits and retries', () => {
    expect(isTokenRefusal(429)).toBe(false);
  });
  it('treats server errors as temporary', () => {
    expect(isTokenRefusal(503)).toBe(false);
  });
});
