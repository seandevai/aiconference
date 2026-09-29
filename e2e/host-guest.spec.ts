import { expect, test } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

test('host creates a room, anonymous guest joins and survives a reload', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  await expect(host.getByText('Host', { exact: true })).toBeVisible();

  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(guest.getByRole('region', { name: 'Palco' })).toBeAttached();
  await expect(guest.getByRole('complementary', { name: 'Partecipanti' })).toBeAttached();

  await guest.reload();
  await expect(guest.getByText('Ospite', { exact: true })).toBeVisible();
  await guest.context().close();
});

test('unknown room code shows 404', async ({ page }) => {
  const response = await page.goto('/room/ZZZZZZZZ');
  expect(response?.status()).toBe(404);
});

test('a room code typed by hand leads to the room', async ({ browser }) => {
  const { roomUrl } = await signUpHostWithRoom(browser);
  const code = roomUrl.slice(-8);
  const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4).toLowerCase()}`;
  const guest = await joinAsAnonymousGuest(browser, roomUrl.replace(code, typed));
  await expect(guest).toHaveURL(new RegExp(`/room/${code}$`));
});
