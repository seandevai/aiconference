import { describe, expect, it } from 'vitest';
import {
  ScreenShareCancelled,
  isShareCancel,
  isScreenShareOver,
  supportsScreenShare,
} from '@omnicanvas/realtime';

describe('screen share helpers', () => {
  it('needs getDisplayMedia', () => {
    expect(supportsScreenShare({ mediaDevices: { getDisplayMedia: () => {} } })).toBe(true);
    expect(supportsScreenShare({ mediaDevices: {} })).toBe(false);
    expect(supportsScreenShare(undefined)).toBe(false);
  });

  it('tells a cancelled picker from a system refusal', () => {
    expect(isShareCancel(new DOMException('Permission denied', 'NotAllowedError'))).toBe(true);
    expect(isShareCancel(new DOMException('Permission denied by system', 'NotAllowedError'))).toBe(
      false,
    );
    expect(isShareCancel(new DOMException('Could not start', 'NotReadableError'))).toBe(false);
    expect(isShareCancel('boom')).toBe(false);
  });

  it('treats an unpublish as the end only when the capture is no longer live', () => {
    // Riconnessione: LiveKit toglie e ripubblica la traccia senza fermarla.
    expect(isScreenShareOver({ readyState: 'live' })).toBe(false);
    // Stop dalla UI o dal browser: la traccia è già ferma quando arriva l'evento.
    expect(isScreenShareOver({ readyState: 'ended' })).toBe(true);
    expect(isScreenShareOver({})).toBe(true);
    expect(isScreenShareOver(undefined)).toBe(true);
  });

  it('names the cancellation', () => {
    expect(new ScreenShareCancelled().name).toBe('ScreenShareCancelled');
  });
});
