/* astro-lambert.mjs — Lambert problemi (evrensel değişkenler) + gezegen efemerisi (SAF).
   porkchop_explorer, transfer_explorer ve gravity_assist bunu paylaşır; Node'da sınanır.

   LAMBERT (Curtis, Orbital Mechanics for Engineering Students, Alg. 5.2 / Bate–Mueller–White):
     r1, r2 (km), Δt (s), μ (km³/s²), yön: 'prograde' | 'retrograde' (transfer açısı Δθ z-bileşeninden seçilir)
     A = sinΔθ √(r1 r2 / (1 − cosΔθ)),  y(z) = r1 + r2 + A (z S(z) − 1)/√C(z)
     F(z) = (y/C)^{3/2} S + A √y − √μ Δt = 0  → z, önce köşeleme (bisection) sonra Newton (güvenli hibrit)
     f = 1 − y/r1, g = A √(y/μ), ġ = 1 − y/r2 → v1 = (r2 − f r1)/g, v2 = (ġ r2 − r1)/g
   Tek-tur çözüm (çok-tur yok). Δθ = 0 ya da π (A = 0) tekildir → null.

   EFEMERİS: JPL "Keplerian Elements for Approximate Positions of the Major Planets"
   (E.M. Standish, Solar System Dynamics, JPL; Tablo 1, 1800–2050 AD geçerli).
   J2000 ekliptik çerçevesi; a (AU), e, I, L, ϖ, Ω (derece) ve yüzyıl başına oranlar.
   Doğruluk: iç gezegenler için ~ birkaç yay dakikası / 10⁻⁴ AU düzeyi (illüstratif görev
   analizi için yeterli; gerçek görev tasarımı DE4xx efemerisi ister). Kaynak: ssd.jpl.nasa.gov/planets/approx_pos.html */

export const MU_SUN = 1.32712440018e11;   // km³/s²
export const AU = 149597870.7;            // km
export const DAY = 86400;
export const MU_EARTH = 398600.4418, MU_MARS = 42828.375214, MU_VENUS = 324858.592, MU_JUPITER = 1.26686534e8;

/* Stumpff fonksiyonları */
export function stumpffC(z) { if (z > 1e-8) return (1 - Math.cos(Math.sqrt(z))) / z; if (z < -1e-8) return (Math.cosh(Math.sqrt(-z)) - 1) / (-z); return .5 - z / 24; }
export function stumpffS(z) { if (z > 1e-8) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); } if (z < -1e-8) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); } return 1 / 6 - z / 120; }

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Lambert çözümü. Döner { v1, v2, dtheta, a, z, iterations } ya da null (yakınsamadı / tekil).
 */
export function lambert(r1v, r2v, dt, mu = MU_SUN, direction = 'prograde') {
  const r1 = norm(r1v), r2 = norm(r2v);
  const c12 = cross(r1v, r2v);
  let dth = Math.acos(Math.max(-1, Math.min(1, dot(r1v, r2v) / (r1 * r2))));
  if (direction === 'prograde' ? c12[2] < 0 : c12[2] >= 0) dth = 2 * Math.PI - dth;
  const sdt = Math.sin(dth), cdt = Math.cos(dth);
  if (Math.abs(1 - cdt) < 1e-12 || Math.abs(sdt) < 1e-12) return null;
  const A = sdt * Math.sqrt(r1 * r2 / (1 - cdt));
  const y = z => r1 + r2 + A * (z * stumpffS(z) - 1) / Math.sqrt(stumpffC(z));
  const F = z => { const yy = y(z); if (yy < 0) return NaN; return Math.pow(yy / stumpffC(z), 1.5) * stumpffS(z) + A * Math.sqrt(yy) - Math.sqrt(mu) * dt; };
  /* köşeleme: F monoton artan (z ile). Alt sınır: y(z) > 0 olan en küçük z; üst sınır 4π² (tek tur eliptik). */
  let zlo = -4 * Math.PI * Math.PI, zhi = 39.0;   // üst sınır 4π² ≈ 39,48 tekildir (C→0), altında kalınır
  /* y<0 (hiperbolik alt bölgede A<0 iken) bölgesini atla */
  for (let k = 0; k < 60 && !(y(zlo) > 0 && Number.isFinite(F(zlo))); k++) zlo = zlo / 2 + 1e-6;
  let flo = F(zlo), fhi = F(zhi);
  if (!(flo < 0)) { /* Δt çok küçük — hiperbolik bölge daha aşağıda */ let z = zlo; for (let k = 0; k < 80 && !(F(z) < 0); k++) { z = z * 2 - 1; if (!(y(z) > 0)) return null; } zlo = z; flo = F(zlo); }
  if (!(fhi > 0)) return null;
  let z = 0, iterations = 0;
  if (!(y(0) > 0) || !Number.isFinite(F(0))) z = (zlo + zhi) / 2;
  for (; iterations < 60; iterations++) {
    const f = F(z);
    if (!Number.isFinite(f)) { z = (zlo + zhi) / 2; continue; }
    if (Math.abs(f) < 1e-11 * Math.sqrt(mu) * dt) break;
    if (f < 0) zlo = z; else zhi = z;
    /* Newton adımı (Curtis F'), köşe dışına düşerse bisection */
    const yy = y(z), C = stumpffC(z), S = stumpffS(z);
    let dF;
    if (Math.abs(z) < 1e-8) dF = Math.SQRT2 / 40 * Math.pow(yy, 1.5) + A / 8 * (Math.sqrt(yy) + A * Math.sqrt(1 / (2 * yy)));
    else dF = Math.pow(yy / C, 1.5) * (1 / (2 * z) * (C - 1.5 * S / C) + .75 * S * S / C) + A / 8 * (3 * S / C * Math.sqrt(yy) + A * Math.sqrt(C / yy));
    let zn = z - f / dF;
    if (!(zn > zlo && zn < zhi) || !Number.isFinite(zn)) zn = (zlo + zhi) / 2;
    if (Math.abs(zn - z) < 1e-10) { z = zn; break; }
    z = zn;
  }
  const yy = y(z);
  if (!(yy > 0)) return null;
  const f = 1 - yy / r1, g = A * Math.sqrt(yy / mu), gd = 1 - yy / r2;
  const v1 = [(r2v[0] - f * r1v[0]) / g, (r2v[1] - f * r1v[1]) / g, (r2v[2] - f * r1v[2]) / g];
  const v2 = [(gd * r2v[0] - r1v[0]) / g, (gd * r2v[1] - r1v[1]) / g, (gd * r2v[2] - r1v[2]) / g];
  const v1n2 = dot(v1, v1);
  const a = 1 / (2 / r1 - v1n2 / mu);
  return { v1, v2, dtheta: dth, a, z, iterations };
}

/* Kepler yayılımı (evrensel değişken, Curtis Alg. 3.4) — Lambert doğrulaması ve transfer yayı için */
export function propagateKepler(r0, v0, dt, mu = MU_SUN) {
  const r = norm(r0), vr0 = dot(r0, v0) / r, alpha = 2 / r - dot(v0, v0) / mu;
  let x = Math.sqrt(mu) * Math.abs(alpha) * dt;
  if (Math.abs(alpha) < 1e-12) x = Math.sqrt(mu) * dt / r;
  for (let k = 0; k < 100; k++) {
    const z = alpha * x * x, C = stumpffC(z), S = stumpffS(z);
    const F = r * vr0 / Math.sqrt(mu) * x * x * C + (1 - alpha * r) * x * x * x * S + r * x - Math.sqrt(mu) * dt;
    const dF = r * vr0 / Math.sqrt(mu) * x * (1 - alpha * x * x * S) + (1 - alpha * r) * x * x * C + r;
    const dx = F / dF; x -= dx; if (Math.abs(dx) < 1e-9) break;
  }
  const z = alpha * x * x, C = stumpffC(z), S = stumpffS(z);
  const f = 1 - x * x / r * C, g = dt - x * x * x / Math.sqrt(mu) * S;
  const rv = [f * r0[0] + g * v0[0], f * r0[1] + g * v0[1], f * r0[2] + g * v0[2]];
  const rn = norm(rv);
  const fd = Math.sqrt(mu) / (r * rn) * (alpha * x * x * x * S - x), gd = 1 - x * x / rn * C;
  return { r: rv, v: [fd * r0[0] + gd * v0[0], fd * r0[1] + gd * v0[1], fd * r0[2] + gd * v0[2]] };
}

/* ───────────── efemeris (Standish Tablo 1: a e I L ϖ Ω | yüzyıl başına oranlar) */
export const PLANETS = Object.freeze({
  mercury: { label: 'Merkür', mu: 22031.78, el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081], color: '#b9b2a6' },
  venus: { label: 'Venüs', mu: MU_VENUS, el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], rate: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418], color: '#e6c58a' },
  earth: { label: 'Dünya', mu: MU_EARTH, el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0], color: '#8fb8dd' },
  mars: { label: 'Mars', mu: MU_MARS, el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343], color: '#d78f6c' },
  jupiter: { label: 'Jüpiter', mu: MU_JUPITER, el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], color: '#d9b877' },
  saturn: { label: 'Satürn', mu: 3.7931187e7, el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], color: '#e0d2a8' },
});

/** Takvim (UTC) → Jülyen günü. */
export function julianDay(y, m, d, hour = 0) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + hour / 24;
}
export const J2000 = 2451545.0;
export function jdToDate(jd) { const d = new Date((jd - 2440587.5) * 86400000); return d; }
export function fmtJd(jd) { const d = jdToDate(jd); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }

const rad = Math.PI / 180;
/** Gezegenin J2000 ekliptik heliosantrik durumu (km, km/s) — JD'de. */
export function planetState(name, jd) {
  const P = PLANETS[name];
  const T = (jd - J2000) / 36525;
  const [a0, e0, I0, L0, w0, O0] = P.el, [ar, er, Ir, Lr, wr, Or] = P.rate;
  const a = (a0 + ar * T) * AU, e = e0 + er * T, I = (I0 + Ir * T) * rad, L = (L0 + Lr * T) * rad, wb = (w0 + wr * T) * rad, O = (O0 + Or * T) * rad;
  const w = wb - O; let M = L - wb; M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 30; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-13) break; }
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const p = a * (1 - e * e), r = p / (1 + e * Math.cos(nu));
  const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(I), si = Math.sin(I), cw = Math.cos(w), sw = Math.sin(w);
  const Pv = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const Qv = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const cx = r * Math.cos(nu), cy = r * Math.sin(nu);
  const vf = Math.sqrt(MU_SUN / p), vx = -vf * Math.sin(nu), vy = vf * (e + Math.cos(nu));
  return { r: [Pv[0] * cx + Qv[0] * cy, Pv[1] * cx + Qv[1] * cy, Pv[2] * cx + Qv[2] * cy], v: [Pv[0] * vx + Qv[0] * vy, Pv[1] * vx + Qv[1] * vy, Pv[2] * vx + Qv[2] * vy], a, e, nu };
}

/**
 * Tek transfer değerlendirmesi: kalkış JD, varış JD, kaynak/hedef gezegen.
 * Döner { tof (gün), vinfDep, vinfArr, c3, dvDep (LEO 200 km'den kaçış), dvArrCapture (hedefte dairesel yörüngeye tutunma), type ('I'|'II'), lambert, r1, r2, vP1, vP2 }
 * Her iki yön (kısa/uzun yol) çözülür, C3'ü küçük olan seçilir.
 */
export function evaluateTransfer(origin, target, jdDep, jdArr, { parkAltDep = 200, parkAltArr = 300 } = {}) {
  const tof = (jdArr - jdDep) * DAY;
  if (tof <= 0) return null;
  const s1 = planetState(origin, jdDep), s2 = planetState(target, jdArr);
  let best = null;
  for (const dir of ['prograde', 'retrograde']) {
    const L = lambert(s1.r, s2.r, tof, MU_SUN, dir);
    if (!L) continue;
    const vinfD = sub(L.v1, s1.v), vinfA = sub(L.v2, s2.v);
    const c3 = dot(vinfD, vinfD);
    if (!best || c3 < best.c3) best = { L, dir, vinfDep: Math.sqrt(c3), vinfArr: norm(vinfA), c3, vinfDepVec: vinfD, vinfArrVec: vinfA };
  }
  if (!best) return null;
  const muO = PLANETS[origin].mu, muT = PLANETS[target].mu;
  const RO = { earth: 6378.137, mars: 3389.5, venus: 6051.8, jupiter: 69911, mercury: 2439.7, saturn: 58232 };
  const rpD = RO[origin] + parkAltDep, rpA = RO[target] + parkAltArr;
  const dvDep = Math.sqrt(best.c3 + 2 * muO / rpD) - Math.sqrt(muO / rpD);
  const dvArr = Math.sqrt(best.vinfArr ** 2 + 2 * muT / rpA) - Math.sqrt(muT / rpA);
  return { tof: tof / DAY, vinfDep: best.vinfDep, vinfArr: best.vinfArr, c3: best.c3, dvDep, dvArr, type: best.L.dtheta < Math.PI ? 'I' : 'II', dir: best.dir, lambert: best.L, r1: s1.r, r2: s2.r, vP1: s1.v, vP2: s2.v, vinfDepVec: best.vinfDepVec, vinfArrVec: best.vinfArrVec };
}

/**
 * Porkchop ızgarası: { dep:[jd…], arr:[jd…], c3:Float64Array(nDep×nArr), vinfArr, tof, dvTotal, min:{i,j,c3,…} }
 * Her hücre GERÇEK Lambert çözümüdür (hazır ısı haritası yok).
 */
export function porkchopGrid(origin, target, jdDep0, jdDep1, jdArr0, jdArr1, nDep = 60, nArr = 60, opts = {}) {
  const dep = Array.from({ length: nDep }, (_, i) => jdDep0 + (jdDep1 - jdDep0) * i / (nDep - 1));
  const arr = Array.from({ length: nArr }, (_, j) => jdArr0 + (jdArr1 - jdArr0) * j / (nArr - 1));
  const c3 = new Float64Array(nDep * nArr).fill(NaN), vinfArr = new Float64Array(nDep * nArr).fill(NaN), tof = new Float64Array(nDep * nArr).fill(NaN), dvTotal = new Float64Array(nDep * nArr).fill(NaN);
  let min = null;
  for (let i = 0; i < nDep; i++) for (let j = 0; j < nArr; j++) {
    const t = evaluateTransfer(origin, target, dep[i], arr[j], opts);
    const k = i * nArr + j;
    if (!t || t.tof < 30) continue;
    c3[k] = t.c3; vinfArr[k] = t.vinfArr; tof[k] = t.tof; dvTotal[k] = t.dvDep + t.dvArr;
    if (!min || t.c3 < min.c3) min = { i, j, c3: t.c3, vinfArr: t.vinfArr, tof: t.tof, jdDep: dep[i], jdArr: arr[j], dvDep: t.dvDep, dvArr: t.dvArr };
  }
  return { origin, target, dep, arr, nDep, nArr, c3, vinfArr, tof, dvTotal, min };
}
