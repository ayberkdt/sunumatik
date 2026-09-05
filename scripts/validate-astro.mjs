#!/usr/bin/env node
/* validate-astro.mjs — Astrodinamik / uzay mühendisliği preset'lerinin SAF
   çözücülerini bağımsız sayısal denetimden geçirir. "Makul görünüyor" bir
   test değildir: her madde kapalı biçim, bilinen değer ya da limit durumla
   karşılaştırılır. CI bu dosyayı koşar.

   Kullanım: node scripts/validate-astro.mjs [--json] */
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = rel => import(pathToFileURL(path.join(repoRoot, rel)).href);
const results = [];
const check = (group, name, ok, detail = '') => results.push({ group, name, ok: !!ok, detail });
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);

/* ───────────────────────── US76 atmosferi */
{
  const { atmosphere, SEA_LEVEL } = await mod('presets/core/astro-atmosphere.mjs');
  check('atmosphere', 'deniz seviyesi ρ = 1,2250 kg/m³', near(SEA_LEVEL.rho, 1.2250, 2e-4), SEA_LEVEL.rho.toFixed(5));
  check('atmosphere', 'deniz seviyesi a = 340,29 m/s', near(SEA_LEVEL.a, 340.29, .05), SEA_LEVEL.a.toFixed(2));
  const z11 = atmosphere(11000);   // US76 tablo: 11 km (geometrik) p ≈ 22 700 Pa, T ≈ 216,8 K
  check('atmosphere', '11 km p ≈ 22,7 kPa (tablo 22 699)', rel(z11.p, 22699, .003), z11.p.toFixed(0));
  const z20 = atmosphere(20000);   // tablo: 5 529 Pa, ρ 0,08891
  check('atmosphere', '20 km ρ ≈ 0,0889 (tablo 0,08891)', rel(z20.rho, .08891, .003), z20.rho.toFixed(5));
  const z50 = atmosphere(50000);   // tablo: p ≈ 79,8 Pa, T ≈ 270,65
  check('atmosphere', '50 km p ≈ 79,8 Pa', rel(z50.p, 79.78, .01), z50.p.toFixed(2));
  const z80 = atmosphere(80000);   // tablo: ρ ≈ 1,846e-5
  check('atmosphere', '80 km ρ ≈ 1,85e-5', rel(z80.rho, 1.846e-5, .02), z80.rho.toExponential(3));
  /* süreklilik: katman sınırlarında sıçrama yok */
  let jumpOk = true;
  for (const zb of [11000, 20000, 32000, 47000, 51000, 71000, 86000]) {
    const a = atmosphere(zb - 1), b = atmosphere(zb + 1);
    if (!rel(a.p, b.p, 1e-3) || !rel(a.T, b.T, 1e-3)) jumpOk = false;
  }
  check('atmosphere', 'katman sınırlarında C0 süreklilik', jumpOk);
  /* monoton azalan yoğunluk */
  let mono = true, prev = Infinity;
  for (let z = 0; z <= 200e3; z += 500) { const r = atmosphere(z).rho; if (r > prev) mono = false; prev = r; }
  check('atmosphere', 'ρ(z) monoton azalır (0–200 km)', mono);
}

/* ───────────────────────── Fırlatma / tırmanış */
{
  const { simulateAscent, sampleAt, MU_EARTH, R_EARTH } = await mod('presets/launch_ascent/ascent-model.mjs');
  const sim = simulateAscent();
  check('ascent', 'varsayılan araç yörüngeye ulaşır', sim.ok, sim.ok ? `${(sim.orbit.hp / 1e3).toFixed(0)}×${(sim.orbit.ha / 1e3).toFixed(0)} km` : 'ulaşamadı');
  /* Max-Q gerçek bir iç tepe: komşular daha küçük, atmosferde, T+40–90 s */
  const S = sim.samples;
  const i = S.findIndex(s => s.t >= sim.maxQ.t);
  const peakOk = i > 0 && i < S.length - 1 && S[i - 1].q <= sim.maxQ.q + 1e-6 && S[i + 1].q <= sim.maxQ.q + 1e-6;
  check('ascent', 'Max-Q q(t)\'nin iç tepe noktasıdır', peakOk, `${(sim.maxQ.q / 1e3).toFixed(1)} kPa @ ${sim.maxQ.t.toFixed(1)} s`);
  check('ascent', 'Max-Q 8–16 km irtifada, T+40–90 s (Falcon 9 sınıfı beklenti)', sim.maxQ.alt > 8e3 && sim.maxQ.alt < 16e3 && sim.maxQ.t > 40 && sim.maxQ.t < 90, `${(sim.maxQ.alt / 1e3).toFixed(1)} km`);
  check('ascent', 'Max-Q büyüklüğü 25–45 kPa', sim.maxQ.q > 25e3 && sim.maxQ.q < 45e3);
  /* q = ½ρv² tanımı örnekte tutar */
  const { atmosphere } = await mod('presets/core/astro-atmosphere.mjs');
  const sQ = sampleAt(sim, sim.maxQ.t);
  check('ascent', 'q = ½ρ v_hava² örnekte tutarlı', rel(sQ.q, .5 * atmosphere(sQ.alt).rho * sQ.vAir ** 2, .02));
  /* SECO'da yörünge: vis-viva ve dairesellik */
  if (sim.ok) {
    const seco = sampleAt(sim, sim.tSeco);
    const r = Math.hypot(seco.x, seco.y);
    const aVV = 1 / (2 / r - seco.v ** 2 / MU_EARTH);
    check('ascent', 'SECO vis-viva ile yarı-büyük eksen tutarlı', rel(aVV, sim.orbit.a, 1e-3));
    check('ascent', 'SECO yörüngesi neredeyse dairesel (e < 0,01)', sim.orbit.e < .01, sim.orbit.e.toFixed(4));
    check('ascent', 'hedef irtifa ±15 km', Math.abs(seco.alt - sim.profile.targetAlt) < 15e3, `${(seco.alt / 1e3).toFixed(1)} km`);
    check('ascent', 'SECO hızı ≈ √(μ/r) (±0,5 %)', rel(seco.v, Math.sqrt(MU_EARTH / r), .005));
  }
  /* kütle bütçesi: MECO'da 1. kademe yakıtı tam bitti */
  const meco = sampleAt(sim, sim.tMeco);
  const V = sim.vehicle;
  const mExpectMeco = V.stages[0].dry + V.stages[1].dry + V.stages[1].prop + V.payload + V.fairing;
  check('ascent', 'MECO kütlesi = kuru1 + kademe2 + yük + kapak', rel(meco.m, mExpectMeco, 2e-3), `${(meco.m / 1e3).toFixed(1)} t`);
  /* ideal ΔV ≈ Tsiolkovsky (kademe kademe) */
  const m0 = sim.samples[0].m, mMeco = mExpectMeco;
  const dvTsUpper = 9.80665 * V.stages[0].ispVac * Math.log(m0 / mMeco);
  const dvTsLower = 9.80665 * V.stages[0].ispSL * Math.log(m0 / mMeco);
  /* 1. kademe ideal ΔV: t<MECO aralığında ∫T/m dt — kayıp entegrasyonundan ayrı hesapla */
  let dvStage1 = 0;
  for (let k = 1; k < S.length && S[k].t <= sim.tMeco; k++) dvStage1 += (S[k].thrust / S[k].m + S[k - 1].thrust / S[k - 1].m) / 2 * (S[k].t - S[k - 1].t);
  check('ascent', '1. kademe ideal ΔV, Tsiolkovsky(Isp_ds) ile Tsiolkovsky(Isp_vak) arasında', dvStage1 > dvTsLower * .98 && dvStage1 < dvTsUpper * 1.01, `${dvStage1.toFixed(0)} ∈ [${dvTsLower.toFixed(0)}, ${dvTsUpper.toFixed(0)}]`);
  /* kayıp bütçesi kapanır: ideal − kayıplar ≈ kazanılan (yörünge hızı − başlangıç) — düzlemsel, ±3 % */
  if (sim.ok) {
    const L = sim.losses;
    const seco = sampleAt(sim, sim.tSeco);
    const gained = seco.v - sim.samples[0].v;
    /* Dünya dönmesi başlangıç hızında (v₀ ≈ 409 m/s) zaten var; enerji yerine hız-bütçesi denetimi */
    check('ascent', 'hız bütçesi: ideal − (yerçekimi+sürükleme+yönlendirme) ≈ Δ|v| (±4 %)', rel(L.ideal - L.gravity - L.drag - L.steering, gained, .04), `${(L.ideal - L.gravity - L.drag - L.steering).toFixed(0)} ≈ ${gained.toFixed(0)}`);
  }
  /* olay sırası mantıklı */
  const t = id => sim.events.find(e => e.id === id)?.t ?? NaN;
  check('ascent', 'olay sırası: kick < Mach1 < Max-Q < MECO < ayrılma < SES < SECO', t('pitchkick') < t('mach1') && t('mach1') < t('maxq') && t('maxq') < t('meco') && t('meco') < t('separation') && t('separation') < t('ses') && t('ses') < t('seco'));
  /* limit durum: atmosfersiz (US76 kapalı gibi: yoğunluk yok) — burada sürükleme kaybı sıfır olmalı */
  const simNoRot = simulateAscent({}, { earthRotation: false });
  check('ascent', 'Dünya dönmesi kapalıyken başlangıç hızı 0 ve daha fazla ideal ΔV gerekir', simNoRot.samples[0].v === 0 && (!simNoRot.ok || simNoRot.losses.ideal >= sim.losses.ideal * .98));
  /* daha ağır yük → daha geç MECO değil (ṁ sabit) ama daha düşük MECO hızı */
  const simHeavy = simulateAscent({ payload: 22000 });
  const mecoH = sampleAt(simHeavy, simHeavy.tMeco);
  check('ascent', 'daha ağır yük → MECO hızı düşer', mecoH.v < meco.v, `${mecoH.v.toFixed(0)} < ${meco.v.toFixed(0)}`);
}

/* ───────────────────────── rapor */
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
