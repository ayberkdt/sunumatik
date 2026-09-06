/* conjunction.mjs — Yakın Geçiş ve Kovaryans Sahnesi (conjunction_covariance)

   Belirsizlik geometrisi ana içerik: iki yörünge ve TCA (menzil minimizasyonuyla bulunur), karşılaşma
   çerçevesi, karşılaşma düzleminde birleşik kovaryans elipsleri (1/2/3σ), sert-gövde dairesi, ıska
   vektörü, Mahalanobis uzaklığı, 2B çarpışma olasılığı ve seyrelme eğrisi. Çözücü: conjunction-model.mjs.

   API:
     const cj = await mountConjunction(host, { miss:[R,T,N] m, crossAngle, sigP:[σR,σT,σN], sigS, rHb, tTca, warp });
     cj.set({...}) · cj.analysis · cj.timeline · cj.dispose()
   Sahne: ECI (X = x, Y = z, Z = −y); 1 birim = R_E. */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { analyzeConjunction } from './conjunction-model.mjs';
import { stateAt, R_E, TAU } from '../core/astro-orbit.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const toScene = (r, out) => out.set(r[0] / R_E, r[2] / R_E, -r[1] / R_E);
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function mountConjunction(host, options = {}) {
  if (!host) throw new Error('mountConjunction bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'cj';
  figure.innerHTML = `
    <style>
      .cj{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,10fr) minmax(0,10fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .cj__3d{grid-row:1/3;position:relative;min-width:0;min-height:0;} .cj__3d canvas{display:block;width:100%;height:100%;}
      .cj__plane,.cj__lower{position:relative;min-width:0;min-height:0;border-left:1px solid var(--color-rule,#3a3c42);} .cj__lower{border-top:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);}
      .cj canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .cj__cell{position:relative;min-width:0;min-height:0;} .cj__cell + .cj__cell{border-left:1px solid var(--color-rule,#3a3c42);}
      .cj__hud{position:absolute;top:12px;left:12px;padding:10px 14px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;font-size:12px;color:var(--color-muted,#9a938a);
        background:color-mix(in srgb,var(--color-surface,#15161a) 86%,transparent);pointer-events:none;min-width:250px;}
      .cj__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;} .cj__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .cj__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);} .cj__hud dd.hi{color:var(--color-accent,#d9b877);} .cj__hud dd.bad{color:var(--color-data-2,#d78f6c);}
      .cj__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .cj__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;letter-spacing:.06em;text-shadow:0 1px 4px rgba(0,0,0,.9);}
    </style>
    <div class="cj__3d"><div class="cj__labels" aria-hidden="true"></div>
      <div class="cj__hud" role="status"><dl>
        <dt>t − TCA</dt><dd data-h="t">—</dd><dt>menzil</dt><dd data-h="range" class="hi">—</dd>
        <dt>TCA ıska</dt><dd data-h="miss">—</dd><dt>|v_rel|</dt><dd data-h="vrel">—</dd>
        <dt>Mahalanobis d_M</dt><dd data-h="dm" class="hi">—</dd><dt>birleşik σ (düzlem)</dt><dd data-h="sig">—</dd>
        <dt>P_c (2B)</dt><dd data-h="pc" class="hi">—</dd><dt>seyrelme tepesi</dt><dd data-h="peak">—</dd>
        <dt>R_HB</dt><dd data-h="rhb">—</dd><dt>karar</dt><dd data-h="dec">—</dd>
      </dl></div></div>
    <div class="cj__plane"><canvas class="p" data-plot="plane" aria-label="Karşılaşma düzlemi"></canvas></div>
    <div class="cj__lower"><div class="cj__cell"><canvas class="p" data-plot="range" aria-label="Menzil"></canvas></div><div class="cj__cell"><canvas class="p" data-plot="dilution" aria-label="Seyrelme"></canvas></div></div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.cj__3d'), labelLayer = figure.querySelector('.cj__labels');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(36, 1, .01, 600);
  scene.add(new THREE.DirectionalLight('#fff4e6', 2).translateX(60).translateY(30).translateZ(40)); scene.add(new THREE.HemisphereLight('#93a7bd', '#1c1e24', .5)); scene.add(new THREE.AmbientLight('#3c4250', .55));
  { const rand = mulberry32(seed), n = reducedMotion ? 600 : 1400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 200 + rand() * 150, th = rand() * TAU, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .65, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  { const loader = new THREE.TextureLoader(); const url = rel => new URL(rel, import.meta.url).href;
    try { const day = await loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')); day.colorSpace = THREE.SRGBColorSpace; scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhongMaterial({ map: day, specular: new THREE.Color('#2a3138'), shininess: 10 }))); }
    catch (e) { scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .85 }))); } }
  const mats = []; const lineMat = (color, width, opacity) => { const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true }); mats.push(m); return m; };
  const mkLine = (pts, mat) => { const g = new LineGeometry(); g.setPositions(pts); return new Line2(g, mat); };
  const orbP = mkLine([0, 0, 0, 0, 0, 0], lineMat(P.data1, 1.6, .8)), orbS = mkLine([0, 0, 0, 0, 0, 0], lineMat(P.data2, 1.6, .8)); scene.add(orbP, orbS);
  const satP = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), new THREE.MeshBasicMaterial({ color: P.data1 })), satS = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), new THREE.MeshBasicMaterial({ color: P.data2 })); scene.add(satP, satS);
  const tcaMark = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10), new THREE.MeshBasicMaterial({ color: P.accent, transparent: true, opacity: .8 })); scene.add(tcaMark);
  const labels = []; const addLabel = (text, color) => { const el = document.createElement('div'); el.className = 'cj__label'; el.textContent = text; el.style.color = color; labelLayer.appendChild(el); const o = { el, pos: new THREE.Vector3() }; labels.push(o); return o; };
  const lP = addLabel('birincil', P.data1), lS = addLabel('ikincil', P.data2), lT = addLabel('TCA', P.accent);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08;

  let cfg = { miss: options.miss ?? [120, 300, -80], crossAngle: options.crossAngle ?? 40, sigP: options.sigP ?? [50, 400, 60], sigS: options.sigS ?? [120, 900, 150], rHb: options.rHb ?? 20, tTca: options.tTca ?? 3600, threshold: options.threshold ?? 1e-4 };
  let A = null;
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 20, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); render(0); }, setWarp(w) { this.warp = w; } };
  const _v = new THREE.Vector3();
  function recompute() {
    A = analyzeConjunction(cfg);
    const orbitPts = el => { const pts = []; const T = TAU * Math.sqrt(el.a ** 3 / 398600.4418); for (let k = 0; k <= 200; k++) { toScene(stateAt(el, k / 200 * T).r, _v); pts.push(_v.x, _v.y, _v.z); } return pts; };
    orbP.geometry.setPositions(orbitPts(A.primary)); orbS.geometry.setPositions(orbitPts(A.secondary));
    toScene(A.tca.rP, _v); tcaMark.position.copy(_v); lT.pos.copy(_v).add(new THREE.Vector3(0, .12, 0));
    timeline.duration = A.series[A.series.length - 1].t - A.series[0].t; timeline.t = Math.min(timeline.t, timeline.duration);
    const d = 5.6; camera.position.copy(_v).normalize().multiplyScalar(d).add(new THREE.Vector3(.8, 1.4, .6)); controls.target.copy(_v).multiplyScalar(.5); controls.update();
    H.miss.textContent = `${nf1.format(A.tca.miss * 1000)} m (R ${nf0.format(cfg.miss[0])} / T ${nf0.format(cfg.miss[1])} / N ${nf0.format(cfg.miss[2])})`; H.vrel.textContent = `${nf3.format(A.vRelMag)} km/s`;
    H.dm.textContent = nf2.format(A.geo.dM); H.sig.textContent = `${nf0.format(A.geo.ellipse.s1)} × ${nf0.format(A.geo.ellipse.s2)} m`;
    H.pc.textContent = A.pc.toExponential(2); H.peak.textContent = `k = ${nf2.format(A.dilution.peak.k)} → ${A.dilution.peak.pc.toExponential(2)}`; H.rhb.textContent = `${cfg.rHb} m`;
    H.dec.textContent = A.pc >= cfg.threshold ? `P_c ≥ ${cfg.threshold.toExponential(0)} — manevra değerlendir` : `P_c < ${cfg.threshold.toExponential(0)} — izle`; H.dec.className = A.pc >= cfg.threshold ? 'bad' : '';
  }
  let dpr = 1;
  function drawPlane() {
    const cv = plots.plane, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const g = A.geo, ext = Math.max(3 * g.ellipse.s1, Math.hypot(...g.missPlane) * 1.3, cfg.rHb * 4) * 1.1;
    const sc = Math.min(W, Hh) / 2 / ext * .86, cx = W * .5, cy = Hh * .52, X = x => cx + x * sc, Y = y => cy - y * sc;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('KARŞILAŞMA DÜZLEMİ (v_rel ⊥): birleşik kovaryans 1σ/2σ/3σ · ıska vektörü · sert-gövde dairesi', 12, 16);
    ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, Hh); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.fillText('ê₂ (r_rel × v_rel yönü) →', W - 150, cy - 5); ctx.fillText('ê₃ ↑', cx + 5, 30);
    /* elipsler (ikincil merkezde: birincil, orijinde) */
    for (const k of [3, 2, 1]) { ctx.beginPath(); ctx.ellipse(X(0), Y(0), g.ellipse.s1 * k * sc, g.ellipse.s2 * k * sc, -g.ellipse.angle, 0, TAU); ctx.fillStyle = `rgba(143,184,221,${.05 + .04 * (4 - k)})`; ctx.fill(); ctx.strokeStyle = `rgba(143,184,221,${.35 + .2 * (4 - k) / 3})`; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = 'rgba(143,184,221,.9)'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`${k}σ`, X(g.ellipse.s1 * k * Math.cos(g.ellipse.angle)) + 4, Y(g.ellipse.s1 * k * Math.sin(g.ellipse.angle)) - 4); }
    /* ıska vektörü + sert gövde */
    const [mx, my] = g.missPlane;
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(mx), Y(my)); ctx.stroke();
    ctx.fillStyle = 'rgba(215,143,108,.35)'; ctx.beginPath(); ctx.arc(X(mx), Y(my), Math.max(2, cfg.rHb * sc), 0, TAU); ctx.fill(); ctx.strokeStyle = P.data2; ctx.stroke();
    ctx.fillStyle = P.accent; ctx.font = '600 10.5px ui-monospace, monospace'; ctx.fillText(`ıska ${nf0.format(Math.hypot(mx, my))} m · d_M = ${nf2.format(g.dM)}`, X(mx) + 8, Y(my) - 8);
    ctx.fillStyle = P.data2; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`R_HB ${cfg.rHb} m`, X(mx) + 8, Y(my) + 14);
    ctx.fillStyle = P.data1; ctx.beginPath(); ctx.arc(X(0), Y(0), 3, 0, TAU); ctx.fill(); ctx.fillStyle = P.muted; ctx.font = '10px Inter, sans-serif'; ctx.fillText('birincil (belirsizlik birleşik: C = C_P + C_S)', X(0) + 8, Y(0) + 14);
    ctx.fillStyle = P.muted; ctx.fillText(`ölçek: ${nf0.format(Math.round(100 / sc))} m / 100 px`, 12, Hh - 8);
  }
  function drawRange() {
    const cv = plots.range, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const pad = { l: 46, r: 10, t: 20, b: 16 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b, S = A.series, t0 = S[0].t, t1 = S[S.length - 1].t, rMax = Math.max(...S.map(s => s.range));
    const X = t => pad.l + (t - t0) / (t1 - t0) * pw, Y = r => pad.t + ph - r / rMax * ph;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('menzil |r_rel|(t), TCA ± 15 dk — minimum altın oranla bulunur', pad.l, 13);
    ctx.strokeStyle = P.data1; ctx.lineWidth = 1.6; ctx.beginPath(); S.forEach((s, k) => k ? ctx.lineTo(X(s.t), Y(s.range)) : ctx.moveTo(X(s.t), Y(s.range))); ctx.stroke();
    const xt = X(A.tca.tTca); ctx.strokeStyle = P.accent; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xt, pad.t); ctx.lineTo(xt, pad.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(`${nf0.format(rMax / 1000)} km`, pad.l - 4, pad.t + 8); ctx.fillText('0', pad.l - 4, pad.t + ph); ctx.textAlign = 'left';
    const xc = X(t0 + timeline.t); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xc, pad.t); ctx.lineTo(xc, pad.t + ph); ctx.stroke();
  }
  function drawDilution() {
    const cv = plots.dilution, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const pad = { l: 46, r: 10, t: 20, b: 18 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b, pts = A.dilution.points;
    const lp = pts.map(p => Math.log10(Math.max(1e-12, p.pc))), lo = Math.min(...lp), hi = Math.max(...lp, Math.log10(cfg.threshold));
    const X = k => pad.l + (Math.log10(k) + 1) / 2 * pw, Y = l => pad.t + ph - (l - lo) / Math.max(1e-9, hi - lo) * ph;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('seyrelme: P_c vs kovaryans ölçeği k (log–log) — büyük belirsizlik "güvenli" değildir', pad.l, 13);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k <= 4; k++) { const y = pad.t + ph * k / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); }
    ctx.strokeStyle = P.data2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(Math.log10(cfg.threshold))); ctx.lineTo(pad.l + pw, Y(Math.log10(cfg.threshold))); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = P.data2; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`eşik ${cfg.threshold.toExponential(0)}`, pad.l + 4, Y(Math.log10(cfg.threshold)) - 3);
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.6; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(X(p.k), Y(lp[k])) : ctx.moveTo(X(p.k), Y(lp[k]))); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(X(1), Y(Math.log10(Math.max(1e-12, A.pc))), 4, 0, TAU); ctx.fill(); ctx.font = '10px ui-monospace, monospace'; ctx.fillText('k = 1 (verilen)', X(1) + 6, Y(Math.log10(Math.max(1e-12, A.pc))) + 4);
    ctx.fillStyle = P.muted; ctx.textAlign = 'right'; ctx.fillText(`1e${hi.toFixed(0)}`, pad.l - 4, pad.t + 8); ctx.fillText(`1e${lo.toFixed(0)}`, pad.l - 4, pad.t + ph); ctx.textAlign = 'center'; for (const k of [.1, 1, 10]) ctx.fillText(`${k}×`, X(k), Hh - 4); ctx.textAlign = 'left';
  }
  function render(dtReal) {
    const t = A.series[0].t + timeline.t; const Pp = stateAt(A.primary, t), Ss = stateAt(A.secondary, t);
    toScene(Pp.r, _v); satP.position.copy(_v); lP.pos.copy(_v).add(new THREE.Vector3(0, .1, 0)); toScene(Ss.r, _v); satS.position.copy(_v); lS.pos.copy(_v).add(new THREE.Vector3(0, -.1, 0));
    const range = Math.hypot(Ss.r[0] - Pp.r[0], Ss.r[1] - Pp.r[1], Ss.r[2] - Pp.r[2]) * 1000;
    H.t.textContent = `${t - A.tca.tTca >= 0 ? '+' : '−'}${nf1.format(Math.abs(t - A.tca.tTca))} s`; H.range.textContent = range > 10000 ? `${nf2.format(range / 1000)} km` : `${nf0.format(range)} m`;
    drawPlane(); drawRange(); drawDilution(); controls.update();
    const w = pane3d.clientWidth, h = pane3d.clientHeight; for (const l of labels) { _v.copy(l.pos).project(camera); l.el.style.left = `${((_v.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _v.y) / 2 * h).toFixed(1)}px`; }
    renderer.render(scene, camera);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t = 0; } render(dt); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); for (const m of mats) m.resolution.set(w, h); dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } }
  const ro = new ResizeObserver(() => { resize(); if (A) render(0); }); ro.observe(figure);
  recompute(); resize();
  if (reducedMotion || exportMode) timeline.t = options.t ?? timeline.duration / 2; else if (options.autoplay ?? true) timeline.playing = true;
  render(0); ensureLoop();
  return {
    get analysis() { return A; }, get config() { return { ...cfg }; }, timeline,
    set(c) { cfg = { ...cfg, ...c }; timeline.t = 0; recompute(); render(0); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.cj__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
