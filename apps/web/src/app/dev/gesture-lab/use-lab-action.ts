'use client';

import { useCallback, useRef, useState } from 'react';
import type { LabResult } from '@/lib/gesture-lab/lab-store';
import { LAB_MESSAGES, UNEXPECTED_MESSAGE } from './lab-messages';

// Lo schema comune delle azioni sul server: una alla volta, errore leggibile se fallisce.
export function useLabAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Il ref blocca il secondo click prima che lo stato «busy» arrivi ai bottoni.
  const busyRef = useRef(false);

  const run = useCallback(
    async <T>(action: () => Promise<LabResult<T>>): Promise<LabResult<T> | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        const result = await action();
        setMessage(result.ok ? null : LAB_MESSAGES[result.error]);
        return result;
      } catch {
        setMessage(UNEXPECTED_MESSAGE);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return { busy, message, setMessage, run };
}
