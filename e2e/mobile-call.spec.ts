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
