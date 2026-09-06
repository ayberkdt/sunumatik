/* orbit-perturbations.mjs — Yörünge Pertürbasyonları Sahnesi (orbit_perturbations)

   Sayısal yayılım (RK4: iki-cisim + J2 + sürükleme + SRP + Ay/Güneş) üstüne: 3B'de yörünge
   "yelpazesi" (zaman boyunca oskülatör yörünge anlık görüntüleri — düğüm gerilemesi ve perigee
   kayması GÖRÜNÜR), düğüm çizgisi, uydu; sağda Ω(t), ω(t), irtifa/e, i grafikleri — oskülatör
   sayısal eğri + analitik sekülar doğru üst üste. Çözücü: perturbation-model.mjs (saf).

   API:
     const op = await mountPerturbations(host, { scenario:'j2leo', overrides:{ el:{...}, forces:{...}, days }, warp });
     op.setScenario(id, overrides) · op.sim · op.rates · op.timeline · op.dispose()
   Sahne: ECI (X = x, Y = z, Z = −y); 1 birim = R_E. */

import * as THREE from 'three';
import { atmosphereShell, glowSprite, sunGlow } from '../core/lab-three.mjs';
import { backdrop } from '../core/lab-scene.mjs';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { propagatePerturbed, elementsToRv, unwrap, fitRate, runningMean, SCENARIOS, R_E } from './perturbation-model.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const deg = x => x * 180 / Math.PI, DAY = 86400;
const toScene = (r, out) => out.set(r[0] / R_E, r[2] / R_E, -r[1] / R_E);
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function mountPerturbations(host, options = {}) {
  if (!host) throw new Error('mountPerturbations bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'opert';
  figure.innerHTML = `
    <style>
      .opert{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .opert__3d{position:relative;min-width:0;min-height:0;} .opert__3d canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
      .opert__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .opert__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);text-shadow:0 1px 4px rgba(0,0,0,.9);}
      .opert__side{min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto repeat(4,minmax(0,1fr));}
      .opert__hud{padding:10px 14px;border-bottom:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .opert__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px;} .opert__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .opert__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);} .opert__hud dd.hi{color:var(--color-accent,#d9b877);}
      .opert__plot{position:relative;min-height:0;border-bottom:1px solid var(--color-rule,#3a3c42);} .opert__plot canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .opert__top{position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);pointer-events:none;}
      .opert__legend{position:absolute;left:14px;bottom:14px;font-size:11px;color:var(--color-muted,#9a938a);pointer-events:none;line-height:1.6;}
      .opert__legend i{display:inline-block;width:16px;height:3px;vertical-align:middle;margin-right:6px;border-radius:2px;}
    </style>
    <div class="opert__3d"><div class="opert__labels" aria-hidden="true"></div><div class="opert__top" data-top></div>
      <div class="opert__legend" aria-hidden="true"><div><i style="background:#9a938a"></i>başlangıç yörüngesi ve düğüm çizgisi</div><div><i style="background:#8fb8dd;opacity:.6"></i>ara oskülatör yörüngeler (yelpaze)</div><div><i style="background:#d9b877"></i>anlık oskülatör yörünge · uydu</div></div></div>
    <div class="opert__side">
      <div class="opert__hud" role="status"><dl>
        <dt>t</dt><dd data-h="t">—</dd><dt>irtifa</dt><dd data-h="alt">—</dd>
        <dt>Ω̇ sayısal</dt><dd data-h="rn" class="hi">—</dd><dt>Ω̇ analitik</dt><dd data-h="ra">—</dd>
        <dt>ω̇ sayısal</dt><dd data-h="wn" class="hi">—</dd><dt>ω̇ analitik</dt><dd data-h="wa">—</dd>
        <dt>a, e</dt><dd data-h="ae">—</dd><dt>i</dt><dd data-h="i">—</dd>
        <dt>ΔE</dt><dd data-h="dE">—</dd><dt>ΔH_z</dt><dd data-h="dHz">—</dd>
      </dl></div>
      <div class="opert__plot"><canvas data-plot="raan"></canvas></div>
      <div class="opert__plot"><canvas data-plot="argp"></canvas></div>
      <div class="opert__plot"><canvas data-plot="alt"></canvas></div>
      <div class="opert__plot"><canvas data-plot="inc"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.opert__3d'), labelLayer = figure.querySelector('.opert__labels'), topEl = figure.querySelector('[data-top]');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), nf4 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }), nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

  /* -------- 3B */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 600);
  scene.add(new THREE.DirectionalLight('#fff4e6', 2).translateX(60).translateY(30).translateZ(40)); scene.add(new THREE.HemisphereLight('#93a7bd', '#1c1e24', .5)); scene.add(new THREE.AmbientLight('#3c4250', .55));
  { const rand = mulberry32(seed), n = reducedMotion ? 600 : 1400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 200 + rand() * 150, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .65, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  const earth = new THREE.Group(); scene.add(earth);
  { const loader = new THREE.TextureLoader(); const url = rel => new URL(rel, import.meta.url).href;
    try { const day = await loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')); day.colorSpace = THREE.SRGBColorSpace; earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhongMaterial({ map: day, specular: new THREE.Color('#2a3138'), shininess: 10 }))); }
    catch (e) { earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .85 }))); } }
  scene.add(atmosphereShell(THREE, 1, '#6fb4ff', 1.5)); sunGlow(THREE, scene, new THREE.Vector3(60, 30, 40), { dist: 300, size: 46 });
  const mats = []; const lineMat = (color, width, opacity) => { const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true }); mats.push(m); return m; };
  const mkLine = (pts, mat) => { const g = new LineGeometry(); g.setPositions(pts); return new Line2(g, mat); };
  { const pts = []; for (let k = 0; k <= 128; k++) { const a = k / 128 * Math.PI * 2; pts.push(Math.cos(a) * 1.003, 0, Math.sin(a) * 1.003); } scene.add(mkLine(pts, lineMat(P.muted, 1, .3))); scene.add(mkLine([0, -1.3, 0, 0, 1.3, 0], lineMat(P.muted, 1, .3))); }
  const labels = []; const addLabel = (text, pos, color = P.muted) => { const el = document.createElement('div'); el.className = 'opert__label'; el.textContent = text; el.style.color = color; labelLayer.appendChild(el); labels.push({ el, pos }); return el; };
  addLabel('kutup ekseni', new THREE.Vector3(0, 1.42, 0)); addLabel('ekvator', new THREE.Vector3(1.15, 0, .1));
  const fanGroup = new THREE.Group(); scene.add(fanGroup);
  const sat = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 10), new THREE.MeshBasicMaterial({ color: P.accent })); scene.add(sat); { const g = glowSprite(THREE, P.accent, .85); g.scale.setScalar(.26); sat.add(g); }
  let curOrbit = null, curNode = null, node0 = null, orbit0 = null;
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08;

  let sim = null, rates = null, sid = options.scenario ?? 'j2leo', overrides = options.overrides ?? {};
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? DAY / 4, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); render(0); }, setWarp(w) { this.warp = w; } };
  const orbitPts = el => { const pts = []; const v = new THREE.Vector3(); for (let k = 0; k <= 180; k++) { const nu = k / 180 * Math.PI * 2; const { r } = elementsToRv({ ...el, nu }); toScene(r, v); pts.push(v.x, v.y, v.z); } return pts; };
  const nodePts = el => { const v = new THREE.Vector3(); const rr = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(-el.argp)); const p = [rr * Math.cos(el.raan), rr * Math.sin(el.raan), 0]; toScene(p, v); return [0, 0, 0, v.x, v.y, v.z]; };
  const series = {};
  function rebuild() {
    sim = propagatePerturbed(sid, overrides);
    timeline.duration = sim.samples[sim.samples.length - 1].t; timeline.t = Math.min(timeline.t, timeline.duration);
    const T = sim.samples.map(s => s.t);
    series.t = T; series.raan = unwrap(sim.samples.map(s => s.el.raan)); series.argp = unwrap(sim.samples.map(s => s.el.argp));
    series.alt = sim.samples.map(s => s.alt); series.a = sim.samples.map(s => s.el.a); series.e = sim.samples.map(s => s.el.e); series.inc = sim.samples.map(s => s.el.i);
    series.raanMean = runningMean(T, series.raan, sim.period); series.argpMean = runningMean(T, series.argp, sim.period);
    rates = { raanNum: fitRate(T, series.raan), argpNum: fitRate(T, series.argp), raanAn: sim.secular.raanDot, argpAn: sim.secular.argpDot };
    /* 3B: yelpaze (8 anlık görüntü) + başlangıç + anlık */
    while (fanGroup.children.length) { const c = fanGroup.children.pop(); c.geometry.dispose(); }
    const N = 8; for (let k = 1; k < N; k++) { const s = sim.samples[Math.floor(sim.samples.length * k / N)]; fanGroup.add(mkLine(orbitPts(s.el), lineMat(P.data1, 1, .12 + .35 * k / N))); }
    if (orbit0) { scene.remove(orbit0, node0, curOrbit, curNode); for (const o of [orbit0, node0, curOrbit, curNode]) o.geometry.dispose(); }
    orbit0 = mkLine(orbitPts(sim.samples[0].el), lineMat(P.muted, 1.4, .8)); node0 = mkLine(nodePts(sim.samples[0].el), lineMat(P.muted, 1.4, .8));
    curOrbit = mkLine(orbitPts(sim.samples[0].el), lineMat(P.accent, 2, .95)); curNode = mkLine(nodePts(sim.samples[0].el), lineMat(P.accent, 1.6, .9));
    scene.add(orbit0, node0, curOrbit, curNode);
    const ext = Math.max(...sim.samples.map(s => s.el.ra)) / R_E; const d = Math.max(5.8, ext * 2.4); camera.position.set(d * .5, d * .62, d * .6); controls.target.set(0, 0, 0); controls.update();
    const F = sim.cfg.forces; topEl.textContent = `${sim.label} · kuvvetler: ${['j2', 'drag', 'srp', 'moon', 'sun'].filter(k => F[k]).map(k => ({ j2: 'J2', drag: 'sürükleme', srp: 'SRP', moon: 'Ay', sun: 'Güneş' })[k]).join(' + ') || 'iki-cisim'} · RK4 dt = ${sim.cfg.dt} s · ${sim.cfg.days} gün`;
    resize();
  }
  /* -------- grafikler */
  let dpr = 1;
  function drawPlot(cv, curves, title, fmt) {
    const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W, Hh, { canvas: P.canvas });
    const pad = { l: 56, r: 12, t: 18, b: 14 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b;
    let lo = Infinity, hi = -Infinity; for (const c of curves) for (const v of c.data) { if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } } if (hi - lo < 1e-9) { hi += 1e-9 + Math.abs(hi) * 1e-6; lo -= 1e-9; }
    const T = series.t, tEnd = T[T.length - 1];
    const X = t => pad.l + t / tEnd * pw, Y = v => pad.t + ph - (v - lo) / (hi - lo) * ph;
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k <= 4; k++) { const y = pad.t + ph * k / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); }
    ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(fmt(hi), pad.l - 4, pad.t + 8); ctx.fillText(fmt(lo), pad.l - 4, pad.t + ph); ctx.textAlign = 'left'; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(title, pad.l, 12);
    curves.forEach((c, k) => { ctx.strokeStyle = c.color; ctx.lineWidth = c.width || 1.2; if (c.dash) ctx.setLineDash(c.dash); ctx.beginPath(); let first = true; for (let i = 0; i < c.data.length; i++) { const v = c.data[i]; if (!Number.isFinite(v)) continue; const x = X(c.t ? c.t[i] : T[i]), y = Y(v); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; } ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = c.color; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(c.label, pad.l + pw - 130 + (k % 2) * 70, pad.t + 10 + Math.floor(k / 2) * 11); });
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(timeline.t), pad.t); ctx.lineTo(X(timeline.t), pad.t + ph); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(`${nf1.format(tEnd / DAY)} gün`, pad.l + pw, Hh - 3); ctx.textAlign = 'left';
  }
  function drawPlots() {
    const T = series.t, r0 = series.raan[0], w0 = series.argp[0];
    drawPlot(plots.raan, [{ label: 'oskülatör', color: P.data1, data: series.raan.map(deg) }, { label: 'ortalama', color: P.ink, data: series.raanMean.map(deg), width: 1 }, { label: 'sekülar (analitik)', color: P.data2, dash: [4, 4], data: T.map(t => deg(r0 + rates.raanAn * t)) }], 'Ω düğüm boylamı (°)', v => nf2.format(v));
    if (sim.el0.e < .005) drawPlot(plots.argp, [{ label: 'u = ω + ν (oskülatör)', color: P.data1, data: sim.samples.map(s => deg((s.el.argp + s.el.nu) % (2 * Math.PI))) }], 'ω tanımsız (e ≈ 0): enlem argümanı u (°)', v => nf0.format(v));
    else drawPlot(plots.argp, [{ label: 'oskülatör', color: P.data1, data: series.argp.map(deg) }, { label: 'ortalama', color: P.ink, data: series.argpMean.map(deg), width: 1 }, { label: 'sekülar (analitik)', color: P.data2, dash: [4, 4], data: T.map(t => deg(w0 + rates.argpAn * t)) }], 'ω perigee argümanı (°)', v => nf2.format(v));
    drawPlot(plots.alt, [{ label: 'irtifa', color: P.data1, data: series.alt }, { label: 'a − R', color: P.ink, data: series.a.map(a => a - R_E), width: 1 }], 'irtifa ve a − R_E (km)', v => nf0.format(v));
    drawPlot(plots.inc, [{ label: 'i', color: P.data1, data: series.inc.map(deg) }, { label: 'e ×1000', color: P.data2, data: series.e.map(e => e * 1000) }], 'eğiklik (°) · e × 1000', v => nf3.format(v));
  }
  /* -------- kare */
  const _v = new THREE.Vector3();
  function render(dtReal) {
    const t = timeline.t; let n = 0, lo = 0, hi = sim.samples.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; sim.samples[m].t <= t ? lo = m : hi = m; } n = lo;
    const s = sim.samples[n];
    toScene(s.r, _v); sat.position.copy(_v);
    curOrbit.geometry.setPositions(orbitPts(s.el)); curNode.geometry.setPositions(nodePts(s.el));
    const d = 180 / Math.PI * DAY;
    H.t.textContent = `${nf1.format(t / DAY)} gün`; H.alt.textContent = `${nf0.format(s.alt)} km`;
    H.rn.textContent = `${nf3.format(rates.raanNum * d)} °/gün`; H.ra.textContent = `${nf3.format(rates.raanAn * d)} °/gün`;
    const circ = sim.el0.e < .005; H.wn.textContent = circ ? 'tanımsız (e ≈ 0)' : `${nf3.format(rates.argpNum * d)} °/gün`; H.wa.textContent = `${nf3.format(rates.argpAn * d)} °/gün`;
    H.ae.textContent = `${nf0.format(s.el.a)} km, ${nf4.format(s.el.e)}`; H.i.textContent = `${nf3.format(deg(s.el.i))}°`;
    H.dE.textContent = `${(s.el.energy - sim.samples[0].el.energy).toExponential(2)} km²/s²`; H.dHz.textContent = `${(s.el.hz - sim.samples[0].el.hz).toExponential(2)}`;
    drawPlots(); controls.update();
    const w = pane3d.clientWidth, h = pane3d.clientHeight;
    for (const l of labels) { _v.copy(l.pos).project(camera); const vis = _v.z < 1; l.el.style.display = vis ? '' : 'none'; if (vis) { l.el.style.left = `${((_v.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _v.y) / 2 * h).toFixed(1)}px`; } }
    renderer.render(scene, camera);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t = 0; } render(dt); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); for (const m of mats) m.resolution.set(w, h); dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } }
  const ro = new ResizeObserver(() => { resize(); if (sim) render(0); }); ro.observe(figure);
  rebuild();
  if (reducedMotion || exportMode) timeline.t = options.t ?? timeline.duration * .6; else if (options.autoplay ?? true) timeline.playing = true;
  render(0); ensureLoop();
  return {
    get sim() { return sim; }, get rates() { return rates; }, get scenario() { return sid; }, scenarios: SCENARIOS, timeline,
    setScenario(id, ov = {}) { sid = id; overrides = ov; timeline.t = 0; rebuild(); render(0); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.opert__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
