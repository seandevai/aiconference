'use client';

import { useEffect, useState, type RefObject } from 'react';
import { pipDiagnostics } from '@/lib/call/pip';

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  extra: Record<string, string>;
};

// Pannello temporaneo per il PiP su iPhone, visibile solo con ?debugpip nell'indirizzo.
export function PipDebug({ videoRef, extra }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const video = videoRef.current;
      setValues(video ? pipDiagnostics(document, video) : { video: 'missing' });
    };
    read();
    const timer = setInterval(read, 1_000);
    return () => clearInterval(timer);
  }, [videoRef]);

  return (
    <pre className="fixed left-2 top-2 z-50 rounded bg-black/80 p-2 text-[10px] text-green-300">
      {Object.entries({ ...values, ...extra })
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')}
    </pre>
  );
}
