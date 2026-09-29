import { describe, expect, it } from 'vitest';
import { admin } from './helpers';

async function profileNameFor(
  displayName: string | undefined,
): Promise<{ name: string | null; email: string }> {
  const email = `profile-${crypto.randomUUID()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
    user_metadata: displayName === undefined ? {} : { display_name: displayName },
  });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', data.user.id)
    .single();
  return { name: profile?.display_name ?? null, email };
}

describe('profile name at signup', () => {
  it('keeps the chosen name, trimmed', async () => {
    expect((await profileNameFor('  Anna  ')).name).toBe('Anna');
  });

  it('falls back to the email prefix when the name is blank', async () => {
    const { name, email } = await profileNameFor('   ');
    expect(name).toBe(email.split('@')[0]!.slice(0, 40));
  });

  it('falls back to the email prefix when no name is given', async () => {
    const { name, email } = await profileNameFor(undefined);
    expect(name).toBe(email.split('@')[0]!.slice(0, 40));
  });

  it('cuts a name longer than 40 characters', async () => {
    expect((await profileNameFor('x'.repeat(60))).name).toBe('x'.repeat(40));
  });
});
