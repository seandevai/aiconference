import { describe, expect, it } from 'vitest';
import { DEFAULT_DICTIONARY, DEFAULT_TUNING } from '@omnicanvas/gesture';
import {
  DEFAULT_LAB_SETTINGS,
  LAB_STORAGE_KEY,
  TUNING_SLIDERS,
  effectiveTuning,
  labCode,
  loadLabSettings,
  parseDictionary,
  parseLabSettings,
  readTuningValue,
  saveLabSettings,
  setTuningValue,
  tuningToCode,
} from '@/lib/gesture-lab/settings';
import { labStage } from '@/lib/gesture-lab/lab-stage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('lab settings', () => {
  it('starts from today defaults, with every correction off', () => {
    expect(DEFAULT_LAB_SETTINGS.dictionary).toEqual(DEFAULT_DICTIONARY);
    expect(DEFAULT_LAB_SETTINGS.toggles).toEqual({
      smoothCursor: false,
      feedback: false,
      stablePoses: false,
    });
    expect(effectiveTuning(DEFAULT_LAB_SETTINGS)).toEqual(DEFAULT_TUNING);
  });

  it('applies the stability frames only when stable poses are on', () => {
    const on = {
      ...DEFAULT_LAB_SETTINGS,
      toggles: { ...DEFAULT_LAB_SETTINGS.toggles, stablePoses: true },
    };
    expect(effectiveTuning(on).stability.frames).toBe(3);
    expect(effectiveTuning(DEFAULT_LAB_SETTINGS).stability.frames).toBe(1);
  });

  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const settings = {
      ...DEFAULT_LAB_SETTINGS,
      tuning: setTuningValue(DEFAULT_LAB_SETTINGS.tuning, 'timings.holdMs', 600),
      dictionary: { ...DEFAULT_DICTIONARY, flick_up: null },
      toggles: { smoothCursor: true, feedback: true, stablePoses: false },
    };
    saveLabSettings(storage, settings);
    expect(storage.data.has(LAB_STORAGE_KEY)).toBe(true);
    expect(loadLabSettings(storage)).toEqual(settings);
  });

  it('falls back to the defaults when storage is missing, broken or throws', () => {
    expect(loadLabSettings(null)).toEqual(DEFAULT_LAB_SETTINGS);
    const broken = new MemoryStorage();
    broken.setItem(LAB_STORAGE_KEY, '{not json');
    expect(loadLabSettings(broken)).toEqual(DEFAULT_LAB_SETTINGS);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadLabSettings(throwing)).toEqual(DEFAULT_LAB_SETTINGS);
    expect(() =>
      saveLabSettings(
        {
          setItem: () => {
            throw new Error('full');
          },
        },
        DEFAULT_LAB_SETTINGS,
      ),
    ).not.toThrow();
  });

  it('keeps only valid dictionary entries', () => {
    const parsed = parseDictionary({
      swipe_left: 'FOCUS_PREV',
      flick_up: null,
      index_up_hold: 'BOOM',
    });
    expect(parsed.swipe_left).toBe('FOCUS_PREV');
    expect(parsed.flick_up).toBeNull();
    expect(parsed.index_up_hold).toBe(DEFAULT_DICTIONARY.index_up_hold);
    expect(parsed.open_palm_hold).toBe(DEFAULT_DICTIONARY.open_palm_hold);
  });
});

describe('sliders', () => {
  it('read and write every slider path within the clamped bounds', () => {
    for (const slider of TUNING_SLIDERS) {
      const value = readTuningValue(DEFAULT_LAB_SETTINGS.tuning, slider.path);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(slider.min);
      expect(value).toBeLessThanOrEqual(slider.max);
    }
    const tuned = setTuningValue(DEFAULT_TUNING, 'pose.pinchOn', 0.9);
    expect(tuned.pose.pinchOn).toBeLessThan(tuned.pose.pinchOff);
    expect(
      setTuningValue(DEFAULT_TUNING, 'timings.swipe.withinMs', 700).timings.swipe.withinMs,
    ).toBe(700);
  });
});

describe('tuningToCode', () => {
  it('writes the current values as code ready to paste', () => {
    const tuning = setTuningValue(DEFAULT_TUNING, 'timings.holdMs', 700);
    const code = tuningToCode(tuning, { ...DEFAULT_DICTIONARY, flick_up: null });
    expect(code).toContain('export const DEFAULT_TUNING: Tuning = ');
    expect(code).toContain('export const DEFAULT_DICTIONARY: Dictionary = ');
    const tuningJson = code.split('export const DEFAULT_TUNING: Tuning = ')[1]!.split(';\n')[0]!;
    expect(JSON.parse(tuningJson).timings.holdMs).toBe(700);
    expect(code).toContain('"flick_up": null');
  });
});

describe('labStage', () => {
  it('builds two windows, each with a sample content', () => {
    const stage = labStage();
    expect(stage.windows).toHaveLength(2);
    expect(stage.windows.every((w) => w.contents.length === 1)).toBe(true);
    expect(stage.tray).toEqual([]);
  });
});

describe('labCode', () => {
  it('copies the effective tuning, so stability stays off when the toggle is off', () => {
    const code = labCode(DEFAULT_LAB_SETTINGS);
    expect(code).toContain('"frames": 1');
    expect(code).not.toContain('"frames": 3');
    const start = code.indexOf('{');
    const end = code.indexOf('\n};');
    expect(JSON.parse(code.slice(start, end + 2))).toEqual(DEFAULT_TUNING);
  });
});

describe('parseLabSettings', () => {
  it('falls back to the defaults for anything it does not understand', () => {
    expect(parseLabSettings(null)).toEqual(DEFAULT_LAB_SETTINGS);
    expect(parseLabSettings({ toggles: { feedback: 'yes' } })).toEqual(DEFAULT_LAB_SETTINGS);
  });

  it('keeps valid toggles', () => {
    const settings = parseLabSettings({ toggles: { feedback: true } });
    expect(settings.toggles.feedback).toBe(true);
  });
});
