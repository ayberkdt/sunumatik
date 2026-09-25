/* terrain-field.mjs — yükseklik alanı KOMPOZİTÖRÜ (three'siz, DOM'suz).

   h(x,z) = sagitta + exaggeration · Σ kapı_i(x,z) · katman_i(x,z) + düzeltme(x,z)

   · sagitta −d²/(2R): ufuk eğriliği GERÇEK yarıçapla (Ay 17 374, Mars 33 895 birim).
   · Kapılar (clearings): gezgin pedi, sürüş koridoru, saha (site) — büyük
     biçimler ped merkezindeki yerel seviyeye (datum) bastırılır, `keep`
     listesindeki küçükler yaşar. Pedin merkezi h = 0 datumudur.
   · exaggeration varsayılan 1; ≠ 1 ise describe() bunu İLAN eder (§3).
   · Gezegen kısıtı: katmanın `planets` listesi profilin gezegenini içermiyorsa
     alan KURULMAZ (Ay'da kumul → Error). Sessiz kabul yok.
   · Düzeltme: terrain-mesh eğim kırpması (§4.4) hücre bazında hesaplar ve
     `field.setCorrection(fn)` ile geri yazar; analitik `height()` bu
     düzeltmeyi okur, örgü ile sorgu asla ayrışmaz (§6 kuralı).

   API (donmuş):
     createTerrainField({ seed, planet, radiusUnits, layers, clearings, exaggeration })
       → { height(x,z), gradient(x,z,out), normal(x,z,out), slopeDeg(x,z),
           hardness(x,z), gate(x,z,layer), isClear(x,z), clearings, layers,
           planet, radiusUnits, exaggeration, setCorrection(fn), describe() } */

import { clamp, smoothstep } from './terrain-noise.mjs';

export const BODY_RADIUS_UNITS = Object.freeze({ moon: 17374, mars: 33895, generic: 20000 });
export const UNIT_M = 100;                    // 1 birim = 100 m (değişmez)
export const ANGLE_OF_REPOSE_DEG = 35;        // gevşek regolit durma açısı (30–35°)

function normalizeClearing(c) {
  if (c.path) {                                // sürüş koridoru
    const segs = [];
    for (let i = 0; i + 1 < c.path.length; i++) {
      const [ax, az] = c.path[i], [bx, bz] = c.path[i + 1];
      const L = Math.hypot(bx - ax, bz - az) || 1e-9;
      segs.push({ ax, az, ux: (bx - ax) / L, uz: (bz - az) / L, L });
    }
    const dist = (x, z) => {
      let best = Infinity;
      for (const g of segs) {
        const t = clamp((x - g.ax) * g.ux + (z - g.az) * g.uz, 0, g.L);
        best = Math.min(best, Math.hypot(x - (g.ax + g.ux * t), z - (g.az + g.uz * t)));
      }
      return best;
    };
    /* Koridorun REFERANSI en yakin eksen noktasidir: yol, araziyi takip
       eder; sabit bir kota cekilirse tepelerde kanyon acar (olculdu). */
    const refPt = (x, z) => {
      let best = Infinity, bx = 0, bz = 0;
      for (const g of segs) {
        const t = clamp((x - g.ax) * g.ux + (z - g.az) * g.uz, 0, g.L);
        const px = g.ax + g.ux * t, pz = g.az + g.uz * t, d = Math.hypot(x - px, z - pz);
        if (d < best) { best = d; bx = px; bz = pz; }
      }
      return [bx, bz];
    };
    return { type: 'corridor', w: c.w ?? 1.2, maxSlopeDeg: c.maxSlopeDeg ?? 15, keep: new Set(c.keep ?? ['microRelief']),
      flatten: c.flatten ?? 'drivable', dist, segs, refPt, sabitRef: false,
      inside: (x, z) => dist(x, z) <= (c.w ?? 1.2) / 2,
      /* kapı: koridor içinde 0, dışında 1 (yumuşak) */
      gate: (x, z) => smoothstep((c.w ?? 1.2) / 2, (c.w ?? 1.2) * 1.4, dist(x, z)) };
  }
  if (c.polygon) {                             // saha (site) — habitat üsleri
    const poly = c.polygon;
    const inside = (x, z) => { let odd = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) odd = !odd; } return odd; };
    let cx = 0, cz = 0; for (const [px, pz] of poly) { cx += px / poly.length; cz += pz / poly.length; }
    const rad = Math.max(...poly.map(([px, pz]) => Math.hypot(px - cx, pz - cz)));
    return { type: 'site', x: cx, z: cz, r: rad, compaction: c.compaction ?? .6, keep: new Set(c.keep ?? []), flatten: c.flatten ?? 'graded',
      refPt: () => [cx, cz], sabitRef: true,
      inside, gate: (x, z) => inside(x, z) ? 0 : smoothstep(rad, rad * 1.5, Math.hypot(x - cx, z - cz)) };
  }
  const [x0, z0] = c.at ?? [0, 0], r = c.r ?? 3.5;
  return { type: 'pad', x: x0, z: z0, r, keep: new Set(c.keep ?? ['microRelief']), flatten: c.flatten ?? 'large',
    refPt: () => [x0, z0], sabitRef: true,
    inside: (x, z) => Math.hypot(x - x0, z - z0) <= r,
    /* surface-scene deseni: 2,2→6 birim yumuşak geçiş (r = 3,5 için) */
    gate: (x, z) => smoothstep(r * .63, r * 1.71, Math.hypot(x - x0, z - z0)) };
}

export function createTerrainField({
  seed = 20260916, planet = 'moon', radiusUnits, layers = [], clearings = [], exaggeration = 1,
} = {}) {
  const R = radiusUnits ?? BODY_RADIUS_UNITS[planet] ?? BODY_RADIUS_UNITS.generic;
  for (const L of layers) {
    if (!L.planets.includes('any') && !L.planets.includes(planet)) {
      throw new Error(`terrain_blocks: '${L.name}' (${L.phenomenon}) ${planet} profilinde geçersiz — gezegen kısıtı: ${L.planets.join('/')}.`);
    }
  }
  const gates = clearings.map(normalizeClearing);
  const large = layers.filter(L => L.tags.includes('large'));
  const small = layers.filter(L => L.tags.includes('small'));
  const micro = layers.filter(L => L.tags.includes('micro'));
  let correction = null;

  /* Kapı: 'large' → tüm büyük ve küçük biçimler; 'drivable'/'graded' → keep dışı her şey */
  const gateFor = (x, z, L) => {
    let g = 1;
    for (const c of gates) {
      if (c.keep.has(L.name)) continue;
      if (c.flatten === 'large' && L.tags.includes('micro')) continue;
      g = Math.min(g, c.gate(x, z));
    }
    return g;
  };
  /* kapı değerleri her height() çağrısında BİR kez hesaplanır (katman başına
     değil): koridor uzaklığı en pahalı kapı, altı katman için altı kez
     ölçmek örgü kurulumunu ikiye katlıyordu (ölçüldü) */
  const gateVals = new Float64Array(gates.length);
  const ordered = [...large, ...small, ...micro];
  /* DATUM: kapılar katmanı sıfıra değil, ped merkezindeki YEREL seviyesine
     bastırır. Aksi hâlde ortalaması sıfır olmayan bir katman (sırtlı masif
     ≥ 0, krater kenarı, mesa tepesi) pedin çevresinde bir kuyu kazar —
     moon-highland'de gezgin 1 km derinlikte bir çukurda oturuyordu (ölçüldü:
     r=10 birimde +10,5 birim). Datum = ilk ped, yoksa orijin; kapısız katman
     (her kapının keep listesinde ya da ped kapısından muaf mikro) ötelenmez. */
  const datum = gates.find(c => c.type === 'pad') ?? { x: 0, z: 0 };
  const gatedBy = L => gates.some(c => !c.keep.has(L.name) && !(c.flatten === 'large' && L.tags.includes('micro')));
  const ref = new Float64Array(ordered.map(L => gatedBy(L) ? L.h(datum.x, datum.z) : 0));
  /* YEREL DATUM: bir kapi katmani SIFIRA degil, KENDI referans noktasindaki
     degerine bastirir. Tek bir genel datum, orijinden 1 km otedeki bir
     modulu orijinin kotasina kazir: 3B onizlemede koridorlar 30 m derin
     kanyon, modul pedleri basamak oluyordu (olculdu, moon-highland).
     Sabit referansli kapilarda (ped, saha) katman basina BIR kez hesaplanir;
     koridorda referans nokta kaydigi icin cagri basina. */
  const sabitRef = gates.map(c => (c.sabitRef ? ordered.map(L => L.h(...c.refPt())) : null));
  const raw = (x, z) => {
    for (let c = 0; c < gates.length; c++) gateVals[c] = gates[c].gate(x, z);
    let sum = 0;
    for (let i = 0; i < ordered.length; i++) {
      const L = ordered[i];
      let g = 1, kapi = -1;
      for (let c = 0; c < gates.length; c++) {
        const cl = gates[c];
        if (cl.keep.has(L.name)) continue;
        if (cl.flatten === 'large' && L.tags.includes('micro')) continue;
        if (gateVals[c] < g) { g = gateVals[c]; kapi = c; }
      }
      if (g >= 1) { sum += L.h(x, z) - ref[i]; continue; }
      const yerel = sabitRef[kapi] ? sabitRef[kapi][i] : L.h(...gates[kapi].refPt(x, z));
      sum += g * (L.h(x, z) - ref[i]) + (1 - g) * (yerel - ref[i]);
    }
    return sum;
  };
  const sagitta = (x, z) => -(x * x + z * z) / (2 * R);
  const height = (x, z) => sagitta(x, z) + exaggeration * raw(x, z) + (correction ? correction(x, z) : 0);
  const step = (x, z) => Math.max(.02, Math.hypot(x, z) * .004);   // yerel çözünürlük (kutupsal örgüyle uyumlu)
  const gradient = (x, z, out = [0, 0]) => {
    const e = step(x, z);
    out[0] = (height(x + e, z) - height(x - e, z)) / (2 * e);
    out[1] = (height(x, z + e) - height(x, z - e)) / (2 * e);
    return out;
  };
  const normal = (x, z, out = [0, 1, 0]) => {
    const g = gradient(x, z);
    const inv = 1 / Math.hypot(g[0], 1, g[1]);
    out[0] = -g[0] * inv; out[1] = inv; out[2] = -g[1] * inv;
    return out;
  };
  const slopeDeg = (x, z) => { const g = gradient(x, z); return Math.atan(Math.hypot(g[0], g[1])) * 180 / Math.PI; };
  const hardness = (x, z) => { let m = 0; for (const L of layers) if (L.hard) m = Math.max(m, L.hard(x, z)); return clamp(m, 0, 1); };
  const isClear = (x, z) => gates.some(c => c.inside(x, z));
  const corridorAt = (x, z) => gates.find(c => c.type === 'corridor' && c.inside(x, z)) || null;

  return {
    seed, planet, radiusUnits: R, exaggeration, layers, clearings: gates,
    height, sagitta, raw, gradient, normal, slopeDeg, hardness, isClear, corridorAt,
    gate: gateFor,
    setCorrection(fn) { correction = fn; },
    hasCorrection: () => !!correction,
    describe() {
      return {
        seed, planet, radiusUnits: R, unitMeters: UNIT_M, exaggeration,
        exaggerationDeclared: exaggeration !== 1 ? `yükseklik ×${exaggeration} ABARTILI` : null,
        layers: layers.map(L => ({ name: L.name, phenomenon: L.phenomenon, tags: L.tags, ...(L.describe ? summarize(L.describe()) : {}) })),
        clearings: gates.map(c => ({ type: c.type, r: c.r, w: c.w, maxSlopeDeg: c.maxSlopeDeg, flatten: c.flatten })),
        datum: [datum.x, datum.z],
        corrected: !!correction,
      };
    },
  };
}

function summarize(d) {
  const out = {};
  for (const [k, v] of Object.entries(d)) out[k] = Array.isArray(v) ? { count: v.length } : v;
  return out;
}
