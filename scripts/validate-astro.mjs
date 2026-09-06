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
  const { atmosphere, G0 } = await mod('presets/core/astro-atmosphere.mjs');
  const s = R.simulateEntry(R.VEHICLES.capsule, { vEntry: 7800, gammaEntry: -6, bank: 0 });
  check('reentry', 'LEO −6° kapsül girişi 10 km\'ye iner', s.outcome === 'landed');
  /* tepe yavaşlama: n = D/m/g0 tanımıyla örnekte tutarlı */
  const pk = s.samples.find(x => x.t === s.peakG.t);
  const nCalc = Math.hypot(1, s.vehicle.ld) * .5 * atmosphere(pk.h).rho * pk.v * pk.v * s.vehicle.cd * s.vehicle.area / s.vehicle.m / G0;
  check('reentry', 'tepe g, ½ρv²C_D A/m tanımıyla örtüşür', rel(pk.n, nCalc, 1e-6), `${pk.n.toFixed(2)} g @ ${(pk.h / 1e3).toFixed(0)} km`);
  /* Sutton–Graves: q̇ ∝ v³ √ρ — örnekte doğrula */
  const pq = s.samples.find(x => x.t === s.peakQ.t);
  check('reentry', 'Sutton–Graves q̇ = k√(ρ/r_n)v³ örnekte tutarlı', rel(pq.q, R.K_SG * Math.sqrt(atmosphere(pq.h).rho / s.vehicle.rn) * pq.v ** 3, 1e-9));
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
  check('reentry', 'eş-yavaşlama eğrisi: n = ½ρv²/β/g₀ = 5 g', near(.5 * atmosphere(p.h).rho * p.v * p.v / s.beta / G0, 5, 1e-9));
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
