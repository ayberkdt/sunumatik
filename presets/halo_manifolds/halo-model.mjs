/* halo-model.mjs — Halo yörüngeleri + değişmez manifoldlar senaryo kurucusu (saf; THREE gerekmez).
   Çözücü: ../core/astro-cr3bp.mjs (Richardson tahmini + 6×6 STM düzeltmesi, Az sürekliliği, monodromi,
   manifold demeti). Bu dosya birim çevirimi, aile listesi ve seçilen yörüngeyi en yakın aile üyesinden
   başlatma işini yapar; hiçbir sayı elle yerleştirilmez. */

import { SYSTEMS, lagrangePoints, haloOrbit, haloFamily, richardsonHalo, lyapunovFamily, monodromy, manifold, jacobi } from '../core/astro-cr3bp.mjs';

export { SYSTEMS };

/** Aile Az listesi: γ (L–ikincil uzaklığı) katları; süreklilik ilk başarısızlıkta durur. */
export function familyAzList(mu, L, { n = 14, maxRatio = 1.4 } = {}) {
  const g = richardsonHalo(mu, L, 1e-3) ?? { gamma: Math.cbrt(mu / 3) };
  return Array.from({ length: n }, (_, i) => g.gamma * (0.08 + (maxRatio - 0.08) * i / (n - 1)));
}

/**
 * buildHalo({ system, L, Az (boyutsuz), northern, family: { n, maxRatio }, manifold: { n, tEnd, eps } })
 * Döner { sys, mu, L, lagrange, family, orbit, mono, manifolds: { uPlus, uMinus, sPlus, sMinus }, lyap, toKm, toDays }.
 */
export function buildHalo({ system = 'earthMoon', L = 'L1', Az = null, northern = true, family = {}, manifold: mf = {}, lyapunov = true } = {}) {
  const sys = SYSTEMS[system], mu = sys.mu, lagrange = lagrangePoints(mu);
  const toKm = x => x * sys.L, toDays = t => t / (2 * Math.PI) * sys.T / 86400;
  const azList = familyAzList(mu, L, family);
  const fam = haloFamily(mu, L, azList, { northern, dt: 2e-3 });
  if (!fam.length) return null;
  const AzMax = fam[fam.length - 1].z0 * (northern ? 1 : -1), AzMin = Math.abs(fam[0].z0);
  let AzSel = Az == null ? Math.abs(fam[Math.floor(fam.length * .55)].z0) : Math.min(Math.max(Az, AzMin), Math.abs(AzMax));
  /* en yakın aile üyesinden başlat (Richardson uzak Az'de bozulur) */
  let near = fam[0]; for (const o of fam) if (Math.abs(Math.abs(o.z0) - AzSel) < Math.abs(Math.abs(near.z0) - AzSel)) near = o;
  let orbit = haloOrbit(mu, L, AzSel, { northern, dt: 2e-3, guess: { x0: near.x0, z0: AzSel * Math.sign(near.z0), ydot0: near.ydot0, period: near.period, Ax: near.Ax } });
  if (!orbit || !orbit.converged) orbit = near;
  const mono = monodromy(mu, orbit, { dt: 2e-3 });
  const mo = { n: mf.n ?? 16, tEnd: mf.tEnd ?? 4, eps: mf.eps ?? 50 / sys.L, dt: 2e-3 };   // ε = 50 km (doğrusal bölge; λ_u ile karşılaştırılabilir)
  const manifolds = {
    uPlus: manifold(mu, orbit, mono, { ...mo, branch: 'unstable', sign: 1 }), uMinus: manifold(mu, orbit, mono, { ...mo, branch: 'unstable', sign: -1 }),
    sPlus: manifold(mu, orbit, mono, { ...mo, branch: 'stable', sign: 1 }), sMinus: manifold(mu, orbit, mono, { ...mo, branch: 'stable', sign: -1 }),
  };
  /* karşılaştırma: aynı L noktasının düzlemsel Lyapunov ailesi (Ax ≈ halo Ax'e en yakın üye) */
  let lyap = null;
  if (lyapunov) { const gam = richardsonHalo(mu, L, 1e-3)?.gamma ?? Math.cbrt(mu / 3); const list = [.03, .06, .1, .15, .2, .3, .4, .5, .6, .7].map(f => f * gam); const lf = lyapunovFamily(mu, L, list.filter((a, i) => i < 2 || a <= orbit.Ax * 1.4), { dt: 2e-3 }); if (lf.length) lyap = lf.reduce((b, o) => Math.abs(o.Ax - orbit.Ax) < Math.abs(b.Ax - orbit.Ax) ? o : b, lf[0]); }
  /* manifold ayrılma hızı: ilk yarım periyotta sapmanın büyüme oranı (λu ile karşılaştırma için) */
  const growth = (() => { const tr = manifolds.uPlus[0]; if (!tr) return null; const s = orbit.states; let iEnd = tr.times.findIndex(t => t >= orbit.period); if (iEnd < 0) iEnd = tr.states.length - 1; const d = (i, j) => Math.hypot(tr.states[i][0] - s[j][0], tr.states[i][1] - s[j][1], tr.states[i][2] - s[j][2]); return { d0: mo.eps, dT: d(iEnd, Math.min(s.length - 1, iEnd)), ratio: d(iEnd, Math.min(s.length - 1, iEnd)) / mo.eps }; })();
  return { sys, system, mu, L, lagrange, family: fam, orbit, mono, manifolds, manifoldOpts: mo, lyap, growth, AzMin, AzMax: Math.abs(AzMax), toKm, toDays, jacobi: s => jacobi(mu, s) };
}
