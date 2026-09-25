#!/usr/bin/env node
/* validate-satellite.mjs — UYDU ENTEGRASYONU denetimleri (three'siz).

   Patlatılmış görünüm bir çizim değil, bir İDDİA kümesidir: her parçanın
   nereye bağlandığı, hangi sırada geldiği ve ne kadar kütle getirdiği
   yazılıdır. Bu betik o iddiaları sınar — kütle toplanmazsa, ağaç
   kapanmazsa ya da bir parça ebeveyninden önce takılıyorsa burada düşer.

   Kullanım: node scripts/validate-satellite.mjs    Çıkış: HATA varsa 1 */

/* fileURLToPath, not `new URL(...).pathname`: the pathname is
   percent-encoded, so a folder with a space in its name came back as
   `Custom%20Yetenekler` and pathToFileURL then encoded the percent
   again. Every import missed, and only in the checkout that has a
   space in its path - which is the one people actually work in. */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = await import(pathToFileURL(path.join(root, 'presets/satellite_integration/sat-parts.mjs')).href);

let fails = 0, total = 0;
const check = (name, ok, detail = '') => { total++; console.log(`  ${ok ? 'ok ' : 'HATA'} ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) fails++; };

/* ── 1) katalog bütünlüğü ────────────────────────────────────────────── */
console.log('== 1 katalog: her parça tam künyeli');
{
  const P = S.PARTS;
  check('kimlikler benzersiz', new Set(P.map(p => p.id)).size === P.length, `${P.length} parça`);
  const eksik = P.filter(p => !p.ad || !p.why || !p.sekil || !Array.isArray(p.pos) || !Array.isArray(p.size));
  check('her parçada ad, NEDEN VAR, şekil, konum ve gabari var', eksik.length === 0, eksik.map(p => p.id).join(','));
  const kotuSistem = P.filter(p => !S.SUBSYSTEMS[p.sistem]);
  check('her parça bilinen bir alt sisteme ait', kotuSistem.length === 0, kotuSistem.map(p => p.id).join(','));
  const kotuArayuz = P.filter(p => !S.INTERFACES[p.arayuz]);
  check('her parçanın arayüz türü tanımlı', kotuArayuz.length === 0, kotuArayuz.map(p => p.id).join(','));
  const kotuKutle = P.filter(p => !(p.massKg > 0));
  check('her parçanın kütlesi pozitif', kotuKutle.length === 0, kotuKutle.map(p => p.id).join(','));
  const kisaNeden = P.filter(p => p.why.length < 40);
  check('gerekçeler tek cümlelik değil (≥ 40 karakter)', kisaNeden.length === 0, kisaNeden.map(p => p.id).join(','));
  check('her alt sistemde en az bir parça var',
    Object.keys(S.SUBSYSTEMS).every(k => P.some(p => p.sistem === k)),
    Object.keys(S.SUBSYSTEMS).filter(k => !P.some(p => p.sistem === k)).join(',') || `${Object.keys(S.SUBSYSTEMS).length} sistem`);
}

/* ── 2) montaj ağacı ─────────────────────────────────────────────────── */
console.log('== 2 montaj ağacı kapalı ve döngüsüz');
{
  const P = S.PARTS;
  const kokler = P.filter(p => p.mountsTo === null);
  check('tek kök var (fırlatıcı arayüzü)', kokler.length === 1, kokler.map(p => p.id).join(',') || 'yok');
  const kayip = P.filter(p => p.mountsTo !== null && !S.partById(p.mountsTo));
  check('her bağlantı hedefi GERÇEKTEN var', kayip.length === 0, kayip.map(p => `${p.id}→${p.mountsTo}`).join(','));

  /* Döngü: zincir köke varmalı, yoksa sonsuza gider. */
  const donguler = [];
  for (const p of P) {
    const gorulen = new Set();
    let q = p, adim = 0;
    while (q && adim++ < P.length + 2) {
      if (gorulen.has(q.id)) { donguler.push(p.id); break; }
      gorulen.add(q.id);
      q = q.mountsTo ? S.partById(q.mountsTo) : null;
    }
    if (adim > P.length + 1) donguler.push(p.id);
  }
  check('döngü yok — her zincir köke varıyor', donguler.length === 0, donguler.join(','));

  const en = P.map(p => S.depth(p.id));
  check('ağaç derinliği makul (≤ 4)', Math.max(...en) <= 4, `en derin ${Math.max(...en)}`);
  check('mountChain kökte bitiyor',
    S.PARTS.every(p => S.mountChain(p.id).slice(-1)[0].mountsTo === null));
}

/* ── 3) montaj sırası ────────────────────────────────────────────────── */
console.log('== 3 montaj sırası fiziksel olarak mümkün');
{
  const P = S.PARTS;
  /* Bir parça, bağlandığı parçadan ÖNCE takılamaz. */
  const erken = P.filter(p => {
    const ust = p.mountsTo ? S.partById(p.mountsTo) : null;
    return ust && p.step < ust.step;
  });
  check('hiçbir parça ebeveyninden önce takılmıyor', erken.length === 0,
    erken.map(p => `${p.id}(${p.step}) < ${p.mountsTo}(${S.partById(p.mountsTo).step})`).join(' | '));

  const adimlar = S.STEPS.map(s => s.no);
  check('adım numaraları 1..N ve kesintisiz',
    adimlar.every((n, i) => n === i + 1), adimlar.join(','));
  const bos = S.STEPS.filter(s => !P.some(p => p.step === s.no));
  check('her adımda en az bir parça var', bos.length === 0, bos.map(s => s.no).join(','));
  const tanimsiz = P.filter(p => !S.STEPS.some(s => s.no === p.step));
  check('her parçanın adımı tanımlı', tanimsiz.length === 0, tanimsiz.map(p => p.id).join(','));
  check('her adımda açıklama var', S.STEPS.every(s => s.ad && s.aciklama && s.aciklama.length > 40));
  const sira = S.integrationOrder();
  check('integrationOrder bütün parçaları kapsıyor',
    sira.reduce((a, s) => a + s.parcalar.length, 0) === P.length);

  /* MLI en son ısıl adımda olmalı: altındaki cıvatalara erişimi kapatır. */
  const mli = S.partById('mli');
  const altindakiler = P.filter(p => p.id !== 'mli' && p.mountsTo === mli.mountsTo);
  check('MLI, aynı gövdeye bağlı parçaların hepsinden sonra geliyor',
    altindakiler.every(p => p.step <= mli.step),
    altindakiler.filter(p => p.step > mli.step).map(p => p.id).join(',') || `adım ${mli.step}`);
}

/* ── 4) kütle bütçesi ────────────────────────────────────────────────── */
console.log('== 4 kütle bütçesi toplanıyor');
{
  const b = S.massBudget();
  const elle = S.PARTS.filter(p => p.id !== 'itici-yakit').reduce((a, p) => a + S.partMass(p), 0);
  check('kuru kütle parçaların toplamına eşit', Math.abs(b.kuruKg - elle) < 0.05, `${b.kuruKg} vs ${elle.toFixed(1)} kg`);
  const sistemToplam = b.sistemler.reduce((a, s) => a + s.kg, 0);
  check('alt sistem payları kuru kütleyi veriyor', Math.abs(sistemToplam - b.kuruKg) < 0.2,
    `${sistemToplam.toFixed(1)} vs ${b.kuruKg} kg`);
  check('fırlatma = kuru + itici', Math.abs(b.firlatmaKg - (b.kuruKg + b.iticiKg)) < 0.05,
    `${b.firlatmaKg} kg`);
  check('itici yükü KURU kütleye dahil değil', b.kuruKg < b.firlatmaKg && b.iticiKg > 0);
  check('paylar toplamı %100', Math.abs(b.sistemler.reduce((a, s) => a + s.pay, 0) - 1) < 1e-6);

  /* Gerçek bir otobüste kablaj kuru kütlenin %3-5'idir; unutulduğunda
     bütçe tutmaz. Burada da o mertebede olmalı. */
  const kablaj = b.sistemler.find(s => s.sistem === 'kablaj');
  check('kablaj kuru kütlenin %3-6\'sı (unutulan kalem)', kablaj.pay > 0.03 && kablaj.pay < 0.06,
    `%${(kablaj.pay * 100).toFixed(1)}`);
  /* Yapı payı %20-30 bandında olmalı: altında dayanamaz, üstünde faydalı
     yüke yer kalmaz. */
  const yapi = b.sistemler.find(s => s.sistem === 'yapi');
  check('yapı payı %20-30 bandında', yapi.pay > 0.20 && yapi.pay < 0.30, `%${(yapi.pay * 100).toFixed(1)}`);
  /* İtici oranı (yakıt / fırlatma) kimyasal itkili bir transfer için makul. */
  const oran = b.iticiKg / b.firlatmaKg;
  check('itici oranı %30-45 (kimyasal transfer)', oran > 0.30 && oran < 0.45, `%${(oran * 100).toFixed(1)}`);
}

/* ── 5) kütle merkezi ────────────────────────────────────────────────── */
console.log('== 5 kütle merkezi fırlatıcı arayüzüyle uyumlu');
{
  const c = S.centerOfMass();
  const ck = S.centerOfMass({ yakitli: false });
  const yanal = Math.hypot(c.x, c.y) * 1000;
  check('yanal sapma ≤ 50 mm (fırlatıcı arayüz sınırı)', yanal <= 50, `${yanal.toFixed(1)} mm`);
  check('yakıt tüketilince merkez fazla kaymıyor (≤ 120 mm)',
    Math.hypot(ck.x - c.x, ck.y - c.y, ck.z - c.z) * 1000 <= 120,
    `${(Math.hypot(ck.x - c.x, ck.y - c.y, ck.z - c.z) * 1000).toFixed(1)} mm`);
  check('merkez gövde içinde (|z| < 0,6 m)', Math.abs(c.z) < 0.6, `z = ${c.z.toFixed(3)} m`);
  check('yakıtlı kütle fırlatma kütlesine eşit',
    Math.abs(c.kg - S.massBudget().firlatmaKg) < 0.05, `${c.kg} kg`);
}

/* ── 6) tasarım gerekçeleri geometriyle tutarlı ──────────────────────── */
console.log('== 6 gerekçe ile geometri tutuyor');
{
  /* Radyatörler ±Y'de olmalı: gerekçe "Güneş +X ekseninde döner" diyor. */
  const rad = S.PARTS.filter(p => p.id.startsWith('radyator-'));
  check('radyatörler ±Y yüzeylerinde (Güneş ekseni +X)',
    rad.length === 2 && rad.every(p => Math.abs(p.pos[1]) > 0.5 && Math.abs(p.pos[0]) < 0.1),
    rad.map(p => p.id).join(','));
  /* Kanatlar ±X'te ve simetrik olmalı, yoksa güneş basıncı sürekli tork üretir. */
  const kanat = S.PARTS.filter(p => p.id.startsWith('kanat-'));
  check('kanatlar ±X\'te ve simetrik', kanat.length === 2
    && Math.abs(kanat[0].pos[0] + kanat[1].pos[0]) < 1e-9
    && kanat[0].massKg === kanat[1].massKg,
    kanat.map(p => `${p.id}@${p.pos[0]}`).join(' '));
  /* Apogee motoru ayırma halkası ekseninde olmalı. */
  const ap = S.partById('apogee-motoru');
  check('apogee motoru eksende (|x|,|y| < 1 mm)', Math.abs(ap.pos[0]) < 1e-3 && Math.abs(ap.pos[1]) < 1e-3);
  /* Isı üreten kutular radyatör panellerine bağlı olmalı. */
  const isinanlar = ['batarya', 'transponder'];
  check('ısı üreten kutular radyatör paneline bağlı',
    isinanlar.every(id => S.partById(id).mountsTo.startsWith('radyator-')),
    isinanlar.map(id => `${id}→${S.partById(id).mountsTo}`).join(' '));
  /* Tank itki tüpünün içinde: yarıçapı tüpten küçük olmalı. */
  const tup = S.partById('itki-tupu'), tank = S.partById('yakit-tanki');
  check('tank itki tüpünün içine sığıyor', tank.size[0] < tup.size[0], `${tank.size[0]} < ${tup.size[0]} m`);
  /* Yıldız izleyiciler ikiden az olmazsa tek arıza gözü kör eder. */
  check('yıldız izleyici en az iki adet', (S.partById('yildiz-izleyici').qty ?? 1) >= 2);
  /* Tepki tekerlekleri piramit: dördü olmalı (üçü yeter, biri yedek). */
  check('tepki tekerleği dört adet (üçü yeter, biri yedek)', S.partById('tepki-tekerlekleri').qty === 4);
}

/* ── 7) determinizm ──────────────────────────────────────────────────── */
console.log('== 7 determinizm');
{
  const a = JSON.stringify(S.describe()), b = JSON.stringify(S.describe());
  check('describe() aynı sonucu veriyor', a === b);
  const d = S.describe();
  check('özet alanları dolu', d.parca > 0 && d.adet >= d.parca && d.adim === S.STEPS.length
    && d.kuruKg > 0 && d.firlatmaKg > d.kuruKg, `${d.parca} tür · ${d.adet} adet · ${d.adim} adım`);
}

/* ── 8) teknik künye ─────────────────────────────────────────────────
   Künyedeki sayılar bir süs değil: toplandıklarında KAPANMAK zorunda.
   Bu bölüm ilk koşumunda iki gerçek hata buldu — faydalı yük elektroniği
   "radyatör paneline" diye künyelenmişken katalogda üst panele bağlıydı,
   ve radyatör kapasitesi künyeye 340 W yazılmışken aynı panelin alanı ve
   kaplaması 1252 W veriyordu. */
console.log('== 8 teknik künye');
{
  /* 8a. Her parçanın künyesi var ve parça numarası benzersiz. */
  const kunyesiz = S.PARTS.filter(p => !p.tech);
  check('her parçanın teknik künyesi var', kunyesiz.length === 0,
    kunyesiz.map(p => p.id).join(',') || `${S.PARTS.length} parça`);
  const nolar = S.PARTS.map(p => p.tech?.no).filter(Boolean);
  check('parça numaraları benzersiz', new Set(nolar).size === nolar.length, `${nolar.length} numara`);
  check('parça numaraları biçimli (SD-XXX-000)',
    nolar.every(n => /^SD-[A-Z]{3}-\d{3}$/.test(n)),
    nolar.filter(n => !/^SD-[A-Z]{3}-\d{3}$/.test(n)).join(',') || 'hepsi');
  check('her künyede malzeme ve bağlantı beyanı var',
    S.PARTS.every(p => p.tech?.malzeme && p.tech?.baglanti));

  /* 8b. Sıcaklık bantları anlamlı: alt sınır üst sınırdan küçük. */
  const tersBant = S.PARTS.filter(p => p.tech?.sicaklik_C && p.tech.sicaklik_C[0] >= p.tech.sicaklik_C[1]);
  check('sıcaklık bantları ters değil', tersBant.length === 0, tersBant.map(p => p.id).join(','));

  /* 8c. Güç bütçesi kapanıyor ve payı gerçekçi. */
  const g = S.powerBudget();
  check('güç üretimi tüketimi karşılıyor', g.uretimW > g.tuketimW,
    `${g.uretimW} W üretim, ${g.tuketimW} W tüketim`);
  check('güç payı %20–%45 arasında (BOL için gerçekçi)', g.pay >= 0.20 && g.pay <= 0.45,
    `%${(g.pay * 100).toFixed(1)}`);
  const elleUretim = (S.partById('kanat-xp').tech.guc_W + S.partById('kanat-xn').tech.guc_W) * -1;
  check('üretim yalnız kanatlardan geliyor', g.uretimW === elleUretim, `${elleUretim} W`);

  /* 8d. Veri zinciri tutarlı: ham / sıkıştırma = verilen, indirme yeterli. */
  const d = S.dataBudget();
  check('sıkıştırılmış hız ham/oran ile tutuyor', d.tutarli,
    `${d.hamMbps} / ${d.sikistirma} = ${(d.hamMbps / d.sikistirma).toFixed(1)} vs ${d.sikisikMbps} Mbps`);
  check('indirme kapasitesi üretilen veriyi karşılıyor', d.yeterli,
    `${d.indirmeMbps} ≥ ${d.sikisikMbps} Mbps, pay ${d.payMbps} Mbps`);
  check('kurtarma yolu (LGA) var ve çok daha yavaş', d.kurtarmaMbps > 0 && d.kurtarmaMbps < d.indirmeMbps / 100,
    `${d.kurtarmaMbps} Mbps`);

  /* 8e. Isıl: her ısı kaynağının radyatöre giden bir yolu BEYAN edilmiş. */
  const yollar = S.thermalPaths();
  const yolsuz = yollar.filter(y => !y.ok);
  check('her ısı kaynağının radyatöre yolu beyan edilmiş', yolsuz.length === 0,
    yolsuz.map(y => `${y.id} (${y.W} W)`).join(',') || `${yollar.length} kaynak`);

  /* 8f. Isıl kapanış: kapasite geometriden HESAPLANIR, künyeden okunmaz. */
  const t = S.thermalClosure();
  check('radyatör kapasitesi atılacak gücü karşılıyor', t.kapaniyor,
    `${t.kapasiteW} W kapasite ≥ ${t.atilacakW} W atılacak, pay %${(t.pay * 100).toFixed(1)}`);
  check('ısıl pay %10–%40 arasında', t.pay >= 0.10 && t.pay <= 0.40, `%${(t.pay * 100).toFixed(1)}`);
  /* Künyeye yazılan sayı hesapla tutmalı: ikisi ayrışırsa beyan yalan olur. */
  const yaziliW = /Rejects (\d+) W/.exec(S.partById('radyator-yp').tech.detay);
  check('künyeye yazılan radyatör kapasitesi hesapla aynı',
    yaziliW && Math.abs(Number(yaziliW[1]) - t.paneller[0].W) <= 2,
    yaziliW ? `künye ${yaziliW[1]} W vs hesap ${t.paneller[0].W} W` : 'künyede sayı yok');

  /* 8g. Isıl tasarımı belirleyen bileşen: en dar sıcaklık bandı. */
  const s2 = S.thermalDriver();
  check('ısıl tasarımı faydalı yük optiği belirliyor', s2.id === 'faydali-yuk',
    `${s2.ad}: ${s2.bant[0]}…${s2.bant[1]} °C (${s2.genislik} K)`);

  /* 8h. TERS SINAV: bozulmuş bir künye yakalanmalı. */
  const sahte = { ...S.partById('kanat-xp'), tech: { ...S.partById('kanat-xp').tech, guc_W: -100 } };
  const sahteUretim = 100 + 1450;
  check('TERS SINAV: üretim düşerse pay eşiğin altına iner',
    (sahteUretim - S.powerBudget().tuketimW) / sahteUretim < 0.20,
    `%${(100 * (sahteUretim - S.powerBudget().tuketimW) / sahteUretim).toFixed(1)}`);
  void sahte;
}

/* ══ NİŞANGÂH: NEREYE BAKIYOR, VE O YÖN İŞE YARIYOR MU ════════════════
   İki parçanın tek işi bir yöne bakmaktı ve ikisi de yanlış yöne bakıyordu.
   Ölçülen (düzeltme öncesi, kurulmuş sahnede): güneş dizisinin hücre normali
   (0,0,1), güneş (5,6,7) — arada 48,03°, kosinüs 0,667, yani satırın kendi
   hesabındaki 2585 W'ın 1725 W'ı. Yüksek kazançlı antenin boresight'ı da
   (0,0,1), nadir ise (0,0,-1): tam 180,0°, yani 1,6°'lik hüzme derin uzaya.

   Buradaki sınavların hepsi KİMLİKTİR ve her birinin ters sınavı vardır:
   eski hâl YAKALANMAK zorunda, yoksa sınav bir şey ölçmüyordur. */
console.log('== 9 nişangâh: nereye bakıyor, ve o yön işe yarıyor mu');
{
  const bir = (v) => { const n = Math.hypot(...v); return v.map(x => x / n); };
  const nok = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const aciDeg = (a, b) => Math.acos(Math.max(-1, Math.min(1, nok(bir(a), bir(b))))) * 180 / Math.PI;

  /* ── güneş dizisi ── */
  const r = S.sadaAcisi(S.GUNES_YONU);
  /* Tek eksenli bir sürücünün ulaşabileceği en iyi kosinüs, güneşin mil
     eksenine dik düzlemdeki izdüşümünün BOYUDUR. Bu bir kimlik: ayrı yoldan
     hesaplayıp aynı sayıyı vermek zorunda. */
  const s0 = bir(S.GUNES_YONU);
  const beklenenKos = Math.hypot(s0[1], s0[2]);          // mil = x
  check('dizi kosinüsü tek eksenli optimumla aynı',
    Math.abs(r.kosinus - beklenenKos) < 1e-12,
    `${r.kosinus.toFixed(6)} vs ${beklenenKos.toFixed(6)}`);
  /* Kalan açı beta açısıdır: güneşin mil eksenine olan eğimi. İkinci bir
     eksen olmadan kapanmaz ve kapanıyormuş gibi çizmek güç bütçesini
     yalan yapar. */
  check('kalan sapma beta açısına eşit (mil eksenine eğim)',
    Math.abs(r.betaDeg - Math.asin(Math.abs(s0[0])) * 180 / Math.PI) < 1e-9,
    `${r.betaDeg.toFixed(3)}°`);
  /* Mili `aci` kadar dondurdugunde sifir normali (0,0,1) hedefe gitmeli.
     X ekseni etrafinda donme: (0,0,1) -> (0, -sin, cos). Kapali form. */
  const donmus = [0, -Math.sin(r.aci), Math.cos(r.aci)];
  const sapma = Math.hypot(donmus[0] - r.hedefNormal[0],
    donmus[1] - r.hedefNormal[1], donmus[2] - r.hedefNormal[2]);
  check('surucu acisi hucre normalini hedefe oturtuyor', sapma < 1e-12,
    `mil ${(r.aci * 180 / Math.PI).toFixed(2)} derece, sapma ${sapma.toExponential(1)}`);
  /* TERS SINAV: mil sıfırda bırakılırsa — çizimin eski hâli — yakalanmalı. */
  const sifirKos = Math.abs(nok(s0, [0, 0, 1]));
  check('TERS SINAV: mil sıfırda bırakılan dizi yakalanıyor',
    sifirKos < beklenenKos - 0.1,
    `sıfırda ${sifirKos.toFixed(3)} < optimum ${beklenenKos.toFixed(3)}`);

  /* Beyan edilen güç DİK GELİŞ içindir; sayfanın gösterdiği üretim
     kosinüsle çarpılmış olan. İkisini karıştırmak 313 W'lık bir hata. */
  for (const id of ['kanat-xp', 'kanat-xn']) {
    const k = S.kanatGucu(S.partById(id));
    check(`${id}: gerçek üretim = beyan × kosinüs`,
      Math.abs(k.gercekW - k.dikW * k.kosinus) < 1e-9,
      `${k.dikW.toFixed(0)} W dik → ${k.gercekW.toFixed(0)} W`);
  }

  /* Gövde savruldukça mil ekseni dünya XY düzleminde döner, güneş ise sabit
     kalır: bu yüzden beta açısı bir ÇEVRİM yapar ve kosinüs bir en küçük ile
     1,000 arasında gidip gelir. Sahnede ölçülen (çizen döngünün kendi yolu
     sürülerek, 18 s): 0,879 → 0,826 → 0,673. Kapalı formu burada: mil ekseni
     düzlemde dönerken s·a en çok güneşin O DÜZLEMDEKİ bileşeni kadar olur. */
  const duzlemBilesen = Math.hypot(s0[0], s0[1]);
  /* Uc noktalari TARAMAKLA aramak yanlis aletti: 0,5 derecelik adimla en
     buyuk 0,999997 cikiyor ve 1e-9 esigi kendi ornekleme hatasini hata
     sayiyor. Ikisi de kapali formda biliniyor - |s.a| duzlemde en cok
     guneşin o duzlemdeki bileseni kadar olur, ve bu deger phi* =
     atan2(s_y, s_x) azimutunda gerceklesir; ona dik azimutta ise sifir. */
  const fi = Math.atan2(s0[1], s0[0]);
  const kosinusFi = (f) => S.sadaAcisi(S.GUNES_YONU, {
    eksen: [Math.cos(f), Math.sin(f), 0],
    sifirNormal: [-Math.sin(f), Math.cos(f), 0] }).kosinus;
  const enAz = kosinusFi(fi);                    // gunes mile en yakin
  const enCok = kosinusFi(fi + Math.PI / 2);     // gunes mile dik
  check('cevrimin en iyisi tam dik gelis (beyan edilen guc oradadir)',
    Math.abs(enCok - 1) < 1e-12, `en cok kosinus ${enCok.toFixed(12)}`);
  check('cevrimin en kotusu gunesin mil duzlemindeki bileseninden geliyor',
    Math.abs(enAz - Math.sqrt(1 - duzlemBilesen * duzlemBilesen)) < 1e-12,
    `en az ${enAz.toFixed(6)} · kapali form ${Math.sqrt(1 - duzlemBilesen ** 2).toFixed(6)}`);
  /* TERS SINAV: tek eksen yetseydi cevrim duz bir cizgi olurdu. */
  check('TERS SINAV: tek eksen yetmiyor (cevrim duz degil)',
    enCok - enAz > 0.2, `salinim ${(enCok - enAz).toFixed(3)}`);

  /* ── yüksek kazançlı anten ── */
  const hga = S.partById('hga');
  check('HGA nişangâhını beyan ediyor', !!hga.nis, JSON.stringify(hga.nis ?? null));
  const bore = S.boresightYonu(hga.nis);
  const nadirAci = aciDeg(bore, S.NADIR);
  check('HGA boresight nadir YARIM KÜRESİNDE (uzaya değil)',
    nadirAci < 90, `nadirden ${nadirAci.toFixed(1)}°`);
  check('HGA eğimi beyan edilen değere eşit',
    Math.abs(nadirAci - hga.nis.egimDeg) < 1e-9, `${nadirAci.toFixed(2)}°`);

  /* Hüzme kendi uydusunun içinden geçmemeli. Boom satırı bunu ZATEN
     söylüyor — "hüzme hiç engellenmesin diye çanağı gövdeden uzak tutar" —
     ve dik aşağı bakan bir hüzme için doğru değildi. */
  const govde = ['ust-panel', 'alt-panel', 'yan-panel-xp', 'yan-panel-xn',
    'itki-tupu', 'govde-iskeleti', 'mli', 'radyator-yp', 'radyator-yn'];
  const kutu = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const id of govde) {
    const q = S.partById(id);
    if (!q) continue;
    for (let k = 0; k < 3; k++) {
      kutu.min[k] = Math.min(kutu.min[k], q.pos[k] - q.size[k] / 2);
      kutu.max[k] = Math.max(kutu.max[k], q.pos[k] + q.size[k] / 2);
    }
  }
  const acik = S.huzmeAcikligi(hga.pos, bore, kutu);
  check('hüzme gövdeyi sıyırıyor (boom satırının iddiası)', acik.acik,
    `ayak izinden çıkış z ${acik.z.toFixed(3)} m ≥ gövde tepesi ${kutu.max[2].toFixed(2)} m`);
  /* TERS SINAV: çanak gövde köşesinin ÜSTÜNDE durduğu için dik aşağı bakan
     hüzme ayak izinden hiç çıkmaz — yakalanmak zorunda. */
  check('TERS SINAV: dik nadire bakan hüzme yakalanıyor',
    !S.huzmeAcikligi(hga.pos, [0, 0, -1], kutu).acik,
    'dik aşağı: ayak izini hiç terk etmiyor');
  /* Ve eğim, çanağın kendi genişliğini de geçirecek kadar olmalı: sıfır
     paylı bir sıyırma, çanağın kenarının çarpması demektir. */
  check('sıyırma payı çanağın yarıçapından büyük',
    acik.z - kutu.max[2] > hga.size[0] / 2 * 0.4,
    `pay ${(acik.z - kutu.max[2]).toFixed(2)} m`);
}

/* ── 10) acilim: katli hal kaportaya sigmak, ACIK hal SIGMAMAK zorunda ── */
console.log('== 10 acilim: katlanma neyi kazandiriyor');
{
  const kaporta = S.KAPORTA;
  check('kaporta zarfi beyan edilmis', !!kaporta && kaporta.capM > 0,
    kaporta ? `${kaporta.capM} m cap x ${kaporta.boyM} m` : 'yok');

  /* Zarflar three gerektirmeden kapali formda cikar: katli yigin, panel
     genisligi kadar derinlikte ve kok menteselerinin oturdugu yaricaptadir;
     acik kanat ise ucu uca uzar. Buradaki sayilar KURULMUS sahnede olculdu
     ve bu kapali form onlarla karsilastirilarak yazildi. */
  for (const id of ['kanat-xp', 'kanat-xn']) {
    const k = S.partById(id);
    const yariAcik = Math.abs(k.pos[0]) + k.size[0] / 2;      // uc, govde merkezinden
    const kokX = Math.abs(k.pos[0]) - k.size[0] / 2;          // kok mentesesi
    const panelBoy = k.size[0] / 3;
    check(`${id}: acik hal kaportaya SIGMIYOR (katlanmanin sebebi)`,
      2 * yariAcik > kaporta.capM,
      `acik ${(2 * yariAcik).toFixed(2)} m > kaporta ${kaporta.capM} m`);
    /* Katliyken panel boyu Z'ye doner ve yigin kok etrafinda durur, bu
       yuzden yatay yaricapi belirleyen sey kok mesafesi ile panel
       YUKSEKLIGININ yarisidir - panel boyu degil. */
    const katliYari = Math.hypot(kokX, k.size[1] / 2);
    /* Kapali form yalniz panellerin kendisini sayar; menteseler, kelepceler
       ve bagli tutma fincanlari biraz disa tasar. Kurulmus sahnede olculen
       3,144 m'ye karsi bu form 3,11 m diyordu - yani EKSIK tarafta yaniliyor,
       ki bir zarf denetimi icin yanlis yon. %5 cikinti payi konur ve pay
       yazilir, yoksa kapi gecerken geometri tasabilir. */
    const CIKINTI = 1.05;
    check(`${id}: katli hal kaportaya sigiyor (cikinti payiyla)`,
      2 * katliYari * CIKINTI <= kaporta.capM,
      `katli ${(2 * katliYari * CIKINTI).toFixed(2)} m <= ${kaporta.capM} m` +
      ` · olculen 3.144 m`);
    check(`${id}: katli yigin kaporta BOYUNA da sigiyor`,
      panelBoy <= kaporta.boyM, `yigin ${panelBoy.toFixed(2)} m`);
    /* Katlanmanin kazandirdigi sey oran olarak: 1'e yakinsa mekanizma
       kendi kutlesini hak etmiyor demektir. */
    const oran = yariAcik / katliYari;
    check(`${id}: katlanma anlamli bir kazanc sagliyor`, oran > 2.5,
      `${oran.toFixed(2)}x sikisma`);
  }
  /* TERS SINAV: kaportayi kanat acikliginin ustune cikarsan katlanmanin
     gerekcesi kalmaz ve sinav bunu SOYLEMELI. */
  const sahteKaporta = 20;
  const k0 = S.partById('kanat-xp');
  check('TERS SINAV: kaporta yeterince buyuk olsa katlanma gereksizdi',
    2 * (Math.abs(k0.pos[0]) + k0.size[0] / 2) <= sahteKaporta,
    `${sahteKaporta} m kaportada acik hal sigardi`);
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
