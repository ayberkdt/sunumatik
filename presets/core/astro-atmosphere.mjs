/* astro-atmosphere.mjs — ABD Standart Atmosferi 1976 (US76), SAF modül.
   presets/core/ paylaşılan ALTYAPIDIR; THREE bağımlılığı YOKTUR, Node'da
   doğrudan import edilip sayısal olarak sınanır (scripts/validate-astro.mjs).

   MODEL
   ─────
   0–86 km: US76'nın yedi katmanlı sıcaklık profili (jeopotansiyel yükseklik,
   sabit sıcaklık gradyanları, hidrostatik denge, ideal gaz). Basınç her
   katmanda kapalı biçimle (izotermal katmanda üstel, gradyanlı katmanda
   kuvvet yasası) hesaplanır. 86 km üstü: sabit ölçek yüksekliğiyle (H≈6,9 km
   civarında, 86 km'deki değere bağlanan) üstel uzatma — US76'nın 86–1000 km
   arası ayrıntılı (difüzif denge, türe göre) modeli DEĞİLDİR; fırlatma ve
   giriş sunumlarında 86 km üstünde yoğunluk zaten ihmal mertebesindedir ve
   bu sadeleştirme q(t)'nin tepe değerini etkilemez (tepe 10–14 km'dedir).

   SINIRLAR: sürekli süreklilik (C0) korunur; rüzgâr, mevsim, enlem ve güneş
   aktivitesi yok. Ses hızı a = sqrt(γ R T), γ=1,4. */

export const G0 = 9.80665;          // m/s²
export const R_AIR = 287.05287;     // J/(kg·K)
export const GAMMA_AIR = 1.4;
export const R_EARTH_M = 6356766;   // US76 jeopotansiyel dönüşümünde kullanılan yarıçap (m)

/* Katman tabanları: [h_b (m, jeopotansiyel), T_b (K), L_b (K/m)] */
const LAYERS = [
  [0,     288.15, -0.0065],
  [11000, 216.65,  0.0],
  [20000, 216.65,  0.001],
  [32000, 228.65,  0.0028],
  [47000, 270.65,  0.0],
  [51000, 270.65, -0.0028],
  [71000, 214.65, -0.002],
  [84852, 186.946, 0.0],
];
const P0 = 101325;                  // Pa, deniz seviyesi

/* Katman taban basınçları bir kez üretilir (hidrostatik, kapalı biçim). */
const P_BASE = (() => {
  const p = [P0];
  for (let i = 1; i < LAYERS.length; i++) {
    const [hb, Tb, Lb] = LAYERS[i - 1];
    const h = LAYERS[i][0];
    const pb = p[i - 1];
    p.push(Lb === 0
      ? pb * Math.exp(-G0 * (h - hb) / (R_AIR * Tb))
      : pb * Math.pow(Tb / (Tb + Lb * (h - hb)), G0 / (R_AIR * Lb)));
  }
  return p;
})();
const H_TOP = LAYERS[LAYERS.length - 1][0];
const T_TOP = LAYERS[LAYERS.length - 1][1];
const P_TOP = P_BASE[P_BASE.length - 1];
const H_SCALE_TOP = R_AIR * T_TOP / G0;   // ≈ 5,47 km üstel uzatma ölçek yüksekliği (izotermal 186,9 K)

/* Geometrik yükseklik (m) → jeopotansiyel yükseklik (m). */
export const geopotential = z => R_EARTH_M * z / (R_EARTH_M + z);

/**
 * US76 atmosferi. z: GEOMETRİK yükseklik (m, deniz seviyesinden).
 * Döner: { T (K), p (Pa), rho (kg/m³), a (m/s ses hızı) }.
 * Negatif z: deniz seviyesine kenetlenir (fırlatma rampaları için).
 */
export function atmosphere(z) {
  const h = geopotential(Math.max(0, z));
  let T, p;
  if (h >= H_TOP) {
    T = T_TOP;
    p = P_TOP * Math.exp(-(h - H_TOP) / H_SCALE_TOP);
  } else {
    let i = LAYERS.length - 2;
    while (i > 0 && h < LAYERS[i][0]) i--;
    const [hb, Tb, Lb] = LAYERS[i];
    const pb = P_BASE[i];
    T = Tb + Lb * (h - hb);
    p = Lb === 0
      ? pb * Math.exp(-G0 * (h - hb) / (R_AIR * Tb))
      : pb * Math.pow(Tb / T, G0 / (R_AIR * Lb));
  }
  const rho = p / (R_AIR * T);
  return { T, p, rho, a: Math.sqrt(GAMMA_AIR * R_AIR * T) };
}

/** Yoğunluk kısayolu (kg/m³). */
export const density = z => atmosphere(z).rho;

/** Deniz seviyesi referansları. */
export const SEA_LEVEL = Object.freeze(atmosphere(0));

/** Dinamik basınç q = ½ ρ v² (Pa). v: hava-göreli hız (m/s). */
export const dynamicPressure = (z, vAir) => 0.5 * density(z) * vAir * vAir;

/* ── Termosfer için üstel-tablo modeli (Vallado, Fundamentals of Astrodynamics, Tablo 8-4;
   kaynağı US Standard Atmosphere 1976 + CIRA-72 karışımı). Parçalı üstel: ρ = ρ₀ exp(−(z − z₀)/H).
   0–1000 km; güneş aktivitesine bağlı 10× değişim MODELLENMEZ (ortalama koşul). 86 km altında
   US76 katmanlı model tercih edilir; densityBlend ikisini birleştirir. */
const EXP_TABLE = [
  [0, 1.225, 7.249], [25, 3.899e-2, 6.349], [30, 1.774e-2, 6.682], [40, 3.972e-3, 7.554], [50, 1.057e-3, 8.382],
  [60, 3.206e-4, 7.714], [70, 8.770e-5, 6.549], [80, 1.905e-5, 5.799], [90, 3.396e-6, 5.382], [100, 5.297e-7, 5.877],
  [110, 9.661e-8, 7.263], [120, 2.438e-8, 9.473], [130, 8.484e-9, 12.636], [140, 3.845e-9, 16.149], [150, 2.070e-9, 22.523],
  [180, 5.464e-10, 29.740], [200, 2.789e-10, 37.105], [250, 7.248e-11, 45.546], [300, 2.418e-11, 53.628], [350, 9.518e-12, 53.298],
  [400, 3.725e-12, 58.515], [450, 1.585e-12, 60.828], [500, 6.967e-13, 63.822], [600, 1.454e-13, 71.835], [700, 3.614e-14, 88.667],
  [800, 1.170e-14, 124.64], [900, 5.245e-15, 181.05], [1000, 3.019e-15, 268.00],
];
/** Üstel-tablo yoğunluğu (kg/m³), z geometrik yükseklik (m). */
export function densityExponential(z) {
  const km = Math.max(0, z / 1000);
  let i = EXP_TABLE.length - 1; while (i > 0 && km < EXP_TABLE[i][0]) i--;
  const [z0, rho0, H] = EXP_TABLE[i];
  return rho0 * Math.exp(-(km - z0) / H);
}
/** Birleşik yoğunluk: < 86 km US76 katmanlı, ≥ 90 km üstel tablo (86–90 km arası doğrusal karışım — C0). */
export function densityBlend(z) {
  if (z < 86e3) return atmosphere(z).rho;
  if (z < 90e3) { const f = (z - 86e3) / 4e3; return atmosphere(z).rho * (1 - f) + densityExponential(z) * f; }
  return densityExponential(z);
}
