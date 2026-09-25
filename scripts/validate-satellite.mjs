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

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
