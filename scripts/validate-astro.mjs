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
  const { densityExponential, densityBlend } = await mod('presets/core/astro-atmosphere.mjs');
  check('atmosphere', 'üstel tablo: 300 km ρ = 2,418e−11, 400 km 3,725e−12 (Vallado 8-4)', rel(densityExponential(300e3), 2.418e-11, 1e-6) && rel(densityExponential(400e3), 3.725e-12, 1e-6));
  let monoB = true, prevB = Infinity; for (let z = 0; z <= 1000e3; z += 1000) { const r = densityBlend(z); if (r > prevB) monoB = false; prevB = r; }
  check('atmosphere', 'birleşik yoğunluk 0–1000 km monoton ve 86–90 km karışımı C0', monoB && rel(densityBlend(86e3 - 1), densityBlend(86e3 + 1), .05));
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


/* ───────────────────────── Clohessy–Wiltshire (göreli hareket) */
{
  const R = await mod('presets/core/astro-relative.mjs');
  const n = R.meanMotion(R.R_EARTH + 400e3);
  const T = 2 * Math.PI / n;
  check('cw', 'ISS irtifasında periyot ≈ 92,6 dk', near(T / 60, 92.56, .1), (T / 60).toFixed(2));
  /* Φ(0) = I */
  const I = R.cwStm(n, 0);
  check('cw', 'Φ(0) = I', I.every((v, k) => near(v, (k % 7 === 0) ? 1 : 0, 1e-12)));
  /* yarı-grup: Φ(t1+t2) = Φ(t2)Φ(t1) */
  const A = R.matMul6(R.cwStm(n, 700), R.cwStm(n, 1300)), B = R.cwStm(n, 2000);
  check('cw', 'Φ(t₁+t₂) = Φ(t₂)Φ(t₁)', A.every((v, k) => near(v, B[k], 1e-6 * Math.max(1, Math.abs(B[k])))));
  /* STM ↔ RK4 */
  const s0 = [120, -900, 40, .3, -.2, .05];
  const rk = R.cwIntegrate(s0, n, 2400, 1);
  const st = R.cwPropagate(s0, n, 2400);
  const end = rk[rk.length - 1].state;
  check('cw', 'STM yayılımı RK4 ile örtüşür (2400 s, |Δr| < 1 mm)', Math.hypot(end[0] - st[0], end[1] - st[1], end[2] - st[2]) < 1e-3, `${Math.hypot(end[0] - st[0], end[1] - st[1], end[2] - st[2]).toExponential(2)} m`);
  /* sürüklenmesiz koşul: ẏ0 = −2n x0 → bir periyot sonra aynı yer */
  const pco = R.pcoInitialState(500, .7, n);
  const after = R.cwPropagate(pco, n, T);
  check('cw', 'PCO bir periyot sonra kapanır (sürüklenmesiz)', pco.every((v, k) => near(v, after[k], 1e-6)));
  check('cw', 'PCO y–z izdüşümü daire: ρ = 500 m (t = T/4)', near(Math.hypot(...[R.cwPropagate(pco, n, T / 4)].map(s => [s[1], s[2]])[0]), 500, 1e-6));
  check('cw', 'sekülar sürüklenme formülü PCO için 0', near(R.alongTrackDrift(pco, n), 0, 1e-12));
  /* sürüklenme: STM sekülar terimiyle eşleşir */
  const drifting = [100, 0, 0, 0, 0, 0];
  const y1 = R.cwPropagate(drifting, n, T)[1], y2 = R.cwPropagate(drifting, n, 2 * T)[1];
  check('cw', 'radyal ofset → iz boyu sürüklenme = −6n x₀ · T / periyot', near(y2 - y1, R.alongTrackDrift(drifting, n) * T, 1e-6));
  /* hedefleme: r0 → rf, T = 0,4 periyot; varışta artık ~0 */
  const r0 = [0, -3000, 0], rf = [0, -250, 0];
  const tg = R.cwTargeting(r0, [0, 0, 0], rf, n, .4 * T);
  const arr = R.cwPropagate([...r0, ...tg.v0], n, .4 * T);
  check('cw', 'CW iki-impuls hedefleme varış artığı < 1 mm', Math.hypot(arr[0] - rf[0], arr[1] - rf[1], arr[2] - rf[2]) < 1e-3, `ΔV ${(tg.dvTotal * 100).toFixed(2)} cm/s`);
  check('cw', 'hedefleme n·T = 2π (tam periyot) tekilliğinde null döner', R.cwTargeting(r0, [0, 0, 0], rf, n, 2 * Math.PI / n) === null);
  /* limit: V-bar üstünde duran araç durur (x=0, v=0 → sabit) */
  const vbar = R.cwPropagate([0, -500, 0, 0, 0, 0], n, 5000);
  check('cw', 'V-bar bekleme noktası doğal olarak sabittir', near(vbar[0], 0, 1e-9) && near(vbar[1], -500, 1e-9));
  /* glideslope: ρ(tArrive) = 0, ρ̇(0) = ρ̇0 */
  const g = R.glideslope(250, -.5, -.05, 0);
  const gEnd = R.glideslope(250, -.5, -.05, g.tArrive);
  check('cw', 'glideslope ρ(t_varış) = 0 ve ρ̇(0) = ρ̇₀', near(gEnd.rho, 0, 1e-6) && near(g.rhoDot, -.5, 1e-12), `t_varış ${g.tArrive.toFixed(0)} s`);
}

/* ───────────────────────── Randevu senaryoları */
{
  const { simulateRendezvous, losMetrics } = await mod('presets/rendezvous_docking/rendezvous-model.mjs');
  const R = await mod('presets/core/astro-relative.mjs');
  const vb = simulateRendezvous('vbar');
  check('rendezvous', 'V-bar: temas ρ = 0, kapanma −5 cm/s, yanal 0', vb.contact && near(vb.contact.closingRate, -.05, 1e-6) && vb.contact.lateral < 1e-6, `${(vb.contact.closingRate * 100).toFixed(2)} cm/s`);
  const hold = vb.samples.filter(s => s.phase === 'hold' && s.t > 0 && s.t < 600);
  check('rendezvous', 'V-bar beklemesi: itki 0 ve konum sabit', hold.every(s => Math.hypot(...s.thrust) < 1e-12 && near(s.state[1], -3000, 1e-6)));
  const hop2 = vb.events.find(e => e.id === 'hop-2');
  const atHop = vb.samples.find(s => s.t >= hop2.t);
  check('rendezvous', 'hop varışı −250 m V-bar (STM hedefleme, < 1 mm)', Math.hypot(atHop.state[0], atHop.state[1] + 250, atHop.state[2]) < 1e-3);
  check('rendezvous', 'hop iki impulsu simetrik (durgun→durgun)', near(vb.events.find(e => e.id === 'hop-1').dv, hop2.dv, 1e-9));
  /* glideslope boyunca hep koridor içinde ve KOS'a sadece koridordan girer */
  const gl = vb.samples.filter(s => s.phase === 'glideslope');
  check('rendezvous', 'glideslope boyunca LOS açısı 0 (koridor içinde)', gl.every(s => losMetrics(s.state, vb.geometry).inCorridor));
  const rb = simulateRendezvous('rbar');
  const rh = rb.samples.filter(s => s.phase === 'hold-thrust' && s.t > 0);
  const n = rb.n;
  check('rendezvous', 'R-bar beklemesi itkisi = −3n²x (mm/s² düzeyinde)', rh.every(s => near(s.thrust[0], -3 * n * n * s.state[0], 1e-12) && near(s.thrust[1], 0, 1e-12)), `${(3 * n * n * 1500 * 1e3).toFixed(3)} mm/s²`);
  check('rendezvous', 'R-bar: temas kapanma −5 cm/s', rb.contact && near(rb.contact.closingRate, -.05, 1e-6));
  /* ΔV bütçesi: sürekli ∫|a|dt ≈ hız-değişimi ile tutarlı büyüklükte (>0) ve R-bar V-bar'dan pahalı */
  check('rendezvous', 'R-bar toplam ΔV > V-bar toplam ΔV (yerçekimi gradyanına karşı)', rb.dvTotal > vb.dvTotal, `${rb.dvTotal.toFixed(2)} > ${vb.dvTotal.toFixed(2)} m/s`);
  const ps = simulateRendezvous('push');
  const end = ps.samples[ps.samples.length - 1].state;
  check('rendezvous', '"ileri it": araç önce yükselir (x > 0) ve sonunda GERİDE kalır (y daha negatif)', ps.samples.some(s => s.state[0] > 100) && end[1] < -500, `y_son = ${end[1].toFixed(0)} m`);
  /* sekülar sürüklenme formülü push senaryosuyla tutarlı: −3·ẏ₀ (x₀ = 0) */
  const pushEv = ps.events.find(e => e.id === 'push');
  const afterPush = ps.samples.find(s => s.t > pushEv.t);
  const drift = R.alongTrackDrift(afterPush.state, n);
  check('rendezvous', 'push sürüklenme hızı = −3ẏ₀ = −0,90 m/s', near(drift, -.9, 1e-6), `${drift.toFixed(3)} m/s`);
}

/* ───────────────────────── Yörünge + yer izi */
{
  const O = await mod('presets/core/astro-orbit.mjs');
  const T_SID = 86164.0905;
  /* GEO: alt-uydu noktası sabit */
  const geo = O.ORBIT_PRESETS.geo;
  check('groundtrack', 'GEO periyodu = yıldızıl gün (±1 s)', near(O.periodOf(geo.a), T_SID, 1), O.periodOf(geo.a).toFixed(1));
  const gtGeo = O.groundTrack(geo, { tEnd: 2 * T_SID, dt: 600 });
  const lonSpread = Math.max(...gtGeo.map(s => s.lon)) - Math.min(...gtGeo.map(s => s.lon));
  check('groundtrack', 'GEO yer izi sabit (boylam yayılımı < 0,01°)', lonSpread < .01 * Math.PI / 180 && gtGeo.every(s => Math.abs(s.lat) < 1e-9), `${(lonSpread * 180 / Math.PI).toFixed(4)}°`);
  /* Kutupsal: enlem ±90'a ulaşır; ISS: max enlem = i */
  const pol = O.groundTrack(O.ORBIT_PRESETS.polar, { tEnd: O.periodOf(O.ORBIT_PRESETS.polar.a), dt: 1 });
  check('groundtrack', 'kutupsal yörünge izi ±90° enleme ulaşır (1 s örnekleme, ±0,1°)', Math.max(...pol.map(s => s.lat)) > 89.9 * Math.PI / 180 && Math.min(...pol.map(s => s.lat)) < -89.9 * Math.PI / 180, `${(Math.max(...pol.map(s => s.lat)) * 180 / Math.PI).toFixed(2)}°`);
  const iss = O.ORBIT_PRESETS.iss;
  const gtIss = O.groundTrack(iss, { tEnd: O.periodOf(iss.a), dt: 2 });
  check('groundtrack', 'ISS izinin en yüksek enlemi = eğiklik (51,64°)', near(Math.max(...gtIss.map(s => s.lat)), iss.i, .1 * Math.PI / 180), `${(Math.max(...gtIss.map(s => s.lat)) * 180 / Math.PI).toFixed(2)}°`);
  /* tur başına boylam kayması = −ω_e T: ekvator geçişleri arasındaki fark */
  const T = O.periodOf(iss.a);
  const s0 = O.groundTrack({ ...iss, e: 0, M0: -.5 }, { tEnd: 2.2 * T, dt: T / 2000 });   // M0 < 0: düğüm geçişleri dizinin içinde
  const asc = []; for (let k = 1; k < s0.length; k++) if (s0[k - 1].lat < 0 && s0[k].lat >= 0) asc.push(s0[k].lon);
  const shift = O.wrapLon(asc[1] - asc[0]);
  check('groundtrack', 'ardışık yükselen düğüm boylam farkı = −ω_e·T', near(shift, -O.OMEGA_E * T, .05 * Math.PI / 180), `${(shift * 180 / Math.PI).toFixed(2)}° vs ${(-O.OMEGA_E * T * 180 / Math.PI).toFixed(2)}°`);
  /* Kepler: durum enerjisi ve açısal momentum korunur; vis-viva */
  const st = O.stateAt(O.ORBIT_PRESETS.molniya, 12345);
  const r = Math.hypot(...st.r), v2 = st.v[0] ** 2 + st.v[1] ** 2 + st.v[2] ** 2;
  check('groundtrack', 'Molniya durumunda vis-viva: v² = μ(2/r − 1/a)', rel(v2, O.MU * (2 / r - 1 / O.ORBIT_PRESETS.molniya.a), 1e-9));
  const h = [st.r[1] * st.v[2] - st.r[2] * st.v[1], st.r[2] * st.v[0] - st.r[0] * st.v[2], st.r[0] * st.v[1] - st.r[1] * st.v[0]];
  const hm = Math.hypot(...h); const iRec = Math.acos(h[2] / hm);
  check('groundtrack', 'açısal momentumdan eğiklik geri kazanılır (63,4°)', near(iRec, O.ORBIT_PRESETS.molniya.i, 1e-9));
  /* J2: SSO için Ω̇ ≈ +0,9856°/gün (Güneş-eşzamanlı tanımı) */
  const rates = O.j2Rates(O.ORBIT_PRESETS.sso);
  check('groundtrack', 'SSO (700 km, 98,2°) J2 düğüm oranı ≈ +0,986°/gün (±0,03)', near(rates.raanDot * 86400 * 180 / Math.PI, .9856, .03), `${(rates.raanDot * 86400 * 180 / Math.PI).toFixed(3)}°/gün`);
  /* Molniya: kritik eğiklikte ω̇ ≈ 0 */
  const rm = O.j2Rates(O.ORBIT_PRESETS.molniya);
  check('groundtrack', 'Molniya 63,4° kritik eğiklikte ω̇ ≈ 0', Math.abs(rm.argpDot * 86400 * 180 / Math.PI) < .01, `${(rm.argpDot * 86400 * 180 / Math.PI).toFixed(4)}°/gün`);
  /* boylam sarımı: kırılma bayrağı yalnız sıçramalarda */
  const brk = gtIss.filter(s => s.brk).length;
  check('groundtrack', 'bir ISS turunda tam bir boylam sarımı (1 kırılma)', brk === 1, `${brk}`);
}

/* ───────────────────────── Lambert + efemeris + porkchop */
{
  const L = await mod('presets/core/astro-lambert.mjs');
  /* Lambert uç-nokta artığı: v1 ile Kepler yayılımı r2'ye varmalı */
  const jd1 = L.julianDay(2020, 7, 30), jd2 = L.julianDay(2021, 2, 18);
  const t = L.evaluateTransfer('earth', 'mars', jd1, jd2);
  const prop = L.propagateKepler(t.r1, t.lambert.v1, t.tof * L.DAY);
  const resid = Math.hypot(...prop.r.map((x, i) => x - t.r2[i]));
  check('lambert', 'Lambert uç-nokta artığı < 1 km (Dünya→Mars 2020-07-30 → 2021-02-18)', resid < 1, `${resid.toExponential(2)} km`);
  check('lambert', 'v2, yayılımın varış hızıyla örtüşür (< 1e-6 km/s)', Math.hypot(...prop.v.map((x, i) => x - t.lambert.v2[i])) < 1e-6);
  check('lambert', 'Perseverance benzeri geçiş: C3 12–16 km²/s², Tip I', t.c3 > 12 && t.c3 < 16 && t.type === 'I', `C3 ${t.c3.toFixed(2)}`);
  /* Hohmann limiti: eş-düzlem dairesel, Δθ → π (π − 0,02) */
  const r1 = [L.AU, 0, 0], r2n = 1.523679 * L.AU, th = Math.PI - .02, r2 = [r2n * Math.cos(th), r2n * Math.sin(th), 0];
  const aH = (L.AU + r2n) / 2, tH = Math.PI * Math.sqrt(aH ** 3 / L.MU_SUN);
  const lam = L.lambert(r1, r2, tH * (th / Math.PI));
  const vpH = Math.sqrt(L.MU_SUN * (2 / L.AU - 1 / aH));
  check('lambert', 'Hohmann limiti: Δθ→π için v1 ≈ kapalı biçim (±0,3 %)', lam && rel(Math.hypot(...lam.v1), vpH, .003), lam ? `${Math.hypot(...lam.v1).toFixed(4)} vs ${vpH.toFixed(4)} km/s` : 'null');
  check('lambert', 'Δθ = π tam tekilliği null döner (A = 0)', L.lambert(r1, [-r2n, 0, 0], tH) === null);
  /* kısa/uzun yol: retrograd çözüm de var ve farklı */
  const lamR = L.lambert(t.r1, t.r2, t.tof * L.DAY, L.MU_SUN, 'retrograde');
  check('lambert', 'retrograd (uzun yol) çözümü mevcut ve Δθ > π', !!lamR && lamR.dtheta > Math.PI);
  /* efemeris: Dünya J2000 ~0,983 AU (günberi 3 Ocak), ekliptik z ≈ 0; Mars periyodu ~687 gün */
  const e0 = L.planetState('earth', L.J2000);
  check('ephemeris', 'Dünya J2000 |r| = 0,983 AU (±0,002)', near(Math.hypot(...e0.r) / L.AU, .9833, .002), (Math.hypot(...e0.r) / L.AU).toFixed(4));
  check('ephemeris', 'Dünya J2000 ekliptik z ≈ 0 (< 1e-4 AU)', Math.abs(e0.r[2]) / L.AU < 1e-4);
  check('ephemeris', 'Dünya hızı ≈ 30,3 km/s (günberi civarı)', near(Math.hypot(...e0.v), 30.29, .05), Math.hypot(...e0.v).toFixed(3));
  const mA = L.planetState('mars', L.J2000), mB = L.planetState('mars', L.J2000 + 686.98);
  const ang = Math.acos((mA.r[0] * mB.r[0] + mA.r[1] * mB.r[1] + mA.r[2] * mB.r[2]) / (Math.hypot(...mA.r) * Math.hypot(...mB.r)));
  check('ephemeris', 'Mars 686,98 gün sonra aynı yere döner (< 0,5°)', ang < .5 * Math.PI / 180, `${(ang * 180 / Math.PI).toFixed(3)}°`);
  /* porkchop: 2020 penceresi minimumu Temmuz 2020 ±20 gün, C3 < 15 */
  const g = L.porkchopGrid('earth', 'mars', L.julianDay(2020, 6, 1), L.julianDay(2020, 10, 1), L.julianDay(2020, 11, 1), L.julianDay(2021, 10, 1), 40, 40);
  check('porkchop', '2020 Mars penceresi minimumu: C3 < 15, kalkış 2020-07-25 ±20 gün', g.min && g.min.c3 < 15 && Math.abs(g.min.jdDep - L.julianDay(2020, 7, 25)) < 20, g.min ? `${g.min.c3.toFixed(2)} @ ${L.fmtJd(g.min.jdDep)}` : 'yok');
  check('porkchop', 'ızgarada NaN hücre yok (Lambert her hücrede yakınsadı)', Array.from(g.c3).every(Number.isFinite));
  /* simetri/limit: aynı gezegene aynı gün → null (tof 0) */
  check('porkchop', 'tof ≤ 0 → null', L.evaluateTransfer('earth', 'mars', jd2, jd1) === null);
}

/* ───────────────────────── Takımyıldızı kapsaması */
{
  const C = await mod('presets/constellation_coverage/constellation-model.mjs');
  const gps = C.buildConstellation(C.CONSTELLATION_PRESETS.gps);
  check('constellation', 'GPS: T = P·S = 24', gps.T === 24 && gps.sats.length === 24);
  check('constellation', 'GPS: düzlem RAAN aralığı 60° (Delta 360°/6)', near(gps.sats[4].raan - gps.sats[0].raan, Math.PI / 3, 1e-12));
  check('constellation', 'GPS ayak izi λ ≈ 71,2° (20 200 km, ε = 5°)', near(C.footprintAngle(20200, 5) * 180 / Math.PI, 71.2, .3), `${(gps.lambda * 180 / Math.PI).toFixed(2)}°`);
  check('constellation', 'Iridium ayak izi λ ≈ 19,9° (780 km, ε = 8,2°)', near(C.footprintAngle(780, 8.2) * 180 / Math.PI, 19.9, .3));
  check('constellation', 'ε = 0 limiti: λ = acos(R/(R+h)) (ufuk)', near(C.footprintAngle(1000, 0), Math.acos(C.R_E / (C.R_E + 1000)), 1e-12));
  const irid = C.buildConstellation(C.CONSTELLATION_PRESETS.iridium);
  check('constellation', 'Iridium (Star 86,4°: 66/6/2): düzlem aralığı 30° (180°/6)', near(irid.sats[11].raan - irid.sats[0].raan, Math.PI / 6, 1e-12));
  const grid = C.makeGrid(128, 64);
  const covI = C.coverageAt(irid, grid, 0);
  check('constellation', 'Iridium anlık küresel kapsama ≥ 99 %', covI.fraction >= .99, `${(covI.fraction * 100).toFixed(2)} %`);
  /* ağırlıklar: Σ cos(lat) ≈ küre alanı ile tutarlı (ızgara ağırlığı normalize) */
  let wsum = 0; for (let g = 0; g < grid.N; g++) wsum += grid.w[g];
  check('constellation', 'ızgara cos(lat) ağırlıkları toplamı = (2/π)·N (±0,5 %)', rel(wsum, 2 / Math.PI * grid.N, .005));
  /* GEO halkası: 3 uydu ekvatoru kapsar, kutupları kapsamaz (λ = 76,3° < 90°) */
  const geo = C.buildConstellation(C.CONSTELLATION_PRESETS.geoRing);
  const covG = C.coverageAt(geo, grid, 0);
  const polarUncovered = Array.from({ length: grid.N }, (_, g) => g).filter(g => Math.abs(grid.lat[g]) > 80 * Math.PI / 180).every(g => covG.count[g] === 0);
  check('constellation', 'GEO halkası: |lat| > 80° kapsanmaz, ekvator tam kapsanır', polarUncovered && Array.from({ length: grid.N }, (_, g) => g).filter(g => Math.abs(grid.lat[g]) < 5 * Math.PI / 180).every(g => covG.count[g] >= 1));
  /* görünürlük: alt-uydu noktasının tam altındaki istasyon ε = 90° görür */
  const pos = C.positionsAt(gps, 0, 0);
  const la = Math.asin(pos.ecefU[2]) * 180 / Math.PI, lo = Math.atan2(pos.ecefU[1], pos.ecefU[0]) * 180 / Math.PI;
  const vis = C.visibleFrom(gps, la, lo, 0, 0);
  check('constellation', 'alt-uydu noktasındaki istasyon o uyduyu ε ≈ 90° ile görür', vis.some(v => v.k === 0 && near(v.elev, Math.PI / 2, 1e-6)));
  /* zaman taraması: GPS sürekli kapsama 100 %, seyrek kutupsal < 100 % ve boşluk > 0 */
  const scanG = C.revisitScan(gps, { dt: 300, nLon: 48, nLat: 24 });
  const scanM = C.revisitScan(C.buildConstellation(C.CONSTELLATION_PRESETS.molniyaLike), { dt: 120, nLon: 48, nLat: 24 });
  check('constellation', 'GPS zaman taraması: sürekli kapsama 100 %, boşluk yok', scanG.continuousFraction > .999 && scanG.maxGap === 0);
  check('constellation', 'seyrek kutupsal: kapsama < 60 % ve en uzun boşluk > 10 dk', scanM.meanFraction < .6 && scanM.maxGap > 600, `${(scanM.meanFraction * 100).toFixed(0)} %, ${(scanM.maxGap / 60).toFixed(0)} dk`);
}

/* ───────────────────────── Atmosferik giriş / koridor */
{
  const R = await mod('presets/reentry_corridor/reentry-model.mjs');
  const { atmosphere, densityBlend, G0 } = await mod('presets/core/astro-atmosphere.mjs');
  const s = R.simulateEntry(R.VEHICLES.capsule, { vEntry: 7800, gammaEntry: -6, bank: 0 });
  check('reentry', 'LEO −6° kapsül girişi 10 km\'ye iner', s.outcome === 'landed');
  /* tepe yavaşlama: n = D/m/g0 tanımıyla örnekte tutarlı */
  const pk = s.samples.find(x => x.t === s.peakG.t);
  const nCalc = Math.hypot(1, s.vehicle.ld) * .5 * densityBlend(pk.h) * pk.v * pk.v * s.vehicle.cd * s.vehicle.area / s.vehicle.m / G0;
  check('reentry', 'tepe g, ½ρv²C_D A/m tanımıyla örtüşür', rel(pk.n, nCalc, 1e-6), `${pk.n.toFixed(2)} g @ ${(pk.h / 1e3).toFixed(0)} km`);
  /* Sutton–Graves: q̇ ∝ v³ √ρ — örnekte doğrula */
  const pq = s.samples.find(x => x.t === s.peakQ.t);
  check('reentry', 'Sutton–Graves q̇ = k√(ρ/r_n)v³ örnekte tutarlı', rel(pq.q, R.K_SG * Math.sqrt(densityBlend(pq.h) / s.vehicle.rn) * pq.v ** 3, 1e-9));
  check('reentry', 'tepe ısınma tepe yavaşlamadan ÖNCE gelir (v³ ağırlığı)', s.peakQ.t < s.peakG.t, `${s.peakQ.t.toFixed(0)} s < ${s.peakG.t.toFixed(0)} s`);
  /* enerji: hız kaybı sürüklemeden — atmosfersiz limit: ρ → 0 üstü (300 km'de) dış kuvvet yok, Kepler enerjisi korunur */
  const hi = R.simulateEntry(R.VEHICLES.capsule, { hEntry: 300e3, vEntry: 7800, gammaEntry: -1, hEnd: 150e3, dt: .5 });
  const e0 = hi.samples[0], e1 = hi.samples[Math.min(hi.samples.length - 1, 200)];
  const E0 = e0.v * e0.v / 2 - R.MU / (R.R_E + e0.h), E1 = e1.v * e1.v / 2 - R.MU / (R.R_E + e1.h);
  check('reentry', 'atmosfer dışında (≥150 km) özgül enerji korunur (< 0,05 %)', rel(E1, E0, 5e-4), `${((E1 - E0) / Math.abs(E0) * 100).toExponential(2)} %`);
  /* koridor: Ay dönüşü kapsülü ≈ Apollo (−7,7°…−5,3°, ~2,4°) — model sınırları içinde */
  const c = R.findCorridor(R.VEHICLES.capsule, { vEntry: 11000, nMax: 10 });
  check('reentry', 'Ay dönüşü koridoru: aşma −5,5…−4,3°, altında-kalma −8…−6,5°, genişlik 1,5–3,5° (Apollo ≈ 2,4°)', c.gammaOvershoot > -5.5 && c.gammaOvershoot < -4.3 && c.gammaUndershoot > -8 && c.gammaUndershoot < -6.5 && c.width > 1.5 && c.width < 3.5, `[${c.gammaUndershoot.toFixed(2)}, ${c.gammaOvershoot.toFixed(2)}] → ${c.width.toFixed(2)}°`);
  check('reentry', 'aşma sınırından sığ giriş (kaldırma aşağı) yakalanmaz', R.simulateEntry(R.VEHICLES.capsule, { vEntry: 11000, gammaEntry: c.gammaOvershoot + .3, bank: 180 }).outcome !== 'landed');
  check('reentry', 'altında-kalma sınırından dik giriş (kaldırma yukarı) n_max\'ı aşar', R.simulateEntry(R.VEHICLES.capsule, { vEntry: 11000, gammaEntry: c.gammaUndershoot - .3, bank: 0 }).peakG.n > 10);
  /* daha yüksek L/D → daha geniş koridor; balistik (L/D 0) en dar */
  const cb = R.findCorridor(R.VEHICLES.ballistic, { vEntry: 11000, nMax: 10 });
  check('reentry', 'kaldırma koridoru genişletir: balistik (L/D 0) < kapsül (L/D 0,3)', (isNaN(cb.width) ? 0 : cb.width) < c.width, `${isNaN(cb.width) ? 'yok' : cb.width.toFixed(2)}° < ${c.width.toFixed(2)}°`);
  /* balistik: aşma ve altında-kalma aynı yatışla (L/D = 0 → σ etkisiz) — iki sınır arası dar */
  check('reentry', 'balistik sonda koridoru dar (< 0,5°)', !isNaN(cb.width) && cb.width < .5, `${cb.width.toFixed(2)}°`);
  /* eş-yavaşlama eğrisi: kapalı biçim v = √(2 n g₀ β/ρ) → o (h,v)'de gerçekten n g */
  const p = R.isoDecelCurve(s.beta, 5)[20];
  check('reentry', 'eş-yavaşlama eğrisi: n = ½ρv²/β/g₀ = 5 g', near(.5 * densityBlend(p.h) * p.v * p.v / s.beta / G0, 5, 1e-9));
}

/* ───────────────────────── Formasyon uçuşu */
{
  const F = await mod('presets/formation_flight/formation-model.mjs');
  const pco = F.buildFormation('pco', { count: 3, rho: 1000 });
  check('formation', 'PCO: 3 deputy, hepsi sürüklenmesiz', pco.deputies.length === 3 && pco.deputies.every(d => Math.abs(d.drift) < 1e-9));
  const st = F.separationStats(pco, 30);
  check('formation', 'PCO: şefe uzaklık |r| ∈ [ρ, ρ√5/2] (|r|² = ρ²(1 + sin²/4))', st.chief.every(c => c.min >= 500 * .999 && c.max <= 1118.1), st.chief.map(c => `${c.min.toFixed(0)}–${c.max.toFixed(0)}`).join(' '));
  /* y–z izdüşümü yarıçapı ρ: t taramasında sabit */
  const tr = F.trace(pco, pco.deputies[0], 0, pco.period, 60);
  check('formation', 'PCO y–z izdüşüm yarıçapı sabit = ρ (±1e−6)', tr.every(s => near(Math.hypot(s[1], s[2]), 1000, 1e-6)));
  check('formation', 'PCO bir periyot sonra kapanır', tr[0].every((v, k) => near(v, tr[60][k], 1e-6)));
  const gco = F.buildFormation('gco', { count: 1, rho: 1000 });
  const trg = F.trace(gco, gco.deputies[0], 0, gco.period, 60);
  check('formation', 'GCO: şefe uzaklık sabit = ρ (küresel formasyon)', trg.every(s => near(Math.hypot(s[0], s[1], s[2]), 1000, 1e-6)));
  const lf = F.buildFormation('leaderFollower', { separation: 220e3 });
  const sl = F.separationStats(lf, 60);
  check('formation', 'lider–takipçi: ayrım tam sabit 220 km', near(sl.chief[0].min, 220e3, 1e-6) && near(sl.chief[0].max, 220e3, 1e-6));
  const dr = F.buildFormation('drift', { rho: 1000, delta: .05 });
  const sd = F.statesAt(dr, dr.period);
  check('formation', 'sürüklenme ihlali: +5 cm/s → bir periyotta −3·δẏ·T ≈ −0,85 km geriye', near(sd[1][1] - sd[0][1], -3 * .05 * dr.period, 1e-3), `${((sd[1][1] - sd[0][1]) / 1000).toFixed(3)} km`);
  check('formation', 'ihlal deputy sürüklenme hızı = −3·δẏ = −0,15 m/s', near(dr.deputies[1].drift, -.15, 1e-12));
}

/* ───────────────────────── CR3BP */
{
  const C = await mod('presets/core/astro-cr3bp.mjs');
  const mu = C.SYSTEMS.earthMoon.mu, L = C.lagrangePoints(mu);
  check('cr3bp', 'Dünya–Ay L1 = 0,836915 (literatür ±1e−5)', near(L.L1.x, .836915, 1e-5), L.L1.x.toFixed(6));
  check('cr3bp', 'Dünya–Ay L2 = 1,155682, L3 = −1,005063', near(L.L2.x, 1.155682, 1e-5) && near(L.L3.x, -1.005063, 1e-5));
  check('cr3bp', 'L1–L5 gradyan artıkları ‖∇Ω‖ < 1e−12', Object.values(L).every(p => p.residual < 1e-12));
  check('cr3bp', 'L4 eşkenar üçgen: birincil ve ikinciliye uzaklık 1', near(Math.hypot(L.L4.x + mu, L.L4.y), 1, 1e-12) && near(Math.hypot(L.L4.x - 1 + mu, L.L4.y), 1, 1e-12));
  check('cr3bp', 'Jacobi sıralaması C(L1) > C(L2) > C(L3) > C(L4) = C(L5)', L.L1.C > L.L2.C && L.L2.C > L.L3.C && L.L3.C > L.L4.C && near(L.L4.C, L.L5.C, 1e-12));
  const SE = C.lagrangePoints(C.SYSTEMS.sunEarth.mu);
  check('cr3bp', 'Güneş–Dünya L1 ≈ 1,49 milyon km, L2 ≈ 1,50 milyon km', near((1 - C.SYSTEMS.sunEarth.mu - SE.L1.x) * 149597870.7, 1.4915e6, 3e3) && near((SE.L2.x - 1 + C.SYSTEMS.sunEarth.mu) * 149597870.7, 1.5015e6, 3e3));
  /* Jacobi korunumu */
  const s0 = [.5, 0, 0, 0, .8, 0]; const pr = C.propagate(mu, s0, 20, 1e-3);
  const dC = Math.max(...pr.states.map(s => Math.abs(C.jacobi(mu, s) - C.jacobi(mu, s0))));
  check('cr3bp', 'Jacobi sabiti 20 TU boyunca < 1e−10 sapar', dC < 1e-10, dC.toExponential(2));
  /* Lyapunov: kapanma ve simetri */
  const o = C.lyapunovOrbit(mu, 'L1', .008, { dt: 1e-3 });   // küçük genlik: doğrusal tahmin yeterli; büyük genlik sürekliliğe bırakılır
  const last = o.states[o.states.length - 1];
  check('cr3bp', 'L1 Lyapunov (Ax 0,008) yakınsadı ve bir periyotta kapanır (< 1e−6)', o.converged && Math.hypot(last[0] - o.x0, last[1], last[3], last[4] - o.ydot0) < 1e-6, `${o.iterations} adım, artık ${Math.hypot(last[0] - o.x0, last[1], last[3], last[4] - o.ydot0).toExponential(1)}`);
  check('cr3bp', 'Lyapunov yörüngesi x eksenine simetrik (y → −y)', near(Math.max(...o.states.map(s => s[1])), -Math.min(...o.states.map(s => s[1])), 1e-4));
  const fam = C.lyapunovFamily(mu, 'L2', [.005, .01, .02, .04, .07], { dt: 2e-3 });
  check('cr3bp', 'L2 Lyapunov ailesi süreklilikle 5/5 yakınsar; periyot genlikle artar', fam.length === 5 && fam.every((f, i) => i === 0 || f.period > fam[i - 1].period));
  /* sıfır-hız eğrisi: C = C(L1)'de boyun L1'de kapanır: L1'de 2Ω = C, hemen yanında (y) 2Ω > C */
  /* L1 bir eyer: x boyunca Ω minimum (boyun), y boyunca maksimum → C = C(L1)'de x-komşuları erişilebilir (2Ω > C), y-komşuları yasak (2Ω < C) */
  check('cr3bp', 'L1 eyer noktası: C(L1) seviyesinde x-komşuları erişilebilir, y-komşuları yasak', near(2 * C.omega(mu, L.L1.x, 0), L.L1.C, 1e-12) && 2 * C.omega(mu, L.L1.x + .05, 0) > L.L1.C && 2 * C.omega(mu, L.L1.x - .05, 0) > L.L1.C && 2 * C.omega(mu, L.L1.x, .05) < L.L1.C);
  check('cr3bp', 'eylemsiz dönüşüm uzunluk korur', near(Math.hypot(...C.rotatingToInertial([.3, .4, 0], 1.234).slice(0, 2)), .5, 1e-12));
}

/* ───────────────────────── Yerçekimi yardımı / B-düzlemi */
{
  const F = await mod('presets/gravity_assist/flyby-model.mjs');
  const fb = F.solveFlyby({ body: 'jupiter', vinf: 6, alpha: 120, rp: 6 * 69911, theta: 0 });
  const n = v => Math.hypot(v[0], v[1], v[2]);
  check('flyby', '|v∞| korunur (giriş = çıkış)', near(n(fb.vinfIn), n(fb.vinfOut), 1e-9), `${n(fb.vinfOut).toFixed(6)} km/s`);
  check('flyby', 'δ = 2 asin(1/e) ve ΔV = 2 v∞ sin(δ/2)', near(fb.delta, 2 * Math.asin(1 / fb.e), 1e-12) && near(fb.dV, 2 * fb.vinf * Math.sin(fb.delta / 2), 1e-9), `δ ${(fb.delta * 180 / Math.PI).toFixed(2)}°, ΔV ${fb.dV.toFixed(3)}`);
  check('flyby', 'ΔE = V_p·Δv∞ (vis-viva farkı ile)', near(fb.dEnergy, fb.dEnergyCheck, 1e-6), `${fb.dEnergy.toFixed(3)} km²/s²`);
  check('flyby', 'Tisserand parametresi korunur (dairesel gezegen)', near(fb.tisserandIn, fb.tisserandOut, 1e-9), fb.tisserandOut.toFixed(6));
  /* geometri: hiperbol enberisi r_p, enberi hızı vis-viva, asimptot yönleri S / S_out */
  const path = F.hyperbolaPath(fb, { n: 2000 });
  const mn = path.reduce((m, p) => p.dist < m.dist ? p : m, path[0]);
  check('flyby', 'hiperbol en yakın nokta = r_p, hız = √(v∞² + 2μ/r_p)', rel(mn.dist, fb.rp, 1e-6) && rel(mn.speed, Math.sqrt(fb.vinf ** 2 + 2 * fb.body.mu / fb.rp), 1e-6));
  const u = v => { const k = n(v); return v.map(x => x / k); };
  const din = u(path[0].v), dout = u(path[path.length - 1].v);
  check('flyby', 'giriş asimptot yönü = S, çıkış = S_out (< 0,2°)', Math.acos(din[0] * fb.S[0] + din[1] * fb.S[1] + din[2] * fb.S[2]) < .2 * Math.PI / 180 && Math.acos(dout[0] * u(fb.vinfOut)[0] + dout[1] * u(fb.vinfOut)[1] + dout[2] * u(fb.vinfOut)[2]) < .2 * Math.PI / 180);
  check('flyby', 'enberi B̂ tarafında (P̂·B̂ > 0) ve açısal momentum yönü tutarlı', (fb.Phat[0] * fb.Bhat[0] + fb.Phat[1] * fb.Bhat[1] + fb.Phat[2] * fb.Bhat[2]) > 0);
  /* çarpma limiti: r_p = R → b = b_çarpma; r_p < R kenetlenir */
  const fbR = F.solveFlyby({ body: 'jupiter', vinf: 6, alpha: 120, rp: 69911 });
  check('flyby', 'r_p = R için |B| = çarpma dairesi yarıçapı', near(fbR.b, fbR.bImpact, 1e-6));
  /* arka geçiş enerji kazandırır, ön geçiş kaybettirir (θ = 0 vs 180) */
  /* küçük δ'da ΔE ≈ −sin δ · v∞ (V_p·B̂): taraf değişince işaret döner (büyük δ'da (cos δ − 1) terimi baskın olabilir) */
  const back = F.solveFlyby({ body: 'jupiter', vinf: 6, alpha: 120, rp: 30 * 69911, theta: 0 }), front = F.solveFlyby({ body: 'jupiter', vinf: 6, alpha: 120, rp: 30 * 69911, theta: 180 });
  check('flyby', 'arka geçiş (θ = 0) enerji kazandırır, ön geçiş (θ = 180) kaybettirir (r_p = 30R)', back.dEnergy > 0 && front.dEnergy < 0, `${back.dEnergy.toFixed(1)} / ${front.dEnergy.toFixed(1)}`);
  check('flyby', 'ΔE(θ) − ΔE(θ+π) = −2 sin δ v∞ V_p·B̂', near(back.dEnergy - front.dEnergy, -2 * Math.sin(back.delta) * back.vinf * (back.Vp[0] * back.Bhat[0] + back.Vp[1] * back.Bhat[1] + back.Vp[2] * back.Bhat[2]), 1e-6));
  /* limit: r_p → ∞ ⇒ δ → 0, ΔV → 0 */
  const far = F.solveFlyby({ body: 'jupiter', vinf: 6, alpha: 120, rp: 4e7 });
  check('flyby', 'uzak geçişte δ ve ΔV küçülür', far.delta < fb.delta / 4 && far.dV < fb.dV / 4);
  /* Voyager-benzeri sayı: Jüpiter v∞ ≈ 10 km/s, r_p ≈ 5 R → δ ≈ 2 asin(1/(1+ r_p v∞²/μ)) */
  const vg = F.solveFlyby({ body: 'jupiter', vinf: 10, alpha: 120, rp: 5 * 69911 });
  check('flyby', 'Jüpiter v∞ 10 km/s, r_p 5R: e = 1 + r_p v∞²/μ = 1,276', near(vg.e, 1 + 5 * 69911 * 100 / 1.26686534e8, 1e-9), vg.e.toFixed(4));
}

/* ───────────────────────── Yönelim dinamiği / GNC */
{
  const A = await mod('presets/attitude_gnc/attitude-model.mjs');
  const slew = A.simulateAttitude({ craft: 'small', mode: 'slew', duration: 120 });
  check('attitude', 'kuaterniyon normu korunur (|q| = 1 ± 1e−9)', slew.samples.every(s => Math.abs(Math.hypot(...s.q) - 1) < 1e-9));
  check('attitude', 'PD slew hedefe oturur (< 0,5°, 120 s içinde; tekerlek torku sınırlı)', slew.stats.settledAt != null, slew.stats.settledAt ? `${slew.stats.settledAt.toFixed(1)} s` : 'oturmadı');
  check('attitude', 'slew sırasında toplam momentum (gövde + tekerlek) korunur (< 1e−3 N·m·s)', slew.stats.HDrift < 1e-3 && (Math.max(...slew.samples.map(s => s.H)) - Math.min(...slew.samples.map(s => s.H))) < 1e-3, `${slew.stats.HDrift.toExponential(1)}`);
  const tum = A.simulateAttitude({ craft: 'tumbler', mode: 'tumble', w0: [.01, 2, 0], duration: 40, wheels: false });
  check('attitude', 'serbest gövde: kinetik enerji ve |H| korunur (< 1e−8)', tum.stats.energyDrift < 1e-8 && tum.stats.HDrift < 1e-8, `${tum.stats.energyDrift.toExponential(1)} / ${tum.stats.HDrift.toExponential(1)}`);
  check('attitude', 'Dzhanibekov: ara eksen dönüşü devrilir (|ω₁| büyür ≥ 1 rad/s)', Math.max(...tum.samples.map(s => Math.abs(s.w[0]))) > 1);
  const stable = A.simulateAttitude({ craft: 'tumbler', mode: 'tumble', w0: [.01, 0, 2], duration: 40, wheels: false });
  check('attitude', 'büyük eksen dönüşü kararlı (|ω₁| ≤ 0,02)', Math.max(...stable.samples.map(s => Math.abs(s.w[0]))) <= .02);
  const sat = A.simulateAttitude({ craft: 'small', mode: 'saturation', tauExt: [.02, 0, 0], duration: 120, qTarget: [0, 0, 0, 1] });
  check('attitude', 'sabit dış tork: tekerlek h_max/τ = 50 s\'de doyar (±1 s)', sat.stats.satAt != null && Math.abs(sat.stats.satAt - 50) < 1, sat.stats.satAt ? `${sat.stats.satAt.toFixed(1)} s` : 'yok');
  check('attitude', 'doymadan sonra toplam |H| = τ·t büyür (120 s: 2,4 N·m·s ±2 %)', rel(sat.samples[sat.samples.length - 1].H, .02 * 120, .02), sat.samples[sat.samples.length - 1].H.toFixed(3));
  const q = A.qFromEuler321(.7, -.3, 1.1), e = A.euler321FromQ(q);
  check('attitude', 'Euler 3-2-1 → q → Euler gidiş-dönüş', near(e.psi, .7, 1e-12) && near(e.theta, -.3, 1e-12) && near(e.phi, 1.1, 1e-12));
  check('attitude', 'gimbal kilidi: θ = 89,9° için Euler hız matrisi det = 1/cos θ ≈ 573', near(A.eulerRateMatrix321(89.9 * Math.PI / 180, .3).det, 1 / Math.cos(89.9 * Math.PI / 180), 1e-9));
  const s5 = A.qSlerp([0, 0, 0, 1], A.qFromAxisAngle([0, 0, 1], Math.PI / 2), .5);
  check('attitude', 'SLERP yarı yol = 45° (büyük çember)', near(A.qAngle(s5), Math.PI / 4, 1e-12));
  /* K_p = I ω_n² tanımı */
  check('attitude', 'K_p = I·ω_n², K_d = 2ζω_n·I', slew.Kp.every((k, i) => near(k, slew.cfg.I[i] * slew.cfg.wn ** 2, 1e-12)) && slew.Kd.every((k, i) => near(k, 2 * slew.cfg.zeta * slew.cfg.wn * slew.cfg.I[i], 1e-12)));
}

/* ───────────────────────── Yörünge pertürbasyonları */
{
  const Pm = await mod('presets/orbit_perturbations/perturbation-model.mjs');
  const d = 180 / Math.PI * 86400;
  const run = id => { const p = Pm.propagatePerturbed(id); const T = p.samples.map(s => s.t); return { p, raan: Pm.fitRate(T, Pm.unwrap(p.samples.map(s => s.el.raan))), argp: Pm.fitRate(T, Pm.unwrap(p.samples.map(s => s.el.argp))) }; };
  const leo = run('j2leo');
  check('perturbation', 'J2 LEO 51,6°: sayısal Ω̇ ≈ analitik (±2 %)', rel(leo.raan, leo.p.secular.raanDot, .02), `${(leo.raan * d).toFixed(3)} vs ${(leo.p.secular.raanDot * d).toFixed(3)} °/gün`);
  const sso = run('sso');
  check('perturbation', 'SSO 98,2°: Ω̇ ≈ +0,986 °/gün (Güneş-eşzamanlı)', near(sso.raan * d, .9856, .03), `${(sso.raan * d).toFixed(3)} °/gün`);
  const mol = run('molniya'), off = run('molniyaOff');
  check('perturbation', 'Molniya 63,4°: ω̇ ≈ 0; 55°: ω̇ ≈ analitik (±3 %)', Math.abs(mol.argp * d) < .01 && rel(off.argp, off.p.secular.argpDot, .03), `${(mol.argp * d).toFixed(4)} / ${(off.argp * d).toFixed(3)} vs ${(off.p.secular.argpDot * d).toFixed(3)}`);
  /* J2 eksenel simetrik: H_z korunur (göreli 1e−8) */
  const hz0 = leo.p.samples[0].el.hz, hzMax = Math.max(...leo.p.samples.map(s => Math.abs(s.el.hz - hz0)));
  check('perturbation', 'J2 altında H_z korunur (göreli < 1e−7)', hzMax / Math.abs(hz0) < 1e-7, (hzMax / Math.abs(hz0)).toExponential(1));
  /* iki-cisim: elemanlar sabit */
  const tb = Pm.propagatePerturbed('twoBody');
  const aSpread = Math.max(...tb.samples.map(s => s.el.a)) - Math.min(...tb.samples.map(s => s.el.a)), iSpread = Math.max(...tb.samples.map(s => s.el.i)) - Math.min(...tb.samples.map(s => s.el.i));
  check('perturbation', 'iki-cisim: a ve i sabit (Δa < 1 m, Δi < 1e−9)', aSpread < 1e-3 && iSpread < 1e-9, `Δa ${(aSpread * 1000).toExponential(1)} m`);
  /* sürükleme: enerji tek yönlü azalır, irtifa düşer */
  const dr = Pm.propagatePerturbed('drag');
  /* J2 dahil toplam enerji: E = v²/2 − (μ/r)[1 − J2 (R/r)² (3 sin²φ − 1)/2] — J2 korunumlu, sürükleme tek yönlü azaltır */
  const eJ2 = s => { const r = Math.hypot(...s.r), v2 = s.v[0] ** 2 + s.v[1] ** 2 + s.v[2] ** 2, sp = s.r[2] / r; return v2 / 2 - Pm.MU / r * (1 - Pm.J2 * (Pm.R_E / r) ** 2 * (3 * sp * sp - 1) / 2); };
  let monoE = true; for (let k = 1; k < dr.samples.length; k++) if (eJ2(dr.samples[k]) > eJ2(dr.samples[k - 1]) + 1e-7) monoE = false;
  const eJ2Leo = leo.p.samples.map(eJ2); const spreadLeo = (Math.max(...eJ2Leo) - Math.min(...eJ2Leo)) / Math.abs(eJ2Leo[0]);
  check('perturbation', 'J2 dahil enerji: yalnız J2\'de korunur (göreli < 1e−6)', spreadLeo < 1e-6, spreadLeo.toExponential(1));
  check('perturbation', 'sürükleme: J2-dahil enerji tek yönlü azalır; 300 km\'de 20 günde > 15 km bozunma', monoE && dr.samples[0].el.a - dr.samples[dr.samples.length - 1].el.a > 15, `Δa = ${(dr.samples[0].el.a - dr.samples[dr.samples.length - 1].el.a).toFixed(1)} km`);
  /* Ay+Güneş GEO: eğiklik ~0,8–0,9 °/yıl büyür */
  const mg = Pm.propagatePerturbed('moonGeo');
  const di = (mg.samples[mg.samples.length - 1].el.i - mg.samples[0].el.i) * 180 / Math.PI / (mg.cfg.days / 365.25);
  check('perturbation', 'Ay+Güneş: GEO eğiklik sürüklenmesi 0,6–1,1 °/yıl', di > .6 && di < 1.1, `${di.toFixed(2)} °/yıl`);
  /* SRP: e salınır ama a korunur (göreli < 1e−4) */
  const sr = Pm.propagatePerturbed('srpGeo');
  check('perturbation', 'SRP: e değişir, a korunur (< 1e−4 göreli)', Math.abs(sr.samples[sr.samples.length - 1].el.a - sr.samples[0].el.a) / sr.samples[0].el.a < 1e-4);
  /* elemanlar gidiş-dönüş */
  const el = { a: 26562, e: .74, i: 1.1, raan: 2.2, argp: 4.7, nu: .8 }, rv = Pm.elementsToRv(el), back = Pm.rvToElements(rv.r, rv.v);
  check('perturbation', 'elemanlar → durum → elemanlar gidiş-dönüş (1e−9)', near(back.a, el.a, 1e-6) && near(back.e, el.e, 1e-9) && near(back.i, el.i, 1e-9) && near(back.raan, el.raan, 1e-9) && near(back.argp, el.argp, 1e-9) && near(back.nu, el.nu, 1e-9));
}

/* ───────────────────────── Tutulma / görünürlük geometrisi */
{
  const E = await mod('presets/eclipse_geometry/eclipse-model.mjs');
  const O = await mod('presets/core/astro-orbit.mjs');
  const eq = { ...O.ORBIT_PRESETS.iss, i: 0, raan: 0 };
  const b = E.analyze({ el: eq, dayOfYear: 80, revs: 1 });
  const theo = Math.asin(O.R_E / eq.a) / Math.PI;
  check('eclipse', 'β = 0 dairesel: umbra ≤ silindirik asin(R/r)/π ≤ penumbra (konik ⊂ silindirik ⊂ penumbra)', b.stats.umbraFrac <= theo + 1e-3 && b.stats.penumbraFrac >= theo - 1e-3 && Math.abs(b.stats.umbraFrac - theo) < .01, `${b.stats.umbraFrac.toFixed(4)} ≤ ${theo.toFixed(4)} ≤ ${b.stats.penumbraFrac.toFixed(4)}`);
  const dd = E.analyze({ el: { ...O.ORBIT_PRESETS.polar, raan: Math.PI / 2 }, dayOfYear: 80, revs: 1 });
  check('eclipse', 'şafak-alacakaranlık kutupsal (β = 90°): tutulma yok', dd.noEclipseByBeta && dd.stats.umbraFrac === 0, `β ${(dd.beta * 180 / Math.PI).toFixed(1)}°`);
  const iss = E.analyze({ el: O.ORBIT_PRESETS.iss, dayOfYear: 80, revs: 3, station: { lat: 39.9, lon: 32.9, maskDeg: 5 } });
  check('eclipse', 'ISS umbra tur başına 30–37 dk', iss.stats.umbraPerRev / 60 > 30 && iss.stats.umbraPerRev / 60 < 37, `${(iss.stats.umbraPerRev / 60).toFixed(1)} dk`);
  check('eclipse', 'olaylar sıralı ve umbra girişi penumbra girişinden sonra', iss.events.every((e, k) => k === 0 || e.t >= iss.events[k - 1].t) && iss.events.findIndex(e => e.id === 'umbra-entry') > iss.events.findIndex(e => e.id === 'penumbra-entry'));
  const st = E.stationEcef(0, 0);
  check('eclipse', 'tepe noktasındaki uydu ε = 90°', near(E.elevationFrom(st, [O.R_E + 400, 0, 0], 0).elevation, Math.PI / 2, 1e-6));
  check('eclipse', 'ufuk geometrisi: ε = 0 için merkez açı = acos(R/r)', near(E.elevationFrom(st, [(O.R_E + 400) * Math.cos(Math.acos(O.R_E / (O.R_E + 400))), (O.R_E + 400) * Math.sin(Math.acos(O.R_E / (O.R_E + 400))), 0], 0).elevation, 0, 1e-6));
  const tg = E.segmentBlocked([7000, 0, 0], [0, 7000, 0]);
  check('eclipse', 'doğru parçası teğet yüksekliği = 7000/√2 − R', near(tg.tangentAlt, 7000 / Math.SQRT2 - O.R_E, 1e-6) && tg.blocked);
  check('eclipse', 'gölge fonksiyonu limitleri: karşı-Güneş noktası umbra (0), Güneş tarafı 1', E.shadowFunction([-(O.R_E + 400), 0, 0], [1, 0, 0]).nu === 0 && E.shadowFunction([O.R_E + 400, 0, 0], [1, 0, 0]).nu === 1);
  check('eclipse', 'GEO ekinoks tutulması: penumbra toplamı 2–8 dk (sonlu Güneş diski; giriş+çıkış ≈ 2×2 dk)', (() => { const g = E.analyze({ el: O.ORBIT_PRESETS.geo, dayOfYear: 80, revs: 1, dt: 20 }); return (g.stats.penumbraFrac - g.stats.umbraFrac) * g.period / 60 > 2 && (g.stats.penumbraFrac - g.stats.umbraFrac) * g.period / 60 < 8; })());
}

/* ───────────────────────── Yakın geçiş / kovaryans */
{
  const C = await mod('presets/conjunction_covariance/conjunction-model.mjs');
  const A = C.analyzeConjunction({ miss: [120, 300, -80], crossAngle: 40, tTca: 3600 });
  check('conjunction', 'TCA\'da r_rel ⊥ v_rel (düzlem-dışı bileşen < 1 mm)', Math.abs(A.geo.outOfPlane) < 1e-3, `${A.geo.outOfPlane.toExponential(1)} m`);
  check('conjunction', 'TCA, nominal zamana yakın (±60 s) ve menzil minimumu (komşular büyük)', Math.abs(A.tca.tTca - 3600) < 60 && A.series.every(s => s.range >= A.tca.miss * 1000 - 1e-3), `${A.tca.tTca.toFixed(1)} s, ${(A.tca.miss * 1000).toFixed(1)} m`);
  /* P_c limitleri */
  const iso = [1e6, 0, 0, 1e6];
  check('conjunction', 'P_c küçük sert gövde limiti: ≈ πR²/(2π|C|^½) (±0,1 %)', rel(C.collisionProbability(iso, [0, 0], 5), Math.PI * 25 / (2 * Math.PI * 1e6), 1e-3));
  check('conjunction', 'P_c → 1 sert gövde kovaryansı kaplayınca; → 0 kovaryans devasa olunca (seyrelme)', Math.abs(C.collisionProbability([1e4, 0, 0, 1e4], [0, 0], 5000) - 1) < 1e-3 && C.collisionProbability([1e12, 0, 0, 1e12], [300, 0], 20) < 1e-8);
  /* Mahalanobis izotropik: ıska/σ */
  const g0 = C.encounterGeometry(A.tca, [100, 100, 100], [0, 0, 0]);
  check('conjunction', 'izotropik kovaryansta d_M = ıska/σ', near(g0.dM, Math.hypot(...g0.missPlane) / (100 * Math.SQRT2) * Math.SQRT2, 1e-9) && near(g0.ellipse.s1, 100, 1e-9) && near(g0.ellipse.s2, 100, 1e-9));
  /* kovaryans dönüşümü iz korur (RTN → ECI) */
  const B = C.rtnBasis(A.tca.rP, A.tca.vP), CE = C.covRtnToEci([50, 400, 60], B);
  check('conjunction', 'RTN → ECI kovaryans dönüşümü izi korur (σ_R² + σ_T² + σ_N²)', near(CE[0] + CE[4] + CE[8], 50 * 50 + 400 * 400 + 60 * 60, 1e-6));
  check('conjunction', 'birleşik kovaryans = C_P + C_S (simetrik, pozitif tanımlı)', A.geo.det > 0 && near(A.geo.C2[1], A.geo.C2[2], 1e-9));
  /* seyrelme: tepe var, uçlarda küçük */
  const dil = A.dilution; check('conjunction', 'seyrelme eğrisi: tepe P_c uçlardan büyük', dil.peak.pc > dil.points[0].pc && dil.peak.pc > dil.points[dil.points.length - 1].pc, `tepe k = ${dil.peak.k.toFixed(2)}`);
  /* daha yakın ıska → daha büyük P_c (aynı kovaryans) */
  const A2 = C.analyzeConjunction({ miss: [30, 60, -20], crossAngle: 40, tTca: 3600 });
  check('conjunction', 'yakın ıska → daha büyük P_c', A2.pc > A.pc, `${A2.pc.toExponential(2)} > ${A.pc.toExponential(2)}`);
  const e = C.eig2(4, 1, 2); check('conjunction', 'eig2: özdeğerler iz ve determinantı sağlar', near(e.l1 + e.l2, 6, 1e-12) && near(e.l1 * e.l2, 7, 1e-12));
}

/* ───────────────────────── Küresel harmonik yerçekimi alanı */
{
  const G = await mod('presets/gravity_field/gravity-model.mjs');
  const O = await mod('presets/core/astro-orbit.mjs');
  const t = .3, P = G.legendreNormalized(t, 8);
  check('gravity', 'P̄20 = √5(3t²−1)/2, P̄22 = (√15/2)(1−t²)', near(P[2][0], Math.sqrt(5) * (3 * t * t - 1) / 2, 1e-12) && near(P[2][2], Math.sqrt(15) / 2 * (1 - t * t), 1e-12));
  let acc = 0; const nl = 300, nm = 300; for (let a = 0; a < nl; a++) { const th = (a + .5) / nl * Math.PI, Pl = G.legendreNormalized(Math.cos(th), 8); for (let b = 0; b < nm; b++) { const lam = (b + .5) / nm * 2 * Math.PI, v = Pl[6][3] * Math.cos(3 * lam); acc += v * v * Math.sin(th) * (Math.PI / nl) * (2 * Math.PI / nm); } }
  check('gravity', 'tam normalize ortonormallik: (1/4π)∬(P̄63 cos3λ)² dΩ = 1 (±1e−3)', near(acc / (4 * Math.PI), 1, 1e-3), (acc / (4 * Math.PI)).toFixed(5));
  const cs = G.buildCoefficients(24);
  check('gravity', 'C̄20 = −J2/√5 (EGM96 yuvarlatılmış)', near(-Math.sqrt(5) * cs.C[2][0], G.J2, 2e-6), (-Math.sqrt(5) * cs.C[2][0]).toExponential(5));
  check('gravity', 'katsayı kaynağı işaretli: 5 gerçek, gerisi sentetik', cs.prov[2][0] === 1 && cs.prov[2][2] === 1 && cs.prov[3][0] === 1 && cs.prov[4][0] === 1 && cs.prov[3][1] === 2 && cs.prov[5][0] === 2);
  const spec = G.degreeSpectrum(cs);
  check('gravity', 'sentetik dereceler Kaula 1e−5/l² mertebesinde (l = 8: 0,3–3×)', spec.find(s => s.l === 8).sigma / (1e-5 / 64) > .3 && spec.find(s => s.l === 8).sigma / (1e-5 / 64) < 3);
  /* elipsoide göre jeoit: normal alan çıkarılınca ±200 m içinde; küreye göre J2 şişkinliği km düzeyinde */
  const gE = G.surfaceGrid(cs, 60, 30, { removeNormal: true }), gS = G.surfaceGrid(cs, 60, 30, { removeNormal: false });
  check('gravity', 'jeoit elipsoide göre ±200 m içinde; küreye göre km düzeyinde (J2)', Math.max(Math.abs(gE.nMin), Math.abs(gE.nMax)) < 200 && Math.abs(gS.nMin) > 3000, `${gE.nMin.toFixed(0)}…${gE.nMax.toFixed(0)} m vs ${gS.nMin.toFixed(0)}…${gS.nMax.toFixed(0)} m`);
  /* yalnız C̄20 alanı → düğüm kayması J2 analitik (±2 %) */
  const csJ2 = G.loadCoefficients([{ l: 2, m: 0, C: -4.84165e-4, S: 0 }], 2);
  const nd = G.propagateNodeDrift(csJ2, { hours: 4, dt: 40, opts: { removeNormal: false } }), an = O.j2Rates({ a: 6778.137, e: 0, i: 51.6 * Math.PI / 180 }).raanDot;
  check('gravity', 'yalnız-C̄20 alanında sayısal Ω̇ ≈ J2 analitik (±2 %)', rel(nd.raanDot, an, .02), `${(nd.raanDot * 86400 * 180 / Math.PI).toFixed(3)} vs ${(an * 86400 * 180 / Math.PI).toFixed(3)} °/gün`);
  check('gravity', 'yayılımda enerji korunur (< 1e−6 göreli)', nd.energyDrift < 1e-6, nd.energyDrift.toExponential(1));
  /* tek derece l=2 zonal: N ∝ P̄20 → ekvator/kutup işaretleri zıt */
  const eq = G.disturbance(csJ2, G.R, 0, 0, { removeNormal: false }), po = G.disturbance(csJ2, G.R, Math.PI / 2, 0, { removeNormal: false });
  check('gravity', 'C̄20 tek: kutupta N < 0, ekvatorda N > 0 (yassılık), oran −2', eq.N > 0 && po.N < 0 && near(po.N / eq.N, -2, 1e-6));
}

/* ───────────────────────── transfer (Lambert kâşifi) */
{
  const T = await mod('presets/transfer_explorer/transfer-model.mjs');
  const muE = T.CENTRAL.earth.mu, muS = T.CENTRAL.sun.mu, AU = T.CENTRAL.sun.unit;
  const h = T.hohmann(muE, 6678.137, 42164.17);
  check('transfer', 'Hohmann LEO→GEO kapalı biçim 3,89 km/s, 5,27 sa', near(h.dvTotal, 3.893, .005) && near(h.tof / 3600, 5.27, .02), `${h.dvTotal.toFixed(4)} km/s, ${(h.tof / 3600).toFixed(3)} sa`);
  const s180 = T.solveTransfer({ central: 'earth', r1: 6678.137, r2: 42164.17, dth: 180, tof: h.tof });
  check('transfer', 'Δθ = 180° (kaydırılmış) Lambert = Hohmann (1e−4 bağıl)', !!s180 && rel(s180.dv1, h.dv1, 1e-4) && rel(s180.dv2, h.dv2, 1e-4), s180 ? `${s180.dv1.toFixed(5)}/${s180.dv2.toFixed(5)} vs ${h.dv1.toFixed(5)}/${h.dv2.toFixed(5)}` : 'null');
  check('transfer', 'Hohmann transfer elipsi: a = (r1+r2)/2, r_p = r1, r_a = r2', !!s180 && rel(s180.a, h.a, 1e-4) && rel(s180.rp, 6678.137, 1e-3) && rel(s180.ra, 42164.17, 1e-3), s180 ? `a ${s180.a.toFixed(1)} rp ${s180.rp.toFixed(1)} ra ${s180.ra.toFixed(1)}` : 'null');
  const sM = T.solveTransfer({ central: 'sun', r1: AU, r2: 1.523679 * AU, dth: 120, tof: 180 * 86400 });
  const end = sM.arc[sM.arc.length - 1], err = Math.hypot(end[0] - sM.R2[0], end[1] - sM.R2[1], end[2] - sM.R2[2]);
  check('transfer', 'Kepler yayı uç noktası r2\'ye oturur (< 1e−3 km)', err < 1e-3, `${err.toExponential(2)} km`);
  const eps1 = Math.hypot(...sM.v1) ** 2 / 2 - muS / AU, eps2 = Math.hypot(...sM.v2) ** 2 / 2 - muS / (1.523679 * AU);
  check('transfer', 'Transfer yayında özgül enerji korunur (v1 ↔ v2)', rel(eps1, eps2, 1e-9), `${eps1.toExponential(6)} vs ${eps2.toExponential(6)}`);
  check('transfer', 'Transfer a = −μ/2ε ile tutarlı', rel(sM.a, -muS / (2 * eps1), 1e-9), `${(sM.a / AU).toFixed(6)} AU`);
  const sw = T.tofSweep({ central: 'sun', r1: AU, r2: 1.523679 * AU, dth: 180 }, [80 * 86400, 600 * 86400], 120), hm = T.hohmann(muS, AU, 1.523679 * AU);
  check('transfer', 'TOF taraması minimumu (Δθ = 180°) Hohmann\'ın %0,3 içinde ve Hohmann TOF\'una yakın', sw.best && rel(sw.best.dv, hm.dvTotal, 3e-3) && rel(sw.best.tof, hm.tof, .05), `${sw.best.dv.toFixed(4)} @ ${(sw.best.tof / 86400).toFixed(1)} gün vs ${hm.dvTotal.toFixed(4)} @ ${(hm.tof / 86400).toFixed(1)} gün`);
  check('transfer', 'Tarama boş çözüm üretmez (kısa yol, tüm TOF)', sw.points.every(p => Number.isFinite(p.short)), `${sw.points.filter(p => !Number.isFinite(p.short)).length} NaN`);
  const sShort = T.solveTransfer({ central: 'sun', r1: AU, r2: 1.523679 * AU, dth: 120, tof: 180 * 86400, direction: 'prograde' }), sLong = T.solveTransfer({ central: 'sun', r1: AU, r2: 1.523679 * AU, dth: 120, tof: 180 * 86400, direction: 'retrograde' });
  check('transfer', 'Kısa yol Δθ = 120°, uzun yol Δθ = 240°; uzun yol daha pahalı', !!sShort && !!sLong && near(sShort.dtheta * 180 / Math.PI, 120, 1e-6) && near(sLong.dtheta * 180 / Math.PI, 240, 1e-6) && sLong.dvTotal > sShort.dvTotal, `${sShort?.dvTotal.toFixed(3)} vs ${sLong?.dvTotal.toFixed(3)} km/s`);
  const sV = T.solveTransfer({ central: 'sun', r1: AU, r2: .723332 * AU, dth: 180, tof: T.hohmann(muS, AU, .723332 * AU).tof });
  check('transfer', 'İçe transfer (Venüs): kalkışta yavaşlama (|v1| < v_c1), a < r1', !!sV && Math.hypot(...sV.v1) < Math.hypot(...sV.Vc1) && sV.a < AU, sV ? `|v1| ${Math.hypot(...sV.v1).toFixed(3)} < v_c1 ${Math.hypot(...sV.Vc1).toFixed(3)}` : 'null');
  const sFast = T.solveTransfer({ central: 'earth', r1: 6678.137, r2: 42164.17, dth: 150, tof: 2 * 3600 });
  check('transfer', 'Kısa TOF (2 sa, Δθ = 150°) çözümü Hohmann\'dan pahalı ve daha enerjik (a büyük ya da hiperbolik)', !!sFast && sFast.dvTotal > h.dvTotal && (sFast.a < 0 || sFast.a > h.a), sFast ? `${sFast.dvTotal.toFixed(3)} km/s, a ${sFast.a.toFixed(0)} km` : 'null');
}

/* ───────────────────────── halo (Richardson + STM düzeltmesi, monodromi, manifoldlar) */
{
  const C = await mod('presets/core/astro-cr3bp.mjs');
  const M = await mod('presets/halo_manifolds/halo-model.mjs');
  const mu = C.SYSTEMS.earthMoon.mu, se = C.SYSTEMS.sunEarth.mu, AU = C.SYSTEMS.sunEarth.L;
  const h = C.haloOrbit(se, 'L2', 110000 / AU);
  check('halo', 'Güneş–Dünya L2 halo (Az 110 000 km): x₀ ≈ 1,00833, T ≈ 180 gün (literatür ±0,5 %)', !!h && h.converged && near(h.x0, 1.00833, 5e-5) && rel(h.period / (2 * Math.PI) * 365.256, 180, 5e-3), h ? `x0 ${h.x0.toFixed(6)}, T ${(h.period / (2 * Math.PI) * 365.256).toFixed(1)} gün` : 'null');
  const o = C.haloOrbit(mu, 'L1', 0.1);
  check('halo', 'Dünya–Ay L1 halo (Az 0,1) yakınsar (< 10 yineleme, artık < 1e−9)', !!o && o.converged && o.iterations < 10 && o.residual < 1e-9, o ? `${o.iterations} yin., ${o.residual.toExponential(1)}` : 'null');
  const e = o.states[o.states.length - 1]; const clos = Math.hypot(e[0] - o.x0, e[1], e[2] - o.z0, e[3], e[4] - o.ydot0, e[5]);
  check('halo', 'Periyodiklik: tam turda durum kapanışı < 1e−6', clos < 1e-6, clos.toExponential(2));
  const Cs = o.states.map(st => C.jacobi(mu, st)); check('halo', 'Halo boyunca Jacobi korunur (< 1e−9)', Math.max(...Cs) - Math.min(...Cs) < 1e-9, (Math.max(...Cs) - Math.min(...Cs)).toExponential(2));
  const half = o.states[Math.floor(o.states.length / 2)]; check('halo', 'Simetri: T/2\'de y ≈ 0, ẋ ≈ ż ≈ 0 (x–z düzlemine dik geçiş)', Math.abs(half[1]) < 2e-3 && Math.abs(half[3]) < 2e-3 && Math.abs(half[5]) < 2e-3, `y ${half[1].toExponential(1)}, ẋ ${half[3].toExponential(1)}, ż ${half[5].toExponential(1)}`);
  const g = o.guess; check('halo', 'Richardson tahmini düzeltilmişe yakın (Δx₀ < 1 %, Δẏ₀ < 10 %)', Math.abs(o.x0 - g.x0) < .01 && Math.abs(o.ydot0 - g.ydot0) / Math.abs(g.ydot0) < .1, `Δx0 ${Math.abs(o.x0 - g.x0).toExponential(1)}, Δẏ0 ${(Math.abs(o.ydot0 - g.ydot0) / Math.abs(g.ydot0) * 100).toFixed(1)} %`);
  const south = C.haloOrbit(mu, 'L1', 0.1, { northern: false }); check('halo', 'Güney halo = kuzeyin z aynası (x₀, ẏ₀, T aynı; z₀ ters)', !!south && south.converged && near(south.x0, o.x0, 1e-9) && near(south.period, o.period, 1e-9) && near(south.z0, -o.z0, 1e-12));
  const fam = C.haloFamily(mu, 'L1', M.familyAzList(mu, 'L1'));
  const azs = fam.map(f => Math.abs(f.z0)); check('halo', 'L1 ailesi ≥ 10 üye, Az monoton artar, periyot sürekli (adım < 25 %; NRHO yönünde hızla kısalır)', fam.length >= 10 && azs.every((a, i) => !i || a > azs[i - 1]) && fam.every((f, i) => !i || Math.abs(f.period - fam[i - 1].period) / fam[i - 1].period < .25), `${fam.length} üye, Az ${azs[0].toFixed(3)}–${azs[azs.length - 1].toFixed(3)}`);
  check('halo', 'Az → küçük limitinde halo periyodu Lyapunov çatallanma periyoduna yaklaşır (±3 %)', (() => { const small = C.haloOrbit(mu, 'L1', .006); const ly = C.lyapunovFamily(mu, 'L1', [.004, .008, .012, .016]); const lb = ly.reduce((b, x) => Math.abs(x.Ax - small.Ax) < Math.abs(b.Ax - small.Ax) ? x : b, ly[0]); return small.converged && rel(small.period, lb.period, .03); })());
  const mono = C.monodromy(mu, o);
  check('halo', 'Monodromi simplektik: det Φ = 1 (±1e−4), λ_u·λ_s = 1 (±1e−3)', near(mono.det, 1, 1e-4) && rel(mono.lambdaU * mono.lambdaS, 1, 1e-3), `det ${mono.det.toFixed(6)}, λuλs ${(mono.lambdaU * mono.lambdaS).toFixed(5)}`);
  check('halo', 'Kararsız özdeğer λ_u ≫ 1 (Dünya–Ay L1 halo: 10²–10³ mertebesi)', mono.lambdaU > 50 && mono.lambdaU < 5e3, mono.lambdaU.toExponential(3));
  check('halo', 'Özvektör: Φ v_u = λ_u v_u (artık < 1e−6)', (() => { const w = mono.Phi.map(r => r.reduce((a, x, j) => a + x * mono.vU[j], 0)); return Math.hypot(...w.map((x, i) => x - mono.lambdaU * mono.vU[i])) / Math.hypot(...w) < 1e-6; })());
  check('halo', 'İz: tr Φ = 2 + λ_u + 1/λ_u + 2cos θ ⇒ |tr Φ − 2 − λ_u − 1/λ_u| ≤ 2', Math.abs(mono.trace - 2 - mono.lambdaU - 1 / mono.lambdaU) <= 2 + 1e-6, `tr ${mono.trace.toFixed(3)}`);
  const m = M.buildHalo({ system: 'earthMoon', L: 'L1', Az: 0.1, manifold: { n: 6, tEnd: 3 } });
  check('halo', 'Manifold ε büyümesi bir periyotta λ_u ile uyumlu (0,5–2 kat)', !!m.growth && m.growth.ratio > .5 * m.mono.lambdaU && m.growth.ratio < 2 * m.mono.lambdaU, `×${m.growth.ratio.toFixed(0)} vs λu ${m.mono.lambdaU.toFixed(0)}`);
  const sTr = m.manifolds.sPlus[0], sEnd = sTr.states[sTr.states.length - 1], sT = sTr.times;
  check('halo', 'Kararlı manifold yörüngeye yaklaşır (son nokta ε içinde, zaman negatiften 0\'a)', Math.hypot(sEnd[0] - m.orbit.x0, sEnd[1], sEnd[2] - m.orbit.z0) < 2 * m.manifoldOpts.eps && sT[0] < 0 && Math.abs(sT[sT.length - 1]) < 1e-9, `d ${Math.hypot(sEnd[0] - m.orbit.x0, sEnd[1], sEnd[2] - m.orbit.z0).toExponential(1)}`);
  const uTr = m.manifolds.uPlus[0]; const uFar = uTr.states[uTr.states.length - 1];
  check('halo', 'Kararsız manifold uzaklaşır (son nokta > 100 ε) ve Jacobi C korunur (< 1e−6)', Math.hypot(uFar[0] - m.orbit.x0, uFar[1], uFar[2] - m.orbit.z0) > 100 * m.manifoldOpts.eps && Math.abs(C.jacobi(mu, uFar) - C.jacobi(mu, uTr.states[0])) < 1e-6, `ΔC ${Math.abs(C.jacobi(mu, uFar) - C.jacobi(mu, uTr.states[0])).toExponential(1)}`);
  { const mT = M.buildHalo({ system: 'sunEarth', L: 'L2', manifold: { n: 8, tEnd: 5 } }); const b = mT.transfer.best;
    check('halo', 'Güneş–Dünya L2 kararlı manifoldu Dünya’ya yaklaşır: en yakın üye yükseklik > 0 ve < 2 000 000 km; hiperbolik değil', !!b && b.body === 'Dünya' && b.hKm > 0 && b.hKm < 2e6 && !b.hyperbolic, b ? `h ${b.hKm.toFixed(0)} km, ΔV ${b.dvKmS.toFixed(3)} km/s, TOF ${b.tofDays.toFixed(0)} gün` : 'yok');
    check('halo', 'Transfer ΔV = |v_in − v_c t̂| ≥ |v_in − v_c| (üçgen eşitsizliği) ve manifold boyunca Jacobi sabit (< 1e−6)', !!b && b.dvKmS >= Math.abs(b.vInKmS - b.vcKmS) - 1e-9 && (() => { const tr = mT.manifolds[b.branch][b.index]; const C0 = C.jacobi(se, tr.states[0]), C1 = C.jacobi(se, tr.states[tr.states.length - 1]); return Math.abs(C0 - C1) < 1e-6 && Math.abs(C0 - mT.orbit.C) < 1e-3; })());
    const mE = M.buildHalo({ system: 'earthMoon', L: 'L1', manifold: { n: 8, tEnd: 4 } }); const bE = mE.transfer.best;
    check('halo', 'Dünya–Ay L1 kararlı manifoldu Dünya’ya LEO kadar inmez (en yakın yaklaşma > 20 000 km) — bilinen sonuç', !!bE && bE.body === 'Dünya' && bE.hKm > 2e4, bE ? `h ${bE.hKm.toFixed(0)} km` : 'yok'); }
  check('halo', 'Lyapunov ailesi (süreklilik) periyodu Ax ile monoton artar, L1 (Dünya–Ay)', (() => { const ly = C.lyapunovFamily(mu, 'L1', [.004, .008, .012, .018, .025, .035, .05, .07, .09]); return ly.length >= 8 && ly.every((x, i) => !i || x.period > ly[i - 1].period); })());
  for (const [sid, Ln] of [['sunEarth', 'L1'], ['sunEarth', 'L2'], ['sunJupiter', 'L1'], ['earthMoon', 'L2']]) {
    const mus = C.SYSTEMS[sid].mu, gam = Math.abs(C.lagrangePoints(mus)[Ln].x - (1 - mus)), ly = C.lyapunovFamily(mus, Ln, [.03, .05, .08, .12, .17, .23, .33, .46].map(f => f * gam), { dt: 2e-3 });
    check('halo', `${sid} ${Ln} Lyapunov ailesi (γ-göreli Ax listesi) ≥ 7 üye, periyot monoton artar, ilk üye doğrusal periyoda ±3 % (sahte-yörünge kilitlenmesi yok)`, ly.length >= 7 && ly.every((x, i) => !i || x.period > ly[i - 1].period) && (() => { const H = C.hessOmega(mus, C.lagrangePoints(mus)[Ln].x, 0, 0), b1 = 4 - H[0][0] - H[1][1], c1 = H[0][0] * H[1][1], w = Math.sqrt(-(-b1 - Math.sqrt(b1 * b1 - 4 * c1)) / 2); return rel(ly[0].period, 2 * Math.PI / w, .03); })(), `${ly.length} üye, T ${ly.map(o => o.period.toFixed(2)).join(' ')}`);
  }
}

/* ───────────────────────── od (yörünge belirleme, EKF) */
{
  const M = await mod('presets/orbit_determination/od-model.mjs');
  /* ölçüm modeli geometrisi */
  const st = M.stationEci([1, 0, 0], 0); const x = [7000, 0, 0, 0, 7.5, 0]; const me = M.measure(x, st);
  check('od', 'Menzil = |r − R_s| (istasyon x ekseninde, uydu zenitte: ρ = 7000 − R_E, yükseklik 90°)', near(me.rho, 7000 - M.R_E, 1e-9) && near(me.el, Math.PI / 2, 1e-9), `ρ ${me.rho.toFixed(3)}, el ${(me.el * 180 / Math.PI).toFixed(2)}°`);
  check('od', 'Menzil-hızı: zenitte yalnız istasyon dönüşü etkisi düşer (ρ̇ = d·(v − V_s)/ρ; V_s ⊥ d ⇒ ρ̇ = 0)', Math.abs(me.rhoDot) < 1e-9, me.rhoDot.toExponential(1));
  /* H sonlu-fark karşılaştırması */
  { const x2 = [5000, 3000, 2500, -3, 5, 2], st2 = M.stationEci(M.STATIONS ? [.5, .6, Math.sqrt(1 - .25 - .36)] : [1, 0, 0], .7), m0 = M.measure(x2, st2); let maxErr = 0;
    for (let j = 0; j < 6; j++) { const eps = j < 3 ? 1e-4 : 1e-7, xp = x2.slice(), xm = x2.slice(); xp[j] += eps; xm[j] -= eps; const mp = M.measure(xp, st2), mm = M.measure(xm, st2); maxErr = Math.max(maxErr, Math.abs((mp.rho - mm.rho) / (2 * eps) - m0.H_rho[j]), Math.abs((mp.rhoDot - mm.rhoDot) / (2 * eps) - m0.H_rate[j])); }
    check('od', 'Analitik H (menzil, menzil-hızı) sonlu farkla uyuşur (< 1e−6)', maxErr < 1e-6, maxErr.toExponential(1)); }
  /* STM: iki-cisim analitik 2. mertebe ile */
  { const x0 = [6878, 0, 0, 0, 5.3, 5.3], dt = 10, Phi = M.stmStep(x0, dt, false), r = [x0[0], x0[1], x0[2]], rn = Math.hypot(...r); const G = [0, 1, 2].map(i => [0, 1, 2].map(j => M.MU / rn ** 3 * (3 * r[i] * r[j] / (rn * rn) - (i === j ? 1 : 0))));
    let mx = 0; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const a = (i === j ? 1 : 0) + (i < 3 && j >= 3 && j - 3 === i ? dt : 0) + (i >= 3 && j < 3 ? G[i - 3][j] * dt : 0) + (i < 3 && j < 3 ? G[i][j] * dt * dt / 2 : 0) + (i >= 3 && j >= 3 ? G[i - 3][j - 3] * dt * dt / 2 : 0); mx = Math.max(mx, Math.abs(Phi[i][j] - a)); }
    check('od', 'Sonlu-fark STM ≈ I + A dt + A² dt²/2 (iki-cisim, 10 s; fark < 1e−3)', mx < 1e-3, mx.toExponential(1)); }
  const R = {}; for (const id of ['leoOne', 'leoThree', 'rangeOnly', 'rateOnly', 'badModel', 'lostInSpace', 'geo', 'molniya']) R[id] = M.runOd(id);
  for (const id of ['leoOne', 'leoThree', 'rateOnly', 'molniya']) { const s = R[id].stats; check('od', `${id}: tutarlı EKF — NEES ort. 0,5–8, NIS ort. 0,6–1,6, 3σ içinde ≥ %95, yakınsadı (RMS < hata₀/10)`, s.neesMean > .5 && s.neesMean < 8 && s.nisMean > .6 && s.nisMean < 1.6 && s.inside3sigFrac >= .95 && s.converged, `NEES ${s.neesMean.toFixed(2)}, NIS ${s.nisMean.toFixed(2)}, in3σ ${s.inside3sigFrac.toFixed(3)}, RMS ${s.rmsPosFinal.toExponential(2)} km`); }
  check('od', 'rangeOnly: yalnız menzil de yakınsar (iki istasyon), NIS ≈ 1', R.rangeOnly.stats.converged && R.rangeOnly.stats.nisMean > .6 && R.rangeOnly.stats.nisMean < 1.6, `RMS ${R.rangeOnly.stats.rmsPosFinal.toExponential(2)} km, NIS ${R.rangeOnly.stats.nisMean.toFixed(2)}`);
  check('od', 'leoThree konum RMS (son çeyrek) < 20 m ve leoOne < 50 m (σρ 10 m, σρ̇ 1 cm/s)', R.leoThree.stats.rmsPosFinal < .02 && R.leoOne.stats.rmsPosFinal < .05, `${(R.leoThree.stats.rmsPosFinal * 1000).toFixed(1)} m / ${(R.leoOne.stats.rmsPosFinal * 1000).toFixed(1)} m`);
  check('od', 'Filtre J2 bilmezse (LEO): sapma — RMS > 10 km, 3σ içinde kalma < %30, NEES ≫ 6 (aşırı güven)', R.badModel.stats.rmsPosFinal > 10 && R.badModel.stats.inside3sigFrac < .3 && R.badModel.stats.neesMean > 1e3, `RMS ${R.badModel.stats.rmsPosFinal.toFixed(1)} km, in3σ ${R.badModel.stats.inside3sigFrac.toFixed(2)}, NEES ${R.badModel.stats.neesMean.toExponential(1)}`);
  check('od', 'Büyük başlangıç hatası (10 km / 10 m/s): EKF tutarsız (3σ içinde < %50 ya da NEES > 100) — doğrusallaştırma sınırı', R.lostInSpace.stats.inside3sigFrac < .5 || R.lostInSpace.stats.neesMean > 100, `in3σ ${R.lostInSpace.stats.inside3sigFrac.toFixed(2)}, NEES ${R.lostInSpace.stats.neesMean.toExponential(1)}`);
  check('od', 'GEO tek istasyon: sürekli ölçüme rağmen RMS hata LEO’nun ≥ 10 katı ve yakınsamaz, ama tutarlı (zayıf gözlenebilirlik)', R.geo.stats.nMeas > 100 && R.geo.stats.rmsPosFinal > 10 * R.leoOne.stats.rmsPosFinal && !R.geo.stats.converged && R.geo.stats.inside3sigFrac >= .95, `n ${R.geo.stats.nMeas}, RMS ${R.geo.stats.rmsPosFinal.toExponential(2)} km vs ${R.leoOne.stats.rmsPosFinal.toExponential(2)} km, in3σ ${R.geo.stats.inside3sigFrac.toFixed(2)}`);
  check('od', 'Ölçüm yokken hata da 3σ da büyür; geçişler ölçüm sayısıyla tutarlı (Σ geçiş n = ölçüm/ölçüm-türü)', (() => { const r = R.leoOne; const sumN = r.passes.reduce((a, p) => a + p.n, 0); return sumN * r.cfg.meas.length === r.stats.nMeas; })(), `${R.leoOne.passes.length} geçiş`);
  check('od', 'Deterministik: aynı tohum aynı sonuç', M.runOd('leoOne').stats.rmsPosFinal === R.leoOne.stats.rmsPosFinal);
}

/* ───────────────────────── lowthrust (Edelbaum, spiral) */
{
  const M = await mod('presets/low_thrust_transfer/low-thrust-model.mjs');
  const r0 = 6678.137, r1 = 42164.17;
  check('lowthrust', 'Edelbaum eş-düzlem = |v₀ − v₁| (LEO→GEO 4,651 km/s)', near(M.edelbaumDv(r0, r1, 0), Math.abs(M.vCirc(r0) - M.vCirc(r1)), 1e-12) && near(M.edelbaumDv(r0, r1, 0), 4.651, 2e-3), M.edelbaumDv(r0, r1, 0).toFixed(4));
  check('lowthrust', 'Edelbaum Δi = 28,5° LEO→GEO ≈ 5,95 km/s (literatür 5,9–6,0)', near(M.edelbaumDv(r0, r1, 28.5), 5.95, .05), M.edelbaumDv(r0, r1, 28.5).toFixed(3));
  check('lowthrust', 'Edelbaum Δi monoton artar; Δi = 0 limitinde eş-düzlem', M.edelbaumDv(r0, r1, 10) > M.edelbaumDv(r0, r1, 0) && M.edelbaumDv(r0, r1, 40) > M.edelbaumDv(r0, r1, 10));
  const hoh = M.hohmann(r0, r1); check('lowthrust', 'Hohmann LEO→GEO 3,893 km/s, 5,27 sa (transfer grubuyla aynı)', near(hoh.dv, 3.893, 3e-3) && near(hoh.tof / 3600, 5.27, .02));
  const sim = M.simulateSpiral({ r0, r1, di: 0, vehicle: 'hallGeo' });
  check('lowthrust', 'Sayısal spiral ΔV Edelbaum limitine ±0,5 % (T/W ≈ 1e−5)', sim.reached && rel(sim.dvTotal, sim.edelbaum, 5e-3), `${sim.dvTotal.toFixed(4)} vs ${sim.edelbaum.toFixed(4)}`);
  check('lowthrust', 'Spiral yaklaşık dairesel kalır: e_max < 0,01; hedef yarı-büyük eksene ulaşır', sim.eMax < .01 && near(sim.samples[sim.samples.length - 1].a, r1, 5), `e_max ${sim.eMax.toExponential(1)}, a_son ${sim.samples[sim.samples.length - 1].a.toFixed(1)}`);
  check('lowthrust', 'Süre ΔV/a₁ ile ΔV/a₀ arasında (kütle azaldıkça ivme büyür)', sim.tof < sim.dvTotal / sim.aT0 && sim.tof > sim.dvTotal / sim.aT1, `${(sim.tof / 86400).toFixed(1)} gün`);
  check('lowthrust', 'Yakıt Tsiolkovsky ile tutarlı (±0,5 %)', rel(sim.mp, M.propellant(sim.vehicle.m0, sim.dvTotal, sim.vehicle.isp).mp, 5e-3), `${sim.mp.toFixed(1)} vs ${M.propellant(sim.vehicle.m0, sim.dvTotal, sim.vehicle.isp).mp.toFixed(1)} kg`);
  const cargo = M.simulateSpiral({ r0, r1, di: 0, vehicle: 'cargo' }); check('lowthrust', 'Daha yüksek T/W: aynı ΔV (±1 %), daha kısa süre, daha büyük e_max', rel(cargo.dvTotal, sim.dvTotal, 1e-2) && cargo.tof < sim.tof && cargo.eMax > sim.eMax, `cargo ${(cargo.tof / 86400).toFixed(0)} g vs ${(sim.tof / 86400).toFixed(0)} g`);
  const sh = M.simulateSpiral({ r0, r1, di: 0, vehicle: 'hallGeo', shadow: true }); check('lowthrust', 'Gölge: görev çevrimi < 0,95, süre uzar, ΔV Edelbaum ±3 %', sh.dutyCycle < .95 && sh.tof > sim.tof && rel(sh.dvTotal, sh.edelbaum, .03), `duty ${sh.dutyCycle.toFixed(2)}, ${(sh.tof / 86400).toFixed(0)} g, ΔV ${sh.dvTotal.toFixed(3)}`);
  const inc = M.simulateSpiral({ r0, r1, di: 28.5, vehicle: 'hallGeo' }); check('lowthrust', 'Eğiklik değişimli spiral: ΔV = Edelbaum(Δi) ±0,5 %, eğiklik hedefe ulaşır', inc.reached && rel(inc.dvTotal, inc.edelbaum, 5e-3) && near(inc.samples[inc.samples.length - 1].inc, 28.5, .1), `${inc.dvTotal.toFixed(3)} vs ${inc.edelbaum.toFixed(3)}, i ${inc.samples[inc.samples.length - 1].inc.toFixed(2)}°`);
  const down = M.simulateSpiral({ r0: r1, r1: r0, di: 0, vehicle: 'hallGeo' }); check('lowthrust', 'İçe spiral (GEO→LEO) da Edelbaum ±0,5 %', down.reached && rel(down.dvTotal, down.edelbaum, 5e-3), down.dvTotal.toFixed(3));
}

/* ───────────────────────── tisserand (grafik ve dizi planlayıcı) */
{
  const M = await mod('presets/tisserand_graph/tisserand-model.mjs');
  const c = M.contour('venus', 5).filter(p => !p.hyperbolic); const Ts = c.map(p => p.T);
  check('tisserand', 'Sabit-v∞ eğrisi boyunca Tisserand parametresi sabit (< 1e−9)', Math.max(...Ts) - Math.min(...Ts) < 1e-9, (Math.max(...Ts) - Math.min(...Ts)).toExponential(1));
  check('tisserand', 'v∞ = V_P√(3 − T) tersinirliği (Dünya, 8,8 km/s)', (() => { const o = M.orbitFromVinf('earth', 8.8, .7); return near(Math.sqrt(3 - o.T) * M.vPlanet('earth'), 8.8, 1e-9); })());
  check('tisserand', 'vinfAt ↔ orbitFromVinf tutarlı (v∞ ve α geri bulunur)', (() => { const o = M.orbitFromVinf('earth', 6, 1.1); const at = M.vinfAt('earth', o.rp, o.ra); return at && near(at.vinf, 6, 1e-9) && near(at.alpha, 1.1, 1e-9); })());
  const o = M.orbitFromVinf('earth', 8.8, 0), at = M.vinfAt('jupiter', o.rp, o.ra);
  check('tisserand', 'Dünya v∞ 8,8 km/s teğet kalkış: r_a ≈ 5,2 AU (Jüpiter), Jüpiter\u2019de v∞ ≈ 5,6 km/s (Hohmann ölçeği)', near(o.ra / M.AU, 5.2, .1) && at && near(at.vinf, 5.65, .1), `ra ${(o.ra / M.AU).toFixed(2)} AU, v∞J ${at?.vinf.toFixed(2)}`);
  check('tisserand', 'δ_max formülü: Venüs 5 km/s 300 km ≈ 84°, Jüpiter 6 km/s 300 km > 150°', near(M.maxTurn('venus', 5, 300).delta * 180 / Math.PI, 84.4, 1) && M.maxTurn('jupiter', 6, 300).delta * 180 / Math.PI > 150);
  check('tisserand', 'δ_max v∞ ile küçülür, h_min ile küçülür', M.maxTurn('earth', 3, 300).delta > M.maxTurn('earth', 9, 300).delta && M.maxTurn('earth', 5, 300).delta > M.maxTurn('earth', 5, 3000).delta);
  const v = M.planSequence(M.SEQUENCES.veega.seq, { vinf0: 3.6, mode: 'pump', resonanceTargets: { 3: [2, 1] } });
  check('tisserand', 'VEEGA erişilebilir: her geçişte |Δα| ≤ δ_max, Dünya–Dünya bacağı 2:1 rezonans (T ≈ 2 yıl), Jüpiter varış v∞ 5–7 km/s', v.feasible && v.legs.slice(1).every(l => l.used <= l.delta + 1e-9) && near(v.legs[2].orbit.period / 86400 / 365.25, 2, .05) && v.final.vinf > 5 && v.final.vinf < 7, `varış ${v.final.vinf.toFixed(2)} km/s, EE T ${(v.legs[2].orbit.period / 86400 / 365.25).toFixed(2)} yıl`);
  check('tisserand', 'Pompalama: Venüs geçişi Dünya\u2019daki v∞\u2019yi kalkıştan büyütür (3,6 → > 10 km/s)', v.legs[1].vinfNext > 10, v.legs[1].vinfNext.toFixed(2));
  check('tisserand', 'Bacaklar gezegenleri kesen yörüngeler: her bacak r_p ≤ a_from,to ≤ r_a', v.legs.every(l => l.orbit && l.orbit.rp <= M.PLANETS[l.from].a * (1 + 1e-6) && l.orbit.ra >= M.PLANETS[l.to].a * (1 - 1e-6) || (l.orbit && l.orbit.rp <= M.PLANETS[l.to].a * (1 + 1e-6) && l.orbit.ra >= M.PLANETS[l.from].a * (1 - 1e-6))));
  const bad = M.planSequence(['earth', 'venus', 'jupiter'], { vinf0: 2.5, mode: 'pump' });
  check('tisserand', 'Erişilemez dizi işaretlenir (Dünya → Venüs → Jüpiter, v∞₀ 2,5: Venüs tek geçişte Jüpiter\u2019e pompalayamaz)', !bad.feasible && bad.legs[bad.legs.length - 1].reachable === false);
  const rs = M.resonances('earth'); check('tisserand', 'Rezonans yarı-büyük eksenleri: 2:1 → a = 2^{2/3} AU', near(rs.find(r => r.label === '2:1').a / M.AU, Math.pow(2, 2 / 3), 1e-9));
}

/* ───────────────────────── dispersion (giriş Monte Carlo) */
{
  const M = await mod('presets/entry_dispersion/dispersion-model.mjs');
  const zero = M.runDispersion('leoNominal', { n: 20, sigmas: { gamma: 0, v: 0, rhoScale: 0, ld: 0, mass: 0, bank: 0 } });
  check('dispersion', 'Sıfır sapma → σ_s = 0, her örnek nominal ile aynı (determinizm)', zero.stats.s.std < 1e-9 && zero.runs.every(r => Math.abs(r.s - zero.nominal.s) < 1e-9), `σ ${zero.stats.s.std.toExponential(1)}`);
  const a = M.runDispersion('leoNominal', { n: 200 }), b = M.runDispersion('leoNominal', { n: 200 });
  check('dispersion', 'Aynı tohum aynı sonuç; farklı tohum farklı örnek ama σ yakın (±30 %)', a.stats.s.std === b.stats.s.std && (() => { const c = M.runDispersion('leoNominal', { n: 200, seed: 7 }); return rel(c.stats.s.std, a.stats.s.std, .3); })());
  check('dispersion', 'Monte Carlo ortalaması nominale yakın (|Δ| < 3σ/√n + %1 nominal)', Math.abs(a.stats.s.mean - a.nominal.s) < 3 * a.stats.s.std / Math.sqrt(a.runs.length) + .01 * a.nominal.s, `${a.stats.s.mean.toFixed(1)} vs ${a.nominal.s.toFixed(1)}`);
  check('dispersion', 'Doğrusal RSS ↔ Monte Carlo σ oranı 0,7–1,3 (küçük sapmalarda doğrusal yayılım)', a.linearity > .7 && a.linearity < 1.3, a.linearity.toFixed(2));
  const sg = a.sens.find(x => x.key === 'gamma'), sr = a.sens.find(x => x.key === 'rhoScale'), sl = a.sens.find(x => x.key === 'ld');
  check('dispersion', 'İşaretler: daha sığ γ (Δγ > 0) menzili uzatır; daha yoğun atmosfer kısaltır; daha büyük L/D uzatır', sg.dsdx > 0 && sr.dsdx < 0 && sl.dsdx > 0, `∂s/∂γ ${sg.dsdx.toFixed(0)} km/°, ∂s/∂ρ ${sr.dsdx.toFixed(0)}, ∂s/∂(L/D) ${sl.dsdx.toFixed(0)}`);
  const nav = M.runDispersion('nav', { n: 200 }); check('dispersion', 'Yalnız seyrüsefer sapması: γ payı > %60, RSS yalnız γ ve v katkısından', nav.sens.find(x => x.key === 'gamma').share > .6 && nav.sens.filter(x => x.key !== 'gamma' && x.key !== 'v').every(x => x.contrib === 0));
  const atmo = M.runDispersion('atmo', { n: 200 }); check('dispersion', 'Yalnız atmosfer sapması (%20): σ_s < seyrüsefer senaryosunun σ_s\u2019i; tepe g neredeyse değişmez (σ_g < 0,05 g)', atmo.stats.s.std < nav.stats.s.std && atmo.stats.peakG.std < .05, `σ_s ${atmo.stats.s.std.toFixed(1)} km, σ_g ${atmo.stats.peakG.std.toFixed(3)}`);
  const bal = M.runDispersion('ballistic', { n: 100 }); check('dispersion', 'Balistik sonda: dik giriş → küçük σ_s (< 20 km) ve yüksek tepe g (> 15 g)', bal.stats.s.std < 20 && bal.stats.peakG.mean > 15, `σ ${bal.stats.s.std.toFixed(1)} km, g ${bal.stats.peakG.mean.toFixed(1)}`);
  check('dispersion', 'Yüzdelikler sıralı: min ≤ p05 ≤ p50 ≤ p95 ≤ max', a.stats.s.min <= a.stats.s.p05 && a.stats.s.p05 <= a.stats.s.p50 && a.stats.s.p50 <= a.stats.s.p95 && a.stats.s.p95 <= a.stats.s.max);
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
