/* astro-relative.mjs — Göreli yörünge hareketi: Hill / Clohessy–Wiltshire (CW).
   SAF modül (THREE yok); rendezvous_docking ve formation_flight bunu paylaşır,
   scripts/validate-astro.mjs bağımsız sınar (STM özdeşlikleri, RK4 karşılaştırması,
   hedefleme artığı, sürüklenmesiz koşul).

   ÇERÇEVE (LVLH, hedef/şef merkezli, dairesel referans yörünge, ortalama hareket n):
     x : radyal, dışa (zenit)        — "R-bar" ekseni −x yönüne bakar (Dünya'ya doğru)
     y : iz boyunca (hız yönü)       — "V-bar" +y
     z : çapraz-iz (açısal momentum yönü)
   Denklemler (birim: m, s):
     ẍ − 3n²x − 2nẏ = a_x
     ÿ + 2nẋ         = a_y
     z̈ + n²z         = a_z
   GEÇERLİLİK: |r| ≪ a_ref (doğrusallaştırma), referans yörünge dairesel, iki-cisim
   (J2 yok, sürükleme yok). Durum vektörü [x, y, z, ẋ, ẏ, ż]. */

export const MU_EARTH = 3.986004418e14;   // m³/s²
export const R_EARTH = 6378137;           // m

/** Dairesel yörünge ortalama hareketi (rad/s), a: yarı-büyük eksen (m). */
export const meanMotion = (a, mu = MU_EARTH) => Math.sqrt(mu / (a * a * a));

/** CW durum geçiş matrisi Φ(t) — 6×6, satır-öncelikli Array(36). Kapalı biçim. */
export function cwStm(n, t) {
  const s = Math.sin(n * t), c = Math.cos(n * t), nt = n * t;
  const M = new Array(36).fill(0);
  const set = (i, j, v) => { M[i * 6 + j] = v; };
  /* konum satırları */
  set(0, 0, 4 - 3 * c);           set(0, 3, s / n);              set(0, 4, 2 * (1 - c) / n);
  set(1, 0, 6 * (s - nt));        set(1, 1, 1);                  set(1, 3, -2 * (1 - c) / n); set(1, 4, (4 * s - 3 * nt) / n);
  set(2, 2, c);                   set(2, 5, s / n);
  /* hız satırları */
  set(3, 0, 3 * n * s);           set(3, 3, c);                  set(3, 4, 2 * s);
  set(4, 0, -6 * n * (1 - c));    set(4, 3, -2 * s);             set(4, 4, 4 * c - 3);
  set(5, 2, -n * s);              set(5, 5, c);
  return M;
}

export function matVec6(M, v) {
  const out = new Array(6).fill(0);
  for (let i = 0; i < 6; i++) { let acc = 0; for (let j = 0; j < 6; j++) acc += M[i * 6 + j] * v[j]; out[i] = acc; }
  return out;
}
export function matMul6(A, B) {
  const out = new Array(36).fill(0);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let acc = 0; for (let k = 0; k < 6; k++) acc += A[i * 6 + k] * B[k * 6 + j]; out[i * 6 + j] = acc; }
  return out;
}

/** Serbest (itkisiz) CW yayılımı: state(t) = Φ(t)·state0. */
export const cwPropagate = (state0, n, t) => matVec6(cwStm(n, t), state0);

/** CW ivmesi (a_x, a_y, a_z dış kuvvet), sayısal entegrasyon ve denetim için. */
export function cwAccel(state, n, ext = [0, 0, 0]) {
  const [x, , z, vx, vy] = state;
  return [3 * n * n * x + 2 * n * vy + ext[0], -2 * n * vx + ext[1], -n * n * z + ext[2]];
}

/** RK4 ile CW (STM doğrulaması ve sürekli itkili kılavuz segmentleri için). accelFn(t, state) → [ax,ay,az]. */
export function cwIntegrate(state0, n, tEnd, dt, accelFn = () => [0, 0, 0]) {
  const deriv = (t, s) => { const a = cwAccel(s, n, accelFn(t, s)); return [s[3], s[4], s[5], a[0], a[1], a[2]]; };
  let s = state0.slice(), t = 0;
  const out = [{ t: 0, state: s.slice() }];
  while (t < tEnd - 1e-9) {
    const h = Math.min(dt, tEnd - t);
    const k1 = deriv(t, s);
    const s2 = s.map((v, i) => v + .5 * h * k1[i]); const k2 = deriv(t + .5 * h, s2);
    const s3 = s.map((v, i) => v + .5 * h * k2[i]); const k3 = deriv(t + .5 * h, s3);
    const s4 = s.map((v, i) => v + h * k3[i]);      const k4 = deriv(t + h, s4);
    s = s.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t += h;
    out.push({ t, state: s.slice() });
  }
  return out;
}

/** 3×3 ters (satır-öncelikli Array(9)). */
function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-18) return null;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}

/**
 * CW iki-impuls hedefleme: r0'dan T sürede rf'e varmak için gereken başlangıç hızı.
 *   rf = Φ_rr r0 + Φ_rv v0⁺  →  v0⁺ = Φ_rv⁻¹ (rf − Φ_rr r0)
 * Döner { v0: gereken hız, dv1: v0 − v0Mevcut, vf: varış hızı (Φ_vr r0 + Φ_vv v0),
 *         dv2: vfHedef − vf, dvTotal } — vfHedef verilmezse varışta durma (0) hedeflenir.
 * Φ_rv, n·T = 2kπ'de (bir tam periyot; ayrıca aşkın köklerde) tekil olur → null döner.
 */
export function cwTargeting(r0, v0Now, rf, n, T, vfTarget = [0, 0, 0]) {
  const P = cwStm(n, T);
  const Prr = [P[0], P[1], P[2], P[6], P[7], P[8], P[12], P[13], P[14]];
  const Prv = [P[3], P[4], P[5], P[9], P[10], P[11], P[15], P[16], P[17]];
  const Pvr = [P[18], P[19], P[20], P[24], P[25], P[26], P[30], P[31], P[32]];
  const Pvv = [P[21], P[22], P[23], P[27], P[28], P[29], P[33], P[34], P[35]];
  const inv = inv3(Prv);
  if (!inv) return null;
  const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const rr = mv(Prr, r0);
  const v0 = mv(inv, [rf[0] - rr[0], rf[1] - rr[1], rf[2] - rr[2]]);
  const vf = mv(Pvr, r0).map((a, i) => a + mv(Pvv, v0)[i]);
  const dv1 = v0.map((a, i) => a - v0Now[i]);
  const dv2 = vfTarget.map((a, i) => a - vf[i]);
  const norm = v => Math.hypot(v[0], v[1], v[2]);
  return { v0, vf, dv1, dv2, dvTotal: norm(dv1) + norm(dv2) };
}

/**
 * Sürüklenmesiz (kapalı göreli yörünge) koşulu: ẏ0 = −2n x0  →  iz-boyu sekülar
 * sürüklenme sıfır. Verilen duruma göre sürüklenme hızı (m/s, iz boyunca, ortalama).
 */
export const alongTrackDrift = (state, n) => -(6 * n * state[0] + 3 * state[4]);   // STM y-satırının sekülar terimi

/** Yansıtılmış dairesel yörünge (PCO): şefin etrafında yarıçap ρ'lu, y–z düzleminde daire çizen deputy başlangıç durumu. */
export function pcoInitialState(rho, alpha, n) {
  /* x = (ρ/2) sin(nt+α), y = ρ cos(nt+α), z = ρ sin(nt+α) — sürüklenmesiz (ẏ0 = −2n x0) */
  const s = Math.sin(alpha), c = Math.cos(alpha);
  return [rho / 2 * s, rho * c, rho * s, rho / 2 * n * c, -rho * n * s, rho * n * c];
}

/** Genel dairesel (GCO) — deputy şef etrafında 3B dairede: z genliği √3 katı. */
export function gcoInitialState(rho, alpha, n) {
  const s = Math.sin(alpha), c = Math.cos(alpha);
  const rz = rho * Math.sqrt(3) / 2;
  return [rho / 2 * s, rho * c, rz * s, rho / 2 * n * c, -rho * n * s, rz * n * c];
}

/** Lider–takipçi (aynı yörünge, iz boyunca d geride): sürüklenmesiz, sabit ayrım. */
export const leaderFollowerState = d => [0, -d, 0, 0, 0, 0];

/** Düzlem-içi eliptik göreli yörünge (sürüklenmesiz, 2:1 elips: y genliği 2·x genliği). */
export function inPlaneEllipseState(xAmp, alpha, n) {
  const s = Math.sin(alpha), c = Math.cos(alpha);
  return [xAmp * s, 2 * xAmp * c, 0, xAmp * n * c, -2 * xAmp * n * s, 0];
}

/**
 * Glideslope kılavuzu (Hablani): hedefe doğru DÜZ çizgi boyunca, mesafe üstel azalır.
 * ρ̇ = a ρ + ρ̇_T,  a = (ρ̇_0 − ρ̇_T)/ρ_0 (< 0). Çizgi üzerindeki konum/hız/ivmeyi verir;
 * gereken itki ivmesi = kinematik ivme − CW doğal ivme (cwAccel) → sürekli itki.
 * dir: birim yaklaşma yönü (hedeften uzağa, ρ ölçülür), rho0: başlangıç mesafesi,
 * rhoDot0/rhoDotT: başlangıç/varış kapanma hızları (negatif = yaklaşma).
 */
export function glideslope(rho0, rhoDot0, rhoDotT, t) {
  const a = (rhoDot0 - rhoDotT) / rho0;
  const rho = (rho0 + rhoDotT / a) * Math.exp(a * t) - rhoDotT / a;
  const rhoDot = a * (rho0 + rhoDotT / a) * Math.exp(a * t);
  const rhoDdot = a * rhoDot;
  const tArrive = Math.log((rhoDotT / a) / (rho0 + rhoDotT / a)) / a;   // ρ = 0 anı
  return { rho: Math.max(0, rho), rhoDot, rhoDdot, a, tArrive };
}
