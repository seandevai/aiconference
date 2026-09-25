import { expect, test } from '@playwright/test';
import { joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

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
