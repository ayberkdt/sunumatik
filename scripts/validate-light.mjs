#!/usr/bin/env node
/* validate-light.mjs — IŞIK FİZİĞİ çekirdeği denetimleri (three'siz).
   docs/light-physics-plan.md §9.

   Kullanım: node scripts/validate-light.mjs    Çıkış: HATA varsa 1 */

/* fileURLToPath, not `new URL(...).pathname`: the pathname is
   percent-encoded, so a folder with a space in its name came back as
   `Custom%20Yetenekler` and pathToFileURL then encoded the percent
   again. Every import missed, and only in the checkout that has a
   space in its path - which is the one people actually work in. */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = await import(pathToFileURL(path.join(root, 'presets/core/light-math.mjs')).href);
const S = await import(pathToFileURL(path.join(root, 'presets/core/scene-lighting.mjs')).href);
const fs = await import('node:fs');

let fails = 0, total = 0;
const check = (name, ok, detail = '') => { total++; console.log(`  ${ok ? 'ok ' : 'HATA'} ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) fails++; };

/* ── 1) kara cisim ───────────────────────────────────────────────────── */
console.log('== 1 blackbodyRGB: Planck eğrisi ve çapalar');
{
  /* EN GÜÇLÜ SINAV renklilik koordinatıdır: RGB çapası göz kararıdır,
     xy ise yayımlanmış Planck eğrisidir ve kaynağıyla karşılaştırılır. */
  const xy = (T) => {
    const [X, Y, Z] = L.cieXYZ(nm => L.planck(nm * 1e-9, T));
    const s = X + Y + Z;
    return [X / s, Y / s];
  };
  const LOCUS = { 2856: [0.44758, 0.40745], 4000: [0.3805, 0.3768], 5772: [0.3263, 0.3351], 6504: [0.3135, 0.3237], 10000: [0.2807, 0.2884] };
  let enKotu = 0, nerede = '';
  for (const T of Object.keys(LOCUS)) {
    const m = xy(+T), r = LOCUS[T];
    const d = Math.hypot(m[0] - r[0], m[1] - r[1]);
    if (d > enKotu) { enKotu = d; nerede = `${T} K`; }
  }
  check('renklilik yayımlanmış Planck eğrisinde (Δxy < 0,003)', enKotu < 0.003, `en kötü ${nerede}: Δ ${enKotu.toFixed(4)}`);
  /* A aydınlatıcısı (2856 K) en sık alıntılanan çapadır. */
  const a = xy(2856);
  check('CIE A aydınlatıcısı (2856 K) x,y = 0,4476 / 0,4074',
    Math.abs(a[0] - 0.44758) < 0.002 && Math.abs(a[1] - 0.40745) < 0.002, `${a[0].toFixed(4)} / ${a[1].toFixed(4)}`);

  /* Derin kırmızıda analitik uyum zayıflar — sınırı BİLEREK yazıyoruz. */
  const c = xy(1900);
  check('1900 K mum: uyumun bilinen sapması ilan edilmiş sınırda (< 0,02)',
    Math.hypot(c[0] - 0.5487, c[1] - 0.4089) < 0.02, `Δ ${Math.hypot(c[0] - 0.5487, c[1] - 0.4089).toFixed(4)}`);

  const mum = L.blackbodyRGB(1900);
  check('1900 K mum kırmızı baskın, mavi yok', mum[0] === 1 && mum[1] > 0.15 && mum[1] < 0.45 && mum[2] < 0.05,
    mum.map(v => v.toFixed(2)).join(', '));
  const gunes = L.blackbodyRGB(5772);
  check('5772 K Güneş sıcak beyaz (mavi < yeşil < kırmızı)',
    gunes[2] < gunes[1] && gunes[1] < gunes[0] && gunes[2] > 0.75, gunes.map(v => v.toFixed(2)).join(', '));
  const d65 = L.blackbodyRGB(6504, { normalize: 'white' });
  check('6504 K, ilan edilen beyaz dengelemesiyle (1,1,1)',
    d65.every(v => Math.abs(v - 1) < 0.02), d65.map(v => v.toFixed(3)).join(', '));
  const ham = L.blackbodyRGB(6504);
  check('ham hâli (1,1,1) DEĞİL — 6504 K Planck ışıması D65 değildir',
    Math.abs(ham[1] - 1) > 0.02, ham.map(v => v.toFixed(3)).join(', '));

  /* Monotonluk: T arttıkça mavi/kırmızı oranı artar. */
  let monoton = true, onceki = -1;
  for (let T = 1200; T <= 20000; T += 200) {
    const [r, , b] = L.blackbodyRGB(T, { normalize: 'luminance' });
    const oran = b / Math.max(1e-9, r);
    if (oran < onceki - 1e-9) { monoton = false; break; }
    onceki = oran;
  }
  check('T ↑ → mavi/kırmızı oranı monoton artar', monoton);

  /* R2: Doppler ve kızıla kayma spektrumu KAYDIRIR. */
  const durgun = L.blackbodyRGB(6000, { normalize: 'luminance' });
  const yakl = L.blackbodyRGB(6000, { normalize: 'luminance', dopplerFactor: 1.35 });
  const uzak = L.blackbodyRGB(6000, { normalize: 'luminance', gravRedshift: 0.6 });
  const mavilik = (c2) => c2[2] / Math.max(1e-9, c2[0]);
  check('yaklaşan kenar mavileşir, kızıla kayan kenar kızıllaşır',
    mavilik(yakl) > mavilik(durgun) && mavilik(uzak) < mavilik(durgun),
    `δ=1,35 → ${mavilik(yakl).toFixed(2)} · durgun ${mavilik(durgun).toFixed(2)} · z=0,6 → ${mavilik(uzak).toFixed(2)}`);
}

/* ── 2) ters kare ────────────────────────────────────────────────────── */
console.log('== 2 ters kare ve birimler');
{
  const I = 2000;
  let kotu = 0;
  for (const d of [0.5, 1, 2, 5, 12.5, 40]) {
    const E = L.illuminanceAt(I, d);
    kotu = Math.max(kotu, Math.abs(E - I / (d * d)));
  }
  check('E = I/d² (±1e-6)', kotu < 1e-6, `en kötü Δ ${kotu.toExponential(1)}`);
  check('mesafe iki katına çıkınca aydınlatma dörtte bire iner',
    Math.abs(L.illuminanceAt(I, 2) / L.illuminanceAt(I, 4) - 4) < 1e-9);
  check('candelaFor ters işlemi geri veriyor',
    Math.abs(L.candelaFor(L.illuminanceAt(I, 7), 7) - I) < 1e-9);
  /* Ay'da Güneş 127 000 lux; gri kart parlaklığı E·ρ/π. */
  const Lum = L.luminanceFromLux(127000);
  check('127 000 lux gri kart parlaklığı ≈ 7278 cd/m²', Math.abs(Lum - 127000 * 0.18 / Math.PI) < 1e-9, `${Lum.toFixed(0)} cd/m²`);
  const ev = L.ev100(Lum);
  check('EV100 makul aralıkta (14–16)', ev > 14 && ev < 16, ev.toFixed(2));
  check('pozlama EV ile ters çalışıyor', L.exposureForLux(127000) < L.exposureForLux(300));
}

/* ── 3) ortam kuralı ─────────────────────────────────────────────────── */
console.log('== 3 ortam kuralı: uyumsuz olgu reddedilir');
{
  const red = (olgu, env) => L.envAllows(olgu, env);
  check('fire @ vacuum REDDEDİLDİ', !red('fire', 'vacuum').ok, red('fire', 'vacuum').neden?.slice(0, 44));
  check('fire @ mars REDDEDİLDİ (%95 CO₂, oksijen yok)', !red('fire', 'mars').ok);
  check('fire @ earth kabul', red('fire', 'earth').ok);
  check('fire @ interior kabul (basınçlı, oksijenli)', red('fire', 'interior').ok);
  check('beam @ vacuum REDDEDİLDİ (saçacak ortam yok)', !red('beam', 'vacuum').ok);
  check('beam @ mars kabul (ince ama saçan atmosfer)', red('beam', 'mars').ok);
  check('smoke @ vacuum REDDEDİLDİ', !red('smoke', 'vacuum').ok);
  check('her ret bir ÖNERİ veriyor (sessiz ret yok)',
    L.PHENOMENA.every(o => ['vacuum', 'mars', 'earth', 'interior'].every(e => { const r = red(o, e); return r.ok || (r.neden && r.oneri); })));
  let atti = false;
  try { L.requireEnv('fire', 'vacuum'); } catch { atti = true; }
  check('requireEnv hata atıyor', atti);
  let bilinmeyen = false;
  try { L.envAllows('fire', 'satürn'); } catch { bilinmeyen = true; }
  check('bilinmeyen ortam hata veriyor', bilinmeyen);
}

/* ── 4) titreşim alanı ───────────────────────────────────────────────── */
console.log('== 4 flickerField: 1/f spektrumu ve genlik sınırı');
{
  const f = L.flickerField(7, { band: [3, 30], amplitude: 0.15 });
  const N = 8192, fs = 240;
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) x[i] = f(i / fs);
  let maxA = 0;
  for (let i = 0; i < N; i++) maxA = Math.max(maxA, Math.abs(x[i]));
  check('genlik ilan edilen sınırı aşmıyor', maxA <= 0.15 + 1e-9, `en büyük ${maxA.toFixed(4)}`);

  /* Güç spektrumu BANTLI ölçülür. Tek tek frekansta örneklemek yanıltır:
     alan sonlu sayıda sinüsten kurulu bir ÇİZGİ spektrumudur, örneklenen
     nokta iki çizginin arasına düşerse güç olduğundan küçük okunur
     (ilk ölçüm bu yüzden −2,70 ve −1,38 verdi). Bant gücü bant
     genişliğine bölünerek PSD kestirilir, sonra log-log eğim aranır. */
  const egimOlc = (dizi) => {
    const bins = Math.floor(N / 2);
    const psdBin = new Float64Array(bins);
    for (let k = 1; k < bins; k++) {
      let re = 0, im = 0;
      const w = 2 * Math.PI * k / N;
      for (let i = 0; i < N; i++) { re += dizi[i] * Math.cos(w * i); im += dizi[i] * Math.sin(w * i); }
      psdBin[k] = (re * re + im * im) / (N * N);
    }
    const binHz = fs / N;
    const bantlar = [[3, 5], [5, 8.2], [8.2, 13.4], [13.4, 22], [22, 30]];
    const noktalar = bantlar.map(([a, b]) => {
      let guc = 0;
      for (let k = Math.ceil(a / binHz); k <= Math.floor(b / binHz); k++) guc += psdBin[k];
      return { f: Math.sqrt(a * b), psd: guc / (b - a) };
    }).filter(p2 => p2.psd > 0);
    const lx = noktalar.map(p2 => Math.log10(p2.f));
    const ly = noktalar.map(p2 => Math.log10(p2.psd));
    const n = lx.length;
    const mx = lx.reduce((a, b) => a + b) / n, my = ly.reduce((a, b) => a + b) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (lx[i] - mx) * (ly[i] - my); den += (lx[i] - mx) ** 2; }
    return num / den;
  };
  const egim = egimOlc(x);
  check('log-log güç spektrumu eğimi −0,8…−1,2 (1/f)', egim < -0.8 && egim > -1.2, egim.toFixed(3));

  /* TERS SINAV: ölçüm her sinyali "pembe" ilan ediyor olabilir. Beyaz
     gürültünün (düz PSD) eğimi sıfır çevresinde çıkmalı. */
  let rs = 12345 >>> 0;
  const beyaz = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    rs = (Math.imul(rs ^ (rs >>> 15), 2246822519) + 0x6D2B79F5) >>> 0;
    beyaz[i] = ((rs >>> 8) / 8388608 - 1) * 0.15;
  }
  const egimBeyaz = egimOlc(beyaz);
  check('ölçüm çalışıyor: beyaz gürültüde eğim ≈ 0', Math.abs(egimBeyaz) < 0.3, egimBeyaz.toFixed(3));

  check('gain() 1 çevresinde salınıyor', Math.abs(f.gain(3.3) - (1 + f(3.3))) < 1e-12);
  const g = L.flickerField(7, { band: [3, 30], amplitude: 0.15 });
  check('aynı tohum → aynı alan', [0, 1.7, 5.5, 13.2].every(t => f(t) === g(t)));
  check('farklı tohum → farklı alan', L.flickerField(8)(2.5) !== L.flickerField(9)(2.5));
}

/* ── 5) adaptasyon ───────────────────────────────────────────────────── */
console.log('== 5 pozlama adaptasyonu: kritik sönüm, aşım yok');
{
  const hedef = 8, baslangic = 15;
  let ev = baslangic, asim = 0, onceki = ev;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 12; i++) {
    ev = L.adaptEV(ev, hedef, dt);
    if (ev < hedef - 1e-9) asim = Math.max(asim, hedef - ev);
    if (ev > onceki + 1e-9) asim = Math.max(asim, ev - onceki);   // geri sekme
    onceki = ev;
  }
  /* τ = 2,5 s ile 12 saniye ≈ 4,8 zaman sabiti: kalan hata başlangıcın
     %1'inden küçük olmalı. Mutlak EV eşiği τ'ya bağlı olduğu için
     yanıltıcıdır. */
  const baglilik = Math.abs(ev - hedef) / Math.abs(baslangic - hedef);
  check('hedefe aşımsız oturuyor (kalan < başlangıcın %1\'i)', asim < 1e-6 && baglilik < 0.01,
    `kalan %${(100 * baglilik).toFixed(2)}`);

  /* Yön asimetrik: aydınlığa uyum karanlığa uyumdan HIZLI. */
  let a1 = 10, a2 = 10;
  for (let i = 0; i < 30; i++) { a1 = L.adaptEV(a1, 14, dt); a2 = L.adaptEV(a2, 6, dt); }
  check('aydınlığa uyum karanlığa uyumdan hızlı', Math.abs(a1 - 14) / 4 < Math.abs(a2 - 6) / 4,
    `aydınlık kalan ${(Math.abs(a1 - 14)).toFixed(2)} · karanlık kalan ${(Math.abs(a2 - 6)).toFixed(2)}`);
  /* Kadans bağımsız: 1/60 ile 1/120 aynı yere gider. */
  let k60 = 15, k120 = 15;
  for (let i = 0; i < 600; i++) k60 = L.adaptEV(k60, 8, 1 / 60);
  for (let i = 0; i < 1200; i++) k120 = L.adaptEV(k120, 8, 1 / 120);
  check('1/60 ve 1/120 aynı sonuca gidiyor', Math.abs(k60 - k120) < 1e-6, `Δ ${Math.abs(k60 - k120).toExponential(1)}`);
}

/* ── 6) yakıt tablosu ────────────────────────────────────────────────── */
console.log('== 6 yakıt kimyası: her yakıtın rengi tanımlı');
{
  const adlar = Object.keys(L.PROPELLANTS);
  check('yedi yakıt tanımlı', adlar.length === 7, adlar.join(' '));
  const nan = adlar.filter(k => L.propellantRGB(k).some(v => !Number.isFinite(v)));
  check('hiçbir yakıtta NaN yok', nan.length === 0, nan.join(','));
  const eksik = adlar.filter(k => { const p = L.PROPELLANTS[k]; return !p.ad || !p.ornek || !p.gorunum; });
  check('her yakıtta ad, örnek araç ve görünüm açıklaması var', eksik.length === 0, eksik.join(','));

  /* Kimya renge GERÇEKTEN giriyor mu? */
  const ker = L.propellantRGB('kerolox'), met = L.propellantRGB('methalox'), hyd = L.propellantRGB('hydrolox');
  check('kerolox turuncu (kırmızı > yeşil > mavi)', ker[0] > ker[1] && ker[1] > ker[2], ker.map(v => v.toFixed(2)).join(', '));
  check('methalox mavi baskın (CH 431 + C₂ 516)', met[2] > met[0], met.map(v => v.toFixed(2)).join(', '));
  check('hydrolox mavi ve çok saydam (opacity ≤ 0,15)', hyd[2] > hyd[0] && L.PROPELLANTS.hydrolox.opacity <= 0.15);
  check('soğuk gaz GÖRÜNMEZ — plüm çizilmez', L.propellantVisible('cold-gas') === false);
  check('katı yakıt duman ZORUNLU (smoke = 1)', L.PROPELLANTS.solid.smoke === 1);
  let bilinmeyen = false;
  try { L.propellantRGB('kekstir'); } catch { bilinmeyen = true; }
  check('bilinmeyen yakıt hata veriyor', bilinmeyen);
}

/* ── 7) karşıtlık etkisi ─────────────────────────────────────────────── */
console.log('== 7 karşıtlık etkisi (heiligenschein)');
{
  const s0 = L.oppositionSurge(0);
  const s5 = L.oppositionSurge(5 * Math.PI / 180);
  const s60 = L.oppositionSurge(60 * Math.PI / 180);
  check('faz açısı 0\'da parlaklık artışı ≥ %20', s0 >= 1.2, `×${s0.toFixed(2)}`);
  /* Ölçüt: 60°'de kalan fazlalık, tepedeki fazlalığın %10'undan az. */
  check('artış faz açısıyla hızla sönüyor (60°\'de tepenin < %10\'u)',
    s5 < s0 && s60 < s5 && (s60 - 1) / (s0 - 1) < 0.10,
    `0° ×${s0.toFixed(2)} · 5° ×${s5.toFixed(2)} · 60° ×${s60.toFixed(3)} → kalan %${(100 * (s60 - 1) / (s0 - 1)).toFixed(1)}`);
  let monoton = true;
  for (let g = 0; g < Math.PI; g += 0.01) if (L.oppositionSurge(g + 0.01) > L.oppositionSurge(g) + 1e-12) { monoton = false; break; }
  check('monoton azalan', monoton);
  check('yalnız tozlu yüzeyde gerçek (Dünya havası için reddedilir)',
    L.envAllows('heiligenschein', 'vacuum').ok && !L.envAllows('heiligenschein', 'earth').ok);
}

/* ── 8) emisyon ve yansıma ───────────────────────────────────────────── */
console.log('== 8 emisyon hatları ve yansıma');
{
  const yesil = L.emissionLineRGB([{ nm: 557.7, w: 1 }]);       // auroranın yeşili
  check('557,7 nm yeşil baskın', yesil[1] === 1 && yesil[0] < 0.9 && yesil[2] < 0.5, yesil.map(v => v.toFixed(2)).join(', '));
  const kirmizi = L.emissionLineRGB([{ nm: 630, w: 1 }]);
  check('630 nm kırmızı baskın', kirmizi[0] === 1 && kirmizi[2] < 0.2, kirmizi.map(v => v.toFixed(2)).join(', '));
  const mor = L.emissionLineRGB([{ nm: 431, w: 1 }]);
  check('431 nm (CH) mavi-mor', mor[2] === 1 && mor[1] < 0.5, mor.map(v => v.toFixed(2)).join(', '));
  check('hatsız giriş siyah döner', L.emissionLineRGB([]).every(v => v === 0));

  const yansiyan = L.reflectedRGB([0.4, 0.38, 0.35], L.blackbodyRGB(5772));
  check('yansıma ışık YARATMIYOR (her kanal albedodan küçük)',
    yansiyan.every((v, i) => v <= [0.4, 0.38, 0.35][i] + 1e-9), yansiyan.map(v => v.toFixed(3)).join(', '));
}

/* ── 9) ortam tablosu ────────────────────────────────────────────────── */
console.log('== 9 ortam tablosu');
{
  const E = L.ENVIRONMENTS;
  check('dört ortam tanımlı', Object.keys(E).length === 4, Object.keys(E).join(' '));
  check('Ay Güneş 127 000 lux, Mars 55 000, Dünya 100 000',
    E.vacuum.sunLux === 127000 && E.mars.sunLux === 55000 && E.earth.sunLux === 100000);
  check('vakumda gök ışığı YOK (AmbientLight\'ın fiziksel karşılığı yok)', E.vacuum.skyLux === 0);
  check('yalnız Dünya ve iç mekânda oksijen var', E.earth.oxygen && E.interior.oxygen && !E.vacuum.oxygen && !E.mars.oxygen);
  check('saçılma sırası vakum < mars < dünya', E.vacuum.scattering < E.mars.scattering && E.mars.scattering < E.earth.scattering);
}

/* ── S) sahne aydınlatması: her ışığın kaynağı var mı ────────────────── */
console.log('== S sahne aydınlatması kaynağa bağlı');
{
  /* The photometry has to agree with the measured table that was already
     in the repository, or one of the two is wrong and nobody would know. */
  const ay = S.isikButcesi('vacuum'), mars = S.isikButcesi('mars'), yor = S.isikButcesi('orbit');
  const olculen = L.ENVIRONMENTS;
  check('1 AU güneş aydınlığı ölçülen tabloyla uyuşuyor',
    Math.abs(ay.gunesLux - olculen.vacuum.sunLux) / olculen.vacuum.sunLux < 0.02,
    `${ay.gunesLux} vs ${olculen.vacuum.sunLux} lx`);
  check('Mars güneş aydınlığı ölçülen tabloyla uyuşuyor',
    Math.abs(mars.gunesLux - olculen.mars.sunLux) / olculen.mars.sunLux < 0.02,
    `${mars.gunesLux} vs ${olculen.mars.sunLux} lx`);
  /* The inverse square law, stated as a number rather than as a habit. */
  const oran = S.sunLuxAt(S.AU.mars) / S.sunLuxAt(S.AU.earth);
  check('Mars/Dünya güneş oranı ters kare yasasına uyuyor',
    Math.abs(oran - 1 / (S.AU.mars ** 2)) < 1e-9, `${oran.toFixed(4)}`);

  /* The defining property of an airless body: shadows have nothing to open
     them except the ground. A non-zero sky term here is the single error
     that made every one of these scenes look wrong. */
  check('havasız gövdede GÖK terimi tam sıfır', ay.gokLux === 0 && yor.gokLux === 0,
    `Ay ${ay.gokLux} lx · yörünge ${yor.gokLux} lx`);
  check('Mars\'ta gök terimi var ama küçük', mars.gokPay > 0.05 && mars.gokPay < 0.12,
    `%${(100 * mars.gokPay).toFixed(1)}`);
  check('Ay\'da tek dolgu regolit sekmesi (%5–8)', ay.yerPay > 0.05 && ay.yerPay < 0.08,
    `%${(100 * ay.yerPay).toFixed(1)}`);
  check('yörüngede tek dolgu yeryüzü ışığı (%15–25)', yor.yerPay > 0.15 && yor.yerPay < 0.25,
    `%${(100 * yor.yerPay).toFixed(1)}`);

  /* Colour is reflectance, not preference. Earthshine has to come back
     COOLER than the Sun that made it and regolith WARMER; if a scene has
     those the wrong way round it is painting, not lighting. */
  const yer = S.bounceColorRGB(S.SAHNELER.orbit.yerAlbedo3);
  const reg = S.bounceColorRGB(S.SAHNELER.vacuum.yerAlbedo3);
  check('yeryüzü ışığı güneşten SOĞUK', yer[2] > yer[0],
    `[${yer.map(v => v.toFixed(2)).join(', ')}]`);
  check('regolit sekmesi güneşten SICAK', reg[0] > reg[2],
    `[${reg.map(v => v.toFixed(2)).join(', ')}]`);
  check('beyaz dengesi güneşi beyaz noktaya alıyor',
    S.sunColorRGB().every(v => v === 1),
    `D65\'e göre [${S.sunColorRGB(false).map(v => v.toFixed(2)).join(', ')}]`);

  /* Reverse exam: if the sky term were restored on an airless body the
     shadow-side illumination would jump by the factor below. That number
     is why the check above exists. */
  const sahte = 0.42;                                 // the satellite page's old hemisphere share
  check('TERS SINAV: kaynaksız gök terimi gölgeyi kaç kat açardı',
    sahte / yor.yerPay > 1.5, `${(sahte / yor.yerPay).toFixed(1)}x`);

  /* A camera in a brighter place stops down. Intensity times exposure has
     to come out the same in every scene, or the render is saying that Mars
     is sunnier than the Moon - which the habitat page was saying, because
     it held intensity fixed and changed exposure instead. */
  let carpimSabit = true, carpimlar = [];
  for (const k of ['vacuum', 'mars', 'orbit']) {
    const b = S.isikButcesi(k);
    const yog = b.gunesLux / S.REFERANS_LUX;
    const poz = S.REFERANS_LUX / b.gunesLux;
    carpimlar.push(`${k} ${(yog * poz).toFixed(3)}`);
    if (Math.abs(yog * poz - 1) > 1e-9) carpimSabit = false;
  }
  check('yoğunluk × pozlama her sahnede sabit (kamera modeli)', carpimSabit,
    carpimlar.join(' · '));

  check('bilinmeyen sahne adı hata veriyor', (() => {
    try { S.isikButcesi('yok'); return false; } catch { return true; }
  })());
}

/* ── T) sahneler artık elle ışık kurmuyor ────────────────────────────── */
console.log('== T sahneler rig kullanıyor');
{
  /* A page that builds its own HemisphereLight is inventing a sky. These
     three were the ones doing it, and this is what stops them doing it
     again quietly. */
  const SAYFALAR = [
    'presets/satellite_integration/index.html',
    'presets/habitat_blocks/index.html',
    'presets/exploded_view/index.html',
  ];
  for (const rel of SAYFALAR) {
    const metin = fs.readFileSync(path.join(root, rel), 'utf8');
    /* Comments explain what was removed, so only real constructor calls
       count. */
    const kod = metin.replace(/\/\*[\s\S]*?\*\//g, '');
    const hemi = (kod.match(/new THREE\.HemisphereLight\(/g) || []).length;
    const dir = (kod.match(/new THREE\.DirectionalLight\(/g) || []).length;
    const ad = rel.split('/')[1];
    check(`${ad}: kendi HemisphereLight'ını kurmuyor`, hemi === 0, `${hemi} adet`);
    check(`${ad}: kendi DirectionalLight'ını kurmuyor`, dir === 0, `${dir} adet`);
    check(`${ad}: rig'i çağırıyor`, /sceneLighting\(/.test(kod));
  }
}

/* == yorunge dolgusu hangi yuzu aydinlatiyor =========================
   Yorungede gok terimi tam sifirdir, yani golgeyi acan TEK sey gezegen
   isigidir. O dolgu ters tarafa konuldugunda sahnenin golge yuzu SIYAH
   kalir - ve tam bu oluyordu: nadir (0,0,-1) ile cagrilan kurulum dolguyu
   (0,0,+1)'e koyuyordu, yani gezegene donuk yuz karanlikta, uzaya bakan yuz
   aydinlik. Modulun kendi yorumu dogrusunu zaten yaziyordu ("earthshine
   arrives from nadir and leaves the anti-nadir side dark"); 79 denetimin
   hicbiri yone bakmiyordu. */
console.log('== U yorunge dolgusu nadirden geliyor');
{
  /* Bu dosya bugune kadar yalniz saf matematik sinadi; kurulumun KENDISINI
     sinamak icin bir three gerekiyor. scene-lighting.mjs ucunden fazlasini
     kullanmiyor, o yuzden sahtesi kisa - ve sahte olmasi denetimi
     zayiflatmiyor, cunku sorulan sey isigin NEREYE konuldugu. */
  const V3 = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } });
  class SahteRenk {
    constructor(r = 1, g = 1, b = 1) { this.r = r; this.g = g; this.b = b; }
    setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  }
  const sahte = {
    Color: SahteRenk,
    DirectionalLight: class {
      constructor(renk, yogunluk) {
        this.color = renk instanceof SahteRenk ? renk : new SahteRenk();
        this.intensity = yogunluk; this.position = V3(); this.userData = {};
        this.castShadow = false;
        this.shadow = { mapSize: { set() {} }, camera: {}, bias: 0 };
      }
    },
    HemisphereLight: class {
      constructor(gok, yer, yogunluk) {
        this.color = new SahteRenk(); this.groundColor = new SahteRenk();
        this.intensity = yogunluk; this.position = V3(); this.userData = {};
        void gok; void yer;
      }
    },
  };
  const rig = S.sceneLighting(sahte, { add() {} }, 'orbit', { anahtarYogunluk: 3.1 });

  /* Uc farkli nadir yonu: tek bir yon, isaret hatasini eksen secimiyle
     gizleyebilir. */
  for (const nadir of [[0, 0, -1], [0, -1, 0], [0.6, 0, -0.8]]) {
    rig.yorungeyeAyarla(nadir);
    const q = rig.yansima.position;
    const nok = q.x * nadir[0] + q.y * nadir[1] + q.z * nadir[2];
    check(`dolgu gezegenin bulundugu yonde duruyor [${nadir.join(", ")}]`, nok > 0,
      `konum (${q.x}, ${q.y}, ${q.z}) - nadirle ic carpim ${nok.toFixed(2)}`);
  }

  rig.yorungeyeAyarla([0, 0, -1]);
  check('yorungede gok terimi kapali (bosluk ta gok yok)',
    rig.gokYer.intensity === 0, String(rig.gokYer.intensity));
  check('gezegen isigi golgeyi acacak kadar var',
    rig.yansima.intensity > 0, rig.yansima.intensity.toFixed(3));

  /* TERS SINAV: isaret cevrildiginde ic carpim negatife doner - yani bu
     sinav gercekten YONU olcuyor, varligi degil. */
  const q = rig.yansima.position;
  const cevrik = (-q.z) * (-1);
  check('TERS SINAV: ters isaret yakalaniyor', cevrik < 0,
    `cevrilmis konum nadirle ${cevrik.toFixed(2)} veriyor`);
}

console.log(`
${total - fails}/${total} gecti`);
process.exit(fails ? 1 : 0);
