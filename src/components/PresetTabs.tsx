import type { RatioPreset } from '../data/presets';

interface Props {
  presets: RatioPreset[];
  activeLabel: string | null;
  onSelect: (preset: RatioPreset) => void;
}

export function PresetTabs({ presets, activeLabel, onSelect }: Props) {
  return (
    <div className="preset-tabs">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className={`preset-tab${preset.label === activeLabel ? ' active' : ''}`}
          onClick={() => onSelect(preset)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
