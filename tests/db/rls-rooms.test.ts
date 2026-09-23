import { beforeAll, describe, expect, it } from 'vitest';
import { generateJoinCode } from '@/lib/rooms/join-code';
import { admin, anonClient, createTestUser, signedInClient, type TestUser } from './helpers';

// Il DB locale non si azzera fra un'esecuzione e l'altra: codici sempre nuovi.

async function workspaceOf(user: TestUser): Promise<string> {
  const { data, error } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (error || !data) throw error ?? new Error('workspace not found');
  return data.id;
}

describe('RLS on rooms and room_participants', () => {
  let host: TestUser;
  let stranger: TestUser;
  let roomId: string;

  beforeAll(async () => {
    host = await createTestUser('host');
    stranger = await createTestUser('stranger');
    const client = await signedInClient(host);
    const { data, error } = await client
      .from('rooms')
      .insert({
        workspace_id: await workspaceOf(host),
        created_by: host.id,
        title: 'Kickoff',
        join_code: generateJoinCode(),
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('insert failed');
    roomId = data.id;
    await admin.from('room_participants').insert({
      room_id: roomId,
      user_id: host.id,
      role: 'host',
      display_name: 'Host',
      language: 'it',
    });
  });

  it('the creator sees the room and its participants', async () => {
    const client = await signedInClient(host);
    const { data: rooms } = await client.from('rooms').select('id').eq('id', roomId);
    expect(rooms).toHaveLength(1);
    const { data: participants } = await client
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId);
    expect(participants).toEqual([{ role: 'host' }]);
  });

  it('a user of another workspace sees nothing', async () => {
    const client = await signedInClient(stranger);
    const { data: rooms } = await client.from('rooms').select('id').eq('id', roomId);
    expect(rooms).toHaveLength(0);
    const { data: participants } = await client
      .from('room_participants')
      .select('id')
      .eq('room_id', roomId);
    expect(participants).toHaveLength(0);
  });

  it('anon sees nothing', async () => {
    const client = anonClient();
    const { data: rooms } = await client.from('rooms').select('id');
    expect(rooms).toHaveLength(0);
    const { data: participants } = await client.from('room_participants').select('id');
    expect(participants).toHaveLength(0);
  });

  it('a user cannot create a room in a workspace they do not belong to', async () => {
    const client = await signedInClient(stranger);
    const { error } = await client.from('rooms').insert({
      workspace_id: await workspaceOf(host),
      created_by: stranger.id,
      title: 'Intrusion',
      join_code: generateJoinCode(),
    });
    expect(error?.code).toBe('42501');
  });

  it('a user cannot create a room that is already active', async () => {
    const client = await signedInClient(host);
    const { error } = await client.from('rooms').insert({
      workspace_id: await workspaceOf(host),
      created_by: host.id,
      title: 'Shortcut',
      join_code: generateJoinCode(),
      status: 'active',
    });
    expect(error?.code).toBe('42501');
  });

  it('users cannot write participants directly', async () => {
    const client = await signedInClient(host);
    const { error } = await client.from('room_participants').insert({
      room_id: roomId,
      role: 'guest',
      display_name: 'Fake',
      language: 'it',
    });
    expect(error?.code).toBe('42501');
  });

  it('a room has at most one host', async () => {
    const { error } = await admin.from('room_participants').insert({
      room_id: roomId,
      user_id: stranger.id,
      role: 'host',
      display_name: 'Second host',
      language: 'it',
    });
    expect(error?.code).toBe('23505');
  });
});
