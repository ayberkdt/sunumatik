/* geo-sk-model.mjs — GEO istasyon tutma bütçesi, SAF model.

   DOĞU–BATI (boylam): Dünya'nın ekvator elipsliği (tesseral C̄22, S̄22 — gravity_field modülündeki GERÇEK EGM96
   değerleri) GEO'da teğetsel ivme üretir: U₂₂ = (μ/r)(R/r)² P̄₂₂(0)(C̄₂₂cos2λ + S̄₂₂sin2λ), a_λ = (1/r)∂U₂₂/∂λ.
   Doğuya ivme yörüngeyi büyütür → batıya sürüklenme: λ̈ = −3a_λ/r. Denge boylamları a_λ = 0 kökleridir (Newton);
   kararlı olanlar λ̈ eğimi negatif olanlar. Yıllık ΔV_DB(λ) = |a_λ(λ)|·(1 yıl) (istasyonu sabit tutmak için ivmeyi
   sürekli iptal etme). J31/J33 katkıları ihmal (kararsız noktaları birkaç derece kaydırır — belirtilir).
   KUZEY–GÜNEY: Ay + Güneş üçüncü-cisim çekimi (orbit_perturbations/acceleration ile 1 yıl RK4) eğiklik vektörünü
   sürükler; ΔV_KG = V_geo·Δi (rad). SRP: eksantriklik doğal çemberi (sayısal, 1 yıl).
   Tüm sayılar bu hesaplardan çıkar; literatür karşılaştırması denetimde (kararlı 75°D / 105°B, Δi ≈ 0,8°/yıl, ~45 m/s). */

import { REAL_LOW_DEGREE, GM as GM_SI, R as R_SI } from '../gravity_field/gravity-model.mjs';
const GM = GM_SI > 1e8 ? GM_SI / 1e9 : GM_SI, R = R_SI > 1e5 ? R_SI / 1000 : R_SI;   // gravity-model SI (m) → km
import { propagatePerturbed, rvToElements } from '../orbit_perturbations/perturbation-model.mjs';

export const R_GEO = 42164.17, V_GEO = Math.sqrt(GM / R_GEO), OMEGA_E = 7.2921159e-5, YEAR = 365.25 * 86400, G0 = 9.80665e-3;
const c22 = REAL_LOW_DEGREE.find(c => c.l === 2 && c.m === 2), C22 = c22.C, S22 = c22.S;
export const P22_0 = 3 * Math.sqrt(5 / 12);   // tam normalize P̄22(sin φ = 0)
export const COEFF = Object.freeze({ C22, S22 });

/** Teğetsel (doğu) ivme km/s² ve boylam ivmesi rad/s² (λ radyan, doğu pozitif). */
export function eastAccel(lam, r = R_GEO) { const k = (GM / r) * (R / r) ** 2 * P22_0; return (k / r) * 2 * (-C22 * Math.sin(2 * lam) + S22 * Math.cos(2 * lam)); }
export const lonAccel = (lam, r = R_GEO) => -3 * eastAccel(lam, r) / r;
/** Yıllık doğu–batı ΔV (m/s) belirli boylamda. */
export const dvEastWestPerYear = lamDeg => Math.abs(eastAccel(lamDeg * Math.PI / 180)) * YEAR * 1000;
/** Denge boylamları: a_λ = 0 kökleri (analitik: tan 2λ = S22/C22 → 4 kök), kararlılık λ̈ eğiminden. */
export function equilibria() {
  const base = .5 * Math.atan2(S22, C22); const out = [];
  for (let k = 0; k < 4; k++) { let lam = base + k * Math.PI / 2; lam = Math.atan2(Math.sin(lam), Math.cos(lam)); const h = 1e-6; const slope = (lonAccel(lam + h) - lonAccel(lam - h)) / (2 * h); out.push({ lonDeg: lam * 180 / Math.PI, stable: slope < 0, residual: Math.abs(eastAccel(lam)) }); }
  return out.sort((a, b) => a.lonDeg - b.lonDeg);
}
/** Serbest sürüklenme: λ(t) (yıl) küçük genlikli libration periyodu kararlı nokta çevresinde T = 2π/√(−dλ̈/dλ). */
export function librationPeriodYears() { const st = equilibria().find(e => e.stable); const lam = st.lonDeg * Math.PI / 180, h = 1e-6; const slope = (lonAccel(lam + h) - lonAccel(lam - h)) / (2 * h); return 2 * Math.PI / Math.sqrt(-slope) / YEAR; }
/** Sürüklenme simülasyonu: λ̈ = lonAccel, λ(0) = λ0, λ̇(0) = 0, N yıl (RK4). */
export function driftTrajectory(lon0Deg, years = 6, dt = 86400) { let lam = lon0Deg * Math.PI / 180, ld = 0, t = 0; const out = [{ t: 0, lonDeg: lon0Deg }]; const f = (l, v) => [v, lonAccel(l)]; while (t < years * YEAR) { const k1 = f(lam, ld), k2 = f(lam + .5 * dt * k1[0], ld + .5 * dt * k1[1]), k3 = f(lam + .5 * dt * k2[0], ld + .5 * dt * k2[1]), k4 = f(lam + dt * k3[0], ld + dt * k3[1]); lam += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); ld += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); t += dt; if (out.length < 3000) out.push({ t, lonDeg: lam * 180 / Math.PI }); } return out; }

/** Kuzey–güney: 1 yıl Ay+Güneş (RK4) → eğiklik vektörü izi ve Δi. */
export function northSouth({ days = 365, dt = 300, raan0 = 0 } = {}) {
  const run = propagatePerturbed('moonGeo', { days, dt, el: { raan: raan0, i: .05 }, forces: { j2: true, moon: true, sun: true } });
  const trace = run.samples.map(s => ({ t: s.t, ix: s.el.i * Math.cos(s.el.raan) * 180 / Math.PI, iy: s.el.i * Math.sin(s.el.raan) * 180 / Math.PI, i: s.el.i * 180 / Math.PI }));
  const i0 = trace[0], iN = trace[trace.length - 1]; const di = Math.hypot(iN.ix - i0.ix, iN.iy - i0.iy) * (365.25 / days);   // °/yıl
  return { trace, diPerYear: di, dvPerYear: V_GEO * di * Math.PI / 180 * 1000, driftDirDeg: Math.atan2(iN.iy - i0.iy, iN.ix - i0.ix) * 180 / Math.PI };
}
/** SRP: eksantriklik doğal çemberi (1 yıl sayısal). */
export function srpEccentricity({ crAm = 1.3 * .04, days = 365, dt = 600 } = {}) {
  const run = propagatePerturbed('srpGeo', { days, dt, crAm, forces: { j2: true, srp: true } });
  const es = run.samples.map(s => s.el.e); return { eMax: Math.max(...es), eMean: es.reduce((a, b) => a + b, 0) / es.length, trace: run.samples.map(s => ({ t: s.t, ex: s.el.e * Math.cos(s.el.raan + s.el.argp), ey: s.el.e * Math.sin(s.el.raan + s.el.argp) })) };
}
/** Bütçe: seçilen boylamda yıllık DB, KG, toplam; görev ömrü yakıtı (Tsiolkovsky) kimyasal vs elektrikli. */
export function budget({ lonDeg = 42, years = 15, m0 = 3000, ispChem = 300, ispEp = 1500, ns = null } = {}) {
  const ew = dvEastWestPerYear(lonDeg), nsr = ns ?? northSouth(); const total = ew + nsr.dvPerYear;
  const prop = (isp) => m0 * (1 - Math.exp(-total * years / 1000 / (G0 * isp)));
  return { lonDeg, ewPerYear: ew, nsPerYear: nsr.dvPerYear, totalPerYear: total, lifetimeDv: total * years, propChem: prop(ispChem), propEp: prop(ispEp), years, m0, ns: nsr };
}
