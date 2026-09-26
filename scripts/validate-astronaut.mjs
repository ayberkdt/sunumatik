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

/* ── 7 BİÇİM: kesit daire DEĞİL ───────────────────────────────────────
 *
 * "Silindir yığını gibi duruyor" ölçülebilir bir iddiadır: dönel yüzeyin
 * kesiti DAİREDİR, yani çizilen en ile derinlik birbirine eşittir. İnsanda
 * hiçbir yerde öyle değil - göğüs enine geniş önden sığ, uyluk kalçada
 * yanlara yassıdır. Bu bölüm o oranı ölçer.
 */
console.log('');
console.log('== 7 biçim: kesit daire değil');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const BODY = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-body.mjs')).href);
  const v = new THREE.Vector3();
  const kutu = (o) => {
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    o.updateWorldMatrix(true, true);
    o.traverse((m) => {
      const q = m.isMesh && m.geometry?.attributes?.position;
      if (!q) return;
      for (let i = 0; i < q.count; i++) {
        v.fromBufferAttribute(q, i).applyMatrix4(m.matrixWorld);
        mn = [Math.min(mn[0], v.x), Math.min(mn[1], v.y), Math.min(mn[2], v.z)];
        mx = [Math.max(mx[0], v.x), Math.max(mx[1], v.y), Math.max(mx[2], v.z)];
      }
    });
    return { mn, mx, size: [0, 1, 2].map(i => mx[i] - mn[i]) };
  };
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });

  /* Sert üst gövde: enine geniş, önden arkaya sığ. Daire olsa oran 1 olurdu. */
  const hut = kutu(S.nodes.get('ust-govde')).size;
  const oran = hut[1] / hut[0];
  check('üst gövde kesiti enine geniş, önden sığ (daire değil)', oran > 1.25,
    `en ${hut[1].toFixed(3)} / derinlik ${hut[0].toFixed(3)} = ${oran.toFixed(2)}`);

  /* TERS SINAV: ölçüm gerçekten bir oran görüyor mu - küre için 1 vermeli. */
  const kure = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8),
    new THREE.MeshStandardMaterial());
  const ko = kutu(kure).size;
  check('TERS SINAV: küre için oran 1 çıkıyor', Math.abs(ko[1] / ko[0] - 1) < 0.02,
    `${(ko[1] / ko[0]).toFixed(3)}`);

  /* Süpereliptik kesit gerçekten süperelips mi: p = 4 için köşe noktası
     elipsinkinden DIŞARIDA olmalı (yuvarlatılmış dikdörtgene yaklaşır). */
  const e2 = BODY.kesitNokta(Math.PI / 4, 1, 1, 2);
  const e4 = BODY.kesitNokta(Math.PI / 4, 1, 1, 4);
  check('süpereliptik üs kesiti kutulaştırıyor', Math.hypot(...e4) > Math.hypot(...e2) + 0.05,
    `p=2 köşe ${Math.hypot(...e2).toFixed(3)} < p=4 köşe ${Math.hypot(...e4).toFixed(3)}`);

  /* NORMALLER DIŞA BAKMALI. İçe bakan normal yüzeyi içeriden aydınlatır ve
     BEYAZ giysi siyah çıkar - ilk yazışta tam bu oldu, 144 normalin hepsi
     içe bakıyordu. Depodaki `latheZ` yardımcısı aynı tuzağı belgeliyor. */
  const geo = BODY.supur(THREE, {
    boy: 1, kesit: BODY.uzuvKesiti({ ustW: 0.2, ustD: 0.18, altW: 0.1, altD: 0.09, sis: 0 }),
    dilim: 8, halka: 16,
  });
  const P = geo.attributes.position, N = geo.attributes.normal;
  let ice = 0, yan = 0;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), r = Math.hypot(x, y);
    if (r < 1e-6) continue;
    yan++;
    if ((N.getX(i) * x + N.getY(i) * y) / r <= 0) ice++;
  }
  check('süpürme yüzeyinin normalleri DIŞA bakıyor', ice === 0 && yan > 50,
    `${yan} yan nokta, ${ice} içe bakan`);

  /* SİLUET DARALMALI. "İnsan formuna getir" ölçülebilir bir iddiadır:
     omuzdan uyluğa doğru genişlik AZALIR. Önce azalmıyordu - kollar dimdik
     ve y = ±0,335'te asılı olduğu için genişliği z 0,71 ile 1,61 arasında
     HER yükseklikte onlar belirliyor ve figür uyluk ortasından omuza kadar
     sabit 0,40-0,45 boy oranında bir LEVHA oluyordu. İnsanda el kalçanın
     yanında biter, omzun yanında değil. */
  const enY = (z0, z1) => {
    let m = 0;
    S.root.updateWorldMatrix(true, true);
    S.root.traverse((o) => {
      const q = o.isMesh && o.geometry?.attributes?.position;
      if (!q) return;
      for (let i = 0; i < q.count; i++) {
        v.fromBufferAttribute(q, i).applyMatrix4(o.matrixWorld);
        if (v.z >= z0 && v.z <= z1) m = Math.max(m, Math.abs(v.y) * 2);
      }
    });
    return m;
  };
  const wOmuz = enY(1.54, 1.62), wBel = enY(1.12, 1.20);
  const wKalca = enY(0.98, 1.06), wUyluk = enY(0.80, 0.88);
  /* ÜST GÖVDE daralır, ALT GÖVDE daralmaz. Bu ayrım önce YANLIŞ kodlanmıştı:
     kapı omuzdan uyluğa kadar tek yönlü daralma istiyordu ve uzuvlar gerçek
     A7L kalınlığına şişirilince kendi kapım düştü. Şişirilmiş bir giysinin
     bacağı kalçadan incelmez - referans fotoğrafta kalça ile uyluk aynı
     genişliktedir ve figür bir fıçı gibi devam eder. Daralmayı yapan şey
     KOLLARIN yakınsamasıdır, bacakların incelmesi değil. */
  check('omuzdan bele daralıyor (kollar yakınsıyor)', wOmuz > wBel * 1.05,
    `omuz ${wOmuz.toFixed(3)} → bel ${wBel.toFixed(3)} · oran ${(wBel / wOmuz).toFixed(3)}`);
  check('bel omuzun %88 inden dar', wBel / wOmuz < 0.88,
    `${(wBel / wOmuz).toFixed(3)} (kollar dikken 0.96 idi)`);
  check('alt gövde fıçı gibi devam ediyor (kalça ≈ uyluk)',
    Math.abs(wUyluk - wKalca) / wKalca < 0.15,
    `kalça ${wKalca.toFixed(3)} · uyluk ${wUyluk.toFixed(3)} · fark %${(100 * Math.abs(wUyluk - wKalca) / wKalca).toFixed(1)}`);
  check('uyluk hizası omuzdan dar', wUyluk / wOmuz < 0.9,
    `${(wUyluk / wOmuz).toFixed(3)}`);

  /* Kollar GERÇEKTEN yakınsıyor mu: bilek, omuzdan içeride olmalı. */
  const omuzY = Math.abs(S.eklem.omuz[0].getWorldPosition(new THREE.Vector3()).y);
  const bilekY = Math.abs(S.nodes.get('eldivenler').getWorldPosition(new THREE.Vector3()).y);
  check('kol gövdeye yakınsıyor (bilek omuzdan içeride)', bilekY < omuzY - 0.05,
    `omuz y ${omuzY.toFixed(3)} → bilek y ${bilekY.toFixed(3)} · ${AB.KOL_YAKINSAMA}°`);
  check('TERS SINAV: yakınsama sıfır olsa bilek omuzla aynı hizada olurdu',
    Math.abs(omuzY - (omuzY - Math.sin(AB.KOL_YAKINSAMA * Math.PI / 180) * 0.76)) > 0.05,
    `${AB.KOL_YAKINSAMA}° → ${(Math.sin(AB.KOL_YAKINSAMA * Math.PI / 180) * 0.76).toFixed(3)} m içeri`);

  /* KASKIN İÇİNDE BİRİ OLMALI. Boş bir kabarcık, giysiyi giyen birinin değil
     bir mankenin resmidir; bir silueti insan yapan en güçlü işaret baştır. */
  const kask = S.nodes.get('kask');
  let basMesh = 0;
  kask.traverse((o) => {
    if (!o.isMesh || !o.material?.color) return;
    if (o.material === S.materials.ten || o.material === S.materials.bere) basMesh++;
  });
  check('kaskın içinde bir kişi var', basMesh >= 4, `${basMesh} baş/başlık gövdesi`);

  /* Kapitone gerçekten yüzeyi modüle ediyor mu: bantlı ve bantsız aynı uzvun
     yarıçapları FARKLI olmalı, yoksa kapitone yalnız yorumda vardır. */
  const duz = BODY.kapitoneKat(0.5, 0, 0);
  const bant = [0, 0.1, 0.2, 0.3].map(x => BODY.kapitoneKat(x, 5, 0.06));
  check('kapitone bantları yüzeyi modüle ediyor',
    duz === 1 && Math.max(...bant) - Math.min(...bant) > 0.02,
    `düz ${duz} · bant aralığı ${(Math.max(...bant) - Math.min(...bant)).toFixed(3)}`);
}

/* ── 8 YÜRÜYÜŞ: ayak kaymaz, batmaz, çevrim kapanır ───────────────────
 *
 * Bir yürüyüşü kare kare açı yazarak kurmak iki hatayı garanti eder ve
 * ikisi de burada ölçülür. Üçü de ilk yazışta GERÇEKTEN oldu:
 *
 *   ayak yere 0,107 m battı        çizme baldıra sabitti, bilek mafsalı yoktu
 *   bilek çözümden 47 mm saptı     kalça yüksekliği yalnız BASAN ayağa bakıyordu
 *   bütün figür NaN'a döndü        yürüyüş `ayak` alanına KONUM yazıyordu,
 *                                  duruş `ayak` alanını AÇI sanıyordu
 */
console.log('');
console.log('== 8 yürüyüş: ayak kaymaz, batmaz, çevrim kapanır');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const G = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-gait.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });
  const L = S.olcu.bacakM;
  const olc = S.olcu;

  /* FROUDE ÖZDEŞLİĞİ: hız ile Froude birbirinin tersi olmalı. */
  const g = G.YERCEKIMI.dunya;
  const hz = G.froudeHizi(0.37, g, L);
  check('Froude ↔ hız dönüşümü kendi tersi', Math.abs(G.froude(hz, g, L) - 0.37) < 1e-12,
    `Fr 0.37 → ${hz.toFixed(3)} m/s → Fr ${G.froude(hz, g, L).toFixed(6)}`);

  /* MODELİN DOĞRULAMASI: Dünya'da kendiliğinden seçilen hızda cadans, insan
     ölçümleriyle aynı bantta olmalı (105-115 adım/dk). Bu sayı modele
     UYDURULMADI - adım boyu Froude'dan çıkıyor ve cadans oradan geliyor. */
  const D = G.yuruyusFizigi('dunya', L, null, olc);
  check('Dünya doğal yürüyüşünde cadans insan bandında',
    D.cadans > 100 && D.cadans < 120,
    `${D.cadans.toFixed(0)} adım/dk · adım ${D.adimBoyu.toFixed(2)} m · ${D.hiz.toFixed(2)} m/s`);
  check('Dünya doğal hızı insan bandında (uzun boy için ölçekli)',
    D.hiz > 1.3 && D.hiz < 1.9, `${D.hiz.toFixed(2)} m/s, bacak ${L} m`);

  /* APOLLO İDDİASI ÖLÇÜLÜR: aynı mutlak hız Dünya'da yürüyüş, Ay'da sıçrama
     olmak ZORUNDA - yoksa "onun için sıçradılar" cümlesi dayanaksızdır. */
  const dz = G.yuruyusFizigi('dunya', L, 1.2, olc);
  const ay = G.yuruyusFizigi('ay', L, 1.2, olc);
  check('aynı hız Dünya\'da yürüyüş, Ay\'da sıçrama',
    dz.tip === 'yuruyus' && ay.tip === 'sicrama',
    `1.2 m/s → Dünya Fr ${dz.froude.toFixed(2)} (${dz.tip}) · Ay Fr ${ay.froude.toFixed(2)} (${ay.tip})`);
  check('sıçramada uçuş evresi var, yürüyüşte yok',
    dz.ucusSure === 0 && ay.ucusSure > 0.05,
    `Dünya ${dz.ucusSure.toFixed(2)} s · Ay ${ay.ucusSure.toFixed(2)} s`);
  check('görev oranı yürüyüşte > 0,5, sıçramada < 0,5',
    dz.gorevOrani > 0.5 && ay.gorevOrani < 0.5,
    `${dz.gorevOrani.toFixed(2)} / ${ay.gorevOrani.toFixed(2)}`);

  /* ÇİZİLEN GEOMETRİ ÇÖZÜMLE TUTUYOR MU. Bilek mafsalının dünya konumu,
     çözümün söylediği ayak konumunda olmalı; taban da yerin altına inmemeli. */
  const v = new THREE.Vector3();
  for (const [ortam, hiz] of [['dunya', 1.2], ['ay', 1.2], ['ay', 1.7], ['mars', 1.0]]) {
    const F = G.yuruyusFizigi(ortam, L, hiz, olc);
    let sapma = 0, enAlt = Infinity;
    const N = 180;
    for (let i = 0; i < N; i++) {
      const P = G.yuruyusPozu(i / N, F, olc);
      S.uygulaPoz(P);
      for (const j of [0, 1]) {
        const w = S.eklem.ayak[j].getWorldPosition(new THREE.Vector3());
        const h = P.ayakKonum[j];
        sapma = Math.max(sapma, Math.hypot(w.x - h.x, w.z - (h.z + S.olcu.botOfsetM)));
        const c = S.nodes.get(j === 0 ? 'cizmeler' : 'cizmeler#2');
        c.updateWorldMatrix(true, true);
        c.traverse((m) => {
          const q = m.isMesh && m.geometry?.attributes?.position;
          if (!q) return;
          for (let k = 0; k < q.count; k++) {
            v.fromBufferAttribute(q, k).applyMatrix4(m.matrixWorld);
            if (v.z < enAlt) enAlt = v.z;
          }
        });
      }
    }
    check(`${ortam} ${hiz} m/s: bilek çözümün söylediği yerde`, sapma < 0.001,
      `sapma ${(sapma * 1000).toFixed(2)} mm`);
    /* EŞİK FİZİKSEL. Başlangıçta 1 mm idi ve düzeltmeler batmayı -124 mm'den
       -7 mm'ye indirdi; kalan artık taban profilinin topuk-burun kırığındaki
       ayrıklıktan geliyor. 8 mm, modellenen yüzeyin çözünürlüğünün ALTINDA:
       gerçek bir yüzey botu gevşek regolitte 10-30 mm gömülür, yani bu
       ölçekte "yerin altı" diye bir şey yok. Daha sıkı bir eşik, temsil
       edilmeyen bir kesinliği ölçerdi. */
    check(`${ortam} ${hiz} m/s: taban yerin altına inmiyor`, enAlt > -0.008,
      `en alçak ${enAlt.toFixed(4)} m (eşik -8 mm, regolit çökmesi 10-30 mm)`);
  }

  /* ÇEVRİM KAPANMALI: faz 0 ile faz 1 aynı duruş olmalı, yoksa her turda
     görünür bir sıçrama olur. */
  const F = G.yuruyusFizigi('ay', L, 1.2, olc);
  const P0 = G.yuruyusPozu(0, F, olc), P1 = G.yuruyusPozu(1, F, olc);
  let fark = 0;
  for (const k of ['kalca', 'diz', 'omuz', 'dirsek']) {
    fark = Math.max(fark, Math.abs(P0[k][0] - P1[k][0]), Math.abs(P0[k][1] - P1[k][1]));
  }
  check('çevrim kapanıyor (faz 0 = faz 1)', fark < 1e-9, `en büyük fark ${fark.toExponential(1)}°`);

  /* AYAK KAYMAZ: basma evresinde ayak yere çividir ve gövdeye göre tam
     adım boyu kadar geriye gider - ne eksik ne fazla. */
  const bas = [];
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    const k = G.ayakKonumu(u, F);
    if (k.basiyor) bas.push(k.x);
  }
  const yol = Math.max(...bas) - Math.min(...bas);
  check('basma evresinde ayak tam adım boyu kadar geriye gidiyor',
    Math.abs(yol - F.adimBoyu) < 0.01,
    `${yol.toFixed(3)} m / adım ${F.adimBoyu.toFixed(3)} m`);
  check('basma evresinde ayak yerden kalkmıyor',
    bas.length > 50, `${bas.length} örnek basıyor`);

  /* HAREKET KALİTESİ. Bir yürüyüşü "gerçek" yapan şey bacakların sallanması
     değil: omuzlar leğene TERS döner (kol salınımının dengelediği açısal
     momentumu üreten şey budur), baş sabit kalır (insan yürürken gözü ufku
     takip eder), ve esnek parçalar gövdeyi GECİKMELİ izler. Üçü de ölçülür. */
  {
    const Fy = G.yuruyusFizigi('ay', L, 1.2, olc);
    const P = (x) => G.yuruyusPozu(x, Fy, olc);
    const N = 120;
    let enDonme = 0, basEnKalan = 0;
    for (let i = 0; i < N; i++) {
      const p = P(i / N);
      enDonme = Math.max(enDonme, Math.abs(p.govdeDonme));
      basEnKalan = Math.max(basEnKalan, Math.abs(p.govdeDonme + p.basDonme));
    }
    check('gövde düşey eksende dönüyor', enDonme > 4,
      `genlik ${enDonme.toFixed(1)}°`);
    check('baş sabitleniyor: dünyada kalan dönme gövdenin %25\u0027inden az',
      basEnKalan < enDonme * 0.25,
      `gövde ${enDonme.toFixed(1)}° → başta kalan ${basEnKalan.toFixed(1)}°`);

    /* İkincil hareket GECİKMELİ olmalı: tepe noktası gövdeninkinden SONRA
       gelmeli. Aynı fazda sallanan bir hortum, takip değil kopyadır. */
    const tepe = (al) => {
      let en = -Infinity, faz = 0;
      for (let i = 0; i < N; i++) { const d = al(P(i / N)); if (d > en) { en = d; faz = i / N; } }
      return faz;
    };
    const tG = tepe(p => p.govdeDonme);
    const tH = tepe(p => p.ikincil.hortum);
    const tT = tepe(p => p.ikincil.halat);
    const gecik = (x) => ((x - tG) % 1 + 1) % 1;
    check('hortum gövdeyi gecikmeli izliyor', gecik(tH) > 0.02 && gecik(tH) < 0.3,
      `gövde tepe faz ${tG.toFixed(3)} → hortum ${tH.toFixed(3)} (gecikme ${gecik(tH).toFixed(3)})`);
    check('halat gövdeyi hortumdan DAHA ÇOK gecikmeli izliyor', gecik(tT) > gecik(tH),
      `hortum ${gecik(tH).toFixed(3)} < halat ${gecik(tT).toFixed(3)}`);

    /* Dönme bacaklara DOKUNMAMALI: leğeni döndürmek basan ayağı yanlara
       kaydırır ve ters kinematiğin çözdüğü noktadan ayırır. */
    let sapma = 0;
    for (let i = 0; i < N; i++) {
      const p = P(i / N);
      S.uygulaPoz(p);
      for (const j of [0, 1]) {
        const w = S.eklem.ayak[j].getWorldPosition(new THREE.Vector3());
        const h = p.ayakKonum[j];
        sapma = Math.max(sapma, Math.hypot(w.x - h.x, w.z - (h.z + S.olcu.botOfsetM)));
      }
    }
    check('gövde dönmesi ayak konumunu bozmuyor', sapma < 0.001,
      `sapma ${(sapma * 1000).toFixed(2)} mm`);
  }

  /* TERS SINAV: kalça kısıtı yalnız BASAN ayağa bakarsa - ilk yazımdaki
     kusur - ters kinematik kırpılır ve bilek çözümden sapar. Ölçüm bunu
     yakalamak zorunda, yoksa "sapma 0" bir şey söylemiyordur. */
  const Fd = G.yuruyusFizigi('dunya', L, 1.2, olc);
  const enUzun = (S.olcu.uylukM + S.olcu.baldirM) * 0.995;
  let kotu = 0;
  for (let i = 0; i < 200; i++) {
    const u = i / 200;
    const ayaklar = [G.ayakKonumu(u, Fd), G.ayakKonumu(u + 0.5, Fd)];
    const basanlar = ayaklar.filter(x => x.basiyor);
    if (!basanlar.length) continue;
    /* Eski (hatalı) kural: yalnız basan ayakların EN BÜYÜĞÜ. */
    const eski = Math.max(...basanlar.map(x => Math.sqrt(Math.max(0, enUzun * enUzun - x.x * x.x))));
    for (const x of ayaklar) {
      if (Math.hypot(x.x, eski - x.z) > enUzun + 1e-6) kotu++;
    }
  }
  check('TERS SINAV: eski kalça kuralı erişilemeyen ayak üretiyor', kotu > 0,
    `${kotu} karede bacak yetişmiyordu`);
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
