import { beforeAll, describe, expect, it } from 'vitest';
import { createRoomForUser } from '@/lib/rooms/create-room';
import { generateJoinCode } from '@/lib/rooms/join-code';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

describe('createRoomForUser', () => {
  let host: TestUser;

  beforeAll(async () => {
    host = await createTestUser('creator');
  });

  it('creates a room in the user workspace', async () => {
    const client = await signedInClient(host);
    const result = await createRoomForUser(client, host.id, { title: '  Kickoff Acme  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data } = await admin
      .from('rooms')
      .select('title, status, created_by, join_code')
      .eq('id', result.id)
      .single();
    expect(data).toEqual({
      title: 'Kickoff Acme',
      status: 'created',
      created_by: host.id,
      join_code: result.joinCode,
    });
  });

  it('rejects an empty title', async () => {
    const client = await signedInClient(host);
    expect(await createRoomForUser(client, host.id, { title: '   ' })).toEqual({
      ok: false,
      error: 'INVALID_TITLE',
    });
  });

  it('retries on a join code collision', async () => {
    const client = await signedInClient(host);
    const first = await createRoomForUser(client, host.id, { title: 'First' });
    if (!first.ok) throw new Error('setup failed');

    const fresh = generateJoinCode();
    const codes = [first.joinCode, fresh];
    const second = await createRoomForUser(client, host.id, { title: 'Second' }, () =>
      codes.shift()!,
    );
    expect(second).toMatchObject({ ok: true, joinCode: fresh });
  });

  it('gives up after three collisions', async () => {
    const client = await signedInClient(host);
    const first = await createRoomForUser(client, host.id, { title: 'Taken' });
    if (!first.ok) throw new Error('setup failed');
    const result = await createRoomForUser(
      client,
      host.id,
      { title: 'Stuck' },
      () => first.joinCode,
    );
    expect(result).toEqual({ ok: false, error: 'JOIN_CODE_COLLISION' });
  });

  it('stores the chosen duration, 60 minutes when none is given', async () => {
    const client = await signedInClient(host);
    const chosen = await createRoomForUser(client, host.id, { title: 'Breve', plannedMinutes: 30 });
    const fallback = await createRoomForUser(client, host.id, { title: 'Standard' });
    if (!chosen.ok || !fallback.ok) throw new Error('create failed');
    const { data } = await admin
      .from('rooms')
      .select('id, planned_minutes, ends_at')
      .in('id', [chosen.id, fallback.id]);
    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    expect(byId.get(chosen.id)).toMatchObject({ planned_minutes: 30, ends_at: null });
    expect(byId.get(fallback.id)).toMatchObject({ planned_minutes: 60, ends_at: null });
  });

  it('refuses a duration outside the list', async () => {
    const client = await signedInClient(host);
    expect(
      await createRoomForUser(client, host.id, { title: 'Lunga', plannedMinutes: 240 }),
    ).toEqual({ ok: false, error: 'INVALID_DURATION' });
  });
});
