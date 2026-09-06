/* od-model.mjs — Yörünge Belirleme (EKF) laboratuvarı, SAF model (THREE gerekmez).

   GERÇEK: iki-cisim + J2 (RK4, sabit adım dt). İSTASYONLAR: ECEF birim vektörü (enlem/boylam), Dünya
   θ = θ₀ + ω_e t ile döner; ölçüm menzil ρ = |r − R_s| ve menzil-hızı ρ̇ = d·(v − V_s)/ρ (V_s = ω × R_s),
   yükseklik maskesi altında yok; Gauss gürültü (tohumlu Box–Muller). FİLTRE: genişletilmiş Kalman filtresi,
   durum [r; v] (6), tahmin adımı RK4 haritasının SONLU-FARK Jacobian'ı Φ (12 ek RK4 çağrısı), süreç gürültüsü
   sürekli beyaz ivme q = σ_a² → Q = q·[[dt³/3 I, dt²/2 I],[dt²/2 I, dt I]]; güncelleme ANALİTİK H (menzil:
   ∂ρ/∂r = d/ρ; ρ̇: ∂ρ̇/∂r = (v − V_s)/ρ − ρ̇ d/ρ², ∂ρ̇/∂v = d/ρ), Joseph biçimi P güncellemesi.
   TUTARLILIK: NEES = eᵀP⁻¹e (beklenen 6), NIS = νᵀS⁻¹ν (beklenen ölçüm sayısı), normalize artıklar.
   Hiçbir hata/kovaryans değeri elle yerleştirilmez; hepsi simülasyondan çıkar. */

import { MU, R_E, J2, OMEGA_E, solveKepler } from '../core/astro-orbit.mjs';
import { stationEcef } from '../eclipse_geometry/eclipse-model.mjs';
import { elementsToRv } from '../orbit_perturbations/perturbation-model.mjs';

export { MU, R_E, J2, OMEGA_E };
const norm = v => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const STATIONS = Object.freeze({
  ankara: { label: 'Ankara', lat: 39.93, lon: 32.85 }, svalbard: { label: 'Svalbard', lat: 78.23, lon: 15.39 }, canberra: { label: 'Canberra', lat: -35.40, lon: 148.98 },
  goldstone: { label: 'Goldstone', lat: 35.43, lon: -116.89 }, kourou: { label: 'Kourou', lat: 5.25, lon: -52.80 },
});
export const SCENARIOS = Object.freeze({
  leoOne: { label: 'LEO · tek istasyon (Ankara)', el: { a: 6878, e: .001, i: 51.6, raan: 40, argp: 0, M0: 0 }, stations: ['ankara'], meas: ['range', 'rate'], hours: 24, dt: 10, filterJ2: true, sigA: 1e-8 },
  leoThree: { label: 'LEO · üç istasyon', el: { a: 6878, e: .001, i: 51.6, raan: 40, argp: 0, M0: 0 }, stations: ['ankara', 'canberra', 'goldstone'], meas: ['range', 'rate'], hours: 24, dt: 10, filterJ2: true, sigA: 1e-8 },
  ssoPolar: { label: 'SSO · kutup istasyonu (Svalbard)', el: { a: 7078, e: .001, i: 98.2, raan: 120, argp: 0, M0: 0 }, stations: ['svalbard'], meas: ['range', 'rate'], hours: 24, dt: 10, filterJ2: true, sigA: 1e-8 },
  rangeOnly: { label: 'LEO · yalnız menzil', el: { a: 6878, e: .001, i: 51.6, raan: 40, argp: 0, M0: 0 }, stations: ['ankara', 'canberra'], meas: ['range'], hours: 24, dt: 10, filterJ2: true, sigA: 1e-8 },
  rateOnly: { label: 'LEO · yalnız menzil-hızı', el: { a: 6878, e: .001, i: 51.6, raan: 40, argp: 0, M0: 0 }, stations: ['ankara', 'canberra'], meas: ['rate'], hours: 24, dt: 10, filterJ2: true, sigA: 1e-8 },
  badModel: { label: 'LEO · filtre J2\'yi bilmiyor', el: { a: 6878, e: .001, i: 51.6, raan: 40, argp: 0, M0: 0 }, stations: ['ankara', 'canberra', 'goldstone'], meas: ['range', 'rate'], hours: 24, dt: 10, filterJ2: false, sigA: 1e-8 },
  meoBadModel: { label: 'MEO (GPS) · filtre J2 bilmiyor, süreç gürültüsü büyütülmüş', el: { a: 26560, e: .001, i: 55, raan: 40, argp: 0, M0: 0 }, stations: ['ankara', 'canberra', 'goldstone'], meas: ['range', 'rate'], hours: 48, dt: 30, filterJ2: false, sigA: 3e-7 },
  geo: { label: 'GEO · tek istasyon (zayıf gözlenebilirlik)', el: { a: 42164, e: .0005, i: .1, raan: 0, argp: 0, M0: 320 }, stations: ['kourou'], meas: ['range', 'rate'], hours: 48, dt: 60, filterJ2: true, sigA: 1e-9 },
  lostInSpace: { label: 'LEO · büyük başlangıç hatası (10 km, 10 m/s): EKF aşırı güven', el: { a: 6878, e: .001, i: 51.6, raan: 40, argp: 0, M0: 0 }, stations: ['ankara', 'canberra', 'goldstone'], meas: ['range', 'rate'], hours: 24, dt: 10, filterJ2: true, sigA: 1e-8, err0Pos: 10, err0Vel: .01 },
  molniya: { label: 'Molniya · iki istasyon', el: { a: 26600, e: .74, i: 63.4, raan: 60, argp: 270, M0: 0 }, stations: ['svalbard', 'ankara'], meas: ['range', 'rate'], hours: 48, dt: 30, filterJ2: true, sigA: 1e-8 },
});

function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gaussian(rand) { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** İvme: iki-cisim (+ J2). */
export function accel(r, j2 = true) {
  const rn = norm(r), r3 = rn ** 3, a = [-MU * r[0] / r3, -MU * r[1] / r3, -MU * r[2] / r3];
  if (j2) { const k = 1.5 * J2 * MU * R_E * R_E / (rn ** 4), z2 = (r[2] / rn) ** 2; a[0] += k * r[0] / rn * (5 * z2 - 1); a[1] += k * r[1] / rn * (5 * z2 - 1); a[2] += k * r[2] / rn * (5 * z2 - 3); }
  return a;
}
/** Tek RK4 adımı (6-durum). */
export function rk4Step(x, h, j2) {
  const f = s => { const a = accel([s[0], s[1], s[2]], j2); return [s[3], s[4], s[5], a[0], a[1], a[2]]; };
  const k1 = f(x), x2 = x.map((v, i) => v + .5 * h * k1[i]), k2 = f(x2), x3 = x.map((v, i) => v + .5 * h * k2[i]), k3 = f(x3), x4 = x.map((v, i) => v + h * k3[i]), k4 = f(x4);
  return x.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
/** RK4 haritasının sonlu-fark Jacobian'ı Φ (6×6, merkezi fark). */
export function stmStep(x, h, j2) {
  const Phi = Array.from({ length: 6 }, () => new Array(6).fill(0));
  for (let j = 0; j < 6; j++) { const eps = j < 3 ? 1e-3 : 1e-6; const xp = x.slice(), xm = x.slice(); xp[j] += eps; xm[j] -= eps; const fp = rk4Step(xp, h, j2), fm = rk4Step(xm, h, j2); for (let i = 0; i < 6; i++) Phi[i][j] = (fp[i] - fm[i]) / (2 * eps); }
  return Phi;
}
/* küçük matris yardımcıları */
const matMul = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
const matT = A => A[0].map((_, j) => A.map(r => r[j]));
const matAdd = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
const matSub = (A, B) => A.map((r, i) => r.map((x, j) => x - B[i][j]));
const eye = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export function inv(M) {
  const n = M.length, A = M.map(r => r.slice()), I = eye(n);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [I[c], I[p]] = [I[p], I[c]]; const d = A[c][c]; if (Math.abs(d) < 1e-300) return null; for (let j = 0; j < n; j++) { A[c][j] /= d; I[c][j] /= d; } for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f) for (let j = 0; j < n; j++) { A[r][j] -= f * A[c][j]; I[r][j] -= f * I[c][j]; } } }
  return I;
}
const symmetrize = P => P.map((r, i) => r.map((x, j) => .5 * (x + P[j][i])));

/** İstasyon ECI konumu ve hızı (θ = θ₀ + ω_e t). */
export function stationEci(u, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const R = [R_E * (c * u[0] - s * u[1]), R_E * (s * u[0] + c * u[1]), R_E * u[2]];
  return { R, V: [-OMEGA_E * R[1], OMEGA_E * R[0], 0], u: [c * u[0] - s * u[1], s * u[0] + c * u[1], u[2]] };
}
/** Ölçüm modeli: { rho, rhoDot, el, H_rho, H_rate } (H: 1×6 satırlar). */
export function measure(x, st) {
  const d = [x[0] - st.R[0], x[1] - st.R[1], x[2] - st.R[2]], rho = norm(d), dv = [x[3] - st.V[0], x[4] - st.V[1], x[5] - st.V[2]];
  const rhoDot = dot(d, dv) / rho, el = Math.asin(Math.max(-1, Math.min(1, dot(d, st.u) / rho)));
  const H_rho = [d[0] / rho, d[1] / rho, d[2] / rho, 0, 0, 0];
  const H_rate = [dv[0] / rho - rhoDot * d[0] / (rho * rho), dv[1] / rho - rhoDot * d[1] / (rho * rho), dv[2] / rho - rhoDot * d[2] / (rho * rho), d[0] / rho, d[1] / rho, d[2] / rho];
  return { rho, rhoDot, el, H_rho, H_rate };
}

/**
 * runOd(scenarioId, overrides) → { cfg, samples:[{t, truth, est, errPos, errVel, sig3Pos, sig3Vel, nees, nMeasSoFar}], meas:[{t, k, station, type, z, pred, innov, sigInnov, nis, elDeg}],
 *   passes:[{station, t0, t1, n}], stats:{ rmsPosFinal, rmsVelFinal, neesMean, nisMean, nMeas, nPasses, converged, errPos0, errPosMin }, stationsEci(t) }
 */
export function runOd(id = 'leoOne', ov = {}) {
  const base = SCENARIOS[id] ?? SCENARIOS.leoOne;
  const cfg = { ...base, ...ov, el: { ...base.el, ...(ov.el || {}) }, seed: ov.seed ?? 20260906, sigRho: ov.sigRho ?? .01, sigRate: ov.sigRate ?? 1e-5, maskDeg: ov.maskDeg ?? 10, err0Pos: ov.err0Pos ?? base.err0Pos ?? 1, err0Vel: ov.err0Vel ?? base.err0Vel ?? 1e-3, theta0: ov.theta0 ?? 0, meas: ov.meas ?? base.meas };
  const rand = mulberry32(cfg.seed), g = () => gaussian(rand);
  const el = { a: cfg.el.a, e: cfg.el.e, i: cfg.el.i * Math.PI / 180, raan: cfg.el.raan * Math.PI / 180, argp: cfg.el.argp * Math.PI / 180, M0: cfg.el.M0 * Math.PI / 180 };
  const E0 = solveKepler(el.M0, el.e), nu0 = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E0 / 2), Math.sqrt(1 - el.e) * Math.cos(E0 / 2));
  const rv0 = elementsToRv({ ...el, nu: nu0 }); let truth = [...rv0.r, ...rv0.v];
  /* başlangıç hatası: rastgele yönde, verilen büyüklükte; P₀ aynı ölçekte (tutarlılık adil) */
  const dir = [g(), g(), g()], dn = norm(dir), dv = [g(), g(), g()], dvn = norm(dv);
  let x = [truth[0] + cfg.err0Pos * dir[0] / dn, truth[1] + cfg.err0Pos * dir[1] / dn, truth[2] + cfg.err0Pos * dir[2] / dn, truth[3] + cfg.err0Vel * dv[0] / dvn, truth[4] + cfg.err0Vel * dv[1] / dvn, truth[5] + cfg.err0Vel * dv[2] / dvn];
  let P = eye(6).map((r, i) => r.map(v => v * (i < 3 ? cfg.err0Pos ** 2 : cfg.err0Vel ** 2)));
  const stations = cfg.stations.map(k => ({ id: k, ...STATIONS[k], u: stationEcef(STATIONS[k].lat, STATIONS[k].lon) }));
  const dt = cfg.dt, N = Math.round(cfg.hours * 3600 / dt), q = cfg.sigA ** 2;
  const Qd = [[dt ** 3 / 3, 0, 0, dt * dt / 2, 0, 0], [0, dt ** 3 / 3, 0, 0, dt * dt / 2, 0], [0, 0, dt ** 3 / 3, 0, 0, dt * dt / 2], [dt * dt / 2, 0, 0, dt, 0, 0], [0, dt * dt / 2, 0, 0, dt, 0], [0, 0, dt * dt / 2, 0, 0, dt]].map(r => r.map(v => v * q));
  const samples = [], meas = [], passes = []; const open = {}; let nMeas = 0, neesSum = 0, nisSum = 0, nisCount = 0;
  const mask = cfg.maskDeg * Math.PI / 180;
  const record = (t, k) => {
    const e = x.map((v, i) => v - truth[i]); const Pi = inv(P); const nees = Pi ? e.reduce((s, ei, i) => s + ei * Pi[i].reduce((a, pij, j) => a + pij * e[j], 0), 0) : NaN;
    neesSum += nees;
    samples.push({ t, truth: truth.slice(), est: x.slice(), errPos: norm(e), errVel: Math.hypot(e[3], e[4], e[5]), sig3Pos: 3 * Math.sqrt(P[0][0] + P[1][1] + P[2][2]), sig3Vel: 3 * Math.sqrt(P[3][3] + P[4][4] + P[5][5]), nees, nMeasSoFar: nMeas, Prr: [[P[0][0], P[0][1], P[0][2]], [P[1][0], P[1][1], P[1][2]], [P[2][0], P[2][1], P[2][2]]] });
  };
  for (let k = 0; k <= N; k++) {
    const t = k * dt, theta = cfg.theta0 + OMEGA_E * t;
    if (k > 0) {
      truth = rk4Step(truth, dt, true);
      const Phi = stmStep(x, dt, cfg.filterJ2); x = rk4Step(x, dt, cfg.filterJ2);
      P = symmetrize(matAdd(matMul(matMul(Phi, P), matT(Phi)), Qd));
    }
    /* ölçümler */
    for (const st of stations) {
      const se = stationEci(st.u, theta); const mt = measure(truth, se);
      if (mt.el < mask) { if (open[st.id]) { passes.push({ station: st.label, t0: open[st.id].t0, t1: t, n: open[st.id].n }); delete open[st.id]; } continue; }
      if (!open[st.id]) open[st.id] = { t0: t, n: 0 }; open[st.id].n++;
      const zs = []; if (cfg.meas.includes('range')) zs.push({ type: 'range', z: mt.rho + cfg.sigRho * g(), sig: cfg.sigRho }); if (cfg.meas.includes('rate')) zs.push({ type: 'rate', z: mt.rhoDot + cfg.sigRate * g(), sig: cfg.sigRate });
      for (const m of zs) {
        const me = measure(x, se); const pred = m.type === 'range' ? me.rho : me.rhoDot, H = m.type === 'range' ? me.H_rho : me.H_rate;
        const PHt = P.map(r => r.reduce((s, v, j) => s + v * H[j], 0)); const S = H.reduce((s, h, i) => s + h * PHt[i], 0) + m.sig * m.sig;
        const innov = m.z - pred, K = PHt.map(v => v / S);
        x = x.map((v, i) => v + K[i] * innov);
        const IKH = matSub(eye(6), K.map(ki => H.map(h => ki * h)));
        P = symmetrize(matAdd(matMul(matMul(IKH, P), matT(IKH)), K.map(ki => K.map(kj => ki * kj * m.sig * m.sig))));   // Joseph
        const nis = innov * innov / S; nisSum += nis; nisCount++; nMeas++;
        meas.push({ t, k, station: st.label, type: m.type, z: m.z, pred, innov, sigInnov: Math.sqrt(S), nis, elDeg: mt.el * 180 / Math.PI });
      }
    }
    record(t, k);
  }
  for (const [id, o] of Object.entries(open)) passes.push({ station: stations.find(s => s.id === id).label, t0: o.t0, t1: N * dt, n: o.n });
  passes.sort((a, b) => a.t0 - b.t0);
  const tail = samples.slice(Math.floor(samples.length * .75));
  const rms = arr => Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length);
  const stats = { rmsPosFinal: rms(tail.map(s => s.errPos)), rmsVelFinal: rms(tail.map(s => s.errVel)), sig3PosFinal: tail[tail.length - 1].sig3Pos, neesMean: neesSum / samples.length, nisMean: nisCount ? nisSum / nisCount : NaN, nMeas, nPasses: passes.length, errPos0: samples[0].errPos, errPosMin: Math.min(...samples.map(s => s.errPos)),
    inside3sigFrac: samples.filter(s => s.errPos <= s.sig3Pos).length / samples.length, converged: rms(tail.map(s => s.errPos)) < samples[0].errPos / 10 };
  return { cfg, el, samples, meas, passes, stats, stations, stationsEci: t => stations.map(st => ({ ...st, ...stationEci(st.u, cfg.theta0 + OMEGA_E * t) })), N, dt };
}
