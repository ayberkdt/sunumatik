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
   diferansiyel düzeltme (STM 4×4, ẏ₀ düzeltilir, y = 0 geçişinde ẋ = 0). Halo AİLESİ BU
   SÜRÜMDE YOK (Richardson 3. mertebe + 6×6 düzeltici gerekir) — sınırlama olarak ilan edilir.
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

function hessOmega(mu, x, y, z) {
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
export function lyapunovOrbit(mu, Lname, Ax, { dt = 1e-3, maxIter = 25, ydot0Guess = null } = {}) {
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
  for (; iterations < maxIter; iterations++) {
    half = propagate(mu, [x0, 0, 0, 0, ydot0, 0], 10, dt, { stm: true, stopAtY0: true });
    const sf = half.states[half.states.length - 1];
    if (Math.abs(sf[3]) < 1e-9) { converged = true; break; }
    /* düzeltme: Δẋ_f ≈ Φ34 Δẏ₀ − (ẍ_f/ẏ_f)·Φ24 Δẏ₀  (y=0 kısıtı ile) */
    const Phi = half.stm; const P = (i, j) => Phi[i * 6 + j];
    const d = deriv(mu, sf); const xdd = d[3], yd = sf[4];
    const dxdot_dydot0 = P(3, 4) - (xdd / yd) * P(1, 4);
    ydot0 -= sf[3] / dxdot_dydot0;
  }
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
    if (prev && prev2) guess = prev.ydot0 + (prev.ydot0 - prev2.ydot0) * (Ax - prev.Ax) / (prev.Ax - prev2.Ax);
    else if (prev) guess = prev.ydot0 * Ax / prev.Ax;
    const o = lyapunovOrbit(mu, Lname, Ax, { ...opts, ydot0Guess: guess });
    if (!o.converged) continue;
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
