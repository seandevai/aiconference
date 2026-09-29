import { expect, test, type Page } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

const main = (page: Page) => page.getByRole('region', { name: 'Finestra in primo piano' });

async function placeInto(host: Page, contentTitle: string, windowTitle: string) {
  await host
    .getByRole('combobox', { name: `Metti «${contentTitle}» in una finestra` })
    .selectOption({ label: windowTitle });
}

async function buildTextWindow(host: Page) {
  await host.getByRole('button', { name: 'Aggiungi testo di prova' }).click();
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await placeInto(host, 'Proposta Acme', 'Finestra 1');
  await expect(main(host)).toContainText('Proposta Acme');
}

test('host builds the stage and the guest follows live', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);

  await buildTextWindow(host);
  await expect(main(guest)).toContainText('Proposta Acme', { timeout: 20_000 });

  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await host
    .getByRole('article', { name: 'Finestra 2' })
    .getByRole('button', { name: 'Metti in primo piano' })
    .click();
  await expect(main(host).getByRole('article', { name: 'Finestra 2' })).toBeVisible();
  await expect(main(guest).getByRole('article', { name: 'Finestra 2' })).toBeVisible({
    timeout: 20_000,
  });
});

test('a late guest and a reloading host land on the same stage', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  await buildTextWindow(host);

  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(main(guest)).toContainText('Proposta Acme', { timeout: 20_000 });

  // L'host salva lo snapshot un secondo dopo l'ultimo comando.
  await host.waitForTimeout(2_000);
  await host.reload();
  await expect(main(host)).toContainText('Proposta Acme', { timeout: 20_000 });

  await host.getByRole('button', { name: 'Aggiungi grafico di prova' }).click();
  await placeInto(host, 'Vendite per trimestre', 'Finestra 1');
  await expect(main(guest)).toContainText('Vendite per trimestre', { timeout: 20_000 });
});

test('images travel peer to peer, also to a guest who joins later', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);

  await host.getByRole('button', { name: 'Aggiungi immagine di prova' }).click();
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await placeInto(host, 'Schema di prova', 'Finestra 1');

  const loaded = (page: Page) =>
    expect
      .poll(
        () =>
          main(page)
            .getByRole('img', { name: 'Schema di prova' })
            .evaluate((img) => (img as HTMLImageElement).naturalWidth)
            .catch(() => 0),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);

  await loaded(guest);
  const late = await joinAsAnonymousGuest(browser, roomUrl, 'Ritardo');
  await loaded(late);
});

test('guests cannot touch the stage', async ({ browser }) => {
  const { roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  // getByText trova anche la vista nascosta (desktop o mobile): si filtra sulla visibile.
  await expect(
    guest
      .getByText(/Nessuna finestra|L'host non ha ancora aperto finestre/)
      .filter({ visible: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByRole('button', { name: 'Nuova finestra' })).toHaveCount(0);
  await expect(guest.getByRole('region', { name: 'Vassoio' })).toHaveCount(0);
});

test('on a phone the guest follows the host and can peek', async ({ browser }) => {
  const { host, roomUrl } = await signUpHostWithRoom(browser);
  const phone = await joinAsAnonymousGuest(browser, roomUrl, 'Telefono', {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  await buildTextWindow(host);
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await expect(main(phone).getByRole('article', { name: 'Finestra 1' })).toBeVisible({
    timeout: 20_000,
  });

  await phone.getByRole('button', { name: 'Finestra successiva' }).click();
  const peeking = phone.getByRole('region', { name: 'Finestra che stai guardando' });
  await expect(peeking.getByRole('article', { name: 'Finestra 2' })).toBeVisible();
  await expect(phone.getByRole('button', { name: "Torna all'host" })).toBeVisible();

  await host.getByRole('button', { name: 'Finestra successiva' }).click();
  await expect(main(phone).getByRole('article', { name: 'Finestra 2' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(phone.getByRole('button', { name: "Torna all'host" })).toHaveCount(0);
});
