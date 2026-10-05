'use client';

import { Button } from '@omnicanvas/ui';
import {
  GESTURE_COMMANDS,
  GESTURE_NAMES,
  type GestureCommand,
  type GestureName,
} from '@omnicanvas/gesture';
import {
  DEFAULT_LAB_SETTINGS,
  TUNING_SLIDERS,
  readTuningValue,
  setTuningValue,
  type LabSettings,
} from '@/lib/gesture-lab/settings';

const GESTURE_LABELS: Record<GestureName, string> = {
  open_palm_hold: 'Palmo aperto, 1 s',
  index_up_hold: 'Indice alzato, 1 s',
  thumb_up_hold: 'Pollice su, 1 s',
  thumb_down_hold: 'Pollice giù, 1 s',
  pinch_drag: 'Pinch e trascina',
  swipe_left: 'Swipe a sinistra',
  swipe_right: 'Swipe a destra',
  flick_up: 'Flick verso l’alto',
  two_hands_spread: 'Due mani che si allontanano',
};

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

export function LabControls({ settings, onChange }: Props) {
  const { tuning, dictionary, toggles } = settings;
  const setToggle = (key: keyof LabSettings['toggles'], value: boolean) =>
    onChange({ ...settings, toggles: { ...toggles, [key]: value } });

  return (
    <div className="flex flex-col gap-4 text-fg">
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-muted">Correzioni</h2>
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Taratura</h2>
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Dizionario</h2>
        {GESTURE_NAMES.map((name) => {
          const options = GESTURE_COMMANDS.filter((c) =>
            name === 'pinch_drag' ? c === 'DRAG' : c !== 'DRAG',
          );
          return (
            <label key={name} className="flex items-center justify-between gap-2 text-xs">
              <span>{GESTURE_LABELS[name]}</span>
              <select
                aria-label={GESTURE_LABELS[name]}
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
      </section>

      <Button variant="quiet" onClick={() => onChange(DEFAULT_LAB_SETTINGS)}>
        Ripristina predefiniti
      </Button>
    </div>
  );
}
