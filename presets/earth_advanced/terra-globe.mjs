/* Terra: the Earth counterpart of the Lunaris vanilla preset — a premium,
   realistic WebGL globe with a guided city tour.

   Realism inventory:
   - NASA-derived Blue Marble day color, terrain normal map, ocean specular
     glint, semi-transparent rotating cloud deck (three.js example textures);
   - real night city lights (Black Marble derived) revealed only past the
     day/night terminator via a shader mask — the terminator itself comes
     from actual lighting, not a painted gradient;
   - layered atmosphere rim; seeded star shell; ACES tone mapping + bloom;
   - eight real cities at their true coordinates; the tour rotates the globe
     so each city faces the camera, draws the great-circle route, and shows
     name, country, and exact coordinates;
   - an illustrative satellite on a 51.6°-inclined orbit with a fading trail.

   Truth split (kept visible in the caption): city positions and coordinates
   are real geographic data; the satellite orbit and timings are illustrative.

   Page requirements match the Lunaris vanilla preset: an import map for
   "three" pointing at ../moon_advanced/vendor/three.module.min.js,
   the moon_react_source stylesheet, and this folder's textures/. */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { EffectComposer } from '../moon_advanced/vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../moon_advanced/vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../moon_advanced/vendor/postprocessing/UnrealBloomPass.js';

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const domExport = () =>
  new URLSearchParams(location.search).get('export') === '1'
  || document.documentElement.dataset.export === 'true';

/* Real coordinates (WGS84, two decimals). Data, not decoration. */
export const TOUR_CITIES = [
  { name: 'İstanbul', country: 'Türkiye', lat: 41.01, lon: 28.98 },
  { name: 'Londra', country: 'Birleşik Krallık', lat: 51.51, lon: -0.13 },
  { name: 'New York', country: 'ABD', lat: 40.71, lon: -74.01 },
  { name: 'São Paulo', country: 'Brezilya', lat: -23.55, lon: -46.63 },
  { name: 'Cape Town', country: 'Güney Afrika', lat: -33.92, lon: 18.42 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.29, lon: 36.82 },
  { name: 'Tokyo', country: 'Japonya', lat: 35.68, lon: 139.69 },
  { name: 'Sidney', country: 'Avustralya', lat: -33.87, lon: 151.21 },
];

const formatCoords = city =>
  `${Math.abs(city.lat).toFixed(2)}°${city.lat >= 0 ? 'K' : 'G'} ${Math.abs(city.lon).toFixed(2)}°${city.lon >= 0 ? 'D' : 'B'}`;

/* Equirectangular texture mapping → unit sphere position. */
function latLonToVector(lat, lon, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(count, seed = 41285) {
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
    color: '#ffffff', size: .55, sizeAttenuation: true,
    transparent: true, opacity: .8, depthWrite: false,
  }));
}

const easeInOut = t => t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;

function buildSatellite() {
  const group = new THREE.Group();
  const craft = new THREE.Group();
  craft.scale.setScalar(1.9);
  const standard = options => new THREE.MeshStandardMaterial(options);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, .045),
    standard({ color: '#dddddd', metalness: .6, roughness: .3 }));
  const panelMaterial = () => standard({ color: '#10254a', emissive: '#02132e', metalness: .85, roughness: .15 });
  const panelA = new THREE.Mesh(new THREE.BoxGeometry(.02, .06, .0012), panelMaterial());
  panelA.position.y = .045; panelA.rotation.y = Math.PI / 2;
  const panelB = panelA.clone(); panelB.position.y = -.045;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(.01, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    standard({ color: '#ffffff', metalness: .5, roughness: .3, side: THREE.DoubleSide }));
  dish.position.z = .028; dish.rotation.x = -Math.PI / 2;
  craft.add(body, panelA, panelB, dish);
  group.add(craft);
  return group;
}

export async function mountTerra(container, options = {}) {
  if (!container) throw new Error('mountTerra requires a container element');
  const assetBaseUrl = options.assetBaseUrl || '.';
  const accent = options.accent || '#4da3ff';
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const title = options.title || 'Dünya: gerçek dokular, gerçek koordinatlar';
  const cities = options.cities || TOUR_CITIES;

  const state = {
    rotationSpeed: options.rotationSpeed ?? .05,
    paused: false,
    autoRotateCam: false,
    showClouds: true,
    showAtmosphere: true,
    showSatellite: true,
    showRoutes: true,
    showStars: true,
    showBloom: true,
    active: options.active ?? true,
    tourActive: false,
    tourIndex: -1,
    telemetry: { city: null, satelliteAngle: 0 },
  };
  const finalPaused = () => (state.paused && !state.tourActive) || reducedMotion || exportMode || !state.active;

  /* -- DOM (lunaris stylesheet classes) -- */
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
    <header class="lunaris-preset__heading"><span>TERRA · INTERACTIVE PRESET</span><h1>${title}</h1></header>
    <div class="lunaris-preset__loading" role="status">Dünya dokuları yükleniyor · 0%</div>
    <div class="lunaris-preset__controls" data-export-hide>
      <section class="lunaris-preset__panel lunaris-preset__panel--left" aria-label="Görünüm kontrolleri">
        <span class="lunaris-preset__panel-title">Görünüm</span>
        <label class="lunaris-preset__range">
          <span>Dönüş hızı <output data-out="spin">1.0×</output></span>
          <input data-input="spin" aria-label="Dönüş hızı" type="range" min="0" max="3" step="0.1" value="1">
        </label>
        <div class="lunaris-preset__toggles">
          <label><input type="checkbox" data-toggle="showClouds" checked> Bulutlar</label>
          <label><input type="checkbox" data-toggle="showAtmosphere" checked> Atmosfer</label>
          <label><input type="checkbox" data-toggle="showSatellite" checked> Uydu</label>
          <label><input type="checkbox" data-toggle="showRoutes" checked> Rotalar</label>
          <label><input type="checkbox" data-toggle="showStars" checked> Yıldızlar</label>
          <label><input type="checkbox" data-toggle="showBloom" checked> Bloom</label>
        </div>
      </section>
      <section class="lunaris-preset__panel lunaris-preset__panel--right" aria-label="Şehir turu">
        <span class="lunaris-preset__panel-title">Şehir turu</span>
        <div class="lunaris-preset__button-row">
          <button type="button" data-action="tour" aria-pressed="false">Turu başlat</button>
          <button type="button" data-action="next">Sonraki şehir</button>
          <button type="button" data-action="resetView">Görünümü sıfırla</button>
        </div>
        <button type="button" class="lunaris-preset__fullscreen" data-action="fullscreen">Tam ekran</button>
      </section>
    </div>
    <figcaption class="lunaris-preset__truth">
      <strong>Gerçek koordinatlar · temsilî uydu</strong>
      <span data-telemetry>Serbest görünüm — turu başlatın</span>
      <small>Şehir konumları gerçek coğrafi veridir. Dokular NASA Blue/Black Marble türevlerinden (three.js örnek seti); uydu yörüngesi ve zamanlaması temsilîdir.</small>
    </figcaption>
    <p class="lunaris-preset__help" data-export-hide>Sürükle: kamera · Tekerlek: zoom · Boşluk: durdur · N: sonraki şehir · Esc: turu bitir</p>`;
  container.appendChild(figure);
  const canvasHost = figure.querySelector('.lunaris-preset__canvas');
  const loadingEl = figure.querySelector('.lunaris-preset__loading');
  const telemetryEl = figure.querySelector('[data-telemetry]');

  /* -- textures -- */
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, loaded, total) => {
    loadingEl.textContent = `Dünya dokuları yükleniyor · ${Math.round((loaded / total) * 100)}%`;
  };
  const loader = new THREE.TextureLoader(manager);
  let dayMap, normalMap, specularMap, cloudsMap, lightsMap;
  try {
    [dayMap, normalMap, specularMap, cloudsMap, lightsMap] = await Promise.all([
      loader.loadAsync(`${assetBaseUrl}/textures/earth_atmos_2048.jpg`),
      loader.loadAsync(`${assetBaseUrl}/textures/earth_normal_2048.jpg`),
      loader.loadAsync(`${assetBaseUrl}/textures/earth_specular_2048.jpg`),
      loader.loadAsync(`${assetBaseUrl}/textures/earth_clouds_1024.png`),
      loader.loadAsync(`${assetBaseUrl}/textures/earth_lights_2048.png`),
    ]);
  } catch (error) {
    loadingEl.textContent = `Dokular yüklenemedi: ${error.message}`;
    loadingEl.classList.add('lunaris-preset__loading--error');
    loadingEl.setAttribute('role', 'alert');
    return { figure, dispose: () => figure.remove(), setActive() {}, error };
  }
  dayMap.colorSpace = THREE.SRGBColorSpace;
  lightsMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = 8;
  cloudsMap.anisotropy = 4;
  loadingEl.remove();

  /* -- renderer, scene, camera -- */
  /* preserveDrawingBuffer: deterministic export screenshots can read the
     canvas back at any time (the audit pipeline depends on this). */
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.38;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04060c');
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 400);
  camera.position.set(0, .35, 3.1);

  /* Photographic balance: one sun, a sky/ground hemisphere so the night
     limb keeps readable shape, and a faint cool fill — no pitch-black
     half, no blown highlights. */
  const sunDir = new THREE.Vector3(5, 1.6, 2.4).normalize();
  const sun = new THREE.DirectionalLight('#ffffff', 2.8);
  sun.position.copy(sunDir).multiplyScalar(10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#a8c0dc', '#232830', .75));
  scene.add(new THREE.AmbientLight('#454e5c', .7));
  const nightFill = new THREE.PointLight('#3a4a66', .55);
  nightFill.position.set(-5, -2, -4);
  scene.add(nightFill);

  const stars = buildStars(reducedMotion ? 1500 : 3800);
  stars.visible = state.showStars && !exportMode;
  scene.add(stars);

  /* -- earth -- */
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);
  const sunDirView = { value: new THREE.Vector3() };
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: dayMap,
    normalMap,
    normalScale: new THREE.Vector2(.85, .85),
    specularMap,
    specular: new THREE.Color('#3a444e'),
    shininess: 14,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: lightsMap,
    emissiveIntensity: 1.0,
  });
  /* Night mask: real city lights appear only past the terminator. */
  earthMaterial.onBeforeCompile = shader => {
    shader.uniforms.uSunDirView = sunDirView;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirView;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float terraNight = smoothstep(.12, -.25, dot(normalize(vNormal), normalize(uSunDirView)));
        totalEmissiveRadiance *= terraNight;`);
  };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), earthMaterial);
  earthGroup.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 128, 96),
    new THREE.MeshLambertMaterial({ map: cloudsMap, transparent: true, opacity: .58, depthWrite: false }),
  );
  earthGroup.add(clouds);

  /* Atmosphere: view-dependent fresnel scattering, not flat shells.
     - halo: BackSide shell whose glow ring survives the planet's depth
       test, tinted warm-blue on the sun side and deep blue on the night
       side (single-scatter approximation);
     - haze: FrontSide rim on the visible hemisphere — the thin bright
       limb line that photographs of Earth actually show. */
  const atmosphereUniforms = { uSunDir: { value: sunDir } };
  const haloMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: atmosphereUniforms.uSunDir,
      uDay: { value: new THREE.Color('#7ec3ff') },
      uNight: { value: new THREE.Color('#16304f') },
      uIntensity: { value: 1.9 },
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
        float glow = pow(clamp(.62 - dot(vNormalView, vec3(0., 0., 1.)), 0., 1.45), 4.2);
        float sunFacing = clamp(dot(normalize(vPosW), normalize(uSunDir)) * .6 + .4, 0., 1.);
        vec3 color = mix(uNight, uDay, sunFacing);
        gl_FragColor = vec4(color * glow * uIntensity * (.3 + .7 * sunFacing), 1.);
      }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const atmosphereHalo = new THREE.Mesh(new THREE.SphereGeometry(1.17, 96, 64), haloMaterial);
  const hazeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: atmosphereUniforms.uSunDir,
      uColor: { value: new THREE.Color('#9fd0ff') },
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
      uniform vec3 uSunDir; uniform vec3 uColor;
      varying vec3 vNormalView; varying vec3 vPosW;
      void main() {
        float rim = pow(1. - clamp(dot(vNormalView, vec3(0., 0., 1.)), 0., 1.), 3.2);
        float sunFacing = clamp(dot(normalize(vPosW), normalize(uSunDir)) * .7 + .3, 0., 1.);
        gl_FragColor = vec4(uColor * rim * .55 * sunFacing, 1.);
      }`,
    side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const atmosphereHaze = new THREE.Mesh(new THREE.SphereGeometry(1.028, 96, 64), hazeMaterial);
  scene.add(atmosphereHalo, atmosphereHaze);

  /* Visible sun: a soft radial glow anchored on the real light direction,
     so the terminator has an on-screen cause. */
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 256;
  const sunCtx = sunCanvas.getContext('2d');
  const gradient = sunCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.12, 'rgba(255,244,214,.95)');
  gradient.addColorStop(.35, 'rgba(255,214,140,.32)');
  gradient.addColorStop(1, 'rgba(255,190,90,0)');
  sunCtx.fillStyle = gradient;
  sunCtx.fillRect(0, 0, 256, 256);
  const sunSpriteMaterial = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sunCanvas),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  sunSpriteMaterial.map.colorSpace = THREE.SRGBColorSpace;
  const sunSprite = new THREE.Sprite(sunSpriteMaterial);
  sunSprite.position.copy(sunDir).multiplyScalar(70);
  sunSprite.scale.setScalar(12);
  scene.add(sunSprite);

  /* -- city markers (children of earthGroup so they rotate with it) -- */
  const markerRoot = new THREE.Group();
  earthGroup.add(markerRoot);
  const markers = cities.map(city => {
    const anchor = new THREE.Group();
    const normal = latLonToVector(city.lat, city.lon).normalize();
    anchor.position.copy(normal).multiplyScalar(1.006);
    anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.009, 16, 16),
      new THREE.MeshBasicMaterial({ color: accent }));
    dot.material.toneMapped = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(.016, .021, 40),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .75, side: THREE.DoubleSide }));
    ring.material.toneMapped = false;
    anchor.add(dot, ring);
    markerRoot.add(anchor);
    return { city, anchor, ring, normal };
  });

  /* -- great-circle tour routes (drawn during the tour) -- */
  const resolution = new THREE.Vector2(1, 1);
  const routeRoot = new THREE.Group();
  earthGroup.add(routeRoot);
  const routes = cities.map((city, index) => {
    const nextCity = cities[(index + 1) % cities.length];
    const from = latLonToVector(city.lat, city.lon);
    const to = latLonToVector(nextCity.lat, nextCity.lon);
    const points = [];
    const steps = 72;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = new THREE.Vector3().copy(from).lerp(to, t).normalize();
      const lift = 1.01 + Math.sin(t * Math.PI) * .06 * from.angleTo(to);
      points.push(point.multiplyScalar(lift));
    }
    const geometry = new LineGeometry();
    geometry.setPositions(points.flatMap(p => [p.x, p.y, p.z]));
    const material = new LineMaterial({
      color: accent, linewidth: 2.2, transparent: true, opacity: .85,
      depthWrite: false, worldUnits: false, dashed: true,
    });
    material.resolution.copy(resolution);
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    const length = points.reduce((sum, p, i) => i ? sum + p.distanceTo(points[i - 1]) : 0, 0);
    material.dashSize = length;
    material.gapSize = length;
    material.dashOffset = length;   // fully hidden until drawn
    line.visible = false;
    routeRoot.add(line);
    return { line, material, length };
  });

  /* -- satellite (inertial: not a child of the rotating earth) -- */
  const satellite = buildSatellite();
  scene.add(satellite);
  const satOrbit = { radius: 1.55, inclination: THREE.MathUtils.degToRad(51.6), angle: 1.2, speed: (2 * Math.PI) / 16 };
  const satPosition = angle => new THREE.Vector3(
    satOrbit.radius * Math.cos(angle),
    satOrbit.radius * Math.sin(angle) * Math.sin(satOrbit.inclination),
    satOrbit.radius * Math.sin(angle) * Math.cos(satOrbit.inclination),
  );
  const TRAIL_POINTS = 90;
  const satTrailMaterial = new LineMaterial({
    color: accent, linewidth: 1.6, transparent: true, opacity: .5, depthWrite: false, worldUnits: false,
  });
  satTrailMaterial.resolution.copy(resolution);
  let satTrail = new Line2(new LineGeometry(), satTrailMaterial);
  scene.add(satTrail);
  const rebuildSatTrail = () => {
    const pts = [];
    for (let i = TRAIL_POINTS; i >= 0; i--) pts.push(satPosition(satOrbit.angle - i * .02));
    satTrail.geometry.dispose();
    satTrail.geometry = new LineGeometry();
    satTrail.geometry.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
  };

  /* -- post + camera -- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .65, .5, 1.5));
  const useBloom = () => state.showBloom;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1.45;
  controls.maxDistance = 6;
  controls.autoRotateSpeed = .4;
  controls.addEventListener('change', () => { if (finalPaused()) renderOnce(); });

  const resetView = () => {
    camera.position.set(0, .35, 3.1);
    controls.target.set(0, 0, 0);
    controls.update();
    renderOnce();
  };

  /* -- tiny tween runner (drives the tour flights) -- */
  const tweens = [];
  const tween = (duration, onUpdate, onDone) => {
    tweens.push({ elapsed: 0, duration, onUpdate, onDone });
  };
  const runTweens = delta => {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const item = tweens[i];
      item.elapsed += delta * 1000;
      const t = Math.min(1, item.elapsed / item.duration);
      item.onUpdate(easeInOut(t));
      if (t >= 1) { tweens.splice(i, 1); item.onDone?.(); }
    }
  };

  /* -- city tour -- */
  let dwellTimer = null;
  const setTelemetryCity = city => {
    telemetryEl.textContent = city
      ? `${city.name} · ${city.country} · ${formatCoords(city)}`
      : 'Serbest görünüm — turu başlatın';
  };

  const faceCity = (index, animate = true) => {
    const marker = markers[index];
    const camDir = camera.position.clone().sub(controls.target).normalize();
    /* rotate the globe so the city's world normal meets the camera direction */
    const currentNormal = marker.normal.clone().applyQuaternion(earthGroup.quaternion);
    const targetQuaternion = new THREE.Quaternion()
      .setFromUnitVectors(currentNormal, camDir)
      .multiply(earthGroup.quaternion);
    state.tourIndex = index;
    state.telemetry.city = marker.city;
    options.onTelemetry?.(state.telemetry);
    markers.forEach((m, i) => m.ring.material.opacity = i === index ? 1 : .45);
    if (!animate) {
      earthGroup.quaternion.copy(targetQuaternion);
      setTelemetryCity(marker.city);
      renderOnce();
      return;
    }
    const startQuaternion = earthGroup.quaternion.clone();
    const startDistance = camera.position.distanceTo(controls.target);
    tween(1700, t => {
      earthGroup.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, t);
      camera.position.setLength(Math.max(1.6, startDistance - (startDistance - 2.3) * t));
      controls.update();
    }, () => setTelemetryCity(marker.city));
    /* draw the route that arrives at this city */
    const routeIndex = (index - 1 + cities.length) % cities.length;
    const route = routes[routeIndex];
    if (state.showRoutes && state.tourActive) {
      route.line.visible = true;
      const start = route.material.dashOffset;
      tween(1500, t => { route.material.dashOffset = start * (1 - t); });
    }
  };

  const scheduleNext = () => {
    clearTimeout(dwellTimer);
    if (!state.tourActive) return;
    dwellTimer = setTimeout(() => {
      if (!state.tourActive) return;
      faceCity((state.tourIndex + 1) % cities.length);
      scheduleNext();
    }, 4300);
  };

  const tourButton = figure.querySelector('[data-action="tour"]');
  const setTour = active => {
    state.tourActive = active && !reducedMotion && !exportMode;
    tourButton.textContent = state.tourActive ? 'Turu durdur' : 'Turu başlat';
    tourButton.setAttribute('aria-pressed', String(state.tourActive));
    if (state.tourActive) {
      controls.autoRotate = false;
      faceCity(state.tourIndex < 0 ? 0 : state.tourIndex);
      scheduleNext();
    } else {
      clearTimeout(dwellTimer);
      setTelemetryCity(state.telemetry.city);
    }
    ensureLoop();
  };
  const nextCity = () => {
    faceCity(((state.tourIndex < 0 ? -1 : state.tourIndex) + 1) % cities.length);
    if (state.tourActive) scheduleNext();
    ensureLoop();
  };

  /* -- frame loop -- */
  let frame = null;
  const clock = new THREE.Clock();
  const step = delta => {
    if (!state.tourActive && !exportMode && !reducedMotion && !state.paused) {
      earthGroup.rotation.y += delta * state.rotationSpeed;
    }
    clouds.rotation.y += delta * state.rotationSpeed * .4;
    if (!exportMode && !reducedMotion) {
      satOrbit.angle += delta * satOrbit.speed * (state.paused && !state.tourActive ? 0 : 1);
    }
    satellite.position.copy(satPosition(satOrbit.angle));
    const ahead = satPosition(satOrbit.angle + .05);
    satellite.lookAt(ahead);
    satellite.visible = state.showSatellite;
    satTrail.visible = state.showSatellite;
    if (satellite.visible) rebuildSatTrail();
    if (stars.visible && !reducedMotion) stars.rotation.y += delta * .003;
    /* pulse the active marker */
    if (state.tourIndex >= 0) {
      const ring = markers[state.tourIndex].ring;
      ring.scale.setScalar(1 + .25 * Math.sin(clock.elapsedTime * 4.2));
    }
    sunDirView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    runTweens(delta);
    state.telemetry.satelliteAngle = satOrbit.angle;
  };
  const renderOnce = () => { if (useBloom()) composer.render(); else renderer.render(scene, camera); };
  const loop = () => {
    frame = null;
    if (finalPaused() && !tweens.length) return;
    const delta = Math.min(.1, clock.getDelta());
    controls.autoRotate = state.autoRotateCam && !state.tourActive;
    controls.update();
    step(delta);
    renderOnce();
    frame = requestAnimationFrame(loop);
  };
  const ensureLoop = () => {
    if (finalPaused() && !tweens.length) { step(0); renderOnce(); return; }
    if (frame === null) { clock.getDelta(); frame = requestAnimationFrame(loop); }
  };
  const onVisibility = () => ensureLoop();
  document.addEventListener('visibilitychange', onVisibility);

  /* -- sizing -- */
  const resize = () => {
    const width = Math.max(2, canvasHost.clientWidth);
    const height = Math.max(2, canvasHost.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resolution.set(width, height);
    routes.forEach(route => route.material.resolution.copy(resolution));
    satTrailMaterial.resolution.copy(resolution);
    renderOnce();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  resize();

  /* -- controls wiring -- */
  figure.querySelector('[data-input="spin"]').addEventListener('input', event => {
    const factor = Number(event.target.value);
    state.rotationSpeed = .05 * factor;
    figure.querySelector('[data-out="spin"]').textContent = `${factor.toFixed(1)}×`;
    ensureLoop();
  });
  figure.querySelectorAll('[data-toggle]').forEach(input => input.addEventListener('change', event => {
    state[input.dataset.toggle] = event.target.checked;
    stars.visible = state.showStars && !exportMode;
    clouds.visible = state.showClouds;
    atmosphereHalo.visible = atmosphereHaze.visible = state.showAtmosphere;
    routeRoot.visible = state.showRoutes;
    renderOnce();
  }));
  figure.querySelector('[data-action="tour"]').addEventListener('click', () => setTour(!state.tourActive));
  figure.querySelector('[data-action="next"]').addEventListener('click', nextCity);
  figure.querySelector('[data-action="resetView"]').addEventListener('click', resetView);
  figure.querySelector('[data-action="fullscreen"]').addEventListener('click', () => figure.requestFullscreen?.());
  figure.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') { event.preventDefault(); state.paused = !state.paused; ensureLoop(); }
    if (event.key.toLowerCase() === 'n') nextCity();
    if (event.key.toLowerCase() === 'r') { setTour(false); state.tourIndex = -1; setTelemetryCity(null); resetView(); }
    if (event.key === 'Escape') setTour(false);
  });

  /* -- deterministic modes: İstanbul faces the camera, satellite frozen -- */
  if (exportMode || reducedMotion) {
    faceCity(0, false);
    markers[0].ring.scale.setScalar(1.15);
  }

  step(0);
  renderOnce();
  ensureLoop();

  return {
    figure,
    cities,
    get telemetry() { return state.telemetry; },
    startTour: () => setTour(true),
    stopTour: () => setTour(false),
    nextCity,
    faceCity,
    resetView,
    setActive: value => {
      state.active = Boolean(value);
      if (!state.active) { setTour(false); }
      ensureLoop();
    },
    dispose: () => {
      clearTimeout(dwellTimer);
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      figure.remove();
    },
  };
}
