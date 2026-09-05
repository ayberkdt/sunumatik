/* astro-orbit.mjs — İki-cisim yörünge + Dünya dönmesi + yer izi geometrisi (SAF).
   presets/core paylaşılan altyapısı; ground_track_3d, constellation_coverage ve
   orbit_perturbations bunu kullanır. Node'da sınanır (scripts/validate-astro.mjs).

   MODEL
   • Kepler elemanları (a, e, i, Ω, ω, M0) → ECI durum: Kepler denklemi Newton ile.
   • İsteğe bağlı J2 SEKÜLAR oranları (ortalama elemanlar): Ω̇ = −(3/2) n J2 (R/p)² cos i,
     ω̇ = (3/4) n J2 (R/p)² (5cos²i − 1), Ṁ = n [1 + (3/4) J2 (R/p)² √(1−e²)(3cos²i − 1)].
     Kısa-periyot terimleri YOK: bu, oskülatör değil ortalama-eleman yayılımıdır.
   • ECI → ECEF: z ekseni etrafında θ = θ0 + ω_e t (GMST; θ0 keyfi, referans epoch t=0).
   • Yer izi: lat = asin(z/r) (jeosantrik), lon = atan2(y,x) − θ, [−π, π]'ye sarılır.
   Birim: km, s, rad. */

export const MU = 398600.4418;         // km³/s²
export const R_E = 6378.137;           // km
export const J2 = 1.08262668e-3;
export const OMEGA_E = 7.2921159e-5;   // rad/s (yıldızıl)
export const TAU = Math.PI * 2;

export const meanMotionOf = a => Math.sqrt(MU / (a * a * a));
export const periodOf = a => TAU / meanMotionOf(a);

export function solveKepler(M, e) {
  M = ((M % TAU) + TAU) % TAU;
  let E = e < .8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-13) break; }
  return E;
}

/** Sekülar J2 oranları (rad/s). */
export function j2Rates(el) {
  const { a, e, i } = el;
  const n = meanMotionOf(a), p = a * (1 - e * e), k = J2 * (R_E / p) ** 2, ci = Math.cos(i);
  return {
    raanDot: -1.5 * n * k * ci,
    argpDot: .75 * n * k * (5 * ci * ci - 1),
    mDot: n * (1 + .75 * k * Math.sqrt(1 - e * e) * (3 * ci * ci - 1)),
  };
}

/** Elemanlar + t → ECI durum {r:[x,y,z] km, v:[…] km/s, el(t)} (J2 seküler isteğe bağlı). */
export function stateAt(el, t, { j2 = false } = {}) {
  const { a, e = 0, i = 0, raan = 0, argp = 0, M0 = 0 } = el;
  const n = meanMotionOf(a);
  let Om = raan, w = argp, M = M0 + n * t;
  if (j2) { const r = j2Rates(el); Om = raan + r.raanDot * t; w = argp + r.argpDot * t; M = M0 + r.mDot * t; }
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const p = a * (1 - e * e), rr = p / (1 + e * Math.cos(nu));
  const cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(w), sw = Math.sin(w);
  const P = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const Q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const cx = rr * Math.cos(nu), cy = rr * Math.sin(nu);
  const vf = Math.sqrt(MU / p), vx = -vf * Math.sin(nu), vy = vf * (e + Math.cos(nu));
  return {
    r: [P[0] * cx + Q[0] * cy, P[1] * cx + Q[1] * cy, P[2] * cx + Q[2] * cy],
    v: [P[0] * vx + Q[0] * vy, P[1] * vx + Q[1] * vy, P[2] * vx + Q[2] * vy],
    nu, E, M, raan: Om, argp: w,
  };
}

/** ECI → ECEF (θ = GMST). */
export function eciToEcef(r, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [c * r[0] + s * r[1], -s * r[0] + c * r[1], r[2]];
}

export const wrapLon = lon => { let l = ((lon + Math.PI) % TAU + TAU) % TAU - Math.PI; return l; };

/** ECEF → {lat, lon, alt} (küresel Dünya; jeosantrik enlem). */
export function ecefToGeodetic(r) {
  const rho = Math.hypot(r[0], r[1], r[2]);
  return { lat: Math.asin(r[2] / rho), lon: wrapLon(Math.atan2(r[1], r[0])), alt: rho - R_E };
}

/**
 * Yer izi örnekleri: [{t, lat, lon, alt, r(ECI)}]; ardışık örnekler arasında
 * boylam sıçraması (|Δlon| > π) 'break' bayrağıyla işaretlenir — 2B çizim kesilir.
 */
export function groundTrack(el, { tEnd, dt = 30, theta0 = 0, j2 = false, omega = OMEGA_E } = {}) {
  const out = [];
  let prev = null;
  for (let t = 0; t <= tEnd + 1e-9; t += dt) {
    const s = stateAt(el, t, { j2 });
    const ecef = eciToEcef(s.r, theta0 + omega * t);
    const g = ecefToGeodetic(ecef);
    const brk = prev != null && Math.abs(g.lon - prev.lon) > Math.PI;
    out.push({ t, lat: g.lat, lon: g.lon, alt: g.alt, r: s.r, v: s.v, brk });
    prev = g;
  }
  return out;
}

/** Yer izinin tur başına boylam kayması (iki-cisim, küresel): Δλ = −ω_e·T (+J2 düğüm kayması). */
export function lonShiftPerRev(el, { j2 = false } = {}) {
  const T = periodOf(el.a);
  const raanDot = j2 ? j2Rates(el).raanDot : 0;
  /* nodal periyot yaklaşık: T·n/Ṁ·(…) — burada ortalama anomali periyodu kullanılır */
  return (raanDot - OMEGA_E) * T;
}

/** Bilinen yörünge presetleri (km, rad). */
export const ORBIT_PRESETS = Object.freeze({
  iss: { label: 'ISS (LEO 51,6°)', a: R_E + 420, e: .0006, i: 51.64 * Math.PI / 180, raan: .8, argp: 0, M0: 0 },
  sso: { label: 'Güneş-eşzamanlı (SSO 97,8°)', a: R_E + 700, e: .001, i: 98.2 * Math.PI / 180, raan: 1.9, argp: 0, M0: 0 },
  polar: { label: 'Kutupsal 90°', a: R_E + 800, e: 0, i: Math.PI / 2, raan: .3, argp: 0, M0: 0 },
  molniya: { label: 'Molniya (12 sa, 63,4°)', a: 26562, e: .74, i: 63.4 * Math.PI / 180, raan: 2.4, argp: -Math.PI / 2, M0: 0 },
  gps: { label: 'GPS (MEO 55°)', a: 26560, e: .01, i: 55 * Math.PI / 180, raan: 1.2, argp: 0, M0: 0 },
  geo: { label: 'Jeostasyoner (GEO)', a: 42164.17, e: 0, i: 0, raan: 0, argp: 0, M0: 0 },
  tundra: { label: 'Tundra (24 sa, 63,4°)', a: 42164.17, e: .27, i: 63.4 * Math.PI / 180, raan: 1.0, argp: -Math.PI / 2, M0: 0 },
});
