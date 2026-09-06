/* free-return-model.mjs — Ay serbest dönüş yörüngesi (Apollo tipi "8" figürü), SAF model.
   Çözücü: ../core/astro-cr3bp.mjs (Dünya–Ay CR3BP, cisme yakınlıkta adaptif adımlı RK4). Birimler: uzunluk L = 384 400 km,
   zaman TU = T_ay/2π, hız VU = L/TU ≈ 1,023 km/s. Başlangıç: LEO (h₀) üstünde, Dünya–Ay doğrultusundan θ₀ faz açısında,
   Dünya'ya göre eylemsiz teğetsel hız v_I = v_circ + ΔV_TLI; dönen çerçeveye v_R = v_I − ω × r (ω = 1 ẑ) ile geçilir.
   Yayılım: perilune (Ay'a en yakın) ve sonrasında Dünya'ya dönüş perigee'si ölçülür. Serbest dönüş: perilune yüksekliği
   h_p > h_min ve dönüş perigee'si atmosfer içinde (≈ 60–120 km) — hiç manevrasız. (ΔV, θ₀) taraması bu koridoru haritalar;
   en iyi aday dönüş perigee hedefine en yakın olandır. Hiçbir sayı elle yerleştirilmez; Apollo ölçeği denetimde
   (ΔV_TLI ≈ 3,1 km/s, Ay'a ~3 gün, perilune ~100–300 km, toplam ~6 gün). */

import { SYSTEMS, propagateAdaptive, jacobi, rotatingToInertial } from '../core/astro-cr3bp.mjs';

export const SYS = SYSTEMS.earthMoon, MU = SYS.mu, L = SYS.L, TU = SYS.T / (2 * Math.PI), VU = L / TU;
export const R_EARTH = SYS.rPrimary / L, R_MOON = SYS.rSecondary / L, MU_E_KM = 398600.4418;
const norm3 = v => Math.hypot(v[0], v[1], v[2]);

/** Başlangıç durumu (dönen çerçeve). h0 km, theta0 derece (Dünya–Ay doğrultusundan, saat yönü tersi), dvKmS. */
export function initialState({ h0 = 200, theta0 = 229, dvKmS = 3.14 } = {}) {
  const r0 = (SYS.rPrimary + h0) / L, vc = Math.sqrt(MU_E_KM / (SYS.rPrimary + h0)) / VU, vI = vc + dvKmS / VU, th = theta0 * Math.PI / 180;
  const rx = -MU + r0 * Math.cos(th), ry = r0 * Math.sin(th);                       // Dünya (−μ, 0) çevresinde
  const tx = -Math.sin(th), ty = Math.cos(th);                                       // teğet (ileri, saat yönü tersi)
  const vxI = vI * tx, vyI = vI * ty;                                                // Dünya-göreli eylemsiz hız
  const vxR = vxI + ry, vyR = vyI - (rx + MU);                                       // v_R = v_I − ω×r_rel (ω = 1)
  return [rx, ry, 0, vxR, vyR, 0];
}

/** Tek yörünge: perilune, dönüş perigee, süreler, izler. */
export function simulate({ h0 = 200, theta0 = 229, dvKmS = 3.14, tEndDays = 8, dt = 2e-3 } = {}) {
  const s0 = initialState({ h0, theta0, dvKmS }), tEnd = tEndDays * 86400 / TU;
  const r = propagateAdaptive(MU, s0, tEnd, dt, { hMinFactor: 1e-5, refDist: .2 });   // adım ∝ (r/0,2)^1,5: LEO'da ~280 adım/tur, Ay yakınında ~80 adım/tur
  let peri = null, perigee = null, impactMoon = false, impactEarth = false, iPeri = -1;
  for (let i = 0; i < r.states.length; i++) { const s = r.states[i]; const dm = Math.hypot(s[0] - 1 + MU, s[1], s[2]); if (!peri || dm < peri.d) { peri = { d: dm, i }; } }
  if (peri) { iPeri = peri.i; for (let i = iPeri + 20; i < r.states.length; i++) { const s = r.states[i]; const de = Math.hypot(s[0] + MU, s[1], s[2]); if (!perigee || de < perigee.d) perigee = { d: de, i }; } }
  const last = r.states[r.states.length - 1]; impactMoon = peri && (peri.d - R_MOON) * L < 0; impactEarth = perigee && (perigee.d - R_EARTH) * L < 0;
  const C0 = jacobi(MU, s0), Cend = jacobi(MU, last);
  return { s0, states: r.states, times: r.times, perilune: peri ? { altKm: (peri.d - R_MOON) * L, tDays: r.times[peri.i] * TU / 86400, i: peri.i } : null, returnPerigee: perigee ? { altKm: (perigee.d - R_EARTH) * L, tDays: r.times[perigee.i] * TU / 86400, i: perigee.i } : null, impactMoon, impactEarth, jacobiDrift: Math.abs(Cend - C0), C: C0, h0, theta0, dvKmS, inertial: r.states.map((s, i) => rotatingToInertial(s, r.times[i])) };
}

/** (ΔV, θ₀) taraması: her hücrede perilune ve dönüş perigee yüksekliği. Döner { dv:[], th:[], cells:[{dv, th, hp, hr, ok}], best } */
export function scan({ h0 = 200, dvRange = [3.125, 3.155], thRange = [222, 236], nDv = 16, nTh = 29, hpMin = 100, hrTarget = 100, hrTol = 150, tEndDays = 8 } = {}) {
  const cells = []; let best = null;
  for (let a = 0; a < nDv; a++) for (let b = 0; b < nTh; b++) {
    const dv = dvRange[0] + (dvRange[1] - dvRange[0]) * a / (nDv - 1), th = thRange[0] + (thRange[1] - thRange[0]) * b / (nTh - 1);
    const s = simulate({ h0, theta0: th, dvKmS: dv, tEndDays, dt: 4e-3 });
    const hp = s.perilune ? s.perilune.altKm : NaN, hr = s.returnPerigee ? s.returnPerigee.altKm : NaN;
    const ok = Number.isFinite(hp) && Number.isFinite(hr) && hp > hpMin && !s.impactMoon && Math.abs(hr - hrTarget) < hrTol && hp < 20000 && s.returnPerigee.tDays < tEndDays - .05;
    cells.push({ dv, th, hp, hr, ok, tPeri: s.perilune ? s.perilune.tDays : NaN, tRet: s.returnPerigee ? s.returnPerigee.tDays : NaN });
    if (ok) { const score = Math.abs(hr - hrTarget) + .05 * Math.max(0, 500 - hp); if (!best || score < best.score) best = { dv, th, hp, hr, score, tPeri: s.perilune.tDays, tRet: s.returnPerigee.tDays }; }
  }
  /* yerel iyileştirme: her ΔV satırında dönüş perigee − hedef işaret değiştiren komşu θ₀ hücreleri arasında bisection */
  const refined = [];
  for (let a = 0; a < nDv; a++) {
    const row = cells.slice(a * nTh, (a + 1) * nTh);
    for (let b = 0; b < nTh - 1; b++) {
      const c0 = row[b], c1 = row[b + 1]; const valid = c => Number.isFinite(c.hp) && Number.isFinite(c.hr) && c.hp > hpMin && c.hp < 20000;
      if (!valid(c0) || !valid(c1) || (c0.hr - hrTarget) * (c1.hr - hrTarget) > 0) continue;
      let lo = c0.th, hi = c1.th, flo = c0.hr - hrTarget, sol = null;
      for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; const s = simulate({ h0, theta0: mid, dvKmS: c0.dv, tEndDays, dt: 4e-3 }); const hr = s.returnPerigee ? s.returnPerigee.altKm : NaN, hp = s.perilune ? s.perilune.altKm : NaN; if (!Number.isFinite(hr)) break; sol = { dv: c0.dv, th: mid, hp, hr, tPeri: s.perilune.tDays, tRet: s.returnPerigee.tDays }; if ((hr - hrTarget) * flo > 0) { lo = mid; flo = hr - hrTarget; } else hi = mid; }
      if (sol && sol.hp > hpMin && Math.abs(sol.hr - hrTarget) < hrTol && sol.tRet < tEndDays - .05) refined.push(sol);   // yayılım sonunda kesilen (gerçek perigee olmayan) adaylar elenir
    }
  }
  refined.sort((x, y) => Math.abs(x.hr - hrTarget) - Math.abs(y.hr - hrTarget));
  /* en iyi: iyileştirilmiş adaylar arasında perilune 100–3000 km bandında hedefe en yakın; yoksa en yakın */
  const safe = refined.filter(r => r.hp >= hpMin && r.hp <= 3000); best = (safe[0] ?? refined[0]) ? { ...(safe[0] ?? refined[0]), score: 0 } : best;
  return { cells, best, refined, nDv, nTh, dvRange, thRange, hpMin, hrTarget, hrTol };
}
