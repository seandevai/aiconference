import type { FacingMode, RosterEntry } from '@omnicanvas/realtime';

// Come FaceTime e WhatsApp: ti vedi allo specchio con la fotocamera anteriore. Gli altri
// ti ricevono sempre non specchiato, perché lo specchio è solo CSS sul tuo schermo.
export function isMirrored(entry: RosterEntry, facing: FacingMode): boolean {
  return entry.isLocal && facing === 'user';
}
