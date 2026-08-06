/* Lunaris vanilla port: the full WebGL lunar flight from
   ../moon_react_source, rebuilt on plain Three.js so any HTML deck
   can mount it without React. Feature parity with the R3F original:

   - aesthetic + gravity texture modes, displacement relief control;
   - 192x128-segment Moon, SRGB maps, anisotropy, slow spin, cinematic halo;
   - orbit camera drag/zoom, optional auto-rotation, view reset;
   - seeded star field, UnrealBloom post-processing (cinematic style);
   - 1200-sample trajectory playback with speed control;
   - fading historical trail (150 samples, 15 fat-line segments) and
     per-sample predicted future path;
   - modeled spacecraft: body, RCS blocks, docking rings, boom, solar
     panels, gimballed dish antenna, engine bell;
   - prograde/retrograde attitude slews (quaternion slerp);
   - animated burn plume: flickering outer cone, hot core, point light;
   - telemetry callback, truth caption, controls, Space/R/Esc keys,
     fullscreen, loading and error states;
   - export (?export=1 or html[data-export="true"]) freezes progress at
     exportProgress, hides stars/controls; reduced motion does the same
     without hiding the caption. Pauses when the document is hidden.

   Page requirements:
   1. An import map before any module script:
      {"imports": {"three": ".../moon_advanced/vendor/three.module.min.js"}}
   2. The original stylesheet:
      ../moon_react_source/components/moon_react_source.css
   3. assetBaseUrl pointing at ../moon_react_source/public/lunaris

   Truth level: illustrative playback of the local Lunaris visual prototype.
   Never present it as a mission ephemeris or high-fidelity propagation. */

import * as THREE from 'three';
import { OrbitControls } from './vendor/controls/OrbitControls.js';
import { Line2 } from './vendor/lines/Line2.js';
import { LineGeometry } from './vendor/lines/LineGeometry.js';
import { LineMaterial } from './vendor/lines/LineMaterial.js';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';

const TRAIL_LENGTH = 150;
const TRAIL_SEGMENTS = 15;
const FUTURE_SEGMENTS = 15;

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const domExport = () =>
  new URLSearchParams(location.search).get('export') === '1'
  || document.documentElement.dataset.export === 'true';

const isBurnIndex = index =>
  (index >= 270 && index <= 300)
  || (index >= 570 && index <= 600)
  || (index >= 870 && index <= 900)
  || index >= 1170
  || index < 5;

const isRetrogradeIndex = index =>
  (index >= 820 && index <= 930) || index >= 1120 || index <= 30;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Seeded spherical star shell — deterministic across exports. */
function buildStars(count, seed = 20260805) {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 100 + random() * 50;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#ffffff', size: .7, sizeAttenuation: true,
    transparent: true, opacity: .85, depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

const standard = options => new THREE.MeshStandardMaterial(options);
const HALF_PI = Math.PI / 2;

/* Full spacecraft model — every part of the R3F original. */
function buildSpacecraft() {
  const root = new THREE.Group();
  const craft = new THREE.Group();
  craft.scale.setScalar(3.4);
  root.add(craft);
  const add = (mesh, position, rotation) => {
    if (position) mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    craft.add(mesh);
    return mesh;
  };

  add(new THREE.Mesh(new THREE.BoxGeometry(.025, .025, .06),
    standard({ color: '#eeeeee', metalness: .6, roughness: .2 })));
  add(new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .04, 6),
    standard({ color: '#111111', metalness: .5, roughness: .8 })), null, [HALF_PI, 0, Math.PI / 6]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .015, 16),
    standard({ color: '#333333', metalness: .8, roughness: .2 })), [0, 0, .03], [HALF_PI, 0, 0]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .01, 16),
    standard({ color: '#1a1a1a', metalness: .9, roughness: .1 })), [0, 0, .04]);
  add(new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .08, 8),
    standard({ color: '#555555', metalness: .8, roughness: .4 })));

  const panelMaterial = () => standard({ color: '#0a192f', emissive: '#001122', metalness: .9, roughness: .1 });
  add(new THREE.Mesh(new THREE.BoxGeometry(.025, .07, .001), panelMaterial()), [0, .05, 0], [0, HALF_PI, 0]);
  add(new THREE.Mesh(new THREE.BoxGeometry(.025, .07, .001), panelMaterial()), [0, -.05, 0], [0, HALF_PI, 0]);

  const antenna = new THREE.Group();
  antenna.position.set(.015, 0, .01);
  antenna.rotation.set(0, -Math.PI / 6, -HALF_PI);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.001, .001, .01, 8),
    standard({ color: '#888888', metalness: .7 }));
  mast.position.set(0, .005, 0);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(.015, 16, 16, 0, Math.PI * 2, 0, HALF_PI),
    standard({ color: '#ffffff', metalness: .5, roughness: .3, side: THREE.DoubleSide }));
  dish.position.set(0, .01, 0);
  dish.rotation.set(Math.PI, 0, 0);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(.0005, .0005, .01, 8),
    standard({ color: '#555555', metalness: .9 }));
  feed.position.set(0, .015, 0);
  antenna.add(mast, dish, feed);
  craft.add(antenna);

  add(new THREE.Mesh(new THREE.ConeGeometry(.008, .015, 16),
    standard({ color: '#222222', metalness: .9, roughness: .5 })), [0, 0, -.033], [HALF_PI, 0, 0]);

  const thruster = new THREE.Mesh(new THREE.CylinderGeometry(.022, .001, .14, 16),
    standard({ color: '#ff8800', emissive: '#ff5500', emissiveIntensity: 1.5, transparent: true, opacity: .6 }));
  thruster.material.toneMapped = false;
  thruster.position.set(0, 0, -.09);
  thruster.rotation.set(HALF_PI, 0, 0);
  thruster.scale.setScalar(.001);
  craft.add(thruster);

  const thrusterCore = new THREE.Mesh(new THREE.CylinderGeometry(.009, .0005, .14, 8),
    standard({ color: '#ffffff', emissive: '#ffeeaa', emissiveIntensity: 3, transparent: true, opacity: .85 }));
  thrusterCore.material.toneMapped = false;
  thrusterCore.position.set(0, 0, -.09);
  thrusterCore.rotation.set(HALF_PI, 0, 0);
  thrusterCore.scale.setScalar(.001);
  craft.add(thrusterCore);

  const burnLight = new THREE.PointLight('#ffaa00', 0, 2.5);
  burnLight.position.set(0, 0, -.05);
  craft.add(burnLight);

  return { root, thruster, thrusterCore, burnLight };
}

function segmentRanges(length, count) {
  const size = length / count;
  return Array.from({ length: count }, (_, index) => [
    Math.floor(index * size),
    Math.min(length, Math.floor((index + 1) * size) + 1),
  ]).filter(([start, end]) => end - start > 1);
}

function makeFatLine(color, width, opacity, resolution) {
  const material = new LineMaterial({
    color, linewidth: width, transparent: true, opacity,
    depthWrite: false, worldUnits: false,
  });
  material.resolution.copy(resolution);
  const line = new Line2(new LineGeometry(), material);
  line.visible = false;
  return line;
}

function setLinePoints(line, flat) {
  if (flat.length < 6) { line.visible = false; return; }
  line.geometry.dispose();
  line.geometry = new LineGeometry();
  line.geometry.setPositions(flat);
  line.visible = true;
}

export async function mountLunaris(container, options = {}) {
  if (!container) throw new Error('mountLunaris requires a container element');
  const assetBaseUrl = options.assetBaseUrl || '../moon_react_source/public/lunaris';
  const dataKey = options.dataKey || 'path1';
  const cinematic = (options.visualStyle || 'cinematic') === 'cinematic';
  const accent = options.accent || '#00e5ff';
  const glowColor = options.glowColor || (cinematic ? '#00aeef' : '#5a2132');
  const exportMode = options.exportMode ?? domExport();
  const reducedMotion = prefersReduced();
  const exportProgress = options.exportProgress ?? .18;
  const title = options.title || 'Lunaris interactive lunar flight';

  const state = {
    textureMode: options.initialTextureMode || 'aesthetic',
    relief: options.initialRelief ?? .03,
    speed: options.initialSpeed ?? 3.5,
    paused: options.initialPaused ?? false,
    autoRotate: true,
    showPrediction: true,
    showTrail: true,
    showStars: true,
    showBloom: true,
    active: options.active ?? true,
    telemetry: { index: 150, burning: false },
  };
  const finalPaused = () => state.paused || reducedMotion || exportMode || !state.active;

  /* -- DOM scaffold (same classes as the React preset stylesheet) -- */
  const figure = document.createElement('figure');
  figure.className = 'lunaris-preset';
  figure.dataset.style = cinematic ? 'cinematic' : 'matte';
  figure.dataset.export = exportMode ? 'true' : 'false';
  figure.dataset.ownsKeys = '';
  figure.style.setProperty('--lunaris-accent', accent);
  figure.tabIndex = 0;
  figure.setAttribute('aria-label', title);
  figure.innerHTML = `
    <div class="lunaris-preset__canvas" aria-hidden="true"></div>
    <header class="lunaris-preset__heading"><span>LUNARIS · INTERACTIVE PRESET</span><h1>${title}</h1></header>
    <div class="lunaris-preset__loading" role="status">Loading lunar assets · 0%</div>
    <div class="lunaris-preset__controls" data-export-hide>
      <section class="lunaris-preset__panel lunaris-preset__panel--left" aria-label="Surface controls">
        <span class="lunaris-preset__panel-title">Surface model</span>
        <div class="lunaris-preset__segmented">
          <button type="button" data-mode="aesthetic" class="is-active">Aesthetic</button>
          <button type="button" data-mode="gravity">Gravity</button>
        </div>
        <label class="lunaris-preset__range">
          <span>Surface relief <output data-out="relief">0.030</output></span>
          <input data-input="relief" aria-label="Surface relief" type="range" min="0" max="0.08" step="0.002" value="${state.relief}">
        </label>
        <p class="lunaris-preset__warning" hidden>Relief above 0.05 is a cinematic exaggeration.</p>
      </section>
      <section class="lunaris-preset__panel lunaris-preset__panel--right" aria-label="Motion controls">
        <span class="lunaris-preset__panel-title">Flight controls</span>
        <div class="lunaris-preset__button-row">
          <button type="button" data-action="pause" aria-pressed="false">Pause</button>
          <button type="button" data-action="restart">Restart</button>
          <button type="button" data-action="resetView">Reset view</button>
        </div>
        <label class="lunaris-preset__range">
          <span>Playback speed <output data-out="speed">3.5×</output></span>
          <input data-input="speed" aria-label="Playback speed" type="range" min="0.25" max="6" step="0.25" value="${state.speed}">
        </label>
        <div class="lunaris-preset__toggles">
          <label><input type="checkbox" data-toggle="autoRotate" checked> Auto camera</label>
          <label><input type="checkbox" data-toggle="showPrediction" checked> Prediction</label>
          <label><input type="checkbox" data-toggle="showTrail" checked> Trail</label>
          <label><input type="checkbox" data-toggle="showStars" checked> Stars</label>
          <label><input type="checkbox" data-toggle="showBloom" checked> Bloom</label>
        </div>
        <button type="button" class="lunaris-preset__fullscreen" data-action="fullscreen">Fullscreen</button>
      </section>
    </div>
    <figcaption class="lunaris-preset__truth">
      <strong>Illustrative trajectory playback</strong>
      <span data-telemetry>Sample 151/1200 · coast phase</span>
      <small>Imported from the local Lunaris visual prototype. Not a mission ephemeris or high-fidelity propagator.</small>
    </figcaption>
    <p class="lunaris-preset__help" data-export-hide>Drag to orbit · wheel to zoom · Space play/pause · R restart · Esc pause</p>`;
  container.appendChild(figure);
  const canvasHost = figure.querySelector('.lunaris-preset__canvas');
  const loadingEl = figure.querySelector('.lunaris-preset__loading');
  const telemetryEl = figure.querySelector('[data-telemetry]');

  /* -- data + textures -- */
  let dataset;
  try {
    const response = await fetch(`${assetBaseUrl}/orbit-data.json`);
    if (!response.ok) throw new Error(`Orbit data returned ${response.status}`);
    dataset = await response.json();
  } catch (error) {
    loadingEl.textContent = `Orbit data could not load: ${error.message}`;
    loadingEl.classList.add('lunaris-preset__loading--error');
    loadingEl.setAttribute('role', 'alert');
    return { figure, dispose: () => figure.remove(), setActive() {}, error };
  }
  const pathData = dataset[dataKey];
  const points = pathData.path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const total = points.length;

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, loaded, totalItems) => {
    loadingEl.textContent = `Loading lunar assets · ${Math.round((loaded / totalItems) * 100)}%`;
  };
  const loader = new THREE.TextureLoader(manager);
  const [gravityMap, aestheticMap, displacementMap] = await Promise.all([
    loader.loadAsync(`${assetBaseUrl}/textures/gravity_moon_real.webp`),
    loader.loadAsync(`${assetBaseUrl}/textures/aesthetic_moon_real.webp`),
    loader.loadAsync(`${assetBaseUrl}/textures/moon_disp_real.webp`),
  ]).catch(error => {
    loadingEl.textContent = `Textures could not load: ${error.message}`;
    loadingEl.classList.add('lunaris-preset__loading--error');
    throw error;
  });
  gravityMap.colorSpace = THREE.SRGBColorSpace;
  aestheticMap.colorSpace = THREE.SRGBColorSpace;
  gravityMap.anisotropy = 8;
  aestheticMap.anisotropy = 8;
  displacementMap.anisotropy = 4;
  loadingEl.remove();

  /* -- renderer, scene, camera -- */
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  canvasHost.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cinematic ? '#05050a' : '#f3eec8');
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 400);
  camera.position.set(0, 0, 5);

  scene.add(new THREE.AmbientLight('#ffffff', cinematic ? .36 : .75));
  const sun = new THREE.DirectionalLight('#ffffff', cinematic ? 2 : 2.4);
  sun.position.set(5, 3, 5);
  scene.add(sun);
  const fill = new THREE.PointLight(cinematic ? '#445588' : '#bcd3e7', .55);
  fill.position.set(-5, -5, -5);
  scene.add(fill);

  const stars = buildStars(reducedMotion ? 1700 : 4200);
  stars.visible = state.showStars && !exportMode;
  scene.add(stars);

  /* -- moon -- */
  const moonGroup = new THREE.Group();
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: state.textureMode === 'aesthetic' ? aestheticMap : gravityMap,
    displacementMap, displacementScale: state.relief,
    roughness: state.textureMode === 'aesthetic' ? .72 : .9, metalness: .08,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), moonMaterial);
  moonGroup.add(moon);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: state.textureMode === 'aesthetic' ? '#a0c0d0' : '#00e5ff',
    transparent: true, opacity: .055, side: THREE.BackSide, depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.065, 96, 64), haloMaterial);
  halo.visible = cinematic;
  moonGroup.add(halo);
  scene.add(moonGroup);
  let moonSpin = .34;

  /* -- orbit lines -- */
  const resolution = new THREE.Vector2(1, 1);
  const fullPath = makeFatLine(glowColor, .8, .12, resolution);
  setLinePoints(fullPath, points.flatMap(p => [p.x, p.y, p.z]));
  scene.add(fullPath);

  const futureLines = Array.from({ length: FUTURE_SEGMENTS }, () => makeFatLine(glowColor, 1.1, .3, resolution));
  const trailLines = Array.from({ length: TRAIL_SEGMENTS }, () => ({
    accent: makeFatLine(accent, 2.7, .9, resolution),
    core: makeFatLine('#ffffff', 1, .8, resolution),
  }));
  futureLines.forEach(line => scene.add(line));
  trailLines.forEach(pair => { scene.add(pair.accent); scene.add(pair.core); });

  const craft = buildSpacecraft();
  scene.add(craft.root);

  /* -- post-processing -- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.45, .4, 1.35);
  composer.addPass(bloomPass);
  const useBloom = () => cinematic && state.showBloom;

  /* -- camera controls -- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 2.35;
  controls.maxDistance = 8;
  controls.autoRotateSpeed = .5;
  controls.addEventListener('change', () => { if (finalPaused()) renderOnce(); });

  const resetView = () => {
    camera.position.set(0, 0, 5);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    controls.update();
    renderOnce();
  };

  /* -- playback state -- */
  let progress = exportMode || reducedMotion ? exportProgress * total : 150;
  let burnTime = 0;
  let lastIndex = -1;
  const clock = new THREE.Clock();

  const rebuildSampleLines = index => {
    const trail = Array.from({ length: TRAIL_LENGTH }, (_, offset) =>
      points[(index - TRAIL_LENGTH + offset + total) % total]);
    segmentRanges(TRAIL_LENGTH, TRAIL_SEGMENTS).forEach(([start, end], i) => {
      const ratio = i / Math.max(1, TRAIL_SEGMENTS - 1);
      const flat = trail.slice(start, end).flatMap(p => [p.x, p.y, p.z]);
      const pair = trailLines[i];
      setLinePoints(pair.accent, flat);
      setLinePoints(pair.core, flat);
      pair.accent.material.opacity = ratio ** 1.5 * .92;
      pair.core.material.opacity = ratio ** 2;
      pair.accent.visible = pair.accent.visible && state.showTrail;
      pair.core.visible = pair.core.visible && state.showTrail;
    });
    const future = (pathData.future_paths?.[String(index)] || []).map(p => new THREE.Vector3(p[0], p[1], p[2]));
    futureLines.forEach(line => { line.visible = false; });
    if (future.length > 1) {
      segmentRanges(future.length, FUTURE_SEGMENTS).forEach(([start, end], i) => {
        const remaining = 1 - i / Math.max(1, FUTURE_SEGMENTS - 1);
        const line = futureLines[i];
        setLinePoints(line, future.slice(start, end).flatMap(p => [p.x, p.y, p.z]));
        line.material.opacity = Math.max(.025, remaining ** 1.5 * .46);
        line.visible = line.visible && state.showPrediction;
      });
    }
  };

  const step = delta => {
    if (exportMode || reducedMotion) progress = THREE.MathUtils.clamp(exportProgress, 0, 1) * total;
    else if (!state.paused && state.active) progress = (progress + delta * state.speed * 2.5) % total;

    const index = Math.floor(progress) % total;
    const lerp = progress - Math.floor(progress);
    craft.root.position.lerpVectors(points[index], points[(index + 1) % total], lerp);

    const velocity = new THREE.Vector3().subVectors(points[(index + 1) % total], points[index]).normalize();
    const attitude = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), velocity);
    if (isRetrogradeIndex(index)) {
      attitude.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)));
    }
    if (exportMode || reducedMotion) craft.root.quaternion.copy(attitude);
    else craft.root.quaternion.slerp(attitude, 1 - Math.exp(-delta * .9));

    const burning = isBurnIndex(index);
    if (burning) {
      burnTime = exportMode || reducedMotion ? index * .031 : burnTime + delta;
      const t = burnTime;
      const flicker1 = .85 + .15 * Math.sin(t * 23.7);
      const flicker2 = .9 + .1 * Math.sin(t * 41.3 + 1.2);
      const flicker3 = .95 + .05 * Math.sin(t * 17.1 + 2.4);
      const flicker = flicker1 * flicker2 * flicker3;
      const length = flicker * (.9 + .1 * Math.sin(t * 8.3));
      const width = 1 + .08 * Math.sin(t * 31);
      craft.thruster.scale.set(width, width, length);
      craft.thrusterCore.scale.set(width * .5, width * .5, length * 1.1);
      craft.thruster.material.emissiveIntensity = 1.2 + .8 * flicker;
      craft.thruster.material.opacity = .55 + .15 * flicker;
      craft.thrusterCore.material.emissiveIntensity = 2.5 + 1.5 * flicker;
      craft.thrusterCore.material.opacity = .7 + .2 * flicker1;
      craft.burnLight.intensity = .8 + .6 * flicker;
      craft.burnLight.color.setHSL(.08 + .02 * flicker2, 1, .6);
    } else {
      burnTime = 0;
      const zero = new THREE.Vector3(.001, .001, .001);
      craft.thruster.scale.lerp(zero, .24);
      craft.thrusterCore.scale.lerp(zero, .24);
      craft.burnLight.intensity = THREE.MathUtils.lerp(craft.burnLight.intensity, 0, .24);
    }

    if (exportMode || reducedMotion) moonSpin = .34;
    else if (!state.paused && state.active) moonSpin += delta * .05;
    moonGroup.rotation.set(.1, moonSpin, 0);

    if (stars.visible && !reducedMotion) stars.rotation.y += delta * .0045;

    if (index !== lastIndex) {
      lastIndex = index;
      state.telemetry = { index, burning };
      telemetryEl.textContent = `Sample ${index + 1}/${total} · ${burning ? 'illustrative burn active' : 'coast phase'}`;
      options.onTelemetry?.(state.telemetry);
      rebuildSampleLines(index);
    }
  };

  const renderOnce = () => { if (useBloom()) composer.render(); else renderer.render(scene, camera); };

  let frame = null;
  const loop = () => {
    frame = null;
    if (finalPaused() || document.hidden) return;
    const delta = Math.min(.1, clock.getDelta());
    controls.autoRotate = state.autoRotate;
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
    [fullPath, ...futureLines, ...trailLines.flatMap(p => [p.accent, p.core])]
      .forEach(line => line.material.resolution.copy(resolution));
    renderOnce();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  resize();

  /* -- controls wiring -- */
  const pauseButton = figure.querySelector('[data-action="pause"]');
  const syncPause = () => {
    pauseButton.textContent = reducedMotion ? 'Motion off' : state.paused ? 'Play' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(state.paused || reducedMotion));
    pauseButton.disabled = reducedMotion;
    ensureLoop();
  };
  const setTextureMode = mode => {
    state.textureMode = mode;
    moonMaterial.map = mode === 'aesthetic' ? aestheticMap : gravityMap;
    moonMaterial.roughness = mode === 'aesthetic' ? .72 : .9;
    moonMaterial.needsUpdate = true;
    haloMaterial.color.set(mode === 'aesthetic' ? '#a0c0d0' : '#00e5ff');
    figure.querySelectorAll('[data-mode]').forEach(button =>
      button.classList.toggle('is-active', button.dataset.mode === mode));
    renderOnce();
  };
  figure.querySelectorAll('[data-mode]').forEach(button =>
    button.addEventListener('click', () => setTextureMode(button.dataset.mode)));
  figure.querySelector('[data-input="relief"]').addEventListener('input', event => {
    state.relief = Number(event.target.value);
    moonMaterial.displacementScale = state.relief;
    figure.querySelector('[data-out="relief"]').textContent = state.relief.toFixed(3);
    figure.querySelector('.lunaris-preset__warning').hidden = state.relief <= .05;
    renderOnce();
  });
  figure.querySelector('[data-input="speed"]').addEventListener('input', event => {
    state.speed = Number(event.target.value);
    figure.querySelector('[data-out="speed"]').textContent = `${state.speed.toFixed(1)}×`;
  });
  const restart = () => { progress = 150; lastIndex = -1; state.paused = false; syncPause(); };
  figure.querySelector('[data-action="restart"]').addEventListener('click', restart);
  figure.querySelector('[data-action="resetView"]').addEventListener('click', resetView);
  figure.querySelector('[data-action="fullscreen"]').addEventListener('click', () => figure.requestFullscreen?.());
  pauseButton.addEventListener('click', () => { state.paused = !state.paused; syncPause(); });
  figure.querySelectorAll('[data-toggle]').forEach(input => input.addEventListener('change', event => {
    state[input.dataset.toggle] = event.target.checked;
    if (input.dataset.toggle === 'showStars') stars.visible = state.showStars && !exportMode;
    if (input.dataset.toggle === 'showTrail' || input.dataset.toggle === 'showPrediction') rebuildSampleLines(lastIndex < 0 ? 150 : lastIndex);
    renderOnce();
  }));
  figure.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') { event.preventDefault(); state.paused = !state.paused; syncPause(); }
    if (event.key.toLowerCase() === 'r') restart();
    if (event.key === 'Escape') { state.paused = true; syncPause(); }
  });

  /* -- first frame + loop -- */
  step(0);
  syncPause();
  renderOnce();
  ensureLoop();

  return {
    figure,
    get telemetry() { return state.telemetry; },
    play: () => { state.paused = false; syncPause(); },
    pause: () => { state.paused = true; syncPause(); },
    restart,
    resetView,
    setActive: value => { state.active = Boolean(value); syncPause(); },
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
