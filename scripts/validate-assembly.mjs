#!/usr/bin/env node
/* validate-assembly.mjs — MONTAJ ÇEKİRDEĞİ denetimleri (three'siz).
   docs/exploded-view-plan.md §10.

   Kullanım: node scripts/validate-assembly.mjs    Çıkış: HATA varsa 1 */

/* fileURLToPath, not `new URL(...).pathname`: the pathname is
   percent-encoded, so a folder with a space in its name came back as
   `Custom%20Yetenekler` and pathToFileURL then encoded the percent
   again. Every import missed, and only in the checkout that has a
   space in its path - which is the one people actually work in. */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const A = await mod('presets/core/assembly.mjs');
const KAT = await mod('presets/exploded_view/adapters/catalog.mjs');
const SAT = await mod('presets/satellite_integration/sat-parts.mjs');
const HAB = await mod('presets/habitat_blocks/hab-parts.mjs');
const LV = await mod('presets/launch_vehicle/lv-parts.mjs');
const XV = await mod('presets/core/exploded-view.mjs');

let fails = 0, total = 0;
const check = (name, ok, detail = '') => { total++; console.log(`  ${ok ? 'ok ' : 'HATA'} ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) fails++; };
const uzunluk = (a) => Math.hypot(a[0], a[1], a[2]);

/* Sentetik bir montaj: kurallar bilinen küçük bir örnekte sınanır. */
const ORNEK = {
  units: 'm', axis: [0, 0, 1],
  steps: [{ no: 1, ad: 'Taban', aciklama: 'Taban ve gövde.' }, { no: 2, ad: 'Ekler', aciklama: 'Kutular ve kapak.' }],
  parts: [
    { id: 'taban', ad: 'Taban', parent: null, iface: 'ayirma', step: 1, group: 'yapi', massKg: 10, pos: [0, 0, 0], size: [1, 1, 0.1], why: 'Her şeyin bağlandığı referans yüzey burasıdır.' },
    { id: 'govde', ad: 'Gövde', parent: 'taban', iface: 'civata', step: 1, group: 'yapi', massKg: 20, pos: [0, 0, 0.5], size: [0.8, 0.8, 1], why: 'Yükü tabana indiren ana yapı elemanıdır.' },
    { id: 'kutu-a', ad: 'Kutu A', parent: 'govde', iface: 'civata', step: 2, group: 'elektronik', massKg: 5, pos: [0.5, 0, 0.5], size: [0.2, 0.2, 0.2], why: 'Gövdenin +X yüzünde, erişimi kolay olsun diye.' },
    { id: 'kutu-b', ad: 'Kutu B', parent: 'govde', iface: 'civata', step: 2, group: 'elektronik', massKg: 5, pos: [-0.5, 0, 0.5], size: [0.2, 0.2, 0.2], why: 'Simetri için karşı yüzde; kütle merkezi eksende kalsın.' },
    { id: 'ic-tank', ad: 'İç tank', parent: 'govde', iface: 'akiskan', step: 1, group: 'itki', massKg: 8, pos: [0, 0, 0.5], size: [0.5, 0.5, 0.7], why: 'Gövdenin İÇİNDE; paneller kapanmadan girmek zorundadır.' },
    { id: 'yakit', ad: 'Yakıt', parent: 'ic-tank', iface: 'akiskan', step: 1, group: 'itki', massKg: 40, wet: true, pos: [0, 0, 0.5], size: [0.45, 0.45, 0.6], why: 'Islak kütle; kuru bütçeye dahil değildir.' },
    { id: 'kapak', ad: 'Kapak', parent: 'govde', iface: 'mentese', step: 2, group: 'yapi', massKg: 3, pos: [0, 0, 1.05], size: [0.8, 0.8, 0.06], why: 'En son kapanır; altındaki her şeye erişim o anda biter.' },
  ],
};

/* ── 1) sözleşme ─────────────────────────────────────────────────────── */
console.log('== 1 sözleşme ve kurulum');
{
  const m = A.createAssembly(ORNEK);
  check('montaj kuruldu', m.parts.length === 7, `${m.parts.length} parça`);
  check('kök tek ve doğru', m.root.id === 'taban');
  check('derinlik hesaplanıyor', m.depth('yakit') === 3, `yakit derinlik ${m.depth('yakit')}`);
  check('zincir köke varıyor', m.chain('kutu-a').map(p => p.id).join('→') === 'kutu-a→govde→taban');
  check('alt ağaç doğru', new Set(m.subtree('ic-tank').map(p => p.id)).size === 2);

  const hatalar = [];
  const dene = (beyan, ad) => { try { A.createAssembly(beyan); hatalar.push(ad); } catch { /* beklenen */ } };
  dene({ ...ORNEK, parts: ORNEK.parts.map(p => p.id === 'govde' ? { ...p, parent: 'yok-boyle' } : p) }, 'bulunmayan ebeveyn');
  dene({ ...ORNEK, parts: [...ORNEK.parts, { ...ORNEK.parts[0], id: 'ikinci-kok' }] }, 'ikinci kök');
  dene({ ...ORNEK, parts: ORNEK.parts.map(p => p.id === 'taban' ? { ...p, parent: 'kapak' } : p) }, 'döngü');
  dene({ ...ORNEK, parts: [] }, 'boş liste');
  check('bozuk beyanlar REDDEDİLİYOR', hatalar.length === 0, hatalar.join(',') || '4 senaryo');

  const eksikNeden = m.parts.filter(p => !p.why || p.why.length < 30);
  check('her parçanın NEDENİ yazılı', eksikNeden.length === 0, eksikNeden.map(p => p.id).join(','));
  const kotuIface = m.parts.filter(p => p.parent != null && !A.IFACE_CLASSES[p.iface]);
  check('arayüz sınıfları bilinen kümede', kotuIface.length === 0, kotuIface.map(p => p.id).join(','));
}

/* ── 2) ayrılma doğrultusu ───────────────────────────────────────────── */
console.log('== 2 ayrılma doğrultusu montajın tersi');
{
  const m = A.createAssembly(ORNEK);
  const hepsiBirim = m.parts.every(p => Math.abs(uzunluk(m.direction(p.id).dir) - 1) < 1e-9);
  check('her yön birim vektör', hepsiBirim);
  check('kutu-a +X\'e ayrılıyor (ebeveyne göre konumdan)',
    m.direction('kutu-a').dir[0] > 0.99 && m.direction('kutu-a').kaynak === 'konum');
  check('kutu-b −X\'e ayrılıyor', m.direction('kutu-b').dir[0] < -0.99);
  /* Nested part: the tank sits at the body's exact centre. It used to fall
     back to the primary axis, which put every nested part in one collision
     bucket and the packing pass then laid them end to end - the satellite
     opened to 9.45x its own size. It now leaves PERPENDICULAR to the axis,
     which is also the only way a tank actually comes out of a tube. */
  const icYon = m.direction('ic-tank');
  /* Sideways AND up. Purely perpendicular was the first attempt and the
     habitat gate rejected it at once: a radial exit sweeps through
     whatever sits beside the parent in the same plane. Lifting it clear
     while pulling it out is how the part would really be removed. */
  const yanalPay = Math.hypot(icYon.dir[0], icYon.dir[1]);
  check('iç içe parça yana VE eksen boyunca ayrılıyor',
    icYon.kaynak === 'ic' && yanalPay > 0.5 && icYon.dir[2] > 0.3
      && Math.abs(uzunluk(icYon.dir) - 1) < 1e-9,
    `[${icYon.dir.map(v => v.toFixed(2)).join(', ')}] · yanal ${yanalPay.toFixed(2)}`);
  /* And it has to come all the way out: concentric start, so a gap is not
     enough - it needs clearance. */
  const icOf = m.explode(1).get('ic-tank');
  check('iç içe parça ebeveyninden tamamen çıkıyor', uzunluk(icOf) >= (0.8 + 0.5) / 2,
    `${uzunluk(icOf).toFixed(2)} m`);
  /* Beyan edilen yön her şeyin önünde gelir. */
  const m2 = A.createAssembly({ ...ORNEK, parts: ORNEK.parts.map(p => p.id === 'kutu-a' ? { ...p, dir: [0, 1, 0] } : p) });
  check('beyan edilen yön öncelikli', m2.direction('kutu-a').kaynak === 'beyan' && m2.direction('kutu-a').dir[1] > 0.99);
  /* Arayüz noktası (ports) konumdan önce gelir. */
  const m3 = A.createAssembly({ ...ORNEK, parts: ORNEK.parts.map(p => p.id === 'kutu-b'
    ? { ...p, ports: [{ ad: 'montaj', tur: 'montaj', pos: [0, 0, 0], dir: [0, 0, -1] }] } : p) });
  check('arayüz normali konumdan önce gelir',
    m3.direction('kutu-b').kaynak === 'arayüz' && m3.direction('kutu-b').dir[2] > 0.99);
}

/* ── 3) patlatma ─────────────────────────────────────────────────────── */
console.log('== 3 patlatma: monoton, çakışmasız, kipli');
{
  const m = A.createAssembly(ORNEK);
  const s0 = m.explode(0);
  check('k = 0\'da her parça yerinde', [...s0.values()].every(v => uzunluk(v) < 1e-12));

  /* Parçalar arası en küçük mesafe k ile MONOTON artmalı. */
  const mesafe = (k) => {
    const of = m.explode(k);
    let en = Infinity;
    for (let i = 0; i < m.parts.length; i++) for (let j = i + 1; j < m.parts.length; j++) {
      const a = m.parts[i], b = m.parts[j];
      const pa = A.add(a.pos, of.get(a.id)), pb = A.add(b.pos, of.get(b.id));
      en = Math.min(en, uzunluk(A.sub(pa, pb)));
    }
    return en;
  };
  let monoton = true, onceki = mesafe(0);
  for (let k = 0.1; k <= 1.0001; k += 0.1) {
    const d = mesafe(k);
    if (d < onceki - 1e-9) { monoton = false; break; }
    onceki = d;
  }
  check('en küçük parça arası mesafe k ile monoton artıyor', monoton,
    `k=0: ${mesafe(0).toFixed(3)} → k=1: ${mesafe(1).toFixed(3)}`);

  /* Nothing may overlap at full explode. Tested as an axis-aligned BOX
     intersection, not as spheres on each part's largest dimension: a
     0.06 m lid sitting on a 1 m body has a largest dimension of 0.8 m
     sideways, so the sphere test demanded 0.77 m of centre separation
     between two parts that were never closer than 0.02 m along the only
     axis that matters. The sphere test passed before only because every
     part used to be flung much further than it needed to be. */
  const of = m.explode(1);
  const binisiyor = (a, b) => {
    const pa = A.add(a.pos, of.get(a.id)), pb = A.add(b.pos, of.get(b.id));
    for (let i = 0; i < 3; i++) {
      if (Math.abs(pa[i] - pb[i]) >= (a.size[i] + b.size[i]) / 2) return false;
    }
    return true;
  };
  const ciftler = [];
  for (let i = 0; i < m.parts.length; i++) for (let j = i + 1; j < m.parts.length; j++) {
    const a = m.parts[i], b = m.parts[j];
    if (a.wet || b.wet) continue;                       // yakıt tankın içinde kalır
    if (binisiyor(a, b)) ciftler.push(`${a.id}/${b.id}`);
  }
  check('tam patlatmada kutu çakışması yok', ciftler.length === 0,
    ciftler.join(', ') || `${m.parts.length} parça`);

  /* And every joint has to OPEN: two parts bolted face to face must end up
     further apart than they started, or the explosion showed nothing about
     the interface between them. */
  const of0 = m.explode(0);
  let acilmayan = 0;
  for (const p of m.parts) {
    if (p.parent == null) continue;
    const ust = m.byId(p.parent);
    const d0 = uzunluk(A.sub(A.add(p.pos, of0.get(p.id)), A.add(ust.pos, of0.get(ust.id))));
    const d1 = uzunluk(A.sub(A.add(p.pos, of.get(p.id)), A.add(ust.pos, of.get(ust.id))));
    if (d1 <= d0 + 1e-6) acilmayan++;
  }
  check('her parça ebeveyninden UZAKLAŞIYOR', acilmayan === 0, `${acilmayan} parça yerinde`);

  check('kova yuvarlaması çalışıyor',
    A.directionBucket([0.99, 0.02, 0]) === '1,0,0' && A.directionBucket([0.1, 0.1, 0.9]) === '0,0,1'
    && A.directionBucket([0.01, 0, 0]) === '1,0,0');

  for (const kip of A.MODES) {
    const o = m.explode(0.6, { mode: kip });
    const hepsiSonlu = [...o.values()].every(v => v.every(Number.isFinite));
    check(`kip '${kip}' sonlu değerler üretiyor`, hepsiSonlu);
  }
  const rad = m.explode(1, { mode: 'radial' });
  check('radial kip merkezden dışa itiyor', uzunluk(rad.get('kutu-a')) > 0);
  const ax = m.explode(1, { mode: 'axial' });
  check('axial kip adım sırasına göre eksende diziyor',
    Math.abs(ax.get('kapak')[2]) > Math.abs(ax.get('taban')[2]));
}

/* ── 4) sıra ─────────────────────────────────────────────────────────── */
console.log('== 4 montaj sırası');
{
  const m = A.createAssembly(ORNEK);
  const erken = m.parts.filter(p => {
    const ust = p.parent != null ? m.byId(p.parent) : null;
    return ust && (p.step ?? 1) < (ust.step ?? 1);
  });
  check('hiçbir parça ebeveyninden önce takılmıyor', erken.length === 0, erken.map(p => p.id).join(','));
  const sira = m.integrationOrder();
  check('adımlar sıralı ve parçaları kapsıyor',
    sira.length === 2 && sira.reduce((a, s) => a + s.parcalar.length, 0) === m.parts.length,
    sira.map(s => `${s.no}:${s.parcalar.length}`).join(' '));
  check('adım kütleleri toplanıyor',
    Math.abs(sira.reduce((a, s) => a + s.kg, 0) - (m.budget().kuruKg + m.budget().islakKg)) < 0.05);
}

/* ── 5) bütçe ────────────────────────────────────────────────────────── */
console.log('== 5 bütçe, kütle merkezi, arayüz sayımı');
{
  const m = A.createAssembly(ORNEK);
  const b = m.budget();
  check('kuru kütle ıslak kütleyi dışlıyor', b.kuruKg === 51 && b.islakKg === 40, `${b.kuruKg} + ${b.islakKg}`);
  check('toplam = kuru + ıslak', Math.abs(b.toplamKg - (b.kuruKg + b.islakKg)) < 1e-9);
  check('grup payları toplamı %100', Math.abs(b.gruplar.reduce((a, g) => a + g.pay, 0) - 1) < 1e-9);
  const c = m.centerOfMass();
  check('kütle merkezi eksende (simetrik kutular)', c.yanalMm < 1e-6, `${c.yanalMm} mm`);
  check('kuru merkez ıslaktan farklı', Math.abs(m.centerOfMass({ wet: false }).z - c.z) > 1e-9);
  const say = m.interfaceCensus();
  check('arayüz sayımı kökü saymıyor', say.reduce((a, s) => a + s.adet, 0) === m.parts.length - 1,
    say.map(s => `${s.iface}:${s.adet}`).join(' '));
  check('tahmini damgası yok (kütleler beyan edilmiş)', b.tahmini === false);
}

/* ── 6) determinizm ──────────────────────────────────────────────────── */
console.log('== 6 determinizm');
{
  const a = A.createAssembly(ORNEK), b = A.createAssembly(ORNEK);
  const im = (m) => [...m.explode(0.73).entries()].map(([k, v]) => `${k}:${v.map(x => x.toFixed(9))}`).join('|');
  check('aynı beyan → aynı patlatma', im(a) === im(b));
  check('describe() kararlı', JSON.stringify(a.describe()) === JSON.stringify(b.describe()));
}

/* ── 7) gerçek katalog: uydu ─────────────────────────────────────────── */
console.log('== 7 uydu kataloğu sözleşmeye çevriliyor');
{
  const m = KAT.assemblyFromCatalog(SAT);
  check('33 parça çevrildi', m.parts.length === SAT.PARTS.length, `${m.parts.length}`);
  const b = m.budget();
  check('kuru kütle katalogla aynı', Math.abs(b.kuruKg - SAT.massBudget().kuruKg) < 0.05,
    `${b.kuruKg} vs ${SAT.massBudget().kuruKg}`);
  check('ıslak kütle (itici) ayrıldı', Math.abs(b.islakKg - SAT.massBudget().iticiKg) < 0.05, `${b.islakKg} kg`);
  const c = m.centerOfMass();
  check('kütle merkezi sapması katalogla aynı',
    Math.abs(c.yanalMm - SAT.describe().eksendenSapmaMm) < 0.2, `${c.yanalMm} mm`);
  const erken = m.parts.filter(p => { const u = p.parent != null ? m.byId(p.parent) : null; return u && p.step < u.step; });
  check('montaj sırası çekirdek kuralını geçiyor', erken.length === 0);
  const say = m.interfaceCensus();
  check('arayüz sayımı üretiliyor', say.length >= 5, say.map(s => `${s.iface}:${s.adet}`).join(' '));
  const of = m.explode(1);
  check('tam patlatmada her parça hareket etti',
    m.parts.filter(p => p.parent != null).every(p => uzunluk(of.get(p.id)) > 1e-6));
}

/* ── 8) genel yüzey sözleşmesi ───────────────────────────────────────
   Bu bölüm, vitrin `byId.get(id)` yazıp sessizce boş künye ürettikten
   sonra yazıldı: byId bir Map değil, işlevdir. Yüzeyin ŞEKLİ de bir
   sözleşmedir ve sınanmazsa çağıran taraf yanlış kullanır. */
console.log('== 8 genel yüzey sözleşmesi');
{
  const m = A.createAssembly(ORNEK);
  check('byId bir işlev (Map değil)', typeof m.byId === 'function');
  check('byId var olan kimliği getiriyor', m.byId(ORNEK.parts[1].id)?.id === ORNEK.parts[1].id);
  check('byId bilinmeyen kimlikte null veriyor', m.byId('olmayan-parca') === null);
  check('chain parça NESNELERİ veriyor (kimlik dizisi değil)',
    Array.isArray(m.chain(ORNEK.parts[1].id)) && m.chain(ORNEK.parts[1].id).every(x => typeof x === 'object'));
  check('explode Map veriyor', typeof m.explode === 'function' && m.explode(0.5) instanceof Map);
  check('interfaceCensus DİZİ veriyor', Array.isArray(m.interfaceCensus()));
  /* Her arayüz anahtarı sözlükte ÇÖZÜLMELİ. Çözülmezse sayım ham anahtarı
     basar ve kimse fark etmez: uydu kataloğu 'menteşe' yazıyordu, sözlükte
     'mentese' vardı ve arayüzde Türkçe ham anahtar görünüyordu. */
  const cozulmeyen = m.interfaceCensus().filter(x => x.ad === x.iface);
  check('her arayüz sınıfı sözlükte çözülüyor', cozulmeyen.length === 0,
    cozulmeyen.map(x => x.iface).join(',') || `${m.interfaceCensus().length} sınıf`);
  check('budget sayısal toplam veriyor', typeof m.budget().toplamKg === 'number');
  check('integrationOrder dizi veriyor', Array.isArray(m.integrationOrder()));
}

/* ── N) the explosion stays readable ─────────────────────────────────── */
console.log('== N patlatma okunur kalıyor');
{
  /* The travel used to be TABAN + depth*KADEME with nothing bounding it.
     A three-deep spacecraft bus never showed the problem; an eight-deep
     launch vehicle sent its payload 75 m off a 74 m vehicle and the
     explosion became a needle. These two numbers are what the cap is for,
     and they are measured on the real catalogues, not on the fixture. */
  const CISIMLER = [
    { ad: 'uydu', mod: SAT }, { ad: 'habitat', mod: HAB }, { ad: 'firlatici', mod: LV },
  ];
  for (const c of CISIMLER) {
    const m = KAT.assemblyFromCatalog(c.mod, { axis: [0, 0, 1] });
    const off = m.explode(1);
    let enUzak = 0, enUzakId = '';
    for (const [id, o] of off) {
      const d = uzunluk(o);
      if (d > enUzak) { enUzak = d; enUzakId = id; }
    }
    check(`${c.ad}: hiçbir parça gabarinin %50'sinden uzağa gitmiyor`,
      enUzak <= m.gabari * 0.5 + 1e-6,
      `${enUzakId} ${enUzak.toFixed(1)} m / gabari ${m.gabari.toFixed(1)} m`);

    /* The exploded envelope against the assembled one, along each axis.
       This is the number a reader actually feels: at 2.0x the object is
       half the size on screen. */
    const kutu = (uygula) => {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const p of m.parts) {
        if (!p.pos || !p.size) continue;
        const o = uygula ? (off.get(p.id) || [0, 0, 0]) : [0, 0, 0];
        for (let i = 0; i < 3; i++) {
          mn[i] = Math.min(mn[i], p.pos[i] + o[i] - p.size[i] / 2);
          mx[i] = Math.max(mx[i], p.pos[i] + o[i] + p.size[i] / 2);
        }
      }
      return mn.map((v, i) => mx[i] - v);
    };
    const kapali = kutu(false), acik = kutu(true);
    /* The DIAGONAL, not the worst axis. A per-axis ratio is the wrong
       criterion for a thin dimension: the satellite is 2.4 m through its
       radiators, so opening it by a perfectly sensible 2.4 m reads as
       "2.05x" while nothing about the view got harder to see. What a
       reader actually feels is the diagonal, because that is what sets
       how far the camera has to pull back. */
    const kose = (v) => Math.hypot(v[0], v[1], v[2]);
    const oran = kose(acik) / Math.max(kose(kapali), 1e-6);
    check(`${c.ad}: açık zarfın köşegeni kapalının 1,8 katını aşmıyor`, oran <= 1.8,
      `${oran.toFixed(2)}x · ${acik.map(v => v.toFixed(0)).join('x')} m`);
    /* And no single axis may blow up in ABSOLUTE terms either, or a thin
       axis could hide a large travel behind a healthy diagonal. */
    const enCokBuyume = Math.max(...acik.map((v, i) => v - kapali[i]));
    check(`${c.ad}: hiçbir eksen gabarinin %60'ından fazla büyümüyor`,
      enCokBuyume <= m.gabari * 0.6,
      `+${enCokBuyume.toFixed(1)} m / gabari ${m.gabari.toFixed(1)} m`);

    /* Separation must still be real: every part has to end up outside the
       envelope it started in, or the cap bought readability by not
       exploding at all. */
    const duran = m.parts.filter(p => p.parent !== null && uzunluk(off.get(p.id) || [0, 0, 0]) < 1e-6);
    check(`${c.ad}: kök dışında her parça hareket ediyor`, duran.length === 0,
      duran.map(p => p.id).join(', ') || `${m.parts.length - 1} parça`);
  }
}

/* ── M) alt-montaj odağı ─────────────────────────────────────────────── */
console.log('== M alt-montaj odağı');
{
  /* The rule is pure, so it is tested without a renderer - which is the
     whole reason it is a function instead of living inside the view's
     closure. */
  const m = KAT.assemblyFromCatalog(SAT, { axis: [0, 0, 1] });
  check('odak yokken kümesi yok', XV.focusSet(m, null) === null);
  check('bilinmeyen kimlik odak olmuyor', XV.focusSet(m, 'boyle-bir-sey-yok') === null);

  /* A radiator panel with equipment on it: its subtree is the equipment,
     its chain is what it hangs from. */
  const hedef = 'radyator-yp';
  const kume = XV.focusSet(m, hedef);
  const altAgac = m.subtree(hedef).map(p => p.id);
  const zincir = m.chain(hedef).map(p => p.id);
  check('odak kendisini içeriyor', kume.has(hedef));
  check('odak bütün alt ağacını içeriyor', altAgac.every(id => kume.has(id)),
    `${altAgac.length} parça`);
  check('odak köke kadar zinciri içeriyor', zincir.every(id => kume.has(id)),
    zincir.join(' < '));
  check('odak kümesi alt ağaç ∪ zincir kadar, fazlası değil',
    kume.size === new Set([...altAgac, ...zincir]).size, `${kume.size} parça`);

  /* The point of a focus is that most of the object goes dim. If it does
     not, the focus bought nothing. */
  const sonen = m.parts.filter(p => !kume.has(p.id)).length;
  check('odakta parçaların çoğu sönüyor', sonen > m.parts.length * 0.5,
    `${sonen}/${m.parts.length} sönük`);

  /* Focusing the root lights everything: the root's subtree IS the object,
     so focusing it is the same as not focusing at all. */
  const kokKume = XV.focusSet(m, m.root.id);
  check('köke odaklanmak her şeyi yakıyor', kokKume.size === m.parts.length,
    `${kokKume.size}/${m.parts.length}`);

  /* A leaf lights only its own chain. */
  const yaprak = m.parts.find(p => m.subtree(p.id).length === 1 && p.parent !== null);
  const yaprakKume = XV.focusSet(m, yaprak.id);
  check('yaprak yalnız kendi zincirini yakıyor',
    yaprakKume.size === m.chain(yaprak.id).length,
    `${yaprak.id}: ${yaprakKume.size} parça`);

  /* Every object, not just the satellite: focusing anything must always
     leave a lit set that is closed under "parent of". A hole in the chain
     would put a lit part on a dimmed one. */
  for (const c of [{ ad: 'uydu', mod: SAT }, { ad: 'habitat', mod: HAB }, { ad: 'firlatici', mod: LV }]) {
    const a = KAT.assemblyFromCatalog(c.mod, { axis: [0, 0, 1] });
    let kirik = 0;
    for (const p of a.parts) {
      const k = XV.focusSet(a, p.id);
      for (const id of k) {
        const q = a.byId(id);
        if (q.parent != null && !k.has(q.parent) && !a.subtree(p.id).some(x => x.id === id)) kirik++;
      }
    }
    check(`${c.ad}: her odak kümesi zincir boyunca kapalı`, kirik === 0,
      `${a.parts.length} parça denendi`);
  }
}

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
