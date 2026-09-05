/* rendezvous-model.mjs — Randevu ve kenetlenme SENARYO MODELİ (saf, THREE'siz).
   ../core/astro-relative.mjs (Clohessy–Wiltshire) üstüne kurulu: her segment ya
   serbest CW yayılımı (STM), ya CW iki-impuls hedeflemeli transfer, ya da
   sürekli itkili zorlanmış hareket (glideslope / R-bar bekleme). Kenetlenme
   koridoru, KOS ve bekleme noktaları geometrik tanımlardır; LOS açısı ve
   koridor-içi durumu göreli geometriden hesaplanır.

   Çerçeve: LVLH, hedef merkezli — x radyal dışa, y iz boyunca (V-bar), z çapraz-iz.
   Birim: m, s. Durum [x,y,z,ẋ,ẏ,ż].

   simulateRendezvous(scenario) →
     { samples:[{t,state,thrust,phase,seg}], events:[{t,id,label,dv?}], dvImpulsive,
       dvContinuous, dvTotal, duration, geometry:{ axis, port, kosRadius, corridorHalfAngle, holds },
       n, period, contact:{t, closingRate, lateral, losAngle} | null }

   SENARYOLAR (buildScenario(id, opts)):
     'vbar'   : −3 km V-bar'dan (arkadan) kenetlenme — bekle → CW hedeflemeli hop (0,4 periyot)
                → KOS kenarında bekle → glideslope (Hablani) ile temas. Klasik ISS yaklaşımı.
     'rbar'   : −1,5 km R-bar'dan (alttan) — R-bar beklemesi SÜREKLİ itki ister (a_x = −3n²x),
                sonra nadir portuna glideslope; yerçekimi gradyanı frenlemeyi gösterir.
     'push'   : "hedefe doğru it" hatası — −500 m V-bar'dan +0,3 m/s ileri impuls, serbest CW:
                araç yükselir, yavaşlar ve GERİ sürüklenir (yörünge mekaniğinin sezgi-karşıtı dersi).
     'custom' : kullanıcı göreli durumu, serbest CW (opts.state, opts.orbits). */

import { meanMotion, cwPropagate, cwAccel, cwTargeting, glideslope, R_EARTH } from '../core/astro-relative.mjs';

export const SCENARIOS = Object.freeze({
  vbar: { id: 'vbar', label: 'V-bar yaklaşması (arkadan)', axis: [0, -1, 0], port: 'aft' },
  rbar: { id: 'rbar', label: 'R-bar yaklaşması (alttan)', axis: [-1, 0, 0], port: 'nadir' },
  push: { id: 'push', label: '"Hedefe doğru it" hatası (serbest sürüklenme)', axis: [0, -1, 0], port: 'aft' },
  custom: { id: 'custom', label: 'Özel göreli durum (serbest CW)', axis: [0, -1, 0], port: 'aft' },
});

const norm = v => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function simulateRendezvous(id = 'vbar', opts = {}) {
  const sc = SCENARIOS[id] || SCENARIOS.vbar;
  const altitude = opts.altitude ?? 400e3;
  const n = meanMotion(R_EARTH + altitude);
  const period = 2 * Math.PI / n;
  const dt = opts.dt ?? 1;
  const kosRadius = opts.kosRadius ?? 200;
  const corridorHalfAngle = (opts.corridorDeg ?? 10) * Math.PI / 180;
  const axis = sc.axis;                        // porttan dışarı, yaklaşma yönünün TERSİ (hedef→araç)
  const samples = [], events = [];
  let dvImpulsive = 0, dvContinuous = 0, t = 0;
  const holds = [];
  let state;

  const push = (state, thrust, phase, seg) => samples.push({ t, state: state.slice(), thrust: thrust.slice(), phase, seg });
  const impulse = (dv, label, idEv) => {
    state = [state[0], state[1], state[2], state[3] + dv[0], state[4] + dv[1], state[5] + dv[2]];
    dvImpulsive += norm(dv);
    events.push({ t, id: idEv, label, dv: norm(dv), dvVec: dv.slice() });
  };
  /* serbest CW: STM ile adım adım */
  const coast = (dur, phase, seg) => {
    const s0 = state.slice(), t0 = t;
    for (let k = 1; k * dt <= dur + 1e-9; k++) {
      t = t0 + k * dt; state = cwPropagate(s0, n, k * dt); push(state, [0, 0, 0], phase, seg);
    }
    if (t < t0 + dur - 1e-9) { t = t0 + dur; state = cwPropagate(s0, n, dur); push(state, [0, 0, 0], phase, seg); }
  };
  /* zorlanmış hareket: kinematik olarak verilen konum/hız/ivme; itki = ivme − CW doğal */
  const forced = (dur, kin, phase, seg) => {
    const t0 = t;
    for (let k = 1; k * dt <= dur + 1e-9; k++) {
      const tau = k * dt; t = t0 + tau;
      const { r, v, a } = kin(tau);
      state = [r[0], r[1], r[2], v[0], v[1], v[2]];
      const nat = cwAccel(state, n);
      const th = [a[0] - nat[0], a[1] - nat[1], a[2] - nat[2]];
      dvContinuous += norm(th) * dt;
      push(state, th, phase, seg);
    }
  };
  const holdAt = (dur, phase, seg) => {
    /* V-bar'da doğal; R-bar/başka yerde sürekli itki (a = −CW doğal ivme) ile sabit tutulur */
    const r = [state[0], state[1], state[2]];
    forced(dur, () => ({ r, v: [0, 0, 0], a: [0, 0, 0] }), phase, seg);
  };
  const glide = (rho0, rhoDot0, rhoDotT, phase, seg) => {
    const g0 = glideslope(rho0, rhoDot0, rhoDotT, 0);
    const dur = Math.ceil(g0.tArrive / dt) * dt;
    const dir = axis;   // hedeften araca birim; ρ bu yönde ölçülür
    impulse([dir[0] * rhoDot0 - state[3], dir[1] * rhoDot0 - state[4], dir[2] * rhoDot0 - state[5]], 'Glideslope başlangıç impulsu', 'glide-start');
    forced(dur, tau => { const g = glideslope(rho0, rhoDot0, rhoDotT, Math.min(tau, g0.tArrive)); return { r: dir.map(d => d * g.rho), v: dir.map(d => d * g.rhoDot), a: dir.map(d => d * g.rhoDdot) }; }, phase, seg);
  };

  let seg = 0;
  if (id === 'vbar') {
    state = [0, -3000, 0, 0, 0, 0]; push(state, [0, 0, 0], 'hold', seg);
    holds.push({ r: [0, -3000, 0], label: 'Bekleme 1 · −3 km V-bar' }, { r: [0, -250, 0], label: 'Bekleme 2 · −250 m (KOS kenarı)' });
    events.push({ t: 0, id: 'start', label: 'Başlangıç: −3 km V-bar, göreli hız 0' });
    coast(600, 'hold', seg++);                                              // V-bar'da bekleme doğaldır
    const T = .4 * period;
    const tg = cwTargeting([state[0], state[1], state[2]], [state[3], state[4], state[5]], [0, -250, 0], n, T);
    impulse(tg.dv1, `Hop ΔV₁ ${(norm(tg.dv1) * 100).toFixed(1)} cm/s`, 'hop-1');
    coast(T, 'transfer', seg++);
    impulse(tg.dv2, `Hop ΔV₂ ${(norm(tg.dv2) * 100).toFixed(1)} cm/s (durdurma)`, 'hop-2');
    events.push({ t, id: 'kos', label: 'KOS kenarı (200 m) — koridor içinde bekleme' });
    state = [0, -250, 0, 0, 0, 0];                                          // sayısal artık (mm) temizlenir
    coast(300, 'hold', seg++);
    glide(250, -.5, -.05, 'glideslope', seg++);
  } else if (id === 'rbar') {
    state = [-1500, 0, 0, 0, 0, 0]; push(state, [0, 0, 0], 'hold-thrust', seg);
    holds.push({ r: [-1500, 0, 0], label: 'Bekleme · −1,5 km R-bar (itkili)' });
    events.push({ t: 0, id: 'start', label: 'Başlangıç: −1,5 km R-bar (altta), göreli hız 0' });
    holdAt(600, 'hold-thrust', seg++);
    events.push({ t, id: 'rbar-note', label: 'R-bar beklemesi sürekli itki ister: a_x = −3n²x' });
    glide(1500, -1.0, -.05, 'glideslope', seg++);
  } else if (id === 'push') {
    state = [0, -500, 0, 0, 0, 0]; push(state, [0, 0, 0], 'hold', seg);
    holds.push({ r: [0, -500, 0], label: 'Başlangıç · −500 m V-bar' });
    events.push({ t: 0, id: 'start', label: 'Başlangıç: −500 m V-bar, göreli hız 0' });
    coast(120, 'hold', seg++);
    impulse([0, .3, 0], '"İleri it" +0,30 m/s (sezgisel hata)', 'push');
    coast(1.5 * period, 'drift', seg++);
  } else {
    state = (opts.state || [100, -800, 50, 0, -.1, 0]).slice(); push(state, [0, 0, 0], 'drift', seg);
    events.push({ t: 0, id: 'start', label: 'Özel göreli durum, serbest CW' });
    coast((opts.orbits ?? 2) * period, 'drift', seg++);
  }

  /* temas ve geometrik ölçümler */
  const last = samples[samples.length - 1];
  const contact = (id === 'vbar' || id === 'rbar') ? {
    t: last.t, closingRate: dot([last.state[3], last.state[4], last.state[5]], axis),
    lateral: norm(last.state.slice(0, 3).map((c, i) => c - axis[i] * dot(last.state.slice(0, 3), axis))),
  } : null;
  if (contact) events.push({ t: last.t, id: 'contact', label: `Temas · kapanma ${(-contact.closingRate * 100).toFixed(1)} cm/s` });
  events.sort((a, b) => a.t - b.t);
  return {
    id, label: sc.label, samples, events, dvImpulsive, dvContinuous, dvTotal: dvImpulsive + dvContinuous,
    duration: last.t, n, period, altitude, contact,
    geometry: { axis, port: sc.port, kosRadius, corridorHalfAngle, holds },
  };
}

/** Göreli konumdan LOS ölçümleri: mesafe, kapanma hızı, koridor ekseninden açı, koridor içi mi. */
export function losMetrics(state, geometry) {
  const r = [state[0], state[1], state[2]], v = [state[3], state[4], state[5]];
  const rho = norm(r);
  const rhoDot = rho > 1e-9 ? dot(r, v) / rho : 0;                  // >0 uzaklaşma, <0 yaklaşma
  const cosA = rho > 1e-9 ? dot(r, geometry.axis) / rho : 1;
  const losAngle = Math.acos(Math.min(1, Math.max(-1, cosA)));
  return { rho, rhoDot, losAngle, inCorridor: losAngle <= geometry.corridorHalfAngle, inKos: rho < geometry.kosRadius };
}

export function sampleAt(sim, t) {
  const S = sim.samples;
  if (t <= S[0].t) return S[0];
  if (t >= S[S.length - 1].t) return S[S.length - 1];
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; (S[mid].t <= t ? (lo = mid) : (hi = mid)); }
  const a = S[lo], b = S[hi], f = (t - a.t) / Math.max(1e-9, b.t - a.t);
  return { t, state: a.state.map((x, i) => x + (b.state[i] - x) * f), thrust: a.thrust.map((x, i) => x + (b.thrust[i] - x) * f), phase: f < .5 ? a.phase : b.phase, seg: a.seg };
}
