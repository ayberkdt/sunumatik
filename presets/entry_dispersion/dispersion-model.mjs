/* dispersion-model.mjs — Giriş dağılımı (Monte Carlo) ve duyarlılık analizi, SAF model.
   Gerçek model: ../reentry_corridor/reentry-model.mjs simulateEntry (düzlemsel giriş dinamiği, US76 + Vallado
   termosfer, Sutton–Graves ısı akısı). Bu modül sapmaları örnekler (tohumlu Gauss), her örneği entegre eder,
   menzil (downrange) ve tepe yük istatistiklerini, tek-değişken duyarlılıklarını (merkezi fark) ve doğrusal
   RSS tahminini (σ_s² ≈ Σ (∂s/∂x_i σ_i)²) Monte Carlo σ ile karşılaştırır — doğrusallık ölçüsü.
   Hiçbir sayı elle yerleştirilmez; her istatistik simülasyondan çıkar. */

import { simulateEntry, VEHICLES, DEFAULT_ENTRY } from '../reentry_corridor/reentry-model.mjs';
export { VEHICLES };

function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gaussian(rand) { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export const SCENARIOS = Object.freeze({
  leoNominal: { label: 'LEO kapsül · nominal sapmalar', vehicle: 'capsuleLeo', entry: { gammaEntry: -1.6, vEntry: 7800 }, sigmas: { gamma: .05, v: 10, rhoScale: .10, ld: .05, mass: .01, bank: 3 } },
  leoSteep: { label: 'LEO kapsül · dik giriş (γ −3°)', vehicle: 'capsuleLeo', entry: { gammaEntry: -3.0, vEntry: 7800 }, sigmas: { gamma: .05, v: 10, rhoScale: .10, ld: .05, mass: .01, bank: 3 } },
  lunar: { label: 'Ay dönüşü kapsül (11 km/s, yatış 60°)', vehicle: 'capsule', entry: { gammaEntry: -6.5, vEntry: 11000, bank: 60 }, sigmas: { gamma: .05, v: 10, rhoScale: .10, ld: .05, mass: .01, bank: 3 } },
  nav: { label: 'LEO kapsül · yalnız seyrüsefer (γ, v) sapması', vehicle: 'capsuleLeo', entry: { gammaEntry: -1.6, vEntry: 7800 }, sigmas: { gamma: .1, v: 20, rhoScale: 0, ld: 0, mass: 0, bank: 0 } },
  atmo: { label: 'LEO kapsül · yalnız atmosfer sapması (±20 %)', vehicle: 'capsuleLeo', entry: { gammaEntry: -1.6, vEntry: 7800 }, sigmas: { gamma: 0, v: 0, rhoScale: .20, ld: 0, mass: 0, bank: 0 } },
  ballistic: { label: 'Balistik sonda · nominal sapmalar', vehicle: 'ballistic', entry: { gammaEntry: -8.0, vEntry: 7600 }, sigmas: { gamma: .1, v: 10, rhoScale: .10, ld: 0, mass: .02, bank: 0 } },
});
export const PARAMS = Object.freeze([
  { key: 'gamma', label: 'γ_giriş', unit: '°', apply: (V, E, d) => { E.gammaEntry += d; } },
  { key: 'v', label: 'v_giriş', unit: 'm/s', apply: (V, E, d) => { E.vEntry += d; } },
  { key: 'rhoScale', label: 'ρ ölçeği', unit: '', apply: (V, E, d) => { E.rhoScale = (E.rhoScale ?? 1) * (1 + d); } },
  { key: 'ld', label: 'L/D', unit: '', apply: (V, E, d) => { V.ld *= (1 + d); } },
  { key: 'mass', label: 'kütle', unit: '', apply: (V, E, d) => { V.m *= (1 + d); } },
  { key: 'bank', label: 'yatış', unit: '°', apply: (V, E, d) => { E.bank = (E.bank ?? DEFAULT_ENTRY.bank ?? 0) + d; } },
]);

function runOne(vehicleId, entry, dev) {
  const V = { ...VEHICLES[vehicleId] }, E = { ...entry };
  for (const p of PARAMS) if (dev[p.key]) p.apply(V, E, dev[p.key]);
  const r = simulateEntry(V, E); const L = r.samples[r.samples.length - 1];
  return { s: L.s / 1000, peakG: r.peakG.n, peakQ: r.peakQ.q / 1e4, Q: L.Q / 1e6, outcome: r.outcome, samples: r.samples, dev };
}
const mean = a => a.reduce((s, v) => s + v, 0) / a.length, std = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const quantile = (sorted, q) => { const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };

/**
 * runDispersion(scenarioId, { n, seed, sigmas }) → { cfg, nominal, runs, stats:{ s:{mean,std,p05,p50,p95,min,max}, peakG:{...}, Q:{...} },
 *   sens:[{key,label,unit,sigma,dsdx,contrib,share}], rssSigma, mcSigma, linearity, skipouts, keep }
 */
export function runDispersion(id = 'leoNominal', { n = 200, seed = 20260906, sigmas = null, keepTraj = 40 } = {}) {
  const base = SCENARIOS[id] ?? SCENARIOS.leoNominal, cfg = { ...base, sigmas: { ...base.sigmas, ...(sigmas || {}) }, n, seed };
  const rand = mulberry32(seed), g = () => gaussian(rand);
  const nominal = runOne(cfg.vehicle, cfg.entry, {});
  const runs = [];
  for (let k = 0; k < n; k++) { const dev = {}; for (const p of PARAMS) dev[p.key] = cfg.sigmas[p.key] ? cfg.sigmas[p.key] * g() : 0; const r = runOne(cfg.vehicle, cfg.entry, dev); if (k >= keepTraj) r.samples = null; runs.push(r); }
  const landed = runs.filter(r => r.outcome === 'landed');
  const statsOf = key => { const a = landed.map(r => r[key]).sort((x, y) => x - y); return a.length ? { mean: mean(a), std: std(a), p05: quantile(a, .05), p50: quantile(a, .5), p95: quantile(a, .95), min: a[0], max: a[a.length - 1] } : null; };
  const stats = { s: statsOf('s'), peakG: statsOf('peakG'), Q: statsOf('Q'), peakQ: statsOf('peakQ') };
  /* tek-değişken duyarlılıklar: merkezi fark ±σ */
  const sens = PARAMS.map(p => { const sg = cfg.sigmas[p.key] || 0; if (!sg) return { key: p.key, label: p.label, unit: p.unit, sigma: 0, dsdx: 0, dGdx: 0, contrib: 0 }; const plus = runOne(cfg.vehicle, cfg.entry, { [p.key]: sg }), minus = runOne(cfg.vehicle, cfg.entry, { [p.key]: -sg }); const dsdx = (plus.s - minus.s) / (2 * sg), dGdx = (plus.peakG - minus.peakG) / (2 * sg); return { key: p.key, label: p.label, unit: p.unit, sigma: sg, dsdx, dGdx, contrib: dsdx * sg }; });
  const rssSigma = Math.sqrt(sens.reduce((a, x) => a + x.contrib * x.contrib, 0)); const tot = sens.reduce((a, x) => a + x.contrib * x.contrib, 0) || 1; for (const x of sens) x.share = x.contrib * x.contrib / tot;
  const mcSigma = stats.s ? stats.s.std : NaN;
  return { cfg, nominal, runs, stats, sens, rssSigma, mcSigma, linearity: mcSigma ? rssSigma / mcSigma : NaN, skipouts: runs.length - landed.length, keep: keepTraj, vehicle: VEHICLES[cfg.vehicle] };
}
