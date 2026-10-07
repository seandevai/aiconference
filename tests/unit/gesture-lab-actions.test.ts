import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hand } from '../fixtures/hands';

const supabaseMock = vi.hoisted(() => ({
  user: { id: 'u1', email: 'luca@example.com' } as { id: string; email: string } | null,
  isAdmin: false,
  insert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: supabaseMock.user } }) },
    rpc: async () => ({ data: supabaseMock.isAdmin, error: null }),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { display_name: 'Luca' } }) }),
      }),
      insert: (row: unknown) => {
        supabaseMock.insert(table, row);
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: 'r1',
                author_id: 'u1',
                author_name: 'Luca',
                label: 'V',
                expect: null,
                description: '',
                created_at: '2026-10-06T10:00:00Z',
              },
              error: null,
            }),
          }),
        };
      },
    }),
  }),
}));

const { saveRecordingAction } = await import('@/app/dev/gesture-lab/actions');

const input = {
  label: 'V',
  expect: null,
  description: '',
  armed: true,
  frames: [{ t: 0, hands: [hand('fist')] }],
};

beforeEach(() => {
  supabaseMock.user = { id: 'u1', email: 'luca@example.com' };
  supabaseMock.isAdmin = false;
  supabaseMock.insert.mockReset();
});

describe('saveRecordingAction', () => {
  it('writes nothing for a user who is not a lab admin', async () => {
    expect(await saveRecordingAction(input)).toEqual({ ok: false, error: 'not_allowed' });
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it('writes nothing without a session', async () => {
    supabaseMock.user = null;
    supabaseMock.isAdmin = true;
    expect(await saveRecordingAction(input)).toEqual({ ok: false, error: 'not_allowed' });
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it('refuses an invalid recording', async () => {
    supabaseMock.isAdmin = true;
    expect(await saveRecordingAction({ ...input, label: '' })).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it('saves for an admin, in the admin name', async () => {
    supabaseMock.isAdmin = true;
    const result = await saveRecordingAction(input);
    expect(result.ok).toBe(true);
    expect(supabaseMock.insert).toHaveBeenCalledWith(
      'gesture_recordings',
      expect.objectContaining({ author_id: 'u1', author_name: 'Luca', label: 'V' }),
    );
  });
});
