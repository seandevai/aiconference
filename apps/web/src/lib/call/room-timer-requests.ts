import type { ExtendMinutes } from '@/lib/rooms/timer';

type Timing = { endsAt: string; capAt: string };

const BOUNDED_MS = 5000;

// `bounded` mette un tetto di 5 secondi: chiusura e lettura della scadenza non devono
// restare appese su una rete bloccata.
const post = (url: string, body?: unknown, bounded = false) =>
  fetch(url, {
    method: 'POST',
    cache: 'no-store',
    ...(bounded ? { signal: AbortSignal.timeout(BOUNDED_MS) } : {}),
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
    await post(`/room/${joinCode}/close`, undefined, true);
  } catch {
    // Rete assente: ci pensa la scadenza pigra.
  }
}

// L'ospite allo zero chiede un token nuovo solo per leggere la scadenza in vigore.
export async function latestEndsAt(joinCode: string): Promise<Timing | null> {
  try {
    const response = await post(`/room/${joinCode}/token`, undefined, true);
    if (!response.ok) return null;
    const { endsAt, capAt } = (await response.json()) as Timing;
    return { endsAt, capAt };
  } catch {
    return null;
  }
}
