/* Aurora: kutup ışığı perdesi — kozmosun kardeşi (aynı mount deseni, aynı
   seçenek dili: seed / activity / density / active / exportMode). Efekt
   yığını DEĞİL: her katman adlandırılmış bir olguya karşılık gelir ve
   renkler ELLE SEÇİLMEZ, emisyon çizgisinden türetilir.

   FİZİK — sahnenin omurgası
   ─────────────────────────
   Auroral renk keyfî değildir; TÜRE ve YÜKSEKLİĞE bağlıdır:

   · 557,7 nm  O(¹S) yeşil — ömür ~0,7 s. ~100–150 km'de baskın auroral
     renk. Altta O₂ ile çarpışmalı sönümleme (quenching) devreye girer:
     A = 1/0,7 s⁻¹, k(O₂) ≈ 4×10⁻¹² cm³ s⁻¹ → kritik O₂ yoğunluğu
     ~3,6×10¹¹ cm⁻³; toplam yoğunluk cinsinden ~3,6×10¹² cm⁻³ (O₂ payı
     ~%10 kabulüyle) — yani ~95–100 km ALTINDA yeşil söner.
   · 630,0 nm  O(¹D) kırmızı — ömür ~110 s. Metastabil durum bu kadar
     uzun yaşarken çarpışma onu ışıma yapamadan bozar: A = 1/110 s⁻¹,
     k(N₂) ≈ 2×10⁻¹¹ cm³ s⁻¹ → n_kritik = A/k ≈ 4,5×10⁸ cm⁻³. Bu yüzden
     630,0 pratikte YALNIZ ~200 km ÜSTÜNDE görünür. Kullanıcının
     "atom yoğunluğu" kaydırıcısının GERÇEK karşılığı budur: yoğunluk
     çarpanı büyüyünce sönümleme tabanı yükselir, kırmızı taç FİZİKSEL
     olarak söner (uydurma bir opaklık kısma değil).
   · 427,8 nm  N₂⁺ birinci negatif (1NG) mavi-mor — ani ışıma (~60 ns),
     sönümleme yok; iyonlaşma hızını birebir izler, yani çökelmenin
     ulaştığı EN DERİN katmanda (~100 km ve altı) parlar; enerjik
     çökelme ister.
   · N₂ birinci pozitif (1PG, ~650–680 nm) — perdenin ALT KENARINDA
     (~90–110 km) sert çökelmede. Meşhur PEMBE alt kenar bu kırmızının
     427,8 mor-mavisiyle toplamıdır — ayrı bir "pembe çizgi" yoktur.

   Katmanlanma bu dört terimden KENDİLİĞİNDEN çıkar: altta pembe/mavi,
   ortada yeşil, üstte kırmızı. Hiçbir yerde "şurayı kırmızı boya" yok.

   Atmosfer modeli (tek kaynak, hem JS hem GLSL aynı sayıları okur):
   · log₁₀ n(h): MSIS benzeri toplam sayı yoğunluğu, softplus ile
     yumuşatılmış çok eğimli üstel (rms 0,03 dex; düğüm noktalarında
     eğim kırılmaz — tablo düğümü olan modeller ekranda o yükseklikte
     YATAY BANT gösteriyordu, bu yüzden C∞ форм seçildi).
   · O/N₂ oranı yükseklikle üstel artar (difüzif ayrışma) → fO(h).
   · Elektron çökelme profili: alt kenarı KESKİN (nüfuz derinliği,
     Gauss σ=7,5 km), üstü dağınık (üstel, 42 km). Tepe yüksekliği
     karakteristik enerjiden: h ≈ 86 + 130/(1+(E₀/2,2)^1,1) km —
     1 keV→~180 km, 10 keV→~106 km, 20 keV→~97 km. Spektrum tek enerjili
     değildir: her zaman YUMUŞAK bir kuyruk (0,7 keV, ~187 km) vardır —
     kırmızı tacın kaynağı odur.
   · Aktivite (Kp 0–9): E₀ = 3,5 + 1,9·Kp keV (sertleşme), enerji akısı
     0,30 + 0,42·Kp (parlaklık), yumuşak pay 0,42 − 0,03·Kp. Oval
     ekvatora doğru genişler (sınır enlemi ≈ 67° − 2·Kp) → yay
     gözlemciye yaklaşır ve gökte yükselir. Morfoloji sırası gerçektir:
     homojen yay → ışınlı yay → katlar → alt fırtına (substorm) kopması
     (yerel sarmal/çıkıntı).
   · Yoğunluk çarpanı yalnız sönümlemeyi değil, DURDURMA yüksekliğini de
     değiştirir: yoğun atmosferde elektronlar daha YUKARIDA durur
     (h_tepe += 8·ln(n/n₀) km).

   RENK: dört çizginin sRGB karşılığı CIE 1931 renk eşleme
   fonksiyonlarından (Wyman–Sloan–Shirley çok-loblu uyum) hesaplanır,
   gamut dışı negatif bileşen beyaza doğru doygunluk azaltılarak
   kapatılır. Elle girilmiş hex YOK. "Serbest renk (sanatsal)" kipi bu
   eşlemeyi bırakır ve altyazıda AÇIKÇA "fiziksel değil" der.

   TEMSİLÎ olan: parlaklık ALANI (perdenin uzamsal dokusu, katların
   dalga boyları, ışın demetlerinin genliği) stilizedir — bu bir çökelme
   simülasyonu DEĞİLDİR. Sönümleme eşiği, katman yükseklikleri, çizgi
   kimlikleri ve morfoloji sırası gerçektir.

   Deterministik: tohumlu yerleşim (mulberry32); zaman YALNIZ advance(dt)
   toplamıdır — Math.random / Date.now kullanılmaz. exportMode ve
   prefers-reduced-motion anlamlı bir SON KARE verir; active:false iken
   rAF hiç kurulmaz (deste fonu kullanımı).

   EPİLEPSİ GÜVENLİĞİ: küresel parlaklık salınımı ±%12 ile sınırlı
   (uPulse), sürekli parlama/neon yok. */

import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════
   0 · yardımcılar
   ═══════════════════════════════════════════════════════════════════ */

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const domExport = () =>
  new URLSearchParams(location.search).get('export') === '1'
  || document.documentElement.dataset.export === 'true';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstepJS = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* GLSL'e sayı basma: her zaman ondalık nokta bırakır (tamsayı literal
   float uniform'a atanırsa derleyici hata verir) */
const G = v => {
  const s = Number(v).toPrecision(8);
  return /[.e]/.test(s) ? s : `${s}.`;
};

/* kara cisim → sRGB (Tanner Helland) — yıldız renkleri SICAKLIKTAN */
function blackbodyRGB(kelvin) {
  const t = clamp(kelvin / 100, 10, 400);
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = v => clamp(v / 255, 0, 1);
  return [c(r), c(g), c(b)];
}

/* CIE 1931 renk eşleme fonksiyonları — Wyman, Sloan & Shirley (2013)
   çok-loblu Gauss uyumu. Dalga boyu → sRGB; gamut dışı negatifler
   BEYAZA doğru doygunluk azaltılarak kapatılır (kırpma yerine), yoksa
   557,7 nm ekranda sarıya kayar. */
const cieG = (x, mu, s1, s2) => { const t = (x - mu) * (x < mu ? 1 / s1 : 1 / s2); return Math.exp(-0.5 * t * t); };
const cieX = l => 1.056 * cieG(l, 599.8, 37.9, 31.0) + 0.362 * cieG(l, 442.0, 16.0, 26.7) - 0.065 * cieG(l, 501.1, 20.4, 26.2);
const cieY = l => 0.821 * cieG(l, 568.8, 46.9, 40.5) + 0.286 * cieG(l, 530.9, 16.3, 31.1);
const cieZ = l => 1.217 * cieG(l, 437.0, 11.8, 36.0) + 0.681 * cieG(l, 459.0, 26.0, 13.8);

function wavelengthRGB(lambda, whiten = 0) {
  const X = cieX(lambda), Y = cieY(lambda), Z = cieZ(lambda);
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const lo = Math.min(r, g, b);
  if (lo < 0) { r -= lo; g -= lo; b -= lo; }        /* beyaza doğru doygunluk azalt */
  const hi = Math.max(r, g, b, 1e-6);
  r /= hi; g /= hi; b /= hi;
  return [r + (1 - r) * whiten, g + (1 - g) * whiten, b + (1 - b) * whiten];
}

function hslRGB(h, s, l) {
  const f = n => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/* ═══════════════════════════════════════════════════════════════════
   1 · FİZİK SABİTLERİ — tek kaynak. GLSL bu nesneden üretilir, böylece
   ekrandaki görüntü ile JS'in yazdığı sayılar ASLA ayrışmaz.
   ═══════════════════════════════════════════════════════════════════ */

const P = {
  /* log10 toplam sayı yoğunluğu (cm^-3), MSIS benzeri; softplus dizisi
     100–400 km arası hedeflere rms 0,031 dex ile oturur */
  n0: 14.45, nH0: 80, nSlope: 0.0720,
  nK: [[124, 10, 0.0340], [142, 10, 0.0230], [196, 18, 0.0075], [270, 30, 0.0025]],
  /* O/N₂ oranı: ln r = ... (difüzif ayrışma) → fO = r/(1+r) */
  oLr0: -2.94, oH0: 110, oSlope: 0.0500,
  oLowK: [105, 5, 0.20],                       /* turbopoz altı hızlı düşüş */
  oK: [[150, 12, 0.0250], [205, 20, 0.0100], [255, 25, 0.0030]],
  /* sönümleme kritik yoğunlukları (toplam yoğunluk cinsinden, log10) */
  logNc557: 12.5563,        /* 3,6e12 — O(¹S), A=1/0,7 s, k(O₂)≈4e-12 */
  logNc630: 8.6532,         /* 4,5e8  — O(¹D), A=1/110 s, k(N₂)≈2e-11 */
  /* çökelme profili */
  depLow: 7.5, depUp: 42,   /* km: alt kenar Gauss σ, üst kuyruk ölçeği */
  hpA: 86, hpB: 130, hpC: 2.2, hpD: 1.1,       /* h_tepe(E₀) */
  eSoft: 0.7,               /* keV — daima var olan yumuşak kuyruk */
  e0A: 3.5, e0B: 1.9,       /* E₀(Kp) keV */
  fSoftA: 0.42, fSoftB: 0.030,
  fluxA: 0.30, fluxB: 0.42,
  densShift: 8,             /* km per ln(yoğunluk çarpanı) */
  /* çizgi verimleri (bağıl; 557,7 = 1) */
  k557: 1.0, k630: 4.5, k4278: 0.078, k1pg: 0.095,
  softG: 0.25,              /* yumuşak elektronların yeşile katkı payı */
  hardR: 0.30,              /* sert elektronların kırmızıya katkı payı */
  pgLo: 106, pgHi: 128,     /* N₂ 1PG yükseklik kapısı (km) */
  /* perde geometrisi */
  hBase: 82, hTop: 360,     /* km — geometri SABİT; görünürlüğü fizik seçer */
  fieldTilt: 6.9,           /* ° — alan çizgisinin dikeyden sapması (I≈78°'in
                               sunumsal olarak yumuşatılmışı; ham 12° kadrajı
                               bozuyordu, sınırlama limitations'ta yazılı) */
  fieldAz: 0.035,           /* doğu-batı bileşeni (manyetik sapma jesti) */
};

const E0ofKp = kp => P.e0A + P.e0B * kp;
const hPeakOf = E => P.hpA + P.hpB / (1 + Math.pow(E / P.hpC, P.hpD));
const H_PEAK_SOFT = hPeakOf(P.eSoft);

function log10n(h) {
  let v = P.n0 - P.nSlope * (h - P.nH0);
  for (const [k, s, d] of P.nK) v += d * s * Math.log(1 + Math.exp(Math.min(30, (h - k) / s)));
  return v;
}
function fOxygen(h) {
  const sp = (x, s) => s * Math.log(1 + Math.exp(Math.min(30, x / s)));
  let lr = P.oLr0 + P.oSlope * (h - P.oH0) - P.oLowK[2] * sp(P.oLowK[0] - h, P.oLowK[1]);
  for (const [k, s, d] of P.oK) lr -= d * sp(h - k, s);
  const r = Math.exp(clamp(lr, -30, 30));
  return r / (1 + r);
}
function depos(h, hp) {
  if (h < hp) { const t = (hp - h) / P.depLow; return Math.exp(-t * t); }
  return Math.exp(-(h - hp) / P.depUp);
}

/* Dört çizginin hacim ışıma hızı (bağıl). Fragment shader'ın birebir
   JS ikizi — eksen işaretleri, telemetri ve açıklama satırı buradan
   okunur, böylece yazı ile piksel aynı modeli anlatır. */
function emission(h, kp, densMul) {
  const ln = log10n(h) + Math.log10(densMul);
  const q557 = 1 / (1 + Math.pow(10, Math.min(20, ln - P.logNc557)));
  const q630 = 1 / (1 + Math.pow(10, Math.min(20, ln - P.logNc630)));
  const o = fOxygen(h);
  const hp = hPeakOf(E0ofKp(kp)) + P.densShift * Math.log(densMul);
  const hpS = H_PEAK_SOFT + P.densShift * Math.log(densMul);
  const fS = P.fSoftA - P.fSoftB * kp;
  const dH = (1 - fS) * depos(h, hp);
  const dS = fS * depos(h, hpS);
  const flux = P.fluxA + P.fluxB * kp;
  return {
    green: P.k557 * flux * (dH + P.softG * dS) * Math.pow(Math.max(o, 1e-4), 0.45) * q557,
    red: P.k630 * flux * (dS + P.hardR * dH) * o * q630,
    blue: P.k4278 * flux * dH * (1 - o),
    pink: P.k1pg * flux * dH * (1 - o) * (1 - smoothstepJS(P.pgLo, P.pgHi, h)),
    hPeak: hp,
  };
}

/* 630,0 katmanının ALT KENARI: tepe değerinin yarısına çıktığı yükseklik.
   Yoğunluk kaydırıcısının ekranda görünen sonucu tam olarak budur. */
const redBaseCache = new Map();
function redBaseAltitude(kp, densMul) {
  const key = `${kp.toFixed(2)}|${densMul.toFixed(3)}`;
  if (redBaseCache.has(key)) return redBaseCache.get(key);
  const value = computeRedBase(kp, densMul);
  if (redBaseCache.size > 400) redBaseCache.clear();
  redBaseCache.set(key, value);
  return value;
}
function computeRedBase(kp, densMul) {
  let peak = 0, peakH = 0;
  const hs = [];
  for (let h = 90; h <= 400; h += 2) { const e = emission(h, kp, densMul).red; hs.push([h, e]); if (e > peak) { peak = e; peakH = h; } }
  if (peak <= 1e-9) return null;
  for (const [h, e] of hs) if (h < peakH && e >= peak * 0.5) return h;
  return peakH;
}

/* ═══════════════════════════════════════════════════════════════════
   2 · GLSL — atmosfer + gürültü (JS sabitlerinden üretilir)
   ═══════════════════════════════════════════════════════════════════ */

const ATMOS_GLSL = `
float aurSoftplus(float x, float s){ return s * log(1. + exp(min(30., x / s))); }
float aurLogN(float h){
  float v = ${G(P.n0)} - ${G(P.nSlope)} * (h - ${G(P.nH0)});
${P.nK.map(([k, s, d]) => `  v += ${G(d)} * aurSoftplus(h - ${G(k)}, ${G(s)});`).join('\n')}
  return v;
}
float aurFO(float h){
  float lr = ${G(P.oLr0)} + ${G(P.oSlope)} * (h - ${G(P.oH0)})
           - ${G(P.oLowK[2])} * aurSoftplus(${G(P.oLowK[0])} - h, ${G(P.oLowK[1])});
${P.oK.map(([k, s, d]) => `  lr -= ${G(d)} * aurSoftplus(h - ${G(k)}, ${G(s)});`).join('\n')}
  float r = exp(clamp(lr, -30., 30.));
  return r / (1. + r);
}
/* çökelme: alt kenar KESKİN (Gauss), üst kuyruk dağınık (üstel) */
float aurDep(float h, float hp){
  float d = (hp - h) / ${G(P.depLow)};
  float below = exp(-(d * d));
  float above = exp(-max(0., h - hp) / ${G(P.depUp)});
  return h < hp ? below : above;
}
/* 10^x — taşma korumalı */
float aurPow10(float x){ return exp2(min(20., x) * 3.321928095); }`;

/* Ashima simplex + fbm + ridge (sol/cosmos ile aynı gövde; NaN kuralı:
   her 1-|n| ridge()'den geçer, kareler çarpımla alınır) */
const NOISE_GLSL = `
vec3 mod289(vec3 x){return x - floor(x * (1./289.)) * 289.;}
vec4 mod289(vec4 x){return x - floor(x * (1./289.)) * 289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - .85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.);
  const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1. - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0., i1.z, i2.z, 1.))
        + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = .142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49. * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7. * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2. + 1.;
  vec4 s1 = floor(b1) * 2. + 1.;
  vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  m = m * m;
  return 42. * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm3(vec3 p){
  float value = 0.;
  float amplitude = .58;
  for (int i = 0; i < 3; i++) { value += amplitude * snoise(p); p *= 2.07; amplitude *= .5; }
  return value;
}
float ridge(float n){ return max(0., 1. - abs(n)); }`;

/* ═══════════════════════════════════════════════════════════════════
   3 · perde katmanları — kaç perde, hangi uzaklık çarpanı, hangi ağırlık
   ═══════════════════════════════════════════════════════════════════ */

const CURTAINS = [
  /* envW: uç sönümü GENİŞLİĞİ — uzak perdelerin uçları kadraj içinde
     bittiği için dar bir sönüm görünür DİKDÖRTGEN kenarı bırakıyordu */
  { dScale: 1.00, lenScale: 1.00, weight: 1.00, envW: 0.20, sheets: [0, 2.4] },
  { dScale: 1.62, lenScale: 0.92, weight: 0.45, envW: 0.36, sheets: [0, -3.0] },
  { dScale: 2.45, lenScale: 0.80, weight: 0.26, envW: 0.44, sheets: [0] },
];
const MAX_STARS = 3400;
const EXPORT_TIME = 16;

/* ═══════════════════════════════════════════════════════════════════
   4 · mountAurora
   ═══════════════════════════════════════════════════════════════════ */

export function mountAurora(container, options = {}) {
  if (!container) throw new Error('mountAurora requires a container element');

  const accent = options.accent || '#3FD98A';
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const frozen = exportMode || reducedMotion;
  const title = options.title || 'Aurora: çizgiler, yükseklik, aktivite';
  const seed = options.seed ?? 20260814;
  const chrome = options.chrome ?? 'full';        /* 'full' | 'none' (deste fonu) */

  /* activity: 0..1 ya da Kp 0..9 — ikisini de kabul et (kozmosla aynı
     dil; 1'den küçükse 0..1 ölçeği kabul edilip Kp'ye eşlenir) */
  const toKp = v => (v === undefined ? null : (v <= 1 ? v * 9 : v));

  const lines = Object.assign({ green: 1, red: 1, blue: 1, pink: 1 }, options.lines || {});
  const state = {
    kp: clamp(options.kp ?? toKp(options.activity) ?? 4, 0, 9),
    density: clamp(options.density ?? 1, 0.35, 2.6),     /* atom yoğunluğu çarpanı */
    lines,
    drift: options.drift ?? 0.28,                        /* perde ilerleme hızı, km/s ölçeği */
    artistic: options.artistic ?? false,
    artHue: options.artHue ?? 0.55,
    exposure: options.exposure ?? 1.35,
    paused: false,
    active: options.active ?? true,
    showStars: options.stars ?? true,
    showHorizon: options.horizon ?? true,
    showAxis: options.axis ?? true,
    showAirglow: options.airglow ?? true,
  };
  const finalPaused = () => state.paused || frozen || !state.active;

  /* ---- çizgi renkleri: dalga boyundan (CIE), elle hex YOK ---- */
  const PHYS_COLORS = {
    green: wavelengthRGB(557.7, 0.17),   /* mezopik/atmosfer beyazlatması: sunum kararı */
    red: wavelengthRGB(630.0, 0.05),
    blue: wavelengthRGB(427.8, 0.07),
    pink: wavelengthRGB(670.0, 0.05),    /* N₂ 1PG bant merkezi temsilcisi */
  };
  const artColors = () => ({
    green: hslRGB(state.artHue, 0.85, 0.55),
    red: hslRGB((state.artHue + 0.13) % 1, 0.9, 0.5),
    blue: hslRGB((state.artHue + 0.58) % 1, 0.9, 0.55),
    pink: hslRGB((state.artHue + 0.76) % 1, 0.9, 0.6),
  });
  const activeColors = () => (state.artistic ? artColors() : PHYS_COLORS);
  const hexOf = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');

  /* ═══ DOM ═══ */
  const figure = document.createElement('figure');
  figure.className = 'lunaris-preset';
  figure.dataset.style = 'cinematic';
  figure.dataset.palette = 'aurora-boreal-dark';
  figure.dataset.export = exportMode ? 'true' : 'false';
  figure.dataset.ownsKeys = '';
  figure.style.setProperty('--lunaris-accent', accent);
  figure.tabIndex = 0;
  figure.setAttribute('aria-label', title);

  const lineRow = (key, label, sub, max = 1.6) => `
    <label class="lunaris-preset__range aurora-line" data-line-row="${key}">
      <span>
        <span class="aurora-line__id"><i data-chip="${key}"></i>${label}</span>
        <output data-out="${key}">${state.lines[key].toFixed(2)}×</output>
      </span>
      <small class="aurora-line__sub">${sub}</small>
      <input data-input="${key}" aria-label="${label} şiddeti" type="range" min="0" max="${max}" step="0.05" value="${state.lines[key]}">
    </label>`;

  figure.innerHTML = `
    <div class="lunaris-preset__canvas" aria-hidden="true"></div>
    <svg class="aurora-axis" data-axis aria-hidden="true"></svg>
    <header class="lunaris-preset__heading"><span>AURORA · EMİSYON PRESET</span><h1>${title}</h1></header>
    <div class="lunaris-preset__controls" data-export-hide>
      <section class="lunaris-preset__panel lunaris-preset__panel--left" aria-label="Atmosfer ve çökelme">
        <span class="lunaris-preset__panel-title">Atmosfer &amp; çökelme</span>
        <label class="lunaris-preset__range">
          <span>Aktivite (Kp) <output data-out="kp">${state.kp.toFixed(1)}</output></span>
          <small class="aurora-line__sub">oval ekvatora genişler · elektronlar sertleşir</small>
          <input data-input="kp" aria-label="Aktivite Kp" type="range" min="0" max="9" step="0.1" value="${state.kp}">
        </label>
        <label class="lunaris-preset__range">
          <span>Atom yoğunluğu <output data-out="density">${state.density.toFixed(2)}×</output></span>
          <small class="aurora-line__sub">termosfer toplam sayı yoğunluğu n(h) çarpanı</small>
          <input data-input="density" aria-label="Atom yoğunluğu" type="range" min="0.35" max="2.6" step="0.05" value="${state.density}">
        </label>
        <p class="aurora-note" data-note></p>
        <label class="lunaris-preset__range">
          <span>Perde hızı <output data-out="drift">${state.drift.toFixed(2)}×</output></span>
          <input data-input="drift" aria-label="Perde hızı" type="range" min="0" max="1.6" step="0.05" value="${state.drift}">
        </label>
      </section>
      <section class="lunaris-preset__panel lunaris-preset__panel--right" aria-label="Emisyon çizgileri">
        <span class="lunaris-preset__panel-title">Emisyon çizgileri</span>
        ${lineRow('green', '557,7 nm', 'atomik oksijen O(¹S) · τ≈0,7 s · ~100–150 km')}
        ${lineRow('red', '630,0 nm', 'atomik oksijen O(¹D) · τ≈110 s · yalnız ≳200 km')}
        ${lineRow('blue', '427,8 nm', 'N₂⁺ birinci negatif (1NG) · ani · ≲110 km')}
        ${lineRow('pink', 'N₂ 1PG', 'azot birinci pozitif ~650–680 nm · 427,8 ile toplanınca PEMBE alt kenar (90–110 km)')}
        <div class="lunaris-preset__toggles">
          <label><input type="checkbox" data-toggle="artistic" ${state.artistic ? 'checked' : ''}> Serbest renk (sanatsal)</label>
          <label><input type="checkbox" data-toggle="showStars" ${state.showStars ? 'checked' : ''}> Yıldızlar</label>
          <label><input type="checkbox" data-toggle="showAxis" ${state.showAxis ? 'checked' : ''}> Yükseklik ekseni</label>
          <label><input type="checkbox" data-toggle="showHorizon" ${state.showHorizon ? 'checked' : ''}> Ufuk</label>
        </div>
        <label class="lunaris-preset__range" data-art-row hidden>
          <span>Serbest ton <output data-out="artHue">${Math.round(state.artHue * 360)}°</output></span>
          <input data-input="artHue" aria-label="Serbest renk tonu" type="range" min="0" max="1" step="0.01" value="${state.artHue}">
        </label>
        <div class="lunaris-preset__button-row">
          <button type="button" data-action="pause" aria-pressed="false">Durdur</button>
          <button type="button" data-action="reset">Sıfırla</button>
          <button type="button" data-action="fullscreen">Tam ekran</button>
        </div>
      </section>
    </div>
    <figcaption class="lunaris-preset__truth">
      <strong>Çizgiler ve yükseklikler gerçek · parlaklık alanı temsilî</strong>
      <span data-telemetry>—</span>
      <small data-truth-detail></small>
    </figcaption>
    <p class="lunaris-preset__help" data-export-hide>Sürükle: bakış · Boşluk: durdur · R: sıfırla · A: sanatsal renk</p>`;
  container.appendChild(figure);

  /* preset CSS'ine eklenen aurora'ya özgü parçalar; palet jetonları
     (aurora-boreal-dark) varsa onlardan, yoksa yerel yedekten okunur */
  const uiStyle = document.createElement('style');
  uiStyle.textContent = `
    .lunaris-preset[data-palette] { --aur-ink: var(--color-ink, #3FD98A); --aur-muted: var(--color-muted, #2C9A6A);
      --aur-surface: var(--color-surface, #0A2E3E); --aur-rule: var(--color-rule, #165446); }
    .aurora-axis { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
    /* eksen yazıları PARLAK perdenin üstünde de okunmalı: koyu kontur */
    .aurora-axis text { font: 600 17px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
      fill: var(--aur-ink); letter-spacing: .01em;
      paint-order: stroke; stroke: rgba(2, 8, 12, .92); stroke-width: 4px; stroke-linejoin: round; }
    .aurora-axis text.aurora-axis__unit { font-size: 15px; fill: var(--aur-muted); letter-spacing: .16em; }
    .aurora-axis text.aurora-axis__mark { font-size: 15px; font-weight: 700; }
    .aurora-axis line { paint-order: stroke; }
    .aurora-axis line.aurora-axis__spine { stroke: var(--aur-ink); stroke-width: 2; opacity: .8;
      filter: drop-shadow(0 0 3px rgba(2, 8, 12, .95)); }
    .aurora-axis line.aurora-axis__tick { stroke: var(--aur-ink); stroke-width: 2.5;
      filter: drop-shadow(0 0 3px rgba(2, 8, 12, .95)); }
    .aurora-axis line.aurora-axis__guide { stroke: #dff3e8; stroke-width: 1.2; stroke-dasharray: 3 9; opacity: .38; }
    .aurora-line__sub { color: #93a6b4; font-size: 15px; font-weight: 550; line-height: 1.25; margin-top: -4px; }
    .aurora-line__id { display: flex; align-items: center; gap: 9px; }
    .aurora-line__id i { width: 14px; height: 14px; border-radius: 4px; display: inline-block;
      box-shadow: 0 0 12px currentColor; background: currentColor; }
    .aurora-line { margin-top: 15px; gap: 7px; }
    .aurora-note { margin: 15px 0 0; padding: 11px 13px; border-left: 4px solid var(--aur-ink);
      background: color-mix(in srgb, var(--aur-surface) 70%, #06131b);
      color: #cfe0da; font-size: 16px; line-height: 1.38; font-weight: 550; }
    .aurora-note b { color: var(--aur-ink); font-weight: 800; }
    .lunaris-preset__panel .lunaris-preset__panel-title { cursor: pointer; user-select: none;
      display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .lunaris-preset__panel .lunaris-preset__panel-title::after { content: "▾"; font-size: 13px; transition: transform .18s ease; }
    .lunaris-preset__panel.is-collapsed .lunaris-preset__panel-title::after { transform: rotate(-90deg); }
    .lunaris-preset__panel.is-collapsed > :not(.lunaris-preset__panel-title) { display: none; }
    .lunaris-preset__panel.is-collapsed { width: auto; min-width: 168px; padding: 12px 18px; }
    .lunaris-preset__panel--left { top: 236px; width: 404px; }
    .lunaris-preset__panel--right { width: 430px; bottom: 40px; }
    .lunaris-preset__truth { width: min(640px, 44vw); }
    .lunaris-preset__truth.is-collapsed { width: auto; max-width: 640px; }
    .lunaris-preset__truth.is-collapsed small { display: none; }
    .lunaris-preset__truth { cursor: pointer; }
    .lunaris-preset__truth.is-artistic { border-left-color: #ffb347; }
    .aurora-warn { display: none; }
    .lunaris-preset__truth.is-artistic .aurora-warn { display: inline; color: #ffb347; font-weight: 800; }`;
  figure.appendChild(uiStyle);

  const canvasHost = figure.querySelector('.lunaris-preset__canvas');
  const axisSvg = figure.querySelector('[data-axis]');
  const telemetryEl = figure.querySelector('[data-telemetry]');
  const truthDetail = figure.querySelector('[data-truth-detail]');
  const truthBox = figure.querySelector('.lunaris-preset__truth');
  const noteEl = figure.querySelector('[data-note]');
  const artRow = figure.querySelector('[data-art-row]');

  truthBox.classList.add('is-collapsed');       /* gerçeklik BAŞLIĞI hep görünür, ayrıntı katlanır */
  truthBox.addEventListener('click', () => truthBox.classList.toggle('is-collapsed'));
  figure.querySelectorAll('.lunaris-preset__panel').forEach(panel => {
    const panelTitle = panel.querySelector('.lunaris-preset__panel-title');
    panelTitle.setAttribute('role', 'button');
    panelTitle.setAttribute('tabindex', '0');
    const toggle = () => panel.classList.toggle('is-collapsed');
    panelTitle.addEventListener('click', toggle);
    panelTitle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  if (chrome === 'none') {
    figure.querySelector('.lunaris-preset__controls')?.remove();
    figure.querySelector('.lunaris-preset__heading')?.remove();
    figure.querySelector('.lunaris-preset__help')?.remove();
    truthBox.remove();
  }

  /* ═══ renderer / sahne ═══ */
  const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  canvasHost.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03060d');
  const camera = new THREE.PerspectiveCamera(options.fov ?? 74, 1, 0.4, 9000);
  camera.position.set(0, 0.02, 0);
  camera.rotation.order = 'YXZ';

  /* ═══ paylaşılan uniform'lar (aynı NESNE tüm materyallerde) ═══ */
  const uTime = { value: frozen ? EXPORT_TIME : 0 };
  const uLogDens = { value: Math.log10(state.density) };
  const uFlux = { value: 1 };
  const uHPeak = { value: 110 };
  const uHPeakSoft = { value: H_PEAK_SOFT };
  const uFSoft = { value: 0.3 };
  const uExposure = { value: state.exposure };
  const uRayAmp = { value: 0.7 };
  const uPulse = { value: reducedMotion ? 0 : 0.12 };
  const uGain = { value: new THREE.Vector4(1, 1, 1, 1) };
  const uColG = { value: new THREE.Color() };
  const uColR = { value: new THREE.Color() };
  const uColB = { value: new THREE.Color() };
  const uColP = { value: new THREE.Color() };
  const uFoldAmp = { value: 0 };
  const uCurlA = { value: 0 };
  const uCurlW = { value: 90 };
  const uCurlX = { value: 0 };
  const uField = { value: new THREE.Vector3(P.fieldAz, 1, Math.tan(P.fieldTilt * Math.PI / 180)) };
  const uStarTwinkle = { value: reducedMotion ? 0 : 0.3 };
  const uPixelRatio = { value: 1 };

  /* ═══ perdeler ═══ */
  const CURTAIN_VERT = `
uniform float uTime, uDist, uLen, uArcR, uFoldAmp, uPhase, uSheet, uCurlA, uCurlW, uCurlX;
uniform vec3 uField;
varying float vH; varying float vU; varying float vS; varying float vV;
void main(){
  float u = position.x + .5;
  float v = position.y + .5;
  float h = ${G(P.hBase)} + ${G(P.hTop - P.hBase)} * pow(v, 1.55);

  float s = (u - .5) * uLen;                       /* perdeye SABİT yay koordinatı */
  float x = s;
  float z = -uDist - s * s / (2. * uArcR) + uSheet;

  /* katlar: gezici, C0; genlik aktiviteyle büyür */
  float fold = sin(s * .0140 + uTime * .21 + uPhase)
             + .55 * sin(s * .0345 - uTime * .34 + uPhase * 1.7)
             + .28 * sin(s * .0720 + uTime * .52 + uPhase * 2.3);
  z += fold * uFoldAmp;

  /* alt fırtına kopması: yerel dönme (batıya ilerleyen sarmal çıkıntı) */
  vec2 rel = vec2(x - uCurlX, z + uDist);
  float wgt = exp(-min(30., dot(rel, rel) / (uCurlW * uCurlW)));
  float a = uCurlA * wgt;
  float ca = cos(a), sa = sin(a);
  vec2 rot = vec2(rel.x * ca - rel.y * sa, rel.x * sa + rel.y * ca);
  x = uCurlX + rot.x;
  z = rot.y - uDist;

  /* manyetik alan çizgisi boyunca uzanma — ışınlar neredeyse dikey,
     üst uç ekvatora (gözlemciye) doğru eğik */
  float dh = h - ${G(P.hBase)};
  x += uField.x * dh;
  z += uField.z * dh;

  vH = h; vU = u; vS = s; vV = v;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, h, z, 1.);
}`;

  const CURTAIN_FRAG = `
precision highp float;
${ATMOS_GLSL}
${NOISE_GLSL}
uniform float uTime, uLogDens, uFlux, uHPeak, uHPeakSoft, uFSoft, uExposure,
              uRayAmp, uWeight, uPulse, uPhase, uSeedF, uEnvW;
uniform vec4 uGain;
uniform vec3 uColG, uColR, uColB, uColP;
varying float vH; varying float vU; varying float vS; varying float vV;
void main(){
  float ln = aurLogN(vH) + uLogDens;
  float q557 = 1. / (1. + aurPow10(ln - ${G(P.logNc557)}));
  float q630 = 1. / (1. + aurPow10(ln - ${G(P.logNc630)}));
  float o = aurFO(vH);
  float dH = (1. - uFSoft) * aurDep(vH, uHPeak);
  float dS = uFSoft * aurDep(vH, uHPeakSoft);

  /* alan çizgisine hizalı ışın demetleri: yay boyunca yapılı, yükseklik
     boyunca neredeyse değişmez (filamentler alan çizgisini izler) */
  float rn  = fbm3(vec3(vS * .052, vH * .0035, uSeedF));
  float rn2 = snoise(vec3(vS * .175, vH * .0018, uSeedF + 13.1));
  float rays = max(0., 1. + uRayAmp * (.78 * rn + .42 * rn2));
  float raysG = mix(1., rays, .88);      /* O(¹S) τ=0,7 s → hafif yumuşama */
  float raysR = mix(1., rays, .16);      /* O(¹D) τ=110 s → yapı SİLİNİR */

  float env = smoothstep(0., uEnvW, vU) * (1. - smoothstep(1. - uEnvW, 1., vU))
            * (1. - smoothstep(.88, 1., vV));
  float pulse = 1. + uPulse * sin(vS * .0062 + uTime * .23 + uPhase);

  float Ig = ${G(P.k557)} * (dH + ${G(P.softG)} * dS) * pow(max(o, 1e-4), .45) * q557 * raysG;
  float Ir = ${G(P.k630)} * (dS + ${G(P.hardR)} * dH) * o * q630 * raysR;
  float Ib = ${G(P.k4278)} * dH * (1. - o) * rays;
  float Ip = ${G(P.k1pg)} * dH * (1. - o) * (1. - smoothstep(${G(P.pgLo)}, ${G(P.pgHi)}, vH)) * rays;

  vec3 col = uColG * (Ig * uGain.x) + uColR * (Ir * uGain.y)
           + uColB * (Ib * uGain.z) + uColP * (Ip * uGain.w);
  col *= uFlux * env * pulse * uExposure * uWeight;
  col = col / (1. + .85 * col);          /* yumuşak omuz — tepe beyaza kırpılmasın */
  gl_FragColor = vec4(max(vec3(0.), col), 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  const curtainGeometry = new THREE.PlaneGeometry(1, 1, 200, 76);
  const curtainRand = mulberry32(seed ^ 0x51ed);
  const curtains = [];
  let order = 20;
  CURTAINS.forEach((def, ci) => {
    const phase = curtainRand() * 6.283;
    def.sheets.forEach((sheetOffset, si) => {
      const uDist = { value: 200 * def.dScale };
      const uLen = { value: 900 * def.lenScale };
      const uArcR = { value: 2400 * def.dScale };
      const uPhase = { value: phase + si * 0.9 };
      const uSheet = { value: sheetOffset };
      const uWeight = { value: def.weight * (si === 0 ? 1 : 0.42) };
      const uEnvW = { value: def.envW };
      const uSeedF = { value: curtainRand() * 40 };
      const material = new THREE.ShaderMaterial({
        vertexShader: CURTAIN_VERT,
        fragmentShader: CURTAIN_FRAG,
        uniforms: {
          uTime, uLogDens, uFlux, uHPeak, uHPeakSoft, uFSoft, uExposure, uRayAmp,
          uPulse, uGain, uColG, uColR, uColB, uColP, uFoldAmp, uCurlA, uCurlW, uCurlX,
          uField, uDist, uLen, uArcR, uPhase, uSheet, uWeight, uEnvW, uSeedF,
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(curtainGeometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = order--;          /* uzak perdeler önce */
      scene.add(mesh);
      curtains.push({ mesh, material, uDist, uLen, uArcR, uWeight, def, ci, si });
    });
  });

  /* ═══ yıldız alanı (kozmosun dili: ışıklılık yasası + kara cisim) ═══ */
  const STAR_A = 0.35, STAR_M0 = -1.2, STAR_M1 = 6.8;
  const sampleMagnitude = u => {
    const A0 = Math.pow(10, STAR_A * STAR_M0), A1 = Math.pow(10, STAR_A * STAR_M1);
    return Math.log10(A0 + u * (A1 - A0)) / STAR_A;
  };
  const starRand = mulberry32(seed);
  const starPos = new Float32Array(MAX_STARS * 3);
  const starCol = new Float32Array(MAX_STARS * 3);
  const starMag = new Float32Array(MAX_STARS);
  const starTw = new Float32Array(MAX_STARS);
  for (let i = 0; i < MAX_STARS; i++) {
    /* yalnız gökyüzü yarıküresi (ufkun altı görünmez) */
    const cosT = starRand() * 0.98 + 0.01;
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
    const phi = starRand() * Math.PI * 2;
    const R = 4200;
    starPos[i * 3] = R * sinT * Math.cos(phi);
    starPos[i * 3 + 1] = R * cosT;
    starPos[i * 3 + 2] = R * sinT * Math.sin(phi);
    const u = starRand();
    const m = sampleMagnitude(u);
    starMag[i] = m;
    const hot = u < 0.06 ? 1 : 0;
    const kelvin = 2600 + Math.pow(starRand(), 1.6) * (hot ? 12400 : 6200);
    const [r, g, b] = blackbodyRGB(kelvin);
    starCol[i * 3] = r; starCol[i * 3 + 1] = g; starCol[i * 3 + 2] = b;
    starTw[i] = u < 0.02 ? 1 : 0;         /* parıldama yalnız en parlak ~%2 */
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeometry.setAttribute('aColor', new THREE.BufferAttribute(starCol, 3));
  starGeometry.setAttribute('aMag', new THREE.BufferAttribute(starMag, 1));
  starGeometry.setAttribute('aTw', new THREE.BufferAttribute(starTw, 1));
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime, uPixelRatio, uTwinkle: uStarTwinkle },
    vertexShader: `
      attribute vec3 aColor; attribute float aMag; attribute float aTw;
      uniform float uTime, uPixelRatio, uTwinkle;
      varying vec3 vColor; varying float vI;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mv;
        float flux = pow(10., -.4 * (aMag + 1.2));
        float bright = clamp(pow(flux, .42), .05, 1.);
        /* atmosferik sönüm: ufka yaklaştıkça hava kütlesi büyür */
        float alt = normalize(position).y;
        float airmass = 1. / max(.045, alt);
        float ext = exp(-.23 * (min(airmass, 12.) - 1.));
        float tw = 1. + uTwinkle * aTw * (sin(uTime * 3.1 + aMag * 41.) * .5 + sin(uTime * 5.37 + aMag * 17.) * .5);
        vI = bright * ext * max(0., tw) * smoothstep(0., .035, alt);
        vColor = aColor;
        gl_PointSize = (1.75 + 2.1 * bright) * uPixelRatio;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vI;
      void main(){
        vec2 c = gl_PointCoord - .5;
        float k = max(0., 1. - dot(c, c) * 4.);
        gl_FragColor = vec4(vColor * vI * k * k, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.renderOrder = -3;
  stars.frustumCulled = false;
  scene.add(stars);

  /* ═══ hava parıltısı (airglow): 557,7 nm ~97 km katmanı, van Rhijn
     etkisiyle ufka doğru parlar (yol uzunluğu artar) ═══ */
  const airglowMaterial = new THREE.ShaderMaterial({
    uniforms: { uColG, uGain },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      uniform vec3 uColG; uniform vec4 uGain;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float sinZ = sqrt(max(0., 1. - d.y * d.y));
        float k = 6371. / (6371. + 97.);
        float vr = 1. / sqrt(max(.02, 1. - k * k * sinZ * sinZ));   /* van Rhijn */
        float ext = exp(-.30 * (min(1. / max(.05, d.y), 12.) - 1.));
        /* zenitte neredeyse yok, ufka doğru ~6× — gerçek davranış;
           aurora'dan bağımsız sabit ölçek (Kp ile değişmez) */
        float a = (min(6., vr) - .95) * ext * smoothstep(-.01, .06, d.y) * .0075;
        gl_FragColor = vec4(uColG * max(0., a) * uGain.x, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
  const airglow = new THREE.Mesh(new THREE.SphereGeometry(3900, 48, 24), airglowMaterial);
  airglow.renderOrder = -2;
  airglow.frustumCulled = false;
  scene.add(airglow);

  /* ═══ ufuk sırtı: ölçek verir ve uzak perdelerin ayağını gizler ═══ */
  const ridgeRand = mulberry32(seed ^ 0x2b17);
  const RIDGE_N = 320, RIDGE_R = 26, RIDGE_OCT = 16;
  const ridgeAmp = Array.from({ length: RIDGE_OCT }, () => ridgeRand());
  const ridgePh = Array.from({ length: RIDGE_OCT }, () => ridgeRand() * 6.283);
  const ridgeH = a => {
    let v = 0;
    for (let k = 0; k < RIDGE_OCT; k++) v += ridgeAmp[k] * Math.sin((k + 1) * a + ridgePh[k]) / Math.pow(k + 1, 0.70);
    return 0.50 + 0.58 * (v + 2.0);
  };
  const ridgePos = new Float32Array(RIDGE_N * 6 * 3);
  const ridgeTop = new Float32Array(RIDGE_N * 6);
  for (let i = 0; i < RIDGE_N; i++) {
    const a0 = (i / RIDGE_N) * Math.PI * 2, a1 = ((i + 1) / RIDGE_N) * Math.PI * 2;
    const p = (a, y) => [RIDGE_R * Math.sin(a), y, -RIDGE_R * Math.cos(a)];
    const h0 = ridgeH(a0), h1 = ridgeH(a1);
    const quad = [p(a0, -4), p(a1, -4), p(a1, h1), p(a0, -4), p(a1, h1), p(a0, h0)];
    const tops = [0, 0, 1, 0, 1, 1];
    for (let k = 0; k < 6; k++) {
      ridgePos.set(quad[k], (i * 6 + k) * 3);
      ridgeTop[i * 6 + k] = tops[k];
    }
  }
  const ridgeGeometry = new THREE.BufferGeometry();
  ridgeGeometry.setAttribute('position', new THREE.BufferAttribute(ridgePos, 3));
  ridgeGeometry.setAttribute('aTop', new THREE.BufferAttribute(ridgeTop, 1));
  const ridgeMaterial = new THREE.ShaderMaterial({
    uniforms: { uColG, uFlux },
    vertexShader: `attribute float aTop; varying float vTop;
      void main(){ vTop = aTop; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      uniform vec3 uColG; uniform float uFlux; varying float vTop;
      void main(){
        /* aurora kar/araziyi çok soluk aydınlatır — gerçek ama zayıf etki */
        vec3 base = vec3(.014, .020, .030);
        vec3 lit = base + uColG * (.030 * uFlux) * smoothstep(.45, 1., vTop);
        gl_FragColor = vec4(lit, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide, depthWrite: true, depthTest: true,
  });
  const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
  ridge.renderOrder = -5;
  ridge.frustumCulled = false;
  scene.add(ridge);

  /* ═══ yükseklik ekseni (SVG bindirmesi — 3B izdüşümden okunur) ═══ */
  const AXIS_TICKS = [100, 150, 200, 250, 300, 350];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const mkSvg = (tag, cls) => { const e = document.createElementNS(SVGNS, tag); if (cls) e.setAttribute('class', cls); axisSvg.appendChild(e); return e; };
  const axisSpine = mkSvg('line', 'aurora-axis__spine');
  const axisUnit = mkSvg('text', 'aurora-axis__unit');
  axisUnit.textContent = 'YÜKSEKLİK / km';
  const axisItems = AXIS_TICKS.map(km => ({
    km,
    tick: mkSvg('line', 'aurora-axis__tick'),
    guide: mkSvg('line', 'aurora-axis__guide'),
    label: mkSvg('text'),
  }));
  axisItems.forEach(it => { it.label.textContent = String(it.km); });
  const axisMarks = [
    { key: 'peak', line: mkSvg('line', 'aurora-axis__tick'), label: mkSvg('text', 'aurora-axis__mark') },
    { key: 'red', line: mkSvg('line', 'aurora-axis__tick'), label: mkSvg('text', 'aurora-axis__mark') },
  ];

  const projectAlt = (h, dist) => {
    const dh = h - P.hBase;
    const v = new THREE.Vector3(P.fieldAz * dh, h, -dist + uField.value.z * dh);
    v.project(camera);
    return v;
  };

  const updateAxis = () => {
    const w = canvasHost.clientWidth || 2, ht = canvasHost.clientHeight || 2;
    axisSvg.setAttribute('viewBox', `0 0 ${w} ${ht}`);
    if (!state.showAxis || chrome === 'none') { axisSvg.style.display = 'none'; return; }
    axisSvg.style.display = '';
    const dist = curtains[0].uDist.value;
    const axisX = Math.round(w - Math.max(190, w * 0.32));   /* sağ panelin SOLUNDA kalsın */
    const yOf = h => {
      const v = projectAlt(h, dist);
      return (v.z > 1 || v.z < -1) ? null : (-v.y * 0.5 + 0.5) * ht;
    };
    const ys = axisItems.map(it => yOf(it.km));
    const good = ys.filter(y => y !== null && y > 30 && y < ht - 30);
    if (good.length >= 2) {
      axisSpine.setAttribute('x1', axisX); axisSpine.setAttribute('x2', axisX);
      axisSpine.setAttribute('y1', Math.min(...good) - 18); axisSpine.setAttribute('y2', Math.max(...good) + 18);
      axisSpine.style.display = '';
    } else axisSpine.style.display = 'none';
    axisItems.forEach((it, i) => {
      const y = ys[i];
      const vis = y !== null && y > 24 && y < ht - 24;
      [it.tick, it.guide, it.label].forEach(e => { e.style.display = vis ? '' : 'none'; });
      if (!vis) return;
      it.tick.setAttribute('x1', axisX); it.tick.setAttribute('x2', axisX + 13);
      it.tick.setAttribute('y1', y); it.tick.setAttribute('y2', y);
      it.guide.setAttribute('x1', axisX - 8); it.guide.setAttribute('x2', Math.max(60, axisX - w * 0.30));
      it.guide.setAttribute('y1', y); it.guide.setAttribute('y2', y);
      it.label.setAttribute('x', axisX + 19); it.label.setAttribute('y', y + 6);
    });
    const topY = good.length ? Math.min(...good) : 60;
    axisUnit.setAttribute('x', axisX - 10);
    axisUnit.setAttribute('y', topY - 30);
    axisUnit.setAttribute('text-anchor', 'end');
    const marks = [
      { key: 'peak', h: uHPeak.value, text: `çökelme tepesi ${Math.round(uHPeak.value)} km`, color: hexOf(activeColors().green) },
      { key: 'red', h: state.lines.red > 0.001 ? redBaseAltitude(state.kp, state.density) : null, text: null, color: hexOf(activeColors().red) },
    ];
    const rb = marks[1].h;
    marks[1].text = rb ? `630,0 tabanı ${Math.round(rb)} km` : '630,0 sönmüş';
    axisMarks.forEach((m, i) => {
      const spec = marks[i];
      const y = spec.h ? yOf(spec.h) : null;
      const vis = y !== null && y > 24 && y < ht - 24;
      m.line.style.display = vis ? '' : 'none';
      m.label.style.display = vis ? '' : 'none';
      if (!vis) return;
      m.line.setAttribute('x1', axisX - 22); m.line.setAttribute('x2', axisX + 13);
      m.line.setAttribute('y1', y); m.line.setAttribute('y2', y);
      m.line.setAttribute('stroke', spec.color);
      m.label.setAttribute('x', axisX - 28);
      m.label.setAttribute('y', y + 5);
      m.label.setAttribute('text-anchor', 'end');
      m.label.setAttribute('fill', spec.color);
      m.label.textContent = spec.text;
    });
  };

  /* ═══ kamera: otomatik yükseliş (Kp ile) + elle bakış ═══ */
  let pitchAuto = 0, pitchManual = 0, yawManual = 0;
  const pitchTarget = () => {
    const d = curtains[0].uDist.value;
    return clamp(Math.atan2(175, Math.max(20, d - 10.6)), 15 * Math.PI / 180, 47 * Math.PI / 180);
  };
  const applyCamera = () => {
    camera.rotation.y = yawManual;
    camera.rotation.x = clamp(pitchAuto + pitchManual, -0.25, 1.42);
  };

  let dragging = false, lastX = 0, lastY = 0;
  const onDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId); };
  const onMove = e => {
    if (!dragging) return;
    yawManual -= (e.clientX - lastX) * 0.0022;
    pitchManual = clamp(pitchManual - (e.clientY - lastY) * 0.0022, -0.9, 0.9);
    lastX = e.clientX; lastY = e.clientY;
    applyCamera();
    if (finalPaused()) renderOnce();
  };
  const onUp = e => { dragging = false; renderer.domElement.releasePointerCapture?.(e.pointerId); };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onUp);
  renderer.domElement.style.touchAction = 'none';

  /* ═══ türetilmiş fizik → uniform'lar + yazı ═══ */
  const morph = () => ({
    rays: smoothstepJS(1.0, 3.5, state.kp),
    folds: smoothstepJS(2.5, 5.5, state.kp),
    curl: smoothstepJS(5.0, 8.0, state.kp),
  });
  const formName = () => {
    if (state.kp < 1.6) return 'homojen yay';
    if (state.kp < 3.4) return 'ışınlı yay';
    if (state.kp < 5.6) return 'katlanan perde';
    if (state.kp < 7.4) return 'alt fırtına başlangıcı';
    return 'alt fırtına kopması';
  };

  const applyPhysics = () => {
    const kp = state.kp, dens = state.density;
    const E0 = E0ofKp(kp);
    const dShift = P.densShift * Math.log(dens);
    uHPeak.value = hPeakOf(E0) + dShift;
    uHPeakSoft.value = H_PEAK_SOFT + dShift;
    uFSoft.value = P.fSoftA - P.fSoftB * kp;
    uFlux.value = P.fluxA + P.fluxB * kp;
    uLogDens.value = Math.log10(dens);
    /* GÖSTERİM sıkıştırması (fiziksel değil, açıkça deklare): gerçek
       enerji akısı Kp ile ~13× değişir; ekranda bunun tamamı ya beyaza
       kırpar ya sakin yayı görünmez bırakırdı. Görünen parlaklık
       akının KAREKÖKÜ ile ölçeklenir — sıra korunur, tavan korunur. */
    uExposure.value = state.exposure * Math.pow(uFlux.value, -0.62);
    uPulse.value = reducedMotion ? 0 : 0.12;

    const m = morph();
    uRayAmp.value = 0.12 + 0.85 * m.rays;
    /* oval ekvatora doğru genişledikçe yay gözlemciye YAKLAŞIR (sınır
       enlemi ≈ 67° − 2·Kp'nin yumuşatılmış eşlemesi; mutlak uzaklık
       kadraj kararıdır, limitations'ta yazılı) */
    const dist0 = 130 + 340 * Math.exp(-0.30 * kp);
    curtains.forEach(c => {
      c.uDist.value = dist0 * c.def.dScale;
      c.uArcR.value = 2400 * c.def.dScale;
      c.uLen.value = 900 * c.def.lenScale;
    });
    uFoldAmp.value = Math.min(0.26 * dist0, 3 + 30 * m.folds);
    uCurlA.value = 2.3 * m.curl;
    uCurlW.value = 60 + 40 * m.curl;

    uGain.value.set(state.lines.green, state.lines.red, state.lines.blue, state.lines.pink);
    const c = activeColors();
    uColG.value.setRGB(...c.green);
    uColR.value.setRGB(...c.red);
    uColB.value.setRGB(...c.blue);
    uColP.value.setRGB(...c.pink);

    stars.visible = state.showStars;
    ridge.visible = state.showHorizon;
    airglow.visible = state.showAirglow && !state.artistic;
    uStarTwinkle.value = reducedMotion ? 0 : 0.3;

    pitchAuto = frozen ? pitchTarget() : pitchAuto;
    applyCamera();
    syncText();
  };

  const syncText = () => {
    if (chrome === 'none') return;
    const kp = state.kp, dens = state.density;
    const E0 = E0ofKp(kp);
    const rb = redBaseAltitude(kp, dens);
    const dist = curtains[0].uDist.value;
    const c = activeColors();
    figure.querySelectorAll('[data-chip]').forEach(el => { el.style.color = hexOf(c[el.dataset.chip]); });
    const redOff = state.lines.red <= 0.001;
    telemetryEl.textContent =
      (state.artistic ? 'SERBEST RENK — RENKLER FİZİKSEL DEĞİL · ' : '')
      + `Kp ${kp.toFixed(1)} · ${formName()} · E₀ ≈ ${E0.toFixed(1)} keV · alt kenar ≈ ${Math.round(uHPeak.value)} km · `
      + (redOff ? '630,0 kapalı' : rb ? `630,0 tabanı ≈ ${Math.round(rb)} km` : '630,0 sönümlenmiş')
      + ` · uzaklık ≈ ${Math.round(dist)} km`;
    /* yoğunluk kaydırıcısının NEDENİ — tek satır, ekranda */
    const refBase = redBaseAltitude(kp, 1);
    const dir = rb && refBase ? (rb > refBase + 3 ? 'yükseldi' : rb < refBase - 3 ? 'alçaldı' : 'yerinde') : 'yükseldi';
    noteEl.innerHTML = state.artistic
      ? `<b>SERBEST RENK</b> — renkler dalga boyundan değil ton kaydırıcısından geliyor. Katmanlanma (yükseklik sırası) hâlâ fiziksel, RENK <b>fiziksel değil</b>.`
      : `n × ${dens.toFixed(2)} → 630,0 nm O(¹D) çarpışmalı sönümleme tabanı <b>${rb ? Math.round(rb) + ' km' : 'ekranın dışında'}</b> (${dir}). `
        + `τ≈110 s'lik metastabil durum, yoğun havada ışıma yapamadan çarpışmayla bozulur: yoğunluk arttıkça kırmızı <b>fiziksel olarak</b> söner.`;
    truthBox.classList.toggle('is-artistic', state.artistic);
    truthDetail.innerHTML =
      `<span class="aurora-warn">RENKLER FİZİKSEL DEĞİL (serbest kip). </span>`
      + `Gerçek: dört çizginin kimliği ve yükseklik sırası — 557,7 nm O(¹S) (τ≈0,7 s, ~100–150 km), 630,0 nm O(¹D) (τ≈110 s, `
      + `n_kritik = A/k ≈ 4,5×10⁸ cm⁻³ → pratikte ≳200 km), 427,8 nm N₂⁺ 1NG (ani, ≲110 km), N₂ 1PG ~650–680 nm (alt kenar 90–110 km; `
      + `PEMBE bu kırmızının 427,8 moruyla toplamıdır). Sönümleme oranları gerçek A ve k katsayılarından; atmosfer profili MSIS benzeri; `
      + `çökelme tepesi h ≈ 86 + 130/(1+(E₀/2,2)^1,1) km; renkler CIE 1931 eşleme fonksiyonlarından türetildi. `
      + `Temsilî: parlaklık ALANI — kat dalga boyları, ışın genlikleri, perde uzunlukları ve Kp→E₀/akı eşlemesi stilizedir; `
      + `bu bir çökelme/taşınım simülasyonu DEĞİLDİR. Dünya eğriliği ve yolboyu ışıma toplamı ihmal edildi; alan çizgisi eğimi ${P.fieldTilt}° `
      + `(gerçek I≈78° yerine kadraj için yumuşatıldı).`;
  };

  /* ═══ döngü ═══ */
  let frame = null, lastNow = 0;
  const renderOnce = () => { renderer.render(scene, camera); updateAxis(); };

  const stepSim = dt => {
    uTime.value += dt * (0.35 + 0.9 * state.drift);
    /* batıya ilerleyen çıkıntı — sarmal merkezi kayar (sarma sabit hızda) */
    const span = curtains[0].uLen.value * 0.5;
    const speed = 2.5 + 7 * smoothstepJS(5.0, 9.0, state.kp);
    uCurlX.value = -span + ((uTime.value * speed) % (2 * span));
    if (!frozen) {
      const tau = 1.15;
      pitchAuto += (pitchTarget() - pitchAuto) * (1 - Math.exp(-dt / tau));
      applyCamera();
    }
  };

  const loop = () => {
    frame = null;
    if (finalPaused() || document.hidden) return;
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    stepSim(dt);
    renderOnce();
    frame = requestAnimationFrame(loop);
  };
  const ensureLoop = () => {
    if (finalPaused() || document.hidden) { renderOnce(); return; }
    if (frame === null) { lastNow = performance.now(); frame = requestAnimationFrame(loop); }
  };
  const onVisibility = () => ensureLoop();
  document.addEventListener('visibilitychange', onVisibility);

  const resize = () => {
    const width = Math.max(2, canvasHost.clientWidth);
    const height = Math.max(2, canvasHost.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    uPixelRatio.value = dpr;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderOnce();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);

  /* ═══ seçenek yolu (UI + setParams ortak) ═══ */
  const setParams = (partial = {}) => {
    if (partial.kp !== undefined) state.kp = clamp(partial.kp, 0, 9);
    if (partial.activity !== undefined) state.kp = clamp(toKp(partial.activity), 0, 9);
    if (partial.density !== undefined) state.density = clamp(partial.density, 0.35, 2.6);
    if (partial.lines) for (const k of ['green', 'red', 'blue', 'pink']) {
      if (partial.lines[k] !== undefined) state.lines[k] = clamp(partial.lines[k], 0, 1.6);
    }
    if (partial.drift !== undefined) state.drift = clamp(partial.drift, 0, 1.6);
    if (partial.artistic !== undefined) state.artistic = Boolean(partial.artistic);
    if (partial.artHue !== undefined) state.artHue = clamp(partial.artHue, 0, 1);
    if (partial.exposure !== undefined) state.exposure = clamp(partial.exposure, 0.2, 6);
    if (partial.stars !== undefined) state.showStars = Boolean(partial.stars);
    if (partial.horizon !== undefined) state.showHorizon = Boolean(partial.horizon);
    if (partial.axis !== undefined) state.showAxis = Boolean(partial.axis);
    if (partial.airglow !== undefined) state.showAirglow = Boolean(partial.airglow);
    applyPhysics();
    syncInputs();
    ensureLoop();
    return { ...state };
  };

  /* ═══ UI bağları ═══ */
  const outs = {};
  const bindRange = (key, fmt, onSet) => {
    const input = figure.querySelector(`[data-input="${key}"]`);
    if (!input) return;
    const out = figure.querySelector(`[data-out="${key}"]`);
    outs[key] = { input, out, fmt };
    input.addEventListener('input', event => {
      onSet(Number(event.target.value));
      if (out) out.textContent = fmt(Number(event.target.value));
      applyPhysics();
      ensureLoop();
    });
  };
  if (chrome !== 'none') {
    bindRange('kp', v => v.toFixed(1), v => { state.kp = v; });
    bindRange('density', v => `${v.toFixed(2)}×`, v => { state.density = v; });
    bindRange('drift', v => `${v.toFixed(2)}×`, v => { state.drift = v; });
    bindRange('artHue', v => `${Math.round(v * 360)}°`, v => { state.artHue = v; });
    for (const k of ['green', 'red', 'blue', 'pink']) bindRange(k, v => `${v.toFixed(2)}×`, v => { state.lines[k] = v; });
    figure.querySelectorAll('[data-toggle]').forEach(input => input.addEventListener('change', () => {
      const key = input.dataset.toggle;
      if (key === 'artistic') state.artistic = input.checked;
      else state[key] = input.checked;
      artRow.hidden = !state.artistic;
      applyPhysics();
      ensureLoop();
    }));
  }
  const syncInputs = () => {
    if (chrome === 'none') return;
    const set = (key, value) => { const o = outs[key]; if (!o) return; o.input.value = value; if (o.out) o.out.textContent = o.fmt(value); };
    set('kp', state.kp); set('density', state.density); set('drift', state.drift); set('artHue', state.artHue);
    for (const k of ['green', 'red', 'blue', 'pink']) set(k, state.lines[k]);
    const t = sel => figure.querySelector(`[data-toggle="${sel}"]`);
    if (t('artistic')) t('artistic').checked = state.artistic;
    if (t('showStars')) t('showStars').checked = state.showStars;
    if (t('showAxis')) t('showAxis').checked = state.showAxis;
    if (t('showHorizon')) t('showHorizon').checked = state.showHorizon;
    artRow.hidden = !state.artistic;
  };

  const pauseButton = figure.querySelector('[data-action="pause"]');
  const syncPause = () => {
    if (!pauseButton) return;
    pauseButton.textContent = reducedMotion ? 'Hareket kapalı' : state.paused ? 'Oynat' : 'Durdur';
    pauseButton.setAttribute('aria-pressed', String(state.paused || reducedMotion));
    pauseButton.disabled = reducedMotion;
    ensureLoop();
  };
  const resetView = () => { yawManual = 0; pitchManual = 0; pitchAuto = pitchTarget(); applyCamera(); renderOnce(); };
  if (chrome !== 'none') {
    pauseButton.addEventListener('click', () => { state.paused = !state.paused; syncPause(); });
    figure.querySelector('[data-action="reset"]').addEventListener('click', resetView);
    figure.querySelector('[data-action="fullscreen"]').addEventListener('click', () => figure.requestFullscreen?.());
    figure.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      if (event.code === 'Space') { event.preventDefault(); state.paused = !state.paused; syncPause(); }
      const k = event.key.toLowerCase();
      if (k === 'r') resetView();
      if (k === 'a') { state.artistic = !state.artistic; applyPhysics(); syncInputs(); ensureLoop(); }
      if (event.key === 'Escape') { state.paused = true; syncPause(); }
    });
  }

  /* ═══ ilk kare ═══ */
  applyPhysics();
  pitchAuto = pitchTarget();
  applyCamera();
  resize();
  if (frozen) stepSim(0);        /* donmuş tabloda sarmal merkezini yerleştir */
  syncPause();
  renderOnce();
  ensureLoop();

  return {
    figure,
    canvas: renderer.domElement,
    renderer,
    setParams,
    setOptions: setParams,          /* kozmosla aynı ad da çalışsın */
    physics: { emission, log10n, fOxygen, depos, hPeakOf, E0ofKp, redBaseAltitude, constants: P },
    lineColors: () => activeColors(),
    _state: state,
    advance: seconds => { stepSim(seconds); renderOnce(); },
    pause: () => { state.paused = true; syncPause(); },
    play: () => { state.paused = false; syncPause(); },
    resetView,
    setActive: value => { state.active = Boolean(value); ensureLoop(); },
    dispose: () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      curtainGeometry.dispose();
      starGeometry.dispose();
      ridgeGeometry.dispose();
      airglow.geometry.dispose();
      [...curtains.map(c => c.material), starMaterial, ridgeMaterial, airglowMaterial].forEach(m => m.dispose());
      renderer.dispose();
      figure.remove();
    },
  };
}

export default mountAurora;
