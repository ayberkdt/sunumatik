/* attitude-model.mjs — Uzay aracı yönelim dinamiği ve kontrolü (saf, THREE'siz).
   attitude_gnc preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.

   GERÇEK MODEL
   • Kuaterniyon q = [x, y, z, w] (gövde → eylemsiz, skaler son). Kinematik: q̇ = ½ q ⊗ [ω, 0].
   • Katı gövde (Euler): I ω̇ = −ω × (I ω + h_w) + τ_dış − ḣ_w  — h_w tepki tekerleği momentumu (gövde eksenlerinde
     üç tekerlek). Tekerlek, gövdeye τ_c uygulamak için ḣ_w = −τ_c çeker; |ḣ_w| ≤ τ_max (motor), |h_w| ≤ h_max (DOYMA):
     doymuş eksende o yönde daha fazla momentum emilemez → kontrol torku sıfırlanır (kaybolur).
   • Kontrolcü: kuaterniyon geri beslemeli PD — δq = q_hedef* ⊗ q (gövde çerçevesinde hata),
     τ_c = −K_p · sgn(δq_w) · δq_v − K_d · ω;  K_p = I ω_n², K_d = 2 ζ ω_n I (kritik sönüm ζ = 1 varsayılan).
   • Serbest gövde (τ_c = 0): kinetik enerji T = ½ ωᵀIω ve |H| = |Iω + h_w| korunur — RK4 denetimi.
     Ara eksen kararsızlığı (Dzhanibekov): I₁ < I₂ < I₃ iken ω₂ etrafındaki dönüş küçük sapmayla devrilir.
   • Euler açıları: 3-2-1 (ZYX: yaw ψ, pitch θ, roll φ) ve 1-2-3 (XYZ) dizileri; gimbal kilidi:
     3-2-1'de θ = ±90°'de gövde hızlarından Euler hızlarına matris tekildir (det → 0, φ̇, ψ̇ ayrışamaz).
   • SLERP: kuaterniyon büyük-çember interpolasyonu (sabit açısal hız) — Euler açılarının doğrusal
     interpolasyonuyla karşılaştırma (aynı uç noktalar, farklı yol).
   • Entegrasyon: RK4, dt = 0,01 s; q her adımda normalize edilir. Birim: SI (kg·m², N·m, N·m·s, rad/s). */

/* ── kuaterniyon yardımcıları ([x,y,z,w]) ── */
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qConj = q => [-q[0], -q[1], -q[2], q[3]];
export const qNorm = q => { const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map(v => v / n); };
export const qFromAxisAngle = (axis, ang) => { const n = Math.hypot(...axis) || 1, s = Math.sin(ang / 2); return [axis[0] / n * s, axis[1] / n * s, axis[2] / n * s, Math.cos(ang / 2)]; };
/** Gövde vektörünü eylemsize döndür: v_i = q ⊗ v ⊗ q* */
export const qRotate = (q, v) => { const r = qMul(qMul(q, [v[0], v[1], v[2], 0]), qConj(q)); return [r[0], r[1], r[2]]; };
export const qAngle = q => 2 * Math.acos(Math.min(1, Math.abs(q[3])));
export function qSlerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b; if (d < 0) { bb = b.map(v => -v); d = -d; }
  if (d > .9995) return qNorm(a.map((v, i) => v + (bb[i] - v) * t));
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + bb[i] * wb);
}
/** 3-2-1 (yaw ψ → pitch θ → roll φ) Euler → kuaterniyon (gövde→eylemsiz). */
export function qFromEuler321(psi, theta, phi) {
  return qMul(qMul(qFromAxisAngle([0, 0, 1], psi), qFromAxisAngle([0, 1, 0], theta)), qFromAxisAngle([1, 0, 0], phi));
}
/** 1-2-3 (roll → pitch → yaw, XYZ) dizisi. */
export function qFromEuler123(phi, theta, psi) {
  return qMul(qMul(qFromAxisAngle([1, 0, 0], phi), qFromAxisAngle([0, 1, 0], theta)), qFromAxisAngle([0, 0, 1], psi));
}
/** Kuaterniyon → DCM (gövde→eylemsiz, 3×3 satır-öncelikli). */
export function qToDcm(q) {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
/** DCM → 3-2-1 Euler (ψ, θ, φ). */
export function euler321FromQ(q) {
  const R = qToDcm(q);
  const theta = Math.asin(Math.max(-1, Math.min(1, -R[6])));
  return { psi: Math.atan2(R[3], R[0]), theta, phi: Math.atan2(R[7], R[8]) };
}
/** Gövde hızları → 3-2-1 Euler hızları matrisi ve determinantı (gimbal kilidi göstergesi: θ → ±90°'de det = cos θ → 0). */
export function eulerRateMatrix321(theta, phi) {
  const c = Math.cos(theta), t = Math.tan(theta), sp = Math.sin(phi), cp = Math.cos(phi);
  const M = [1, sp * t, cp * t, 0, cp, -sp, 0, sp / c, cp / c];   // [φ̇, θ̇, ψ̇]ᵀ = M ω
  return { M, det: 1 / c, condition: Math.abs(1 / c) * Math.max(1, Math.abs(t)) };
}

export const CRAFT_PRESETS = Object.freeze({
  small: { label: 'Küçük uydu (100 kg sınıfı)', I: [12, 18, 24], hMax: 1.0, tauMax: 0.06 },
  observatory: { label: 'Gözlem uydusu (1 t sınıfı)', I: [900, 1400, 1800], hMax: 25, tauMax: 0.4 },
  cubesat: { label: 'CubeSat 3U', I: [.02, .04, .045], hMax: .003, tauMax: .0006 },
  tumbler: { label: 'Dzhanibekov cismi (ara eksen)', I: [1, 2, 3], hMax: 0, tauMax: 0 },
});

export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Simülasyon. cfg: { craft, mode:'slew'|'tumble'|'saturation'|'euler'|'slerp'|'gimbal', q0, w0, qTarget, wn, zeta, tauExt, duration, dt, wheels }
 * Döner { samples:[{t, q, w, hw, tauC, err, T, H, euler, sat}], events, cfg, stats }
 */
export function simulateAttitude(cfgIn = {}) {
  const craft = CRAFT_PRESETS[cfgIn.craft || 'small'];
  const cfg = { mode: 'slew', I: craft.I, hMax: craft.hMax, tauMax: craft.tauMax, q0: [0, 0, 0, 1], w0: [0, 0, 0], qTarget: qFromEuler321(.8, .4, -.6), wn: .2, zeta: 1, tauExt: [0, 0, 0], duration: 60, dt: .01, wheels: true, sample: .05, ...cfgIn };
  const I = cfg.I, Iinv = I.map(v => 1 / v);
  let q = qNorm(cfg.q0.slice()), w = cfg.w0.slice(), hw = [0, 0, 0], t = 0;
  const control = cfg.mode === 'slew' || cfg.mode === 'saturation';
  const Kp = I.map(v => v * cfg.wn * cfg.wn), Kd = I.map(v => 2 * cfg.zeta * cfg.wn * v);
  const events = [], samples = [];
  let saturated = [false, false, false], settledAt = null, satAt = null;
  const controller = (q, w) => {
    if (!control) return { tau: [0, 0, 0], err: [0, 0, 0], angle: 0 };
    const dq = qMul(qConj(cfg.qTarget), q);           // hata: hedef → mevcut (gövde çerçevesi)
    const sgn = dq[3] < 0 ? -1 : 1;
    const err = [dq[0], dq[1], dq[2]];
    const tau = [0, 1, 2].map(i => -Kp[i] * sgn * err[i] - Kd[i] * w[i]);
    return { tau, err, angle: qAngle(dq) };
  };
  /* tekerlek sınırlaması: motor torku ve doyma */
  const wheelTorque = (tauC, hw) => {
    const out = [0, 0, 0], hdot = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      if (!cfg.wheels || cfg.hMax <= 0) continue;
      let hd = -Math.max(-cfg.tauMax, Math.min(cfg.tauMax, tauC[i]));   // ḣ_w = −τ_c (sınırlı)
      /* doyma: h_w sınırındaysa ve daha fazlasını istiyorsa → 0 */
      if ((hw[i] >= cfg.hMax && hd > 0) || (hw[i] <= -cfg.hMax && hd < 0)) hd = 0;
      hdot[i] = hd; out[i] = -hd;
    }
    return { tau: out, hdot };
  };
  const deriv = (q, w, hw) => {
    const c = controller(q, w);
    const wt = wheelTorque(c.tau, hw);
    const H = [I[0] * w[0] + hw[0], I[1] * w[1] + hw[1], I[2] * w[2] + hw[2]];
    const gyro = cross(w, H);
    const wd = [0, 1, 2].map(i => Iinv[i] * (-gyro[i] + cfg.tauExt[i] + wt.tau[i]));
    const qd = qMul(q, [w[0] * .5, w[1] * .5, w[2] * .5, 0]);
    return { qd, wd, hd: wt.hdot, c, wt };
  };
  const stepRK4 = () => {
    const dt = cfg.dt;
    const k1 = deriv(q, w, hw);
    const q2 = q.map((v, i) => v + .5 * dt * k1.qd[i]), w2 = w.map((v, i) => v + .5 * dt * k1.wd[i]), h2 = hw.map((v, i) => v + .5 * dt * k1.hd[i]);
    const k2 = deriv(q2, w2, h2);
    const q3 = q.map((v, i) => v + .5 * dt * k2.qd[i]), w3 = w.map((v, i) => v + .5 * dt * k2.wd[i]), h3 = hw.map((v, i) => v + .5 * dt * k2.hd[i]);
    const k3 = deriv(q3, w3, h3);
    const q4 = q.map((v, i) => v + dt * k3.qd[i]), w4 = w.map((v, i) => v + dt * k3.wd[i]), h4 = hw.map((v, i) => v + dt * k3.hd[i]);
    const k4 = deriv(q4, w4, h4);
    q = qNorm(q.map((v, i) => v + dt / 6 * (k1.qd[i] + 2 * k2.qd[i] + 2 * k3.qd[i] + k4.qd[i])));
    w = w.map((v, i) => v + dt / 6 * (k1.wd[i] + 2 * k2.wd[i] + 2 * k3.wd[i] + k4.wd[i]));
    hw = hw.map((v, i) => Math.max(-cfg.hMax, Math.min(cfg.hMax, v + dt / 6 * (k1.hd[i] + 2 * k2.hd[i] + 2 * k3.hd[i] + k4.hd[i]))));
    t += dt;
    return k1;
  };
  const record = (d) => {
    const T = .5 * (I[0] * w[0] * w[0] + I[1] * w[1] * w[1] + I[2] * w[2] * w[2]);
    const Hb = [I[0] * w[0] + hw[0], I[1] * w[1] + hw[1], I[2] * w[2] + hw[2]];
    const Hi = qRotate(q, Hb);
    const eu = euler321FromQ(q);
    const sat = hw.map(v => Math.abs(v) >= cfg.hMax * .999 && cfg.hMax > 0);
    samples.push({ t, q: q.slice(), w: w.slice(), hw: hw.slice(), tauC: d.wt.tau.slice(), err: d.c.angle, T, H: Math.hypot(...Hi), Hi, euler: eu, sat, gimbal: eulerRateMatrix321(eu.theta, eu.phi).det });
    for (let i = 0; i < 3; i++) if (sat[i] && !saturated[i]) { saturated[i] = true; if (satAt == null) { satAt = t; events.push({ id: 'saturation', t, label: `Tekerlek doydu (${'xyz'[i]})` }); } }
    if (control && settledAt == null && d.c.angle < .5 * Math.PI / 180 && Math.hypot(...w) < 1e-3) { settledAt = t; events.push({ id: 'settled', t, label: 'Hedefe oturdu (< 0,5°)' }); }
  };
  let next = 0;
  let d0 = deriv(q, w, hw);
  record(d0);
  while (t < cfg.duration - 1e-9) { const d = stepRK4(); if (t >= next + cfg.sample - 1e-9) { record(deriv(q, w, hw)); next = t; } }
  events.sort((a, b) => a.t - b.t);
  const stats = { settledAt, satAt, maxRate: Math.max(...samples.map(s => Math.hypot(...s.w))), finalErr: samples[samples.length - 1].err, energyDrift: Math.abs(samples[samples.length - 1].T - samples[0].T), HDrift: Math.abs(samples[samples.length - 1].H - samples[0].H) };
  return { samples, events, cfg, stats, Kp, Kd };
}

export function sampleAt(sim, t) {
  const S = sim.samples; if (t <= S[0].t) return S[0]; if (t >= S[S.length - 1].t) return S[S.length - 1];
  let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; S[m].t <= t ? lo = m : hi = m; }
  const a = S[lo], b = S[hi], f = (t - a.t) / Math.max(1e-9, b.t - a.t);
  return { ...a, t, q: qSlerp(a.q, b.q, f), w: a.w.map((v, i) => v + (b.w[i] - v) * f), hw: a.hw.map((v, i) => v + (b.hw[i] - v) * f), err: a.err + (b.err - a.err) * f };
}
