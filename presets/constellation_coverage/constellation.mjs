/* constellation.mjs — Takımyıldızı Kapsaması (constellation_coverage)

   scene-blocks "wave 2" ORBITAL bloğu. Walker Delta/Star takımyıldızı PARAMETRELERDEN
   üretilir (rastgele uydu yok): düzlemler, düzlem başına uydu, faz, eğiklik, irtifa,
   minimum yükseklik açısı. Görsel: uydular, yörünge düzlemleri, kapsama konileri, anlık
   yüzey ayak izleri, örtüşen kapsama (katlılık boyaması) ve kapsanmayan bölgeler; 2B
   haritada aynı boyama; istatistik HUD (kapsama oranı, katlılık, en uzun boşluk, yer
   istasyonundan görünen uydu sayısı). Çözücü: constellation-model.mjs (saf).

   API:
     const cc = await mountConstellation(host, { preset:'gps' | config:{planes,perPlane,phasing,inc,alt,minElev,kind}, station:{lat,lon}, warp, seed });
     cc.setConfig(cfg) · cc.setPreset(id) · cc.setStation(lat, lon) · cc.timeline · cc.stats · cc.constellation
     cc.advance(dt) · cc.setActive(b) · cc.hud(b) · cc.dispose()
   Sahne: ECI, X = x, Y = z, Z = −y; 1 birim = R_E. */

import * as THREE from 'three';
import { atmosphereShell, sunGlow } from '../core/lab-three.mjs';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { eksenX, coneGeoX } from '../core/geometry-axis.mjs';
import { buildConstellation, positionsAt, makeGrid, coverageAt, visibleFrom, revisitScan, CONSTELLATION_PRESETS, R_E, OMEGA_E, TAU } from './constellation-model.mjs';

const clamp01 = x => Math.min(1, Math.max(0, x));
const deg = x => x * 180 / Math.PI, rad = Math.PI / 180;
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function mountConstellation(host, options = {}) {
  if (!host) throw new Error('mountConstellation bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'cons';
  figure.innerHTML = `
    <style>
      .cons{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,12fr) minmax(0,8fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .cons__3d{position:relative;min-width:0;min-height:0;} .cons__3d canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
      .cons__side{min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:flex;flex-direction:column;}
      .cons__map{position:relative;} .cons__map canvas{display:block;width:100%;}
      .cons__stats{padding:12px 16px;font-size:12px;line-height:1.5;color:var(--color-muted,#9a938a);overflow:auto;}
      .cons__stats dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:3px 12px;}
      .cons__stats dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .cons__stats dd{margin:0;text-align:right;font-size:13px;color:var(--color-ink,#e9e4d8);font-variant-numeric:tabular-nums;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .cons__stats dd.hi{color:var(--color-accent,#d9b877);} .cons__stats .row{grid-column:1/-1;margin-top:6px;padding-top:6px;border-top:1px solid var(--color-rule,#3a3c42);font-size:11px;letter-spacing:.05em;}
      .cons__legend{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:11px;padding:6px 16px 0;color:var(--color-muted,#9a938a);}
      .cons__legend i{display:inline-block;width:14px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px;}
      .cons__hud{position:absolute;top:14px;left:14px;padding:8px 12px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;font-size:11px;letter-spacing:.06em;color:var(--color-accent,#d9b877);
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
    </style>
    <div class="cons__3d"><div class="cons__hud" data-hud></div></div>
    <div class="cons__side">
      <div class="cons__map"><canvas aria-label="Kapsama haritası"></canvas></div>
      <div class="cons__legend"><span><i style="background:rgba(215,143,108,.55)"></i>kapsanmıyor</span><span><i style="background:rgba(143,184,221,.25)"></i>1 uydu</span><span><i style="background:rgba(143,184,221,.5)"></i>2</span><span><i style="background:rgba(217,184,119,.65)"></i>3+</span><span><i style="background:#d9b877;border-radius:50%"></i>yer istasyonu</span></div>
      <div class="cons__stats" role="status"><dl>
        <dt>uydu</dt><dd data-s="T">—</dd><dt>düzlem × uydu</dt><dd data-s="PS">—</dd>
        <dt>eğiklik</dt><dd data-s="inc">—</dd><dt>irtifa</dt><dd data-s="alt">—</dd>
        <dt>ε min</dt><dd data-s="elev">—</dd><dt>ayak izi λ</dt><dd data-s="lam">—</dd>
        <dt>periyot</dt><dd data-s="per">—</dd><dt>faz F</dt><dd data-s="F">—</dd>
        <div class="row">ANLIK KAPSAMA</div>
        <dt>kapsanan</dt><dd data-s="cov" class="hi">—</dd><dt>katlılık</dt><dd data-s="mult">—</dd>
        <dt>kapsanmayan</dt><dd data-s="unc">—</dd><dt>istasyon görür</dt><dd data-s="vis" class="hi">—</dd>
        <div class="row">ZAMAN TARAMASI <span data-s="scanNote"></span></div>
        <dt>ort. kapsama</dt><dd data-s="mean">—</dd><dt>en düşük</dt><dd data-s="min">—</dd>
        <dt>en uzun boşluk</dt><dd data-s="gap" class="hi">—</dd><dt>sürekli kapsanan</dt><dd data-s="cont">—</dd>
      </dl></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.cons__3d'), mapCanvas = figure.querySelector('.cons__map canvas'), hudEl = figure.querySelector('[data-hud]');
  const S = {}; for (const el of figure.querySelectorAll('[data-s]')) S[el.dataset.s] = el;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const palette = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* -------- 3B */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(36, 1, .01, 600);
  const sunDir = new THREE.Vector3(1.4, .5, 1).normalize();
  const sun = new THREE.DirectionalLight('#fff4e6', 2); sun.position.copy(sunDir).multiplyScalar(80); scene.add(sun);
  scene.add(new THREE.HemisphereLight('#93a7bd', '#1c1e24', .55)); scene.add(new THREE.AmbientLight('#3c4250', .6));
  { const rand = mulberry32(seed), n = reducedMotion ? 600 : 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 220 + rand() * 150, th = rand() * TAU, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .65, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  const earth = new THREE.Group(); scene.add(earth);
  let dayImage = null;
  { const loader = new THREE.TextureLoader(); const url = rel => new URL(rel, import.meta.url).href;
    try { const day = await loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8; dayImage = day.image;
      earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshPhongMaterial({ map: day, specular: new THREE.Color('#2a3138'), shininess: 10 }))); }
    catch (error) { console.warn('constellation: doku yok —', error.message); earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .85 }))); } }
  scene.add(atmosphereShell(THREE, 1, '#6fb4ff', 1.4)); sunGlow(THREE, scene, sunDir, { dist: 300, size: 46 });
  /* kapsama boyaması: CanvasTexture, Dünya'nın çocuğu (ECEF ızgarası) */
  const NLON = 256, NLAT = 128;
  const covCanvas = document.createElement('canvas'); covCanvas.width = NLON; covCanvas.height = NLAT;
  const covCtx = covCanvas.getContext('2d'); const covImg = covCtx.createImageData(NLON, NLAT);
  const covTex = new THREE.CanvasTexture(covCanvas); covTex.colorSpace = THREE.SRGBColorSpace; covTex.magFilter = THREE.LinearFilter;
  const covSphere = new THREE.Mesh(new THREE.SphereGeometry(1.004, 128, 96), new THREE.MeshBasicMaterial({ map: covTex, transparent: true, depthWrite: false })); earth.add(covSphere);
  /* yer istasyonu (Dünya'nın çocuğu) */
  const station = new THREE.Mesh(new THREE.SphereGeometry(.014, 12, 10), new THREE.MeshBasicMaterial({ color: palette.accent })); earth.add(station);
  const lineMat = (color, width, opacity) => new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true });
  const mats = { plane: lineMat(palette.muted, 1, .35), foot: lineMat(palette.data1, 1.1, .55) };
  const planeGroup = new THREE.Group(); scene.add(planeGroup);
  /* uydular ve koniler: InstancedMesh (yeniden inşa yalnız konfigürasyon değişince, o anda görünmez) */
  let satMesh = null, coneMesh = null, footMesh = null;
  const satGeo = new THREE.SphereGeometry(.018, 10, 8);
  const satMat = new THREE.MeshStandardMaterial({ color: '#f1ead9', emissive: new THREE.Color(palette.accent), emissiveIntensity: .35, roughness: .4, metalness: .3 });
  const coneMat = new THREE.MeshBasicMaterial({ color: palette.data1, transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide });
  const footMat = new THREE.MeshBasicMaterial({ color: palette.data1, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide });

  /* -------- durum */
  let con = null, cfg = null, grid = makeGrid(NLON, NLAT), covCount = new Uint8Array(grid.N), stationLL = { lat: options.station?.lat ?? 39.9, lon: options.station?.lon ?? 32.9 };
  let scan = null, scanTimer = 0, theta0 = options.theta0 ?? .6, lastCov = null, covFrame = 0;
  const timeline = { t: 0, duration: 86400, playing: false, warp: options.warp ?? 60, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = Math.max(0, t); render(0, true); }, setWarp(w) { this.warp = w; } };
  const stats = { instant: null, scan: null, visible: 0 };

  function rebuild(newCfg) {
    cfg = { ...newCfg }; con = buildConstellation(cfg);
    /* düzlem halkaları */
    while (planeGroup.children.length) { const c = planeGroup.children.pop(); c.geometry.dispose(); }
    const rS = con.r / R_E, ci = Math.cos(con.inc), si = Math.sin(con.inc);
    for (let k = 0; k < con.P; k++) {
      const O = con.sats[k * con.S].raan, cO = Math.cos(O), sO = Math.sin(O), pts = [];
      for (let m = 0; m <= 128; m++) { const u = m / 128 * TAU, cu = Math.cos(u), su = Math.sin(u); const x = cO * cu - sO * su * ci, y = sO * cu + cO * su * ci, z = su * si; pts.push(x * rS, z * rS, -y * rS); }
      const g = new LineGeometry(); g.setPositions(pts); planeGroup.add(new Line2(g, mats.plane));
    }
    /* uydular / koniler / ayak izleri */
    for (const m of [satMesh, coneMesh, footMesh]) if (m) { scene.remove(m); m.geometry.dispose(); }
    satMesh = new THREE.InstancedMesh(satGeo, satMat, con.T); satMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(satMesh);
    const lam = con.lambda, d = rS - Math.cos(lam), rb = Math.sin(lam);
    /* koni: tepe uyduda, taban Dünya yüzeyindeki ayak izi çemberi; eksen yardımcı: +X tepe → −X yönü nadir */
    const coneGeo = coneGeoX(rb, d, 40, true); coneGeo.translate(-d / 2, 0, 0);   // tepe orijinde, taban −X'te
    coneMat.opacity = .07 * Math.min(1, 20 / Math.max(20, deg(lam)));   // geniş ayak izinde (MEO/GEO) koniler ekranı doldurur: saydamlık λ ile ölçeklenir
    coneMesh = new THREE.InstancedMesh(coneGeo, coneMat, con.T); coneMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(coneMesh);
    const footGeo = eksenX(new THREE.RingGeometry(rb * .985, rb * 1.0, 64)); footGeo.translate(-d, 0, 0);
    footMesh = new THREE.InstancedMesh(footGeo, footMat, con.T); footMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(footMesh);
    lastCov = null; covFrame = 0;
    placeStation();
    S.T.textContent = String(con.T); S.PS.textContent = `${con.P} × ${con.S}`; S.inc.textContent = `${nf1.format(cfg.inc)}°`; S.alt.textContent = `${nf0.format(cfg.alt)} km`;
    S.elev.textContent = `${nf1.format(cfg.minElev)}°`; S.lam.textContent = `${nf1.format(deg(con.lambda))}°`; S.per.textContent = `${nf1.format(con.period / 60)} dk`; S.F.textContent = `${cfg.phasing} (${cfg.kind === 'star' ? 'Star 180°' : 'Delta 360°'})`;
    hudEl.textContent = `${cfg.kind === 'star' ? 'Walker Star' : 'Walker Delta'} ${nf1.format(cfg.inc)}°: ${con.T}/${con.P}/${cfg.phasing} · ${nf0.format(cfg.alt)} km · ε ≥ ${nf1.format(cfg.minElev)}° · ${timeline.warp}× zaman`;
    scaleCamera();
    /* zaman taraması: ana iş parçacığını bloklamadan, kısa gecikmeyle */
    scan = null; S.scanNote.textContent = '· hesaplanıyor…'; for (const k of ['mean', 'min', 'gap', 'cont']) S[k].textContent = '…';
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { const t0 = performance.now(); scan = revisitScan(con, { dt: con.T > 200 ? 240 : 120, nLon: con.T > 200 ? 48 : 64, nLat: con.T > 200 ? 24 : 32, theta0 }); stats.scan = scan;
      S.scanNote.textContent = `· ${nf1.format(scan.span / 3600)} sa, ${scan.dt} s adım, ${nf0.format(performance.now() - t0)} ms`;
      S.mean.textContent = `${nf1.format(scan.meanFraction * 100)} %`; S.min.textContent = `${nf1.format(scan.minFraction * 100)} %`;
      S.gap.textContent = scan.maxGap > 0 ? (scan.maxGap >= 3600 ? `${nf1.format(scan.maxGap / 3600)} sa` : `${nf0.format(scan.maxGap / 60)} dk`) : 'yok'; S.cont.textContent = `${nf1.format(scan.continuousFraction * 100)} %`; }, 30);
  }
  function placeStation() { const la = stationLL.lat * rad, lo = stationLL.lon * rad; station.position.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(1.006); }

  /* -------- kapsama boyaması (ızgara → doku + harita) */
  const COL = { none: [215, 143, 108, 110], one: [143, 184, 221, 42], two: [143, 184, 221, 80], many: [217, 184, 119, 118] };
  function paintCoverage(t) {
    const cov = coverageAt(con, grid, t, theta0, covCount); stats.instant = cov;
    const d = covImg.data;
    for (let j = 0; j < NLAT; j++) for (let i = 0; i < NLON; i++) {
      const c = covCount[j * NLON + i]; const col = c === 0 ? COL.none : c === 1 ? COL.one : c === 2 ? COL.two : COL.many;
      const k = ((NLAT - 1 - j) * NLON + i) * 4; d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = col[3];
    }
    covCtx.putImageData(covImg, 0, 0); covTex.needsUpdate = true;
    S.cov.textContent = `${nf1.format(cov.fraction * 100)} %`; S.mult.textContent = nf2.format(cov.meanMultiplicity); S.unc.textContent = `${nf1.format(cov.uncovered * 100)} %`;
    const vis = visibleFrom(con, stationLL.lat, stationLL.lon, t, theta0); stats.visible = vis.length;
    S.vis.textContent = `${vis.length} uydu${vis.length ? ` · en yüksek ${nf0.format(deg(Math.max(...vis.map(v => v.elev))))}°` : ''}`;
  }

  /* -------- 2B harita */
  const mctx = mapCanvas.getContext('2d'); let mapW = 10, mapH = 5, dpr = 1;
  const X = lon => (lon / Math.PI + 1) / 2 * mapW, Y = lat => (1 - lat / (Math.PI / 2)) / 2 * mapH;
  function drawMap(t) {
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.fillStyle = '#0d1420'; mctx.fillRect(0, 0, mapW, mapH);
    if (dayImage) { mctx.globalAlpha = .5; mctx.drawImage(dayImage, 0, 0, mapW, mapH); mctx.globalAlpha = 1; }
    mctx.imageSmoothingEnabled = true; mctx.drawImage(covCanvas, 0, 0, mapW, mapH);
    mctx.strokeStyle = 'rgba(255,255,255,.12)'; mctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) { mctx.beginPath(); mctx.moveTo(X(lon * rad) + .5, 0); mctx.lineTo(X(lon * rad) + .5, mapH); mctx.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { mctx.beginPath(); mctx.moveTo(0, Y(lat * rad) + .5); mctx.lineTo(mapW, Y(lat * rad) + .5); mctx.stroke(); }
    /* alt-uydu noktaları + ayak izi çemberleri (küresel küçük çember) */
    const { ecefU } = positionsAt(con, t, theta0);
    const lam = con.lambda, sl = Math.sin(lam), cl = Math.cos(lam);
    mctx.strokeStyle = 'rgba(143,184,221,.7)'; mctx.lineWidth = 1;
    for (let k = 0; k < con.T; k++) {
      const ux = ecefU[k * 3], uy = ecefU[k * 3 + 1], uz = ecefU[k * 3 + 2];
      const la0 = Math.asin(uz), lo0 = Math.atan2(uy, ux);
      if (con.T <= 120) { mctx.beginPath(); let prev = null;
        for (let m = 0; m <= 48; m++) { const az = m / 48 * TAU; const la = Math.asin(Math.sin(la0) * cl + Math.cos(la0) * sl * Math.cos(az)); let lo = lo0 + Math.atan2(Math.sin(az) * sl * Math.cos(la0), cl - Math.sin(la0) * Math.sin(la)); lo = ((lo + Math.PI) % TAU + TAU) % TAU - Math.PI;
          if (prev == null || Math.abs(lo - prev) > Math.PI) mctx.moveTo(X(lo), Y(la)); else mctx.lineTo(X(lo), Y(la)); prev = lo; }
        mctx.stroke(); }
      mctx.fillStyle = palette.ink; mctx.beginPath(); mctx.arc(X(lo0), Y(la0), con.T > 200 ? 1.2 : 2.2, 0, TAU); mctx.fill();
    }
    mctx.fillStyle = palette.accent; mctx.beginPath(); mctx.arc(X(stationLL.lon * rad), Y(stationLL.lat * rad), 4, 0, TAU); mctx.fill(); mctx.strokeStyle = '#0b0c10'; mctx.lineWidth = 1.5; mctx.stroke();
  }

  /* -------- kamera */
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08;
  const cam = { dist: 6 };
  function scaleCamera() { cam.dist = Math.max(4.6, con.r / R_E * 2.4); camera.position.set(cam.dist * .55, cam.dist * .42, cam.dist * .72); controls.target.set(0, 0, 0); controls.update(); }

  /* -------- kare */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _nx = new THREE.Vector3(-1, 0, 0);
  function render(dtReal, force = false) {
    const t = timeline.t;
    earth.rotation.y = theta0 + OMEGA_E * t;
    const { eci } = positionsAt(con, t, theta0);
    const rS = 1 / R_E;
    for (let k = 0; k < con.T; k++) {
      _p.set(eci[k * 3] * rS, eci[k * 3 + 2] * rS, -eci[k * 3 + 1] * rS);
      _n.copy(_p).normalize().negate();                              // nadir
      _q.setFromUnitVectors(_nx, _n);                                // koni/halka: −X (taban yönü) → nadir
      _m.compose(_p, _q, _s); coneMesh.setMatrixAt(k, _m); footMesh.setMatrixAt(k, _m);
      _m.makeTranslation(_p.x, _p.y, _p.z); satMesh.setMatrixAt(k, _m);
    }
    satMesh.instanceMatrix.needsUpdate = coneMesh.instanceMatrix.needsUpdate = footMesh.instanceMatrix.needsUpdate = true;
    /* kapsama: her 2. karede (büyük takımyıldızda 4.) */
    if (force || lastCov == null || (covFrame++ % (con.T > 200 ? 4 : 2)) === 0) { paintCoverage(t); lastCov = t; drawMap(t); }
    controls.update();
    renderer.render(scene, camera);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0; const perf = { advanceMs: 0 };
  function advance(dt) { const t0 = performance.now(); if (timeline.playing) timeline.t += dt * timeline.warp; render(dt); perf.advanceMs = perf.advanceMs * .9 + (performance.now() - t0) * .1; }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() {
    const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    for (const m of Object.values(mats)) m.resolution.set(w, h);
    dpr = Math.min(devicePixelRatio || 1, 2); mapW = Math.max(10, figure.querySelector('.cons__side').clientWidth); mapH = Math.round(mapW / 2);
    mapCanvas.width = Math.round(mapW * dpr); mapCanvas.height = Math.round(mapH * dpr); mapCanvas.style.height = `${mapH}px`;
  }
  const ro = new ResizeObserver(() => { resize(); if (con) render(0, true); }); ro.observe(figure);

  rebuild(options.config || CONSTELLATION_PRESETS[options.preset || 'gps']);
  resize();
  if (reducedMotion || exportMode) timeline.t = options.t ?? 1800; else if (options.autoplay ?? true) timeline.playing = true;
  render(0, true); ensureLoop();

  return {
    get constellation() { return con; }, get config() { return { ...cfg }; }, stats, timeline, presets: CONSTELLATION_PRESETS,
    setConfig(c) { rebuild({ ...cfg, ...c }); render(0, true); }, setPreset(id) { rebuild(CONSTELLATION_PRESETS[id]); render(0, true); },
    setStation(lat, lon) { stationLL = { lat, lon }; placeStation(); render(0, true); },
    advance, perf, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { hudEl.hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); clearTimeout(scanTimer); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
