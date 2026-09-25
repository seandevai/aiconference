import { expect, type Browser, type Page } from '@playwright/test';

export async function signUpHostWithRoom(
  browser: Browser,
  title = 'Kickoff Acme',
): Promise<{ host: Page; roomUrl: string }> {
  const host = await browser.newPage();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

  await host.goto('/signup');
  await host.getByLabel('Nome').fill('Sean');
  await host.getByLabel('Email').fill(email);
  await host.getByLabel('Password').fill('e2e-password-123');
  await host.getByRole('button', { name: 'Registrati' }).click();
  await expect(host).toHaveURL(/\/dashboard$/);

  await host.getByPlaceholder('Titolo della riunione').fill(title);
  await host.getByRole('button', { name: 'Crea stanza' }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{8}$/);
  return { host, roomUrl: host.url() };
}

export async function joinAsAnonymousGuest(
  browser: Browser,
  roomUrl: string,
  name = 'Cliente',
): Promise<Page> {
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(roomUrl);
  await guest.getByLabel('Il tuo nome').fill(name);
  await guest.getByLabel('In che lingua vuoi leggere gli altri?').selectOption('en');
  await guest.getByRole('button', { name: 'Entra' }).click();
  await expect(guest.getByText('Ospite', { exact: true })).toBeVisible();
  return guest;
}
