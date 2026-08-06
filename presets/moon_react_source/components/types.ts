export type TextureMode = 'aesthetic' | 'gravity';

export type OrbitPathData = {
  path: number[][];
  future_paths?: Record<string, number[][]>;
};

export type OrbitDataset = Record<string, OrbitPathData>;

export type LunarisVisualStyle = 'cinematic' | 'matte';
