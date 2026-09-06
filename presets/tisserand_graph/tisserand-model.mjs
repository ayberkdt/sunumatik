/* tisserand-model.mjs — Tisserand grafiği ve çoklu kütleçekim yardımı dizisi planlayıcısı (saf).

   MODEL: gezegenler eş-düzlem dairesel yörüngede (a_P, V_P = √(μ☉/a_P)); uzay aracının güneş-merkezli yörüngesi
   (r_p, r_a) ile tanımlanır. Gezegende v∞ ve pompa açısı α (v∞ ile V_P arasındaki açı):
     v² = V_P² + v∞² + 2 V_P v∞ cos α,  v_t = V_P + v∞ cos α,  v_r = v∞ sin α,  h = a_P v_t,
     a = 1/(2/a_P − v²/μ☉),  e = √(1 − h²/(μ☉ a)),  r_p = a(1−e), r_a = a(1+e).
   Tisserand parametresi T = a_P/a + 2√(a/a_P (1−e²)) — kütleçekim yardımı α'yı değiştirir, v∞ ve T'yi değiştirmez
   (v∞ = V_P √(3 − T)); bu yüzden bir gezegenin sabit-v∞ eğrisi (α taraması) grafikte "yol"dur. Sapma sınırı: minimum
   yükseklik h_min ile δ_max = 2 asin(1/(1 + (R_P + h_min) v∞²/μ_P)); bir geçişte |Δα| ≤ δ_max.
   DİZİ PLANLAYICI: verilen gezegen sırası için her adımda erişilebilir α aralığında bir sonraki gezegeni kesen
   ve hedefi (bir sonraki v∞'yi büyütme ya da Dünya rezonansı) sağlayan α seçilir — açgözlü, FAZLAMA YOK
   (gezegenlerin gerçekten orada olup olmadığı efemerisle bakılmaz; bu grafik nitel bir tasarım aracıdır). */

export const MU_SUN = 1.32712440018e11, AU = 149597870.7;
export const PLANETS = Object.freeze({
  venus: { label: 'Venüs', a: .723332 * AU, mu: 324858.592, R: 6051.8, color: '#e6c48f', T: 224.70 },
  earth: { label: 'Dünya', a: 1.000000 * AU, mu: 398600.4418, R: 6378.137, color: '#8fb8dd', T: 365.256 },
  mars: { label: 'Mars', a: 1.523679 * AU, mu: 42828.375, R: 3396.2, color: '#d78f6c', T: 686.98 },
  jupiter: { label: 'Jüpiter', a: 5.204267 * AU, mu: 1.26686534e8, R: 71492, color: '#d9b877', T: 4332.59 },
  saturn: { label: 'Satürn', a: 9.582017 * AU, mu: 3.7931187e7, R: 60268, color: '#c9b9a0', T: 10759.22 },
});
export const vPlanet = p => Math.sqrt(MU_SUN / PLANETS[p].a);
export const periodOf = a => 2 * Math.PI * Math.sqrt(a ** 3 / MU_SUN);

/** (planet, v∞, α) → güneş-merkezli yörünge. α radyan (0 = V_P yönünde, π = ters). */
export function orbitFromVinf(planet, vinf, alpha) {
  const P = PLANETS[planet], VP = vPlanet(planet);
  const vt = VP + vinf * Math.cos(alpha), vr = vinf * Math.sin(alpha), v2 = vt * vt + vr * vr;
  const a = 1 / (2 / P.a - v2 / MU_SUN); const h = P.a * vt;
  const e = a > 0 ? Math.sqrt(Math.max(0, 1 - h * h / (MU_SUN * a))) : Math.sqrt(1 + h * h / (MU_SUN * -a));
  const rp = a > 0 ? a * (1 - e) : a * (1 - e), ra = a > 0 ? a * (1 + e) : Infinity;
  return { a, e, rp, ra, period: a > 0 ? periodOf(a) : Infinity, T: tisserandOf(planet, a, e), vt, vr, v: Math.sqrt(v2), hyperbolic: a <= 0 };
}
export function tisserandOf(planet, a, e) { const aP = PLANETS[planet].a; return aP / a + 2 * Math.sqrt(Math.max(0, a / aP * (1 - e * e))); }
/** Yörünge (r_p, r_a) gezegeni kesiyorsa oradaki v∞ ve α; kesmiyorsa null. */
export function vinfAt(planet, rp, ra) {
  const P = PLANETS[planet], aP = P.a; if (rp > aP * (1 + 1e-9) || ra < aP * (1 - 1e-9)) return null;
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp), v2 = MU_SUN * (2 / aP - 1 / a), h = Math.sqrt(MU_SUN * a * (1 - e * e));
  const vt = h / aP, vr = Math.sqrt(Math.max(0, v2 - vt * vt)), VP = vPlanet(planet);
  const vinf = Math.hypot(vt - VP, vr), alpha = Math.atan2(vr, vt - VP);
  return { vinf, alpha, vt, vr, T: tisserandOf(planet, a, e) };
}
/** Sabit-v∞ eğrisi: α ∈ [αmin, π] taraması. */
export function contour(planet, vinf, { n = 181 } = {}) {
  const out = []; for (let k = 0; k <= n; k++) { const alpha = Math.PI * k / n; const o = orbitFromVinf(planet, vinf, alpha); out.push({ alpha, ...o }); } return out;
}
/** Bir geçişte en büyük sapma açısı δ_max (radyan) ve buna karşılık gelen b. */
export function maxTurn(planet, vinf, hMin = 300) { const P = PLANETS[planet], rp = P.R + hMin; const s = 1 / (1 + rp * vinf * vinf / P.mu); return { delta: 2 * Math.asin(s), rpMin: rp, ratio: rp * vinf * vinf / P.mu }; }
/** Dünya rezonans yörüngeleri: periyot = (k/m)·T_E → a = a_E (k/m)^(2/3). */
export function resonances(planet = 'earth', list = [[1, 1], [2, 1], [3, 1], [3, 2], [2, 3], [1, 2]]) { const aP = PLANETS[planet].a; return list.map(([k, m]) => ({ k, m, a: aP * Math.pow(k / m, 2 / 3), label: `${k}:${m}` })); }

/**
 * planSequence(['earth','venus','earth','earth','jupiter'], { vinf0, alpha0, hMin, resonanceTargets:{2:[2,1]} })
 * Her adım: mevcut gezegende (v∞, α) → erişilebilir α' ∈ [α − δ_max, α + δ_max] içinde bir sonraki gezegeni kesen
 * yörüngeler; seçim: sonraki gezegen aynıysa (rezonans bacağı) periyot hedefi, değilse sonraki v∞'yi en büyütme
 * (dışa) ya da en küçültme (içe/hedefte yakalama) — mode 'pump' | 'capture'. Döner { legs:[{from,to,vinf,alpha,alphaNew,delta,orbit,vinfNext}], feasible }.
 */
export function planSequence(seq, { vinf0 = 3.5, alpha0 = 0, hMin = 300, mode = 'pump', resonanceTargets = {}, nScan = 721 } = {}) {
  const legs = []; let planet = seq[0], vinf = vinf0, alpha = alpha0, feasible = true;
  for (let i = 0; i < seq.length - 1; i++) {
    const next = seq[i + 1], mt = i === 0 ? { delta: Math.PI } : maxTurn(planet, vinf, hMin);   // ilk bacak: kalkış, α serbest
    const lo = i === 0 ? 0 : Math.max(0, alpha - mt.delta), hi = i === 0 ? Math.PI : Math.min(Math.PI, alpha + mt.delta);
    let best = null;
    for (let k = 0; k <= nScan; k++) {
      const al = lo + (hi - lo) * k / nScan, o = orbitFromVinf(planet, vinf, al); if (o.hyperbolic) continue;
      const at = vinfAt(next, o.rp, o.ra); if (!at) continue;
      let score;
      if (next === planet) { const tgt = resonanceTargets[i + 1] ?? [2, 1]; const Tres = periodOf(PLANETS[planet].a) * tgt[0] / tgt[1]; score = -Math.abs(o.period - Tres); }
      else score = (mode === 'pump' && i < seq.length - 2) ? at.vinf : -at.vinf;
      if (!best || score > best.score) best = { score, alphaNew: al, orbit: o, at };
    }
    if (!best) { feasible = false; legs.push({ from: planet, to: next, vinf, alpha, alphaNew: null, delta: mt.delta, orbit: null, vinfNext: null, reachable: false }); break; }
    legs.push({ from: planet, to: next, vinf, alpha, alphaNew: best.alphaNew, delta: i === 0 ? null : mt.delta, used: i === 0 ? null : Math.abs(best.alphaNew - alpha), orbit: best.orbit, vinfNext: best.at.vinf, alphaNext: best.at.alpha, reachable: true });
    planet = next; vinf = best.at.vinf; alpha = best.at.alpha;
  }
  return { legs, feasible, final: { planet, vinf, alpha } };
}
export const SEQUENCES = Object.freeze({
  veega: { label: 'VEEGA: Dünya → Venüs → Dünya → Dünya → Jüpiter', seq: ['earth', 'venus', 'earth', 'earth', 'jupiter'], vinf0: 3.6, mode: 'pump', resonanceTargets: { 3: [2, 1] } },
  vvejga: { label: 'Dünya → Venüs → Venüs → Dünya → Jüpiter', seq: ['earth', 'venus', 'venus', 'earth', 'jupiter'], vinf0: 3.4, mode: 'pump', resonanceTargets: { 2: [1, 1] } },
  direct: { label: 'Doğrudan Dünya → Jüpiter (Hohmann ölçeği)', seq: ['earth', 'jupiter'], vinf0: 8.8, mode: 'capture' },
  marsSample: { label: 'Dünya → Mars → Dünya (serbest dönüş)', seq: ['earth', 'mars', 'earth'], vinf0: 3.0, mode: 'capture' },
  jupSat: { label: 'Dünya → Jüpiter → Satürn', seq: ['earth', 'jupiter', 'saturn'], vinf0: 9.0, mode: 'capture' },
});
