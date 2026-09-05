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
