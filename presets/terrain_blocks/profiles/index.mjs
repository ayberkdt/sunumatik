/* profiles/index.mjs — gezegen/bölge profilleri (three'siz).

   Bir profil = createTerrainField argümanları + malzeme ve saçılım dili +
   açıklama. Her biçim bir OLGU ile gerekçelendirilir (docs/terrain-system-plan.md §4).
   Her profil `vista` (gezgin pedi, orijin) ve isteğe bağlı `corridor` tanımlar. */

import { createTerrainField } from '../terrain-field.mjs';
import {
  craterField, massif, wrinkleRidge, fbm, microRelief, canyon, dune, mesa, sinuousRille, pitCrater, displacementSample,
} from '../terrain-features.mjs';

const VISTA = { at: [0, 0], r: 3.5, flatten: 'large', keep: ['microRelief'] };
const CORRIDOR = { path: [[0, 0], [12, -4], [30, -9]], w: 1.2, flatten: 'drivable', maxSlopeDeg: 15, keep: ['microRelief'] };
/* Profil kendi pedini ve koridorunu getirir; ÇAĞIRAN ek kapı verebilir
   (site-plan.mjs'in ürettiği saha kapıları gibi) — böylece yerleşim
   çözücüsünün kararı arazide GERÇEKTEN tesviye olarak görünür. */
const kapilar = (opt = {}) => [VISTA, CORRIDOR, ...(opt.clearings || [])];

/* Ay krater halkaları: surface-scene reçetesiyle aynı bantlar, Pareto boy */
const moonRings = (scale = 1) => [
  { r0: 3, r1: 30, Rmin: .25, Rmax: 2.2, count: Math.round(90 * scale) },
  { r0: 20, r1: 220, Rmin: 1.2, Rmax: 14, count: Math.round(110 * scale) },
  { r0: 180, r1: 1400, Rmin: 6, Rmax: 60, count: Math.round(90 * scale) },
  { r0: 1200, r1: 4800, Rmin: 20, Rmax: 200, count: Math.round(60 * scale) },
];
const fieldCraters = (seed) => craterField({ seed: seed ^ 0x5A4A17, paretoSlope: 2, rings: [
  { r0: .04, r1: .45, Rmin: .01, Rmax: .09, count: 90 },      // saha kraterleri 1–9 m
  { r0: .55, r1: 4.2, Rmin: .08, Rmax: .5, count: 46 },       // orta bant 8–50 m
] });

export const PROFILES = {
  /** Mare Tranquillitatis dili: düz, sırtlı, seyrek büyük krater. */
  'moon-mare': {
    planet: 'moon', title: 'Ay · Mare', albedo: .07, palette: 'moon',
    material: { dust: 0x8f8b84, rock: 0xb0aba2, slopeAlbedo: [20, 35], detail: 'regolith' },
    scatter: { blocks: 12, rocks: 46, pebbles: 160, tone: 0x7d7970 },
    build: (seed, opt = {}) => createTerrainField({
      seed, planet: 'moon',
      layers: [
        displacementSample({ sample: opt.sample, amplitude: 6.5 }),
        craterField({ seed, rings: moonRings(.8), complexAbove: 75, clearings: [{ x: 0, z: 0, r: 3 }] }),
        Object.assign(fieldCraters(seed), { name: 'fieldCraters', tags: ['small'], phenomenon: 'field craters (1–50 m, near-field texture)' }),
        wrinkleRidge({ seed, count: 5, aim: [[-.35, 120], [.25, 210]] }),
        fbm({ seed, bands: [[520, 4.6], [120, 1.4], [26, .4]] }),
        microRelief({ seed }),
      ],
      clearings: kapilar(opt),
    }),
  },
  /** Güney yaylası: doygun krater alanı, havza halka masifleri. */
  'moon-highland': {
    planet: 'moon', title: 'Ay · Yayla', albedo: .16, palette: 'moon',
    material: { dust: 0xa8a49c, rock: 0xc4bfb5, slopeAlbedo: [18, 32], detail: 'regolith' },
    scatter: { blocks: 22, rocks: 70, pebbles: 200, tone: 0x8a867d },
    build: (seed, opt = {}) => createTerrainField({
      seed, planet: 'moon',
      layers: [
        displacementSample({ sample: opt.sample, amplitude: 8 }),
        craterField({ seed, rings: moonRings(1.6), complexAbove: 60, clearings: [{ x: 0, z: 0, r: 3 }] }),
        Object.assign(fieldCraters(seed), { name: 'fieldCraters', tags: ['small'], phenomenon: 'field craters (1–50 m, near-field texture)' }),
        massif({ seed, H: 38, base: 420, ring: { cx: -900, cz: -1500, R: 1700, a0: .2, a1: 1.6, count: 5 } }),
        fbm({ seed, bands: [[420, 6], [110, 2], [24, .5]] }),
        microRelief({ seed }),
      ],
      clearings: kapilar(opt),
    }),
  },
  /** Shackleton kenarı: dik yamaç, kalıcı gölge (Güneş irtifası ≤ 2°). */
  'moon-polar-rim': {
    planet: 'moon', title: 'Ay · Kutup kenarı', albedo: .11, palette: 'moon', sunElevDeg: 1.8,
    material: { dust: 0x8a8781, rock: 0xa8a49c, slopeAlbedo: [15, 30], detail: 'regolith' },
    scatter: { blocks: 18, rocks: 60, pebbles: 180, tone: 0x77736b },
    build: (seed, opt = {}) => createTerrainField({
      seed, planet: 'moon',
      layers: [
        displacementSample({ sample: opt.sample, amplitude: 5 }),
        /* Shackleton: D ≈ 21 km → R 105 birim, merkez vista'nın 130 birim ötesinde (kenar üstünde duruş) */
        craterField({ seed, rings: [{ r0: 128, r1: 132, Rmin: 105, Rmax: 105, count: 1 }, ...moonRings(1.2)], complexAbove: 75, clearings: [{ x: 0, z: 0, r: 3 }] }),
        Object.assign(fieldCraters(seed), { name: 'fieldCraters', tags: ['small'], phenomenon: 'field craters (1–50 m, near-field texture)' }),
        massif({ seed, H: 22, base: 300, centers: [[-700, 400], [900, -300, 28, 360]] }),
        fbm({ seed, bands: [[380, 5], [90, 1.6], [22, .4]] }),
        microRelief({ seed }),
      ],
      clearings: kapilar(opt),
    }),
  },
  /** Gale/Jezero: yumuşak tepeler, kumul alanları, katmanlı mesa. */
  'mars-plain': {
    planet: 'mars', title: 'Mars · Ova', albedo: .2, palette: 'mars',
    material: { dust: 0xb0704a, rock: 0x8a5b42, slopeAlbedo: [20, 35], detail: 'sand' },
    scatter: { blocks: 14, rocks: 60, pebbles: 220, tone: 0x6e4a38 },
    build: (seed, opt = {}) => createTerrainField({
      seed, planet: 'mars',
      layers: [
        craterField({ seed, rings: [
          { r0: 3, r1: 30, Rmin: .25, Rmax: 2, count: 30 },
          { r0: 20, r1: 260, Rmin: 1.5, Rmax: 12, count: 40 },
          { r0: 200, r1: 3000, Rmin: 8, Rmax: 80, count: 30 },
        ], complexAbove: 40, clearings: [{ x: 0, z: 0, r: 3 }] }),
        mesa({ seed, centers: [[380, -520, 90, 3.2], [-760, -300, 140, 4.5], [1200, 900, 220, 5]] }),
        dune({ seed, wind: .6, count: 90, r0: 6, r1: 500 }),
        fbm({ seed, bands: [[600, 3.2], [140, 1.1], [30, .35]] }),
        microRelief({ seed }),
      ],
      clearings: kapilar(opt),
    }),
  },
  /** Valles Marineris kenarı: kanyon duvarı + heyelan yelpazeleri. */
  'mars-canyon': {
    planet: 'mars', title: 'Mars · Kanyon', albedo: .18, palette: 'mars',
    material: { dust: 0xa8674a, rock: 0x7f5140, slopeAlbedo: [18, 34], detail: 'sand' },
    scatter: { blocks: 26, rocks: 80, pebbles: 200, tone: 0x684536 },
    build: (seed, opt = {}) => createTerrainField({
      seed, planet: 'mars',
      layers: [
        canyon({ seed, path: [[-1600, -220], [-400, -160], [700, -260], [1800, -140]], depth: 28, width: 120, wallSlopeDeg: 55 }),
        craterField({ seed, rings: [
          { r0: 3, r1: 30, Rmin: .25, Rmax: 2, count: 30 },
          { r0: 20, r1: 260, Rmin: 1.5, Rmax: 10, count: 30 },
        ], complexAbove: 40, clearings: [{ x: 0, z: 0, r: 3 }] }),
        mesa({ seed, centers: [[500, 700, 120, 3.5]] }),
        dune({ seed, wind: 2.2, count: 40, r0: 6, r1: 300 }),
        fbm({ seed, bands: [[520, 2.8], [120, 1], [28, .3]] }),
        microRelief({ seed }),
      ],
      clearings: kapilar(opt),
    }),
  },
  /** Gezegen bağımsız kayalık: ML/soyut sahneler için. */
  'generic-rocky': {
    planet: 'generic', title: 'Genel · Kayalık', albedo: .12, palette: 'generic',
    material: { dust: 0x7d7d80, rock: 0x9a9a9d, slopeAlbedo: [20, 35], detail: 'regolith' },
    scatter: { blocks: 20, rocks: 60, pebbles: 160, tone: 0x6a6a6e },
    build: (seed, opt = {}) => createTerrainField({
      seed, planet: 'generic',
      layers: [
        craterField({ seed, rings: moonRings(.6), complexAbove: 70, clearings: [{ x: 0, z: 0, r: 3 }] }),
        massif({ seed, H: 30, base: 380, centers: [[600, -700], [-800, -600, 24, 300]] }),
        pitCrater({ centers: [[40, -25, 1.2, .8], [-70, 50, .9, .6]] }),
        sinuousRille({ seed, path: [[-300, 200], [-120, 120], [60, 140], [240, 60]], depth: 2, width: 18 }),
        fbm({ seed, bands: [[500, 5], [120, 1.6], [26, .45]] }),
        microRelief({ seed }),
      ],
      clearings: kapilar(opt),
    }),
  },
};

export const PROFILE_IDS = Object.freeze(Object.keys(PROFILES));

export function buildProfile(id, seed = 20260916, opt = {}) {
  const p = PROFILES[id];
  if (!p) throw new Error(`terrain_blocks: bilinmeyen profil '${id}'; seçenekler: ${PROFILE_IDS.join(', ')}`);
  const field = p.build(seed, opt);
  return { id, profile: p, field };
}
