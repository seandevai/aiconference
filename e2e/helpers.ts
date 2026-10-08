import {
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Ogni partecipante aperto da un test pubblica video finto: se resta connesso dopo il
// test, il carico cresce lungo la suite. Gli spec chiamano closeParticipants in afterEach.
const opened: BrowserContext[] = [];

export async function closeParticipants(): Promise<void> {
  await Promise.all(opened.splice(0).map((context) => context.close().catch(() => {})));
}

export async function signUpHost(browser: Browser): Promise<{ host: Page; email: string }> {
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
  return { host, email };
}

export async function signUpHostWithRoom(
  browser: Browser,
  title = 'Kickoff Acme',
): Promise<{ host: Page; roomUrl: string; email: string }> {
  const { host, email } = await signUpHost(browser);
  await host.getByRole('button', { name: 'Nuova riunione' }).click();
  await host.getByLabel('Titolo della riunione').fill(title);
  await host.getByLabel('Durata').selectOption('30');
  await host.getByRole('button', { name: 'Crea', exact: true }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{8}$/, { timeout: 15_000 });
  return { host, roomUrl: host.url(), email };
}

// La stanza diventa «active» solo quando il client chiede il token della call: prima di
// lasciare la stanza bisogna aspettare di esserci davvero (la propria tessera nei volti).
export async function waitUntilInCall(page: Page): Promise<void> {
  await expect(
    page.getByRole('complementary', { name: 'Partecipanti' }).getByRole('listitem'),
  ).toHaveCount(1, { timeout: 30_000 });
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

export async function grantCreditsTo(email: string, credits: number): Promise<void> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`no test user ${email}`);
  const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', user.id).single();
  const { error } = await admin.rpc('grant_credits', { p_workspace: ws!.id, p_credits: credits });
  if (error) throw error;
}
