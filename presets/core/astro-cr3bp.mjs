/* astro-cr3bp.mjs — Dairesel Kısıtlı Üç-Cisim Problemi (CR3BP), SAF modül.
   cr3bp_lagrange preseti bunun üstüne çizilir; scripts/validate-astro.mjs sınar
   (Lagrange noktası gradyan artığı, Jacobi korunumu, Lyapunov periyodikliği).

   BOYUTSUZ DÖNEN ÇERÇEVE: kütle parametresi μ = m₂/(m₁+m₂); birincil m₁ (−μ, 0, 0),
   ikincil m₂ (1−μ, 0, 0); uzunluk birimi = birincil–ikincil mesafesi, zaman birimi
   1/n (bir devir = 2π). Denklemler:
     ẍ − 2ẏ = Ω_x,  ÿ + 2ẋ = Ω_y,  z̈ = Ω_z,   Ω = ½(x²+y²) + (1−μ)/r₁ + μ/r₂
   Jacobi sabiti C = 2Ω − v² (korunur). Sıfır-hız eğrileri 2Ω(x,y,0) = C; 2Ω < C bölgesi YASAK.
   Lagrange noktaları ∇Ω = 0'dan ÇÖZÜLÜR: L1–L3 eş-doğrusal kök (Newton, |x| yönlü başlangıç),
   L4/L5 = (½−μ, ±√3/2). Göz kararı yerleştirme yoktur; artık ‖∇Ω‖ denetlenir.
   Periyodik yörüngeler: düzlemsel Lyapunov (L1/L2/L3) — doğrusal frekansla başlangıç, tek-atışlı
   diferansiyel düzeltme (STM 4×4, ẏ₀ düzeltilir, y = 0 geçişinde ẋ = 0). HALO yörüngeleri: Richardson (1980) 3. mertebe
   analitik tahmin (c_n, λ, k, a_ij, b_ij, d_ij, s_i, l_i, Δ) + z₀ sabit tutularak (x₀, ẏ₀) 6×6 STM ile
   düzeltilir (y = 0 geçişinde ẋ = ż = 0); aile Az sürekliliğiyle. Monodromi matrisi Φ(T) güç
   yinelemesiyle (Φ ve Φ⁻¹) kararsız/kararlı özvektörler; DEĞİŞMEZ MANİFOLDLAR yörünge boyunca
   Φ(t,0)·v ile taşınan özvektör yönünde ±ε sapma ve ileri (kararsız) / geri (kararlı; zaman-tersleme
   simetrisi x,−y,z,−ẋ,ẏ,−ż) yayılım. Halo periyodikliği ve manifold uzaklaşma oranı denetlenir.
   Entegrasyon: RK4 sabit adım (varsayılan 1e−3 … 2e−3), STM varyasyonel denklemleriyle. */

export const SYSTEMS = Object.freeze({
  earthMoon: { label: 'Dünya–Ay', mu: 0.012150585609624, L: 384400, T: 27.321661 * 86400, primary: 'Dünya', secondary: 'Ay', rPrimary: 6378.137, rSecondary: 1737.4 },
  sunEarth: { label: 'Güneş–Dünya', mu: 3.00348e-6, L: 149597870.7, T: 365.256363 * 86400, primary: 'Güneş', secondary: 'Dünya', rPrimary: 695700, rSecondary: 6378.137 },
  sunJupiter: { label: 'Güneş–Jüpiter', mu: 9.5388e-4, L: 778.5e6, T: 4332.59 * 86400, primary: 'Güneş', secondary: 'Jüpiter', rPrimary: 695700, rSecondary: 69911 },
});

/** Etkin potansiyel Ω ve gradyanı. */
export function omega(mu, x, y, z = 0) {
  const r1 = Math.hypot(x + mu, y, z), r2 = Math.hypot(x - 1 + mu, y, z);
  return .5 * (x * x + y * y) + (1 - mu) / r1 + mu / r2;
}
export function gradOmega(mu, x, y, z = 0) {
  const dx1 = x + mu, dx2 = x - 1 + mu;
  const r1 = Math.hypot(dx1, y, z), r2 = Math.hypot(dx2, y, z);
  const r13 = r1 * r1 * r1, r23 = r2 * r2 * r2;
  return [x - (1 - mu) * dx1 / r13 - mu * dx2 / r23, y - (1 - mu) * y / r13 - mu * y / r23, -(1 - mu) * z / r13 - mu * z / r23];
}
export const jacobi = (mu, s) => 2 * omega(mu, s[0], s[1], s[2]) - (s[3] * s[3] + s[4] * s[4] + s[5] * s[5]);

/** Türev: durum [x,y,z,ẋ,ẏ,ż]. */
export function deriv(mu, s) {
  const g = gradOmega(mu, s[0], s[1], s[2]);
  return [s[3], s[4], s[5], g[0] + 2 * s[4], g[1] - 2 * s[3], g[2]];
}

/** Eş-doğrusal Lagrange noktaları: f(x) = Ω_x(x, 0) = 0, Newton. */
export function lagrangePoints(mu) {
  const f = x => gradOmega(mu, x, 0)[0];
  const df = x => { const h = 1e-7; return (f(x + h) - f(x - h)) / (2 * h); };
  const newton = x0 => { let x = x0; for (let k = 0; k < 60; k++) { const d = f(x) / df(x); x -= d; if (Math.abs(d) < 1e-14) break; } return x; };
  const a = Math.cbrt(mu / 3);
  const L1 = newton(1 - mu - a), L2 = newton(1 - mu + a), L3 = newton(-1 - 5 * mu / 12);
  const pts = { L1: [L1, 0, 0], L2: [L2, 0, 0], L3: [L3, 0, 0], L4: [.5 - mu, Math.sqrt(3) / 2, 0], L5: [.5 - mu, -Math.sqrt(3) / 2, 0] };
  const out = {};
  for (const [k, p] of Object.entries(pts)) { const g = gradOmega(mu, p[0], p[1], p[2]); out[k] = { x: p[0], y: p[1], z: 0, residual: Math.hypot(g[0], g[1], g[2]), C: 2 * omega(mu, p[0], p[1]) }; }
  return out;
}

/** RK4 yayılımı (isteğe bağlı 6×6 STM). Döner { states:[…], times:[…], stm? } */
export function propagate(mu, s0, tEnd, dt = 1e-3, { stm = false, stopAtY0 = false, minSteps = 10 } = {}) {
  const N = stm ? 42 : 6;
  let s = new Float64Array(N); s.set(s0.slice(0, 6)); if (stm) for (let i = 0; i < 6; i++) s[6 + i * 7] = 1;
  const f = (st) => {
    const d = new Float64Array(N);
    const g = gradOmega(mu, st[0], st[1], st[2]);
    d[0] = st[3]; d[1] = st[4]; d[2] = st[5]; d[3] = g[0] + 2 * st[4]; d[4] = g[1] - 2 * st[3]; d[5] = g[2];
    if (stm) {
      /* A = [0 I; Ωxx+…  2J] — Hessian */
      const H = hessOmega(mu, st[0], st[1], st[2]);
      const A = [[0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 1], [H[0][0], H[0][1], H[0][2], 0, 2, 0], [H[1][0], H[1][1], H[1][2], -2, 0, 0], [H[2][0], H[2][1], H[2][2], 0, 0, 0]];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let acc = 0; for (let k = 0; k < 6; k++) acc += A[i][k] * st[6 + k * 6 + j]; d[6 + i * 6 + j] = acc; }
    }
    return d;
  };
  const states = [Array.from(s.slice(0, 6))], times = [0];
  let t = 0, steps = 0;
  while (t < tEnd - 1e-12) {
    const h = Math.min(dt, tEnd - t);
    const k1 = f(s), s2 = s.map((v, i) => v + .5 * h * k1[i]), k2 = f(s2), s3 = s.map((v, i) => v + .5 * h * k2[i]), k3 = f(s3), s4 = s.map((v, i) => v + h * k3[i]), k4 = f(s4);
    const prevY = s[1];
    s = s.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t += h; steps++;
    states.push(Array.from(s.slice(0, 6))); times.push(t);
    if (stopAtY0 && steps > minSteps && prevY * s[1] < 0) {
      /* y = 0 geçişine doğrusal interpolasyon */
      const f0 = prevY / (prevY - s[1]);
      const a = states[states.length - 2], b = states[states.length - 1];
      states[states.length - 1] = a.map((v, i) => v + (b[i] - v) * f0); times[times.length - 1] = times[times.length - 2] + h * f0;
      break;
    }
  }
  return { states, times, stm: stm ? Array.from(s.slice(6)) : null };
}

export function hessOmega(mu, x, y, z) {
  const dx1 = x + mu, dx2 = x - 1 + mu;
  const r1 = Math.hypot(dx1, y, z), r2 = Math.hypot(dx2, y, z);
  const r13 = r1 ** 3, r15 = r1 ** 5, r23 = r2 ** 3, r25 = r2 ** 5;
  const a = 1 - mu, b = mu;
  const Uxx = 1 - a / r13 - b / r23 + 3 * a * dx1 * dx1 / r15 + 3 * b * dx2 * dx2 / r25;
  const Uyy = 1 - a / r13 - b / r23 + 3 * a * y * y / r15 + 3 * b * y * y / r25;
  const Uzz = -a / r13 - b / r23 + 3 * a * z * z / r15 + 3 * b * z * z / r25;
  const Uxy = 3 * a * dx1 * y / r15 + 3 * b * dx2 * y / r25;
  const Uxz = 3 * a * dx1 * z / r15 + 3 * b * dx2 * z / r25;
  const Uyz = 3 * a * y * z / r15 + 3 * b * y * z / r25;
  return [[Uxx, Uxy, Uxz], [Uxy, Uyy, Uyz], [Uxz, Uyz, Uzz]];
}

/**
 * Düzlemsel Lyapunov yörüngesi (L1/L2/L3 çevresinde), genlik Ax (x yönünde, boyutsuz).
 * Doğrusallaştırılmış başlangıç: x₀ = x_L + Ax, ẏ₀ = −Ax·λ·k… (klasik: ẏ₀ = Ax·ω·(…)); ardından
 * ẏ₀ tek-atışlı düzeltilir: y = 0 geçişinde ẋ = 0 olana kadar (Φ elemanlarıyla Newton).
 * Döner { x0, ydot0, period, states (tam tur), C, iterations, converged }.
 */
export function lyapunovOrbit(mu, Lname, Ax, { dt = 1e-3, maxIter = 25, ydot0Guess = null, periodRef = null } = {}) {
  const Lp = lagrangePoints(mu)[Lname];
  const H = hessOmega(mu, Lp.x, 0, 0);
  const Uxx = H[0][0], Uyy = H[1][1];
  /* doğrusal düzlem-içi frekans: λ⁴ + (4 − Uxx − Uyy)λ² + Uxx Uyy = 0 → salınımlı kök ω */
  const b1 = 4 - Uxx - Uyy, c1 = Uxx * Uyy;
  const l2 = (-b1 - Math.sqrt(b1 * b1 - 4 * c1)) / 2;      // negatif kök → ω² = −l2
  const w = Math.sqrt(-l2);
  const kappa = (w * w + Uxx) / (2 * w);                    // ẏ = −kappa·ω·x ilişkisi (doğrusal)
  let x0 = Lp.x + Ax, ydot0 = ydot0Guess ?? -Ax * w * kappa;   // doğrusal: y = −kappa·Ax·sin(ωt) → ẏ(0) = −kappa Ax ω
  let converged = false, iterations = 0, half = null;
  const Tw = (periodRef ?? 2 * Math.PI / w) * 1.2, minSteps = Math.max(10, Math.floor(.3 * (periodRef ?? 2 * Math.PI / w) / dt));
  const shoot = yd => propagate(mu, [x0, 0, 0, 0, yd, 0], Tw, dt, { stm: true, stopAtY0: true, minSteps });   // erken (sahte) y = 0 kesişimleri yok sayılır
  const crossed = h => h.times[h.times.length - 1] < Tw - 1.5 * dt;
  let lastStep = 0;
  for (; iterations < maxIter; iterations++) {
    half = shoot(ydot0);
    /* pencerede y = 0 kesişimi yoksa: son adımı geri sararak yarıla (geri izleme) ya da tahminı tara */
    if (!crossed(half)) { let ok = false; for (let b = 0; b < 6 && !ok; b++) { if (lastStep) { ydot0 += lastStep / 2; lastStep /= 2; } else ydot0 *= (b % 2 ? 1 - .06 * (b + 1) / 2 : 1 + .06 * (b + 2) / 2); half = shoot(ydot0); ok = crossed(half); } if (!ok) break; }
    const sf = half.states[half.states.length - 1];
    if (Math.abs(sf[3]) < 1e-9) { converged = true; break; }
    /* düzeltme: Δẋ_f ≈ Φ34 Δẏ₀ − (ẍ_f/ẏ_f)·Φ24 Δẏ₀  (y=0 kısıtı ile) */
    const Phi = half.stm; const P = (i, j) => Phi[i * 6 + j];
    const d = deriv(mu, sf); const xdd = d[3], yd = sf[4];
    const dxdot_dydot0 = P(3, 4) - (xdd / yd) * P(1, 4);
    let step = sf[3] / dxdot_dydot0; if (!Number.isFinite(step)) break;
    step = Math.sign(step) * Math.min(Math.abs(step), .05 + .5 * Math.abs(ydot0));   // sönümlü Newton
    ydot0 -= step; lastStep = -step;
  }
  /* geçerlilik: yarım tur L noktasının öte yanında bitmeli (erken y = 0 kesişimi = yanlış yörünge) */
  const sfv = half.states[half.states.length - 1];
  { const th = half.times[half.times.length - 1], Tr = periodRef ?? 2 * Math.PI / w;
    if (converged && !((sfv[0] - x0) * (Lp.x - x0) > 0 && Math.abs(sfv[0] - x0) > Ax && th > .35 * Tr && th < .75 * Tr)) converged = false; }
  const period = 2 * half.times[half.times.length - 1];
  const full = propagate(mu, [x0, 0, 0, 0, ydot0, 0], period, dt);
  return { x0, ydot0, period, states: full.states, times: full.times, C: jacobi(mu, [x0, 0, 0, 0, ydot0, 0]), iterations, converged, L: Lname };
}

/**
 * Lyapunov AİLESİ — doğal parametre sürekliliği: küçük genlikten başlanır, her adımda önceki
 * iki çözümden ẏ₀ doğrusal dış-değerlenir (büyük genlikte doğrusal tahmin yanlış aileye kayar;
 * süreklilik bunu önler). Döner [{ Ax, ...orbit }] (yakınsamayanlar atlanır).
 */
export function lyapunovFamily(mu, Lname, AxList, opts = {}) {
  const out = []; let prev = null, prev2 = null;
  for (const Ax of AxList) {
    let guess = null;
    let periodRef = null;
    if (prev && prev2) { const f = (Ax - prev.Ax) / (prev.Ax - prev2.Ax); guess = prev.ydot0 + (prev.ydot0 - prev2.ydot0) * f; periodRef = prev.period + (prev.period - prev2.period) * f; }
    else if (prev) { guess = prev.ydot0 * Ax / prev.Ax; periodRef = prev.period; }
    const o = lyapunovOrbit(mu, Lname, Ax, { ...opts, ydot0Guess: guess, periodRef });
    if (!o.converged) { if (opts.stopOnFail ?? true) break; continue; }
    o.Ax = Ax; out.push(o); prev2 = prev; prev = o;
  }
  return out;
}

/** Sıfır-hız eğrileri: 2Ω = C konturu, ızgara + marching squares → parçalar [[x0,y0,x1,y1]…] */
export function zeroVelocityCurves(mu, C, { xMin = -1.6, xMax = 1.6, yMin = -1.6, yMax = 1.6, n = 220 } = {}) {
  const field = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = xMin + (xMax - xMin) * i / (n - 1), y = yMin + (yMax - yMin) * j / (n - 1); field[i * n + j] = 2 * omega(mu, x, y); }
  const segs = [];
  const at = (i, j) => field[i * n + j];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    const v = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
    const idx = (v[0] >= C) | ((v[1] >= C) << 1) | ((v[2] >= C) << 2) | ((v[3] >= C) << 3);
    if (idx === 0 || idx === 15) continue;
    const pts = []; const it = (a, b) => (C - a) / (b - a);
    if ((idx & 1) !== ((idx >> 1) & 1)) pts.push([i + it(v[0], v[1]), j]);
    if (((idx >> 1) & 1) !== ((idx >> 2) & 1)) pts.push([i + 1, j + it(v[1], v[2])]);
    if (((idx >> 2) & 1) !== ((idx >> 3) & 1)) pts.push([i + it(v[3], v[2]), j + 1]);
    if (((idx >> 3) & 1) !== (idx & 1)) pts.push([i, j + it(v[0], v[3])]);
    const X = p => xMin + (xMax - xMin) * p[0] / (n - 1), Y = p => yMin + (yMax - yMin) * p[1] / (n - 1);
    if (pts.length === 2) segs.push([X(pts[0]), Y(pts[0]), X(pts[1]), Y(pts[1])]);
    else if (pts.length === 4) { segs.push([X(pts[0]), Y(pts[0]), X(pts[1]), Y(pts[1])]); segs.push([X(pts[2]), Y(pts[2]), X(pts[3]), Y(pts[3])]); }
  }
  return { segs, field, n, xMin, xMax, yMin, yMax };
}

/** Dönen → eylemsiz (baricentrik) dönüşüm: açı θ = t. */
export function rotatingToInertial(s, t) {
  const c = Math.cos(t), sn = Math.sin(t);
  return [c * s[0] - sn * s[1], sn * s[0] + c * s[1], s[2]];
}

/* ───────────────────────── HALO (Richardson 1980 + diferansiyel düzeltme) */

/** Richardson 3. mertebe halo tahmini. Az boyutsuz (birincil–ikincil mesafesi birimi), northern: n = 1 kuzey / 3 güney.
 *  Döner { x0, z0, ydot0, Ax, period, gamma, lambda, k, Delta, l1, l2, s1, s2, AxMin } — sadece TAHMİN. */
export function richardsonHalo(mu, Lname, Az, { northern = true } = {}) {
  const Lp = lagrangePoints(mu)[Lname];
  const gamma = Lname === 'L3' ? Math.abs(Lp.x + mu) : Math.abs(Lp.x - (1 - mu));
  const c = n => {
    if (Lname === 'L1') return (mu + (-1) ** n * (1 - mu) * gamma ** (n + 1) / (1 - gamma) ** (n + 1)) / gamma ** 3;
    if (Lname === 'L2') return ((-1) ** n * mu + (-1) ** n * (1 - mu) * gamma ** (n + 1) / (1 + gamma) ** (n + 1)) / gamma ** 3;
    return (1 - mu + mu * gamma ** (n + 1) / (1 + gamma) ** (n + 1)) / gamma ** 3;
  };
  const c2 = c(2), c3 = c(3), c4 = c(4);
  const lam = Math.sqrt(((2 - c2) + Math.sqrt((c2 - 2) ** 2 + 4 * (c2 - 1) * (1 + 2 * c2))) / 2);
  const k = 2 * lam / (lam * lam + 1 - c2);
  const d1 = 3 * lam * lam / k * (k * (6 * lam * lam - 1) - 2 * lam), d2 = 8 * lam * lam / k * (k * (11 * lam * lam - 1) - 2 * lam);
  const a21 = 3 * c3 * (k * k - 2) / (4 * (1 + 2 * c2)), a22 = 3 * c3 / (4 * (1 + 2 * c2));
  const a23 = -3 * c3 * lam / (4 * k * d1) * (3 * k ** 3 * lam - 6 * k * (k - lam) + 4), a24 = -3 * c3 * lam / (4 * k * d1) * (2 + 3 * k * lam);
  const b21 = -3 * c3 * lam / (2 * d1) * (3 * k * lam - 4), b22 = 3 * c3 * lam / d1, d21 = -c3 / (2 * lam * lam);
  const a31 = -9 * lam / (4 * d2) * (4 * c3 * (k * a23 - b21) + k * c4 * (4 + k * k)) + (9 * lam * lam + 1 - c2) / (2 * d2) * (3 * c3 * (2 * a23 - k * b21) + c4 * (2 + 3 * k * k));
  const a32 = -1 / d2 * (9 * lam / 4 * (4 * c3 * (k * a24 - b22) + k * c4) + 1.5 * (9 * lam * lam + 1 - c2) * (c3 * (k * b22 + d21 - 2 * a24) - c4));
  const b31 = 3 / (8 * d2) * (8 * lam * (3 * c3 * (k * b21 - 2 * a23) - c4 * (2 + 3 * k * k)) + (9 * lam * lam + 1 + 2 * c2) * (4 * c3 * (k * a23 - b21) + k * c4 * (4 + k * k)));
  const b32 = 1 / d2 * (9 * lam * (c3 * (k * b22 + d21 - 2 * a24) - c4) + 3 / 8 * (9 * lam * lam + 1 + 2 * c2) * (4 * c3 * (k * a24 - b22) + k * c4));
  const d31 = 3 / (64 * lam * lam) * (4 * c3 * a24 + c4), d32 = 3 / (64 * lam * lam) * (4 * c3 * (a23 - d21) + c4 * (4 + k * k));
  const den = 2 * lam * (lam * (1 + k * k) - 2 * k);
  const s1 = (1.5 * c3 * (2 * a21 * (k * k - 2) - a23 * (k * k + 2) - 2 * k * b21) - 3 / 8 * c4 * (3 * k ** 4 - 8 * k * k + 8)) / den;
  const s2 = (1.5 * c3 * (2 * a22 * (k * k - 2) + a24 * (k * k + 2) + 2 * k * b22 + 5 * d21) + 3 / 8 * c4 * (12 - k * k)) / den;
  const a1 = -1.5 * c3 * (2 * a21 + a23 + 5 * d21) - 3 / 8 * c4 * (12 - k * k), a2 = 1.5 * c3 * (a24 - 2 * a22) + 9 / 8 * c4;
  const l1 = a1 + 2 * lam * lam * s1, l2 = a2 + 2 * lam * lam * s2, Delta = lam * lam - c2;
  const Azn = Az / gamma;                       // Richardson birimi (γ)
  const Ax2 = -(l2 * Azn * Azn + Delta) / l1;
  if (!(Ax2 > 0)) return null;                  // bu Az'de halo yok (Lyapunov çatallanma altı)
  const Ax = Math.sqrt(Ax2), dn = northern ? 1 : -1;
  const om = 1 + s1 * Ax * Ax + s2 * Azn * Azn, period = 2 * Math.PI / (lam * om);
  const x = a21 * Ax * Ax + a22 * Azn * Azn - Ax + (a23 * Ax * Ax - a24 * Azn * Azn) + (a31 * Ax ** 3 - a32 * Ax * Azn * Azn);
  const z = dn * (Azn - 2 * d21 * Ax * Azn + d32 * Azn * Ax * Ax - d31 * Azn ** 3);
  const yd = lam * om * (k * Ax + 2 * (b21 * Ax * Ax - b22 * Azn * Azn) + 3 * (b31 * Ax ** 3 - b32 * Ax * Azn * Azn));
  return { x0: Lp.x + gamma * x, z0: gamma * z, ydot0: gamma * yd, Ax: gamma * Ax, period, gamma, lambda: lam, k, Delta, l1, l2, s1, s2, AxMin: gamma * Math.sqrt(-Delta / l1) };
}

/** Halo yörüngesi: z₀ (≈Az) sabit; x₀ ve ẏ₀, y = 0 geçişinde ẋ = ż = 0 olacak şekilde düzeltilir (6×6 STM).
 *  Döner { x0, z0, ydot0, period, states, times, C, iterations, converged, residual, Az (gerçek |z|max), Ax, L, northern }. */
export function haloOrbit(mu, Lname, Az, { northern = true, dt = 2e-3, maxIter = 30, guess = null } = {}) {
  const g = guess ?? richardsonHalo(mu, Lname, Az, { northern });
  if (!g) return null;
  let x0 = g.x0, z0 = g.z0, ydot0 = g.ydot0, converged = false, iterations = 0, half = null, residual = Infinity;
  const Tw = (g.period ?? 4) * 1.2, minSteps = Math.max(50, Math.floor(.3 * (g.period ?? 4) / dt));
  const shoot = (xx, yd) => propagate(mu, [xx, 0, z0, 0, yd, 0], Tw, dt, { stm: true, stopAtY0: true, minSteps });
  const crossed = h => h.times[h.times.length - 1] < Tw - 1.5 * dt;
  let lastDx = 0, lastDyd = 0;
  for (; iterations < maxIter; iterations++) {
    half = shoot(x0, ydot0);
    if (!crossed(half)) { let ok = false; for (let b = 0; b < 6 && !ok; b++) { if (lastDx || lastDyd) { x0 += lastDx / 2; ydot0 += lastDyd / 2; lastDx /= 2; lastDyd /= 2; } else ydot0 *= (b % 2 ? 1 - .06 * (b + 1) / 2 : 1 + .06 * (b + 2) / 2); half = shoot(x0, ydot0); ok = crossed(half); } if (!ok) break; }
    const sf = half.states[half.states.length - 1];
    residual = Math.hypot(sf[3], sf[5]);
    if (residual < 1e-9) { converged = true; break; }
    const Phi = half.stm, P = (i, j) => Phi[i * 6 + j], d = deriv(mu, sf), yd = sf[4];
    const m11 = P(3, 0) - d[3] / yd * P(1, 0), m12 = P(3, 4) - d[3] / yd * P(1, 4), m21 = P(5, 0) - d[5] / yd * P(1, 0), m22 = P(5, 4) - d[5] / yd * P(1, 4);
    const det = m11 * m22 - m12 * m21; if (!Number.isFinite(det) || Math.abs(det) < 1e-18) break;
    let dx = (m22 * sf[3] - m12 * sf[5]) / det, dyd = (-m21 * sf[3] + m11 * sf[5]) / det;
    const cap = Math.max(.01, .5 * Math.abs(g.Ax ?? .05));                       // sönümlü Newton: adım ≤ ~Ax/2
    const sc = Math.min(1, cap / Math.max(Math.abs(dx), Math.abs(dyd), 1e-300)); dx *= sc; dyd *= sc;
    x0 -= dx; ydot0 -= dyd; lastDx = dx; lastDyd = dyd;
    if (!Number.isFinite(x0) || !Number.isFinite(ydot0)) break;
  }
  if (!half) return null;
  /* geçerlilik: yarım tur x'in öte ucunda bitmeli ve yarım periyot tahminin 0,5–2 katı içinde kalmalı */
  { const sfv = half.states[half.states.length - 1], Tg = g.period ?? (2 * half.times[half.times.length - 1]);
    const th = half.times[half.times.length - 1];
    if (converged && !(Math.abs(sfv[0] - x0) > .5 * Math.abs(g.Ax ?? 0) && th > .25 * Tg && th < Tg)) converged = false; }
  const period = 2 * half.times[half.times.length - 1];
  const full = propagate(mu, [x0, 0, z0, 0, ydot0, 0], period, dt);
  let zmax = 0, xmin = Infinity, xmax = -Infinity; for (const s of full.states) { zmax = Math.max(zmax, Math.abs(s[2])); xmin = Math.min(xmin, s[0]); xmax = Math.max(xmax, s[0]); }
  return { x0, z0, ydot0, period, states: full.states, times: full.times, C: jacobi(mu, [x0, 0, z0, 0, ydot0, 0]), iterations, converged, residual, Az: zmax, Ax: (xmax - xmin) / 2, L: Lname, northern, guess: g };
}

/** Halo ailesi — Az sürekliliği; (x₀, ẏ₀) önceki iki üyeden dış-değerlenir (büyük Az'de Richardson tahmini bozulur). */
export function haloFamily(mu, Lname, AzList, opts = {}) {
  const out = []; let prev = null, prev2 = null;
  const solveFrom = Az => {
    let guess = null;
    if (prev && prev2) { const f = (Az - Math.abs(prev.z0)) / (Math.abs(prev.z0) - Math.abs(prev2.z0)); guess = { x0: prev.x0 + (prev.x0 - prev2.x0) * f, z0: Az * Math.sign(prev.z0), ydot0: prev.ydot0 + (prev.ydot0 - prev2.ydot0) * f, period: prev.period + (prev.period - prev2.period) * f, Ax: prev.Ax }; }
    else if (prev) guess = { x0: prev.x0, z0: Az * Math.sign(prev.z0), ydot0: prev.ydot0, period: prev.period, Ax: prev.Ax };
    let o = haloOrbit(mu, Lname, Az, { ...opts, guess });
    if ((!o || !o.converged) && !prev) o = haloOrbit(mu, Lname, Az, opts);   // ilk üye: Richardson
    return o && o.converged ? o : null;
  };
  for (const Az of AzList) {
    let o = solveFrom(Az);
    /* adım başarısızsa ara adımlar (en çok 3 kez yarılama) — büyük Az'de aile eğrisi keskin döner */
    if (!o && prev) { let lo = Math.abs(prev.z0), hi = Az, ok = true; for (let depth = 0; depth < 3 && ok; depth++) { const mid = (lo + hi) / 2; const om = solveFrom(mid); if (om) { out.push(om); prev2 = prev; prev = om; lo = mid; o = solveFrom(Az); if (o) break; } else ok = false; } }
    if (!o) { if (opts.stopOnFail ?? true) break; continue; }
    out.push(o); prev2 = prev; prev = o;
  }
  return out;
}

/* ───────────────────────── MONODROMİ ve DEĞİŞMEZ MANİFOLDLAR */

function matInv6(M) {
  const n = 6, A = M.map(r => r.slice()), I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [I[c], I[p]] = [I[p], I[c]];
    const d = A[c][c]; if (Math.abs(d) < 1e-300) return null;
    for (let j = 0; j < n; j++) { A[c][j] /= d; I[c][j] /= d; }
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f) for (let j = 0; j < n; j++) { A[r][j] -= f * A[c][j]; I[r][j] -= f * I[c][j]; } }
  }
  return I;
}
const mv6 = (M, v) => M.map(r => r.reduce((a, x, j) => a + x * v[j], 0));
const nrm6 = v => Math.hypot(...v);
function powerIter(M, iters = 200) {
  let v = [1, .3, .2, .1, -.2, .15], lam = 0;
  for (let k = 0; k < iters; k++) { const w = mv6(M, v); const n = nrm6(w); lam = w.reduce((a, x, i) => a + x * v[i], 0) / v.reduce((a, x) => a + x * x, 0); v = w.map(x => x / n); }
  return { vec: v, lambda: lam };
}
function det6(M) { const A = M.map(x => x.slice()); let det = 1; for (let c = 0; c < 6; c++) { let p = c; for (let q = c + 1; q < 6; q++) if (Math.abs(A[q][c]) > Math.abs(A[p][c])) p = q; if (p !== c) { [A[c], A[p]] = [A[p], A[c]]; det = -det; } det *= A[c][c]; for (let q = c + 1; q < 6; q++) { const f = A[q][c] / A[c][c]; for (let j = c; j < 6; j++) A[q][j] -= f * A[c][j]; } } return det; }

/** Monodromi matrisi Φ(T) ve baskın kararsız/kararlı özçiftler (güç yinelemesi; kararlı yön Φ⁻¹ ile).
 *  Döner { Phi, lambdaU, lambdaS, vU, vS, nu = (λu + 1/λu)/2 (kararlılık indeksi), trace, det (=1 simplektik), closure } */
export function monodromy(mu, orbit, { dt = 2e-3 } = {}) {
  const s0 = [orbit.x0, 0, orbit.z0 ?? 0, 0, orbit.ydot0, 0];
  const r = propagate(mu, s0, orbit.period, dt, { stm: true });
  const Phi = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => r.stm[i * 6 + j]));
  const inv = matInv6(Phi);
  const u = powerIter(Phi), s = inv ? powerIter(inv) : { vec: null, lambda: NaN };
  const trace = Phi.reduce((a, row, i) => a + row[i], 0);
  const lambdaU = u.lambda, lambdaS = 1 / s.lambda;
  return { Phi, lambdaU, lambdaS, vU: u.vec, vS: s.vec, nu: (lambdaU + 1 / lambdaU) / 2, trace, det: det6(Phi), closure: Math.hypot(...r.states[r.states.length - 1].map((v, i) => v - s0[i])) };
}

/** Zaman-tersleme simetrisi: (x, y, z, ẋ, ẏ, ż) → (x, −y, z, −ẋ, ẏ, −ż). */
const mirror = s => [s[0], -s[1], s[2], -s[3], s[4], -s[5]];

/** Değişmez manifold demeti. branch 'unstable' (ileri) | 'stable' (geri); sign ±1 (iki kol).
 *  n nokta yörünge boyunca; her noktada v_k = Φ(t_k,0)·v, konum kısmı birim norm; sapma ε (boyutsuz).
 *  Döner [{ t0, states, times, branch, sign }] (kararlı kol zaman sırasına göre: uzaktan yörüngeye gelir). */
export function manifold(mu, orbit, mono, { branch = 'unstable', sign = 1, n = 24, eps = 1e-4, tEnd = 6, dt = 2e-3, stopRadius = 2.2 } = {}) {
  const v0 = branch === 'unstable' ? mono.vU : mono.vS; if (!v0) return [];
  const s0 = [orbit.x0, 0, orbit.z0 ?? 0, 0, orbit.ydot0, 0];
  const out = [];
  /* Φ(t_k, 0) örnekleri: tek yayılım, her örnekte STM'yi okumak için parça parça ilerlenir */
  const samples = []; let cur = s0, curPhi = null;
  for (let k = 0; k < n; k++) {
    const tk = orbit.period * k / n, tPrev = k ? orbit.period * (k - 1) / n : 0;
    if (k === 0) samples.push({ sk: s0, vk: v0 });
    else {
      const r = propagate(mu, cur, tk - tPrev, dt, { stm: true }); cur = r.states[r.states.length - 1];
      const Pk = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => r.stm[i * 6 + j]));
      curPhi = curPhi ? Pk.map(row => Array.from({ length: 6 }, (_, j) => row.reduce((a, x, m) => a + x * curPhi[m][j], 0))) : Pk;   // Φ(t_k,0) = Φ(t_k,t_{k-1})·Φ(t_{k-1},0)
      samples.push({ sk: cur, vk: mv6(curPhi, v0) });
    }
  }
  for (let k = 0; k < n; k++) {
    const tk = orbit.period * k / n, { sk, vk } = samples[k];
    const pn = Math.hypot(vk[0], vk[1], vk[2]) || 1; const dv = vk.map(x => x / pn * eps * sign);
    let st = sk.map((x, i) => x + dv[i]);
    if (branch === 'stable') st = mirror(st);
    const r = propagate(mu, st, tEnd, dt);
    let states = r.states, times = r.times;
    let cut = states.length;
    for (let i = 0; i < states.length; i++) { const s = states[i]; if (Math.hypot(s[0], s[1], s[2]) > stopRadius || Math.hypot(s[0] + mu, s[1], s[2]) < 0.005 || Math.hypot(s[0] - 1 + mu, s[1], s[2]) < 0.002) { cut = i + 1; break; } }
    states = states.slice(0, cut); times = times.slice(0, cut);
    if (branch === 'stable') { states = states.map(mirror).reverse(); times = times.map(t => -t).reverse(); }
    out.push({ t0: tk, states, times, branch, sign });
  }
  return out;
}
