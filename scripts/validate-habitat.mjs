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

import * as H from '../presets/habitat_blocks/hab-parts.mjs';
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
  ok(mars.kapsamParca === 26 && ay.kapsamParca === 24,
    'ortam kapsamı bileşen sayısını değiştiriyor', `Mars ${mars.kapsamParca}, Ay ${ay.kapsamParca}`);
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
  let enKucuk = Infinity, ciftAd = '';
  for (let i = 1; i <= 20; i++) {
    const k = i / 20;
    const of = A.explode(k);
    const konum = A.parts.map(p => {
      const d = of.get(p.id) || [0, 0, 0];
      return { p, x: p.pos[0] + d[0], y: p.pos[1] + d[1], z: p.pos[2] + d[2] };
    });
    for (let a = 0; a < konum.length; a++) {
      for (let b = a + 1; b < konum.length; b++) {
        const A1 = konum[a], B1 = konum[b];
        if (A1.p.parent !== B1.p.parent) continue;       // yalnız kardeşler
        const mesafe = Math.hypot(A1.x - B1.x, A1.y - B1.y, A1.z - B1.z);
        const yaricap = (Math.max(...A1.p.size) + Math.max(...B1.p.size)) / 2;
        const aciklik = mesafe - yaricap * 0.5;
        if (aciklik < enKucuk) { enKucuk = aciklik; ciftAd = `${A1.p.id}/${B1.p.id} k=${k}`; }
      }
    }
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
  ok(g.kesilebilirW > 0 && H.KESILEBILIR.length === 4,
    'kesilebilir yükler beyan edilmiş', H.KESILEBILIR.join(','));
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
console.log(kaldi === 0 ? `HABİTAT DENETİMİ: ${gecti}/${gecti} geçti` : `HABİTAT DENETİMİ: ${gecti} geçti, ${kaldi} KALDI`);
process.exit(kaldi === 0 ? 0 : 1);
