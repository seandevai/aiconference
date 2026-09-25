import { describe, expect, it } from 'vitest';
import {
  MAX_DATA_BYTES,
  PayloadTooLargeError,
  assertChannel,
  decodeData,
  encodeData,
} from '../../packages/realtime/src/data-codec';

describe('data codec', () => {
  it('round-trips JSON payloads', () => {
    const payload = { version: 3, command: { type: 'FOCUS', id: 'w1' }, text: 'è già così' };
    expect(decodeData(encodeData(payload))).toEqual(payload);
  });

  it('refuses payloads over the limit instead of truncating them', () => {
    const big = { blob: 'x'.repeat(MAX_DATA_BYTES) };
    expect(() => encodeData(big)).toThrow(PayloadTooLargeError);
    try {
      encodeData(big);
    } catch (error) {
      expect((error as PayloadTooLargeError).bytes).toBeGreaterThan(MAX_DATA_BYTES);
    }
  });

  it('refuses values that are not JSON', () => {
    expect(() => encodeData(undefined)).toThrow(/JSON/);
  });

  it('ignores malformed messages from a peer', () => {
    expect(decodeData(new TextEncoder().encode('{not json'))).toBeUndefined();
    expect(decodeData(new Uint8Array([0xff, 0xfe, 0x00]))).toBeUndefined();
  });

  it('keeps null as a valid payload', () => {
    expect(decodeData(encodeData(null))).toBeNull();
  });

  it('accepts only short lowercase channel names', () => {
    expect(() => assertChannel('stage')).not.toThrow();
    expect(() => assertChannel('subtitles-it')).not.toThrow();
    expect(() => assertChannel('Stage')).toThrow(/channel/);
    expect(() => assertChannel('')).toThrow(/channel/);
    expect(() => assertChannel('a'.repeat(33))).toThrow(/channel/);
  });
});
