'use client';

import { useEffect, useState } from 'react';
import type { RealtimeSession } from '@omnicanvas/realtime';

// Un volto alla volta: si ridisegna solo la tessera di chi cambia volume, non la call.
export function useAudioLevel(
  subscribe: RealtimeSession['onAudioLevels'] | undefined,
  identity: string,
): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!subscribe) return;
    const unsubscribe = subscribe((levels) => setLevel(levels[identity] ?? 0));
    return () => {
      unsubscribe();
      setLevel(0);
    };
  }, [subscribe, identity]);
  return level;
}
