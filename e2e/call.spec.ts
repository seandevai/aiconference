import { expect, test, type Page } from '@playwright/test';
import { joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

const tiles = (page: Page) =>
  page.getByRole('complementary', { name: 'Partecipanti' }).getByRole('listitem');

test('host and guest see each other and a mute reaches the other side', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);

  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });
  await expect(tiles(guest)).toHaveCount(2, { timeout: 30_000 });
  await expect(
    host.getByRole('listitem', { name: /^Cliente, ospite, microfono acceso/ }),
  ).toBeVisible({
    timeout: 15_000,
  });

  await guest.getByRole('button', { name: 'Disattiva microfono' }).click();
  await expect(
    host.getByRole('listitem', { name: /^Cliente, ospite, microfono spento/ }),
  ).toBeVisible({
    timeout: 15_000,
  });
});

test('guest reconnects after a network drop', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(tiles(guest)).toHaveCount(2, { timeout: 30_000 });

  await guest.context().setOffline(true);
  await expect(guest.getByRole('status')).toContainText('Connessione persa, riprovo…', {
    timeout: 20_000,
  });

  await guest.context().setOffline(false);
  await expect(guest.getByText('Connessione persa, riprovo…')).toBeHidden({ timeout: 45_000 });
  await expect(tiles(guest)).toHaveCount(2, { timeout: 30_000 });
  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });
});

test('guest leaves, host leaves and comes back as host', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });

  await guest.getByRole('button', { name: 'Esci' }).click();
  await expect(guest.getByText('Sei uscito dalla riunione.')).toBeVisible();
  await expect(tiles(host)).toHaveCount(1, { timeout: 30_000 });

  await host.getByRole('button', { name: 'Esci' }).click();
  await expect(host).toHaveURL(/\/dashboard$/);

  await host.goto(roomUrl);
  await expect(host.getByText('Host', { exact: true })).toBeVisible();
  await expect(tiles(host)).toHaveCount(1, { timeout: 30_000 });
});
