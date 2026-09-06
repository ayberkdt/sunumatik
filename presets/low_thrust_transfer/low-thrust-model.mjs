/* low-thrust-model.mjs — Düşük itkili (elektrikli) transfer laboratuvarı, SAF model.

   SAYISAL: düzlemsel iki-cisim + sürekli teğetsel itki (RK4, ivme a_T = T/m(t), ṁ = −T/(g₀ Isp)),
   Dünya gölgesi opsiyonel (silindirik gölge: itki kesilir), hedef yarıçapa ulaşınca durur; ΔV = ∫ a_T dt.
   ANALİTİK: Edelbaum (1961) dairesel→dairesel eğiklik değişimli transfer ΔV = √(v₀² + v₁² − 2v₀v₁cos(πΔi/2));
   eş-düzlemde ΔV = |v₀ − v₁| (spiral limiti, T/m → 0). Karşılaştırma: Hohmann (impulsif) ΔV ve süre; Tsiolkovsky
   kütle oranı. Sayısal sonuç Edelbaum limitine T/m küçüldükçe yaklaşır; denetim scripts/validate-astro.mjs.
   İtki düşük olduğu sürece a(t) ≈ dairesel; eksantriklik küçük kalır (HUD'da raporlanır). */

import { MU, R_E, OMEGA_E } from '../core/astro-orbit.mjs';
export { MU, R_E };
export const G0 = 9.80665e-3;   // km/s²

export const VEHICLES = Object.freeze({
  hallGeo: { label: 'GEO haberleşme uydusu · Hall itici', m0: 5000, thrust: .6, isp: 1800 },          // N, s
  ionSmall: { label: 'Küçük uydu · iyon itici', m0: 500, thrust: .05, isp: 3000 },
  cubesat: { label: 'CubeSat · elektrosprey', m0: 12, thrust: .001, isp: 1200 },
  cargo: { label: 'Kargo çekici · yüksek güç Hall', m0: 20000, thrust: 5, isp: 2500 },
});
export const SCENARIOS = Object.freeze({
  gtoLikeLeoGeo: { label: 'LEO → GEO (eş-düzlem)', r0: 6678.137, r1: 42164.17, di: 0, vehicle: 'hallGeo', shadow: false },
  leoGeoIncl: { label: 'LEO → GEO, Δi = 28,5° (Edelbaum)', r0: 6678.137, r1: 42164.17, di: 28.5, vehicle: 'hallGeo', shadow: false },
  leoGeoShadow: { label: 'LEO → GEO, gölgede itki yok', r0: 6678.137, r1: 42164.17, di: 0, vehicle: 'hallGeo', shadow: true },
  leoRaise: { label: 'LEO 400 → 800 km (CubeSat)', r0: 6778.137, r1: 7178.137, di: 0, vehicle: 'cubesat', shadow: false },
  meoIon: { label: 'LEO → MEO 20 200 km (iyon)', r0: 6878.137, r1: 26578.137, di: 0, vehicle: 'ionSmall', shadow: false },
  cargoGeo: { label: 'LEO → GEO kargo (5 N)', r0: 6678.137, r1: 42164.17, di: 0, vehicle: 'cargo', shadow: false },
});

export const vCirc = r => Math.sqrt(MU / r);
/** Edelbaum ΔV (km/s): v₀, v₁ dairesel hızlar, Δi derece. */
export function edelbaumDv(r0, r1, diDeg) { const v0 = vCirc(r0), v1 = vCirc(r1), a = diDeg * Math.PI / 180; return Math.sqrt(v0 * v0 + v1 * v1 - 2 * v0 * v1 * Math.cos(Math.PI / 2 * a)); }
/** Hohmann ΔV (eş-düzlem) ve süre. */
export function hohmann(r0, r1) { const at = (r0 + r1) / 2, v0 = vCirc(r0), v1 = vCirc(r1), vp = Math.sqrt(MU * (2 / r0 - 1 / at)), va = Math.sqrt(MU * (2 / r1 - 1 / at)); return { dv: Math.abs(vp - v0) + Math.abs(v1 - va), tof: Math.PI * Math.sqrt(at ** 3 / MU) }; }
/** Tsiolkovsky: kütle oranı ve yakıt. */
export function propellant(m0, dv, isp) { const mf = m0 * Math.exp(-dv / (G0 * isp)); return { mf, mp: m0 - mf, ratio: mf / m0 }; }

/**
 * simulateSpiral({ r0, r1, di, vehicle, shadow, dt, maxDays, sunDir }) → { samples:[{t, r, v, a, e, m, dv, thrustOn, inc}], dvTotal, tof, mf, mp, edelbaum, hohmann, revs, eMax, aT0, aT1, dutyCycle, reached }
 * Eğiklik değişimi Edelbaum yaw kanunuyla (β sabit ~ optimal: tan β₀ = sin(πΔi/2)/(v₀/v₁ − cos(πΔi/2))) — düzlem-dışı
 * bileşen ortalama eğiklik değişimi olarak analitik entegre edilir (düzlemsel simülasyon + Edelbaum eğiklik yasası).
 */
export function simulateSpiral({ r0, r1, di = 0, vehicle = 'hallGeo', shadow = false, dt = null, maxDays = 900, sunDir = [1, 0], stepsPerRev = 200 } = {}) {
  const V = typeof vehicle === 'object' && vehicle ? vehicle : (VEHICLES[vehicle] ?? VEHICLES.hallGeo); const T = V.thrust / 1000;   // kN → km·kg/s² ; a = T/m km/s²
  const mdot = V.thrust / (G0 * 1000 * V.isp);                                    // kg/s  (T[N] / (g0[m/s²]·Isp))
  const outward = r1 > r0, v0c = vCirc(r0), v1c = vCirc(r1);
  const a0 = T / V.m0; const stepFor = a => dt ?? Math.max(5, Math.min(600, 2 * Math.PI * Math.sqrt(Math.abs(a) ** 3 / MU) / stepsPerRev));   // adım: yörünge büyüdükçe büyür
  /* Edelbaum yaw: β₀ (radyan), eğiklik hızı; toplam Δi ΔV ile orantılı dağıtılır (Edelbaum'un kapalı biçimi) */
  const dvEd = edelbaumDv(r0, r1, di), diRad = di * Math.PI / 180;
  const beta0 = di > 0 ? Math.atan2(Math.sin(Math.PI / 2 * diRad), v0c / v1c - Math.cos(Math.PI / 2 * diRad)) : 0;
  let s = [r0, 0, 0, v0c], m = V.m0, t = 0, dv = 0, onTime = 0; const samples = [], path = []; /* path: [t, x, y, on] her 2 adımda (çizim için yoğun iz) */ let eMax = 0, revs = 0, reached = false;
  const state = (x, y, vx, vy) => { const r = Math.hypot(x, y), v = Math.hypot(vx, vy), eps = v * v / 2 - MU / r, a = -MU / (2 * eps); const hz = x * vy - y * vx; const e = Math.sqrt(Math.max(0, 1 - hz * hz / (MU * a))); return { r, v, a, e }; };
  const inShadow = (x, y) => shadow && (x * sunDir[0] + y * sunDir[1]) < 0 && Math.abs(x * sunDir[1] - y * sunDir[0]) < R_E;
  const f = (st, aT, on) => { const [x, y, vx, vy] = st, r = Math.hypot(x, y), v = Math.hypot(vx, vy); const g = -MU / (r * r * r); const tx = on ? aT * (outward ? 1 : -1) * vx / v : 0, ty = on ? aT * (outward ? 1 : -1) * vy / v : 0; return [vx, vy, g * x + tx, g * y + ty]; };
  const maxT = maxDays * 86400; let k = 0, h = stepFor(r0);
  while (t < maxT) {
    const { r, v, a, e } = state(...s); h = stepFor(a);
    const on = !inShadow(s[0], s[1]);
    /* Edelbaum: düzlem-içi bileşen cos β, düzlem-dışı sin β; β(t): tan β = sin β₀ v₀ / (v₀ cos β₀ − ΔV) */
    const vEff = v0c; const beta = di > 0 ? Math.atan2(vEff * Math.sin(beta0), vEff * Math.cos(beta0) - dv) : 0;
    const aT = T / m, aIn = aT * Math.cos(beta);
    if (k % 2 === 0) path.push(t, s[0], s[1], on ? 1 : 0);
    if (k % 25 === 0) samples.push({ t, x: s[0], y: s[1], r, v, a, e, m, dv, thrustOn: on, inc: di > 0 ? Math.min(di, di * (dv / dvEd)) : 0, beta: beta * 180 / Math.PI });
    if (outward ? a >= r1 : a <= r1) { reached = true; break; }
    const k1 = f(s, aIn, on), s2 = s.map((q, i) => q + .5 * h * k1[i]), k2 = f(s2, aIn, on), s3 = s.map((q, i) => q + .5 * h * k2[i]), k3 = f(s3, aIn, on), s4 = s.map((q, i) => q + h * k3[i]), k4 = f(s4, aIn, on);
    const ang0 = Math.atan2(s[1], s[0]);
    s = s.map((q, i) => q + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); t += h; k++;
    if (on) { dv += aT * h; m -= mdot * h; onTime += h; }
    const ang1 = Math.atan2(s[1], s[0]); if (ang0 > 0 && ang1 < 0 && Math.abs(ang0 - ang1) > Math.PI) revs++;
    eMax = Math.max(eMax, e);
  }
  const last = state(...s); samples.push({ t, x: s[0], y: s[1], r: last.r, v: last.v, a: last.a, e: last.e, m, dv, thrustOn: false, inc: di > 0 ? Math.min(di, di * (dv / dvEd)) : 0, beta: 0 });
  const hoh = hohmann(r0, r1), prop = propellant(V.m0, dv, V.isp);
  path.push(t, s[0], s[1], 0);
  return { samples, path: Float64Array.from(path), dvTotal: dv, tof: t, mf: m, mp: V.m0 - m, edelbaum: dvEd, edelbaumCoplanar: Math.abs(v0c - v1c), hohmann: hoh, hohmannProp: propellant(V.m0, hoh.dv, 320), revs, eMax, aT0: a0, aT1: T / m, dutyCycle: t ? onTime / t : 1, reached, vehicle: V, r0, r1, di, steps: k, thrustToWeight: a0 / (MU / (r0 * r0)) };
}
