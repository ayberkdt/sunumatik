/* net-builder.mjs — MİMARİ KURUCU (ml_net_builder)

   Bir ağ mimarisi TARİFİ ver, sahne onu BLOK BLOK kursun ve anlatsın.
   orbital-stage'in ML karşılığı: oraya yörünge verilir uçurur, buraya
   mimari verilir kurar. webgl-scene-contract.md'ye istisnasız uyar.

   API:
     const net = await mountNetBuilder(host, { mimari, seed, autoplay, ... });
     await net.kur(mimari)      → { katmanlar, toplamParametre, ... } (şekil çıkarımı)
     net.adim()                 → bir sonraki bloğu getir (animasyonlu)
     net.git(i)                 → i. bloğun kurulduğu ana ışınlan (deterministik)
     net.ileri()                → ileri geçiş darbesini başlat
     net.timeline = { play, pause, scrub, t, duration }
     net.camera   = { mode(m), transitionTo(m,{duration}) }  — yonetmen|genel|katman|akis|serbest
     net.hud(bool) · net.odakla(i) · net.advance(dt) · net.setActive(b) · net.dispose()

   ŞEKİL ÇIKARIMI GERÇEKTİR: konv/havuz çıkışları
       out = floor((in + 2p − k)/s) + 1
   formülüyle hesaplanır (dolgu 'gecerli'/'ayni'/sayı, adım desteklenir) ve
   parametre sayıları katman katman türetilir (Keras'ın Param # sütunuyla
   birebir karşılaştırılabilir; yığın normalizasyonunda eğitilebilir 2C ile
   durgun 2C AYRI raporlanır). Sayı yanlışsa sunum çöker — bu yüzden
   cikarim() saf bir fonksiyondur ve demo sayfası ?test=1 ile elle
   doğrulanmış üç mimariyi karşılaştırır.

   BLOK BAĞIMLILIĞI YUMUŞAKTIR: ml_layer_blocks dinamik import()
   ile bağlanır; modül yoksa/kırıksa etiketli yer tutucu bloklarla sahne
   AYNEN çalışır (sözleşme: bloklar birbirine sert bağlanmaz).
   Blok modülünün yolu options.bloklarUrl ile değiştirilebilir.

   Süreklilik: tüm görsel durum sim zamanı t'nin SAF fonksiyonudur
   (scrub deterministik, ekran görüntüsü tekrarlanabilir); eşikler
   sıfırdan rampalanır; görünür geometri yeniden inşa edilmez — yeniden
   kurulum yalnız opaklığı sıfır olan yeni ağaç üzerinde yapılır. */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { EffectComposer } from '../moon_advanced/vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../moon_advanced/vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../moon_advanced/vendor/postprocessing/UnrealBloomPass.js';

const TAU = Math.PI * 2;
const nfTR = new Intl.NumberFormat('tr-TR');
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth01 = x => { const s = clamp01(x); return s * s * (3 - 2 * s); };
const easeInOut = t => (t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const easeOutCubic = t => 1 - (1 - t) ** 3;
/* geri tepmeli oturma: blok yerine hafifçe gömülüp yerleşir (tek yönlü, C1) */
const easeOutBack = t => { const c = 1.34; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const windowFn = (t, on0, on1, off0, off1) =>
  smooth01((t - on0) / Math.max(1e-9, on1 - on0)) * (1 - smooth01((t - off0) / Math.max(1e-9, off1 - off0)));
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================================================================
   1) ŞEKİL ÇIKARIMI — saf, THREE'den bağımsız, tek doğruluk kaynağı
   ================================================================ */

export class MimariHatasi extends Error {
  constructor(mesaj, katman = null) {
    super(mesaj);
    this.name = 'MimariHatasi';
    this.katman = katman;                 /* 0 tabanlı katman dizini (varsa) */
  }
}

const TUR_ADLARI = {
  input: 'giriş', conv: 'konv', pool: 'havuz', dense: 'tam bağlı', flatten: 'düzleştir',
  norm: 'normalizasyon', activation: 'etkinleştirme', attention: 'dikkat',
  residual: 'artık bağlantı', output: 'çıkış',
};
const AKTIVASYON_ADI = {
  relu: 'ReLU', gelu: 'GELU', tanh: 'tanh', sigmoid: 'Sigmoid',
  softmax: 'Softmax', silu: 'SiLU', elu: 'ELU', leakyrelu: 'Leaky ReLU',
};

const sekilStr = s => (Array.isArray(s) ? s.join('×') : '—');
const carp = s => s.reduce((a, b) => a * b, 1);

function pozitifTam(v, ad, i) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || Math.round(n) !== n) {
    throw new MimariHatasi(`${i + 1}. katman: "${ad}" pozitif tam sayı olmalı (gelen: ${JSON.stringify(v)}).`, i);
  }
  return n;
}
function ikili(v, ad, i, varsayilan) {
  if (v == null) return varsayilan;
  if (typeof v === 'number') { const n = pozitifTam(v, ad, i); return [n, n]; }
  if (Array.isArray(v) && v.length === 2) return [pozitifTam(v[0], ad, i), pozitifTam(v[1], ad, i)];
  throw new MimariHatasi(`${i + 1}. katman: "${ad}" bir sayı ya da iki elemanlı dizi olmalı ([3,3] gibi).`, i);
}

/* dolgu: 'gecerli' (yok) · 'ayni' (çıkış = ceil(in/s)) · sayı (kenar başına) */
function dolguToplam(mod, inSz, k, s, i) {
  if (mod == null || mod === 'gecerli' || mod === 'valid') return 0;
  if (mod === 'ayni' || mod === 'same') {
    const out = Math.ceil(inSz / s);
    return Math.max(0, (out - 1) * s + k - inSz);
  }
  const n = Number(mod);
  if (!Number.isFinite(n) || n < 0) {
    throw new MimariHatasi(`${i + 1}. katman: "dolgu" 'gecerli', 'ayni' ya da negatif olmayan bir sayı olmalı.`, i);
  }
  return 2 * n;
}
/* out = ⌊(in + 2p − k)/s⌋ + 1 — kütüphanenin TEK boyut formülü */
const konvCikis = (inSz, k, s, pTop) => Math.floor((inSz + pTop - k) / s) + 1;

/**
 * Bildirimsel mimariden katman katman şekil + parametre çıkarımı.
 * @returns {{katmanlar:Array, toplamParametre:number, toplamDurgun:number,
 *            girisSekli:number[], cikisSekli:number[]}}
 */
export function cikarim(mimari) {
  if (!Array.isArray(mimari) || mimari.length === 0) {
    throw new MimariHatasi('Mimari boş olamaz: en az bir {tur:"input", sekil:[...]} katmanı gerekir.', null);
  }
  if (!mimari[0] || mimari[0].tur !== 'input') {
    throw new MimariHatasi('İlk katman {tur:"input", sekil:[...]} olmalı.', 0);
  }
  const katmanlar = [];
  let sekil = null;
  let toplam = 0, durgunToplam = 0;

  for (let i = 0; i < mimari.length; i++) {
    const ham = mimari[i];
    if (!ham || typeof ham !== 'object' || Array.isArray(ham)) {
      throw new MimariHatasi(`${i + 1}. katman bir nesne olmalı: {tur:"conv", filtre:32, ...}`, i);
    }
    const tur = String(ham.tur || '').trim();
    if (!TUR_ADLARI[tur]) {
      throw new MimariHatasi(`${i + 1}. katman: bilinmeyen tür "${ham.tur}". Geçerli türler: ${Object.keys(TUR_ADLARI).join(', ')}.`, i);
    }
    if (i > 0 && tur === 'input') {
      throw new MimariHatasi(`${i + 1}. katman: "input" yalnız ilk katman olabilir.`, i);
    }
    const giris = sekil ? sekil.slice() : null;
    let cikis = null, parametre = 0, durgun = 0;
    let ad = '', detay = '', formulSekil = '', formulParam = '', blokArgs = {}, olcek = 1;

    switch (tur) {
      case 'input': {
        const s = ham.sekil;
        if (!Array.isArray(s) || s.length === 0 || s.length > 3 || !s.every(n => Number.isFinite(n) && n > 0 && Math.round(n) === n)) {
          throw new MimariHatasi('1. katman: "sekil" 1–3 pozitif tam sayıdan oluşan dizi olmalı ([28,28,1] ya da [784] gibi).', i);
        }
        cikis = s.map(n => Math.round(n));
        ad = 'Giriş';
        detay = cikis.length === 3 ? `${cikis[0]}×${cikis[1]} · ${cikis[2]} kanal` : `${carp(cikis)} değer`;
        blokArgs = { sekil: cikis.slice() };
        olcek = 1;
        break;
      }
      case 'conv': {
        if (!giris || giris.length !== 3) {
          throw new MimariHatasi(`${i + 1}. katman (konv): giriş 3 boyutlu olmalı [Y,G,K]; gelen ${sekilStr(giris)}. Konv katmanını düzleştirmeden önce koyun.`, i);
        }
        const F = pozitifTam(ham.filtre, 'filtre', i);
        const k = ikili(ham.cekirdek, 'cekirdek', i, [3, 3]);
        const s = ikili(ham.adim, 'adim', i, [1, 1]);
        const pY = dolguToplam(ham.dolgu, giris[0], k[0], s[0], i);
        const pX = dolguToplam(ham.dolgu, giris[1], k[1], s[1], i);
        const oy = konvCikis(giris[0], k[0], s[0], pY);
        const ox = konvCikis(giris[1], k[1], s[1], pX);
        if (oy <= 0 || ox <= 0) {
          throw new MimariHatasi(`${i + 1}. katman (konv): ${sekilStr(giris)} girişinde ${k[0]}×${k[1]} çekirdek ve ${s[0]} adım ile çıkış ${oy}×${ox} — sıfır ya da negatif. Çekirdeği küçültün, adımı düşürün ya da dolgu:'ayni' kullanın.`, i);
        }
        const bias = ham.bias !== false;
        cikis = [oy, ox, F];
        parametre = k[0] * k[1] * giris[2] * F + (bias ? F : 0);
        ad = `Konv ${k[0]}×${k[1]}`;
        detay = `${F} filtre · adım ${s[0]}${s[1] !== s[0] ? '×' + s[1] : ''} · dolgu ${ham.dolgu === 'ayni' || ham.dolgu === 'same' ? 'aynı' : (pY / 2 || 0)}`;
        formulSekil = `⌊(${giris[0]}+${pY}−${k[0]})/${s[0]}⌋+1 = ${oy}`;
        formulParam = `${k[0]}·${k[1]}·${giris[2]}·${F}${bias ? ` + ${F}` : ''} = ${nfTR.format(parametre)}`;
        blokArgs = { filtre: F, cekirdek: k.slice(), adim: s.slice() };
        olcek = 1;
        break;
      }
      case 'pool': {
        if (!giris || giris.length !== 3) {
          throw new MimariHatasi(`${i + 1}. katman (havuz): giriş 3 boyutlu olmalı [Y,G,K]; gelen ${sekilStr(giris)}.`, i);
        }
        const tip = (ham.tip || 'max').toLowerCase();
        if (!['max', 'ort', 'avg', 'ortalama'].includes(tip)) {
          throw new MimariHatasi(`${i + 1}. katman (havuz): "tip" 'max' ya da 'ort' olmalı (gelen: ${ham.tip}).`, i);
        }
        const b = ikili(ham.boyut, 'boyut', i, [2, 2]);
        const s = ikili(ham.adim, 'adim', i, b.slice());
        const pY = dolguToplam(ham.dolgu, giris[0], b[0], s[0], i);
        const pX = dolguToplam(ham.dolgu, giris[1], b[1], s[1], i);
        const oy = konvCikis(giris[0], b[0], s[0], pY);
        const ox = konvCikis(giris[1], b[1], s[1], pX);
        if (oy <= 0 || ox <= 0) {
          throw new MimariHatasi(`${i + 1}. katman (havuz): ${sekilStr(giris)} girişi ${b[0]}×${b[1]} havuz için çok küçük (çıkış ${oy}×${ox}). Önceki havuzları azaltın.`, i);
        }
        cikis = [oy, ox, giris[2]];
        ad = `${tip === 'max' ? 'Maks' : 'Ort'} havuz ${b[0]}×${b[1]}`;
        detay = `adım ${s[0]} · kanal değişmez`;
        formulSekil = `⌊(${giris[0]}+${pY}−${b[0]})/${s[0]}⌋+1 = ${oy}`;
        blokArgs = { tip: tip === 'max' ? 'max' : 'ort', boyut: b.slice() };
        olcek = .82;
        break;
      }
      case 'flatten': {
        if (!giris) throw new MimariHatasi(`${i + 1}. katman: girişten önce düzleştirilemez.`, i);
        if (giris.length === 1) {
          throw new MimariHatasi(`${i + 1}. katman (düzleştir): giriş zaten vektör (${sekilStr(giris)}) — bu katman gereksiz.`, i);
        }
        cikis = [carp(giris)];
        ad = 'Düzleştir';
        detay = `${sekilStr(giris)} → ${nfTR.format(cikis[0])} değer`;
        formulSekil = `${giris.join(' · ')} = ${nfTR.format(cikis[0])}`;
        blokArgs = {};
        olcek = .74;
        break;
      }
      case 'dense':
      case 'output': {
        if (!giris) throw new MimariHatasi(`${i + 1}. katman: girişten önce tam bağlı katman olamaz.`, i);
        if (giris.length === 3) {
          throw new MimariHatasi(`${i + 1}. katman (${TUR_ADLARI[tur]}): giriş ${sekilStr(giris)} — tam bağlı katman vektör bekler. Önce {tur:'flatten'} ekleyin.`, i);
        }
        const U = pozitifTam(ham.birim, 'birim', i);
        const D = giris[giris.length - 1];
        const bias = ham.bias !== false;
        cikis = giris.length === 2 ? [giris[0], U] : [U];
        parametre = D * U + (bias ? U : 0);
        const tip = (ham.tip || (tur === 'output' ? 'softmax' : '')).toLowerCase();
        ad = tur === 'output' ? `Çıkış ${U}` : `Tam bağlı ${U}`;
        detay = tur === 'output'
          ? `${AKTIVASYON_ADI[tip] || tip || 'doğrusal'} · ${U} sınıf`
          : (giris.length === 2 ? 'konum-bazlı (her token)' : `${nfTR.format(D)} → ${nfTR.format(U)}`);
        formulParam = `${nfTR.format(D)}·${nfTR.format(U)}${bias ? ` + ${nfTR.format(U)}` : ''} = ${nfTR.format(parametre)}`;
        blokArgs = tur === 'output' ? { birim: U, tip: tip || 'softmax' } : { birim: U };
        olcek = tur === 'output' ? 1 : .95;
        break;
      }
      case 'activation': {
        if (!giris) throw new MimariHatasi(`${i + 1}. katman: girişten önce etkinleştirme olamaz.`, i);
        const tip = String(ham.tip || 'relu').toLowerCase();
        cikis = giris.slice();
        ad = AKTIVASYON_ADI[tip] || tip.toUpperCase();
        detay = 'şekil değişmez · parametresiz';
        blokArgs = { tip };
        olcek = .58;
        break;
      }
      case 'norm': {
        if (!giris) throw new MimariHatasi(`${i + 1}. katman: girişten önce normalizasyon olamaz.`, i);
        const tip = String(ham.tip || 'yigin').toLowerCase();
        if (!['yigin', 'batch', 'katman', 'layer'].includes(tip)) {
          throw new MimariHatasi(`${i + 1}. katman (normalizasyon): "tip" 'yigin' ya da 'katman' olmalı (gelen: ${ham.tip}).`, i);
        }
        const yigin = tip === 'yigin' || tip === 'batch';
        const C = giris[giris.length - 1];
        cikis = giris.slice();
        parametre = 2 * C;                       /* γ ve β — eğitilebilir */
        durgun = yigin ? 2 * C : 0;              /* hareketli ortalama/varyans — eğitilmez */
        ad = yigin ? 'Yığın norm.' : 'Katman norm.';
        detay = yigin ? `γ,β: 2·${C} eğitilebilir (+2·${C} durgun)` : `γ,β: 2·${C}`;
        formulParam = `2·${C} = ${nfTR.format(parametre)}`;
        blokArgs = { tip: yigin ? 'yigin' : 'katman' };
        olcek = .62;
        break;
      }
      case 'attention': {
        if (!giris || giris.length !== 2) {
          throw new MimariHatasi(`${i + 1}. katman (dikkat): giriş 2 boyutlu dizi olmalı [T,d]; gelen ${sekilStr(giris)}.`, i);
        }
        const kafa = pozitifTam(ham.kafa ?? 8, 'kafa', i);
        const d = giris[1];
        if (d % kafa !== 0) {
          throw new MimariHatasi(`${i + 1}. katman (dikkat): model boyutu ${d}, kafa sayısı ${kafa}'ya tam bölünmüyor (${d}/${kafa} = ${(d / kafa).toFixed(2)}).`, i);
        }
        const bias = ham.bias !== false;
        cikis = giris.slice();
        parametre = 4 * d * d + (bias ? 4 * d : 0);      /* W_Q,W_K,W_V,W_O */
        ad = `Dikkat · ${kafa} kafa`;
        detay = `d=${d} · kafa başına ${d / kafa}`;
        formulParam = `4·${d}²${bias ? ` + 4·${d}` : ''} = ${nfTR.format(parametre)}`;
        blokArgs = { kafa };
        olcek = 1;
        break;
      }
      case 'residual': {
        const atlama = pozitifTam(ham.atlama ?? 2, 'atlama', i);
        const kaynak = i - atlama - 1;
        if (kaynak < 0) {
          throw new MimariHatasi(`${i + 1}. katman (artık bağlantı): ${atlama} katman geriye atlanamaz — bağlantının başlayacağı katman yok.`, i);
        }
        const kaynakSekil = katmanlar[kaynak].cikisSekli;
        if (!giris || kaynakSekil.length !== giris.length || kaynakSekil.some((v, k) => v !== giris[k])) {
          throw new MimariHatasi(`${i + 1}. katman (artık bağlantı): toplanacak şekiller uyuşmuyor — ${kaynak + 1}. katman çıkışı ${sekilStr(kaynakSekil)}, buraya gelen ${sekilStr(giris)}. Atlama sayısını düzeltin ya da izdüşüm katmanı ekleyin.`, i);
        }
        cikis = giris.slice();
        ad = 'Artık bağlantı';
        detay = `${kaynak + 1}. katmandan + · ${atlama} katman atlanır`;
        formulSekil = `${sekilStr(kaynakSekil)} + ${sekilStr(giris)} = ${sekilStr(cikis)}`;
        blokArgs = { atlama };
        olcek = .68;
        break;
      }
      default:
        throw new MimariHatasi(`${i + 1}. katman: desteklenmeyen tür.`, i);
    }

    toplam += parametre;
    durgunToplam += durgun;
    katmanlar.push({
      dizin: i, tur, ad, detay,
      girisSekli: giris, cikisSekli: cikis,
      parametre, durgun, formulSekil, formulParam,
      blokArgs, olcek, spec: ham,
      kaynak: tur === 'residual' ? i - pozitifTam(ham.atlama ?? 2, 'atlama', i) - 1 : null,
      birikimli: toplam,
    });
    sekil = cikis;
  }

  return {
    katmanlar,
    toplamParametre: toplam,
    toplamDurgun: durgunToplam,
    girisSekli: katmanlar[0].cikisSekli,
    cikisSekli: sekil,
  };
}

export const netMath = {
  cikarim, konvCikis, dolguToplam,
  formul: 'out = floor((in + 2p − k)/s) + 1',
};

/* ================================================================
   2) HAZIR MİMARİLER
   ================================================================ */
export const ORNEK_MIMARILER = {
  cnn: {
    ad: 'Küçük ESA (MNIST)',
    ozet: 'Evrişimli sinir ağı: iki konv+havuz kademesi, sonra sınıflandırıcı kafa.',
    mimari: [
      { tur: 'input', sekil: [28, 28, 1] },
      { tur: 'conv', filtre: 32, cekirdek: [3, 3] },
      { tur: 'activation', tip: 'relu' },
      { tur: 'pool', tip: 'max', boyut: [2, 2] },
      { tur: 'conv', filtre: 64, cekirdek: [3, 3] },
      { tur: 'activation', tip: 'relu' },
      { tur: 'pool', tip: 'max', boyut: [2, 2] },
      { tur: 'flatten' },
      { tur: 'dense', birim: 128 },
      { tur: 'activation', tip: 'relu' },
      { tur: 'output', birim: 10, tip: 'softmax' },
    ],
  },
  mlp: {
    ad: 'Çok katmanlı algılayıcı',
    ozet: 'Düz vektör girişi üzerinde üç tam bağlı katman — en yalın katmanlama.',
    mimari: [
      { tur: 'input', sekil: [784] },
      { tur: 'dense', birim: 256 },
      { tur: 'activation', tip: 'relu' },
      { tur: 'dense', birim: 64 },
      { tur: 'activation', tip: 'relu' },
      { tur: 'output', birim: 10, tip: 'softmax' },
    ],
  },
  resnet: {
    ad: 'Artık bloklu derin ağ',
    ozet: 'Konv → norm → ReLU üçlüsü ve üstünden geçen artık (residual) kemer.',
    mimari: [
      { tur: 'input', sekil: [32, 32, 3] },
      { tur: 'conv', filtre: 64, cekirdek: [3, 3], dolgu: 'ayni' },
      { tur: 'norm', tip: 'yigin' },
      { tur: 'activation', tip: 'relu' },
      { tur: 'conv', filtre: 64, cekirdek: [3, 3], dolgu: 'ayni' },
      { tur: 'norm', tip: 'yigin' },
      { tur: 'activation', tip: 'relu' },
      { tur: 'conv', filtre: 64, cekirdek: [3, 3], dolgu: 'ayni' },
      { tur: 'norm', tip: 'yigin' },
      { tur: 'residual', atlama: 5 },
      { tur: 'activation', tip: 'relu' },
      { tur: 'pool', tip: 'max', boyut: [2, 2] },
      { tur: 'pool', tip: 'max', boyut: [2, 2] },
      { tur: 'flatten' },
      { tur: 'dense', birim: 128 },
      { tur: 'output', birim: 10, tip: 'softmax' },
    ],
  },
  trafo: {
    ad: 'Dönüştürücü bloğu',
    ozet: 'Katman norm. → dikkat → artık; sonra norm → ileri besleme → artık.',
    mimari: [
      { tur: 'input', sekil: [64, 128] },
      { tur: 'norm', tip: 'katman' },
      { tur: 'attention', kafa: 8 },
      { tur: 'residual', atlama: 2 },
      { tur: 'norm', tip: 'katman' },
      { tur: 'dense', birim: 512 },
      { tur: 'activation', tip: 'gelu' },
      { tur: 'dense', birim: 128 },
      { tur: 'residual', atlama: 4 },
    ],
  },
};

/* ================================================================
   3) YER TUTUCU BLOKLAR — ml-layer-blocks yoksa sahne aynen çalışır
   Sözleşme: origin blok merkezinde, +X ileri, X ≈ .25·scale, Y/Z ≤ 1·scale
   ================================================================ */
const BLOK_FN = {
  input: 'buildInput', conv: 'buildConv', pool: 'buildPool', dense: 'buildDense',
  flatten: 'buildFlatten', norm: 'buildNorm', activation: 'buildActivation',
  attention: 'buildAttention', residual: 'buildResidual', output: 'buildOutput',
};

function yerTutucuBlok(tur, args = {}) {
  const s = args.scale ?? 1;
  const p = args.palette || {};
  const govde = p.blok || '#2b2f3a';
  const vurgu = p.accent || '#d9b877';
  const ikinci = p.data1 || '#8fb8dd';
  const g = new THREE.Group();
  const mat = (renk, opts = {}) => new THREE.MeshStandardMaterial({
    color: renk, metalness: .28, roughness: .52, ...opts,
  });
  const kutu = (x, y, z, renk, opts) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat(renk, opts));
  const cerceve = (x, y, z, renk) => {
    const l = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(x, y, z)),
      new THREE.LineBasicMaterial({ color: renk, transparent: true, opacity: .85 }));
    return l;
  };

  if (tur === 'input') {
    const b = kutu(.16 * s, .92 * s, .92 * s, govde);
    g.add(b, cerceve(.17 * s, .93 * s, .93 * s, ikinci));
    for (let k = -1; k <= 1; k++) {                     /* örnek pikselleri anıştıran kabartma */
      const c = kutu(.02 * s, .2 * s, .2 * s, ikinci, { emissive: new THREE.Color(ikinci), emissiveIntensity: .18 });
      c.position.set(.09 * s, k * .26 * s, k * .22 * s);
      g.add(c);
    }
  } else if (tur === 'conv') {
    g.add(kutu(.25 * s, .78 * s, .78 * s, govde), cerceve(.26 * s, .79 * s, .79 * s, vurgu));
    for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) {   /* 3×3 çekirdek yüzü */
      const c = kutu(.03 * s, .17 * s, .17 * s, vurgu, { metalness: .5, roughness: .35 });
      c.position.set(.14 * s, a * .21 * s, b2 * .21 * s);
      g.add(c);
    }
  } else if (tur === 'pool') {
    for (const [a, b2] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {      /* dört pencere → bir çıktı */
      const c = kutu(.22 * s, .3 * s, .3 * s, govde);
      c.position.set(-.03 * s, a * .19 * s, b2 * .19 * s);
      g.add(c);
    }
    const t = kutu(.1 * s, .26 * s, .26 * s, vurgu, { emissive: new THREE.Color(vurgu), emissiveIntensity: .12 });
    t.position.x = .17 * s;
    g.add(t);
  } else if (tur === 'activation') {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(.42 * s, .42 * s, .12 * s, 40),
      mat(vurgu, { metalness: .1, roughness: .6, transparent: true, opacity: .9 }));
    d.rotation.z = Math.PI / 2;
    g.add(d);
    const halka = new THREE.Mesh(new THREE.TorusGeometry(.44 * s, .022 * s, 10, 44), mat(ikinci, { metalness: .5 }));
    halka.rotation.y = Math.PI / 2;
    g.add(halka);
  } else if (tur === 'norm') {
    const a = kutu(.05 * s, .82 * s, .82 * s, govde); a.position.x = -.07 * s;
    const b = kutu(.05 * s, .82 * s, .82 * s, ikinci, { transparent: true, opacity: .8 }); b.position.x = .07 * s;
    g.add(a, b, cerceve(.2 * s, .84 * s, .84 * s, ikinci));
  } else if (tur === 'flatten') {
    for (let k = 0; k < 7; k++) {                        /* yelpaze: hacim → vektör */
      const c = kutu(.2 * s, .08 * s, (.7 - k * .085) * s, govde);
      c.position.y = (k - 3) * .11 * s;
      g.add(c);
    }
  } else if (tur === 'dense' || tur === 'output') {
    g.add(kutu(.22 * s, .5 * s, .5 * s, govde), cerceve(.23 * s, .51 * s, .51 * s, tur === 'output' ? vurgu : ikinci));
    const n = 5;
    for (let k = 0; k < n; k++) {                        /* birim düğümleri */
      const c = new THREE.Mesh(new THREE.SphereGeometry(.055 * s, 14, 10),
        mat(tur === 'output' ? vurgu : ikinci, { metalness: .45, roughness: .3 }));
      c.position.set(.13 * s, (k - (n - 1) / 2) * .19 * s, 0);
      g.add(c);
    }
  } else if (tur === 'attention') {
    for (let k = 0; k < 3; k++) {                        /* Q, K, V levhaları */
      const c = kutu(.04 * s, .74 * s, .74 * s, k === 1 ? ikinci : govde, { transparent: true, opacity: .88 });
      c.position.set((k - 1) * .09 * s, 0, (k - 1) * .07 * s);
      g.add(c);
    }
    g.add(cerceve(.28 * s, .76 * s, .78 * s, vurgu));
  } else if (tur === 'residual') {
    const halka = new THREE.Mesh(new THREE.TorusGeometry(.34 * s, .05 * s, 12, 40), mat(vurgu, { metalness: .5 }));
    halka.rotation.y = Math.PI / 2;
    const c1 = kutu(.06 * s, .38 * s, .06 * s, vurgu);   /* + işareti */
    const c2 = kutu(.06 * s, .06 * s, .38 * s, vurgu);
    g.add(halka, c1, c2);
  } else {
    g.add(kutu(.25 * s, .7 * s, .7 * s, govde), cerceve(.26 * s, .71 * s, .71 * s, vurgu));
  }
  g.userData = { ad: TUR_ADLARI[tur] || tur, tur, yerTutucu: true };
  return g;
}

/* ================================================================
   4) SAHNE
   ================================================================ */
export async function mountNetBuilder(host, options = {}) {
  if (!host) throw new Error('mountNetBuilder bir kap ister');

  const seed = options.seed ?? 1;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const exportMode = options.exportMode
    ?? (params.get('export') === '1' || document.documentElement.dataset.export === 'true');
  const bloklarUrl = options.bloklarUrl ?? params.get('bloklar')
    ?? '../ml_layer_blocks/ml-layer-blocks.mjs';

  const ADIM_SURE = options.adimSure ?? 1.5;      /* blok başına kurulum süresi (s) */
  const KURULUM_KUYRUK = .9;                      /* son bloktan sonra nefes */
  const ILERI_SURE = options.ileriSure ?? 7.2;    /* ileri geçiş döngüsü (s) */
  const ARALIK = 1.28;                            /* bloklar arası boşluk (tensör yuvası) */
  const RAY_Y = -.82;                             /* omurga rayının yüksekliği */

  /* -------- DOM: tuval + HUD + etiket katmanı (deste tipografisi) */
  const figure = document.createElement('figure');
  figure.className = 'net-builder';
  figure.innerHTML = `
    <style>
      .net-builder{position:relative;margin:0;width:100%;height:100%;overflow:hidden;
        background:var(--color-canvas,#0b0c10);
        font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);}
      .net-builder__canvas{position:absolute;inset:0;}
      .net-builder__canvas canvas{display:block;width:100%;height:100%;}
      .net-builder__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .net-builder__card{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;
        text-align:center;opacity:0;color:var(--color-ink,#e9e4d8);
        text-shadow:0 1px 5px rgba(0,0,0,.9);line-height:1.32;}
      .net-builder__card b{display:block;font-size:13.5px;font-weight:600;letter-spacing:.02em;}
      .net-builder__card .det{display:block;opacity:0;}
      .net-builder__card .det span{display:block;}
      .net-builder__card .sekil{font-size:11.5px;font-family:var(--font-mono,ui-monospace,monospace);
        color:var(--color-data-1,#8fb8dd);font-variant-numeric:tabular-nums;}
      .net-builder__card .formul{font-size:10.5px;font-family:var(--font-mono,ui-monospace,monospace);
        color:var(--color-muted,#9a938a);}
      .net-builder__card .par{font-size:11px;color:var(--color-accent,#d9b877);
        font-family:var(--font-mono,ui-monospace,monospace);font-variant-numeric:tabular-nums;}
      .net-builder__tag{position:absolute;transform:translate(-50%,0);white-space:nowrap;opacity:0;
        font-size:11px;font-family:var(--font-mono,ui-monospace,monospace);
        color:var(--color-ink,#e9e4d8);text-shadow:0 1px 5px rgba(0,0,0,.9);
        font-variant-numeric:tabular-nums;}
      .net-builder__hud{position:absolute;top:16px;left:16px;min-width:216px;
        padding:12px 16px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);
        color:var(--color-ink,#e9e4d8);pointer-events:none;}
      .net-builder__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 14px;}
      .net-builder__hud dt{font-size:11px;letter-spacing:.09em;text-transform:uppercase;
        color:var(--color-muted,#9a938a);align-self:baseline;}
      .net-builder__hud dd{margin:0;text-align:right;font-size:15px;font-variant-numeric:tabular-nums;
        font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .net-builder__hud .not{grid-column:1/-1;margin-top:4px;padding-top:6px;
        border-top:1px solid var(--color-rule,#3a3c42);font-size:11px;letter-spacing:.05em;
        color:var(--color-accent,#d9b877);text-align:right;}
      .net-builder__faz{position:absolute;left:16px;bottom:14px;padding:7px 13px;border-radius:8px;
        border:1px solid var(--color-rule,#3a3c42);
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);
        color:var(--color-ink,#e9e4d8);font-size:12.5px;letter-spacing:.03em;pointer-events:none;}
      .net-builder__faz b{color:var(--color-accent,#d9b877);font-weight:600;}
      .net-builder__hata{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        max-width:min(560px,86%);padding:16px 20px;border-radius:10px;
        border:1px solid var(--color-data-2,#d78f6c);
        background:color-mix(in srgb,var(--color-surface,#15161a) 94%,transparent);
        color:var(--color-ink,#e9e4d8);font-size:13.5px;line-height:1.5;}
      .net-builder__hata b{display:block;color:var(--color-data-2,#d78f6c);margin-bottom:5px;
        letter-spacing:.08em;text-transform:uppercase;font-size:11px;}
    </style>
    <div class="net-builder__canvas" aria-hidden="true"></div>
    <div class="net-builder__labels" aria-hidden="true"></div>
    <div class="net-builder__hud" role="status" hidden>
      <dl>
        <dt>katman</dt><dd data-hud="katman">—</dd>
        <dt>parametre</dt><dd data-hud="param">—</dd>
        <dt>giriş</dt><dd data-hud="giris">—</dd>
        <dt>çıkış</dt><dd data-hud="cikis">—</dd>
        <div class="not" data-hud="not"></div>
      </dl>
    </div>
    <div class="net-builder__faz" data-faz hidden></div>`;
  host.appendChild(figure);
  const canvasHost = figure.querySelector('.net-builder__canvas');
  const labelLayer = figure.querySelector('.net-builder__labels');
  const hudEl = figure.querySelector('.net-builder__hud');
  const fazEl = figure.querySelector('[data-faz]');
  const hudFields = {
    katman: hudEl.querySelector('[data-hud="katman"]'),
    param: hudEl.querySelector('[data-hud="param"]'),
    giris: hudEl.querySelector('[data-hud="giris"]'),
    cikis: hudEl.querySelector('[data-hud="cikis"]'),
    not: hudEl.querySelector('[data-hud="not"]'),
  };

  /* palet token'ları (fallback: obsidian-champagne ailesi) */
  const css = getComputedStyle(figure);
  const tok = (name, fb) => (css.getPropertyValue(name) || '').trim() || fb;
  const palette = {
    canvas: tok('--color-canvas', '#0b0c10'),
    ink: tok('--color-ink', '#e9e4d8'),
    muted: tok('--color-muted', '#9a938a'),
    accent: tok('--color-accent', '#d9b877'),
    data1: tok('--color-data-1', '#8fb8dd'),
    data2: tok('--color-data-2', '#d78f6c'),
    rule: tok('--color-rule', '#3a3c42'),
    blok: tok('--color-surface', '#22242c'),
  };
  /* ml-layer-blocks paleti (donmuş anahtarlar) + yer tutucuların okuduğu anahtarlar */
  const blokPalet = {
    body: tok('--color-blok', '#2e323c'), panel: tok('--color-blok-panel', '#141821'),
    accent: palette.accent, metal: palette.muted,
    blok: tok('--color-blok', '#2e323c'), data1: palette.data1, data2: palette.data2,
    ink: palette.ink, rule: palette.rule,
  };
  const TUR_RENK = {
    input: palette.data1, conv: palette.accent, pool: palette.muted,
    activation: palette.data2, norm: palette.data1, flatten: palette.muted,
    dense: palette.data1, attention: palette.data2, residual: palette.accent,
    output: palette.accent,
  };

  /* -------- render altyapısı */
  const renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.canvas);
  scene.fog = new THREE.Fog(new THREE.Color(palette.canvas), 26, 78);
  /* uzun objektif (dar fov + uzak kamera): 11 bloklu dizide perspektif
     kısalması azalır, uçtaki bloklar da okunur kalır — sinematik tercih */
  const camera = new THREE.PerspectiveCamera(33, 1, .05, 400);
  camera.position.set(-6, 4, 10);

  /* tek ışık mantığı: bir anahtar + yarıküre dolgu + hafif karşı ışık */
  const anahtar = new THREE.DirectionalLight('#fff4e2', 2.9);
  anahtar.position.set(3.5, 8, 9);
  scene.add(anahtar);
  const karsi = new THREE.DirectionalLight('#9fc2e4', 1.05);   /* kenar ayırıcı */
  karsi.position.set(-7, 3.2, -6);
  scene.add(karsi);
  scene.add(new THREE.HemisphereLight('#8ea4bd', '#181b22', 1.05));
  scene.add(new THREE.AmbientLight('#48505f', .75));

  /* -------- zemin ızgarası: sabit, sessiz, derinlik referansı */
  const zemin = new THREE.Group();
  scene.add(zemin);
  {
    const gm = new THREE.LineBasicMaterial({ color: new THREE.Color(palette.rule), transparent: true, opacity: .2, depthWrite: false });
    const pts = [];
    for (let k = -14; k <= 60; k++) { pts.push(new THREE.Vector3(k, -1.42, -12), new THREE.Vector3(k, -1.42, 12)); }
    for (let k = -12; k <= 12; k++) { pts.push(new THREE.Vector3(-14, -1.42, k), new THREE.Vector3(60, -1.42, k)); }
    zemin.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), gm));
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomOn = options.bloom ?? true;
  if (bloomOn) composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .42, .62, 1.05));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enabled = false;

  const resolution = new THREE.Vector2(2, 2);
  const lineMaterials = [];
  const makeLineMat = opts => {
    const { opacity = 1, ...rest } = opts;
    const m = new LineMaterial({ worldUnits: false, depthWrite: false, transparent: true, ...rest });
    m.uniforms.opacity.value = opacity;
    m.resolution = resolution;
    lineMaterials.push(m);
    return m;
  };
  const setLineOpacity = (m, v) => { m.uniforms.opacity.value = v; };

  /* -------- ekran-uzayı etiketleri */
  const labels = [];
  const _proj = new THREE.Vector3();
  function addCard(html, cls = 'net-builder__card') {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    labelLayer.appendChild(el);
    const item = { el, world: new THREE.Vector3(), opacity: 0, det: 0, detEl: el.querySelector('.det') };
    labels.push(item);
    return item;
  }
  function projectLabels() {
    const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
    for (const item of labels) {
      if (item.opacity <= .012) { item.el.style.opacity = '0'; continue; }
      _proj.copy(item.world).project(camera);
      if (_proj.z > 1) { item.el.style.opacity = '0'; continue; }
      item.el.style.opacity = String(item.opacity);
      item.el.style.left = `${(_proj.x * .5 + .5) * w}px`;
      item.el.style.top = `${(-_proj.y * .5 + .5) * h}px`;
      if (item.detEl) item.detEl.style.opacity = String(item.det);
    }
  }

  /* ---------------------------------------------------------------- durum */
  const state = {
    t: 0, playing: false, active: options.active ?? true,
    hud: true, camMode: options.cam || 'yonetmen', camTransition: null, camSnap: true,
    cikisW: 0,          /* varış çekimi ağırlığı: katman kartları geri çekilir (yumuşak) */
    yonetmenFaz: null, odak: null, durakT: null,
    kurulumSonu: 1, sure: 1, adimSayisi: 0,
  };
  const stats = { advanceMs: 0 };
  let sonuc = null;               /* son başarılı cikarim() sonucu */
  let net = null;                 /* sahnedeki ağ (gruplar, tensörler, etiketler) */
  let hataEl = null;

  /* -------- blok modülü: dinamik, yumuşak bağımlılık */
  let blokModul = null, blokDenendi = false, blokKaynak = 'yer tutucu';
  async function getBlokModul() {
    if (blokDenendi) return blokModul;
    blokDenendi = true;
    try {
      const url = new URL(bloklarUrl, import.meta.url).href;
      const mod = await import(/* @vite-ignore */ url);
      const eksik = Object.values(BLOK_FN).filter(fn => typeof mod[fn] !== 'function');
      if (eksik.length === Object.keys(BLOK_FN).length) throw new Error('beklenen dışa aktarımlar yok');
      blokModul = mod;
      blokKaynak = eksik.length ? `ml-layer-blocks (${eksik.length} tür yer tutucu)` : 'ml-layer-blocks';
      console.info(`net-builder: blok modülü bağlandı — ${blokKaynak}`);
    } catch (e) {
      blokModul = null;
      blokKaynak = 'yer tutucu';
      console.info('net-builder: ml-layer-blocks bulunamadı, yer tutucu bloklarla devam ediliyor —', e.message);
    }
    return blokModul;
  }
  async function blokYap(katman) {
    /* blokPalet: ml-layer-blocks'un DONMUŞ palet anahtarları (body/panel/accent/metal)
       deste token'larından türetilir; yer tutucu kurucular da aynı nesneyi okur */
    const args = {
      ...katman.blokArgs, scale: katman.olcek, palette: blokPalet,
      girisSekli: katman.girisSekli || katman.cikisSekli,
      ...(katman.spec.dolgu != null ? { dolgu: katman.spec.dolgu } : {}),
    };
    const mod = await getBlokModul();
    const fn = mod && mod[BLOK_FN[katman.tur]];
    if (typeof fn === 'function') {
      try {
        const g = await fn(args);
        if (g && g.isObject3D) return { grup: g, yerTutucu: false };
        console.warn(`net-builder: ${BLOK_FN[katman.tur]} Object3D döndürmedi, yer tutucuya düşüldü`);
      } catch (e) {
        console.warn(`net-builder: ${BLOK_FN[katman.tur]} hata verdi (${e.message}), yer tutucuya düşüldü`);
      }
    }
    return { grup: yerTutucuBlok(katman.tur, args), yerTutucu: true };
  }

  /* -------- malzeme toplayıcı: giriş animasyonu ve "işleniyor" vurgusu için */
  function toplaMalzeme(grup, vurguRenk) {
    const list = [];
    const gorulen = new Set();       /* malzemeler blok içinde PAYLAŞILIR — bir kez kaydet */
    grup.traverse(o => {
      if (!o.isMesh && !o.isLine && !o.isLineSegments) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || gorulen.has(m)) continue;
        gorulen.add(m);
        m.transparent = true;
        m.depthWrite = true;
        const kayit = { m, taban: m.opacity ?? 1 };
        if (m.emissive) {
          /* siyah emissive'i vurgu rengine çeviriyoruz ama TABAN ŞİDDET 0 —
             boştayken görüntü DEĞİŞMEZ (ml-layer-blocks "sıfır emissive"
             sözleşmesi korunur), vurgu yalnız şiddet rampasıyla gelir */
          if (m.emissive.getHex() === 0) {
            m.emissive.set(vurguRenk);
            kayit.tabanEmissive = 0;
          } else {
            kayit.tabanEmissive = m.emissiveIntensity ?? 1;
          }
          m.emissiveIntensity = kayit.tabanEmissive;
        }
        list.push(kayit);
      }
    });
    return list;
  }

  /* -------- tensör dilimi: iki blok arasındaki AKTİVASYON HACMİ */
  function tensorYap(sekil, renk, enBuyukAlan, enBuyukKanal, enBuyukVektor) {
    const g = new THREE.Group();
    let sy, sz, sx, etiket;
    if (sekil.length === 3) {
      const [H, W, C] = sekil;
      sy = .22 + .78 * Math.sqrt(H / enBuyukAlan);
      sz = .22 + .78 * Math.sqrt(W / enBuyukAlan);
      sx = .1 + .62 * (Math.log2(C + 1) / Math.log2(enBuyukKanal + 1));
      etiket = `${H}×${W}×${C}`;
    } else if (sekil.length === 2) {
      const [T, D] = sekil;
      sy = .3 + .7 * Math.sqrt(T / Math.max(T, 1));
      sz = .18 + .62 * Math.sqrt(D / Math.max(enBuyukVektor, 1));
      sx = .3;
      etiket = `${T}×${D}`;
    } else {
      const D = sekil[0];
      sy = .18 + .82 * Math.sqrt(D / Math.max(enBuyukVektor, 1));
      sz = .1;
      sx = .18;
      etiket = `${nfTR.format(D)}`;
    }
    const c = new THREE.Color(renk);
    const govdeMat = new THREE.MeshStandardMaterial({
      color: c, transparent: true, opacity: 0, roughness: .35, metalness: .15,
      depthWrite: false, emissive: c.clone(), emissiveIntensity: 0,
    });
    const govde = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), govdeMat);
    const kenarMat = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false });
    const kenar = new THREE.LineSegments(new THREE.EdgesGeometry(govde.geometry), kenarMat);
    g.add(govde, kenar);
    /* kanal dilimleri: hacmin derinliğini okutur (en çok 5 düzlem) */
    const dilimler = [];
    if (sekil.length === 3 && sekil[2] > 1) {
      const n = Math.min(5, sekil[2]);
      for (let k = 0; k < n; k++) {
        const dm = new THREE.MeshBasicMaterial({
          color: c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
        });
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(sz * .93, sy * .93), dm);
        pl.rotation.y = Math.PI / 2;
        pl.position.x = -sx / 2 + (sx * (k + .5)) / n;
        g.add(pl);
        dilimler.push(dm);
      }
    }
    /* işleme süpürmesi: darbe geçerken hacmin içinden ilerleyen parlak düzlem */
    const supMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.ink), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    supMat.toneMapped = false;
    const supurge = new THREE.Mesh(new THREE.PlaneGeometry(sz * 1.02, sy * 1.02), supMat);
    supurge.rotation.y = Math.PI / 2;
    g.add(supurge);
    return { grup: g, govdeMat, kenarMat, dilimler, supMat, supurge, sx, sy, sz, etiket };
  }

  /* -------- ağı kur (görünmez ağaç → animasyonla belirir) */
  function temizleAg() {
    if (!net) return;
    scene.remove(net.kok);
    net.kok.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) m.dispose();
    });
    for (const l of net.etiketler) {
      l.el.remove();
      const idx = labels.indexOf(l);
      if (idx >= 0) labels.splice(idx, 1);
    }
    net = null;
  }
  function hataGoster(mesaj, baslik = 'Mimari hatası') {
    if (!hataEl) {
      hataEl = document.createElement('div');
      hataEl.className = 'net-builder__hata';
      figure.appendChild(hataEl);
    }
    hataEl.innerHTML = `<b>${baslik}</b>${mesaj}`;
    hataEl.hidden = false;
  }
  function hataGizle() { if (hataEl) hataEl.hidden = true; }

  async function kur(mimari) {
    const cozum = cikarim(mimari);       /* hata fırlatırsa çağıran yakalar */
    hataGizle();
    temizleAg();
    sonuc = cozum;

    const kok = new THREE.Group();
    scene.add(kok);
    const katmanlar = cozum.katmanlar;
    const n = katmanlar.length;
    /* ölçek referansları: tensör hacimleri BİRBİRİNE göre okunur */
    let enBuyukAlan = 1, enBuyukKanal = 1, enBuyukVektor = 1;
    for (const k of katmanlar) {
      const s = k.cikisSekli;
      if (s.length === 3) { enBuyukAlan = Math.max(enBuyukAlan, s[0], s[1]); enBuyukKanal = Math.max(enBuyukKanal, s[2]); }
      else if (s.length === 2) { enBuyukVektor = Math.max(enBuyukVektor, s[1]); }
      else enBuyukVektor = Math.max(enBuyukVektor, s[0]);
    }

    const bloklar = [];
    let imlec = 0;
    for (let i = 0; i < n; i++) {
      const katman = katmanlar[i];
      const { grup, yerTutucu } = await blokYap(katman);
      /* TUZAK: Box3.setFromObject DÜNYA uzayında ölçer — grup HENÜZ hiçbir
         ebeveyne eklenmedi ve dönüşümü birim, dolayısıyla ölçüm YEREL. */
      grup.updateMatrixWorld(true);
      const kutu = new THREE.Box3().setFromObject(grup);
      const boy = kutu.getSize(new THREE.Vector3());
      const kalinlik = Math.max(.12, Number.isFinite(boy.x) ? boy.x : .25 * katman.olcek);
      const yuksek = Math.max(.3, Number.isFinite(boy.y) ? boy.y : katman.olcek);

      const yuva = new THREE.Group();          /* animasyon çerçevesi (blok içeriğine dokunmaz) */
      yuva.add(grup);
      const x = imlec + kalinlik / 2;
      const anaGrup = new THREE.Group();
      anaGrup.position.x = x;
      anaGrup.add(yuva);
      kok.add(anaGrup);
      imlec = x + kalinlik / 2 + ARALIK;

      const renk = TUR_RENK[katman.tur] || palette.accent;
      const malzemeler = toplaMalzeme(grup, renk);
      for (const m of malzemeler) m.m.opacity = 0;

      /* iniş halkası: blok yerine oturduğunda rayda yayılan şok dalgası */
      const halkaMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(renk), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      halkaMat.toneMapped = false;
      const halka = new THREE.Mesh(new THREE.RingGeometry(.42, .5, 48), halkaMat);
      halka.rotation.x = -Math.PI / 2;
      halka.position.set(x, RAY_Y + .01, 0);
      kok.add(halka);

      /* etiket kartı: ad + şekil geçişi + formül + parametre */
      const kart = addCard(
        `<b>${katman.ad}</b><span class="det">`
        + `<span class="sekil">${katman.girisSekli ? sekilStr(katman.girisSekli) + ' → ' : ''}${sekilStr(katman.cikisSekli)}</span>`
        + (katman.formulSekil ? `<span class="formul">${katman.formulSekil}</span>` : '')
        + `<span class="par">${katman.parametre ? nfTR.format(katman.parametre) + ' parametre' : (katman.detay || 'parametresiz')}</span>`
        + `</span>`);
      /* kartlar sırayla yukarı/aşağı kaydırılır — uzun dizide üst üste binmez */
      kart.world.set(x, yuksek / 2 + .46 + (i % 2) * .52, 0);

      bloklar.push({
        katman, anaGrup, yuva, grup, malzemeler, kart, halka, halkaMat,
        x, kalinlik, yuksek, renk, yerTutucu,
        x0: x - kalinlik / 2, x1: x + kalinlik / 2,
      });
    }

    /* tensör hacimleri: her bloğun ÇIKIŞI, sonraki bloğa kadarki boşlukta */
    const tensorler = [];
    for (let i = 0; i < n; i++) {
      const b = bloklar[i];
      const sonraki = bloklar[i + 1];
      const merkez = sonraki ? (b.x1 + sonraki.x0) / 2 : b.x1 + ARALIK / 2;
      const t = tensorYap(b.katman.cikisSekli, b.renk, enBuyukAlan, enBuyukKanal, enBuyukVektor);
      t.grup.position.set(merkez, 0, 0);
      kok.add(t.grup);
      const etiket = addCard(`<b>${t.etiket}</b>`, 'net-builder__tag');
      etiket.world.set(merkez, -(t.sy / 2) - .34, 0);
      tensorler.push({ ...t, merkez, etiket, blok: b });
    }

    /* ray: ağın omurgası — bloklar geldikçe uzar (dashSize ile parametrik) */
    const rayNoktalar = [];
    const rayBas = -.8, raySon = imlec - ARALIK + .8;
    for (let k = 0; k <= 64; k++) rayNoktalar.push(rayBas + (k / 64) * (raySon - rayBas), RAY_Y, 0);
    const rayGeo = new LineGeometry();
    rayGeo.setPositions(rayNoktalar);
    const rayMat = makeLineMat({ color: new THREE.Color(palette.rule), linewidth: 2.2, opacity: .85, dashed: true });
    rayMat.dashSize = 1e-6;
    rayMat.gapSize = 1e6;
    const ray = new Line2(rayGeo, rayMat);
    ray.computeLineDistances();
    kok.add(ray);
    const rayUzunluk = raySon - rayBas;

    /* artık bağlantı kemerleri: kaynak bloğun üstünden hedefe quadratik yay */
    const kemerler = [];
    for (const b of bloklar) {
      if (b.katman.tur !== 'residual' || b.katman.kaynak == null) continue;
      const kaynak = bloklar[b.katman.kaynak];
      const y0 = kaynak.yuksek / 2 + .12, y1 = b.yuksek / 2 + .12;
      const tepe = Math.max(y0, y1) + 1.5;
      const pts = [];
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        const px = kaynak.x * (1 - u) ** 2 + ((kaynak.x + b.x) / 2) * 2 * u * (1 - u) + b.x * u * u;
        const py = y0 * (1 - u) ** 2 + tepe * 2 * u * (1 - u) + y1 * u * u;
        pts.push(px, py, 0);
      }
      const geo = new LineGeometry();
      geo.setPositions(pts);
      const mat = makeLineMat({ color: new THREE.Color(palette.accent), linewidth: 3.4, opacity: 0, dashed: true });
      let toplamUz = 0;
      for (let k = 3; k < pts.length; k += 3) {
        toplamUz += Math.hypot(pts[k] - pts[k - 3], pts[k + 1] - pts[k - 2], pts[k + 2] - pts[k - 1]);
      }
      mat.dashSize = 1e-6; mat.gapSize = Math.max(1, toplamUz * 4);
      const line = new Line2(geo, mat);
      line.computeLineDistances();
      kok.add(line);
      const etiket = addCard(`<b>⊕ atlama</b>`, 'net-builder__tag');
      etiket.world.set((kaynak.x + b.x) / 2, tepe + .3, 0);
      kemerler.push({ blok: b, mat, toplam: toplamUz, etiket });
    }

    /* çıkış: softmax çubukları (yalnız output katmanı softmax/sigmoid ise) */
    let softmax = null;
    const sonKatman = katmanlar[n - 1];
    if (sonKatman.tur === 'output') {
      const K = sonKatman.cikisSekli[sonKatman.cikisSekli.length - 1];
      const gosterilen = Math.min(K, 12);
      const rand = mulberry32(seed * 7919 + K);
      const logits = Array.from({ length: gosterilen }, () => rand() * 1.7 - .3);
      const kazanan = logits.indexOf(Math.max(...logits));
      logits[kazanan] += 1.75;      /* net ama TEK BAŞINA olmayan kazanan: rakip
                                       sınıflar da görünür kalsın (çubuklar okunur) */
      const ex = logits.map(v => Math.exp(v));
      const s = ex.reduce((a, b2) => a + b2, 0);
      const p = ex.map(v => v / s);
      const x = bloklar[n - 1].x1 + ARALIK * 1.55;
      const cubuklar = [];
      const genislik = .185, bosluk = .075;
      const z0 = -((gosterilen - 1) * (genislik + bosluk)) / 2;
      for (let k = 0; k < gosterilen; k++) {
        const yuk = Math.max(.02, p[k] * 2.15);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(k === kazanan ? palette.accent : palette.data1),
          transparent: true, opacity: 0, roughness: .4, metalness: .2,
          emissive: new THREE.Color(k === kazanan ? palette.accent : palette.data1), emissiveIntensity: 0,
        });
        const m = new THREE.Mesh(new THREE.BoxGeometry(genislik, 1, genislik), mat);
        m.position.set(x, RAY_Y, z0 + k * (genislik + bosluk));
        m.scale.y = 1e-4;
        kok.add(m);
        cubuklar.push({ mesh: m, mat, yuk, p: p[k], kazanan: k === kazanan });
      }
      const etiket = addCard(
        `<b>sınıf ${kazanan}</b><span class="det"><span class="par">%${(p[kazanan] * 100).toFixed(1)}</span></span>`);
      etiket.world.set(x, cubuklar[kazanan].yuk - 1.15, z0 + kazanan * (genislik + bosluk));
      softmax = { cubuklar, x, etiket, kazanan, p };
    }

    /* darbe: ileri geçişte akan enerji */
    const darbeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    darbeMat.toneMapped = false;
    const darbe = new THREE.Mesh(new THREE.SphereGeometry(.075, 18, 12), darbeMat);
    kok.add(darbe);
    const izMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    izMat.toneMapped = false;
    /* dalga cephesi: ince halka — sözleşme gereği enerji GENİŞ ve SÖNÜK
       yayılır; parlak küçük nokta bloom piramidinde titrer */
    const iz = new THREE.Mesh(new THREE.TorusGeometry(.3, .016, 10, 44), izMat);
    iz.rotation.y = Math.PI / 2;
    kok.add(iz);

    /* darbe yolu: bloklarda YAVAŞLAR (işleniyor), boşlukta hızlanır */
    const yol = [];
    for (let i = 0; i < n; i++) {
      const b = bloklar[i];
      yol.push({ tur: 'blok', i, x0: b.x0 - .06, x1: b.x1 + .06, agirlik: 1.75 });
      const sonrakiX = i + 1 < n ? bloklar[i + 1].x0 - .06 : (softmax ? softmax.x : b.x1 + ARALIK);
      yol.push({ tur: 'bosluk', i, x0: b.x1 + .06, x1: sonrakiX, agirlik: 1 });
    }
    let agirlikTop = 0;
    for (const seg of yol) { seg.bas = agirlikTop; agirlikTop += seg.agirlik; }
    for (const seg of yol) { seg.bas /= agirlikTop; seg.son = seg.bas + seg.agirlik / agirlikTop; }

    net = {
      kok, bloklar, tensorler, ray, rayMat, rayUzunluk, kemerler, softmax,
      darbe, darbeMat, iz, izMat, yol,
      etiketler: [...bloklar.map(b => b.kart), ...tensorler.map(t => t.etiket),
        ...kemerler.map(k => k.etiket), ...(softmax ? [softmax.etiket] : [])],
      uzunluk: raySon - rayBas, x0: rayBas, x1: raySon,
    };

    state.adimSayisi = n;
    state.kurulumSonu = n * ADIM_SURE + KURULUM_KUYRUK;
    state.sure = state.kurulumSonu + ILERI_SURE;
    state.odak = null;
    state.t = 0;
    state.camSnap = true;
    state.camTransition = null;
    state.yonetmenFaz = null;
    guncelleHud();
    stepVisuals();
    render();
    return cozum;
  }

  /* -------- kurulum ilerlemesi: t → kaç blok yerleşti (kesirli, C0) */
  function kurulumIlerleme(t) {
    return clamp01(t / Math.max(1e-6, state.adimSayisi * ADIM_SURE)) * state.adimSayisi;
  }
  function aktifAdim(t) {
    return Math.min(state.adimSayisi - 1, Math.floor(t / ADIM_SURE));
  }

  /* -------- darbe konumu: yol segmentlerinden (bloklarda yavaş) */
  function darbeKonum(f) {
    if (!net || !net.yol.length) return { x: 0, seg: null, u: 0 };
    const u = clamp01(f);
    let seg = net.yol[net.yol.length - 1];
    for (const s of net.yol) { if (u >= s.bas && u <= s.son) { seg = s; break; } }
    const lokal = clamp01((u - seg.bas) / Math.max(1e-9, seg.son - seg.bas));
    /* blok içinde ortada yavaşlayan hız profili (C1): u + k·sin(2πu)/2π */
    const k = seg.tur === 'blok' ? .8 : -.35;
    const e = clamp01(lokal + (k * Math.sin(TAU * lokal)) / TAU);
    return { x: seg.x0 + e * (seg.x1 - seg.x0), seg, u: lokal };
  }

  /* ---------------------------------------------------------------- kare */
  const _v1 = new THREE.Vector3();
  function stepVisuals() {
    if (!net) return;
    const t = state.t;
    const kurulum = kurulumIlerleme(t);
    const ileriF = state.sure > state.kurulumSonu
      ? clamp01((t - state.kurulumSonu) / (state.sure - state.kurulumSonu)) : 0;
    const ileriAktif = t > state.kurulumSonu;

    /* ray: kurulan uzunluğa kadar çizili */
    const rayHedef = net.x0 + (kurulum / Math.max(1, state.adimSayisi)) * net.uzunluk;
    net.rayMat.dashSize = Math.max(1e-5, rayHedef - net.x0 + .0001);
    setLineOpacity(net.rayMat, .85);

    /* darbe */
    let darbeX = 0, darbeSeg = null, darbeU = 0, darbeG = 0;
    if (ileriAktif) {
      const yolF = clamp01((ileriF - .05) / .68);
      const konum = darbeKonum(yolF);
      darbeX = konum.x; darbeSeg = konum.seg; darbeU = konum.u;
      /* darbe görünürlüğü iki uçtan sıfıra rampalanır → döngü dikişi görünmez */
      darbeG = windowFn(ileriF, .02, .08, .70, .78);
    }
    net.darbe.position.set(darbeX, 0, 0);
    net.darbeMat.opacity = darbeG * .5;
    net.darbe.scale.setScalar(.85 + .12 * Math.sin(t * 6.2) * darbeG + .2 * darbeG);
    net.iz.position.set(darbeX, 0, 0);
    net.izMat.opacity = darbeG * .32;
    net.iz.scale.setScalar(.9 + .55 * darbeG);

    /* bloklar */
    for (let i = 0; i < net.bloklar.length; i++) {
      const b = net.bloklar[i];
      const yerel = clamp01((t - i * ADIM_SURE) / ADIM_SURE);
      const gelis = clamp01(yerel / .55);
      const opak = smooth01(yerel / .3);
      const otur = easeOutBack(easeOutCubic(gelis));
      /* çok özellikli iniş: yükseklik + derinlik + yalpa + ölçek + opaklık */
      b.yuva.position.y = (1 - otur) * 3.1;
      b.yuva.position.z = (1 - otur) * -1.6;
      b.yuva.rotation.y = (1 - otur) * .85;
      b.yuva.rotation.z = (1 - otur) * -.22;
      const olc = .82 + .18 * otur;
      b.yuva.scale.setScalar(olc);

      /* "işleniyor" vurgusu: darbe bu bloğun içindeyken */
      let isleme = 0;
      if (ileriAktif && darbeSeg && darbeSeg.tur === 'blok' && darbeSeg.i === i) {
        isleme = smooth01(darbeU / .28) * (1 - smooth01((darbeU - .72) / .28)) * darbeG;
      }
      const odakli = state.odak === i ? 1 : 0;
      for (const m of b.malzemeler) {
        m.m.opacity = m.taban * opak;
        if (m.tabanEmissive != null) {
          m.m.emissiveIntensity = m.tabanEmissive + isleme * 1.35 + odakli * .25;
        }
      }
      b.yuva.scale.setScalar(olc * (1 + .055 * isleme));

      /* iniş halkası: oturma ânında yayılıp söner */
      const halkaW = windowFn(yerel, .42, .5, .58, .95);
      b.halkaMat.opacity = halkaW * .5;
      b.halka.scale.setScalar(.35 + 1.5 * smooth01((yerel - .45) / .45));

      /* kart: kendi adımında tam, sonra sakin ada */
      const kartO = smooth01((yerel - .3) / .3);
      const sonra = smooth01((t - (i * ADIM_SURE + ADIM_SURE * 1.35)) / (ADIM_SURE * .8));
      /* kart: kendi adımında AD + şekil + formül + parametre; sonra yalnız ad
         kalır (11 katmanlı dizide hepsi açık kalırsa metin metne biner),
         odaklanınca ya da darbe içinden geçerken ayrıntı geri gelir */
      const sonBlok = i === net.bloklar.length - 1;
      b.kart.opacity = kartO * (1 - .18 * sonra) * (1 + .18 * odakli * sonra)
        * (sonBlok ? 1 : 1 - .93 * state.cikisW);
      b.kart.det = Math.max(kartO * (1 - sonra), odakli, isleme);
    }

    /* tensör hacimleri */
    for (let i = 0; i < net.tensorler.length; i++) {
      const tn = net.tensorler[i];
      const yerel = clamp01((t - (i * ADIM_SURE + ADIM_SURE * .5)) / (ADIM_SURE * .55));
      const bel = smooth01(yerel);
      tn.grup.scale.set(Math.max(1e-3, bel), Math.max(1e-3, .18 + .82 * bel), Math.max(1e-3, .18 + .82 * bel));
      let gecis = 0;
      if (ileriAktif && darbeSeg && darbeSeg.tur === 'bosluk' && darbeSeg.i === i) {
        gecis = smooth01(darbeU / .3) * (1 - smooth01((darbeU - .6) / .4)) * darbeG;
      }
      tn.govdeMat.opacity = bel * (.2 + .3 * gecis);
      tn.govdeMat.emissiveIntensity = gecis * .7;
      tn.kenarMat.opacity = bel * (.72 + .28 * gecis);
      for (const dm of tn.dilimler) dm.opacity = bel * (.13 + .26 * gecis);
      tn.supMat.opacity = gecis * .5;
      tn.supurge.position.x = (-tn.sx / 2 + tn.sx * clamp01(darbeU)) || 0;
      /* varış çekiminde ara şekil etiketleri de geri çekilir (son hariç) */
      const sonTensor = i === net.tensorler.length - 1;
      tn.etiket.opacity = bel * (.55 + .45 * gecis) * (sonTensor ? 1 : 1 - .9 * state.cikisW);
    }

    /* artık kemerleri: blok yerleştiğinde çizilir */
    for (const kem of net.kemerler) {
      const i = kem.blok.katman.dizin;
      const yerel = clamp01((t - (i * ADIM_SURE + ADIM_SURE * .35)) / (ADIM_SURE * .8));
      const ciz = smooth01(yerel);
      kem.mat.dashSize = Math.max(1e-5, ciz * kem.toplam);
      setLineOpacity(kem.mat, ciz * (.95 - .2 * smooth01((t - (i + 1.6) * ADIM_SURE) / ADIM_SURE)));
      kem.etiket.opacity = ciz * (.9 - .45 * smooth01((t - (i + 1.6) * ADIM_SURE) / ADIM_SURE));
    }

    /* softmax çubukları */
    if (net.softmax) {
      const bas = .70, son = .93;
      const acil = ileriAktif ? clamp01((ileriF - bas) / (son - bas)) : 0;
      const sonFade = 1 - smooth01((ileriF - .94) / .06);
      for (let k = 0; k < net.softmax.cubuklar.length; k++) {
        const c = net.softmax.cubuklar[k];
        const gecikme = k * .05;
        const f = smooth01((acil - gecikme) / Math.max(1e-6, 1 - gecikme)) * sonFade;
        c.mesh.scale.y = Math.max(1e-4, c.yuk * f);
        c.mesh.position.y = RAY_Y + (c.yuk * f) / 2;
        c.mat.opacity = f * .95;
        c.mat.emissiveIntensity = c.kazanan ? f * .8 : f * .12;
      }
      const kz = net.softmax.cubuklar[net.softmax.kazanan];
      net.softmax.etiket.world.y = RAY_Y + kz.mesh.scale.y + .34;
      net.softmax.etiket.opacity = smooth01((acil - .35) / .4) * sonFade;
      net.softmax.etiket.det = net.softmax.etiket.opacity;
    }

    guncelleHud(kurulum, ileriAktif, darbeSeg);
  }

  /* -------- HUD + faz şeridi */
  function guncelleHud(kurulum = null, ileriAktif = false, darbeSeg = null) {
    if (!sonuc) return;
    const n = sonuc.katmanlar.length;
    const ilerleme = kurulum == null ? kurulumIlerleme(state.t) : kurulum;
    const yerlesen = Math.min(n, Math.floor(ilerleme + 1e-6));
    /* HUD sayaçları kurulumla birlikte SAYAR — parametre bütçesi büyür */
    let param = 0, durgun = 0;
    for (let i = 0; i < yerlesen; i++) { param += sonuc.katmanlar[i].parametre; durgun += sonuc.katmanlar[i].durgun; }
    if (state.hud) {
      hudFields.katman.textContent = `${yerlesen} / ${n}`;
      hudFields.param.textContent = nfTR.format(param);
      hudFields.giris.textContent = sekilStr(sonuc.girisSekli);
      hudFields.cikis.textContent = yerlesen >= n ? sekilStr(sonuc.cikisSekli) : '—';
      hudFields.not.textContent = durgun
        ? `+${nfTR.format(durgun)} durgun · ${blokKaynak}`
        : `${blokKaynak} blokları`;
    }
    /* faz şeridi HUD sayacıyla AYNI katmanı göstermeli: adım sınırında
       tamamlanan blok, adım ortasında gelmekte olan blok */
    const aktif = Math.min(n - 1, Math.max(0, Math.ceil(state.t / ADIM_SURE) - 1));
    if (ileriAktif) {
      const ad = darbeSeg ? (darbeSeg.tur === 'blok'
        ? `<b>${sonuc.katmanlar[darbeSeg.i].ad}</b> işleniyor`
        : `${sekilStr(sonuc.katmanlar[darbeSeg.i].cikisSekli)} aktivasyonu akıyor`) : 'ileri geçiş';
      fazEl.innerHTML = `İleri geçiş · ${ad}`;
    } else {
      const k = sonuc.katmanlar[aktif];
      fazEl.innerHTML = `Kurulum <b>${aktif + 1}/${n}</b> · ${k.ad}`
        + (k.parametre ? ` · ${nfTR.format(k.parametre)} parametre` : '');
    }
  }

  /* -------- kamera yönetmeni */
  const camState = {
    pos: new THREE.Vector3(), look: new THREE.Vector3(),
    fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(),
  };
  function cerceveMesafe(uzunluk) {
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(.4, camera.aspect));
    return Math.max(4.2, (uzunluk * .56) / Math.tan(hfov / 2));
  }
  /* küresel çerçeve: az = +Z'den Y ekseni çevresinde açı, el = yükselti.
     az≈0 → dizinin KARŞISINDAN bakış (dizi ekranda yatay uzanır). */
  function kureden(look, az, el, d, out) {
    out.set(
      look.x + d * Math.sin(az) * Math.cos(el),
      look.y + d * Math.sin(el),
      look.z + d * Math.cos(az) * Math.cos(el));
  }
  function istenenKamera(mode, out) {
    const varsayilanMerkez = net ? (net.x0 + net.x1) / 2 : 0;
    if (!net) { out.pos.copy(camera.position); out.look.set(0, 0, 0); return; }
    if (mode === 'katman') {
      const i = state.odak != null ? state.odak : aktifAdim(state.t);
      const b = net.bloklar[Math.min(net.bloklar.length - 1, Math.max(0, i))];
      const son = i >= net.bloklar.length - 1 && net.softmax;
      const az = -.52, el = .26, d = son ? 5.4 : 3.9;
      out.look.set(son ? (b.x + net.softmax.x) / 2 : b.x + .5, .05, 0);
      kureden(out.look, az, el, d, out.pos);
      return;
    }
    if (mode === 'cikis' && net.softmax) {
      /* varış çekimi: kamera dizinin ÖTESİNE geçip geriye bakar — softmax
         çubukları ekran boyunca yan yana dizilir, ağ arkalarında uzar */
      const sx = net.softmax.x;
      out.look.set(sx - .35, RAY_Y + .95, .12);
      out.pos.set(sx + 3.95, RAY_Y + 1.62, .12);   /* tam karşıdan: çubuklar yan yana ve ORTALI okunur */
      return;
    }
    if (mode === 'akis') {
      /* omuz üstü: darbenin biraz gerisinde, akış yönüne bakar */
      const ileriF = clamp01((state.t - state.kurulumSonu) / Math.max(1e-6, state.sure - state.kurulumSonu));
      const x = state.t > state.kurulumSonu
        ? darbeKonum(clamp01((ileriF - .05) / .68)).x
        : net.x0 + kurulumIlerleme(state.t) / Math.max(1, state.adimSayisi) * net.uzunluk;
      out.pos.set(x - 5.1, 1.65, 3.45);
      out.look.set(x + 3.4, .05, 0);
      return;
    }
    /* genel: kurulan uzunluğu çerçeveler — bloklar geldikçe kamera GERİ ÇEKİLİR */
    const ilerleme = kurulumIlerleme(state.t) / Math.max(1, state.adimSayisi);
    const gorunur = Math.max(3.4, net.uzunluk * Math.max(.28, ilerleme) + 2.2);
    const merkez = state.t >= state.kurulumSonu
      ? varsayilanMerkez
      : net.x0 + gorunur / 2 - 1.1;
    const az = -.30 + .05 * Math.sin(state.t * .07);        /* çok yavaş, amaçlı salınım */
    const el = .30;
    const d = cerceveMesafe(gorunur);
    out.look.set(merkez, .2, 0);
    kureden(out.look, az, el, d, out.pos);
  }
  function yonetmenModu() {
    /* kurulum boyunca ve darbe yokken GENEL; yalnız darbe akarken omuz üstü.
       (t == kurulumSonu tablosu — dışa aktarım karesi — kurulmuş ağın genel
       görünümüdür; sınır '<=' olmalı, yoksa tablo akış kamerasına düşer.) */
    if (!net) return 'genel';
    if (state.t <= state.kurulumSonu + 1e-6) return 'genel';
    const ileriF = clamp01((state.t - state.kurulumSonu) / Math.max(1e-6, state.sure - state.kurulumSonu));
    if (ileriF > .04 && ileriF < .72) return 'akis';
    if (ileriF >= .72 && net.softmax) return 'cikis';    /* varış: çıkış dağılımı */
    return 'genel';
  }
  const _dc = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  function updateCamera(dtReal) {
    if (state.camMode === 'serbest') { controls.enabled = true; controls.update(); return; }
    controls.enabled = false;
    let mode = state.camMode;
    if (mode === 'yonetmen') {
      const m = yonetmenModu();
      if (m !== state.yonetmenFaz) {
        if (state.yonetmenFaz != null && !state.camSnap) {
          state.camTransition = { duration: 1500, elapsed: 0, fromPos: camera.position.clone(), fromLook: camState.look.clone() };
        }
        state.yonetmenFaz = m;
      }
      mode = m;
    }
    /* varış çekiminde ara katman kartları geri çekilir — yoksa hepsi
       ekranın sol üstünde üst üste biner. Ağırlık YUMUŞAK ilerler (C0). */
    const cikisHedef = mode === 'cikis' ? 1 : 0;
    state.cikisW = (state.camSnap || dtReal <= 1e-6) ? cikisHedef
      : state.cikisW + (cikisHedef - state.cikisW) * (1 - Math.exp(-3.2 * dtReal));
    istenenKamera(mode, _dc);
    const tr = state.camTransition;
    if (tr) {
      tr.elapsed += dtReal * 1000;
      const f = easeInOut(clamp01(tr.elapsed / tr.duration));
      camera.position.lerpVectors(tr.fromPos, _dc.pos, f);
      camState.look.lerpVectors(tr.fromLook, _dc.look, f);
      if (f >= 1) state.camTransition = null;
    } else if (state.camSnap) {
      camera.position.copy(_dc.pos);
      camState.look.copy(_dc.look);
      state.camSnap = false;
    } else {
      const k = state.camMode === 'katman' ? 3.4 : 2.6;
      const alpha = 1 - Math.exp(-k * dtReal);
      camera.position.lerp(_dc.pos, alpha);
      camState.look.lerp(_dc.look, alpha);
    }
    camera.lookAt(camState.look);
    controls.target.copy(camState.look);
  }
  const cameraApi = {
    mode(m) { if (m !== state.camMode) this.transitionTo(m, { duration: 900 }); },
    transitionTo(m, { duration = 1400 } = {}) {
      if (m === 'serbest') {
        controls.target.copy(camState.look);
        state.camMode = 'serbest'; state.camTransition = null;
        return;
      }
      state.camMode = m;
      state.yonetmenFaz = null;
      if (duration <= 0) { state.camTransition = null; state.camSnap = true; return; }
      state.camTransition = {
        duration: Math.max(1, duration), elapsed: 0,
        fromPos: camera.position.clone(), fromLook: camState.look.clone(),
      };
    },
    get current() { return state.camMode; },
  };

  /* -------- zaman çizelgesi */
  const timeline = {
    play() { state.durakT = null; state.playing = true; ensureLoop(); },
    pause() { state.playing = false; state.durakT = null; },
    scrub(t) {
      state.t = Math.min(state.sure, Math.max(0, t));
      state.camSnap = true; state.camTransition = null;
      state.yonetmenFaz = null;
      stepVisuals(); render();
    },
    get t() { return state.t; },
    set t(v) { this.scrub(v); },
    get playing() { return state.playing; },
    get duration() { return state.sure; },
    get kurulumSonu() { return state.kurulumSonu; },
  };

  /* -------- render + adımlama */
  function render() {
    projectLabels();
    if (bloomOn) composer.render(); else renderer.render(scene, camera);
  }
  function advance(dtReal) {
    const p0 = performance.now();
    if (state.playing) {
      state.t += dtReal;
      if (state.durakT != null && state.t >= state.durakT) {
        state.t = state.durakT; state.durakT = null; state.playing = false;
      } else if (state.t >= state.sure) {
        /* ileri geçiş döngüsü: darbe iki uçta da sıfır opaklıkta → dikiş görünmez */
        state.t = state.kurulumSonu + (state.t - state.sure);
      }
    }
    stepVisuals();
    updateCamera(dtReal);
    render();
    stats.advanceMs = stats.advanceMs * .92 + (performance.now() - p0) * .08;
  }
  let frame = null;
  const clock = new THREE.Clock();
  function loop() {
    frame = null;
    if (!state.active || document.hidden) return;
    const dt = Math.min(.1, clock.getDelta());
    advance(dt);
    frame = requestAnimationFrame(loop);
  }
  function ensureLoop() {
    if (!state.active || document.hidden) return;
    if (frame === null) { clock.getDelta(); frame = requestAnimationFrame(loop); }
  }
  const onVisibility = () => ensureLoop();
  document.addEventListener('visibilitychange', onVisibility);

  function resize() {
    const w = Math.max(2, canvasHost.clientWidth);
    const h = Math.max(2, canvasHost.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resolution.set(w, h);
    for (const m of lineMaterials) m.resolution = resolution;
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  resize();

  /* -------- ilk mimari */
  const ilkMimari = options.mimari || ORNEK_MIMARILER.cnn.mimari;
  try {
    await kur(ilkMimari);
  } catch (e) {
    if (e instanceof MimariHatasi) hataGoster(e.message);
    else throw e;
  }
  hudEl.hidden = !(options.hud ?? true);
  state.hud = options.hud ?? true;
  fazEl.hidden = false;
  guncelleHud();

  const otomatik = !reducedMotion && !exportMode && (options.autoplay ?? true);
  if (otomatik) state.playing = true;
  else { state.t = state.kurulumSonu; state.camSnap = true; stepVisuals(); }
  ensureLoop();
  render();

  const api = {
    figure, palette, stats, timeline, camera: cameraApi,
    get sonuc() { return sonuc; },
    get blokKaynak() { return blokKaynak; },
    get reducedMotion() { return reducedMotion; },
    get exportMode() { return exportMode; },
    get adimSayisi() { return state.adimSayisi; },
    async kur(mimari) {
      try {
        const r = await kur(mimari);
        if (!reducedMotion && !exportMode && (options.autoplay ?? true)) { state.playing = true; ensureLoop(); }
        else { state.t = state.kurulumSonu; stepVisuals(); render(); }
        return r;
      } catch (e) {
        if (e instanceof MimariHatasi) {
          hataGoster(e.message);
          throw e;
        }
        throw e;
      }
    },
    /* bir sonraki bloğu getir: hedefe kadar OYNAT (animasyon korunur) */
    adim() {
      if (!net) return;
      const i = Math.min(state.adimSayisi - 1, Math.floor(state.t / ADIM_SURE + 1e-6));
      const hedef = Math.min(state.kurulumSonu, (i + 1) * ADIM_SURE);
      if (state.t >= state.kurulumSonu - 1e-6) { this.ileri(); return; }
      state.durakT = hedef;
      state.playing = true;
      ensureLoop();
      return i + 1;
    },
    /* i. bloğun kurulduğu ana ışınlan (deterministik, animasyonsuz) */
    git(i) {
      const k = Math.min(state.adimSayisi, Math.max(0, Math.round(i)));
      timeline.scrub(Math.min(state.kurulumSonu, k * ADIM_SURE));
      return k;
    },
    ileri() {
      timeline.scrub(state.kurulumSonu + .02);
      state.playing = true;
      state.durakT = null;
      ensureLoop();
    },
    odakla(i) {
      state.odak = i == null ? null : Math.min(state.adimSayisi - 1, Math.max(0, Math.round(i)));
      stepVisuals(); render();
    },
    hud(on) { state.hud = Boolean(on); hudEl.hidden = !state.hud; fazEl.hidden = !state.hud; guncelleHud(); },
    advance,
    renderNow: render,
    setActive(v) {
      state.active = Boolean(v);
      if (!state.active && frame !== null) { cancelAnimationFrame(frame); frame = null; }
      ensureLoop();
    },
    hataGoster, hataGizle,
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      temizleAg();
      controls.dispose();
      renderer.dispose();
      figure.remove();
    },
  };
  return api;
}
