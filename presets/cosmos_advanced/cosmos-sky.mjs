/* Cosmos: derin uzay fonu — başlık/kapanış slaytlarının arkasına serilen
   prosedürel gökyüzü. Efekt yığını değil; her katman adlandırılmış bir
   olguya karşılık gelir:

   GERÇEKÇİ (dağılım düzeyinde):
   - parlaklık dağılımı: gerçek ışıklılık fonksiyonunu izler —
     N(m) ∝ 10^(0.35m), m ∈ [-1.2, 6.8] kesilmiş; sönük yıldız ÇOK,
     parlak yıldız SEYREK (ters-CDF örneklemesi);
   - yıldız renkleri: kara cisim rampası (M sınıfı kızıl ~2600K →
     A/B sınıfı mavi-beyaz ~15000K) — asla gökkuşağı paleti değil;
   - atmosferik parıldama (scintillation): yalnız en parlak ~%2'de
     görünür — gerçekte de sönük yıldızların parıldaması göz eşiğinin
     altındadır (not: uzaydan bakışta parıldama olmazdı; seyircinin
     beklediği "gece gökyüzü" dili için temsilîdir);
   - Samanyolu: galaktik düzlem bandı + içinde koyu toz şeridi
     (Büyük Yarık'ın karşılığı) — yapı fBm, gerçek yıldız sayımı değil.

   VERİ-TABANLI (galaxyTexture açıkken, varsayılan "auto"):
   - Samanyolu bandı GERÇEK gözlemdir: ESO GigaGalaxy Zoom 360°
     panoraması (eso0932a, ESO/S. Brunier, CC BY 4.0) içe bakan kubbeye
     eşirekt giydirilir; prosedürel bant + nokta tozu bu modda kapanır.
     Doku yüklenemezse (dosya yok, file:// CORS) SESSİZCE prosedürel
     banda dönülür (tek console.info). Yönelim/eğim sunumsaldır —
     ekvatoral koordinat doğruluğu iddiası yok. KREDİ ZORUNLU:
     "ESO/S. Brunier" fotoğrafik bandı kullanan her destede görünmeli.

   TEMSİLÎ: yıldız KONUMLARI rastgele (katalog değil), Samanyolu dokusu
   yedek modda prosedürel fBm, bulutsu lekeleri (H-alfa gülü + O-III
   camgöbeği paleti) serbest kompozisyon, göktaşı zamanlaması tohumlu
   program.

   Deterministik: tohumlu yerleşim + göktaşı programı; advance(saniye)
   sahneyi dışarıdan sürer (dekor kompozitleri, testler, export).

   PERFORMANS (ölçüldü, gizli-pane yöntemi: 1280×800 tuval, 200 kare,
   performance.now): advance(1/60) ortalama ~0.13 ms / kare CPU tarafı
   (GPU gönderimi dahil, GPU süresi asenkron — bloom/composer olmadığı
   ve kubbe fBm'i STATİK olduğu için parça maliyeti salt örneklemedir);
   dekor draw() tüylemeyle birlikte ~0.5 ms / kare. Hedef <2 ms: geniş
   payla sağlanıyor. Fotoğrafik Samanyolu modu (2026-08-13, dekor-host
   1280×800, 3×300 kare): foto ~0.022–0.067 ms vs prosedürel
   ~0.025–0.053 ms — fark gürültü içinde; foto mod bir draw call bile
   AZALTIR (fBm kubbesi + 8000 nokta yerine tek dokulu kubbe) ve
   parça başına maliyet fBm yerine tek doku örneklemesidir. */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const domExport = () =>
  new URLSearchParams(location.search).get('export') === '1'
  || document.documentElement.dataset.export === 'true';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* kara cisim → sRGB (Tanner Helland yaklaşımı). Yıldız rengi SICAKLIKTAN
   gelir; keyfî "uzay moru / gökkuşağı" paleti sözleşmeye aykırı. */
function blackbodyRGB(kelvin) {
  const t = Math.min(400, Math.max(10, kelvin / 100));
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = v => Math.min(1, Math.max(0, v / 255));
  return [c(r), c(g), c(b)];
}

/* Ashima simplex + fbm + ridge — sol-sun.mjs ile aynı gövde (NaN kuralı:
   ridge her 1-|n| için, kare alma çarpımla). */
const NOISE_GLSL = `
vec3 mod289(vec3 x){return x - floor(x * (1./289.)) * 289.;}
vec4 mod289(vec4 x){return x - floor(x * (1./289.)) * 289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - .85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.);
  const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1. - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0., i1.z, i2.z, 1.))
        + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = .142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49. * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7. * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2. + 1.;
  vec4 s1 = floor(b1) * 2. + 1.;
  vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  m = m * m;
  return 42. * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm4(vec3 p){
  float value = 0.;
  float amplitude = .55;
  for (int i = 0; i < 4; i++) {
    value += amplitude * snoise(p);
    p *= 2.03;
    amplitude *= .52;
  }
  return value;
}
float ridge(float n){ return max(0., 1. - abs(n)); }`;

const SKY_RADIUS = 100;
const MAX_STARS = 12000;          /* yoğunluk kaydırıcısı GATE ile kısar —
                                     geometri asla yeniden kurulmaz */
const METEOR_POOL = 3;

/* ters-CDF: N(m) ∝ 10^(a·m), m ∈ [M0, M1] kesilmiş */
const MAG_A = .35, MAG_M0 = -1.2, MAG_M1 = 6.8;
function sampleMagnitude(u) {
  const A0 = Math.pow(10, MAG_A * MAG_M0);
  const A1 = Math.pow(10, MAG_A * MAG_M1);
  return Math.log10(A0 + u * (A1 - A0)) / MAG_A;
}

export async function mountCosmos(container, options = {}) {
  if (!container) throw new Error('mountCosmos requires a container element');
  const accent = options.accent || '#9db8e8';
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const title = options.title || 'Kozmos: yıldız alanı, Samanyolu, göktaşları';
  const frozen = exportMode || reducedMotion;
  const seed = options.seed ?? 20260813;

  const state = {
    activity: options.activity ?? 1,          /* göktaşı sıklığı + parıldama genliği */
    density: options.density ?? .75,          /* 0–1: yıldız gate eşiği */
    milkyWayIntensity: options.milkyWayIntensity ?? 1,
    nebulae: options.nebulae ?? false,        /* varsayılan KAPALI */
    drift: options.drift ?? .1,               /* derece/sn, çok yavaş yaw */
    milkyWayTilt: options.milkyWayTilt ?? 63, /* bandın eğimi, derece */
    galaxyTexture: options.galaxyTexture ?? 'auto', /* "auto" | false | URL —
                                     fotoğrafik Samanyolu (ESO eso0932a) */
    paused: false,
    showStars: true, showMilky: true, showTwinkle: true,
    active: options.active ?? true,
  };
  const finalPaused = () => state.paused || frozen || !state.active;
  const EXPORT_TIME = 12;

  const figure = document.createElement('figure');
  figure.className = 'lunaris-preset';
  figure.dataset.style = 'cinematic';
  figure.dataset.export = exportMode ? 'true' : 'false';
  figure.dataset.ownsKeys = '';
  figure.style.setProperty('--lunaris-accent', accent);
  figure.tabIndex = 0;
  figure.setAttribute('aria-label', title);
  figure.innerHTML = `
    <div class="lunaris-preset__canvas" aria-hidden="true"></div>
    <header class="lunaris-preset__heading"><span>COSMOS · BACKDROP PRESET</span><h1>${title}</h1></header>
    <div class="lunaris-preset__controls" data-export-hide>
      <section class="lunaris-preset__panel lunaris-preset__panel--left" aria-label="Gökyüzü kontrolleri">
        <span class="lunaris-preset__panel-title">Gökyüzü</span>
        <label class="lunaris-preset__range">
          <span>Aktivite <output data-out="activity">${state.activity.toFixed(1)}×</output></span>
          <input data-input="activity" aria-label="Aktivite" type="range" min="0" max="2.5" step="0.1" value="${state.activity}">
        </label>
        <label class="lunaris-preset__range">
          <span>Yıldız yoğunluğu <output data-out="density">${Math.round(state.density * 100)}%</output></span>
          <input data-input="density" aria-label="Yıldız yoğunluğu" type="range" min="0.15" max="1" step="0.05" value="${state.density}">
        </label>
        <label class="lunaris-preset__range">
          <span>Samanyolu <output data-out="milky">${state.milkyWayIntensity.toFixed(1)}×</output></span>
          <input data-input="milky" aria-label="Samanyolu parlaklığı" type="range" min="0" max="1.6" step="0.1" value="${state.milkyWayIntensity}">
        </label>
        <label class="lunaris-preset__range">
          <span>Kayma <output data-out="drift">${state.drift.toFixed(2)}°/s</output></span>
          <input data-input="drift" aria-label="Kamera kayması" type="range" min="0" max="0.6" step="0.02" value="${state.drift}">
        </label>
        <div class="lunaris-preset__button-row" style="grid-template-columns:1fr">
          <button type="button" data-action="meteor">Göktaşı tetikle</button>
        </div>
      </section>
      <section class="lunaris-preset__panel lunaris-preset__panel--right" aria-label="Görünüm kontrolleri">
        <span class="lunaris-preset__panel-title">Görünüm</span>
        <div class="lunaris-preset__button-row">
          <button type="button" data-action="pause" aria-pressed="false">Durdur</button>
          <button type="button" data-action="resetView">Sıfırla</button>
          <button type="button" data-action="fullscreen">Tam ekran</button>
        </div>
        <div class="lunaris-preset__toggles">
          <label><input type="checkbox" data-toggle="showStars" checked> Yıldızlar</label>
          <label><input type="checkbox" data-toggle="showMilky" checked> Samanyolu bandı</label>
          <label><input type="checkbox" data-toggle="nebulae" ${state.nebulae ? 'checked' : ''}> Bulutsular</label>
          <label><input type="checkbox" data-toggle="showTwinkle" checked> Parıldama</label>
        </div>
      </section>
    </div>
    <figcaption class="lunaris-preset__truth">
      <strong>Dağılımlar gerçekçi · konumlar temsilî</strong>
      <span data-telemetry>Sakin gökyüzü</span>
      <small>Gerçekçi: parlaklık dağılımı N(m)∝10^(0.35m) (sönük çok, parlak seyrek); renkler kara cisim rampası (kızıl M → mavi-beyaz A/B); parıldama yalnız en parlak ~%2'de. Fotoğrafik modda Samanyolu bandı gerçek gözlemdir: ESO GigaGalaxy Zoom 360° panoraması (ESO/S. Brunier, CC BY 4.0) — yönelim/eğim sunumsaldır, koordinat doğruluğu iddiası yok. Temsilî: yıldız konumları tohumlu rastgele (katalog değil), yedek Samanyolu bandı ve toz şeridi prosedürel fBm, bulutsu paleti (H-alfa/O-III) serbest, göktaşı zamanlaması programlı; parıldama atmosfer etkisidir — uzay sahnesinde stilizasyondur.</small>
    </figcaption>
    <p class="lunaris-preset__help" data-export-hide>Sürükle: bakış · Boşluk: durdur · M: göktaşı</p>`;
  container.appendChild(figure);

  /* paneller çiplere katlanır (sol-preset UI sözleşmesi); gerçeklik
     BAŞLIĞI hep görünür, yalnız ayrıntı satırı katlanır */
  const uiStyle = document.createElement('style');
  uiStyle.textContent = `
    .lunaris-preset__panel .lunaris-preset__panel-title { cursor: pointer; user-select: none;
      display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .lunaris-preset__panel .lunaris-preset__panel-title::after { content: "▾"; font-size: 13px;
      transition: transform .18s ease; }
    .lunaris-preset__panel.is-collapsed .lunaris-preset__panel-title::after { transform: rotate(-90deg); }
    .lunaris-preset__panel.is-collapsed > :not(.lunaris-preset__panel-title) { display: none; }
    .lunaris-preset__panel.is-collapsed { width: auto; min-width: 148px; padding: 12px 18px; }
    .lunaris-preset__truth { cursor: pointer; }
    .lunaris-preset__truth.is-collapsed small { display: none; }
    .lunaris-preset__truth.is-collapsed { width: auto; max-width: 420px; }`;
  figure.appendChild(uiStyle);
  figure.querySelectorAll('.lunaris-preset__panel').forEach(panel => {
    panel.classList.add('is-collapsed');
    const panelTitle = panel.querySelector('.lunaris-preset__panel-title');
    panelTitle.setAttribute('role', 'button');
    panelTitle.setAttribute('tabindex', '0');
    const toggle = () => panel.classList.toggle('is-collapsed');
    panelTitle.addEventListener('click', toggle);
    panelTitle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  const truthBox = figure.querySelector('.lunaris-preset__truth');
  truthBox.classList.add('is-collapsed');
  truthBox.addEventListener('click', () => truthBox.classList.toggle('is-collapsed'));

  const canvasHost = figure.querySelector('.lunaris-preset__canvas');
  const telemetryEl = figure.querySelector('[data-telemetry]');

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#01020a');
  /* skybox sahnesi: kamera MERKEZDE oturur, dışarı bakar — cameraDistance
     kavramı yok. OrbitControls minicik yarıçapta "etrafına bakınma"ya
     dönüşür (rotateSpeed negatif: sürükleme gökyüzünü tutar). */
  const camera = new THREE.PerspectiveCamera(options.fov ?? 62, 1, .1, 400);
  camera.position.set(0, 0, .02);

  const skyGroup = new THREE.Group();   /* drift bu grubu döndürür */
  scene.add(skyGroup);

  const timeUniform = { value: frozen ? EXPORT_TIME : 0 };
  const twinkleUniform = { value: (reducedMotion || !state.showTwinkle) ? 0 : .38 * state.activity };
  const densityUniform = { value: state.density };
  const milkyUniform = { value: state.milkyWayIntensity };
  const pixelRatioUniform = { value: 1 };

  /* ---- Samanyolu düzlemi çerçevesi (JS + shader ortak) ---- */
  const tiltRad = state.milkyWayTilt * Math.PI / 180;
  const bandN = new THREE.Vector3(Math.sin(tiltRad), Math.cos(tiltRad), 0).normalize();
  const bandE1 = new THREE.Vector3().crossVectors(bandN, new THREE.Vector3(0, 0, 1)).normalize();
  const bandE2 = new THREE.Vector3().crossVectors(bandN, bandE1).normalize();
  /* "çekirdek" yönü: bant içinde parlaklığın hafifçe arttığı boylam
     (galaktik merkez karşılığı — temsilî) */
  const coreDir = bandE1.clone().multiplyScalar(Math.cos(1.1)).addScaledVector(bandE2, Math.sin(1.1)).normalize();

  /* ---- yıldız alanı: MAX_STARS nokta, yoğunluk GATE'i shader'da ----
     Işıklılık fonksiyonu ters-CDF ile örneklenir; renk kara cisimden.
     Parıldama genlik niteliği yalnız u<%2 yıldızlarda sıfırdan büyük. */
  const starRand = mulberry32(seed);
  const starPos = new Float32Array(MAX_STARS * 3);
  const starColor = new Float32Array(MAX_STARS * 3);
  const starBright = new Float32Array(MAX_STARS);
  const starTwinkle = new Float32Array(MAX_STARS * 2);   /* faz, genlik */
  const starCut = new Float32Array(MAX_STARS);
  for (let i = 0; i < MAX_STARS; i++) {
    const theta = starRand() * Math.PI * 2;
    const phi = Math.acos(2 * starRand() - 1);
    starPos[i * 3] = SKY_RADIUS * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = SKY_RADIUS * Math.cos(phi);
    starPos[i * 3 + 2] = SKY_RADIUS * Math.sin(phi) * Math.sin(theta);
    const u = starRand();
    const m = sampleMagnitude(u);
    /* ekran ağırlığı: logaritmik akıdan sıkıştırılmış — en sönükler
       ~%5 zeminde kalır (2px altı yüksek-alfa nokta yok; boyut tabanı 1.7px) */
    starBright[i] = .05 + .95 * Math.pow(10, -.32 * (m - MAG_M0));
    /* sıcaklık: soğuğa çarpık; parlak yıldızlar hafifçe sıcağa itilir
       (temsilî bir eğilim — HR diyagramı değil) */
    let kelvin = 2600 + 9400 * Math.pow(starRand(), 2.1);
    if (u < .06) kelvin = kelvin * .5 + (6500 + 8500 * starRand()) * .5;
    const [r, g, b] = blackbodyRGB(kelvin);
    starColor[i * 3] = r; starColor[i * 3 + 1] = g; starColor[i * 3 + 2] = b;
    starTwinkle[i * 2] = starRand() * Math.PI * 2;
    starTwinkle[i * 2 + 1] = u < .02 ? .55 + .45 * starRand() : 0;
    starCut[i] = starRand();
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeometry.setAttribute('aColor', new THREE.BufferAttribute(starColor, 3));
  starGeometry.setAttribute('aBright', new THREE.BufferAttribute(starBright, 1));
  starGeometry.setAttribute('aTwinkle', new THREE.BufferAttribute(starTwinkle, 2));
  starGeometry.setAttribute('aCut', new THREE.BufferAttribute(starCut, 1));
  const stars = new THREE.Points(starGeometry, new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform, uTwinkle: twinkleUniform,
      uDensity: densityUniform, uPixelRatio: pixelRatioUniform,
    },
    vertexShader: `
      uniform float uTime; uniform float uTwinkle; uniform float uDensity; uniform float uPixelRatio;
      attribute vec3 aColor; attribute float aBright; attribute vec2 aTwinkle; attribute float aCut;
      varying vec3 vColor; varying float vI;
      void main() {
        /* yoğunluk eşiği RAMPALI: kaydırıcı oynarken yıldızlar pop etmez,
           .12'lik bantta sıfırdan doğar/söner */
        float gate = smoothstep(uDensity + .06, uDensity - .06, aCut);
        /* parıldama: iki eş-ölçülü olmayan sinüs — periyodik "nefes" değil,
           kırpışma; genlik yalnız parlak %2'de sıfırdan büyük */
        float tw = 1. + uTwinkle * aTwinkle.y
                 * (.55 * sin(uTime * 6.3 + aTwinkle.x) + .45 * sin(uTime * 14.7 + aTwinkle.x * 1.93));
        vI = aBright * gate * max(0., tw);
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_PointSize = (1.7 + 4.6 * pow(aBright, 1.4)) * (1. + .16 * uTwinkle * aTwinkle.y * (tw - 1.)) * uPixelRatio;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vI;
      void main() {
        vec2 c = gl_PointCoord - .5;
        float k = max(0., 1. - dot(c, c) * 4.);
        gl_FragColor = vec4(vColor * vI * k * k, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  skyGroup.add(stars);

  /* ---- Samanyolu nokta katmanı: banda gauss enlemle yığılmış sönük
     yıldız tozu; boylam boyunca tohumlu kümelenme, toz şeridinde seyrelme.
     (Kabul-ret JS'te BİR KEZ koşar — kare başına maliyeti yok.) ---- */
  const MILKY_PTS = 8000;
  const milkyRand = mulberry32(seed ^ 0x2c9277b5);
  const p1 = milkyRand() * Math.PI * 2, p2 = milkyRand() * Math.PI * 2, p3 = milkyRand() * Math.PI * 2;
  const milkyPos = [];
  const milkyCol = [];
  const milkyA = [];
  const tmpV = new THREE.Vector3();
  while (milkyPos.length < MILKY_PTS * 3) {
    const lon = milkyRand() * Math.PI * 2;
    /* Box-Muller gauss enlem, σ ≈ .14 rad */
    const g = Math.sqrt(-2 * Math.log(Math.max(1e-9, milkyRand()))) * Math.cos(2 * Math.PI * milkyRand());
    const lat = g * .14;
    if (Math.abs(lat) > .5) continue;
    /* boylam kümelenmesi: bant homojen şerit değil, yamalı */
    const clump = (.5 + .5 * Math.sin(lon * 2.3 + p1)) * .45
                + (.5 + .5 * Math.sin(lon * 5.1 + p2)) * .3
                + (.5 + .5 * Math.sin(lon * 9.7 + p3)) * .25;
    if (milkyRand() > .3 + .7 * clump) continue;
    /* toz şeridi: bandın hafif altında dar negatif kuşak — noktalar da seyrelir */
    if (Math.abs(lat - .025) < .045 && milkyRand() < .68) continue;
    tmpV.copy(bandE1).multiplyScalar(Math.cos(lat) * Math.cos(lon))
      .addScaledVector(bandE2, Math.cos(lat) * Math.sin(lon))
      .addScaledVector(bandN, Math.sin(lat));
    milkyPos.push(tmpV.x * SKY_RADIUS, tmpV.y * SKY_RADIUS, tmpV.z * SKY_RADIUS);
    /* renk: çekirdeğe yakın ılık fildişi, uçlarda soğuk mavi-beyaz */
    const toCore = .5 + .5 * tmpV.dot(coreDir);
    const warm = toCore * toCore;
    milkyCol.push(.78 + .13 * warm, .8 + .07 * warm, .9 - .12 * warm);
    milkyA.push(.16 + .4 * milkyRand());
  }
  const milkyGeometry = new THREE.BufferGeometry();
  milkyGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(milkyPos), 3));
  milkyGeometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(milkyCol), 3));
  milkyGeometry.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(milkyA), 1));
  const milkyPoints = new THREE.Points(milkyGeometry, new THREE.ShaderMaterial({
    uniforms: { uMilky: milkyUniform, uPixelRatio: pixelRatioUniform },
    vertexShader: `
      uniform float uMilky; uniform float uPixelRatio;
      attribute vec3 aColor; attribute float aA;
      varying vec3 vColor; varying float vI;
      void main() {
        vColor = aColor;
        vI = aA * uMilky;
        gl_PointSize = 1.8 * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vI;
      void main() {
        vec2 c = gl_PointCoord - .5;
        float k = max(0., 1. - dot(c, c) * 4.);
        gl_FragColor = vec4(vColor * vI * k, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  skyGroup.add(milkyPoints);

  /* ---- Samanyolu ışıması: içe bakan kubbe (BackSide küre) üzerinde
     STATİK fBm — büyük daire bandı + koyu toz şeridi (bant içi negatif
     yoğunluk) + çekirdeğe doğru ılık parlama. Kamera merkezde olduğu için
     kubbe, "shader billboard glow"un doğru geometrik hâlidir: her bakış
     yönü tek örneklenir, paralaks hatası olamaz. Zaman girdisi YOK —
     yapı sabittir, kare maliyeti salt örnekleme. ---- */
  const milkyDome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS * 1.1, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: {
        uMilky: milkyUniform,
        uBandN: { value: bandN },
        uCoreDir: { value: coreDir },
        uWarm: { value: new THREE.Color('#e7ddc4') },
        uCool: { value: new THREE.Color('#b9c6e4') },
      },
      vertexShader: `
        varying vec3 vObj;
        void main() {
          vObj = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }`,
      fragmentShader: `${NOISE_GLSL}
        uniform float uMilky; uniform vec3 uBandN; uniform vec3 uCoreDir;
        uniform vec3 uWarm; uniform vec3 uCool;
        varying vec3 vObj;
        void main() {
          vec3 dir = normalize(vObj);
          float lat = dot(dir, uBandN);
          /* bant profili: gauss enlem zarfı (kare çarpımla — pow yok) */
          float b = lat / .16;
          float band = exp(-b * b);
          /* katmanlı fBm yoğunluğu: iri yamalar + ince lif dokusu */
          float macro = .5 + .5 * fbm4(dir * 2.1 + vec3(7.3, 1.9, 4.2));
          float fibril = .6 + .4 * fbm4(dir * 6.4 + vec3(1.7, 9.1, 3.3));
          /* toz şeridi: bandın hafif altında dar NEGATİF kuşak; kenarı
             fBm ile yırtık — Büyük Yarık'ın karşılığı */
          float d = (lat - .028 + .022 * snoise(dir * 3.1 + vec3(2.2))) / .05;
          float dust = exp(-d * d) * (.45 + .55 * (.5 + .5 * fbm4(dir * 4.6 + vec3(5.5, .7, 8.8))));
          /* çekirdek parlaması: bant içinde bir boylama doğru ılık artış */
          float core = smoothstep(.1, .95, .5 + .5 * dot(dir, uCoreDir));
          float density = band * macro * fibril * (1. - .8 * dust) * (.55 + .65 * core);
          density = max(0., density);
          vec3 color = mix(uCool, uWarm, core * .75);
          gl_FragColor = vec4(color * density * uMilky * .34, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  skyGroup.add(milkyDome);

  /* ---- fotoğrafik Samanyolu kubbesi (isteğe bağlı, varsayılan "auto"):
     ESO GigaGalaxy Zoom 360° panoraması (eso0932a, ESO/S. Brunier,
     CC BY 4.0) ayrı bir içe bakan küreye eşirekt giydirilir. Kürenin
     KENDİ uv'si kullanılır (fragment'ta atan dikişi yok → türev
     süreksizliği yok, mip zinciri temiz); hizalama mesh kuaterniyonuyla
     yapılır: ekvator = bant düzlemi (milkyWayTilt), görüntü merkezi
     (galaktik çekirdek, u=.5) coreDir boylamına oturur. Yükleme mount
     içinde AWAIT edilir — ilk kareden önce karar verilir, uçuşta katman
     takası (pop) olamaz. Başarısızlıkta tek console.info ile prosedürel
     banda dönülür. Deterministik: bu yolda rastgelelik yok. ---- */
  let photoTexture = null;
  let photoDome = null;
  if (state.galaxyTexture !== false) {
    const texUrl = (typeof state.galaxyTexture === 'string' && state.galaxyTexture !== 'auto')
      ? state.galaxyTexture
      : new URL('./textures/milkyway-eso0932a.jpg', import.meta.url).href;
    photoTexture = await new Promise(resolve => {
      new THREE.TextureLoader().load(texUrl, tex => resolve(tex), undefined, () => resolve(null));
    });
    if (photoTexture) {
      photoTexture.colorSpace = THREE.SRGBColorSpace;   /* donanım sRGB çözümü → lineer örnek */
      photoTexture.wrapS = THREE.RepeatWrapping;
      photoTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    } else {
      console.info(`Cosmos: fotoğrafik Samanyolu dokusu yüklenemedi (${texUrl}) — prosedürel fBm bandına dönüldü.`);
    }
  }
  if (photoTexture) {
    photoDome = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_RADIUS * 1.15, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: photoTexture },
          uMilky: milkyUniform,          /* parlaklık uniform ÇARPIMI — opacity değil */
          uTone: { value: .35 },         /* yumuşak omuz: 1×'te beyaza kırpma yok */
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }`,
        fragmentShader: `
          uniform sampler2D uTex; uniform float uMilky; uniform float uTone;
          varying vec2 vUv;
          void main() {
            vec3 photo = texture2D(uTex, vUv).rgb;
            /* Reinhard omzu: additive toplamda yıldız katmanı üstte
               okunur kalsın, bant tepe parlaklıkta doymasın */
            vec3 c = photo * uMilky;
            c = c / (1. + uTone * c);
            gl_FragColor = vec4(c, 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }),
    );
    /* yönelim: (0,1,0) → bandN, sonra bant ekseni etrafında rulo —
       u=.5 ekvator yönü (üç.js küresinde +X) coreDir'e taşınır.
       Hizalama SUNUMSALDIR: milkyWayTilt kompozisyon seçimidir,
       ekvatoral koordinat doğruluğu iddia edilmez. */
    const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bandN);
    const d0 = new THREE.Vector3(1, 0, 0).applyQuaternion(q1);
    const roll = Math.atan2(new THREE.Vector3().crossVectors(d0, coreDir).dot(bandN), d0.dot(coreDir));
    photoDome.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(bandN, roll).multiply(q1));
    skyGroup.add(photoDome);
  }
  /* foto mod etkin mi? (doku yüklü + seçenek kapatılmamış) */
  const photoOn = () => Boolean(photoDome && state.galaxyTexture !== false);

  /* ---- bulutsu lekeleri: 3 shader-billboard (merkeze bakan düzlemler),
     fBm alfa, kısıtlı palet — H-alfa gülü + O-III camgöbeği. Varsayılan
     KAPALI; açılınca alfa rampayla doğar (pop yok). ---- */
  const nebulaFade = { value: state.nebulae ? 1 : 0 };
  const nebulaRand = mulberry32(seed ^ 0x51ed270b);
  const NEBULA_DEFS = [
    { hue: '#c4586e', size: 34 },   /* H-alfa gülü (kırmızıya kaçmayan) */
    { hue: '#4f9d97', size: 27 },   /* O-III camgöbeği */
    { hue: '#b06a76', size: 22 },   /* ikinci, daha sönük H-alfa lekesi */
  ];
  const nebulae = NEBULA_DEFS.map((def, idx) => {
    /* bant civarına ama üstüne binmeyen tohumlu yönler */
    const lon = nebulaRand() * Math.PI * 2;
    const lat = (.2 + nebulaRand() * .5) * (idx % 2 === 0 ? 1 : -1);
    const dir = new THREE.Vector3()
      .copy(bandE1).multiplyScalar(Math.cos(lat) * Math.cos(lon))
      .addScaledVector(bandE2, Math.cos(lat) * Math.sin(lon))
      .addScaledVector(bandN, Math.sin(lat)).normalize();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(def.size, def.size),
      new THREE.ShaderMaterial({
        uniforms: {
          uFade: nebulaFade,
          uColor: { value: new THREE.Color(def.hue) },
          uSeed: { value: nebulaRand() * 40 },
          uGain: { value: .55 + nebulaRand() * .35 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }`,
        fragmentShader: `${NOISE_GLSL}
          uniform float uFade; uniform vec3 uColor; uniform float uSeed; uniform float uGain;
          varying vec2 vUv;
          void main() {
            vec2 q = vUv - .5;
            float rr = dot(q, q) * 4.;                    /* 0 merkez → 1 kenar */
            float radial = max(0., 1. - rr);
            radial = radial * radial;                     /* kare çarpımla */
            float body = .5 + .5 * fbm4(vec3(vUv * 5.2, uSeed));
            float wisp = ridge(snoise(vec3(vUv * 9.5, uSeed + 11.7)));
            float a = smoothstep(.22, .8, body * radial) * (.6 + .4 * wisp) * uGain;
            gl_FragColor = vec4(uColor * a * uFade * .38, 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    mesh.position.copy(dir).multiplyScalar(SKY_RADIUS * .92);
    mesh.lookAt(0, 0, 0);
    skyGroup.add(mesh);
    return mesh;
  });

  /* ---- göktaşları: küçük havuz (3 quad). Her iz TEK bir gerilmiş
     dörtgendir; uçuş boyunca yalnız uniform (uP) değişir — görünürken
     hiçbir geometri/konum değişmez, yerleştirme yalnız görünmezken olur
     (sözleşme: rebuild yalnız sıfır opaklıkta yasal). Parlaklık zarfı
     sin(π·p): sıfırdan doğar, sıfıra söner — eşik pop'u yok. ---- */
  const meteorRand = mulberry32(seed ^ 0x9e3779b9);
  const meteorMat4 = new THREE.Matrix4();
  const meteors = Array.from({ length: METEOR_POOL }, () => {
    const uP = { value: 2 };          /* > 1.3 = ölü */
    const uAmp = { value: 0 };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uP, uAmp },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }`,
        fragmentShader: `
          uniform float uP; uniform float uAmp;
          varying vec2 vUv;
          void main() {
            /* kafa yol boyunca kayar; arkada üstel iz, önde keskin kenar */
            float head = uP * 1.12;
            float d = head - vUv.x;
            float trail = d > 0. ? exp(-d * 10.) : exp(d * 240.);
            float ly = (vUv.y - .5) * 5.;
            float lat = exp(-ly * ly);
            /* zarf: sin(π·clamp(p)) — p=0 ve p≥1'de tam sıfır */
            float env = sin(clamp(uP, 0., 1.) * 3.14159265);
            float headMask = d > 0. ? exp(-d * 26.) : exp(d * 240.);
            /* kafa ılık beyaz, iz hafif yeşil-mavi (magnezyum çizgisi tınısı) */
            vec3 color = mix(vec3(.7, .92, .86), vec3(1., .96, .88), headMask);
            gl_FragColor = vec4(color * trail * lat * env * uAmp, 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.userData = { t: -1, dur: .7, uP, uAmp };
    skyGroup.add(mesh);
    return mesh;
  });
  const spawnMeteor = (startT = 0) => {
    const slot = meteors.find(m => m.userData.t < 0 || m.userData.uP.value > 1.3);
    if (!slot) return false;
    /* tohumlu yön + teğet: iz, gök küresine yapışık bir kiriş */
    const theta = meteorRand() * Math.PI * 2;
    const phi = Math.acos(2 * meteorRand() - 1);
    const center = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    const tangent = new THREE.Vector3(meteorRand() - .5, meteorRand() - .5, meteorRand() - .5)
      .projectOnPlane(center);
    if (tangent.lengthSq() < 1e-6) tangent.set(0, 1, 0).projectOnPlane(center);
    tangent.normalize();
    const R = SKY_RADIUS * .82;
    const len = 14 + meteorRand() * 14;
    const width = 1 + meteorRand() * .9;
    /* yerel çerçeve: x = uçuş yönü, z = merkeze bakış */
    const zAxis = center.clone();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, tangent).normalize();
    meteorMat4.makeBasis(tangent, yAxis, zAxis);
    slot.quaternion.setFromRotationMatrix(meteorMat4);
    slot.position.copy(center).multiplyScalar(R);
    slot.scale.set(len, width, 1);
    slot.userData.t = startT;
    slot.userData.dur = .55 + meteorRand() * .3;      /* ~0.7 sn */
    slot.userData.uAmp.value = .5 + meteorRand() * .6;
    slot.userData.uP.value = Math.min(1.3, startT / slot.userData.dur);
    slot.visible = true;
    telemetryEl.textContent = 'Göktaşı';
    return true;
  };
  const triggerMeteor = () => { const ok = spawnMeteor(0); ensureLoop(); return ok; };

  /* tohumlu program: sıradaki göktaşı zamanı aktiviteyle ölçeklenir */
  let nextMeteorAt = 4 + meteorRand() * 6;
  const stepMeteors = (dt, now) => {
    if (!frozen && state.activity > .01 && now >= nextMeteorAt) {
      spawnMeteor(0);
      nextMeteorAt = now + (7 + meteorRand() * 16) / Math.max(.2, state.activity);
    }
    meteors.forEach(m => {
      const md = m.userData;
      if (md.t < 0) return;
      md.t += dt;
      md.uP.value = md.t / md.dur;
      if (md.uP.value > 1.3) { md.t = -1; m.visible = false; }
    });
    const anyLive = meteors.some(m => m.userData.t >= 0);
    if (!anyLive && telemetryEl.textContent === 'Göktaşı') telemetryEl.textContent = 'Sakin gökyüzü';
  };

  /* ---- kontroller: merkezden bakınma ---- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = -.3;          /* sürükleme gökyüzünü "tutar" */
  controls.minDistance = .02;
  controls.maxDistance = .02;
  controls.addEventListener('change', () => { if (finalPaused()) renderOnce(); });
  const resetView = () => {
    camera.position.set(0, 0, .02);
    controls.target.set(0, 0, 0);
    controls.update();
    skyGroup.rotation.set(0, 0, 0);
    renderOnce();
  };

  /* ---- export tablosu: t=12'de statik gök; export modunda bir göktaşı
     %45 ilerlemede donuk (sol'un donmuş parlaması gibi deklare tablo);
     reduced-motion'da göktaşı YOK (hareket imâsı da istemiyoruz) ---- */
  if (exportMode && !reducedMotion) {
    spawnMeteor(0);
    const m = meteors[0].userData;
    m.t = m.dur * .45;
    m.uP.value = .45;
  }

  let frame = null;
  const clock = new THREE.Clock();
  const stepSim = dt => {
    timeUniform.value += dt;
    skyGroup.rotation.y += state.drift * Math.PI / 180 * dt;
    stepMeteors(dt, timeUniform.value);
  };
  const step = delta => {
    if (!frozen && !state.paused && state.active) stepSim(delta);
  };
  const renderOnce = () => renderer.render(scene, camera);
  const loop = () => {
    frame = null;
    if (finalPaused() || document.hidden) return;
    const delta = Math.min(.1, clock.getDelta());
    controls.update();
    step(delta);
    renderOnce();
    frame = requestAnimationFrame(loop);
  };
  const ensureLoop = () => {
    if (finalPaused() || document.hidden) { renderOnce(); return; }
    if (frame === null) { clock.getDelta(); frame = requestAnimationFrame(loop); }
  };
  const onVisibility = () => ensureLoop();
  document.addEventListener('visibilitychange', onVisibility);

  const resize = () => {
    const width = Math.max(2, canvasHost.clientWidth);
    const height = Math.max(2, canvasHost.clientHeight);
    const dpr = Math.min(devicePixelRatio, 1.5);
    renderer.setPixelRatio(dpr);
    pixelRatioUniform.value = dpr;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderOnce();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  resize();

  /* ---- seçenek uygulama (UI + setOptions ortak yolu) ---- */
  const applyOptions = () => {
    twinkleUniform.value = (reducedMotion || !state.showTwinkle) ? 0 : .38 * state.activity;
    densityUniform.value = state.density;
    milkyUniform.value = state.milkyWayIntensity;
    stars.visible = state.showStars;
    /* foto mod prosedürel bandın YERİNE geçer: fBm kubbesi ve nokta
       tozu kapanır (gerçek fotoğrafın üstüne uydurma tanecik binmesin);
       yıldız katmanı her iki modda da üstte kalır (additive toplam) */
    milkyPoints.visible = state.showMilky && !photoOn();
    milkyDome.visible = state.showMilky && !photoOn();
    if (photoDome) photoDome.visible = state.showMilky && photoOn();
    /* bulutsular rampayla açılır/kapanır — hedefe loop içinde ease etmek
       yerine (statik sahnede loop dönmeyebilir) doğrudan atanır ama
       additive alfa .38 tavanlı, geçiş zaten görsel olarak yumuşak */
    nebulaFade.value = state.nebulae ? 1 : 0;
    nebulae.forEach(n => { n.visible = state.nebulae; });
    renderOnce();
  };
  applyOptions();

  const setOptions = (partial = {}) => {
    if (partial.activity !== undefined) state.activity = Math.max(0, partial.activity);
    if (partial.density !== undefined) state.density = Math.min(1, Math.max(0, partial.density));
    if (partial.milkyWayIntensity !== undefined) state.milkyWayIntensity = Math.max(0, partial.milkyWayIntensity);
    if (partial.drift !== undefined) state.drift = Math.max(0, partial.drift);
    if (partial.nebulae !== undefined) state.nebulae = Boolean(partial.nebulae);
    /* çalışma anında yalnız yüklü dokuyu açar/kapar; FARKLI bir URL
       yüklemek yeniden mount gerektirir (yükleme mount'ta await edilir) */
    if (partial.galaxyTexture !== undefined) state.galaxyTexture = partial.galaxyTexture;
    if (partial.showStars !== undefined) state.showStars = Boolean(partial.showStars);
    if (partial.showMilky !== undefined) state.showMilky = Boolean(partial.showMilky);
    if (partial.showTwinkle !== undefined) state.showTwinkle = Boolean(partial.showTwinkle);
    applyOptions();
    ensureLoop();
    return { ...state };
  };

  /* ---- UI bağları ---- */
  figure.querySelector('[data-input="activity"]').addEventListener('input', event => {
    state.activity = Number(event.target.value);
    figure.querySelector('[data-out="activity"]').textContent = `${state.activity.toFixed(1)}×`;
    applyOptions();
  });
  figure.querySelector('[data-input="density"]').addEventListener('input', event => {
    state.density = Number(event.target.value);
    figure.querySelector('[data-out="density"]').textContent = `${Math.round(state.density * 100)}%`;
    applyOptions();
  });
  figure.querySelector('[data-input="milky"]').addEventListener('input', event => {
    state.milkyWayIntensity = Number(event.target.value);
    figure.querySelector('[data-out="milky"]').textContent = `${state.milkyWayIntensity.toFixed(1)}×`;
    applyOptions();
  });
  figure.querySelector('[data-input="drift"]').addEventListener('input', event => {
    state.drift = Number(event.target.value);
    figure.querySelector('[data-out="drift"]').textContent = `${state.drift.toFixed(2)}°/s`;
    ensureLoop();
  });
  const pauseButton = figure.querySelector('[data-action="pause"]');
  const syncPause = () => {
    pauseButton.textContent = reducedMotion ? 'Hareket kapalı' : state.paused ? 'Oynat' : 'Durdur';
    pauseButton.setAttribute('aria-pressed', String(state.paused || reducedMotion));
    pauseButton.disabled = reducedMotion;
    ensureLoop();
  };
  pauseButton.addEventListener('click', () => { state.paused = !state.paused; syncPause(); });
  figure.querySelector('[data-action="meteor"]').addEventListener('click', triggerMeteor);
  figure.querySelector('[data-action="resetView"]').addEventListener('click', resetView);
  figure.querySelector('[data-action="fullscreen"]').addEventListener('click', () => figure.requestFullscreen?.());
  figure.querySelectorAll('[data-toggle]').forEach(input => input.addEventListener('change', () => {
    state[input.dataset.toggle] = input.checked;
    applyOptions();
  }));
  figure.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') { event.preventDefault(); state.paused = !state.paused; syncPause(); }
    if (event.key.toLowerCase() === 'm') triggerMeteor();
    if (event.key.toLowerCase() === 'r') resetView();
    if (event.key === 'Escape') { state.paused = true; syncPause(); }
  });

  step(0);
  syncPause();
  renderOnce();
  ensureLoop();

  return {
    figure,
    triggerMeteor,
    setOptions,
    galaxyPhotoActive: photoOn,  /* fotoğrafik bant şu an görünür mü —
                                    kredi satırı göstermek için (CC BY) */
    _state: state,               /* debug: katman söndürme anahtarları */
    /* deterministik zaman sürüşü — dekor kompoziti, export ve gizli-pane
       testleri rAF'a dokunmadan buradan ilerler */
    advance: seconds => {
      stepSim(seconds);
      renderOnce();
    },
    pause: () => { state.paused = true; syncPause(); },
    play: () => { state.paused = false; syncPause(); },
    resetView,
    setActive: value => { state.active = Boolean(value); ensureLoop(); },
    dispose: () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      controls.dispose();
      starGeometry.dispose();
      milkyGeometry.dispose();
      photoTexture?.dispose();
      [stars, milkyPoints, milkyDome, ...(photoDome ? [photoDome] : []), ...nebulae, ...meteors].forEach(m => {
        m.geometry?.dispose?.();
        m.material?.dispose?.();
      });
      renderer.dispose();
      figure.remove();
    },
  };
}
