/* perturbation-model.mjs — Yörünge pertürbasyonları (saf, THREE'siz).
   orbit_perturbations preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.

   GERÇEK MODEL (ECI, km, s; RK4 sabit adım):
   • İki-cisim: a = −μ r/r³ (μ = 398600,4418).
   • J2 (yassılık): a_J2 = (3/2) J2 μ R²/r⁴ · [ x/r (5z²/r² − 1), y/r (5z²/r² − 1), z/r (5z²/r² − 3) ]
     (J2 = 1,08262668e−3, R = 6378,137). Sekülar oranlar (Ω̇, ω̇, Ṁ) ../core/astro-orbit.mjs'ten
     karşılaştırma için: pertürbasyon modelden ÇIKAR, sallantı çizilmez.
   • Sürükleme: a_D = −½ ρ (C_D A/m) |v_rel| v_rel, v_rel = v − ω_e × r (dönen atmosfer); ρ < 86 km US76,
     ≥ 90 km üstel-tablo termosferi (Vallado Tablo 8-4; ../core/astro-atmosphere.mjs densityBlend) —
     ortalama güneş aktivitesi; gerçek yoğunluk aktiviteyle 10× değişir (ilan edilir).
   • Güneş radyasyon basıncı (top model): a_SRP = −P_☉ C_R (A/m) ŝ, P_☉ = 4,56e−6 N/m² (1 AU),
     ŝ Güneş yönü (ekliptikte sabit ya da yıllık dönen), silindirik gölge (Dünya arkasında sıfır).
   • Üçüncü cisim (Ay): a_3 = μ_m [ (r_m − r)/|r_m − r|³ − r_m/|r_m|³ ], Ay dairesel yörüngede (384 400 km,
     eğiklik 23,4°'ye 5,1° eklenmeden ekvatora ~23° — basitleştirilmiş), Güneş de aynı biçimde (isteğe bağlı).
   • Oskülatör elemanlar her örnekte durumdan; "ortalama" elemanlar bir periyot penceresiyle koşan ortalama.
   • Korunum denetimleri: yalnız J2'de enerji (J2 potansiyeli dahil) ve H_z korunur; sürüklemede enerji azalır. */

import { densityBlend } from '../core/astro-atmosphere.mjs';
import { j2Rates, MU, R_E, J2, OMEGA_E, TAU } from '../core/astro-orbit.mjs';

export { MU, R_E, J2, OMEGA_E };
export const MU_MOON = 4902.800066, MU_SUN = 1.32712440018e11, AU = 149597870.7, P_SUN = 4.56e-6;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);

/** Durum → oskülatör elemanlar (rad). */
export function rvToElements(r, v, mu = MU) {
  const rn = norm(r), v2 = dot(v, v), rdotv = dot(r, v);
  const h = cross(r, v), hn = norm(h);
  const ev = [(v2 - mu / rn) * r[0] / mu - rdotv * v[0] / mu, (v2 - mu / rn) * r[1] / mu - rdotv * v[1] / mu, (v2 - mu / rn) * r[2] / mu - rdotv * v[2] / mu];
  const e = norm(ev), a = 1 / (2 / rn - v2 / mu), i = Math.acos(Math.max(-1, Math.min(1, h[2] / hn)));
  const n = [-h[1], h[0], 0], nn = Math.hypot(n[0], n[1]);
  let raan = 0, argp = 0, nu = 0;
  if (nn > 1e-12) { raan = Math.atan2(n[1], n[0]); if (e > 1e-10) { argp = Math.acos(Math.max(-1, Math.min(1, dot(n, ev) / (nn * e)))); if (ev[2] < 0) argp = TAU - argp; } }
  else if (e > 1e-10) { argp = Math.atan2(ev[1], ev[0]); if (h[2] < 0) argp = TAU - argp; }
  if (e > 1e-10) { nu = Math.acos(Math.max(-1, Math.min(1, dot(ev, r) / (e * rn)))); if (rdotv < 0) nu = TAU - nu; }
  return { a, e, i, raan: (raan + TAU) % TAU, argp: (argp + TAU) % TAU, nu, h: hn, hz: h[2], energy: v2 / 2 - mu / rn, rp: a * (1 - e), ra: a * (1 + e) };
}
/** Elemanlar → durum. */
export function elementsToRv(el, mu = MU) {
  const { a, e, i, raan, argp, nu } = el, p = a * (1 - e * e), r = p / (1 + e * Math.cos(nu));
  const cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(argp), sw = Math.sin(argp);
  const P = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si], Q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const cx = r * Math.cos(nu), cy = r * Math.sin(nu), vf = Math.sqrt(mu / p), vx = -vf * Math.sin(nu), vy = vf * (e + Math.cos(nu));
  return { r: [P[0] * cx + Q[0] * cy, P[1] * cx + Q[1] * cy, P[2] * cx + Q[2] * cy], v: [P[0] * vx + Q[0] * vy, P[1] * vx + Q[1] * vy, P[2] * vx + Q[2] * vy] };
}

export const SCENARIOS = Object.freeze({
  j2leo: { label: 'J2 — LEO 51,6° (düğüm gerilemesi)', el: { a: R_E + 420, e: .0006, i: 51.64, raan: 40, argp: 0, nu: 0 }, forces: { j2: true }, days: 7, dt: 10 },
  sso: { label: 'J2 — Güneş-eşzamanlı 98,2° (Ω̇ = +0,986°/gün)', el: { a: R_E + 700, e: .001, i: 98.2, raan: 100, argp: 0, nu: 0 }, forces: { j2: true }, days: 10, dt: 10 },
  molniya: { label: 'J2 — Molniya 63,4° (kritik eğiklik, ω sabit)', el: { a: 26562, e: .74, i: 63.4, raan: 60, argp: 270, nu: 0 }, forces: { j2: true }, days: 10, dt: 20 },
  molniyaOff: { label: 'J2 — 55° (kritik dışı, ω kayar)', el: { a: 26562, e: .74, i: 55, raan: 60, argp: 270, nu: 0 }, forces: { j2: true }, days: 10, dt: 20 },
  drag: { label: 'Sürükleme — 300 km, B = 100 kg/m² (bozunma)', el: { a: R_E + 300, e: .001, i: 51.6, raan: 0, argp: 0, nu: 0 }, forces: { j2: true, drag: true }, days: 20, dt: 10, cdAm: 1 / 100 },
  srpGeo: { label: 'SRP — GEO, A/m = 0,04 (e salınımı)', el: { a: 42164, e: .0005, i: .1, raan: 0, argp: 0, nu: 0 }, forces: { j2: true, srp: true }, days: 120, dt: 120, crAm: 1.3 * .04 },
  moonGeo: { label: 'Üçüncü cisim — GEO, Ay+Güneş (eğiklik sürüklenmesi)', el: { a: 42164, e: .0005, i: .1, raan: 0, argp: 0, nu: 0 }, forces: { j2: true, moon: true, sun: true }, days: 180, dt: 120 },
  twoBody: { label: 'İki-cisim (referans: elemanlar sabit)', el: { a: R_E + 420, e: .0006, i: 51.64, raan: 40, argp: 0, nu: 0 }, forces: {}, days: 7, dt: 10 },
});

/** İvme (km/s²). */
export function acceleration(r, v, t, F, cfg) {
  const rn = norm(r), r3 = rn ** 3;
  const a = [-MU * r[0] / r3, -MU * r[1] / r3, -MU * r[2] / r3];
  if (F.j2) { const k = 1.5 * J2 * MU * R_E * R_E / (rn ** 4), z2 = (r[2] / rn) ** 2; a[0] += k * r[0] / rn * (5 * z2 - 1); a[1] += k * r[1] / rn * (5 * z2 - 1); a[2] += k * r[2] / rn * (5 * z2 - 3); }
  if (F.drag) { const alt = (rn - R_E) * 1000; const rho = densityBlend(alt); const vr = [v[0] + OMEGA_E * r[1], v[1] - OMEGA_E * r[0], v[2]]; const vn = norm(vr); const k = -.5 * rho * (cfg.cdAm ?? .01) * 1000 * vn; /* ρ kg/m³ · (C_D A/m) m²/kg · |v| km/s → km/s² için ×1000 */ a[0] += k * vr[0]; a[1] += k * vr[1]; a[2] += k * vr[2]; }
  if (F.srp || F.sun) { const th = TAU * t / (365.25 * 86400), eps = 23.44 * Math.PI / 180; const s = [Math.cos(th), Math.sin(th) * Math.cos(eps), Math.sin(th) * Math.sin(eps)];
    if (F.srp) { const shadow = dot(r, s) < 0 && Math.hypot(r[0] - dot(r, s) * s[0], r[1] - dot(r, s) * s[1], r[2] - dot(r, s) * s[2]) < R_E; if (!shadow) { const k = -P_SUN * (cfg.crAm ?? .04) / 1000; a[0] += k * s[0]; a[1] += k * s[1]; a[2] += k * s[2]; } }
    if (F.sun) { const rs = s.map(x => x * AU), d = [rs[0] - r[0], rs[1] - r[1], rs[2] - r[2]], dn = norm(d), rsn = AU; a[0] += MU_SUN * (d[0] / dn ** 3 - rs[0] / rsn ** 3); a[1] += MU_SUN * (d[1] / dn ** 3 - rs[1] / rsn ** 3); a[2] += MU_SUN * (d[2] / dn ** 3 - rs[2] / rsn ** 3); } }
  if (F.moon) { const wm = TAU / (27.321661 * 86400), th = wm * t, im = 23.4 * Math.PI / 180; const rm = [384400 * Math.cos(th), 384400 * Math.sin(th) * Math.cos(im), 384400 * Math.sin(th) * Math.sin(im)]; const d = [rm[0] - r[0], rm[1] - r[1], rm[2] - r[2]], dn = norm(d), rmn = 384400; a[0] += MU_MOON * (d[0] / dn ** 3 - rm[0] / rmn ** 3); a[1] += MU_MOON * (d[1] / dn ** 3 - rm[1] / rmn ** 3); a[2] += MU_MOON * (d[2] / dn ** 3 - rm[2] / rmn ** 3); }
  return a;
}

/** Yayılım. Döner { samples:[{t, r, v, el, alt}], secular:{raanDot, argpDot, mDot}, el0, cfg, events } */
export function propagatePerturbed(id = 'j2leo', overrides = {}) {
  const S = { ...SCENARIOS[id], ...overrides, el: { ...SCENARIOS[id].el, ...(overrides.el || {}) }, forces: { ...SCENARIOS[id].forces, ...(overrides.forces || {}) } };
  const rad = Math.PI / 180;
  const el0 = { a: S.el.a, e: S.el.e, i: S.el.i * rad, raan: S.el.raan * rad, argp: S.el.argp * rad, nu: S.el.nu * rad };
  let { r, v } = elementsToRv(el0);
  const tEnd = S.days * 86400, dt = S.dt, sampleEvery = S.sampleEvery ?? Math.max(dt, tEnd / 4000);
  const samples = [], events = [];
  let t = 0, next = 0, decayed = false;
  const push = () => { const el = rvToElements(r, v); samples.push({ t, r: r.slice(), v: v.slice(), el, alt: norm(r) - R_E }); };
  push();
  const f = (r, v, t) => acceleration(r, v, t, S.forces, S);
  while (t < tEnd - 1e-9) {
    const h = Math.min(dt, tEnd - t);
    const k1v = f(r, v, t), k1r = v;
    const r2 = r.map((x, i) => x + .5 * h * k1r[i]), v2 = v.map((x, i) => x + .5 * h * k1v[i]); const k2v = f(r2, v2, t + .5 * h), k2r = v2;
    const r3 = r.map((x, i) => x + .5 * h * k2r[i]), v3 = v.map((x, i) => x + .5 * h * k2v[i]); const k3v = f(r3, v3, t + .5 * h), k3r = v3;
    const r4 = r.map((x, i) => x + h * k3r[i]), v4 = v.map((x, i) => x + h * k3v[i]); const k4v = f(r4, v4, t + h), k4r = v4;
    r = r.map((x, i) => x + h / 6 * (k1r[i] + 2 * k2r[i] + 2 * k3r[i] + k4r[i]));
    v = v.map((x, i) => x + h / 6 * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]));
    t += h;
    if (t >= next + sampleEvery - 1e-9) { push(); next = t; }
    if (norm(r) - R_E < 120 && !decayed) { decayed = true; events.push({ id: 'reentry', t, label: '120 km — yeniden giriş' }); break; }
  }
  if (samples[samples.length - 1].t < t) push();
  const sec = j2Rates({ a: el0.a, e: el0.e, i: el0.i });
  return { id, label: S.label, samples, secular: S.forces.j2 ? sec : { raanDot: 0, argpDot: 0, mDot: Math.sqrt(MU / el0.a ** 3) }, el0, cfg: S, events, period: TAU * Math.sqrt(el0.a ** 3 / MU), decayed };
}

/** Sarımı açılmış açı dizisi (rad): ardışık atlamaları düzeltir. */
export function unwrap(arr) { const out = [arr[0]]; for (let k = 1; k < arr.length; k++) { let d = arr[k] - arr[k - 1]; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; out.push(out[k - 1] + d); } return out; }

/** Bir periyot penceresiyle koşan ortalama ("ortalama eleman" vekili). */
export function runningMean(times, values, window) { const out = new Array(values.length); let j0 = 0; for (let k = 0; k < values.length; k++) { while (times[k] - times[j0] > window) j0++; let s = 0; for (let j = j0; j <= k; j++) s += values[j]; out[k] = s / (k - j0 + 1); } return out; }

/** Sayısal sekülar oran: sarımı açılmış açının en-küçük-kareler eğimi (rad/s). */
export function fitRate(times, values) { const n = times.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let k = 0; k < n; k++) { sx += times[k]; sy += values[k]; sxx += times[k] * times[k]; sxy += times[k] * values[k]; } return (n * sxy - sx * sy) / (n * sxx - sx * sx); }
