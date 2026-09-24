/* terrain-mesh.mjs — kutupsal örgü + eğim kırpma (§4.4, §7).

   İki katman:
   · buildHeightGrid / applySlopeClamp — three'siz. Kutupsal ızgara (merkez
     sık, ufka geometrik seyrelme) üzerinde yükseklikleri örnekler; gevşek
     regolit hücrelerinde durma açısını (35°) aşan yamaçları TERMAL EROZYON
     ile "döker" (yüksekten alçağa kütle aktarımı; sert kaya `hard()` muaf)
     ve düzeltmeyi `field.setCorrection` ile analitik alana GERİ YAZAR: örgü
     ile sorgu aynı yüzeyi görür (§6 kuralı).
   · buildTerrainGeometry(THREE, grid) — BufferGeometry: konum, uv, indeks,
     normal (ızgara komşu farkı = örgü çözünürlüğünde analitik gradyan),
     yükseklik/eğim renk öznitelikleri (vitrin harita görünümleri için).

   LOD STATİKtir: görünür geometri asla yeniden kurulmaz (sözleşme §2);
   dinamik clipmap bilinçli olarak reddedildi (§7). */

import { clamp } from './terrain-noise.mjs';

/** Kutupsal ızgara: r0'dan rMax'a `ratio` ile büyüyen halkalar, `angular` dilim. */
export function buildHeightGrid(field, { angular = 320, r0 = .02, ratio = 1.025, rMax = 36000 } = {}) {
  const radii = [];
  for (let r = r0; r < rMax; r *= ratio) radii.push(r);
  radii.push(rMax);
  const rings = radii.length;
  const n = rings * angular + 1;
  /* çift duyarlık: sagitta yüzlerce birim, düzeltme milimetre — Float32 burada mm kaybeder */
  const heights = new Float64Array(n);
  const hardness = new Float32Array(n);
  const xs = new Float64Array(n), zs = new Float64Array(n);   // tepe konumu da çift duyarlık (sagitta eğimi × Float32 hatası = mm)
  heights[0] = field.height(0, 0);
  hardness[0] = field.hardness(0, 0);
  let v = 1;
  for (let i = 0; i < rings; i++) {
    const r = radii[i];
    for (let j = 0; j < angular; j++, v++) {
      const t = j / angular * Math.PI * 2;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      xs[v] = x; zs[v] = z;
      heights[v] = field.height(x, z);
      hardness[v] = field.hardness(x, z);
    }
  }
  return { angular, radii, rings, r0, ratio, rMax, radiusUnits: field.radiusUnits, heights, hardness, xs, zs, count: n, index: (i, j) => 1 + i * angular + ((j % angular) + angular) % angular };
}

/** Termal erozyon (Jacobi, sınırlı geçiş): durma açısını aşan yumuşak
    hücrelerde kütle aktarımı. Düzeltme dizisini alana yazar; istatistik döner. */
export function applySlopeClamp(field, grid, { maxSlopeDeg = 35, passes = 12, hardnessExempt = .5 } = {}) {
  const { angular, radii, rings, heights, hardness, index } = grid;
  const tanMax = Math.tan(maxSlopeDeg * Math.PI / 180);
  const delta = new Float64Array(grid.count);
  const h = Float64Array.from(heights);
  let moved = 0;
  for (let pass = 0; pass < passes; pass++) {
    const d = new Float64Array(grid.count);
    let any = false;
    const edge = (a, b, dist) => {
      const diff = h[a] - h[b];
      const excess = Math.abs(diff) - tanMax * dist;
      if (excess <= 0) return;
      const hi = diff > 0 ? a : b, lo = diff > 0 ? b : a;
      const sHi = clamp(1 - hardness[hi] / hardnessExempt, 0, 1), sLo = clamp(1 - hardness[lo] / hardnessExempt, 0, 1);
      if (sHi + sLo <= 0) return;
      /* yarısı yüksekten iner, yarısı alçağa çıkar — sertlik oranında */
      const m = .5 * excess;
      d[hi] -= m * sHi; d[lo] += m * sLo;
      any = true;
    };
    for (let i = 0; i < rings; i++) {
      const r = radii[i], chord = 2 * r * Math.sin(Math.PI / angular);
      const dr = i + 1 < rings ? radii[i + 1] - r : 0;
      for (let j = 0; j < angular; j++) {
        const a = index(i, j);
        edge(a, index(i, j + 1), chord);
        if (i + 1 < rings) edge(a, index(i + 1, j), dr);
        if (i === 0) edge(a, 0, r);
      }
    }
    if (!any) break;
    for (let k = 0; k < grid.count; k++) { if (d[k] !== 0) moved++; h[k] += d[k]; delta[k] += d[k]; }
  }
  /* alan düzeltmesi: kutupsal bilineer okuma (r → halka, θ → dilim) */
  const lnRatio = Math.log(grid.ratio), r0 = grid.r0;
  const correction = (x, z) => {
    const r = Math.hypot(x, z);
    if (r <= r0) return delta[0] * (1 - r / r0) + delta[index(0, Math.round(Math.atan2(z, x) / (Math.PI * 2) * angular))] * (r / r0);
    if (r >= grid.rMax) return 0;
    const fi = Math.log(r / r0) / lnRatio;
    const i0 = Math.min(rings - 2, Math.floor(fi)), ti = clamp((r - radii[i0]) / (radii[i0 + 1] - radii[i0]), 0, 1);
    let ang = Math.atan2(z, x); if (ang < 0) ang += Math.PI * 2;
    const fj = ang / (Math.PI * 2) * angular, j0 = Math.floor(fj), tj = fj - j0;
    const a = delta[index(i0, j0)], b = delta[index(i0, j0 + 1)], c = delta[index(i0 + 1, j0)], e = delta[index(i0 + 1, j0 + 1)];
    return (a + (b - a) * tj) * (1 - ti) + (c + (e - c) * tj) * ti;
  };
  field.setCorrection(correction);
  grid.heights.set(h);                            // örgü de düzeltilmiş yüzeyi taşır
  /* kanıt: kırpma sonrası, iki ucu da yumuşak olan örgü kenarlarında en dik eğim */
  let maxSoft = 0;
  const soft = k => hardness[k] < .05;
  for (let i = 0; i < rings; i++) {
    const r = radii[i], chord = 2 * r * Math.sin(Math.PI / angular), dr = i + 1 < rings ? radii[i + 1] - r : 0;
    for (let j = 0; j < angular; j++) {
      const a = index(i, j), b = index(i, j + 1), c = i + 1 < rings ? index(i + 1, j) : -1;
      if (soft(a) && soft(b)) maxSoft = Math.max(maxSoft, Math.abs(h[a] - h[b]) / chord);
      if (c >= 0 && soft(a) && soft(c)) maxSoft = Math.max(maxSoft, Math.abs(h[a] - h[c]) / dr);
    }
  }
  return { moved, passes, maxSlopeDeg, maxSoftSlopeDeg: Math.atan(maxSoft) * 180 / Math.PI };
}

/** three.js BufferGeometry: konum/uv/indeks + ızgara-farkı normaller + harita renkleri. */
export function buildTerrainGeometry(THREE, grid, { uvExtent = 10000 } = {}) {
  const { angular, radii, rings, heights, xs, zs, count, index } = grid;
  const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), nrm = new Float32Array(count * 3);
  pos[1] = heights[0]; uv[0] = .5; uv[1] = .5;
  for (let v = 1; v < count; v++) {
    pos[v * 3] = xs[v]; pos[v * 3 + 1] = heights[v]; pos[v * 3 + 2] = zs[v];
    uv[v * 2] = xs[v] / uvExtent + .5; uv[v * 2 + 1] = .5 - zs[v] / uvExtent;
  }
  /* normal: kutupsal komşulardan (∂h/∂r, ∂h/∂θ) → dünya gradyanı */
  const setN = (v, gx, gz) => { const inv = 1 / Math.hypot(gx, 1, gz); nrm[v * 3] = -gx * inv; nrm[v * 3 + 1] = inv; nrm[v * 3 + 2] = -gz * inv; };
  setN(0, (heights[index(0, 0)] - heights[index(0, angular / 2 | 0)]) / (2 * radii[0]), (heights[index(0, angular / 4 | 0)] - heights[index(0, 3 * angular / 4 | 0)]) / (2 * radii[0]));
  for (let i = 0; i < rings; i++) {
    const r = radii[i];
    const rIn = i > 0 ? radii[i - 1] : 0, rOut = i + 1 < rings ? radii[i + 1] : r;
    for (let j = 0; j < angular; j++) {
      const v = index(i, j);
      const hIn = i > 0 ? heights[index(i - 1, j)] : heights[0];
      const hOut = i + 1 < rings ? heights[index(i + 1, j)] : heights[v];
      const dhdr = (hOut - hIn) / Math.max(1e-9, rOut - rIn);
      const dhdt = (heights[index(i, j + 1)] - heights[index(i, j - 1)]) / (2 * r * Math.sin(Math.PI / angular) * 2);
      const t = j / angular * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      setN(v, dhdr * c - dhdt * s, dhdr * s + dhdt * c);
    }
  }
  const idx = new Uint32Array((angular + (rings - 1) * angular * 2) * 3);
  let n = 0;
  for (let j = 0; j < angular; j++) { idx[n++] = 0; idx[n++] = index(0, j + 1); idx[n++] = index(0, j); }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < angular; j++) {
    const a = index(i, j), b = index(i, j + 1), c = index(i + 1, j), d = index(i + 1, j + 1);
    idx[n++] = a; idx[n++] = d; idx[n++] = c;
    idx[n++] = a; idx[n++] = b; idx[n++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  /* harita renkleri: yükseklik (sagitta çıkarılmış) ve eğim — vitrin görünümleri */
  const colH = new Float32Array(count * 3), colS = new Float32Array(count * 3);
  let hMin = Infinity, hMax = -Infinity;
  const rel = new Float32Array(count);
  for (let v = 0; v < count; v++) { const r2 = xs[v] * xs[v] + zs[v] * zs[v]; rel[v] = heights[v] + r2 / (2 * (grid.radiusUnits || 17374)); if (Math.hypot(xs[v], zs[v]) < 3000) { hMin = Math.min(hMin, rel[v]); hMax = Math.max(hMax, rel[v]); } }
  const ramp = (t, c) => { /* lacivert → altın → fildişi (5 durak, porkchop ile aynı dil) */
    const stops = [[.05, .09, .22], [.16, .26, .48], [.62, .48, .20], [.85, .70, .38], [.95, .93, .86]];
    const f = clamp(t, 0, 1) * 4, i = Math.min(3, Math.floor(f)), u = f - i;
    c[0] = stops[i][0] + (stops[i + 1][0] - stops[i][0]) * u; c[1] = stops[i][1] + (stops[i + 1][1] - stops[i][1]) * u; c[2] = stops[i][2] + (stops[i + 1][2] - stops[i][2]) * u;
  };
  const c = [0, 0, 0];
  for (let v = 0; v < count; v++) {
    ramp((rel[v] - hMin) / Math.max(1e-9, hMax - hMin), c); colH[v * 3] = c[0]; colH[v * 3 + 1] = c[1]; colH[v * 3 + 2] = c[2];
    const slope = Math.acos(clamp(nrm[v * 3 + 1], -1, 1)) * 180 / Math.PI;
    ramp(slope / 45, c); colS[v * 3] = c[0]; colS[v * 3 + 1] = c[1]; colS[v * 3 + 2] = c[2];
  }
  geo.setAttribute('colorHeight', new THREE.BufferAttribute(colH, 3));
  geo.setAttribute('colorSlope', new THREE.BufferAttribute(colS, 3));
  geo.userData.stats = { vertices: count, triangles: idx.length / 3, rings, angular, hMin, hMax };
  return geo;
}
