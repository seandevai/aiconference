import { describe, expect, it, vi } from 'vitest';
import {
  isLabAdmin,
  toPresetSummary,
  toRecordingSummary,
  type LabClient,
} from '@/lib/gesture-lab/lab-store';
import { DEFAULT_LAB_SETTINGS } from '@/lib/gesture-lab/settings';

const client = (rpc: () => unknown) => ({ rpc: vi.fn(rpc) }) as unknown as LabClient;

describe('isLabAdmin', () => {
  it('is true only when the database says so', async () => {
    expect(await isLabAdmin(client(async () => ({ data: true, error: null })))).toBe(true);
    expect(await isLabAdmin(client(async () => ({ data: false, error: null })))).toBe(false);
    expect(await isLabAdmin(client(async () => ({ data: null, error: { message: 'x' } })))).toBe(
      false,
    );
  });

  it('is false when Supabase cannot be reached', async () => {
    const unreachable = client(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await isLabAdmin(unreachable)).toBe(false);
  });
});

describe('row mapping', () => {
  it('maps a recording row and drops an unknown event', () => {
    const row = {
      id: 'r1',
      author_id: 'u1',
      author_name: 'Luca',
      label: 'V',
      expect: 'DANCE',
      description: '',
      created_at: '2026-10-06T10:00:00Z',
    };
    expect(toRecordingSummary(row)).toEqual({
      id: 'r1',
      authorId: 'u1',
      authorName: 'Luca',
      label: 'V',
      expect: null,
      description: '',
      createdAt: '2026-10-06T10:00:00Z',
    });
  });

  it('maps a preset row and normalizes its settings', () => {
    const row = {
      id: 'p1',
      author_id: 'u1',
      author_name: 'Luca',
      name: 'morbido',
      settings: {},
      created_at: '2026-10-06T10:00:00Z',
    };
    expect(toPresetSummary(row).settings).toEqual(DEFAULT_LAB_SETTINGS);
  });
});
