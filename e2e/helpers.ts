import {
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

// Ogni partecipante aperto da un test pubblica video finto: se resta connesso dopo il
// test, il carico cresce lungo la suite. Gli spec chiamano closeParticipants in afterEach.
const opened: BrowserContext[] = [];

export async function closeParticipants(): Promise<void> {
  await Promise.all(opened.splice(0).map((context) => context.close().catch(() => {})));
}

export async function signUpHostWithRoom(
  browser: Browser,
  title = 'Kickoff Acme',
): Promise<{ host: Page; roomUrl: string }> {
  const context = await browser.newContext();
  opened.push(context);
  const host = await context.newPage();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

  await host.goto('/signup');
  await host.getByLabel('Nome').fill('Sean');
  await host.getByLabel('Email').fill(email);
  await host.getByLabel('Password').fill('e2e-password-123');
  await host.getByRole('button', { name: 'Registrati' }).click();
  // Il server di sviluppo sotto carico (e2e in parallelo con i media) può metterci qualche secondo.
  await expect(host).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await host.getByPlaceholder('Titolo della riunione').fill(title);
  await host.getByRole('button', { name: 'Crea stanza' }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{8}$/, { timeout: 15_000 });
  return { host, roomUrl: host.url() };
}

export async function joinAsAnonymousGuest(
  browser: Browser,
  roomUrl: string,
  name = 'Cliente',
  contextOptions: BrowserContextOptions = {},
): Promise<Page> {
  const context = await browser.newContext(contextOptions);
  opened.push(context);
  const guest = await context.newPage();
  await guest.goto(roomUrl);
  await guest.getByLabel('Il tuo nome').fill(name);
  await guest.getByLabel('In che lingua vuoi leggere gli altri?').selectOption('en');
  await guest.getByRole('button', { name: 'Entra' }).click();
  await expect(guest.getByText('Ospite', { exact: true })).toBeVisible();
  return guest;
}
