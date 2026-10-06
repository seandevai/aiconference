'use client';

export type LabTab = 'record' | 'archive' | 'tuning';

export const TAB_LABELS: Record<LabTab, string> = {
  record: 'Registra',
  archive: 'Archivio',
  tuning: 'Taratura',
};

// Riquadro di una sezione: bordo e sfondo la separano dalle vicine.
export const CARD = 'rounded-tile border border-line bg-surface p-3';

export const tabId = (tab: LabTab) => `lab-tab-${tab}`;
export const panelId = (tab: LabTab) => `lab-panel-${tab}`;

type Props = { tabs: LabTab[]; active: LabTab; onChange: (tab: LabTab) => void };

// Schede della colonna dei comandi: si vede una sezione alla volta, le altre restano montate.
export function LabTabs({ tabs, active, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Sezioni del laboratorio" className="flex border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={tabId(tab)}
          aria-selected={tab === active}
          aria-controls={panelId(tab)}
          onClick={() => onChange(tab)}
          className={`-mb-px flex-1 border-b-2 px-3 py-2 text-sm font-semibold ${
            tab === active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}

// Pannello di una scheda: nascosto, non smontato, così quello che si è scritto resta.
export function LabTabPanel({
  tab,
  active,
  children,
}: {
  tab: LabTab;
  active: LabTab;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(tab)}
      aria-labelledby={tabId(tab)}
      hidden={tab !== active}
      className="flex flex-col gap-4"
    >
      {children}
    </div>
  );
}
