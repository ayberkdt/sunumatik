/* launch-window-model.mjs — Fırlatma penceresi ve azimut geometrisi, SAF model.

   Verilen: fırlatma sahası enlemi φ, boylamı L, hedef eğiklik i ve düğüm boylamı Ω, gün (GMST₀), yanma sonu hızı V_bo.
   Küresel trigonometri (Vallado 6.4): eylemsiz azimut sin β_i = cos i / cos φ (çıkan ve inen: β ve 180° − β; i < φ
   ise çözüm yok → "dogleg" gerekir); düğümden açısal uzaklık sin λ_u = tan φ / tan i; fırlatma yerel yıldız zamanı
   LST = Ω + λ_u (çıkan) ya da Ω + 180° − λ_u (inen); UTC = (LST − GMST₀ − L)/ω_e. Dünya dönmesi düzeltmesi: sahaya
   göre gereken hız vektörü v_rel = V_bo(sin β_i, cos β_i) − (ω_e R cos φ, 0) (doğu, kuzey) → dönen azimut β ve
   |v_rel| (tasarruf ΔV = V_bo − |v_rel|). Pencere: kalkış gecikmesi Δt → ΔΩ = ω_e Δt → düzlem açısı cos θ =
   cos²i + sin²i cos ΔΩ → düzlem değişimi ΔV = 2V sin(θ/2); ΔV bütçesi için pencere genişliği. Hiçbir sayı elle
   yerleştirilmez; Vallado örnekleri denetimde. */

import { R_E, OMEGA_E, MU } from '../core/astro-orbit.mjs';
export { R_E, OMEGA_E };
const rad = Math.PI / 180, deg = 180 / Math.PI;

export const SITES = Object.freeze({
  ksc: { label: 'Cape Canaveral / KSC', lat: 28.5, lon: -80.6, azMin: 35, azMax: 120 },
  vandenberg: { label: 'Vandenberg', lat: 34.7, lon: -120.6, azMin: 147, azMax: 201 },
  baikonur: { label: 'Baykonur', lat: 45.9, lon: 63.3, azMin: 35, azMax: 90 },
  kourou: { label: 'Kourou', lat: 5.2, lon: -52.8, azMin: -10.5, azMax: 93.5 },
  tanegashima: { label: 'Tanegashima', lat: 30.4, lon: 131.0, azMin: 90, azMax: 160 },
  sinop: { label: 'Sinop (kavramsal)', lat: 42.0, lon: 35.2, azMin: 0, azMax: 90 },
});
export const TARGETS = Object.freeze({
  iss: { label: 'ISS (i 51,6°, 420 km)', inc: 51.6, alt: 420 },
  sso: { label: 'Güneş-eşzamanlı (i 97,8°, 600 km)', inc: 97.8, alt: 600 },
  gto: { label: 'GTO düşük eğiklik (i 28,5°)', inc: 28.5, alt: 250 },
  polar: { label: 'Kutupsal (i 90°, 500 km)', inc: 90, alt: 500 },
  equatorial: { label: 'Ekvatoral (i 0°) — çoğu sahadan dogleg', inc: 0, alt: 300 },
});

export const gmst0 = doy => (280.46 + .9856 * (doy - 1)) % 360;   // yaklaşık GMST(0h UTC, gün), derece — J2000 tabanlı doğrusal
export const circVel = alt => Math.sqrt(MU / (R_E + alt));

/** Azimut çözümü. Döner { feasible, betaAsc, betaDesc, lambdaAsc, lambdaDesc, rotAsc:{beta, vRel, saving}, rotDesc, vEq } (derece, km/s). */
export function azimuths(latDeg, incDeg, vBo) {
  const phi = latDeg * rad, inc = incDeg * rad, vEq = OMEGA_E * R_E * Math.cos(phi);
  const s = Math.cos(inc) / Math.cos(phi);
  if (Math.abs(s) > 1) return { feasible: false, reason: incDeg < Math.abs(latDeg) ? 'eğiklik saha enleminden küçük' : 'geometri', vEq, minInc: Math.abs(latDeg) };
  const bAsc = Math.asin(s), bDesc = Math.PI - bAsc;
  const lamU = Math.abs(Math.tan(phi) / Math.tan(inc)) <= 1 ? Math.asin(Math.tan(phi) / Math.tan(inc)) : Math.PI / 2;
  const rot = b => { const e = vBo * Math.sin(b) - vEq, n = vBo * Math.cos(b); const v = Math.hypot(e, n); return { beta: Math.atan2(e, n) * deg, vRel: v, saving: vBo - v }; };
  return { feasible: true, betaAsc: bAsc * deg, betaDesc: bDesc * deg, lambdaAsc: lamU * deg, lambdaDesc: 180 - lamU * deg, rotAsc: rot(bAsc), rotDesc: rot(bDesc), vEq };
}
/** Fırlatma anları (UTC saat) ve LST'ler. */
export function opportunities({ lat, lon, inc, raan, doy = 80 }) {
  const az = azimuths(lat, inc, 7.8); if (!az.feasible) return { feasible: false, ...az };
  const g0 = gmst0(doy), toUtc = lst => { let h = ((lst - g0 - lon) % 360 + 360) % 360 / 15; return h; };
  const lstAsc = (raan + az.lambdaAsc) % 360, lstDesc = (raan + az.lambdaDesc) % 360;
  return { feasible: true, asc: { lst: lstAsc, utcHours: toUtc(lstAsc), beta: az.betaAsc }, desc: { lst: lstDesc, utcHours: toUtc(lstDesc), beta: az.betaDesc }, gmst0: g0 };
}
/** Kalkış gecikmesi Δt (s) → düzlem hatası ve düzlem değişimi ΔV (km/s). */
export function planePenalty(incDeg, dtSec, v) { const dO = OMEGA_E * dtSec, inc = incDeg * rad; const c = Math.cos(inc) ** 2 + Math.sin(inc) ** 2 * Math.cos(dO); const th = Math.acos(Math.max(-1, Math.min(1, c))); return { dRaanDeg: dO * deg, planeDeg: th * deg, dv: 2 * v * Math.sin(th / 2) }; }
/** ΔV bütçesi için pencere yarı-genişliği (s), bisection. */
export function windowHalfWidth(incDeg, v, dvBudget) { let lo = 0, hi = 6 * 3600; if (planePenalty(incDeg, hi, v).dv < dvBudget) return hi; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; (planePenalty(incDeg, m, v).dv < dvBudget ? (lo = m) : (hi = m)); } return lo; }
/** Azimut kısıtı (menzil güvenliği) denetimi. */
export const azimuthAllowed = (site, beta) => { const b = ((beta % 360) + 360) % 360, lo = ((site.azMin % 360) + 360) % 360, hi = ((site.azMax % 360) + 360) % 360; return lo <= hi ? b >= lo && b <= hi : b >= lo || b <= hi; };
/** Tam analiz. */
export function analyze({ site = 'ksc', target = 'iss', raan = 0, doy = 80, dvBudget = .1, siteOverride = null } = {}) {
  const S = siteOverride ?? SITES[site], T = TARGETS[target], v = circVel(T.alt);
  const az = azimuths(S.lat, T.inc, v), opp = opportunities({ lat: S.lat, lon: S.lon, inc: T.inc, raan, doy });
  const half = az.feasible ? windowHalfWidth(T.inc, v, dvBudget) : 0;
  const curve = Array.from({ length: 121 }, (_, k) => { const dt = (k - 60) / 60 * 3600; return { dt, ...planePenalty(T.inc, dt, v) }; });
  return { site: S, target: T, v, az, opp, half, windowSec: 2 * half, dvBudget, curve, ascAllowed: az.feasible && azimuthAllowed(S, az.rotAsc.beta), descAllowed: az.feasible && azimuthAllowed(S, az.rotDesc.beta) };
}
