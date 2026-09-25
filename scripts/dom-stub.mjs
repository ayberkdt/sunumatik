/* dom-stub.mjs — geometriyi node'da kurabilmek için asgari tarayıcı yüzeyi.
 *
 * NEDEN VAR
 * ─────────
 * Bu depodaki en pahalı hata sınıfı YÖN ve HİZALAMA: bir parça beyan ettiği
 * yerde durmuyor ya da beyan ettiği yöne bakmıyor. Tek tek yakalandılar ve
 * her seferinde önce kullanıcı gördü — güneş dizisi güneşten 48° sapmış,
 * yüksek kazançlı anten nadirden 180°, panel tarlası beyan ettiği yerden
 * 37 m ötede, kriyojenik tanklar pedin bir metre altında, regolit örtüsü
 * örttüğü modülün yanına dikilmiş bir duvar.
 *
 * Hepsi ÖLÇÜLEBİLİR. Ölçülemez olan tek şey, ölçümün koşamamasıydı: gövdeyi
 * kuran kod doku üretmek için canvas istiyor, node'da canvas yok, dolayısıyla
 * hiçbir kapı çizilen geometriye bakamıyordu ve bütün denetimler kataloğun
 * kendi kendisiyle tutarlılığını sınamakla yetiniyordu.
 *
 * Gereken yüzey küçük: ölçüldü, `document.createElement('canvas')` ve 2B
 * bağlamda dokuz metot. Dokuların NEYE benzediği burada önemli değil —
 * sorulan soru köşe noktalarının nerede durduğu — bu yüzden bağlam çizim
 * yapmaz, yalnız çağrıları yutar ve doğru biçimde nesneler döndürür.
 *
 * KULLANIM
 * ────────
 *     import { domKur } from './dom-stub.mjs';
 *     domKur();                       // globalThis.document'i kurar
 *     const B = await import('.../hab-build.mjs');
 */

class SahteBaglam {
  constructor(tuval) {
    this.canvas = tuval;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.globalAlpha = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
  }
  /* Çizim çağrıları: geometri sorusunun cevabını değiştirmezler. */
  beginPath() {} closePath() {} moveTo() {} lineTo() {} stroke() {} fill() {}
  fillRect() {} strokeRect() {} clearRect() {} arc() {} ellipse() {}
  quadraticCurveTo() {} bezierCurveTo() {} rect() {} save() {} restore() {}
  translate() {} rotate() {} scale() {} setTransform() {} clip() {}
  drawImage() {} setLineDash() {} fillText() {} strokeText() {}
  measureText(s) { return { width: String(s).length * 6 }; }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createPattern() { return null; }
  createImageData(w, h) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' };
  }
  getImageData(x, y, w, h) { return this.createImageData(w, h); }
  putImageData() {}
}

class SahteTuval {
  constructor() {
    this.width = 1; this.height = 1;
    this.style = {};
    this.__ctx = null;
    /* three, CanvasTexture'ı yüklerken bunlara bakar. */
    this.nodeName = 'CANVAS';
    this.tagName = 'CANVAS';
  }
  getContext(tur) {
    if (tur !== '2d') return null;
    if (!this.__ctx) this.__ctx = new SahteBaglam(this);
    return this.__ctx;
  }
  toDataURL() { return 'data:,'; }
  addEventListener() {} removeEventListener() {}
}

/**
 * Global `document`'i kurar. Zaten varsa DOKUNMAZ: gerçek bir tarayıcıda
 * koşuyorsak kütüğün sahneyi bozması, kapının ölçtüğü şeyi değiştirmek olur.
 * @returns {boolean} kütük kurulduysa true
 */
export function domKur() {
  if (typeof globalThis.document !== 'undefined') return false;
  globalThis.document = {
    createElement(ad) {
      if (String(ad).toLowerCase() === 'canvas') return new SahteTuval();
      /* Başka bir eleman istenirse sessizce boş bir şey döndürmek, hatayı
         gizlemek olur: neyin istendiğini söyleyip düşsün. */
      throw new Error(`dom-stub: beklenmeyen createElement('${ad}') — kütük yalnız canvas tanıyor`);
    },
    createElementNS(ns, ad) { return this.createElement(ad); },
  };
  return true;
}
