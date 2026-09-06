/* three-body-model.mjs — Düzlemsel üç-cisim problemi, SAF model (G = 1, birim kütleler aksi yazılmadıkça).

   Periyodik çözüm kataloğu: Šuvakov & Dmitrašinović (2013, Phys. Rev. Lett. 110, 114301) eşit-kütle aileleri
   (başlangıç: r1 = (−1, 0), r2 = (1, 0), r3 = (0, 0); v1 = v2 = (ẋ, ẏ), v3 = −2(ẋ, ẏ) — toplam momentum sıfır),
   Lagrange (1772) eşkenar üçgen ve Euler (1767) doğrusal çözümleri (analitik: ω² = 3/d³ ve ω² = 5/(4a³)),
   Broucke (1975) A2 yörüngesi, Burrau/Pisagor problemi (kütle 3-4-5, kaotik — periyodik DEĞİL, bir kaçışla biter).
   Periyotlar literatürden; DOĞRULUK denetimde: bir periyot ileri yayılınca durum vektörü başlangıca döner mi
   (validate-astro 'threebody': dönüş hatası, enerji sapması, açısal momentum korunumu).

   İntegratör: RK4, uyarlanır adım (adım ∝ en yakın çift uzaklığının 3/2 kuvveti — yakın geçişlerde küçülür). */

export const G = 1;
const SD = (name, vx, vy, T, note = '') => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, note, T, masses: [1, 1, 1], src: 'Šuvakov & Dmitrašinović 2013',
  state: () => [-1, 0, 1, 0, 0, 0, vx, vy, vx, vy, -2 * vx, -2 * vy] });
/* Lagrange: kenar d = 1, her cisim merkezden r = 1/√3 uzakta; ω = √(3G/d³) = √3; v = ω r = 1 */
const lagrange = () => { const r = 1 / Math.sqrt(3), w = Math.sqrt(3); const st = []; for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + k * 2 * Math.PI / 3; st.push(r * Math.cos(a), r * Math.sin(a)); } for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + k * 2 * Math.PI / 3; st.push(-w * r * Math.sin(a), w * r * Math.cos(a)); } return st; };
/* Euler doğrusal: kütleler (−a, 0), (0, 0), (a, 0); dış cisme kuvvet G(1/a² + 1/(2a)²) = 5G/(4a²) → ω² = 5G/(4a³) */
/* Lagrange, eşit olmayan kütleler: eşkenar üçgen (kenar d = 1) kütle merkezi etrafında ω² = G M/d³ ile döner */
const lagrangeMasses = m => { const M = m[0] + m[1] + m[2], w = Math.sqrt(G * M), p = [[0, 0], [1, 0], [.5, Math.sqrt(3) / 2]], c = [0, 0]; for (let i = 0; i < 3; i++) { c[0] += m[i] * p[i][0] / M; c[1] += m[i] * p[i][1] / M; } const st = []; for (let i = 0; i < 3; i++) st.push(p[i][0] - c[0], p[i][1] - c[1]); for (let i = 0; i < 3; i++) st.push(-w * (p[i][1] - c[1]), w * (p[i][0] - c[0])); return st; };
const euler = () => { const a = 1, w = Math.sqrt(5 / 4); return [-a, 0, 0, 0, a, 0, 0, -w * a, 0, 0, 0, w * a]; };
export const CATALOG = Object.freeze([
  SD('Figure-8', .347111, .532728, 6.324449, 'Moore 1993 · Chenciner–Montgomery 2000'),
  SD('Butterfly I', .306893, .125507, 6.235641),
  SD('Butterfly II', .392955, .097579, 7.003870),
  SD('Bumblebee', .184279, .587188, 63.534735),
  SD('Moth I', .464445, .396060, 14.893911),
  SD('Moth II', .439166, .452968, 28.670278),
  SD('Butterfly III', .405916, .230163, 13.865763),
  SD('Moth III', .383444, .377364, 25.840631),
  SD('Goggles', .083300, .127889, 10.466818),
  SD('Dragonfly', .080584, .588836, 21.270975),
  SD('Yarn', .559064, .349192, 55.501762),
  SD('Yin-Yang I a', .513938, .304736, 17.328370),
  SD('Yin-Yang I b', .282699, .327209, 10.963875),
  SD('Yin-Yang II a', .416822, .330333, 55.789829),
  SD('Yin-Yang II b', .417343, .313100, 54.207599),
  { id: 'lagrange', name: 'Lagrange', note: 'eşkenar üçgen, dairesel · 1772', T: 2 * Math.PI / Math.sqrt(3), masses: [1, 1, 1], src: 'analitik', state: lagrange },
  { id: 'lagrange-123', name: 'Lagrange 1·2·3', note: 'eşkenar üçgen, kütleler 1·2·3 (kütle merkezi etrafında)', T: 2 * Math.PI / Math.sqrt(6), masses: [1, 2, 3], src: 'analitik', state: () => lagrangeMasses([1, 2, 3]) },
  { id: 'euler', name: 'Euler', note: 'doğrusal, dairesel · 1767', T: 2 * Math.PI / Math.sqrt(5 / 4), masses: [1, 1, 1], src: 'analitik', state: euler },
  { id: 'broucke-a2', name: 'Broucke A2', note: '1975', T: 7.702408, masses: [1, 1, 1], src: 'Broucke 1975', state: () => [.3361300950, 0, .7699893804, 0, -1.1061194754, 0, 0, 1.5324160, 0, -.6287935, 0, -.9036225] },
  { id: 'pythagorean', name: 'Pisagor (Burrau)', note: 'kütle 3·4·5, kaotik — kaçışla biter', T: 70, masses: [3, 4, 5], src: 'Burrau 1913', chaotic: true, state: () => [1, 3, -2, -1, 1, -1, 0, 0, 0, 0, 0, 0] },
]);

/** İvmeler: state [x1,y1,x2,y2,x3,y3, vx1..vy3] → [ax1,ay1,...] */
export function accel(st, m, out = new Float64Array(6)) {
  out.fill(0);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const dx = st[2 * j] - st[2 * i], dy = st[2 * j + 1] - st[2 * i + 1], r2 = dx * dx + dy * dy, inv = G / (r2 * Math.sqrt(r2));
    out[2 * i] += m[j] * dx * inv; out[2 * i + 1] += m[j] * dy * inv; out[2 * j] -= m[i] * dx * inv; out[2 * j + 1] -= m[i] * dy * inv;
  }
  return out;
}
export function minDistance(st) { let d = Infinity; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) d = Math.min(d, Math.hypot(st[2 * j] - st[2 * i], st[2 * j + 1] - st[2 * i + 1])); return d; }
function rk4(st, m, h) {
  const n = 12, k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n), a = new Float64Array(6);
  const deriv = (s, k) => { accel(s, m, a); for (let i = 0; i < 6; i++) { k[i] = s[6 + i]; k[6 + i] = a[i]; } };
  deriv(st, k1); for (let i = 0; i < n; i++) tmp[i] = st[i] + .5 * h * k1[i];
  deriv(tmp, k2); for (let i = 0; i < n; i++) tmp[i] = st[i] + .5 * h * k2[i];
  deriv(tmp, k3); for (let i = 0; i < n; i++) tmp[i] = st[i] + h * k3[i];
  deriv(tmp, k4); for (let i = 0; i < n; i++) st[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
/** dt kadar ilerlet (uyarlanır alt adım: h = min(hMax, k·d_min^1.5)). Yerinde. */
export function advance(st, m, dt, { hMax = 2e-3, k = 4e-3 } = {}) {
  let left = dt; while (left > 0) { const h = Math.min(left, hMax, k * Math.pow(Math.max(1e-3, minDistance(st)), 1.5)); rk4(st, m, h); left -= h; } return st;
}
export function energy(st, m) {
  let T = 0, V = 0; for (let i = 0; i < 3; i++) T += .5 * m[i] * (st[6 + 2 * i] ** 2 + st[7 + 2 * i] ** 2);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) V -= G * m[i] * m[j] / Math.hypot(st[2 * j] - st[2 * i], st[2 * j + 1] - st[2 * i + 1]);
  return T + V;
}
export function angularMomentum(st, m) { let L = 0; for (let i = 0; i < 3; i++) L += m[i] * (st[2 * i] * st[7 + 2 * i] - st[2 * i + 1] * st[6 + 2 * i]); return L; }
/** Bir periyot boyunca örnekle: { pts:[[x,y]×3 per sample], returnError, energyDrift, bbox } */
export function sampleOrbit(entry, { n = 1200 } = {}) {
  const m = entry.masses, st = Float64Array.from(entry.state()), st0 = Float64Array.from(st), E0 = energy(st, m), L0 = angularMomentum(st, m);
  const pts = [[], [], []]; let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  const push = () => { for (let b = 0; b < 3; b++) { const x = st[2 * b], y = st[2 * b + 1]; pts[b].push([x, y]); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); } };
  push(); const dt = entry.T / n; for (let k = 0; k < n; k++) { advance(st, m, dt); push(); }
  let err = 0; for (let i = 0; i < 6; i++) err = Math.max(err, Math.abs(st[i] - st0[i]));
  return { pts, returnError: err, energyDrift: Math.abs((energy(st, m) - E0) / E0), momentumDrift: Math.abs(angularMomentum(st, m) - L0), bbox: { xmin, xmax, ymin, ymax } };
}
