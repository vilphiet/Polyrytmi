interface Props {
  isPlaying: boolean;
  bpm: number;
  bpmRange: { min: number; max: number };
  onToggle: () => void;
  onReset: () => void;
  onBpmChange: (bpm: number) => void;
}

export function TransportBar({ isPlaying, bpm, bpmRange, onToggle, onReset, onBpmChange }: Props) {
  return (
    <div className="transport-bar">
      <div className="transport-buttons">
        <button type="button" className="transport-btn primary" onClick={onToggle}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="transport-btn" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="tempo-control">
        <label htmlFor="bpm-slider">Tempo</label>
        <input
          id="bpm-slider"
          type="range"
          min={bpmRange.min}
          max={bpmRange.max}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
        />
        <span className="tempo-value">{bpm} BPM</span>
      </div>
    </div>
  );
}
