/* soi-model.mjs — Etki küresi (SOI) ve yamalı-konik el değiştirme, SAF model.

   SOI (Laplace): r_SOI = a (m/M)^(2/5) — ikincil cismin çekiminin "ana", büyük cismin çekiminin "bozucu" sayıldığı
   bölgenin sınırı; sınırda iki bakış açısının bozucu/ana ivme oranları eşitlenir (bu eşitlik denetimde sayısal olarak
   gösterilir). Hill küresi: a (m/3M)^(1/3) (dairesel kısıtlı üç-cisim L1/L2 uzaklığı). Bütün cisim verileri GM (km³/s²)
   ve yarı-büyük eksen olarak girilir; r_SOI ve Hill HESAPLANIR (literatür: Dünya 924 000 km, Ay 66 100 km, Jüpiter
   48,2 milyon km — denetimde).
   Kalkış geometrisi: park yörüngesinden (h_p) v∞ hedefiyle hiperbol: a = −μ/v∞², e = 1 + r_p v∞²/μ, p = a(1−e²);
   SOI'ye ulaşana dek konum (ν) ve süre (hiperbolik anomali); çıkışta hız vektörü ≈ v∞ (asimptot yönünde, artık
   |v(r_SOI)| − v∞ raporlanır — yamalı-konik "hata"nın kendisi). Güneş-merkezli: V_⊕ + v∞ (yön: Dünya hızıyla
   hizalı, prograd) → a, e, afel/perihel. Hiçbir sayı elle yerleştirilmez. */

export const MU_SUN = 1.32712440018e11, AU = 149597870.7;
export const BODIES = Object.freeze({
  mercury: { label: 'Merkür', mu: 22031.78, a: .387098 * AU, parent: 'sun', R: 2439.7, color: '#b9b0a3' },
  venus: { label: 'Venüs', mu: 324858.592, a: .723332 * AU, parent: 'sun', R: 6051.8, color: '#e6c48f' },
  earth: { label: 'Dünya', mu: 398600.4418, a: 1.000000 * AU, parent: 'sun', R: 6378.137, color: '#8fb8dd' },
  mars: { label: 'Mars', mu: 42828.375, a: 1.523679 * AU, parent: 'sun', R: 3396.2, color: '#d78f6c' },
  jupiter: { label: 'Jüpiter', mu: 1.26686534e8, a: 5.204267 * AU, parent: 'sun', R: 71492, color: '#d9b877' },
  saturn: { label: 'Satürn', mu: 3.7931187e7, a: 9.582017 * AU, parent: 'sun', R: 60268, color: '#c9b9a0' },
  uranus: { label: 'Uranüs', mu: 5.793939e6, a: 19.201 * AU, parent: 'sun', R: 25559, color: '#9fd0d8' },
  neptune: { label: 'Neptün', mu: 6.836529e6, a: 30.047 * AU, parent: 'sun', R: 24764, color: '#7fa0e0' },
  moon: { label: 'Ay', mu: 4902.800066, a: 384400, parent: 'earth', R: 1737.4, color: '#a9a49b' },
});
export const parentMu = id => (BODIES[id].parent === 'sun' ? MU_SUN : BODIES[BODIES[id].parent].mu);
export const soiRadius = id => BODIES[id].a * Math.pow(BODIES[id].mu / parentMu(id), 2 / 5);
export const hillRadius = id => BODIES[id].a * Math.pow(BODIES[id].mu / (3 * parentMu(id)), 1 / 3);
export const orbitalSpeed = id => Math.sqrt(parentMu(id) / BODIES[id].a);

/** Laplace ölçütü: ikincile r uzaklığında, iki bakış açısının (bozucu/ana) ivme oranları. Ana cisim ikincile a uzaklıkta, r << a. */
export function accelRatios(id, r) {
  const mu = BODIES[id].mu, M = parentMu(id), a = BODIES[id].a;
  const aBody = mu / (r * r);                                     // ikincilin çekimi
  const aParentPerturb = M * (1 / ((a - r) * (a - r)) - 1 / (a * a));   // ana cismin FARK (gelgit) ivmesi (radyal doğrultuda, birinci mertebe ≈ 2Mr/a³)
  const aParent = M / (a * a);                                    // ana cismin çekimi (heliyosentrik bakış)
  const aBodyPerturb = aBody;                                     // ikincilin bozucu çekimi
  return { geo: aParentPerturb / aBody, helio: aBodyPerturb / aParent, aBody, aParentPerturb };
}
/** Oranların eşitlendiği yarıçap (bisection) — SOI tanımının sayısal doğrulaması. */
export function laplaceCrossing(id) {
  let lo = BODIES[id].R * 2, hi = BODIES[id].a * .5;
  const f = r => { const q = accelRatios(id, r); return Math.log(q.geo) - Math.log(q.helio); };
  for (let k = 0; k < 80; k++) { const m = Math.sqrt(lo * hi); (f(m) < 0 ? (lo = m) : (hi = m)); }
  return Math.sqrt(lo * hi);
}

/** Kalkış hiperbolü: h_p km park, vinf km/s. Döner geometri + SOI'ye süre + çıkış hızı + yamalı-konik artığı. */
export function departure(id = 'earth', { hPark = 200, vinf = 3, n = 300 } = {}) {
  const B = BODIES[id], mu = B.mu, rp = B.R + hPark, rSoi = soiRadius(id);
  const a = -mu / (vinf * vinf), e = 1 + rp * vinf * vinf / mu, p = a * (1 - e * e), h = Math.sqrt(mu * p);
  const nuInf = Math.acos(-1 / e), nuSoi = Math.acos(Math.max(-1, Math.min(1, (p / rSoi - 1) / e)));
  const vPark = Math.sqrt(mu / rp), vPeri = Math.sqrt(vinf * vinf + 2 * mu / rp), dvInject = vPeri - vPark;
  const tof = nu => { const F = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2)); return Math.sqrt(-a * a * a / mu) * (e * Math.sinh(F) - F); };
  const pts = []; for (let k = 0; k <= n; k++) { const nu = nuSoi * k / n, r = p / (1 + e * Math.cos(nu)); pts.push({ nu, r, x: r * Math.cos(nu), y: r * Math.sin(nu), t: tof(nu), v: Math.sqrt(mu * (2 / r - 1 / a)) }); }
  const vAtSoi = Math.sqrt(mu * (2 / rSoi - 1 / a)), residual = vAtSoi - vinf;   // SOI'de hız v∞'den büyüktür: yamalı-konik el değiştirmenin "artığı"
  const turn = 2 * Math.asin(1 / e), asymptoteDeg = nuInf * 180 / Math.PI;
  /* güneş-merkezli sonuç (v∞ Dünya hızına paralel, prograd) */
  const VE = orbitalSpeed(id), M = parentMu(id), aP = B.a, vH = VE + vinf, aH = 1 / (2 / aP - vH * vH / M), eH = aH > 0 ? Math.abs(aH - aP) / aH : NaN;
  return { id, rp, rSoi, a, e, p, nuSoi, nuInf, asymptoteDeg, turnDeg: turn * 180 / Math.PI, pts, tSoiDays: tof(nuSoi) / 86400, vAtSoi, residual, residualPct: residual / vinf * 100, dvInject, vPark, vPeri, helio: { V: VE, v: vH, a: aH, e: eH, aphelion: aH > 0 ? aH * (1 + eH) : Infinity, perihelion: aH > 0 ? aH * (1 - eH) : NaN, hyperbolic: aH <= 0 } };
}
export const CASES = Object.freeze({
  mars: { label: 'Mars transferi (v∞ ≈ 3 km/s)', vinf: 2.95 }, moonTli: { label: 'Ay transferi (TLI, v∞ ≈ 0,8 km/s)', vinf: .8 },
  jupiter: { label: 'Jüpiter (v∞ ≈ 8,8 km/s)', vinf: 8.8 }, escape: { label: 'Güneş sisteminden kaçış (v∞ 12,5 km/s)', vinf: 12.5 },   // √2·V_⊕ − V_⊕ = 12,34 km/s eşiği
});
