import { beforeAll, describe, expect, it } from 'vitest';
import { admin, createTestUser, signedInClient, type TestUser } from './helpers';

const frames = [{ t: 0, hands: [] }];
const recording = (authorId: string) => ({
  author_id: authorId,
  author_name: 'Test',
  label: 'due dita a V',
  expect: null,
  description: '',
  armed: true,
  frames,
});

describe('RLS on the gesture lab tables', () => {
  let labAdmin: TestUser;
  let otherAdmin: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    labAdmin = await createTestUser('lab-admin');
    otherAdmin = await createTestUser('lab-admin-2');
    stranger = await createTestUser('lab-stranger');
    const { error } = await admin
      .from('gesture_lab_admins')
      .insert([{ user_id: labAdmin.id }, { user_id: otherAdmin.id }]);
    if (error) throw error;
  });

  it('tells admins apart', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const asStranger = await signedInClient(stranger);
    expect((await asAdmin.rpc('is_gesture_lab_admin')).data).toBe(true);
    expect((await asStranger.rpc('is_gesture_lab_admin')).data).toBe(false);
  });

  it('lets an admin save and read recordings, and another admin read them', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data, error } = await asAdmin
      .from('gesture_recordings')
      .insert(recording(labAdmin.id))
      .select('id')
      .single();
    expect(error).toBeNull();
    const asOther = await signedInClient(otherAdmin);
    const { data: seen } = await asOther.from('gesture_recordings').select('id').eq('id', data!.id);
    expect(seen).toHaveLength(1);
  });

  it('hides everything from a non-admin and refuses its writes', async () => {
    const asAdmin = await signedInClient(labAdmin);
    await asAdmin.from('gesture_recordings').insert(recording(labAdmin.id));
    const asStranger = await signedInClient(stranger);
    const { data } = await asStranger.from('gesture_recordings').select('id');
    expect(data).toEqual([]);
    const { error } = await asStranger.from('gesture_recordings').insert(recording(stranger.id));
    expect(error).not.toBeNull();
    const { error: presetError } = await asStranger
      .from('gesture_lab_presets')
      .insert({ author_id: stranger.id, author_name: 'x', name: 'p', settings: {} });
    expect(presetError).not.toBeNull();
  });

  it('refuses a recording written in the name of someone else', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { error } = await asAdmin.from('gesture_recordings').insert(recording(otherAdmin.id));
    expect(error).not.toBeNull();
  });

  it('lets only the author delete', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data } = await asAdmin
      .from('gesture_recordings')
      .insert(recording(labAdmin.id))
      .select('id')
      .single();
    const asOther = await signedInClient(otherAdmin);
    const { data: deleted } = await asOther
      .from('gesture_recordings')
      .delete()
      .eq('id', data!.id)
      .select('id');
    expect(deleted).toEqual([]);
    const { data: still } = await admin.from('gesture_recordings').select('id').eq('id', data!.id);
    expect(still).toHaveLength(1);
    const { data: own } = await asAdmin
      .from('gesture_recordings')
      .delete()
      .eq('id', data!.id)
      .select('id');
    expect(own).toHaveLength(1);
  });

  it('keeps the admin list closed to every client', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data } = await asAdmin.from('gesture_lab_admins').select('user_id');
    expect(data).toEqual([]);
    const { error } = await asAdmin.from('gesture_lab_admins').insert({ user_id: stranger.id });
    expect(error).not.toBeNull();
  });

  it('refuses frames over 1 MB', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const big = [{ t: 0, hands: [], pad: 'x'.repeat(1_100_000) }];
    const { error } = await asAdmin
      .from('gesture_recordings')
      .insert({ ...recording(labAdmin.id), frames: big });
    expect(error?.code).toBe('23514');
  });

  it('lets an admin save a preset that another admin reads', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { data, error } = await asAdmin
      .from('gesture_lab_presets')
      .insert({ author_id: labAdmin.id, author_name: 'Test', name: 'morbido', settings: {} })
      .select('id')
      .single();
    expect(error).toBeNull();
    const asOther = await signedInClient(otherAdmin);
    const { data: seen } = await asOther
      .from('gesture_lab_presets')
      .select('id')
      .eq('id', data!.id);
    expect(seen).toHaveLength(1);
  });

  it('hides presets from a non-admin', async () => {
    const asAdmin = await signedInClient(labAdmin);
    const { error } = await asAdmin
      .from('gesture_lab_presets')
      .insert({ author_id: labAdmin.id, author_name: 'Test', name: 'nascosto', settings: {} });
    expect(error).toBeNull();
    const asStranger = await signedInClient(stranger);
    const { data } = await asStranger.from('gesture_lab_presets').select('id');
    expect(data).toEqual([]);
  });
});
