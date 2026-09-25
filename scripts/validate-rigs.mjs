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
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { createRig, solveRockerBogie, ackermann, wheelAdvance, slipRatio, hashPose, DEG } = await mod('presets/physical_rigs/rig-core.mjs');
const { createProgram, PROGRAMS } = await mod('presets/physical_rigs/choreography.mjs');
const { createTreadmill, loopClosure, periodicNoise, wrapZ } = await mod('presets/physical_rigs/terrain-treadmill.mjs');
const { createRoverDrive, ROVER_GEOM, reconstructInclinations } = await mod('presets/physical_rigs/rover-drive.mjs');
const { MECHANISMS, MECHANISM_IDS, resolveMechanism, limitText } = await mod('presets/physical_rigs/mechanism-index.mjs');

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

console.log('== 8 treadmill: dikissiz periyodik zemin'.replace('dikissiz', 'dikişsiz'));
{
  const P = 17.37;
  const field = createTreadmill({ period: P, seed: 4242 });
  let hMax = 0, gMax = 0, pMax = 0;
  for (let i = 0; i < 400; i++) {
    const x = (i / 400 - 0.5) * 40;
    hMax = Math.max(hMax, Math.abs(field.height(x, -P / 2) - field.height(x, P / 2)));
    const gA = field.gradient(x, -P / 2), gB = field.gradient(x, P / 2);
    gMax = Math.max(gMax, Math.abs(gA[1] - gB[1]));
    const z = (i / 400 - 0.5) * P;
    pMax = Math.max(pMax, Math.abs(field.height(x, z) - field.height(x, z + P)));
  }
  check('döşeme sınırında YÜKSEKLİK atlamıyor (h(x,−P/2) = h(x,+P/2))', hMax < 1e-9, hMax.toExponential(2));
  check('döşeme sınırında EĞİM atlamıyor (C¹ dikiş)', gMax < 1e-9, gMax.toExponential(2));
  check('h(x, z) = h(x, z + P) her yerde', pMax < 1e-9, pMax.toExponential(2));
  const n = periodicNoise(7, 16);
  let nMax = 0;
  for (let i = 0; i < 64; i++) { const u = i / 64; nMax = Math.max(nMax, Math.abs(n(u, 0) - n(u, 1)), Math.abs(n(0, u) - n(1, u))); }
  check('periyodik gürültü kenarda sarar (doku dikişsiz)', nMax < 1e-12, nMax.toExponential(2));
  /* wrapZ periyodik DEĞİL, ANTİ-periyodiktir: wrapZ(z+P) = −wrapZ(z).
     Dikişin kapanması, biçimlerin dz'de ÇİFT olmasından gelir (üstteki üç sınama). */
  check('wrapZ anti-periyodik (wrapZ(z+P) = −wrapZ(z)) ve merkezde z − cz',
    Math.abs(wrapZ(5, 0, P) + wrapZ(5 + P, 0, P)) < 1e-12 && Math.abs(wrapZ(0.001, 0, P) - 0.001) < 1e-6);
  check('bilinmeyen biçim reddedilir', (() => { try { createTreadmill({ period: 10, features: [{ kind: 'yok' }] }); return false; } catch { return true; } })());
}

console.log('== 9 döngü kapanışı (tekerlek tam sayı devir)');
{
  const r = 0.2509, k = loopClosure({ wheelRadius: r, revolutions: 28, loopSeconds: 96 });
  check('travel = 2π r N', Math.abs(k.travel - 2 * Math.PI * r * 28) < 1e-12, k.travel.toFixed(4));
  check('speed × loop = travel', Math.abs(k.speed * 96 - k.travel) < 1e-12);
  const aci = (k.speed * 96) / r;
  check('bir döngüde tekerlek açısı = 2π × 28 (sıçrama yok)', Math.abs(aci - 2 * Math.PI * 28) < 1e-9, (aci / (2 * Math.PI)).toFixed(6) + ' devir');
  check('arazi periyodu = travel (zemin tam bir döşeme kayar)', k.period === k.travel);
  check('devir sayısı tam sayıya yuvarlanır', loopClosure({ wheelRadius: r, revolutions: 27.6 }).revolutions === 28);
}

console.log('== 10 araziye bağlı sürüş (rover-drive)');
{
  const R = 0.1433;
  const duz = () => 0;
  const flat = createRoverDrive({ wheelRadius: R }).update(null, { sample: duz, v: 0, dt: 0 });
  check('düz arazi: tüm açılar 0, gövde yüksekliği = yarıçap',
    Math.abs(flat.pitch) < 1e-12 && Math.abs(flat.roll) < 1e-12 && Math.abs(flat.height - R) < 1e-12, flat.height.toFixed(4));
  const egim = 8 * Math.PI / 180;
  const rampa = (lx) => -Math.tan(egim) * lx;
  const ramp = createRoverDrive({ wheelRadius: R }).update(null, { sample: rampa, v: 0, dt: 0 });
  check('eğimli düzlem: yunuslama düzlem eğimine eşit (±0,03°)',
    Math.abs(Math.abs(ramp.pitch) - egim) < 6e-4, `${(ramp.pitch * 180 / Math.PI).toFixed(3)}° / ${(egim * 180 / Math.PI).toFixed(3)}°`);
  check('eğimli düzlemde yalpa 0 ve diferansiyel 0', Math.abs(ramp.roll) < 1e-12 && Math.abs(ramp.differential) < 1e-12);
  const yan = createRoverDrive({ wheelRadius: R }).update(null, { sample: (lx, ly) => 0.12 * ly, v: 0, dt: 0 });
  check('yalnız yanal eğimde yunuslama 0, yalpa ≠ 0', Math.abs(yan.pitch) < 1e-12 && Math.abs(yan.roll) > 0.05, `${(yan.roll * 180 / Math.PI).toFixed(2)}°`);

  const joints = {};
  for (const nm of ['rocker.L', 'rocker.R', 'bogie.L', 'bogie.R', 'differential']) joints[nm] = { node: nm, axis: 'y', range: [-90, 90], rateDegS: 1e6 };
  for (const nm of ['steer.FL', 'steer.FR', 'steer.RL', 'steer.RR']) joints[nm] = { node: nm, axis: 'z', range: [-90, 90], rateDegS: 1e6 };
  for (const nm of ['FL', 'ML', 'RL', 'FR', 'MR', 'RR']) joints[`wheel.${nm}`] = { node: `wheel${nm}`, axis: 'y', spin: true, spokes: 48, radius: R };
  const rig = createRig({ kind: 'rover', joints });
  const engebe = (lx, ly) => 0.09 * Math.sin(lx * 3.1) + 0.05 * Math.cos(ly * 2.3 + lx);
  const sol = createRoverDrive({ wheelRadius: R }).update(rig, { sample: engebe, v: 0.4, dt: 1 / 60 });
  for (let i = 0; i < 400; i++) rig.advance(1 / 60);
  const geri = reconstructInclinations(rig, sol.pitch);
  const err = Math.max(Math.abs(geri.rockerL - sol.rocker.L), Math.abs(geri.rockerR - sol.rocker.R),
    Math.abs(geri.bogieL - sol.bogie.L), Math.abs(geri.bogieR - sol.bogie.R));
  check('eklem zinciri mutlak rocker/bogie eğimlerini geri verir (< 0,01°)', err * 180 / Math.PI < 0.01, (err * 180 / Math.PI).toExponential(2) + '°');

  const st = createRoverDrive({ wheelRadius: R }).update(null, { sample: (lx) => -Math.tan(35 * Math.PI / 180) * lx, v: 0.4, dt: 1 });
  check('25° üstü yamaçta rig ilerlemeyi reddeder (patinaj)', st.stalled && st.odometer === 0, `${(st.slopeRad * 180 / Math.PI).toFixed(1)}°`);
  const fl = createRoverDrive({ wheelRadius: R }).update(null, { sample: duz, v: 0.4, dt: 1 });
  check('düzlükte odometre = v·dt ve ω r > v (kayma)', Math.abs(fl.odometer - 0.4) < 1e-12 && fl.omega * R > 0.4);

  const kos = () => { const dr = createRoverDrive({ wheelRadius: R }); let o = 0;
    for (let i = 0; i < 300; i++) o = dr.update(null, { sample: engebe, v: 0.5, dt: 1 / 60 }).odometer; return o; };
  check('aynı girdi → aynı odometre', kos() === kos(), kos().toFixed(9));
  check('ROVER_GEOM donmuş (tek doğruluk kaynağı)', Object.isFrozen(ROVER_GEOM));
}

console.log('== 11 aksam dizini (mechanism-index)');
{
  /* Kurucu kaynağı METİN olarak okunur: craft-blocks three ve canvas ister,
     Node'da kurulamaz. Dizindeki her eklem adının kurucuda ÜRETİLDİĞİ,
     şablon adları joker\'e çevrilerek sınanır — yanlış yazılmış tek bir ad
     laboratuvarda sessizce boş satır olurdu. */
  const src = readFileSync(path.join(root, 'presets/craft_blocks/craft-blocks.mjs'), 'utf8');
  /* Eklem adları hem joints['…'] indekslerinde hem de satır içi
     { 'rotor.lower': {…} } nesnelerinde geçer; bu yüzden dosyadaki TÜM
     dizgi sabitleri toplanır. Şablonlardaki ${…} ÖNCE bir nişancıya
     çevrilir, SONRA kaçış uygulanır: ters sırada kaçan `$`, köşeli
     parantezi de kaçırıp hiçbir adı eşleştirmiyordu (ölçüldü). */
  const NISAN = '';
  const kalip = [...src.matchAll(/(['`])([A-Za-z0-9_.${}()\s]+?)\1/g)].map(m => m[2]);
  const regexler = kalip.map(k => new RegExp('^' + k
    .replace(/\$\{[^}]*\}/g, NISAN)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .split(NISAN).join('[A-Za-z0-9]+') + '$'));
  const uretilir = (ad) => regexler.some(r => r.test(ad));
  let eksik = [];
  for (const id of MECHANISM_IDS) for (const ad of MECHANISMS[id].joints) if (!uretilir(ad)) eksik.push(`${id}:${ad}`);
  check('dizindeki her eklem adı kurucuda üretiliyor', eksik.length === 0, eksik.length ? eksik.join(' ') : `${MECHANISM_IDS.length} mekanizma`);

  const zorunlu = ['craft', 'ad', 'tur', 'joints', 'iliski', 'neden', 'kanit', 'kapsam', 'odak'];
  const eksikAlan = [];
  for (const id of MECHANISM_IDS) for (const a of zorunlu) {
    const v = MECHANISMS[id][a];
    if (v == null || (Array.isArray(v) ? !v.length : String(v).trim() === '')) eksikAlan.push(`${id}.${a}`);
  }
  check('her mekanizma künyesi tam (tür, bağıntı, neden, kanıt, kapsam)', eksikAlan.length === 0, eksikAlan.join(' '));
  check('kimlikler benzersiz ve craft adları bilinen kurucular',
    new Set(MECHANISM_IDS).size === MECHANISM_IDS.length
    && MECHANISM_IDS.every(id => ['rover', 'lander', 'rocket', 'cubesat', 'capsule', 'orbiter', 'starship', 'marshelicopter'].includes(MECHANISMS[id].craft)));

  /* DOF rig haritasından TÜRETİLİR: iki eksenli gimbal 2, diğerleri 1. */
  const sahte = { joints: { 'a.tek': { node: 'a', axis: 'y', range: [0, 10] },
    'b.gimbal': { node: 'b', axis: ['y', 'z'], range: [-5, 5] },
    'c.strok': { node: 'c', mode: 'translate', dir: [1, 0, 0], range: [0, 0.08], oneWay: true } } };
  const r1 = resolveMechanism({ joints: ['a.tek', 'b.gimbal', 'c.strok'] }, sahte);
  check('DOF türetimi: tek eksen 1, gimbal 2, prizmatik 1 → 4', r1.dof === 4, String(r1.dof));
  const r2 = resolveMechanism({ joints: ['a.tek', 'yok.bu'] }, sahte);
  check('bulunamayan eklem DOF\'a sayılmaz ve eksik listesine girer',
    r2.dof === 1 && r2.eksik.length === 1 && r2.eksik[0] === 'yok.bu');
  check('sınır metni prizmatikte cm, dönerde derece, spin\'de serbest yazar',
    limitText(sahte.joints['c.strok']).includes('cm') && limitText(sahte.joints['a.tek']).includes('°')
    && limitText({ spin: true, rpm: 2400, spokes: 2 }).includes('serbest'));
}

console.log('\n(7 kol IK: henüz yok — plan §5.2, F3.)');
/* ── J) atılan gövdenin dönüş ekseni ─────────────────────────────────── */
console.log('== J atılan gövde tek eksen etrafında dönüyor');
{
  const J = await mod('presets/physical_rigs/jettison.mjs');
  const w = [0.31, -0.12, 0.47];                 // rad/s, üç bileşenli takla
  const q0 = [0, 0, 0, 1];

  /* Tork yoksa gövde TEK bir eksen etrafında döner. Bunu ölçmenin yolu:
     iki ayrı ana bakıp aradaki bağıl dönüşü çıkarmak. Ekseni omega'nın
     yönü olmak ZORUNDA, ve açısı |omega|*dt. Önceki sürüm qx, qy, qz'yi
     ayrı ayrı biriktirip sırayla uyguluyordu; o bileşim sıraya bağlıdır ve
     açı büyüdükçe görünen eksen kayar. */
  const carp = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const es = (q) => [-q[0], -q[1], -q[2], q[3]];
  const eksenAci = (q) => {
    const s2 = Math.hypot(q[0], q[1], q[2]);
    const aci = 2 * Math.atan2(s2, Math.abs(q[3]));
    const isaret = q[3] < 0 ? -1 : 1;
    return { aci, eksen: s2 > 1e-12 ? [isaret * q[0] / s2, isaret * q[1] / s2, isaret * q[2] / s2] : [0, 0, 1] };
  };
  const wLen = Math.hypot(w[0], w[1], w[2]);
  const wHat = [w[0] / wLen, w[1] / wLen, w[2] / wLen];

  /* Compared as ROTATIONS, not as extracted angles. Axis-angle extraction
     always returns an angle in [0, pi] with a possibly flipped axis, so on
     an interval longer than pi/|omega| it reports the short way round and
     the axis inverts - which is what the first version of this check did,
     and it failed a correct implementation with a deviation of exactly 2.0
     (a unit vector pointing the other way). The quaternion double cover is
     handled by accepting q or -q. */
  const beklenen = (dt) => {
    const half = wLen * dt / 2, sn = Math.sin(half) / wLen;
    return [w[0] * sn, w[1] * sn, w[2] * sn, Math.cos(half)];
  };
  const ciftOrtu = (a, b) => Math.min(
    Math.max(...a.map((v, i) => Math.abs(v - b[i]))),
    Math.max(...a.map((v, i) => Math.abs(v + b[i]))));
  let enKotu = 0;
  for (const [t1, t2] of [[0, 0.7], [0.7, 2.3], [2.3, 5.9], [5.9, 11.4]]) {
    const q1 = J.attitudeAt(q0, w, t1), q2 = J.attitudeAt(q0, w, t2);
    enKotu = Math.max(enKotu, ciftOrtu(carp(q2, es(q1)), beklenen(t2 - t1)));
  }
  check('her aralıkta bağıl dönüş = rot(omega-hat, |omega|·dt)', enKotu < 1e-12,
    `sapma ${enKotu.toExponential(1)}`);
  /* And on a short interval, where the extraction is unambiguous, the axis
     itself is checked so the statement is not only about quaternions. */
  {
    const { aci, eksen } = eksenAci(carp(J.attitudeAt(q0, w, 1.4), es(J.attitudeAt(q0, w, 0.6))));
    const sapma = Math.hypot(eksen[0] - wHat[0], eksen[1] - wHat[1], eksen[2] - wHat[2]);
    check('kısa aralıkta eksen doğrudan omega yönünde', sapma < 1e-9 && Math.abs(aci - wLen * 0.8) < 1e-9,
      `eksen sapması ${sapma.toExponential(1)} · açı ${aci.toFixed(4)} rad`);
  }
  check('birim kuaterniyon kalıyor',
    Math.abs(Math.hypot(...J.attitudeAt(q0, w, 37.2)) - 1) < 1e-12);
  check('t = 0 bırakma yönelimini değiştirmiyor',
    J.attitudeAt([0.2, 0.3, 0.1, 0.927], w, 0).every((v, i) => Math.abs(v - [0.2, 0.3, 0.1, 0.927][i]) < 1e-12));

  /* TERS SINAV: eski bileşim (Euler'leri sırayla uygula) aynı ölçütü
     geçemez. Geçseydi denetim bir şey söylemiyor olurdu. */
  const euler = (t) => {
    const cx = Math.cos(w[0] * t / 2), sx = Math.sin(w[0] * t / 2);
    const cy = Math.cos(w[1] * t / 2), sy = Math.sin(w[1] * t / 2);
    const cz = Math.cos(w[2] * t / 2), sz = Math.sin(w[2] * t / 2);
    const qx = [sx, 0, 0, cx], qy = [0, sy, 0, cy], qz = [0, 0, sz, cz];
    return carp(carp(qx, qy), qz);
  };
  let eskiSapma = 0;
  for (const [t1, t2] of [[0.7, 2.3], [2.3, 5.9]]) {
    const { eksen } = eksenAci(carp(euler(t2), es(euler(t1))));
    eskiSapma = Math.max(eskiSapma,
      Math.hypot(eksen[0] - wHat[0], eksen[1] - wHat[1], eksen[2] - wHat[2]));
  }
  check('TERS SINAV: sıralı Euler bileşimi ekseni kaydırıyor', eskiSapma > 0.05,
    `kayma ${eskiSapma.toFixed(3)}`);

  /* Adım adım integrasyon ile kapalı form aynı yönelimi vermeli. */
  const jt = J.createJettison({ gravity: [0, -1.62, 0] });
  const govde = jt.release(null, { position: [0, 0, 0], quaternion: q0, velocity: [1, 2, 0], omega: w, id: 'x' });
  const DT = 1 / 240;
  for (let i = 0; i < Math.round(3 / DT); i++) jt.advance(DT);
  const adimli = J.attitudeAt(govde.q0, govde.w, govde.age);
  const kapali = jt.poseAt(govde, 3).q4;
  const fark = Math.max(...adimli.map((v, i) => Math.abs(v - kapali[i])));
  check('adım adım ve kapalı form aynı yönelim', fark < 1e-9, `fark ${fark.toExponential(1)}`);
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
