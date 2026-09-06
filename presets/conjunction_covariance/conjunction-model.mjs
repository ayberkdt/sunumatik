/* conjunction-model.mjs — Yakın geçiş (conjunction) + kovaryans geometrisi + çarpışma olasılığı (saf).
   conjunction_covariance preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.
   İki nokta neredeyse çarpışıyor değil: BELİRSİZLİK geometrisi ana içeriktir.

   GERÇEK MODEL
   • İki nesne iki-cisim Kepler yörüngelerinde (../core/astro-orbit.mjs). Senaryo, ikincil nesnenin yörüngesini
     birincilin bir noktasından geçecek biçimde kurar: verilen ıska vektörü (RTN bileşenleri, m) ve göreli hız
     geometrisi (kesişme açısı) ile — TCA "uydurulmaz", menzil minimizasyonuyla (kaba tarama + altın oran) BULUNUR.
   • Karşılaşma çerçevesi (TCA'da): ê₁ = v_rel/|v_rel| (görüş hattı dışı), ê₂ = (r_rel × v_rel)/|·|, ê₃ = ê₁ × ê₂;
     KARŞILAŞMA DÜZLEMİ (ê₂, ê₃) v_rel'e diktir; ıska vektörü bu düzlemde yatar (r_rel ⊥ v_rel TCA'da).
   • Kovaryanslar RTN (radyal, iz-boyu, normal) çerçevesinde köşegen σ² ile verilir (m²), ECI'ye döndürülür,
     iki nesneninki TOPLANIR (bağımsız hata varsayımı), karşılaşma düzlemine izdüşürülür: C₂ = P C P^T.
   • Mahalanobis uzaklığı d_M = √(δᵀ C₂⁻¹ δ); 1σ/2σ/3σ elipsleri C₂'nin özdeğer/özvektörlerinden.
   • Çarpışma olasılığı (2B, KISA KARŞILAŞMA varsayımı: göreli hareket doğrusal, kovaryans TCA'da sabit, Gauss):
       P_c = ∬_{|x − δ| ≤ R_HB} N(x; 0, C₂) dx — sert-gövde yarıçapı R_HB (iki nesnenin yarıçap toplamı) çevresinde
       kutupsal ızgarayla sayısal integral (Foster benzeri). Seyrelme (dilution): kovaryans ölçeklendikçe P_c önce
       artar sonra düşer — büyük belirsizlik "güvenli" göstermez, bilgisizliktir; eğri hesaplanır.
   SINIRLAR: Kepler (pertürbasyon yok), kovaryans yayılımı yok (TCA'da verilen değer), Gauss varsayımı, kısa karşılaşma
   (GEO gibi yavaş geçişlerde geçersiz), yalnız konum belirsizliği. */

import { stateAt, periodOf, ORBIT_PRESETS, R_E, MU, TAU } from '../core/astro-orbit.mjs';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** RTN taban (satırlar: R̂, T̂, N̂) — konum/hızdan. */
export function rtnBasis(r, v) { const R = unit(r), N = unit(cross(r, v)), T = cross(N, R); return [R, T, N]; }
/** Köşegen RTN kovaryansı (σ_R, σ_T, σ_N m) → ECI 3×3 (satır-öncelikli). */
export function covRtnToEci(sig, basis) {
  const [R, T, N] = basis, s2 = sig.map(x => x * x), C = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = s2[0] * R[i] * R[j] + s2[1] * T[i] * T[j] + s2[2] * N[i] * N[j];
  return C;
}
/** 2×2 simetrik matris özayrışımı: { l1 ≥ l2, v1, v2 (birim) }. */
export function eig2(a, b, d) { const tr = a + d, det = a * d - b * b, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)); const l1 = tr / 2 + disc, l2 = tr / 2 - disc; let v1 = Math.abs(b) > 1e-14 ? [l1 - d, b] : (a >= d ? [1, 0] : [0, 1]); const n = Math.hypot(v1[0], v1[1]); v1 = [v1[0] / n, v1[1] / n]; return { l1, l2, v1, v2: [-v1[1], v1[0]] }; }

/**
 * Karşılaşma kur: birincil (el), ikincil el'i verilen ıska (RTN, m) ve kesişme açısı (deg) ile TÜRETİLİR.
 *   İkincilin TCA konumu = birincil konumu + ıska; hızı = |v| aynı büyüklükte, birincil hız yönünü N̂ etrafında
 *   crossAngle kadar döndür (+ isteğe bağlı eğim). Geri yayılarak Kepler elemanlarına dönüştürülür (rvToElements).
 */
export function buildEncounter({ primary = ORBIT_PRESETS.iss, tTca = 3600, miss = [120, 300, -80], crossAngle = 40, speedRatio = 1.0 } = {}) {
  const p = stateAt(primary, tTca), [R, T, N] = rtnBasis(p.r, p.v);
  const dr = add(add(scale(R, miss[0] / 1000), scale(T, miss[1] / 1000)), scale(N, miss[2] / 1000));   // km
  const rS = add(p.r, dr);
  const ang = crossAngle * Math.PI / 180, vh = unit(p.v), vn = norm(p.v) * speedRatio;
  /* N̂ etrafında döndür: v' = cos·v̂ + sin·(N̂ × v̂) */
  const vdir = add(scale(vh, Math.cos(ang)), scale(cross(N, vh), Math.sin(ang)));
  const vS = scale(vdir, vn);
  const secondary = rvToEl(rS, vS);
  /* elemanları t=0'a taşı: M0 = M(tTca) − n·tTca */
  const n = Math.sqrt(MU / secondary.a ** 3); secondary.M0 = secondary.M - n * tTca;
  return { primary, secondary, tTcaNominal: tTca };
}
function rvToEl(r, v) {
  const rn = norm(r), v2 = dot(v, v), rdotv = dot(r, v), h = cross(r, v), hn = norm(h);
  const ev = sub(scale(cross(v, h), 1 / MU), scale(r, 1 / rn)), e = norm(ev), a = 1 / (2 / rn - v2 / MU), i = Math.acos(Math.max(-1, Math.min(1, h[2] / hn)));
  const nv = [-h[1], h[0], 0], nn = Math.hypot(nv[0], nv[1]);
  let raan = nn > 1e-12 ? Math.atan2(nv[1], nv[0]) : 0, argp = 0;
  if (e > 1e-10) { if (nn > 1e-12) { argp = Math.acos(Math.max(-1, Math.min(1, dot(nv, ev) / (nn * e)))); if (ev[2] < 0) argp = TAU - argp; } else { argp = Math.atan2(ev[1], ev[0]); } }
  let nu = e > 1e-10 ? Math.acos(Math.max(-1, Math.min(1, dot(ev, r) / (e * rn)))) : 0; if (rdotv < 0) nu = TAU - nu;
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2)), M = E - e * Math.sin(E);
  return { a, e, i, raan: (raan + TAU) % TAU, argp: (argp + TAU) % TAU, M, M0: M };
}

/** TCA bul: menzil(t) kaba tarama + altın oran. Döner { tTca, miss (km), rRel, vRel, rP, vP, rS, vS }. */
export function findTca(primary, secondary, tSpan = [0, 7200], dt = 10) {
  const range = t => norm(sub(stateAt(secondary, t).r, stateAt(primary, t).r));
  let best = tSpan[0], bestR = Infinity;
  for (let t = tSpan[0]; t <= tSpan[1]; t += dt) { const r = range(t); if (r < bestR) { bestR = r; best = t; } }
  let a = best - dt, b = best + dt; const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a), fc = range(c), fd = range(d);
  for (let k = 0; k < 60; k++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = range(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = range(d); } }
  const tTca = (a + b) / 2, P = stateAt(primary, tTca), S = stateAt(secondary, tTca);
  return { tTca, miss: range(tTca), rRel: sub(S.r, P.r), vRel: sub(S.v, P.v), rP: P.r, vP: P.v, rS: S.r, vS: S.v };
}

/** Karşılaşma çerçevesi ve düzleme izdüşümler. sigP/sigS: RTN σ (m). Döner { basis, missPlane (m, 2B), C2 (m²), dM, ellipse{σ1,σ2,angle} }. */
export function encounterGeometry(tca, sigP, sigS) {
  const e1 = unit(tca.vRel); let e2 = cross(tca.rRel, tca.vRel); e2 = norm(e2) > 1e-9 ? unit(e2) : unit(cross(e1, [0, 0, 1])); const e3 = cross(e1, e2);
  const CP = covRtnToEci(sigP, rtnBasis(tca.rP, tca.vP)), CS = covRtnToEci(sigS, rtnBasis(tca.rS, tca.vS));
  const C = CP.map((v, k) => v + CS[k]);
  const proj = (v) => [dot(v, e2), dot(v, e3)];
  const missM = scale(tca.rRel, 1000);   // m
  const missPlane = proj(missM), outOfPlane = dot(missM, e1);
  const Cv = (u, w) => { let s = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += u[i] * C[i * 3 + j] * w[j]; return s; };
  const a = Cv(e2, e2), b = Cv(e2, e3), d = Cv(e3, e3);
  const det = a * d - b * b, inv = [d / det, -b / det, -b / det, a / det];
  const dM = Math.sqrt(missPlane[0] * (inv[0] * missPlane[0] + inv[1] * missPlane[1]) + missPlane[1] * (inv[2] * missPlane[0] + inv[3] * missPlane[1]));
  const eg = eig2(a, b, d);
  return { basis: { e1, e2, e3 }, missPlane, outOfPlane, C2: [a, b, b, d], det, dM, ellipse: { s1: Math.sqrt(eg.l1), s2: Math.sqrt(eg.l2), angle: Math.atan2(eg.v1[1], eg.v1[0]) }, CP, CS, C };
}

/** 2B çarpışma olasılığı: sert-gövde dairesi üzerinde kutupsal ızgara integrali (nr × nθ). */
export function collisionProbability(C2, missPlane, rHb, nrIn = null, nth = 96) {
  const [a, b, , d] = C2, det = a * d - b * b; if (det <= 0) return 0;
  /* radyal çözünürlük: en küçük σ'nın ~1/8'i (sert gövde kovaryanstan büyükse ızgara sıklaşır), 48 … 600 halka */
  const lmin = Math.max(1e-9, (a + d) / 2 - Math.sqrt(Math.max(0, (a - d) * (a - d) / 4 + b * b)));
  const nr = nrIn ?? Math.min(600, Math.max(48, Math.ceil(8 * rHb / Math.sqrt(lmin))));
  const inv = [d / det, -b / det, -b / det, a / det], k = 1 / (2 * Math.PI * Math.sqrt(det));
  let P = 0;
  for (let i = 0; i < nr; i++) { const r = (i + .5) / nr * rHb, dA = (rHb / nr) * r * (TAU / nth);
    for (let j = 0; j < nth; j++) { const th = (j + .5) / nth * TAU, x = missPlane[0] + r * Math.cos(th), y = missPlane[1] + r * Math.sin(th);
      const q = x * (inv[0] * x + inv[1] * y) + y * (inv[2] * x + inv[3] * y); P += k * Math.exp(-.5 * q) * dA; } }
  return Math.min(1, P);
}

/** Seyrelme eğrisi: kovaryans ölçeği k ∈ [0,1 … 10] için P_c(k). */
export function dilutionCurve(C2, missPlane, rHb, n = 60) {
  const out = []; for (let i = 0; i < n; i++) { const k = Math.pow(10, -1 + 2 * i / (n - 1)); out.push({ k, pc: collisionProbability(C2.map(v => v * k * k), missPlane, rHb) }); }
  const peak = out.reduce((m, o) => o.pc > m.pc ? o : m, out[0]);
  return { points: out, peak };
}

/** Tam analiz. */
export function analyzeConjunction(cfg = {}) {
  const enc = buildEncounter(cfg);
  const tca = findTca(enc.primary, enc.secondary, [Math.max(0, enc.tTcaNominal - 1800), enc.tTcaNominal + 1800], 5);
  const sigP = cfg.sigP ?? [50, 400, 60], sigS = cfg.sigS ?? [120, 900, 150], rHb = cfg.rHb ?? 20;
  const geo = encounterGeometry(tca, sigP, sigS);
  const pc = collisionProbability(geo.C2, geo.missPlane, rHb);
  const dil = dilutionCurve(geo.C2, geo.missPlane, rHb);
  /* menzil ve göreli konum zaman serisi (TCA ± 15 dk) */
  const series = []; for (let t = tca.tTca - 900; t <= tca.tTca + 900; t += 5) { const P = stateAt(enc.primary, t), S = stateAt(enc.secondary, t); const rel = sub(S.r, P.r); series.push({ t, range: norm(rel) * 1000, rel: [dot(rel, geo.basis.e1), dot(rel, geo.basis.e2), dot(rel, geo.basis.e3)].map(x => x * 1000) }); }
  return { ...enc, tca, sigP, sigS, rHb, geo, pc, dilution: dil, series, vRelMag: norm(tca.vRel), periodP: periodOf(enc.primary.a), periodS: periodOf(enc.secondary.a) };
}
