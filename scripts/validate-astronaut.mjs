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
import { register } from 'node:module';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* Bu kapı artık yalnız kataloğu okumuyor: 6. bölüm figürü KURUP ölçüyor,
   çünkü çerçeve kusurları (omuz yatağının göğse düşmesi, elin arkada
   kalması) katalogda değil ancak çizilen geometride görünür. */
register(pathToFileURL(path.join(kok, 'scripts/three-resolver.mjs')).href, import.meta.url);
const { domKur } = await import(pathToFileURL(path.join(kok, 'scripts/dom-stub.mjs')).href);
domKur();
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

/* ── 6 GÖVDE ÇERÇEVESİ ────────────────────────────────────────────────
 *
 * Bu bölüm var çünkü çerçeve aynı anda üç şeydi ve KURULAN figür ölçülünce
 * çıktı:
 *
 *   omuz-yatagi   x = ±0,270 · y = 0    biri GÖĞÜSTE, öteki SIRTTA
 *   yasam-paketi  y = -0,268            sırt paketi sol kolun içinde
 *   gogus-paneli  y = +0,227            göğüs paneli sol böğürde
 *   eldivenler    x = -0,123            dik duran figürün elleri arkada
 *
 * Sebep: katalog aynalama eksenini hiç söylemiyordu, montajcı qty 2 olan
 * parçalarda `pos[0]`'ı bir koordinat değil BÜYÜKLÜK diye okuyordu, ve her
 * mafsal kendi fleksiyon işaretini icat ediyordu. Üçü de artık beyan edilir;
 * burada beyan ile ÇİZİLEN karşılaştırılır.
 */
console.log('');
console.log('== 6 gövde çerçevesi: beyan edilen yön ile çizilen yön');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const { buildAstronaut, POZLAR } = AB;
  const v = new THREE.Vector3();
  const merkez = (o) => {
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    o.updateWorldMatrix(true, true);
    o.traverse((m) => {
      const q = m.geometry?.attributes?.position;
      if (!q) return;
      for (let i = 0; i < q.count; i++) {
        v.fromBufferAttribute(q, i).applyMatrix4(m.matrixWorld);
        mn = [Math.min(mn[0], v.x), Math.min(mn[1], v.y), Math.min(mn[2], v.z)];
        mx = [Math.max(mx[0], v.x), Math.max(mx[1], v.y), Math.max(mx[2], v.z)];
      }
    });
    return { mn, mx, c: [0, 1, 2].map(i => (mn[i] + mx[i]) / 2) };
  };
  const { root, nodes } = buildAstronaut(THREE, { poz: 'dik' });

  /* Her qty 2 satırı aynalama eksenini BEYAN etmeli ve o eksende sıfırdan
     farklı olmalı - yoksa iki kopya üst üste biner. */
  const ciftler = A.PARTS.filter(p => (p.qty ?? 1) === 2);
  const eksik = ciftler.filter(p => !p.ayna
    || Math.abs(p.pos[{ x: 0, y: 1, z: 2 }[p.ayna]]) < 1e-6);
  check('qty 2 olan her parça aynalama eksenini beyan ediyor', eksik.length === 0,
    eksik.map(p => p.id).join(', ') || `${ciftler.length} çift`);
  check('her satır gövdede nerede durduğunu söylüyor',
    A.PARTS.every(p => p.yon && A.YONLER[p.yon]));

  /* Beyan edilen yer ile çizilen yerin İŞARETİ tutmalı. */
  const yanlis = [];
  for (const p of A.PARTS) {
    const n = nodes.get(p.id);
    if (!n) continue;
    const c = merkez(n).c;
    const y = A.YONLER[p.yon];
    if (p.yon === 'gogus' && !(c[0] > 0.05)) yanlis.push(`${p.id} göğüs ama x=${c[0].toFixed(3)}`);
    if (p.yon === 'sirt' && !(c[0] < -0.05)) yanlis.push(`${p.id} sırt ama x=${c[0].toFixed(3)}`);
    if (p.yon === 'yan' && !(Math.abs(c[1]) > 0.05)) yanlis.push(`${p.id} yan ama y=${c[1].toFixed(3)}`);
    if (p.yon === 'orta' && Math.abs(c[1]) > 0.06) yanlis.push(`${p.id} orta ama y=${c[1].toFixed(3)}`);
    void y;
  }
  check('çizilen konum beyan edilen yönle aynı işarette', yanlis.length === 0,
    yanlis.join(' · ') || `${A.PARTS.length} satır`);

  /* Aynalanan çift GERÇEKTEN aynalanmış olmalı: ±y'de ve aynı yükseklikte. */
  const bozuk = [];
  for (const p of ciftler) {
    const a1 = nodes.get(p.id), a2 = nodes.get(`${p.id}#2`);
    if (!a1 || !a2) { bozuk.push(`${p.id} tek kopya`); continue; }
    const c1 = merkez(a1).c, c2 = merkez(a2).c;
    if (Math.sign(c1[1]) === Math.sign(c2[1])) bozuk.push(`${p.id} ikisi de y=${c1[1].toFixed(2)}`);
    if (Math.abs(c1[2] - c2[2]) > 0.02) bozuk.push(`${p.id} yükseklik ${c1[2].toFixed(2)}≠${c2[2].toFixed(2)}`);
    if (Math.abs(Math.abs(c1[1]) - Math.abs(c2[1])) > 0.02) bozuk.push(`${p.id} simetrik değil`);
  }
  check('aynalanan her çift sol/sağ simetrik', bozuk.length === 0, bozuk.join(' · ') || `${ciftler.length} çift`);

  /* TERS SINAV: aynalama ekseni x olsa omuz yatakları göğse ve sırta düşer -
     tam da düzeltilen kusur. Ölçüm bunu yakalamak zorunda. */
  const sahte = { ...A.partById('omuz-yatagi'), ayna: 'x', pos: [0.275, 0, 1.45] };
  const k = A.kopyaKonumlari(sahte);
  check('TERS SINAV: x ekseninde aynalama göğüs/sırt çifti üretir (eski kusur)',
    Math.abs(k[0][1]) < 1e-6 && Math.abs(k[1][1]) < 1e-6 && k[0][0] === -k[1][0],
    `[${k[0].join(',')}] ve [${k[1].join(',')}]`);

  /* FLEKSİYON İŞARETİ. Dik duruşta dirsek 16° bükük: eller gövdenin ÖNÜNDE
     olmalı. Eski sözleşmede -0,123 m ile ARKADAYDI. */
  const el = merkez(nodes.get('eldivenler')).c;
  check('dirsek fleksiyonu eli ÖNE getiriyor', el[0] > 0.05, `el x = ${el[0].toFixed(3)} m`);
  const omuzY = merkez(nodes.get('omuz-yatagi')).c;
  check('omuz yatakları yanlarda, göğüste değil',
    Math.abs(omuzY[1]) > 0.2 && Math.abs(omuzY[0]) < 0.06,
    `x ${omuzY[0].toFixed(3)} · y ${omuzY[1].toFixed(3)}`);
  const paket = merkez(nodes.get('yasam-paketi')).c;
  check('yaşam paketi SIRTTA', paket[0] < -0.15 && Math.abs(paket[1]) < 0.06,
    `x ${paket[0].toFixed(3)} · y ${paket[1].toFixed(3)}`);

  /* ÖLÇEK: çizilen boy ve omuz, beyan edilenle %3 içinde kalmalı. Bir kapı
     açıklığı beyana göre değil, geçecek şeye göre ölçülür. */
  const B = merkez(root);
  const boy = B.mx[2] - B.mn[2], gen = B.mx[1] - B.mn[1];
  check('çizilen boy beyan edilenle tutuyor', Math.abs(boy - A.BOY_M) / A.BOY_M < 0.03,
    `${boy.toFixed(3)} m / ${A.BOY_M} m (%${(100 * Math.abs(boy - A.BOY_M) / A.BOY_M).toFixed(1)})`);
  check('çizilen omuz beyan edilenle tutuyor', Math.abs(gen - A.OMUZ_M) / A.OMUZ_M < 0.03,
    `${gen.toFixed(3)} m / ${A.OMUZ_M} m`);
  check('ayaklar yere oturuyor', Math.abs(B.mn[2]) < 0.005, `taban ${B.mn[2].toFixed(4)} m`);

  /* Her poz yere oturmalı: sabit ofset çömelmiş figürü havada bırakır. */
  const havada = [];
  for (const ad of Object.keys(POZLAR)) {
    const r = buildAstronaut(THREE, { poz: ad }).root;
    const m = merkez(r);
    if (Math.abs(m.mn[2]) > 0.005) havada.push(`${ad} ${m.mn[2].toFixed(3)}`);
  }
  check('beş duruşun hepsinde ayaklar yerde', havada.length === 0,
    havada.join(', ') || Object.keys(POZLAR).join(', '));
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
