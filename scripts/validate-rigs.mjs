#!/usr/bin/env node
/* validate-rigs.mjs — physical_rigs eklem sürücüsü ve saf çözücüler için
   Node doğrulaması (three'siz). docs/physical-rigs-plan.md §7 maddeleri:
   1 odometre/tekerlek açısı · 2 rocker-bogie diferansiyel eşitliği ve düz
   arazi sıfırı · 3 Ackermann dönüş merkezi · 4 hız/sınır fuzz · 5 determinizm
   + kadans · 6 stroboskop kuralı · (7 kol IK henüz yok, bildirilir).
   Ek: kritik sönüm aşmaz; yaylı açılım aşar ve dayanakta durur; tek yönlü
   geri gitmez; koreografi programları her tür için hatasız koşar.

   Kullanım: node scripts/validate-rigs.mjs        Çıkış: HATA varsa 1 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { createRig, solveRockerBogie, ackermann, wheelAdvance, slipRatio, hashPose, DEG } = await mod('presets/physical_rigs/rig-core.mjs');
const { createProgram, PROGRAMS } = await mod('presets/physical_rigs/choreography.mjs');

let fails = 0, total = 0;
const check = (name, ok, detail = '') => { total++; console.log(`  ${ok ? 'ok ' : 'HATA'} ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) fails++; };
const seededRand = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const RIG = { kind: 'test', joints: {
  hinge: { node: 'hinge', axis: 'x', range: [0, 90], rateDegS: 30 },
  spring: { node: 'spring', axis: 'x', range: [0, 90], spring: true, oneWay: true, rateDegS: 400 },
  stroke: { node: 'stroke', mode: 'translate', dir: [1, 0, 0], range: [0, 0.08], oneWay: true },
  gimbal: { node: 'gimbal', axis: ['y', 'z'], range: [-6, 6], rateDegS: 10 },
  rotor: { node: 'rotor', axis: 'z', spin: true, rpm: 2400, spokes: 2 },
  wheel: { node: 'wheel', axis: 'y', spin: true, radius: 0.135, spokes: 18 },
} };

console.log('== 1 tekerlek: θ = odometre / r (kayma 0), kaymada ω r > v');
{
  const s = { theta: 0, odometer: 0 };
  for (let i = 0; i < 600; i++) wheelAdvance(s, { v: 0.04, r: 0.25, slip: 0, dt: 1 / 60 });
  check('odometre = ∫v dt', Math.abs(s.odometer - 0.4) < 1e-9, s.odometer.toFixed(6));
  check('θ = odometre / r', Math.abs(s.theta - s.odometer / 0.25) < 1e-9);
  const s2 = wheelAdvance({ theta: 0, odometer: 0 }, { v: 0.04, r: 0.25, slip: 0.3, dt: 1 });
  check('kayma: ω r = v/(1−s) > v', Math.abs(s2.omega * 0.25 - 0.04 / 0.7) < 1e-12);
  check('kayma oranı düzlükte s0, 20° yamaçta ≈ 0,3', Math.abs(slipRatio(0) - 0.05) < 1e-12 && Math.abs(slipRatio(20 * DEG) - 0.3047) < 0.01, slipRatio(20 * DEG).toFixed(3));
}

console.log('== 2 rocker-bogie');
{
  const geom = { Lbogie: 0.37, Lrocker: 0.42, track: 0.62 };
  const flat = solveRockerBogie({ hF: 0, hM: 0, hR: 0 }, { hF: 0, hM: 0, hR: 0 }, geom);
  check('düz arazi → tüm açılar 0', Object.values(flat).every(v => Math.abs(v) < 1e-12));
  const L = { hF: 0.06, hM: 0.0, hR: 0.02 }, R = { hF: 0.0, hM: 0.03, hR: 0.0 };
  const k = solveRockerBogie(L, R, geom);
  check('diferansiyel: pitch = (ρL+ρR)/2', Math.abs(k.pitch - 0.5 * (k.rockerL + k.rockerR)) < 1e-12);
  check('çubuk = (ρL−ρR)/2', Math.abs(k.differential - 0.5 * (k.rockerL - k.rockerR)) < 1e-12);
  check('bogie açısı arka−orta yükseklikten', Math.abs(k.bogieL - Math.atan2(0.02, 0.37)) < 1e-12);
  check('simetrik giriş → roll 0, çubuk 0', (() => { const s = solveRockerBogie(L, L, geom); return Math.abs(s.roll) < 1e-12 && Math.abs(s.differential) < 1e-12; })());
}

console.log('== 3 Ackermann');
{
  const g = { L: 0.51, w: 0.62 };
  const a = ackermann(2.0, g);
  const cI = 2.0 - g.w / 2 - 0 + g.L / Math.tan(a.innerFront) * 0;   // merkez y: R
  /* dönüş merkezi: iç tekerlek için (R − w/2) = L / tan δi, dış için (R + w/2) = L / tan δo */
  const Ri = g.L / Math.tan(a.innerFront) + g.w / 2, Ro = g.L / Math.tan(a.outerFront) - g.w / 2;
  check('iç/dış açıların dönüş merkezi aynı nokta', Math.abs(Ri - Ro) < 1e-9 && Math.abs(Ri - 2.0) < 1e-9, `${Ri.toFixed(4)} / ${Ro.toFixed(4)}`);
  check('iç açı > dış açı', a.innerFront > a.outerFront);
  check('arka köşeler ters işaretli', a.innerRear === -a.innerFront && a.outerRear === -a.outerFront);
  const p = ackermann(0, g);
  check('yerinde dönüş: köşeler ±atan(L/(w/2))', p.turnInPlace && Math.abs(p.innerFront - Math.atan2(0.51, 0.31)) < 1e-12);
  check('sonsuz yarıçap → 0', ackermann(Infinity, g).innerFront === 0);
  void cI;
}

console.log('== 4 hız sınırı ve sınır açısı (fuzz, 10⁴ adım)');
{
  const rig = createRig(RIG);
  const rnd = seededRand(7);
  let rateViol = 0, limitViol = 0, prev = rig.value('hinge');
  for (let i = 0; i < 10000; i++) {
    if (i % 37 === 0) rig.set('hinge', rnd() * 200 - 50);
    if (i % 53 === 0) rig.set('gimbal', [rnd() * 30 - 15, rnd() * 30 - 15]);
    rig.advance(1 / 60);
    const h = rig.value('hinge');
    if (Math.abs(h - prev) > 30 / 60 + 1e-9) rateViol++;
    if (h < -1e-9 || h > 90 + 1e-9) limitViol++;
    const [gy, gz] = rig.value('gimbal');
    if (Math.abs(gy) > 6 + 1e-9 || Math.abs(gz) > 6 + 1e-9) limitViol++;
    prev = h;
  }
  check('adım başına hız sınırı ihlali yok', rateViol === 0, `${rateViol}`);
  check('sınır açısı ihlali yok', limitViol === 0, `${limitViol}`);
}

console.log('== 5 determinizm + kadans');
{
  const run = (dt, n) => { const rig = createRig(RIG); rig.set('hinge', 60); rig.set('gimbal', [4, -3]); rig.set('rotor', 2400); for (let i = 0; i < n; i++) rig.advance(dt); return rig; };
  const a = run(1 / 60, 120), b = run(1 / 60, 120), c = run(1 / 120, 240);
  check('aynı komut → aynı imza', hashPose(a.pose()) === hashPose(b.pose()), hashPose(a.pose()));
  const dh = Math.abs(a.value('hinge') - c.value('hinge')), dg = Math.abs(a.value('gimbal')[0] - c.value('gimbal')[0]);
  check('advance(1/60)×120 ≈ advance(1/120)×240 (menteşe < 0,05°, gimbal < 0,01°)', dh < 0.05 && dg < 0.01, `${dh.toExponential(2)}° / ${dg.toExponential(2)}°`);
  const s = createRig(RIG); s.set('hinge', 60);
  for (let i = 0; i < 600; i++) s.advance(1 / 60);
  check('kritik sönüm: 10 s sonra hedefte (< 0,01°)', Math.abs(s.value('hinge') - 60) < 0.01, s.value('hinge').toFixed(4));
}

console.log('== 5b aşma davranışı');
{
  const rig = createRig(RIG); rig.set('hinge', 45);
  let maxH = 0; for (let i = 0; i < 600; i++) { rig.advance(1 / 60); maxH = Math.max(maxH, rig.value('hinge')); }
  check('kritik sönümlü eklem hedefi AŞMAZ', maxH <= 45 + 1e-9, maxH.toFixed(4));
  const sp = createRig(RIG); sp.set('spring', 60);
  let maxS = 0, hits = 0, prevV = 0;
  for (let i = 0; i < 600; i++) { sp.advance(1 / 60); const v = sp.value('spring'); maxS = Math.max(maxS, v); if (v >= 90 - 1e-9 && prevV < 90 - 1e-9) hits++; prevV = v; }
  check('yaylı açılım aşar ama dayanakta (90°) durur', maxS <= 90 + 1e-9 && maxS > 60, maxS.toFixed(2));
  check('tek yönlü yay geri gitmez (son değer = azami)', Math.abs(sp.value('spring') - maxS) < 1e-9, sp.value('spring').toFixed(2));
  const st = createRig(RIG); st.set('stroke', 0.06); for (let i = 0; i < 300; i++) st.advance(1 / 60);
  const reached = st.value('stroke'); st.set('stroke', 0); for (let i = 0; i < 300; i++) st.advance(1 / 60);
  check('bal peteği strok tek yönlü: hedef 0 verilince geri çıkmaz', Math.abs(st.value('stroke') - reached) < 1e-12 && reached > 0.059, reached.toFixed(4));
}

console.log('== 6 stroboskop kuralı');
{
  const rig = createRig(RIG, { fps: 60 }); rig.set('rotor', 2400);
  for (let i = 0; i < 600; i++) rig.advance(1 / 60);
  const f = 2 * rig.omega('rotor') / (2 * Math.PI);
  check('2400 dev/dk × 2 çıta = 80 Hz > 0,4·60 → blur açık', rig.blur('rotor') && Math.abs(f - 80) < 0.5, `${f.toFixed(1)} Hz`);
  rig.set('rotor', 300); for (let i = 0; i < 600; i++) rig.advance(1 / 60);
  check('300 dev/dk (10 Hz) → blur kapalı', !rig.blur('rotor'), (2 * rig.omega('rotor') / (2 * Math.PI)).toFixed(1) + ' Hz');
  check('rpm rampası sınırlı: 4 s içinde 2400 (600 dev/dk/s)', (() => { const r = createRig(RIG); r.set('rotor', 2400); r.advance(1); const rpm = r.omega('rotor') * 60 / (2 * Math.PI); return Math.abs(rpm - 600) < 1e-6; })());
}

console.log('== 7 koreografi programları (kurucu rig haritaları üzerinde)');
{
  /* Kurucu haritalarını three olmadan yeniden üretmek yerine programın
     çağırdığı eklem adları ile sentetik bir harita kurulur: eksik ad → HATA. */
  const need = {
    rover: ['rocker.L', 'rocker.R', 'bogie.L', 'bogie.R', 'differential', 'steer.FL', 'steer.FR', 'steer.RL', 'steer.RR', 'wheel.FL', 'wheel.ML', 'wheel.RL', 'wheel.FR', 'wheel.MR', 'wheel.RR', 'mast.pan', 'mast.tilt', 'arm.j1', 'arm.j2', 'arm.j3', 'arm.turret', 'hga.az', 'hga.el'],
    orbiter: ['wing.L.sada', 'wing.R.sada', 'hga.az', 'hga.el', 'radiator.louvers', 'engine.gimbal'],
    lander: ['engine.gimbal', 'leg.0.stroke', 'leg.1.stroke', 'leg.2.stroke', 'leg.3.stroke', 'sband.az', 'sband.el'],
    rocket: ['engine.gimbal', 'gridFin.0.fold', 'gridFin.1.fold', 'gridFin.2.fold', 'gridFin.3.fold', 'leg.0.deploy', 'leg.1.deploy', 'leg.2.deploy', 'leg.3.deploy', 'fairing.L.open', 'fairing.R.open', 'stage.sep'],
    cubesat: ['wing.L.deploy', 'wing.R.deploy'],
    capsule: ['smWing.0.deploy', 'smWing.1.deploy', 'smWing.2.deploy', 'smWing.3.deploy', 'hatch.open', 'engine.gimbal'],
    starship: ['flap.FL', 'flap.FR', 'flap.RL', 'flap.RR', 'engine.0.gimbal', 'engine.1.gimbal', 'engine.2.gimbal'],
    marshelicopter: ['rotor.lower', 'rotor.upper'],
  };
  for (const [kind, names] of Object.entries(need)) {
    const joints = {};
    for (const n of names) {
      const spin = n.startsWith('wheel') || n.startsWith('rotor');
      joints[n] = spin ? { node: n, axis: 'y', spin: true, rpm: 2400, spokes: n.startsWith('wheel') ? 18 : 2, radius: 0.135 }
        : n.includes('gimbal') ? { node: n, axis: ['y', 'z'], range: [-15, 15], rateDegS: 30 }
        : n.includes('stroke') || n === 'stage.sep' ? { node: n, mode: 'translate', dir: [1, 0, 0], range: [0, n === 'stage.sep' ? 3 : 0.08], oneWay: true }
        : { node: n, axis: 'y', range: [-180, 180], rateDegS: 90 };
    }
    const rig = createRig({ kind, joints });
    const setNames = new Set(); const orig = rig.set.bind(rig);
    rig.set = (name, v) => { setNames.add(name); const ok = orig(name, v); if (!ok) throw new Error(`${kind}: program bilinmeyen eklem '${name}' istedi`); return ok; };
    const prog = createProgram(kind);
    let err = null;
    try { for (let i = 0; i < Math.round(prog.period * 60); i++) { prog.apply(rig, i / 60); rig.advance(1 / 60); } } catch (e) { err = e; }
    const missing = names.filter(n => !setNames.has(n) && !n.startsWith('wheel'));
    check(`${kind}: program ${prog.period} s hatasız, tüm eklemler komut aldı`, !err && missing.length === 0, err ? String(err.message) : missing.length ? 'komutsuz: ' + missing.join(',') : `${setNames.size} eklem`);
    /* determinizm: iki koşum aynı imza */
    const run = () => { const r = createRig({ kind, joints }); const p = createProgram(kind); for (let i = 0; i < 300; i++) { p.apply(r, i / 60); r.advance(1 / 60); } return hashPose(r.pose()); };
    check(`${kind}: iki koşum aynı imza`, run() === run());
  }
  check('bilinmeyen tür → boş program (sessiz)', createProgram('yok').period === 1);
  check('starship-stack programı starship ile aynı', PROGRAMS['starship-stack'] === PROGRAMS.starship);
}

console.log('\n(7 kol IK: henüz yok — plan §5.2, F3.)');
console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
