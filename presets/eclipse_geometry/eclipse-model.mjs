/* eclipse-model.mjs — Tutulma / örtülme / görünürlük GEOMETRİSİ (saf, THREE'siz).
   eclipse_geometry preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.
   Hiçbir geçiş zamanı elle yazılmaz: umbra/penumbra, yer istasyonu AOS/LOS ve örtülmeler
   çizgi-görüş ve koni geometrisinden TÜRETİLİR (tarama + bisection).

   MODEL (ECI, km, s):
   • Uydu: Kepler yörüngesi (../core/astro-orbit.mjs stateAt; isteğe bağlı J2 seküler).
   • Güneş: sabit yön ŝ (yıl-günü → deklinasyon ε·sin(λ), λ yıllık; mesafe 1 AU). Sonlu disk: R_☉ = 695 700 km.
   • GÖLGE FONKSİYONU ν ∈ [0,1] (Montenbruck & Gill konik model): uydudan görünen Güneş yarıçapı
     a = asin(R_☉/|r_☉ − r|), Dünya yarıçapı b = asin(R_⊕/|r|), merkezler arası açı c = acos(−r̂·ŝ');
     a + b ≤ c → tam güneş (ν = 1); c ≤ b − a → umbra (ν = 0); aksi hâlde kısmi: dairesel diskler örtüşme
     alanı A ile ν = 1 − A/(π a²). Umbra/penumbra girişleri ν eşiklerinden (1 ve 0) bisection ile bulunur.
   • Beta açısı β = asin(ŝ·ĥ) (Güneş yönü ile yörünge düzlemi arasındaki açı); silindirik gölge için
     tutulma yok koşulu |β| > asin(R/r) (bağımsız denetim).
   • YER İSTASYONU: ECEF konumundan yükseklik açısı; Dünya θ = θ₀ + ω_e t ile döner; AOS/LOS = ε ≥ ε_maske
     geçişleri (bisection).
   • ÖRTÜLME (LOS engeli): iki nokta arasındaki doğru parçasının Dünya'ya (yarıçap R + h_atm) en yakın
     noktası — parçanın içindeyse ve mesafe < R + h_atm → örtülü. Sensör hedefi (yıldız yönü, sonsuzda) için
     ışın–küre testi. Haberleşme örtülmesi: uydu ↔ röle uydusu LOS.
   Küresel Dünya, kırılma yok, Ay gölgesi yok. */

import { stateAt, periodOf, ORBIT_PRESETS, R_E, OMEGA_E, TAU } from '../core/astro-orbit.mjs';

export const R_SUN = 695700, AU = 149597870.7;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };

/** Güneş yönü (ECI, birim) — yıl günü ile: ekliptik boylam λ, deklinasyon δ = asin(sin ε sin λ). */
export function sunDirection(dayOfYear = 80) {
  const lam = TAU * (dayOfYear - 80) / 365.25, eps = 23.44 * Math.PI / 180;
  return [Math.cos(lam), Math.sin(lam) * Math.cos(eps), Math.sin(lam) * Math.sin(eps)];
}

/** Gölge fonksiyonu ν (0 umbra … 1 tam güneş), kısmi bölgede disk örtüşmesi. */
export function shadowFunction(r, sunDir) {
  const rs = sunDir.map(x => x * AU), d = [rs[0] - r[0], rs[1] - r[1], rs[2] - r[2]], dn = norm(d), rn = norm(r);
  const a = Math.asin(Math.min(1, R_SUN / dn)), b = Math.asin(Math.min(1, R_E / rn));
  const c = Math.acos(Math.max(-1, Math.min(1, -dot(r, d) / (rn * dn))));
  if (a + b <= c) return { nu: 1, region: 'sun', a, b, c };
  if (c <= b - a) return { nu: 0, region: 'umbra', a, b, c };
  if (c <= a - b) return { nu: 1 - (b * b) / (a * a), region: 'annular', a, b, c };
  const x = (c * c + a * a - b * b) / (2 * c), y = Math.sqrt(Math.max(0, a * a - x * x));
  const A = a * a * Math.acos(Math.max(-1, Math.min(1, x / a))) + b * b * Math.acos(Math.max(-1, Math.min(1, (c - x) / b))) - c * y;
  return { nu: 1 - A / (Math.PI * a * a), region: 'penumbra', a, b, c };
}

/** Beta açısı (rad): Güneş yönü ile yörünge düzlemi arasındaki açı. */
export function betaAngle(el, sunDir) {
  const s = stateAt(el, 0), h = unit(cross(s.r, s.v));
  return Math.asin(Math.max(-1, Math.min(1, dot(h, sunDir))));
}

/** İstasyon ECEF birim vektörü ve yükseklik açısı. */
export function stationEcef(latDeg, lonDeg) { const la = latDeg * Math.PI / 180, lo = lonDeg * Math.PI / 180; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; }
export function elevationFrom(stationU, rEci, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const rE = [c * rEci[0] + s * rEci[1], -s * rEci[0] + c * rEci[1], rEci[2]];
  const g = stationU.map(x => x * R_E), d = [rE[0] - g[0], rE[1] - g[1], rE[2] - g[2]], dn = norm(d);
  const el = Math.asin(Math.max(-1, Math.min(1, dot(d, stationU) / dn)));
  const east = unit(cross([0, 0, 1], stationU)), north = cross(stationU, east);
  const az = Math.atan2(dot(d, east), dot(d, north));
  return { elevation: el, azimuth: (az + TAU) % TAU, range: dn };
}

/** Doğru parçası p→q Dünya (R + hAtm) tarafından engelleniyor mu? Döner { blocked, minDist, tangentAlt }. */
export function segmentBlocked(p, q, hAtm = 0) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L2 = dot(d, d);
  let t = L2 > 0 ? -dot(p, d) / L2 : 0; t = Math.max(0, Math.min(1, t));
  const cpt = [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]], md = norm(cpt);
  return { blocked: md < R_E + hAtm, minDist: md, tangentAlt: md - R_E, t };
}
/** Sonsuzdaki hedef (yıldız) yönü u için ışın–küre: p + s u, s ≥ 0. */
export function rayBlocked(p, u, hAtm = 0) {
  const s = -dot(p, u); if (s <= 0) return { blocked: false, tangentAlt: Infinity };
  const cpt = [p[0] + s * u[0], p[1] + s * u[1], p[2] + s * u[2]], md = norm(cpt);
  return { blocked: md < R_E + hAtm, minDist: md, tangentAlt: md - R_E };
}

/** Eşik geçişlerini tarama + bisection ile bul: f(t) − thr işaret değişimi. */
function findCrossings(f, t0, t1, dt, thr = 0) {
  const out = []; let tp = t0, fp = f(t0) - thr;
  for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) { const fv = f(t) - thr; if (fp * fv < 0) { let a = tp, b = t, fa = fp; for (let k = 0; k < 40; k++) { const m = (a + b) / 2, fm = f(m) - thr; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } } out.push({ t: (a + b) / 2, rising: fv > 0 }); } tp = t; fp = fv; }
  return out;
}

/**
 * Tam analiz. cfg: { el, dayOfYear, revs, dt, station:{lat,lon,maskDeg}, relay:{el}, star:[ux,uy,uz], hAtm, theta0, j2 }
 * Döner { samples, events, sunDir, beta, stats, period }
 */
export function analyze(cfg = {}) {
  const el = cfg.el ?? ORBIT_PRESETS.iss, sunDir = sunDirection(cfg.dayOfYear ?? 80), revs = cfg.revs ?? 2;
  const T = periodOf(el.a), tEnd = revs * T, dt = cfg.dt ?? Math.max(5, T / 600), theta0 = cfg.theta0 ?? 0, j2 = !!cfg.j2;
  const st = cfg.station ? stationEcef(cfg.station.lat, cfg.station.lon) : null, mask = (cfg.station?.maskDeg ?? 5) * Math.PI / 180;
  const hAtm = cfg.hAtm ?? 0, star = cfg.star ? unit(cfg.star) : null, relayEl = cfg.relay?.el ?? null;
  const rAt = t => stateAt(el, t, { j2 }).r;
  const nuAt = t => shadowFunction(rAt(t), sunDir).nu;
  const elevAt = t => elevationFrom(st, rAt(t), theta0 + OMEGA_E * t).elevation;
  const starAt = t => (star ? (rayBlocked(rAt(t), star, hAtm).blocked ? 0 : 1) : 1);
  const relayAt = t => (relayEl ? (segmentBlocked(rAt(t), stateAt(relayEl, t).r, hAtm).blocked ? 0 : 1) : 1);
  const samples = [];
  for (let t = 0; t <= tEnd + 1e-9; t += dt) {
    const r = rAt(t), sh = shadowFunction(r, sunDir);
    const s = { t, r, nu: sh.nu, region: sh.region };
    if (st) { const e = elevationFrom(st, r, theta0 + OMEGA_E * t); s.elevation = e.elevation; s.azimuth = e.azimuth; s.range = e.range; s.visible = e.elevation >= mask; }
    if (star) { const rb = rayBlocked(r, star, hAtm); s.starBlocked = rb.blocked; s.starTangent = rb.tangentAlt; }
    if (relayEl) { const rr = stateAt(relayEl, t).r; const sb = segmentBlocked(r, rr, hAtm); s.relayBlocked = sb.blocked; s.relayTangent = sb.tangentAlt; s.relayR = rr; }
    samples.push(s);
  }
  const events = [];
  for (const c of findCrossings(nuAt, 0, tEnd, dt, .999999)) events.push({ t: c.t, kind: 'penumbra', id: c.rising ? 'penumbra-exit' : 'penumbra-entry', label: c.rising ? 'Penumbra çıkışı (tam güneş)' : 'Penumbra girişi' });
  for (const c of findCrossings(nuAt, 0, tEnd, dt, 1e-6)) events.push({ t: c.t, kind: 'umbra', id: c.rising ? 'umbra-exit' : 'umbra-entry', label: c.rising ? 'Umbra çıkışı' : 'Umbra girişi (tam gölge)' });
  if (st) for (const c of findCrossings(elevAt, 0, tEnd, dt, mask)) events.push({ t: c.t, kind: 'station', id: c.rising ? 'aos' : 'los', label: c.rising ? `AOS (ε ≥ ${(mask * 180 / Math.PI).toFixed(0)}°)` : 'LOS' });
  if (star) for (const c of findCrossings(starAt, 0, tEnd, dt, .5)) events.push({ t: c.t, kind: 'sensor', id: c.rising ? 'star-egress' : 'star-ingress', label: c.rising ? 'Sensör hedefi açığa çıktı' : `Sensör örtülmesi (teğet < ${hAtm} km)` });
  if (relayEl) for (const c of findCrossings(relayAt, 0, tEnd, dt, .5)) events.push({ t: c.t, kind: 'link', id: c.rising ? 'link-up' : 'link-down', label: c.rising ? 'Röle bağlantısı açıldı' : 'Röle bağlantısı örtüldü' });
  events.sort((a, b) => a.t - b.t);
  /* istatistik: gölge oranı, umbra süresi/tur, görünürlük süresi, geçiş sayısı */
  const n = samples.length, umbraFrac = samples.filter(s => s.nu <= 1e-6).length / n, penFrac = samples.filter(s => s.nu < .999999).length / n;
  const visFrac = st ? samples.filter(s => s.visible).length / n : 0;
  const beta = betaAngle(el, sunDir), betaStar = Math.asin(R_E / el.a);
  return { samples, events, sunDir, beta, betaStar, noEclipseByBeta: Math.abs(beta) > betaStar, period: T, tEnd, dt, stats: { umbraFrac, penumbraFrac: penFrac, umbraPerRev: umbraFrac * T, visFrac, passes: events.filter(e => e.id === 'aos').length }, el, station: cfg.station, hAtm, star, relayEl, theta0 };
}
