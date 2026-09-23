/* terrain-features.mjs — OLGU kütüphanesi (three'siz, DOM'suz).

   Her katman ADLANDIRILMIŞ bir gerçek olgudur (webgl-scene-contract §1):
   krater alanı, karmaşık krater, masif, mare sırtı, kanyon, kumul, mesa,
   kıvrımlı rille, çökme çukuru, fBm regolit, mikro kabartma, yükseklik
   dokusu örneklemesi. Katman sözleşmesi:

     { name, phenomenon, tags:['large'|'small'|'micro'], planets:['moon','mars','any'],
       h(x, z) → birim, hard?(x, z) → 0..1 (eğim kırpmadan muafiyet),
       describe() → istatistik/liste (doğrulama ve bölge albedosu için) }

   Birim: 1 birim = 100 m (docs/terrain-system-plan.md §3). Gerçek ölçü
   çapaları §3 tablosundan; her katmanın parametre yorumu satır içinde. */

import { mulberry32, clamp, smoothstep, fbm2D, ridged2D, domainWarp, spatialHash } from './terrain-noise.mjs';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Krater alanı                                                        */
/* ------------------------------------------------------------------ */

/** Güç-yasalı krater popülasyonu. Kümülatif boy dağılımı N(>D) ∝ D^−b
    (Pareto, b = 2 — Neukum üretim fonksiyonu eğimine yakın), halkalar
    hâlinde: {r0, r1, Rmin, Rmax, count}. Aşınma yaşı (age 0 taze → 1 yaşlı)
    kenarı yumuşatır ve çanağı doldurur; D > complexAbove olan kraterler
    merkez tepe + teraslı duvar + düz taban alır (karmaşık krater).
    Üst üste binme: genç kraterin çanağı yaşlı kenarı bastırır (§4.1). */
export function craterField({
  seed, rings, complexAbove = 75,           // R > 75 birim (D > 15 km) → karmaşık
  paretoSlope = 2, clearings = [],
} = {}) {
  const rnd = mulberry32(seed ^ 0x7E44A1);
  const craters = [];
  rings.forEach((ring, ringIndex) => {
    const { r0, r1, Rmin, Rmax, count } = ring;
    for (let i = 0; i < count; i++) {
      /* Pareto b: R = Rmin · u^(−1/b), Rmax'ta kesilir */
      const u = Math.max(1e-6, rnd());
      const R = Math.min(Rmax, Rmin * Math.pow(u, -1 / paretoSlope));
      const t = rnd() * TAU;
      const rr = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
      const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
      let blocked = false;
      for (const c of clearings) if (Math.hypot(x - c.x, z - c.z) < c.r + R * 1.6) { blocked = true; break; }
      if (blocked) continue;
      const age = rnd();                                    // 0 taze … 1 aşınmış
      const fresh = 1 - age;
      const complex = R > complexAbove;
      /* derinlik/çap: taze basit 0,2 → aşınmış 0,05; karmaşık ≈ 0,1 */
      const dOverD = complex ? .09 + .03 * fresh : .05 + .15 * fresh;
      const d = 2 * R * dOverD;
      const rim = .04 * 2 * R * (.5 + .5 * fresh);          // kenar ≈ 0,04·D (taze)
      craters.push({
        x, z, R, d, rim, age, fresh, complex, ringIndex,
        k: complex ? 3.2 : 2 + 1.2 * fresh,                 // çanak dikliği
        peak: complex ? d * (.25 + .2 * fresh) : 0,         // merkez tepe
        floor: complex ? .45 : 0,                            // düz taban yarıçap oranı
      });
    }
  });
  /* genç önce: üst üste binme kuralı için */
  craters.sort((a, b) => a.age - b.age);
  const hash = spatialHash(60);
  for (const k of craters) hash.insert(k, k.x, k.z, k.R * 2.8);

  const bowl = (k, s) => {
    if (k.complex) {
      /* düz taban → teraslı duvar (iki kademe) → kenar; merkez tepe Gauss */
      const wall = smoothstep(k.floor, 1, s);
      const terrace = wall + .12 * Math.sin(wall * Math.PI * 2) * (1 - wall);
      const h = -k.d + (k.d + k.rim) * Math.pow(clamp(terrace, 0, 1), k.k);
      const peak = k.peak * Math.exp(-(s * s) / (.06));
      return h + peak;
    }
    return -k.d + (k.d + k.rim) * Math.pow(s, k.k);
  };
  const h = (x, z) => {
    const list = hash.at(x, z);
    if (!list) return 0;
    let sum = 0, youngBowl = 0;              // youngBowl: bu noktayı örten genç çanak maskesi
    for (const k of list) {
      const s = Math.hypot(x - k.x, z - k.z) / k.R;
      if (s >= 2.8) continue;
      const suppress = 1 - youngBowl;        // yaşlı kenar gencin çanağında bastırılır
      if (s < 1) {
        sum += bowl(k, s) * suppress;
        youngBowl = Math.max(youngBowl, 1 - smoothstep(.8, 1, s));
      } else {
        sum += k.rim * (1 - smoothstep(1.7, 2.8, s)) / (s * s) * suppress;
      }
    }
    return sum;
  };
  return {
    name: 'craterField', phenomenon: 'impact crater population (Pareto size–frequency, erosion age, overlap)',
    tags: ['large'], planets: ['any'], h,
    describe: () => ({ rings: rings.map(r => ({ ...r })), craters: craters.map(k => ({ x: k.x, z: k.z, R: k.R, age: k.age, complex: k.complex, ring: k.ringIndex })) }),
  };
}

/* ------------------------------------------------------------------ */
/* Masif / havza halka dağları                                         */
/* ------------------------------------------------------------------ */

/** Sırtlı çok-fraktal masif: taban yarıçapı `base`, tepe `H` (birim).
    Montes Apenninus çapası: H 30–50, taban 300–600. `ring` verilirse
    masifler bir havza halkası boyunca dizilir (ringMassif). */
export function massif({ seed, H = 35, base = 400, centers, ring } = {}) {
  const rnd = mulberry32(seed ^ 0x3A55);
  const list = [];
  if (ring) {
    const { cx = 0, cz = 0, R, a0 = 0, a1 = TAU, count = 5 } = ring;
    for (let i = 0; i < count; i++) {
      const a = a0 + (a1 - a0) * (i + .5 + (rnd() - .5) * .6) / count;
      list.push({ x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, H: H * (.7 + .6 * rnd()), base: base * (.8 + .5 * rnd()), az: a });
    }
  }
  for (const c of centers || []) list.push({ x: c[0], z: c[1], H: c[2] ?? H, base: c[3] ?? base, az: rnd() * TAU });
  const ridge = ridged2D(seed ^ 0x9D11, { octaves: 5, power: 1.8 });
  const warp = domainWarp(seed ^ 0x44C2, { amplitude: base * .12, wavelength: base * .9 });
  const warp2 = domainWarp(seed ^ 0x77E9, { amplitude: base * .03, wavelength: base * .18 });
  const w = [0, 0];
  const hash = spatialHash(200);
  for (const m of list) hash.insert(m, m.x, m.z, m.base * 1.3);
  const h = (x, z) => {
    const near = hash.at(x, z);
    if (!near) return 0;
    let sum = 0;
    for (const m of list) {
      const d = Math.hypot(x - m.x, z - m.z) / m.base;
      if (d > 1.3) continue;
      const env = 1 - smoothstep(.25, 1.2, d);                 // etek zarfı
      warp(x - m.x, z - m.z, w); warp2(w[0], w[1], w);
      const r = ridge(w[0] / (m.base * .55) + m.az, w[1] / (m.base * .55));
      sum += m.H * env * (.35 + .65 * r);
    }
    return sum;
  };
  return {
    name: 'massif', phenomenon: 'basin-ring massif (ridged multifractal, domain-warped)',
    tags: ['large'], planets: ['any'], h,
    /* masif sert kaya: eğim kırpma etek dışında muaf */
    hard: (x, z) => { let m = 0; for (const c of list) { const d = Math.hypot(x - c.x, z - c.z) / c.base; m = Math.max(m, 1 - smoothstep(.5, .9, d)); } return m; },
    describe: () => ({ massifs: list.map(m => ({ x: m.x, z: m.z, H: m.H, base: m.base })) }),
  };
}

/* ------------------------------------------------------------------ */
/* Mare sırtı (wrinkle ridge)                                          */
/* ------------------------------------------------------------------ */

/** Sinüzoidal kıvrımlı, ASİMETRİK kesitli sırtlar (bir yamaç dik).
    Çapa: H 0,5–3, genişlik 10–100, uzunluk 100–1000 birim. */
export function wrinkleRidge({ seed, count = 6, rMin = 60, rMax = 1400, aim = [] } = {}) {
  const rnd = mulberry32(seed ^ 0x51D7);
  const ridges = [];
  const add = (az, rd) => {
    const dir = az + Math.PI / 2 + (rnd() - .5) * .8;
    ridges.push({
      cx: Math.cos(az) * rd, cz: Math.sin(az) * rd, ux: Math.cos(dir), uz: Math.sin(dir),
      L: clamp(rd * .9, 100, 1000), w: 10 + rd * .03,
      H: clamp(.02 * rd, .5, 3) * (.7 + .6 * rnd()), phase: rnd() * TAU, asym: .45 + .3 * rnd(),
    });
  };
  for (const [az, rd] of aim) add(az, rd);   // vista ufkuna nişanlı sırtlar
  for (let i = 0; i < count; i++) add(rnd() * TAU, rMin + rnd() * (rMax - rMin));
  const h = (x, z) => {
    let sum = 0;
    for (const s of ridges) {
      const dx = x - s.cx, dz = z - s.cz;
      const along = dx * s.ux + dz * s.uz;
      const half = s.L * .55;
      if (Math.abs(along) > half) continue;
      const across = -dx * s.uz + dz * s.ux + Math.sin(along * .012 + s.phase) * s.w * .7;
      const env = 1 - (along / half) ** 2;
      const wEff = across > 0 ? s.w * s.asym : s.w;         // dik yamaç
      sum += s.H * env * Math.exp(-(across * across) / (wEff * wEff));
    }
    return sum;
  };
  return { name: 'wrinkleRidge', phenomenon: 'mare wrinkle ridge (contractional, asymmetric)', tags: ['large'], planets: ['moon', 'any'], h,
    describe: () => ({ ridges: ridges.length }) };
}

/* ------------------------------------------------------------------ */
/* fBm regolit dalgalanması ve mikro kabartma                           */
/* ------------------------------------------------------------------ */

/** Genel kabarma: [ölçek, genlik] çiftleri; mevcut reçete (520/4,6; 120/1,4; 26/0,4). */
export function fbm({ seed, bands = [[520, 4.6], [120, 1.4], [26, .4]] } = {}) {
  const fns = bands.map((b, i) => fbm2D(seed ^ (0x1F1F + i * 7919), { octaves: 3 }));
  const h = (x, z) => { let s = 0; for (let i = 0; i < bands.length; i++) s += fns[i](x / bands[i][0], z / bands[i][0]) * 2 * bands[i][1]; return s; };
  return { name: 'fbm', phenomenon: 'regolith undulation (value-noise fBm)', tags: ['small'], planets: ['any'], h, describe: () => ({ bands }) };
}

/** 30–80 cm dalga boyu, ±3–4 cm: yalnız kamera yakın alanında (r < near). */
export function microRelief({ seed, near = .5 } = {}) {
  const a = fbm2D(seed ^ 0x6A6A, { octaves: 2 }), b = fbm2D(seed ^ 0x2B2B, { octaves: 2 });
  const h = (x, z) => {
    const d = Math.hypot(x, z);
    if (d >= near) return 0;
    const fade = 1 - smoothstep(near * .6, near, d);
    return fade * (a(x / .6, z / .6) * .056 * smoothstep(.045, .3, d) + b(x / .22, z / .22) * .022 * smoothstep(.03, .18, d));
  };
  return { name: 'microRelief', phenomenon: 'regolith micro-relief (cm-scale)', tags: ['micro'], planets: ['any'], h, describe: () => ({ near }) };
}

/* ------------------------------------------------------------------ */
/* Mars biçimleri                                                      */
/* ------------------------------------------------------------------ */

/** Çizgisel kanyon: `path` [[x,z],…] boyunca derinlik D, taban genişliği W,
    duvar eğimi (talus 30–35°) + tabanda ikincil kanal + kenarda heyelan
    yelpazeleri. Sert kaya duvar → eğim kırpmadan muaf. */
export function canyon({ seed, path, depth = 30, width = 40, wallSlopeDeg = 60 } = {}) {
  const rnd = mulberry32(seed ^ 0xCA9E);
  const segs = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    segs.push({ ax, az, ux: (bx - ax) / L, uz: (bz - az) / L, L });
  }
  const fans = Array.from({ length: Math.max(2, Math.round(segs.reduce((s, g) => s + g.L, 0) / 60)) }, () => {
    const g = segs[Math.floor(rnd() * segs.length)];
    const t = rnd() * g.L, side = rnd() < .5 ? -1 : 1;
    return { x: g.ax + g.ux * t - g.uz * side * width * .55, z: g.az + g.uz * t + g.ux * side * width * .55, r: width * (.25 + .3 * rnd()), h: depth * (.15 + .2 * rnd()) };
  });
  const wallW = depth / Math.tan(wallSlopeDeg * Math.PI / 180);
  const meander = fbm2D(seed ^ 0x33AA, { octaves: 2 });
  const dist = (x, z) => {
    let best = Infinity, bestAlong = 0;
    for (const g of segs) {
      const dx = x - g.ax, dz = z - g.az;
      const t = clamp(dx * g.ux + dz * g.uz, 0, g.L);
      const px = g.ax + g.ux * t, pz = g.az + g.uz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; bestAlong = t; }
    }
    return [best, bestAlong];
  };
  const h = (x, z) => {
    const [d0, along] = dist(x, z);
    const d = d0 + meander(along / 90, 0) * width * .3;
    const half = width / 2;
    if (d > half + wallW + 1) return fansAt(x, z);
    const inFloor = 1 - smoothstep(half, half + wallW, d);       // 1 tabanda, 0 kenarda
    const channel = -depth * .12 * (1 - smoothstep(0, half * .35, d));
    return -depth * inFloor + channel * inFloor + fansAt(x, z);
  };
  const fansAt = (x, z) => { let s = 0; for (const f of fans) { const d = Math.hypot(x - f.x, z - f.z) / f.r; if (d < 1.5) s += f.h * (1 - smoothstep(.3, 1.5, d)); } return s; };
  const hard = (x, z) => { const [d] = dist(x, z); const half = width / 2; return d < half + wallW + 1 ? (1 - smoothstep(half + wallW * .9, half + wallW + 1, d)) : 0; };
  return { name: 'canyon', phenomenon: 'canyon (wall, floor channel, landslide fans)', tags: ['large'], planets: ['mars', 'any'], h, hard, describe: () => ({ segments: segs.length, fans: fans.length }) };
}

/** Barchan kumulları: rüzgâr yönü `wind` (rad); hilal biçim, yumuşak rüzgâr
    üstü, ≈32° kayma yüzü. Çapa: H 0,05–0,3, genişlik 1–3 birim. Atmosfersiz
    cisimde ANLAMSIZ: `planets: ['mars']` — alan kapısı Ay profilinde reddeder. */
export function dune({ seed, wind = 0, count = 40, r0 = 4, r1 = 400 } = {}) {
  const rnd = mulberry32(seed ^ 0xD00E);
  const ux = Math.cos(wind), uz = Math.sin(wind);
  const list = [];
  for (let i = 0; i < count; i++) {
    const t = rnd() * TAU, rr = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
    const H = .05 + Math.pow(rnd(), 1.5) * .25, W = H * 9 * (.8 + .4 * rnd());
    list.push({ x: Math.cos(t) * rr, z: Math.sin(t) * rr, H, W, L: W * .8 });
  }
  const hash = spatialHash(20);
  for (const d of list) hash.insert(d, d.x, d.z, d.W * 1.5);
  const h = (x, z) => {
    const near = hash.at(x, z);
    if (!near) return 0;
    let sum = 0;
    for (const d of near) {
      const dx = x - d.x, dz = z - d.z;
      const a = dx * ux + dz * uz, c = -dx * uz + dz * ux;          // rüzgâr boyunca / dik
      if (Math.abs(a) > d.L * 1.4 || Math.abs(c) > d.W) continue;
      /* rüzgâr üstü yumuşak (uzun), kayma yüzü dik: a>0 tarafında kısa düşüş */
      const aw = a < 0 ? d.L : d.H / Math.tan(32 * Math.PI / 180) * 1.0;
      const body = Math.exp(-(a * a) / (aw * aw)) * (1 - (c / d.W) ** 2);
      const horns = smoothstep(0, d.L * .6, a) * (1 - Math.abs(c) / d.W) * .6; // hilal boynuzları kaymayı açar
      sum += d.H * Math.max(0, body - horns * body);
    }
    return sum;
  };
  return { name: 'dune', phenomenon: 'barchan dune field (wind-shaped, ~32° slip face)', tags: ['small'], planets: ['mars'], h, describe: () => ({ dunes: list.length, wind }) };
}

/** Katmanlı mesa: sert tabaka üstte (düz plato), altta ≈33° talus. Çapa: H 0,5–5. */
export function mesa({ seed, centers, talusDeg = 33 } = {}) {
  const rnd = mulberry32(seed ^ 0x3E5A);
  const list = (centers || []).map(c => ({ x: c[0], z: c[1], R: c[2], H: c[3], rot: rnd() * TAU }));
  const edge = fbm2D(seed ^ 0x8E5A, { octaves: 3 });
  const h = (x, z) => {
    let sum = 0;
    for (const m of list) {
      const dx = x - m.x, dz = z - m.z;
      const ang = Math.atan2(dz, dx);
      const Rr = m.R * (1 + edge(Math.cos(ang + m.rot) * 2.3, Math.sin(ang + m.rot) * 2.3) * .5); // kenar girinti-çıkıntı
      const talusW = m.H / Math.tan(talusDeg * Math.PI / 180);
      const d = Math.hypot(dx, dz);
      if (d > Rr + talusW) continue;
      const t = clamp((Rr + talusW - d) / talusW, 0, 1);      // talus doğrusal
      sum += m.H * (d < Rr ? 1 : t) * (1 - .02 * edge(dx / 30, dz / 30));
    }
    return sum;
  };
  const hard = (x, z) => { let m = 0; for (const c of list) { const talusW = c.H / Math.tan(talusDeg * Math.PI / 180); const d = Math.hypot(x - c.x, z - c.z); m = Math.max(m, 1 - smoothstep(c.R, c.R + talusW * .5, d)); } return m; };
  return { name: 'mesa', phenomenon: 'layered mesa (caprock plateau + talus)', tags: ['large'], planets: ['mars', 'any'], h, hard, describe: () => ({ mesas: list.length }) };
}

/* ------------------------------------------------------------------ */
/* Ay volkanik biçimleri (R3)                                          */
/* ------------------------------------------------------------------ */

/** Kıvrımlı rille: 1–3 km geniş, 100–300 m derin lav kanalı. Sert kaya. */
export function sinuousRille({ seed, path, depth = 2, width = 20 } = {}) {
  const inner = canyon({ seed: seed ^ 0x511E, path, depth, width, wallSlopeDeg: 40 });
  return { ...inner, name: 'sinuousRille', phenomenon: 'sinuous rille (collapsed lava channel)', planets: ['moon', 'any'] };
}

/** Çökme çukuru (skylight): dik duvarlı, 50–100 m; Marius Hills tipi. Sert kaya. */
export function pitCrater({ centers = [] } = {}) {
  const list = centers.map(c => ({ x: c[0], z: c[1], R: c[2], D: c[3] }));
  const h = (x, z) => { let s = 0; for (const p of list) { const q = Math.hypot(x - p.x, z - p.z) / p.R; if (q < 1.3) s += -p.D * (1 - smoothstep(.85, 1.05, q)); } return s; };
  const hard = (x, z) => { let m = 0; for (const p of list) m = Math.max(m, 1 - smoothstep(p.R * 1.05, p.R * 1.3, Math.hypot(x - p.x, z - p.z))); return m; };
  return { name: 'pitCrater', phenomenon: 'lava-tube skylight (steep-walled collapse pit)', tags: ['small'], planets: ['moon', 'mars', 'any'], h, hard, describe: () => ({ pits: list.length }) };
}

/* ------------------------------------------------------------------ */
/* Yükseklik dokusu örneklemesi (R1)                                    */
/* ------------------------------------------------------------------ */

/** Coğrafi taban katmanı: `sample(u,v)` → [0,1] (tarayıcıda WebP'den, Node'da
    Float32 .bin'den); `extent` birim başına u-v ölçeği. Küre→arazi teslim
    sürekliliği bu katmanla kurulur. */
export function displacementSample({ sample, extent = 13000, amplitude = 6.5, repeat = 9 } = {}) {
  const h = sample ? (x, z) => (sample(((x / extent + .5) * repeat) % 1, ((.5 - z / extent) * repeat) % 1) - .5) * amplitude : () => 0;
  return { name: 'displacementSample', phenomenon: 'sampled lunar relief (texture-derived base)', tags: ['large'], planets: ['any'], h, describe: () => ({ extent, amplitude, active: !!sample }) };
}

export const FEATURES = Object.freeze({ craterField, massif, wrinkleRidge, fbm, microRelief, canyon, dune, mesa, sinuousRille, pitCrater, displacementSample });
