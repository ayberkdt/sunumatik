/* gravity-model.mjs — Küresel harmonik yerçekimi alanı (saf, THREE'siz).
   gravity_field preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.

   MODEL
   • Potansiyel: U(r,φ,λ) = (GM/r) [1 + Σ_{l≥2} (R/r)^l Σ_{m=0}^{l} P̄_lm(sin φ) (C̄_lm cos mλ + S̄_lm sin mλ)]
     — TAM NORMALİZE katsayılar ve 4π-normalize bağlı Legendre fonksiyonları (kararlı ileri sütun/satır özyineleme).
   • Bozukluk potansiyeli T = U − GM/r; jeoit yüksekliği (Bruns) N ≈ T/γ, γ = GM/R²; serbest-hava yerçekimi
     anomalisi δg = (GM/r²) Σ (l−1)(R/r)^l Σ P̄_lm(…) (küresel yaklaşım).
   • Derece varyansı σ_l² = Σ_m (C̄²+S̄²); Kaula kuralı σ_l ≈ 1e−5/l² (referans eğri).
   • İvme: ∇U merkezi farklarla (h = 1 m; illüstratif yayılım için yeterli). Yalnız C̄20 ile yayılım, J2 sekülar
     oranlarıyla çapraz-denetlenir (C̄20 = −J2/√5).

   KATSAYI KAYNAĞI — DÜRÜSTLÜK
   • GERÇEK (düşük derece, EGM96/EGM2008'den yuvarlatılmış, tam normalize): C̄20 = −4,84165e−4, C̄30 = 9,5716e−7,
     C̄40 = 5,3999e−7, C̄22 = 2,4393e−6, S̄22 = −1,4003e−6, C̄21 ≈ 0, S̄21 ≈ 0. Kaynak: NGA EGM96 (kamuya açık),
     4 anlamlı basamağa yuvarlanmış. Bu kadarı "Dünya'nın yassılığı ve ekvatoral elipsliği" için yeterlidir.
   • SENTETİK (illüstratif): l ≥ 3'te m ≥ 1 ve l ≥ 5 tümü, tohumlu rastgele, Kaula kuralına uyan genlik — GERÇEK
     DÜNYA VERİSİ DEĞİLDİR; sahne bunu her karede yazar. Gerçek yüksek dereceli alan için EGM2008 dosyası yüklenmelidir
     (loadCoefficients ile {l,m,C,S} dizisi verilebilir). */

export const GM = 3.986004418e14, R = 6378137, J2 = 1.08262668e-3;
/* Referans elipsoidin (GRS80) NORMAL alanı: jeoit yüksekliği elipsoide göre tanımlanır; normal alanın çift zonalleri
   çıkarılmazsa J2 şişkinliği (±7 km) her şeyi örter. C̄20n = −J2n/√5, C̄40n = −J4n/3 (tam normalize). */
export const NORMAL_FIELD = Object.freeze({ C20: -4.841668e-4, C40: 7.9030e-7 });

export const REAL_LOW_DEGREE = Object.freeze([
  { l: 2, m: 0, C: -4.84165e-4, S: 0 }, { l: 2, m: 1, C: 0, S: 0 }, { l: 2, m: 2, C: 2.4393e-6, S: -1.4003e-6 },
  { l: 3, m: 0, C: 9.5716e-7, S: 0 }, { l: 4, m: 0, C: 5.3999e-7, S: 0 },
]);

function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = rng => { const u = 1 - rng(), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/** Katsayı seti kur: gerçek düşük derece + sentetik Kaula (l ≤ Lmax). Döner { C, S, Lmax, provenance:[…] } (C[l][m]). */
export function buildCoefficients(Lmax = 24, { seed = 7, kaula = 1e-5, syntheticScale = 1 } = {}) {
  const C = [], S = [], prov = [];
  for (let l = 0; l <= Lmax; l++) { C.push(new Float64Array(l + 1)); S.push(new Float64Array(l + 1)); prov.push(new Uint8Array(l + 1)); }
  C[0][0] = 1;
  const rng = mulberry32(seed);
  for (let l = 2; l <= Lmax; l++) for (let m = 0; m <= l; m++) {
    const sig = kaula / (l * l) * syntheticScale;       // Kaula: derece başına RMS, katsayı başına ≈ σ_l/√(2l+1)
    const perCoef = sig / Math.sqrt(2 * l + 1);
    C[l][m] = gauss(rng) * perCoef; S[l][m] = m === 0 ? 0 : gauss(rng) * perCoef; prov[l][m] = 2;   // 2 = sentetik
  }
  for (const c of REAL_LOW_DEGREE) if (c.l <= Lmax) { C[c.l][c.m] = c.C; S[c.l][c.m] = c.S; prov[c.l][c.m] = 1; }   // 1 = gerçek
  return { C, S, Lmax, prov };
}
/** Dış katsayı listesi yükle: [{l,m,C,S}] tam normalize. */
export function loadCoefficients(list, Lmax) {
  const C = [], S = [], prov = [];
  for (let l = 0; l <= Lmax; l++) { C.push(new Float64Array(l + 1)); S.push(new Float64Array(l + 1)); prov.push(new Uint8Array(l + 1)); }
  C[0][0] = 1;
  const cs = { C, S, Lmax, prov };                         // YALNIZ verilen liste (gerçek düşük derece otomatik eklenmez)
  for (const c of list) if (c.l <= Lmax) { cs.C[c.l][c.m] = c.C; cs.S[c.l][c.m] = c.S ?? 0; cs.prov[c.l][c.m] = 1; }
  return cs;
}

/** Tam normalize bağlı Legendre P̄_lm(t), t = sin φ; P[l][m]. Kararlı özyineleme (Holmes & Featherstone tarzı, ölçekleme gerektirmeyen dereceler için). */
export function legendreNormalized(t, Lmax) {
  const u = Math.sqrt(Math.max(0, 1 - t * t));
  const P = []; for (let l = 0; l <= Lmax; l++) P.push(new Float64Array(l + 1));
  P[0][0] = 1;
  if (Lmax >= 1) { P[1][0] = Math.sqrt(3) * t; P[1][1] = Math.sqrt(3) * u; }
  for (let l = 2; l <= Lmax; l++) {
    /* diyagonal: P̄_ll = u √((2l+1)/(2l)) P̄_{l−1,l−1} */
    P[l][l] = u * Math.sqrt((2 * l + 1) / (2 * l)) * P[l - 1][l - 1];
    /* alt-diyagonal: P̄_{l,l−1} = t √(2l+1) P̄_{l−1,l−1} */
    P[l][l - 1] = t * Math.sqrt(2 * l + 1) * P[l - 1][l - 1];
    for (let m = 0; m <= l - 2; m++) {
      const a = Math.sqrt((2 * l + 1) * (2 * l - 1) / ((l - m) * (l + m))), b = Math.sqrt((2 * l + 1) * (l + m - 1) * (l - m - 1) / ((l - m) * (l + m) * (2 * l - 3)));
      P[l][m] = a * t * P[l - 1][m] - b * P[l - 2][m];
    }
  }
  return P;
}

/** Bozukluk potansiyeli T (m²/s²) ve serbest-hava anomali δg (m/s²) — r, φ (rad), λ (rad); dereceler [lMin, lMax], isteğe bağlı yalnız-zonal / yalnız-derece. */
export function disturbance(cs, r, phi, lam, { lMin = 2, lMax = cs.Lmax, zonalOnly = false, onlyDegree = null, removeNormal = true } = {}) {
  const P = legendreNormalized(Math.sin(phi), lMax);
  const cosm = new Float64Array(lMax + 1), sinm = new Float64Array(lMax + 1);
  for (let m = 0; m <= lMax; m++) { cosm[m] = Math.cos(m * lam); sinm[m] = Math.sin(m * lam); }
  let T = 0, dg = 0; const rr = R / r; let pw = rr * rr;   // (R/r)^2 başlangıç
  for (let l = 2; l <= lMax; l++, pw *= rr) {
    if (l < lMin) continue; if (onlyDegree != null && l !== onlyDegree) continue;
    let sum = 0; const mMax = zonalOnly ? 0 : l;
    for (let m = 0; m <= mMax; m++) sum += P[l][m] * (cs.C[l][m] * cosm[m] + cs.S[l][m] * sinm[m]);
    if (removeNormal) { if (l === 2) sum -= P[2][0] * NORMAL_FIELD.C20; else if (l === 4) sum -= P[4][0] * NORMAL_FIELD.C40; }
    T += pw * sum; dg += (l - 1) * pw * sum;
  }
  return { T: GM / r * T, dg: GM / (r * r) * dg, N: GM / r * T / (GM / (R * R)) };
}

/** Derece varyans spektrumu: σ_l = √Σ_m(C̄²+S̄²) ve Kaula referansı. */
export function degreeSpectrum(cs) { const out = []; for (let l = 2; l <= cs.Lmax; l++) { let s = 0; for (let m = 0; m <= l; m++) s += cs.C[l][m] ** 2 + cs.S[l][m] ** 2; out.push({ l, sigma: Math.sqrt(s), kaula: 1e-5 / (l * l) }); } return out; }

/** Yüzey haritası (nLon × nLat): N (m) ve δg (mGal) ızgaraları + istatistik. */
export function surfaceGrid(cs, nLon = 180, nLat = 90, opts = {}) {
  const N = new Float32Array(nLon * nLat), dg = new Float32Array(nLon * nLat); let nMin = Infinity, nMax = -Infinity, gMin = Infinity, gMax = -Infinity;
  for (let j = 0; j < nLat; j++) { const phi = -Math.PI / 2 + (j + .5) / nLat * Math.PI; for (let i = 0; i < nLon; i++) { const lam = -Math.PI + (i + .5) / nLon * 2 * Math.PI; const d = disturbance(cs, R, phi, lam, opts); const k = j * nLon + i; N[k] = d.N; dg[k] = d.dg * 1e5; nMin = Math.min(nMin, d.N); nMax = Math.max(nMax, d.N); gMin = Math.min(gMin, dg[k]); gMax = Math.max(gMax, dg[k]); } }
  return { N, dg, nLon, nLat, nMin, nMax, gMin, gMax };
}

/** Toplam ivme ∇U (m/s²) merkezi farkla; ECEF [x,y,z] m. */
export function acceleration(cs, x, y, z, opts = {}) {
  const h = 1;
  const U = (x, y, z) => { const r = Math.hypot(x, y, z), phi = Math.asin(z / r), lam = Math.atan2(y, x); return GM / r + disturbance(cs, r, phi, lam, opts).T; };
  return [(U(x + h, y, z) - U(x - h, y, z)) / (2 * h), (U(x, y + h, z) - U(x, y - h, z)) / (2 * h), (U(x, y, z + h) - U(x, y, z - h)) / (2 * h)];
}

/** Kısa yayılım (ECI ≈ ECEF: Dünya dönmesi alanın tesseral kısmı için ihmal — yalnız düğüm kayması gösterimi). Döner RAAN oranı (rad/s) ve enerji sapması. */
export function propagateNodeDrift(cs, { a = 6778137, i = 51.6 * Math.PI / 180, hours = 12, dt = 30, opts = {} } = {}) {
  const v0 = Math.sqrt(GM / a); let r = [a, 0, 0], v = [0, v0 * Math.cos(i), v0 * Math.sin(i)];
  const raanOf = (r, v) => { const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]]; return Math.atan2(h[0], -h[1]); };
  const E0 = .5 * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) - (GM / a + disturbance(cs, a, 0, 0, opts).T);
  const raan0 = raanOf(r, v); const raans = [0], times = [0]; let t = 0;
  const f = (r) => acceleration(cs, r[0], r[1], r[2], opts);
  while (t < hours * 3600) {
    const k1 = f(r), r2 = r.map((x, k) => x + .5 * dt * v[k]), v2 = v.map((x, k) => x + .5 * dt * k1[k]), k2 = f(r2), r3 = r.map((x, k) => x + .5 * dt * v2[k]), v3 = v.map((x, k) => x + .5 * dt * k2[k]), k3 = f(r3), r4 = r.map((x, k) => x + dt * v3[k]), v4 = v.map((x, k) => x + dt * k3[k]), k4 = f(r4);
    r = r.map((x, k) => x + dt / 6 * (v[k] + 2 * v2[k] + 2 * v3[k] + v4[k])); v = v.map((x, k) => x + dt / 6 * (k1[k] + 2 * k2[k] + 2 * k3[k] + k4[k])); t += dt;
    let d = raanOf(r, v) - raan0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; raans.push(d); times.push(t);
  }
  const n = times.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let k = 0; k < n; k++) { sx += times[k]; sy += raans[k]; sxx += times[k] ** 2; sxy += times[k] * raans[k]; }
  const rn = Math.hypot(...r), E1 = .5 * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) - (GM / rn + disturbance(cs, rn, Math.asin(r[2] / rn), Math.atan2(r[1], r[0]), opts).T);
  return { raanDot: (n * sxy - sx * sy) / (n * sxx - sx * sx), energyDrift: Math.abs(E1 - E0) / Math.abs(E0) };
}
