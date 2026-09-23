/* rig-core.mjs — EKLEM SÜRÜCÜSÜ (three'siz, DOM'suz, deterministik).
   docs/physical-rigs-plan.md §2 parça sözleşmesini SÜRER: craft-blocks
   kurucularının userData.rig.joints haritasını okur, her eklemi gerçek bir
   aktüatör gibi hedefe götürür ve düğüme yazar.

   Fizik (adlandırılmış):
   · Kritik sönümlü ikinci derece yanıt (ζ = 1): aktüatör hedefe aşmadan,
     sıçramadan yaklaşır. Adım KAPALI FORMDUR (lineer ODE'nin tam çözümü),
     yani sabit hedefte advance(1/60)×120 ≡ advance(1/120)×240 (kadans testi).
   · Yaylı açılım (spec.spring): ζ = 0,25 — sönümlü salınım 2–3 periyot,
     mekanik dayanakta durur (range sınırı). Yalnız spring bayrağıyla.
   · Hız sınırı (rateDegS / rate): gerçek aktüatör sonsuz hızlı değildir;
     adım başına yer değiştirme rate·dt ile kırpılır, hız da.
   · Sınır açısı (range): kırpılır, sınırda hız sıfırlanır.
   · Tek yönlü (oneWay): bal peteği strok'u, yanan-tel açılımı — geri gitmez;
     yalnız reset() sıfırlar (yeni araç).
   · Dönme (spin): açı serbest, HIZ birinci derece rampayla hedefe gider
     (rpm); çıta frekansı f = spokes·ω/2π; f > 0,4·fps ise stroboskop
     tehlikesi → blur bayrağı (tüketici bulanıklık diskini açar, §3.3).
   · Öteleme (mode:'translate'): aynı dinamik, birim tasarım birimidir;
     düğüm konumu = taban + dir·x.

   API:
     createRig(rigData, { fps=60 }) → rig
       rig.set(ad, hedef)        rotate: derece; iki eksenli: [a, b]; translate: birim; spin: rpm
       rig.advance(dt)           saf: durum(t+dt) = f(durum(t), dt)
       rig.value(ad)             anlık değer (derece / birim / rad açı spin'de)
       rig.pose()                { ad: değer } — hash için
       rig.blur(ad)              spin ekleminde stroboskop bayrağı
       rig.reset()               tüm eklemler sıfır, tek yönlüler dahil
       rig.apply(root)           three düğümlerine yazar (root.getObjectByName) — three import ETMEZ
     solveRockerBogie(...), ackermann(...), wheelAdvance(...), slipRatio(...) — saf çözücüler
     hashPose(pose) — determinizm imzası */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ── tek eklem ─────────────────────────────────────────────────────── */
function makeJoint(name, spec) {
  const mode = spec.spin ? 'spin' : spec.mode === 'translate' ? 'translate' : 'rotate';
  const twoAxis = Array.isArray(spec.axis) && mode === 'rotate';
  const range = spec.range || (mode === 'rotate' ? [-180, 180] : [0, 1]);
  const lo = mode === 'rotate' ? range[0] * DEG : range[0];
  const hi = mode === 'rotate' ? range[1] * DEG : range[1];
  const rate = mode === 'rotate'
    ? (spec.rateDegS ?? 90) * DEG
    : (spec.rate ?? Math.max(1e-6, (hi - lo)) * 0.5);            // translate: yarım strok / s
  const omegaN = spec.omegaN ?? (spec.spring ? 9 : 6);           // rad/s doğal frekans
  const zeta = spec.spring ? (spec.zeta ?? 0.25) : 1;
  const n = twoAxis ? 2 : 1;
  return {
    name, spec, mode, twoAxis, lo, hi, rate, omegaN, zeta,
    x: new Float64Array(n), v: new Float64Array(n), target: new Float64Array(n),
    /* spin */ omega: 0, omegaTarget: 0, blur: false,
    rpmRate: spec.rpmRate ?? (spec.rpm ?? 60) / 4,                 // rpm/s: 4 s'de tam devir
  };
}

/* Kapalı form ikinci derece adım: e = x − T. Kritik (ζ=1) ve sönümlü (ζ<1). */
function stepSecondOrder(e0, v0, w, zeta, dt) {
  if (zeta >= 1) {
    const A = e0, B = v0 + w * e0, ex = Math.exp(-w * dt);
    return [(A + B * dt) * ex, (B - w * (A + B * dt)) * ex];
  }
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const C1 = e0, C2 = (v0 + zeta * w * e0) / wd;
  const ex = Math.exp(-zeta * w * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt);
  const e = ex * (C1 * c + C2 * s);
  const v = ex * ((-zeta * w * C1 + wd * C2) * c + (-zeta * w * C2 - wd * C1) * s);
  return [e, v];
}

function advanceJoint(j, dt) {
  if (j.mode === 'spin') {
    /* hız birinci derece rampa (rpm/s sınırı), açı integral */
    const rpmNow = j.omega * 60 / (2 * Math.PI), rpmT = j.omegaTarget * 60 / (2 * Math.PI);
    const d = clamp(rpmT - rpmNow, -j.rpmRate * dt, j.rpmRate * dt);
    j.omega = (rpmNow + d) * 2 * Math.PI / 60;
    j.x[0] = (j.x[0] + j.omega * dt) % (2 * Math.PI);
    if (j.x[0] < 0) j.x[0] += 2 * Math.PI;
    return;
  }
  for (let k = 0; k < j.x.length; k++) {
    const x0 = j.x[k];
    let [e, v] = stepSecondOrder(x0 - j.target[k], j.v[k], j.omegaN, j.zeta, dt);
    let x = j.target[k] + e;
    /* hız sınırı: yer değiştirme rate·dt'yi aşamaz */
    const maxD = j.rate * dt;
    if (x - x0 > maxD) { x = x0 + maxD; v = j.rate; }
    else if (x0 - x > maxD) { x = x0 - maxD; v = -j.rate; }
    /* tek yönlü: geri gitmez */
    if (j.spec.oneWay && x < x0) { x = x0; v = 0; }
    /* sınır: kırp, sınırda dur */
    if (x <= j.lo) { x = j.lo; if (v < 0) v = 0; }
    if (x >= j.hi) { x = j.hi; if (v > 0) v = 0; }
    j.x[k] = x; j.v[k] = v;
  }
}

/* ── rig ───────────────────────────────────────────────────────────── */
export function createRig(rigData, { fps = 60 } = {}) {
  const joints = new Map();
  for (const [name, spec] of Object.entries((rigData && rigData.joints) || {})) joints.set(name, makeJoint(name, spec));
  const bases = new Map();                  // translate eklemlerinin taban konumu (ilk apply'da)
  const rig = {
    kind: rigData ? rigData.kind : null,
    joints,
    names: () => [...joints.keys()],
    has: (name) => joints.has(name),
    set(name, target) {
      const j = joints.get(name);
      if (!j) return false;
      if (j.mode === 'spin') { j.omegaTarget = (Number(target) || 0) * 2 * Math.PI / 60; return true; }
      const arr = Array.isArray(target) ? target : [target];
      for (let k = 0; k < j.x.length; k++) {
        const t = Number(arr[k] ?? arr[0]) || 0;
        j.target[k] = clamp(j.mode === 'rotate' ? t * DEG : t, j.lo, j.hi);
      }
      return true;
    },
    advance(dt) {
      if (!(dt > 0)) return;
      for (const j of joints.values()) advanceJoint(j, dt);
      for (const j of joints.values()) if (j.mode === 'spin') {
        const spokes = j.spec.spokes ?? 0;
        j.blur = spokes > 0 && (spokes * Math.abs(j.omega) / (2 * Math.PI)) > 0.4 * fps;
      }
    },
    value(name) {
      const j = joints.get(name);
      if (!j) return null;
      if (j.mode === 'spin') return j.x[0];
      if (j.twoAxis) return [j.x[0] * RAD, j.x[1] * RAD];
      return j.mode === 'rotate' ? j.x[0] * RAD : j.x[0];
    },
    /* Durumu DOĞRUDAN yaz (dinamik yok): katlı başlangıç pozu gibi 'zaten
       oradaydı' durumları için. Hedef de aynı değere kurulur. */
    jump(name, value) {
      const j = joints.get(name);
      if (!j || j.mode === 'spin') return false;
      const arr = Array.isArray(value) ? value : [value];
      for (let k = 0; k < j.x.length; k++) {
        const t = Number(arr[k] ?? arr[0]) || 0;
        j.x[k] = j.target[k] = clamp(j.mode === 'rotate' ? t * DEG : t, j.lo, j.hi); j.v[k] = 0;
      }
      return true;
    },
    /* spin ekleminde açıyı DIŞARIDAN yaz (tekerlek: θ = ∫ v/r dt çözücüden gelir);
       omega blur kararı için verilir */
    setSpinAngle(name, theta, omega = 0) {
      const j = joints.get(name);
      if (!j || j.mode !== 'spin') return false;
      j.x[0] = theta; j.omega = omega; j.omegaTarget = omega;
      return true;
    },
    blur: (name) => !!(joints.get(name) && joints.get(name).blur),
    omega: (name) => (joints.get(name) ? joints.get(name).omega : 0),
    pose() { const p = {}; for (const [n] of joints) p[n] = rig.value(n); return p; },
    reset() {
      for (const j of joints.values()) { j.x.fill(0); j.v.fill(0); j.target.fill(0); j.omega = 0; j.omegaTarget = 0; j.blur = false; }
    },
    /* three düğümlerine yaz — three import etmeden (rotation/position düz alanlar) */
    apply(root) {
      for (const j of joints.values()) {
        const node = root.getObjectByName(j.spec.node);
        if (!node) continue;
        if (j.mode === 'translate') {
          let base = bases.get(j.spec.node);
          if (!base) { base = [node.position.x, node.position.y, node.position.z]; bases.set(j.spec.node, base); }
          const d = j.spec.dir || [1, 0, 0];
          node.position.set(base[0] + d[0] * j.x[0], base[1] + d[1] * j.x[0], base[2] + d[2] * j.x[0]);
        } else if (j.twoAxis) {
          node.rotation[j.spec.axis[0]] = j.x[0];
          node.rotation[j.spec.axis[1]] = j.x[1];
        } else {
          node.rotation[j.spec.axis || 'y'] = (j.spec.sense ?? 1) * j.x[0];
        }
      }
    },
  };
  return rig;
}

/* ── saf çözücüler ─────────────────────────────────────────────────── */

/** Rocker-bogie kinematiği (§3.2) — bir yan için: tekerlek altı yükseklikleri
    (ön hF, orta hM, arka hR) ve kol boyları → bogie açısı β, rocker açısı ρ.
    Bogie pivotu orta–arka ortasında kabul edilir (buildRover geometrisi:
    pivot x=−0,22, orta −0,07, arka −0,44 → orta nokta −0,255; fark ihmal). */
export function solveSide({ hF, hM, hR }, { Lbogie, Lrocker }) {
  const beta = Math.atan2(hR - hM, Lbogie);              // arka yüksekse pozitif
  const hPivot = 0.5 * (hM + hR);
  const rho = Math.atan2(hPivot - hF, Lrocker);          // arka yüksekse pozitif (burun aşağı)
  return { beta, rho, hPivot };
}

/** İki yan → gövde. Diferansiyel: pitch = (ρL + ρR)/2, çubuk (ρL − ρR)/2. */
export function solveRockerBogie(left, right, geom) {
  const L = solveSide(left, geom), R = solveSide(right, geom);
  const pitch = 0.5 * (L.rho + R.rho);
  const differential = 0.5 * (L.rho - R.rho);
  const hL = (left.hF + left.hM + left.hR) / 3, hR = (right.hF + right.hM + right.hR) / 3;
  const roll = Math.atan2(hL - hR, geom.track);
  const height = 0.5 * (hL + hR);
  return { rockerL: L.rho, rockerR: R.rho, bogieL: L.beta, bogieR: R.beta, pitch, roll, differential, height };
}

/** Ackermann (§4): dönüş yarıçapı R (orta aks hattında, + sola), dingil
    mesafesi L (ön–orta aks), iz genişliği w → köşe açıları (rad). R=0: yerinde
    dönüş (köşeler ±atan(L/(w/2))). Sonsuz R → 0. */
export function ackermann(R, { L, w }) {
  if (!Number.isFinite(R)) return { innerFront: 0, outerFront: 0, innerRear: 0, outerRear: 0 };
  if (R === 0) {
    const a = Math.atan2(L, w / 2);
    return { innerFront: a, outerFront: -a, innerRear: -a, outerRear: a, turnInPlace: true };
  }
  const s = Math.sign(R), r = Math.abs(R);
  const inner = Math.atan2(L, r - w / 2), outer = Math.atan2(L, r + w / 2);
  return { innerFront: s * inner, outerFront: s * outer, innerRear: -s * inner, outerRear: -s * outer };
}

/** Kayma oranı (§3.1): s = s0 + k·tan(eğim), [0, 0.95]. */
export function slipRatio(slopeRad, { s0 = 0.05, k = 0.7 } = {}) {
  return clamp(s0 + k * Math.tan(Math.max(0, slopeRad)), 0, 0.95);
}

/** Tekerlek ilerletme: yol hızı v, yarıçap r, kayma s → açı artışı ve odometre.
    Tekerlek yol hızından hızlı döner: ω r = v / (1 − s). */
export function wheelAdvance(state, { v, r, slip = 0, dt }) {
  const omega = v / (r * Math.max(1e-6, 1 - slip));
  state.theta = (state.theta || 0) + omega * dt;
  state.odometer = (state.odometer || 0) + v * dt;
  state.omega = omega;
  return state;
}

/* ── determinizm imzası ────────────────────────────────────────────── */
export function hashPose(pose) {
  let h = 0x811c9dc5;
  const mix = (n) => { const b = new Float64Array([n]), u = new Uint8Array(b.buffer); for (let i = 0; i < 8; i++) { h ^= u[i]; h = Math.imul(h, 0x01000193) >>> 0; } };
  for (const k of Object.keys(pose).sort()) {
    const v = pose[k];
    if (Array.isArray(v)) v.forEach(mix); else mix(Number(v) || 0);
  }
  return h.toString(16).padStart(8, '0');
}
