import { expect, test } from '@playwright/test';

test('host creates a room, anonymous guest joins and survives a reload', async ({ browser }) => {
  const host = await browser.newPage();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

  await host.goto('/signup');
  await host.getByLabel('Nome').fill('Sean');
  await host.getByLabel('Email').fill(email);
  await host.getByLabel('Password').fill('e2e-password-123');
  await host.getByRole('button', { name: 'Registrati' }).click();
  await expect(host).toHaveURL(/\/dashboard$/);

  await host.getByPlaceholder('Titolo della riunione').fill('Kickoff Acme');
  await host.getByRole('button', { name: 'Crea stanza' }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{8}$/);
  await expect(host.getByText('Host', { exact: true })).toBeVisible();
  const roomUrl = host.url();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(roomUrl);
  await guest.getByLabel('Il tuo nome').fill('Cliente');
  await guest.getByLabel('In che lingua vuoi leggere gli altri?').selectOption('en');
  await guest.getByRole('button', { name: 'Entra' }).click();

  await expect(guest.getByText('Ospite', { exact: true })).toBeVisible();
  await expect(guest.getByRole('region', { name: 'Palco' })).toBeAttached();
  await expect(guest.getByRole('complementary', { name: 'Partecipanti' })).toBeAttached();

  await guest.reload();
  await expect(guest.getByText('Ospite', { exact: true })).toBeVisible();

  await guestContext.close();
});

test('unknown room code shows 404', async ({ page }) => {
  const response = await page.goto('/room/ZZZZZZZZ');
  expect(response?.status()).toBe(404);
});
