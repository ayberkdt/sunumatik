/* transfer-model.mjs — Lambert transfer kâşifi (saf). ../core/astro-lambert.mjs paylaşılan çözücüsü üstüne:
   r1, r2, TOF, kısa/uzun yol → transfer yayı, v1, v2, kalkış/varış ΔV (dairesel yörüngelerden), v∞'ler,
   transfer açısı, konik elemanları; TOF taraması (ΔV toplam eğrisi) ve Hohmann referansı (Δθ = 180° limiti).

   MODEL: iki-cisim, eş-düzlem ya da 3B (r1, r2 vektör); kalkış/varış yörüngeleri dairesel varsayılır
   (ΔV₁ = |v1 − v_c1|, ΔV₂ = |v_c2 − v2|, v_c teğet dairesel hız). Tek tur Lambert (çok-tur yok). */

import { lambert, propagateKepler, MU_SUN, MU_EARTH, AU } from '../core/astro-lambert.mjs';

export const CENTRAL = Object.freeze({
  sun: { label: 'Güneş', mu: MU_SUN, unit: AU, unitLabel: 'AU' },
  earth: { label: 'Dünya', mu: MU_EARTH, unit: 1000, unitLabel: '×10³ km' },
});
export const PRESETS = Object.freeze({
  leoGeo: { label: 'LEO → GEO (Dünya)', central: 'earth', r1: 6678.137, r2: 42164.17, dth: 180, tof: 5.27 * 3600, tofRange: [1800, 12 * 3600] },
  leoGeoPhased: { label: 'LEO → GEO, Δθ = 150° (Dünya)', central: 'earth', r1: 6678.137, r2: 42164.17, dth: 150, tof: 4.5 * 3600, tofRange: [1800, 12 * 3600] },
  earthMars: { label: 'Dünya → Mars (eş-düzlem dairesel)', central: 'sun', r1: AU, r2: 1.523679 * AU, dth: 180, tof: 259 * 86400, tofRange: [80 * 86400, 600 * 86400] },
  earthMars2: { label: 'Dünya → Mars, Δθ = 120°', central: 'sun', r1: AU, r2: 1.523679 * AU, dth: 120, tof: 180 * 86400, tofRange: [60 * 86400, 600 * 86400] },
  earthJupiter: { label: 'Dünya → Jüpiter', central: 'sun', r1: AU, r2: 5.2044 * AU, dth: 180, tof: 997 * 86400, tofRange: [300 * 86400, 2000 * 86400] },
  earthVenus: { label: 'Dünya → Venüs', central: 'sun', r1: AU, r2: .723332 * AU, dth: 180, tof: 146 * 86400, tofRange: [60 * 86400, 400 * 86400] },
});

const norm = v => Math.hypot(v[0], v[1], v[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Tek transfer. r1 = r1·x̂, r2 = r2·(cos Δθ, sin Δθ, 0); dairesel yörünge hızları teğet. */
export function solveTransfer({ central = 'sun', r1, r2, dth = 180, tof, direction = 'prograde', inc2 = 0 } = {}) {
  const mu = CENTRAL[central].mu, i2 = inc2 * Math.PI / 180;
  /* Δθ = 180° tam tekildir (transfer düzlemi belirsiz, A → 0); eş-düzlem varsayımıyla 0,01° kaydırılır — Hohmann'a 1e-5 bağıl yakınlıkta */
  let th = dth * Math.PI / 180; if (Math.abs(Math.sin(th)) < 1e-9) th -= Math.sign(Math.cos(th) < 0 ? 1 : -1) * 0.01 * Math.PI / 180;
  const R1 = [r1, 0, 0], R2 = [r2 * Math.cos(th), r2 * Math.sin(th) * Math.cos(i2), r2 * Math.sin(th) * Math.sin(i2)];
  const vc1 = Math.sqrt(mu / r1), vc2 = Math.sqrt(mu / r2);
  const Vc1 = [0, vc1, 0], Vc2 = [-vc2 * Math.sin(th), vc2 * Math.cos(th) * Math.cos(i2), vc2 * Math.cos(th) * Math.sin(i2)];
  const L = lambert(R1, R2, tof, mu, direction);
  if (!L) return null;
  const dv1v = sub(L.v1, Vc1), dv2v = sub(Vc2, L.v2), dv1 = norm(dv1v), dv2 = norm(dv2v);
  /* yay örnekleri */
  const arc = []; const N = 160; for (let k = 0; k <= N; k++) arc.push(propagateKepler(R1, L.v1, tof * k / N, mu).r);
  const a = L.a, ecc = Math.sqrt(Math.max(0, 1 - (norm([R1[1] * L.v1[2] - R1[2] * L.v1[1], R1[2] * L.v1[0] - R1[0] * L.v1[2], R1[0] * L.v1[1] - R1[1] * L.v1[0]]) ** 2) / (mu * a)));
  return { mu, R1, R2, Vc1, Vc2, v1: L.v1, v2: L.v2, dv1, dv2, dvTotal: dv1 + dv2, dv1v, dv2v, dtheta: L.dtheta, a, e: ecc, rp: a * (1 - ecc), ra: ecc < 1 ? a * (1 + ecc) : Infinity, arc, tof, direction, vinf1: dv1, vinf2: dv2, iterations: L.iterations };
}

/** Hohmann referansı (eş-düzlem dairesel). */
export function hohmann(mu, r1, r2) {
  const at = (r1 + r2) / 2, vc1 = Math.sqrt(mu / r1), vc2 = Math.sqrt(mu / r2);
  const vp = Math.sqrt(mu * (2 / r1 - 1 / at)), va = Math.sqrt(mu * (2 / r2 - 1 / at));
  return { dv1: Math.abs(vp - vc1), dv2: Math.abs(vc2 - va), dvTotal: Math.abs(vp - vc1) + Math.abs(vc2 - va), tof: Math.PI * Math.sqrt(at ** 3 / mu), a: at };
}

/** TOF taraması: her TOF için kısa ve uzun yol ΔV toplamı. */
export function tofSweep(cfg, tofRange, n = 80) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const tof = tofRange[0] * Math.pow(tofRange[1] / tofRange[0], k / (n - 1));
    const s = solveTransfer({ ...cfg, tof, direction: 'prograde' }), l = solveTransfer({ ...cfg, tof, direction: 'retrograde' });
    out.push({ tof, short: s ? s.dvTotal : NaN, long: l ? l.dvTotal : NaN });
  }
  let best = null; for (const p of out) for (const [k, v] of [['short', p.short], ['long', p.long]]) if (Number.isFinite(v) && (!best || v < best.dv)) best = { tof: p.tof, dv: v, way: k };
  return { points: out, best };
}
