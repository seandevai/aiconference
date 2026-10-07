'use client';

import { Button } from '@omnicanvas/ui';
import { GESTURE_COMMANDS, GESTURE_NAMES, type GestureCommand } from '@omnicanvas/gesture';
import { gestureByName } from '@/lib/gesture-lab/gesture-catalog';
import {
  DEFAULT_LAB_SETTINGS,
  TUNING_SLIDERS,
  readTuningValue,
  setTuningValue,
  type LabSettings,
} from '@/lib/gesture-lab/settings';

type Props = { settings: LabSettings; onChange: (next: LabSettings) => void };

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function CorrectionControls({ settings, onChange }: Props) {
  const { tuning, toggles } = settings;
  const setToggle = (key: keyof LabSettings['toggles'], value: boolean) =>
    onChange({ ...settings, toggles: { ...toggles, [key]: value } });

  return (
    <div className="flex flex-col gap-1 text-fg">
      <Toggle
        label="Filtro anti-tremolio"
        checked={tuning.smoothing.enabled}
        onChange={(v) =>
          onChange({
            ...settings,
            tuning: { ...tuning, smoothing: { ...tuning.smoothing, enabled: v } },
          })
        }
      />
      <Toggle
        label="Cursore fluido a 60fps"
        checked={toggles.smoothCursor}
        onChange={(v) => setToggle('smoothCursor', v)}
      />
      <Toggle
        label="Riscontro durante il gesto"
        checked={toggles.feedback}
        onChange={(v) => setToggle('feedback', v)}
      />
      <Toggle
        label="Pose stabili"
        checked={toggles.stablePoses}
        onChange={(v) => setToggle('stablePoses', v)}
      />
    </div>
  );
}

export function TuningControls({ settings, onChange }: Props) {
  const { tuning } = settings;
  return (
    <div className="flex flex-col gap-2 text-fg">
      {TUNING_SLIDERS.map((slider) => {
        const value = readTuningValue(tuning, slider.path);
        const fallback = readTuningValue(DEFAULT_LAB_SETTINGS.tuning, slider.path);
        return (
          <label key={slider.path} className="flex flex-col gap-1 text-xs">
            <span className="flex justify-between">
              <span>{slider.label}</span>
              <span className="tabular-nums text-muted">
                {value} <span aria-hidden>· predefinito {fallback}</span>
              </span>
            </span>
            <input
              type="range"
              aria-label={slider.label}
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={value}
              onChange={(e) =>
                onChange({
                  ...settings,
                  tuning: setTuningValue(tuning, slider.path, Number(e.target.value)),
                })
              }
            />
          </label>
        );
      })}
    </div>
  );
}

// L'unico posto del laboratorio in cui si vedono i codici dei comandi.
export function DictionaryControls({ settings, onChange }: Props) {
  const { dictionary } = settings;
  return (
    <div className="flex flex-col gap-2 text-fg">
      {GESTURE_NAMES.map((name) => {
        const label = gestureByName(name).label;
        const options = GESTURE_COMMANDS.filter((c) =>
          name === 'pinch_drag' ? c === 'DRAG' : c !== 'DRAG',
        );
        return (
          <label key={name} className="flex items-center justify-between gap-2 text-xs">
            <span>{label}</span>
            <select
              aria-label={label}
              value={dictionary[name] ?? ''}
              onChange={(e) =>
                onChange({
                  ...settings,
                  dictionary: {
                    ...dictionary,
                    [name]: e.target.value === '' ? null : (e.target.value as GestureCommand),
                  },
                })
              }
              className="min-h-11 rounded-tile border border-line bg-stage px-2 text-fg"
            >
              {options.map((command) => (
                <option key={command} value={command}>
                  {command}
                </option>
              ))}
              <option value="">spento</option>
            </select>
          </label>
        );
      })}
    </div>
  );
}

// Provvisorio: la vecchia colonna dei comandi lo usa finché la pagina nuova non la sostituisce.
export function LabControls(props: Props) {
  return (
    <div className="flex flex-col gap-4 text-fg">
      <CorrectionControls {...props} />
      <TuningControls {...props} />
      <DictionaryControls {...props} />
      <Button variant="quiet" onClick={() => props.onChange(DEFAULT_LAB_SETTINGS)}>
        Ripristina predefiniti
      </Button>
    </div>
  );
}
