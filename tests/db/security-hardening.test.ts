import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, createTestUser, signedInClient, type TestUser } from './helpers';

// Migrazione 0008: la funzione del trigger sui nuovi utenti non si chiama da /rest/v1/rpc.
// Prima della migrazione la chiamata arrivava alla funzione e falliva solo perché non è
// dentro un trigger (0A000); dopo, si ferma ai privilegi (42501).
describe('security hardening', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser('hardening');
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(user.id);
  });

  it('keeps handle_new_user out of reach for anonymous callers', async () => {
    const { error } = await anonClient().rpc('handle_new_user' as never);
    expect(error?.code).toBe('42501');
  });

  it('keeps handle_new_user out of reach for signed-in users', async () => {
    const client = await signedInClient(user);
    const { error } = await client.rpc('handle_new_user' as never);
    expect(error?.code).toBe('42501');
  });

  it('still creates the profile when a user signs up', async () => {
    const { data, error } = await admin.from('profiles').select('id').eq('id', user.id).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(user.id);
  });
});
