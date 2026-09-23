/* terrain-treadmill.mjs — KESİNTİSİZ DÖNEN ZEMİN (three'siz, DOM'suz).
 *
 * Sorun: bir aracın "yol aldığını" göstermek için araziyi kaydırırsan, döşeme
 * sınırında bir sırt belirir — yükseklik ya da EĞİM iki kenarda uyuşmadığı için.
 * Çözüm, yüksekliği z'de PERİYODİK bir fonksiyon olarak yazmaktır: aynı döşeme
 * arka arkaya dizildiğinde dikiş görünmez, çünkü fonksiyon ve türevi z = ±P/2'de
 * birebir aynıdır (C∞, yalnız C⁰ değil).
 *
 * Nasıl: z farkı doğrudan kullanılmaz, PERİYODİK VEKİLİNE çevrilir
 *
 *     dz(z, cz) = (P/π) · sin( π (z − cz) / P )
 *
 * Bu ifade z → z + P altında değişmez ve |z − cz| ≪ P iken (z − cz)'ye eşittir;
 * yani tepe/krater yakınından bakıldığında normal Öklid uzaklığı gibi davranır,
 * uzakta ise yumuşakça sarar. Geniş bantlı dalgalanma zaten k = 2π/P
 * harmoniklerinden kurulur, o da doğası gereği periyodiktir.
 *
 * DÖNGÜ KAPANIŞI: sahne T saniyede başa dönecekse, tekerlek de tam sayıda tur
 * atmalıdır — yoksa çıtalar döngü sınırında sıçrar. Bu yüzden yol uzunluğu
 * tekerleğin GERÇEK dış çevresinden türetilir:
 *
 *     travel = 2π · rDış · devir      (devir tam sayı)
 *     speed  = travel / loop
 *
 * ve arazi periyodu = travel seçilir: bir döngüde zemin tam bir döşeme kayar.
 * Yarıçap NOMİNAL jant değil, çıtaların dış köşesidir (craft-blocks
 * `WHEEL_OUTER_RADIUS`): tekerlek zemine oradan basar.
 *
 * Kaynak: Masaüstü/Sunumlar/rover-sahnesi (Night Traverse) tekniği; burada
 * parametrik, denetlenebilir ve blok sözleşmesine uygun hâle getirildi.
 *
 * API:
 *   createTreadmill({ period, seed, features, amplitude }) →
 *     { height(x,z), gradient(x,z,out), normal(x,z,out), slopeDeg(x,z),
 *       period, features, describe() }
 *   loopClosure({ wheelRadius, revolutions, loopSeconds }) →
 *     { travel, speed, period, tile, revolutions }
 *   periodicNoise(seed, n) → f(u,v) ∈ [0,1], u ve v'de 1 periyotlu (doku için)
 */

const TAU = Math.PI * 2;

/* ── deterministik rastgelelik ─────────────────────────────────────── */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* z farkının periyodik vekili — modülün çekirdeği (yukarıdaki formül).
 *
 * UYARI (doğrulama yakaladı): bu ifade P periyoduyla PERİYODİK DEĞİL,
 * ANTİ-PERİYODİKTİR:  wrapZ(z + P) = −wrapZ(z).  İşaret döndüğü için
 * kullanan her biçim dz'de ÇİFT olmak ZORUNDADIR — hypot(dx,dz), dz²,
 * exp(−dz²/…) gibi. Tek (odd) bir kullanım (ör. doğrudan `+dz` eklemek)
 * döşeme sınırında görünür bir sırt üretir. Yerleşik üç biçim (crater,
 * hill, ridge) bu kurala uyar ve validate-rigs h(x,z) = h(x,z+P) ile
 * SONUCU sınar; yeni bir biçim eklendiğinde aynı sınama onu da kapsar. */
export const wrapZ = (z, cz, period) => (period / Math.PI) * Math.sin(Math.PI * (z - cz) / period);

/* ── biçimler ──────────────────────────────────────────────────────── */

/** Krater: Gauss çanak + kenar halkası. Derinlik/çap oranı gerçekçi kalır
    (basit kâse kraterde d/D ≈ 0,2; burada kullanıcı verir). */
function craterAt(x, z, P, f) {
  const dx = x - f.x, dz = wrapZ(z, f.z, P);
  const r = Math.hypot(dx, dz);
  const bowl = -f.depth * Math.exp(-0.5 * (r / (f.radius * 0.52)) ** 2);
  const rim = f.depth * 0.29 * Math.exp(-(((r - f.radius) / (f.radius * 0.24)) ** 2));
  return bowl + rim;
}

/** Tepe/mesa: eliptik Gauss zarf × aşınmış sırt modülasyonu. Modülasyon
    k = 2π/P harmonikleriyle yazılır, yoksa dikişte kırılır. */
function hillAt(x, z, P, f) {
  const dx = (x - f.x) / f.rx, dz = wrapZ(z, f.z, P) / f.rz;
  const envelope = Math.exp(-1.8 * (dx * dx + dz * dz));
  const k = TAU / P;
  const crest = 0.83 + 0.17 * Math.cos(x * 1.17 + 2 * k * z) * Math.cos(5 * k * z - x * 0.38);
  return f.height * envelope * crest;
}

/** Sırt (wrinkle ridge): x yönünde uzun, alçak, asimetrik kabarma. */
function ridgeAt(x, z, P, f) {
  const dz = wrapZ(z, f.z, P);
  const across = dz / f.width;
  const along = Math.exp(-0.5 * ((x - f.x) / f.length) ** 2);
  const k = TAU / P;
  const wobble = 1 + 0.22 * Math.sin(3 * k * z + x * 0.31);
  return f.height * along * Math.exp(-0.5 * across * across) * wobble;
}

const KIND = { crater: craterAt, hill: hillAt, ridge: ridgeAt };

/** Varsayılan tohumlu manzara: sürüş koridorunun DIŞINDA tepeler, içinde
    yalnız alçak kraterler — araç kendi yolunu tırmanmak zorunda kalmasın
    ama ufuk boş durmasın (kadraj kuralı, Night Traverse dersi). */
export function defaultFeatures(seed, period, { lane = 1.6, laneHalfWidth = 2.2 } = {}) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1;
    out.push({ kind: 'hill', x: side * (6.2 + rnd() * 8.4), z: (rnd() - 0.5) * period,
      rx: 3.2 + rnd() * 2.6, rz: 5.0 + rnd() * 2.4, height: 1.7 + rnd() * 1.4 });
  }
  for (let i = 0; i < 4; i++) {
    let x = (rnd() - 0.5) * 22;
    if (Math.abs(Math.abs(x) - lane) < laneHalfWidth) x += x < 0 ? -laneHalfWidth : laneHalfWidth;
    out.push({ kind: 'crater', x, z: (rnd() - 0.5) * period,
      radius: 2.7 + rnd() * 1.6, depth: 0.22 + rnd() * 0.22 });
  }
  out.push({ kind: 'ridge', x: (rnd() - 0.5) * 6, z: (rnd() - 0.5) * period,
    length: 9 + rnd() * 5, width: 1.4 + rnd() * 0.8, height: 0.16 + rnd() * 0.12 });
  return out;
}

/* ── alan ──────────────────────────────────────────────────────────── */
export function createTreadmill({ period = 20, seed = 20260923, features, amplitude = 1,
  lane = 1.6, laneHalfWidth = 2.2 } = {}) {
  if (!(period > 0)) throw new Error('terrain-treadmill: period > 0 olmalı');
  const list = (features ?? defaultFeatures(seed, period, { lane, laneHalfWidth })).map(f => {
    if (!KIND[f.kind]) throw new Error(`terrain-treadmill: bilinmeyen biçim '${f.kind}'`);
    return f;
  });
  const k = TAU / period;

  /* Geniş bantlı dalgalanma: yalnız k'nın tam katları — periyodikliğin garantisi. */
  const undulation = (x, z) =>
    0.057 * Math.sin(k * z + x * 0.22) * Math.cos(x * 0.27) +
    0.041 * Math.sin(2 * k * z - x * 0.39) +
    0.025 * Math.cos(3 * k * z + x * 0.58);

  const height = (x, z) => {
    let h = undulation(x, z);
    for (const f of list) h += KIND[f.kind](x, z, period, f);
    return h * amplitude;
  };
  const EPS = 0.035;
  const gradient = (x, z, out = [0, 0]) => {
    out[0] = (height(x + EPS, z) - height(x - EPS, z)) / (2 * EPS);
    out[1] = (height(x, z + EPS) - height(x, z - EPS)) / (2 * EPS);
    return out;
  };
  const normal = (x, z, out = [0, 1, 0]) => {
    const g = gradient(x, z);
    const inv = 1 / Math.hypot(g[0], 1, g[1]);
    out[0] = -g[0] * inv; out[1] = inv; out[2] = -g[1] * inv;
    return out;
  };
  const slopeDeg = (x, z) => { const g = gradient(x, z); return Math.atan(Math.hypot(g[0], g[1])) * 180 / Math.PI; };

  return {
    period, amplitude, features: list, seed,
    height, gradient, normal, slopeDeg,
    describe() {
      return {
        period, amplitude, seed,
        seamless: 'h(x, z) = h(x, z + period) ve ∂h/∂z de eşittir (C∞)',
        features: list.map(f => ({ kind: f.kind, x: +f.x.toFixed(2), z: +f.z.toFixed(2) })),
      };
    },
  };
}

/* ── döngü kapanışı ────────────────────────────────────────────────── */
/** Tekerlek tam sayı devir atacak biçimde yol/hız/periyot türetir.
    wheelRadius = ÇITALARIN DIŞ köşesi (craft-blocks WHEEL_OUTER_RADIUS × ölçek). */
export function loopClosure({ wheelRadius, revolutions = 28, loopSeconds = 96 } = {}) {
  if (!(wheelRadius > 0)) throw new Error('loopClosure: wheelRadius > 0 olmalı');
  const revs = Math.max(1, Math.round(revolutions));
  const travel = TAU * wheelRadius * revs;
  return { travel, speed: travel / loopSeconds, period: travel, tile: travel / 4, revolutions: revs, loopSeconds };
}

/* ── periyodik değer gürültüsü (doku için) ─────────────────────────── */
/** n×n ızgara, kenarlarda sarar: üretilen doku yan yana dizilince dikiş yok. */
export function periodicNoise(seed, n = 16) {
  const rnd = mulberry32(seed);
  const v = new Float32Array(n * n);
  for (let i = 0; i < v.length; i++) v[i] = rnd();
  const at = (a, b) => v[((b % n) + n) % n * n + (((a % n) + n) % n)];
  return (u, w) => {
    const x = u * n, y = w * n, ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
    const b = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
    return a * (1 - sy) + b * sy;
  };
}

/** Katmanlı periyodik fBm ∈ [0,1] — zemin dokusu ve tümsek haritası için. */
export function periodicFbm(seed, octaves = [4, 8, 16, 32, 64], weights = [0.34, 0.26, 0.19, 0.13, 0.08]) {
  const layers = octaves.map((n, i) => ({ f: periodicNoise(seed + i * 7919, n), w: weights[i] ?? 0 }));
  const total = layers.reduce((s, l) => s + l.w, 0) || 1;
  return (u, v) => layers.reduce((s, l) => s + l.w * l.f(u, v), 0) / total;
}
