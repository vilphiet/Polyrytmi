import type { RhythmLayer, Waveform } from '../audio/types';

const WAVEFORM_OPTIONS: Waveform[] = ['sine', 'triangle', 'square', 'sawtooth'];

interface Props {
  layers: RhythmLayer[];
  onUpdate: (id: string, patch: Partial<RhythmLayer>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function LayerPanel({ layers, onUpdate, onRemove, onAdd }: Props) {
  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <h2>Kerrokset</h2>
        <button type="button" className="add-layer-btn" onClick={onAdd}>
          + Lisää kerros
        </button>
      </div>
      <div className="layer-list">
        {layers.map((layer) => (
          <div className="layer-row" key={layer.id} style={{ borderColor: layer.color }}>
            <input
              type="color"
              className="layer-color"
              value={layer.color}
              onChange={(e) => onUpdate(layer.id, { color: e.target.value })}
              title="Väri"
            />

            <label className="layer-field layer-n">
              <span>N</span>
              <input
                type="number"
                min={1}
                max={64}
                value={layer.n}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(64, Number(e.target.value) || 1));
                  onUpdate(layer.id, { n });
                }}
              />
            </label>

            <label className="layer-field">
              <span>Aaltomuoto</span>
              <select
                value={layer.waveform}
                onChange={(e) => onUpdate(layer.id, { waveform: e.target.value as Waveform })}
              >
                {WAVEFORM_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>

            <label className="layer-field layer-freq">
              <span>Hz</span>
              <input
                type="number"
                min={20}
                max={2000}
                value={Math.round(layer.frequency)}
                onChange={(e) => onUpdate(layer.id, { frequency: Number(e.target.value) || 0 })}
              />
            </label>

            <label className="layer-field layer-volume">
              <span>Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.volume}
                onChange={(e) => onUpdate(layer.id, { volume: Number(e.target.value) })}
              />
            </label>

            <button
              type="button"
              className={`icon-btn${layer.muted ? ' active' : ''}`}
              title={layer.muted ? 'Poista mykistys' : 'Mykistä'}
              onClick={() => onUpdate(layer.id, { muted: !layer.muted })}
            >
              {layer.muted ? 'Mykistetty' : 'Mykistä'}
            </button>

            <button
              type="button"
              className={`icon-btn${layer.hidden ? ' active' : ''}`}
              title={layer.hidden ? 'Näytä' : 'Piilota'}
              onClick={() => onUpdate(layer.id, { hidden: !layer.hidden })}
            >
              {layer.hidden ? 'Piilotettu' : 'Piilota'}
            </button>

            <button
              type="button"
              className="icon-btn remove"
              title="Poista kerros"
              onClick={() => onRemove(layer.id)}
              disabled={layers.length <= 1}
            >
              Poista
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
