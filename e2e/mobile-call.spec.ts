import { expect, test, type Page } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

const tiles = (page: Page) =>
  page.getByRole('complementary', { name: 'Partecipanti' }).getByRole('listitem');

const phone = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true };

test('phone in landscape hides the header and keeps faces on the right', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone layout only');
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  // Entra in verticale (l'helper cerca «Ospite» nell'header), poi ruota il telefono.
  const guest = await joinAsAnonymousGuest(browser, roomUrl, 'Cliente', phone);
  await expect(tiles(guest)).toHaveCount(2, { timeout: 30_000 });
  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });
  await guest.setViewportSize({ width: 915, height: 412 });

  await expect(guest.getByRole('banner')).toBeHidden();
  const faces = await guest.getByRole('complementary', { name: 'Partecipanti' }).boundingBox();
  expect(faces).not.toBeNull();
  expect(faces!.x).toBeGreaterThan(915 / 2);
  expect(faces!.width).toBeGreaterThanOrEqual(90);
  await expect(guest.getByRole('button', { name: 'Esci' })).toBeInViewport();
});

test('tapping a face opens it full screen and closes when that person leaves', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'one run is enough');
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(tiles(host)).toHaveCount(2, { timeout: 30_000 });

  // La propria tessera non si apre.
  await expect(host.getByRole('button', { name: /^Mostra Sean/ })).toHaveCount(0);

  await host.getByRole('button', { name: 'Mostra Cliente a tutto schermo' }).click();
  const dialog = host.getByRole('dialog', { name: 'Cliente a tutto schermo' });
  await expect(dialog).toBeVisible();
  await expect(host.getByRole('button', { name: 'Esci' })).toBeVisible();

  await host.getByRole('button', { name: 'Chiudi tutto schermo' }).click();
  await expect(dialog).toBeHidden();

  await host.getByRole('button', { name: 'Mostra Cliente a tutto schermo' }).click();
  await host.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await host.getByRole('button', { name: 'Mostra Cliente a tutto schermo' }).click();
  await guest.getByRole('button', { name: 'Esci' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
});

test('switch camera is hidden on a device with a single camera', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser);
  await expect(tiles(host)).toHaveCount(1, { timeout: 30_000 });
  await expect(host.getByRole('button', { name: 'Disattiva camera' })).toBeVisible();
  await expect(host.getByRole('button', { name: 'Gira fotocamera' })).toHaveCount(0);
});
