/* flyby-model.mjs — Yerçekimi yardımı (gravity assist) + B-düzlemi GERÇEK MODELİ (saf).
   gravity_assist preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.

   YAMA-KONİK MODEL
   • Gezegen, Güneş çevresinde dairesel yörüngede: V_p = √(μ_☉/a_p), yön +y (x radyal dışa, z ekliptik kutbu).
   • Gelen heliosantrik hız V_in; gezegen-göreli hiperbolik fazlalık v∞_in = V_in − V_p, S = v∞_in/|v∞_in|.
   • Gezegen-göreli HİPERBOL: a = −μ/v∞², e = 1 + r_p v∞²/μ, dönme açısı δ = 2 asin(1/e),
     çarpma parametresi b = r_p √(1 + 2μ/(r_p v∞²)); asimptotlar ±(π − δ)/2… (perifokal çizim).
   • B-DÜZLEMİ: S'ye dik, gezegen merkezinden geçen düzlem. T̂ = S × ẑ / |·|, R̂ = S × T̂.
     B = b (cos θ T̂ + sin θ R̂); B·T ve B·R hedefleme bileşenleri. Çarpma dairesi:
     b_çarpma = R √(1 + 2μ/(R v∞²)) — |B| bundan küçükse gezegene çarpar.
   • Çıkan fazlalık, hiperbol düzleminde (S ve B̂ gerdirir) gezegene DOĞRU (−B̂ tarafına) bükülür:
     v∞_out = v∞ (cos δ · S − sin δ · B̂);   |v∞| KORUNUR (gezegen-göreli enerji sabit).
   • Heliosantrik: V_out = V_p + v∞_out;  ΔV = |V_out − V_in| = 2 v∞ sin(δ/2);
     enerji değişimi ΔE = V_p · (v∞_out − v∞_in) — "gezegen aracı çekti" değil, ÇERÇEVE değişimi:
     gezegen-göreli hız büyüklüğü değişmez, heliosantrik büyüklük değişir.
   • Önce/sonra heliosantrik yörünge elemanları V_in / V_out ve gezegen konumundan (vis-viva, e vektörü).
   • Hiperbol boyunca zaman: hiperbolik Kepler denklemi (M = e sinh H − H), t = 0 enberi.
   Birim: km, s. Güneş μ = 1,32712440018e11. */

export const MU_SUN = 1.32712440018e11, AU = 149597870.7;
export const BODIES = Object.freeze({
  venus: { label: 'Venüs', mu: 324858.592, R: 6051.8, a: .723332 * AU, soi: 616e3 },
  earth: { label: 'Dünya', mu: 398600.4418, R: 6378.137, a: 1.0 * AU, soi: 924e3 },
  mars: { label: 'Mars', mu: 42828.375, R: 3389.5, a: 1.523679 * AU, soi: 576e3 },
  jupiter: { label: 'Jüpiter', mu: 1.26686534e8, R: 69911, a: 5.2044 * AU, soi: 48.2e6 },
  saturn: { label: 'Satürn', mu: 3.7931187e7, R: 58232, a: 9.5826 * AU, soi: 54.5e6 },
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = a => scale(a, 1 / norm(a));

/** Heliosantrik yörünge elemanları (a, e, r_p, r_a, enerji) — konum r ve hız V'den. */
export function helioElements(r, V, mu = MU_SUN) {
  const rn = norm(r), v2 = dot(V, V), h = cross(r, V), hn = norm(h);
  const energy = v2 / 2 - mu / rn, a = -mu / (2 * energy);
  const ev = sub(scale(cross(V, h), 1 / mu), scale(r, 1 / rn)); const e = norm(ev);
  const inc = Math.acos(Math.max(-1, Math.min(1, h[2] / hn)));
  return { a, e, energy, rp: a * (1 - e), ra: e < 1 ? a * (1 + e) : Infinity, inc, period: e < 1 ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity, h: hn };
}

/**
 * Uçuş çözümü. Girdi: { body, vinf (km/s), alpha (deg: v∞_in'in gezegen hızına göre açısı, ekliptik düzleminde),
 *   rp (km, enberi yarıçapı) ya da b (km), theta (deg: B-düzlemi açısı, 0 = T̂ yönü — ekliptik düzleminde
 *   arka/ön geçiş; 180 = ters taraf; ±90 = ekliptik dışına bükme) }
 */
export function solveFlyby({ body = 'jupiter', vinf = 6, alpha = 120, rp = null, b = null, theta = 0 } = {}) {
  const B = BODIES[body];
  const Vp = [0, Math.sqrt(MU_SUN / B.a), 0], rPlanet = [B.a, 0, 0];
  const rad = Math.PI / 180;
  /* v∞_in: gezegen hızı yönünden α kadar döndürülmüş (ekliptik düzleminde) */
  const vinfIn = [vinf * Math.sin(alpha * rad), vinf * Math.cos(alpha * rad), 0];
  const Vin = add(Vp, vinfIn);
  const S = unit(vinfIn);
  const mu = B.mu, v2 = vinf * vinf;
  const a = -mu / v2;
  if (rp == null && b != null) { rp = -a + Math.sqrt(a * a + b * b); }   // b² = r_p² + 2 r_p (−a)… : b² = rp² − 2 a rp → rp = −a + √(a² + b²)… (a<0)
  rp = Math.max(rp ?? B.R * 1.5, B.R);
  const e = 1 + rp * v2 / mu, delta = 2 * Math.asin(1 / e);
  const bImp = rp * Math.sqrt(1 + 2 * mu / (rp * v2));
  const bImpact = B.R * Math.sqrt(1 + 2 * mu / (B.R * v2));
  /* B-düzlemi tabanı */
  const zhat = [0, 0, 1];
  let That = cross(S, zhat); That = norm(That) < 1e-9 ? [1, 0, 0] : unit(That);
  const Rhat = cross(S, That);
  const Bhat = add(scale(That, Math.cos(theta * rad)), scale(Rhat, Math.sin(theta * rad)));
  const Bvec = scale(Bhat, bImp);
  const BT = dot(Bvec, That), BR = dot(Bvec, Rhat);
  /* çıkan fazlalık: gezegene doğru (−B̂) bükülür */
  const vinfOut = scale(add(scale(S, Math.cos(delta)), scale(Bhat, -Math.sin(delta))), vinf);
  const Vout = add(Vp, vinfOut);
  const dV = norm(sub(Vout, Vin));
  const before = helioElements(rPlanet, Vin), after = helioElements(rPlanet, Vout);
  /* hiperbol perifokal çerçevesi: P̂ enberi yönü, Q̂ hareket yönü; düzlem S–B̂ */
  /* Perifokal çerçeve: araç gezegeni B̂ tarafından geçer → enberi yönü P̂ B̂ bileşeni pozitif: P̂ = (S − S_out)/|·|;
     açısal momentum ĥ = B̂ × S (r ≈ b B̂, v ≈ v∞ S için r × v yönü); Q̂ = ĥ × P̂. Sayısal denetim: ν → −ν∞'de hız yönü = S. */
  const Sout = unit(vinfOut);
  const hDir = unit(cross(Bhat, S));
  const Phat = unit(sub(S, Sout));
  const Qhat = unit(cross(hDir, Phat));
  return {
    body: B, bodyId: body, vinf, alpha, theta, rp, e, a, delta, b: bImp, bImpact, impact: bImp < bImpact,
    S, That, Rhat, Bhat, Bvec, BT, BR, vinfIn, vinfOut, Vp, Vin, Vout, dV, rPlanet,
    energyIn: before.energy, energyOut: after.energy, dEnergy: after.energy - before.energy, dEnergyCheck: dot(Vp, sub(vinfOut, vinfIn)),
    before, after, Phat, Qhat, hDir, tisserandIn: tisserand(before, B.a), tisserandOut: tisserand(after, B.a),
    soi: B.soi,
  };
}

/** Tisserand parametresi (gezegen yörüngesine göre): T = a_p/a + 2 √((a/a_p)(1 − e²)) cos i. */
export function tisserand(el, ap) { return ap / el.a + 2 * Math.sqrt(Math.max(0, el.a / ap * (1 - el.e * el.e))) * Math.cos(el.inc); }

/** Hiperbol üzerinde konum (gezegen-göreli, km), t = 0 enberi; ±SOI'ye kadar. Döner [{t, r:[x,y,z], v}] */
export function hyperbolaPath(fb, { n = 400, rMax = null } = {}) {
  const mu = fb.body.mu, e = fb.e, a = fb.a, p = a * (1 - e * e);
  const nuMax = Math.acos(-1 / e) * .999;                // asimptot sınırı
  const rLim = rMax ?? fb.soi;
  /* ν sınırı: r ≤ rLim */
  const cosLim = (p / rLim - 1) / e; const nuLim = Math.min(nuMax, Math.acos(Math.max(-1, Math.min(1, cosLim))));
  const out = [];
  const sqrtMu = Math.sqrt(mu / (-a * a * a));
  for (let k = 0; k <= n; k++) {
    const nu = -nuLim + 2 * nuLim * k / n;
    const r = p / (1 + e * Math.cos(nu));
    const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
    const t = (e * Math.sinh(H) - H) / sqrtMu;
    const pos = add(scale(fb.Phat, r * Math.cos(nu)), scale(fb.Qhat, r * Math.sin(nu)));
    const vf = Math.sqrt(mu / p); const vel = add(scale(fb.Phat, -vf * Math.sin(nu)), scale(fb.Qhat, vf * (e + Math.cos(nu))));
    out.push({ t, nu, r: pos, v: vel, speed: norm(vel), dist: r });
  }
  return out;
}

/** Heliosantrik yama-konik yol: gezegen hareketi + göreli hiperbol (SOI içinde). */
export function heliocentricPath(fb, path) {
  const Vp = fb.Vp, ap = fb.body.a, wp = norm(Vp) / ap;
  return path.map(s => { const ang = wp * s.t; const rp = [ap * Math.cos(ang), ap * Math.sin(ang), 0]; return { t: s.t, r: add(rp, s.r), planet: rp }; });
}

/** Yörünge çizimi için heliosantrik elips noktaları (a, e, ekliptik düzlemine izdüşüm): r(ν) perifokal → yön e-vektöründen. */
export function helioOrbitPoints(r0, V0, n = 240, mu = MU_SUN) {
  const el = helioElements(r0, V0);
  const h = cross(r0, V0), ev = sub(scale(cross(V0, h), 1 / mu), scale(r0, 1 / norm(r0)));
  const P = norm(ev) > 1e-12 ? unit(ev) : unit(r0), W = unit(h), Q = cross(W, P);
  const p = el.a * (1 - el.e * el.e);
  const pts = [];
  const nuMax = el.e < 1 ? Math.PI : Math.acos(-1 / el.e) * .98;
  for (let k = 0; k <= n; k++) { const nu = -nuMax + 2 * nuMax * k / n; const r = p / (1 + el.e * Math.cos(nu)); if (r > 40 * AU) continue; pts.push(add(scale(P, r * Math.cos(nu)), scale(Q, r * Math.sin(nu)))); }
  return { pts, el };
}
