/* terrain-noise.mjs — deterministik gürültü çekirdeği (three'siz, DOM'suz).

   Her fonksiyon seed'in SAF fonksiyonudur: Math.random / Date.now yok.
   Reçeteler lunar_descent ve surface-scene ile aynı aileden (mulberry32,
   izgara hash'li değer gürültüsü) — arazi kütüphanesi bu yüzden mevcut
   sahnelerle aynı "el yazısını" taşır. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

/** Tohumlu 2B değer gürültüsü: değer(x,z) ∈ [0,1], C1 sürekli (Hermite). */
export function valueNoise2D(seed) {
  const s = (seed ^ 0x9E3779B9) >>> 0;
  const hash = (ix, iz) => {
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(s, 69069)) | 0;
    h = (h ^ (h >>> 13)) | 0; h = Math.imul(h, 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    const ab = a + (b - a) * sx;
    return ab + ((c + (d - c) * sx) - ab) * sz;
  };
}

/** fBm: `octaves` oktav, frekans oranı ölçüşmez (φ ≈ 1,618 → tekrar kırılır). */
export function fbm2D(seed, { octaves = 4, lacunarity = 1.618 * 1.2, gain = .5 } = {}) {
  const noise = valueNoise2D(seed);
  const rnd = mulberry32(seed ^ 0x51D7);
  const ofs = Array.from({ length: octaves }, () => [rnd() * 97, rnd() * 97]);
  let norm = 0; for (let o = 0, a = 1; o < octaves; o++, a *= gain) norm += a;
  return (x, z) => {
    let sum = 0, amp = 1, f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += (noise(x * f + ofs[o][0], z * f + ofs[o][1]) - .5) * amp;
      amp *= gain; f *= lacunarity;
    }
    return sum / norm;                       // ≈ [−0,5, 0,5]
  };
}

/** Sırtlı (ridged) çok-fraktal: (1 − |2n − 1|)^p — kırık masif silüeti. p ≥ 1. */
export function ridged2D(seed, { octaves = 4, lacunarity = 1.618 * 1.25, gain = .55, power = 1.6 } = {}) {
  const noise = valueNoise2D(seed ^ 0x2C1B);
  const rnd = mulberry32(seed ^ 0xA5A5);
  const ofs = Array.from({ length: octaves }, () => [rnd() * 71, rnd() * 71]);
  let norm = 0; for (let o = 0, a = 1; o < octaves; o++, a *= gain) norm += a;
  return (x, z) => {
    let sum = 0, amp = 1, f = 1;
    for (let o = 0; o < octaves; o++) {
      /* ridge(): max(0,·) — negatif taban pow'a girmez (sözleşme §3 dersi) */
      const r = Math.max(0, 1 - Math.abs(2 * noise(x * f + ofs[o][0], z * f + ofs[o][1]) - 1));
      sum += Math.pow(r, power) * amp;
      amp *= gain; f *= lacunarity;
    }
    return sum / norm;                       // [0, 1]
  };
}

/** İki ölçekli domain warp: p' = p + A·n(p/λ). Tek gürültü tekrarı gözle sayılır (§4.3). */
export function domainWarp(seed, { amplitude = 1, wavelength = 1 } = {}) {
  const nx = valueNoise2D(seed ^ 0x77A1), nz = valueNoise2D(seed ^ 0x1B3F);
  return (x, z, out) => {
    const u = x / wavelength, v = z / wavelength;
    out[0] = x + (nx(u, v) - .5) * 2 * amplitude;
    out[1] = z + (nz(u + 13.7, v - 5.1) - .5) * 2 * amplitude;
    return out;
  };
}

/** Uzamsal hücre ızgarası: nokta-yarıçaplı nesneler için O(1) komşu sorgusu. */
export function spatialHash(cell) {
  const map = new Map();
  const key = (ix, iz) => ix * 100003 + iz;
  return {
    insert(item, x, z, reach) {
      for (let ix = Math.floor((x - reach) / cell); ix <= Math.floor((x + reach) / cell); ix++)
        for (let iz = Math.floor((z - reach) / cell); iz <= Math.floor((z + reach) / cell); iz++) {
          const k = key(ix, iz);
          let list = map.get(k);
          if (!list) map.set(k, list = []);
          list.push(item);
        }
    },
    at(x, z) { return map.get(key(Math.floor(x / cell), Math.floor(z / cell))); },
    cell,
  };
}

/** Deterministik FNV-1a benzeri hash (doğrulama: yükseklik imzası). */
export function hashFloats(values) {
  let h = 0x811C9DC5;
  const buf = new Float64Array(1), view = new Uint8Array(buf.buffer);
  for (const v of values) {
    buf[0] = v;
    for (let i = 0; i < 8; i++) { h ^= view[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return h.toString(16).padStart(8, '0');
}
