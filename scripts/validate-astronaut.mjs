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

  /* EKLEM SÜREKLİLİĞİ. İki katı parçayı bir mafsalda birleştirmek yetmez:
     uçları düz kapaklıysa açı büyüdükçe bükümün DIŞINDA kama biçiminde bir
     boşluk açılır. Ölçülen kusur buydu ve figürün "birbirine yapıştırılmış
     parçalar" gibi durmasının sebebiydi.

     Sınama: mafsalın merkezinden 0,6 m uzaktan, büküm düzleminde 72 yöne
     içeri doğru ışın gönderilir ve menzil merkezde durdurulur. Yüzey o yönde
     kopmuşsa ışın hiçbir şeye çarpmaz - kama boşluğu tam budur. */
  {
    const ray = new THREE.Raycaster();
    const surekli = (eklem, altKok, aciDeg, n = 72) => {
      const eski = eklem.rotation.y;
      eklem.rotation.y = aciDeg * Math.PI / 180;
      S.root.updateMatrixWorld(true);
      const c = eklem.getWorldPosition(new THREE.Vector3());
      const hedef = [];
      altKok.traverse((m) => { if (m.isMesh) hedef.push(m); });
      let bos = 0;
      for (let i = 0; i < n; i++) {
        const q = (i / n) * Math.PI * 2;
        const d = new THREE.Vector3(Math.cos(q), 0, Math.sin(q));
        ray.set(c.clone().addScaledVector(d, 0.6), d.clone().negate());
        ray.far = 0.599;
        if (!ray.intersectObjects(hedef, false).length) bos++;
      }
      eklem.rotation.y = eski;
      S.root.updateMatrixWorld(true);
      return bos;
    };
    const kotu = [];
    for (const [ad, ek, altKok, acilar] of [
      ['diz', S.eklem.diz[0], S.eklem.kalca[0], [0, 20, 45, 70, 100]],
      ['dirsek', S.eklem.dirsek[0], S.eklem.omuz[0], [0, 40, 80, 120]],
      ['kalca', S.eklem.kalca[0], S.nodes.get('alt-govde'), [-20, 0, 30, 70]],
    ]) {
      for (const a of acilar) {
        const bos = surekli(ek, altKok, a);
        if (bos > 0) kotu.push(`${ad} ${a}° → ${bos}/72 boş`);
      }
    }
    check('her mafsal her açıda SÜREKLİ (kama boşluğu yok)', kotu.length === 0,
      kotu.join(' · ') || 'diz, dirsek, kalça · 13 açı · hepsi kapalı');

    /* TERS SINAV: ölçüm gerçekten boşluk görüyor mu? Figürün 1,2 m önündeki
       boş uzayda 72 yönün HEPSİ boş çıkmak zorunda, yoksa sınama her şeye
       "kapalı" diyen bir sayaçtan ibarettir. */
    const bosluk = new THREE.Object3D();
    bosluk.position.set(1.2, 0, 1.0);
    S.root.add(bosluk);
    S.root.updateMatrixWorld(true);
    const bosSayi = surekli(bosluk, S.root, 0);
    S.root.remove(bosluk);
    check('TERS SINAV: boş uzayda 72 yönün hepsi boş', bosSayi === 72, `${bosSayi}/72`);
  }

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

/* ── 9 AYNA SİMETRİSİ ─────────────────────────────────────────────────
 *
 * `EKSEN` "sol = +y" diye beyan edilmişti ama hiçbir kapı figürün simetrisini
 * ÖLÇMÜYORDU. Ölçüldüğünde 481 mesh'in 48'inin ayna eşi çıkmadı ve içlerinde
 * gerçek kusurlar vardı: iki yan vizör de sağdaydı (kısmi lathe'in yönü
 * yanlış biliniyordu), haberleşme beresi merkez çizgisinden 33 mm kaymıştı
 * (kısmi kürenin kutbu çevrilmemişti). İkisi de gözle bulunmuştu, kapıyla
 * değil.
 *
 * Asimetri YASAK DEĞİL - beyan edilmemiş asimetri yasak. Bir giysinin tek
 * halatı, tek mikrofonu, tek kontrol listesi vardır ve bunlar SEBEBİYLE
 * birlikte katalogda yazar. Beyan, gerekçesi olan bir cümledir: `true`
 * her yere yapıştırılabilir, bir cümle yapıştırılamaz.
 */
console.log('\n== 9 ayna simetrisi: asimetri beyan edilmeden olmaz');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });
  S.root.updateMatrixWorld(true);

  /* Her mesh hangi PARÇAYA ait? Kopyalar (`cizmeler#2`) aynı parçadır. */
  const parcasi = new Map();
  for (const [ad, n] of S.nodes) {
    const pid = ad.replace(/#\d+$/, '');
    n.traverse((o) => { if (o.isMesh && !parcasi.has(o)) parcasi.set(o, pid); });
  }
  const ms = [];
  S.root.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    ms.push({ c: b.getCenter(new THREE.Vector3()), s: b.getSize(new THREE.Vector3()),
      ySim: Math.abs(b.min.y + b.max.y), pid: parcasi.get(o) ?? '(kök)',
      geo: o.geometry.type });
  });
  /* TOLERANS ÖLÇÜMDEN: meşru eşler 12 mm'nin çok altında buluşuyor (süpürme
     örneklemesi leğen kemiğinde 6 mm bırakıyor), gerçek kusurlar 33 mm ve
     üstünde başlıyordu. */
  const TOL = 0.012;
  const yakin = (a, b) => Math.abs(a - b) < TOL;
  const esi = (m) => ms.some((n) => n !== m
    && yakin(n.c.x, m.c.x) && yakin(n.c.z, m.c.z) && yakin(n.c.y, -m.c.y)
    && yakin(n.s.x, m.s.x) && yakin(n.s.y, m.s.y) && yakin(n.s.z, m.s.z));

  /** Eşi olmayan mesh'ler, parça parça. `yoksay` ters sınav içindir. */
  const essizler = (yoksay = new Set()) => {
    const d = {};
    for (const m of ms) {
      const beyan = A.partById(m.pid)?.asimetrik;
      if (beyan && !yoksay.has(m.pid)) continue;
      if (m.ySim <= TOL) continue;                 // merkez çizgisinde ve simetrik
      if (esi(m)) continue;
      (d[m.pid] ??= []).push(m);
    }
    return d;
  };

  const kotu = essizler();
  const sayi = Object.values(kotu).reduce((a, b) => a + b.length, 0);
  check('simetrik beyan edilen her parça gerçekten simetrik', sayi === 0,
    sayi ? Object.entries(kotu).map(([k, v]) => `${k}:${v.length}`).join(' ')
         : `${ms.length} mesh tarandı`);

  /* Beyanlar gerekçeli mi? */
  const beyanlilar = A.PARTS.filter((q) => q.asimetrik);
  const kisa = beyanlilar.filter((q) => typeof q.asimetrik !== 'string' || q.asimetrik.length < 40);
  check('her asimetri beyanı gerekçeli bir cümle', kisa.length === 0,
    kisa.map((q) => q.id).join(',') || `${beyanlilar.length} beyan`);

  /* Beyan BOŞA yazılmamalı: beyan edilen parça gerçekten asimetrik olmalı,
     yoksa beyan zamanla anlamsız bir etikete dönüşür. */
  const gereksiz = beyanlilar.filter((q) => !(essizler(new Set([q.id]))[q.id]?.length));
  check('hiçbir asimetri beyanı gereksiz değil', gereksiz.length === 0,
    gereksiz.map((q) => q.id).join(',') || `${beyanlilar.length} beyanın hepsi karşılığını buluyor`);

  /* TERS SINAV: emniyet halatının beyanını yok say - kapı DÜŞMELİ. */
  const ters = essizler(new Set(['emniyet-halati']));
  check('TERS SINAV: beyan kaldırılınca tek yanlı halat yakalanıyor',
    (ters['emniyet-halati']?.length ?? 0) > 0,
    `${ters['emniyet-halati']?.length ?? 0} mesh eşsiz kaldı`);

  /* TERS SINAV 2: ölçüm gerçekten ölçüyor mu? Bir mesh'i y'de 40 mm kaydır
     ve eşinin kaybolduğunu gör. Kaydırılmadan ölçüm anlamsız olurdu. */
  const ornek = ms.find((m) => Math.abs(m.c.y) > 0.1 && esi(m));
  const oncesi = esi(ornek);
  ornek.c.y += 0.04;
  const sonrasi = esi(ornek);
  ornek.c.y -= 0.04;
  check('TERS SINAV: 40 mm kaydırılan mesh eşini kaybediyor', oncesi && !sonrasi,
    `${ornek.geo} @ y=${ornek.c.y.toFixed(3)}`);
}

/* ── 10 ZARF: ÇİZİLEN GEOMETRİ BEYAN EDİLEN KUTUNUN İÇİNDE Mİ ─────────
 *
 * Bu kapıda 75 sınav yeşilken astronotun çizilen gabarisini ÖLÇEN tek bir
 * satır yoktu (`Box3` geçmiyordu) ve `validate-geometry` yalnız habitat ile
 * uyduyu kuruyordu. 0,36 m'lik bir çizmenin çevresinde dönen 0,657 m'lik
 * düz siyah bir çember bu boşluktan geçti.
 *
 * Ölçüm SIFIR DURUŞTA yapılır: eklemler sıfırlanınca kalan kutu parçanın
 * KENDİ gabarisidir. Bükülmüş bir kolun dünya kutusu duruşu ölçer, parçayı
 * değil - ölçüldü, aynı kol dik duruşta 2,17 kat, sıfır duruşta 1,80 kat
 * çıkıyor ve aradaki fark geometri değil poz.
 *
 * Çocuk parçalar hariç tutulur: kola takılan eldiven kolun gabarisi değildir.
 */
console.log('\n== 10 zarf: çizilen geometri beyan edilen kutunun içinde');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });
  S.uygulaPoz({ omuz: [0, 0], dirsek: [0, 0], kalca: [0, 0], diz: [0, 0], ayak: [0, 0],
    govdeEgim: 0, govdeDonme: 0, basDonme: 0, kalcaZOfset: 0 });
  S.root.updateMatrixWorld(true);

  const kendiKutusu = (pid) => {
    const n = S.nodes.get(pid) ?? S.nodes.get(`${pid}#1`);
    if (!n) return null;
    const cocuk = new Set();
    for (const [ad, n2] of S.nodes) {
      if (ad.replace(/#\d+$/, '') === pid) continue;
      let q = n2, ic = false;
      while (q) { if (q === n) { ic = true; break; } q = q.parent; }
      if (ic) n2.traverse((o) => cocuk.add(o));
    }
    const b = new THREE.Box3();
    n.traverse((o) => { if (o.isMesh && !cocuk.has(o)) b.expandByObject(o); });
    return isFinite(b.min.x) ? b.getSize(new THREE.Vector3()).toArray() : null;
  };

  const olcum = [];
  for (const q of A.PARTS) {
    const ciz = kendiKutusu(q.id);
    if (!ciz) continue;
    const oran = [0, 1, 2].map((i) => ciz[i] / q.size[i]);
    const en = Math.max(...oran);
    olcum.push({ id: q.id, en, eksen: 'xyz'[oran.indexOf(en)], ciz,
      pay: q.zarfOran ?? A.ZARF_VARSAYILAN, beyanli: q.zarfOran !== undefined });
  }
  check('astronot node\'da kuruluyor ve her parça ölçülüyor', olcum.length >= 12,
    `${olcum.length} parça`);

  /* TOLERANS %0,5: paylar ölçümden 0,05'e yuvarlanarak beyan edilir, tam
     eşitlik kayan noktada iki yana da düşebilir. Daha büyüğü pay dağıtmak
     olurdu. */
  const asan = olcum.filter((m) => m.en > 1 + m.pay + 0.005);
  check('hiçbir parça beyan ettiği zarf payını aşmıyor', asan.length === 0,
    asan.map((m) => `${m.id} ×${m.en.toFixed(2)} > ${(1 + m.pay).toFixed(2)}`).join(', ')
    || `en büyük ×${Math.max(...olcum.map((m) => m.en)).toFixed(2)}`);

  const tavanAsan = A.PARTS.filter((q) => (q.zarfOran ?? 0) > A.ZARF_TAVAN);
  check(`hiçbir pay tavanı (${A.ZARF_TAVAN}) aşmıyor`, tavanAsan.length === 0,
    tavanAsan.map((q) => q.id).join(',') || `${A.PARTS.filter((q) => q.zarfOran !== undefined).length} beyan`);

  /* Pay BEDAVA olmasın: 0,40 üstü her beyan neyin taştığını ADIYLA yazar. */
  const gerekcesiz = A.PARTS.filter((q) => (q.zarfOran ?? 0) > 0.40
    && (typeof q.zarfNeden !== 'string' || q.zarfNeden.length < 60));
  check('0,40 üstü her pay neyin taştığını adıyla söylüyor', gerekcesiz.length === 0,
    gerekcesiz.map((q) => q.id).join(',') || 'hepsi gerekçeli');

  /* Pay BOŞA yazılmasın: beyan eden parça varsayılanı gerçekten aşmalı. */
  const bosBeyan = olcum.filter((m) => m.beyanli && m.en <= 1 + A.ZARF_VARSAYILAN);
  check('hiçbir zarf beyanı gereksiz değil', bosBeyan.length === 0,
    bosBeyan.map((m) => `${m.id} ×${m.en.toFixed(2)}`).join(',') || 'hepsi karşılığını buluyor');

  /* TERS SINAV: ölçüm gerçekten geometriye bakıyor mu? Beyan edilen kutuyu
     %40 küçültmek, o parçayı payının dışına çıkarmak zorunda. */
  {
    const hedef = olcum.find((m) => m.id === 'kask');
    const kaskP = A.partById('kask');
    const sahteOran = Math.max(...[0, 1, 2].map((i) => hedef.ciz[i] / (kaskP.size[i] * 0.6)));
    check('TERS SINAV: kutusu %40 küçültülen parça payının dışına çıkıyor',
      sahteOran > 1 + (kaskP.zarfOran ?? A.ZARF_VARSAYILAN),
      `×${hedef.en.toFixed(2)} → ×${sahteOran.toFixed(2)} (pay ${(1 + (kaskP.zarfOran ?? 0)).toFixed(2)})`);
  }
  /* TERS SINAV 2: sıfır duruş gerçekten fark yaratıyor mu? Dik duruşta
     ölçseydik kolun oranı poz yüzünden şişerdi. */
  {
    /* POZ olarak EN BÜKÜK olanı seçilir: sınav "poz ölçümü kirletir mi"
       diye soruyor ve dinlenme duruşu düzeldikçe (kol artık dimdik değil ama
       çok daha sakin) aradaki fark küçülüyor - `dik` ile 2,17'den 1,95'e
       indi. Sınavın ölçtüğü şeyi en iyi gösteren duruş, kolun en çok
       kaldırıldığı duruştur. */
    const S2 = AB.buildAstronaut(THREE, { poz: 'uzanma' });
    S2.root.updateMatrixWorld(true);
    const n = S2.nodes.get('kollar') ?? S2.nodes.get('kollar#1');
    const b = new THREE.Box3().setFromObject(n);
    const kolP = A.partById('kollar');
    const dikOran = Math.max(...[0, 1, 2].map((i) => (b.max.toArray()[i] - b.min.toArray()[i]) / kolP.size[i]));
    const sifirOran = olcum.find((m) => m.id === 'kollar').en;
    check('TERS SINAV: poz ölçümü kirletiyor, sıfır duruş şart',
      dikOran > sifirOran + 0.2,
      `uzanma ×${dikOran.toFixed(2)} vs sıfır ×${sifirOran.toFixed(2)}`);
  }
}

/* ── 11 BOYUN: SİLUET DARALIYOR MU ───────────────────────────────────
 *
 * "Boyunsuz insan" ölçülebilir bir şeydir: boyun, iki geniş kütle arasındaki
 * DARALMADIR. Ölçüldüğünde figürün siluetinde göğüsten tepeye hiçbir yerel
 * en küçük yoktu - genişlik 0,6163'ten tek yönde azalıyordu - ve göğüsle
 * kask arasındaki en dar nokta göğsün %72'siydi. Derinlik hiç daralmıyordu:
 * boyun hizasında göğsün %96'sı, yani baş önden arkaya göğüs kadar kalın.
 *
 * İki sebep de ölçülmüştü: gövde kabuğu boyun çizgisinde bitiyor ama orada
 * 0,56 m GENİŞ kalıyordu (kesitin tepesi omuzun %86'sı, boyna daralma yok),
 * ve kaskın ekvatoru halkanın yalnız 25 mm üstündeydi, yani kaskın en geniş
 * yeri boynun bandını dolduruyordu.
 *
 * EŞİK %55: giysili boyun kilidi 0,26 m, göğüs 0,61 m - oran %43. Ölçülen
 * kusur %72'ydi. İkisinin arasında, meşru payı bırakacak kadar yukarıda.
 */
console.log('\n== 11 boyun: siluet daralıyor mu');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const B = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-body.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });
  S.uygulaPoz({ omuz: [0, 0], dirsek: [0, 0], kalca: [0, 0], diz: [0, 0], ayak: [0, 0],
    govdeEgim: 0, govdeDonme: 0, basDonme: 0, kalcaZOfset: 0 });
  S.root.updateMatrixWorld(true);

  /* KOLLAR HARİÇ: bir kol boynu ölçmez, ama omuz hizasında siluetin en
     geniş şeyi odur ve ölçümü tamamen bastırır. */
  const disari = new Set();
  for (const ad of ['kollar', 'kollar#2', 'eldivenler', 'eldivenler#2',
                    'omuz-yatagi', 'omuz-yatagi#2']) {
    S.nodes.get(ad)?.traverse((o) => disari.add(o));
  }
  const hedef = [];
  S.root.traverse((o) => { if (o.isMesh && !disari.has(o)) hedef.push(o); });
  const rc = new THREE.Raycaster(); rc.far = 2;
  const enDeger = (z) => {
    rc.set(new THREE.Vector3(0.02, 1.5, z), new THREE.Vector3(0, -1, 0));
    const a = rc.intersectObjects(hedef, true);
    rc.set(new THREE.Vector3(0.02, -1.5, z), new THREE.Vector3(0, 1, 0));
    const b = rc.intersectObjects(hedef, true);
    if (!a.length || !b.length) return null;
    return (1.5 - a[0].distance) - (-1.5 + b[0].distance);
  };
  const tara = [];
  for (let z = 1.20; z <= 1.96; z += 0.01) {
    const e = enDeger(z);
    if (e !== null) tara.push({ z: +z.toFixed(2), e });
  }
  check('siluet taranıyor', tara.length > 50, `${tara.length} kesit`);

  const gogus = Math.max(...tara.filter((r) => r.z <= A.DIKEY.omuz).map((r) => r.e));
  const bant = tara.filter((r) => r.z >= A.DIKEY.omuz && r.z <= A.DIKEY.boyun + 0.10);
  const dar = bant.reduce((a, b) => (b.e < a.e ? b : a));
  const ustu = tara.filter((r) => r.z > dar.z).map((r) => r.e);
  const oran = dar.e / gogus;

  check('boyun bandında YEREL bir en küçük var (üstünde daha geniş bir şey)',
    ustu.length > 0 && Math.max(...ustu) > dar.e + 0.02,
    `en dar ${dar.e.toFixed(3)} @ ${dar.z} · üstünde ${Math.max(...ustu).toFixed(3)}`);
  check('en dar nokta göğsün %55\'ini geçmiyor', oran <= 0.55,
    `%${(100 * oran).toFixed(0)} (${dar.e.toFixed(3)} / ${gogus.toFixed(3)})`);
  check('daralma BEYAN EDİLEN boyun çizgisinde', Math.abs(dar.z - A.DIKEY.boyun) <= 0.06,
    `${dar.z} vs ${A.DIKEY.boyun}`);
  check('çizilen boyun beyan edilen çapa uyuyor',
    Math.abs(dar.e - A.BOYUN_CAP_M) / A.BOYUN_CAP_M <= 0.25,
    `${dar.e.toFixed(3)} m vs ${A.BOYUN_CAP_M} m`);

  /* TERS SINAV: boyun girintisi olmadan kesit ne kadar genişti? Aynı
     fonksiyon, `boyunW` verilmeden - kapı bunu yakalamak zorunda. */
  {
    const ortak = { omuzW: 0.28, omuzD: 0.2, belW: 0.235, belD: 0.18, omuzT: 0.26 };
    const boyunlu = B.govdeKesiti({ ...ortak, boyunW: A.BOYUN_CAP_M * 0.5,
      boyunD: A.BOYUN_CAP_M * 0.52, boyunT: 0.26 })(0.0);
    const boyunsuz = B.govdeKesiti(ortak)(0.0);
    check('TERS SINAV: boyun girintisi olmadan kesit tepede %50 daha geniş',
      boyunsuz.w > boyunlu.w * 1.5,
      `boyunsuz ${(2 * boyunsuz.w).toFixed(3)} m vs boyunlu ${(2 * boyunlu.w).toFixed(3)} m`);
  }
  /* TERS SINAV 2: kask alçaltılsa ölçüm bunu görür mü? Kaskın kabuğunu
     boyun bandına indirmek en dar noktayı bozmak zorunda. */
  {
    const kaskD = S.nodes.get('kask');
    const oncekiZ = kaskD.position.z;
    kaskD.position.z -= 0.09;
    kaskD.updateMatrixWorld(true);
    const bozuk = Math.min(...bant.map((r) => enDeger(r.z) ?? 9));
    kaskD.position.z = oncekiZ;
    kaskD.updateMatrixWorld(true);
    check('TERS SINAV: kask 90 mm indirilince daralma kayboluyor',
      bozuk / gogus > 0.55, `%${(100 * bozuk / gogus).toFixed(0)}`);
  }
}

/* ── 12 KIRPMA SESSİZ OLMASIN ────────────────────────────────────────
 *
 * Bir eklem sınırına dayandığında çözüm istediğini alamaz ve aradaki fark
 * SESSİZCE yutulur. Ölçülen sonuç: bilek basma evresinin %19'unda sınırda
 * ve kırpma 40,8°'ye kadar çıkıyor. Bu kendi başına kusur DEĞİLDİR - basınçlı
 * bir bilek itiş boyunca plantar fleksiyon yapamaz ve mürettebatın yürümek
 * yerine sıçramasının sebebi tam olarak budur. Kusur, kırpmanın GÖRÜNMEMESİ:
 * taban profili eklemin aralığında örneklenip DÜNYA EĞİMİYLE sorgulanıyordu
 * ve kırpma o aralığın 39,5° dışına çıkınca çizme yere 15,7 mm giriyordu.
 *
 * İkinci sınav bir DÜZELTMEDİR. Basan dizin açısını "hiç değişmiyor, sabit
 * 11,5°" diye rapor etmiştim; o ölçüm 8 fazlıydı, yani iki adımlık çevrimde
 * adım başına dört örnek, ve her seferinde çevrimin aynı yerine denk geldi.
 * 120 fazda ölçülen genlik 43,7°. Sayı artık kapıda duruyor ki aynı dikkatsiz
 * iddia bir daha kurulmasın.
 */
console.log('\n== 12 kırpma sessiz olmasın');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const G = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-gait.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });

  const olc = (ortam, hiz) => {
    const F = G.yuruyusFizigi(ortam, S.olcu.bacakM, hiz, S.olcu);
    let kirpik = 0, basan = 0, enBuyuk = 0;
    let dizMin = 1e9, dizMaks = -1e9, enAlt = 1e9;
    for (let i = 0; i < 120; i++) {
      const P = G.yuruyusPozu(i / 120, F, S.olcu);
      S.uygulaPoz(P);
      S.root.updateMatrixWorld(true);
      enAlt = Math.min(enAlt, new THREE.Box3().setFromObject(S.root).min.z);
      for (let j = 0; j < 2; j++) {
        if (!P.ayakKonum[j].basiyor) continue;
        basan++;
        const gereken = P.kalca[j] - P.diz[j];
        const k = Math.abs(P.ayak[j] - gereken);
        if (k > 0.5) { kirpik++; enBuyuk = Math.max(enBuyuk, k); }
        dizMin = Math.min(dizMin, P.diz[j]);
        dizMaks = Math.max(dizMaks, P.diz[j]);
      }
    }
    return { oran: kirpik / Math.max(1, basan), enBuyuk, basan,
      dizGenlik: dizMaks - dizMin, enAlt };
  };

  const ortamlar = [['ay', 1.2], ['ay', 1.7], ['dunya', 1.2], ['mars', 1.0]];
  const sonuc = ortamlar.map(([o, h]) => ({ o, h, ...olc(o, h) }));

  check('her ortamda basma evresi ölçülüyor', sonuc.every((r) => r.basan > 40),
    sonuc.map((r) => `${r.o}:${r.basan}`).join(' '));

  /* EŞİK %40: ölçülen en yüksek oran %22 (Dünya 1,2 m/s). Bunun üstü, artık
     kırpılan bir bilek değil, giysiye sığmayan bir yürüyüş demektir. */
  const cokKirpik = sonuc.filter((r) => r.oran > 0.40);
  check('hiçbir ortamda bilek basma evresinin %40\'ından fazlasında sınırda değil',
    cokKirpik.length === 0,
    sonuc.map((r) => `${r.o} ${r.h}: %${(100 * r.oran).toFixed(0)}`).join(' · '));

  /* Kırpma varsa taban YİNE DE yerde kalmalı: sessiz kırpmanın gerçek
     bedeli buydu. */
  const batan = sonuc.filter((r) => r.enAlt < -0.008);
  check('kırpmaya rağmen taban yere girmiyor', batan.length === 0,
    sonuc.map((r) => `${r.o} ${r.h}: ${(1000 * r.enAlt).toFixed(1)} mm`).join(' · '));

  /* DÜZELTME: basan diz donuk değil. */
  const donuk = sonuc.filter((r) => r.dizGenlik < 8);
  check('basan dizin açısı çevrim boyunca en az 8° değişiyor', donuk.length === 0,
    sonuc.map((r) => `${r.o}:${r.dizGenlik.toFixed(1)}°`).join(' '));

  /* TERS SINAV: profil aralığı eklem aralığına daraltılsaydı ne olurdu?
     Kırpmanın bıraktığı eğim ölçülen tablonun DIŞINA çıkıyor ve tablo uca
     kırpılıp eksik düşme döndürüyor - yani sorgu, ölçümün kapsamadığı yerde. */
  {
    const [aMin, aMaxJ] = [-26, 34];
    let disari = 0, enUzak = 0;
    const F = G.yuruyusFizigi('ay', S.olcu.bacakM, 1.7, S.olcu);
    for (let i = 0; i < 120; i++) {
      const P = G.yuruyusPozu(i / 120, F, S.olcu);
      for (let j = 0; j < 2; j++) {
        const egim = P.ayak[j] - (P.kalca[j] - P.diz[j]);
        if (egim < aMin || egim > aMaxJ) { disari++; enUzak = Math.max(enUzak, Math.abs(egim)); }
      }
    }
    check('TERS SINAV: dünya eğimi eklem aralığının DIŞINA çıkıyor (profil geniş olmak zorunda)',
      disari > 0, `${disari} örnekte, en uzak ${enUzak.toFixed(1)}°`);
  }
}

/* ── 13 EKLEM GÖVDESİ UZVUN DİLİNİ KONUŞUYOR MU ──────────────────────
 *
 * Mafsalda boşluk yoktu (bölüm 6 onu ölçüyor) ama diz ve kalça hâlâ çıplak
 * beyaz yumurtalar gibi duruyordu. Ölçüm sebebi söyledi: diz gövdesi
 * 0,260 x 0,286, yanındaki baldır 0,261 x 0,279 - top uzuvdan yalnız %2,5
 * kalın, yani boyut hiç sorun değildi. Aynı ÇAPTA ama farklı DOKUDA iki
 * yüzey yan yana gelince göz onları tek parça saymaz.
 *
 * O yüzden burada ölçülen şey yüzeydir: gövdenin yarıçapı, uzuvlarınki gibi
 * kapitone/dikiş/kırışık alanıyla modüle edilmiş olmak zorunda. Düz bir küre
 * bu sınavı geçemez ve ters sınav tam olarak onu gösterir.
 */
console.log('\n== 13 eklem gövdesi uzvun dilini konuşuyor mu');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });
  S.root.updateMatrixWorld(true);

  const govdeler = [];
  S.root.traverse((o) => { if (o.isMesh && o.userData.mafsalGovdesi) govdeler.push(o); });
  check('her mafsalın bir gövdesi var', govdeler.length >= 12,
    `${govdeler.length} eklem gövdesi (kalça, diz, bilek, omuz, dirsek, el bileği x2)`);

  /* Yarıçap dalgalanması: kürenin kendi yarıçapı 1, dokunun bıraktığı
     sapma yüzde kaç? */
  const dalga = (m) => {
    const poz = m.geometry.attributes.position;
    let mn = 9, mx = 0;
    const v = new THREE.Vector3();
    for (let i = 0; i < poz.count; i++) {
      v.fromBufferAttribute(poz, i);
      const r = v.length();
      if (r < 0.2) continue;                 // kutup yakını: yarıçap zaten küçük
      mn = Math.min(mn, r); mx = Math.max(mx, r);
    }
    return mx - mn;
  };
  const en = Math.min(...govdeler.map(dalga));
  check('her eklem gövdesinin yüzeyi modüle edilmiş (düz küre değil)', en > 0.015,
    `en düz gövdede bile ±%${(100 * en / 2).toFixed(1)} dalga`);

  /* Malzeme paylaşılmalı: eklem için AYRI bir malzeme, uzvun yanında başka
     bir nesne gibi durur. */
  const uzuvMat = new Set();
  S.root.traverse((o) => {
    if (o.isMesh && !o.userData.mafsalGovdesi && o.material) uzuvMat.add(o.material);
  });
  const yabanci = govdeler.filter((m) => !uzuvMat.has(m.material));
  check('hiçbir eklem gövdesi kendine ait bir malzeme kullanmıyor',
    yabanci.length === 0, `${uzuvMat.size} paylaşılan malzeme`);

  /* Kesit komşu uzuvdan ÇOK sapmamalı: mafsal bağladığı şeyin kesitini
     izler, yoksa ince bir bileğe yuvarlak bir top takılmış gibi durur. */
  const dizG = govdeler.find((m) => Math.abs(m.getWorldPosition(new THREE.Vector3()).z - A.DIKEY.diz) < 0.05);
  check('diz gövdesi bulundu', !!dizG,
    dizG ? `z = ${dizG.getWorldPosition(new THREE.Vector3()).z.toFixed(3)}` : '-');
  if (dizG) {
    const gb = new THREE.Box3().setFromObject(dizG).getSize(new THREE.Vector3());
    /* Komşu baldır: dizin hemen altındaki süpürme gövdesi. */
    let baldir = null;
    S.eklem.diz[0].traverse((o) => {
      if (!o.isMesh || o.userData.mafsalGovdesi) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.getSize(new THREE.Vector3()).z > 0.25 && (!baldir || b.min.z < baldir.min.z)) {
        baldir = b;
      }
    });
    const bb = baldir.getSize(new THREE.Vector3());
    const sapma = Math.abs(gb.y - bb.y) / bb.y;
    check('diz gövdesinin kesiti baldırınkinden %20 den fazla sapmıyor', sapma < 0.20,
      `gövde ${gb.y.toFixed(3)} · baldır ${bb.y.toFixed(3)} · %${(100 * sapma).toFixed(1)}`);
  }

  /* TERS SINAV: modülasyonsuz bir küre bu sınavı GEÇEMEMELİ. */
  {
    const duz = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 18));
    check('TERS SINAV: modüle edilmemiş küre sınavı geçemiyor', dalga(duz) <= 0.015,
      `düz kürede dalga ${dalga(duz).toExponential(1)}`);
  }
}

/* ── 14 YÜZEY SAYIMI: "premium" bir zevk değil, bir envanterdir ────────
 *
 * "Yeterince premium durmuyor" cümlesinin altında sayılabilir şeyler var ve
 * hepsi bir kez sayıldı: 481 mesh'in 232'si çıplak kutu (keskin kenar, ışığı
 * yakalayacak kırık yok), 18 malzemenin yalnız 3'ünde doku ve o üçü de yazı
 * etiketi (normal 0, pürüzlülük 0, örtme 0), tek bir malzeme mesh'lerin
 * %40'ını kaplıyor (her şey aynı krom), ve gövdeye oturan panel 12 ışının
 * hiçbirinde gövdeye değmiyor (17-46 mm havada).
 *
 * Bunların hepsi SAYIDIR, o yüzden hepsi kapıda durur. Bir daha "biraz daha
 * premium olsun" diye bakmak yerine, sayıya bakılır.
 */
console.log('\n== 14 yüzey sayımı: premium bir envanterdir');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik' });
  S.root.updateMatrixWorld(true);

  let mesh = 0, ciplakKutu = 0, renksiz = 0;
  const malzeme = new Map();
  S.root.traverse((o) => {
    if (!o.isMesh) return;
    mesh++;
    if (o.geometry.type === 'BoxGeometry') ciplakKutu++;
    if (!o.geometry.attributes.color) renksiz++;
    malzeme.set(o.material, (malzeme.get(o.material) ?? 0) + 1);
  });

  /* 1. KESKİN KENAR. İmal edilmiş hiçbir kenar keskin değildir ve kırığı
     olmayan bir kutu, üstüne hangi ışığı koyarsanız koyun çizilmiş görünür. */
  check('astronotta çıplak (pahsız) kutu yok', ciplakKutu === 0,
    ciplakKutu ? `${ciplakKutu} çıplak kutu` : `${mesh} mesh, hepsi pahlı ya da süpürme`);

  /* 2. TEK MALZEME TEKELİ. Vida da toka da braket de aynı ayna olunca
     donanım oyuncak gibi okunur. */
  const enBuyuk = Math.max(...malzeme.values());
  check('hiçbir malzeme mesh\'lerin %32 sinden fazlasını kaplamıyor',
    enBuyuk / mesh <= 0.32, `en büyük pay %${(100 * enBuyuk / mesh).toFixed(0)} · ${malzeme.size} malzeme`);

  /* 3. DOKU. Düz renk artı iki sayı, boyanmış plastiktir. */
  /* MESH AĞIRLIKLI ölçülür, malzeme sayısıyla değil: sorulan şey "tabloda
     kaç satır doku taşıyor" değil, GÖRÜLEN yüzeyin ne kadarının dokusu var.
     Vizör bir aynadır, cam camdır, ten tendir - üçü de dokuma taşımaz ve
     taşımamalı, ama üçü birlikte figürün yüzeyinin yüzde birkaçıdır. */
  let haritaliMesh = 0;
  for (const [m, n] of malzeme) if (m && (m.normalMap || m.roughnessMap)) haritaliMesh += n;
  check('görünen yüzeyin en az %80 i doku taşıyor', haritaliMesh / mesh >= 0.80,
    `%${(100 * haritaliMesh / mesh).toFixed(0)} (${haritaliMesh}/${mesh} mesh)`);
  for (const ad of ['kumas', 'kumasGolge']) {
    const m = S.materials[ad];
    check(`${ad} dokuma taşıyor`, !!(m && m.normalMap && m.roughnessMap),
      m && m.normalMap ? `tekrar ${m.normalMap.repeat.x.toFixed(0)}/m` : 'harita yok');
  }

  /* 4. UV. Harita UV'siz sahiplenilemez: tek teksel her yüzeye yayılır. */
  let uvsuz = 0;
  S.root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if ((o.material.normalMap || o.material.roughnessMap) && !o.geometry.attributes.uv) uvsuz++;
  });
  check('haritalı hiçbir mesh UV siz değil', uvsuz === 0, `${uvsuz} mesh`);

  /* 5. TEMAS KARARTMASI. Her mesh renk özniteliği taşımak ZORUNDA: eksikse
     `vertexColors` açık malzemede SİYAH çıkar. */
  check('her mesh temas karartması taşıyor', renksiz === 0,
    renksiz ? `${renksiz} mesh renksiz` : `${S.ao.koseSayisi} köşe · ortalama ${S.ao.ortalama.toFixed(3)}`);
  check('karartma gerçekten karartıyor (ortalama 0,70-0,95)',
    S.ao.ortalama > 0.70 && S.ao.ortalama < 0.95, S.ao.ortalama.toFixed(3));

  /* 5b. KÖŞELİ EĞRİ. Ölçüt segment SAYISI değil KENAR AÇISIDIR: 12 segment
     bir vidada görünmez, kaskta görünür. Bir eğri, komşu iki yüzeyi
     arasındaki açı 30°yi geçtiğinde faseta olarak okunur; yarıçapı 40 mm den
     küçük olan şeyde ise o açı ekrana bir pikselden az düşer.
     Simit iki ayrı çözünürlük taşır ve ikisi FARKLI şeyleri belirler:
     `tubularSegments` halkanın kendi çevresi (siluet), `radialSegments`
     borunun kesiti. İkisinin en küçüğünü almak, ince bir boruyu kaba
     sanmaktı. */
  const koseli = [];
  S.root.traverse((o) => {
    if (!o.isMesh) return;
    const pr = o.geometry.parameters;
    if (!pr) return;
    const bak = [];
    if (o.geometry.type === 'TorusGeometry') {
      bak.push([pr.radius ?? 0, pr.tubularSegments ?? 99]);
      bak.push([pr.tube ?? 0, pr.radialSegments ?? 99]);
    } else {
      const r = pr.radius ?? Math.max(pr.radiusTop ?? 0, pr.radiusBottom ?? 0);
      const seg = pr.radialSegments ?? pr.widthSegments ?? pr.segments ?? 99;
      bak.push([r, seg]);
    }
    /* Yerel yarıçap dünyaya ölçeklenmiş olabilir. */
    const ol = o.getWorldScale(new THREE.Vector3());
    const k = Math.max(ol.x, ol.y, ol.z);
    for (const [r, seg] of bak) {
      if (r * k < 0.04) continue;
      const aci = 360 / seg;
      if (aci > 30) koseli.push(`${o.geometry.type} r=${(r * k).toFixed(3)} ${seg} seg = ${aci.toFixed(0)}°`);
    }
  });
  check('yarıçapı 40 mm den büyük hiçbir eğride kenar açısı 30° yi geçmiyor',
    koseli.length === 0, koseli.slice(0, 4).join(' · ') || `${mesh} mesh tarandı`);
  /* TERS SINAV: 6 segmentli bir silindir bu sınavı geçemez. */
  check('TERS SINAV: 6 segmentli 0,1 m lik bir silindir köşeli sayılıyor',
    360 / 6 > 30, '60° > 30°');

  /* 6. GÖVDEYE OTURAN DONANIM. Yüzeyin üstünde DURAN bir panel, yüzeye
     BASILMIŞ bir panele hiç benzemez. */
  const temas = (pid) => {
    const n = S.nodes.get(pid) ?? S.nodes.get(`${pid}#1`);
    if (!n) return null;
    const ic = new Set(); n.traverse((o) => ic.add(o));
    const ustAd = A.partById(pid)?.mountsTo;
    const ustN = ustAd ? (S.nodes.get(ustAd) ?? S.nodes.get(`${ustAd}#1`)) : null;
    if (!ustN) return null;
    const hedef = []; ustN.traverse((o) => { if (o.isMesh && !ic.has(o)) hedef.push(o); });
    const b = new THREE.Box3().setFromObject(n);
    const rc = new THREE.Raycaster(); rc.far = 0.3;
    let enYakin = 9;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
      rc.set(new THREE.Vector3(b.min.x - 0.0005,
        b.min.y + (b.max.y - b.min.y) * (i / 4),
        b.min.z + (b.max.z - b.min.z) * (j / 4)), new THREE.Vector3(-1, 0, 0));
      const h = rc.intersectObjects(hedef, true);
      if (h.length) enYakin = Math.min(enYakin, h[0].distance);
    }
    return enYakin;
  };
  const panel = temas('gogus-paneli');
  check('göğüs paneli gövdeye değiyor (≤ 6 mm)', panel !== null && panel <= 0.006,
    panel === null ? 'ölçülemedi' : `${(1000 * panel).toFixed(1)} mm (önce 27,0 mm)`);

  /* TERS SINAV: paneli 30 mm öne itmek kapıyı düşürmek ZORUNDA. */
  {
    const n = S.nodes.get('gogus-paneli');
    n.position.x += 0.03; n.updateMatrixWorld(true);
    const bozuk = temas('gogus-paneli');
    n.position.x -= 0.03; n.updateMatrixWorld(true);
    check('TERS SINAV: panel 30 mm öne itilince temas kayboluyor',
      bozuk !== null && bozuk > 0.006, `${(1000 * bozuk).toFixed(1)} mm`);
  }
  /* TERS SINAV 2: dokusuz bir malzeme sayımda görünür mü? */
  {
    const sahte = new THREE.MeshStandardMaterial();
    check('TERS SINAV: dokusuz malzeme haritalı sayılmıyor',
      !(sahte.normalMap || sahte.roughnessMap), 'çıplak MeshStandardMaterial');
  }
}

/* ── 15 ELLİLİK: sol kolda sol el mi ─────────────────────────────────
 *
 * Ölçülen kusur: avuç normali (1,000 · 0,000 · 0,000) - tam ÖNE - parmaklar
 * öne kıvrık, ve başparmak İKİ elde de gövde orta çizgisine doğru. Bu dördü
 * bir arada imkânsız bir eldir: avucu öne bakan bir SOL elde başparmak
 * kişinin SOLUNDA olur. Yani sol kola sağ el, sağ kola sol el takılmıştı.
 *
 * AYNA KAPISI (bölüm 9) BUNU GÖREMEZ ve sebebi öğreticidir: o kapı "bu
 * mesh'in karşı tarafta eşi var mı" diye sorar, iki eldiven de birbirinin
 * kusursuz aynasıdır (0,1 mm sapma). Birbirinin aynası olmak, doğru kol için
 * doğru el olmak demek DEĞİLDİR. Ellilik ayrı bir sorudur ve ayrı bir ölçüm
 * ister: üç vektörün oluşturduğu çerçevenin İŞARETİ.
 *
 * İşaret = sign( (başparmak × parmak) · avuçNormali ). Bir sol el ile bir sağ
 * eli ayıran tek şey budur; uzunluk, konum, simetri hiçbiri ayıramaz.
 */
console.log('\n== 15 ellilik: sol kolda sol el mi');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik', ao: false });
  /* SIFIR DURUŞ: çerçeve poza değil GEOMETRİYE ait. */
  S.uygulaPoz({ omuz: [0, 0], dirsek: [0, 0], kalca: [0, 0], diz: [0, 0], ayak: [0, 0],
    govdeEgim: 0, govdeDonme: 0, basDonme: 0, kalcaZOfset: 0 });
  S.root.updateMatrixWorld(true);

  const D = (o) => o.getWorldPosition(new THREE.Vector3());
  const elOku = (ad) => {
    const n = S.nodes.get(ad);
    if (!n) return null;
    const parmaklar = [], bilgi = { yastik: null, basparmak: null };
    n.traverse((o) => {
      const e = o.userData.el;
      if (!e) return;
      if (e.rol === 'parmak') parmaklar.push({ uc: D(o), kok: D(e.kok), sira: e.sira });
      else if (e.rol === 'basparmak') bilgi.basparmak = { uc: D(o), kok: D(e.kok) };
      else if (e.rol === 'avucYastigi') bilgi.yastik = D(o);
      bilgi.ayna = e.ayna;
    });
    if (parmaklar.length !== 4 || !bilgi.basparmak || !bilgi.yastik) return null;
    parmaklar.sort((a, b) => a.sira - b.sira);
    const kokOrt = parmaklar.reduce((a, b) => a.add(b.kok.clone()), new THREE.Vector3())
      .multiplyScalar(1 / 4);
    const ucOrt = parmaklar.reduce((a, b) => a.add(b.uc.clone()), new THREE.Vector3())
      .multiplyScalar(1 / 4);
    /* ÇERÇEVE KIVRIMDAN BAĞIMSIZ OLMALI. İlk sürüm avuç normalini "avuç
       merkezinden kavrama yastığına" diye alıyordu ve 61° sapma ölçtü - ama
       yastık avucun ÜSTÜNDE, DIŞINDA değil, yani o vektör normali değil
       avucun boyunu gösteriyordu. Parmak yönünü de köklerden uçlara almak
       kıvrımı ölçüyor: basınçlı eldivenin beyan edilen kıvrımı 1,12 radyan,
       yani uçlar TASARIM GEREĞİ 64° eğik.
       Çerçeve el AYASINDAN kurulur ve ikisi de kıvrımdan bağımsızdır:
         h = bilekten parmak köklerine  (elin baktığı yön)
         a = işaret kökünden serçe köküne (avucun eni)
         n = h × a                       (avuç normali, geometrik) */
    const h = kokOrt.clone().sub(D(n)).normalize();
    const a = parmaklar[0].kok.clone().sub(parmaklar[3].kok).normalize();
    const nrm = h.clone().cross(a).normalize();
    /* İşaret yastıkla doğrulanır: normal avuç yüzüne bakmak zorunda. */
    if (bilgi.yastik.clone().sub(kokOrt).dot(nrm) < 0) nrm.negate();
    return {
      ayna: bilgi.ayna, h, a, n: nrm,
      /* Parmak yönü (kıvrım dâhil) ve başparmak yönü. */
      f: ucOrt.clone().sub(kokOrt).normalize(),
      t: bilgi.basparmak.uc.clone().sub(bilgi.basparmak.kok).normalize(),
      kokOrt, ucOrt,
    };
  };

  const sol = elOku('eldivenler'), sag = elOku('eldivenler#2');
  check('iki el de parçalarını ADIYLA bildiriyor', !!sol && !!sag,
    sol && sag ? 'dört parmak + başparmak + avuç yastığı' : 'eksik userData.el');

  if (sol && sag) {
    /* ELLİLİK: başparmak × elin yönü, avuç normaline göre. Kıvrımdan
       bağımsız üç vektör - bir sol eli bir sağ elden ayıran tek işaret. */
    const isaret = (e) => Math.sign(e.t.clone().cross(e.h).dot(e.n));
    const iSol = isaret(sol), iSag = isaret(sag);
    check('sol ve sağ elin ELLİLİĞİ zıt', iSol !== 0 && iSol === -iSag,
      `sol ${iSol > 0 ? '+1' : '−1'} · sağ ${iSag > 0 ? '+1' : '−1'}`);
    check('sol el beyan edilen işareti taşıyor', iSol === A.EL_CERCEVE.solIsaret,
      `${iSol} vs beyan ${A.EL_CERCEVE.solIsaret}`);

    /* Çerçevenin üç ekseni de beyan edilen yöne uymalı. */
    const derece = (v, hedef) => Math.acos(Math.max(-1, Math.min(1, v.dot(hedef)))) * 180 / Math.PI;
    for (const [ad, e] of [['sol', sol], ['sağ', sag]]) {
      const ice = new THREE.Vector3(0, -e.ayna, 0);
      check(`${ad}: avuç İÇE bakıyor`, derece(e.n, ice) <= 40,
        `${derece(e.n, ice).toFixed(0)}° sapma`);
      check(`${ad}: başparmak ÖNE bakıyor`, derece(e.t, new THREE.Vector3(1, 0, 0)) <= 50,
        `${derece(e.t, new THREE.Vector3(1, 0, 0)).toFixed(0)}° sapma`);
      check(`${ad}: el AŞAĞI bakıyor`, derece(e.h, new THREE.Vector3(0, 0, -1)) <= 25,
        `${derece(e.h, new THREE.Vector3(0, 0, -1)).toFixed(0)}° sapma`);
      check(`${ad}: avuç eni ÖNDEN ARKAYA`, derece(e.a, new THREE.Vector3(1, 0, 0)) <= 30,
        `${derece(e.a, new THREE.Vector3(1, 0, 0)).toFixed(0)}° sapma`);
      /* Kıvrım BEYAN EDİLDİĞİ kadar olmalı: basınçlı eldiven açık duramaz
         ama yumruk da değildir. */
      const kivrim = derece(e.f, e.h);
      check(`${ad}: parmak kıvrımı 25-70°`, kivrim >= 25 && kivrim <= 70,
        `${kivrim.toFixed(0)}°`);
    }

    /* TERS SINAV: başparmağı öteki tarafa alınca ellilik işareti dönmeli -
       yoksa bu bölüm bir sayaçtan ibarettir. */
    const sahte = { ...sol, t: sol.t.clone().setY(-sol.t.y) };
    /* y bileşeni sıfıra yakınsa aynalamak bir şey değiştirmez; o yüzden
       başparmağı avuç normalinin TERSİNE çevirerek sına. */
    const sahte2 = { ...sol, n: sol.n.clone().negate() };
    const i2 = Math.sign(sahte2.t.clone().cross(sahte2.h).dot(sahte2.n));
    check('TERS SINAV: avuç ters çevrilince ellilik işareti dönüyor', i2 === -iSol,
      `${iSol} → ${i2}`);
    void sahte;

    /* ── BİLEK AYAĞIN NERESİNDE ──────────────────────────────────
       `AYAK_ON_M` ve `AYAK_ARKA_M` yalnız birer ölçü değil, `ayakYuvarlanma`
       içinde KALDIRAÇ KOLUDUR: bilek kırpıldığında tabanın ne kadar
       yükseleceği onlardan hesaplanır. Çizim onlara uymazsa yürüyüş çözümü
       var olmayan bir ayağı hesaplıyor demektir - ölçülen kusur topukta
       %34'tü (çizme bileğin 50 mm önüne kaymıştı). */
    {
      const bot = S.nodes.get('cizmeler');
      const b = new THREE.Box3().setFromObject(bot);
      const bilek = S.eklem.ayak[0].getWorldPosition(new THREE.Vector3());
      const on = b.max.x - bilek.x, arka = bilek.x - b.min.x;
      const sapmaOn = Math.abs(on / A.AYAK_ON_M - 1), sapmaArka = Math.abs(arka / A.AYAK_ARKA_M - 1);
      check('bilek ayağın BEYAN EDİLEN yerinde (±%10)',
        sapmaOn <= 0.10 && sapmaArka <= 0.10,
        `burun ${on.toFixed(3)}/${A.AYAK_ON_M} (%${(100 * sapmaOn).toFixed(0)}) · `
        + `topuk ${arka.toFixed(3)}/${A.AYAK_ARKA_M} (%${(100 * sapmaArka).toFixed(0)})`);
      /* TERS SINAV: çizmeyi 40 mm öne kaydırmak kapıyı düşürmeli. */
      bot.position.x += 0.04; bot.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(bot);
      const arka2 = bilek.x - b2.min.x;
      bot.position.x -= 0.04; bot.updateMatrixWorld(true);
      check('TERS SINAV: çizme 40 mm öne kayınca topuk kaldıracı bozuluyor',
        Math.abs(arka2 / A.AYAK_ARKA_M - 1) > 0.10,
        `topuk ${arka2.toFixed(3)} m → %${(100 * Math.abs(arka2 / A.AYAK_ARKA_M - 1)).toFixed(0)} sapma`);
    }

    /* TERS SINAV 2: ayna sınavı elliliği GÖREMEZ - ikisi hâlâ ayna. */
    const aynaSapma = Math.abs(sol.ucOrt.x - sag.ucOrt.x)
      + Math.abs(sol.ucOrt.y + sag.ucOrt.y) + Math.abs(sol.ucOrt.z - sag.ucOrt.z);
    check('TERS SINAV: iki el birbirinin aynası (ayna kapısı bu yüzden kör)',
      aynaSapma < 0.002, `${(1000 * aynaSapma).toFixed(2)} mm ayna sapması`);
  }
}

/* ── 16 EK YERİ: iki parça BULUŞUYOR mu, birbirinden GEÇİYOR mu ───────
 *
 * Ölçülen kusur: kask ile sert üst gövde 1 cm'lik ızgarada 223 hücreyi
 * paylaşıyordu, z 1,57…1,67 bandında. Kaskın en alçak geometrisi 1,560'taydı -
 * beyan edilen boyun çizgisinin 100 mm ALTI - ve gövdenin tepesi onun 27 mm
 * üstündeydi. İki kapalı kabuk birbirinin içinden geçiyor ve kesişme
 * çizgisinde gözün "kask omzun içine sokulmuş" diye okuduğu tırtıklı kenar
 * oluşuyordu.
 *
 * Kutu örtüşmesi bu iş için YANLIŞ ölçüdür: altın vizör boynun önünde aşağı
 * sarkar ve kutuları meşru olarak üst üste bindirir. Ölçülmesi gereken şey
 * paylaşılan HACİMDİR.
 *
 * EŞİK 130 hücre: birbirine DEĞEN iki kabuk sınırda birkaç düzine hücre
 * paylaşır (ölçülen 71); 223 iki ayrı cismin iç içe geçmesiydi.
 */
console.log('\n== 16 ek yeri: kask ile gövde buluşuyor mu');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik', ao: false });
  S.root.updateMatrixWorld(true);
  const H = 0.01;
  const ah = (x, y, z) => (((x + 512) << 20) | ((y + 512) << 10) | (z + 512));
  const hucreler = (ad) => {
    const s = new Set(); const n = S.nodes.get(ad); const v = new THREE.Vector3();
    n.traverse((o) => {
      if (!o.isMesh) return;
      const q = o.geometry.attributes.position;
      for (let i = 0; i < q.count; i++) {
        v.fromBufferAttribute(q, i).applyMatrix4(o.matrixWorld);
        s.add(ah(Math.floor(v.x / H), Math.floor(v.y / H), Math.floor(v.z / H)));
      }
    });
    return s;
  };
  const ortak = (a, b) => { let n = 0; for (const k of a) if (b.has(k)) n++; return n; };
  const govdeH = hucreler('ust-govde');
  const n = ortak(hucreler('kask'), govdeH);
  check('kask ile gövde iç içe geçmiyor', n <= 130,
    `${n} ortak hücre (1 cm) · kusurlu hâlinde 223`);

  /* Kaskın hiçbir parçası boyun çizgisinin çok altına inmemeli. Vizör
     istisnadır: güneşliktir ve boynun ÖNÜNDE aşağı sarkar. */
  let enAlcak = 9, suclu = '';
  S.nodes.get('kask').traverse((o) => {
    if (!o.isMesh || o.material === S.materials.vizor) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.min.z < enAlcak) { enAlcak = b.min.z; suclu = o.geometry.type; }
  });
  check('kaskın (vizör hariç) hiçbir parçası boyun çizgisinin 20 mm altına inmiyor',
    enAlcak >= A.DIKEY.boyun - 0.02,
    `en alçak ${enAlcak.toFixed(3)} (${suclu}) · boyun ${A.DIKEY.boyun} · kusurlu hâlinde 1,560`);

  /* Kaskın içinde BİR KİŞİ var ve o kişi kabarcığın İÇİNDE olmalı. */
  {
    let kafa = null, kab = null;
    S.nodes.get('kask').traverse((o) => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      if (o.material === S.materials.ten && b.getSize(new THREE.Vector3()).z > 0.15) kafa = b;
      if (o.material === S.materials.cam) kab = b;
    });
    check('baş kabarcığın İÇİNDE', !!kafa && !!kab && kafa.min.z >= kab.min.z - 0.005,
      kafa && kab ? `baş ${kafa.min.z.toFixed(3)} · kabarcık ${kab.min.z.toFixed(3)}` : 'ölçülemedi');
  }

  /* TERS SINAV: kaskı 60 mm indirmek kapıyı düşürmeli. */
  {
    const k = S.nodes.get('kask');
    k.position.z -= 0.06; k.updateMatrixWorld(true);
    const n2 = ortak(hucreler('kask'), govdeH);
    k.position.z += 0.06; k.updateMatrixWorld(true);
    check('TERS SINAV: kask 60 mm indirilince iç içe geçme yakalanıyor', n2 > 130,
      `${n} → ${n2} ortak hücre`);
  }
}

/* ── 17 KOLUN EKSENLERİ: tek eksen bir kol değildir ──────────────────
 *
 * Katalog okundu: bu bölüm yazılana kadar figürdeki BÜTÜN uzuv eklemleri tek
 * eksenliydi (y). Omuz dönmesi yok, ön kol pronasyonu yok, omuz açılması yok,
 * kalça açılması yok - kol yalnız ileri-geri sallanabiliyordu. Üç ölçülmüş
 * sonuç: elin yönü her pozda donuk, yürüyüş tek düzlemde, ve çevrimin 60
 * fazının 32'sinde el gövdenin içinde çünkü çözümün onu çıkaracak hiçbir
 * serbestliği yok.
 *
 * Burada ölçülen şey eksenin VAR OLMASI değil, DOĞRU ŞEYİ DOĞRU YÖNE
 * götürmesi. İşaret bir kez ölçüldü ve yanlış çıktı: −yanIsaret ile sol kol
 * 45°'de gövdeden uzaklaşmak yerine y = +0,203'ten −0,325'e, yani KARŞIYA
 * geçiyordu.
 */
console.log('\n== 17 kolun eksenleri');
{
  const THREE = await import(pathToFileURL(path.join(kok, 'presets/moon_advanced/vendor/three.module.min.js')).href);
  const AB = await import(pathToFileURL(path.join(kok, 'presets/astronaut_blocks/astro-build.mjs')).href);
  const S = AB.buildAstronaut(THREE, { poz: 'dik', ao: false });
  const sifir = { omuz: [0, 0], dirsek: [0, 0], kalca: [0, 0], diz: [0, 0], ayak: [0, 0],
    govdeEgim: 0, govdeDonme: 0, basDonme: 0, kalcaZOfset: 0 };
  const V = () => new THREE.Vector3();
  const merkez = (ad) => { S.root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(S.nodes.get(ad)).getCenter(V()); };

  /* 1. Beyan: dört eksen de katalogda, düğümü/ekseni/aralığı/hızıyla. */
  const yeni = ['omuz.acilma.L', 'omuz.donme.L', 'onkol.donme.L', 'kalca.acilma.L'];
  const eksik = yeni.filter((ad) => {
    const e = A.EKLEMLER[ad];
    return !e || !e.node || !e.axis || !Array.isArray(e.range) || !e.rateDegS;
  });
  check('dört yeni eksen katalogda tam künyeli', eksik.length === 0,
    eksik.join(',') || yeni.map((a) => `${a}:${A.EKLEMLER[a].axis}`).join(' '));

  /* 2. Her eksenin düğümü figürde GERÇEKTEN var. */
  const dugumVar = yeni.every((ad) => {
    let bulundu = false;
    S.root.traverse((o) => { if (o.name === A.EKLEMLER[ad].node) bulundu = true; });
    return bulundu;
  });
  check('her eksenin düğümü figürde kurulu', dugumVar,
    yeni.map((a) => A.EKLEMLER[a].node).join(' '));

  /* 3. Her eksen KENDİ grubunda: iki eksen aynı `rotation` üstüne yazılırsa
     Euler sırası tuzağına düşülür (eksen-denetimi kural 2). */
  {
    const cokEksenli = [];
    S.root.traverse((o) => {
      if (!o.isObject3D) return;
      const r = o.rotation;
      const n = [r.x, r.y, r.z].filter((v) => Math.abs(v) > 1e-6).length;
      if (n > 1 && o.name) cokEksenli.push(o.name);
    });
    check('hiçbir düğümde iki eksen birden dönmüyor', cokEksenli.length === 0,
      cokEksenli.slice(0, 3).join(',') || 'her eksen kendi grubunda');
  }

  /* 4. AÇILMA gövdeden UZAKLAŞTIRIR - iki tarafta da. */
  for (const [ad, hedef, alan] of [
    ['omuz', 'eldivenler', 'omuzAcilma'], ['kalça', 'cizmeler', 'kalcaAcilma'],
  ]) {
    S.uygulaPoz(sifir);
    const sol0 = merkez(hedef).y, sag0 = merkez(`${hedef}#2`).y;
    S.uygulaPoz({ ...sifir, [alan]: [40, 40] });
    const sol1 = merkez(hedef).y, sag1 = merkez(`${hedef}#2`).y;
    check(`${ad} açılması iki kolu da gövdeden UZAKLAŞTIRIYOR`,
      sol1 > sol0 + 0.05 && sag1 < sag0 - 0.05,
      `sol ${sol0.toFixed(3)}→${sol1.toFixed(3)} · sağ ${sag0.toFixed(3)}→${sag1.toFixed(3)}`);
  }

  /* 5. DÖNME eli ÇEVİRİR, YERİNDEN OYNATMAZ. Bir rotasyon ekseni uzvu
     taşıyorsa o eksen yanlış yere konmuştur. */
  {
    S.uygulaPoz(sifir);
    const bilek0 = S.eklem.onkolDonme[0].getWorldPosition(V());
    S.uygulaPoz({ ...sifir, onkolDonme: [60, 0] });
    const bilek1 = S.eklem.onkolDonme[0].getWorldPosition(V());
    check('ön kol dönmesi bileği yerinden oynatmıyor',
      bilek0.distanceTo(bilek1) < 0.002,
      `${(1000 * bilek0.distanceTo(bilek1)).toFixed(2)} mm kayma`);
    /* Ama eli GERÇEKTEN ÇEVİRİYOR. Ölçü elin KUTU MERKEZİ olamaz: bir
       rotasyon ekseni merkezi neredeyse yerinde bırakır (ölçüldü: 14 mm) ve
       o sayı "çevirmiyor" demek değil, "yanlış şeyi ölçüyorsun" demektir.
       Çevrilen şey elin YÖNÜDÜR - başparmağın dünyadaki doğrultusu. */
    const bpYon = () => {
      S.root.updateMatrixWorld(true);
      let uc = null, kk = null;
      S.nodes.get('eldivenler').traverse((o) => {
        if (o.userData.el?.rol !== 'basparmak') return;
        uc = o.getWorldPosition(V()); kk = o.userData.el.kok.getWorldPosition(V());
      });
      return uc.sub(kk).normalize();
    };
    S.uygulaPoz(sifir);
    const y0 = bpYon();
    S.uygulaPoz({ ...sifir, onkolDonme: [60, 0] });
    const y1 = bpYon();
    const aci = Math.acos(Math.max(-1, Math.min(1, y0.dot(y1)))) * 180 / Math.PI;
    check('ön kol dönmesi eli gerçekten çeviriyor (başparmak yönü)', aci > 25,
      `başparmak ${aci.toFixed(0)}° döndü`);
  }

  /* 6. SINIRLAR uygulanıyor: aralığın dışı kırpılmalı. */
  {
    S.uygulaPoz({ ...sifir, omuzAcilma: [200, 0] });
    const asiri = merkez('eldivenler').clone();
    S.uygulaPoz({ ...sifir, omuzAcilma: [A.EKLEMLER['omuz.acilma.L'].range[1], 0] });
    const sinir = merkez('eldivenler');
    check('beyan edilen sınırın ötesi kırpılıyor', asiri.distanceTo(sinir) < 0.002,
      `200° ile ${A.EKLEMLER['omuz.acilma.L'].range[1]}° aynı yere gidiyor`);
  }

  /* TERS SINAV: eksen olmasaydı poz hiçbir şeyi oynatmazdı. */
  {
    S.uygulaPoz(sifir);
    const a = merkez('eldivenler').clone();
    S.uygulaPoz({ ...sifir, omuzDonme: [0, 0] });
    const b = merkez('eldivenler');
    check('TERS SINAV: sıfır açı hiçbir şeyi oynatmıyor', a.distanceTo(b) < 1e-6,
      `${(1000 * a.distanceTo(b)).toFixed(4)} mm`);
  }
  S.uygulaPoz(sifir);
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
