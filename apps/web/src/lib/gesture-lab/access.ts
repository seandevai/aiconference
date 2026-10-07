// Chi apre /dev/gesture-lab. In locale (development e test) il laboratorio è di tutti, e
// diventa «admin» se l'utente lo è. Altrove (Vercel) esiste solo con la variabile accesa e
// solo per un admin: per gli altri è un 404.
export type LabAccess = 'open' | 'admin' | 'hidden';

const LOCAL_ENVS = ['development', 'test'];

export function labAccess(input: {
  nodeEnv: string | undefined;
  enabled: boolean;
  isAdmin: boolean;
}): LabAccess {
  if (LOCAL_ENVS.includes(input.nodeEnv ?? '')) return input.isAdmin ? 'admin' : 'open';
  return input.enabled && input.isAdmin ? 'admin' : 'hidden';
}

// Letta a parte: serverEnv() esige tutti i segreti del server, che in locale qui non servono.
export function gestureLabEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.GESTURE_LAB_ENABLED === 'true';
}
