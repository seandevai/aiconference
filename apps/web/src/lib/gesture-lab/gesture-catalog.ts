import type { GestureEvent, GestureName, Pose } from '@omnicanvas/gesture';

// I nove gesti come li vede chi usa il laboratorio: nome italiano, come si fanno, cosa fanno
// sul palco. L'evento è quello del dizionario predefinito (il trascinamento si apre con GRAB):
// le registrazioni salvano l'evento in `expect`, e il catalogo lo ritraduce in gesto.
export type GestureInfo = {
  name: GestureName;
  icon: string;
  label: string;
  howTo: string;
  event: GestureEvent['type'];
  effect: string;
  // Solo per i gesti «tieni fermo»: la posa che riempie l'anello d'attesa.
  holdPose?: Pose;
};

export const GESTURE_CATALOG: readonly GestureInfo[] = [
  {
    name: 'open_palm_hold',
    icon: '✋',
    label: 'Palmo aperto',
    howTo: 'Mano aperta verso la fotocamera, ferma per un secondo.',
    event: 'GESTURES_TOGGLE',
    effect: 'attiva o mette in pausa le gesture',
    holdPose: 'open_palm',
  },
  {
    name: 'index_up_hold',
    icon: '☝️',
    label: 'Indice alzato',
    howTo: 'Solo l’indice alzato, fermo per un secondo.',
    event: 'AGENT_ACTIVATE',
    effect: 'chiama l’agente',
    holdPose: 'index_up',
  },
  {
    name: 'pinch_drag',
    icon: '🤏',
    label: 'Pinch e trascina',
    howTo: 'Unisci pollice e indice sopra una finestra, spostala, poi apri le dita.',
    event: 'GRAB',
    effect: 'sposta una finestra',
  },
  {
    name: 'swipe_left',
    icon: '👈',
    label: 'Swipe a sinistra',
    howTo: 'Muovi la mano veloce verso la tua sinistra, in orizzontale.',
    event: 'FOCUS_NEXT',
    effect: 'passa alla finestra dopo',
  },
  {
    name: 'swipe_right',
    icon: '👉',
    label: 'Swipe a destra',
    howTo: 'Muovi la mano veloce verso la tua destra, in orizzontale.',
    event: 'FOCUS_PREV',
    effect: 'torna alla finestra prima',
  },
  {
    name: 'two_hands_spread',
    icon: '🙌',
    label: 'Due mani che si allontanano',
    howTo: 'Due mani aperte vicine davanti alla fotocamera, poi allontanale.',
    event: 'WINDOW_CREATE',
    effect: 'crea una finestra',
  },
  {
    name: 'thumb_up_hold',
    icon: '👍',
    label: 'Pollice su',
    howTo: 'Pugno chiuso col pollice in su, fermo per un secondo.',
    event: 'CONFIRM',
    effect: 'conferma',
    holdPose: 'thumb_up',
  },
  {
    name: 'thumb_down_hold',
    icon: '👎',
    label: 'Pollice giù',
    howTo: 'Pugno chiuso col pollice in giù, fermo per un secondo.',
    event: 'REJECT',
    effect: 'annulla',
    holdPose: 'thumb_down',
  },
  {
    name: 'flick_up',
    icon: '👆',
    label: 'Flick verso l’alto',
    howTo: 'Mano aperta, muovila veloce verso l’alto.',
    event: 'WINDOW_ARCHIVE',
    effect: 'archivia la finestra',
  },
];

export function gestureByName(name: GestureName): GestureInfo {
  const info = GESTURE_CATALOG.find((g) => g.name === name);
  if (!info) throw new Error(`unknown gesture: ${name}`);
  return info;
}

export const gestureForEvent = (type: GestureEvent['type'] | null): GestureInfo | null =>
  GESTURE_CATALOG.find((g) => g.event === type) ?? null;

export const gestureForHold = (pose: Pose): GestureInfo | null =>
  GESTURE_CATALOG.find((g) => g.holdPose === pose) ?? null;

// Nome leggibile di un evento: il gesto che lo produce, o il codice se non ce n'è uno.
export const eventLabel = (type: GestureEvent['type']): string =>
  gestureForEvent(type)?.label ?? type;
