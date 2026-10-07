'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button, cx } from '@omnicanvas/ui';
import { DEFAULT_LAB_SETTINGS, labCode, type LabSettings } from '@/lib/gesture-lab/settings';
import { CorrectionControls, DictionaryControls, TuningControls } from './lab-controls';

type Props = {
  open: boolean;
  onClose: () => void;
  settings: LabSettings;
  onChange: (next: LabSettings) => void;
  diagnostics: ReactNode;
  // Solo per un admin del laboratorio: i preset stanno sul server.
  presets: ReactNode | null;
};

// Sotto questa distanza il gesto sulla maniglia è un tocco, sopra è un trascinamento.
const DRAG_PX = 40;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="border-b border-line py-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
        {title}
      </summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}

// Il tecnico del laboratorio, sopra la schermata in cui si prova: dal basso sul telefono
// verticale, colonna a destra sul telefono orizzontale e sul computer (spec §2).
export function AdvancedPanel({ open, onClose, settings, onChange, diagnostics, presets }: Props) {
  const [size, setSize] = useState<'half' | 'full'>('half');
  const [code, setCode] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  // Dopo un trascinamento il browser manda anche un click: non deve riportare indietro.
  const dragged = useRef(false);

  if (!open) return null;

  async function copyCode() {
    const text = labCode(settings);
    try {
      await navigator.clipboard.writeText(text);
      setCode(null);
    } catch {
      setCode(text);
    }
  }

  return (
    <aside
      aria-label="Avanzate"
      data-size={size}
      className={cx(
        'fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-line bg-surface text-fg',
        size === 'full' ? 'h-dvh' : 'h-[50dvh]',
        'landscape:inset-y-0 landscape:left-auto landscape:h-dvh landscape:w-80 landscape:border-l landscape:border-t-0',
        'lg:static lg:z-auto lg:h-full lg:w-auto lg:rounded-panel lg:border',
      )}
    >
      <button
        type="button"
        aria-label={size === 'half' ? 'Ingrandisci il pannello' : 'Riduci il pannello'}
        onPointerDown={(e) => {
          dragFrom.current = e.clientY;
        }}
        onPointerUp={(e) => {
          const from = dragFrom.current;
          dragFrom.current = null;
          if (from === null || Math.abs(e.clientY - from) < DRAG_PX) return;
          dragged.current = true;
          setSize(e.clientY < from ? 'full' : 'half');
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          setSize((s) => (s === 'half' ? 'full' : 'half'));
        }}
        className="flex min-h-11 w-full touch-none items-center justify-center landscape:hidden"
      >
        <span aria-hidden className="h-1.5 w-12 rounded-full bg-line" />
      </button>
      <header className="flex items-center gap-2 px-4">
        <h2 className="flex-1 text-base font-extrabold">Avanzate</h2>
        <Button variant="quiet" aria-label="Chiudi le impostazioni avanzate" onClick={onClose}>
          ✕
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <Section title="Taratura">
          <TuningControls settings={settings} onChange={onChange} />
        </Section>
        <Section title="Correzioni">
          <CorrectionControls settings={settings} onChange={onChange} />
        </Section>
        <Section title="Dizionario">
          <DictionaryControls settings={settings} onChange={onChange} />
        </Section>
        {presets && <Section title="Preset">{presets}</Section>}
        <Section title="Diagnostica">{diagnostics}</Section>
        <div className="flex flex-col gap-2 py-4">
          <Button onClick={() => void copyCode()}>Copia come codice</Button>
          {code && (
            <textarea
              readOnly
              value={code}
              rows={12}
              className="rounded-tile border border-line bg-stage p-2 font-mono text-xs"
            />
          )}
          <Button variant="quiet" onClick={() => onChange(DEFAULT_LAB_SETTINGS)}>
            Ripristina predefiniti
          </Button>
        </div>
      </div>
    </aside>
  );
}
