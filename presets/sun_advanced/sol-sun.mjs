/* Sol: an active Sun grounded in documented solar physics — not an effect
   pile. Every visual element maps to a real phenomenon; the caption keeps
   the real/illustrative split visible.

   REAL physics encoded (sources: standard solar physics references):
   - limb darkening: linear law I(μ) = I₀(1 − u(1 − μ)), u = 0.56 (visible);
   - sunspots: dark umbra (~3800 K) inside a lighter filamentary penumbra
     (~5500 K), grouped as BIPOLAR PAIRS confined to the ±8–32° activity
     belts (the butterfly-diagram latitudes), spread in longitude via
     best-candidate placement (uniform random clumps);
   - faculae: bright rings around active regions, more visible toward the
     limb — exactly where real faculae show;
   - coronal loops: plasma arcs tracing magnetic field lines between the
     opposite polarities of a spot pair;
   - flares: magnetic-energy releases AT active regions with the real
     impulsive profile — fast rise (~0.5 s here), slower exponential decay;
   - CMEs: occasional large plasma clouds expanding outward after major
     flares, launched radially from the erupting region;
   - corona: radial streamer structure concentrated toward the equatorial
     belt (solar-minimum configuration).

   ILLUSTRATIVE: all timing (sped up ~1000×), sizes, colors beyond rough
   temperature ordering, granulation texture scale, and streamer detail.

   Deterministic: seeded spot layout and event schedule; export freezes a
   declared tableau (flare at 0.8 on region 0, CME at 45% expansion). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { EffectComposer } from '../moon_advanced/vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../moon_advanced/vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../moon_advanced/vendor/postprocessing/UnrealBloomPass.js';

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

function buildStars(count, seed = 58601) {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 80 + random() * 70;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  /* stars fade as they approach the Sun on SCREEN — under this glare the
     eye (and a camera) would never see them right beside the disc */
  return new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms: { uCamPos: { value: new THREE.Vector3(0, 0, 5) } },
    vertexShader: `
      uniform vec3 uCamPos;
      varying float vFade;
      void main() {
        vec3 toStar = normalize(position - uCamPos);
        vec3 toSun = normalize(-uCamPos);
        float nearSun = smoothstep(.78, .92, dot(toStar, toSun));
        vFade = (1. - nearSun) * .55;   /* disk çevresi geniş bir kuşakta tamamen görünmez */
        gl_PointSize = 2.1;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      varying float vFade;
      void main() {
        vec2 c = gl_PointCoord - .5;
        gl_FragColor = vec4(vec3(.86, .89, 1.) * vFade * max(0., 1. - dot(c, c) * 4.), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
}

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
float fbm(vec3 p){
  float value = 0.;
  float amplitude = .55;
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p);
    p *= 2.03;
    amplitude *= .52;
  }
  return value;
}
/* ridge: 1-|n| SIFIRA KIRPILMIŞ. Ashima snoise nadiren ±1'i aşar; o an
   1-|n| negatifleşir ve pow(negatif, kesirli) = NaN. Tek bir NaN pikseli
   bloom mip zincirini komple zehirler: bloom 2-3 kareliğine tamamen söner
   ve bütün sahne "glitch" gibi kararıp geri gelir. */
float ridge(float n){ return max(0., 1. - abs(n)); }`;

const SHELL_VERTEX = `
varying vec3 vNormalView; varying vec3 vObj; varying vec3 vPosW;
void main() {
  vNormalView = normalize(normalMatrix * normal);
  vObj = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.);
  vPosW = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}`;

const MAX_SPOTS = 12;
const MAX_REGIONS = 6;   /* even count → 3 north + 3 south, mirrored belts */

/* Bipolar active regions inside the real ±8–32° activity belts.
   Regions live a CYCLE: they emerge, hold, decay, and are reborn at a new
   seeded longitude — the way real active regions grow over days and
   dissolve over weeks (time compressed here). */
function rollRegionGeometry(seed, hemisphere, avoidLongitudes = []) {
  const random = mulberry32(seed);
  /* Spörer: activity belts at ±8–32°. JOY'S LAW: the pair's axis is
     TILTED — the leading spot sits closer to the equator, the trailing
     spot poleward, and the tilt grows with latitude. Real spot groups
     line up this way; random jumble does not. */
  const latitude = hemisphere * (8 + random() * 20) * Math.PI / 180;
  /* Boylam: EN-İYİ-ADAY yerleşimi. Bağımsız tekdüze rastgelelik kümelenir
     (ölçüldü: 6 bölgenin hepsi 128°'lik yayda, ikisi 1° arayla) — 10 aday
     çekilir, diğer bölgelere dairesel olarak EN UZAK olanı seçilir. */
  let longitude = 0, bestScore = -1;
  for (let c = 0; c < 10; c++) {
    const cand = random() * Math.PI * 2;
    let minD = Math.PI * 2;
    for (const other of avoidLongitudes) {
      const dd = Math.abs(((cand - other + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (dd < minD) minD = dd;
    }
    if (minD > bestScore) { bestScore = minD; longitude = cand; }
  }
  const separation = (.09 + random() * .07);
  const size = .085 + random() * .075;
  const joyTilt = Math.tan(Math.abs(latitude) * .75) * (0.85 + random() * .3);
  const toDir = (lat, lon) => new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  const lead = toDir(latitude, longitude);
  const trail = toDir(latitude + hemisphere * separation * joyTilt, longitude + separation);
  return {
    center: lead.clone().add(trail).normalize(),
    spots: [
      /* spots RIDE the differential flow of their own latitude; on top of
         that only a small proper motion separates the pair (leading ahead) */
      { dir: lead.clone(), baseDir: lead, radius: size * (.8 + random() * .3), properMotion: .0032 + random() * .0015 },
      { dir: trail.clone(), baseDir: trail, radius: size * (.55 + random() * .3), properMotion: -.0014 - random() * .001 },
    ],
    loopSeeds: [random(), random(), random(), random(), random(), random()],
    weight: size,
  };
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const regionLongitude = region => Math.atan2(region.center.z, region.center.x);

function generateRegions(seed = 20260805) {
  const random = mulberry32(seed);
  const built = [];
  return Array.from({ length: MAX_REGIONS }, (_, i) => {
    const hemisphere = i % 2 === 0 ? 1 : -1;
    const region = rollRegionGeometry(seed + i * 7919, hemisphere, built.map(regionLongitude));
    built.push(region);
    region.hemisphere = hemisphere;
    region.baseSeed = seed + i * 7919;
    region.generation = 0;
    region.cycle = 42 + random() * 34;      // seconds per emerge→decay cycle
    region.phase = random() * region.cycle; // staggered lifetimes
    region.strength = 1;
    region.lastU = 0;
    return region;
  });
}

export async function mountSol(container, options = {}) {
  if (!container) throw new Error('mountSol requires a container element');
  const accent = options.accent || '#ffb347';
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const title = options.title || 'Güneş: aktif bölgeler, ilmekler, patlamalar';
  const frozen = exportMode || reducedMotion;

  const state = {
    activity: options.activity ?? 1.4,
    rotationSpeed: 1,
    paused: false,
    showSpots: true, showLoops: true, showCorona: true, showCME: true,
    showStars: true, showBloom: true,
    active: options.active ?? true,
  };
  const finalPaused = () => state.paused || frozen || !state.active;
  const EXPORT_TIME = 26.4;

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
    <header class="lunaris-preset__heading"><span>SOL · INTERACTIVE PRESET</span><h1>${title}</h1></header>
    <div class="lunaris-preset__controls" data-export-hide>
      <section class="lunaris-preset__panel lunaris-preset__panel--left" aria-label="Yüzey kontrolleri">
        <span class="lunaris-preset__panel-title">Aktivite</span>
        <label class="lunaris-preset__range">
          <span>Aktivite düzeyi <output data-out="activity">1.4×</output></span>
          <input data-input="activity" aria-label="Aktivite" type="range" min="0.3" max="2.5" step="0.1" value="${state.activity}">
        </label>
        <label class="lunaris-preset__range">
          <span>Dönüş hızı <output data-out="spin">1.0×</output></span>
          <input data-input="spin" aria-label="Dönüş hızı" type="range" min="0" max="3" step="0.1" value="1">
        </label>
        <div class="lunaris-preset__button-row" style="grid-template-columns:1fr">
          <button type="button" data-action="flare">Patlama tetikle</button>
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
          <label><input type="checkbox" data-toggle="showSpots" checked> Benekler</label>
          <label><input type="checkbox" data-toggle="showLoops" checked> Manyetik ilmekler</label>
          <label><input type="checkbox" data-toggle="showCorona" checked> Korona</label>
          <label><input type="checkbox" data-toggle="showCME" checked> CME</label>
          <label><input type="checkbox" data-toggle="showStars" checked> Yıldızlar</label>
          <label><input type="checkbox" data-toggle="showBloom" checked> Bloom</label>
        </div>
      </section>
    </div>
    <figcaption class="lunaris-preset__truth">
      <strong>Fizik gerçek · zamanlama temsilî</strong>
      <span data-telemetry>Sakin evre</span>
      <small>Gerçek: kenar kararması I(μ)=I₀(1−0.56(1−μ)); diferansiyel dönme (ekvator kutuplardan hızlı) ve kutup korona delikleri; umbra+penumbra yapılı benekler ±8–32° kuşakta doğup sönüyor; ilmekler benek çiftlerini bağlar; parlamalar hızlı yükselip yavaş söner; püskürmelerde yavaş plazma yüzeye geri yağar. Temsilî: tüm zamanlama (~1000× hızlı), ölçek ve doku ayrıntısı.</small>
    </figcaption>
    <p class="lunaris-preset__help" data-export-hide>Sürükle: kamera · Boşluk: durdur · F: patlama tetikle</p>`;
  container.appendChild(figure);

  /* panels collapse to chips so the Sun stays watchable; the truth
     HEADLINE stays visible always — only its detail line folds away */
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
    const title = panel.querySelector('.lunaris-preset__panel-title');
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    const toggle = () => panel.classList.toggle('is-collapsed');
    title.addEventListener('click', toggle);
    title.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
  const truthBox = figure.querySelector('.lunaris-preset__truth');
  truthBox.classList.add('is-collapsed');
  truthBox.addEventListener('click', () => truthBox.classList.toggle('is-collapsed'));

  const canvasHost = figure.querySelector('.lunaris-preset__canvas');
  const telemetryEl = figure.querySelector('[data-telemetry]');

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030308');
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 400);
  /* dekor/kompozit kullanımları kamerayı temiz bir seçenekle geri çeker
     (sentetik tekerlek olayları yerine) */
  const camDistance = Math.min(9, Math.max(1.9, options.cameraDistance ?? 3.6));
  camera.position.set(0, .15, camDistance);

  const stars = buildStars(reducedMotion ? 1400 : 3200);
  stars.visible = state.showStars && !exportMode;
  scene.add(stars);

  const sunGroup = new THREE.Group();
  scene.add(sunGroup);

  /* -- active regions + uniforms shared with the photosphere shader -- */
  const regions = generateRegions(options.seed ?? 20260805);
  const spotUniform = { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Vector4()) };
  const regionUniform = { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Vector4()) };
  /* kurdele (flare ribbon) durumu: x = nötr çizgiden yarı-ayrılma,
     z = çift ekseni boyunca yarı-uzunluk */
  const flareInfoUniform = { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Vector4()) };
  const spotCount = MAX_REGIONS * 2;
  const syncRegionUniforms = () => {
    regions.forEach((region, i) => {
      region.spots.forEach((spot, j) => {
        spotUniform.value[i * 2 + j].set(spot.dir.x, spot.dir.y, spot.dir.z, spot.radius * region.strength);
      });
      regionUniform.value[i].setX(region.center.x);
      regionUniform.value[i].setY(region.center.y);
      regionUniform.value[i].setZ(region.center.z);
    });
  };
  syncRegionUniforms();

  const timeUniform = { value: frozen ? EXPORT_TIME : 0 };
  const activityUniform = { value: state.activity };
  const spotsOnUniform = { value: 1 };

  /* -- photosphere: granulation + limb darkening + umbra/penumbra spots +
        faculae + flare brightening at the erupting region.
        DEPTH: the same flow field that colors the plasma DISPLACES the
        geometry — ridges swell outward, lanes sink, the limb silhouette
        undulates — and sunspots sit in real depressions (the Wilson
        depression). Fragment-side relief shading rides the same field. -- */
  const PHOTO_VERTEX = `${NOISE_GLSL}
    uniform float uTime; uniform float uActivity; uniform float uSpotsOn;
    uniform vec4 uSpots[${MAX_SPOTS}]; uniform int uSpotCount;
    varying vec3 vNormalView; varying vec3 vObj; varying vec3 vPosW; varying float vRelief;
    void main() {
      vObj = position;
      vec3 dir = normalize(position);
      /* relief RİJİT döner: diferansiyel burulma renk tarafında flow-map
         ile sınırlandı; yer değiştirmede birikirse aynı bantlaşma doğar */
      float dphi = -uTime * .028;
      float cphi = cos(dphi), sphi = sin(dphi);
      vec3 flowDir = vec3(cphi * dir.x + sphi * dir.z, dir.y, -sphi * dir.x + cphi * dir.z);
      float t = uTime * .07 * uActivity;
      /* low-frequency slice of the SAME churn field used for color */
      vec3 q = flowDir * 4.;
      float warp1 = fbm(q + vec3(t * .7, -t * .5, t * .34));
      float warp2 = fbm(q * 1.6 + vec3(-t * .44, t * .62, -t * .5) + warp1 * 1.8);
      float relief = .72 * warp1 + .28 * snoise(q * 1.6 + vec3(-t * .55, t * .4, t * .3) + vec3(warp2));
      /* Wilson depression: sunspots are real pits in the surface */
      if (uSpotsOn > .5) {
        for (int i = 0; i < ${MAX_SPOTS}; i++) {
          if (i >= uSpotCount) break;
          if (uSpots[i].w < .012) continue;   /* w=0 → smoothstep(0,0,·)=1 → TÜM küre çöker */
          float ang = acos(clamp(dot(dir, normalize(uSpots[i].xyz)), -1., 1.));
          /* eşik geçişinde POP yok: çukur eşiğin üstünde sıfırdan büyür */
          relief -= smoothstep(uSpots[i].w, uSpots[i].w * .3, ang) * 1.9 * smoothstep(.012, .05, uSpots[i].w);
        }
      }
      vRelief = relief;
      vec3 displaced = position + normal * relief * .006 * (.8 + .3 * uActivity);
      vNormalView = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(displaced, 1.);
      vPosW = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }`;
  const photosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 256, 176),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform, uActivity: activityUniform, uSpotsOn: spotsOnUniform,
        uSpots: spotUniform, uRegions: regionUniform, uFlareInfo: flareInfoUniform,
        uSpotCount: { value: spotCount },
        uCool: { value: new THREE.Color('#7c1a02') },
        uMid: { value: new THREE.Color('#cf4a0c') },
        uHot: { value: new THREE.Color('#ffb85c') },
        uLimbU: { value: .56 },
      },
      vertexShader: PHOTO_VERTEX,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform float uActivity; uniform float uLimbU; uniform float uSpotsOn;
        uniform vec4 uSpots[${MAX_SPOTS}]; uniform vec4 uRegions[${MAX_REGIONS}];
        uniform vec4 uFlareInfo[${MAX_REGIONS}]; uniform int uSpotCount;
        uniform vec3 uCool; uniform vec3 uMid; uniform vec3 uHot;
        varying vec3 vNormalView; varying vec3 vObj; varying vec3 vPosW; varying float vRelief;
        vec3 rotY(vec3 v, float a) {
          float c = cos(a), s = sin(a);
          return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
        }
        /* plazma alanı: kaynayan sarmal iplik/kıvrım yığını — flow-map iki
           kopyasını harmanladığı için ayrı fonksiyon */
        vec2 plasmaField(vec3 fd, float t, vec3 swirl, float lat2, float act) {
          vec3 q = fd * 4.;
          float warp1 = fbm(q + vec3(t * .7, -t * .5, t * .34));
          float warp2 = fbm(q * 1.6 + vec3(-t * .44, t * .62, -t * .5) + warp1 * 1.8);
          float warp3 = fbm(q * .9 + vec3(t * .28, t * .18, -t * .36) + warp2 * 1.3);
          vec3 p = q + 2.3 * vec3(warp1, warp2, warp3) + swirl * 1.4;
          float patchMask = smoothstep(.25, .75, .5 + .5 * snoise(fd * 1.25 + vec3(t * .12, -t * .09, t * .07)));
          float convection = fbm(p);
          float strandsA = pow(ridge(snoise(p * 2. + vec3(-t * .55, t * .4, t * .3))), 2.2);
          float strandsB = pow(ridge(snoise(p.zxy * 2.2 + vec3(t * .38, t * .5, -t * .44))), 2.2);
          float strands = max(strandsA * (.35 + .65 * patchMask), strandsB * (.35 + .65 * (1. - patchMask)));
          float fibrils = pow(ridge(snoise(p * 5.2 + vec3(t * .9, -t * 1.1, t * .7))), 2.6);
          float lanes = pow(ridge(snoise(fd * 2.1 + vec3(warp2 * 1.4, warp3 * .9, -t * .2))), 3.2);
          return vec2(.3 * convection + .42 * strands * (1. - .3 * lat2) * act + .06 * fibrils, lanes);
        }
        void main() {
          vec3 dir = normalize(vObj);
          float t = uTime * .07 * uActivity;

          /* DIFFERENTIAL ROTATION (real): the equatorial plasma laps the
             poles — omega(lat) ~ A - B sin^2(lat). The RIGID part rotates
             sample coords forever without harm; the DIFFERENTIAL part is
             applied through a FLOW MAP below, because unbounded shear
             combs the chaotic field into latitude-parallel streaks over
             minutes (the "pattern settles" artifact). */
          float lat2 = dir.y * dir.y;
          vec3 dirRigid = rotY(dir, -uTime * .028);

          /* magnetic combing: the flow field swirls around every active
             region, so fibrils wrap spots the way real ones do */
          vec3 swirl = vec3(0.);
          for (int i = 0; i < ${MAX_SPOTS}; i++) {
            if (i >= uSpotCount) break;
            if (uSpots[i].w < .012) continue;   /* w→0: smoothstep/bölme tanımsızlaşır — atla */
            vec3 spotDir = normalize(uSpots[i].xyz);
            float ang = acos(clamp(dot(dir, spotDir), -1., 1.));
            swirl += cross(spotDir, dir) * exp(-pow(ang / (uSpots[i].w * 2.6), 2.)) * 2.4
                   * smoothstep(.012, .05, uSpots[i].w);
          }

          /* FLOW MAP: the differential twist runs in TWO phases with a
             triangle crossfade. Each field's accumulated shear is bounded
             (±22 s worth) and resets while that field is fully faded out;
             the pattern velocity stays exactly omega(lat) throughout, and
             the slow A↔B morph reads as plasma reorganizing — the chaotic
             look no longer decays into combed streaks. */
          float diffRate = .028 * .8 * lat2;
          float fA = fract(uTime / 44.);
          float fB = fract(fA + .5);
          float wA = 1. - abs(2. * fA - 1.);
          vec2 fieldA = plasmaField(rotY(dirRigid, (fA - .5) * 44. * diffRate), t, swirl, lat2, uActivity);
          vec2 fieldB = plasmaField(rotY(dirRigid, (fB - .5) * 44. * diffRate), t, swirl, lat2, uActivity);
          vec2 field = mix(fieldB, fieldA, wA);
          float heat = clamp(.35 + field.x, 0., 1.5);
          heat *= 1. - field.y * .38;
          /* MACRO patches: slow, very-large convection/activity regions so
             the disc is not one uniform grain — some areas calm, some busy */
          float macro = fbm(dirRigid * 1.05 + vec3(t * .06, -t * .04, t * .05));
          heat *= .93 + .14 * macro;
          /* polar coronal holes (real): the poles run quieter and darker */
          heat *= 1. - .26 * pow(lat2, 1.6);
          vec3 color = heat < .5
            ? mix(uCool, uMid, heat / .5)
            : heat < 1.05
              ? mix(uMid, uHot, (heat - .5) / .55)
              : mix(uHot, vec3(1.24, 1.08, .82), clamp((heat - 1.05) / .45, 0., 1.));

          /* DEPTH shading, tied to the same field that displaces the mesh —
             kept GENTLE: strong per-pixel emboss shreds the plasma look */
          float hx = dFdx(heat), hy = dFdy(heat);
          float emboss = clamp(1. + hx * 1.1 - hy * .85, .86, 1.14);
          color *= emboss * (1. + vRelief * .07);

          float mu = clamp(dot(vNormalView, vec3(0., 0., 1.)), 0., 1.);

          /* sunspots: dark umbra, filamentary penumbra, facular ring
             brightening toward the limb (as real faculae do) */
          if (uSpotsOn > .5) {
            for (int i = 0; i < ${MAX_SPOTS}; i++) {
              if (i >= uSpotCount) break;
              if (uSpots[i].w < .012) continue; /* sıfır yarıçap = tanımsız smoothstep = tüm disk kararır */
              vec3 spotDir = normalize(uSpots[i].xyz);
              float radius = uSpots[i].w;
              /* genç/ölen benek POP etmez: eşiğin üstünde yumuşak doğar */
              float spotFade = smoothstep(.012, .05, radius);
              float ang = acos(clamp(dot(dir, spotDir), -1., 1.));
              /* LIVING penumbra: filaments radiate from the umbra and FLOW
                 outward (the real Evershed flow), the pattern slowly shears
                 around the spot, and the umbra edge breathes irregularly */
              vec3 radial = normalize(dir - spotDir * dot(dir, spotDir) + vec3(1e-5));
              float outflow = ang * 30. - uTime * .55;            /* radial drift */
              float striae = .6 + .4 * snoise(vec3(radial * 24.) + spotDir * 9.
                             + vec3(sin(outflow) * .35, cos(outflow) * .3, uTime * .07));
              /* the wobble pattern is anchored to the SPOT (relative
                 coords), so it travels with the drifting spot instead of
                 crawling through it */
              float wobble = 1. + .13 * snoise((dir - spotDir) * 16. + vec3(uTime * .18));
              float rEff = radius * wobble;
              float penumbra = smoothstep(rEff, rEff * .42, ang) * spotFade;
              float umbra = smoothstep(rEff * .48, rEff * .26, ang) * spotFade;
              color *= mix(1., .5 * striae, penumbra * (1. - umbra));
              color *= mix(1., .14, umbra);
              float facula = smoothstep(radius * 2., radius * 1.15, ang)
                           * (1. - smoothstep(radius * 1.2, radius * .95, ang));
              color *= 1. + facula * .5 * (1. - mu) * spotFade;
            }
          }

          /* flare: NOT a flat spotlight (that reads as a cheap effect).
             The real SDO signature: TWO RAGGED RIBBONS flanking the
             neutral line between the spot pair — they separate as the
             flare evolves — plus a MODEST warm heating that keeps the
             granulation texture visible underneath. */
          for (int i = 0; i < ${MAX_REGIONS}; i++) {
            float flare = uRegions[i].w;
            if (flare < .01) continue;
            vec3 mid = normalize(uRegions[i].xyz);
            float ang = acos(clamp(dot(dir, mid), -1., 1.));
            /* zayıf, dokulu bölge ısınması — parlaklık plazma desenine
               binmeli, onu silmemeli */
            float glowMask = smoothstep(.24, .05, ang) * clamp(flare, 0., 1.05);
            float texKeep = .5 + .5 * clamp(heat, 0., 1.);
            color = mix(color, vec3(1.05, .78, .48), glowMask * .2 * texKeep);
            color += vec3(.15, .10, .045) * glowMask * texKeep;
            /* kurdeleler: çiftin yerel teğet çerçevesinde, nötr çizginin
               iki yanında ince ve girintili iki şerit */
            vec3 A = normalize(uSpots[2 * i].xyz);
            vec3 B = normalize(uSpots[2 * i + 1].xyz);
            vec3 pairAxis = B - A;
            vec3 e1 = normalize(pairAxis - mid * dot(pairAxis, mid) + vec3(1e-6));
            vec3 e2 = normalize(cross(mid, e1));
            vec3 rel = dir - mid;
            float u = dot(rel, e1);
            float v = dot(rel, e2);
            float halfSep = uFlareInfo[i].x;
            float ext = uFlareInfo[i].z;
            float thick = .011 + .10 * halfSep;
            /* pow(negatif, 2.) GLSL'de tanımsız (NaN → bloom zehirlenir);
               kare elle alınır */
            float bandD = (abs(v) - halfSep) / thick;
            float band = exp(-bandD * bandD);
            float along = smoothstep(ext, ext * .3, abs(u));
            float rag = max(0., .45 + .55 * snoise(vec3(u * 70., v * 46. + float(i) * 7.3, uTime * .5)));
            float ribbon = band * along * rag * clamp(flare * 1.5, 0., 1.15);
            /* altın-beyaz doygun sıcaklık — asla saf beyaz değil */
            color = mix(color, vec3(1.3, 1.02, .68), clamp(ribbon, 0., 1.) * .8);
          }

          color *= (1. - uLimbU * (1. - mu));
          gl_FragColor = vec4(color * 1.05, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sunGroup.add(photosphere);

  /* -- chromosphere rim -- */
  const chromosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.024, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color('#ff3c14') } },
      vertexShader: SHELL_VERTEX,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform vec3 uColor;
        varying vec3 vNormalView; varying vec3 vObj; varying vec3 vPosW;
        void main() {
          vec3 dir = normalize(vObj);
          float ring = pow(clamp(.34 - dot(vNormalView, vec3(0., 0., 1.)), 0., 1.), 5.5);
          /* spicule fringe: fine plasma jets flickering along the limb,
             not a smooth ring; a slow sector field leaves parts of the
             limb soft and parts crisp so the edge never reads as a
             pasted-on outline */
          float jets = pow(ridge(snoise(dir * 30. + vec3(0., uTime * .5, uTime * .3))), 2.4);
          float sector = .55 + .45 * snoise(dir * 1.1 + vec3(uTime * .05, 3.1, 0.));
          float breath = .8 + .2 * snoise(dir * 6. + vec3(uTime * .3));
          gl_FragColor = vec4(uColor * ring * (.35 + 1.25 * jets) * breath * sector * 1.15, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  sunGroup.add(chromosphere);

  /* -- coronal loops: plasma arcs along field lines between spot pairs.
        The tube is PARAMETRIC: the vertex shader builds the arc from the
        two footpoint uniforms EVERY FRAME, so the loops are glued to the
        drifting spots. Geometry is NEVER rebuilt — no 4-second re-anchor
        snaps ("tik tak"), no allocation churn, no GC hitches. -- */
  const makeArcStrip = (alongSegments, radialSegments) => {
    const rows = alongSegments + 1, cols = radialSegments + 1;
    const count = rows * cols;
    const aT = new Float32Array(count);
    const aC = new Float32Array(count);
    let v = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++, v++) {
        aT[v] = i / alongSegments;
        aC[v] = j / radialSegments;
      }
    }
    const index = [];
    for (let i = 0; i < alongSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * cols + j, b = a + cols;
        index.push(a, a + 1, b, b, a + 1, b + 1);   /* dışa bakan yüzler */
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    geometry.setAttribute('aC', new THREE.BufferAttribute(aC, 1));
    geometry.setIndex(index);
    return geometry;
  };
  /* arc frame: W = the arc-plane normal is CONSTANT along the arc (all
     arc points live in span(A,B)), so the tube frame has zero twist and
     no degeneracy at the steep footpoints */
  const ARC_VERTEX_LIB = `
    uniform vec3 uA; uniform vec3 uB;
    attribute float aT; attribute float aC;
    varying vec2 vUv;
    vec3 arcDir(float t) { return normalize(mix(uA, uB, t)); }`;
  /* per-region footpoint uniforms, shared by the region's loops+filament */
  const regionArcA = regions.map(region => ({ value: region.spots[0].dir.clone() }));
  const regionArcB = regions.map(region => ({ value: region.spots[1].dir.clone() }));
  const loopStrip = makeArcStrip(48, 6);
  const loopMeshes = [];
  regions.forEach((region, regionIndex) => {
    region.loopSeeds.forEach((seedValue, k) => {
      const flareUniform = { value: 0 };
      const strengthUniform = { value: 1 };
      const mesh = new THREE.Mesh(
        loopStrip,
        new THREE.ShaderMaterial({
          uniforms: {
            uTime: timeUniform, uFlare: flareUniform, uStrength: strengthUniform,
            uA: regionArcA[regionIndex], uB: regionArcB[regionIndex],
            uHeight: { value: 0 }, uRadius: { value: 0 }, uJitter: { value: 0 }, uK: { value: k },
            uColor: { value: new THREE.Color('#d8551e') },
            uHot: { value: new THREE.Color('#ffb45e') },
            uPhase: { value: seedValue * 12 },
          },
          vertexShader: `${ARC_VERTEX_LIB}
            uniform float uHeight; uniform float uRadius; uniform float uJitter; uniform float uK;
            vec3 arcPoint(float t) {
              float jitter = sin(t * 3.14159265 * (2. + uK)) * uJitter;
              /* clamp ABOVE the photosphere displacement band (±.0073 +
                 tube radius): a tube segment inside the band gets covered
                 and uncovered COHERENTLY by the churning relief — the
                 bloom halo turns each flip into a whole-frame step */
              return arcDir(t) * max(1.016, 1.004 + sin(t * 3.14159265) * uHeight + jitter);
            }
            void main() {
              vUv = vec2(aT, aC);
              float t1 = min(aT, .995);
              vec3 T = normalize(arcPoint(t1 + .005) - arcPoint(t1));
              vec3 W = normalize(cross(uA, uB));
              vec3 N2 = normalize(cross(W, T));
              float ang = aC * 6.2831853;
              vec3 pos = arcPoint(aT) + (cos(ang) * N2 + sin(ang) * W) * uRadius;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
            }`,
          fragmentShader: `${NOISE_GLSL}
            uniform float uTime; uniform float uFlare; uniform float uPhase; uniform float uStrength;
            uniform vec3 uColor; uniform vec3 uHot;
            varying vec2 vUv;
            void main() {
              /* plasma flows along the loop: scrolling noise + bright
                 traveling pulses climbing the arc */
              float flow = .5 + .5 * snoise(vec3(vUv.x * 9. - uTime * 1.6 - uPhase, uPhase, uTime * .2));
              /* pulses kept slow, soft and WIDE — and the flare boost must
                 NOT multiply them: flare-amplified pulse dots are tiny
                 bright sources that ALIAS in the bloom mip pyramid, and
                 the giant halo they feed flashes the whole disc */
              float pulse = pow(.5 + .5 * sin(vUv.x * 22. - uTime * 3. - uPhase * 21.), 5.);
              float ends = smoothstep(0., .1, vUv.x) * smoothstep(1., .9, vUv.x);
              /* footpoint glow BROAD and gentle: pow-6 dots a few px wide
                 dominated the bloom input, and each time a drifting dot
                 crossed a coarse bloom-mip texel the halo of the WHOLE
                 frame stepped darker — the "glitch" staircase */
              float footpoints = 1. + .9 * (pow(1. - vUv.x, 2.5) + pow(vUv.x, 2.5));
              float bright = ((.28 + .34 * flow) * (1. + uFlare * 2.5) + .4 * pulse * (1. + uFlare * 1.1))
                           * ends * footpoints * uStrength;
              gl_FragColor = vec4(mix(uColor, uHot, clamp(uFlare * 1.6 + pulse * .6 + flow * .25, 0., 1.)) * bright, 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
          blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        }),
      );
      mesh.userData.regionIndex = regionIndex;
      mesh.userData.flareUniform = flareUniform;
      mesh.userData.strengthUniform = strengthUniform;
      mesh.userData.k = k;
      mesh.frustumCulled = false;   /* konum shader'da doğar; sınır küresi yok */
      loopMeshes.push(mesh);
      sunGroup.add(mesh);
    });
  });
  /* loop shape params live in uniforms; refresh them only at relocation
     (the region is invisible then — strength 0) */
  const syncLoopShapes = regionIndex => {
    const region = regions[regionIndex];
    const sep = region.spots[0].dir.angleTo(region.spots[1].dir);
    loopMeshes.forEach(mesh => {
      if (mesh.userData.regionIndex !== regionIndex) return;
      const seedValue = region.loopSeeds[mesh.userData.k];
      /* GERÇEKÇİ yükseklik dağılımı: apeks ayak açıklığıyla ölçeklenir ve
         alçağa çarpıktır — çoğu ilmek basık, yüksek kemer SEYREK. Eski
         formüldeki k·.05 merdiveni her bölgeye garanti "max boy" ilmek
         veriyordu; tekdüze yüksek siluetin nedeni oydu. */
      const height = sep * (.5 + 1.6 * Math.pow(seedValue, 2.2));
      mesh.material.uniforms.uHeight.value = height;
      /* kıvrım ilmeğin BOYUYLA orantılı: basık ilmekte dev dalga olmaz */
      mesh.material.uniforms.uJitter.value = Math.min(.008 * (mesh.userData.k + 1), height * .3);
      mesh.material.uniforms.uRadius.value = .0045 + seedValue * .004;
      mesh.material.uniforms.uPhase.value = seedValue * 12;
    });
  };
  regions.forEach((_, i) => syncLoopShapes(i));

  /* -- eruptive filaments: one giant arc per region that lifts off and
        detaches during major flares (the classic erupting-prominence
        sequence) -- */
  const filamentStrip = makeArcStrip(64, 7);
  const filaments = regions.map((region, regionIndex) => {
    const liftUniform = { value: 0 };
    const strengthUniform = { value: 1 };
    const mesh = new THREE.Mesh(
      filamentStrip,
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: timeUniform, uLift: liftUniform, uStrength: strengthUniform,
          uA: regionArcA[regionIndex], uB: regionArcB[regionIndex],
          uColor: { value: new THREE.Color('#b83410') },
          uHot: { value: new THREE.Color('#ffb45e') },
        },
        vertexShader: `${ARC_VERTEX_LIB}
          uniform float uLift;
          vec3 arcPoint(float t) { return arcDir(t) * max(1.016, 1.004 + sin(t * 3.14159265) * .34); }
          void main() {
            vUv = vec2(aT, aC);
            float t1 = min(aT, .995);
            vec3 T = normalize(arcPoint(t1 + .005) - arcPoint(t1));
            vec3 W = normalize(cross(uA, uB));
            vec3 N2 = normalize(cross(W, T));
            float ang = aC * 6.2831853;
            vec3 pos = arcPoint(aT) + (cos(ang) * N2 + sin(ang) * W) * .012;
            pos += normalize(pos) * uLift * uLift * 1.7 * sin(aT * 3.14159265);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
          }`,
        fragmentShader: `${NOISE_GLSL}
          uniform float uTime; uniform float uLift; uniform float uStrength;
          uniform vec3 uColor; uniform vec3 uHot;
          varying vec2 vUv;
          void main() {
            float strand = pow(ridge(snoise(vec3(vUv.x * 14. - uTime * .8, vUv.y * 3., uTime * .15))), 2.);
            /* translucent magnetic arch: deep-red rim, hot orange core,
               never white — the strand value IS the core mask */
            float rim = .5 + .5 * cos(vUv.y * 6.2831853);
            float ends = smoothstep(0., .07, vUv.x) * smoothstep(1., .93, vUv.x);
            float fade = smoothstep(1., .55, uLift);       /* detaches and dims */
            float bright = (.22 + .55 * strand) * (.45 + .55 * rim) * ends * fade
                         * smoothstep(0., .12, uLift) * 1.5 * uStrength;
            gl_FragColor = vec4(mix(uColor, uHot, clamp(strand * rim, 0., 1.) * .85) * bright, 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }),
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.userData.liftUniform = liftUniform;
    mesh.userData.strengthUniform = strengthUniform;
    mesh.userData.regionIndex = regionIndex;
    sunGroup.add(mesh);
    return mesh;
  });
  let activeEruption = null;   // { region, t0 }

  /* -- flare flash sprite at the erupting region -- */
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = flashCanvas.height = 128;
  const flashCtx = flashCanvas.getContext('2d');
  const flashGradient = flashCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  /* saf beyaz çekirdek = ucuz mercek parlaması görünümü; ışık işini artık
     kurdeleler + ilmek takımı yapıyor, sprite yalnız soluk sıcak bir sis */
  flashGradient.addColorStop(0, 'rgba(255,238,205,.9)');
  flashGradient.addColorStop(.3, 'rgba(255,212,145,.5)');
  flashGradient.addColorStop(1, 'rgba(255,170,80,0)');
  flashCtx.fillStyle = flashGradient;
  flashCtx.fillRect(0, 0, 128, 128);
  const flashTexture = new THREE.CanvasTexture(flashCanvas);
  flashTexture.colorSpace = THREE.SRGBColorSpace;
  /* one sprite pair PER REGION: two simultaneous flares each keep their
     own flash — a single shared sprite teleports between regions (pop) */
  const makeFlash = () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    sprite.visible = false;
    sunGroup.add(sprite);
    return sprite;
  };
  const flareSprites = regions.map(() => makeFlash());
  const flareHalos = regions.map(() => makeFlash());

  /* -- plasma splash: the eruption is PARTICLES, not a balloon. Blobs
        launch from the flare site in a cone; with G tuned so the escape
        speed at the surface is 1, the slower fraction arcs over and RAINS
        BACK onto the photosphere (failed eruption / coronal rain) while
        the fast fraction escapes as the ejecta -- */
  const MAX_PARTICLES = 240000;                 /* fluid film, flat-array math;
                                                   physics runs on alternating
                                                   halves each frame (dt×2) */
  const GRAV = .5;                              /* v_esc(r=1) = 1 */
  const particlePositions = new Float32Array(MAX_PARTICLES * 3);
  const particleFades = new Float32Array(MAX_PARTICLES);
  const particleVelocities = new Float32Array(MAX_PARTICLES * 3);
  const particleLives = new Float32Array(MAX_PARTICLES).fill(-1000);   /* < -900 = dead */
  const particleSpans = new Float32Array(MAX_PARTICLES);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('aFade', new THREE.BufferAttribute(particleFades, 1));
  const particles = new THREE.Points(particleGeometry, new THREE.ShaderMaterial({
    uniforms: {
      uHot: { value: new THREE.Color('#ffdba0') },
      uCool: { value: new THREE.Color('#c33808') },
    },
    vertexShader: `
      attribute float aFade;
      varying float vFade;
      void main() {
        vFade = aFade;
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        /* GAZ, kum değil: taze damla küçük ve parlak bir çekirdek; yaşlanan
           damla BÜYÜYÜP saydamlaşan yumuşak bir baloncuğa genişler
           (püsküren plazma gerçekte genişleyip soğuyarak dağılır). Komşu
           baloncuklar örtüşünce sprey sürekli bir filme kaynaşır —
           1 piksellik ayrık noktalar "partikül partikül" okunuyordu. */
        gl_PointSize = (3. + 10. * (1. - aFade)) / max(.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uHot; uniform vec3 uCool;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - .5) * 2.;
        float soft = pow(clamp(1. - d * d, 0., 1.), 2.4);
        vec3 color = mix(uCool, uHot, vFade);
        gl_FragColor = vec4(color * soft * vFade * .12, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  particles.frustumCulled = false;
  scene.add(particles);

  let splashCounter = 0;
  const tangentA = new THREE.Vector3();
  const tangentB = new THREE.Vector3();
  const jetDir = new THREE.Vector3();
  /* FLUID jets, not confetti: the eruption is 6–8 coherent streams; each
     stream launches its droplets along one direction with staggered
     delays, so overlapping glows read as a connected filament of liquid
     arcing up and folding back. */
  const spawnSplash = (centerDir, power) => {
    const rand = mulberry32(0xB10B ^ (splashCounter++));
    const normal = centerDir.clone().normalize();
    tangentA.set(0, 1, 0).cross(normal);
    if (tangentA.lengthSq() < 1e-4) tangentA.set(1, 0, 0).cross(normal);
    tangentA.normalize();
    tangentB.copy(normal).cross(tangentA);
    /* a FLUID, not pollen: many hundreds of tiny droplets per stream at
       LOW pressure — dense overlapping specks read as connected liquid */
    const jets = 8 + Math.floor(rand() * 3);
    let cursor = 0;
    for (let j = 0; j < jets; j++) {
      const azimuth = rand() * Math.PI * 2;
      const tilt = .12 + rand() * .55;
      jetDir
        .copy(normal).multiplyScalar(Math.cos(tilt))
        .addScaledVector(tangentA, Math.sin(tilt) * Math.cos(azimuth))
        .addScaledVector(tangentB, Math.sin(tilt) * Math.sin(azimuth));
      const jetSpeed = (.34 + rand() * .52) * (.72 + power * .28) * .6;  /* dengelenmiş güç */
      const jetSpan = 3 + rand() * 2.4;
      const drops = Math.floor(MAX_PARTICLES / jets * .92);
      const stagger = 2.6 / drops;              /* the whole stream pours in ~2.6 s */
      for (let k = 0; k < drops && cursor < MAX_PARTICLES; cursor++) {
        if (particleLives[cursor] > -900) continue;   /* only reuse dead slots */
        const i = cursor;
        const speed = jetSpeed * (.9 + rand() * .2);
        particleVelocities[i * 3] = (jetDir.x + tangentA.x * (rand() - .5) * .04 + tangentB.x * (rand() - .5) * .04) * speed;
        particleVelocities[i * 3 + 1] = (jetDir.y + tangentA.y * (rand() - .5) * .04 + tangentB.y * (rand() - .5) * .04) * speed;
        particleVelocities[i * 3 + 2] = (jetDir.z + tangentA.z * (rand() - .5) * .04 + tangentB.z * (rand() - .5) * .04) * speed;
        particlePositions[i * 3] = normal.x * 1.012;
        particlePositions[i * 3 + 1] = normal.y * 1.012;
        particlePositions[i * 3 + 2] = normal.z * 1.012;
        particleLives[i] = -(k * stagger + rand() * .004);
        particleSpans[i] = jetSpan;
        k++;
      }
    }
  };
  let particleParity = 0;
  let cmePulseTarget = 0;
  const stepParticles = dtIn => {
    /* corona surge: target decays, display eases toward it — no jump */
    cmePulseTarget *= Math.exp(-dtIn * .45);
    cmePulseUniform.value += (cmePulseTarget - cmePulseUniform.value) * (1 - Math.exp(-dtIn / .5));
    /* alternate halves: each particle integrates every other frame with
       double dt — same trajectories, half the CPU */
    /* NO STROBE: every particle moves EVERY frame with the real dt;
       only gravity + bounds run on alternating halves (double dt) —
       trajectories identical, cost halved, motion continuous */
    particleParity ^= 1;
    const dtG = dtIn * 2;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const life = particleLives[i];
      if (life < 0) {
        if (life > -900) {                              /* pending in a stream */
          const next = life + dtIn;
          particleLives[i] = next >= 0 ? 0 : next;
          if (particleLives[i] < 0) { particleFades[i] = 0; continue; }
        } else { particleFades[i] = 0; continue; }
      }
      const i3 = i * 3;
      if ((i & 1) === particleParity) {
        const px = particlePositions[i3], py = particlePositions[i3 + 1], pz = particlePositions[i3 + 2];
        const r2 = px * px + py * py + pz * pz;
        const r = Math.sqrt(r2) || .6;
        const pull = (GRAV / (r2 * r)) * dtG;           /* a = -G p / r^3 */
        particleVelocities[i3] -= px * pull;
        particleVelocities[i3 + 1] -= py * pull;
        particleVelocities[i3 + 2] -= pz * pull;
      }
      const nx = particlePositions[i3] += particleVelocities[i3] * dtIn;
      const ny = particlePositions[i3 + 1] += particleVelocities[i3 + 1] * dtIn;
      const nz = particlePositions[i3 + 2] += particleVelocities[i3 + 2] * dtIn;
      particleLives[i] += dtIn;
      if (particleLives[i] > particleSpans[i]) {
        particleLives[i] = -1000;
        particleFades[i] = 0;
        continue;
      }
      let fade = Math.max(0, 1 - particleLives[i] / particleSpans[i]);
      /* droplets never vanish abruptly: returning plasma FADES INTO the
         surface (an instant kill makes whole jet columns blink out in
         sync), and escaping mist dissolves before the outer bound */
      const nr2 = nx * nx + ny * ny + nz * nz;
      if (nr2 < 1.1025) {                               /* r < 1.05 */
        const falling = nx * particleVelocities[i3] + ny * particleVelocities[i3 + 1] + nz * particleVelocities[i3 + 2] < 0;
        if (falling) {
          const nr = Math.sqrt(nr2);
          fade *= Math.max(0, (nr - 1.002) / .048);
          if (nr < 1.004) { particleLives[i] = -1000; particleFades[i] = 0; continue; }
        }
      } else if (nr2 > 12.25) {                         /* r > 3.5 */
        const nr = Math.sqrt(nr2);
        fade *= Math.max(0, (4.3 - nr) / .8);
        if (nr > 4.3) { particleLives[i] = -1000; particleFades[i] = 0; continue; }
      }
      particleFades[i] = fade;
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.aFade.needsUpdate = true;
  };

  /* -- corona: inner glow + long radial streamers, equator-weighted like
        the real streamer belt -- */
  const coronaInner = new THREE.Mesh(
    new THREE.SphereGeometry(1.75, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform, uActivity: activityUniform, uColor: { value: new THREE.Color('#ffb36b') } },
      vertexShader: SHELL_VERTEX,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform float uActivity; uniform vec3 uColor;
        varying vec3 vNormalView; varying vec3 vObj; varying vec3 vPosW;
        void main() {
          /* THIN inner rim only — the crown quad carries the structure */
          float glow = pow(clamp(.38 - dot(vNormalView, vec3(0., 0., 1.)), 0., 1.5), 5.2);
          vec3 dir = normalize(vObj);
          float streamer = .6 + .4 * fbm(dir * 2.6 + vec3(uTime * .05, -uTime * .03, uTime * .04));
          float breath = .82 + .18 * sin(uTime * .29 + 1.3);
          gl_FragColor = vec4(uColor * glow * streamer * breath * (0.11 + .04 * uActivity), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  sunGroup.add(coronaInner);

  /* -- coronagraph layer: a camera-facing plane running a polar shader.
        Ridged angular noise makes petal streamers; features stretch
        RADIALLY and drift slowly outward (the solar-wind direction);
        streamers concentrate toward the projected equator (streamer belt)
        with faint polar plumes — the SOHO/LASCO composition -- */
  const axisWorldUniform = { value: new THREE.Vector3(0, 1, 0) };
  const cmeDirUniform = { value: new THREE.Vector3(1, 0, 0) };
  const cmePulseUniform = { value: 0 };
  const coronaQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform, uActivity: activityUniform,
        uAxisWorld: axisWorldUniform, uCmeDir: cmeDirUniform, uCmePulse: cmePulseUniform,
        uColor: { value: new THREE.Color('#ffbf78') },
      },
      vertexShader: `
        varying vec2 vXY; varying vec3 vWorldPos;
        void main() {
          vXY = position.xy;
          vWorldPos = (modelMatrix * vec4(position, 1.)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }`,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform float uActivity; uniform float uCmePulse;
        uniform vec3 uAxisWorld; uniform vec3 uCmeDir; uniform vec3 uColor;
        varying vec2 vXY; varying vec3 vWorldPos;
        void main() {
          float rr = length(vXY);
          if (rr < .93 || rr > 5.) { gl_FragColor = vec4(0.); return; }
          /* the pattern lives on the WORLD direction from the Sun's center,
             so orbiting the camera moves you AROUND a fixed corona instead
             of dragging the corona with the view */
          vec3 worldDir = normalize(vWorldPos);
          /* rays curve slightly as they leave (eclipse photos flare, they
             are not straight spokes) */
          vec3 bendDir = normalize(worldDir + vec3(
            snoise(worldDir * 1.1 + vec3(uTime * .006, 0., 0.)),
            snoise(worldDir * 1.1 + vec3(7.3, uTime * .005, 0.)),
            snoise(worldDir * 1.1 + vec3(0., 13.7, uTime * .007))) * rr * .045);
          float breath = .8 + .2 * sin(uTime * .33) + .14 * snoise(vec3(uTime * .11, 3.7, 0.));
          float reach = .92 + .16 * sin(uTime * .21 + 2.1);
          float latFactor = abs(dot(worldDir, normalize(uAxisWorld)));

          /* MAIN CORONA: a few BROAD petal streamers, eclipse-style.
             The same lobe field sets both brightness and LENGTH: bright
             petals stretch far, the gaps between them die early. */
          /* hemispheric asymmetry: a 2–3-lobe activity field makes one
             side of the corona quiet and another busy — no even halo */
          float sector = .5 + .5 * snoise(bendDir * .75 + vec3(uTime * .004, 2.7, -uTime * .003));
          float activityMask = .45 + .75 * sector;
          float lobe = fbm(bendDir * 1.5 + vec3(uTime * .012, -uTime * .009, uTime * .01));
          float petal = pow(clamp(.46 + .64 * lobe, 0., 1.), 2.1) * activityMask;
          float innerRayDetail = ridge(snoise(bendDir * 4.2 + vec3(uTime * .02, uTime * .016, -uTime * .014)));
          float streamerLength = (1.35 + petal * 3.1) * reach * (.8 + .4 * sector);
          float radialProfile = smoothstep(streamerLength, streamerLength * .3, rr);
          float belt = .22 + .78 * pow(1. - latFactor, 1.6);
          float mainCorona = petal * (.5 + .5 * innerRayDetail) * radialProfile * belt;

          /* POLAR PLUMES: fine, short, comb-like brushes along open field */
          float plume = pow(ridge(snoise(bendDir * 7.5 + vec3(0., uTime * .01, 0.))), 3.2)
                      * pow(latFactor, 1.6) * smoothstep(2., 1.04, rr) * .55;

          /* CME: a sector of the corona surges around the launch direction */
          float cmeAngle = acos(clamp(dot(worldDir, normalize(uCmeDir)), -1., 1.));
          float surge = exp(-pow(cmeAngle / .42, 2.)) * uCmePulse;

          /* reveal starts INSIDE the limb so the glow meets the disc edge —
             a dark moat between disc and corona kills the realism */
          float reveal = smoothstep(.975, 1.04, rr);
          float falloff = pow(rr, -1.1);
          /* soft SPHERICAL base glow under the crown: thin, structureless,
             hugging the disc and gone by ~2R — the crown rays rise out of
             it instead of floating on black */
          float baseGlow = pow(rr, -3.3) * reveal * (.9 + .1 * snoise(worldDir * 2.2 + vec3(uTime * .02)));
          float bright = (baseGlow * .5 + (mainCorona + plume) * falloff) * (1. + surge * 1.9) * reveal
                       * (0.55 + .26 * uActivity) * breath;
          gl_FragColor = vec4(uColor * bright, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
    }),
  );
  coronaQuad.renderOrder = -1;
  scene.add(coronaQuad);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  /* the high-pass knee is SOFT: the stock smoothWidth (.01) is a hard
     luminance gate — during flares a large disc area hovers AT the
     threshold and the churning plasma pushes pixel blobs across it
     coherently, so the blurred bloom mips flash the whole disc (this WAS
     the "simultaneous glitch blink"). A wide knee makes every pixel's
     bloom contribution ramp continuously — the gate cannot pop. */
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), .3, .55, .4);
  bloomPass.highPassUniforms.smoothWidth.value = .5;
  composer.addPass(bloomPass);
  const useBloom = () => state.showBloom;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1.9;
  controls.maxDistance = 9;
  controls.addEventListener('change', () => { if (finalPaused()) renderOnce(); });
  const resetView = () => {
    camera.position.set(0, .15, camDistance);
    controls.target.set(0, 0, 0);
    controls.update();
    renderOnce();
  };

  /* -- flare/CME scheduler: seeded, deterministic order; the real profile
        is fast rise then slow exponential decay; big flares launch CMEs -- */
  const eventRandom = mulberry32((options.seed ?? 20260805) ^ 0x5f3759df);
  const schedule = Array.from({ length: 64 }, () => ({
    region: Math.floor(eventRandom() * regions.length),
    gap: 4.5 + eventRandom() * 8,
    power: .55 + eventRandom() * .95,
  }));
  let scheduleIndex = 0;
  let nextEventAt = 3;
  /* CONTINUOUS flare energy per region: new flares ADD energy, energy
     decays exponentially, and the displayed value follows with a short
     attack — no object swapping, so no pops, no glitch blinking, and two
     regions can glow at once. Display is CAPPED so stacked events cannot
     blow out the frame. */
  const flareEnergy = new Float32Array(MAX_REGIONS);
  const flareDisplay = new Float32Array(MAX_REGIONS);
  /* what actually reaches the screen: display × region-life gate, so a
     dying region's glow fades WITH the region and the rebirth reset
     never zeroes anything still visible */
  const flareShown = new Float32Array(MAX_REGIONS);
  let flareClock = null;

  const startFlare = (regionIndex, power, now) => {
    flareEnergy[regionIndex] = Math.min(1.6, flareEnergy[regionIndex] + power);
    telemetryEl.textContent = `Parlama · bölge ${regionIndex + 1} · şiddet ${power.toFixed(2)}`;
    if (power > 1.05) {
      /* never steal a filament mid-flight — an instant handover pops.
         And never LAUNCH one on a region that dies before the eruption
         ends: the filament would be cut down mid-air at the rebirth */
      const region = regions[regionIndex];
      const remaining = (1 - ((now + region.phase) % region.cycle) / region.cycle) * region.cycle;
      if (!activeEruption && (frozen || remaining > 7)) {
        activeEruption = { region: regionIndex, t0: now + .2, duration: 5.5 };
      }
      if (state.showCME) {
        spawnSplash(regions[regionIndex].center, power);
        cmeDirUniform.value.copy(regions[regionIndex].center).normalize();
        cmePulseTarget = Math.min(1.3, cmePulseTarget + power * .7);   /* yumuşak atak stepParticles'ta */
        telemetryEl.textContent += ' · filament koptu · CME fırlatıldı';
      }
    }
    options.onFlare?.({ region: regionIndex, power });
  };
  const triggerFlare = () => {
    const score = r => r.weight * Math.max(.05, r.strength);
    const best = regions.reduce((max, r, i) => score(r) > score(regions[max]) ? i : max, 0);
    startFlare(best, 1.3, timeUniform.value);
    ensureLoop();
  };

  /* Region lifecycle: emerge (18% of cycle), hold, decay (28%), then be
     reborn at a new seeded longitude with fresh loops and filament.
     The rebirth swaps uniforms while the region is at strength 0 —
     nothing visible ever changes discontinuously. */
  const relocateRegion = regionIndex => {
    const region = regions[regionIndex];
    region.generation++;
    /* yeni doğuş, diğer bölgelerin O ANKİ konumlarından uzağa düşer */
    const avoid = regions.filter((_, j) => j !== regionIndex).map(regionLongitude);
    const fresh = rollRegionGeometry(region.baseSeed + region.generation * 104729, region.hemisphere, avoid);
    region.center = fresh.center;
    region.spots = fresh.spots;
    region.loopSeeds = fresh.loopSeeds;
    region.weight = fresh.weight;
    region.bornAt = timeUniform.value;
    syncLoopShapes(regionIndex);
    flareEnergy[regionIndex] = 0;
    flareDisplay[regionIndex] = 0;
    if (activeEruption && activeEruption.region === regionIndex) activeEruption = null;
  };
  const updateRegionLifecycles = now => {
    regions.forEach((region, i) => {
      const u = ((now + region.phase) % region.cycle) / region.cycle;
      if (u < region.lastU - .5) relocateRegion(i);   // wrapped → reborn elsewhere
      region.lastU = u;
      const emerge = Math.min(1, u / .18);
      const decay = 1 - Math.max(0, (u - .72) / .28);
      region.strength = Math.max(0, Math.min(emerge, decay));
      /* spots are EMBEDDED in the plasma: each rides the differential
         flow of its own latitude (the same omega(lat) the shader uses for
         the surface pattern), plus a tiny proper motion for the pair */
      region.spots.forEach(spot => {
        const sinLat = spot.baseDir.y;
        const flowRate = .028 * (1 - .8 * sinLat * sinLat);
        spot.dir.copy(spot.baseDir).applyAxisAngle(Y_AXIS, (now - (region.bornAt || 0)) * (flowRate + spot.properMotion));
      });
      region.center.copy(region.spots[0].dir).add(region.spots[1].dir).normalize();
      /* loop+filament footpoints are GLUED to the spots every frame via
         these uniforms — the arcs stretch continuously as the pair
         separates; there is no geometry to rebuild, so no tick is possible */
      regionArcA[i].value.copy(region.spots[0].dir);
      regionArcB[i].value.copy(region.spots[1].dir);
    });
    syncRegionUniforms();
    loopMeshes.forEach(mesh => {
      mesh.userData.strengthUniform.value = regions[mesh.userData.regionIndex].strength;
    });
  };

  const updateActivityState = now => {
    updateRegionLifecycles(now);
    if (!frozen && now >= nextEventAt) {
      const event = schedule[scheduleIndex % schedule.length];
      scheduleIndex++;
      /* flares only happen on LIVING regions — walk to the next one that
         has emerged and not yet decayed */
      let regionIndex = event.region;
      for (let tries = 0; tries < MAX_REGIONS && regions[regionIndex].strength < .35; tries++) {
        regionIndex = (regionIndex + 1) % MAX_REGIONS;
      }
      if (regions[regionIndex].strength >= .35) {
        startFlare(regionIndex, event.power * (0.7 + .5 * state.activity), now);
      }
      nextEventAt = now + event.gap / Math.max(.3, state.activity);
    }
    /* energy decay + smooth attack toward the capped display value —
       continuous by construction, so no pops or glitch blinking */
    if (flareClock === null) flareClock = now;
    const flareDt = Math.max(0, now - flareClock);
    flareClock = now;
    let maxIdx = 0;
    for (let i = 0; i < MAX_REGIONS; i++) {
      flareEnergy[i] *= Math.exp(-flareDt / 2.4);
      const target = Math.min(1.05, flareEnergy[i]);
      flareDisplay[i] += (target - flareDisplay[i]) * (1 - Math.exp(-flareDt / .32));
      flareShown[i] = flareDisplay[i] * (frozen ? 1 : Math.min(1, regions[i].strength * 4));
      regionUniform.value[i].w = flareShown[i];
      if (flareShown[i] > flareShown[maxIdx]) maxIdx = i;
      /* kurdele evrimi: parlama sürdükçe şeritler nötr çizgiden ayrılır
         (gerçek kurdele hareketi); yaş yalnız parlaklık sıfırken sıfırlanır
         — görünür hiçbir şey asla zıplamaz */
      const region = regions[i];
      if (flareDisplay[i] > .015) region.flareAge = (region.flareAge || 0) + flareDt;
      else region.flareAge = 0;
      const ribbonSep = .012 + .032 * (1 - Math.exp(-(region.flareAge || 0) / 2.4));
      flareInfoUniform.value[i].set(ribbonSep, 0, region.spots[0].dir.angleTo(region.spots[1].dir) * .62, 0);
    }
    /* ARCADE CASCADE: gerçek patlamada ilmekler aynı anda değil sırayla
       parlar; alçak ilmekler önce yanar, yüksekler geç parlayıp geç söner
       (post-flare arcade). Her ilmek hedefe kendi zaman sabitiyle gider. */
    loopMeshes.forEach(mesh => {
      const target = flareShown[mesh.userData.regionIndex];
      if (frozen) { mesh.userData.flareUniform.value = target; return; }
      const tau = .3 + mesh.userData.k * .5;
      const current = mesh.userData.flareUniform.value;
      mesh.userData.flareUniform.value = current + (target - current) * (1 - Math.exp(-flareDt / tau));
    });
    const peak = flareShown[maxIdx];
    /* the flash lives ON the surface (shader glow does the work);
       sprites stay small and dim so the disc never washes to glass */
    for (let i = 0; i < MAX_REGIONS; i++) {
      const value = flareShown[i];
      const sprite = flareSprites[i], halo = flareHalos[i];
      if (value > .02) {
        /* opacity ramps FROM ZERO at the threshold — a hard visibility
           toggle at finite opacity reads as a blink */
        sprite.position.copy(regions[i].center).multiplyScalar(1.02);
        sprite.scale.setScalar(.08 + value * .15);
        sprite.material.opacity = Math.min(.16, (value - .02) * .14);
        sprite.visible = true;
        halo.position.copy(sprite.position);
        halo.scale.setScalar(.26 + value * .48);
        halo.material.opacity = Math.min(.055, (value - .02) * .05);
        halo.visible = true;
      } else { sprite.visible = false; halo.visible = false; }
    }
    if (peak < .03 && telemetryEl.textContent.startsWith('Parlama') && !frozen) {
      telemetryEl.textContent = 'Sakin evre — sonraki patlama planlandı';
    }
    /* erupting filament: rises, detaches, dims */
    filaments.forEach(mesh => {
      if (activeEruption && mesh.userData.regionIndex === activeEruption.region
          && state.showLoops && state.showFilament !== false) {
        const t = (now - activeEruption.t0) / activeEruption.duration;
        if (t >= 0 && t <= 1) {
          mesh.visible = true;
          mesh.userData.liftUniform.value = t;
          /* ölmekte olan bölgenin filamenti bölgeyle birlikte söner —
             yer değiştirme anında havada parlak filament kalmaz */
          mesh.userData.strengthUniform.value = frozen
            ? 1 : Math.min(1, regions[mesh.userData.regionIndex].strength * 4);
        } else if (t > 1) { activeEruption = null; mesh.visible = false; }
      } else mesh.visible = false;
    });
    particles.visible = state.showCME;
  };

  /* deterministic export tableau: flare mid-decay, filament mid-lift,
     splash particles mid-flight, corona sector surging */
  if (frozen) {
    flareClock = EXPORT_TIME;
    flareEnergy[0] = .9;
    flareDisplay[0] = .9;
    regions[0].flareAge = 2.2;   /* tabloda kurdeleler ayrılmış görünsün */
    activeEruption = { region: 0, t0: EXPORT_TIME - 2.5, duration: 5.5 };
    spawnSplash(regions[0].center, 1.2);
    cmeDirUniform.value.copy(regions[0].center).normalize();
    cmePulseUniform.value = .9;
    cmePulseTarget = .9;
    for (let i = 0; i < 14; i++) stepParticles(.1);
    updateActivityState(EXPORT_TIME);
  }

  let frame = null;
  const clock = new THREE.Clock();
  const orientCorona = () => {
    coronaQuad.quaternion.copy(camera.quaternion);
    axisWorldUniform.value.set(0, 1, 0).applyQuaternion(sunGroup.quaternion);
    stars.material.uniforms.uCamPos.value.copy(camera.position);
  };
  const step = delta => {
    if (!frozen && !state.paused && state.active) {
      timeUniform.value += delta * state.rotationSpeed;
      sunGroup.rotation.y += delta * .015 * state.rotationSpeed;
      if (stars.visible) stars.rotation.y += delta * .002;
      updateActivityState(timeUniform.value);
      stepParticles(delta * state.rotationSpeed);
    }
    orientCorona();
  };
  const renderOnce = () => { if (useBloom()) composer.render(); else renderer.render(scene, camera); };
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
    if (finalPaused() || document.hidden) { step(0); renderOnce(); return; }
    if (frame === null) { clock.getDelta(); frame = requestAnimationFrame(loop); }
  };
  const onVisibility = () => ensureLoop();
  document.addEventListener('visibilitychange', onVisibility);

  const resize = () => {
    const width = Math.max(2, canvasHost.clientWidth);
    const height = Math.max(2, canvasHost.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderOnce();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  resize();

  /* -- controls -- */
  figure.querySelector('[data-input="activity"]').addEventListener('input', event => {
    state.activity = Number(event.target.value);
    activityUniform.value = state.activity;
    figure.querySelector('[data-out="activity"]').textContent = `${state.activity.toFixed(1)}×`;
    renderOnce();
  });
  figure.querySelector('[data-input="spin"]').addEventListener('input', event => {
    state.rotationSpeed = Number(event.target.value);
    figure.querySelector('[data-out="spin"]').textContent = `${state.rotationSpeed.toFixed(1)}×`;
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
  figure.querySelector('[data-action="flare"]').addEventListener('click', triggerFlare);
  figure.querySelector('[data-action="resetView"]').addEventListener('click', resetView);
  figure.querySelector('[data-action="fullscreen"]').addEventListener('click', () => figure.requestFullscreen?.());
  figure.querySelectorAll('[data-toggle]').forEach(input => input.addEventListener('change', event => {
    state[input.dataset.toggle] = event.target.checked;
    spotsOnUniform.value = state.showSpots ? 1 : 0;
    loopMeshes.forEach(mesh => { mesh.visible = state.showLoops; });
    coronaInner.visible = coronaQuad.visible = state.showCorona;
    stars.visible = state.showStars && !exportMode;
    updateActivityState(timeUniform.value);
    renderOnce();
  }));
  figure.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') { event.preventDefault(); state.paused = !state.paused; syncPause(); }
    if (event.key.toLowerCase() === 'f') triggerFlare();
    if (event.key.toLowerCase() === 'r') resetView();
    if (event.key === 'Escape') { state.paused = true; syncPause(); }
  });

  step(0);
  syncPause();
  renderOnce();
  ensureLoop();

  return {
    figure,
    regions,
    triggerFlare,
    /* debug/test kancası: tek tek katman söndürme (görsel hata avı) */
    _state: state,
    /* deterministic time stepping — lets exports and tests drive the
       animation without relying on requestAnimationFrame */
    advance: seconds => {
      timeUniform.value += seconds;
      updateActivityState(timeUniform.value);
      stepParticles(seconds);
      orientCorona();
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
      renderer.dispose();
      figure.remove();
    },
  };
}
