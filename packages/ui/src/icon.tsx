import { cx } from './cx';

// Icone disegnate qui, al posto delle emoji: le emoji cambiano forma e colore da un
// sistema all'altro e portano una tavolozza propria sopra l'antracite. Tratto unico
// da 1,75, colore del testo, sempre decorative: il nome lo dà il testo accanto.
const PATHS = {
  lock: [
    'M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z',
    'M8 11V8a4 4 0 0 1 8 0v3',
  ],
  'mic-off': [
    'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z',
    'M5 11a7 7 0 0 0 14 0',
    'M12 18v3',
    'M3 3l18 18',
  ],
  hand: [
    'M8 13V5.5a1.5 1.5 0 0 1 3 0V12',
    'M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5',
    'M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13',
    'M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4.6 14.8a1.5 1.5 0 0 1 2.4-1.8L8 14.2',
  ],
  spark: [
    'M12 3l1.8 5.4a2 2 0 0 0 1.3 1.3L20.5 12l-5.4 1.8a2 2 0 0 0-1.3 1.3L12 20.5l-1.8-5.4a2 2 0 0 0-1.3-1.3L3.5 12l5.4-1.8a2 2 0 0 0 1.3-1.3z',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  focus: [
    'M4 9V5a1 1 0 0 1 1-1h4',
    'M15 4h4a1 1 0 0 1 1 1v4',
    'M20 15v4a1 1 0 0 1-1 1h-4',
    'M9 20H5a1 1 0 0 1-1-1v-4',
  ],
  archive: [
    'M4 4h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    'M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9',
    'M10 13h4',
  ],
  'to-tray': ['M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4', 'M12 4v11', 'M8 11l4 4 4-4'],
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx('h-4 w-4 shrink-0', className)}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
