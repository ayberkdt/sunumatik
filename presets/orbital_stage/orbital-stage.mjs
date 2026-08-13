/* orbital-stage.mjs — Yörünge Sahnesi (orbital_stage)

   AMİRAL GEMİSİ kompoze edilebilir 3B yörünge sahnesi: bir yörünge ver,
   sinematik ve fizikçe dürüst bir animasyon al (transfer manevraları,
   varışlar). scene-blocks.md programının "wave 1" çekirdek bloğu;
   webgl-scene-contract.md'ye istisnasız uyar.

   API:
     const stage = await mountOrbitalStage(host, { central:'earth'|'moon'|'none', active, seed });
     stage.addTrajectory(spec)          → iz tutamağı { show(), hide(), focus() }
        spec biçimleri:
        a) { kepler:{ a,e,i,raan,argp,nu0, mu }, span?:rad|'full' }   — analitik konik (e>1 hiperbol)
        b) { states:[[t,x,y,z],...] }                                  — VERİ GÜDÜMLÜ oynatma (Catmull-Rom)
        c) { propagate:{ r0,v0,mu,tMax, burns:[{t,dv:[..]}] } }        — RK4 + impulsif ΔV
     stage.setCraft(track, 'orbiter'|'lander'|'cubesat'|'capsule'|THREE.Group)
     stage.addBurnMarker(track, { t, dv, label })
     stage.timeline = { play, pause, scrub, setWarp, t }
     stage.camera   = { mode(m), transitionTo(m, {duration}) }         — chase|orbit|body|free
     stage.hud(bool) · stage.setGrid(bool) · stage.advance(dt) · stage.setActive(bool) · stage.dispose()

   Birimler DÜRÜST: içeride km ve saniye; mu_earth=398600.4418,
   mu_moon=4902.800066 km³/s². Görüntü ölçeği normalize: 1 sahne birimi
   = merkez gövde yarıçapı. Zaman sıkıştırma (warp) yalnız GÖSTERİMDİR ve
   HUD'da ilan edilir; fizik daima gerçek saniyelerle hesaplanır.

   Süreklilik sözleşmesi: görünür hiçbir geometri yeniden inşa edilmez —
   hayalet/keşif çizgileri dashSize UNIFORM'u ile parametrik çizilir; tüm
   görsel durumlar sim zamanı t'nin SAF fonksiyonudur (scrub deterministik,
   ekran görüntüsü tekrarlanabilir). Eşikler her zaman sıfırdan rampalanır.

   PERFORMANS NOTU (ölçülmüş): advance() süresi EMA olarak
   stage.stats.advanceMs'te izlenir (demo 6. saniyede console.info basar;
   ?perf=1 sorgusu 180 karelik ölçümü DOM'a yazar). CPU tarafı ölçümü
   (Node 22, bu makine): RK4 kurulumu 62 ms — İZ BAŞINA BİR KEZ, addTrajectory
   içinde; kare başına Hermite örneklemesi (2 iz × ~200 değerlendirme)
   ~0,04 ms. Kare bütçesini GPU çizimi belirler (bloom dahil); bloom'u
   kapatmak (options.bloom:false) en büyük tasarruftur. */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { EffectComposer } from '../moon_advanced/vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../moon_advanced/vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../moon_advanced/vendor/postprocessing/UnrealBloomPass.js';

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- gövdeler */
const BODIES = {
  earth: {
    R: 6378.137, mu: 398600.4418,
    omega: 7.2921159e-5,           /* yıldızıl dönme hızı rad/s — GERÇEK */
    label: 'Dünya',
  },
  moon: {
    R: 1737.4, mu: 4902.800066,
    omega: 2.6616995e-6,
    label: 'Ay',
  },
};

/* ---------------------------------------------------------------- matematik */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth01 = x => { const s = clamp01(x); return s * s * (3 - 2 * s); };
const easeInOut = t => t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
/* [t0,t1] arası yumuşak pencere: içeri smoothstep, dışarı smoothstep */
const windowFn = (t, on0, on1, off0, off1) =>
  smooth01((t - on0) / Math.max(1e-9, on1 - on0)) * (1 - smooth01((t - off0) / Math.max(1e-9, off1 - off0)));

/* perifokal → eylemsiz taban vektörleri (P: enberi yönü, Q: hareket yönü) */
function perifocalBasis(i, raan, argp) {
  const cO = Math.cos(raan), sO = Math.sin(raan);
  const ci = Math.cos(i), si = Math.sin(i);
  const cw = Math.cos(argp), sw = Math.sin(argp);
  return {
    P: [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si],
    Q: [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si],
    W: [sO * si, -cO * si, ci],
  };
}

/* Kepler öğeleri + gerçek anomali → durum (km, km/s). e>1 hiperbol için de geçerli. */
function stateFromKepler(el, nu) {
  const { a, e, i = 0, raan = 0, argp = 0, mu } = el;
  const p = a * (1 - e * e);                       /* hiperbolde a<0, e>1 → p>0 */
  if (!(p > 0)) throw new Error('stateFromKepler: p<=0 (öğeleri kontrol edin)');
  const r = p / (1 + e * Math.cos(nu));
  const { P, Q } = perifocalBasis(i, raan, argp);
  const cx = r * Math.cos(nu), cy = r * Math.sin(nu);
  const vf = Math.sqrt(mu / p);
  const vx = -vf * Math.sin(nu), vy = vf * (e + Math.cos(nu));
  return {
    r: [P[0] * cx + Q[0] * cy, P[1] * cx + Q[1] * cy, P[2] * cx + Q[2] * cy],
    v: [P[0] * vx + Q[0] * vy, P[1] * vx + Q[1] * vy, P[2] * vx + Q[2] * vy],
  };
}

/* Durum → oskülatör öğeler (hayalet konikler ve apsis işaretleri için). */
function elementsFromState(rv, vv, mu) {
  const r = Math.hypot(rv[0], rv[1], rv[2]);
  const v2 = vv[0] * vv[0] + vv[1] * vv[1] + vv[2] * vv[2];
  const rdotv = rv[0] * vv[0] + rv[1] * vv[1] + rv[2] * vv[2];
  const h = [rv[1] * vv[2] - rv[2] * vv[1], rv[2] * vv[0] - rv[0] * vv[2], rv[0] * vv[1] - rv[1] * vv[0]];
  const hm = Math.hypot(h[0], h[1], h[2]);
  const eVec = [
    (v2 - mu / r) * rv[0] / mu - rdotv * vv[0] / mu,
    (v2 - mu / r) * rv[1] / mu - rdotv * vv[1] / mu,
    (v2 - mu / r) * rv[2] / mu - rdotv * vv[2] / mu,
  ];
  const e = Math.hypot(eVec[0], eVec[1], eVec[2]);
  const a = 1 / (2 / r - v2 / mu);
  const i = Math.acos(Math.min(1, Math.max(-1, h[2] / hm)));
  const n = [-h[1], h[0], 0];                       /* düğüm vektörü */
  const nm = Math.hypot(n[0], n[1]);
  let raan = 0, argp = 0;
  if (nm > 1e-10) {
    raan = Math.atan2(n[1], n[0]);
    if (e > 1e-9) {
      argp = Math.acos(Math.min(1, Math.max(-1, (n[0] * eVec[0] + n[1] * eVec[1]) / (nm * e))));
      if (eVec[2] < 0) argp = TAU - argp;
    }
  } else if (e > 1e-9) {
    /* ekvatoral: enberi boylamını argp'ye koy */
    argp = Math.atan2(eVec[1], eVec[0]);
    if (h[2] < 0) argp = TAU - argp;
  }
  let nu = 0;
  if (e > 1e-9) {
    nu = Math.acos(Math.min(1, Math.max(-1, (eVec[0] * rv[0] + eVec[1] * rv[1] + eVec[2] * rv[2]) / (e * r))));
    if (rdotv < 0) nu = TAU - nu;
  } else {
    /* dairesel: argp=0 kabulüyle konum açısı */
    const { P, Q } = perifocalBasis(i, raan, 0);
    nu = Math.atan2(rv[0] * Q[0] + rv[1] * Q[1] + rv[2] * Q[2], rv[0] * P[0] + rv[1] * P[1] + rv[2] * P[2]);
  }
  return { a, e, i, raan, argp, nu, mu };
}

/* Enberiden geçen süre (işaretli, s). Eliptik ve hiperbolik dallar. */
function timeFromPeriapsis(a, e, mu, nu) {
  if (e < 1) {
    const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
    const M = E - e * Math.sin(E);
    return M / Math.sqrt(mu / (a * a * a));
  }
  const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
  const M = e * Math.sinh(H) - H;
  return M / Math.sqrt(mu / (-(a * a * a)));
}

/* Zamanla analitik konik değerlendirici (biçim a). */
function keplerEvaluator(el) {
  const { a, e, mu, nu0 = 0 } = el;
  if (e < 1) {
    const n = Math.sqrt(mu / (a * a * a));
    const E0 = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu0 / 2), Math.sqrt(1 + e) * Math.cos(nu0 / 2));
    const M0 = E0 - e * Math.sin(E0);
    return t => {
      const M = M0 + n * t;
      let E = M;
      for (let k = 0; k < 10; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      return stateFromKepler(el, nu);
    };
  }
  const n = Math.sqrt(mu / (-(a * a * a)));
  const H0 = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu0 / 2));
  const M0 = e * Math.sinh(H0) - H0;
  return t => {
    const M = M0 + n * t;
    let H = Math.asinh(M / e);
    for (let k = 0; k < 14; k++) H -= (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
    const nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
    return stateFromKepler(el, nu);
  };
}

/* ---------------------------------------------------------------- RK4 (biçim c)
   Sabit taban adım + yerel periyoda bağlı alt adımlar; impulsif ΔV tam t'de.
   Yayılım addTrajectory'de BİR KEZ koşar; oynatma Hermite ile interpolasyondur. */
const _sA = new Float64Array(3), _k1r = new Float64Array(3), _k1v = new Float64Array(3),
  _k2r = new Float64Array(3), _k2v = new Float64Array(3), _k3r = new Float64Array(3),
  _k3v = new Float64Array(3), _k4r = new Float64Array(3), _k4v = new Float64Array(3),
  _tr = new Float64Array(3), _tv = new Float64Array(3);
function accel(r, mu, out) {
  const d = Math.hypot(r[0], r[1], r[2]);
  const k = -mu / (d * d * d);
  out[0] = k * r[0]; out[1] = k * r[1]; out[2] = k * r[2];
}
function rk4Step(r, v, h, mu) {
  accel(r, mu, _sA);
  for (let j = 0; j < 3; j++) { _k1r[j] = v[j]; _k1v[j] = _sA[j]; _tr[j] = r[j] + .5 * h * _k1r[j]; _tv[j] = v[j] + .5 * h * _k1v[j]; }
  accel(_tr, mu, _sA);
  for (let j = 0; j < 3; j++) { _k2r[j] = _tv[j]; _k2v[j] = _sA[j]; _tr[j] = r[j] + .5 * h * _k2r[j]; _tv[j] = v[j] + .5 * h * _k2v[j]; }
  accel(_tr, mu, _sA);
  for (let j = 0; j < 3; j++) { _k3r[j] = _tv[j]; _k3v[j] = _sA[j]; _tr[j] = r[j] + h * _k3r[j]; _tv[j] = v[j] + h * _k3v[j]; }
  accel(_tr, mu, _sA);
  for (let j = 0; j < 3; j++) {
    _k4r[j] = _tv[j]; _k4v[j] = _sA[j];
    r[j] += (h / 6) * (_k1r[j] + 2 * _k2r[j] + 2 * _k3r[j] + _k4r[j]);
    v[j] += (h / 6) * (_k1v[j] + 2 * _k2v[j] + 2 * _k3v[j] + _k4v[j]);
  }
}
function rk4Propagate({ r0, v0, mu, tMax, burns = [] }) {
  const events = burns.slice().sort((x, y) => x.t - y.t).filter(b => b.t > 0 && b.t <= tMax);
  const T = [], R = [], V = [];
  let t = 0;
  const r = r0.slice(), v = v0.slice();
  const push = () => { T.push(t); R.push(r[0], r[1], r[2]); V.push(v[0], v[1], v[2]); };
  push();
  const hBase = Math.min(45, Math.max(.5, tMax / 8000));
  const burnStates = [];
  let ei = 0;
  while (t < tMax - 1e-9) {
    const tTarget = ei < events.length ? Math.min(events[ei].t, tMax) : tMax;
    const h = Math.min(hBase, tTarget - t);
    /* yerel dairesel periyoda göre alt adım — enberi hızlanmalarında hassasiyet */
    const rm = Math.hypot(r[0], r[1], r[2]);
    const Tloc = TAU * Math.sqrt((rm * rm * rm) / mu);
    const nSub = Math.max(1, Math.ceil(h / (Tloc / 480)));
    const hs = h / nSub;
    for (let k = 0; k < nSub; k++) rk4Step(r, v, hs, mu);
    t += h;
    push();
    if (ei < events.length && Math.abs(t - events[ei].t) < 1e-6) {
      const b = events[ei];
      burnStates.push({ t, rPre: r.slice(), vPre: v.slice(), dv: b.dv.slice() });
      v[0] += b.dv[0]; v[1] += b.dv[1]; v[2] += b.dv[2];
      push();                              /* aynı t'de yanma-sonrası örnek */
      ei++;
    }
  }
  return { T, R, V, burnStates };
}

/* Hermite interpolasyonu (konum+hız bilinen örnek dizisi üzerinde). */
function hermiteSampler(T, R, V) {
  const n = T.length;
  return (t, out) => {
    let lo = 0, hi = n - 1;
    if (t <= T[0]) { out.r[0] = R[0]; out.r[1] = R[1]; out.r[2] = R[2]; out.v[0] = V[0]; out.v[1] = V[1]; out.v[2] = V[2]; return out; }
    if (t >= T[n - 1]) { const k = (n - 1) * 3; out.r[0] = R[k]; out.r[1] = R[k + 1]; out.r[2] = R[k + 2]; out.v[0] = V[k]; out.v[1] = V[k + 1]; out.v[2] = V[k + 2]; return out; }
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; }
    /* sıfır uzunluklu (yanma) segmentini atla — yanma SONRASI durumu kullan */
    while (hi < n - 1 && T[hi] - T[lo] <= 0) { lo = hi; hi++; }
    const dt = T[hi] - T[lo];
    const s = dt > 0 ? (t - T[lo]) / dt : 1;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
    const a = lo * 3, b = hi * 3;
    for (let j = 0; j < 3; j++) {
      out.r[j] = h00 * R[a + j] + h10 * dt * V[a + j] + h01 * R[b + j] + h11 * dt * V[b + j];
      out.v[j] = (d00 * R[a + j] + d01 * R[b + j]) / dt + d10 * V[a + j] + d11 * V[b + j];
    }
    return out;
  };
}

/* Biçim b: [t,x,y,z] dizisi → Catmull-Rom (sonlu fark teğetli Hermite). */
function statesSampler(states) {
  const n = states.length;
  const T = new Float64Array(n), R = new Float64Array(n * 3), V = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) { T[i] = states[i][0]; R[i * 3] = states[i][1]; R[i * 3 + 1] = states[i][2]; R[i * 3 + 2] = states[i][3]; }
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, i - 1), q = Math.min(n - 1, i + 1);
    const dt = Math.max(1e-9, T[q] - T[p]);
    for (let j = 0; j < 3; j++) V[i * 3 + j] = (R[q * 3 + j] - R[p * 3 + j]) / dt;
  }
  return { sampler: hermiteSampler(Array.from(T), Array.from(R), Array.from(V)), t0: T[0], tEnd: T[n - 1] };
}

/* dışa açık matematik — demo sahne kurulumları bunları kullanır */
export const orbitMath = {
  MU_EARTH: BODIES.earth.mu,
  MU_MOON: BODIES.moon.mu,
  R_EARTH: BODIES.earth.R,
  R_MOON: BODIES.moon.R,
  stateFromKepler, elementsFromState, timeFromPeriapsis,
  circularSpeed: (mu, r) => Math.sqrt(mu / r),
  periodOf: (mu, a) => TAU * Math.sqrt((a * a * a) / mu),
};

/* ---------------------------------------------------------------- yedek araç
   craft-blocks import'u BAŞARISIZSA sözleşme gereği basit kutu+panel yedeği.
   +X ileri, itki −X'ten çıkar; en uzun boyut ≈ 1. */
function buildPlaceholderCraft() {
  const g = new THREE.Group();
  const std = o => new THREE.MeshStandardMaterial(o);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.42, .2, .2),
    std({ color: 0x33353c, metalness: .65, roughness: .38 }));
  const panelMat = () => std({ color: 0x17233d, metalness: .8, roughness: .22 });
  const pa = new THREE.Mesh(new THREE.BoxGeometry(.2, .5, .012), panelMat());
  pa.position.y = .36; const pb = pa.clone(); pb.position.y = -.36;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .075, .12, 20),
    std({ color: 0x8a877e, metalness: .85, roughness: .3 }));
  nozzle.rotation.z = Math.PI / 2; nozzle.position.x = -.27;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12, 0, TAU, 0, Math.PI / 2.6),
    std({ color: 0xd9cdb4, metalness: .5, roughness: .4, side: THREE.DoubleSide }));
  dish.position.z = .14; dish.rotation.x = -Math.PI / 2;
  g.add(body, pa, pb, nozzle, dish);
  return g;
}

/* ---------------------------------------------------------------- ana giriş */
export async function mountOrbitalStage(host, options = {}) {
  if (!host) throw new Error('mountOrbitalStage bir kap ister');
  const centralName = options.central ?? 'earth';
  const body = BODIES[centralName] || null;
  const kmToScene = 1 / (body ? body.R : 6378.137);   /* 1 sahne birimi = gövde yarıçapı */
  /* km çerçevesi: z = yörünge normali (ekvator düzlemi z=0). Sahnede yukarı +Y.
     Sağ-elli eşleme: (x,y,z)km → (x, z, −y)sahne — ekvator düzlemi yatay yatar. */
  const toScene = (x, y, z, v) => v.set(x * kmToScene, z * kmToScene, -y * kmToScene);
  const toSceneDir = (x, y, z, v) => v.set(x, z, -y);
  const seed = options.seed ?? 20260813;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode
    ?? (new URLSearchParams(location.search).get('export') === '1'
      || document.documentElement.dataset.export === 'true');

  /* -------- DOM: tuval + HUD + etiket katmanı (deste tipografisi, palet token'ları) */
  const figure = document.createElement('figure');
  figure.className = 'orbital-stage';
  figure.innerHTML = `
    <style>
      .orbital-stage{position:relative;margin:0;width:100%;height:100%;overflow:hidden;
        background:var(--color-canvas,#0b0c10);
        font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);}
      .orbital-stage__canvas{position:absolute;inset:0;}
      .orbital-stage__canvas canvas{display:block;width:100%;height:100%;}
      .orbital-stage__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .orbital-stage__label{position:absolute;transform:translate(-50%,-140%);white-space:nowrap;
        font-size:13px;letter-spacing:.04em;color:var(--color-ink,#e9e4d8);
        text-shadow:0 1px 4px rgba(0,0,0,.85);opacity:0;transition:none;}
      .orbital-stage__label small{color:var(--color-muted,#9a938a);font-size:11px;display:block;}
      .orbital-stage__hud{position:absolute;top:16px;right:16px;min-width:212px;
        padding:12px 16px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;
        background:color-mix(in srgb,var(--color-surface,#15161a) 82%,transparent);
        color:var(--color-ink,#e9e4d8);pointer-events:none;}
      .orbital-stage__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 14px;}
      .orbital-stage__hud dt{font-size:11px;letter-spacing:.09em;text-transform:uppercase;
        color:var(--color-muted,#9a938a);align-self:baseline;}
      .orbital-stage__hud dd{margin:0;text-align:right;font-size:15px;
        font-variant-numeric:tabular-nums;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .orbital-stage__hud .orbital-stage__warp{grid-column:1/-1;margin-top:4px;padding-top:6px;
        border-top:1px solid var(--color-rule,#3a3c42);font-size:11px;letter-spacing:.06em;
        color:var(--color-accent,#d9b877);text-align:right;}
    </style>
    <div class="orbital-stage__canvas" aria-hidden="true"></div>
    <div class="orbital-stage__labels" aria-hidden="true"></div>
    <div class="orbital-stage__hud" role="status" hidden>
      <dl>
        <dt>t</dt><dd data-hud="t">—</dd>
        <dt>irtifa</dt><dd data-hud="alt">—</dd>
        <dt>|v|</dt><dd data-hud="v">—</dd>
        <dt>ΣΔV</dt><dd data-hud="dv">—</dd>
        <div class="orbital-stage__warp" data-hud="warp"></div>
      </dl>
    </div>`;
  host.appendChild(figure);
  const canvasHost = figure.querySelector('.orbital-stage__canvas');
  const labelLayer = figure.querySelector('.orbital-stage__labels');
  const hudEl = figure.querySelector('.orbital-stage__hud');
  const hudFields = {
    t: hudEl.querySelector('[data-hud="t"]'),
    alt: hudEl.querySelector('[data-hud="alt"]'),
    v: hudEl.querySelector('[data-hud="v"]'),
    dv: hudEl.querySelector('[data-hud="dv"]'),
    warp: hudEl.querySelector('[data-hud="warp"]'),
  };

  /* palet token'larını bir kez oku (fallback: obsidian-champagne ailesi) */
  const css = getComputedStyle(figure);
  const tok = (name, fb) => (css.getPropertyValue(name) || '').trim() || fb;
  const palette = {
    ink: tok('--color-ink', '#e9e4d8'),
    muted: tok('--color-muted', '#9a938a'),
    accent: tok('--color-accent', '#d9b877'),
    data1: tok('--color-data-1', '#8fb8dd'),
    data2: tok('--color-data-2', '#d78f6c'),
    rule: tok('--color-rule', '#3a3c42'),
  };
  const trackColorCycle = [palette.data1, palette.accent, palette.data2, palette.muted];

  /* -------- render altyapısı */
  const renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: true,               /* deterministik geri-okuma/ekran görüntüsü */
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(46, 1, .01, 4000);
  camera.position.set(0, 4, 11);

  /* ışık disiplini: TEK güneş + yarıküre dolgu — sahne başına tek ışık mantığı */
  const sunDir = new THREE.Vector3(4.2, 1.5, 2.6).normalize();
  const sun = new THREE.DirectionalLight('#ffffff', 2.6);
  sun.position.copy(sunDir).multiplyScalar(50);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#93a7bd', '#1c1e24', .55));
  scene.add(new THREE.AmbientLight('#3c4250', .5));

  /* -------- seyrek, SABİT yıldız fonu (sözleşme: sürekli yıldız hareketi yok) */
  const rand = mulberry32(seed);
  const starCount = reducedMotion ? 900 : 2200;
  {
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 160 + rand() * 220;
      const theta = rand() * TAU;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: '#cfd6e4', size: .55, sizeAttenuation: false,
      transparent: true, opacity: .75, depthWrite: false,
    }));
    stars.renderOrder = -10;
    scene.add(stars);
  }

  /* -------- merkez gövde */
  const bodyGroup = new THREE.Group();
  scene.add(bodyGroup);
  if (body) {
    const loader = new THREE.TextureLoader();
    const url = rel => new URL(rel, import.meta.url).href;
    try {
      if (centralName === 'earth') {
        const [day, normal, spec] = await Promise.all([
          loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')),
          loader.loadAsync(url('../earth_advanced/textures/earth_normal_2048.jpg')),
          loader.loadAsync(url('../earth_advanced/textures/earth_specular_2048.jpg')),
        ]);
        day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8;
        const mat = new THREE.MeshPhongMaterial({
          map: day, normalMap: normal, normalScale: new THREE.Vector2(.8, .8),
          specularMap: spec, specular: new THREE.Color('#39434d'), shininess: 13,
        });
        bodyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat));
        /* atmosfer: görüşe bağlı fresnel — halo (BackSide) + limb pusu (FrontSide).
           Özel fragment'ler sözleşme gereği tonemapping+colorspace include'larıyla biter. */
        const atmoVert = `
          varying vec3 vNormalView; varying vec3 vPosW;
          void main() {
            vNormalView = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.);
            vPosW = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }`;
        const halo = new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 48), new THREE.ShaderMaterial({
          uniforms: {
            uSunDir: { value: sunDir },
            uDay: { value: new THREE.Color('#7ec3ff') },
            uNight: { value: new THREE.Color('#152c49') },
          },
          vertexShader: atmoVert,
          fragmentShader: `
            uniform vec3 uSunDir; uniform vec3 uDay; uniform vec3 uNight;
            varying vec3 vNormalView; varying vec3 vPosW;
            void main() {
              float glow = pow(clamp(.6 - dot(vNormalView, vec3(0., 0., 1.)), 0., 1.4), 4.);
              float sunFacing = clamp(dot(normalize(vPosW), normalize(uSunDir)) * .6 + .4, 0., 1.);
              vec3 color = mix(uNight, uDay, sunFacing);
              gl_FragColor = vec4(color * glow * .95 * (.3 + .7 * sunFacing), 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
          side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        }));
        const haze = new THREE.Mesh(new THREE.SphereGeometry(1.022, 64, 48), new THREE.ShaderMaterial({
          uniforms: { uSunDir: { value: sunDir }, uColor: { value: new THREE.Color('#9fd0ff') } },
          vertexShader: atmoVert,
          fragmentShader: `
            uniform vec3 uSunDir; uniform vec3 uColor;
            varying vec3 vNormalView; varying vec3 vPosW;
            void main() {
              float rim = pow(1. - clamp(dot(vNormalView, vec3(0., 0., 1.)), 0., 1.), 3.4);
              float sunFacing = clamp(dot(normalize(vPosW), normalize(uSunDir)) * .7 + .3, 0., 1.);
              gl_FragColor = vec4(uColor * rim * .5 * sunFacing, 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
          side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        }));
        scene.add(halo, haze);
      } else if (centralName === 'moon') {
        const albedo = await loader.loadAsync(url('../moon_react_source/public/lunaris/textures/aesthetic_moon_real.webp'));
        albedo.colorSpace = THREE.SRGBColorSpace; albedo.anisotropy = 8;
        const mat = new THREE.MeshStandardMaterial({ map: albedo, roughness: .78, metalness: .05 });
        bodyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat));
      }
    } catch (error) {
      /* doku gelmezse dürüst düz küre — sahne yine çalışır */
      console.warn('orbital-stage: doku yüklenemedi, düz küreye düşüldü —', error.message);
      bodyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64),
        new THREE.MeshStandardMaterial({ color: centralName === 'moon' ? '#8f8b84' : '#274668', roughness: .85 })));
    }
  }

  /* -------- ekvator referans ızgarası (kapatılabilir, sessiz) */
  const gridGroup = new THREE.Group();
  scene.add(gridGroup);
  const gridMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(palette.rule), transparent: true, opacity: .16, depthWrite: false,
  });
  function rebuildGrid(extent) {
    /* yalnız görünmezken/başlangıçta kurulur — görünür yeniden inşa yasağına takılmaz */
    while (gridGroup.children.length) {
      const c = gridGroup.children.pop();
      c.geometry.dispose();
    }
    const maxR = Math.max(3, Math.ceil(extent + .5));
    for (let ring = 1; ring <= maxR; ring++) {
      const pts = [];
      for (let k = 0; k <= 128; k++) {
        const a = (k / 128) * TAU;
        pts.push(new THREE.Vector3(ring * Math.cos(a), 0, ring * Math.sin(a)));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      gridGroup.add(new THREE.Line(g, gridMat));
    }
    const spokes = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      spokes.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
        new THREE.Vector3(maxR * Math.cos(a), 0, maxR * Math.sin(a)));
    }
    const sg = new THREE.BufferGeometry().setFromPoints(spokes);
    gridGroup.add(new THREE.LineSegments(sg, gridMat));
  }

  /* -------- post: RenderPass + yumuşak bloom (terra ayarları — kanıtlanmış) */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomOn = options.bloom ?? true;
  if (bloomOn) composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .5, .55, 1.35));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enabled = false;                    /* yalnız 'free' modda açılır */

  /* çizgi malzemeleri çözünürlük ister — kayıt tutup resize'da HER BİRİNE yaz
     (LineMaterial.resolution setter'ı KOPYALAR, referans paylaşmaz).
     DİKKAT: LineMaterial'de opacity ShaderMaterial özelliğidir ve uniform'a
     otomatik senkronlanmaz — animasyon uniforms.opacity.value ile yapılır. */
  const resolution = new THREE.Vector2(2, 2);
  const lineMaterials = [];
  const makeLineMat = opts => {
    const { opacity = 1, ...rest } = opts;
    const m = new LineMaterial({ worldUnits: false, depthWrite: false, transparent: true, ...rest });
    m.uniforms.opacity.value = opacity;
    m.resolution = resolution;
    lineMaterials.push(m);
    return m;
  };
  const setLineOpacity = (m, v) => { m.uniforms.opacity.value = v; };

  /* -------- ekran-uzayı HTML etiketleri (deste tipografisi) */
  const labels = [];
  const _proj = new THREE.Vector3();
  function addLabel(html, small) {
    const el = document.createElement('div');
    el.className = 'orbital-stage__label';
    el.innerHTML = small ? `${html}<small>${small}</small>` : html;
    labelLayer.appendChild(el);
    const item = { el, world: new THREE.Vector3(), opacity: 0 };
    labels.push(item);
    return item;
  }
  function projectLabels() {
    const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
    for (const item of labels) {
      if (item.opacity <= .01) { item.el.style.opacity = '0'; continue; }
      _proj.copy(item.world).project(camera);
      if (_proj.z > 1) { item.el.style.opacity = '0'; continue; }
      item.el.style.opacity = String(item.opacity);
      item.el.style.left = `${(_proj.x * .5 + .5) * w}px`;
      item.el.style.top = `${(-_proj.y * .5 + .5) * h}px`;
    }
  }

  /* ---------------------------------------------------------------- durum */
  const state = {
    t: 0, warp: options.warp ?? 300, playing: false,
    warpRef: options.warp ?? 300,      /* orbit kamerası bunu kullanır — warp değişince kamera SIÇRAMAZ */
    active: options.active ?? true,
    hud: false, grid: true,
    camMode: 'orbit', camTransition: null, camSnap: true,
    orbitAz0: -.9,
    extent: 3,
    duration: 86400,
    focused: null,
  };
  const stats = { advanceMs: 0 };
  const tracks = [];
  const ghostSimDur = options.ghostDuration ?? 900;   /* hayalet animasyonu (sim s) */

  /* ---------------------------------------------------------------- izler */
  const scratch = { r: new Float64Array(3), v: new Float64Array(3) };
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(),
    _v4 = new THREE.Vector3(), _m4 = new THREE.Matrix4();

  function conicPoints(el, { nuStart = 0, nuArc = TAU, steps = 256 } = {}) {
    /* konik poligonu (sahne birimleri) — hiperbolde çağıran taraf yayı sınırlar */
    const pts = [];
    for (let k = 0; k <= steps; k++) {
      const nu = nuStart + (k / steps) * nuArc;
      const s = stateFromKepler(el, nu);
      pts.push(s.r[0] * kmToScene, s.r[2] * kmToScene, -s.r[1] * kmToScene);
    }
    return pts;
  }

  function makePathLine(positions, color, { reveal = false, opacity = .8, width = 2 } = {}) {
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    const material = makeLineMat({
      color: new THREE.Color(color), linewidth: width, opacity,
      dashed: reveal,
    });
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    let total = 0;
    const cum = [0];
    for (let i = 3; i < positions.length; i += 3) {
      total += Math.hypot(positions[i] - positions[i - 3], positions[i + 1] - positions[i - 2], positions[i + 2] - positions[i - 1]);
      cum.push(total);
    }
    if (reveal) { material.dashSize = 1e-6; material.gapSize = Math.max(1, total * 4); }
    return { line, material, total, cum };
  }

  const TRAIL_N = 96;
  function makeTrail(color) {
    const geometry = new LineGeometry();
    const zeros = new Float32Array(TRAIL_N * 3);
    geometry.setPositions(zeros);
    geometry.setColors(zeros);
    const material = makeLineMat({
      linewidth: 2.6, vertexColors: true, blending: THREE.AdditiveBlending, opacity: 1,
    });
    const line = new Line2(geometry, material);
    line.visible = false;
    const c = new THREE.Color(color);
    return { line, color: c, positions: new Float32Array(TRAIL_N * 3), colors: new Float32Array(TRAIL_N * 3) };
  }

  function osculatingAt(track, t, side = 'post') {
    /* iz üzerinde t anındaki (yanma öncesi/sonrası) oskülatör öğeler */
    if (track.kind === 'propagate') {
      const bs = track.burnStates.find(b => Math.abs(b.t - t) < 1e-6);
      if (bs) {
        const v = side === 'pre' ? bs.vPre
          : [bs.vPre[0] + bs.dv[0], bs.vPre[1] + bs.dv[1], bs.vPre[2] + bs.dv[2]];
        return elementsFromState(bs.rPre, v, track.mu);
      }
    }
    const s = track.evaluate(t);
    return elementsFromState(Array.from(s.r), Array.from(s.v), track.mu);
  }

  function addApsisMarkers(track, el, appearT) {
    /* enberi/enöte kene + etiketleri; dairesel yörüngede apsis anlamsız → atla */
    if (!(el.e > .01 && el.e < 1)) return;
    const mk = (nu, name) => {
      const s = stateFromKepler(el, nu);
      const pos = toScene(s.r[0], s.r[1], s.r[2], new THREE.Vector3());
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.035, 0),
        new THREE.MeshBasicMaterial({ color: palette.muted, transparent: true, opacity: 0 }));
      mesh.material.toneMapped = false;
      mesh.position.copy(pos);
      scene.add(mesh);
      const rkm = Math.hypot(s.r[0], s.r[1], s.r[2]);
      const altTxt = body ? `${fmtKm(rkm - body.R)} km` : `${fmtKm(rkm)} km`;
      const label = addLabel(name, altTxt);
      label.world.copy(pos);
      track.apsides.push({ mesh, label, appearT });
    };
    mk(0, 'enberi');
    mk(Math.PI, 'enöte');
  }

  function addTrajectory(spec) {
    const id = 'iz-' + (tracks.length + 1);
    const color = spec.color || trackColorCycle[tracks.length % trackColorCycle.length];
    const group = new THREE.Group();
    scene.add(group);
    const track = {
      id, spec, color, group,
      visible: true, craft: null, craftGroup: null,
      burnStates: [], burnMarkers: [], apsides: [],
      appliedBurns: [],                       /* {t, dvMag} — HUD ΣΔV */
      mu: null, t0: 0, tEnd: 0, kind: null,
      evaluate: null, path: null, trail: null,
      plume: null,
    };

    if (spec.kepler) {
      track.kind = 'kepler';
      const el = spec.kepler;
      track.mu = el.mu;
      const evalFn = keplerEvaluator(el);
      track.evaluate = t => { const s = evalFn(t); scratch.r.set(s.r); scratch.v.set(s.v); return scratch; };
      const e = el.e;
      let pts;
      if (e < 1) {
        const span = spec.span === 'full' || spec.span == null ? TAU : spec.span;
        pts = conicPoints(el, { nuStart: el.nu0 ?? 0, nuArc: span, steps: 384 });
        track.tEnd = Infinity;               /* analitik ve periyodik — araç sonsuza dek sürer */
        track.periodHint = orbitMath.periodOf(el.mu, el.a);
      } else {
        /* hiperbol: açık yay — asimptota %94 yaklaş */
        const nuInf = Math.acos(-1 / e);
        const lim = Math.min(nuInf * .94, (typeof spec.span === 'number' ? spec.span / 2 : nuInf * .94));
        pts = conicPoints(el, { nuStart: -lim, nuArc: 2 * lim, steps: 384 });
        track.tEnd = Infinity;
        track.periodHint = 3600;
      }
      track.path = makePathLine(pts, color, { reveal: false, opacity: .34, width: 1.8 });
      group.add(track.path.line);
    } else if (spec.states) {
      track.kind = 'states';
      const { sampler, t0, tEnd } = statesSampler(spec.states);
      track.mu = spec.mu ?? (body ? body.mu : BODIES.earth.mu);
      track.t0 = t0; track.tEnd = tEnd;
      track.evaluate = t => sampler(Math.min(tEnd, Math.max(t0, t)), scratch);
      /* yol örneklemesi: sabit zaman adımı */
      const N = 600, pos = [], times = [];
      for (let k = 0; k <= N; k++) {
        const tt = t0 + (k / N) * (tEnd - t0);
        const s = sampler(tt, scratch);
        pos.push(s.r[0] * kmToScene, s.r[2] * kmToScene, -s.r[1] * kmToScene);
        times.push(tt);
      }
      track.path = makePathLine(pos, color, { reveal: true, opacity: .8, width: 2 });
      track.pathTimes = times;
      /* kuyruk uzunluğu için periyot kestirimi: vis-viva'dan oskülatör a */
      const s0 = sampler(t0, scratch);
      const el0 = elementsFromState(Array.from(s0.r), Array.from(s0.v), track.mu);
      track.periodHint = el0.a > 0 ? orbitMath.periodOf(track.mu, el0.a) : (tEnd - t0);
      group.add(track.path.line);
    } else if (spec.propagate) {
      track.kind = 'propagate';
      const p = spec.propagate;
      track.mu = p.mu;
      const { T, R, V, burnStates } = rk4Propagate(p);
      track.burnStates = burnStates;
      track.appliedBurns = burnStates.map(b => ({ t: b.t, dvMag: Math.hypot(b.dv[0], b.dv[1], b.dv[2]) }));
      const sampler = hermiteSampler(T, R, V);
      track.evaluate = t => sampler(t, scratch);
      track.t0 = 0; track.tEnd = p.tMax;
      /* çizgi için seyreltilmiş örnekler (~1400 nokta) */
      const stride = Math.max(1, Math.floor(T.length / 1400));
      const pos = [], times = [];
      for (let i = 0; i < T.length; i += stride) {
        pos.push(R[i * 3] * kmToScene, R[i * 3 + 2] * kmToScene, -R[i * 3 + 1] * kmToScene);
        times.push(T[i]);
      }
      const last = T.length - 1;
      if (times[times.length - 1] !== T[last]) {
        pos.push(R[last * 3] * kmToScene, R[last * 3 + 2] * kmToScene, -R[last * 3 + 1] * kmToScene);
        times.push(T[last]);
      }
      track.path = makePathLine(pos, color, { reveal: true, opacity: .8, width: 2 });
      track.pathTimes = times;
      const el0 = elementsFromState(p.r0, p.v0, p.mu);
      track.periodHint = el0.a > 0 ? orbitMath.periodOf(p.mu, el0.a) : 3600;
      group.add(track.path.line);
    } else {
      throw new Error('addTrajectory: kepler | states | propagate biçimlerinden biri gerekli');
    }

    track.trail = makeTrail(color);
    group.add(track.trail.line);

    tracks.push(track);
    refreshExtent();
    refreshDuration();
    if (!state.focused) state.focused = track;

    const handle = {
      id,
      show: () => { track.visible = true; group.visible = true; },
      hide: () => { track.visible = false; group.visible = false; },
      focus: () => { state.focused = track; },
      __track: track,
    };
    track.handle = handle;
    return handle;
  }

  /* keşfedilen yay uzunluğu: t → yol boyu (dashSize uniform'u için) */
  function flownLen(track, t) {
    const times = track.pathTimes, cum = track.path.cum;
    if (!times) return track.path.total;
    if (t <= times[0]) return 0;
    if (t >= times[times.length - 1]) return track.path.total;
    let lo = 0, hi = times.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
    const f = (t - times[lo]) / Math.max(1e-9, times[hi] - times[lo]);
    return cum[lo] + f * (cum[hi] - cum[lo]);
  }

  /* -------- araçlar (craft-blocks; yoksa yedek) */
  let craftBuilders = null, craftImportTried = false;
  async function getCraftBuilders() {
    if (craftImportTried) return craftBuilders;
    craftImportTried = true;
    try {
      const mod = await import(new URL('../craft_blocks/craft-blocks.mjs', import.meta.url).href);
      craftBuilders = {
        orbiter: mod.buildOrbiter, lander: mod.buildLander,
        cubesat: mod.buildCubesat, capsule: mod.buildCapsule,
      };
    } catch (e) {
      console.info('orbital-stage: craft-blocks bulunamadı, yedek araç kullanılacak');
      craftBuilders = null;
    }
    return craftBuilders;
  }

  async function setCraft(handle, kind) {
    const track = handle.__track;
    if (track.craftGroup) { track.group.remove(track.craftGroup); }
    let craft;
    if (kind && kind.isObject3D) {
      craft = kind;
    } else {
      const builders = await getCraftBuilders();
      craft = builders && builders[kind] ? builders[kind]({ scale: 1 }) : buildPlaceholderCraft();
    }
    const size = Math.max(.055, state.extent * .02);
    const wrap = new THREE.Group();
    wrap.add(craft);
    wrap.scale.setScalar(size);
    /* itki hüzmesi: −X'ten kısa koni; yanma penceresi dışında opaklık 0 */
    const plumeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent).lerp(new THREE.Color('#ffd9a0'), .5),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    plumeMat.toneMapped = false;
    const plume = new THREE.Mesh(new THREE.ConeGeometry(.16, 1.15, 20, 1, true), plumeMat);
    plume.rotation.z = Math.PI / 2;             /* koni +X'e bakar → tepe −X tarafında */
    plume.position.x = -.85;
    wrap.add(plume);
    track.plume = plume;
    track.craftGroup = wrap;
    track.group.add(wrap);
    return wrap;
  }

  /* -------- yanma işaretleri: hüzme + ΔV oku + ÖNCESİ/SONRASI hayalet konikler */
  function addBurnMarker(handle, { t, dv, label = '' }) {
    const track = handle.__track;
    const dvMag = Math.hypot(dv[0], dv[1], dv[2]);
    /* yanma noktası ve önce/sonra durumları */
    let rPre, vPre;
    const bs = track.burnStates.find(b => Math.abs(b.t - t) < 1e-3);
    if (bs) { rPre = bs.rPre; vPre = bs.vPre; }
    else {
      const s = track.evaluate(t - 1e-3);
      rPre = Array.from(s.r); vPre = Array.from(s.v);
    }
    const vPost = [vPre[0] + dv[0], vPre[1] + dv[1], vPre[2] + dv[2]];
    const elPre = elementsFromState(rPre, vPre, track.mu);
    const elPost = elementsFromState(rPre, vPost, track.mu);
    const posScene = toScene(rPre[0], rPre[1], rPre[2], new THREE.Vector3());

    /* hayaletler: önce-koniği tam çizili gelir ve söner; sonra-koniği yanma
       noktasından itibaren dashSize ile ÇİZİLİR — manim ânı. */
    const mkGhost = (el, startNu, color) => {
      let pts;
      if (el.e < 1) pts = conicPoints(el, { nuStart: startNu, nuArc: TAU, steps: 320 });
      else {
        const nuInf = Math.acos(-1 / el.e);
        pts = conicPoints(el, { nuStart: -nuInf * .93, nuArc: 2 * nuInf * .93, steps: 320 });
      }
      return makePathLine(pts, color, { reveal: true, opacity: 0, width: 1.6 });
    };
    const ghostPre = mkGhost(elPre, elPre.nu, palette.ink);
    ghostPre.material.dashSize = ghostPre.total;       /* önce-hayaleti baştan tam çizili */
    const ghostPost = mkGhost(elPost, elPost.nu, track.color);
    track.group.add(ghostPre.line, ghostPost.line);

    /* ΔV oku: yanma noktasından dv yönünde — silindir + koni, palet accent */
    const arrowGroup = new THREE.Group();
    const arrowLen = Math.max(.35, state.extent * .1);
    const arrowMat = new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0 });
    arrowMat.toneMapped = false;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, arrowLen * .72, 10), arrowMat);
    shaft.position.y = arrowLen * .36;
    const head = new THREE.Mesh(new THREE.ConeGeometry(.045, arrowLen * .28, 14), arrowMat);
    head.position.y = arrowLen * .86;
    arrowGroup.add(shaft, head);
    arrowGroup.position.copy(posScene);
    toSceneDir(dv[0], dv[1], dv[2], _v1).normalize();
    arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v1);
    track.group.add(arrowGroup);

    const lbl = addLabel(label || `ΔV ${dvMag.toFixed(2)} km/s`, `${fmtKm(dvMag * 1000)} m/s`);
    lbl.world.copy(posScene).add(_v1.clone().multiplyScalar(arrowLen * 1.1));

    /* apsis işaretleri: yanma-sonrası yörünge için */
    addApsisMarkers(track, elPost, t);

    if (!track.appliedBurns.some(b => Math.abs(b.t - t) < 1e-3)) {
      track.appliedBurns.push({ t, dvMag });
      track.appliedBurns.sort((a, b2) => a.t - b2.t);
    }
    track.burnMarkers.push({ t, dvMag, ghostPre, ghostPost, arrowMat, label: lbl, pos: posScene });
  }

  /* -------- kapsam ve süre */
  function refreshExtent() {
    let ext = 2.5;
    /* her izin değerlendiricisinden kaba tarama — en dış yarıçap */
    for (const tr of tracks) {
      const tEnd = Number.isFinite(tr.tEnd) ? tr.tEnd : (tr.t0 + (tr.periodHint || 3600));
      for (let k = 0; k <= 48; k++) {
        const s = tr.evaluate(tr.t0 + (k / 48) * Math.max(1, tEnd - tr.t0));
        ext = Math.max(ext, Math.hypot(s.r[0], s.r[1], s.r[2]) * kmToScene);
      }
    }
    state.extent = ext;
    rebuildGrid(Math.min(ext, 12));
  }
  function refreshDuration() {
    let dur = 0;
    for (const tr of tracks) if (Number.isFinite(tr.tEnd)) dur = Math.max(dur, tr.tEnd);
    state.duration = dur || 86400;
  }

  /* -------- biçimleyiciler */
  const nfTR = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  function fmtKm(x) { return nfTR.format(Math.round(x)); }
  function fmtTime(t) {
    if (t < 3600) return `${Math.floor(t / 60)} dk ${String(Math.floor(t % 60)).padStart(2, '0')} sn`;
    if (t < 172800) return `${Math.floor(t / 3600)} sa ${String(Math.floor((t % 3600) / 60)).padStart(2, '0')} dk`;
    return `${Math.floor(t / 86400)} g ${Math.floor((t % 86400) / 3600)} sa`;
  }

  /* -------- kamera yönetmeni */
  const camState = {
    pos: new THREE.Vector3(), look: new THREE.Vector3(),
    haveDesired: false,
    desiredPos: new THREE.Vector3(), desiredLook: new THREE.Vector3(),
    fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(),
  };
  function desiredCamera(mode, out) {
    const ext = state.extent;
    if (mode === 'orbit') {
      /* sinematik tur: azimut sim zamanının (gerçek-saniye eşdeğeri) fonksiyonu → deterministik;
         warpRef sabittir ki warp değişimi kamerada adım oluşturmasın (C0) */
      const az = state.orbitAz0 + (state.t / Math.max(1, state.warpRef)) * .05;
      const el = .42;
      const rad = ext * 1.9;
      out.pos.set(rad * Math.cos(el) * Math.cos(az), rad * Math.sin(el), rad * Math.cos(el) * Math.sin(az));
      out.look.set(0, 0, 0);
      return;
    }
    if (mode === 'body') {
      const rad = ext * 2.05;
      out.pos.set(rad * .18, rad * .82, rad * .55);
      out.look.set(0, 0, 0);
      return;
    }
    if (mode === 'chase' && state.focused && state.focused.craftGroup) {
      const tr = state.focused;
      const s = tr.evaluate(Math.min(state.t, Number.isFinite(tr.tEnd) ? tr.tEnd : state.t));
      toScene(s.r[0], s.r[1], s.r[2], _v1);                                 /* araç */
      toSceneDir(s.v[0], s.v[1], s.v[2], _v2).normalize();                  /* v̂ */
      toSceneDir(s.r[0], s.r[1], s.r[2], _v3).normalize();                  /* r̂ (yerel yukarı) */
      const cs = Math.max(.055, state.extent * .02);                        /* araç görüntü boyu */
      out.pos.copy(_v1).addScaledVector(_v2, -cs * 7.5).addScaledVector(_v3, cs * 2.8);
      out.look.copy(_v1).addScaledVector(_v2, cs * 6);
      return;
    }
    /* free veya takip edilecek araç yoksa: mevcut konumda kal */
    out.pos.copy(camera.position);
    out.look.copy(controls.target);
  }
  const _dc = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  function updateCamera(dtReal) {
    if (state.camMode === 'free') { controls.enabled = true; controls.update(); return; }
    controls.enabled = false;
    desiredCamera(state.camMode, _dc);
    const tr2 = state.camTransition;
    if (tr2) {
      tr2.elapsed += dtReal * 1000;
      const f = easeInOut(clamp01(tr2.elapsed / tr2.duration));
      camera.position.lerpVectors(tr2.fromPos, _dc.pos, f);
      camState.look.lerpVectors(tr2.fromLook, _dc.look, f);
      if (f >= 1) state.camTransition = null;
    } else if (state.camSnap) {
      camera.position.copy(_dc.pos);
      camState.look.copy(_dc.look);
      state.camSnap = false;
    } else {
      /* kritik sönümlü takip: chase modunda titremesiz akış */
      const k = state.camMode === 'chase' ? 6.5 : 3.2;
      const alpha = 1 - Math.exp(-k * dtReal);
      camera.position.lerp(_dc.pos, alpha);
      camState.look.lerp(_dc.look, alpha);
    }
    camera.lookAt(camState.look);
    controls.target.copy(camState.look);
  }
  const cameraApi = {
    mode(m) {
      if (m === state.camMode) return;
      this.transitionTo(m, { duration: 700 });
    },
    transitionTo(m, { duration = 1400 } = {}) {
      if (m === 'free') {
        controls.target.copy(camState.look);
        state.camMode = 'free'; state.camTransition = null;
        return;
      }
      state.camTransition = {
        duration: Math.max(1, duration), elapsed: 0,
        fromPos: camera.position.clone(),
        fromLook: camState.look.clone(),
      };
      state.camMode = m;
    },
    get current() { return state.camMode; },
  };

  /* -------- zaman çizelgesi */
  const timeline = {
    play() { state.playing = true; ensureLoop(); },
    pause() { state.playing = false; },
    scrub(t) {
      state.t = Math.min(state.duration, Math.max(0, t));
      state.camSnap = true; state.camTransition = null;
      stepVisuals(); render();
    },
    setWarp(x) { state.warp = Math.max(.01, x); },
    get t() { return state.t; },
    set t(v) { this.scrub(v); },
    get warp() { return state.warp; },
    get playing() { return state.playing; },
    get duration() { return state.duration; },
  };

  /* -------- HUD */
  function updateHud() {
    if (!state.hud) return;
    const tr = state.focused;
    hudFields.t.textContent = fmtTime(state.t);
    if (tr) {
      const s = tr.evaluate(state.t);
      const rkm = Math.hypot(s.r[0], s.r[1], s.r[2]);
      hudFields.alt.textContent = body ? `${fmtKm(rkm - body.R)} km` : `${fmtKm(rkm)} km`;
      hudFields.v.textContent = `${Math.hypot(s.v[0], s.v[1], s.v[2]).toFixed(2)} km/s`;
      const dvSum = tr.appliedBurns.reduce((acc, b) => acc + (state.t >= b.t ? b.dvMag : 0), 0);
      hudFields.dv.textContent = `${dvSum.toFixed(2)} km/s`;
    }
    hudFields.warp.textContent = `${nfTR.format(Math.round(state.warp))}× hızlandırılmış gösterim`;
  }

  /* -------- her karede görsel durum = f(t) (deterministik) */
  function stepVisuals() {
    const t = state.t;
    /* gövde dönüşü: MUTLAK açı — scrub ile tutarlı, fiziksel hız */
    if (body) bodyGroup.rotation.y = body.omega * t;

    for (const tr of tracks) {
      if (!tr.visible) continue;
      /* keşif çizgisi */
      if (tr.path.material.dashed) {
        tr.path.material.dashSize = Math.max(1e-5, flownLen(tr, t));
      }
      /* araç pozu: +X hız yönünde (teğetten çatı) */
      const clampT = Math.min(Number.isFinite(tr.tEnd) ? tr.tEnd : t, Math.max(tr.t0, t));
      const s = tr.evaluate(clampT);
      if (tr.craftGroup) {
        toScene(s.r[0], s.r[1], s.r[2], _v1);
        tr.craftGroup.position.copy(_v1);
        toSceneDir(s.v[0], s.v[1], s.v[2], _v2);
        if (_v2.lengthSq() > 1e-12) {
          _v2.normalize();                                     /* X = v̂ */
          toSceneDir(s.r[0], s.r[1], s.r[2], _v3).normalize(); /* Z referansı = r̂ */
          _v4.crossVectors(_v3, _v2).normalize();              /* Y = ẑ×x̂ */
          _v3.crossVectors(_v2, _v4);                          /* Z = x̂×ŷ */
          _m4.makeBasis(_v2, _v4, _v3);
          tr.craftGroup.quaternion.setFromRotationMatrix(_m4);
        }
        tr.craftGroup.visible = t >= tr.t0 - 1e-9;
      }
      /* iz kuyruğu: baş parlak, kuyruk söner — konumlar t'nin fonksiyonu.
         Kuyruk BİNİCİNİN yakın geçmişidir: araçsız referans izlerde çizilmez
         (hedef halkada hayalet kuyruk = araçsız parlaklık, yanlış okunur). */
      const trail = tr.trail;
      const show = t > tr.t0 + 1 && !!tr.craftGroup;
      trail.line.visible = show;
      if (show) {
        const span = Math.min(Math.max(60, (tr.periodHint || 3600) * .38), t - tr.t0);
        for (let i = 0; i < TRAIL_N; i++) {
          const ti = clampT - (i / (TRAIL_N - 1)) * span;
          const si = tr.evaluate(ti);
          trail.positions[i * 3] = si.r[0] * kmToScene;
          trail.positions[i * 3 + 1] = si.r[2] * kmToScene;
          trail.positions[i * 3 + 2] = -si.r[1] * kmToScene;
          const w = (1 - i / (TRAIL_N - 1)) ** 2;
          trail.colors[i * 3] = trail.color.r * w * 1.25;
          trail.colors[i * 3 + 1] = trail.color.g * w * 1.25;
          trail.colors[i * 3 + 2] = trail.color.b * w * 1.25;
        }
        trail.line.geometry.setPositions(trail.positions);
        trail.line.geometry.setColors(trail.colors);
      }
      /* yanma işaretleri: pencereler sim t'nin saf fonksiyonu */
      let plumeW = 0;
      for (const bm of tr.burnMarkers) {
        const gd = ghostSimDur;
        /* önce-hayaleti: yanmadan önce belirir, yanma sırasında söner */
        setLineOpacity(bm.ghostPre.material, .5 * windowFn(t, bm.t - 2 * gd, bm.t - 1.2 * gd, bm.t + .2 * gd, bm.t + gd));
        /* sonra-hayaleti: yanma noktasından itibaren ÇİZİLİR, sonra sakinleşir */
        const drawF = smooth01((t - bm.t) / gd);
        bm.ghostPost.material.dashSize = Math.max(1e-5, drawF * bm.ghostPost.total);
        setLineOpacity(bm.ghostPost.material, t < bm.t ? 0
          : .55 - .33 * smooth01((t - (bm.t + 3 * gd)) / (3 * gd)));
        /* ΔV oku + etiket + hüzme penceresi */
        const w = windowFn(t, bm.t - .4 * gd, bm.t - .1 * gd, bm.t + .8 * gd, bm.t + 1.6 * gd);
        bm.arrowMat.opacity = w * .95;
        bm.label.opacity = w;
        /* hüzme: yalnız yanma sırasında — işaretler arasında MAX alınır */
        plumeW = Math.max(plumeW, windowFn(t, bm.t - .05 * gd, bm.t + .02 * gd, bm.t + .5 * gd, bm.t + .8 * gd));
      }
      if (tr.plume) {
        tr.plume.material.opacity = plumeW * (.55 + .15 * Math.sin(t * .9));  /* deterministik titreme */
        tr.plume.scale.set(1, .7 + .5 * plumeW, 1);
        tr.plume.visible = plumeW > .01;
      }
      /* apsis işaretleri: bağlı yanmadan sonra yumuşak belirme */
      for (const ap of tr.apsides) {
        const o = .7 * smooth01((t - ap.appearT) / (ghostSimDur * .8));
        ap.mesh.material.opacity = o;
        ap.label.opacity = state.hud && tr === state.focused ? o : 0;
      }
    }
    updateHud();
  }

  function render() {
    projectLabels();
    if (bloomOn) composer.render(); else renderer.render(scene, camera);
  }

  /* -------- adımlama: advance(dtReal) — dışarıdan veya iç rAF'tan */
  function advance(dtReal) {
    const perf0 = performance.now();
    if (state.playing) {
      state.t = Math.min(state.duration, state.t + dtReal * state.warp);
      if (state.t >= state.duration) state.playing = false;   /* sonda dur, kareyi tut */
    }
    stepVisuals();
    updateCamera(dtReal);
    render();
    stats.advanceMs = stats.advanceMs * .92 + (performance.now() - perf0) * .08;
  }

  /* -------- iç döngü (yalnız active iken; gizli sekmede durur) */
  let frame = null;
  const clock = new THREE.Clock();
  function loop() {
    frame = null;
    if (!state.active || document.hidden) return;
    const dt = Math.min(.1, clock.getDelta());
    advance(dt);
    frame = requestAnimationFrame(loop);
  }
  function ensureLoop() {
    if (!state.active || document.hidden) return;
    if (frame === null) { clock.getDelta(); frame = requestAnimationFrame(loop); }
  }
  const onVisibility = () => ensureLoop();
  document.addEventListener('visibilitychange', onVisibility);

  /* -------- boyutlandırma */
  function resize() {
    const w = Math.max(2, canvasHost.clientWidth);
    const h = Math.max(2, canvasHost.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   /* DPR sınırı (sözleşme) */
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resolution.set(w, h);
    for (const m of lineMaterials) m.resolution = resolution;   /* setter kopyalar */
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  resize();

  /* azaltılmış hareket / dışa aktarım: kendiliğinden oynatma yok; çağıran
     taraf tabloyu scrub ile kurar (deklarasyon manifest'te) */
  if (!reducedMotion && !exportMode && (options.autoplay ?? true)) state.playing = true;
  ensureLoop();

  const stage = {
    figure,
    addTrajectory,
    setCraft,
    addBurnMarker,
    timeline,
    camera: cameraApi,
    hud(on) { state.hud = Boolean(on); hudEl.hidden = !state.hud; updateHud(); },
    setGrid(on) { state.grid = Boolean(on); gridGroup.visible = state.grid; render(); },
    advance,
    renderNow: render,
    setActive(v) {
      state.active = Boolean(v);
      if (!state.active && frame !== null) { cancelAnimationFrame(frame); frame = null; }
      ensureLoop();
    },
    get focusedTrack() { return state.focused ? state.focused.handle : null; },
    get reducedMotion() { return reducedMotion; },
    get exportMode() { return exportMode; },
    stats,
    palette,
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      figure.remove();
    },
  };
  return stage;
}
