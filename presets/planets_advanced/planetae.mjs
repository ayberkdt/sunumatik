/* Planetae: the remaining seven planets at the Lunaris/Terra/Sol standard —
   one module, one scene, a planet switcher with a crossfade transition.

   Realism inventory (the caption keeps the split visible):
   - REAL: photographic surface textures (Solar System Scope, CC BY 4.0,
     NASA-imagery derived); axial tilts (Mercury 0.03° … Uranus 97.8°, and
     Venus's 177.4° — which is WHY it spins retrograde); relative day
     lengths ordering the visual spin (Jupiter visibly faster than Venus);
     the fact panel (radius, day, year, moons, distance) from NASA
     planetary fact sheets;
   - ILLUSTRATIVE: lighting, absolute spin speed, atmosphere glow strength,
     and every scale — planets are rendered at unit radius, so sizes are
     NOT comparable between planets.

   Saturn gets its ring system from the CC BY alpha strip; Uranus gets thin
   procedural rings standing almost vertical because of its real 97.8° tilt.
   Same page requirements as the other vanilla presets (import map for
   "three" → lunaris vendor, moon_react_source.css). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { EffectComposer } from '../moon_advanced/vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../moon_advanced/vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../moon_advanced/vendor/postprocessing/UnrealBloomPass.js';

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const domExport = () =>
  new URLSearchParams(location.search).get('export') === '1'
  || document.documentElement.dataset.export === 'true';

/* Facts: NASA planetary fact sheet values, rounded; moon counts are
   "known as of ~2025" and change with discoveries. */
export const PLANETS = [
  { id: 'mercury', name: 'Merkür', texture: '2k_mercury.jpg', tiltDeg: .03, dayHours: 1407.6,
    facts: { radius: '2 439.7 km', day: '58.6 Dünya günü', year: '88 Dünya günü', moons: '0', distance: '0.39 AU' } },
  { id: 'venus', name: 'Venüs', texture: '2k_venus_atmosphere.jpg', tiltDeg: 177.4, dayHours: 5832.5,
    facts: { radius: '6 051.8 km', day: '243 Dünya günü · retrograd', year: '225 Dünya günü', moons: '0', distance: '0.72 AU' },
    atmosphere: { day: '#f2ddab', night: '#6e5c36', intensity: 1.5 } },
  { id: 'mars', name: 'Mars', texture: '2k_mars.jpg', tiltDeg: 25.2, dayHours: 24.6,
    facts: { radius: '3 389.5 km', day: '24.6 saat', year: '687 Dünya günü', moons: '2', distance: '1.52 AU' },
    atmosphere: { day: '#e8b28a', night: '#402c24', intensity: .65 } },
  { id: 'jupiter', name: 'Jüpiter', texture: '2k_jupiter.jpg', tiltDeg: 3.1, dayHours: 9.9,
    facts: { radius: '69 911 km', day: '9.9 saat', year: '11.9 yıl', moons: '≈95', distance: '5.20 AU' },
    atmosphere: { day: '#dcccaa', night: '#4c4236', intensity: .85 },
    /* REAL: neighbouring belts/zones stream in OPPOSITE directions; the
       Great Red Spot is a fixed-longitude anticyclone */
    dynamics: { bands: 10, flowSpeed: .05, turbulence: .32,
      grs: { lat: -22, lon: 20, size: .16, spin: 2.2 } },
    /* Galilean moons: display distances, REAL relative periods 1:2:4:9.4 */
    moons: [
      { name: 'Io', color: '#d8b25c', radius: .022, distance: 1.9, period: 6 },
      { name: 'Europa', color: '#e8ddc8', radius: .019, distance: 2.35, period: 12 },
      { name: 'Ganymede', color: '#b9a58c', radius: .03, distance: 2.95, period: 24.2 },
      { name: 'Callisto', color: '#8d8578', radius: .027, distance: 3.8, period: 56.4 },
    ] },
  { id: 'saturn', name: 'Satürn', texture: '2k_saturn.jpg', tiltDeg: 26.7, dayHours: 10.7,
    facts: { radius: '58 232 km', day: '10.7 saat', year: '29.4 yıl', moons: '≈146', distance: '9.54 AU' },
    atmosphere: { day: '#e8dcb2', night: '#4c4634', intensity: .75 },
    dynamics: { bands: 8, flowSpeed: .03, turbulence: .18, hexagon: true },
    rings: { kind: 'texture', inner: 1.24, outer: 2.27, file: '2k_saturn_ring_alpha.png', opacity: .96, shadows: true },
    moons: [ { name: 'Titan', color: '#d9a05c', radius: .024, distance: 4.4, period: 75 } ] },
  { id: 'uranus', name: 'Uranüs', texture: '2k_uranus.jpg', tiltDeg: 97.8, dayHours: 17.2,
    facts: { radius: '25 362 km', day: '17.2 saat · retrograd', year: '84 yıl', moons: '≈28', distance: '19.2 AU' },
    atmosphere: { day: '#a5e0e4', night: '#2d4d55', intensity: .9 },
    dynamics: { bands: 5, flowSpeed: .012, turbulence: .08 },
    rings: { kind: 'procedural', inner: 1.64, outer: 2.0, opacity: .55 } },
  { id: 'neptune', name: 'Neptün', texture: '2k_neptune.jpg', tiltDeg: 28.3, dayHours: 16.1,
    facts: { radius: '24 622 km', day: '16.1 saat', year: '165 yıl', moons: '≈16', distance: '30.1 AU' },
    atmosphere: { day: '#86adf2', night: '#243662', intensity: 1.05 },
    /* REAL: the fastest winds in the solar system; dark-spot storms come
       and go over years (compressed here) */
    dynamics: { bands: 6, flowSpeed: .11, turbulence: .38,
      darkSpot: { lat: -30, size: .14, cycle: 46 }, cirrus: true } },
];

/* Ashima 3D simplex + fbm — shared by the gas-giant dynamics shaders */
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
  for (int i = 0; i < 4; i++) {
    value += amplitude * snoise(p);
    p *= 2.03;
    amplitude *= .52;
  }
  return value;
}`;

const MAX_MOON_SHADOWS = 5;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(count, seed = 90210) {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 90 + random() * 60;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color: '#e8eeff', size: .55, sizeAttenuation: true,
    transparent: true, opacity: .75, depthWrite: false,
  }));
}

/* Fresnel atmosphere halo — Terra's approach, with the tone-mapping
   includes custom shaders need to stay inside ACES. */
function makeAtmosphere(config, sunDirUniform) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1.14, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: sunDirUniform,
        uDay: { value: new THREE.Color(config.day) },
        uNight: { value: new THREE.Color(config.night) },
        uIntensity: { value: config.intensity },
      },
      vertexShader: `
        varying vec3 vNormalView; varying vec3 vPosW;
        void main() {
          vNormalView = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.);
          vPosW = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }`,
      fragmentShader: `
        uniform vec3 uSunDir; uniform vec3 uDay; uniform vec3 uNight; uniform float uIntensity;
        varying vec3 vNormalView; varying vec3 vPosW;
        void main() {
          float glow = pow(clamp(.6 - dot(vNormalView, vec3(0., 0., 1.)), 0., 1.4), 4.4);
          float sunFacing = clamp(dot(normalize(vPosW), normalize(uSunDir)) * .6 + .4, 0., 1.);
          gl_FragColor = vec4(mix(uNight, uDay, sunFacing) * glow * uIntensity * (.3 + .7 * sunFacing), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
}

/* Ring UVs radial: u runs inner→outer so the alpha strip reads correctly. */
function radialRingGeometry(inner, outer) {
  const geometry = new THREE.RingGeometry(inner, outer, 160, 1);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), .5);
  }
  return geometry;
}

function proceduralRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 4;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 4);
  const band = (u, w, alpha) => {
    ctx.fillStyle = `rgba(190, 205, 215, ${alpha})`;
    ctx.fillRect(Math.round(u * 512), 0, Math.max(1, Math.round(w * 512)), 4);
  };
  band(.06, .015, .5); band(.18, .01, .4); band(.34, .012, .45);
  band(.52, .008, .35); band(.68, .01, .4); band(.93, .04, .85); /* ε ring */
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function mountPlanetae(container, options = {}) {
  if (!container) throw new Error('mountPlanetae requires a container element');
  const assetBaseUrl = options.assetBaseUrl || '.';
  const accent = options.accent || '#e8905a';
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const title = options.title || 'Gezegenler: gerçek dokular, gerçek eğiklikler';
  const planets = options.planets || PLANETS;
  const initialId = options.initialPlanet || 'mars';

  const state = {
    spinFactor: 1, paused: false,
    showAtmosphere: true, showRings: true, showMoons: true, showStars: true, showBloom: true,
    active: options.active ?? true,
    currentId: null,
  };
  const finalPaused = () => state.paused || reducedMotion || exportMode || !state.active;

  const figure = document.createElement('figure');
  figure.className = 'lunaris-preset';
  figure.dataset.style = 'cinematic';
  figure.dataset.export = exportMode ? 'true' : 'false';
  figure.dataset.ownsKeys = '';
  figure.dataset.ownsArrows = '';
  figure.style.setProperty('--lunaris-accent', accent);
  figure.tabIndex = 0;
  figure.setAttribute('aria-label', title);
  figure.innerHTML = `
    <div class="lunaris-preset__canvas" aria-hidden="true"></div>
    <header class="lunaris-preset__heading"><span>PLANETAE · INTERACTIVE PRESET</span><h1>${title}</h1></header>
    <div class="lunaris-preset__loading" role="status">Gezegen dokuları yükleniyor · 0%</div>
    <div class="lunaris-preset__controls" data-export-hide>
      <section class="lunaris-preset__panel lunaris-preset__panel--left" aria-label="Gezegen seçimi">
        <span class="lunaris-preset__panel-title">Gezegen</span>
        <div class="lunaris-preset__segmented" data-planet-buttons></div>
        <div class="lunaris-preset__toggles">
          <label><input type="checkbox" data-toggle="showAtmosphere" checked> Atmosfer</label>
          <label><input type="checkbox" data-toggle="showRings" checked> Halkalar</label>
          <label><input type="checkbox" data-toggle="showMoons" checked> Uydular</label>
          <label><input type="checkbox" data-toggle="showStars" checked> Yıldızlar</label>
          <label><input type="checkbox" data-toggle="showBloom" checked> Bloom</label>
        </div>
      </section>
      <section class="lunaris-preset__panel lunaris-preset__panel--right" aria-label="Veriler ve hareket">
        <span class="lunaris-preset__panel-title">Veriler</span>
        <dl class="planetae-facts" data-facts></dl>
        <label class="lunaris-preset__range">
          <span>Dönüş hızı <output data-out="spin">1.0×</output></span>
          <input data-input="spin" aria-label="Dönüş hızı" type="range" min="0" max="3" step="0.1" value="1">
        </label>
        <div class="lunaris-preset__button-row">
          <button type="button" data-action="pause" aria-pressed="false">Durdur</button>
          <button type="button" data-action="resetView">Sıfırla</button>
          <button type="button" data-action="fullscreen">Tam ekran</button>
        </div>
      </section>
    </div>
    <figcaption class="lunaris-preset__truth">
      <strong>Gerçek veriler · temsilî ölçek</strong>
      <span data-telemetry></span>
      <small>Gerçek: eksen eğiklikleri, zıt yönlü kuşak rüzgârları, Büyük Kırmızı Leke antisiklonu, Satürn kutup altıgeni ve halka gölgeleri, Galile uydularının 1:2:4 dönemli geçiş gölgeleri, Neptün'ün gelip geçen karanlık lekeleri (NASA veri sayfaları; dokular Solar System Scope CC BY 4.0). Temsilî: hız ölçekleri, uydu boyut/uzaklıkları ve gezegenler arası boyutlar.</small>
    </figcaption>
    <p class="lunaris-preset__help" data-export-hide>← → gezegen değiştirir · Sürükle: kamera · Boşluk: durdur</p>`;
  container.appendChild(figure);

  const style = document.createElement('style');
  style.textContent = `
    .planetae-facts { display: grid; grid-template-columns: auto 1fr; gap: 7px 16px; margin: 16px 0 0; }
    .planetae-facts dt { color: #c9d5e0; font-size: 16px; font-weight: 650; }
    .planetae-facts dd { margin: 0; color: var(--lunaris-accent); font-size: 16px; font-weight: 750;
                         font-variant-numeric: tabular-nums; text-align: right; }
    .lunaris-preset [data-planet-buttons] button { font-size: 15px; min-height: 38px; }`;
  figure.appendChild(style);

  const canvasHost = figure.querySelector('.lunaris-preset__canvas');
  const loadingEl = figure.querySelector('.lunaris-preset__loading');
  const telemetryEl = figure.querySelector('[data-telemetry]');
  const factsEl = figure.querySelector('[data-facts]');

  /* -- textures -- */
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, loaded, total) => {
    loadingEl.textContent = `Gezegen dokuları yükleniyor · ${Math.round((loaded / total) * 100)}%`;
  };
  const loader = new THREE.TextureLoader(manager);
  const textures = {};
  try {
    await Promise.all(planets.map(async planet => {
      textures[planet.id] = await loader.loadAsync(`${assetBaseUrl}/textures/${planet.texture}`);
      textures[planet.id].colorSpace = THREE.SRGBColorSpace;
      textures[planet.id].anisotropy = 8;
      if (planet.rings?.kind === 'texture') {
        textures[`${planet.id}-ring`] = await loader.loadAsync(`${assetBaseUrl}/textures/${planet.rings.file}`);
        textures[`${planet.id}-ring`].colorSpace = THREE.SRGBColorSpace;
      }
    }));
  } catch (error) {
    loadingEl.textContent = `Dokular yüklenemedi: ${error.message}`;
    loadingEl.classList.add('lunaris-preset__loading--error');
    return { figure, dispose: () => figure.remove(), setActive() {}, error };
  }
  loadingEl.remove();

  /* -- scene -- */
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04060c');
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 400);
  camera.position.set(0, .4, 3.6);

  const sunDir = new THREE.Vector3(5, 1.6, 2.4).normalize();
  const sunDirUniform = { value: sunDir };
  const sun = new THREE.DirectionalLight('#ffffff', 2.7);
  sun.position.copy(sunDir).multiplyScalar(10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#93a8c4', '#1d2026', .65));
  scene.add(new THREE.AmbientLight('#3f4650', .6));

  const stars = buildStars(reducedMotion ? 1400 : 3400);
  stars.visible = state.showStars && !exportMode;
  scene.add(stars);

  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 256;
  const sunCtx = sunCanvas.getContext('2d');
  const gradient = sunCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.14, 'rgba(255,243,210,.9)');
  gradient.addColorStop(.4, 'rgba(255,212,140,.28)');
  gradient.addColorStop(1, 'rgba(255,190,90,0)');
  sunCtx.fillStyle = gradient;
  sunCtx.fillRect(0, 0, 256, 256);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sunCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  sunSprite.material.map.colorSpace = THREE.SRGBColorSpace;
  sunSprite.position.copy(sunDir).multiplyScalar(70);
  sunSprite.scale.setScalar(11);
  scene.add(sunSprite);

  /* -- planet groups (built lazily, cached) -- */
  const groups = new Map();
  const timeUniform = { value: exportMode || reducedMotion ? 31.7 : 0 };

  /* Gas-giant atmosphere dynamics, Sol-quality but planet-appropriate:
     counter-rotating zonal bands (REAL: neighbouring belts stream in
     opposite directions), shear turbulence at band boundaries, optional
     Great-Red-Spot anticyclone, Saturn's polar hexagon, Neptune's
     transient dark spot + fast cirrus, moon transit shadows, and the
     ring shadow across Saturn. Custom lighting keeps the terminator. */
  const makeDynamicMaterial = config => {
    const d = config.dynamics;
    const grs = d.grs || { lat: 0, lon: 0, size: 0, spin: 0 };
    const dark = d.darkSpot || { lat: 0, size: 0, cycle: 1 };
    const ring = config.rings?.shadows ? config.rings : { inner: 0, outer: 0 };
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: textures[config.id] },
        uTime: timeUniform,
        uSunLocal: { value: new THREE.Vector3(0, 0, 1) },
        uFlow: { value: d.flowSpeed }, uBands: { value: d.bands }, uTurb: { value: d.turbulence },
        uGrsUv: { value: new THREE.Vector2((grs.lon + 180) / 360, (grs.lat + 90) / 180) },
        uGrsSize: { value: grs.size }, uGrsSpin: { value: grs.spin || 0 },
        uHex: { value: d.hexagon ? 1 : 0 },
        uDarkLat: { value: (dark.lat + 90) / 180 }, uDarkSize: { value: dark.size || 0 },
        uDarkCycle: { value: dark.cycle || 1 }, uCirrus: { value: d.cirrus ? 1 : 0 },
        uMoonShadows: { value: Array.from({ length: MAX_MOON_SHADOWS }, () => new THREE.Vector4(0, 0, 1, 0)) },
        uShadowCount: { value: 0 },
        uRingIn: { value: ring.inner }, uRingOut: { value: ring.outer },
      },
      vertexShader: `
        varying vec3 vObj; varying vec2 vUv;
        void main() {
          vObj = position; vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }`,
      fragmentShader: `${NOISE_GLSL}
        uniform sampler2D uMap;
        uniform float uTime, uFlow, uBands, uTurb, uGrsSize, uGrsSpin, uHex;
        uniform float uDarkLat, uDarkSize, uDarkCycle, uCirrus;
        uniform float uRingIn, uRingOut;
        uniform vec2 uGrsUv;
        uniform vec3 uSunLocal;
        uniform vec4 uMoonShadows[${MAX_MOON_SHADOWS}];
        uniform int uShadowCount;
        varying vec3 vObj; varying vec2 vUv;
        void main() {
          vec3 dir = normalize(vObj);
          float lat = (vUv.y - .5) * 3.14159265;
          /* REAL zonal structure: alternating jet directions by latitude */
          float jet = sin(lat * uBands) * cos(lat);
          float lonShift = uTime * uFlow * jet;
          /* shear turbulence, strongest where neighbouring jets collide */
          float shear = abs(cos(lat * uBands));
          /* fade the advection near the poles: the UV singularity there
             turns any warp into flicker */
          float polarFade = smoothstep(1.5, 1.05, abs(lat));
          vec2 wUv = vUv + vec2(lonShift * polarFade, 0.);
          wUv += uTurb * .02 * polarFade * (1. + shear * 1.6) * vec2(
            fbm(vec3(vUv * 7., uTime * .05)),
            fbm(vec3(vUv * 7. + 4.7, uTime * .04)) * .45);
          /* Great Red Spot: anticyclonic swirl fixed in the cloud deck */
          if (uGrsSize > 0.) {
            vec2 delta = wUv - uGrsUv;
            delta.x = delta.x - floor(delta.x + .5);
            delta.x *= cos(lat);
            float dist = length(delta);
            float core = exp(-pow(dist / uGrsSize, 2.) * 2.2);
            float angle = uGrsSpin * core * (1. + .15 * sin(uTime * .3));
            float ca = cos(angle), sa = sin(angle);
            vec2 rotated = vec2(ca * delta.x - sa * delta.y, sa * delta.x + ca * delta.y);
            wUv += (rotated - delta) * vec2(1. / max(.2, cos(lat)), 1.);
          }
          vec3 color = texture2D(uMap, fract(wUv)).rgb;
          if (uGrsSize > 0.) {
            vec2 delta2 = vUv - uGrsUv;
            delta2.x = (delta2.x - floor(delta2.x + .5)) * cos(lat);
            float tint = exp(-pow(length(delta2) / uGrsSize, 2.) * 2.6);
            color = mix(color, color * vec3(1.18, .82, .68), tint * .55);
          }
          /* Neptune: transient dark-spot storm + racing methane cirrus */
          if (uDarkSize > 0.) {
            float phase = .5 + .5 * sin(uTime * 6.2831 / uDarkCycle);
            vec2 deltaD = vec2((vUv.x - fract(uTime * .012)) , vUv.y - uDarkLat);
            deltaD.x = (deltaD.x - floor(deltaD.x + .5)) * cos(lat);
            float storm = exp(-pow(length(deltaD * vec2(1., 1.6)) / uDarkSize, 2.) * 2.);
            color *= 1. - storm * .38 * phase;
          }
          if (uCirrus > .5) {
            float streak = pow(1. - abs(snoise(vec3(vUv.x * 5. + uTime * uFlow * 3.2, vUv.y * 60., uTime * .07))), 6.);
            color += vec3(.5, .55, .62) * streak * .28 * smoothstep(.65, .2, abs(lat));
          }
          /* Saturn's REAL north-polar hexagon jet */
          if (uHex > .5 && dir.y > .86) {
            float polarAngle = atan(dir.x, dir.z) + uTime * .04;
            float sector = mod(polarAngle + 3.14159265, 1.0472) - .5236;
            float hexLat = 1.245 + .028 / max(.6, cos(sector));
            float actualLat = asin(clamp(dir.y, -1., 1.));
            float edge = exp(-pow((actualLat - hexLat) / .016, 2.));
            color *= 1. - edge * .3;
          }
          /* moon transit shadows */
          for (int i = 0; i < ${MAX_MOON_SHADOWS}; i++) {
            if (i >= uShadowCount) break;
            float ang = acos(clamp(dot(dir, normalize(uMoonShadows[i].xyz)), -1., 1.));
            color *= 1. - uMoonShadows[i].w * smoothstep(.09, .025, ang) * .8;
          }
          /* ring shadow: does the sunward ray cross the ring annulus? */
          if (uRingOut > 0.) {
            float s = -vObj.y / (uSunLocal.y + sign(uSunLocal.y) * 1e-4);
            if (s > 0.) {
              vec2 hit = vObj.xz + uSunLocal.xz * s;
              float rho = length(hit);
              float inRing = smoothstep(uRingIn - .04, uRingIn + .06, rho)
                           * (1. - smoothstep(uRingOut - .06, uRingOut + .04, rho));
              color *= 1. - inRing * .45;
            }
          }
          /* terminator lighting */
          float nDotL = dot(dir, normalize(uSunLocal));
          color *= .12 + smoothstep(-.15, .3, nDotL) * 1.05;
          gl_FragColor = vec4(color, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  };

  const buildPlanet = config => {
    if (groups.has(config.id)) return groups.get(config.id);
    const group = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 96),
      config.dynamics
        ? makeDynamicMaterial(config)
        : new THREE.MeshStandardMaterial({ map: textures[config.id], roughness: .92, metalness: 0 }),
    );
    sphere.name = 'surface';
    group.add(sphere);
    /* moons orbit in the equatorial plane; the group's tilt carries them */
    if (config.moons) {
      const orbit = new THREE.Group();
      orbit.name = 'moonOrbit';
      const seededPhase = mulberry32(0xC0FFEE);
      group.userData.moons = config.moons.map(moon => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(moon.radius, 24, 16),
          new THREE.MeshStandardMaterial({ color: moon.color, roughness: .95, metalness: 0 }),
        );
        orbit.add(mesh);
        return { ...moon, mesh, phase: seededPhase() * Math.PI * 2 };
      });
      group.add(orbit);
    }
    if (config.atmosphere) {
      const halo = makeAtmosphere(config.atmosphere, sunDirUniform);
      halo.name = 'atmosphere';
      group.add(halo);
    }
    if (config.rings) {
      const ringMap = config.rings.kind === 'texture' ? textures[`${config.id}-ring`] : proceduralRingTexture();
      let material;
      if (config.rings.shadows) {
        /* the planet's REAL shadow sweeps across the rings */
        const sunRingUniform = { value: new THREE.Vector3(0, 0, 1) };
        material = new THREE.ShaderMaterial({
          uniforms: { uMap: { value: ringMap }, uSunRing: sunRingUniform, uOpacity: { value: config.rings.opacity } },
          vertexShader: `
            varying vec2 vUv; varying vec3 vPos;
            void main() { vUv = uv; vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `
            uniform sampler2D uMap; uniform vec3 uSunRing; uniform float uOpacity;
            varying vec2 vUv; varying vec3 vPos;
            void main() {
              vec4 base = texture2D(uMap, vUv);
              vec3 p = vec3(vPos.xy, 0.);
              float along = dot(p, uSunRing);
              float perp2 = dot(p, p) - along * along;
              float blocked = (along < 0. && perp2 < 1.) ? .72 : 0.;
              float lit = .35 + .65 * abs(uSunRing.z);
              gl_FragColor = vec4(base.rgb * lit * (1. - blocked), base.a * uOpacity);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
          transparent: true, side: THREE.DoubleSide, depthWrite: false,
        });
        group.userData.sunRingUniform = sunRingUniform;
      } else {
        material = new THREE.MeshStandardMaterial({
          map: ringMap,
          transparent: true, opacity: config.rings.opacity, side: THREE.DoubleSide,
          depthWrite: false, roughness: .85, metalness: 0,
        });
      }
      const rings = new THREE.Mesh(radialRingGeometry(config.rings.inner, config.rings.outer), material);
      rings.rotation.x = -Math.PI / 2;
      rings.name = 'rings';
      group.add(rings);
    }
    /* real axial tilt — Venus's 177.4° and Uranus's 97.8° come free */
    group.rotation.z = THREE.MathUtils.degToRad(config.tiltDeg);
    group.visible = false;
    scene.add(group);
    groups.set(config.id, group);
    return group;
  };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .5, .5, .88));
  const useBloom = () => state.showBloom;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 8;
  controls.addEventListener('change', () => { if (finalPaused()) renderOnce(); });
  const resetView = () => {
    camera.position.set(0, .4, 3.6);
    controls.target.set(0, 0, 0);
    controls.update();
    renderOnce();
  };

  /* -- tween runner (crossfade transitions) -- */
  const tweens = [];
  const tween = (duration, onUpdate, onDone) =>
    tweens.push({ elapsed: 0, duration, onUpdate, onDone });
  const easeInOut = t => t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  const runTweens = delta => {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const item = tweens[i];
      item.elapsed += delta * 1000;
      const t = Math.min(1, item.elapsed / item.duration);
      item.onUpdate(easeInOut(t));
      if (t >= 1) { tweens.splice(i, 1); item.onDone?.(); }
    }
  };
  const setGroupOpacity = (group, value) => {
    group.traverse(node => {
      if (node.material) {
        node.material.transparent = true;
        node.material.opacity = value * (node.name === 'rings' ? (planets.find(p => p.id === state.currentId)?.rings?.opacity ?? 1) : 1);
      }
    });
  };

  const applyVisibility = group => {
    group.traverse(node => {
      if (node.name === 'atmosphere') node.visible = state.showAtmosphere;
      if (node.name === 'rings') node.visible = state.showRings;
      if (node.name === 'moonOrbit') node.visible = state.showMoons;
    });
  };

  const currentConfig = () => planets.find(p => p.id === state.currentId);
  const setFacts = config => {
    telemetryEl.textContent = `${config.name} · eksen eğikliği ${config.tiltDeg}°`;
    factsEl.innerHTML = [
      ['Yarıçap', config.facts.radius],
      ['Gün', config.facts.day],
      ['Yıl', config.facts.year],
      ['Bilinen uydu', config.facts.moons],
      ['Güneş\'e uzaklık', config.facts.distance],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    figure.querySelectorAll('[data-planet]').forEach(button =>
      button.classList.toggle('is-active', button.dataset.planet === config.id));
  };

  let transitioning = false;
  const showPlanet = (id, animate = true) => {
    const config = planets.find(p => p.id === id);
    if (!config || id === state.currentId || transitioning) return;
    const previous = state.currentId ? groups.get(state.currentId) : null;
    state.currentId = id;
    const group = buildPlanet(config);
    applyVisibility(group);
    setFacts(config);
    options.onPlanet?.(config);
    if (!animate || reducedMotion || exportMode || !previous) {
      if (previous) previous.visible = false;
      group.visible = true;
      setGroupOpacity(group, 1);
      group.scale.setScalar(1);
      renderOnce();
      return;
    }
    transitioning = true;
    group.visible = true;
    group.scale.setScalar(.62);
    setGroupOpacity(group, 0);
    const settle = () => {
      if (previous) { previous.visible = false; previous.scale.setScalar(1); }
      setGroupOpacity(group, 1);
      group.scale.setScalar(1);
      transitioning = false;
    };
    tween(720, t => {
      if (previous) { previous.scale.setScalar(1 - t * .38); setGroupOpacity(previous, 1 - t); }
      group.scale.setScalar(.62 + t * .38);
      setGroupOpacity(group, t);
    }, settle);
    /* hidden/throttled documents never advance the tween — land it anyway */
    setTimeout(() => { if (transitioning && state.currentId === id) { settle(); renderOnce(); } }, 1600);
    ensureLoop();
  };
  const stepPlanet = direction => {
    const index = planets.findIndex(p => p.id === state.currentId);
    showPlanet(planets[(index + direction + planets.length) % planets.length].id);
  };

  /* -- frame loop -- */
  let frame = null;
  const clock = new THREE.Clock();
  const groupQuatInv = new THREE.Quaternion();
  const sphereQuatInv = new THREE.Quaternion();
  const sunGroupLocal = new THREE.Vector3();
  const sunSphereLocal = new THREE.Vector3();
  const moonWork = new THREE.Vector3();
  const updateDynamics = (config, group) => {
    const sphere = group.getObjectByName('surface');
    /* sun in group-local (tilt) and sphere-local (tilt + spin) frames */
    groupQuatInv.copy(group.quaternion).invert();
    sunGroupLocal.copy(sunDir).applyQuaternion(groupQuatInv);
    sphereQuatInv.copy(sphere.quaternion).invert();
    sunSphereLocal.copy(sunGroupLocal).applyQuaternion(sphereQuatInv);
    if (config.dynamics) sphere.material.uniforms.uSunLocal.value.copy(sunSphereLocal);
    if (group.userData.sunRingUniform) {
      /* ring local = group local rotated by the ring's -90° X turn */
      group.userData.sunRingUniform.value.set(sunGroupLocal.x, -sunGroupLocal.z, sunGroupLocal.y);
    }
    /* moons: REAL relative periods; shadows projected along the sun ray */
    if (group.userData.moons) {
      let shadowCount = 0;
      const uniforms = config.dynamics ? sphere.material.uniforms : null;
      group.userData.moons.forEach(moon => {
        const angle = moon.phase + (timeUniform.value * 2 * Math.PI) / moon.period;
        moon.mesh.position.set(Math.cos(angle) * moon.distance, 0, Math.sin(angle) * moon.distance);
        if (!uniforms || shadowCount >= MAX_MOON_SHADOWS) return;
        const p = moon.mesh.position;
        const b = p.dot(sunGroupLocal);
        const c = p.lengthSq() - 1;
        const disc = b * b - c;
        if (b > 0 && disc > 0) {
          const s = b - Math.sqrt(disc);
          moonWork.copy(p).addScaledVector(sunGroupLocal, -s).normalize()
            .applyQuaternion(sphereQuatInv);
          uniforms.uMoonShadows.value[shadowCount].set(moonWork.x, moonWork.y, moonWork.z, Math.min(1, moon.radius * 34));
          shadowCount++;
        }
      });
      if (uniforms) uniforms.uShadowCount.value = shadowCount;
    }
  };
  const step = delta => {
    const config = currentConfig();
    const group = config && groups.get(config.id);
    if (group && !exportMode && !reducedMotion && !state.paused && state.active) {
      /* visual spin ordered by real day length (Jupiter fast, Venus glacial) */
      const rate = THREE.MathUtils.clamp(24 / config.dayHours, .04, 2.4);
      group.getObjectByName('surface').rotation.y += delta * rate * .3 * state.spinFactor;
      timeUniform.value += delta * state.spinFactor;
      if (stars.visible) stars.rotation.y += delta * .0025;
    }
    if (group) updateDynamics(config, group);
    sunDirUniform.value = sunDir;
    runTweens(delta);
  };
  const renderOnce = () => { if (useBloom()) composer.render(); else renderer.render(scene, camera); };
  const loop = () => {
    frame = null;
    if ((finalPaused() && !tweens.length) || document.hidden) return;
    const delta = Math.min(.1, clock.getDelta());
    controls.update();
    step(delta);
    renderOnce();
    frame = requestAnimationFrame(loop);
  };
  const ensureLoop = () => {
    if ((finalPaused() && !tweens.length) || document.hidden) { step(0); renderOnce(); return; }
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
  const buttonHost = figure.querySelector('[data-planet-buttons]');
  planets.forEach(planet => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.planet = planet.id;
    button.textContent = planet.name;
    button.addEventListener('click', () => showPlanet(planet.id));
    buttonHost.appendChild(button);
  });
  figure.querySelector('[data-input="spin"]').addEventListener('input', event => {
    state.spinFactor = Number(event.target.value);
    figure.querySelector('[data-out="spin"]').textContent = `${state.spinFactor.toFixed(1)}×`;
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
  figure.querySelector('[data-action="resetView"]').addEventListener('click', resetView);
  figure.querySelector('[data-action="fullscreen"]').addEventListener('click', () => figure.requestFullscreen?.());
  figure.querySelectorAll('[data-toggle]').forEach(input => input.addEventListener('change', event => {
    state[input.dataset.toggle] = event.target.checked;
    stars.visible = state.showStars && !exportMode;
    const group = state.currentId && groups.get(state.currentId);
    if (group) applyVisibility(group);
    renderOnce();
  }));
  figure.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); stepPlanet(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); stepPlanet(-1); }
    if (event.code === 'Space') { event.preventDefault(); state.paused = !state.paused; syncPause(); }
    if (event.key.toLowerCase() === 'r') resetView();
    if (event.key === 'Escape') { state.paused = true; syncPause(); }
  });

  showPlanet(initialId, false);
  step(0);
  syncPause();
  renderOnce();
  ensureLoop();

  return {
    figure,
    planets,
    get currentPlanet() { return currentConfig(); },
    /* deterministic stepping for exports and tests (rAF-free) */
    advance: seconds => {
      timeUniform.value += seconds;
      const config = currentConfig();
      const group = config && groups.get(config.id);
      if (group) {
        const rate = THREE.MathUtils.clamp(24 / config.dayHours, .04, 2.4);
        group.getObjectByName('surface').rotation.y += seconds * rate * .3 * state.spinFactor;
        updateDynamics(config, group);
      }
      runTweens(seconds);
      renderOnce();
    },
    debugDynamics: () => {
      const config = currentConfig();
      const group = config && groups.get(config.id);
      const sphere = group?.getObjectByName('surface');
      return {
        planet: config?.id,
        dynamic: Boolean(config?.dynamics),
        shadowCount: sphere?.material.uniforms?.uShadowCount?.value ?? 0,
        moonCount: group?.userData.moons?.length ?? 0,
        time: timeUniform.value,
      };
    },
    showPlanet,
    nextPlanet: () => stepPlanet(1),
    prevPlanet: () => stepPlanet(-1),
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
