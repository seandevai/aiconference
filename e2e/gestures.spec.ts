import { expect, test } from '@playwright/test';
import { closeParticipants, signUpHostWithRoom } from './helpers';

test.afterEach(closeParticipants);

test('the palm button arms and pauses hand tracking', async ({ browser }) => {
  const { host } = await signUpHostWithRoom(browser);
  await expect(host.getByRole('button', { name: 'Disattiva camera' })).toBeVisible({
    timeout: 20_000,
  });

  await host.getByRole('button', { name: '✋ Attiva le gesture' }).click();
  // MediaPipe si scarica e si avvia: sulla CPU della CI servono alcuni secondi.
  await expect(
    host.getByText('Gesture attive: palmo aperto per un secondo per metterle in pausa.'),
  ).toBeVisible({
    timeout: 60_000,
  });

  await host.getByRole('button', { name: '✋ Metti in pausa le gesture' }).click();
  await expect(
    host.getByText('Gesture in pausa: palmo aperto per un secondo per riattivarle.'),
  ).toBeVisible();
});

test('without a camera the gestures explain themselves and the mouse keeps working', async ({
  browser,
}) => {
  const { host } = await signUpHostWithRoom(browser);
  await host.getByRole('button', { name: 'Disattiva camera' }).click({ timeout: 20_000 });
  await host.getByRole('button', { name: '✋ Attiva le gesture' }).click();
  await expect(
    host.getByText(
      /Accendi la camera per usare le gesture: ogni comando resta disponibile col mouse/,
    ),
  ).toBeVisible();

  await host.getByRole('button', { name: 'Nuova finestra' }).click();
  await expect(
    host
      .getByRole('region', { name: 'Finestra in primo piano' })
      .getByRole('article', { name: 'Finestra 1' }),
  ).toBeVisible();
});
