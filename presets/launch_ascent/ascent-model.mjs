/* ascent-model.mjs — Fırlatma / tırmanış GERÇEK MODELİ (SAF, THREE'siz).
   launch_ascent preseti bunun ÜSTÜNE çizilir; Node'da doğrudan import edilip
   sınanır (scripts/validate-astro.mjs). Sahne asla fizik uydurmaz: Max-Q,
   MECO, ses duvarı, kapak ayrılması ve SECO'nun ZAMANLARI buradaki yörüngeden
   TÜRETİLİR — zaman çizelgesine elle "MAX-Q" yazılmaz.

   GERÇEK MODEL
   ────────────
   • 2B, Dünya merkezli eylemsiz düzlem (fırlatma düzlemi); nokta-kütle.
   • Yerçekimi: μ/r² (nokta kütle, J2 yok).
   • Atmosfer: US76 (../core/astro-atmosphere.mjs), Dünya ile birlikte döner:
     hava-göreli hız v_air = v − ω_e × r. Rampa, enleme göre ω_e R cos(φ)
     doğuya doğru başlangıç hızı taşır (fırlatma azimutu 90° kabulü; başka
     azimutta düzlemsel model dönme katkısını olduğu gibi doğuya koyar —
     yaklaşık ama ilan edilir).
   • Sürükleme: D = q·C_D(M)·A, q = ½ ρ |v_air|²; C_D(M) sıfır hücum açılı
     ince gövde için parçalı-doğrusal bir Mach eğrisi (transonik tepeli).
   • İtki: T = ṁ·g₀·Isp(p), Isp(p) = Isp_vak − (Isp_vak − Isp_ds)·p/p₀ —
     basınçla doğrusal itki kaybı (klasik nozul eşitliğinin doğrusallaştırılmışı).
   • Kütle: ṁ sabit (kademe başına), kademe yakıtı bitince MECO → ayrılma
     gecikmesi → SES (kademe kütlesi atılır) → kapak, q ≤ q_kapak olunca atılır.
   • Yönlendirme (GNC), aşamalı:
       1. dikey kalkış (t < t_pitch);
       2. pitch kick: itki, yerel dikeyden rampalı olarak θ_kick'e döner;
       3. yerçekimi dönüşü: itki hava-göreli hıza hizalı (sıfır hücum açısı —
          atmosferde yapısal yükü sıfırlayan klasik kural);
       4. 2. kademe: irtifa-hız geri beslemeli kapalı-döngü pitch kılavuzu:
          a_v,cmd = ω²(h_hedef − h) − 2ζω·ḣ  (kritik sönümlü, ω = 3/T_go),
          sinθ = (a_v,cmd + g_eff)/a_T, g_eff = g − v_h²/r; T_go, yatay hızı
          dairesel hıza çıkarmak için gereken süreden tahmin edilir.
          SECO: v_h ≥ v_dairesel(r). Bu PEG/optimal değildir; dürüst bir
          sadeleştirilmiş kapalı-döngü kılavuzdur ve manifestte öyle anılır.
   • Entegrasyon: RK4, sabit adım (dt = 0,05 s); olaylar adım sınırında.
   • Kayıplar entegre edilir: yerçekimi ∫g·sinγ dt, sürükleme ∫D/m dt,
     yönlendirme ∫(T/m)(1 − cos α) dt; ΔV_ideal = ∫T/m dt.

   ARAÇ VARSAYILANI: "iki kademeli orta sınıf" — Falcon 9 sınıfı kamuya açık
   yuvarlatılmış değerler; gerçek aracın teknik verisi DEĞİLDİR (illüstratif). */

import { atmosphere, SEA_LEVEL, G0 } from '../core/astro-atmosphere.mjs';

export const MU_EARTH = 3.986004418e14;   // m³/s²
export const R_EARTH = 6378137;           // m
export const OMEGA_EARTH = 7.2921159e-5;  // rad/s

export const DEFAULT_VEHICLE = Object.freeze({
  name: 'İki kademeli orta sınıf (jenerik)',
  diameter: 3.66,                    // m
  payload: 15000,                    // kg
  fairing: 1900,                     // kg
  stages: [
    { dry: 22200, prop: 411000, thrustSL: 7.6e6, thrustVac: 8.2e6, ispSL: 283, ispVac: 312 },
    { dry: 4000,  prop: 107500, thrustSL: 0,     thrustVac: 9.34e5, ispSL: 0,   ispVac: 348 },
  ],
});

export const DEFAULT_PROFILE = Object.freeze({
  latitude: 28.5,        // deg (Cape Canaveral sınıfı)
  targetAlt: 200e3,      // m — hedef dairesel yörünge
  tPitch: 8,             // s — dikey kalkış süresi
  pitchKick: 3.2,        // deg — kick sonrası yerel dikeyden sapma
  pitchKickDur: 10,      // s — kick rampası
  sepDelay: 3,           // s — MECO → ayrılma
  sesDelay: 4,           // s — ayrılma → SES
  fairingQ: 1000,        // Pa — kapak atma eşiği (q bunun altına inince)
  dt: 0.05,              // s
  sampleEvery: 0.25,     // s — çıktı örnekleme
  tMax: 1200,            // s — güvenlik tavanı
  earthRotation: true,
});

/* Sıfır hücum açılı ince gövde için C_D(M): parçalı doğrusal, transonik tepeli.
   Kaynak düzeyi: ders kitabı sınıfı tipik eğri (illüstratif). */
export function dragCoefficient(mach) {
  const pts = [[0, .30], [.8, .32], [1.05, .58], [1.3, .55], [2, .42], [3, .32], [5, .25], [8, .22]];
  if (mach <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (mach <= pts[i][0]) {
      const [m0, c0] = pts[i - 1], [m1, c1] = pts[i];
      return c0 + (c1 - c0) * (mach - m0) / (m1 - m0);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Tırmanışı simüle eder. Döner:
 * { samples:[...], events:[{id,t,label,...}], maxQ:{t,q,alt,mach}, losses:{...},
 *   orbit:{ a, e, hp, ha, period } | null, ok, vehicle, profile }
 */
export function simulateAscent(vehicleIn = {}, profileIn = {}) {
  const V = { ...DEFAULT_VEHICLE, ...vehicleIn, stages: (vehicleIn.stages || DEFAULT_VEHICLE.stages).map(s => ({ ...s })) };
  const P = { ...DEFAULT_PROFILE, ...profileIn };
  const A = Math.PI * (V.diameter / 2) ** 2;
  const rad = Math.PI / 180;
  const lat = P.latitude * rad;
  const rTarget = R_EARTH + P.targetAlt;
  const vCircTarget = Math.sqrt(MU_EARTH / rTarget);

  /* durum: x,y (m, eylemsiz düzlem), vx,vy (m/s), m (kg) */
  const s = { x: R_EARTH, y: 0, vx: 0, vy: 0, m: 0 };
  const stageMass = V.stages.map(st => st.dry + st.prop);
  s.m = stageMass.reduce((a, b) => a + b, 0) + V.payload + V.fairing;
  if (P.earthRotation) s.vy = OMEGA_EARTH * R_EARTH * Math.cos(lat);

  let stage = 0;                    // aktif kademe indeksi
  let propLeft = V.stages[0].prop;
  let fairingOn = true;
  let phase = 'vertical';           // vertical | kick | gravityturn | coast | stage2 | orbit
  let tMeco = null, tSep = null, tSes = null, tSeco = null, tFairing = null, tMach1 = null;
  let engineOn = true;
  const losses = { gravity: 0, drag: 0, steering: 0, ideal: 0 };
  const events = [{ id: 'liftoff', t: 0, label: 'Kalkış', alt: 0 }];
  const samples = [];
  let maxQ = { t: 0, q: 0, alt: 0, mach: 0 };
  let kickStart = null;

  /* yerel çerçeve yardımcıları */
  const local = st => {
    const r = Math.hypot(st.x, st.y);
    const ux = st.x / r, uy = st.y / r;             // radyal birim
    const hx = -uy, hy = ux;                        // yatay (downrange, +θ)
    const vr = st.vx * ux + st.vy * uy;
    const vh = st.vx * hx + st.vy * hy;
    const alt = r - R_EARTH;
    const wAir = P.earthRotation ? OMEGA_EARTH * r * Math.cos(lat) : 0;   // atmosfer hızı (yatay, enlem çemberi)
    const vAirR = vr, vAirH = vh - wAir;
    const vAir = Math.hypot(vAirR, vAirH);
    const atm = atmosphere(alt);
    return { r, ux, uy, hx, hy, vr, vh, alt, vAirR, vAirH, vAir, atm, mach: vAir / atm.a, q: .5 * atm.rho * vAir * vAir };
  };

  /* itki yönü (birim vektör, eylemsiz) + hücum açısı */
  const guidance = (t, st, L) => {
    const stg = V.stages[stage];
    if (!engineOn) return { tx: 0, ty: 0, thrust: 0, pitch: 0, alpha: 0 };
    const thrust = stg.thrustVac - (stg.thrustVac - stg.thrustSL) * Math.min(1, L.atm.p / SEA_LEVEL.p);
    let dx, dy;                                   // yön: yerel çerçevede (radyal, yatay)
    if (phase === 'vertical') { dx = 1; dy = 0; }
    else if (phase === 'kick') {
      const f = Math.min(1, (t - kickStart) / P.pitchKickDur);
      const th = P.pitchKick * rad * (f * f * (3 - 2 * f));
      dx = Math.cos(th); dy = Math.sin(th);
    } else if (phase === 'gravityturn') {
      /* sıfır hücum açısı: hava-göreli hız yönü */
      const n = Math.max(1e-6, L.vAir);
      dx = L.vAirR / n; dy = L.vAirH / n;
    } else {
      /* kapalı-döngü irtifa/hız pitch kılavuzu (2. kademe) */
      const aT = thrust / st.m;
      const gEff = MU_EARTH / (L.r * L.r) - L.vh * L.vh / L.r;
      const dvH = Math.max(1, vCircTarget - L.vh);
      const tGo = Math.max(8, dvH / Math.max(1e-3, aT * 0.95));
      const w = 3 / tGo;
      const aV = w * w * (rTarget - L.r) - 2 * w * L.vr;
      const sinTh = Math.max(-0.6, Math.min(0.8, (aV + gEff) / aT));
      dx = sinTh; dy = Math.sqrt(1 - sinTh * sinTh);
    }
    const tx = dx * L.ux + dy * L.hx, ty = dx * L.uy + dy * L.hy;
    const pitch = Math.atan2(dx, dy);             // yerel ufuk üstü açı
    const vn = Math.max(1e-6, Math.hypot(st.vx, st.vy));
    const cosA = Math.max(-1, Math.min(1, (tx * st.vx + ty * st.vy) / vn));
    return { tx, ty, thrust, pitch, alpha: Math.acos(cosA) };
  };

  const deriv = (t, st) => {
    const L = local(st);
    const g = guidance(t, st, L);
    const r3 = L.r ** 3;
    const cd = dragCoefficient(L.mach);
    const D = L.q * cd * A;
    const dn = Math.max(1e-6, L.vAir);
    /* sürükleme hava-göreli hıza karşı: eylemsiz bileşenler */
    const vAx = L.vAirR * L.ux + L.vAirH * L.hx, vAy = L.vAirR * L.uy + L.vAirH * L.hy;
    const dAx = -D * vAx / dn / st.m, dAy = -D * vAy / dn / st.m;
    const mdot = engineOn ? V.stages[stage].thrustVac / (G0 * V.stages[stage].ispVac) : 0;
    return {
      dx: st.vx, dy: st.vy,
      dvx: -MU_EARTH * st.x / r3 + g.thrust * g.tx / st.m + dAx,
      dvy: -MU_EARTH * st.y / r3 + g.thrust * g.ty / st.m + dAy,
      dm: -mdot, D, g, L, cd,
    };
  };

  const dt = P.dt;
  let t = 0, nextSample = 0;
  const pushSample = (t, st, d) => {
    const L = d.L;
    const gamma = Math.atan2(L.vr, L.vh);
    const v = Math.hypot(st.vx, st.vy);
    const twr = d.g.thrust / (st.m * G0);
    samples.push({
      t, x: st.x, y: st.y, vx: st.vx, vy: st.vy, m: st.m,
      alt: L.alt, downrange: R_EARTH * Math.atan2(st.y, st.x), v, vAir: L.vAir,
      gamma, q: L.q, mach: L.mach, rho: L.atm.rho, thrust: d.g.thrust, twr,
      accel: Math.hypot(d.dvx + MU_EARTH * st.x / L.r ** 3, d.dvy + MU_EARTH * st.y / L.r ** 3) / G0,
      drag: d.D, cd: d.cd, pitch: d.g.pitch, alpha: d.g.alpha, stage: stage + 1, phase, fairing: fairingOn,
      propFrac: propLeft / V.stages[stage].prop,
    });
  };

  let orbit = null;
  while (t < P.tMax) {
    const d0 = deriv(t, s);
    if (t >= nextSample - 1e-9) { pushSample(t, s, d0); nextSample += P.sampleEvery; }
    if (d0.L.q > maxQ.q) maxQ = { t, q: d0.L.q, alt: d0.L.alt, mach: d0.L.mach, v: Math.hypot(s.vx, s.vy) };
    if (tMach1 == null && d0.L.mach >= 1) { tMach1 = t; events.push({ id: 'mach1', t, label: 'Mach 1', alt: d0.L.alt }); }

    /* faz geçişleri (zaman tabanlı) */
    if (phase === 'vertical' && t >= P.tPitch) { phase = 'kick'; kickStart = t; events.push({ id: 'pitchkick', t, label: 'Pitch kick', alt: d0.L.alt }); }
    else if (phase === 'kick' && t >= kickStart + P.pitchKickDur) phase = 'gravityturn';

    /* RK4 adımı */
    const h = Math.min(dt, engineOn ? propLeft / Math.max(1e-9, -d0.dm) : dt);
    const k1 = d0;
    const s2 = { x: s.x + .5 * h * k1.dx, y: s.y + .5 * h * k1.dy, vx: s.vx + .5 * h * k1.dvx, vy: s.vy + .5 * h * k1.dvy, m: s.m + .5 * h * k1.dm };
    const k2 = deriv(t + .5 * h, s2);
    const s3 = { x: s.x + .5 * h * k2.dx, y: s.y + .5 * h * k2.dy, vx: s.vx + .5 * h * k2.dvx, vy: s.vy + .5 * h * k2.dvy, m: s.m + .5 * h * k2.dm };
    const k3 = deriv(t + .5 * h, s3);
    const s4 = { x: s.x + h * k3.dx, y: s.y + h * k3.dy, vx: s.vx + h * k3.dvx, vy: s.vy + h * k3.dvy, m: s.m + h * k3.dm };
    const k4 = deriv(t + h, s4);
    s.x += h / 6 * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
    s.y += h / 6 * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);
    s.vx += h / 6 * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx);
    s.vy += h / 6 * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy);
    const dm = h / 6 * (k1.dm + 2 * k2.dm + 2 * k3.dm + k4.dm);
    s.m += dm; propLeft += dm;
    t += h;

    /* kayıplar (k1 ile, birinci mertebe yeterli) */
    if (engineOn) {
      const aT = k1.g.thrust / (s.m - dm);
      losses.ideal += aT * h;
      losses.steering += aT * (1 - Math.cos(k1.g.alpha)) * h;
    }
    {
      const gam = Math.atan2(k1.L.vr, k1.L.vh);
      losses.gravity += (MU_EARTH / (k1.L.r * k1.L.r)) * Math.sin(gam) * h;
      losses.drag += k1.D / (s.m - dm) * h;
    }

    const L = local(s);
    /* kapak */
    if (fairingOn && stage >= 1 && L.q <= P.fairingQ) {
      fairingOn = false; s.m -= V.fairing; tFairing = t;
      events.push({ id: 'fairing', t, label: 'Kapak ayrılması', alt: L.alt });
    }
    /* MECO / ayrılma / SES */
    if (stage === 0 && engineOn && propLeft <= 1e-6) {
      engineOn = false; tMeco = t; phase = 'coast';
      events.push({ id: 'meco', t, label: 'MECO', alt: L.alt, v: Math.hypot(s.vx, s.vy) });
    }
    if (tMeco != null && tSep == null && t >= tMeco + P.sepDelay) {
      tSep = t; s.m -= V.stages[0].dry; stage = 1; propLeft = V.stages[1].prop;
      events.push({ id: 'separation', t, label: 'Kademe ayrılması', alt: L.alt });
    }
    if (tSep != null && tSes == null && t >= tSep + P.sesDelay) {
      tSes = t; engineOn = true; phase = 'stage2';
      events.push({ id: 'ses', t, label: 'SES — 2. kademe ateşleme', alt: L.alt });
    }
    /* SECO: yatay hız dairesel hıza ulaştı */
    if (phase === 'stage2' && engineOn && L.vh >= Math.sqrt(MU_EARTH / L.r)) {
      engineOn = false; tSeco = t; phase = 'orbit';
      const v2 = s.vx * s.vx + s.vy * s.vy;
      const a = 1 / (2 / L.r - v2 / MU_EARTH);
      const hvec = s.x * s.vy - s.y * s.vx;
      const e = Math.sqrt(Math.max(0, 1 - hvec * hvec / (MU_EARTH * a)));
      orbit = { a, e, hp: a * (1 - e) - R_EARTH, ha: a * (1 + e) - R_EARTH, period: 2 * Math.PI * Math.sqrt(a ** 3 / MU_EARTH), v: Math.sqrt(v2), alt: L.alt };
      events.push({ id: 'seco', t, label: 'SECO — yörünge', alt: L.alt, v: orbit.v });
    }
    if (stage === 1 && engineOn && propLeft <= 1e-6) {
      engineOn = false; phase = 'coast';
      events.push({ id: 'depleted', t, label: '2. kademe yakıtı bitti (yörünge YOK)', alt: L.alt });
      break;
    }
    if (phase === 'orbit' && t >= tSeco + 240) break;      // kısa yörünge sahili
    if (L.alt < -10) { events.push({ id: 'impact', t, label: 'Yere çarpma', alt: 0 }); break; }
  }
  const d = deriv(t, s); pushSample(t, s, d);
  events.push({ id: 'maxq', t: maxQ.t, label: 'Max-Q', alt: maxQ.alt, q: maxQ.q, derived: true });
  events.sort((a, b) => a.t - b.t);
  return {
    samples, events, maxQ, losses, orbit, ok: !!orbit,
    vehicle: V, profile: P, duration: t, tMeco, tSep, tSes, tSeco, tFairing, tMach1,
    targets: { rTarget, vCircTarget },
  };
}

/* Zaman → örnek (doğrusal ara değer). */
export function sampleAt(sim, t) {
  const S = sim.samples;
  if (t <= S[0].t) return S[0];
  if (t >= S[S.length - 1].t) return S[S.length - 1];
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; (S[mid].t <= t ? (lo = mid) : (hi = mid)); }
  const a = S[lo], b = S[hi], f = (t - a.t) / Math.max(1e-9, b.t - a.t);
  const out = {};
  for (const k of Object.keys(a)) out[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * f : (f < .5 ? a[k] : b[k]);
  return out;
}
