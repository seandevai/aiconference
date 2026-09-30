import { test } from '@playwright/test';
import { closeParticipants, joinAsAnonymousGuest, signUpHostWithRoom } from './helpers';

// Solo con SCREENSHOTS=1: immagini per la revisione della PR, non confronti di pixel.
test.skip(!process.env.SCREENSHOTS, 'screenshots only on request');
test.afterEach(closeParticipants);

test('redesign screenshots', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  const { host, roomUrl } = await signUpHostWithRoom(browser, 'Kickoff Acme');
  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await host.getByRole('button', { name: 'Aggiungi grafico di prova' }).click();
  const guest = await joinAsAnonymousGuest(browser, roomUrl, 'Cliente');

  const shots: Array<[string, typeof host, { width: number; height: number }]> = [
    ['host-desktop-1440', host, { width: 1440, height: 900 }],
    ['host-laptop-1280', host, { width: 1280, height: 720 }],
    ['guest-desktop', guest, { width: 1440, height: 900 }],
    ['guest-phone-portrait', guest, { width: 390, height: 844 }],
    ['guest-phone-landscape', guest, { width: 844, height: 390 }],
  ];
  for (const [name, page, size] of shots) {
    await page.setViewportSize(size);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }
});
