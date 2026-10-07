import {
  DEFAULT_DICTIONARY,
  DEFAULT_TUNING,
  GESTURE_COMMANDS,
  GESTURE_NAMES,
  clampTuning,
  type Dictionary,
  type GestureCommand,
  type Tuning,
} from '@omnicanvas/gesture';

// Impostazioni del laboratorio gesture (solo sviluppo): restano nel browser di Sean.

export type LabToggles = { smoothCursor: boolean; feedback: boolean; stablePoses: boolean };
export type LabSettings = { tuning: Tuning; dictionary: Dictionary; toggles: LabToggles };

export const LAB_STORAGE_KEY = 'gesture-lab:v1';

// La stabilità ha già un valore da provare (3), ma conta solo con l'interruttore acceso.
export const DEFAULT_LAB_SETTINGS: LabSettings = {
  tuning: { ...DEFAULT_TUNING, stability: { frames: 3 } },
  dictionary: DEFAULT_DICTIONARY,
  toggles: { smoothCursor: false, feedback: false, stablePoses: false },
};

export function effectiveTuning(settings: LabSettings): Tuning {
  return {
    ...settings.tuning,
    stability: { frames: settings.toggles.stablePoses ? settings.tuning.stability.frames : 1 },
  };
}

const isCommand = (value: unknown): value is GestureCommand =>
  (GESTURE_COMMANDS as readonly unknown[]).includes(value);

export function parseDictionary(value: unknown): Dictionary {
  const source =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const dictionary = { ...DEFAULT_DICTIONARY };
  for (const name of GESTURE_NAMES) {
    const entry = source[name];
    if (entry === null || isCommand(entry)) dictionary[name] = entry;
  }
  return dictionary;
}

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export function loadLabSettings(storage: Pick<Storage, 'getItem'> | null): LabSettings {
  try {
    const raw = storage?.getItem(LAB_STORAGE_KEY);
    if (!raw) return DEFAULT_LAB_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const toggles = (parsed.toggles ?? {}) as Record<string, unknown>;
    const d = DEFAULT_LAB_SETTINGS.toggles;
    return {
      tuning: clampTuning(parsed.tuning ?? DEFAULT_LAB_SETTINGS.tuning),
      dictionary: parseDictionary(parsed.dictionary),
      toggles: {
        smoothCursor: bool(toggles.smoothCursor, d.smoothCursor),
        feedback: bool(toggles.feedback, d.feedback),
        stablePoses: bool(toggles.stablePoses, d.stablePoses),
      },
    };
  } catch {
    return DEFAULT_LAB_SETTINGS;
  }
}

export function saveLabSettings(storage: Pick<Storage, 'setItem'> | null, settings: LabSettings) {
  try {
    storage?.setItem(LAB_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage pieno o bloccato: le impostazioni valgono fino alla chiusura della pagina.
  }
}

export type TuningSlider = { path: string; label: string; min: number; max: number; step: number };

export const TUNING_SLIDERS: TuningSlider[] = [
  { path: 'timings.holdMs', label: 'Attesa del gesto (ms)', min: 200, max: 3_000, step: 50 },
  { path: 'timings.cooldownMs', label: 'Pausa dopo un gesto (ms)', min: 0, max: 3_000, step: 50 },
  {
    path: 'timings.stillness',
    label: 'Immobilità durante l’attesa',
    min: 0.01,
    max: 0.3,
    step: 0.01,
  },
  { path: 'timings.swipe.distance', label: 'Swipe: distanza', min: 0.05, max: 0.6, step: 0.01 },
  { path: 'timings.swipe.withinMs', label: 'Swipe: entro (ms)', min: 100, max: 1_500, step: 25 },
  { path: 'timings.flick.distance', label: 'Flick: distanza', min: 0.05, max: 0.6, step: 0.01 },
  { path: 'timings.flick.withinMs', label: 'Flick: entro (ms)', min: 100, max: 1_500, step: 25 },
  { path: 'timings.spread.distance', label: 'Due mani: distanza', min: 0.05, max: 0.6, step: 0.01 },
  {
    path: 'timings.spread.withinMs',
    label: 'Due mani: entro (ms)',
    min: 100,
    max: 1_500,
    step: 25,
  },
  { path: 'pose.pinchOn', label: 'Pinch: si chiude sotto', min: 0.05, max: 0.6, step: 0.01 },
  { path: 'pose.pinchOff', label: 'Pinch: si apre sopra', min: 0.06, max: 0.8, step: 0.01 },
  { path: 'pose.extended', label: 'Dito esteso sopra', min: 1.0, max: 2.5, step: 0.05 },
  { path: 'pose.folded', label: 'Dito piegato sotto', min: 0.5, max: 2.45, step: 0.05 },
  { path: 'pose.thumbMargin', label: 'Margine pollice su/giù', min: 0, max: 1, step: 0.05 },
  {
    path: 'smoothing.minCutoff',
    label: 'Filtro: tremolio (minCutoff)',
    min: 0.01,
    max: 10,
    step: 0.01,
  },
  { path: 'smoothing.beta', label: 'Filtro: reattività (beta)', min: 0, max: 1, step: 0.001 },
  { path: 'stability.frames', label: 'Pose stabili: fotogrammi', min: 1, max: 10, step: 1 },
];

export function readTuningValue(tuning: Tuning, path: string): number {
  let node: unknown = tuning;
  for (const key of path.split('.')) node = (node as Record<string, unknown>)[key];
  return typeof node === 'number' ? node : Number.NaN;
}

export function setTuningValue(tuning: Tuning, path: string, value: number): Tuning {
  const copy = structuredClone(tuning) as unknown as Record<string, unknown>;
  const keys = path.split('.');
  let node = copy;
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[keys[keys.length - 1]!] = value;
  return clampTuning(copy);
}

// Il blocco da incollare in packages/gesture quando una taratura convince.
export function tuningToCode(tuning: Tuning, dictionary: Dictionary): string {
  return [
    `export const DEFAULT_TUNING: Tuning = ${JSON.stringify(tuning, null, 2)};`,
    '',
    `export const DEFAULT_DICTIONARY: Dictionary = ${JSON.stringify(dictionary, null, 2)};`,
    '',
  ].join('\n');
}

// Il codice da copiare usa la taratura effettiva: con «Pose stabili» spento la stabilità vale 1,
// altrimenti incollarlo in DEFAULT_TUNING accenderebbe la stabilità nella call.
export function labCode(settings: LabSettings): string {
  return tuningToCode(effectiveTuning(settings), settings.dictionary);
}
