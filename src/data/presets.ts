export interface RatioPreset {
  label: string;
  values: number[];
}

export const PRESETS: RatioPreset[] = [
  { label: '2:3', values: [2, 3] },
  { label: '3:4', values: [3, 4] },
  { label: '3:5', values: [3, 5] },
  { label: '4:5', values: [4, 5] },
  { label: '5:4', values: [5, 4] },
  { label: '5:7', values: [5, 7] },
  { label: '6:4', values: [6, 4] },
  { label: '7:8', values: [7, 8] },
];
