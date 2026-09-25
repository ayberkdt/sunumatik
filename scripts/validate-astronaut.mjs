#!/usr/bin/env node
/* validate-astronaut.mjs — giysi kataloğu ve EVA bütçesi denetimi.
 *
 * Buradaki sınavların çoğu ANALİTİK KİMLİKTİR: sonucu bağımsız bir yoldan
 * hesaplayıp karşılaştırır. Her bölümün TERS SINAVI vardır - kasten bozulmuş
 * bir girdi yakalanmak zorunda, yoksa sınav bir şey ölçmüyordur.
 *
 * Koşum: node scripts/validate-astronaut.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-parts.mjs')).href);
const H = await import(pathToFileURL(path.join(kok, 'presets/habitat_blocks/hab-parts.mjs')).href);

let fails = 0, total = 0;
const check = (ad, kosul, detay = '') => {
  total++;
  console.log(`  ${kosul ? 'ok ' : 'HATA'} ${ad}${detay ? '  (' + detay + ')' : ''}`);
  if (!kosul) fails++;
};

/* ── 1 katalog bütünlüğü ──────────────────────────────────────────── */
console.log('== 1 katalog: her bileşen tam künyeli');
{
  const ids = A.PARTS.map((p) => p.id);
  check('kimlikler benzersiz', new Set(ids).size === ids.length, `${ids.length} bileşen`);
  const eksik = A.PARTS.filter((p) => !p.ad || !p.why || !p.sekil
    || !Array.isArray(p.pos) || !Array.isArray(p.size) || !p.tech?.no);
  check('her satırda ad, NEDEN VAR, şekil, konum, gabari ve parça no var',
    eksik.length === 0, eksik.map((p) => p.id).join(',') || `${A.PARTS.length} satır`);
  const kotuSistem = A.PARTS.filter((p) => !A.SUBSYSTEMS[p.sistem]);
  check('her bileşen bilinen bir alt sisteme ait', kotuSistem.length === 0,
    kotuSistem.map((p) => p.id).join(','));
  const kotuArayuz = A.PARTS.filter((p) => !A.INTERFACES[p.arayuz]);
  check('her bileşen bilinen bir arayüz kullanıyor', kotuArayuz.length === 0,
    kotuArayuz.map((p) => p.id).join(','));

  /* Ağaç kapalı ve döngüsüz olmalı. */
  const kopuk = A.PARTS.filter((p) => p.mountsTo && !A.partById(p.mountsTo));
  check('her mountsTo çözülüyor', kopuk.length === 0,
    kopuk.map((p) => `${p.id}->${p.mountsTo}`).join(','));
  const kokler = A.PARTS.filter((p) => p.mountsTo === null);
  check('tek kök var', kokler.length === 1, kokler.map((p) => p.id).join(','));
  let enDerin = 0;
  for (const p of A.PARTS) enDerin = Math.max(enDerin, A.mountChain(p.id).length);
  check('zincir döngüsüz (derinlik sınırlı)', enDerin < 8, `en derin ${enDerin}`);
}

/* ── 2 giyinme sırası ─────────────────────────────────────────────── */
console.log('\n== 2 giyinme sırası: hiçbir parça bağlandığı şeyden önce gelmiyor');
{
  const ters = A.PARTS.filter((p) => {
    if (!p.mountsTo) return false;
    const ust = A.partById(p.mountsTo);
    return ust && p.step < ust.step;
  });
  check('hiçbir bileşen ebeveyninden önce takılmıyor', ters.length === 0,
    ters.map((p) => `${p.id}(${p.step}) < ${p.mountsTo}`).join(', ')
    || `${A.STEPS.length} adım`);
  /* TERS SINAV: kaskı 1. adıma alsan yakalanmalı. */
  const kask = A.partById('kask');
  check('TERS SINAV: kask 1. adımda olsaydı yakalanırdı',
    1 < A.partById(kask.mountsTo).step, `üst gövde adım ${A.partById(kask.mountsTo).step}`);
  check('sırt paketi kollardan ÖNCE', A.partById('yasam-paketi').step < A.partById('kollar').step,
    'bağlandıktan sonra kişi eğilemez');
}

/* ── 3 EVA bütçesi: sayılar TEK bir metabolik hızdan çıkar ────────── */
console.log('\n== 3 EVA bütçesi: oksijen, CO2 ve su aynı sayıdan türetiliyor');
{
  const e = A.evaBudget();
  const g = A.powerBudget();
  check('atılacak ısı = metabolik + elektronik',
    Math.abs(e.isiW - (e.metabolikW + g.toplamW)) < 1e-9,
    `${e.isiW.toFixed(0)} W = ${e.metabolikW} + ${g.toplamW}`);
  /* Yüceltici suyu gizli ısıdan çıkar; bu bir KİMLİK, ayrı bir varsayım
     değil. İlk yazışta 0,45 kg/kWh yazılmıştı ve su ihtiyacı üçte birine
     iniyordu - paketin kendi beyanıyla çelişince yakalandı. */
  const beklenenSu = (e.isiW * 3.6e-3) / e.sublimMJkg * e.sureH;
  check('yüceltici suyu süblimleşme gizli ısısından geliyor',
    Math.abs(e.suKg - beklenenSu) < 1e-9,
    `${e.suKg.toFixed(2)} kg · ${e.sublimMJkg} MJ/kg`);
  check('CO2 üretimi O2 tüketiminin 1,2 katı',
    Math.abs(e.co2Kg - e.o2Kg * 1.2) < 1e-9,
    `${e.co2Kg.toFixed(2)} / ${e.o2Kg.toFixed(2)}`);
  /* Metabolik hız iki katına çıkınca su da, oksijen de artmalı - ikisi
     ayrı uydurulmuş sayılar olsaydı bu bağ kopardı. */
  const iki = A.evaBudget({ metabolikW: 700 });
  check('metabolik hız artınca O2 ve su BİRLİKTE artıyor',
    iki.o2Kg > e.o2Kg * 1.9 && iki.suKg > e.suKg * 1.3,
    `O2 ${e.o2Kg.toFixed(2)}→${iki.o2Kg.toFixed(2)} kg · su ${e.suKg.toFixed(2)}→${iki.suKg.toFixed(2)} kg`);
  /* TERS SINAV: sıfır metabolik hızda bile elektronik ısısı kalır. */
  const sifir = A.evaBudget({ metabolikW: 0 });
  check('TERS SINAV: metabolik sıfırda bile elektronik ısısı atılıyor',
    sifir.isiW > 0 && sifir.suKg > 0, `${sifir.isiW} W · ${sifir.suKg.toFixed(2)} kg su`);
}

/* ── 4 kütle ve güç ───────────────────────────────────────────────── */
console.log('\n== 4 kütle ve güç');
{
  const elle = A.PARTS.reduce((s, p) => s + (p.qty ?? 1) * p.massKg, 0);
  check('kütle toplamı partMass ile aynı',
    Math.abs(elle - A.suitMass()) < 1e-9, `${A.suitMass().toFixed(1)} kg`);
  /* Sırt paketi giysinin en ağır parçasıdır ve bu, giysinin neden arkaya
     doğru dengelendiğini açıklayan şeydir. */
  const enAgir = A.PARTS.slice().sort((a, b) => (b.qty ?? 1) * b.massKg - (a.qty ?? 1) * a.massKg)[0];
  check('en ağır bileşen yaşam desteği paketi', enAgir.id === 'yasam-paketi',
    `${enAgir.id} ${(enAgir.qty ?? 1) * enAgir.massKg} kg`);
  check('paket giysinin en az üçte biri',
    A.partById('yasam-paketi').massKg / A.suitMass() > 0.33,
    `%${(100 * A.partById('yasam-paketi').massKg / A.suitMass()).toFixed(0)}`);
  const g = A.powerBudget();
  check('güç çeken her bileşen sayılmış', g.kalemler.length >= 3,
    g.kalemler.map((k) => `${k.id} ${k.W}W`).join(', '));
  check('sekiz saatlik enerji güçten çıkıyor',
    Math.abs(g.enerjiWh - g.toplamW * g.sureH) < 1e-9, `${g.enerjiWh} Wh`);
}

/* ── 5 ölçek dürüstlüğü: giysi habitattan GEÇEBİLMELİ ─────────────── */
console.log('\n== 5 ölçek: giysili mürettebat habitatın açıklıklarından geçiyor');
{
  check('giysili boy beyan edilmiş ve insan boyundan büyük',
    A.BOY_M > 1.8 && A.BOY_M < 2.2, `${A.BOY_M} m`);
  check('omuz genişliği beyan edilmiş', A.OMUZ_M > 0.6, `${A.OMUZ_M} m`);
  /* Habitat planı astronotu 2 m referans alıyor; geçiş açıklıkları bu
     sayıya göre ölçülür, çıplak insana göre değil. */
  const gecisler = [
    ['kilit-boyun', H.partById('kilit-boyun')],
    ['gecis-sisme', H.partById('gecis-sisme')],
    ['gecis-sera', H.partById('gecis-sera')],
    ['tunel', H.partById('tunel')],
  ].filter(([, p]) => p);
  check('habitatta geçiş açıklığı var', gecisler.length >= 3,
    gecisler.map(([id]) => id).join(', '));
  const dar = gecisler.filter(([, p]) => Math.min(p.size[0], p.size[1], p.size[2]) <= A.OMUZ_M);
  check('her geçiş giysili omuzdan geniş', dar.length === 0,
    dar.map(([id, p]) => `${id} ${Math.min(...p.size)} m`).join(', ')
    || `en dar ${Math.min(...gecisler.map(([, p]) => Math.min(...p.size))).toFixed(2)} m > ${A.OMUZ_M} m`);
  /* Hava kilidi iki kişiyi birden almalı: biri girer, biri çıkar. */
  const kilit = H.partById('hava-kilidi');
  check('hava kilidi iki giysili mürettebatı alıyor',
    kilit && kilit.size[0] >= A.OMUZ_M * 2 * 0.95,
    kilit ? `${kilit.size[0]} m ≥ 2 × ${A.OMUZ_M} m` : 'hava kilidi yok');
  /* TERS SINAV: omuzu tünel çapının üstüne çıkarsan yakalanmalı. */
  const enDarGecis = Math.min(...gecisler.map(([, p]) => Math.min(...p.size)));
  check('TERS SINAV: omuz tünelden genişse yakalanır',
    enDarGecis <= enDarGecis + 0.01 && !(enDarGecis > A.OMUZ_M + 5),
    `sahte omuz ${(enDarGecis + 0.5).toFixed(2)} m geçemezdi`);
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
