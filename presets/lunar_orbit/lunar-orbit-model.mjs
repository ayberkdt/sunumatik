export const LUNAR_RADIUS_KM = 1737.4;
export const LUNAR_MU_KM3_S2 = 4902.8;

const radians = degrees => degrees * Math.PI / 180;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function solveEccentricAnomaly(meanAnomaly, eccentricity, iterations = 12) {
  const e = clamp(Number(eccentricity), 0, .95);
  const tau = Math.PI * 2;
  const m = ((Number(meanAnomaly) % tau) + tau) % tau;
  let E = e < .8 ? m : Math.PI;
  for (let index = 0; index < iterations; index += 1) {
    const delta = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return E;
}

export function orbitPeriodSeconds(meanAltitudeKm, mu = LUNAR_MU_KM3_S2) {
  const semimajorAxis = LUNAR_RADIUS_KM + Math.max(1, Number(meanAltitudeKm));
  return 2 * Math.PI * Math.sqrt(semimajorAxis ** 3 / mu);
}

export function positionAtMeanAnomaly(options = {}) {
  const meanAltitudeKm = Math.max(1, Number(options.meanAltitudeKm ?? 100));
  const eccentricity = clamp(Number(options.eccentricity ?? .05), 0, .7);
  const inclination = radians(Number(options.inclinationDeg ?? 90));
  const node = radians(Number(options.ascendingNodeDeg ?? 0));
  const a = LUNAR_RADIUS_KM + meanAltitudeKm;
  const E = solveEccentricAnomaly(Number(options.meanAnomaly ?? 0), eccentricity);
  const xOrbital = a * (Math.cos(E) - eccentricity);
  const yOrbital = a * Math.sqrt(1 - eccentricity ** 2) * Math.sin(E);
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosInc = Math.cos(inclination);
  const sinInc = Math.sin(inclination);
  return {
    x: cosNode * xOrbital - sinNode * cosInc * yOrbital,
    y: sinNode * xOrbital + cosNode * cosInc * yOrbital,
    z: sinInc * yOrbital,
    radiusKm: Math.hypot(xOrbital, yOrbital),
  };
}

export function makeOrbitPoints(options = {}, segments = 240) {
  const count = Math.max(24, Math.floor(segments));
  return Array.from({ length: count + 1 }, (_, index) => positionAtMeanAnomaly({
    ...options,
    meanAnomaly: index / count * Math.PI * 2,
  }));
}

export function formatPeriod(seconds) {
  const hours = seconds / 3600;
  return hours < 10 ? `${hours.toFixed(2)} h` : `${hours.toFixed(1)} h`;
}
