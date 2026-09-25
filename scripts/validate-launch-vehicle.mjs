#!/usr/bin/env node
/* validate-launch-vehicle.mjs — the rocket has to close, not just look right.
 *
 * A launch vehicle catalogue makes quantitative claims - thrust, specific
 * impulse, propellant load, tank size - and those claims constrain each
 * other. This recomputes every one of them from the declared inputs and
 * fails when two of them disagree, because a drawing cannot tell you that
 * a tank is too small for the propellant a row says is inside it.
 *
 * Nothing here reads a number the catalogue also states as a conclusion:
 * burn time comes from mass flow, mass flow comes from thrust and Isp,
 * tank volume comes from the geometry that is actually drawn.
 *
 *   node scripts/validate-launch-vehicle.mjs
 */
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

/* The grammar reaches core/geometry-axis.mjs, which imports the bare
   specifier `three`. The page resolves that with an importmap; Node needs
   telling. Registered BEFORE the grammar is imported. */
register('./_three-resolver.mjs', import.meta.url, {
  data: { threeUrl: pathToFileURL(path.join(root, 'presets/moon_advanced/vendor/three.module.min.js')).href },
});

const LV = await load('presets/launch_vehicle/lv-parts.mjs');
const { knowsKind } = await load('presets/core/hardware-shapes.mjs');

let pass = 0, fail = 0;
const section = (t) => console.log(`\n== ${t}`);
function check(ad, kosul, detay = '') {
  if (kosul) { pass++; console.log(`  ok  ${ad}${detay ? '  (' + detay + ')' : ''}`); }
  else { fail++; console.log(`  HATA ${ad}${detay ? '  (' + detay + ')' : ''}`); }
}
const yuvarla = (x, n = 1) => Number(x.toFixed(n));

const P = LV.PARTS;
const G0 = LV.G0;

/* ── 1) catalogue integrity ──────────────────────────────────────────── */
section('1 katalog bütünlüğü');
check('her satırda kimlik, ad, sistem, adım, konum ve gabari var',
  P.every(p => p.id && p.ad && p.sistem && p.step && p.pos?.length === 3 && p.size?.length === 3),
  `${P.length} satır`);
check('kimlikler benzersiz', new Set(P.map(p => p.id)).size === P.length);
check('her satırın gerekçesi var', P.every(p => typeof p.why === 'string' && p.why.length > 40));
check('her alt sistem tanımlı', P.every(p => LV.SUBSYSTEMS[p.sistem]));
check('her arayüz tanımlı', P.every(p => LV.INTERFACES[p.arayuz]));

/* ── 2) it is a catalogue, not a builder ─────────────────────────────── */
section('2 dilbilgisi: nesneye özel kod yok');
const yabanci = P.filter(p => !knowsKind(p.sekil));
check('her şekil dilbilgisinde tanımlı bir kind', yabanci.length === 0,
  yabanci.map(p => `${p.id}:${p.sekil}`).join(', ') || [...new Set(P.map(p => p.sekil))].sort().join(', '));
const bildirimsiz = P.filter(p => !p.detay);
check('her satır kendi detayını beyan ediyor', bildirimsiz.length === 0,
  bildirimsiz.map(p => p.id).join(', ') || 'hepsi');
/* The claim this whole exercise is about: no per-object builder exists. */
let yapiciVar = false;
try { await load('presets/launch_vehicle/lv-build.mjs'); yapiciVar = true; } catch { /* beklenen */ }
check('nesneye özel bir yapıcı YOK (lv-build.mjs olmamalı)', !yapiciVar);

/* ── 3) assembly tree ────────────────────────────────────────────────── */
section('3 montaj ağacı');
const idler = new Set(P.map(p => p.id));
check('her bağlantı var olan bir parçaya', P.every(p => p.mountsTo === null || idler.has(p.mountsTo)),
  P.filter(p => p.mountsTo && !idler.has(p.mountsTo)).map(p => p.id).join(', ') || 'kapalı');
check('tek kök var', P.filter(p => p.mountsTo === null).length === 1);
check('döngü yok', P.every(p => LV.depth(p.id) < 12), `en derin ${Math.max(...P.map(p => LV.depth(p.id)))}`);
check('ebeveyn çocuktan önce gelir (adım sırası)',
  P.every(p => !p.mountsTo || LV.partById(p.mountsTo).step <= p.step),
  P.filter(p => p.mountsTo && LV.partById(p.mountsTo).step > p.step).map(p => p.id).join(', ') || 'tutuyor');
check('her adımın en az bir parçası var',
  LV.STEPS.every(s => P.some(p => p.step === s.no)), `${LV.STEPS.length} adım`);

/* ── 4) mass budget ──────────────────────────────────────────────────── */
section('4 kütle bütçesi');
const b = LV.massBudget();
const elle = P.filter(p => !LV.ITICI_IDS.includes(p.id))
  .reduce((a, p) => a + (p.qty ?? 1) * p.massKg, 0);
check('kuru kütle parçaların toplamı', Math.abs(b.kuruKg - elle) < 0.05, `${b.kuruKg} kg`);
const elleItici = P.filter(p => LV.ITICI_IDS.includes(p.id))
  .reduce((a, p) => a + (p.qty ?? 1) * p.massKg, 0);
check('itici kütlesi itici satırlarının toplamı', Math.abs(b.iticiKg - elleItici) < 0.05, `${b.iticiKg} kg`);
/* Every propellant row must sit inside a tank, or the volume check below
   is comparing a tank against nothing. */
check('her itici satırı bir tankın içinde',
  LV.ITICI_IDS.every(id => LV.partById(id)?.mountsTo?.endsWith('-tank')),
  LV.ITICI_IDS.join(', '));
check('fırlatma = kuru + itici', Math.abs(b.firlatmaKg - (b.kuruKg + b.iticiKg)) < 0.05,
  `${b.firlatmaKg} kg`);
check('itici kuru kütleye dahil DEĞİL', b.iticiKg > 0 && b.kuruKg < b.firlatmaKg);
/* A launcher is mostly propellant; anything outside this band is a
   different kind of vehicle and the rest of the numbers will not mean
   what they say. */
const iticiPay = b.iticiKg / b.firlatmaKg;
check('itici payı %88–94 (bir fırlatıcı için)', iticiPay > 0.88 && iticiPay < 0.94,
  `%${(100 * iticiPay).toFixed(1)}`);
const yukPay = b.yukKg / b.firlatmaKg;
check('faydalı yük payı %2–4 (LEO için gerçekçi)', yukPay > 0.02 && yukPay < 0.04,
  `%${(100 * yukPay).toFixed(2)}`);
check('her kademenin kuru ve itici kütlesi pozitif',
  b.kademe.every(k => k.kuruKg > 0 && k.iticiKg > 0),
  b.kademe.map(k => `${k.ad} ${k.kuruKg}/${k.iticiKg} kg`).join(' · '));

/* ── 5) the rocket equation ──────────────────────────────────────────── */
section('5 roket denklemi');
const d = LV.deltaV();
/* Recomputed here from the declared masses rather than read back, so the
   module and the gate cannot agree by sharing a bug. */
const k1 = b.kademe[0], k2 = b.kademe[1];
const m0a = b.firlatmaKg, mfa = m0a - k1.iticiKg;
const dvA = LV.STAGES[0].IspOrt * G0 * Math.log(m0a / mfa);
const m0b = mfa - k1.kuruKg - b.baslikKg, mfb = m0b - k2.iticiKg;
const dvB = LV.STAGES[1].IspOrt * G0 * Math.log(m0b / mfb);
check('1. kademe Δv bağımsız hesapla aynı', Math.abs(d.kademeler[0].dv - dvA) < 1,
  `${d.kademeler[0].dv} m/s`);
check('2. kademe Δv bağımsız hesapla aynı', Math.abs(d.kademeler[1].dv - dvB) < 1,
  `${d.kademeler[1].dv} m/s`);
check('her kademenin kütle oranı > 1', d.kademeler.every(x => x.kutleOrani > 1),
  d.kademeler.map(x => x.kutleOrani.toFixed(2)).join(' · '));
/* LEO needs ~7800 m/s of orbital speed plus ~1500 m/s of gravity and drag
   losses. Below ~9300 the vehicle does not reach orbit; far above ~11000
   the design is carrying propellant it cannot use. */
check('toplam ideal Δv 9300–11000 m/s (LEO + kayıplar)',
  d.toplamDv > 9300 && d.toplamDv < 11000, `${d.toplamDv} m/s`);
check('ikinci kademe Δv\'nin çoğunu veriyor',
  d.kademeler[1].dv > d.kademeler[0].dv,
  `${d.kademeler[0].dv} vs ${d.kademeler[1].dv} m/s`);

/* ── 6) thrust, flow and burn time ───────────────────────────────────── */
section('6 itki, debi ve yanma süresi');
const t = LV.itkiButcesi();
check('kalkış itkisi motor sayısı × birim itki',
  t.kalkisItkiN === LV.STAGES[0].itkiN * LV.STAGES[0].motorAdet, `${(t.kalkisItkiN / 1000).toFixed(0)} kN`);
check('kalkış ağırlığı GLOW × g0', Math.abs(t.kalkisAgirlikN - b.firlatmaKg * G0) < 1,
  `${(b.firlatmaKg * G0 / 1000).toFixed(0)} kN`);
/* Below ~1.15 the vehicle barely leaves the pad and burns propellant
   fighting gravity; above ~1.5 it hits max q too hard. */
check('kalkış itki/ağırlık 1,15–1,50', t.itkiAgirlik > 1.15 && t.itkiAgirlik < 1.50,
  `${t.itkiAgirlik}`);
for (const s of LV.STAGES) {
  const k = t.kademeler.find(x => x.no === s.no);
  const Isp = s.IspSL ?? s.IspVac;
  const debi = (s.itkiN / (Isp * G0)) * s.motorAdet;
  check(`${s.ad}: debi = F / (Isp·g0) × motor`, Math.abs(k.debiKgS - debi) < 0.15,
    `${k.debiKgS} kg/s`);
  const kutle = b.kademe.find(x => x.no === s.no).iticiKg;
  check(`${s.ad}: yanma süresi = itici / debi`, Math.abs(k.yanmaS - kutle / debi) < 1,
    `${k.yanmaS} s`);
}
check('1. kademe yanması 130–180 s', t.kademeler[0].yanmaS > 130 && t.kademeler[0].yanmaS < 180);
check('2. kademe yanması 300–430 s', t.kademeler[1].yanmaS > 300 && t.kademeler[1].yanmaS < 430);
check('vakum Isp deniz seviyesinden büyük',
  LV.STAGES[0].IspVac > LV.STAGES[0].IspSL && LV.STAGES[1].IspVac > LV.STAGES[0].IspVac,
  `${LV.STAGES[0].IspSL} / ${LV.STAGES[0].IspVac} / ${LV.STAGES[1].IspVac} s`);

/* ── 7) tanks hold what the rows say they hold ───────────────────────── */
section('7 tank hacimleri');
for (const h of LV.tankHacimleri()) {
  /* Volume recomputed here from size and domeRatio - the same geometry the
     grammar draws - so the drawing and the propellant load cannot drift
     apart silently. */
  const p = LV.partById(h.id);
  const r = p.size[0] / 2, dr = p.detay.domeRatio;
  const govde = p.size[2] - 2 * r * dr;
  const hacim = Math.PI * r * r * govde + (4 / 3) * Math.PI * r * r * (r * dr);
  check(`${h.id}: hacim çizilen geometriden`, Math.abs(h.hacimM3 - hacim) < 0.15,
    `${h.hacimM3} m3`);
  /* 2-6% ullage: a tank filled to the brim cannot be loaded, and one with
     10% spare is carrying structure it does not need. */
  check(`${h.id}: ullage payı %2–6`, h.pay > 0.02 && h.pay < 0.06,
    `%${(100 * h.pay).toFixed(1)} · ${h.gerekenM3} m3 içinde ${h.hacimM3} m3`);
}
for (const k of LV.karisimOrani()) {
  check(`${k.ad}: O/F oranı beyan edilen ${LV.OF_ORANI}`, Math.abs(k.oran - LV.OF_ORANI) < 0.02,
    `${k.oran}`);
}

/* ── 8) the stack is physically contiguous ───────────────────────────── */
section('8 yığın geometrisi');
const YIGIN = ['itki-yapisi', 's1-rp1-tank', 'ara-tank', 's1-lox-tank',
  'ara-kademe', 's2-rp1-tank', 's2-lox-tank', 'yuk-adaptoru'];
const ust = (id) => { const p = LV.partById(id); return p.pos[2] + p.size[2] / 2; };
const alt = (id) => { const p = LV.partById(id); return p.pos[2] - p.size[2] / 2; };
let bitisik = true; const bosluklar = [];
for (let i = 0; i < YIGIN.length - 1; i++) {
  const g = alt(YIGIN[i + 1]) - ust(YIGIN[i]);
  bosluklar.push(`${YIGIN[i + 1]} ${yuvarla(g, 3)}`);
  if (Math.abs(g) > 0.02) bitisik = false;
}
/* A gap or an overlap anywhere in this chain means a row's length or its
   position was edited without the other, and nothing else would notice. */
check('eksenel yığın bitişik (boşluk/bindirme ≤ 20 mm)', bitisik, bosluklar.join(' · '));
check('başlık gövdesi 2. kademe LOX tankının üstünde başlıyor',
  Math.abs(alt('baslik-govde') - ust('s2-lox-tank')) < 0.02);
check('başlık burnu gövdenin üstünde başlıyor',
  Math.abs(alt('baslik-burun') - ust('baslik-govde')) < 0.02);
check('faydalı yük başlığın içinde',
  alt('faydali-yuk') > alt('baslik-govde') && ust('faydali-yuk') < ust('baslik-burun'),
  `${yuvarla(alt('faydali-yuk'), 2)}–${yuvarla(ust('faydali-yuk'), 2)} m`);

/* Nothing that is meant to be inside the core may stick out of it. */
const CAP = 3.7, icKalanlar = ['s1-motor', 's2-motor', 'helyum-copv', 's2-copv', 's2-itki-konisi'];
const tasan = icKalanlar.filter(id => {
  const p = LV.partById(id);
  const rHalka = p.dizilim?.r ?? Math.max(Math.abs(p.pos[0]), Math.abs(p.pos[1]));
  return rHalka + p.size[0] / 2 > CAP / 2 + 1e-6;
});
check('gövde içinde kalması gereken parçalar çapı aşmıyor', tasan.length === 0,
  tasan.map(id => id).join(', ') || `${icKalanlar.length} parça, çap ${CAP} m`);

const boyut = LV.boy();
check('toplam boy 60–80 m', boyut.boyM > 60 && boyut.boyM < 80, `${boyut.boyM} m`);
check('motor çıkış düzlemi kardan düzleminin altında', boyut.altM < 0, `${boyut.altM} m`);

/* ── 9) part numbers and specs ───────────────────────────────────────── */
section('9 teknik künye');
check('her parçanın künyesi var', P.every(p => p.tech?.no && p.tech?.malzeme && p.tech?.baglanti));
const numaralar = P.map(p => p.tech.no);
check('künye numaraları benzersiz', new Set(numaralar).size === numaralar.length);
check('künye numaraları biçimli (LV-XXX-000)', numaralar.every(n => /^LV-[A-Z]{3}-\d{3}$/.test(n)),
  numaralar.filter(n => !/^LV-[A-Z]{3}-\d{3}$/.test(n)).join(', ') || 'hepsi');

/* ── 10) determinism and the reverse exam ────────────────────────────── */
section('10 determinizm ve ters sınav');
check('describe() aynı sonucu veriyor',
  JSON.stringify(LV.describe()) === JSON.stringify(LV.describe()),
  `${LV.describe().parca} tür · ${LV.describe().adet} adet`);
/* If the checks above pass for any catalogue at all, they are decoration.
   Adding 20 t of dry mass to the upper stage must put delta-v under the
   threshold - and it does, which is what makes the threshold mean
   something. */
const agirMf = m0b - k2.iticiKg + 20000;
const agirDv = dvA + LV.STAGES[1].IspOrt * G0 * Math.log(m0b / agirMf);
check('TERS SINAV: 2. kademeye 20 t kuru kütle eklenince Δv eşiğin altına iner',
  agirDv < 9300, `${Math.round(agirDv)} m/s`);
/* And a tank that is 5% shorter must fail the ullage check. */
const kisa = LV.partById('s1-lox-tank');
const rk = kisa.size[0] / 2, drk = kisa.detay.domeRatio;
const kisaGovde = kisa.size[2] * 0.95 - 2 * rk * drk;
const kisaHacim = Math.PI * rk * rk * kisaGovde + (4 / 3) * Math.PI * rk * rk * (rk * drk);
check('TERS SINAV: tank %5 kısalınca itici sığmıyor',
  kisaHacim < LV.partById('s1-lox').massKg / LV.RHO_LOX,
  `${yuvarla(kisaHacim)} < ${yuvarla(LV.partById('s1-lox').massKg / LV.RHO_LOX)} m3`);

console.log(`\n${'-'.repeat(62)}`);
const o = LV.describe();
console.log(`  ${o.parca} tür · ${o.adet} adet · ${o.adim} adım · ${o.boyM} m x ${o.capM} m`);
console.log(`  ${(o.firlatmaKg / 1000).toFixed(1)} t kalkış = ${(o.kuruKg / 1000).toFixed(1)} t kuru `
  + `+ ${(o.iticiKg / 1000).toFixed(1)} t itici · ${(o.yukKg / 1000).toFixed(1)} t LEO`);
console.log(`  Δv ${o.toplamDv} m/s · T/W ${o.itkiAgirlik}`);
console.log('='.repeat(62));
console.log(fail === 0 ? `${pass}/${pass} geçti` : `${pass} geçti, ${fail} HATA`);
process.exit(fail ? 1 : 0);
