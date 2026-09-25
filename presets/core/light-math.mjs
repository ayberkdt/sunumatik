/* light-math.mjs — IŞIK FİZİĞİ ÇEKİRDEĞİ (three'siz, DOM'suz, saf).
 * docs/light-physics-plan.md §2 ve §12-F0.
 *
 * Bu dosyanın tek işi şu: sahnedeki hiçbir rengin ve hiçbir parlaklığın
 * "böyle güzel duruyordu" diye seçilmemesini sağlamak. Üç meşru renk
 * kaynağı vardır, dördüncüsü yoktur:
 *
 *   1. RENK = SICAKLIK  — Planck ışıması → CIE 1931 → doğrusal sRGB.
 *      Alev, sıcak metal, yıldız, akresyon diski buradan renk alır.
 *   2. RENK = KİMYA     — emisyon hatları (CH 431 nm, C₂ 516 nm, Xe 460 nm…).
 *      İyon iticisi, metalox çekirdeği, auroranın 557,7 nm'si buradan.
 *   3. RENK = YANSIMA   — albedo × aydınlatan ışık.
 *
 * İkinci iş: ORTAM. Vakumda alev yanmaz (oksijen yok) ve ışık huzmesi
 * GÖRÜNMEZ (saçacak ortam yok). Bu bir üslup tercihi değil; `envAllows`
 * uyumsuz olguyu reddeder ve yerine ne konacağını söyler.
 *
 * Üçüncü iş: BİRİM. three.js r184 ışık şiddetleri fizikseldir — yönlü
 * ışık lux, nokta/spot kandela, decay = 2 her zaman. Pozlama EV100
 * üstünden kurulur; "intensity 3.0" gibi gözle seçilmiş sayı kalmaz.
 *
 * API: blackbodyRGB · emissionLineRGB · reflectedRGB · flickerField
 *      envAllows · ENVIRONMENTS · PROPELLANTS · illuminanceAt · ev100
 *      exposureFromEV · luxToScreen · magnitudeToScreen · oppositionSurge
 *      planck · cieXYZ · xyzToLinearSRGB
 */

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;

/* ── fiziksel sabitler (SI) ─────────────────────────────────────────── */
export const CONST = Object.freeze({
  h: 6.62607015e-34,      // Planck sabiti, J·s
  c: 2.99792458e8,        // ışık hızı, m/s
  kB: 1.380649e-23,       // Boltzmann, J/K
  K_CAL: 12.5,            // pozlama ölçer kalibrasyonu (ISO 2720, yansıyan ışık)
  GRAY_CARD: 0.18,        // orta gri
});

/** Planck spektral ışıması B(λ, T) — λ metre, çıkış W·sr⁻¹·m⁻³. */
export function planck(lambdaM, T) {
  const { h, c, kB } = CONST;
  if (!(T > 0) || !(lambdaM > 0)) return 0;
  const l5 = lambdaM ** 5;
  const x = (h * c) / (lambdaM * kB * T);
  /* exp taşmasını engelle: x > 700'de payda zaten sonsuz */
  if (x > 700) return 0;
  return (2 * h * c * c) / (l5 * (Math.expm1(x)));
}

/* ── CIE 1931 renk eşleme fonksiyonları ─────────────────────────────────
   Wyman, Sloan & Shirley (2013) "Simple Analytic Approximations to the
   CIE XYZ Color Matching Functions", JCGT 2(2) — çok loblu parçalı
   Gauss uyumu. Tam tablo yerine bu seçildi çünkü YAYIMLANMIŞ ve
   izlenebilir bir uyum; "gözle ayarlanmış eğri" değil. */
const gauss = (x, mu, s1, s2) => {
  const s = x < mu ? s1 : s2;
  const t = (x - mu) / s;
  return Math.exp(-0.5 * t * t);
};
export function cieX(nm) {
  return 1.056 * gauss(nm, 599.8, 37.9, 31.0)
    + 0.362 * gauss(nm, 442.0, 16.0, 26.7)
    - 0.065 * gauss(nm, 501.1, 20.4, 26.2);
}
export function cieY(nm) {
  return 0.821 * gauss(nm, 568.8, 46.9, 40.5)
    + 0.286 * gauss(nm, 530.9, 16.3, 31.1);
}
export function cieZ(nm) {
  return 1.217 * gauss(nm, 437.0, 11.8, 36.0)
    + 0.681 * gauss(nm, 459.0, 26.0, 13.8);
}

/** Spektral güç dağılımını (nm → değer) XYZ'ye indirger. */
export function cieXYZ(spd, { from = 360, to = 830, step = 5 } = {}) {
  let X = 0, Y = 0, Z = 0;
  for (let nm = from; nm <= to; nm += step) {
    const v = spd(nm);
    if (!Number.isFinite(v) || v <= 0) continue;
    X += v * cieX(nm); Y += v * cieY(nm); Z += v * cieZ(nm);
  }
  return [X * step, Y * step, Z * step];
}

/* sRGB (IEC 61966-2-1) birincilleri, D65 beyaz — DOĞRUSAL çıkış.
   Gama uygulanmaz: three.js malzeme renkleri doğrusal uzayda yaşar ve
   çıkışta `outputColorSpace` gamayı kendisi verir. İki kez gama, geçen
   turda araziyi kömüre çevirmişti. */
export function xyzToLinearSRGB([X, Y, Z]) {
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Kara cisim rengi: sıcaklık → doğrusal sRGB.
 *
 * `normalize`:
 *   'peak'  (varsayılan) en parlak bileşen 1 — malzeme rengi için
 *   'luminance' Y = 1 — ışık rengi × şiddet ayrı verilecekse
 *   'white' 6504 K'yi (1,1,1) yapan von Kries dengelemesi
 *   'none'  ham (çok büyük sayılar)
 *
 * NOT: 'peak' ile 6504 K (1, 0,945, 0,994) verir, (1,1,1) DEĞİL — çünkü
 * 6504 K Planck ışıması D65 değildir (ölçülen xy 0,3134/0,3237; D65
 * 0,3127/0,3290). Bu bir hata değil, olgunun kendisi. "Beyaz görünsün"
 * isteyen 'white' seçer ve bunu bilerek seçmiş olur.
 *
 * R2 (plan §14): gözlenen sıcaklık Doppler ve gravitasyonel kızıla kayma
 * ile ÖLÇEKLENİR — spektrum kayar, renk onunla kayar:
 *   T_gözlenen = T · δ / (1 + z)
 * Akresyon diskinde yaklaşan kenar mavi ve parlak, uzaklaşan kenar kızıl
 * olur; bu bir "renk tonu" değil, aynı formülün sonucudur.
 */
export function blackbodyRGB(T, { normalize = 'peak', dopplerFactor = 1, gravRedshift = 0 } = {}) {
  const Tobs = T * dopplerFactor / (1 + gravRedshift);
  const xyz = cieXYZ(nm => planck(nm * 1e-9, Tobs));
  let rgb = xyzToLinearSRGB(xyz).map(v => Math.max(0, v));
  if (normalize === 'peak') {
    const m = Math.max(rgb[0], rgb[1], rgb[2]) || 1;
    rgb = rgb.map(v => v / m);
  } else if (normalize === 'luminance') {
    const Y = xyz[1] || 1;
    rgb = rgb.map(v => v / Y);
  } else if (normalize === 'white') {
    const w = whitePoint6504();
    rgb = rgb.map((v, i) => v / w[i]);
    const m = Math.max(rgb[0], rgb[1], rgb[2]) || 1;
    if (m > 1) rgb = rgb.map(v => v / m);
  }
  return rgb;
}

/* 6504 K'nin ham doğrusal sRGB'si — 'white' dengelemesinin böleni.
   Bir kez hesaplanır; her çağrıda Planck integrali almak pahalıdır. */
let _w6504 = null;
function whitePoint6504() {
  if (_w6504) return _w6504;
  const xyz = cieXYZ(nm => planck(nm * 1e-9, 6504));
  const rgb = xyzToLinearSRGB(xyz).map(v => Math.max(1e-9, v));
  const m = Math.max(...rgb);
  _w6504 = rgb.map(v => v / m);
  return _w6504;
}

/**
 * Emisyon hatlarından renk: [{ nm, w }] → doğrusal sRGB.
 * Hat genişliği verilmezse dar (2 nm) kabul edilir; gerçek bir spektrometre
 * çizgisi değil, o hattın GÖRÜNEN rengidir.
 */
export function emissionLineRGB(lines = [], { normalize = 'peak', width = 2 } = {}) {
  if (!lines.length) return [0, 0, 0];
  const spd = (nm) => {
    let s = 0;
    for (const L of lines) {
      const w = L.width ?? width;
      const d = (nm - L.nm) / w;
      s += (L.w ?? 1) * Math.exp(-0.5 * d * d);
    }
    return s;
  };
  const xyz = cieXYZ(spd, { step: 1 });
  let rgb = xyzToLinearSRGB(xyz).map(v => Math.max(0, v));
  if (normalize === 'peak') {
    const m = Math.max(rgb[0], rgb[1], rgb[2]) || 1;
    rgb = rgb.map(v => v / m);
  }
  return rgb;
}

/** Yansıyan renk: albedo × aydınlatan. Işık YARATMAZ, yalnız çarpar. */
export function reflectedRGB(albedoRGB, illuminantRGB) {
  return [0, 1, 2].map(i => Math.max(0, albedoRGB[i] * illuminantRGB[i]));
}

/* ── titreşim alanı (§2.3) ──────────────────────────────────────────────
   Alev, plüm, kıvılcım, ışık ve gölge AYNI alanı paylaşır. Ayrı ayrı
   titretilirse göz üçünü birbirinden ayırır ve sahne dağılır
   (craft-effects dersi: plüm, zemin jeti ve ışık aynı değeri okur).

   Güç spektrumu 1/f (pembe). Bileşenler LOGARİTMİK aralıklıdır, bu yüzden
   birim frekans başına bileşen yoğunluğu ∝ 1/f'tir; PSD'nin 1/f çıkması
   için genlik SABİT olmalıdır. (İlk sürümde genlik ∝ f^(−1/2) yazılmıştı;
   yoğunlukla çarpılınca PSD ∝ 1/f² oluyordu — denetim eğimi −2,70 ölçtü.)
   Bileşen sayısı, çizgi spektrumunun sürekli okunmasına yetecek kadar
   sıktır; frekanslar tohumlu sarsıntıyla ölçüşmez hâle gelir. Saf f(t, seed). */
export function flickerField(seed = 1, { band = [3, 30], amplitude = 0.15, octaves = 32 } = {}) {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const f0 = band[0], f1 = band[1];
  const katman = [];
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    /* φ aralıklı frekanslar: bandın içine logaritmik yayılır */
    const u = octaves === 1 ? 0 : i / (octaves - 1);
    const f = f0 * Math.pow(f1 / f0, u) * (1 + 0.07 * (rnd() - 0.5));
    const A = 1;                                 // log aralıkta SABİT genlik → PSD ∝ 1/f
    katman.push({ f, A, faz: rnd() * TAU, r: PHI ** (i % 3) });
    norm += A;
  }
  /* Rastgele fazlı N bileşenin toplamı √N ile büyür, N ile değil; genliği
     N'e bölmek alanı görünmez yapardı. Tepe değeri ilan edilen sınırda
     kalsın diye 3σ'ya göre ölçeklenir ve sınırda kırpılır. */
  const olcek = amplitude / (3 * Math.sqrt(katman.length / 2));
  const at = (t) => {
    let s = 0;
    for (const k of katman) s += k.A * Math.sin(TAU * k.f * t + k.faz);
    const v = s * olcek;
    return v > amplitude ? amplitude : v < -amplitude ? -amplitude : v;
  };
  /** Çarpan biçimi: 1 + titreşim (ışık şiddeti için). */
  at.gain = (t) => 1 + at(t);
  at.layers = katman;
  at.band = [f0, f1];
  at.amplitude = amplitude;
  return at;
}

/* ── ortam (§2.4) ───────────────────────────────────────────────────── */
export const ENVIRONMENTS = Object.freeze({
  vacuum: { medium: 'vacuum', scattering: 0, gravity: 1.62, pressure: 0, oxygen: false,
    ad: 'Vakum (Ay yüzeyi)', sunLux: 127000, skyLux: 0 },
  mars: { medium: 'mars', scattering: 0.35, gravity: 3.72, pressure: 610, oxygen: false,
    ad: 'Mars (ince CO₂)', sunLux: 55000, skyLux: 4200 },
  earth: { medium: 'earth', scattering: 1, gravity: 9.81, pressure: 101325, oxygen: true,
    ad: 'Dünya (deniz seviyesi)', sunLux: 100000, skyLux: 12000 },
  interior: { medium: 'interior', scattering: 0.12, gravity: 9.81, pressure: 101325, oxygen: true,
    ad: 'Basınçlı iç mekân', sunLux: 0, skyLux: 300 },
});

/* Olgu → ortam kuralı. Reddetmek yetmez; NE KONACAĞINI da söyler. */
const OLGU = {
  fire: { gerek: e => e.oxygen, neden: 'Açık alev oksijen ister; vakumda ve %95 CO₂ olan Mars atmosferinde yanma olmaz.',
    oneri: 'Plazma ark, LED meşale ya da kimyasal ışık çubuğu (üçü de oksijensiz çalışır).' },
  beam: { gerek: e => e.scattering > 0, neden: 'Işık huzmesi havadaki parçacıklardan saçılarak görünür; vakumda saçacak ortam yoktur, ışık kaynağı ile aydınlattığı yüzey arasında HİÇBİR ŞEY görünmez.',
    oneri: 'Zemindeki ışık deseni (IES profili) + varsa tozun aydınlanması; huzme çizme.' },
  smoke: { gerek: e => e.pressure > 100, neden: 'Duman asılı kalmak için atmosfer ister; vakumda plüm genleşip kaybolur.',
    oneri: 'Vakum plümü (genleşen, sönen) — craft-effects `vakum` tipi.' },
  dustSettle: { gerek: e => e.gravity > 0, neden: 'Toz çökelmesi yerçekimi ister.', oneri: 'Serbest sürüklenme.' },
  windDrift: { gerek: e => e.pressure > 100, neden: 'Rüzgâr sürüklenmesi atmosfer ister.', oneri: 'Balistik yol.' },
  heiligenschein: { gerek: e => e.medium === 'vacuum' || e.medium === 'mars', neden: 'Karşıtlık etkisi tozlu regolit yüzeyin geri saçılmasıdır.', oneri: 'Düz Lambert.' },
};

/** Olgu bu ortamda gerçek mi? { ok, neden, oneri } döner — sessiz geçiş yok. */
export function envAllows(olgu, env) {
  const e = typeof env === 'string' ? ENVIRONMENTS[env] : env;
  if (!e) throw new Error(`light-math: bilinmeyen ortam '${env}'`);
  const kural = OLGU[olgu];
  if (!kural) return { ok: true, neden: null, oneri: null, env: e };
  const ok = Boolean(kural.gerek(e));
  return { ok, neden: ok ? null : kural.neden, oneri: ok ? null : kural.oneri, env: e, olgu };
}

/** Reddi hata olarak isteyenler için. */
export function requireEnv(olgu, env) {
  const r = envAllows(olgu, env);
  if (!r.ok) throw new Error(`light-math: '${olgu}' ${r.env.ad} ortamında gerçek değil — ${r.neden} Öneri: ${r.oneri}`);
  return r;
}

export const PHENOMENA = Object.freeze(Object.keys(OLGU));

/* ── birimler ve pozlama (§2.1, §6.3) ───────────────────────────────── */

/** Ters kare: I kandela, d metre → lux. decay = 2 her zaman. */
export function illuminanceAt(candela, distanceM) {
  if (!(distanceM > 0)) return Infinity;
  return candela / (distanceM * distanceM);
}
/** Hedef aydınlatmayı veren kandela. */
export function candelaFor(lux, distanceM) { return lux * distanceM * distanceM; }

/** EV100: yansıyan ışık ölçümü, K = 12,5. */
export function ev100(luminance) {
  const L = Math.max(1e-6, luminance);
  return Math.log2(L * 100 / CONST.K_CAL);
}
/** Ortalama AYDINLATMADAN (lux) gri kart parlaklığı: L = E·ρ/π. */
export function luminanceFromLux(lux, albedo = CONST.GRAY_CARD) { return lux * albedo / Math.PI; }
/** EV100 → toneMappingExposure (ACES korunur). */
export function exposureFromEV(ev) { return 1 / (1.2 * Math.pow(2, ev)); }
/** Sahne aydınlatmasından doğrudan pozlama. */
export function exposureForLux(lux, albedo = CONST.GRAY_CARD) { return exposureFromEV(ev100(luminanceFromLux(lux, albedo))); }
/** Pozlanmış ekran değeri (0..1 öncesi, tonemap girdisi). */
export function luxToScreen(lux, exposure, albedo = CONST.GRAY_CARD) { return luminanceFromLux(lux, albedo) * exposure; }

/** R3: görünür kadir → bağıl akı → ekran değeri. m=0 referans. */
export function magnitudeToScreen(m, exposure, { zeroPointLux = 2.54e-6 } = {}) {
  const lux = zeroPointLux * Math.pow(10, -0.4 * m);
  return luxToScreen(lux, exposure, 1);
}

/**
 * Göz/kamera adaptasyonu: BİRİNCİ DERECEDEN üstel, yönü asimetrik.
 * Gerçek göz ışığa ~0,6 s'de, karanlığa dakikalarca uyum sağlar; sinematik
 * karşılığı 2,5 s'dir ve İLAN EDİLİR.
 *
 * Neden ikinci derece (kritik sönüm) değil: kritik sönümün kapalı formu
 * hızı da taşır, yani DURUM ister. Durumsuz bir imzada her karede sıfır
 * hızdan yeniden başlatılır ve (1+ωΔt)e^(−ωΔt) ≈ 1 − (ωΔt)²/2 olduğu için
 * adım küçüldükçe sönüm KAYBOLUR (denetim ölçtü: 12 saniye sonra 6,1 EV
 * kalıyordu, 1/60 ile 1/120 farklı yere gidiyordu). Üstel sönüm hem
 * aşımsız hem de kadanstan tam bağımsızdır: e^(−t/τ) çarpımsaldır.
 * Hız taşıyan sürüm gerekirse physical_rigs/rig-core stepSecondOrder.
 */
export function adaptEV(current, target, dt, { up = 0.6, down = 2.5 } = {}) {
  const tau = target > current ? up : down;      // daha parlak → hızlı kısıl
  const e = current - target;
  return target + e * Math.exp(-Math.max(0, dt) / Math.max(1e-3, tau));
}

/* ── regolit karşıtlık etkisi (§5.3) ────────────────────────────────────
   Hapke'nin sadeleştirilmiş gölge-gizleme terimi. Faz açısı g sıfıra
   giderken parlaklık artar: astronotun kendi gölgesinin başı çevresindeki
   hale (heiligenschein) tam olarak budur. */
export function oppositionSurge(phaseAngleRad, { B0 = 0.7, h = 0.05 } = {}) {
  const g = Math.abs(phaseAngleRad);
  return 1 + B0 / (1 + Math.tan(Math.min(g, Math.PI - 1e-6) / 2) / h);
}

/* ── yakıt kimyası (§4.2) ───────────────────────────────────────────── */
export const PROPELLANTS = Object.freeze({
  kerolox: { ad: 'RP-1 / LOX', T: 2600, lines: [], soot: 0.85, opacity: 0.9, smoke: 0.7,
    ornek: 'Falcon 9, Saturn V', gorunum: 'Parlak turuncu-sarı, isli, uzun alev' },
  hydrolox: { ad: 'LH₂ / LOX', T: 2900, lines: [{ nm: 440, w: 0.6 }, { nm: 470, w: 0.4 }], soot: 0.02, opacity: 0.12, smoke: 0,
    ornek: 'RS-25, Centaur', gorunum: 'Neredeyse görünmez, soluk mavi-mor; şok elmasları belirgin' },
  methalox: { ad: 'CH₄ / LOX', T: 2750, lines: [{ nm: 431, w: 1 }, { nm: 516, w: 0.7 }], soot: 0.18, opacity: 0.45, smoke: 0.15,
    ornek: 'Raptor, BE-4', gorunum: 'Mavi-mor çekirdek, açık turuncu dış' },
  hypergolic: { ad: 'MMH / NTO', T: 2000, lines: [{ nm: 590, w: 0.5 }, { nm: 620, w: 0.4 }], soot: 0.08, opacity: 0.2, smoke: 0.05,
    ornek: 'Apollo SPS/LM, RCS', gorunum: 'Saydam, soluk pembe-turuncu, kısa' },
  solid: { ad: 'APCP (katı)', T: 3000, lines: [], soot: 0.6, opacity: 1, smoke: 1,
    ornek: 'SRB', gorunum: 'Kör beyaz-sarı, Al₂O₃ parçacıkları, yoğun beyaz duman' },
  ion: { ad: 'Xe (Hall/ızgara)', T: 0, lines: [{ nm: 462, w: 1 }, { nm: 484, w: 0.8 }, { nm: 450, w: 0.5 }], soot: 0, opacity: 0.05, smoke: 0,
    ornek: 'NSTAR, BHT', gorunum: 'Soluk mavi ışıma, çok geniş huzme' },
  'cold-gas': { ad: 'N₂ (soğuk gaz)', T: 0, lines: [], soot: 0, opacity: 0, smoke: 0,
    ornek: 'RCS soğuk gaz', gorunum: 'GÖRÜNMEZ — plüm çizilmez; yalnız toz/buz varsa iz bırakır' },
});

/** Yakıtın görünen rengi: blackbody + emisyon karışımı. */
export function propellantRGB(key) {
  const p = PROPELLANTS[key];
  if (!p) throw new Error(`light-math: bilinmeyen yakıt '${key}'`);
  const bb = p.T > 0 ? blackbodyRGB(p.T) : [0, 0, 0];
  const em = p.lines.length ? emissionLineRGB(p.lines) : [0, 0, 0];
  if (p.T > 0 && p.lines.length) {
    /* is ne kadar baskınsa kara cisim o kadar öne çıkar */
    const w = p.soot;
    const mix = [0, 1, 2].map(i => bb[i] * w + em[i] * (1 - w));
    const m = Math.max(...mix) || 1;
    return mix.map(v => v / m);
  }
  return p.T > 0 ? bb : em;
}

/** Yakıtın görünürlüğü: 0 ise plüm ÇİZİLMEZ (soğuk gaz). */
export function propellantVisible(key) { return PROPELLANTS[key].opacity > 0; }

export { PHI, TAU, clamp01 };
