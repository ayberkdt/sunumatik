/* reentry-model.mjs — Atmosferik giriş / giriş koridoru GERÇEK MODELİ (saf, THREE'siz).
   reentry_corridor preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.

   GERÇEK MODEL (düzlemsel, küresel dönmeyen Dünya, nokta-kütle, US76 atmosferi):
     v̇ = −D/m − g sin γ
     γ̇ = (L cos σ)/(m v) − (g/v − v/r) cos γ          (σ: yatış açısı, cos σ ile kaldırma düzlem-içi)
     ḣ = v sin γ,  ṡ = (R/r) v cos γ                    (s: yer menzili)
     D = ½ ρ v² C_D A,  L = (L/D)·D,  g = μ/r²,  β = m/(C_D A) balistik katsayı
   Isınma vekili (BİLDİRİLEN MODEL): Sutton–Graves durma-noktası konvektif akısı
     q̇ = k √(ρ/r_n) v³,  k = 1,7415e−4 (SI; W/m², ρ kg/m³, r_n m, v m/s) — radyatif ısınma yok.
     Q = ∫ q̇ dt (J/m²).  Yavaşlama n = |a_aero|/g₀.
   Atmosfer: US76 (0–86 km) + üstel-tablo termosferi (≥ 90 km, Vallado Tablo 8-4; 120 km'de 2,4e−8 kg/m³),
     86–90 km arası doğrusal karışım (densityBlend).
   Entegrasyon: RK4, dt = 0,25 s (v > 1 km/s) → 0,5 s; bitiş: h ≤ h_son (10 km) ya da atmosferden
     çıkış (h > h_arayüz ve ḣ > 0 → 'skip').

   KORİDOR (neden var?): γ_E taraması ile iki sınır BULUNUR (bisection):
     • aşma (overshoot) sınırı: bundan sığ girişler yakalanmaz — atmosferden yeniden çıkar (skip)
       ya da yeterince yavaşlayamaz (çıkışta v > v_dairesel, yörüngede kalır).
     • altında kalma (undershoot) sınırı: bundan dik girişler yavaşlama tavanını (n_max, örn. 10 g)
       ya da ısı akısı tavanını (q̇_max) aşar.
     Koridor = [γ_aşma, γ_altında]; genişliği v_E, L/D ve β'ya bağlıdır — bu bağımlılık sahnede okunur.
   Ayrıca (h, v) düzleminde eş-yavaşlama ve eş-ısı-akısı eğrileri kapalı biçimden çizilir:
     n = g_lim ⇒ v = √(2 n g₀ β / ρ(h));  q̇ = q̇_lim ⇒ v = (q̇_lim / (k √(ρ(h)/r_n)))^{1/3}. */

import { atmosphere, densityBlend, G0 } from '../core/astro-atmosphere.mjs';

export const MU = 3.986004418e14, R_E = 6378137;
export const K_SG = 1.7415e-4;

export const VEHICLES = Object.freeze({
  capsule: { label: 'Kapsül (Apollo sınıfı)', m: 5500, cd: 1.30, area: 12.0, ld: 0.30, rn: 4.7 },
  capsuleLeo: { label: 'Kapsül (LEO dönüşü, Soyuz/Dragon sınıfı)', m: 7000, cd: 1.35, area: 10.5, ld: 0.25, rn: 3.5 },
  lifting: { label: 'Kaldırmalı gövde (Shuttle sınıfı)', m: 95000, cd: 0.85, area: 250, ld: 1.10, rn: 1.5 },
  ballistic: { label: 'Balistik (L/D = 0, küçük sonda)', m: 300, cd: 1.0, area: 0.8, ld: 0.0, rn: 0.4 },
});

export const DEFAULT_ENTRY = Object.freeze({
  hEntry: 120e3,     // m — giriş arayüzü
  vEntry: 7800,      // m/s — LEO dönüşü (Ay dönüşü ≈ 11 000)
  gammaEntry: -6.0,  // deg (negatif = aşağı)
  bank: 0,           // deg — yatış (L cos σ düzlem-içi)
  hEnd: 10e3,        // m — bitiş (paraşüt / uçuş sonu)
  nMax: 10,          // g — yavaşlama tavanı (koridor)
  qMax: 5e6,         // W/m² — ısı akısı tavanı (koridor; kapsül ~ 5 MW/m² ölçeği)
  dt: 0.25,
});

/** Tek giriş yörüngesi. Döner { samples, peaks, outcome:'landed'|'skip'|'orbit', events, duration, heatLoad } */
export function simulateEntry(vehicle = VEHICLES.capsule, entry = {}) {
  const V = { ...VEHICLES.capsule, ...vehicle }, E = { ...DEFAULT_ENTRY, ...entry };
  const beta = V.m / (V.cd * V.area), rad = Math.PI / 180, cosBank = Math.cos(E.bank * rad);
  let v = E.vEntry, gam = E.gammaEntry * rad, h = E.hEntry, s = 0, t = 0, Q = 0;
  const samples = []; let peakG = { n: 0 }, peakQ = { q: 0 }, outcome = 'landed';
  const deriv = (v, gam, h) => {
    const r = R_E + h, g = MU / (r * r), rho = densityBlend(h) * (E.rhoScale ?? 1);   // rhoScale: atmosfer yoğunluk sapması (dağılım analizi)
    const D = .5 * rho * v * v * V.cd * V.area, L = V.ld * D;
    return { dv: -D / V.m - g * Math.sin(gam), dgam: (L * cosBank) / (V.m * v) - (g / v - v / r) * Math.cos(gam), dh: v * Math.sin(gam), ds: (R_E / r) * v * Math.cos(gam), rho, D, g };
  };
  const push = (d) => {
    const n = Math.hypot(d.D / V.m, V.ld * d.D / V.m) / G0, q = K_SG * Math.sqrt(d.rho / V.rn) * v * v * v, mach = v / atmosphere(h).a;
    samples.push({ t, h, v, gamma: gam, s, rho: d.rho, n, q, Q, mach, dynP: .5 * d.rho * v * v });
    if (n > peakG.n) peakG = { n, t, h, v };
    if (q > peakQ.q) peakQ = { q, t, h, v };
  };
  push(deriv(v, gam, h));
  const tMax = 3600;
  while (t < tMax) {
    const dt = v > 1000 ? E.dt : E.dt * 2;
    const k1 = deriv(v, gam, h);
    const k2 = deriv(v + .5 * dt * k1.dv, gam + .5 * dt * k1.dgam, h + .5 * dt * k1.dh);
    const k3 = deriv(v + .5 * dt * k2.dv, gam + .5 * dt * k2.dgam, h + .5 * dt * k2.dh);
    const k4 = deriv(v + dt * k3.dv, gam + dt * k3.dgam, h + dt * k3.dh);
    v += dt / 6 * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv);
    gam += dt / 6 * (k1.dgam + 2 * k2.dgam + 2 * k3.dgam + k4.dgam);
    h += dt / 6 * (k1.dh + 2 * k2.dh + 2 * k3.dh + k4.dh);
    s += dt / 6 * (k1.ds + 2 * k2.ds + 2 * k3.ds + k4.ds);
    t += dt;
    const d = deriv(v, gam, h);
    Q += K_SG * Math.sqrt(d.rho / V.rn) * v * v * v * dt;
    push(d);
    if (h <= E.hEnd) { outcome = 'landed'; break; }
    if (h > E.hEntry && d.dh > 0) { outcome = v * v / 2 - MU / (R_E + h) >= 0 ? 'escape' : (v >= Math.sqrt(MU / (R_E + h)) * .999 ? 'orbit' : 'skip'); break; }
    if (v < 50) break;
  }
  const events = [{ id: 'interface', t: 0, label: 'Giriş arayüzü', h: E.hEntry }];
  if (peakQ.t != null) events.push({ id: 'peakq', t: peakQ.t, label: 'Tepe ısı akısı', h: peakQ.h, q: peakQ.q, derived: true });
  if (peakG.t != null) events.push({ id: 'peakg', t: peakG.t, label: 'Tepe yavaşlama', h: peakG.h, n: peakG.n, derived: true });
  const last = samples[samples.length - 1];
  events.push({ id: 'end', t: last.t, label: outcome === 'landed' ? `${(E.hEnd / 1e3).toFixed(0)} km — uçuş sonu` : outcome === 'skip' ? 'Atmosferden çıkış (skip)' : outcome === 'orbit' ? 'Yakalanamadı (yörüngede)' : 'Kaçış', h: last.h });
  events.sort((a, b) => a.t - b.t);
  return { samples, events, peakG, peakQ, heatLoad: Q, outcome, duration: last.t, downrange: last.s, vehicle: V, entry: E, beta };
}

/**
 * Koridor sınırları (klasik tanım, kaldırmalı araç için):
 *   • aşma sınırı: TAM KALDIRMA AŞAĞI (σ = 180°) ile yakalanan en sığ γ — araç en fazla bu kadar sığ girerse
 *     kaldırmayı aşağı çevirerek hâlâ yakalanabilir;
 *   • altında kalma sınırı: TAM KALDIRMA YUKARI (σ = 0°) ile n_max ve q̇_max içinde kalan en dik γ.
 *   L/D = 0 için iki durum aynıdır (balistik koridor). Tarama + bisection; sonuçlar derece.
 * Döner { gammaOvershoot, gammaUndershoot, width, sweep, overshootSim, undershootSim }.
 */
export function findCorridor(vehicle = VEHICLES.capsule, entry = {}, { gMin = -30, gMax = -0.2, nSweep = 30 } = {}) {
  const E = { ...DEFAULT_ENTRY, ...entry };
  const run = (g, bank) => simulateEntry(vehicle, { ...E, gammaEntry: g, bank });
  const captured = r => r.outcome === 'landed';
  const within = r => captured(r) && r.peakG.n <= E.nMax && r.peakQ.q <= E.qMax;
  const gam = k => gMin + (gMax - gMin) * k / nSweep;
  /* taramalar: aşağı-kaldırma ile yakalama, yukarı-kaldırma ile limit */
  const sweep = [];
  const capDown = [], okUp = [];
  for (let k = 0; k <= nSweep; k++) {
    const g = gam(k), rd = run(g, 180), ru = run(g, 0);
    capDown.push(captured(rd)); okUp.push(within(ru));
    sweep.push({ gamma: g, outcomeDown: rd.outcome, outcomeUp: ru.outcome, peakGUp: ru.peakG.n, peakQUp: ru.peakQ.q, capturedDown: captured(rd), withinUp: within(ru) });
  }
  const bisect = (a, b, pred, bank) => { for (let k = 0; k < 22; k++) { const m = (a + b) / 2; (pred(run(m, bank)) ? (a = m) : (b = m)); } return a; };
  /* aşma: yakalanan en sığ (γ büyürken captured true → false geçişi) */
  let gammaOvershoot = NaN;
  let lastCap = -1; for (let k = 0; k <= nSweep; k++) if (capDown[k]) lastCap = k;
  if (lastCap >= 0) gammaOvershoot = lastCap === nSweep ? gMax : bisect(gam(lastCap), gam(lastCap + 1), captured, 180);
  /* altında kalma: önce yukarı-kaldırma ile yakalanan en sığ γ (γ_capUp) bulunur; limit-içi bölge
     bundan daha dik tarafta tek parçalıdır (dikleştikçe n ve q̇ artar) → within true→false geçişi bisection ile */
  let gammaUndershoot = NaN;
  const capUpArr = sweep.map(s => s.outcomeUp === 'landed');
  let lastCapUp = -1; for (let k = 0; k <= nSweep; k++) if (capUpArr[k]) lastCapUp = k;
  if (lastCapUp >= 0) {
    const gCapUp = lastCapUp === nSweep ? gMax : bisect(gam(lastCapUp), gam(lastCapUp + 1), captured, 0);
    if (within(run(gCapUp, 0))) {
      /* dik uçta limit aşılıyor mu? aşılmıyorsa koridor gMin'e kadar */
      if (within(run(gMin, 0))) gammaUndershoot = gMin;
      else { let a = gCapUp, b = gMin; for (let k = 0; k < 22; k++) { const m = (a + b) / 2; (within(run(m, 0)) ? (a = m) : (b = m)); } gammaUndershoot = a; }
    }
  }
  const width = gammaOvershoot - gammaUndershoot;
  return { gammaOvershoot, gammaUndershoot, width, sweep,
    overshootSim: Number.isFinite(gammaOvershoot) ? run(gammaOvershoot, 180) : null,
    undershootSim: Number.isFinite(gammaUndershoot) ? run(gammaUndershoot, 0) : null };
}

/** (h, v) düzleminde eş-yavaşlama eğrisi: v(h) = √(2 n g₀ β / ρ(h)). */
export function isoDecelCurve(beta, nG, hMin = 20e3, hMax = 120e3, steps = 60) {
  const out = []; for (let k = 0; k <= steps; k++) { const h = hMin + (hMax - hMin) * k / steps; out.push({ h, v: Math.sqrt(2 * nG * G0 * beta / densityBlend(h)) }); } return out;
}
/** Eş-ısı-akısı eğrisi: v(h) = (q̇ / (k √(ρ/r_n)))^{1/3}. */
export function isoHeatCurve(rn, qDot, hMin = 20e3, hMax = 120e3, steps = 60) {
  const out = []; for (let k = 0; k <= steps; k++) { const h = hMin + (hMax - hMin) * k / steps; out.push({ h, v: Math.cbrt(qDot / (K_SG * Math.sqrt(densityBlend(h) / rn))) }); } return out;
}

export function sampleAt(sim, t) {
  const S = sim.samples; if (t <= S[0].t) return S[0]; if (t >= S[S.length - 1].t) return S[S.length - 1];
  let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; S[m].t <= t ? lo = m : hi = m; }
  const a = S[lo], b = S[hi], f = (t - a.t) / Math.max(1e-9, b.t - a.t), o = {};
  for (const k of Object.keys(a)) o[k] = a[k] + (b[k] - a[k]) * f; return o;
}
