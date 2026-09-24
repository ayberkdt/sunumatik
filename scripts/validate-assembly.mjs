#!/usr/bin/env node
/* validate-assembly.mjs — MONTAJ ÇEKİRDEĞİ denetimleri (three'siz).
   docs/exploded-view-plan.md §10.

   Kullanım: node scripts/validate-assembly.mjs    Çıkış: HATA varsa 1 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const mod = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const A = await mod('presets/core/assembly.mjs');
const KAT = await mod('presets/exploded_view/adapters/catalog.mjs');
const SAT = await mod('presets/satellite_integration/sat-parts.mjs');

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
  /* İç içe parça: tank gövdenin TAM merkezinde → birincil eksene düşmeli. */
  check('iç içe parça birincil eksene düşüyor',
    m.direction('ic-tank').kaynak === 'eksen' && Math.abs(m.direction('ic-tank').dir[2] - 1) < 1e-9);
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

  /* Aynı yönde giden parçalar üst üste binmemeli. */
  const of = m.explode(1);
  let cakisma = 0;
  for (let i = 0; i < m.parts.length; i++) for (let j = i + 1; j < m.parts.length; j++) {
    const a = m.parts[i], b = m.parts[j];
    if (a.wet || b.wet) continue;                       // yakıt tankın içinde kalır
    const pa = A.add(a.pos, of.get(a.id)), pb = A.add(b.pos, of.get(b.id));
    const gerek = (Math.max(...a.size) + Math.max(...b.size)) / 2 * 0.85;
    if (uzunluk(A.sub(pa, pb)) < gerek) cakisma++;
  }
  check('tam patlatmada gabari çakışması yok', cakisma === 0, `${cakisma} çift`);

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

console.log(`\n${total - fails}/${total} geçti`);
process.exit(fails ? 1 : 0);
