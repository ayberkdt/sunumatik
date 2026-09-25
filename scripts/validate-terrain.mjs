#!/usr/bin/env node
/* validate-terrain.mjs — terrain_blocks yükseklik alanının bağımsız denetimi.
   Node'da three'siz çalışır (terrain-field / features DOM ve three bilmez).
   "Makul görünüyor" bir test değildir: her madde plan §9'daki ölçülebilir
   kritere karşı sınanır. CI bu dosyayı koşar.

   Kullanım: node scripts/validate-terrain.mjs [--json] */
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = rel => import(pathToFileURL(path.join(repoRoot, rel)).href);
const results = [];
const check = (group, name, ok, detail = '') => results.push({ group, name, ok: !!ok, detail });

const { PROFILES, PROFILE_IDS, buildProfile } = await mod('presets/terrain_blocks/profiles/index.mjs');
const { hashFloats, mulberry32 } = await mod('presets/terrain_blocks/terrain-noise.mjs');
const { createTerrainField, ANGLE_OF_REPOSE_DEG, BODY_RADIUS_UNITS } = await mod('presets/terrain_blocks/terrain-field.mjs');
const { dune, craterField, fbm } = await mod('presets/terrain_blocks/terrain-features.mjs');
const { buildHeightGrid, applySlopeClamp } = await mod('presets/terrain_blocks/terrain-mesh.mjs');

/* Örnekleme noktaları: log-düzgün yarıçap (2 m … 3 000 km), 4 096 nokta, tohumlu */
function samplePoints(seed, n = 4096) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = Math.exp(Math.log(.02) + rnd() * (Math.log(30000) - Math.log(.02)));
    const t = rnd() * Math.PI * 2;
    pts.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  return pts;
}

for (const id of PROFILE_IDS) {
  const g = `profile:${id}`;
  const t0 = performance.now();
  const { field } = buildProfile(id, 20260916);
  const buildMs = performance.now() - t0;
  const pts = samplePoints(7);
  const hs = pts.map(([x, z]) => field.height(x, z));

  /* 1 ── determinizm: aynı seed → aynı imza; farklı seed → farklı imza */
  const sig1 = hashFloats(hs);
  const sig2 = hashFloats(pts.map(([x, z]) => buildProfile(id, 20260916).field.height(x, z)));
  const sig3 = hashFloats(pts.map(([x, z]) => buildProfile(id, 20260917).field.height(x, z)));
  check(g, 'determinizm: aynı seed aynı yükseklik imzası (4 096 nokta)', sig1 === sig2, sig1);
  check(g, 'seed değişince alan değişir', sig1 !== sig3, sig3);

  /* 2 ── NaN/sonsuz yok; sagitta ufukta beklenen (±%1) */
  check(g, 'NaN/sonsuz yok', hs.every(Number.isFinite));
  const R = field.radiusUnits, d = 3000;
  const hSag = field.height(d, 0) - field.exaggeration * field.raw(d, 0);
  check(g, 'sagitta 300 km\'de −d²/2R (±1 %)', Math.abs(hSag + d * d / (2 * R)) < .01 * d * d / (2 * R), `${hSag.toFixed(1)} birim, R=${R}`);

  /* 3 ── kapılar: ped bölgesinde büyük biçimler bastırılmış (|h − h₀| < 2 cm = 0,0002 birim
         mikro kabartma hariç: ped kapısı yalnız 'large'/'small' katmanları kapatır) */
  let padMax = 0;
  for (let i = 0; i < 200; i++) {
    const a = i / 200 * Math.PI * 2, r = 1.8 * (i % 7) / 7;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    /* mikro katman hariç fark: raw − micro */
    const micro = field.layers.filter(L => L.tags.includes('micro')).reduce((s, L) => s + L.h(x, z), 0);
    padMax = Math.max(padMax, Math.abs(field.raw(x, z) - micro));
  }
  check(g, 'gezgin pedi (r ≤ 1,8): büyük/küçük biçimler |h| < 2 cm', padMax < .0002, `${(padMax * 100).toFixed(3)} m`);
  const corridor = field.clearings.find(c => c.type === 'corridor');
  let corrMax = 0;
  for (const seg of corridor.segs) for (let i = 0; i <= 30; i++) {
    const t = seg.L * i / 30, x = seg.ax + seg.ux * t, z = seg.az + seg.uz * t;
    for (const off of [-.4, 0, .4]) corrMax = Math.max(corrMax, field.slopeDeg(x - seg.uz * off, z + seg.ux * off));
  }
  check(g, `sürüş koridoru eğimi ≤ ${corridor.maxSlopeDeg}° (kapı tasarımıyla, şerit ±0,4)`, corrMax <= corridor.maxSlopeDeg + 1e-6, `${corrMax.toFixed(2)}°`);

  /* 4 ── eğim kırpma: örgü hücrelerinde regolit eğimi ≤ 36° (sert kaya muaf) */
  const grid = buildHeightGrid(field, { angular: 96, r0: .5, ratio: 1.12, rMax: 4000 });
  const clampStat = applySlopeClamp(field, grid, { maxSlopeDeg: ANGLE_OF_REPOSE_DEG });
  /* kırpma sonrası, iki ucu yumuşak (sert kaya değil) örgü kenarlarında en dik eğim */
  check(g, 'eğim kırpma: regolit kenarlarında örgü eğimi ≤ 36°', clampStat.maxSoftSlopeDeg <= 36, `${clampStat.maxSoftSlopeDeg.toFixed(1)}° (${clampStat.moved} düzeltme, ${clampStat.passes} geçiş)`);
  /* analitik alan örgüyle aynı yüzeyi görür: örgü tepesinde |h_alan − h_örgü| ≈ 0 */
  let maxDiff = 0;
  for (let k = 1; k < grid.count; k += 97) maxDiff = Math.max(maxDiff, Math.abs(field.height(grid.xs[k], grid.zs[k]) - grid.heights[k]));
  check(g, 'düzeltme geri yazıldı: analitik height() örgü tepeleriyle eşleşir (< 1 mm)', maxDiff < 1e-5, `${(maxDiff * 100).toFixed(4)} m`);

  /* 5 ── krater istatistiği: kümülatif N(>D) log-log eğimi −1,8…−2,2 (orta boy bandı) */
  /* Her halka kendi [Rmin, Rmax] bandında Pareto b=2 örneklenir; istatistik
     halka İÇİNDE, kesme (Rmax) etkisinin dışında [1,05·Rmin, 0,4·Rmax] bandında
     ölçülür. ~100 örnekle eğimin standart hatası ≈ 0,2 → kabul −1,6…−2,4. */
  const cf = field.layers.find(L => L.name === 'craterField')?.describe();
  if (cf && cf.craters.length > 40) {
    const byRing = new Map();
    for (const k of cf.craters) { if (!byRing.has(k.ring)) byRing.set(k.ring, []); byRing.get(k.ring).push(k.R); }
    const [ringIdx, Rs] = [...byRing.entries()].sort((p, q) => q[1].length - p[1].length)[0];
    const ring = cf.rings[ringIdx];
    const lo = ring.Rmin * 1.05, hi = ring.Rmax * .4;
    const xs = [], ys = [];
    for (let k = 0; k < 6; k++) { const D = lo * Math.pow(hi / lo, k / 5); const N = Rs.filter(r => r > D).length; if (N > 0) { xs.push(Math.log(D)); ys.push(Math.log(N)); } }
    const mx = xs.reduce((p, q) => p + q, 0) / xs.length, my = ys.reduce((p, q) => p + q, 0) / ys.length;
    const slope = xs.reduce((p, x, i) => p + (x - mx) * (ys[i] - my), 0) / xs.reduce((p, x) => p + (x - mx) ** 2, 0);
    if (Rs.length >= 100) check(g, 'krater boy dağılımı: N(>D) log-log eğimi −1,6…−2,4 (Pareto b = 2, halka içi, N ≥ 100)', slope < -1.6 && slope > -2.4, `${slope.toFixed(2)} (halka ${ringIdx}, ${Rs.length} krater)`);
    else check(g, 'krater boy dağılımı: küçük örneklem (N < 100) — üreteç aşağıda büyük N ile sınanır', true, `${slope.toFixed(2)} (halka ${ringIdx}, ${Rs.length} krater)`);
  }

  /* 6 ── kurulum bütçesi (yalnız alan; örgü tarayıcıda ölçülür) */
  check(g, 'alan kurulumu < 150 ms (Node)', buildMs < 150, `${buildMs.toFixed(0)} ms`);
  check(g, 'exaggeration = 1 (abartı ilanı yok)', field.exaggeration === 1 && field.describe().exaggerationDeclared === null);
}

/* 7 ── profil kısıtları: Ay profilinde kumul reddedilir */
{
  let threw = false;
  try { createTerrainField({ seed: 1, planet: 'moon', layers: [dune({ seed: 1 })] }); } catch (e) { threw = /dune/.test(e.message); }
  check('constraints', 'Ay profilinde `dune` katmanı reddedilir (atmosfer yok)', threw);
  check('constraints', 'cisim yarıçapları: Ay 17 374, Mars 33 895 birim (1 birim = 100 m)', BODY_RADIUS_UNITS.moon === 17374 && BODY_RADIUS_UNITS.mars === 33895);
  const ex = createTerrainField({ seed: 3, planet: 'moon', layers: [fbm({ seed: 3 })], exaggeration: 2 });
  check('constraints', 'exaggeration ≠ 1 describe() ile İLAN edilir', /ABARTILI/.test(ex.describe().exaggerationDeclared || ''));
  /* krater ÜRETECİ büyük N ile: kümülatif boy dağılımı log-log eğimi −2 (±0,15) */
  {
    const big = craterField({ seed: 11, rings: [{ r0: 100, r1: 5000, Rmin: 1, Rmax: 100, count: 20000 }] });
    const Rs = big.describe().craters.map(k => k.R);
    const xs = [], ys = [];
    for (let k = 0; k < 8; k++) { const D = 1.05 * Math.pow(40 / 1.05, k / 7); const N = Rs.filter(r => r > D).length; xs.push(Math.log(D)); ys.push(Math.log(N)); }
    const mx = xs.reduce((p, q) => p + q, 0) / xs.length, my = ys.reduce((p, q) => p + q, 0) / ys.length;
    const slope = xs.reduce((p, x, i) => p + (x - mx) * (ys[i] - my), 0) / xs.reduce((p, x) => p + (x - mx) ** 2, 0);
    check('constraints', 'krater üreteci (N = 20 000): N(>D) ∝ D^−2, log-log eğimi −2 ± 0,15', Math.abs(slope + 2) < .15, slope.toFixed(3));
  }
  /* karmaşık krater: merkez tepe tabanın üstünde, kenar dışın üstünde */
  const cf = craterField({ seed: 5, rings: [{ r0: 200, r1: 201, Rmin: 100, Rmax: 100, count: 1 }], complexAbove: 75 });
  const k = cf.describe().craters[0];
  const center = cf.h(k.x, k.z), floor = cf.h(k.x + k.R * .3, k.z), rim = cf.h(k.x + k.R, k.z), outside = cf.h(k.x + k.R * 3, k.z);
  check('constraints', 'karmaşık krater: merkez tepe > düz taban, kenar > dış', k.complex && center > floor && rim > outside, `merkez ${center.toFixed(2)} taban ${floor.toFixed(2)} kenar ${rim.toFixed(2)}`);
}

/* rapor */
const failed = results.filter(r => !r.ok);
if (process.argv.includes('--json')) console.log(JSON.stringify({ results, failed: failed.length }, null, 2));
else {
  let group = '';
  for (const r of results) {
    if (r.group !== group) { group = r.group; console.log(`\n== ${group}`); }
    console.log(`${r.ok ? '  ok ' : ' FAIL'} ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} geçti`);
}
process.exit(failed.length ? 1 : 0);
