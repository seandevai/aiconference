import { expect, test } from '@playwright/test';
import {
  closeParticipants,
  grantCreditsTo,
  joinAsAnonymousGuest,
  signUpHostWithRoom,
} from './helpers';

test.afterEach(closeParticipants);

test('the host asks the agent and the content lands in the tray', async ({ browser }) => {
  const { host, email } = await signUpHostWithRoom(browser);
  await grantCreditsTo(email, 20);
  await host.reload();

  await expect(host.getByText(/Crediti: 20/)).toBeVisible({ timeout: 20_000 });
  await host.getByRole('button', { name: /Chiedi all'agente/ }).click();
  await host.getByLabel('Cosa ti serve?').fill('Fammi un grafico delle vendite');
  await host.getByRole('button', { name: 'Invia' }).click();

  const tray = host.getByRole('region', { name: 'Vassoio' });
  await expect(tray.getByText('Fammi un grafico delle vendite')).toBeVisible({ timeout: 20_000 });
  await expect(tray.getByText('grafico', { exact: true })).toBeVisible();
});

test('without credits the agent says so and nothing reaches the tray', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser);
  await host.getByRole('button', { name: /Chiedi all'agente/ }).click({ timeout: 20_000 });
  await host.getByLabel('Cosa ti serve?').fill('Riassumi la proposta');
  await host.getByRole('button', { name: 'Invia' }).click();
  await expect(host.getByText(/Crediti esauriti/)).toBeVisible({ timeout: 20_000 });
  await expect(
    host.getByRole('region', { name: 'Vassoio' }).getByText('Riassumi la proposta'),
  ).toHaveCount(0);
});

test('guests do not see the agent', async ({ browser }) => {
  const { roomUrl } = await signUpHostWithRoom(browser);
  const guest = await joinAsAnonymousGuest(browser, roomUrl);
  await expect(guest.getByRole('button', { name: /Chiedi all'agente/ })).toHaveCount(0);
});
