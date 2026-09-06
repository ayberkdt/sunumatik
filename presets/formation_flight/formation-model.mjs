/* formation-model.mjs — Formasyon uçuşu senaryoları (saf, THREE'siz).
   ../core/astro-relative.mjs (Clohessy–Wiltshire) üstüne: şef/deputy formülasyonu, LVLH,
   yapılandırılabilir göreli başlangıç durumu, çok araç. Sürüklenmesiz koşul ẏ₀ = −2n x₀
   kapalı göreli yörüngeyi verir; ihlali iz-boyu sekülar sürüklenmeyle görünür.

   SENARYOLAR (buildFormation(id, opts)):
     'leaderFollower' : GRACE/GRAIL tarzı çift — aynı yörüngede d geride (varsayılan 220 km), sabit ayrım.
     'pco'            : Yansıtılmış dairesel yörünge — N deputy, y–z izdüşümünde ρ yarıçaplı daire, 2π/N fazlı.
     'gco'            : Genel dairesel yörünge — 3B daire (z genliği √3/2·ρ).
     'inPlane'        : Düzlem-içi 2:1 elips (y genliği 2·x genliği), sürüklenmesiz.
     'drift'          : Sürüklenmesiz koşulu ihlal eden deputy (ẏ₀ = −2n x₀ + δ) — geriye/ileriye sürüklenir.
     'custom'         : kullanıcı deputy listesi [{ state:[x,y,z,ẋ,ẏ,ż], label }].
   Birim: m, s. */

import { meanMotion, cwPropagate, pcoInitialState, gcoInitialState, leaderFollowerState, inPlaneEllipseState, alongTrackDrift, R_EARTH } from '../core/astro-relative.mjs';

export const FORMATIONS = Object.freeze({
  leaderFollower: { label: 'Lider–takipçi (GRACE tarzı, 220 km)' },
  pco: { label: 'Yansıtılmış dairesel yörünge (PCO)' },
  gco: { label: 'Genel dairesel yörünge (GCO)' },
  inPlane: { label: 'Düzlem-içi 2:1 elips' },
  drift: { label: 'Sürüklenmesiz koşul ihlali' },
  custom: { label: 'Özel deputy listesi' },
});

const COLORS = ['#8fb8dd', '#d78f6c', '#d9b877', '#9ad3a1', '#c9a0dc', '#e6c58a'];

export function buildFormation(id = 'pco', opts = {}) {
  const altitude = opts.altitude ?? 500e3;
  const n = meanMotion(R_EARTH + altitude);
  const period = 2 * Math.PI / n;
  const deputies = [];
  const add = (state, label) => deputies.push({ id: deputies.length, label, state0: state.slice(), color: COLORS[deputies.length % COLORS.length], drift: alongTrackDrift(state, n) });
  if (id === 'leaderFollower') add(leaderFollowerState(opts.separation ?? 220e3), `Takipçi · ${((opts.separation ?? 220e3) / 1000).toFixed(0)} km geride`);
  else if (id === 'pco') { const N = opts.count ?? 3, rho = opts.rho ?? 1000; for (let k = 0; k < N; k++) add(pcoInitialState(rho, k * 2 * Math.PI / N, n), `PCO ${k + 1} · α = ${Math.round(k * 360 / N)}°`); }
  else if (id === 'gco') { const N = opts.count ?? 3, rho = opts.rho ?? 1000; for (let k = 0; k < N; k++) add(gcoInitialState(rho, k * 2 * Math.PI / N, n), `GCO ${k + 1} · α = ${Math.round(k * 360 / N)}°`); }
  else if (id === 'inPlane') { const N = opts.count ?? 2, x = opts.xAmp ?? 500; for (let k = 0; k < N; k++) add(inPlaneEllipseState(x, k * 2 * Math.PI / N, n), `Elips ${k + 1} · α = ${Math.round(k * 360 / N)}°`); }
  else if (id === 'drift') {
    const rho = opts.rho ?? 1000, d = opts.delta ?? .05;
    add(pcoInitialState(rho, 0, n), 'Sürüklenmesiz (ẏ₀ = −2n x₀)');
    const s = pcoInitialState(rho, 0, n); s[4] += d; add(s, `ẏ₀ + ${(d * 100).toFixed(0)} cm/s → sürüklenir`);
    const s2 = pcoInitialState(rho, 0, n); s2[4] -= d; add(s2, `ẏ₀ − ${(d * 100).toFixed(0)} cm/s → ters sürüklenir`);
  } else { for (const d of (opts.deputies || [{ state: [200, -600, 100, 0, -.45, .1], label: 'Deputy 1' }])) add(d.state, d.label || `Deputy ${deputies.length + 1}`); }
  const span = (opts.orbits ?? 2) * period;
  return { id, label: FORMATIONS[id]?.label ?? id, deputies, n, period, span, altitude };
}

/** t anındaki tüm deputy durumları (STM). */
export const statesAt = (form, t) => form.deputies.map(d => cwPropagate(d.state0, form.n, t));

/** Deputy izi: [t0, t1] arasında N nokta (durum dizisi). */
export function trace(form, deputy, t0, t1, N = 400) {
  const out = []; for (let k = 0; k <= N; k++) { const t = t0 + (t1 - t0) * k / N; out.push(cwPropagate(deputy.state0, form.n, t)); } return out;
}

/** Ayrım istatistikleri: şef–deputy ve deputy–deputy min/max mesafe (span boyunca, dt örnekleme). */
export function separationStats(form, dt = 20) {
  const D = form.deputies.length;
  const stats = { chief: form.deputies.map(() => ({ min: Infinity, max: 0 })), pairs: [] };
  for (let i = 0; i < D; i++) for (let j = i + 1; j < D; j++) stats.pairs.push({ i, j, min: Infinity, max: 0 });
  for (let t = 0; t <= form.span; t += dt) {
    const S = statesAt(form, t);
    for (let i = 0; i < D; i++) { const r = Math.hypot(S[i][0], S[i][1], S[i][2]); stats.chief[i].min = Math.min(stats.chief[i].min, r); stats.chief[i].max = Math.max(stats.chief[i].max, r); }
    for (const p of stats.pairs) { const r = Math.hypot(S[p.i][0] - S[p.j][0], S[p.i][1] - S[p.j][1], S[p.i][2] - S[p.j][2]); p.min = Math.min(p.min, r); p.max = Math.max(p.max, r); }
  }
  return stats;
}
