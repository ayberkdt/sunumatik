/* astro-doku.mjs — giysinin YÜZEY dokuları (three görmez, veri üretir).
 *
 * NEDEN VAR
 * ─────────
 * Sayıldı: giysinin 18 malzemesinin yalnız 3'ü bir doku taşıyordu ve o üçü de
 * birer YAZI etiketiydi. Normal haritası 0, pürüzlülük haritası 0, ortam örtme
 * haritası 0. Yani giysinin hiçbir yerinde yüzey dokusu yoktu: düz renk artı
 * iki sayı ile aydınlatılan bir yüzey, boyanmış plastik gibi okunur. Beta-bezi
 * DOKUMADIR ve bir giysi render'ı onun üstünde yaşar.
 *
 * CANVAS YOK. Doku `DataTexture` ile, düz bir dizi olarak üretilir: kapılar
 * node'da koşuyor ve orada `document.createElement('canvas')` yok. Aynı kod
 * hem tarayıcıda hem kapıda çalışmak zorunda, yoksa ölçülen şey gösterilen şey
 * olmaz.
 *
 * ÖLÇEK. UV'ler METRE cinsindendir (bkz. `astro-body/supur`), o yüzden
 * `repeat` doğrudan "metrede kaç tekrar" demektir: 2 mm'lik bir dokuma için
 * repeat = 500. Mesh'e göre ölçeklenen UV, aynı kumaşı gövdede kaba parmak
 * ucunda görünmez yapardı.
 */

/**
 * MIPMAP ŞART. `DataTexture` varsayılanda mipmap üretmez ve `LinearFilter`
 * kullanır; 1,4 mm'lik bir dokuma tam figür planında piksel başına onlarca
 * iplik düşürdüğü için yüzey KAYNIYORDU - uzaktan bakınca kumaş değil kirli
 * bir parazit görünüyordu. Mipmap zinciri o frekansı mesafeye göre söndürür,
 * anizotropi de yüzeye eğik bakıldığında bulanıklaşmasını engeller.
 */
function kur(THREE, veri, en) {
  const dok = new THREE.DataTexture(veri, en, en, THREE.RGBAFormat);
  dok.wrapS = dok.wrapT = THREE.RepeatWrapping;
  dok.generateMipmaps = true;
  dok.minFilter = THREE.LinearMipmapLinearFilter;
  dok.magFilter = THREE.LinearFilter;
  dok.anisotropy = 8;
  dok.needsUpdate = true;
  return dok;
}

/** Deterministik gürültü: aynı giysi her karede aynı kumaşı taşır. */
function gurultu(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function yumusakGurultu(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = gurultu(xi, yi), b = gurultu(xi + 1, yi);
  const c = gurultu(xi, yi + 1), d = gurultu(xi + 1, yi + 1);
  return (a + (b - a) * u) + ((c - a) + (d - c) * u - (a + (b - a) * u)) * v;
}

/**
 * DOKUMA YÜKSEKLİĞİ — düz örgü (plain weave).
 *
 * Çözgü ve atkı birbirinin ÜSTÜNDEN ve ALTINDAN geçer; hangisinin üstte
 * olduğu dama tahtası gibi değişir. Tek bir sinüs dalgası bunu vermez - o
 * oluklu sac olur, kumaş değil.
 */
export function dokumaYuksekligi(u, v, iplik) {
  const su = u * iplik, sv = v * iplik;
  const cu = Math.abs(Math.sin(Math.PI * su));
  const cv = Math.abs(Math.sin(Math.PI * sv));
  const ust = (Math.floor(su) + Math.floor(sv)) % 2 === 0;
  /* Üstteki iplik dolgun, alttaki yalnız aralıklardan görünür. */
  const h = ust ? cu * 0.9 + cv * 0.25 : cv * 0.9 + cu * 0.25;
  /* Tüy: kumaş kusursuz tekrar etmez, yoksa yüzey plastikleşir. */
  return h * 0.88 + yumusakGurultu(su * 1.7, sv * 1.7) * 0.12;
}

/**
 * KUMAŞ NORMAL HARİTASI. Yükseklikten merkezî farkla türetilir.
 * `guc` normalin eğimini ölçekler; 1,0 gerçek dokumanın derinliğidir.
 */
export function kumasNormalHaritasi(THREE, { en = 256, iplik = 8, guc = 1.0 } = {}) {
  const veri = new Uint8Array(en * en * 4);
  const d = 1 / en;
  for (let j = 0; j < en; j++) {
    for (let i = 0; i < en; i++) {
      const u = i / en, v = j / en;
      const hx = dokumaYuksekligi(u + d, v, iplik) - dokumaYuksekligi(u - d, v, iplik);
      const hy = dokumaYuksekligi(u, v + d, iplik) - dokumaYuksekligi(u, v - d, iplik);
      /* Eğim → normal. Ölçek `guc` ile, sonra birim boya normalize. */
      const nx = -hx * iplik * guc, ny = -hy * iplik * guc, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const k = (j * en + i) * 4;
      veri[k] = Math.round((nx / l * 0.5 + 0.5) * 255);
      veri[k + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
      veri[k + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
      veri[k + 3] = 255;
    }
  }
  return kur(THREE, veri, en);
}

/**
 * PÜRÜZLÜLÜK HARİTASI. Dokumanın tepeleri aşınır (daha parlak), aralıkları
 * toz tutar (daha mat). Tek bir pürüzlülük sayısı, ışığı her yerde aynı
 * kıran bir yüzey demektir ve gerçek kumaşta öyle bir yer yoktur.
 */
export function kumasPuruzHaritasi(THREE, { en = 256, iplik = 8, taban = 0.88, genlik = 0.16 } = {}) {
  const veri = new Uint8Array(en * en * 4);
  for (let j = 0; j < en; j++) {
    for (let i = 0; i < en; i++) {
      const u = i / en, v = j / en;
      const h = dokumaYuksekligi(u, v, iplik);
      /* Alçak frekanslı leke: kumaş bölge bölge farklı yıpranır. */
      const leke = yumusakGurultu(u * 5.3, v * 5.3) * 0.5 + yumusakGurultu(u * 13.1, v * 13.1) * 0.5;
      const r = Math.max(0.04, Math.min(1, taban - genlik * h + (leke - 0.5) * 0.1));
      const k = (j * en + i) * 4;
      const b = Math.round(r * 255);
      veri[k] = b; veri[k + 1] = b; veri[k + 2] = b; veri[k + 3] = 255;
    }
  }
  return kur(THREE, veri, en);
}

/**
 * İŞLENMİŞ METAL için ince taşlama izi: tek yönlü, çok sığ. Donanımın
 * kumaşla aynı dokumayı taşıması, giysiyi tek parça bir battaniye yapardı.
 */
export function metalNormalHaritasi(THREE, { en = 128, guc = 0.35 } = {}) {
  const veri = new Uint8Array(en * en * 4);
  for (let j = 0; j < en; j++) {
    for (let i = 0; i < en; i++) {
      const u = i / en, v = j / en;
      const iz = yumusakGurultu(u * 220, v * 3.5) - 0.5;
      const nx = -iz * guc, ny = 0, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const k = (j * en + i) * 4;
      veri[k] = Math.round((nx / l * 0.5 + 0.5) * 255);
      veri[k + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
      veri[k + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
      veri[k + 3] = 255;
    }
  }
  return kur(THREE, veri, en);
}

/** Dokumanın metre cinsinden aralığı ve ona karşılık gelen `repeat`. */
/* İPLİK ARALIĞI ÖLÇÜLDÜ, SEÇİLMEDİ. 2,2 mm ile kurulduğunda yüzey ekranda
   çuval bezi gibi çıkıyordu: yakın planda iplikler 6-8 piksel aralıklı, yani
   gerçekte ~5 mm. Beta bezi 1,2-1,6 mm örgüdür ve 1,5 m uzaktan DOKU değil
   TON olarak okunur - görünmesi gereken şey ipliğin kendisi değil, ipliğin
   ışığı kırma biçimidir. */
export const IPLIK_ARALIGI_M = 0.0014;
export const DOKU_TEKRAR = 1 / (IPLIK_ARALIGI_M * 8);   // 8 iplik / karo
