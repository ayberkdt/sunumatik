/* constellation-model.mjs — Walker takımyıldızı + kapsama geometrisi (SAF, THREE'siz).
   constellation_coverage preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar.

   MODEL
   • Walker Delta / Star: i:T/P/F. P düzlem, düzlem başına S uydu (T = P·S), faz F ∈ [0, P).
     Düzlem k'nin RAAN'ı: Ω_k = Ω₀ + k·(ΔΩ/P), ΔΩ = 360° (Delta) ya da 180° (Star).
     Uydu (k, j) enlem argümanı: u_kj = j·360°/S + k·F·360°/T.  Dairesel yörüngeler, iki-cisim.
   • Konum (ECI): r = (R+h)·[cosΩ cos u − sinΩ sin u cos i, sinΩ cos u + cosΩ sin u cos i, sin u sin i]
     u(t) = u₀ + n t. Dünya ω_e ile döner; kapsama Dünya-sabit ızgarada değerlendirilir.
   • Ayak izi: minimum yükseklik açısı ε için merkez açı λ = acos( R/(R+h) · cos ε ) − ε;
     yer noktası kapsanır ⇔ noktanın alt-uydu noktasına merkez açısı ≤ λ. (Küresel Dünya.)
   • Kapsama istatistiği: enlem-boylam ızgarası cos(lat) ağırlıklı → anlık kapsama oranı,
     ortalama katlılık, kapsanmayan oran; zaman taraması ile en uzun boşluk (max gap) ve
     ortalama yeniden ziyaret. Bir yer istasyonu için görünen uydu sayısı.
   SINIRLAR: J2 yok (düzlemler sabit), küresel Dünya, ε tek eşik (anten/terrain yok). */

export const R_E = 6378.137, MU = 398600.4418, OMEGA_E = 7.2921159e-5, TAU = Math.PI * 2;
const rad = Math.PI / 180;

export const CONSTELLATION_PRESETS = Object.freeze({
  gps: { label: 'GPS (Walker 55°: 24/6/1)', planes: 6, perPlane: 4, phasing: 1, inc: 55, alt: 20200, minElev: 5, kind: 'delta' },
  galileo: { label: 'Galileo (Walker 56°: 24/3/1)', planes: 3, perPlane: 8, phasing: 1, inc: 56, alt: 23222, minElev: 5, kind: 'delta' },
  iridium: { label: 'Iridium (Star 86,4°: 66/6/2)', planes: 6, perPlane: 11, phasing: 2, inc: 86.4, alt: 780, minElev: 8.2, kind: 'star' },
  leoShell: { label: 'LEO kabuğu (Delta 53°: 288/24/1)', planes: 24, perPlane: 12, phasing: 1, inc: 53, alt: 550, minElev: 25, kind: 'delta' },
  molniyaLike: { label: 'Seyrek kutupsal (Star 90°: 12/3/1)', planes: 3, perPlane: 4, phasing: 1, inc: 90, alt: 1200, minElev: 10, kind: 'star' },
  geoRing: { label: 'GEO halkası (Delta 0°: 3/1/0)', planes: 1, perPlane: 3, phasing: 0, inc: 0, alt: 35786, minElev: 5, kind: 'delta' },
});

/** Ayak izi merkez açısı (rad). */
export function footprintAngle(alt, minElevDeg) {
  const e = minElevDeg * rad;
  return Math.acos(Math.min(1, R_E / (R_E + alt) * Math.cos(e))) - e;
}

/** Takımyıldızı kur: [{ plane, index, raan, u0 }], n, r. */
export function buildConstellation(cfg) {
  const c = { planes: 6, perPlane: 4, phasing: 1, inc: 55, alt: 20200, minElev: 5, kind: 'delta', raan0: 0, ...cfg };
  const P = Math.max(1, Math.round(c.planes)), S = Math.max(1, Math.round(c.perPlane)), T = P * S;
  const spread = (c.kind === 'star' ? Math.PI : TAU) / P;
  const sats = [];
  for (let k = 0; k < P; k++) for (let j = 0; j < S; j++) sats.push({ plane: k, index: j, raan: c.raan0 * rad + k * spread, u0: j * TAU / S + k * c.phasing * TAU / T });
  const r = R_E + c.alt, n = Math.sqrt(MU / (r * r * r));
  return { cfg: c, sats, T, P, S, r, n, period: TAU / n, inc: c.inc * rad, lambda: footprintAngle(c.alt, c.minElev) };
}

/** t anında tüm uydu ECI konumları (Float64Array 3T) ve alt-uydu birim vektörleri ECEF (3T). */
export function positionsAt(con, t, theta0 = 0) {
  const { sats, r, n, inc } = con;
  const eci = new Float64Array(sats.length * 3), ecefU = new Float64Array(sats.length * 3);
  const ci = Math.cos(inc), si = Math.sin(inc), th = theta0 + OMEGA_E * t, cth = Math.cos(th), sth = Math.sin(th);
  for (let k = 0; k < sats.length; k++) {
    const s = sats[k], u = s.u0 + n * t, cO = Math.cos(s.raan), sO = Math.sin(s.raan), cu = Math.cos(u), su = Math.sin(u);
    const x = cO * cu - sO * su * ci, y = sO * cu + cO * su * ci, z = su * si;
    eci[k * 3] = x * r; eci[k * 3 + 1] = y * r; eci[k * 3 + 2] = z * r;
    ecefU[k * 3] = cth * x + sth * y; ecefU[k * 3 + 1] = -sth * x + cth * y; ecefU[k * 3 + 2] = z;
  }
  return { eci, ecefU };
}

/** Enlem-boylam ızgarası (Dünya-sabit): birim vektörler + cos(lat) ağırlıkları. */
export function makeGrid(nLon = 128, nLat = 64) {
  const N = nLon * nLat, u = new Float64Array(N * 3), w = new Float64Array(N), lat = new Float64Array(N), lon = new Float64Array(N);
  let k = 0;
  for (let j = 0; j < nLat; j++) { const la = -Math.PI / 2 + (j + .5) / nLat * Math.PI; for (let i = 0; i < nLon; i++) { const lo = -Math.PI + (i + .5) / nLon * TAU; u[k * 3] = Math.cos(la) * Math.cos(lo); u[k * 3 + 1] = Math.cos(la) * Math.sin(lo); u[k * 3 + 2] = Math.sin(la); w[k] = Math.cos(la); lat[k] = la; lon[k] = lo; k++; } }
  return { nLon, nLat, N, u, w, lat, lon };
}

/** Anlık kapsama: her ızgara hücresi için görünen uydu sayısı (Uint8Array) + istatistik. */
export function coverageAt(con, grid, t, theta0 = 0, out = null) {
  const { ecefU } = positionsAt(con, t, theta0);
  const cosL = Math.cos(con.lambda);
  const count = out || new Uint8Array(grid.N);
  let covW = 0, totW = 0, multW = 0;
  for (let g = 0; g < grid.N; g++) {
    const ux = grid.u[g * 3], uy = grid.u[g * 3 + 1], uz = grid.u[g * 3 + 2];
    let c = 0;
    for (let k = 0; k < con.T; k++) if (ux * ecefU[k * 3] + uy * ecefU[k * 3 + 1] + uz * ecefU[k * 3 + 2] >= cosL) c++;
    count[g] = Math.min(255, c);
    totW += grid.w[g]; if (c > 0) covW += grid.w[g]; multW += c * grid.w[g];
  }
  return { count, fraction: covW / totW, meanMultiplicity: multW / totW, uncovered: 1 - covW / totW };
}

/** Bir yer noktasından görünen uydular: [{k, elev}] (ε eşiği üstündekiler). */
export function visibleFrom(con, latDeg, lonDeg, t, theta0 = 0) {
  const la = latDeg * rad, lo = lonDeg * rad;
  const g = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const { ecefU } = positionsAt(con, t, theta0);
  const out = [];
  for (let k = 0; k < con.T; k++) {
    const cosc = g[0] * ecefU[k * 3] + g[1] * ecefU[k * 3 + 1] + g[2] * ecefU[k * 3 + 2];
    /* yükseklik açısı: tan ε = (cos c − R/(R+h)) / sin c */
    const c = Math.acos(Math.max(-1, Math.min(1, cosc)));
    const elev = Math.atan2(cosc - R_E / con.r, Math.sin(c));
    if (elev >= con.cfg.minElev * rad) out.push({ k, elev });
  }
  return out;
}

/**
 * Zaman taraması: bir periyot (ya da span) boyunca dt adımlarla kapsama;
 * döner { meanFraction, minFraction, maxGap (s), meanGap, continuousFraction (her adımda kapsanan hücre oranı) }.
 * Kaba ızgara önerilir (64×32) — maliyet ∝ adım × hücre × T.
 */
export function revisitScan(con, { span = null, dt = 60, nLon = 64, nLat = 32, theta0 = 0 } = {}) {
  const grid = makeGrid(nLon, nLat);
  const total = span ?? Math.max(con.period, 2 * Math.PI / OMEGA_E / 4);   // en az bir yörünge periyodu, sürüklenmeyi görmek için ≥ 6 saat
  const steps = Math.max(2, Math.round(total / dt));
  const lastCov = new Float64Array(grid.N).fill(-1), maxGap = new Float64Array(grid.N), gapSum = new Float64Array(grid.N), gapN = new Uint16Array(grid.N);
  const everUncovered = new Uint8Array(grid.N);
  const cnt = new Uint8Array(grid.N);
  let fracSum = 0, fracMin = 1;
  for (let s = 0; s <= steps; s++) {
    const t = s * dt;
    const cov = coverageAt(con, grid, t, theta0, cnt);
    fracSum += cov.fraction; fracMin = Math.min(fracMin, cov.fraction);
    for (let g = 0; g < grid.N; g++) {
      if (cnt[g] > 0) { if (lastCov[g] >= 0 && t - lastCov[g] > dt * 1.5) { const gap = t - lastCov[g]; maxGap[g] = Math.max(maxGap[g], gap); gapSum[g] += gap; gapN[g]++; } lastCov[g] = t; }
      else everUncovered[g] = 1;
    }
  }
  let worstGap = 0, gapW = 0, gapWsum = 0, contW = 0, totW = 0;
  for (let g = 0; g < grid.N; g++) { totW += grid.w[g]; worstGap = Math.max(worstGap, maxGap[g]); if (gapN[g]) { gapWsum += gapSum[g] / gapN[g] * grid.w[g]; gapW += grid.w[g]; } if (!everUncovered[g]) contW += grid.w[g]; }
  return { meanFraction: fracSum / (steps + 1), minFraction: fracMin, maxGap: worstGap, meanGap: gapW ? gapWsum / gapW : 0, continuousFraction: contW / totW, steps, dt, span: total, maxGapField: maxGap, grid };
}
