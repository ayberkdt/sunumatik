/* ml_conv_vision — "bir görüntü nasıl işlenir" filmi.
   Evrişimli görü (CNN) sahnesi: 2B tuval (Canvas 2D), three.js YOK.

   DOĞRULUK DÜZEYİ: SAYISAL. Ekranda görünen her sayı çalışma anında
   CPU'da hesaplanır — evrişim doğrudan uzamsal çapraz-korelasyondur
   (CNN'lerdeki gibi çekirdek ÇEVRİLMEZ), stride/padding dahil; havuzlama
   gerçek pencere indirgemesidir; ReLU max(0,x); softmax exp/Σexp.
   Önceden pişirilmiş görüntü, doku ya da sayı yoktur.

   Rastgelelik: yalnızca mulberry32 (sabit tohum). Math.random ve Date.now
   KULLANILMAZ — tüm kareler ve tüm sayılar her çalıştırmada birebir aynıdır.

   Sunum tekniği — neden 2B tuval:
   Evrişim özünde bir PİKSEL IZGARASI işlemidir ve anlatının yükü
   SAYILARDIR (yamadaki 9 değer, çekirdek katsayıları, çarpım-toplam,
   çıktı boyutu formülü). Perspektif projeksiyon bu hücreleri kısaltır ve
   rakamları okunmaz kılar; bu yüzden haritalar dik açıdan, 1:1 ölçekli
   2B çizilir. Derinlik anlatısı (katman yığını) tek yerde gerekir, orada
   da AYNI tuval içinde aksonometrik (eğik) kart yığını kullanılır — karma
   çözüm: haritalar 2B, yığın 2.5B. WebGL bağımlılığı, shader ve NaN riski
   yok; export karesi tek `draw(t)` çağrısıyla birebir yeniden üretilir.

   API:
     mountConvVision(host, options) → { play, pause, restart, advance, seek,
       setStage, setFilter, setStride, setPad, setImage, renderNow, state,
       setActive, dispose }
   Matematik dışa aktarılır (Node'dan denetlenebilir, DOM'a dokunmaz):
     mulberry32, makeImage, KERNELS, BANK, DEEP_KERNELS, outSize, convolve,
     convolveMulti, pool, relu, softmax, histogram, classify, buildPipeline
*/

/* =====================================================================
   1. DETERMİNİSTİK KAYNAK
   ===================================================================== */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
};

/* =====================================================================
   2. GÖRÜNTÜ SENTEZİ — dış ağ yok, dosya yok, prosedürel
   ===================================================================== */

export const IMG_N = 28;                       // 28×28: MNIST ölçeği

/* nokta–doğru parçası uzaklığı (kalem darbesi alanı için) */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* Darbeler görüntü koordinatında (0..28). "rakam": el yazısı 4 benzeri —
   bir dikey, bir çapraz, bir yatay darbe; üç yönelim de temsil edilsin diye
   seçildi (Sobel-x, Sobel-y ve çapraz kutular farklı yanıt versin).
   Oranlar bir "4" glifinin olağan oranlarıdır: gövde çubuğun ALTINA iner ve
   en uzun darbedir (22,8 px; çapraz 18,3; çubuk 18,6) — sınıflandırıcının
   "Dikey kenar" kararı bu görünür olguyu yansıtır, kurgu değildir.
   Denenen dört oran arasından bu seçildi: daha kısa gövdeyle karar iki sınıf
   arasında beraberliğe düşüyor (%45'e %45), daha kısa çaprazla ise şekil
   artık 4'e benzemiyordu. */
export const STROKES = {
  rakam: [
    [18.2, 2.4, 18.2, 25.6],    // dikey gövde (en uzun darbe)
    [18.2, 2.4, 6.6, 17.2],     // çapraz kol
    [5.4, 17.2, 24.0, 17.2],    // yatay çubuk
  ],
};

/* Görüntü değerleri 0..1. Kenarlar kenar-yumuşatmalı (yumuşak geçiş):
   ikili maske olsaydı Sobel yanıtı iki değere çökerdi. */
export function makeImage(kind = 'rakam') {
  const n = IMG_N;
  const data = new Float64Array(n * n);
  const rnd = mulberry32(kind === 'desen' ? 0x5A17 : 0x4D07);

  if (kind === 'desen') {
    /* geometrik desen: dikey şerit + yatay şerit + halka + çapraz bant.
       Dört yapı sınıfının hepsini aynı karede taşır. */
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const cx = x + .5, cy = y + .5;
        let v = 0;
        // dikey şeritler (sol üst blok), periyot 4 px
        if (cx > 2.5 && cx < 12.5 && cy > 2.5 && cy < 11.5) {
          v = Math.max(v, .5 + .5 * Math.cos(2 * Math.PI * cx / 4));
        }
        // yatay şeritler (sağ üst blok)
        if (cx > 15.5 && cx < 25.5 && cy > 2.5 && cy < 11.5) {
          v = Math.max(v, .5 + .5 * Math.cos(2 * Math.PI * cy / 4));
        }
        // halka (sol alt)
        const dr = Math.abs(Math.hypot(cx - 8.5, cy - 19.5) - 5.2);
        v = Math.max(v, smoothstep(1.9, .5, dr));
        // çapraz bant (sağ alt)
        v = Math.max(v, smoothstep(2.0, .7, segDist(cx, cy, 16.5, 15.0, 25.0, 24.5)));
        data[y * n + x] = clamp(v + (rnd() - .5) * .05, 0, 1);
      }
    }
    return { w: n, h: n, data, kind };
  }

  const strokes = STROKES.rakam;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = x + .5, cy = y + .5;
      let v = 0;
      for (const s of strokes) {
        const d = segDist(cx, cy, s[0], s[1], s[2], s[3]);
        v = Math.max(v, smoothstep(2.15, .55, d));   // ~1.6 px yarıçap, yumuşak kenar
      }
      data[y * n + x] = clamp(v + (rnd() - .5) * .05, 0, 1);
    }
  }
  return { w: n, h: n, data, kind: 'rakam' };
}

/* =====================================================================
   3. ÇEKİRDEKLER — adı olan klasikler + tohumlu "öğrenilmiş gibi"
   ===================================================================== */

/* not: gauss ölçeği 1/16 → ağırlık toplamı 1 (sabit bölgede değeri korur);
   diğer kenar çekirdeklerinin toplamı 0 (sabit bölgede yanıt sıfır). */
export const KERNELS = {
  'sobel-x': {
    id: 'sobel-x', ad: 'Sobel-x', yakalar: 'dikey kenar',
    w: [-1, 0, 1, -2, 0, 2, -1, 0, 1], scale: 1 / 4, tur: 'adli',
    not: 'yatay türev → DİKEY kenarlarda büyük yanıt',
  },
  'sobel-y': {
    id: 'sobel-y', ad: 'Sobel-y', yakalar: 'yatay kenar',
    w: [-1, -2, -1, 0, 0, 0, 1, 2, 1], scale: 1 / 4, tur: 'adli',
    not: 'dikey türev → YATAY kenarlarda büyük yanıt',
  },
  'sobel-d': {
    id: 'sobel-d', ad: 'Sobel-çapraz', yakalar: 'çapraz kenar',
    w: [-2, -1, 0, -1, 0, 1, 0, 1, 2], scale: 1 / 4, tur: 'adli',
    not: '45° yönünde türev',
  },
  laplacian: {
    id: 'laplacian', ad: 'Laplace', yakalar: 'nokta ve halka',
    w: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1 / 4, tur: 'adli',
    not: 'ikinci türev → yönden bağımsız kenar/nokta',
  },
  gauss: {
    id: 'gauss', ad: 'Gauss bulanıklığı', yakalar: 'düşük frekans',
    w: [1, 2, 1, 2, 4, 2, 1, 2, 1], scale: 1 / 16, tur: 'adli',
    not: 'ağırlık toplamı 1 → parlaklığı korur, gürültüyü bastırır',
  },
  keskin: {
    id: 'keskin', ad: 'Keskinleştirme', yakalar: 'yerel karşıtlık',
    w: [0, -1, 0, -1, 5, -1, 0, -1, 0], scale: 1 / 1, tur: 'adli',
    not: 'birim + Laplace → kenarları abartır',
  },
  kose: {
    id: 'kose', ad: 'Köşe maskesi', yakalar: 'köşe / kesişim',
    w: [1, -2, 1, -2, 4, -2, 1, -2, 1], scale: 1 / 4, tur: 'adli',
    not: 'çapraz ikinci türev → düz kenarda sönük, köşede güçlü',
  },
};

/* "Öğrenilmiş gibi" çekirdekler: tohumlu PRNG ile üretilir, ortalaması
   sıfırlanır (DC bileşeni yok — gerçek eğitilmiş ilk katman filtreleri de
   büyük ölçüde sıfır ortalamalıdır), sonra |w| toplamı 4'e ölçeklenir ki
   adlı çekirdeklerle karşılaştırılabilir büyüklükte yanıt versinler.
   EĞİTİLMİŞ DEĞİLDİR — yalnızca eğitilmiş filtre istatistiğini taklit eder. */
function learnedKernel(seed, ad, yakalar) {
  const rnd = mulberry32(seed);
  const raw = Array.from({ length: 9 }, () => rnd() * 2 - 1);
  const mean = raw.reduce((a, b) => a + b, 0) / 9;
  const zero = raw.map(v => v - mean);
  const l1 = zero.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const w = zero.map(v => (v * 4) / l1);
  return {
    id: `ogr-${seed}`, ad, yakalar, w, scale: 1, tur: 'ogrenilmis',
    not: 'tohumlu (mulberry32) sabit — eğitilmiş değil, eğitilmiş görünümlü',
  };
}

export const LEARNED = [
  learnedKernel(20260814, 'Öğrenilmiş gibi F1', 'karışık doku'),
  learnedKernel(70177, 'Öğrenilmiş gibi F2', 'yönlü doku'),
];

/* Sahnenin öznitelik bankası (1. katman, 6 filtre). İlk DÖRDÜ sınıflandırıcıyı
   besler; sıra anlatının sırasıdır (dikey → yatay → çapraz → nokta → düşük
   frekans → doku). */
export const BANK = [
  KERNELS['sobel-x'], KERNELS['sobel-y'], KERNELS['sobel-d'],
  KERNELS.laplacian, KERNELS.gauss, LEARNED[0],
];

/* Kayan pencere sahnesinde seçilebilen filtreler */
export const FILTER_LIST = [
  KERNELS['sobel-x'], KERNELS['sobel-y'], KERNELS.laplacian,
  KERNELS.gauss, KERNELS.keskin, KERNELS.kose, LEARNED[0], LEARNED[1],
];

/* 2. katman: 3×3×6 (çok kanallı) çekirdekler — kanal boyunca TOPLAR.
   Yine tohumlu sabitler; eğitilmiş değil. */
export const DEEP_KERNELS = Array.from({ length: 6 }, (_, i) => {
  const rnd = mulberry32(0xC0FFEE + i * 977);
  const ch = Array.from({ length: BANK.length }, () => {
    const raw = Array.from({ length: 9 }, () => rnd() * 2 - 1);
    const mean = raw.reduce((a, b) => a + b, 0) / 9;
    return raw.map(v => v - mean);
  });
  const l1 = ch.flat().reduce((a, b) => a + Math.abs(b), 0) || 1;
  return {
    id: `L2-${i + 1}`, ad: `K2·${i + 1}`,
    ch: ch.map(k => k.map(v => (v * 6) / l1)),
  };
});

/* =====================================================================
   4. İŞLEMLER — hepsi gerçek, hepsi burada
   ===================================================================== */

/* Çıktı boyutu formülü. Ekranda da bu formül gösterilir. */
export function outSize(n, k, stride, pad) {
  return Math.floor((n + 2 * pad - k) / stride) + 1;
}

/* Doğrudan uzamsal ÇAPRAZ-KORELASYON (CNN kuralı: çekirdek çevrilmez).
   Dolgu sıfır-dolgudur (zero padding). float64 birikim, FFT yok. */
export function convolve(src, kernel, opts = {}) {
  const stride = opts.stride ?? 1;
  const pad = opts.pad ?? 0;
  const k = 3;
  const { w, h, data } = src;
  const ow = outSize(w, k, stride, pad);
  const oh = outSize(h, k, stride, pad);
  const out = new Float64Array(Math.max(0, ow * oh));
  const scale = kernel.scale ?? 1;
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      let sum = 0;
      for (let ky = 0; ky < k; ky++) {
        const iy = oy * stride - pad + ky;
        if (iy < 0 || iy >= h) continue;             // sıfır dolgu
        for (let kx = 0; kx < k; kx++) {
          const ix = ox * stride - pad + kx;
          if (ix < 0 || ix >= w) continue;
          sum += data[iy * w + ix] * kernel.w[ky * k + kx];
        }
      }
      out[oy * ow + ox] = sum * scale;
    }
  }
  return { w: ow, h: oh, data: out };
}

/* Tek çıktı pikselinin ayrıntısı — kayan pencere panelindeki 9 çarpım.
   convolve ile AYNI kuralı kullanır; panel ile harita asla ayrışamaz. */
export function tapDetail(src, kernel, ox, oy, opts = {}) {
  const stride = opts.stride ?? 1;
  const pad = opts.pad ?? 0;
  const { w, h, data } = src;
  const taps = [];
  let sum = 0;
  for (let ky = 0; ky < 3; ky++) {
    for (let kx = 0; kx < 3; kx++) {
      const iy = oy * stride - pad + ky;
      const ix = ox * stride - pad + kx;
      const inside = ix >= 0 && ix < w && iy >= 0 && iy < h;
      const v = inside ? data[iy * w + ix] : 0;
      const kw = kernel.w[ky * 3 + kx];
      sum += v * kw;
      taps.push({ kx, ky, ix, iy, inside, v, kw, urun: v * kw });
    }
  }
  const scale = kernel.scale ?? 1;
  return { taps, ham: sum, scale, deger: sum * scale };
}

/* Çok kanallı evrişim: kanal boyunca TOPLAR (2. katman). */
export function convolveMulti(maps, kernel, opts = {}) {
  const stride = opts.stride ?? 1;
  const pad = opts.pad ?? 0;
  const k = 3;
  const { w, h } = maps[0];
  const ow = outSize(w, k, stride, pad);
  const oh = outSize(h, k, stride, pad);
  const out = new Float64Array(Math.max(0, ow * oh));
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      let sum = 0;
      for (let c = 0; c < maps.length; c++) {
        const src = maps[c].data;
        const kw = kernel.ch[c];
        for (let ky = 0; ky < k; ky++) {
          const iy = oy * stride - pad + ky;
          if (iy < 0 || iy >= h) continue;
          for (let kx = 0; kx < k; kx++) {
            const ix = ox * stride - pad + kx;
            if (ix < 0 || ix >= w) continue;
            sum += src[iy * w + ix] * kw[ky * k + kx];
          }
        }
      }
      out[oy * ow + ox] = sum;
    }
  }
  return { w: ow, h: oh, data: out };
}

/* Havuzlama: 'max' ya da 'ort'. Dolgu yok (CNN geleneği). */
export function pool(src, opts = {}) {
  const size = opts.size ?? 2;
  const stride = opts.stride ?? size;
  const mode = opts.mode ?? 'max';
  const { w, h, data } = src;
  const ow = Math.floor((w - size) / stride) + 1;
  const oh = Math.floor((h - size) / stride) + 1;
  const out = new Float64Array(Math.max(0, ow * oh));
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      let best = -Infinity, sum = 0, n = 0;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const v = data[(oy * stride + dy) * w + (ox * stride + dx)];
          if (v > best) best = v;
          sum += v; n++;
        }
      }
      out[oy * ow + ox] = mode === 'max' ? best : sum / n;
    }
  }
  return { w: ow, h: oh, data: out };
}

export const relu = src => ({
  w: src.w, h: src.h,
  data: Float64Array.from(src.data, v => (v > 0 ? v : 0)),
});

export function softmax(scores) {
  const m = Math.max(...scores);
  const exps = scores.map(v => Math.exp(v - m));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / total);
}

export function histogram(data, bins, lo, hi) {
  const out = new Array(bins).fill(0);
  const span = (hi - lo) || 1;
  for (let i = 0; i < data.length; i++) {
    const b = clamp(Math.floor(((data[i] - lo) / span) * bins), 0, bins - 1);
    out[b]++;
  }
  return out;
}

const maxAbs = src => {
  let m = 0;
  for (let i = 0; i < src.data.length; i++) {
    const a = Math.abs(src.data[i]);
    if (a > m) m = a;
  }
  return m || 1;
};
const meanAbs = src => {
  let s = 0;
  for (let i = 0; i < src.data.length; i++) s += Math.abs(src.data[i]);
  return s / (src.data.length || 1);
};

/* --------- küresel havuzlama: gradyan YÖNELİM histogramı ---------
   Neden tek tek filtre enerjileri DEĞİL: çapraz Sobel, dikey bir kenara da
   maksimumunun %75'i kadar yanıt verir (tek bir doğrusal filtre yönelime
   SEÇİCİ olamaz) — bu yüzden "çapraz" kutusu her şeyi toplardı. Doğru
   büyüklük, iki dik bileşenin ORANIDIR: klasik gradyan yönelim histogramı
   (HOG ailesi, 4 kutu). gx ve gy zaten 1. katmanın Sobel-x / Sobel-y
   haritalarıdır — yeni bir model değil, aynı özniteliklerin okunması.

   Piksel başına: m = √(gx² + gy²);  KENAR yönelimi φ = atan2(gy, gx) + 90°,
   [0°, 180°) aralığına indirgenir (y aşağı yönlü görüntü koordinatı).
   m < %6·m_max olan pikseller sayılmaz (gürültü tabanı — düz bölgelerde
   yönelim tanımsızdır). Her piksel en yakın kutuya m ağırlığıyla girer. */
export const ORI_BINS = [
  { ad: 'Dikey kenar', merkez: 90 },
  { ad: 'Yatay kenar', merkez: 0 },
  { ad: 'Çapraz kenar /', merkez: 135 },
  { ad: 'Çapraz kenar \\', merkez: 45 },
];
export const ORI_FLOOR = 0.06;

export function orientationEnergy(gx, gy, floorRatio = ORI_FLOOR) {
  let mmax = 0;
  const n = gx.data.length;
  const mag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const m = Math.hypot(gx.data[i], gy.data[i]);
    mag[i] = m;
    if (m > mmax) mmax = m;
  }
  const esik = mmax * floorRatio;
  const bins = [0, 0, 0, 0];
  let sayilan = 0;
  for (let i = 0; i < n; i++) {
    const m = mag[i];
    if (m < esik) continue;
    let phi = Math.atan2(gy.data[i], gx.data[i]) * 180 / Math.PI + 90;
    phi = ((phi % 180) + 180) % 180;
    let best = 0, bestD = Infinity;
    for (let b = 0; b < 4; b++) {
      let d = Math.abs(phi - ORI_BINS[b].merkez);
      if (d > 90) d = 180 - d;                       // dairesel mesafe (mod 180°)
      if (d < bestD) { bestD = d; best = b; }
    }
    bins[best] += m;
    sayilan++;
  }
  return { bins, mag, mmax, esik, sayilan, toplam: bins.reduce((a, b) => a + b, 0) };
}

/* Sınıflandırıcı: yönelim histogramı → normalize (toplam 1) → ELLE KURULMUŞ
   (eğitilmemiş) doğrusal başlık → softmax. Ağırlıklar köşegen baskındır:
   her sınıf kendi kutusunu okur, diğerlerini bastırır. Bu bir eğitim sonucu
   DEĞİLDİR ve ekranda öyle yazar. */
export const CLASSES = ORI_BINS.map(b => b.ad);
export const HEAD_W = [
  [3.2, -0.9, -0.7, -0.7],
  [-0.9, 3.2, -0.7, -0.7],
  [-0.8, -0.8, 3.2, -0.6],
  [-0.8, -0.8, -0.6, 3.2],
];
export const HEAD_B = [0, 0, 0, 0];
export const HEAD_T = 7;     // sıcaklık: kararı okunur kılan ölçek

export function classify(gx, gy) {
  const ori = orientationEnergy(gx, gy);
  const feats = ori.bins;
  const total = feats.reduce((a, b) => a + b, 0) || 1;
  const norm = feats.map(v => v / total);
  const scores = HEAD_W.map((row, c) =>
    (row.reduce((s, wv, i) => s + wv * norm[i], 0) + HEAD_B[c]) * HEAD_T);
  const probs = softmax(scores);
  return { ori, feats, norm, scores, probs, kazanan: probs.indexOf(Math.max(...probs)) };
}

/* Alıcı alan (receptive field): rf ve atlama (jump) katman katman büyür.
   rf ← rf + (k−1)·j ; j ← j·s  — her aşama için gerçek hesap. */
export function receptiveField(layers) {
  let rf = 1, j = 1;
  const out = [];
  for (const l of layers) {
    rf += (l.k - 1) * j;
    j *= l.s;
    out.push({ ...l, rf, j });
  }
  return out;
}

export const PIPELINE_LAYERS = [
  { ad: 'Evrişim 1 (3×3, s1)', k: 3, s: 1 },
  { ad: 'Havuz 1 (2×2, s2)', k: 2, s: 2 },
  { ad: 'Evrişim 2 (3×3×6, s1)', k: 3, s: 1 },
  { ad: 'Havuz 2 (2×2, s2)', k: 2, s: 2 },
];

/* Tüm boru hattı. Ağır kısımlar (bank, derin katman) girdi başına bir kez
   hesaplanır ve önbelleğe alınır; kayan pencere haritası stride/padding/
   filtre değişince yeniden hesaplanır. */
const pipeCache = new Map();

export function buildPipeline(opts = {}) {
  const image = opts.image ?? 'rakam';
  const key = image;
  let base = pipeCache.get(key);
  if (!base) {
    const img = makeImage(image);
    const bank = BANK.map(k => convolve(img, k, { stride: 1, pad: 0 }));
    const bankRelu = bank.map(relu);
    const bankPool = bankRelu.map(m => pool(m, { size: 2, stride: 2, mode: 'max' }));
    const deep = DEEP_KERNELS.map(k => convolveMulti(bankPool, k, { stride: 1, pad: 0 }));
    const deepRelu = deep.map(relu);
    const deepPool = deepRelu.map(m => pool(m, { size: 2, stride: 2, mode: 'max' }));
    const poolSrc = bankRelu[0];
    const havuzMax = pool(poolSrc, { size: 2, stride: 2, mode: 'max' });
    const havuzOrt = pool(poolSrc, { size: 2, stride: 2, mode: 'ort' });
    const reluSrc = bank[0];
    let negatif = 0;
    for (const v of reluSrc.data) if (v < 0) negatif++;
    base = {
      img, bank, bankRelu, bankPool, deep, deepRelu, deepPool,
      poolSrc, havuzMax, havuzOrt, reluSrc,
      negatifOran: negatif / reluSrc.data.length,
      /* karar 1. katmanın gx (Sobel-x) ve gy (Sobel-y) haritalarından okunur */
      karar: classify(bank[0], bank[1]),
      rf: receptiveField(PIPELINE_LAYERS),
    };
    pipeCache.set(key, base);
  }
  return base;
}

export { maxAbs, meanAbs, clamp, smoothstep };

/* =====================================================================
   5. SAHNE — buradan aşağısı DOM'a dokunur
   ===================================================================== */

const VW = 1920, VH = 1080;
const SANS = '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

export const STAGES = [
  {
    id: 'goruntu', ad: 'Görüntü', dur: 8,
    baslik: 'Görüntü bir sayı ızgarasıdır',
    iddia: 'Ağ resmi görmez: 28 × 28 = 784 parlaklık değeri okur.',
  },
  {
    id: 'kaydir', ad: 'Kayan pencere', dur: 30,
    baslik: 'Çekirdek görüntünün üzerinde kayar',
    iddia: 'Her çıktı pikseli, 3 × 3 yamanın çekirdekle çarpım-toplamıdır.',
  },
  {
    id: 'haritalar', ad: 'Haritalar', dur: 16,
    baslik: 'Her filtre başka bir yapıyı yakalar',
    iddia: 'Aynı görüntü, altı çekirdekle altı farklı öznitelik haritası verir.',
  },
  {
    id: 'havuz', ad: 'Havuzlama', dur: 14,
    baslik: 'Havuzlama küçültür — ve seçer',
    iddia: 'Maksimum havuzlama tepeyi korur, ortalama havuzlama onu seyreltir.',
  },
  {
    id: 'relu', ad: 'ReLU', dur: 12,
    baslik: 'ReLU negatifleri keser',
    iddia: 'max(0, x): değerlerin bir kısmı tam olarak sıfıra düşer.',
  },
  {
    id: 'derin', ad: 'Derin', dur: 14,
    baslik: 'Derinleştikçe alıcı alan büyür',
    iddia: '2. katmanın bir hücresi girdide 10 × 10 piksellik bölgeyi görür.',
  },
  {
    id: 'karar', ad: 'Karar', dur: 14,
    baslik: 'Öznitelikler karara dönüşür',
    iddia: 'Küresel havuzlama → doğrusal başlık → softmax: sayılar gerçek hesaptan.',
  },
];

const STAGE_START = (() => {
  let t = 0;
  return STAGES.map(s => { const st = t; t += s.dur; return st; });
})();
export const TOTAL_DUR = STAGE_START[STAGES.length - 1] + STAGES[STAGES.length - 1].dur;

/* ---------- renk yardımcıları ---------- */

const hex2rgb = h => {
  const s = h.trim().replace('#', '');
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rampAt = (ramp, t) => {
  const x = clamp(t, 0, 1) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  return mix(ramp[i], ramp[i + 1], x - i);
};

const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const fmt = (v, d = 2) => {
  const s = v.toFixed(d);
  return s.replace('-', '−').replace('.', ',');
};
const fmtK = v => {
  if (Number.isInteger(v)) return String(v).replace('-', '−');
  return fmt(v, 2);
};

export function mountConvVision(host, options = {}) {
  if (!host) throw new Error('mountConvVision bir kap elementi ister');

  /* ---------- palet: deste jetonlarını CSS'ten oku ---------- */
  const cs = getComputedStyle(host);
  const tok = (name, fb) => {
    const v = cs.getPropertyValue(name).trim();
    return v || fb;
  };
  const C = {
    canvas: hex2rgb(tok('--color-canvas', '#0F1013')),
    surface: hex2rgb(tok('--color-surface', '#1A1C21')),
    ink: hex2rgb(tok('--color-ink', '#F4EEE1')),
    muted: hex2rgb(tok('--color-muted', '#A9A296')),
    accent: hex2rgb(tok('--color-accent', '#D3B26A')),
    rule: hex2rgb(tok('--color-rule', '#2E3037')),
    d1: hex2rgb(tok('--color-data-1', '#5590C9')),
    d2: hex2rgb(tok('--color-data-2', '#C86A40')),
    d3: hex2rgb(tok('--color-data-3', '#6FBF9A')),
    d4: hex2rgb(tok('--color-data-4', '#A88BD9')),
  };
  const SEQ = [
    hex2rgb(tok('--ramp-seq-1', '#1A1C21')), hex2rgb(tok('--ramp-seq-2', '#4A4030')),
    hex2rgb(tok('--ramp-seq-3', '#7D6A42')), hex2rgb(tok('--ramp-seq-4', '#A88E54')),
    hex2rgb(tok('--ramp-seq-5', '#D3B26A')),
  ];
  const DIV = [
    hex2rgb(tok('--ramp-div-1', '#5590C9')), hex2rgb(tok('--ramp-div-2', '#8A9BAD')),
    hex2rgb(tok('--ramp-div-3', '#3A3B40')), hex2rgb(tok('--ramp-div-4', '#BE8A68')),
    hex2rgb(tok('--ramp-div-5', '#C86A40')),
  ];
  const seqColor = v => rampAt(SEQ, v);
  const divColor = v => rampAt(DIV, (clamp(v, -1, 1) + 1) / 2);

  /* ---------- durum ---------- */
  let image = options.image === 'desen' ? 'desen' : 'rakam';
  let filterId = options.filter && FILTER_LIST.some(k => k.id === options.filter)
    ? options.filter : 'sobel-x';
  let stride = clamp(options.stride ?? 1, 1, 4) | 0;
  let pad = clamp(options.pad ?? 0, 0, 2) | 0;
  let t = 0;
  let playing = false;
  let active = options.active !== false;
  let disposed = false;
  let raf = 0;
  let lastTs = 0;

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exporting = () => document.documentElement.dataset.export === 'true';
  const isStatic = () => reduced() || exporting();

  let P = buildPipeline({ image });
  const filterOf = () => FILTER_LIST.find(k => k.id === filterId) || FILTER_LIST[0];
  let heroCache = null;
  const hero = () => {
    const key = `${image}|${filterId}|${stride}|${pad}`;
    if (!heroCache || heroCache.key !== key) {
      const map = convolve(P.img, filterOf(), { stride, pad });
      heroCache = { key, map, mA: maxAbs(map) };
    }
    return heroCache;
  };

  /* ---------- tuval ---------- */
  host.classList.add('cvp');
  host.dataset.ownsArrows = '';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    'Evrişimli görü sahnesi: 28×28 prosedürel görüntü üzerinde 3×3 çekirdeğin ' +
    'kayması, öznitelik haritaları, havuzlama, ReLU, derin katman yığını ve ' +
    'softmax kararı — bütün sayılar çalışma anında hesaplanır.');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  const status = document.createElement('p');
  status.className = 'cvp-status';
  status.setAttribute('aria-live', 'polite');
  host.appendChild(status);

  let dpr = 1;
  const resize = () => {
    const wCss = host.clientWidth || host.offsetWidth || VW;
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const scale = (wCss / VW) * dpr;
    const bw = Math.round(VW * scale), bh = Math.round(VH * scale);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw; canvas.height = bh;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  };

  /* ---------- küçük çizim yardımcıları ---------- */
  const setFont = (size, weight = 400, mono = false) => {
    ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  };
  const txt = (s, x, y, o = {}) => {
    setFont(o.size ?? 18, o.weight ?? 400, o.mono ?? false);
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.fillStyle = o.fill ?? rgb(C.ink);
    ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
  };
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
  const panel = (x, y, w, h, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgba(C.surface, .55);
    roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = rgba(C.rule, .9); ctx.lineWidth = 1.5;
    roundRect(x, y, w, h, 14); ctx.stroke();
    ctx.globalAlpha = 1;
  };

  /* Haritayı ImageData üzerinden bas: 784 dikdörtgen yerine tek drawImage
     (hız) ve piksel sınırları keskin (imageSmoothingEnabled = false). */
  const bufCache = new Map();
  const mapImage = (map, opts = {}) => {
    const signed = opts.signed !== false;
    const scale = opts.scale ?? (signed ? maxAbs(map) : 1);
    const key = `${opts.key || ''}|${map.w}x${map.h}|${signed}|${scale.toFixed(4)}|${opts.reveal ?? 1}`;
    let entry = bufCache.get(key);
    if (!entry) {
      const cv = document.createElement('canvas');
      cv.width = map.w; cv.height = map.h;
      const c2 = cv.getContext('2d');
      const id = c2.createImageData(map.w, map.h);
      const lim = opts.reveal === undefined ? map.data.length
        : Math.round(clamp(opts.reveal, 0, 1) * map.data.length);
      for (let i = 0; i < map.data.length; i++) {
        const col = i < lim
          ? (signed ? divColor(map.data[i] / scale) : seqColor(map.data[i] / scale))
          : mix(C.canvas, C.surface, .35);
        id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1];
        id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255;
      }
      c2.putImageData(id, 0, 0);
      entry = cv;
      if (bufCache.size > 220) bufCache.clear();
      bufCache.set(key, entry);
    }
    return entry;
  };
  const drawMap = (map, x, y, w, h, opts = {}) => {
    const cv = mapImage(map, opts);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.drawImage(cv, x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = rgba(C.rule, .95); ctx.lineWidth = 1.5;
    ctx.strokeRect(x - .75, y - .75, w + 1.5, h + 1.5);
  };

  /* Hücre hücre ızgara (kahraman ızgaralar): boşluklu, kenarlıklı, sayılı */
  const drawCellGrid = (map, x, y, cell, opts = {}) => {
    const gap = opts.gap ?? 1;
    const signed = opts.signed ?? false;
    const scale = opts.scale ?? (signed ? maxAbs(map) : 1);
    const lim = opts.count === undefined ? map.data.length : opts.count;
    for (let iy = 0; iy < map.h; iy++) {
      for (let ix = 0; ix < map.w; ix++) {
        const i = iy * map.w + ix;
        const cx = x + ix * cell, cy = y + iy * cell;
        if (i >= lim) {
          ctx.fillStyle = rgba(C.canvas, 1);
          ctx.fillRect(cx, cy, cell - gap, cell - gap);
          ctx.strokeStyle = rgba(C.rule, .35); ctx.lineWidth = 1;
          ctx.strokeRect(cx + .5, cy + .5, cell - gap - 1, cell - gap - 1);
          continue;
        }
        const v = map.data[i];
        ctx.fillStyle = rgb(signed ? divColor(v / scale) : seqColor(v));
        ctx.fillRect(cx, cy, cell - gap, cell - gap);
      }
    }
    ctx.strokeStyle = rgba(C.rule, .9); ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 1, y - 1, map.w * cell + 1, map.h * cell + 1);
  };

  /* 3×3 sayı ızgarası (yama / çekirdek panelleri) */
  const numGrid = (x, y, cell, vals, opts = {}) => {
    for (let ky = 0; ky < 3; ky++) {
      for (let kx = 0; kx < 3; kx++) {
        const i = ky * 3 + kx;
        const cx = x + kx * cell, cy = y + ky * cell;
        const item = vals[i];
        ctx.fillStyle = item.bg || rgba(C.surface, .9);
        roundRect(cx + 2, cy + 2, cell - 4, cell - 4, 6); ctx.fill();
        ctx.strokeStyle = item.stroke || rgba(C.rule, 1); ctx.lineWidth = 1.4;
        roundRect(cx + 2, cy + 2, cell - 4, cell - 4, 6); ctx.stroke();
        txt(item.text, cx + cell / 2, cy + cell / 2 + 1, {
          size: opts.size ?? 19, mono: true, weight: 500,
          align: 'center', baseline: 'middle',
          fill: item.fg || rgb(C.ink), alpha: item.alpha ?? 1,
        });
      }
    }
  };

  const arrow = (x1, y1, x2, y2, color, width = 2.5, headLen = 14) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(a - .38), y2 - headLen * Math.sin(a - .38));
    ctx.lineTo(x2 - headLen * Math.cos(a + .38), y2 - headLen * Math.sin(a + .38));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };

  /* ---------- zaman → aşama ---------- */
  const stageIndexAt = time => {
    const tt = clamp(time, 0, TOTAL_DUR - 1e-4);
    let i = 0;
    while (i < STAGES.length - 1 && tt >= STAGE_START[i + 1]) i++;
    return i;
  };

  /* Kayan pencere adım programı: ilk adımlar YAVAŞ (sayılar okunsun),
     sonra ivmelenerek taranır — "kalem gibi başlar, kamera hızlanır".
     Süre uyarlanır: hangi (stride, padding) olursa olsun tarama aşamanın
     %82'sinde biter, kalan süre tamamlanmış haritada durulur. */
  const SLOW_N = 9, SLOW_RATE = 1.15;
  const sweepPlan = () => {
    const m = hero().map;
    const total = m.w * m.h;
    const dur = STAGES[1].dur;
    const t0 = SLOW_N / SLOW_RATE;
    const tEnd = Math.max(t0 + .5, dur * .82);
    const dt = tEnd - t0;
    const a = Math.max(.15, 2 * (total - SLOW_N - SLOW_RATE * dt) / (dt * dt));
    return { total, t0, a };
  };
  const stepAt = u => {
    const { total, t0, a } = sweepPlan();
    if (u <= 0) return 0;
    if (u <= t0) return Math.min(total, u * SLOW_RATE);
    const dt = u - t0;
    return Math.min(total, SLOW_N + SLOW_RATE * dt + .5 * a * dt * dt);
  };
  const rateAt = u => {
    const { t0, a } = sweepPlan();
    return u <= t0 ? SLOW_RATE : SLOW_RATE + a * (u - t0);
  };

  /* =============== ortak çerçeve (başlık, ray, rozet) =============== */
  const drawChrome = (si, u) => {
    const S = STAGES[si];
    ctx.fillStyle = rgb(C.canvas);
    ctx.fillRect(0, 0, VW, VH);

    // üst kural + başlık
    const inA = easeOut(clamp(u / .8, 0, 1));
    txt(S.baslik, 72, 88, { size: 44, weight: 600, alpha: .25 + .75 * inA });
    txt(S.iddia, 72, 130, { size: 22, fill: rgb(C.muted), alpha: .2 + .8 * inA });
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(72, 158); ctx.lineTo(VW - 72, 158); ctx.stroke();

    // aşama rayı (alt): 7 bölüt, geçerli olan vurgulu, ilerleme dolgusu
    const railY = 1006, railX = 72, railW = 880;
    const seg = railW / STAGES.length;
    for (let i = 0; i < STAGES.length; i++) {
      const x = railX + i * seg;
      const on = i === si;
      const done = i < si;
      ctx.fillStyle = rgba(on ? C.accent : (done ? C.muted : C.rule), on ? 1 : (done ? .55 : .9));
      ctx.fillRect(x, railY, seg - 10, 3);
      if (on) {
        const p = clamp(u / S.dur, 0, 1);
        ctx.fillStyle = rgba(C.ink, .85);
        ctx.fillRect(x, railY, (seg - 10) * p, 3);
      }
      txt(STAGES[i].ad, x, railY + 24, {
        size: 14, mono: false, weight: on ? 600 : 400,
        fill: rgb(on ? C.ink : C.muted), alpha: on ? 1 : .65,
      });
    }

    /* Dürüstlük rozeti — rayın SAĞINDA, çakışmadan (ray 72+880 = 952'de biter,
       rozet en fazla ~830 px genişler ve 1848'de biter). */
    const badge = 'SAYISAL · her sayı tarayıcıda gerçek evrişimle hesaplandı · eğitilmiş model yok';
    setFont(15, 500, true);
    const bw = ctx.measureText(badge).width + 28;
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    roundRect(VW - 72 - bw, railY - 12, bw, 34, 17); ctx.stroke();
    txt(badge, VW - 72 - bw / 2, railY + 6, {
      size: 15, mono: true, weight: 500, align: 'center', fill: rgb(C.muted),
    });
  };

  /* =============== 0. AŞAMA: görüntü doğar =============== */
  const drawStageImage = u => {
    const img = P.img;
    const cell = 22, gx = 150, gy = 250;
    const gw = img.w * cell;

    // kalem darbeleri: 0–2.6 sn arasında elle çizilir gibi ilerler
    const drawP = clamp(u / 2.6, 0, 1);
    const quant = clamp((u - 2.4) / 2.2, 0, 1);

    panel(gx - 34, gy - 60, gw + 68, gw + 118);
    txt('Prosedürel girdi · 28 × 28 · gri ton', gx, gy - 26, {
      size: 19, mono: true, fill: rgb(C.muted),
    });

    // hücre ızgarası satır satır belirir (kuantalama)
    for (let iy = 0; iy < img.h; iy++) {
      const rowP = clamp((quant * img.h - iy) / 1.6, 0, 1);
      for (let ix = 0; ix < img.w; ix++) {
        const v = img.data[iy * img.w + ix];
        const x = gx + ix * cell, y = gy + iy * cell;
        ctx.fillStyle = rgb(mix(C.canvas, seqColor(v), rowP));
        ctx.fillRect(x, y, cell - 1, cell - 1);
      }
    }
    // sürekli darbe izi (kuantalama ilerledikçe söner)
    if (drawP > 0 && quant < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - quant) * .9;
      ctx.strokeStyle = rgba(C.accent, .85);
      ctx.lineWidth = 3.2 * cell / 6; ctx.lineCap = 'round';
      const strokes = STROKES.rakam;
      const per = 1 / strokes.length;
      strokes.forEach((s, i) => {
        const sp = clamp((drawP - i * per) / per, 0, 1);
        if (sp <= 0) return;
        ctx.beginPath();
        ctx.moveTo(gx + s[0] * cell, gy + s[1] * cell);
        ctx.lineTo(gx + (s[0] + (s[2] - s[0]) * sp) * cell,
          gy + (s[1] + (s[3] - s[1]) * sp) * cell);
        ctx.stroke();
      });
      ctx.restore();
    }
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    ctx.strokeRect(gx - 1, gy - 1, gw + 1, gw + 1);

    /* Yakınlaştırılmış 6×6 yama: "resim = sayı" ifadesinin kanıtı */
    const zp = clamp((u - 3.6) / 1.6, 0, 1);
    if (zp > 0) {
      const zx = 1000, zy = 250, zc = 104, Z = 6, ox = 14, oy = 13;
      panel(zx - 30, zy - 60, Z * zc + 60, Z * zc + 110, zp);
      ctx.save(); ctx.globalAlpha = zp;
      txt(`Yakınlaştırma · girdi[${oy}…${oy + Z - 1}][${ox}…${ox + Z - 1}]`, zx, zy - 26, {
        size: 19, mono: true, fill: rgb(C.muted),
      });
      for (let j = 0; j < Z; j++) {
        for (let i = 0; i < Z; i++) {
          const v = img.data[(oy + j) * img.w + (ox + i)];
          const x = zx + i * zc, y = zy + j * zc;
          ctx.fillStyle = rgb(seqColor(v));
          ctx.fillRect(x, y, zc - 3, zc - 3);
          const light = v > .55;
          txt(fmt(v, 2), x + (zc - 3) / 2, y + (zc - 3) / 2, {
            size: 23, mono: true, weight: 600, align: 'center', baseline: 'middle',
            fill: rgb(light ? C.canvas : C.ink), alpha: .35 + .65 * zp,
          });
        }
      }
      ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
      ctx.strokeRect(zx - 1, zy - 1, Z * zc + 1, Z * zc + 1);
      txt('0,00 = siyah   ·   1,00 = beyaz   ·   ara değerler kenar yumuşatmasından',
        zx, zy + Z * zc + 38, { size: 18, fill: rgb(C.muted) });
      // kaynak yama çerçevesi
      ctx.strokeStyle = rgba(C.accent, .95); ctx.lineWidth = 3;
      ctx.strokeRect(gx + ox * cell - 2, gy + oy * cell - 2, Z * cell + 3, Z * cell + 3);
      arrow(gx + (ox + Z) * cell + 8, gy + (oy + Z / 2) * cell,
        zx - 44, zy + Z * zc / 2, rgba(C.accent, .9), 3);
      ctx.restore();
    }

    const fp = clamp((u - 5.6) / 1.4, 0, 1);
    if (fp > 0) {
      txt('Bundan sonrasında hiçbir şey "resim" değil: yalnızca bu 784 sayı üzerinde aritmetik.',
        150, 966, { size: 24, fill: rgb(C.accent), alpha: fp });
    }
  };

  /* =============== 1. AŞAMA: kayan pencere =============== */
  const drawStageSlide = u => {
    const K = filterOf();
    const H = hero();
    const map = H.map;
    const img = P.img;
    const s = stepAt(u);
    const idx = Math.min(map.w * map.h - 1, Math.floor(s));
    const frac = s - Math.floor(s);
    const rate = rateAt(u);
    /* 9 çarpımın görünürlüğü: hız arttıkça söner — AMA sahne duraklatılmışsa
       (deterministik kare, ?adim=, dışa aktarım) hep tam görünür: durmuş bir
       karede okunacak vakit vardır, asıl yük de bu sayılardır. */
    const slow = playing ? clamp((6 - rate) / 4, 0, 1) : 1;

    const ox = idx % map.w, oy = Math.floor(idx / map.w);
    const nIdx = Math.min(map.w * map.h - 1, idx + 1);
    const nx = nIdx % map.w, ny = Math.floor(nIdx / map.w);
    // pencere frac 0,45'ten sonra bir sonraki hücreye SÜZÜLÜR (C0 hareket)
    const glide = easeInOut(clamp((frac - .45) / .55, 0, 1));
    const wx = ox + (nx - ox) * glide, wy = oy + (ny - oy) * glide;

    /* --- sol: girdi + dolgu halkası + pencere --- */
    const cell = 16, gx = 88, gy = 236;
    const px0 = gx - pad * cell, py0 = gy - pad * cell;
    panel(px0 - 30, py0 - 58, img.w * cell + 2 * pad * cell + 60, img.w * cell + 2 * pad * cell + 116);
    txt(`Girdi ${img.w}×${img.h}${pad ? `  +  ${pad} piksel sıfır dolgu` : ''}`, px0 - 8, py0 - 26, {
      size: 19, mono: true, fill: rgb(C.muted),
    });
    // dolgu hücreleri (kesikli, boş)
    if (pad > 0) {
      const tot = img.w + 2 * pad;
      ctx.strokeStyle = rgba(C.rule, .8); ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (let iy = 0; iy < tot; iy++) {
        for (let ix = 0; ix < tot; ix++) {
          if (ix >= pad && ix < pad + img.w && iy >= pad && iy < pad + img.h) continue;
          ctx.strokeRect(px0 + ix * cell + .5, py0 + iy * cell + .5, cell - 1.5, cell - 1.5);
        }
      }
      ctx.setLineDash([]);
    }
    for (let iy = 0; iy < img.h; iy++) {
      for (let ix = 0; ix < img.w; ix++) {
        ctx.fillStyle = rgb(seqColor(img.data[iy * img.w + ix]));
        ctx.fillRect(gx + ix * cell, gy + iy * cell, cell - .8, cell - .8);
      }
    }
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    ctx.strokeRect(gx - 1, gy - 1, img.w * cell + 1, img.h * cell + 1);
    // pencere çerçevesi (3×3), süzülen konumda — koyu halka üstüne vurgu
    // (tek çizgi, altındaki açık sarı piksellerde kayboluyordu)
    const fx = px0 + wx * stride * cell, fy = py0 + wy * stride * cell;
    ctx.strokeStyle = rgba(C.canvas, .9); ctx.lineWidth = 8;
    ctx.strokeRect(fx - 2, fy - 2, 3 * cell + 4, 3 * cell + 4);
    ctx.strokeStyle = rgba(C.accent, 1); ctx.lineWidth = 3.5;
    ctx.strokeRect(fx - 2, fy - 2, 3 * cell + 4, 3 * cell + 4);
    ctx.fillStyle = rgba(C.accent, .12);
    ctx.fillRect(fx, fy, 3 * cell, 3 * cell);
    // tarama kılavuzu: pencerenin bulunduğu satır hafifçe aydınlanır
    ctx.fillStyle = rgba(C.accent, .05);
    ctx.fillRect(px0, fy, (img.w + 2 * pad) * cell, 3 * cell);
    txt(`adım ${idx + 1} / ${map.w * map.h}   ·   ${rate < 2.2 ? 'yavaş' : 'hızlandırılmış'} tarama`,
      px0 - 8, py0 + (img.w + 2 * pad) * cell + 38, { size: 18, mono: true, fill: rgb(C.muted) });

    /* --- orta: yama ⊙ çekirdek → 9 çarpım → Σ --- */
    const D = tapDetail(img, K, ox, oy, { stride, pad });
    const mx = 640, my = 214;
    panel(mx - 26, my - 44, 560, 700);
    txt('Bu adımın aritmetiği', mx, my - 12, { size: 19, mono: true, fill: rgb(C.muted) });

    const pc = 74;
    txt('yama', mx, my + 26, { size: 17, fill: rgb(C.muted) });
    numGrid(mx, my + 36, pc, D.taps.map(tp => ({
      text: tp.inside ? fmt(tp.v, 2) : '0',
      fg: rgb(tp.inside ? C.ink : C.muted),
      bg: tp.inside ? rgba(seqColor(tp.v), .32) : rgba(C.canvas, .8),
      stroke: tp.inside ? rgba(C.rule, 1) : rgba(C.rule, .5),
      alpha: tp.inside ? 1 : .7,
    })), { size: 18 });
    txt('⊙', mx + 3 * pc + 26, my + 36 + 1.5 * pc, {
      size: 34, align: 'center', baseline: 'middle', fill: rgb(C.accent),
    });
    txt(`çekirdek · ${K.ad}`, mx + 3 * pc + 52, my + 26, { size: 17, fill: rgb(C.muted) });
    numGrid(mx + 3 * pc + 52, my + 36, pc, D.taps.map(tp => ({
      text: fmtK(tp.kw),
      fg: rgb(C.ink),
      bg: rgba(divColor(tp.kw / 2), .40),
      stroke: rgba(C.rule, 1),
    })), { size: 18 });

    // 9 çarpım listesi — hızlı taramada söner, yerini tarama okuması alır
    const listY = my + 36 + 3 * pc + 46;
    if (slow > .02) {
      ctx.save(); ctx.globalAlpha = slow * (playing ? 1 - .75 * glide : 1);
      D.taps.forEach((tp, i) => {
        const y = listY + i * 30;
        const line = `${tp.inside ? fmt(tp.v, 2) : '0,00'} × ${fmtK(tp.kw).padStart(4, ' ')}` +
          ` = ${fmt(tp.urun, 3).padStart(7, ' ')}`;
        txt(line, mx + 8, y, {
          size: 20, mono: true, fill: rgb(Math.abs(tp.urun) < 1e-9 ? C.muted : C.ink),
          alpha: Math.abs(tp.urun) < 1e-9 ? .5 : 1,
        });
      });
      ctx.restore();
    } else {
      txt('tarama hızlandı — tek tek çarpımlar yerine',
        mx + 8, listY + 60, { size: 20, fill: rgb(C.muted) });
      txt('haritanın doğuşunu izleyin', mx + 8, listY + 90, { size: 20, fill: rgb(C.muted) });
    }
    // toplam
    const sumY = listY + 9 * 30 + 22;
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mx + 8, sumY - 26); ctx.lineTo(mx + 500, sumY - 26); ctx.stroke();
    const sc = K.scale ?? 1;
    txt(`Σ = ${fmt(D.ham, 3)}${sc !== 1 ? `   ×  ${fmt(sc, 3)}  (ölçek)` : ''}`,
      mx + 8, sumY, { size: 22, mono: true, fill: rgb(C.muted) });
    txt(`çıktı[${oy}][${ox}] = ${fmt(D.deger, 3)}`, mx + 8, sumY + 42, {
      size: 30, mono: true, weight: 600, fill: rgb(C.accent),
    });

    /* --- sağ: çıktı haritası doğar --- */
    const oc = Math.min(19, Math.floor(560 / Math.max(map.w, map.h)));
    const owpx = map.w * oc, ohpx = map.h * oc;
    const qx = 1250, qy = 236;
    panel(qx - 30, qy - 58, Math.max(owpx, 480) + 60, Math.max(ohpx, 300) + 190);
    txt(`Öznitelik haritası ${map.w}×${map.h}`, qx - 8, qy - 26, {
      size: 19, mono: true, fill: rgb(C.muted),
    });
    const glowSpan = Math.max(1.2, rate * .34);
    for (let iy = 0; iy < map.h; iy++) {
      for (let ix = 0; ix < map.w; ix++) {
        const i = iy * map.w + ix;
        const x = qx + ix * oc, y = qy + iy * oc;
        if (i > idx) {
          // henüz hesaplanmamış bölge: boş ama görünür (panelden ayrışsın)
          ctx.fillStyle = rgba(C.surface, .95);
          ctx.fillRect(x, y, oc - .8, oc - .8);
          continue;
        }
        ctx.fillStyle = rgb(divColor(map.data[i] / H.mA));
        ctx.fillRect(x, y, oc - .8, oc - .8);
        const age = idx - i;
        if (age < glowSpan) {
          ctx.fillStyle = rgba(C.ink, .55 * (1 - age / glowSpan));
          ctx.fillRect(x, y, oc - .8, oc - .8);
        }
      }
    }
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    ctx.strokeRect(qx - 1, qy - 1, owpx + 1, ohpx + 1);
    // doğan pikselin halkası
    ctx.strokeStyle = rgba(C.accent, .95); ctx.lineWidth = 2.5;
    ctx.strokeRect(qx + ox * oc - 2, qy + oy * oc - 2, oc + 3, oc + 3);

    // boyut formülü — stride/padding değişince ekranda doğrulanır
    const fy2 = qy + ohpx + 66;
    txt('Çıktı boyutu', qx - 8, fy2, { size: 19, mono: true, fill: rgb(C.muted) });
    txt('⌊(g + 2p − ç) / a⌋ + 1', qx - 8, fy2 + 40, { size: 27, mono: true, fill: rgb(C.ink) });
    txt(`⌊(${img.w} + 2·${pad} − 3) / ${stride}⌋ + 1  =  ${map.w}`, qx - 8, fy2 + 82, {
      size: 27, mono: true, weight: 600, fill: rgb(C.accent),
    });
    txt(`adım (a) = ${stride}   ·   dolgu (p) = ${pad}   ·   çekirdek (ç) = 3`,
      qx - 8, fy2 + 122, { size: 19, mono: true, fill: rgb(C.muted) });
    txt(`renk ölçeği ±${fmt(H.mA, 2)} (haritanın kendi maksimumu)`,
      qx - 8, fy2 + 152, { size: 17, mono: true, fill: rgb(C.muted) });
  };

  /* =============== 2. AŞAMA: öznitelik haritaları =============== */
  const drawStageMaps = u => {
    const cols = 3, mw = 468, gap = 36;
    const x0 = 296, y0 = 220, pitch = 380, MS = 210;
    // girdi küçük resmi
    panel(72, 220, 190, 258);
    txt('girdi', 92, 250, { size: 17, mono: true, fill: rgb(C.muted) });
    drawMap(P.img, 92, 262, 150, 150, { signed: false, key: 'img' });
    txt('28 × 28', 92, 440, { size: 17, mono: true, fill: rgb(C.muted) });
    txt('aynı görüntü', 92, 464, { size: 17, fill: rgb(C.muted) });

    BANK.forEach((K, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = x0 + c * (mw + gap), y = y0 + r * pitch;
      const ap = easeOut(clamp((u - i * 1.05) / 1.5, 0, 1));
      const rev = clamp((u - i * 1.05) / 1.8, 0, 1);
      if (ap <= 0) return;
      ctx.save(); ctx.globalAlpha = ap;
      panel(x - 18, y - 18, mw + 36, 366);
      const map = P.bank[i];
      const mA = maxAbs(map);
      // çekirdek rozeti (3×3 katsayı, ıraksak rampa)
      const kc = 26;
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const wv = K.w[ky * 3 + kx];
          ctx.fillStyle = rgb(divColor(wv / 2));
          ctx.fillRect(x + kx * kc, y + ky * kc, kc - 2, kc - 2);
        }
      }
      ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.2;
      ctx.strokeRect(x - 1, y - 1, 3 * kc, 3 * kc);
      txt(K.ad, x + 3 * kc + 16, y + 22, { size: 22, weight: 600 });
      txt(`yakalar: ${K.yakalar}`, x + 3 * kc + 16, y + 48, { size: 18, fill: rgb(C.accent) });
      txt(K.tur === 'adli' ? 'adı olan klasik çekirdek' : 'tohumlu sabit (eğitilmemiş)',
        x + 3 * kc + 16, y + 70, { size: 15, fill: rgb(C.muted) });
      drawMap(map, x, y + 90, MS, MS, { signed: true, scale: mA, reveal: rev, key: `bank${i}` });
      const rx = x + MS + 22;
      txt(`ölçek ±${fmt(mA, 2)}`, rx, y + 118, { size: 16, mono: true, fill: rgb(C.muted) });
      txt('ort |yanıt|', rx, y + 152, { size: 16, fill: rgb(C.muted) });
      txt(fmt(meanAbs(map), 3), rx, y + 182, { size: 26, mono: true, weight: 600 });
      txt('mavi = negatif', rx, y + 218, { size: 14, fill: rgb(C.d1) });
      txt('turuncu = pozitif', rx, y + 240, { size: 14, fill: rgb(C.d2) });
      // açıklama satırı kartın ALTINDA, tam genişlikte — kırpılmaz
      txt(K.not, x, y + 330, { size: 15, fill: rgb(C.muted) });
      ctx.restore();
    });

    const fp = clamp((u - 8.4) / 1.4, 0, 1);
    if (fp > 0) {
      txt('Filtre bankası aynı girdiyi altı ayrı "bakış"a çevirir; renk ölçeği her harita için kendi maksimumudur.',
        72, 966, { size: 21, fill: rgb(C.muted), alpha: fp });
    }
  };

  /* =============== 3. AŞAMA: havuzlama =============== */
  /* Havuzlama gezisi: pencere yalnızca İÇİ DOLU pencerelerde durur.
     Okuma sırasıyla gezilseydi ilk onlarca pencere boş arka plana düşer ve
     kare "0,000 / 0,000 / %100 kayıp" gösterirdi — öğretmeyen bir kare.
     Çıktı haritaları yine okuma sırasında dolar (tutarlılık korunur). */
  let havuzYolCache = null;
  const havuzYol = () => {
    const key = image;
    if (havuzYolCache && havuzYolCache.key === key) return havuzYolCache.list;
    const src = P.poolSrc, mx = P.havuzMax;
    const g = maxAbs(mx);
    const list = [];
    for (let i = 0; i < mx.w * mx.h; i++) if (mx.data[i] > .12 * g) list.push(i);
    havuzYolCache = { key, list: list.length ? list : [0] };
    return havuzYolCache.list;
  };

  const drawStageHavuz = u => {
    const src = P.poolSrc;                       // ReLU'lu Sobel-x haritası
    const mx = P.havuzMax, av = P.havuzOrt;
    const yol = havuzYol();
    const k = Math.min(yol.length - 1, Math.floor(clamp((u - .5) * 2.4, 0, yol.length - 1)));
    const step = yol[k];
    const ox = step % mx.w, oy = Math.floor(step / mx.w);

    const cell = 19, gx = 96, gy = 262;
    panel(gx - 28, gy - 58, src.w * cell + 56, src.h * cell + 116);
    txt(`Kaynak: ReLU(Sobel-x) ${src.w}×${src.h}`, gx - 6, gy - 26, {
      size: 19, mono: true, fill: rgb(C.muted),
    });
    const sA = maxAbs(src);
    for (let iy = 0; iy < src.h; iy++) {
      for (let ix = 0; ix < src.w; ix++) {
        ctx.fillStyle = rgb(seqColor(src.data[iy * src.w + ix] / sA));
        ctx.fillRect(gx + ix * cell, gy + iy * cell, cell - .8, cell - .8);
      }
    }
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    ctx.strokeRect(gx - 1, gy - 1, src.w * cell + 1, src.h * cell + 1);
    // 2×2 pencere — koyu halka + vurgu çerçevesi (arka planda kaybolmasın)
    const wx = gx + ox * 2 * cell, wy = gy + oy * 2 * cell;
    ctx.strokeStyle = rgba(C.canvas, .9); ctx.lineWidth = 7;
    ctx.strokeRect(wx - 2, wy - 2, 2 * cell + 4, 2 * cell + 4);
    ctx.strokeStyle = rgba(C.accent, 1); ctx.lineWidth = 3.5;
    ctx.strokeRect(wx - 2, wy - 2, 2 * cell + 4, 2 * cell + 4);
    txt(`2 × 2 pencere, adım 2 — pencereler örtüşmez  ·  ${k + 1}. dolu pencere`,
      gx - 6, gy + src.h * cell + 40, { size: 18, mono: true, fill: rgb(C.muted) });

    /* pencere içeriği + iki indirgeme */
    const px = 660, py = 262;
    panel(px - 30, py - 60, 452, 426);
    txt('Pencere içeriği', px, py - 26, { size: 19, mono: true, fill: rgb(C.muted) });
    const vals = [];
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        vals.push(src.data[(oy * 2 + dy) * src.w + (ox * 2 + dx)]);
      }
    }
    const vmax = Math.max(...vals), vavg = vals.reduce((a, b) => a + b, 0) / 4;
    const pc = 106;
    for (let i = 0; i < 4; i++) {
      const cx = px + (i % 2) * pc, cy = py + 6 + Math.floor(i / 2) * pc;
      const isMax = Math.abs(vals[i] - vmax) < 1e-12;
      ctx.fillStyle = rgba(seqColor(vals[i] / sA), .55);
      roundRect(cx + 3, cy + 3, pc - 6, pc - 6, 8); ctx.fill();
      ctx.strokeStyle = isMax ? rgba(C.accent, 1) : rgba(C.rule, 1);
      ctx.lineWidth = isMax ? 3 : 1.4;
      roundRect(cx + 3, cy + 3, pc - 6, pc - 6, 8); ctx.stroke();
      txt(fmt(vals[i], 3), cx + pc / 2, cy + pc / 2, {
        size: 22, mono: true, weight: 600, align: 'center', baseline: 'middle',
      });
    }
    txt('maks →', px + 2 * pc + 28, py + 58, { size: 20, fill: rgb(C.muted) });
    txt(fmt(vmax, 3), px + 2 * pc + 28, py + 94, { size: 32, mono: true, weight: 600, fill: rgb(C.accent) });
    txt('ort →', px + 2 * pc + 28, py + 150, { size: 20, fill: rgb(C.muted) });
    txt(fmt(vavg, 3), px + 2 * pc + 28, py + 186, { size: 32, mono: true, weight: 600, fill: rgb(C.d1) });
    txt(vmax > 1e-9
      ? `ortalama tepeyi ${fmt((1 - vavg / vmax) * 100, 1)} % düşürdü`
      : 'pencere tamamen boş — iki indirgeme de 0', px + 4, py + 288, {
      size: 19, mono: true, fill: rgb(C.muted),
    });
    // iki ayrı satır: tek satır panel kenarından taşıyordu
    txt('maks: "burada güçlü bir kenar VAR"', px + 4, py + 320, { size: 17, fill: rgb(C.accent) });
    txt('ort:  "ortalama ne kadar kenar var"', px + 4, py + 344, { size: 17, fill: rgb(C.d1) });

    /* iki çıktı yan yana — 1120..1848 arasına iki panel + 21 px boşluk sığar
       (oc 26'da paneller 18 px örtüşüyordu) */
    const oc = 23;
    const showMax = (mapv, x, y, label, col, key) => {
      panel(x - 24, y - 58, mapv.w * oc + 48, mapv.h * oc + 120);
      txt(label, x - 4, y - 26, { size: 21, weight: 600, fill: col });
      const A = maxAbs(mapv);
      for (let iy = 0; iy < mapv.h; iy++) {
        for (let ix = 0; ix < mapv.w; ix++) {
          const i = iy * mapv.w + ix;
          const cx = x + ix * oc, cy = y + iy * oc;
          if (i > step) {
            ctx.fillStyle = rgba(C.surface, .45);
            ctx.fillRect(cx, cy, oc - 1, oc - 1);
            continue;
          }
          ctx.fillStyle = rgb(seqColor(mapv.data[i] / A));
          ctx.fillRect(cx, cy, oc - 1, oc - 1);
          if (i === step) {
            ctx.strokeStyle = rgba(C.accent, .95); ctx.lineWidth = 2.5;
            ctx.strokeRect(cx - 1, cy - 1, oc + 1, oc + 1);
          }
        }
      }
      ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 1, y - 1, mapv.w * oc + 1, mapv.h * oc + 1);
      txt(`${mapv.w}×${mapv.h}  ·  tepe ${fmt(A, 3)}  ·  ort ${fmt(meanAbs(mapv), 3)}`,
        x - 4, y + mapv.h * oc + 34, { size: 18, mono: true, fill: rgb(C.muted) });
      return A;
    };
    const aMax = showMax(mx, 1144, 262, 'Maksimum havuzlama', rgb(C.accent), 'pmax');
    const aAvg = showMax(av, 1512, 262, 'Ortalama havuzlama', rgb(C.d1), 'pavg');

    const fp = clamp((u - 5.5) / 1.4, 0, 1);
    if (fp > 0) {
      txt(`Maks tepeyi olduğu gibi taşır (${fmt(aMax, 3)}); ortalama onu ${fmt((1 - aAvg / aMax) * 100, 1)} % düşürür.`,
        96, 900, { size: 22, fill: rgb(C.ink), alpha: fp });
      txt(`Konum bilgisi ikisinde de aynı oranda seyrelir: ${src.w}×${src.w} ızgara ${mx.w}×${mx.w}'e iner ` +
        `(hücre sayısı ${src.w * src.w} → ${mx.w * mx.w}, dörtte bir).`,
        96, 934, { size: 20, fill: rgb(C.muted), alpha: fp });
      txt('Atılan şey konumun İNCE ayrıntısıdır: kenarın hangi 2×2 blokta olduğu kalır, blok içindeki yeri gider.',
        96, 966, { size: 20, fill: rgb(C.muted), alpha: fp });
    }
  };

  /* =============== 4. AŞAMA: ReLU =============== */
  const drawStageRelu = u => {
    const before = P.reluSrc;                    // işaretli Sobel-x
    const after = relu(before);
    const A = maxAbs(before);
    const p = easeInOut(clamp((u - 1.2) / 2.4, 0, 1));

    const size = 420;
    let neg = 0, mn = Infinity;
    for (const v of before.data) { if (v < 0) neg++; if (v < mn) mn = v; }
    const negPct = fmt(neg / before.data.length * 100, 1);
    // önce
    panel(100, 226, size + 48, size + 166);
    txt('ÖNCE — ham evrişim çıktısı', 124, 268, { size: 22, weight: 600 });
    drawMap(before, 124, 288, size, size, { signed: true, scale: A, key: 'relu-b' });
    txt(`en küçük  ${fmt(mn, 3)}`, 124, 288 + size + 36, { size: 19, mono: true, fill: rgb(C.muted) });
    txt(`negatif piksel  ${negPct} %`, 124, 288 + size + 64, { size: 19, mono: true, fill: rgb(C.d1) });

    // sonra
    panel(608, 226, size + 48, size + 166);
    txt('SONRA — max(0, x)', 632, 268, { size: 22, weight: 600, fill: rgb(C.accent) });
    drawMap(after, 632, 288, size, size, { signed: true, scale: A, key: 'relu-a', alpha: p });
    txt('en küçük  0,000', 632, 288 + size + 36, { size: 19, mono: true, fill: rgb(C.muted) });
    txt(`tam sıfır piksel  ${negPct} %`, 632, 288 + size + 64, { size: 19, mono: true, fill: rgb(C.accent) });

    // histogram: negatif kutular sıfır çubuğuna göçer
    const bins = 25, lo = -A, hi = A;
    const hb = histogram(before.data, bins, lo, hi);
    const hx = 1152, hy = 330, hw = 660, hh = 400;
    panel(hx - 40, hy - 104, hw + 88, hh + 250);
    txt('Değer dağılımı (25 kutu)', hx - 14, hy - 62, { size: 21, weight: 600 });
    txt('yükseklik = o aralıktaki piksel sayısı', hx - 14, hy - 36, { size: 17, fill: rgb(C.muted) });
    const maxCount = Math.max(...hb);
    const zeroBin = Math.floor(((0 - lo) / (hi - lo)) * bins);
    const bw = hw / bins;
    // sıfır çubuğunun geçiş sonundaki yüksekliği
    let zeroTarget = 0;
    for (let b = 0; b <= zeroBin; b++) zeroTarget += hb[b];
    const scaleY = hh / Math.max(maxCount, zeroTarget);
    for (let b = 0; b < bins; b++) {
      const negBin = b < zeroBin;
      const cnt = hb[b];
      const x = hx + b * bw;
      let h1 = cnt * scaleY;
      let alpha = 1;
      if (negBin) { h1 = cnt * scaleY * (1 - p); alpha = 1 - p * .55; }
      if (b === zeroBin) h1 = (cnt + (zeroTarget - cnt) * p) * scaleY;
      ctx.fillStyle = rgba(negBin ? C.d1 : (b === zeroBin ? C.accent : C.d2), alpha * .92);
      ctx.fillRect(x + 1, hy + hh - h1, bw - 2, h1);
    }
    ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hx, hy + hh + .5); ctx.lineTo(hx + hw, hy + hh + .5); ctx.stroke();
    // sıfır ekseni
    const zx = hx + (zeroBin + 1) * bw;
    ctx.strokeStyle = rgba(C.ink, .6); ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(zx, hy - 10); ctx.lineTo(zx, hy + hh + 8); ctx.stroke();
    ctx.setLineDash([]);
    txt('0', zx, hy + hh + 30, { size: 18, mono: true, align: 'center', fill: rgb(C.ink) });
    txt(fmt(lo, 2), hx, hy + hh + 30, { size: 18, mono: true, fill: rgb(C.muted) });
    txt(fmt(hi, 2), hx + hw, hy + hh + 30, { size: 18, mono: true, align: 'right', fill: rgb(C.muted) });
    txt(`en yüksek kutu: ${Math.round(zeroTarget)} piksel`, hx, hy - 12, {
      size: 17, mono: true, fill: rgb(C.muted),
    });
    txt('negatif kütle (kesmeden önce)', hx + 8, hy + 84, {
      size: 18, fill: rgb(C.d1), alpha: 1 - p * .55,
    });
    /* "sıfırda yığılır" oku: sıfır çubuğunun SOLUNDA, çubuğun kendisinden
       bir kutu genişliği uzakta (yazının sonu çubuğun altında kalıyordu) */
    txt('sıfırda yığılır', zx - bw - 22, hy + 44, {
      size: 19, align: 'right', fill: rgb(C.accent), alpha: p,
    });
    arrow(zx - bw - 16, hy + 38, zx - bw - 2, hy + 72, rgba(C.accent, p), 2.5, 10);
    txt(`${neg} piksel (${negPct} %) tam olarak 0'a düşer; pozitif kuyruk hiç değişmez.`,
      hx - 14, hy + hh + 82, { size: 20, fill: rgb(C.muted) });
    txt('ReLU doğrusal değildir: bu kesme olmasa üst üste',
      hx - 14, hy + hh + 118, { size: 19, fill: rgb(C.muted) });
    txt('evrişimler tek bir evrişime çökerdi.',
      hx - 14, hy + hh + 146, { size: 19, fill: rgb(C.muted) });
  };

  /* =============== 5. AŞAMA: derin katman yığını (2.5B) =============== */
  const drawStageDeep = u => {
    /* Aksonometrik kart yığını: her grup 6 harita, her kart bir öncekinden
       (dx, dy) kadar ötelenmiş — arkadan öne çizilir (ressam algoritması). */
    const groups = [
      { ad: 'girdi', maps: [P.img], size: 200, signed: false, alt: '28×28×1' },
      { ad: 'evrişim 1', maps: P.bank, size: 178, signed: true, alt: '26×26×6' },
      { ad: 'havuz 1', maps: P.bankPool, size: 152, signed: true, alt: '13×13×6' },
      { ad: 'evrişim 2', maps: P.deepRelu, size: 132, signed: true, alt: '11×11×6' },
      { ad: 'havuz 2', maps: P.deepPool, size: 108, signed: true, alt: '5×5×6' },
    ];
    const xs = [120, 430, 780, 1090, 1380];
    /* ORTAK TABAN: yığınlar alt kenarlarından hizalanır (küçülme okunur),
       etiketler tek satırda durur — üst hizalamada etiketler merdiven yapıyordu. */
    const baseline = 560;
    const dx = 15, dy = -13;
    const labelY = 632, arrowY = 480;

    groups.forEach((g, gi) => {
      const ap = easeOut(clamp((u - gi * .85) / 1.3, 0, 1));
      if (ap <= 0) return;
      ctx.save(); ctx.globalAlpha = ap;
      const n = g.maps.length;
      const slide = (1 - ap) * 60;
      const top = baseline - g.size;
      for (let i = n - 1; i >= 0; i--) {
        const x = xs[gi] + i * dx - slide, y = top + i * dy;
        drawMap(g.maps[i], x, y, g.size, g.size, {
          signed: g.signed, key: `deep${gi}-${i}`,
          alpha: .55 + .45 * (1 - i / Math.max(1, n)),
        });
      }
      txt(g.ad, xs[gi], labelY, { size: 22, weight: 600 });
      txt(g.alt, xs[gi], labelY + 28, { size: 19, mono: true, fill: rgb(C.accent) });
      if (gi > 0) {
        const prev = groups[gi - 1];
        arrow(xs[gi - 1] + prev.size + (prev.maps.length - 1) * dx + 16, arrowY,
          xs[gi] - 16, arrowY, rgba(C.muted, .8 * ap), 2.5);
      }
      ctx.restore();
    });

    /* alıcı alan: gerçek hesap (rf ← rf + (k−1)·j, j ← j·s) */
    const rp = clamp((u - 5.4) / 1.6, 0, 1);
    if (rp > 0) {
      ctx.save(); ctx.globalAlpha = rp;
      panel(120, 700, 900, 220);
      txt('Alıcı alan katman katman büyür', 148, 740, { size: 23, weight: 600 });
      txt('rf ← rf + (ç − 1)·atlama   ·   atlama ← atlama × adım', 148, 766, {
        size: 17, mono: true, fill: rgb(C.muted),
      });
      P.rf.forEach((l, i) => {
        const y = 800 + i * 30;
        txt(l.ad, 148, y, { size: 19, fill: rgb(C.muted) });
        txt(`rf = ${String(l.rf).padStart(2, ' ')} px`, 540, y, {
          size: 19, mono: true, weight: 600, fill: rgb(C.accent),
        });
        txt(`atlama = ${l.j}`, 700, y, { size: 19, mono: true, fill: rgb(C.muted) });
      });
      /* girdi üzerinde alıcı alan kutusu — etiket kutunun SAĞINDA, harita
         içine düşmez (içeride rakamların üstüne biniyordu) */
      const last = P.rf[P.rf.length - 1];
      const g0 = groups[0], sz = g0.size;
      const cellPx = sz / P.img.w;
      const bx = xs[0] + 9 * cellPx, by = (baseline - sz) + 9 * cellPx;
      ctx.strokeStyle = rgba(C.canvas, .85); ctx.lineWidth = 6;
      ctx.strokeRect(bx, by, last.rf * cellPx, last.rf * cellPx);
      ctx.strokeStyle = rgba(C.accent, 1); ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, last.rf * cellPx, last.rf * cellPx);
      // etiket kartın ALTINDA: ok bölgesine ya da haritanın üstüne düşmesin
      txt(`alıcı alan ${last.rf}×${last.rf} px`, xs[0], labelY + 56, {
        size: 18, mono: true, fill: rgb(C.accent),
      });
      txt(`Son yığındaki TEK hücre, girdide ${last.rf} × ${last.rf} piksellik bölgeyi görür.`,
        1080, 748, { size: 23, fill: rgb(C.ink) });
      txt('2. katman çekirdekleri 3×3×6\'dır: altı kanalın hepsini toplar,',
        1080, 790, { size: 19, fill: rgb(C.muted) });
      txt('bu yüzden "dikey kenarın yanındaki halka" gibi BİRLEŞİK',
        1080, 818, { size: 19, fill: rgb(C.muted) });
      txt('yapılara yanıt verebilir — 1. katman bunu yapamaz.',
        1080, 846, { size: 19, fill: rgb(C.muted) });
      txt('Sınır: 2. katman ağırlıkları da tohumlu sabittir — eğitilmemiştir,',
        1080, 888, { size: 18, fill: rgb(C.muted) });
      txt('bu yüzden haritalar "soyut" görünür ama anlamlı bir kavram taşımaz.',
        1080, 914, { size: 18, fill: rgb(C.muted) });
      ctx.restore();
    }
  };

  /* =============== 6. AŞAMA: karar =============== */
  /* yönelim ikonu: kutunun merkez açısında kısa çizgi (y aşağı yönlü) */
  const oriIcon = (cx, cy, derece, r, color) => {
    const a = derece * Math.PI / 180;
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * Math.cos(a), cy - r * Math.sin(a));
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.stroke();
  };

  const drawStageKarar = u => {
    const K = P.karar;
    const p1 = easeOut(clamp(u / 1.6, 0, 1));
    const p2 = easeOut(clamp((u - 1.8) / 1.6, 0, 1));
    const p3 = easeOut(clamp((u - 3.6) / 1.8, 0, 1));

    /* 1) küresel havuzlama = gradyan yönelim histogramı */
    panel(84, 226, 470, 500, p1);
    ctx.save(); ctx.globalAlpha = p1;
    txt('Küresel havuzlama', 112, 262, { size: 23, weight: 600 });
    txt('gradyan yönelim histogramı · 4 kutu', 112, 288, { size: 17, fill: rgb(C.muted) });
    drawMap(P.bank[0], 112, 302, 62, 62, { signed: true, key: 'kgx' });
    txt('gx', 112, 380, { size: 16, mono: true, fill: rgb(C.muted) });
    drawMap(P.bank[1], 186, 302, 62, 62, { signed: true, key: 'kgy' });
    txt('gy', 186, 380, { size: 16, mono: true, fill: rgb(C.muted) });
    txt('m = √(gx² + gy²)', 268, 326, { size: 18, mono: true, fill: rgb(C.ink) });
    txt('φ = atan2(gy, gx) + 90°', 268, 352, { size: 18, mono: true, fill: rgb(C.ink) });
    txt(`taban: m ≥ ${fmt(K.ori.esik, 3)}  →  ${K.ori.sayilan} piksel sayıldı`,
      112, 406, { size: 16, mono: true, fill: rgb(C.muted) });
    const enB = Math.max(...K.norm);
    K.feats.forEach((f, i) => {
      const y = 432 + i * 66;
      oriIcon(130, y + 14, ORI_BINS[i].merkez, 17, rgba(C.accent, .95));
      txt(`${ORI_BINS[i].merkez}°`, 158, y + 20, { size: 17, mono: true, fill: rgb(C.muted) });
      const bw = 210 * (K.norm[i] / enB);
      ctx.fillStyle = rgba(C.d1, .85);
      roundRect(212, y + 2, Math.max(3, bw * p1), 24, 5); ctx.fill();
      txt(`${fmt(K.norm[i] * 100, 1)} %`, 212 + Math.max(bw, 46) + 12, y + 20, {
        size: 19, mono: true, weight: 600, fill: rgb(C.ink),
      });
      txt(ORI_BINS[i].ad, 212, y + 46, { size: 15, fill: rgb(C.muted) });
    });
    txt('normalize edilir (toplam = 1,00)', 112, 706, { size: 17, fill: rgb(C.muted) });
    ctx.restore();

    /* 2) doğrusal başlık: 4×4 ağırlık matrisi */
    panel(604, 226, 480, 500, p2);
    ctx.save(); ctx.globalAlpha = p2;
    txt('Doğrusal başlık  W · f', 632, 268, { size: 23, weight: 600 });
    txt('ELLE KURULMUŞ ağırlıklar — eğitilmemiştir', 632, 294, { size: 17, fill: rgb(C.accent) });
    const wc = 90;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 632 + c * wc, y = 322 + r * wc;
        const wv = HEAD_W[r][c];
        ctx.fillStyle = rgba(divColor(wv / 3.2), .55);
        roundRect(x + 3, y + 3, wc - 6, wc - 6, 7); ctx.fill();
        ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1.3;
        roundRect(x + 3, y + 3, wc - 6, wc - 6, 7); ctx.stroke();
        txt(fmt(wv, 1), x + wc / 2, y + wc / 2, {
          size: 20, mono: true, weight: 500, align: 'center', baseline: 'middle',
        });
      }
    }
    txt('ham skor = (W · f) × 7', 632, 706, { size: 19, mono: true, fill: rgb(C.muted) });
    ctx.restore();

    /* 3) softmax çubukları */
    panel(1134, 226, 714, 500, p3);
    ctx.save(); ctx.globalAlpha = p3;
    txt('softmax(skor)', 1162, 268, { size: 23, weight: 600 });
    txt('exp(sᵢ) / Σ exp(sⱼ)  —  toplam tam olarak 1,00', 1162, 294, { size: 17, fill: rgb(C.muted) });
    const barX = 1162, barW = 480;
    K.probs.forEach((pr, i) => {
      const y = 340 + i * 92;
      const win = i === K.kazanan;
      oriIcon(barX + 14, y + 12, ORI_BINS[i].merkez, 14, rgba(win ? C.accent : C.muted, .95));
      txt(CLASSES[i], barX + 40, y + 18, { size: 20, weight: win ? 600 : 400, fill: rgb(win ? C.ink : C.muted) });
      txt(`skor ${fmt(K.scores[i], 2)}`, barX + 330, y + 18, { size: 17, mono: true, fill: rgb(C.muted) });
      ctx.fillStyle = rgba(C.rule, .7);
      roundRect(barX, y + 30, barW, 30, 6); ctx.fill();
      ctx.fillStyle = rgba(win ? C.accent : C.d1, .92);
      roundRect(barX, y + 30, Math.max(3, barW * pr * p3), 30, 6); ctx.fill();
      txt(`${fmt(pr * 100, 1)} %`, barX + barW + 16, y + 52, {
        size: 22, mono: true, weight: win ? 600 : 400, fill: rgb(win ? C.accent : C.muted),
      });
    });
    const toplam = K.probs.reduce((a, b) => a + b, 0);
    txt(`Σ = ${fmt(toplam, 4)}`, barX, 716, { size: 19, mono: true, fill: rgb(C.muted) });
    ctx.restore();

    const p4 = clamp((u - 6) / 1.6, 0, 1);
    if (p4 > 0) {
      txt(`Karar: ${CLASSES[K.kazanan]} — %${fmt(K.probs[K.kazanan] * 100, 1)}`,
        84, 800, { size: 34, weight: 600, fill: rgb(C.accent), alpha: p4 });
      txt('Sınır: başlık ağırlıkları eğitilmemiştir; bu bir sınıflandırıcının NASIL karar verdiğini gösterir,',
        84, 842, { size: 20, fill: rgb(C.muted), alpha: p4 });
      txt('bir modelin ne öğrendiğini değil. Yönelim histogramı ve softmax ise gerçek hesaptır.',
        84, 870, { size: 20, fill: rgb(C.muted), alpha: p4 });
      txt(`Girdi: ${image === 'desen' ? 'geometrik desen' : 'el yazısı benzeri rakam'} (prosedürel, tohumlu)`,
        84, 916, { size: 19, mono: true, fill: rgb(C.muted), alpha: p4 });
    }
  };

  /* ---------- ana çizim ---------- */
  const DRAW = [drawStageImage, drawStageSlide, drawStageMaps,
    drawStageHavuz, drawStageRelu, drawStageDeep, drawStageKarar];

  const draw = () => {
    resize();
    const si = stageIndexAt(t);
    const u = t - STAGE_START[si];
    drawChrome(si, u);
    DRAW[si](u);
  };

  const announce = () => {
    const si = stageIndexAt(t);
    const K = P.karar;
    status.textContent = `${si + 1}/${STAGES.length} · ${STAGES[si].baslik}. ${STAGES[si].iddia}` +
      (si === 6 ? ` Karar: ${CLASSES[K.kazanan]} (%${fmt(K.probs[K.kazanan] * 100, 1)}).` : '');
  };

  /* ---------- döngü ---------- */
  const frame = ts => {
    raf = 0;
    if (disposed) return;
    const dt = lastTs ? Math.min(.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    if (playing) {
      t += dt;
      if (t >= TOTAL_DUR) { t = TOTAL_DUR - 1e-3; playing = false; announce(); }
    }
    draw();
    if (playing) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf && playing && !disposed) { lastTs = 0; raf = requestAnimationFrame(frame); }
  };

  /* ---------- API ---------- */
  const play = () => {
    if (playing || disposed || isStatic()) return;
    playing = true; kick();
  };
  const pause = () => {
    playing = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  const seek = (sec, { announce: ann = true } = {}) => {
    t = clamp(sec, 0, TOTAL_DUR - 1e-3);
    draw();
    if (ann) announce();
  };
  const setStage = (id, adim) => {
    const i = typeof id === 'number' ? clamp(id, 0, STAGES.length - 1)
      : Math.max(0, STAGES.findIndex(s => s.id === id));
    let time = STAGE_START[i];
    if (adim !== undefined && adim !== null && !Number.isNaN(Number(adim))) {
      const n = Number(adim);
      if (STAGES[i].id === 'kaydir') {
        // adım → zaman: tarama programının tersi (ikili arama, deterministik)
        let lo = 0, hi = STAGES[i].dur;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2;
          if (stepAt(mid) < n) lo = mid; else hi = mid;
        }
        time += (lo + hi) / 2 + 1e-4;
      } else {
        time += clamp(n, 0, STAGES[i].dur - .01);
      }
    }
    seek(time);
  };
  const invalidate = () => { heroCache = null; bufCache.clear(); draw(); announce(); };

  const api = {
    play, pause,
    restart() { pause(); t = 0; draw(); announce(); play(); },
    advance(dt) { seek(t + dt, { announce: false }); },
    seek,
    setStage,
    setFilter(id) { if (FILTER_LIST.some(k => k.id === id)) { filterId = id; invalidate(); } },
    setStride(v) { stride = clamp(v | 0, 1, 4); invalidate(); },
    setPad(v) { pad = clamp(v | 0, 0, 2); invalidate(); },
    setImage(kind) {
      image = kind === 'desen' ? 'desen' : 'rakam';
      P = buildPipeline({ image });
      invalidate();
    },
    renderNow() { draw(); },
    setActive(on) { active = !!on; if (!active) pause(); },
    get state() {
      const si = stageIndexAt(t);
      return {
        t, playing, stage: STAGES[si].id, stageIndex: si, filter: filterId,
        stride, pad, image,
        adim: STAGES[si].id === 'kaydir' ? Math.floor(stepAt(t - STAGE_START[si])) : null,
        cikti: { w: hero().map.w, h: hero().map.h },
        karar: { sinif: CLASSES[P.karar.kazanan], olasilik: P.karar.probs[P.karar.kazanan] },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      host.removeEventListener('keydown', onKey);
      bufCache.clear();
      canvas.remove(); status.remove();
      host.classList.remove('cvp');
      delete host.dataset.ownsArrows;
    },
  };

  /* ---------- olaylar ---------- */
  const onVis = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVis);
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!disposed) draw(); }, 80);
  };
  window.addEventListener('resize', onResize);
  const onKey = e => {
    const si = stageIndexAt(t);
    if (e.key === 'ArrowRight') { e.preventDefault(); pause(); setStage(Math.min(STAGES.length - 1, si + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pause(); setStage(Math.max(0, si - 1)); }
    else if (e.key === ' ') { e.preventDefault(); playing ? pause() : play(); }
  };
  host.addEventListener('keydown', onKey);

  /* ---------- kuruluş ----------
     Azaltılmış hareket / dışa aktarım: DURULMUŞ SON KARE — karar aşaması
     tamamlanmış (softmax çubukları, kazanan sınıf, sınır notu görünür). */
  resize();
  if (isStatic()) {
    t = TOTAL_DUR - .05;
    draw(); announce();
  } else if (options.seekTo !== undefined) {
    seek(options.seekTo);
  } else if (options.stage) {
    setStage(options.stage, options.adim);
    if (options.adim === undefined && active) play();
  } else {
    draw(); announce();
    if (active && options.autoplay !== false) play();
  }

  return api;
}
