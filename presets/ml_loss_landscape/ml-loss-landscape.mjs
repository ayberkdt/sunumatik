/* ML Loss Landscape — 3B kayıp yüzeyi üzerinde GERÇEK optimizatör yarışı.

   Dürüstlük çekirdeği:
   - Yüzey ANALİTİK bir test fonksiyonudur (aşağıda birebir formül); çalışma
     zamanında hiçbir rastgelelik yoktur — bütün sabitler literal.
   - Gradyan ∇f elle türetilmiş kapalı formdur (sayısal türevle doğrulandı,
     en kötü fark 3.4e-9).
   - Üç iz CANLI integre edilir: her simülasyon adımında gerçek güncelleme
     kuralları koşar — önceden pişirilmiş yörünge yoktur. Aynı başlangıç,
     aynı adımlar → restart birebir aynı yolları oynatır.

   ═══ YÜZEY FORMÜLÜ (birebir; referans dosyasıyla aynı) ═══
   G(x,y;cx,cy,σ) = exp(−((x−cx)² + (y−cy)²) / (2σ²))
   v(x,y) = y − (0.28x² − 1.55)              ← vadi merkez eğrisi (parabol)

   f(x,y) = 0.058(x² + y²)                                   hafif çanak
          + 0.42·x·y·exp(−(x² + y²)/3.4)                     nazik eyer (orijin)
          − 0.85·G(x,y; −1.9,  1.7,  0.55)                   kuyu K1 (KB)
          − 0.75·G(x,y; −1.6, −1.8,  0.52)                   kuyu K2 (GB)
          − 0.65·G(x,y;  2.2,  1.8,  0.50)                   kuyu K3 (KD)
          − 1.10·G(x,y;  1.85, −0.59, 0.45)                  kuyu K4 — küresel min
          − 0.20·G(x,y; −0.35, −1.516, 0.20)                 kuyu K5 — sığ tuzak
          − 0.78·exp(−v²/(2·0.20²))·exp(−(x−0.8)²/(2·1.55²)) dar vadi (ravine)

   Tanım bölgesi [−3,3]². Izgara üzerinde f ∈ [−1.675, 1.062];
   küresel minimum ≈ (1.78, −0.66). (K4 genişliği görsel nedenle 0.45:
   daha dar kuyu 40°'lik sinematik kameradan içi görünmeyen bir yarık
   veriyordu; dinamik ayrışma yeniden doğrulandı.)

   ═══ OPTİMİZATÖRLER (adım başına, sabit sim dt) ═══
   SGD       x ← x − η∇f                          η = 0.045
   Momentum  v ← βv − η∇f ;  x ← x + v            β = 0.9,  η = 0.012
   Adam      m ← β₁m + (1−β₁)∇f
             u ← β₂u + (1−β₂)(∇f)²
             x ← x − η·m̂/(√û + ε)                 η = 0.09, β₁=0.9, β₂=0.999, ε=1e-8
             (m̂ = m/(1−β₁ᵗ), û = u/(1−β₂ᵗ) — bias düzeltmeli)

   Başlangıç noktası (deneyle seçildi, bkz. referans): (−1.05, −1.30) —
   eyer havzasının vadiye bakan yamacı. Buradan üç yol GERÇEKTEN ayrışır:
   SGD ~63. adımda sığ tuzak kuyusuna (K5) takılır (L≈−0.601), Adam
   normalize adımlarla vadi boyunca ~43. adımda, Momentum salınarak
   ~87. adımda küresel minimuma (L≈−1.675) varır.

   Sayfa gereksinimleri: "three" için import map
   (../moon_advanced/vendor/three.module.min.js) + ml-loss-landscape.css. */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';

/* ── analitik model ─────────────────────────────────────────────────── */

/* Kuyular: [genlik (negatif = çukur), cx, cy, σ] — literal sabitler. */
const WELLS = [
  [-0.85, -1.9, 1.7, 0.55],
  [-0.75, -1.6, -1.8, 0.52],
  [-0.65, 2.2, 1.8, 0.50],
  [-1.10, 1.85, -0.59, 0.45],
  [-0.20, -0.35, -1.516, 0.20],
];
const BOWL = 0.058;                    // çanak katsayısı
const SADDLE_A = 0.42, SADDLE_S = 3.4; // eyer genliği ve zarf ölçeği
const RAV_A = 0.78;                    // vadi derinliği
const RAV_SV2 = 2 * 0.20 * 0.20;       // 2σ_v² (enine)
const RAV_SX2 = 2 * 1.55 * 1.55;       // 2σ_x² (boyuna zarf)
const RAV_CX = 0.8;                    // boyuna zarf merkezi
const RAV_QA = 0.28, RAV_QB = 1.55;    // merkez eğrisi y = 0.28x² − 1.55

export function lossAt(x, y) {
  let f = BOWL * (x * x + y * y)
    + SADDLE_A * x * y * Math.exp(-(x * x + y * y) / SADDLE_S);
  for (const [A, cx, cy, s] of WELLS) {
    f += A * Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s)));
  }
  const v = y - (RAV_QA * x * x - RAV_QB);
  f += -RAV_A * Math.exp(-(v * v) / RAV_SV2) * Math.exp(-((x - RAV_CX) ** 2) / RAV_SX2);
  return f;
}

/* ∇f — kapalı form (her terimin elle türevi; sayısal türevle doğrulandı). */
export function gradAt(x, y) {
  let gx = 2 * BOWL * x, gy = 2 * BOWL * y;
  const e = Math.exp(-(x * x + y * y) / SADDLE_S);
  gx += SADDLE_A * e * (y - (2 / SADDLE_S) * x * x * y);
  gy += SADDLE_A * e * (x - (2 / SADDLE_S) * x * y * y);
  for (const [A, cx, cy, s] of WELLS) {
    const g = A * Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s)));
    gx += g * (-(x - cx) / (s * s));
    gy += g * (-(y - cy) / (s * s));
  }
  const v = y - (RAV_QA * x * x - RAV_QB);
  const R = -RAV_A * Math.exp(-(v * v) / RAV_SV2) * Math.exp(-((x - RAV_CX) ** 2) / RAV_SX2);
  /* dv/dx = −2·0.28·x ; zincir kuralı: d(lnR)/dx = (−2v/2σv²)·dv/dx − 2(x−cx)/2σx² */
  gx += R * ((-2 * v / RAV_SV2) * (-2 * RAV_QA * x) - 2 * (x - RAV_CX) / RAV_SX2);
  gy += R * (-2 * v / RAV_SV2);
  return [gx, gy];
}

/* ── sabitler ───────────────────────────────────────────────────────── */

export const START = [-1.05, -1.30];   // deneyle seçilen ortak başlangıç
const DOMAIN = 3;                      // [−3,3]²
const GRID = 128;                      // 128² hücre → 129² köşe
const H_SCALE = 0.55;                  // yükseklik ölçeği (görsel)
const STEPS_PER_SEC = 12;              // sabit sim hızı (adım/sn)
const MAX_STEPS = 360;                 // yarış donma noktası (yakınsamanın çok ötesi)
const BALL_R = 0.085;                  // top yarıçapı
const TRAIL_W = 0.032;                 // kurdele yarım genişliği
const ORBIT_RATE = (2 * Math.PI) / 100; // kamera turu: 100 sn'de tam tur (yavaş, sinematik)
const CONTOUR_LEVELS = [-1.5, -1.0, -0.7, -0.45, -0.22, 0.0, 0.35, 0.7]; // 8 gerçek iso-çizgi
const CONTOUR_Y = -1.30;               // kontur düzleminin yüksekliği (yüzeyin altında)

const OPTIMIZERS = [
  { key: 'sgd', label: 'SGD', hyper: 'η 0.045', token: '--color-data-1', fallback: '#5590c9' },
  { key: 'momentum', label: 'Momentum', hyper: 'β 0.9 · η 0.012', token: '--color-data-2', fallback: '#c86a40' },
  { key: 'adam', label: 'Adam', hyper: 'η 0.09 · β₁ 0.9 · β₂ 0.999', token: '--color-data-3', fallback: '#58a27e' },
];

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const domExport = () =>
  new URLSearchParams(location.search).get('export') === '1'
  || document.documentElement.dataset.export === 'true';

const fmt = value => (value < 0 ? '−' : '') + Math.abs(value).toFixed(3);

/* ── optimizatör durum makineleri (canlı entegrasyon) ───────────────── */

function createOptimizers() {
  return {
    t: 0, // adım sayacı (Adam bias düzeltmesi için)
    sgd: { x: START[0], y: START[1] },
    momentum: { x: START[0], y: START[1], vx: 0, vy: 0 },
    adam: { x: START[0], y: START[1], mx: 0, my: 0, ux: 0, uy: 0 },
  };
}

/* Tek sim adımı: üç güncelleme kuralı da gerçek gradyanla koşar. */
function stepOptimizers(o) {
  o.t += 1;
  const clamp = v => Math.max(-2.98, Math.min(2.98, v)); // tanım bölgesi kelepçesi
  { // SGD: x ← x − η∇f
    const [gx, gy] = gradAt(o.sgd.x, o.sgd.y);
    o.sgd.x = clamp(o.sgd.x - 0.045 * gx);
    o.sgd.y = clamp(o.sgd.y - 0.045 * gy);
  }
  { // Momentum: v ← βv − η∇f ; x ← x + v
    const m = o.momentum;
    const [gx, gy] = gradAt(m.x, m.y);
    m.vx = 0.9 * m.vx - 0.012 * gx;
    m.vy = 0.9 * m.vy - 0.012 * gy;
    m.x = clamp(m.x + m.vx);
    m.y = clamp(m.y + m.vy);
  }
  { // Adam: bias düzeltmeli m̂, û
    const a = o.adam;
    const [gx, gy] = gradAt(a.x, a.y);
    a.mx = 0.9 * a.mx + 0.1 * gx;
    a.my = 0.9 * a.my + 0.1 * gy;
    a.ux = 0.999 * a.ux + 0.001 * gx * gx;
    a.uy = 0.999 * a.uy + 0.001 * gy * gy;
    const c1 = 1 - Math.pow(0.9, o.t), c2 = 1 - Math.pow(0.999, o.t);
    a.x = clamp(a.x - 0.09 * (a.mx / c1) / (Math.sqrt(a.ux / c2) + 1e-8));
    a.y = clamp(a.y - 0.09 * (a.my / c1) / (Math.sqrt(a.uy / c2) + 1e-8));
  }
}

/* ── yardımcılar ────────────────────────────────────────────────────── */

/* Marching squares: gerçek iso-çizgiler (örneklenmiş f üzerinde lineer interp). */
function marchContours(values, n, levels) {
  const segs = [];
  const cell = (2 * DOMAIN) / n;
  const X = i => -DOMAIN + i * cell;
  for (const L of levels) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v00 = values[j * (n + 1) + i], v10 = values[j * (n + 1) + i + 1];
        const v01 = values[(j + 1) * (n + 1) + i], v11 = values[(j + 1) * (n + 1) + i + 1];
        let code = 0;
        if (v00 > L) code |= 1;
        if (v10 > L) code |= 2;
        if (v11 > L) code |= 4;
        if (v01 > L) code |= 8;
        if (code === 0 || code === 15) continue;
        const lerp = (a, b) => (L - a) / (b - a);
        /* kenar orta noktaları: alt, sağ, üst, sol */
        const pts = {
          b: [X(i) + cell * lerp(v00, v10), X(j)],
          r: [X(i + 1), X(j) + cell * lerp(v10, v11)],
          t: [X(i) + cell * lerp(v01, v11), X(j + 1)],
          l: [X(i), X(j) + cell * lerp(v00, v01)],
        };
        const EDGE_TABLE = {
          1: [['l', 'b']], 2: [['b', 'r']], 3: [['l', 'r']], 4: [['r', 't']],
          5: [['l', 't'], ['b', 'r']], 6: [['b', 't']], 7: [['l', 't']],
          8: [['t', 'l']], 9: [['t', 'b']], 10: [['t', 'r'], ['l', 'b']],
          11: [['t', 'r']], 12: [['r', 'l']], 13: [['r', 'b']], 14: [['b', 'l']],
        };
        for (const [a, b] of EDGE_TABLE[code]) {
          segs.push(pts[a][0], CONTOUR_Y, pts[a][1], pts[b][0], CONTOUR_Y, pts[b][1]);
        }
      }
    }
  }
  return new Float32Array(segs);
}

/* Kurdele izi: önceden ayrılmış tampon, görünür geometri asla yeniden
   kurulmaz (sözleşme) — sadece drawRange büyür ve baş noktası güncellenir.
   Genişletme KAMERAYA DÖNÜK olarak vertex shader'da yapılır (parametrik
   geometri): her köşe merkez + teğet + yan işareti taşır; ofset yönü
   normalize(cross(kameraya_bakış, teğet)) — kurdele hangi açıdan bakılırsa
   bakılsın tam genişliğiyle okunur (yatay şerit yandan görünmez olurdu). */
class TrailRibbon {
  constructor(colorHex) {
    const maxPts = MAX_STEPS + 2; // adımlar + canlı baş
    this.centers = new Float32Array(maxPts * 2 * 3);   // 'position' = merkez
    this.tangents = new Float32Array(maxPts * 2 * 3);
    this.sides = new Float32Array(maxPts * 2);
    this.steps = new Float32Array(maxPts * 2);
    this.count = 0;             // işlenmiş nokta sayısı
    this.lastTan = [1, 0, 0];
    this.prev = null;           // son işlenen [x, y, z] (dünya)
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.centers, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aTangent', new THREE.BufferAttribute(this.tangents, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSide', new THREE.BufferAttribute(this.sides, 1));
    geometry.setAttribute('aStep', new THREE.BufferAttribute(this.steps, 1).setUsage(THREE.DynamicDrawUsage));
    for (let k = 0; k < maxPts; k++) { this.sides[k * 2] = 1; this.sides[k * 2 + 1] = -1; }
    const index = new Uint32Array((maxPts - 1) * 6);
    for (let i = 0; i < maxPts - 1; i++) {
      const a = i * 2;
      index.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], i * 6);
    }
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.setDrawRange(0, 0);
    /* Kırpma küresi: merkezler zaten [-3,3]² içinde, sabit sınır yeterli. */
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 8);
    this.geometry = geometry;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
        uHead: { value: 0 },
        uFade: { value: 1 },    // 0 = solma yok (export/reduced: iz tam görünür)
        uOpacity: { value: 0.95 },
        uWidth: { value: TRAIL_W },
      },
      vertexShader: /* glsl */`
        attribute vec3 aTangent;
        attribute float aSide;
        attribute float aStep;
        uniform float uWidth;
        varying float vStep;
        void main() {
          vStep = aStep;
          vec3 toCam = normalize(cameraPosition - position);
          vec3 offsetDir = cross(toCam, normalize(aTangent));
          float len = length(offsetDir);
          offsetDir = len > 1e-4 ? offsetDir / len : vec3(0., 1., 0.);
          vec3 pos = position + offsetDir * uWidth * aSide;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uHead; uniform float uFade; uniform float uOpacity;
        varying float vStep;
        void main() {
          /* yaşla solan iz: taban 0.45 → tüm yol okunur kalır (yarış haritası) */
          float age = max(0., uHead - vStep);
          float alpha = mix(1., 0.45 + 0.55 * exp(-age * 0.010), uFade);
          gl_FragColor = vec4(uColor, alpha * uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /* Nokta yaz (index k): merkez p, teğet = önceki noktadan yön. */
  writePoint(k, p, step) {
    let tan = this.lastTan;
    if (this.prev) {
      const dx = p[0] - this.prev[0], dy = p[1] - this.prev[1], dz = p[2] - this.prev[2];
      const len = Math.hypot(dx, dy, dz);
      if (len > 1e-6) { tan = [dx / len, dy / len, dz / len]; this.lastTan = tan; }
    }
    for (const half of [0, 1]) {
      const o = (k * 2 + half) * 3;
      this.centers[o] = p[0]; this.centers[o + 1] = p[1]; this.centers[o + 2] = p[2];
      this.tangents[o] = tan[0]; this.tangents[o + 1] = tan[1]; this.tangents[o + 2] = tan[2];
    }
    this.steps[k * 2] = step;
    this.steps[k * 2 + 1] = step;
  }

  commit(p, step) {
    this.writePoint(this.count, p, step);
    this.prev = p;
    this.count += 1;
    this.syncHead(p, step);
  }

  /* Canlı baş: her karede güncellenen ek nokta — top ile iz arasında boşluk
     kalmaz, geometri yeniden kurulmaz (C0 süreklilik). */
  syncHead(p, step) {
    this.writePoint(this.count, p, step);
    this.geometry.setDrawRange(0, Math.max(0, this.count) * 6);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aTangent.needsUpdate = true;
    this.geometry.attributes.aStep.needsUpdate = true;
    this.material.uniforms.uHead.value = step;
  }

  reset() {
    this.count = 0;
    this.prev = null;
    this.lastTan = [1, 0, 0];
    this.geometry.setDrawRange(0, 0);
  }
}

/* ── mount ──────────────────────────────────────────────────────────── */

export function mountLossLandscape(container, options = {}) {
  if (!container) throw new Error('mountLossLandscape bir kap ister');
  /* seed: API simetrisi için kabul edilir; sahne TAMAMEN deterministiktir
     (yüzey ve yollar sabitlerden gelir), seed şu an hiçbir şeyi değiştirmez. */
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const title = options.title || 'Üç optimizatör, aynı yüzey, üç farklı kader';

  const state = {
    active: options.active ?? true,
    playing: !(exportMode || reducedMotion) && (options.autoplay ?? true),
    orbit: options.orbit ?? true,
    trails: true,
    simAcc: 0,
    orbitTime: 0,
    visible: { sgd: true, momentum: true, adam: true },
    done: false,
  };
  if (exportMode || reducedMotion) state.orbit = false; // sözleşme: kamera sabit

  /* ── DOM ── */
  const figure = document.createElement('figure');
  figure.className = 'lls-preset';
  figure.dataset.export = exportMode ? 'true' : 'false';
  figure.dataset.ownsKeys = '';
  figure.tabIndex = 0;
  figure.setAttribute('aria-label', title);
  figure.innerHTML = `
    <div class="lls-canvas" aria-hidden="true"></div>
    <header class="lls-heading"><span>ML · KAYIP YÜZEYİ</span><h1>${title}</h1></header>
    <div class="lls-legend" role="group" aria-label="Optimizatörler — açıp kapatmak için tıklayın">
      ${OPTIMIZERS.map(o => `
        <button type="button" class="lls-chip" data-opt="${o.key}" aria-pressed="true">
          <i style="background: var(${o.token}, ${o.fallback})"></i>
          <span class="lls-chip__name">${o.label}<small>${o.hyper}</small></span>
          <output data-loss="${o.key}">—</output>
        </button>`).join('')}
    </div>
    <div class="lls-transport" data-export-hide role="group" aria-label="Oynatma kontrolleri">
      <button type="button" data-action="play" aria-pressed="true">Duraklat</button>
      <button type="button" data-action="restart" data-secondary>Yeniden başlat</button>
      <button type="button" data-action="trails" data-secondary aria-pressed="true">Yörüngeyi göster</button>
      <button type="button" data-action="orbit" data-secondary aria-pressed="${state.orbit}">Kamera turu</button>
      <span class="lls-step" data-step aria-live="off">adım 0 / ${MAX_STEPS}</span>
    </div>
    <figcaption class="lls-truth">
      <strong>Analitik test yüzeyi</strong>
      <small>Gerçek bir modelin kayıp yüzeyi değil; adım sayısı sıkıştırılmış.
        Güncelleme kuralları ve gradyan gerçektir; öğrenme oranları gösterim için seçildi.</small>
    </figcaption>
    <p class="lls-help" data-export-hide>Sürükle: kamera · Boşluk: durdur · R: yeniden başlat · O: kamera turu · Y: yörüngeler</p>`;
  container.appendChild(figure);
  const canvasHost = figure.querySelector('.lls-canvas');
  const stepEl = figure.querySelector('[data-step]');
  const lossEls = Object.fromEntries(OPTIMIZERS.map(o => [o.key, figure.querySelector(`[data-loss="${o.key}"]`)]));
  const chips = Object.fromEntries(OPTIMIZERS.map(o => [o.key, figure.querySelector(`[data-opt="${o.key}"]`)]));

  /* Palet renkleri CSS değişkenlerinden (mount anında) okunur. */
  const styles = getComputedStyle(figure);
  const readToken = (token, fallback) => (styles.getPropertyValue(token) || '').trim() || fallback;
  const optColors = Object.fromEntries(OPTIMIZERS.map(o => [o.key, readToken(o.token, o.fallback)]));
  const canvasColor = new THREE.Color(readToken('--color-canvas', '#101318'));
  const warmColor = new THREE.Color(readToken('--color-muted', '#a08a6a'));
  const ruleColor = readToken('--color-rule', '#3a3f48');

  /* ── renderer / sahne / kamera ── */
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: true, powerPreference: 'high-performance',
    preserveDrawingBuffer: true, // export/denetim: canvas her an geri okunabilir
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const target = new THREE.Vector3(0, -0.35, 0);
  /* Açılış kadrajı: vadi ve küresel minimum kameraya bakar (güneyden, dar
     çukurun içi görünecek yükseklikte) — yarış bölgesi açılışta görünür,
     tur gerisini gezdirir. */
  camera.position.set(2.0, 5.3, -5.9);
  camera.lookAt(target);

  /* Işık disiplini: TEK anahtar ışık + sönük dolgu — vadinin gölgesi
     yüzey şeklini okutur, ekstra efekt yok. */
  const key = new THREE.DirectionalLight('#fff2e0', 1.6);
  key.position.set(3.5, 6, 2);
  scene.add(key);
  scene.add(new THREE.HemisphereLight('#5a6a80', '#14161c', 0.55));
  scene.add(new THREE.AmbientLight('#404650', 0.5));

  /* ── yüzey ağı (129² köşe) ── */
  const V = GRID + 1;
  const heights = new Float32Array(V * V); // f değerleri (kontur + renk için)
  const positions = new Float32Array(V * V * 3);
  const colors = new Float32Array(V * V * 3);
  let fMin = Infinity, fMax = -Infinity;
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const x = -DOMAIN + (2 * DOMAIN * i) / GRID;
      const z = -DOMAIN + (2 * DOMAIN * j) / GRID;
      const f = lossAt(x, z);
      heights[j * V + i] = f;
      if (f < fMin) fMin = f;
      if (f > fMax) fMax = f;
      const o = (j * V + i) * 3;
      positions[o] = x; positions[o + 1] = f * H_SCALE; positions[o + 2] = z;
    }
  }
  /* Köşe renkleri: derin = canvas-koyusu, yüksek = ılık nötr (palet uyumlu,
     gökkuşağı yok) — gamma 2.1 rampası kuyuları ve vadiyi görünür koyulukta
     tutar; sadece gerçek yükseklikler ılık tona çıkar. */
  const deep = canvasColor.clone().multiplyScalar(0.5);
  const tmpColor = new THREE.Color();
  for (let k = 0; k < V * V; k++) {
    const t = Math.pow((heights[k] - fMin) / (fMax - fMin), 2.1);
    tmpColor.copy(deep).lerp(warmColor, t);
    colors[k * 3] = tmpColor.r; colors[k * 3 + 1] = tmpColor.g; colors[k * 3 + 2] = tmpColor.b;
  }
  const surfaceGeometry = new THREE.BufferGeometry();
  surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  surfaceGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  {
    const index = new Uint32Array(GRID * GRID * 6);
    let w = 0;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
        index[w++] = a; index[w++] = c; index[w++] = b;
        index[w++] = b; index[w++] = c; index[w++] = d;
      }
    }
    surfaceGeometry.setIndex(new THREE.BufferAttribute(index, 1));
  }
  surfaceGeometry.computeVertexNormals();
  const surface = new THREE.Mesh(surfaceGeometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, metalness: 0.05,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
  scene.add(surface);

  /* İnce tel kafes katmanı — düşük opaklık, yüzeyin eğriliğini okutur. */
  const wireframe = new THREE.Mesh(surfaceGeometry, new THREE.MeshBasicMaterial({
    wireframe: true, transparent: true, opacity: 0.05, color: warmColor, depthWrite: false,
  }));
  wireframe.renderOrder = 1;
  scene.add(wireframe);

  /* Kontur halkaları: f'in GERÇEK iso-çizgileri (marching squares), yüzeyin
     altında düz bir düzleme projeksiyon — altına mat zemin, harita gibi okunur. */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 6.8),
    new THREE.MeshBasicMaterial({ color: canvasColor.clone().multiplyScalar(0.62) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = CONTOUR_Y - 0.02;
  scene.add(ground);
  const contourGeometry = new THREE.BufferGeometry();
  contourGeometry.setAttribute('position', new THREE.BufferAttribute(marchContours(heights, GRID, CONTOUR_LEVELS), 3));
  const contours = new THREE.LineSegments(contourGeometry, new THREE.LineBasicMaterial({
    color: warmColor, transparent: true, opacity: 0.4, depthWrite: false,
  }));
  scene.add(contours);

  /* ── toplar + izler ── */
  const surfaceY = (x, y) => lossAt(x, y) * H_SCALE;
  const worldOf = (x, y) => [x, surfaceY(x, y) + BALL_R, y]; // top: y = f + r
  const trailY = (x, y) => surfaceY(x, y) + 0.03;            // iz: yüzeyin hemen üstü

  const balls = {}, trails = {};
  for (const o of OPTIMIZERS) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 28, 20),
      new THREE.MeshStandardMaterial({
        color: optColors[o.key], roughness: 0.45, metalness: 0.1,
        emissive: optColors[o.key], emissiveIntensity: 0.35, // vadi gölgesinde okunurluk
      }),
    );
    scene.add(ball);
    balls[o.key] = ball;
    const trail = new TrailRibbon(optColors[o.key]);
    scene.add(trail.mesh);
    trails[o.key] = trail;
  }

  /* ── simülasyon durumu ── */
  let opt = createOptimizers();
  /* Görünen konum sim konumuna üstel yaklaşır (C0 — adım atlaması gözükmez). */
  const display = {};
  const resetDisplay = () => {
    for (const o of OPTIMIZERS) {
      const p = worldOf(...START);
      display[o.key] = { x: p[0], y: p[1], z: p[2] };
      balls[o.key].position.set(p[0], p[1], p[2]);
    }
  };

  const simPos = key2 => {
    const s = opt[key2];
    return [s.x, s.y];
  };

  const commitTrails = () => {
    for (const o of OPTIMIZERS) {
      const [x, y] = simPos(o.key);
      trails[o.key].commit([x, trailY(x, y), y], opt.t);
    }
  };

  const updateReadouts = () => {
    for (const o of OPTIMIZERS) {
      const [x, y] = simPos(o.key);
      lossEls[o.key].textContent = fmt(lossAt(x, y));
    }
    stepEl.textContent = `adım ${opt.t} / ${MAX_STEPS}`;
  };

  const resetSim = () => {
    opt = createOptimizers();
    state.simAcc = 0;
    state.done = false;
    for (const o of OPTIMIZERS) trails[o.key].reset();
    commitTrails(); // 0. adım: başlangıç noktası
    resetDisplay();
    updateReadouts();
  };

  /* advance(dt): sahnenin TAMAMI deterministik ilerler (sim + kamera turu).
     Dışarıdan da sürülebilir (test/decor). */
  const advance = dt => {
    if (state.playing && !state.done) {
      state.simAcc += dt * STEPS_PER_SEC;
      while (state.simAcc >= 1 && !state.done) {
        state.simAcc -= 1;
        stepOptimizers(opt);
        commitTrails();
        if (opt.t >= MAX_STEPS) state.done = true;
      }
      updateReadouts();
    }
    if (state.orbit) state.orbitTime += dt;
    /* topların yumuşak takibi (kare hızından bağımsız üstel süzgeç) */
    const k = 1 - Math.exp(-dt * 14);
    for (const o of OPTIMIZERS) {
      const [x, y] = simPos(o.key);
      const p = worldOf(x, y);
      const d = display[o.key];
      d.x += (p[0] - d.x) * k; d.y += (p[1] - d.y) * k; d.z += (p[2] - d.z) * k;
      balls[o.key].position.set(d.x, d.y, d.z);
      trails[o.key].syncHead([d.x, trailY(x, y), d.z], opt.t);
    }
  };

  /* ── kamera turu + kontroller ── */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 16;
  controls.target.copy(target);
  controls.update();
  /* Kullanıcı sürüklerken tur duraksar; bırakınca kaldığı açıdan sürer. */
  let orbitBase = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
  let orbitRadius = camera.position.clone().sub(target).setY(0).length();
  let orbitHeight = camera.position.y;
  let dragging = false;
  controls.addEventListener('start', () => { dragging = true; });
  controls.addEventListener('end', () => {
    const off = camera.position.clone().sub(target);
    orbitBase = Math.atan2(off.x, off.z);
    orbitRadius = off.setY(0).length() || orbitRadius;
    orbitHeight = camera.position.y;
    state.orbitTime = 0;
    dragging = false;
  });
  controls.addEventListener('change', () => { if (!frame) renderOnce(); });

  const applyOrbit = () => {
    if (!state.orbit || dragging) return;
    const a = orbitBase + state.orbitTime * ORBIT_RATE;
    camera.position.set(
      target.x + Math.sin(a) * orbitRadius,
      orbitHeight,
      target.z + Math.cos(a) * orbitRadius,
    );
    camera.lookAt(target);
  };

  /* Tepeden kontur görünümü (denetim/ekran görüntüsü): ?view=top —
     aynasız yönelim: param +x ekran sağı, param +y ekran AŞAĞISI
     (yukarıdan bakışta gerçek el yönü; formülle karşılaştırırken dikkat). */
  const topView = () => {
    state.orbit = false;
    controls.enabled = false;
    camera.up.set(0, 0, -1);
    camera.position.set(0, 10.5, 0);
    camera.lookAt(0, 0, 0);
    renderOnce();
  };

  /* ── kare döngüsü ── */
  let frame = null;
  const clock = new THREE.Clock();
  const idle = () => !state.active || exportMode || reducedMotion
    || (!state.playing && !state.orbit);
  const renderOnce = () => renderer.render(scene, camera);
  const loop = () => {
    frame = null;
    if (idle()) return;
    const dt = Math.min(0.1, clock.getDelta());
    advance(dt);
    applyOrbit();
    renderOnce();
    frame = requestAnimationFrame(loop);
  };
  const ensureLoop = () => {
    if (idle()) { applyOrbit(); renderOnce(); return; }
    if (frame === null) { clock.getDelta(); frame = requestAnimationFrame(loop); }
  };
  const onVisibility = () => ensureLoop();
  document.addEventListener('visibilitychange', onVisibility);

  /* ── boyutlandırma ── */
  const resize = () => {
    const width = Math.max(2, canvasHost.offsetWidth);
    const height = Math.max(2, canvasHost.offsetHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderOnce();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  resize();

  /* ── API eylemleri ── */
  const setPlaying = value => {
    state.playing = Boolean(value) && !exportMode && !reducedMotion;
    const button = figure.querySelector('[data-action="play"]');
    button.textContent = state.playing ? 'Duraklat' : 'Oynat';
    button.setAttribute('aria-pressed', String(state.playing));
    if (state.playing) clock.getDelta(); // duraklama süresi dt'ye sızmasın
    ensureLoop();
  };
  const restart = () => { resetSim(); ensureLoop(); renderOnce(); };
  const toggleOptimizer = (key2, value) => {
    if (!(key2 in state.visible)) return;
    state.visible[key2] = value ?? !state.visible[key2];
    const on = state.visible[key2];
    balls[key2].visible = on;
    trails[key2].mesh.visible = on && state.trails;
    chips[key2].setAttribute('aria-pressed', String(on));
    chips[key2].classList.toggle('is-off', !on);
    renderOnce();
  };
  const setTrails = value => {
    state.trails = Boolean(value);
    for (const o of OPTIMIZERS) trails[o.key].mesh.visible = state.trails && state.visible[o.key];
    const button = figure.querySelector('[data-action="trails"]');
    button.setAttribute('aria-pressed', String(state.trails));
    renderOnce();
  };
  const setOrbit = value => {
    state.orbit = Boolean(value) && !exportMode && !reducedMotion;
    const button = figure.querySelector('[data-action="orbit"]');
    button.setAttribute('aria-pressed', String(state.orbit));
    ensureLoop();
  };
  /* seek(n): n adımı senkron koşar — ?step=N deterministik sıçraması.
     Kamera açısı da aynı sim zamanına oturur (tur açıksa). */
  const seek = n => {
    resetSim();
    const steps = Math.max(0, Math.min(MAX_STEPS, Math.floor(n)));
    for (let i = 0; i < steps; i++) { stepOptimizers(opt); commitTrails(); }
    if (opt.t >= MAX_STEPS) state.done = true;
    state.orbitTime = steps / STEPS_PER_SEC;
    for (const o of OPTIMIZERS) {
      const [x, y] = simPos(o.key);
      const p = worldOf(x, y);
      display[o.key] = { x: p[0], y: p[1], z: p[2] };
      balls[o.key].position.set(p[0], p[1], p[2]);
      trails[o.key].syncHead([p[0], trailY(x, y), p[2]], opt.t);
    }
    updateReadouts();
    applyOrbit();
    renderOnce();
  };

  /* ── kontrol bağlama ── */
  figure.querySelector('[data-action="play"]').addEventListener('click', () => setPlaying(!state.playing));
  figure.querySelector('[data-action="restart"]').addEventListener('click', restart);
  figure.querySelector('[data-action="trails"]').addEventListener('click', () => setTrails(!state.trails));
  figure.querySelector('[data-action="orbit"]').addEventListener('click', () => setOrbit(!state.orbit));
  for (const o of OPTIMIZERS) {
    chips[o.key].addEventListener('click', () => toggleOptimizer(o.key));
  }
  figure.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying(!state.playing); }
    if (event.key.toLowerCase() === 'r') restart();
    if (event.key.toLowerCase() === 'o') setOrbit(!state.orbit);
    if (event.key.toLowerCase() === 'y') setTrails(!state.trails);
  });

  /* ── ilk durum ── */
  resetSim();
  setPlaying(state.playing); // düğme etiketi gerçek durumla eşleşsin
  if (exportMode || reducedMotion) {
    /* Sözleşme: izler yakınsamaya kadar TAM çizili, kamera sabit, solma yok. */
    seek(MAX_STEPS);
    for (const o of OPTIMIZERS) trails[o.key].material.uniforms.uFade.value = 0;
  }
  applyOrbit();
  renderOnce();
  ensureLoop();

  return {
    figure,
    advance,            // dışarıdan deterministik sürüş (sim + tur)
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    restart,            // birebir aynı yolları yeniden oynatır
    toggle: toggleOptimizer,
    setTrails,
    setOrbit,
    seek,
    topView,
    renderNow: renderOnce, // gizli pencere/denetim senkron çizimi
    lossAt,
    get state() {
      return {
        step: opt.t, done: state.done, playing: state.playing, orbit: state.orbit,
        sgd: [opt.sgd.x, opt.sgd.y], momentum: [opt.momentum.x, opt.momentum.y], adam: [opt.adam.x, opt.adam.y],
        losses: {
          sgd: lossAt(opt.sgd.x, opt.sgd.y),
          momentum: lossAt(opt.momentum.x, opt.momentum.y),
          adam: lossAt(opt.adam.x, opt.adam.y),
        },
      };
    },
    setActive: value => {
      state.active = Boolean(value);
      ensureLoop();
    },
    dispose: () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      figure.remove();
    },
  };
}
