#!/usr/bin/env node
/* validate-life-signs.mjs — NEFES kütüphanesi denetimleri (three'siz).
   docs/breathing-motion-plan.md §8'in yedi maddesi.

   Kullanım: node scripts/validate-life-signs.mjs    Çıkış: HATA varsa 1 */

/* fileURLToPath, not `new URL(...).pathname`: the pathname is
   percent-encoded, so a folder with a space in its name came back as
   `Custom%20Yetenekler` and pathToFileURL then encoded the percent
   again. Every import missed, and only in the checkout that has a
   space in its path - which is the one people actually work in. */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const L = await mod('presets/core/life-signs.mjs');
const C = await mod('presets/life_signs/catalog.mjs');
const B = await mod('presets/life_signs/budget.mjs');
const { createIdleModel } = await mod('presets/cinematic_space/spatial-idle.mjs');

let fails = 0, total = 0;
const check = (name, ok, detail = '') => { total++; console.log(`  ${ok ? 'ok ' : 'HATA'} ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) fails++; };
const DEG = Math.PI / 180;

/* ── 1) ölçüşmezlik ──────────────────────────────────────────────────── */
console.log('== 1 spektrum: en güçlü iki bileşen ölçüşmez');
{
  /* Sorulacak doğru soru "oran rasyonel mi" değil, "desen NE ZAMAN
     tekrar ediyor". f₁ = p·g ve f₂ = q·g ise sahne 1/g'de bir kendini
     tekrarlar; göz ancak KISA bir ortak periyodu yakalayabilir.

     Oranın sürekli kesir yakınsayanları taranır: yeterince iyi bir p/q
     bulunursa ortak periyot p/f₁'dir. φ türevi oranlarda hiçbir yakınsayan
     yeterince iyi olmaz, periyot pratikte sonsuzdur.

     Eşik 120 s: iki dakikadan uzun bir tekrar, izleyicinin belleğinde
     desen olarak durmaz. (Plan §8.1'in "p/q ≤ 12" ifadesi bunun kaba bir
     vekiliydi; yalnız q'yu sınırlamak 88,1 gibi bir oranı 793/9 diye
     "rasyonel" ilan ediyordu — ortak periyodu 16 dakika olduğu hâlde.) */
  const TEKRAR_ESIGI = 120;
  const ortakPeriyot = (f1, f2) => {
    const hi = Math.max(f1, f2), lo = Math.min(f1, f2);
    if (!(lo > 0) || !Number.isFinite(hi)) return Infinity;
    let r = hi / lo, p0 = 1, q0 = 0, p1 = Math.floor(r), q1 = 1, x = r;
    for (let i = 0; i < 24; i++) {
      const frac = x - Math.floor(x);
      if (frac < 1e-12) break;
      x = 1 / frac;
      const a = Math.floor(x);
      const p2 = a * p1 + p0, q2 = a * q1 + q0;
      p0 = p1; q0 = q1; p1 = p2; q1 = q2;
      if (q1 > 5000) break;
    }
    /* yakınsayan yeterince iyi mi (ölçüm hassasiyeti mertebesinde)? */
    if (Math.abs(r - p1 / q1) > 1e-9 * r) return Infinity;
    return p1 / hi;                      // saniye
  };

  const kotu = [];
  for (const [id, yap] of Object.entries(C.BUILDERS)) {
    const b = yap();
    const fs = (b.frequencies() || []).filter(x => Number.isFinite(x) && x > 0);
    if (fs.length < 2) continue;
    fs.sort((a, b2) => b2 - a);
    const T = ortakPeriyot(fs[0], fs[1]);
    if (T < TEKRAR_ESIGI) kotu.push(`${id}: ortak periyot ${T.toFixed(1)} s`);
  }
  check(`her davranışın ortak periyodu > ${TEKRAR_ESIGI} s`, kotu.length === 0,
    kotu.join(' | ') || `${Object.keys(C.BUILDERS).length} davranış`);
  check('φ ve φ³ oranları desen üretmiyor (periyot sonsuz)',
    ortakPeriyot(L.PHI, 1) === Infinity && ortakPeriyot(L.PHI3, 1) === Infinity);
  /* Ters sınav: kısa ortak periyot YAKALANMALI, yoksa denetim boş geçer. */
  check('denetim çalışıyor (3/2 → 2 s, 15/4 → 5 s yakalanıyor)',
    Math.abs(ortakPeriyot(1.5, 1) - 2) < 1e-9 && Math.abs(ortakPeriyot(3, 0.8) - 5) < 1e-9);
  check('uzun ortak periyot desen sayılmıyor (0,8 ↔ 0,00908 Hz → 16 dk)',
    ortakPeriyot(0.8, 0.8 / 88.105) > TEKRAR_ESIGI);
  /* Tek sinüs yasağı: pürüz zarfı gerçekten iki ölçüşmez sinüs mü? */
  const pur = L.roughness(5, 14);
  check('pürüz zarfı iki ölçüşmez sinüs ve [0,55–1] bandında',
    ortakPeriyot(pur.f1, pur.f2) >= TEKRAR_ESIGI, `ortak periyot ${ortakPeriyot(pur.f1, pur.f2).toFixed(0)} s`);
  let lo = 2, hi = -2;
  for (let t = 0; t < 4000; t += 0.13) { const v = pur(t); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  check('zarf sıfıra inmiyor, üstü 1', lo > 0.549 && hi <= 1.0001, `[${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
}

/* ── 2) genlik bütçesi ───────────────────────────────────────────────── */
console.log('== 2 genlik bütçesi (§4.1) aşılmıyor');
{
  const N = 10000, dt = 0.0417;
  const asan = [];
  for (const [id, yap] of Object.entries(C.BUILDERS)) {
    const b = yap();
    const lim = b.limits || {};
    let maxKonum = 0, maxAci = 0, maxOlcek = 0, maxIsik = 0;
    for (let i = 0; i < N; i++) {
      const s = b.sample(i * dt) || {};
      for (const [k, v] of Object.entries(s)) {
        if (typeof v !== 'number') continue;
        const birim = (lim.kanal || {})[k];
        if (birim === 'nesne boyu') maxKonum = Math.max(maxKonum, Math.abs(v));
        else if (birim === 'rad') maxAci = Math.max(maxAci, Math.abs(v));
        else if (birim === 'ölçek Δ') maxOlcek = Math.max(maxOlcek, Math.abs(v));
        else if (birim === '0..1') maxIsik = Math.max(maxIsik, Math.abs(v));
      }
    }
    if (lim.konumMax !== undefined && maxKonum > lim.konumMax + 1e-6) asan.push(`${id} konum ${maxKonum.toFixed(3)} > ${lim.konumMax}`);
    if (lim.aciMax !== undefined && maxAci > lim.aciMax + 1e-6) asan.push(`${id} açı ${(maxAci / DEG).toFixed(2)}° > ${(lim.aciMax / DEG).toFixed(2)}°`);
    if (lim.olcekMax !== undefined && maxOlcek > lim.olcekMax + 1e-9) asan.push(`${id} ölçek ${maxOlcek.toFixed(4)} > ${lim.olcekMax}`);
    if (maxIsik > 1.0001) asan.push(`${id} ışık ${maxIsik.toFixed(3)} > 1`);
  }
  check(`${N} örnekte hiçbir davranış ilan ettiği sınırı aşmıyor`, asan.length === 0, asan.join(' | '));

  /* Plan §4.1 çapaları: ölçek ≤ %1,3, açı ≤ 0,6° (salınım kanallarında) */
  const nefes = C.craftBreath();
  let m = 0; for (let i = 0; i < 5000; i++) m = Math.max(m, Math.abs(nefes.sample(i * 0.05).nefes));
  check('craftBreath ölçeği ≤ %1,3', m <= 0.013 + 1e-9, `%${(m * 100).toFixed(3)}`);
}

/* ── 3) sahne bütçesi ────────────────────────────────────────────────── */
console.log('== 3 sahne bütçesi: Σ salience ≤ 1,0 ve fark edilir ≤ 3');
{
  /* Orta mesafede üç davranış sığar: 0,5 + 0,15 + 0,2 = 0,85 × kazanç. */
  const bud = B.createBudget();
  const r1 = bud.add(C.roverGaze(), { distance: 22 });      // birincil
  const r2 = bud.add(C.roverBeacon(), { distance: 22 });    // ikincil
  const r3 = bud.add(C.craftBreath(), { distance: 22 });    // ikincil
  check('orta mesafede üç davranış kabul edildi', r1.kabul && r2.kabul && r3.kabul,
    `Σ ${bud.total().toFixed(3)}`);
  const rep = bud.report();
  check('rapor sınırları geçiyor', rep.gecti, `Σ ${rep.toplam}, fark edilir ${rep.farkedilir}`);

  /* Aynı üçlü YAKIN planda sığmaz: yakınlık salience'ı büyütür, üçüncüsü
     reddedilir. Bütçenin işi tam da budur — yakın planda daha AZ şey
     nefes alır. */
  const yakin = B.createBudget();
  const y1 = yakin.add(C.roverGaze(), { distance: 6 });
  const y2 = yakin.add(C.roverBeacon(), { distance: 6 });
  const y3 = yakin.add(C.craftBreath(), { distance: 6 });
  check('yakın planda üçüncüsü reddedilir (yakınlık bütçeyi daraltır)',
    y1.kabul && y2.kabul && !y3.kabul, `Σ ${yakin.total().toFixed(3)} + 0,27 > 1,0`);

  /* Dördüncü FARK EDİLİR davranış reddedilmeli. */
  const bud2 = B.createBudget();
  for (const b of [C.roverGaze(), C.rcsPuff(), C.documentaryArc()]) bud2.add(b, { distance: 10 });
  const red = bud2.add(C.craftStationKeeping(), { distance: 10 });
  check('dördüncü fark edilir davranış REDDEDİLDİ', !red.kabul, red.neden ? red.kod : 'kabul edildi!');

  /* Salience toplamı taşarsa reddedilmeli. */
  const bud3 = B.createBudget({ maxNoticeable: 99 });
  bud3.add(C.roverGaze(), { distance: 2 });                 // 0,5 × 1,45
  const tas = bud3.add(C.craftStationKeeping(), { distance: 2 });
  check('salience toplamı 1,0\'ı aşınca reddedildi', !tas.kabul && tas.kod === 'toplam', `Σ denendi ${(0.5 * 1.45 + 0.4 * 1.45).toFixed(2)}`);

  /* Uzaklık salience'ı küçültür: aynı davranış uzak planda eşik altına iner. */
  check('yakınlık kazancı uzakta 1\'in altında', B.proximityGain(40) < 1 && B.proximityGain(2) > 1,
    `yakın ${B.proximityGain(2).toFixed(2)} · uzak ${B.proximityGain(40).toFixed(2)}`);
  /* hudSettle salience 0: bütçe tüketmez. */
  const bud4 = B.createBudget();
  bud4.add(C.hudSettle(), {});
  check('hudSettle bütçe tüketmiyor (boşta hareket yok)', bud4.total() === 0);
}

/* ── 4) hız sınırı ───────────────────────────────────────────────────── */
console.log('== 4 mekanik davranışlar hız sınırını aşmıyor (§4.6)');
{
  const gaze = C.roverGaze({ rateDegS: 12 });
  let maxRate = 0;
  const dt = 1 / 240;
  let onceki = gaze.sample(0).pan;
  for (let i = 1; i < 240 * 400; i++) {
    const v = gaze.sample(i * dt).pan;
    maxRate = Math.max(maxRate, Math.abs(v - onceki) / dt);
    onceki = v;
  }
  check('direk 12°/s\'yi aşmıyor', maxRate <= 12 * DEG * 1.02, `${(maxRate / DEG).toFixed(2)}°/s`);

  const hga = C.roverHgaTrack();
  let hr = 0, o2 = hga.sample(0).az;
  for (let i = 1; i < 240 * 200; i++) { const v = hga.sample(i * dt).az; hr = Math.max(hr, Math.abs(v - o2) / dt); o2 = v; }
  check('HGA 4°/s\'yi aşmıyor', hr <= 4 * DEG * 1.02, `${(hr / DEG).toFixed(3)}°/s`);

  /* saccadeSettle'ın kapalı formu: büyük adım daha UZUN sürer, hız sabit kalır. */
  const sac = L.saccadeSettle({ rateMax: 12 * DEG, omegaMax: 2.2 });
  const h1 = sac.settleTime(20 * DEG), h2 = sac.settleTime(80 * DEG);
  check('büyük adım daha uzun sürer (hız sınırı gerçek)', h2 > h1 * 1.5, `20° ${h1.toFixed(1)} s · 80° ${h2.toFixed(1)} s`);
  let pik = 0;
  for (let tau = 0; tau < 30; tau += 0.005) pik = Math.max(pik, Math.abs(sac.rateAt(80 * DEG, tau)));
  check('kapalı form tepe hızı rateMax içinde', pik <= 12 * DEG * 1.001, `${(pik / DEG).toFixed(2)}°/s`);
}

/* ── 5) yasak sınıf bağlanamaz ───────────────────────────────────────── */
console.log('== 5 yasak sınıflar (§3.3) reddediliyor');
{
  const bud = B.createBudget();
  const kotu = [];
  for (const cls of B.FORBIDDEN_CLASSES) {
    const r = bud.add(C.craftBreath(), { sinif: cls });
    if (r.kabul) kotu.push(cls);
  }
  check('arazi/alan/yörünge/gölge/HUD sınıfları reddedildi', kotu.length === 0, `${B.FORBIDDEN_CLASSES.length} sınıf`);
  const bind = await mod('presets/life_signs/bind.mjs');
  let atti = false;
  try { bind.bindBehaviour(C.craftBreath(), {}, { sinif: 'terrain' }); } catch { atti = true; }
  check('bind de reddediyor (sessiz geçiş yok)', atti);
  /* 'bekliyor' durumundaki davranış sahneye bağlanamaz. */
  const bek = bud.add(C.BEKLEYEN[0], {});
  check('bekleyen davranış sahneye bağlanamaz', !bek.kabul && bek.kod === 'durum');
}

/* ── 6) determinizm ve kadans ────────────────────────────────────────── */
console.log('== 6 determinizm ve kadans');
{
  const a = C.roverGaze({ seed: 99 }), b = C.roverGaze({ seed: 99 }), c = C.roverGaze({ seed: 100 });
  const im = (x) => Array.from({ length: 200 }, (_, i) => x.sample(i * 0.7).pan.toFixed(9)).join(',');
  check('aynı tohum → aynı kareler', im(a) === im(b));
  check('farklı tohum → farklı kareler', im(a) !== im(c));

  /* Kadans: saf f(t) olduğu için 1/60 ve 1/120 AYNI t'de aynı değeri verir. */
  const g = C.roverGaze({ seed: 7 });
  let maxd = 0;
  for (let i = 0; i < 6000; i++) {
    const t = i / 120;
    if (i % 2 === 0) maxd = Math.max(maxd, Math.abs(g.sample(t).pan - g.sample((i / 2) / 60).pan));
  }
  check('1/60 ve 1/120 aynı t\'de aynı değer', maxd === 0, `Δ ${maxd}`);

  /* SÜREKLİLİK (C0) doğru ölçütle: "kare başına delta küçük olsun" yanlış
     bir sınavdır — hızlı ama sürekli bir kalkış (RCS pufu 0,06 s) onu
     tetikler, gerçek bir sıçrama ise yavaş kanalda gizlenir. Ayırt edici
     olan ÖLÇEKLENME: sürekli bir fonksiyonda adım küçülünce delta da
     küçülür; süreksizlikte delta aynı kalır. */
  const sicrama = [];
  for (const [id, yap] of Object.entries(C.BUILDERS)) {
    const bb = yap();
    const lim = bb.limits || {};
    const atla = (k) => {
      const birim = (lim.kanal || {})[k];
      return birim === 'ad' || k === 'eksen' || k === 'yon' || k === 'pay' || k === 'panorama' || k === 'durum';
    };
    const enBuyuk = (dt, n) => {
      let onceki = null, worst = 0;
      for (let i = 0; i < n; i++) {
        const s2 = bb.sample(i * dt);
        if (onceki) for (const [k, v] of Object.entries(s2)) {
          if (typeof v !== 'number' || atla(k)) continue;
          worst = Math.max(worst, Math.abs(v - onceki[k]));
        }
        onceki = s2;
      }
      return worst;
    };
    const kaba = enBuyuk(1 / 60, 30000);
    if (kaba < 1e-9) continue;
    const ince = enBuyuk(1 / 240, 120000);
    /* 4 kat sık örneklemede delta en az 2 kat düşmeli (sürekli);
       süreksizlikte oran 1'e yakın kalır. */
    if (kaba / Math.max(ince, 1e-12) < 2) sicrama.push(`${id} 1/60 Δ${kaba.toFixed(3)} · 1/240 Δ${ince.toFixed(3)}`);
  }
  check('delta örnekleme adımıyla küçülüyor (süreksizlik yok)', sicrama.length === 0, sicrama.join(' | '));

  /* Reduced: bütçe tek kareyi dondurur. */
  const bud = B.createBudget().setReduced(true, 3.5);
  bud.add(C.roverGaze(), {});
  const s1 = bud.sample(0), s2 = bud.sample(1000);
  check('reduced motion: davranışlar donuyor', JSON.stringify(s1) === JSON.stringify(s2));
}

/* ── 7) spatial-idle geçişi ──────────────────────────────────────────── */
console.log('== 7 cinematic_space geçişi: aynı tohum → AYNI kare');
{
  /* Plan §7.7 piksel-diff istiyor; sayısal eşitlik ondan güçlüdür ve
     Node'da koşar: kütüphane modeli mevcut sahne modelinin YERİNE
     geçtiğinde tek bir piksel bile değişmemeli. */
  let maxd = 0;
  for (const seed of [20260816, 7, 424242]) {
    const yeni = L.stationKeeping(seed), eski = createIdleModel(seed);
    for (let t = 0; t < 300; t += 0.23) {
      const x = yeni.sample(t), y = eski.sample(t);
      for (const k of Object.keys(y.craft)) maxd = Math.max(maxd, Math.abs(x.craft[k] - y.craft[k]));
      maxd = Math.max(maxd, Math.abs(x.burn - y.burn));
      for (const k of Object.keys(y.camera)) maxd = Math.max(maxd, Math.abs(x.camera[k] - y.camera[k]));
    }
  }
  check('life-signs stationKeeping ≡ spatial-idle (3 tohum, 1300 kare)', maxd < 1e-12, `Δmax ${maxd.toExponential(1)}`);
  const cs = C.craftStationKeeping({ seed: 20260816 });
  const ref = createIdleModel(20260816).sample(12.5);
  const got = cs.sample(12.5);
  check('katalog satırı da aynı sayıyı veriyor', Math.abs(got.x - ref.craft.x) < 1e-12 && Math.abs(got.burn - ref.burn) < 1e-12);
}

/* ── 8) katalog bütünlüğü ────────────────────────────────────────────── */
console.log('== 8 katalog: plan §6 tablosunun tamamı hesapta');
{
  const rows = C.catalogRows();
  check('22 satır (14 uygulandı + 1 reddedildi + 7 bekliyor)',
    rows.length === 22 && rows.filter(r => r.durum === 'uygulandı').length === 14
    && rows.filter(r => r.durum === 'reddedildi').length === 1
    && rows.filter(r => r.durum === 'bekliyor').length === 7,
    `${rows.length} satır`);
  const eksik = rows.filter(r => !r.neden || (r.durum === 'uygulandı' && (!r.model || !r.duygu && r.salience !== 0)));
  check('her satırda NEDEN (gerçek boşta davranış gerekçesi) var', eksik.length === 0, eksik.map(r => r.id).join(','));
  check('reddedilen satır gerekçesiyle duruyor',
    rows.find(r => r.id === 'roverArmTwitch').neden.includes('kilitli'));
  const bek = rows.filter(r => r.durum === 'bekliyor');
  check('bekleyen her satır hangi planı beklediğini söylüyor', bek.every(r => r.plan && r.plan.endsWith('.md')), bek.length + ' satır');
  check('kimlikler benzersiz', new Set(rows.map(r => r.id)).size === rows.length);
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
