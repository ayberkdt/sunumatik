/* ground-track.mjs — 3B Yörünge + 2B Yer İzi (ground_track_3d)

   scene-blocks "wave 2" ORBITAL bloğu. AYNI yörünge iki eşzamanlı görünümde:
   solda dönen Dünya etrafında eylemsiz (ECI) yörünge + alt-uydu noktası +
   nadir çizgisi + küre üstüne işlenen yer izi; sağda açılmış eşdikdörtgen
   haritada yer izi (boylam sarımı kesilerek). Eğiklik / RAAN / irtifa /
   dış-merkezlik değişince iz GERÇEKTEN değişir: koordinat dönüşümünden gelir.
   Çözücü: ../core/astro-orbit.mjs (saf; Kepler + isteğe bağlı J2 seküler).

   API:
     const gt = await mountGroundTrack(host, { elements?, preset?:'iss', revs?, j2?, warp?, seed?, camera?, autoplay? });
     gt.setElements(el, { revs?, j2? })  · gt.setPreset('sso')
     gt.timeline{play,pause,scrub,t,duration,setWarp,warp,playing}
     gt.camera{ mode(m), transitionTo(m), current }   — orbit|pole|free
     gt.track (örnekler) · gt.info{ period, lonShiftPerRev, maxLat, j2Rates }
     gt.advance(dt) · gt.setActive(b) · gt.hud(b) · gt.dispose()

   Sahne çerçevesi = ECI: X = x, Y = z (kutup), Z = −y; 1 birim = R_E. Dünya kürsü
   rotation.y = θ0 + ω_e t (ECEF→ECI dönmesi). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { stateAt, groundTrack, periodOf, lonShiftPerRev, j2Rates, ORBIT_PRESETS, R_E, OMEGA_E, TAU } from '../core/astro-orbit.mjs';

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth01 = x => { const s = clamp01(x); return s * s * (3 - 2 * s); };
const eciToScene = (r, out) => out.set(r[0] / R_E, r[2] / R_E, -r[1] / R_E);
const ecefToLocal = (r, out) => out.set(r[0] / R_E, r[2] / R_E, -r[1] / R_E);
const deg = x => x * 180 / Math.PI;

function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function loadCraft() {
  try { const m = await import('../craft_blocks/craft-blocks.mjs'); return m.buildCubesat; }
  catch (error) { console.warn('ground-track: craft-blocks yok —', error.message); return () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .1, .1), new THREE.MeshStandardMaterial({ color: 0x8a877e }))); return g; }; }
}

export async function mountGroundTrack(host, options = {}) {
  if (!host) throw new Error('mountGroundTrack bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');

  const figure = document.createElement('figure');
  figure.className = 'gtrack';
  figure.innerHTML = `
    <style>
      .gtrack{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .gtrack__3d{position:relative;min-width:0;} .gtrack__3d canvas{display:block;width:100%;height:100%;}
      .gtrack__map{position:relative;min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:flex;flex-direction:column;}
      .gtrack__map canvas{display:block;width:100%;flex:0 0 auto;}
      .gtrack__mapinfo{padding:10px 14px;font-size:12px;color:var(--color-muted,#9a938a);line-height:1.5;}
      .gtrack__mapinfo b{color:var(--color-ink,#e9e4d8);font-family:var(--font-mono,ui-monospace,monospace);font-weight:500;}
      .gtrack__hud{position:absolute;top:14px;left:14px;min-width:210px;padding:10px 14px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
      .gtrack__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 14px;}
      .gtrack__hud dt{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted,#9a938a);align-self:baseline;}
      .gtrack__hud dd{margin:0;text-align:right;font-size:14px;font-variant-numeric:tabular-nums;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .gtrack__hud .warp{grid-column:1/-1;margin-top:4px;padding-top:5px;border-top:1px solid var(--color-rule,#3a3c42);font-size:11px;letter-spacing:.06em;color:var(--color-accent,#d9b877);text-align:right;}
      .gtrack__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .gtrack__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);text-shadow:0 1px 4px rgba(0,0,0,.9);}
    </style>
    <div class="gtrack__3d"><div class="gtrack__labels" aria-hidden="true"></div>
      <div class="gtrack__hud" role="status"><dl>
        <dt>t</dt><dd data-hud="t">—</dd><dt>enlem</dt><dd data-hud="lat">—</dd><dt>boylam</dt><dd data-hud="lon">—</dd>
        <dt>irtifa</dt><dd data-hud="alt">—</dd><dt>|v|</dt><dd data-hud="v">—</dd><dt>tur</dt><dd data-hud="rev">—</dd>
        <div class="warp" data-hud="warp"></div></dl></div></div>
    <div class="gtrack__map"><canvas aria-label="Yer izi haritası"></canvas><div class="gtrack__mapinfo" data-info></div></div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.gtrack__3d');
  const labelLayer = figure.querySelector('.gtrack__labels');
  const mapCanvas = figure.querySelector('.gtrack__map canvas');
  const infoEl = figure.querySelector('[data-info]');
  const hud = {}; for (const el of figure.querySelectorAll('[data-hud]')) hud[el.dataset.hud] = el;
  const css = getComputedStyle(figure);
  const tok = (name, fb) => (css.getPropertyValue(name) || '').trim() || fb;
  const palette = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), surface: tok('--color-surface', '#15161a') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* -------- 3B */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 600);
  const sunDir = new THREE.Vector3(1.6, .6, .9).normalize();
  const sun = new THREE.DirectionalLight('#fff4e6', 2.2); sun.position.copy(sunDir).multiplyScalar(80); scene.add(sun);
  scene.add(new THREE.HemisphereLight('#93a7bd', '#1c1e24', .5)); scene.add(new THREE.AmbientLight('#3c4250', .5));
  { const rand = mulberry32(seed), n = reducedMotion ? 700 : 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 200 + rand() * 150, th = rand() * TAU, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .7, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  const earth = new THREE.Group(); scene.add(earth);
  let dayImage = null;
  { const loader = new THREE.TextureLoader(); const url = rel => new URL(rel, import.meta.url).href;
    try {
      const [day, normal, spec] = await Promise.all([loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')), loader.loadAsync(url('../earth_advanced/textures/earth_normal_2048.jpg')), loader.loadAsync(url('../earth_advanced/textures/earth_specular_2048.jpg'))]);
      day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8; dayImage = day.image;
      earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshPhongMaterial({ map: day, normalMap: normal, normalScale: new THREE.Vector2(.7, .7), specularMap: spec, specular: new THREE.Color('#39434d'), shininess: 12 })));
    } catch (error) { console.warn('ground-track: doku yok —', error.message); earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .85 }))); }
    const atmoVert = `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.04, 96, 64), new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color('#6fb4ff') } }, vertexShader: atmoVert,
      fragmentShader: `uniform vec3 uColor; varying vec3 vN; void main(){ float g = pow(clamp(.6 - dot(vN, vec3(0.,0.,1.)), 0., 1.2), 3.5); gl_FragColor = vec4(uColor * g * .7, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment> }`, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }))); }
  /* kutup ekseni + ekvator halkası (referans) */
  const lineMat = (color, width, opacity) => new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true });
  const mats = { orbit: lineMat(palette.data1, 2, .9), track: lineMat(palette.accent, 2.2, .95), ref: lineMat(palette.muted, 1, .35), nadir: lineMat(palette.accent, 1.2, .8) };
  const mkLine = (pts, mat) => { const g = new LineGeometry(); g.setPositions(pts); return new Line2(g, mat); };
  scene.add(mkLine([0, -1.35, 0, 0, 1.35, 0], mats.ref));
  { const pts = []; for (let k = 0; k <= 128; k++) { const a = k / 128 * TAU; pts.push(Math.cos(a) * 1.002, 0, Math.sin(a) * 1.002); } scene.add(mkLine(pts, mats.ref)); }
  /* Greenwich meridyeni işareti (Dünya'nın çocuğu: dönmeyi görünür kılar) */
  { const pts = []; for (let k = 0; k <= 64; k++) { const a = -Math.PI / 2 + k / 64 * Math.PI; pts.push(Math.cos(a) * 1.003, Math.sin(a) * 1.003, 0); } earth.add(mkLine(pts, mats.ref)); }
  const labels = []; const addLabel = (text, pos, parent = null) => { const el = document.createElement('div'); el.className = 'gtrack__label'; el.textContent = text; labelLayer.appendChild(el); labels.push({ el, pos, parent }); };
  addLabel('Kuzey kutbu · dönme ekseni', new THREE.Vector3(0, 1.45, 0)); addLabel('Greenwich', new THREE.Vector3(0, -1.12, 0), earth);

  let orbitLine = mkLine([0, 0, 0, 0, 0, 0], mats.orbit); scene.add(orbitLine);
  let trackLine = mkLine([0, 0, 0, 0, 0, 0], mats.track); earth.add(trackLine);
  const nadirLine = mkLine([0, 0, 0, 0, 0, 0], mats.nadir); scene.add(nadirLine);
  const subPoint = new THREE.Mesh(new THREE.SphereGeometry(.012, 16, 12), new THREE.MeshBasicMaterial({ color: palette.accent })); scene.add(subPoint);
  const buildCubesat = await loadCraft();
  const sat = buildCubesat({ units: 3 }); scene.add(sat);

  /* -------- durum */
  let el, revs, j2, track = [], trackTimes = [], theta0 = options.theta0 ?? .6, info = {};
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 60, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = Math.min(this.duration, Math.max(0, t)); snapCamera = true; render(0); }, setWarp(w) { this.warp = w; } };

  function rebuild() {
    const T = periodOf(el.a);
    timeline.duration = revs * T;
    track = groundTrack(el, { tEnd: timeline.duration, dt: Math.max(5, T / 400), theta0, j2 });
    trackTimes = track.map(s => s.t);
    /* küre üstü iz (ECEF yerel, Dünya'nın çocuğu) — parçalı: sarım burada sorun değil (3B) */
    const v = new THREE.Vector3(); const pts = [];
    for (const s of track) { const c = Math.cos(theta0 + OMEGA_E * s.t), sn = Math.sin(theta0 + OMEGA_E * s.t); const ecef = [c * s.r[0] + sn * s.r[1], -sn * s.r[0] + c * s.r[1], s.r[2]]; const m = Math.hypot(...ecef); ecefToLocal(ecef.map(x => x / m * R_E * 1.004), v); pts.push(v.x, v.y, v.z); }
    earth.remove(trackLine); trackLine.geometry.dispose(); trackLine = mkLine(pts, mats.track); trackLine.geometry.instanceCount = 0; earth.add(trackLine);
    updateOrbitLine(0);
    const rates = j2Rates(el);
    info = { period: T, lonShiftPerRev: ((lonShiftPerRev(el, { j2 }) + Math.PI) % TAU + TAU) % TAU - Math.PI, maxLat: Math.min(el.i, Math.PI - el.i), j2Rates: rates, revs };
    scaleCamera();
    drawMapStatic();
  }
  const orbitPts = new Float32Array(257 * 3);
  function updateOrbitLine(t) {
    /* J2 açıkken düğüm/perigee kayar: elips t'nin fonksiyonu olarak yeniden örneklenir (özellik güncellemesi, popping yok) */
    const st = stateAt(el, t, { j2 });
    const e2 = { ...el, raan: st.raan, argp: st.argp };
    const v = new THREE.Vector3();
    for (let k = 0; k <= 256; k++) { const M = k / 256 * TAU; const s = stateAt({ ...e2, M0: M }, 0, { j2: false }); eciToScene(s.r, v); orbitPts[k * 3] = v.x; orbitPts[k * 3 + 1] = v.y; orbitPts[k * 3 + 2] = v.z; }
    scene.remove(orbitLine); orbitLine.geometry.dispose(); orbitLine = mkLine(Array.from(orbitPts), mats.orbit); scene.add(orbitLine);
  }
  let lastOrbitUpdate = -1e9;

  /* -------- 2B harita */
  const mctx = mapCanvas.getContext('2d');
  let mapW = 10, mapH = 5, mapDpr = 1;
  const X = lon => (lon / Math.PI + 1) / 2 * mapW, Y = lat => (1 - lat / (Math.PI / 2)) / 2 * mapH;
  let mapStatic = null;   // arkaplan + tam iz (soluk) — OffscreenCanvas
  function drawMapStatic() {
    mapStatic = document.createElement('canvas'); mapStatic.width = mapW * mapDpr; mapStatic.height = mapH * mapDpr;
    const c = mapStatic.getContext('2d'); c.scale(mapDpr, mapDpr);
    c.fillStyle = '#0d1420'; c.fillRect(0, 0, mapW, mapH);
    if (dayImage) { c.globalAlpha = .55; c.drawImage(dayImage, 0, 0, mapW, mapH); c.globalAlpha = 1; }
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) { c.beginPath(); c.moveTo(X(lon * Math.PI / 180) + .5, 0); c.lineTo(X(lon * Math.PI / 180) + .5, mapH); c.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { c.beginPath(); c.moveTo(0, Y(lat * Math.PI / 180) + .5); c.lineTo(mapW, Y(lat * Math.PI / 180) + .5); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(0, Y(0) + .5); c.lineTo(mapW, Y(0) + .5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '10px ui-monospace, monospace';
    for (let lon = -180; lon < 180; lon += 60) c.fillText(`${lon}°`, X(lon * Math.PI / 180) + 3, mapH - 4);
    for (let lat = -60; lat <= 60; lat += 30) c.fillText(`${lat}°`, 3, Y(lat * Math.PI / 180) - 3);
    /* tam iz — soluk */
    c.strokeStyle = palette.accent; c.globalAlpha = .28; c.lineWidth = 1.2;
    c.beginPath();
    for (let k = 0; k < track.length; k++) { const s = track[k]; if (k === 0 || s.brk) c.moveTo(X(s.lon), Y(s.lat)); else c.lineTo(X(s.lon), Y(s.lat)); }
    c.stroke(); c.globalAlpha = 1;
  }
  function drawMap(idx, cur) {
    mctx.setTransform(mapDpr, 0, 0, mapDpr, 0, 0);
    if (mapStatic) mctx.drawImage(mapStatic, 0, 0, mapW, mapH);
    /* uçulan iz — parlak */
    mctx.strokeStyle = palette.accent; mctx.lineWidth = 2; mctx.lineJoin = 'round';
    mctx.beginPath();
    for (let k = 0; k <= idx; k++) { const s = track[k]; if (k === 0 || s.brk) mctx.moveTo(X(s.lon), Y(s.lat)); else mctx.lineTo(X(s.lon), Y(s.lat)); }
    if (idx >= 0 && Math.abs(cur.lon - track[idx].lon) < Math.PI) mctx.lineTo(X(cur.lon), Y(cur.lat));
    mctx.stroke();
    /* anlık nokta + artı */
    const px = X(cur.lon), py = Y(cur.lat);
    mctx.strokeStyle = 'rgba(255,255,255,.35)'; mctx.lineWidth = 1; mctx.beginPath(); mctx.moveTo(px, 0); mctx.lineTo(px, mapH); mctx.moveTo(0, py); mctx.lineTo(mapW, py); mctx.stroke();
    mctx.fillStyle = palette.accent; mctx.beginPath(); mctx.arc(px, py, 4.5, 0, TAU); mctx.fill();
    mctx.strokeStyle = '#0b0c10'; mctx.lineWidth = 1.5; mctx.stroke();
  }

  /* -------- kamera */
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08; controls.enabled = false;
  const cam = { current: options.camera ?? 'orbit', dist: 5 };
  let snapCamera = true;
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3(0, 0, 0);
  function scaleCamera() { cam.dist = Math.max(4.8, (el.a * (1 + el.e)) / R_E * 2.3); }
  function poseFor(mode, out) {
    if (mode === 'pole') out.set(.4, cam.dist, .3);
    else { /* yörünge düzlemini kavrayan sabit eylemsiz açı: düğüm çizgisine dik, hafif yukarıdan */
      const az = el.raan - Math.PI / 2 + .35, elv = .42 + .4 * (1 - Math.abs(Math.cos(el.i)));
      out.set(Math.cos(az) * Math.cos(elv), Math.sin(elv), -Math.sin(az) * Math.cos(elv)).multiplyScalar(cam.dist); }
  }
  const poseB = new THREE.Vector3();
  function updateCamera(dtReal) {
    if (cam.current === 'free') { controls.enabled = true; controls.update(); return; }
    controls.enabled = false; poseFor(cam.current, poseB);
    if (snapCamera) camPos.copy(poseB); else camPos.lerp(poseB, 1 - Math.exp(-dtReal * 4));
    camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(camTarget); snapCamera = false;
  }

  /* -------- kare */
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  function render(dtReal) {
    const t = timeline.t;
    const theta = theta0 + OMEGA_E * t;
    earth.rotation.y = theta;
    const st = stateAt(el, t, { j2 });
    eciToScene(st.r, _v);
    sat.position.copy(_v);
    /* uydu: +X hız yönünde, +Z radyal dışa */
    { const vel = new THREE.Vector3(st.v[0], st.v[2], -st.v[1]).normalize(); const up = _v.clone().normalize(); const side = new THREE.Vector3().crossVectors(up, vel).normalize(); const up2 = new THREE.Vector3().crossVectors(vel, side).normalize(); sat.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(vel, side, up2)); }
    const satScale = .04 + .03 * smooth01((el.a - R_E) / 30000); sat.scale.setScalar(satScale * cam.dist / 4.8);
    _w.copy(_v).normalize().multiplyScalar(1.004); subPoint.position.copy(_w);
    nadirLine.geometry.setPositions([_v.x, _v.y, _v.z, _w.x, _w.y, _w.z]);
    if (j2 && Math.abs(t - lastOrbitUpdate) > info.period / 8) { updateOrbitLine(t); lastOrbitUpdate = t; }
    /* iz ilerlemesi */
    let lo = 0, hi = trackTimes.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; trackTimes[m] <= t ? lo = m : hi = m; }
    trackLine.geometry.instanceCount = Math.max(0, lo);
    /* anlık coğrafi konum */
    const c = Math.cos(theta), s = Math.sin(theta); const ecef = [c * st.r[0] + s * st.r[1], -s * st.r[0] + c * st.r[1], st.r[2]];
    const rho = Math.hypot(...ecef); const lat = Math.asin(ecef[2] / rho); let lon = Math.atan2(ecef[1], ecef[0]); lon = ((lon + Math.PI) % TAU + TAU) % TAU - Math.PI;
    drawMap(lo, { lat, lon });
    hud.t.textContent = `${Math.floor(t / 3600)} sa ${String(Math.floor((t % 3600) / 60)).padStart(2, '0')} dk`;
    hud.lat.textContent = `${nf2.format(deg(lat))}° ${lat >= 0 ? 'K' : 'G'}`;
    hud.lon.textContent = `${nf2.format(Math.abs(deg(lon)))}° ${lon >= 0 ? 'D' : 'B'}`;
    hud.alt.textContent = `${nf0.format(rho - R_E)} km`;
    hud.v.textContent = `${nf2.format(Math.hypot(...st.v))} km/s`;
    hud.rev.textContent = `${nf2.format(t / info.period)} / ${revs}`;
    hud.warp.textContent = `${timeline.warp}× zaman · ${j2 ? 'J2 seküler açık' : 'iki-cisim'}`;
    updateCamera(dtReal);
    const w = pane3d.clientWidth, h = pane3d.clientHeight;
    for (const l of labels) { _w.copy(l.pos); if (l.parent) l.parent.localToWorld(_w); _w.project(camera); const vis = _w.z < 1 && Math.abs(_w.x) < 1.05 && Math.abs(_w.y) < 1.05; l.el.style.display = vis ? '' : 'none'; if (vis) { l.el.style.left = `${((_w.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _w.y) / 2 * h).toFixed(1)}px`; } }
    renderer.render(scene, camera);
  }
  function writeInfo() {
    const r = info.j2Rates;
    infoEl.innerHTML = `Periyot <b>${nf1.format(info.period / 60)} dk</b> · tur başına boylam kayması <b>${nf1.format(deg(info.lonShiftPerRev))}°</b> `
      + `(= −ω_e·T${j2 ? ' + Ω̇·T' : ''}) · en yüksek enlem <b>${nf1.format(deg(info.maxLat))}°</b> (= i${el.i > Math.PI / 2 ? ', retrograd' : ''})`
      + (j2 ? ` · J2: Ω̇ <b>${nf2.format(deg(r.raanDot) * 86400)}°/gün</b>, ω̇ <b>${nf2.format(deg(r.argpDot) * 86400)}°/gün</b>` : '')
      + ` · lat = asin(z/r), lon = atan2(y,x) − θ(t), θ = θ₀ + ω_e t`;
  }

  let active = options.active ?? true, rafId = 0, lastNow = 0; const stats = { advanceMs: 0 };
  function advance(dt) { const t0 = performance.now(); if (timeline.playing) { timeline.t = Math.min(timeline.duration, timeline.t + dt * timeline.warp); if (timeline.t >= timeline.duration) timeline.playing = false; } render(dt); stats.advanceMs = stats.advanceMs * .9 + (performance.now() - t0) * .1; }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() {
    const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    for (const m of Object.values(mats)) m.resolution.set(w, h);
    mapDpr = Math.min(devicePixelRatio || 1, 2); mapW = Math.max(10, figure.querySelector('.gtrack__map').clientWidth); mapH = Math.round(mapW / 2);
    mapCanvas.width = Math.round(mapW * mapDpr); mapCanvas.height = Math.round(mapH * mapDpr); mapCanvas.style.height = `${mapH}px`;
    if (track.length) drawMapStatic();
  }
  const ro = new ResizeObserver(() => { resize(); render(0); }); ro.observe(figure);

  function setElements(newEl, opts = {}) {
    el = { ...newEl }; if (opts.revs != null) revs = opts.revs; if (opts.j2 != null) j2 = !!opts.j2;
    timeline.t = 0; rebuild(); writeInfo(); snapCamera = true; render(0);
  }
  el = { ...(options.elements || ORBIT_PRESETS[options.preset || 'iss']) }; revs = options.revs ?? 3; j2 = !!options.j2;
  resize(); rebuild(); writeInfo();
  /* tablo: uydunun kameraya EN YAKIN olduğu an (arkada kalan uyduyla donmuş kare anlatmaz) — sürenin son üçte biri hariç */
  function tableauTime() {
    poseFor(cam.current === 'free' ? 'orbit' : cam.current, poseB); const cd = poseB.clone().normalize(); const v = new THREE.Vector3();
    let best = 0, bestDot = -2;
    for (const s of track) { if (s.t > timeline.duration * .7) break; eciToScene(s.r, v); v.normalize(); const d = v.dot(cd); if (d > bestDot) { bestDot = d; best = s.t; } }
    return best;
  }
  if (reducedMotion || exportMode) timeline.t = tableauTime(); else if (options.autoplay ?? true) timeline.playing = true;
  snapCamera = true; render(0); render(0); ensureLoop();

  return {
    get elements() { return el; }, get track() { return track; }, get info() { return info; }, presets: ORBIT_PRESETS,
    setElements, setPreset(id, opts) { setElements(ORBIT_PRESETS[id], opts); },
    timeline, camera: { get current() { return cam.current; }, mode(m) { cam.current = m; snapCamera = true; render(0); }, transitionTo(m) { cam.current = m; render(0); } },
    get tableau() { return tableauTime(); },
    advance, stats, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.gtrack__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
