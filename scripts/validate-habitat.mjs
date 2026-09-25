/* validate-habitat.mjs — habitat kataloğu ve hat yönlendirme denetimi.
 *
 * Buradaki sınavların çoğu ANALİTİK KİMLİKTİR: sonucu bağımsız bir yoldan
 * hesaplayıp karşılaştırır. "Makul görünüyor" bir ölçüt değildir; gözün
 * yakalayamadığı şey sayının yakaladığı şeydir.
 *
 * Her bölümün sonunda TERS SINAV vardır: kasten bozulmuş bir girdi
 * YAKALANMAK zorundadır. Yakalanmazsa sınav değersizdir.
 *
 * Koşum: node scripts/validate-habitat.mjs
 */

import * as THREE from '../presets/moon_advanced/vendor/three.module.min.js';
import * as H from '../presets/habitat_blocks/hab-parts.mjs';
import * as AST from '../presets/astronaut_blocks/astro-parts.mjs';
const { massBudget, partById } = H;
import * as R from '../presets/habitat_blocks/routing.mjs';
import { createAssembly } from '../presets/core/assembly.mjs';
import { assemblyFromCatalog } from '../presets/exploded_view/adapters/catalog.mjs';

let gecti = 0, kaldi = 0;
const bolum = (ad) => console.log(`\n── ${ad} ${'─'.repeat(Math.max(0, 58 - ad.length))}`);
function ok(kosul, ad, detay = '') {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}${detay ? '  ' + detay : ''}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay ? '  ' + detay : ''}`); }
}
const yakin = (a, b, tol) => Math.abs(a - b) <= tol;
const bagil = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

/* ══ 1. KATALOG BÜTÜNLÜĞÜ ═══════════════════════════════════════════ */
bolum('1. Katalog bütünlüğü');
{
  const idler = H.PARTS.map(p => p.id);
  ok(new Set(idler).size === idler.length, 'kimlikler benzersiz', `${idler.length} bileşen`);

  const bilinmeyen = H.PARTS.filter(p => p.mountsTo && !H.partById(p.mountsTo));
  ok(bilinmeyen.length === 0, 'her mountsTo çözülüyor',
    bilinmeyen.length ? bilinmeyen.map(p => `${p.id}→${p.mountsTo}`).join(',') : '');

  const kokler = H.PARTS.filter(p => p.mountsTo === null);
  ok(kokler.length === 1 && kokler[0].id === 'platform', 'tek kök var ve o platform',
    kokler.map(p => p.id).join(','));

  /* Döngü yok: her bileşenden köke giden yol sonlu olmalı. */
  let dongu = null;
  for (const p of H.PARTS) {
    const gorulen = new Set([p.id]);
    let q = p;
    while (q.mountsTo) {
      if (gorulen.has(q.mountsTo)) { dongu = `${p.id}…${q.mountsTo}`; break; }
      gorulen.add(q.mountsTo);
      q = H.partById(q.mountsTo);
    }
    if (dongu) break;
  }
  ok(!dongu, 'montaj ağacında döngü yok', dongu || '');

  /* Adım tutarlılığı: bir bileşen ebeveyninden ÖNCE takılamaz. */
  const ters = H.PARTS.filter(p => p.mountsTo && p.step < H.partById(p.mountsTo).step);
  ok(ters.length === 0, 'hiçbir bileşen ebeveyninden önce takılmıyor',
    ters.map(p => `${p.id}(${p.step})<${p.mountsTo}(${H.partById(p.mountsTo).step})`).join(','));

  ok(H.PARTS.every(p => Array.isArray(p.size) && p.size.length === 3 && p.size.every(v => v > 0)),
    'bütün ölçüler pozitif ve üç bileşenli');
  ok(H.PARTS.every(p => Array.isArray(p.pos) && p.pos.length === 3 && p.pos.every(Number.isFinite)),
    'bütün konumlar sonlu');
  ok(H.PARTS.every(p => H.SUBSYSTEMS[p.sistem]), 'her bileşenin sistemi tanımlı');
  ok(H.PARTS.every(p => H.INTERFACES[p.arayuz]), 'her bileşenin arayüzü tanımlı');

  /* Gerekçe: "neden" alanı bir etiket değil, bir cümle olmalı. */
  const kisa = H.PARTS.filter(p => !p.why || p.why.length < 70);
  ok(kisa.length === 0, 'her bileşen en az bir cümlelik gerekçe taşıyor',
    kisa.length ? kisa.map(p => p.id).join(',') : `en kısa ${Math.min(...H.PARTS.map(p => p.why.length))} karakter`);

  const adimlar = H.STEPS.map(s => s.no);
  ok(adimlar.join(',') === adimlar.slice().sort((a, b) => a - b).join(',') && adimlar[0] === 1,
    'adım numaraları 1\'den başlayıp artıyor');
  const kullanilan = new Set(H.PARTS.map(p => p.step));
  ok([...kullanilan].every(s => adimlar.includes(s)) && adimlar.every(s => kullanilan.has(s)),
    'her adımın bileşeni, her bileşenin adımı var');
}

/* ══ 2. ORTAM KURALI ════════════════════════════════════════════════ */
bolum('2. Ortam kuralı');
{
  const marsRed = H.PARTS.filter(p => !H.envAllows(p.id, 'mars').ok).map(p => p.id);
  ok(marsRed.length === 0, 'Mars\'ta hiçbir bileşen reddedilmiyor', marsRed.join(','));

  const ayRed = H.PARTS.filter(p => !H.envAllows(p.id, 'moon').ok).map(p => p.id);
  ok(ayRed.includes('ruzgar-olcer'), 'Ay\'da rüzgâr ölçer REDDEDİLİYOR');
  ok(ayRed.includes('moxie'), 'Ay\'da MOXIE REDDEDİLİYOR (atmosferde CO₂ yok)');
  ok(ayRed.length === 2, 'Ay\'da tam iki bileşen reddediliyor', ayRed.join(','));

  const r = H.envAllows('ruzgar-olcer', 'moon');
  ok(r.neden && r.neden.length > 25, 'red gerekçe taşıyor', `"${r.neden.slice(0, 48)}…"`);
  ok(r.oneri && r.oneri.length > 25, 'red ÖNERİ taşıyor (ne yapılmalı)', `"${r.oneri.slice(0, 48)}…"`);

  let atti = false;
  try { H.envAllows('moxie', 'venus'); } catch { atti = true; }
  ok(atti, 'TERS SINAV: bilinmeyen ortam sessiz geçmiyor, atıyor');

  ok(H.HAB_ENV.moon.gravity < H.HAB_ENV.mars.gravity && !H.HAB_ENV.moon.atmosfer,
    'ortam tablosu tutarlı', `Ay g=${H.HAB_ENV.moon.gravity}, Mars g=${H.HAB_ENV.mars.gravity}`);
}

/* ══ 3. KÜTLE BÜTÇESİ ═══════════════════════════════════════════════ */
bolum('3. Kütle bütçesi');
{
  const b = H.massBudget();
  const elle = H.PARTS.reduce((s, p) => s + (p.qty ?? 1) * p.massKg, 0);
  ok(yakin(b.toplamKg, elle, 0.15), 'bütçe toplamı bağımsız toplamla aynı',
    `${b.toplamKg} kg vs ${elle.toFixed(1)} kg`);

  const payToplam = b.sistemler.reduce((s, x) => s + x.pay, 0);
  ok(yakin(payToplam, 1, 1e-9), 'sistem payları 1\'e toplanıyor', payToplam.toFixed(12));

  const sistemKg = b.sistemler.reduce((s, x) => s + x.kg, 0);
  ok(yakin(sistemKg, b.toplamKg, 0.15), 'sistem kütleleri toplamla aynı');

  ok(b.yerindeUretilen.includes('platform') && b.yerindeUretilen.includes('regolit-ortu'),
    'yerinde üretilen bileşenler kütle bütçesinde sıfır', b.yerindeUretilen.join(','));

  /* Basınçlı hacim en ağır kalem olmalı: insanın yaşadığı yer üssün
     ağırlığını belirler, uydurma bir ayrıntı değil. */
  ok(b.sistemler[0].sistem === 'basincli', 'en ağır sistem basınçlı hacim',
    `${b.sistemler[0].kg} kg (%${(b.sistemler[0].pay * 100).toFixed(0)})`);
  ok(b.toplamKg > 12000 && b.toplamKg < 30000, 'toplam dört kişilik yüzey üssü mertebesinde',
    `${b.toplamKg} kg`);

  /* Ortamlı bütçe: reddedilen bileşen fırlatılmaz, bütçede de olmaz. */
  const mars = massBudget('mars'), ay = massBudget('moon');
  /* The numbers here used to be written down as 26 and 24, so the check
     failed the moment the base gained a part - it was asserting a census,
     not the rule. What it means to say is: on Mars nothing is refused, on
     the Moon the refused ones are gone, and the difference is exactly the
     refusal list. That survives the base growing. */
  const ayRed = H.PARTS.filter(p => !H.envAllows(p.id, 'moon').ok).map(p => p.id);
  const marsRed = H.PARTS.filter(p => !H.envAllows(p.id, 'mars').ok).map(p => p.id);
  ok(mars.kapsamParca === H.PARTS.length && marsRed.length === 0,
    'Mars ortaminda hicbir bilesen reddedilmiyor', `${mars.kapsamParca}/${H.PARTS.length}`);
  ok(ay.kapsamParca === H.PARTS.length - ayRed.length && ayRed.length > 0,
    'ortam kapsamı bileşen sayısını değiştiriyor',
    `Mars ${mars.kapsamParca}, Ay ${ay.kapsamParca} (reddedilen: ${ayRed.join(', ')})`);
  const fark = mars.toplamKg - ay.toplamKg;
  const redKutle = partById('moxie').massKg + partById('ruzgar-olcer').massKg;
  ok(yakin(fark, redKutle, 0.15), 'Ay bütçesi tam reddedilen bileşenlerin kütlesi kadar hafif',
    `${fark.toFixed(1)} kg = MOXIE ${partById('moxie').massKg} + ölçer ${partById('ruzgar-olcer').massKg}`);
  ok(yakin(ay.disaridaKg, redKutle, 0.15), 'dışarıda kalan kütle ayrıca bildiriliyor',
    `${ay.disaridaKg} kg`);
  ok(b.toplamKg === massBudget().toplamKg && massBudget().disaridaKg === 0,
    'ortamsız çağrı tam katalogu topluyor (geriye uyumlu)');
}

/* ══ 4. HAT MATEMATİĞİ ══════════════════════════════════════════════ */
bolum('4. Hat matematiği');
{
  /* 4a. Mesnet açıklığı L ∝ g^(−1/3) — kapalı formdan ÇIKAN bir kimlik. */
  const ortak = { akiskan: 'H2O', odM: 0.12, wallM: 0.003 };
  const pm = R.planRun([0, 0, 0], [20, 0, 0], { ...ortak, env: 'mars' });
  const pl = R.planRun([0, 0, 0], [20, 0, 0], { ...ortak, env: 'moon' });
  const beklenen = Math.cbrt(H.HAB_ENV.mars.gravity / H.HAB_ENV.moon.gravity);
  const olculen = pl.izinliAralikM / pm.izinliAralikM;
  ok(bagil(olculen, beklenen) < 1e-12, 'izin verilen açıklık g^(−1/3) ile ölçekleniyor',
    `ölçülen ${olculen.toFixed(6)} vs beklenen ${beklenen.toFixed(6)}`);

  /* 4b. Sarkma tanımı kendi kendini doğruluyor: seçilen açıklık izin
        verilenin altındaysa sarkma da sınırın altında olmalı. */
  ok(pm.mesnetAraligiM <= pm.izinliAralikM, 'seçilen aralık izin verilenin altında',
    `${pm.mesnetAraligiM.toFixed(2)} m ≤ ${pm.izinliAralikM.toFixed(2)} m`);
  ok(pm.sarkmaM <= pm.mesnetAraligiM / 360, 'sarkma L/360 sınırının altında',
    `${(pm.sarkmaM * 1000).toFixed(3)} mm ≤ ${(pm.mesnetAraligiM / 360 * 1000).toFixed(3)} mm`);

  /* 4c. Kesit atalet momenti: ince cidar yaklaşımı I ≈ πr³t ile kıyas. */
  const { I } = R.tubeSection(0.12, 0.002);
  const inceCidar = Math.PI * (0.059 ** 3) * 0.002;
  ok(bagil(I, inceCidar) < 0.05, 'atalet momenti ince cidar yaklaşımıyla uyuşuyor',
    `tam ${I.toExponential(3)} vs yaklaşık ${inceCidar.toExponential(3)}`);

  /* 4d. Katener: çözülen a geri konduğunda sarkmayı vermeli. */
  let enKotu = 0;
  for (const [L, s] of [[2, 0.002], [4, 0.02], [10, 0.5], [30, 4], [50, 12]]) {
    const a = R.catenaryA(L, s);
    enKotu = Math.max(enKotu, Math.abs(a * (Math.cosh(L / (2 * a)) - 1) - s));
  }
  ok(enKotu < 1e-12, 'katener çözümü beş açıklıkta kapanıyor', `en kötü hata ${enKotu.toExponential(2)}`);

  /* 4e. Yay uzunluğu: analitik 2a·sinh(L/2a) ile SAYISAL integral. */
  const L = 12, s = 0.9, a = R.catenaryA(L, s);
  let S = 0, onceki = null;
  const N = 40000;
  for (let i = 0; i <= N; i++) {
    const x = -L / 2 + L * i / N;
    const y = a * Math.cosh(x / a);
    if (onceki !== null) S += Math.hypot(L / N, y - onceki);
    onceki = y;
  }
  ok(bagil(R.catenaryLength(L, a), S) < 1e-8, 'analitik yay uzunluğu sayısal integrale eşit',
    `${R.catenaryLength(L, a).toFixed(9)} vs ${S.toFixed(9)}`);

  /* 4f. Katener uçlarda sıfır, ortada −sarkma olmalı. */
  ok(yakin(R.catenaryY(L / 2, a, L), 0, 1e-12) && yakin(R.catenaryY(-L / 2, a, L), 0, 1e-12),
    'katener eğrisi uçlarda sıfır');
  ok(yakin(-R.catenaryY(0, a, L), s, 1e-9), 'katener ortada tam sarkma kadar iniyor',
    `${(-R.catenaryY(0, a, L) * 1000).toFixed(4)} mm vs ${(s * 1000).toFixed(4)} mm`);

  /* 4g. Isıl genleşme: ΔL = αLΔT, ilmek sayısı = ceil(ΔL/yutum). */
  const g1 = R.expansionPlan({ lengthM: 30, malzeme: 'paslanmaz', dT: 110, loopHeightM: 0.5 });
  const dLBeklenen = 16.0e-6 * 30 * 110;
  ok(bagil(g1.dLm, dLBeklenen) < 1e-12, 'ısıl boy değişimi αLΔT ile aynı',
    `${(g1.dLm * 1000).toFixed(3)} mm`);
  ok(g1.ilmekAdedi === Math.ceil(dLBeklenen / 0.25), 'ilmek sayısı ceil(ΔL/yutum)',
    `${g1.ilmekAdedi} ilmek`);

  /* Titanyum paslanmazdan daha az genleşir → daha az ilmek ister. */
  const g2 = R.expansionPlan({ lengthM: 30, malzeme: 'titanyum', dT: 110 });
  ok(g2.dLm < g1.dLm && g2.ilmekAdedi <= g1.ilmekAdedi,
    'düşük α daha az ilmek istiyor', `Ti ${g2.ilmekAdedi} ≤ 316L ${g1.ilmekAdedi}`);

  /* 4h. Gaz hattı ile sıvı hattı aynı boruyla aynı açıklığı GEÇEMEZ. */
  const gaz = R.planRun([0, 0, 0], [20, 0, 0], { akiskan: 'O2', env: 'mars', odM: 0.12, wallM: 0.003 });
  const sivi = R.planRun([0, 0, 0], [20, 0, 0], { akiskan: 'H2O', env: 'mars', odM: 0.12, wallM: 0.003 });
  ok(gaz.izinliAralikM > sivi.izinliAralikM, 'gaz hattı sıvı hattından uzun açıklık geçiyor',
    `${gaz.izinliAralikM.toFixed(2)} m > ${sivi.izinliAralikM.toFixed(2)} m`);
  ok(gaz.linMassKgM < sivi.linMassKgM, 'gaz hattının birim kütlesi daha küçük',
    `${gaz.linMassKgM.toFixed(2)} vs ${sivi.linMassKgM.toFixed(2)} kg/m`);

  /* 4i. Mesnet konumları uçlarda ve eşit aralıklı. */
  ok(pm.mesnetler.length >= 2, 'en az iki mesnet var');
  const ilkM = pm.mesnetler[0], sonM = pm.mesnetler[pm.mesnetler.length - 1];
  ok(ilkM.every((v, i) => yakin(v, pm.a[i], 1e-12)) && sonM.every((v, i) => yakin(v, pm.b[i], 1e-12)),
    'ilk ve son mesnet hattın uçlarında');
  const araliklar = pm.mesnetler.slice(1).map((m, i) =>
    Math.hypot(m[0] - pm.mesnetler[i][0], m[1] - pm.mesnetler[i][1], m[2] - pm.mesnetler[i][2]));
  ok(Math.max(...araliklar) - Math.min(...araliklar) < 1e-9, 'mesnet aralıkları eşit',
    `${araliklar.length} açıklık, ${araliklar[0].toFixed(4)} m`);

  /* 4j. TERS SINAV: bilinmeyen akışkan ve malzeme sessiz geçmemeli. */
  let a1 = false, a2 = false;
  try { R.planRun([0, 0, 0], [1, 0, 0], { akiskan: 'lav' }); } catch { a1 = true; }
  try { R.expansionPlan({ lengthM: 1, malzeme: 'ahsap' }); } catch { a2 = true; }
  ok(a1 && a2, 'TERS SINAV: bilinmeyen akışkan/malzeme atıyor');

  /* 4k. TERS SINAV: sarkma sınırı gerçekten bağlayıcı mı? İnce cidarlı,
        ağır dolgulu bir boru için izin verilen açıklık DÜŞMELİ. */
  const zayif = R.planRun([0, 0, 0], [20, 0, 0], { akiskan: 'H2O', env: 'mars', odM: 0.12, wallM: 0.0008 });
  ok(zayif.izinliAralikM < sivi.izinliAralikM,
    'TERS SINAV: cidar inceldiğinde izin verilen açıklık düşüyor',
    `${zayif.izinliAralikM.toFixed(2)} m < ${sivi.izinliAralikM.toFixed(2)} m`);
}

/* ══ 5. BEYAN ↔ TÜRETİM TUTARLILIĞI ═══════════════════════════════ */
bolum('5. Hat beyanı ile hesap tutarlı');
{
  const hatlar = H.PARTS.filter(p => p.sekil === 'hat');
  ok(hatlar.length >= 2, 'katalogda hat bileşeni var', hatlar.map(p => p.id).join(','));
  for (const p of hatlar) {
    const u = H.runEndpoints(p.id);
    ok(u !== null, `${p.id}: uç noktaları çözülüyor`);
    if (!u) continue;
    const plan = R.planRun(u.a, u.b, { akiskan: u.akiskan, env: 'mars', odM: u.odM, wallM: u.wallM, malzeme: u.malzeme });
    const turetilen = plan.kutleKg * H.FITTINGS_FACTOR;
    const sapma = bagil(turetilen, p.massKg);
    ok(sapma < 0.12, `${p.id}: beyan edilen kütle hesapla tutarlı (%12)`,
      `beyan ${p.massKg} kg, hesap ${turetilen.toFixed(1)} kg, sapma %${(sapma * 100).toFixed(1)}`);
    ok(plan.genlesme.ilmekAdedi >= 1, `${p.id}: en az bir genleşme ilmeği var`,
      `ΔL ${(plan.genlesme.dLm * 1000).toFixed(1)} mm`);
    ok(plan.mesnetAdedi >= 3, `${p.id}: yeterli mesnet`, `${plan.mesnetAdedi} mesnet`);
  }
  /* TERS SINAV: beyanı kasten bozulmuş bir hat yakalanmalı. */
  const u = H.runEndpoints('hat-o2');
  const plan = R.planRun(u.a, u.b, { akiskan: u.akiskan, env: 'mars', odM: u.odM, wallM: u.wallM, malzeme: u.malzeme });
  const bozuk = bagil(plan.kutleKg * H.FITTINGS_FACTOR, p_bozuk());
  ok(bozuk >= 0.12, 'TERS SINAV: yanlış beyan %12 kapısına takılıyor',
    `bozuk beyan 40 kg → sapma %${(bozuk * 100).toFixed(0)}`);
  function p_bozuk() { return 40; }
}

/* ══ 6. ARAYÜZ NOKTALARI ════════════════════════════════════════════ */
bolum('6. Arayüz noktaları');
{
  const noktalar = H.allPorts();
  ok(noktalar.length >= 10, 'arayüz noktası beyan edilmiş', `${noktalar.length} nokta`);
  const birimDisi = noktalar.filter(q => !yakin(Math.hypot(...q.dir), 1, 1e-9));
  ok(birimDisi.length === 0, 'bütün yönler birim vektör',
    birimDisi.map(q => `${q.parca}.${q.ad}`).join(','));
  const bilinmeyenTur = noktalar.filter(q => q.tur !== 'basincli' && !H.FLUID_BANDS[q.tur]);
  ok(bilinmeyenTur.length === 0, 'her noktanın türü tanımlı (basınçlı ya da akışkan bandı)',
    bilinmeyenTur.map(q => `${q.parca}.${q.ad}:${q.tur}`).join(','));

  /* Hava kilidinin iki kapısı ZIT yöne bakmalı; aynı yöne bakan iki kapı
     bir kilit değil, bir koridor olurdu. */
  const kilit = H.partById('hava-kilidi').ports;
  const [ic, dis] = [kilit.find(q => q.ad === 'ic'), kilit.find(q => q.ad === 'dis')];
  const skaler = ic.dir[0] * dis.dir[0] + ic.dir[1] * dis.dir[1] + ic.dir[2] * dis.dir[2];
  ok(yakin(skaler, -1, 1e-9), 'hava kilidinin iç ve dış kapısı zıt yöne bakıyor', `iç·dış = ${skaler}`);

  /* Basınçlı hacim zinciri kopuk olmamalı. */
  const zincir = H.pressurizedChain();
  ok(zincir.includes('hab-silindir') && zincir.includes('dugum') && zincir.includes('sisme-modul'),
    'basınçlı zincir çekirdek → düğüm → şişme modülü kapsıyor', `${zincir.length} modül`);

  /* Akışkan bandı: renkler birbirinden ayırt edilebilir olmalı, yoksa
     bant BİLGİ taşımaz. */
  const renkler = Object.values(H.FLUID_BANDS).map(b => b.renk);
  ok(new Set(renkler).size === renkler.length, 'her akışkanın rengi farklı', `${renkler.length} bant`);
  ok(Object.values(H.FLUID_BANDS).every(b => Number.isFinite(b.yogunluk)),
    'her bandın yoğunluğu tanımlı');
  ok(H.FLUID_BANDS.DC.yogunluk === 0 && H.FLUID_BANDS.LOX.yogunluk > 1000,
    'iletken hattın akışkanı yok, kriyojenik hattın yoğunluğu yüksek');
}

/* ══ 7. PATLATMA SİSTEMİYLE BÜTÜNLEŞME ═════════════════════════════ */
bolum('7. Patlatma sistemiyle bütünleşme');
{
  /* Habitat kataloğu, uydu kataloğuyla AYNI adaptörden geçmeli: sözleşme
     tutuyorsa hiçbir özel durum gerekmez. */
  const beyan = assemblyFromCatalog(H, { axis: [0, 0, 1] });
  const A = createAssembly(beyan);
  ok(A.parts.length === H.PARTS.length, 'katalog adaptörü bütün bileşenleri aldı',
    `${A.parts.length} parça`);
  ok(A.chain('sisme-modul').length >= 4, 'montaj zinciri türetiliyor',
    A.chain('sisme-modul').map(x => x.id ?? x).join(' → '));
  ok(A.depth('anten-canak') === 2, 'derinlik doğru', `anten-canak derinliği ${A.depth('anten-canak')}`);

  const sira = A.integrationOrder();
  const yerler = new Map(sira.map((id, i) => [id, i]));
  const ihlal = A.parts.filter(p => p.parent && yerler.get(p.parent) > yerler.get(p.id));
  ok(ihlal.length === 0, 'montaj sırası hiçbir ebeveyni çocuğundan sonraya atmıyor',
    ihlal.map(p => p.id).join(','));

  /* Kök yerinde kalmalı: platform kayarsa bütün üs kayar. */
  for (const k of [0.25, 0.5, 1]) {
    const of = A.explode(k);
    const d = of.get('platform') || [0, 0, 0];
    ok(Math.hypot(...d) < 1e-12, `k=${k}: platform yerinde duruyor`);
  }

  /* Hiçbir parça bir diğerinin içinden geçmemeli: patlatma boyunca
     kardeşler arası en küçük açıklık ölçülür. */
  /* Measured as a BOX separation, not as spheres on each part's largest
     dimension. The sphere form asked a 1.5 m interior rack to stay 3.25 m
     from the CENTRE of the 12 m regolith blanket it legitimately sits
     under, and it passed only because the old explosion threw every part
     much further than it needed to go. Negative here means real
     interpenetration along every axis, which is what actually matters. */
  const ayrilik = (a, b, ka, kb) => {
    let enAz = Infinity;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(ka[i] - kb[i]) - (a.size[i] + b.size[i]) / 2;
      enAz = Math.min(enAz, d);
    }
    return enAz;      // >= 0 ise ayrık; en büyük eksen boşluğu belirler
  };
  let enKucuk = Infinity, ciftAd = '';
  for (let i = 1; i <= 20; i++) {
    const k = i / 20;
    const of = A.explode(k);
    const konum = A.parts.map(p => {
      const d = of.get(p.id) || [0, 0, 0];
      return { p, c: [p.pos[0] + d[0], p.pos[1] + d[1], p.pos[2] + d[2]] };
    });
    for (let a = 0; a < konum.length; a++) {
      for (let b = a + 1; b < konum.length; b++) {
        const A1 = konum[a], B1 = konum[b];
        if (A1.p.parent !== B1.p.parent) continue;       // yalnız kardeşler
        /* Boxes that overlap on every axis interpenetrate; the largest
           per-axis gap is how far apart they really are. */
        const aciklik = Math.max(...[0, 1, 2].map(j =>
          Math.abs(A1.c[j] - B1.c[j]) - (A1.p.size[j] + B1.p.size[j]) / 2));
        if (aciklik < enKucuk) { enKucuk = aciklik; ciftAd = `${A1.p.id}/${B1.p.id} k=${k}`; }
      }
    }
    void ayrilik;
  }
  ok(enKucuk > -0.5, 'kardeş parçalar patlatma boyunca üst üste binmiyor',
    `en küçük açıklık ${enKucuk.toFixed(3)} m (${ciftAd})`);

  /* Dört kip de çalışmalı ve k=0'da hepsi sıfır olmalı. */
  for (const kip of ['assembly', 'axial', 'radial', 'layered']) {
    const sifir = A.explode(0, { mode: kip });
    const hepsiSifir = [...sifir.values()].every(d => Math.hypot(...d) < 1e-12);
    const bir = A.explode(1, { mode: kip });
    const hareket = [...bir.values()].filter(d => Math.hypot(...d) > 1e-6).length;
    ok(hepsiSifir && hareket > A.parts.length * 0.5,
      `${kip} kipi: k=0'da duruyor, k=1'de çoğunluk hareket ediyor`, `${hareket}/${A.parts.length}`);
  }

  /* TERS SINAV: bozuk eksen beyanı sessiz geçmemeli. Bu sınav, axial ve
     layered kiplerinin hiçbir parçayı kıpırdatmadığı gerçek bir kusuru
     ortaya çıkardıktan sonra yazıldı. */
  let eksenAtti = 0;
  for (const kotu of ['z', [0, 0], [0, 0, 0], [1, NaN, 0], 3]) {
    try { createAssembly({ ...beyan, axis: kotu }); } catch { eksenAtti++; }
  }
  ok(eksenAtti === 5, 'TERS SINAV: bozuk eksen beyanı beş biçimde de atıyor', `${eksenAtti}/5`);

  const bt = A.budget();
  ok(yakin(bt.toplamKg, H.massBudget().toplamKg, 1),
    'patlatma çekirdeğinin bütçesi katalog bütçesiyle aynı',
    `${bt.toplamKg} vs ${H.massBudget().toplamKg} kg`);
}

/* ══ 8. TEKNİK KÜNYE VE KAPANAN BÜTÇELER ══════════════════════════ */
bolum('8. Teknik künye ve bütçeler');
{
  /* 8a. Künye bütünlüğü. */
  const kunyesiz = H.PARTS.filter(p => !p.tech);
  ok(kunyesiz.length === 0, 'her bileşenin teknik künyesi var',
    kunyesiz.map(p => p.id).join(',') || `${H.PARTS.length} bileşen`);
  const nolar = H.PARTS.map(p => p.tech?.no).filter(Boolean);
  ok(new Set(nolar).size === nolar.length, 'parça numaraları benzersiz', `${nolar.length} numara`);
  ok(nolar.every(n => /^HB-[A-Z]{3}-\d{3}$/.test(n)), 'parça numaraları biçimli (HB-XXX-000)',
    nolar.filter(n => !/^HB-[A-Z]{3}-\d{3}$/.test(n)).join(',') || 'hepsi');
  ok(H.PARTS.every(p => p.tech.malzeme && p.tech.baglanti && p.tech.detay),
    'her künyede malzeme, bağlantı ve ayrıntı var');
  const tersBant = H.PARTS.filter(p => p.tech.sicaklik_C && p.tech.sicaklik_C[0] >= p.tech.sicaklik_C[1]);
  ok(tersBant.length === 0, 'sıcaklık bantları ters değil', tersBant.map(p => p.id).join(','));

  /* 8b. Güç: üç durumda da kapanmalı. Asıl sınav FIRTINA. */
  const g = H.powerBudget();
  ok(g.gunduz.payW > 0, 'gündüz üretim yükü karşılıyor',
    `${g.gunduz.uretimW} W / ${g.gunduz.yukW} W, pay %${(g.gunduz.pay * 100).toFixed(1)}`);
  ok(g.gece.payW > 0 && g.gece.pay > 0.2, 'gece kritik yük fisyonla karşılanıyor',
    `${g.uretimFisyonW} W / ${g.kritikW} W, pay %${(g.gece.pay * 100).toFixed(1)}`);
  ok(g.firtina.payW > 0 && g.firtina.pay > 0.2,
    'TOZ FIRTINASI: panel %20\'ye düşse de kritik yük karşılanıyor',
    `${Math.round(g.firtina.uretimW)} W / ${g.firtina.yukW} W, pay %${(g.firtina.pay * 100).toFixed(1)}`);
  /* Sayiyi sabitlemek sihirli bir rakamdi ve us buyuyunce yanlis oldu.
     Sorulmasi gereken sey SAYI degil, kesilebilir diye isaretlenen her
     yukun gercekten kesilebilir olmasi: basincli bir hacmi ya da yasam
     destegini firtinada kapatamazsin. */
  ok(g.kesilebilirW > 0, 'kesilebilir yükler beyan edilmiş',
    `${H.KESILEBILIR.length} yük · ${g.kesilebilirW} W`);
  const yanlisKesilebilir = H.PARTS.filter(q => q.tech?.kesilebilir
    && (q.arayuz === 'basincli' && !/sera|kubbe/.test(q.id)));
  ok(yanlisKesilebilir.length === 0,
    'hiçbir basınçlı yaşam hacmi kesilebilir işaretli değil',
    yanlisKesilebilir.map(q => q.id).join(', ') || H.KESILEBILIR.join(', '));
  /* TERS SINAV: habitat silindirini kesilebilir saysan yakalanmali. */
  ok(!(partById('hab-silindir').tech?.kesilebilir),
    'TERS SINAV: çekirdek hacim kesilebilir değil', 'hab-silindir kritik');
  /* Kesilebilir olanlar gerçekten hayati OLMAYANLAR olmalı: basınçlı
     hacmin ve yaşam desteğinin kesilebilir sayılması ölümcül olurdu. */
  const hayati = ['hab-silindir', 'hab-ic-raf', 'dugum', 'sisme-modul', 'hava-kilidi'];
  ok(!H.KESILEBILIR.some(id => hayati.includes(id)),
    'yaşam desteği ve basınçlı hacim kesilebilir sayılmıyor');
  /* Panel gücü DİZİ BAŞINA yazılmalı; qty ile çarpılınca tarla çıkar. */
  const panel = partById('panel-tarlasi');
  ok(Math.abs(-panel.tech.guc_W * (panel.qty ?? 1) - g.uretimGunesW) < 1,
    'güneş üretimi dizi başına güç × dizi sayısı',
    `${-panel.tech.guc_W} W × ${panel.qty} = ${g.uretimGunesW} W`);

  /* 8c. Isıl kapanış — kapasite GEOMETRİDEN, künyeden değil. */
  for (const e of ['mars', 'moon']) {
    const t = H.thermalBudget({ env: e });
    ok(t.kapaniyor && t.pay > 0.15 && t.pay < 0.6, `${e}: radyatör kapasitesi ısı yükünü karşılıyor`,
      `${t.kapasiteW} W ≥ ${t.atilacakW} W, pay %${(t.pay * 100).toFixed(1)}`);
  }
  const t0 = H.thermalBudget({ env: 'mars' });
  const d = partById('radyator-dizisi');
  ok(t0.kanatSayisi === (d.tech.kanat * (d.qty ?? 1)),
    'kanat sayısı künyeden geliyor (çizimle aynı kaynak)', `${t0.kanatSayisi} kanat`);
  /* Ortamın geri ışıması hesaba GİRMELİ: atlanırsa kapasite şişer. */
  const ortamsiz = 0.85 * H.SIGMA * Math.pow(300.15, 4) * t0.alanM2;
  ok(ortamsiz > t0.kapasiteW * 1.1, 'ortam geri ışıması kapasiteyi anlamlı ölçüde düşürüyor',
    `ortamsız ${Math.round(ortamsiz)} W vs gerçek ${t0.kapasiteW} W`);

  /* 8d. Hacim: yaşanabilir hacim geçiş ve üretim hacmini içermez. */
  const v = H.volumeBudget();
  ok(v.yasanabilirM3 < v.toplamM3, 'yaşanabilir hacim toplamdan küçük',
    `${v.yasanabilirM3} / ${v.toplamM3} m³`);
  ok(v.kisiBasiM3 >= 25, 'kişi başı hacim uzun süreli görev alt sınırının üstünde',
    `${v.kisiBasiM3} m³/kişi`);
  const geciss = v.kalemler.filter(x => x.sinif === 'geçiş').map(x => x.id);
  ok(geciss.includes('hava-kilidi') && geciss.includes('tunel'),
    'hava kilidi ve tünel geçiş hacmi sayılıyor', geciss.join(','));

  /* 8e. ISRU: üretilen oksijen solunumu karşılamalı. */
  const i = H.isruBudget();
  ok(i.O2Yeterli, 'üretilen O₂ mürettebatın solunumunu karşılıyor',
    `${i.O2UretimKgGun} ≥ ${i.O2SolunumKgGun} kg/gün, pay ${i.O2PayKgGun}`);
  ok(Math.abs(i.O2SolunumKgGun - i.kisi * H.O2_KISI_GUN) < 1e-9,
    'solunum kişi sayısı × 0,84 kg/gün');
  ok(i.CH4KgGun > 0 && i.H2OKgGun > 0, 'Sabatier hem yakıt hem su üretiyor',
    `CH₄ ${i.CH4KgGun}, H₂O ${i.H2OKgGun} kg/gün`);
  /* Sabatier stokiyometrisi: CO₂ + 4H₂ → CH₄ + 2H₂O.
     Molce 1 CH₄ (16,04 g) başına 2 H₂O (36,03 g) ⇒ kütlece 2,246 kat. */
  const sab = partById('sabatier').tech.uretim;
  const oran = sab.H2O_kg_gun / sab.CH4_kg_gun;
  ok(Math.abs(oran - 2 * 18.015 / 16.043) < 0.06,
    'Sabatier su/metan oranı stokiyometriye uyuyor',
    `${oran.toFixed(3)} vs beklenen ${(2 * 18.015 / 16.043).toFixed(3)}`);

  /* 8f. Isı yolu: anlamlı ısı üreten her kutu ısısını nereye attığını
        söylemeli — radyatöre bağlı değilse yolunu BEYAN etmeli. */
  const isiKaynaklari = H.PARTS.filter(p => (p.tech.guc_W ?? 0) >= 300);
  const yolsuz = isiKaynaklari.filter(p => !p.tech.isiYolu);
  ok(yolsuz.length === 0, 'her büyük ısı kaynağı ısı yolunu beyan ediyor',
    yolsuz.map(p => `${p.id} (${p.tech.guc_W} W)`).join(',') || `${isiKaynaklari.length} kaynak`);

  /* 8g. TERS SINAVLAR. */
  ok(H.powerBudget().uretimGunesW !== H.powerBudget().uretimFisyonW,
    'güneş ve fisyon ayrı sayılıyor (tek toplamda erimiyor)');
  const sahteFirtina = (g.uretimFisyonW + g.uretimGunesW * 0.2 - (g.kritikW + g.kesilebilirW));
  ok(sahteFirtina < 0,
    'TERS SINAV: kesilebilir yük kapanmazsa fırtınada bütçe AÇIK veriyor',
    `${Math.round(sahteFirtina)} W eksik — bu yüzden kesilebilir sınıfı var`);
  const darBant = H.PARTS.filter(p => p.tech.sicaklik_C)
    .sort((a, b) => (a.tech.sicaklik_C[1] - a.tech.sicaklik_C[0]) - (b.tech.sicaklik_C[1] - b.tech.sicaklik_C[0]))[0];
  ok(darBant.id === 'sera' || darBant.id === 'faydali-yuk' || darBant.tech.sicaklik_C[1] - darBant.tech.sicaklik_C[0] <= 6,
    'ısıl tasarımı en dar bantlı bileşen belirliyor',
    `${darBant.ad}: ${darBant.tech.sicaklik_C[0]}…${darBant.tech.sicaklik_C[1]} °C`);
}

/* ══ ÖZET ══════════════════════════════════════════════════════════ */
console.log(`\n${'═'.repeat(62)}`);
/* ── hizalama: hiçbir şey havada durmaz, hiçbir şey ebeveyninden kopuk
      değildir, hiçbir ikili iç içe geçmez ───────────────────────────── */
console.log('\n== hizalama');
{
  /* Routed lines cross the whole site by design and the regolith cover
     WRAPS the habitat, so neither answers a box test; the pad is the ground
     everything legitimately stands on. Named, not silently skipped. */
  const MUAF = new Set(['hat-o2', 'hat-guc', 'regolit-ortu']);
  const by = new Map(H.PARTS.map(q => [q.id, q]));
  const ped = by.get('platform');
  const pedUst = ped.pos[2] + ped.size[2] / 2;

  /* A part that says it stands on the ground has to touch it. Seven of them
     floated between 10 and 30 cm above the pad, which is exactly what
     "misaligned and ugly" looked like from the outside. */
  const havada = H.PARTS
    .filter(q => q.mountsTo === 'platform' && !MUAF.has(q.id))
    .filter(q => Math.abs((q.pos[2] - q.size[2] / 2) - pedUst) > 0.005)
    .map(q => `${q.id} ${((q.pos[2] - q.size[2] / 2) - pedUst).toFixed(2)} m`);
  ok(havada.length === 0, 'zemine oturan her parça pedin üstünde duruyor',
    havada.join(', ') || `${H.PARTS.filter(q => q.mountsTo === 'platform').length} parça`);

  /* Boxes only intersect when all three axes overlap, so the SEPARATING
     axis is the maximum - taking the minimum reported 189 false pairs when
     this was first measured. */
  const acik = (a, b) => {
    let m = -Infinity;
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(a.pos[k] - b.pos[k]) - (a.size[k] + b.size[k]) / 2;
      if (d > m) m = d;
    }
    return m;
  };

  /* Declaring a parent is a claim about contact. The inflatable was 2.1 m
     from the node it named, the greenhouse 1.5 m, the airlock 1.0 m from
     the habitat it seals onto - the base read as parts set down near each
     other rather than one connected thing. */
  const kopuk = H.PARTS
    .filter(q => q.mountsTo && !MUAF.has(q.id) && by.has(q.mountsTo))
    .map(q => ({ q, s: acik(q, by.get(q.mountsTo)) }))
    .filter(x => x.s > 0.05)
    .map(x => `${x.q.id}->${x.q.mountsTo} ${x.s.toFixed(2)} m`);
  ok(kopuk.length === 0, 'her parça beyan ettiği ebeveyne temas ediyor',
    kopuk.join(', ') || 'hepsi');

  const cakisan = [];
  const liste = H.PARTS.filter(q => q.id !== 'platform' && !MUAF.has(q.id));
  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i], b = liste[j];
      if (a.mountsTo === b.id || b.mountsTo === a.id) continue;   // iç içe olabilir
      const s = acik(a, b);
      if (s < 0) cakisan.push(`${a.id}/${b.id} ${s.toFixed(2)} m`);
    }
  }
  ok(cakisan.length === 0, 'hiçbir ikili iç içe geçmiyor',
    cakisan.join(', ') || `${liste.length} parça, ${liste.length * (liste.length - 1) / 2} ikili`);

  /* And the site has to fit on its own ground, with room to read it. */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of H.PARTS) {
    if (q.id === 'platform') continue;
    x0 = Math.min(x0, q.pos[0] - q.size[0] / 2); x1 = Math.max(x1, q.pos[0] + q.size[0] / 2);
    y0 = Math.min(y0, q.pos[1] - q.size[1] / 2); y1 = Math.max(y1, q.pos[1] + q.size[1] / 2);
  }
  const payX = ped.size[0] / 2 - Math.max(-x0, x1), payY = ped.size[1] / 2 - Math.max(-y0, y1);
  ok(payX > 1 && payY > 1, 'üs kendi pedinden taşmıyor (en az 1 m pay)',
    `x ${payX.toFixed(1)} m · y ${payY.toFixed(1)} m`);
}

/* ══ TUTUM: ÇEMBER ÜZERİNE DİZİLMİŞ PARÇALAR ════════════════════════
   Bir dizinin her parçası KENDİ açısına göre dönmek zorundadır. three
   Euler'i XYZ sırasında Rx·Ry·Rz diye kurar, yani Z terimi vektöre ÖNCE
   çarpar; bu yüzden `rotation.set(π/2, 0, a)` hiçbir zaman "ayağa kaldır,
   sonra a açısına çevir" demez ve ardından gelen Rx bütün örnekleri tek bir
   eksene yatırır. Ölçülen (düzeltme öncesi): şerit halkalarında 12 parçanın
   hepsi tek normalde, 90°'ye kadar sapma; şemsiye dilimlerinde koni
   yürüdükçe düzleşiyor (dış uç +0,242 → +0,171 → 0,000); reaktör
   levhalarının dördü de aynı yöne bakıyor.

   Buradaki sınavlar formülün KİMLİĞİNİ ölçer. Kaynağın hâlâ bu formülü
   kullandığını `scripts/eksen-denetimi.py` ayrıca tarar — ikisi ayrı şey ve
   ikisi de gerekli. */
bolum('Tutum: çember dizileri ve anten nişangâhı');
{
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Z = () => V(0, 0, 1);
  /* Bir şerit ile ters çevrilmişi AYNI şeritttir: karşılaştırmadan önce
     ekseni yarım küreye katla, yoksa doğru kurulum 180° yanlış okunur. */
  const sapma = (a, b) => Math.min(a.angleTo(b), a.angleTo(b.clone().negate())) * 180 / Math.PI;
  const enBuyuk = (n, kur, hedef, yerelEksen) => {
    let en = 0;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n;
      const o = new THREE.Object3D();
      kur(o, a);
      en = Math.max(en, sapma(yerelEksen.clone().applyQuaternion(o.quaternion), hedef(a)));
    }
    return en;
  };

  /* Şerit halkası: torusun normali büyük halkanın TEĞETİ olmalı. */
  const seritSapma = enBuyuk(12,
    (o, a) => o.quaternion.setFromUnitVectors(Z(), V(-Math.sin(a), Math.cos(a), 0)),
    (a) => V(-Math.sin(a), Math.cos(a), 0), Z());
  ok(seritSapma < 1e-6, 'şerit halkalarının normali teğete oturuyor',
    `en büyük sapma ${seritSapma.toExponential(1)}°`);
  /* TERS SINAV: eski Euler biçimi YAKALANMAK zorunda. */
  const seritEski = enBuyuk(12,
    (o, a) => o.rotation.set(Math.PI / 2, 0, a + Math.PI / 2),
    (a) => V(-Math.sin(a), Math.cos(a), 0), Z());
  ok(seritEski > 45, 'ters sınav: eski Euler biçimi yakalanıyor',
    `sapma ${seritEski.toFixed(1)}° (eşik 45°)`);

  /* Şemsiye dilimi: her dilim KENDİ teğet ekseni etrafında eğilir, dış ucu
     aşağıda, ve eğim çember boyunca AYNI kalır. */
  const egim = 14 * Math.PI / 180;
  const dilimHedef = (a) => V(Math.cos(a) * Math.cos(egim), Math.sin(a) * Math.cos(egim),
    -Math.sin(egim));
  const dilimSapma = enBuyuk(8,
    (o, a) => { o.rotation.set(0, egim, 0); o.rotateOnWorldAxis(Z(), a); },
    dilimHedef, V(1, 0, 0));
  ok(dilimSapma < 1e-6, 'şemsiye dilimleri tek koni kuruyor, dış uç aşağıda',
    `en büyük sapma ${dilimSapma.toExponential(1)}°`);
  const dilimEski = enBuyuk(8,
    (o, a) => { o.rotation.z = a; o.rotation.y = -egim; }, dilimHedef, V(1, 0, 0));
  ok(dilimEski > 20, 'ters sınav: dünya ekseninde eğim yakalanıyor',
    `sapma ${dilimEski.toFixed(1)}° (eşik 20°)`);

  /* İkaz levhası: yüzü (+Z) DIŞA, metni (+Y) YUKARI. İki eksen birlikte
     sınanır; yalnız yüzü sınamak levhayı yan yatmış hâlde geçirir. */
  const levhaTaban = (o, a) => o.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(V(-Math.sin(a), Math.cos(a), 0), Z(),
      V(Math.cos(a), Math.sin(a), 0)));
  const levhaYuz = enBuyuk(4, levhaTaban, (a) => V(Math.cos(a), Math.sin(a), 0), Z());
  const levhaUst = enBuyuk(4, levhaTaban, () => Z(), V(0, 1, 0));
  ok(levhaYuz < 1e-6 && levhaUst < 1e-6, 'ikaz levhaları dışa bakıyor ve metni yukarı',
    `yüz ${levhaYuz.toExponential(1)}° · üst ${levhaUst.toExponential(1)}°`);
  const levhaEski = enBuyuk(4, (o, a) => o.rotation.set(Math.PI / 2, 0, a + Math.PI / 2),
    (a) => V(Math.cos(a), Math.sin(a), 0), Z());
  ok(levhaEski > 45, 'ters sınav: dördü aynı yöne bakan biçim yakalanıyor',
    `sapma ${levhaEski.toFixed(1)}° (eşik 45°)`);

  /* Anten: nişangâh katalogda BEYAN edilir, çizim onu izler. Üç şey ayrı
     ayrı sınanır — beyanın kendisi tutarlı mı, açı ufkun üstünde mi, ve
     çanak beyan ettiği yol boyunca kendi direğine çarpmadan dönebiliyor mu.
     Son soru bu düzeltmenin ORTAYA ÇIKARDIĞI hataydı: 7,2 m direk başına
     hizalı takılmış 2,4 m'lik çanak 38°'ye çıkarken kenarını direğin içinden
     geçiriyordu. */
  const nisanli = H.PARTS.filter(q => q.nis);
  ok(nisanli.length > 0, 'nişangâh beyan eden parça var', nisanli.map(q => q.id).join(', '));
  for (const q of nisanli) {
    const az = q.nis.azimut * Math.PI / 180, yuk = q.nis.yukseklik * Math.PI / 180;
    const bore = V(Math.sin(az) * Math.cos(yuk), Math.cos(az) * Math.cos(yuk), Math.sin(yuk));
    /* Gidiş-dönüş: sözleşme (azimut 0 = +Y, saat yönünde) kendini doğruluyor. */
    const geriYuk = Math.asin(Math.max(-1, Math.min(1, bore.z))) * 180 / Math.PI;
    const geriAz = ((Math.atan2(bore.x, bore.y) * 180 / Math.PI) + 360) % 360;
    ok(yakin(geriYuk, q.nis.yukseklik, 1e-9) && yakin(geriAz, q.nis.azimut, 1e-9),
      `${q.id}: nişangâh gidiş-dönüş kapanıyor`,
      `${geriAz.toFixed(1)}° az · ${geriYuk.toFixed(1)}° yük`);
    ok(q.nis.yukseklik > 0 && q.nis.yukseklik < 90,
      `${q.id}: boresight ufkun üstünde ve zenitte değil`, `${q.nis.yukseklik}°`);
    ok(q.nis.yukseklik >= q.nis.enAz,
      `${q.id}: nominal açı kendi seyir sınırının içinde`,
      `${q.nis.yukseklik}° ≥ ${q.nis.enAz}°`);

    /* İki eksende dönen bir çanak KÜRE süpürür, dolayısıyla ilan edilmesi
       gereken zarf dönüş ekseni merkezli bir küptür. Buradaki erimi kapalı
       formla ikinci kez yazmak bağımsız bir denetim değil, ikinci kez yanlış
       olma şansıydı: çanağı düz plaka sayan ilk deneme 1,24 m dedi, canlı
       sahnede ölçülen 2,36 m çıktı ve çanak direğin 0,72 m içinde dönerken
       kapı onay veriyordu. Artık türetme geometriyi kuran yerle ORTAK, ve
       burada sınanan şey ortak formülün taklit edemeyeceği şey: beyan edilen
       zarfın süpürülen küreyi kapsayıp ebeveyni boşaltması. */
    const G = H.canakGeo(q.nis.cap);
    const kupMu = yakin(q.size[0], q.size[1], 1e-9) && yakin(q.size[1], q.size[2], 1e-9);
    ok(kupMu, `${q.id}: zarf bir küp (süpürülen hacim yönden bağımsız)`,
      q.size.map(v => v.toFixed(2)).join(' × ') + ' m');
    ok(Math.min(...q.size) >= 2 * G.erim - 1e-9,
      `${q.id}: zarf süpürülen küreyi kapsıyor`,
      `${Math.min(...q.size).toFixed(2)} m ≥ 2 × ${G.erim.toFixed(3)} m`);
    /* Açıklık artık `nis` içinde beyan edilir. `size` bir zamanlar hem açıklık
       hem zarftı ve bu yüzden ilan edilecek dürüst bir sayı yoktu. */
    ok(q.nis.cap > 0 && q.nis.cap < Math.min(...q.size),
      `${q.id}: açıklık zarfın içinde ve ayrıca beyan edilmiş`,
      `açıklık ${q.nis.cap} m · zarf ${Math.min(...q.size)} m`);
    const ebeveyn = partById(q.mountsTo);
    if (ebeveyn) {
      const ebeveynUst = ebeveyn.pos[2] + ebeveyn.size[2] / 2;
      const altUc = q.pos[2] - G.erim;
      ok(altUc >= ebeveynUst - 1e-9,
        `${q.id}: bütün seyir boyunca ${q.mountsTo} başını boşaltıyor`,
        `süpürme alt ucu ${altUc.toFixed(3)} m ≥ direk başı ${ebeveynUst.toFixed(2)} m`);
      /* TERS SINAV: kardanı direk başına hizalasan yakalanmak zorunda. */
      ok(!(ebeveynUst - G.erim >= ebeveynUst),
        `${q.id}: ters sınav — direk başına hizalı kardan yakalanıyor`,
        `hizalı olsa alt uç ${(ebeveynUst - G.erim).toFixed(2)} m olurdu`);
    }
  }
}

/* ══ SAHA: YASAK BÖLGE, GÜNEŞ YÖNÜ, YÜRÜME PAYI ═════════════════════
   Üçü de katalogda YAZILI ve yerleşim üçüyle de çelişiyordu. */
bolum('Saha: yasak bölge, güneş yönü, yürüme payı');
{
  /* ── 1. reaktörün kendi yasak yarıçapı ──
     Reaktör satırı "recessed emplacement 14 m from the base" diyor, detayı
     "14 m plus the shadow shield keeps the base side under 5 mSv a year"
     diyor, ve gövdesine çizilen levha "14 m yaklaşma sınırı" yazıyor.
     Ölçülen (düzeltme öncesi): 11 basınçlı hacmin 7'si sınırın İÇİNDE,
     sera 5,3 m'de, düğüm 9,2 m'de. */
  const r = partById('reaktor');
  const R = r.yasakYaricapM;
  ok(typeof R === 'number' && R > 0, 'reaktör yasak yarıçapını beyan ediyor', `${R} m`);
  const yarıÇap = (q) => Math.hypot(q.size[0], q.size[1]) / 2;
  const yuzeyMesafe = (q) => Math.max(0,
    Math.hypot(q.pos[0] - r.pos[0], q.pos[1] - r.pos[1]) - yarıÇap(q) - yarıÇap(r));
  const basincli = H.PARTS.filter(q => q.arayuz === 'basincli'
    || /^(hab-silindir|sera|dugum|sisme-modul|kilit-boyun|tunel)$/.test(q.id));
  const icerde = basincli.filter(q => yuzeyMesafe(q) < R)
    .map(q => `${q.id} ${yuzeyMesafe(q).toFixed(1)} m`);
  const enYakin = basincli.reduce((a, q) => Math.min(a, yuzeyMesafe(q)), Infinity);
  ok(icerde.length === 0, 'hiçbir basınçlı hacim yasak yarıçapın içinde değil',
    icerde.join(', ') || `${basincli.length} hacim · en yakını ${enYakin.toFixed(1)} m ≥ ${R} m`);
  /* TERS SINAV: yarıçapı en yakın hacmin ötesine çıkarsan yakalanmalı. */
  const sahteR = enYakin + 1;
  ok(basincli.some(q => yuzeyMesafe(q) < sahteR),
    'TERS SINAV: yarıçap büyütülse ihlal yakalanır', `${sahteR.toFixed(1)} m ile 1 ihlal`);

  /* Gölge kalkanı arada durmuyorsa yarıçap tek başına yetmez: doz hem
     mesafeden hem kalkandan gelir ve satır ikisini birlikte söylüyor. */
  const kalkan = partById('golge-kalkani');
  const kesisir = (p0, p1, b) => {
    const d = [p1[0] - p0[0], p1[1] - p0[1]];
    let t0 = 0, t1 = 1;
    for (let a = 0; a < 2; a++) {
      const mn = b.pos[a] - b.size[a] / 2, mx = b.pos[a] + b.size[a] / 2;
      if (Math.abs(d[a]) < 1e-12) { if (p0[a] < mn || p0[a] > mx) return false; continue; }
      let ta = (mn - p0[a]) / d[a], tb = (mx - p0[a]) / d[a];
      if (ta > tb) { const q = ta; ta = tb; tb = q; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    return true;
  };
  const korunan = basincli.filter(q => kesisir(r.pos, q.pos, kalkan)).length;
  ok(korunan === basincli.length, 'kalkan her basınçlı hacmin önünde duruyor',
    `${korunan}/${basincli.length}`);
  ok(!kesisir(r.pos, [r.pos[0] + 5, r.pos[1] - 5], kalkan),
    'TERS SINAV: kalkanın ARKASINA giden yol korunmuyor', 'ters yön açık');

  /* ── 2. güneş yönü ile panel eğimi ──
     Eğim işareti aynalanmıştı: ölçülen kosinüs 0,201, paneli hiç eğmesen
     0,577. Yani eğim, eğmemekten %65 daha kötüydü. */
  for (const env of ['mars', 'ay']) {
    const dogru = H.panelKosinus(H.PANEL_EGIM_DEG, env);
    const duz = H.panelKosinus(0, env);
    const ayna = H.panelKosinus(-H.PANEL_EGIM_DEG, env);
    ok(dogru > duz, `${env}: eğim panel için düz durmaktan İYİ`,
      `${dogru.toFixed(3)} > ${duz.toFixed(3)}`);
    ok(ayna < duz, `TERS SINAV (${env}): aynalanmış eğim düzden kötü, yakalanır`,
      `${ayna.toFixed(3)} < ${duz.toFixed(3)}`);
  }

  /* ── 3. yürüme payı ──
     Kural yalnız FARKLI sistemler arasında geçerlidir: kalkanın reaktöre
     yapışık olması tasarımdır ve aynı basınçlı hacmin içindeki raf ile
     tünel arasında kimse yürümez. İlk denemem bunu ayırmadı ve 16 sahte
     ihlal saydı. */
  const PAY = 1.5;
  const MUAF_HAT = new Set(['hat-o2', 'hat-guc', 'regolit-ortu', 'platform']);
  /* Reaktor tesisi: govde, golge kalkani, radyator diregi ve semsiyesi TEK
     kurulumdur. Kalkanin reaktore 0,10 m'de olmasi tasarimdir - korudugu
     seye yaslanmayan bir kalkan koruma yapmaz - ve reaktorun kendisi bu
     haritada yoksa kendi kalkaniyla 'farkli sistem' sayilip yakalaniyor. */
  const tesis = new Map([['reaktor', 'reaktor'], ['golge-kalkani', 'reaktor'],
    ['reaktor-radyator', 'reaktor'], ['radyator-direk', 'reaktor']]);
  /* Ayni YAPININ parcalari da muaftir: temel plakasi ile ustundeki modul,
     ya da dugum ile ona baglanan gecis tuneli ebeveyn-cocuktur ve aralarinda
     kimse yurumez. Bir parcanin yapisi, pede kadar giden baglanti zincirinin
     kokudur. Ilk yazisimda yalniz `sistem` vardi ve 11 sahte ihlal verdi. */
  const ebeveynAd = new Map(H.PARTS.map(q => [q.id, q.mountsTo]));
  const kokYapi = (id) => {
    let n = id, g = 0;
    while (ebeveynAd.get(n) && ebeveynAd.get(n) !== 'platform' && g++ < 12) n = ebeveynAd.get(n);
    return n;
  };
  const grup = (q) => tesis.get(q.id) || q.sistem;
  const liste = H.PARTS.filter(q => !MUAF_HAT.has(q.id));
  const acikMesafe = (a, b) => {
    let m = -Infinity;
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(a.pos[k] - b.pos[k]) - (a.size[k] + b.size[k]) / 2;
      if (d > m) m = d;
    }
    return m;
  };
  const dar = [];
  let enDar = Infinity;
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i], b = liste[j];
    if (grup(a) === grup(b) || kokYapi(a.id) === kokYapi(b.id)) continue;
    const d = acikMesafe(a, b);
    if (d < enDar) enDar = d;
    if (d < PAY) dar.push(`${a.id}/${b.id} ${d.toFixed(2)} m`);
  }
  ok(dar.length === 0, `farklı sistemler arasında en az ${PAY} m yürüme payı var`,
    dar.join(', ') || `en dar ${enDar.toFixed(2)} m`);
  ok(enDar < 40, 'TERS SINAV: pay ölçümü gerçekten çalışıyor (sonsuz değil)',
    `en dar ${enDar.toFixed(2)} m`);
}

/* ── YÜRÜME YOLLARI ───────────────────────────────────────────────────
 *
 * İki kusur da vardı ve ikisi de ölçülerek bulundu:
 *
 *   1. Yol, BİNANIN İÇİNDEN geçiyordu. İlk yazışta rotalar düz doğruydu ve
 *      hava kilidi -> atölye doğrusu habitat silindirini, düğümü, şişme
 *      modülü ve geçişleri kesiyordu: sekiz engel. Bir yol binanın etrafından
 *      döner, o yüzden rota kırıklı yol oldu.
 *   2. Mürettebat HATTA ÇARPIYORDU. Hatlar üssün tek doğu-batı koridorunu
 *      1,93 ve 1,95 m'de kesiyor, giysili boy 1,95 m. Bu, hat satırlarının
 *      beyan ettiği kutuya bakarak bulunamaz - o kutu y = -7,2'de düz bir
 *      koşu ilan eder, çizilen ise tanktan habitata çapraz gider. Ölçüm
 *      `runEndpoints`'in verdiği gerçek eksen çizgisinden yapılır.
 */
{
  bolum('yürüme yolları');
  const toplamL = H.yolToplamM();
  ok(H.YOLLAR.length >= 4, 'en az dört rota beyan edilmiş', `${H.YOLLAR.length} rota, ${toplamL.toFixed(1)} m`);
  ok(H.YOLLAR.every(y => y.neden && y.neden.length > 30),
    'her rota NEDEN yürünüyor olduğunu söylüyor');

  /* Rota uçları gerçek parçalar olmalı: yol hiçbir yere gitmiyorsa yol değil. */
  const kayip = H.YOLLAR.flatMap(y => [y.a, y.b]).filter(id => !H.partById(id));
  ok(kayip.length === 0, 'her rotanın iki ucu da katalogda var', kayip.join(', ') || 'hepsi var');

  for (const env of ['mars', 'moon']) {
    const engel = [];
    for (const y of H.YOLLAR) {
      if (!H.envAllows(y.a, env).ok || !H.envAllows(y.b, env).ok) continue;
      for (const e of H.yolEngelleri(y, env)) engel.push(`${y.id}/${e.engel}`);
    }
    ok(engel.length === 0, `${env}: hiçbir yol katı bir cismin içinden geçmiyor`,
      engel.join(', ') || 'altı rota temiz');
  }

  /* TERS SINAV: engel ölçümü gerçekten bir şey buluyor mu. Düz doğru hâli
     sekiz engel veriyordu; ara noktaları silince yine vermeli, yoksa denetim
     her şeyi "temiz" diyen boş bir sayaçtan ibarettir. */
  const duz = { ...H.YOLLAR.find(y => y.id === 'yol-atolye'), ara: [] };
  ok(H.yolEngelleri(duz, 'mars').length >= 5,
    'TERS SINAV: ara noktalar silinince engel ölçümü kusuru yakalıyor',
    `${H.yolEngelleri(duz, 'mars').length} engel`);

  /* Baş boşluğu: her gerçek kesişimde çukurdan SONRA giysili boy + pay kadar
     yer kalmalı. Uç bağlantısı kesişme değildir - hat tankın üstünde biter ve
     yol da tankta biter; orada kimse hattın altından yürümez. */
  const gereken = H.GIYSILI_BOY_M + H.BAS_PAYI_M;
  const carpan = [], cukurlu = [];
  for (const y of H.YOLLAR) {
    for (const c of H.yolAltGecisleri(y, 'mars')) {
      if (c.terminal) continue;
      if (c.cukurM > 0) cukurlu.push(`${c.hat} ${c.cukurM.toFixed(2)} m`);
      if (c.altZ + c.cukurM < gereken - 1e-9) carpan.push(`${y.id}/${c.hat} ${(c.altZ + c.cukurM).toFixed(2)} m`);
    }
  }
  ok(carpan.length === 0,
    `her hat kesişiminde çukurdan sonra ${gereken.toFixed(2)} m baş boşluğu var`,
    carpan.join(', ') || `${cukurlu.length} kesişim tesviye edildi: ${cukurlu.join(', ')}`);
  ok(cukurlu.length > 0,
    'TERS SINAV: baş boşluğu ölçümü gerçek bir kesişim buluyor (sıfır değil)',
    `${cukurlu.length} kesişim`);

  /* Çukur derinliği ÖLÇÜMDEN çıkar: her çukur tam gerekeni kapatmalı, ne
     eksik ne de gereksiz derin. 0,05 m yuvarlama payı. */
  const sacma = [];
  for (const y of H.YOLLAR) {
    for (const c of H.yolAltGecisleri(y, 'mars')) {
      if (c.terminal || c.cukurM <= 0) continue;
      if (c.altZ + c.cukurM > gereken + 0.05) sacma.push(`${c.hat} ${c.cukurM.toFixed(2)} m`);
    }
  }
  ok(sacma.length === 0, 'hiçbir çukur gerekenden 0,05 m fazla derin değil',
    sacma.join(', ') || 'derinlikler ölçümden');

  /* Rampa eğimi: 1:8'den dik bir rampa giysili ve yüklü yürünmez. */
  ok(H.CUKUR_EGIM >= 8, 'çukur rampası en çok 1:8 eğimde', `1:${H.CUKUR_EGIM}`);

  /* Genişlik ÖLÇEK DÜRÜSTLÜĞÜ: ana yol iki giysili omuzu yan yana almalı.
     Sayı astronaut_blocks'un BEYAN ettiği yerden OKUNUR. Buraya 0,84 diye
     kopyalanmıştı ve giysi yeniden çizilince beyan 0,88'e çıktı: kopyalanan
     sayı sessizce eskidi ve yol denetimi artık var olmayan bir omuzu
     sınıyordu. Kopyalanan sayı, doğrulanmamış sayıdır. */
  const omuz = AST.OMUZ_M;
  ok(H.YOL_GENISLIK_M.ana >= 2 * omuz,
    'ana yol iki giysili mürettebatı yan yana alıyor',
    `${H.YOL_GENISLIK_M.ana} m, iki omuz ${(2 * omuz).toFixed(2)} m`);
  ok(H.YOL_GENISLIK_M.tali >= omuz + 0.3,
    'tali yol bir giysili mürettebata yetiyor',
    `${H.YOL_GENISLIK_M.tali} m, omuz ${omuz} m`);

  /* Her ana yapıya yürünebiliyor mu: mürettebatın giysiyle gittiği hiçbir
     tesis yolsuz kalmamalı. Yolsuz bir depo, kâğıt üstünde bir depodur. */
  const uclar = new Set(H.YOLLAR.flatMap(y => [y.a, y.b]));
  const gerekli = ['tank-o2', 'tank-ch4', 'moxie', 'garaj', 'depo', 'atolye'];
  const yolsuz = gerekli.filter(id => !uclar.has(id));
  ok(yolsuz.length === 0, 'mürettebatın gittiği her tesise yol var', yolsuz.join(', ') || gerekli.join(', '));

  /* ÇAKIŞMA. Üç ana yol aynı caddeyi paylaşır. Rota başına şerit çizilirse
     aynı düzlemde üç kutu üst üste gelir - z-fighting - ve aynı hat
     kesişimine üç çukur kazılır. `yolSeritleri` aralıkları birleştirir. */
  for (const env of ['mars', 'moon']) {
    const S = H.yolSeritleri(env);
    const cak = [];
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const A = S[i], B = S[j];
      if (Math.abs(A.aci - B.aci) > 1e-6) continue;
      const pa = -A.uy * A.a[0] + A.ux * A.a[1];
      const pb = -B.uy * B.a[0] + B.ux * B.a[1];
      if (Math.abs(pa - pb) > 1e-6) continue;
      const t0 = Math.min(A.ux * A.a[0] + A.uy * A.a[1], A.ux * A.b[0] + A.uy * A.b[1]);
      const t1 = Math.max(A.ux * A.a[0] + A.uy * A.a[1], A.ux * A.b[0] + A.uy * A.b[1]);
      const s0 = Math.min(B.ux * B.a[0] + B.uy * B.a[1], B.ux * B.b[0] + B.uy * B.b[1]);
      const s1 = Math.max(B.ux * B.a[0] + B.uy * B.a[1], B.ux * B.b[0] + B.uy * B.b[1]);
      if (Math.min(t1, s1) - Math.max(t0, s0) > 1e-6) cak.push(`${i}/${j}`);
    }
    ok(cak.length === 0, `${env}: aynı düzlemde çakışan şerit yok`,
      cak.join(', ') || `${S.length} şerit, ${H.yolKaplananM(env).toFixed(1)} m zemin`);
  }

  /* Birleştirme GERÇEKTEN birleştiriyor mu: rotaların toplamı kaplanan
     zeminden büyük olmalı, yoksa tekilleştirme kimsenin farketmediği bir
     boş işlemdir. Paylaşılan cadde 17,6 m. */
  const ham = H.yolToplamM(), net = H.yolKaplananM('mars');
  ok(ham - net > 5, 'paylaşılan cadde bir kez çiziliyor',
    `rota toplamı ${ham.toFixed(1)} m, kaplanan ${net.toFixed(1)} m, paylaşılan ${(ham - net).toFixed(1)} m`);

  /* Cadde TEK PARÇA olmalı. Kanonikleştirme kusuru yüzünden batıya giden yarı
     -1,22e-16 açı alıp "-0.0000" anahtarına düşüyordu ve tek cadde 18,6 + 12,0
     m'ye bölünüyordu; iki bitişik kutu görsel olarak masum ama birleştirmenin
     çalışmadığının işaretiydi. */
  const cadde = H.yolSeritleri('mars')
    .filter(s => Math.abs(s.aci) < 1e-6 && Math.abs(s.a[1] - H.CADDE_Y) < 1e-6);
  ok(cadde.length === 1, 'ana cadde tek parça hâlinde birleşmiş',
    `${cadde.length} parça${cadde.length ? ', ' + cadde[0].uzunluk.toFixed(1) + ' m' : ''}`);

  /* Çukur da tekil olmalı: aynı kesişime üç rota gelir, çukur bir tanedir. */
  const cSay = H.yolCukurlari('mars').length;
  const hamCukur = H.YOLLAR.reduce(
    (n, y) => n + H.yolAltGecisleri(y, 'mars').filter(c => c.cukurM > 0).length, 0);
  ok(cSay < hamCukur, 'aynı kesişimdeki çukur bir kez kazılıyor',
    `${hamCukur} rota-kesişimi -> ${cSay} çukur`);
}

console.log(kaldi === 0 ? `HABİTAT DENETİMİ: ${gecti}/${gecti} geçti` : `HABİTAT DENETİMİ: ${gecti} geçti, ${kaldi} KALDI`);
process.exit(kaldi === 0 ? 0 : 1);
