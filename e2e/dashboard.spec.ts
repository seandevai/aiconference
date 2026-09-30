import { expect, test } from '@playwright/test';
import { closeParticipants, signUpHost, signUpHostWithRoom, waitUntilInCall } from './helpers';

test.afterEach(closeParticipants);

test('the root page sends visitors to login and hosts to their meetings', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  const { host } = await signUpHost(browser);
  await host.goto('/');
  await expect(host).toHaveURL(/\/dashboard$/);
  await expect(host.getByRole('heading', { name: 'Prima riunione' })).toBeVisible();
});

test('a started meeting is live on the dashboard with its link', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser, 'Kickoff Ferretti');
  await waitUntilInCall(host);
  await host.goto('/dashboard');
  await expect(host.getByRole('heading', { name: 'In corso' })).toBeVisible();
  await expect(host.getByText('Kickoff Ferretti', { exact: true })).toBeVisible();
  await expect(host.getByRole('link', { name: /Rientra/ })).toBeVisible();
});

test('the host renames themselves from the profile card', async ({ browser }) => {
  const { host } = await signUpHost(browser);
  await host.getByRole('button', { name: 'Modifica' }).click();
  await host.getByLabel('Nome').fill('Giulia Rinaldi');
  await host.getByRole('button', { name: 'Salva' }).click();
  await expect(host.getByRole('button', { name: 'Menu di Giulia Rinaldi' })).toBeVisible();

  await host.getByRole('button', { name: 'Modifica' }).click();
  await host.getByLabel('Nome').fill('   ');
  await host.getByRole('button', { name: 'Salva' }).click();
  await expect(host.getByText('Scrivi il tuo nome, al massimo 40 caratteri.')).toBeVisible();
  await host.reload();
  await expect(host.getByRole('button', { name: 'Menu di Giulia Rinaldi' })).toBeVisible();
});

test('the host signs out from the profile menu', async ({ browser }) => {
  const { host } = await signUpHost(browser);
  await host.getByRole('button', { name: 'Menu di Sean' }).click();
  await host.getByRole('button', { name: 'Esci' }).click();
  await expect(host).toHaveURL(/\/login$/);
  await host.goto('/dashboard');
  // Next scrive il `next` così com'è: la barra non viene codificata.
  await expect(host).toHaveURL(/\/login\?next=(%2F|\/)dashboard$/);
});
