/* eclipse-geometry.mjs — Tutulma / Örtülme / Görünürlük Sahnesi (eclipse_geometry)

   Tek geometri modeli (eclipse-model.mjs, saf), üç soru: uydu ne zaman gölgede (umbra/penumbra,
   sonlu Güneş diski), yer istasyonu uyduyu ne zaman görür (AOS/LOS, dönen Dünya), sensör hedefi
   ve röle bağlantısı ne zaman Dünya arkasında kalır (LOS örtülmesi, atmosfer teğet yüksekliği).
   3B: Güneş yönü, umbra/penumbra konileri, yörünge, gölge fonksiyonuyla renklenen uydu, istasyon
   çizgisi (görünür/görünmez), röle LOS çizgisi, sensör ışını. 2B: olay zaman çizelgesi bantları
   (güneş / penumbra / umbra, istasyon, sensör, bağlantı) + ν(t) ve ε(t) grafiği.

   API:
     const ec = await mountEclipse(host, { preset:'iss', dayOfYear, revs, station:{lat,lon,maskDeg}, relayPreset:'geo', star:[x,y,z], hAtm, warp });
     ec.set({...}) · ec.analysis · ec.timeline · ec.dispose()
   Sahne: ECI (X = x, Y = z, Z = −y); 1 birim = R_E. */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { coneGeoX, cylGeoX } from '../core/geometry-axis.mjs';
import { analyze, shadowFunction, stationEcef, R_SUN, AU } from './eclipse-model.mjs';
import { stateAt, ORBIT_PRESETS, R_E, OMEGA_E, TAU } from '../core/astro-orbit.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const deg = x => x * 180 / Math.PI;
const toScene = (r, out) => out.set(r[0] / R_E, r[2] / R_E, -r[1] / R_E);
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function mountEclipse(host, options = {}) {
  if (!host) throw new Error('mountEclipse bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'ecl';
  figure.innerHTML = `
    <style>
      .ecl{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .ecl__3d{position:relative;min-width:0;} .ecl__3d canvas{display:block;width:100%;height:100%;}
      .ecl__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .ecl__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);text-shadow:0 1px 4px rgba(0,0,0,.9);}
      .ecl__side{min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr) minmax(0,1fr);}
      .ecl__hud{padding:10px 14px;border-bottom:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .ecl__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px;} .ecl__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .ecl__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);} .ecl__hud dd.hi{color:var(--color-accent,#d9b877);} .ecl__hud dd.bad{color:var(--color-data-2,#d78f6c);} .ecl__hud dd.ok{color:#8fd39a;}
      .ecl__plot{position:relative;min-height:0;border-bottom:1px solid var(--color-rule,#3a3c42);} .ecl__plot canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .ecl__top{position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);pointer-events:none;}
    </style>
    <div class="ecl__3d"><div class="ecl__labels" aria-hidden="true"></div><div class="ecl__top" data-top></div></div>
    <div class="ecl__side">
      <div class="ecl__hud" role="status"><dl>
        <dt>t</dt><dd data-h="t">—</dd><dt>gölge ν</dt><dd data-h="nu" class="hi">—</dd>
        <dt>bölge</dt><dd data-h="reg">—</dd><dt>β / β*</dt><dd data-h="beta">—</dd>
        <dt>umbra / tur</dt><dd data-h="umb">—</dd><dt>penumbra oranı</dt><dd data-h="pen">—</dd>
        <dt>istasyon ε</dt><dd data-h="elev">—</dd><dt>görünür</dt><dd data-h="vis">—</dd>
        <dt>sensör hedefi</dt><dd data-h="star">—</dd><dt>röle bağlantısı</dt><dd data-h="link">—</dd>
        <dt>sonraki olay</dt><dd data-h="next">—</dd><dt>geçiş sayısı</dt><dd data-h="passes">—</dd>
      </dl></div>
      <div class="ecl__plot"><canvas data-plot="bands" aria-label="Olay bantları"></canvas></div>
      <div class="ecl__plot"><canvas data-plot="curves" aria-label="ν ve yükseklik açısı"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.ecl__3d'), labelLayer = figure.querySelector('.ecl__labels'), topEl = figure.querySelector('[data-top]');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  const GREEN = '#8fd39a';

  /* -------- 3B */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 600);
  const sun = new THREE.DirectionalLight('#fff4e6', 2.4); scene.add(sun); scene.add(new THREE.HemisphereLight('#6f86a1', '#141518', .35)); scene.add(new THREE.AmbientLight('#2c3038', .5));
  { const rand = mulberry32(seed), n = reducedMotion ? 600 : 1400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 200 + rand() * 150, th = rand() * TAU, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .65, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  const earth = new THREE.Group(); scene.add(earth);
  { const loader = new THREE.TextureLoader(); const url = rel => new URL(rel, import.meta.url).href;
    try { const day = await loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')); day.colorSpace = THREE.SRGBColorSpace; earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhongMaterial({ map: day, specular: new THREE.Color('#2a3138'), shininess: 10 }))); }
    catch (e) { earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .85 }))); } }
  const mats = []; const lineMat = (color, width, opacity) => { const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true }); mats.push(m); return m; };
  const mkLine = (pts, mat) => { const g = new LineGeometry(); g.setPositions(pts); return new Line2(g, mat); };
  const labels = []; const addLabel = (text, pos, color = P.muted) => { const el = document.createElement('div'); el.className = 'ecl__label'; el.textContent = text; el.style.color = color; labelLayer.appendChild(el); labels.push({ el, pos }); return el; };
  /* gölge konileri: umbra (yakınsak) ve penumbra (ıraksak) — geometri Güneş/Dünya yarıçaplarından; koni ekseni −ŝ */
  const shadowGroup = new THREE.Group(); scene.add(shadowGroup);
  const umbraLen = R_E * AU / (R_SUN - R_E) / R_E;                                   // birim: R_E (≈ 216)
  const drawLen = 4.5;                                                                 // sahnede gösterilen uzunluk (R_E)
  const umbraRadiusAt = L => 1 - L / umbraLen, penumbraRadiusAt = L => 1 + L * (R_SUN + R_E) / AU;
  /* kesik koniler cylGeoX ile: pozitif uç Dünya'da (yarıçap 1), negatif uç uzakta — eksen −ŝ boyunca yönlendirilir */
  const umbraMesh = new THREE.Mesh(cylGeoX(1, umbraRadiusAt(drawLen), drawLen, 48, true), new THREE.MeshBasicMaterial({ color: '#05060a', transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }));
  const penMesh = new THREE.Mesh(cylGeoX(1.002, penumbraRadiusAt(drawLen), drawLen, 48, true), new THREE.MeshBasicMaterial({ color: '#2b3040', transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }));
  umbraMesh.position.x = -drawLen / 2; penMesh.position.x = -drawLen / 2;   // +X ucu orijinde
  shadowGroup.add(umbraMesh, penMesh);
  const sunArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 3.4, 0xffd27a, .28, .16); scene.add(sunArrow);
  const orbitLine = mkLine([0, 0, 0, 0, 0, 0], lineMat(P.data1, 1.6, .8)); scene.add(orbitLine);
  const sat = new THREE.Mesh(new THREE.SphereGeometry(.045, 14, 10), new THREE.MeshBasicMaterial({ color: P.accent })); scene.add(sat);
  const station = new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), new THREE.MeshBasicMaterial({ color: GREEN })); earth.add(station);
  const stLine = mkLine([0, 0, 0, 0, 0, 0], lineMat(GREEN, 1.4, .9)); scene.add(stLine);
  const relay = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10), new THREE.MeshBasicMaterial({ color: P.data2 })); scene.add(relay);
  const relayLine = mkLine([0, 0, 0, 0, 0, 0], lineMat(P.data2, 1.3, .9)); scene.add(relayLine);
  const relayOrbit = mkLine([0, 0, 0, 0, 0, 0], lineMat(P.data2, 1, .3)); scene.add(relayOrbit);
  const starLine = mkLine([0, 0, 0, 0, 0, 0], lineMat(P.ink, 1.2, .8)); scene.add(starLine);
  addLabel('umbra', new THREE.Vector3(0, 0, 0)).dataset.k = 'umbra'; addLabel('penumbra', new THREE.Vector3(0, 0, 0)).dataset.k = 'pen'; addLabel('Güneş →', new THREE.Vector3(0, 0, 0), '#ffd27a').dataset.k = 'sun'; addLabel('yer istasyonu', new THREE.Vector3(0, 0, 0), GREEN).dataset.k = 'st'; addLabel('röle (GEO)', new THREE.Vector3(0, 0, 0), P.data2).dataset.k = 'relay'; addLabel('sensör hedefi (yıldız) →', new THREE.Vector3(0, 0, 0), P.ink).dataset.k = 'star';
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08;

  let cfg = { preset: options.preset ?? 'iss', dayOfYear: options.dayOfYear ?? 80, revs: options.revs ?? 2, station: options.station ?? { lat: 39.9, lon: 32.9, maskDeg: 5 }, relayPreset: options.relayPreset ?? 'geo', star: options.star ?? [0, 0, 1], hAtm: options.hAtm ?? 100, theta0: options.theta0 ?? .4, j2: false, elements: options.elements ?? null };
  let A = null;
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 60, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); render(0); }, setWarp(w) { this.warp = w; } };
  const _s = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
  function recompute() {
    const el = cfg.elements ?? ORBIT_PRESETS[cfg.preset];
    A = analyze({ el, dayOfYear: cfg.dayOfYear, revs: cfg.revs, station: cfg.station, relay: cfg.relayPreset ? { el: ORBIT_PRESETS[cfg.relayPreset] } : null, star: cfg.star, hAtm: cfg.hAtm, theta0: cfg.theta0 });
    timeline.duration = A.tEnd; timeline.t = Math.min(timeline.t, A.tEnd);
    /* Güneş yönü sahnede, koniler −ŝ boyunca */
    toScene(A.sunDir, _s).normalize(); sun.position.copy(_s).multiplyScalar(60); sunArrow.setDirection(_s); sunArrow.position.copy(_s).multiplyScalar(1.15);
    shadowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), _s);       // cyl +X ucu (Dünya) → ŝ yönü; gövde −ŝ'ye uzanır
    /* yörünge çizgisi */
    const pts = []; for (let k = 0; k <= 240; k++) { const s = stateAt(el, k / 240 * A.period); toScene(s.r, _p); pts.push(_p.x, _p.y, _p.z); } orbitLine.geometry.setPositions(pts);
    if (A.relayEl) { const rp = []; for (let k = 0; k <= 180; k++) { const s = stateAt(A.relayEl, k / 180 * (TAU / Math.sqrt(398600.4418 / A.relayEl.a ** 3))); toScene(s.r, _p); rp.push(_p.x, _p.y, _p.z); } relayOrbit.geometry.setPositions(rp); relayOrbit.visible = true; relay.visible = true; relayLine.visible = true; } else { relayOrbit.visible = false; relay.visible = false; relayLine.visible = false; }
    if (A.station) { const u = stationEcef(A.station.lat, A.station.lon); station.position.set(u[0], u[2], -u[1]).multiplyScalar(1.005); station.visible = true; } else station.visible = false;
    starLine.visible = !!A.star;
    const extR = Math.max(el.a * (1 + el.e), A.relayEl ? A.relayEl.a : 0) / R_E; const d = Math.max(6, extR * 1.9); camera.position.set(-d * .45, d * .5, d * .72); controls.target.set(0, 0, 0); controls.update();
    topEl.textContent = `${el.label ?? 'yörünge'} · yıl günü ${cfg.dayOfYear} · β = ${nf1.format(deg(A.beta))}° (β* = ${nf1.format(deg(A.betaStar))}°) · atmosfer teğet eşiği ${cfg.hAtm} km · ${timeline.warp}× zaman`;
    H.beta.textContent = `${nf1.format(deg(A.beta))}° / ${nf1.format(deg(A.betaStar))}°`; H.umb.textContent = `${nf1.format(A.stats.umbraPerRev / 60)} dk`; H.pen.textContent = `${nf1.format(A.stats.penumbraFrac * 100)} %`; H.passes.textContent = String(A.stats.passes);
  }
  let dpr = 1;
  function drawBands() {
    const cv = plots.bands, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const rows = [['Güneş / gölge', s => s.nu >= .999999 ? '#d9b877' : s.nu <= 1e-6 ? '#1a1c24' : '#6a6050'], ['istasyon görür', s => s.visible ? GREEN : 'rgba(255,255,255,.06)'], ['sensör hedefi açık', s => s.starBlocked ? '#5a2c22' : 'rgba(143,184,221,.55)'], ['röle bağlantısı', s => s.relayBlocked ? '#5a2c22' : 'rgba(215,143,108,.6)']].filter((r, i) => i === 0 || (i === 1 && A.station) || (i === 2 && A.star) || (i === 3 && A.relayEl));
    const pad = { l: 118, r: 12, t: 22, b: 16 }, rowH = (Hh - pad.t - pad.b) / rows.length, W2 = W - pad.l - pad.r;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('OLAY BANTLARI — geometriden türetilmiş (elle zaman yok)', pad.l, 13);
    rows.forEach(([label, colorFn], i) => { const y = pad.t + i * rowH + 4, h = rowH - 8; ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(label, pad.l - 8, y + h / 2 + 4); ctx.textAlign = 'left';
      const n = A.samples.length; for (let k = 0; k < n; k++) { const x0 = pad.l + k / n * W2, x1 = pad.l + (k + 1) / n * W2; ctx.fillStyle = colorFn(A.samples[k]); ctx.fillRect(x0, y, Math.max(1, x1 - x0 + .5), h); } });
    /* tur işaretleri + imleç */
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; for (let k = 0; k <= cfg.revs; k++) { const x = pad.l + k * A.period / A.tEnd * W2; ctx.beginPath(); ctx.moveTo(x, pad.t - 4); ctx.lineTo(x, Hh - pad.b + 2); ctx.stroke(); ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.fillText(`tur ${k}`, x + 3, Hh - 4); }
    const xc = pad.l + timeline.t / A.tEnd * W2; ctx.strokeStyle = P.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xc, pad.t - 6); ctx.lineTo(xc, Hh - pad.b + 4); ctx.stroke();
  }
  function drawCurves() {
    const cv = plots.curves, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const pad = { l: 44, r: 12, t: 20, b: 16 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b;
    const X = t => pad.l + t / A.tEnd * pw;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('gölge fonksiyonu ν (altın) · istasyon yükseklik açısı ε (yeşil, −90…90°)', pad.l, 13);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k <= 4; k++) { const y = pad.t + ph * k / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); }
    ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText('1 / 90°', pad.l - 4, pad.t + 8); ctx.fillText('0 / −90°', pad.l - 4, pad.t + ph); ctx.textAlign = 'left';
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.6; ctx.beginPath(); A.samples.forEach((s, k) => { const x = X(s.t), y = pad.t + ph - s.nu * ph; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    if (A.station) { ctx.strokeStyle = GREEN; ctx.lineWidth = 1.3; ctx.beginPath(); A.samples.forEach((s, k) => { const x = X(s.t), y = pad.t + ph - (s.elevation / (Math.PI / 2) + 1) / 2 * ph; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      const ym = pad.t + ph - ((cfg.station.maskDeg ?? 5) * Math.PI / 180 / (Math.PI / 2) + 1) / 2 * ph; ctx.strokeStyle = 'rgba(143,211,154,.4)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, ym); ctx.lineTo(pad.l + pw, ym); ctx.stroke(); ctx.setLineDash([]); }
    for (const e of A.events) { const x = X(e.t); ctx.strokeStyle = e.kind === 'umbra' ? 'rgba(255,255,255,.35)' : e.kind === 'penumbra' ? 'rgba(217,184,119,.35)' : e.kind === 'station' ? 'rgba(143,211,154,.5)' : 'rgba(215,143,108,.5)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.setLineDash([]); }
    const xc = X(timeline.t); ctx.strokeStyle = P.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xc, pad.t); ctx.lineTo(xc, pad.t + ph); ctx.stroke();
  }
  function render(dtReal) {
    const t = timeline.t; let lo = 0, hi = A.samples.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; A.samples[m].t <= t ? lo = m : hi = m; }
    const s = A.samples[lo]; const el = A.el;
    earth.rotation.y = A.theta0 + OMEGA_E * t;
    const st = stateAt(el, t); toScene(st.r, _p); sat.position.copy(_p);
    const sh = shadowFunction(st.r, A.sunDir); sat.material.color.set(sh.nu >= .999999 ? P.accent : sh.nu <= 1e-6 ? '#4a4f5a' : '#a08a60');
    /* istasyon çizgisi (dünya-yerel → dünya) */
    if (A.station) { _q.copy(station.position); earth.localToWorld(_q); stLine.geometry.setPositions([_q.x, _q.y, _q.z, _p.x, _p.y, _p.z]); stLine.material.color.set(s.visible ? GREEN : P.data2); stLine.material.opacity = s.visible ? .9 : .35; }
    if (A.relayEl) { const rr = stateAt(A.relayEl, t); toScene(rr.r, _q); relay.position.copy(_q); relayLine.geometry.setPositions([_p.x, _p.y, _p.z, _q.x, _q.y, _q.z]); relayLine.material.color.set(s.relayBlocked ? P.data2 : GREEN); relayLine.material.opacity = s.relayBlocked ? .45 : .9; }
    if (A.star) { toScene(A.star, _q).normalize(); const e = _p.clone().addScaledVector(_q, 3.5); starLine.geometry.setPositions([_p.x, _p.y, _p.z, e.x, e.y, e.z]); starLine.material.color.set(s.starBlocked ? P.data2 : P.ink); }
    /* etiket konumları */
    for (const l of labels) { const k = l.el.dataset.k; if (k === 'umbra') l.pos.copy(_s).multiplyScalar(-2.2).add(new THREE.Vector3(0, -.75, 0)); else if (k === 'pen') l.pos.copy(_s).multiplyScalar(-3.4).add(new THREE.Vector3(0, 1.5, 0)); else if (k === 'sun') l.pos.copy(_s).multiplyScalar(4.9); else if (k === 'st') { l.pos.copy(station.position); earth.localToWorld(l.pos); l.pos.multiplyScalar(1.12); l.el.style.display = A.station ? '' : 'none'; } else if (k === 'relay') { l.pos.copy(relay.position).add(new THREE.Vector3(0, .35, 0)); l.el.style.display = A.relayEl ? '' : 'none'; } else if (k === 'star') { toScene(A.star || [0, 0, 1], l.pos).normalize().multiplyScalar(3.7).add(_p); l.el.style.display = A.star ? '' : 'none'; } }
    const w = pane3d.clientWidth, h = pane3d.clientHeight; for (const l of labels) { if (l.el.style.display === 'none') continue; _q.copy(l.pos).project(camera); l.el.style.left = `${((_q.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _q.y) / 2 * h).toFixed(1)}px`; }
    /* HUD */
    H.t.textContent = `${nf1.format(t / 60)} dk · tur ${nf2.format(t / A.period)}`; H.nu.textContent = nf2.format(sh.nu); H.reg.textContent = { sun: 'tam güneş', penumbra: 'penumbra', umbra: 'umbra', annular: 'halkalı' }[sh.region];
    H.elev.textContent = A.station ? `${nf1.format(deg(s.elevation))}° · ${nf0.format(s.range)} km` : '—'; H.vis.textContent = A.station ? (s.visible ? 'EVET' : 'hayır') : '—'; H.vis.className = s.visible ? 'ok' : 'bad';
    H.star.textContent = A.star ? (s.starBlocked ? `ÖRTÜLÜ (teğet ${nf0.format(s.starTangent)} km)` : `açık (teğet ${s.starTangent > 1e6 ? '∞' : nf0.format(s.starTangent) + ' km'})`) : '—'; H.star.className = s.starBlocked ? 'bad' : 'ok';
    H.link.textContent = A.relayEl ? (s.relayBlocked ? 'ÖRTÜLÜ' : `açık (teğet ${nf0.format(s.relayTangent)} km)`) : '—'; H.link.className = s.relayBlocked ? 'bad' : 'ok';
    const nx = A.events.find(e => e.t > t); H.next.textContent = nx ? `${nx.label} · +${nf1.format((nx.t - t) / 60)} dk` : '—';
    drawBands(); drawCurves(); controls.update(); renderer.render(scene, camera);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t = 0; } render(dt); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); for (const m of mats) m.resolution.set(w, h); dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } }
  const ro = new ResizeObserver(() => { resize(); if (A) render(0); }); ro.observe(figure);
  recompute(); resize();
  if (reducedMotion || exportMode) timeline.t = options.t ?? (A.events.find(e => e.id === 'umbra-entry')?.t ?? 0) + 300; else if (options.autoplay ?? true) timeline.playing = true;
  render(0); ensureLoop();
  return {
    get analysis() { return A; }, get config() { return { ...cfg }; }, timeline, presets: ORBIT_PRESETS,
    set(c) { cfg = { ...cfg, ...c }; timeline.t = 0; recompute(); render(0); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.ecl__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
