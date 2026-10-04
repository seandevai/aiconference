import type { ExtendMinutes } from '@/lib/rooms/timer';

type Timing = { endsAt: string; capAt: string };

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: 'POST',
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });

// null se il server rifiuta (tetto, stanza finita) o la rete manca: chi chiama mostra l'errore.
export async function extendRoomRequest(
  joinCode: string,
  minutes: ExtendMinutes,
): Promise<Timing | null> {
  try {
    const response = await post(`/room/${joinCode}/extend`, { minutes });
    if (!response.ok) return null;
    const { endsAt, capAt } = (await response.json()) as Timing;
    return { endsAt, capAt };
  } catch {
    return null;
  }
}

// Non lancia mai: se la chiusura non arriva, la scadenza lato server chiude comunque.
export async function closeRoomRequest(joinCode: string): Promise<void> {
  try {
    await post(`/room/${joinCode}/close`);
  } catch {
    // Rete assente: ci pensa la scadenza pigra.
  }
}

// L'ospite allo zero chiede un token nuovo solo per leggere la scadenza in vigore.
export async function latestEndsAt(joinCode: string): Promise<Timing | null> {
  try {
    const response = await post(`/room/${joinCode}/token`);
    if (!response.ok) return null;
    const { endsAt, capAt } = (await response.json()) as Timing;
    return { endsAt, capAt };
  } catch {
    return null;
  }
}
