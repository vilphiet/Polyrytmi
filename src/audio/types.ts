export type Waveform = OscillatorType;

export interface RhythmLayer {
  id: string;
  n: number;
  color: string;
  waveform: Waveform;
  frequency: number;
  volume: number;
  muted: boolean;
  hidden: boolean;
}

export interface BeatEvent {
  layerId: string;
  time: number;
  vertexIndex: number;
  isAccent: boolean;
}
