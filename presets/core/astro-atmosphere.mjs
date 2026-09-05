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
