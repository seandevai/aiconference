import { expect, test } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

test('the host shares the screen and the guest sees it on the stage', async ({ browser }, info) => {
  test.skip(info.project.name === 'mobile', "l'host non condivide da telefono");
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  // Come in stage.spec: i ruoli escludono il palco nascosto (telefono o desktop), il testo no.
  const screenWindow = (page: typeof host) =>
    page
      .getByRole('region', { name: 'Finestra in primo piano' })
      .getByRole('article', { name: 'Schermo' });

  await host.getByRole('button', { name: 'Condividi schermo' }).click();
  await expect(host.getByRole('button', { name: 'Interrompi condivisione' })).toBeVisible();
  await expect(screenWindow(guest)).toBeVisible({ timeout: 20_000 });
  await expect(screenWindow(guest).getByText('Schermo in arrivo…')).toBeHidden({
    timeout: 20_000,
  });

  await host.getByRole('button', { name: 'Interrompi condivisione' }).click();
  await expect(screenWindow(host)).toBeHidden({ timeout: 10_000 });
  await expect(screenWindow(guest)).toBeHidden({ timeout: 20_000 });
});

test('a guest has no share button', async ({ browser }) => {
  const { roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(guest.getByRole('button', { name: 'Esci' })).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByRole('button', { name: 'Condividi schermo' })).toHaveCount(0);
});
