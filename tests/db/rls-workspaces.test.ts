import { beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, createTestUser, signedInClient, type TestUser } from './helpers';

describe('RLS on profiles, workspaces, workspace_members', () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createTestUser('alice');
    bob = await createTestUser('bob');
  });

  it('signup creates profile, free workspace with zero credits, owner membership', async () => {
    const client = await signedInClient(alice);
    const { data: workspaces } = await client
      .from('workspaces')
      .select('id, plan, credits_balance');
    expect(workspaces).toHaveLength(1);
    expect(workspaces?.[0]?.plan).toBe('free');
    expect(workspaces?.[0]?.credits_balance).toBe(0);

    const { data: members } = await client.from('workspace_members').select('role');
    expect(members).toEqual([{ role: 'owner' }]);

    const { data: profiles } = await client.from('profiles').select('id');
    expect(profiles).toEqual([{ id: alice.id }]);
  });

  it('a user never sees another user workspace, membership or profile', async () => {
    const client = await signedInClient(bob);
    const { data: aliceWs } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', alice.id)
      .single();

    const { data: ws } = await client.from('workspaces').select('id').eq('id', aliceWs!.id);
    expect(ws).toHaveLength(0);

    const { data: members } = await client
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', alice.id);
    expect(members).toHaveLength(0);

    const { data: profiles } = await client.from('profiles').select('id').eq('id', alice.id);
    expect(profiles).toHaveLength(0);
  });

  it('a user cannot change credits on their own workspace', async () => {
    const client = await signedInClient(alice);
    const { data: ws } = await client.from('workspaces').select('id').single();
    await client.from('workspaces').update({ credits_balance: 999 }).eq('id', ws!.id);
    const { data: after } = await admin
      .from('workspaces')
      .select('credits_balance')
      .eq('id', ws!.id)
      .single();
    expect(after?.credits_balance).toBe(0);
  });

  it('anon reads nothing', async () => {
    const client = anonClient();
    for (const table of ['profiles', 'workspaces', 'workspace_members'] as const) {
      const { data } = await client.from(table).select('*');
      expect(data).toHaveLength(0);
    }
  });
});
