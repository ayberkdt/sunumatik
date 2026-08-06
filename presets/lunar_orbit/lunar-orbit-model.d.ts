export const LUNAR_RADIUS_KM: number;
export const LUNAR_MU_KM3_S2: number;
export type OrbitOptions = {
  meanAltitudeKm?: number;
  eccentricity?: number;
  inclinationDeg?: number;
  ascendingNodeDeg?: number;
  meanAnomaly?: number;
};
export type OrbitPoint = { x: number; y: number; z: number; radiusKm: number };
export function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number, iterations?: number): number;
export function orbitPeriodSeconds(meanAltitudeKm: number, mu?: number): number;
export function positionAtMeanAnomaly(options?: OrbitOptions): OrbitPoint;
export function makeOrbitPoints(options?: OrbitOptions, segments?: number): OrbitPoint[];
export function formatPeriod(seconds: number): string;
