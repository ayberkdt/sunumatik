/* formation-flight.mjs — Formasyon Uçuşu Sahnesi (formation_flight)

   scene-blocks "wave 2" ORBITAL bloğu. Şef merkezli LVLH çerçevede Clohessy–Wiltshire
   göreli yörüngeler: çok deputy, kapalı göreli izler (sürüklenmesiz koşul), radyal /
   iz-boyu / çapraz-iz bileşenleri, ayrım HUD'u (şef–deputy ve deputy–deputy min/max),
   sürüklenme dersi. Üç ortogonal 2B izdüşüm + 3B görünüm. rendezvous_docking ile
   aynı paylaşılan çözücü (../core/astro-relative.mjs).

   API:
     const ff = await mountFormation(host, { scenario:'pco', scenarioOptions:{count, rho, altitude, orbits}, warp, camera });
     ff.form · ff.setScenario(id, opts) · ff.timeline · ff.camera{mode,current} · ff.stats · ff.advance(dt) · ff.dispose()
   Sahne: LVLH (x radyal, y iz boyu, z çapraz) → (X = y, Y = x, Z = −z); 1 birim = ölçek(senaryo). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { buildFormation, statesAt, trace, separationStats, FORMATIONS } from './formation-model.mjs';

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth01 = x => { const s = clamp01(x); return s * s * (3 - 2 * s); };
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function loadCraft() {
  try { const m = await import('../craft_blocks/craft-blocks.mjs'); return { buildOrbiter: m.buildOrbiter, buildCubesat: m.buildCubesat }; }
  catch (error) { console.warn('formation: craft-blocks yok —', error.message); const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c })); return { buildOrbiter: () => { const g = new THREE.Group(); g.add(box(.5, .2, .2, 0x33353c)); return g; }, buildCubesat: () => { const g = new THREE.Group(); g.add(box(.3, .1, .1, 0x8a877e)); return g; } }; }
}

export async function mountFormation(host, options = {}) {
  if (!host) throw new Error('mountFormation bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'ff';
  figure.innerHTML = `
    <style>
      .ff{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,12fr) minmax(0,8fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .ff__3d{position:relative;min-width:0;} .ff__3d canvas{display:block;width:100%;height:100%;}
      .ff__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .ff__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);text-shadow:0 1px 4px rgba(0,0,0,.9);}
      .ff__label.axis{color:var(--color-ink,#e9e4d8);font-weight:600;letter-spacing:.1em;}
      .ff__side{min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:minmax(0,1fr) auto;}
      .ff__views{display:grid;grid-template-columns:1fr 1fr 1fr;} .ff__views canvas{display:block;width:100%;aspect-ratio:1;}
      .ff__hud{padding:10px 14px;font-size:12px;color:var(--color-muted,#9a938a);overflow:auto;border-top:1px solid var(--color-rule,#3a3c42);}
      .ff__hud table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;}
      .ff__hud th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;text-align:right;font-weight:600;padding:2px 4px;color:var(--color-muted,#9a938a);}
      .ff__hud th:first-child,.ff__hud td:first-child{text-align:left;}
      .ff__hud td{text-align:right;padding:2px 4px;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);}
      .ff__hud td i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:0;}
      .ff__hud .note{margin-top:6px;font-size:11px;letter-spacing:.04em;}
      .ff__top{position:absolute;top:14px;left:14px;padding:8px 12px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;font-size:11px;letter-spacing:.06em;color:var(--color-accent,#d9b877);
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
    </style>
    <div class="ff__3d"><div class="ff__labels" aria-hidden="true"></div><div class="ff__top" data-top></div></div>
    <div class="ff__side">
      <div class="ff__views"><canvas data-view="xy" aria-label="İz-boyu × radyal"></canvas><canvas data-view="zy" aria-label="İz-boyu × çapraz-iz"></canvas><canvas data-view="zx" aria-label="Çapraz-iz × radyal"></canvas></div>
      <div class="ff__hud" role="status"><table><thead><tr><th>deputy</th><th>ρ</th><th>R</th><th>V</th><th>H</th><th>min–max</th><th>sürükl.</th></tr></thead><tbody data-rows></tbody></table><div class="note" data-note></div></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.ff__3d'), labelLayer = figure.querySelector('.ff__labels'), topEl = figure.querySelector('[data-top]'), rowsEl = figure.querySelector('[data-rows]'), noteEl = figure.querySelector('[data-note]');
  const views = Array.from(figure.querySelectorAll('[data-view]'));
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const palette = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(40, 1, .01, 5000);
  const sunDir = new THREE.Vector3(.7, .5, .6).normalize();
  const sun = new THREE.DirectionalLight('#fff4e6', 2.2); sun.position.copy(sunDir).multiplyScalar(200); scene.add(sun);
  scene.add(new THREE.HemisphereLight('#8fa8c4', '#2a2418', .5)); scene.add(new THREE.AmbientLight('#3a404c', .5));
  { const rand = mulberry32(seed), n = reducedMotion ? 600 : 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 1500 + rand() * 500, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .65, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  const lineMat = (color, width, opacity) => new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true });
  const axisMat = lineMat(palette.muted, 1.1, .4);
  const mkLine = (pts, mat) => { const g = new LineGeometry(); g.setPositions(pts); return new Line2(g, mat); };
  const frame = new THREE.Group(); scene.add(frame);
  const labels = []; const addLabel = (text, cls, pos) => { const el = document.createElement('div'); el.className = `ff__label ${cls}`; el.textContent = text; labelLayer.appendChild(el); labels.push({ el, pos }); };
  const craft = await loadCraft();
  const chief = craft.buildOrbiter({ scale: 1 }); scene.add(chief);
  { const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)); chief.quaternion.setFromRotationMatrix(m); }
  const deputyGroup = new THREE.Group(); scene.add(deputyGroup);
  const traceGroup = new THREE.Group(); scene.add(traceGroup);
  const sepGroup = new THREE.Group(); scene.add(sepGroup);

  let form = null, U = 1 / 100, sceneExtent = 10, traces = [], depMeshes = [], sepLines = [], stats = null, traceMats = [];
  const toScene = (s, out) => out.set(s[1] * U, s[0] * U, -s[2] * U);
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 60, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = Math.min(this.duration, Math.max(0, t)); render(0); }, setWarp(w) { this.warp = w; } };

  function clear(g) { while (g.children.length) { const c = g.children.pop(); c.geometry?.dispose?.(); if (c.material?.dispose && !traceMats.includes(c.material)) c.material.dispose(); } }
  function rebuild(id, opts) {
    form = buildFormation(id, opts);
    const ext = form.deputies.reduce((m, d) => { const tr = trace(form, d, 0, form.span, 200); return Math.max(m, ...tr.map(s => Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])))); }, 1);
    U = 10 / ext; sceneExtent = 10 * 1.15;                              // en uzak nokta 10 birim
    clear(frame); clear(deputyGroup); clear(traceGroup); clear(sepGroup); for (const l of labels) l.el.remove(); labels.length = 0; traces = []; depMeshes = []; sepLines = [];
    const L = sceneExtent * 1.2;
    frame.add(mkLine([-L, 0, 0, L, 0, 0], axisMat), mkLine([0, -L, 0, 0, L, 0], axisMat), mkLine([0, 0, -L, 0, 0, L], axisMat));
    addLabel('+V (iz boyu)', 'axis', new THREE.Vector3(L, .5, 0)); addLabel('−V', 'axis', new THREE.Vector3(-L, .5, 0));
    addLabel('+R (zenit)', 'axis', new THREE.Vector3(.6, L, 0)); addLabel('−R (Dünya)', 'axis', new THREE.Vector3(.6, -L, 0)); addLabel('H (çapraz-iz)', 'axis', new THREE.Vector3(.6, .5, L));
    const scaleBar = Math.pow(10, Math.floor(Math.log10(ext))); addLabel(`ölçek: ${nf0.format(scaleBar)} m`, '', new THREE.Vector3(scaleBar * U / 2, -.8, 0)); frame.add(mkLine([0, -.5, 0, scaleBar * U, -.5, 0], lineMat(palette.accent, 2, .8)));
    const chiefScale = Math.max(.35, Math.min(1.2, sceneExtent * .06)); chief.scale.setScalar(chiefScale);
    for (const d of form.deputies) {
      const tr = trace(form, d, 0, Math.min(form.span, form.period * (Math.abs(d.drift) > 1e-9 ? form.span / form.period : 1)), 600);
      const flat = []; const v = new THREE.Vector3(); for (const s of tr) { toScene(s, v); flat.push(v.x, v.y, v.z); }
      const mat = lineMat(d.color, 1.6, .55); traceMats.push(mat); traceGroup.add(mkLine(flat, mat)); traces.push(tr);
      const m = craft.buildCubesat({ units: 3, palette: { accent: new THREE.Color(d.color).getHex() } }); m.scale.setScalar(chiefScale * .55); deputyGroup.add(m); depMeshes.push(m);
      const sl = mkLine([0, 0, 0, 0, 0, 0], lineMat(d.color, 1, .35)); sepGroup.add(sl); sepLines.push(sl);
    }
    stats = separationStats(form);
    timeline.duration = form.span;
    topEl.textContent = `${form.label} · ${nf0.format(form.altitude / 1000)} km dairesel şef yörüngesi · n = ${(form.n * 1e3).toFixed(3)} mrad/s · T = ${nf1.format(form.period / 60)} dk · ${timeline.warp}× zaman`;
    noteEl.textContent = `Sürüklenmesiz koşul: ẏ₀ = −2n x₀ (sekülar sürüklenme −(6n x₀ + 3ẏ₀)). PCO: y–z izdüşümü daire; düzlem-içi hareket 2:1 elips (y genliği 2× x). Doğrusal CW: |r| ≪ a, dairesel referans, J2/sürükleme yok.`;
    rebuildRows();
    scaleCamera();
  }
  function rebuildRows() {
    rowsEl.innerHTML = form.deputies.map((d, i) => `<tr data-i="${i}"><td><i style="background:${d.color}"></i>${d.label}</td><td data-c="rho"></td><td data-c="x"></td><td data-c="y"></td><td data-c="z"></td><td>${fmtM(stats.chief[i].min)}–${fmtM(stats.chief[i].max)}</td><td>${Math.abs(d.drift) < 1e-6 ? '0' : `${nf2.format(d.drift)} m/s`}</td></tr>`).join('')
      + stats.pairs.map(p => `<tr><td>${form.deputies[p.i].label.split(' ·')[0]} ↔ ${form.deputies[p.j].label.split(' ·')[0]}</td><td colspan="4"></td><td>${fmtM(p.min)}–${fmtM(p.max)}</td><td></td></tr>`).join('');
  }
  const fmtM = m => m >= 10000 ? `${nf1.format(m / 1000)} km` : `${nf0.format(m)} m`;

  /* 2B izdüşümler */
  let dpr = 1;
  function drawViews(S) {
    const ext = sceneExtent / U;   // m
    const titles = { xy: ['iz boyu (y) →', 'radyal (x) ↑'], zy: ['iz boyu (y) →', 'çapraz-iz (z) ↑'], zx: ['çapraz-iz (z) →', 'radyal (x) ↑'] };
    const pick = { xy: s => [s[1], s[0]], zy: s => [s[1], s[2]], zx: s => [s[2], s[0]] };
    for (const cv of views) {
      const key = cv.dataset.view, ctx = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = palette.canvas; ctx.fillRect(0, 0, W, H);
      const sc = (Math.min(W, H) / 2 - 10) / ext, cx = W / 2, cy = H / 2, X = v => cx + v * sc, Y = v => cy - v * sc;
      ctx.strokeStyle = palette.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
      ctx.fillStyle = palette.muted; ctx.font = '9.5px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(titles[key][0], W - 4, cy - 3); ctx.textAlign = 'left'; ctx.fillText(titles[key][1], cx + 3, 10);
      form.deputies.forEach((d, i) => { ctx.strokeStyle = d.color; ctx.globalAlpha = .45; ctx.lineWidth = 1; ctx.beginPath(); traces[i].forEach((s, k) => { const [a, b] = pick[key](s); k ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b)); }); ctx.stroke(); ctx.globalAlpha = 1;
        const [a, b] = pick[key](S[i]); ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(X(a), Y(b), 3.5, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = palette.ink; ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
    }
  }

  /* kamera */
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08; controls.enabled = false;
  const cam = { current: options.camera ?? 'overview' };
  const camPos = new THREE.Vector3();
  function scaleCamera() { const d = sceneExtent * 2.4; camPos.set(-d * .62, d * .72, -d * .42); }
  function updateCamera(dtReal) {
    if (cam.current === 'free') { controls.enabled = true; controls.update(); return; }
    controls.enabled = false;
    const d = sceneExtent * 2.4;
    const target = cam.current === 'along' ? new THREE.Vector3(-d * 1.15, d * .12, 0) : cam.current === 'top' ? new THREE.Vector3(0, d * 1.2, .01) : new THREE.Vector3(-d * .62, d * .72, -d * .42);
    camPos.lerp(target, 1 - Math.exp(-dtReal * 4)); camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
  }

  const _v = new THREE.Vector3(), _c = new THREE.Vector3();
  function render(dtReal) {
    const t = timeline.t; const S = statesAt(form, t);
    form.deputies.forEach((d, i) => {
      toScene(S[i], _v); depMeshes[i].position.copy(_v);
      sepLines[i].geometry.setPositions([0, 0, 0, _v.x, _v.y, _v.z]);
      const row = rowsEl.querySelector(`tr[data-i="${i}"]`); if (row) { row.querySelector('[data-c="rho"]').textContent = fmtM(Math.hypot(S[i][0], S[i][1], S[i][2])); row.querySelector('[data-c="x"]').textContent = fmtM(S[i][0]); row.querySelector('[data-c="y"]').textContent = fmtM(S[i][1]); row.querySelector('[data-c="z"]').textContent = fmtM(S[i][2]); }
    });
    drawViews(S);
    updateCamera(dtReal);
    const w = pane3d.clientWidth, h = pane3d.clientHeight;
    for (const l of labels) { _c.copy(l.pos).project(camera); const vis = _c.z < 1 && Math.abs(_c.x) < 1.05 && Math.abs(_c.y) < 1.05; l.el.style.display = vis ? '' : 'none'; if (vis) { l.el.style.left = `${((_c.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _c.y) / 2 * h).toFixed(1)}px`; } }
    renderer.render(scene, camera);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0; const perf = { advanceMs: 0 };
  function advance(dt) { const t0 = performance.now(); if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t -= timeline.duration; } render(dt); perf.advanceMs = perf.advanceMs * .9 + (performance.now() - t0) * .1; }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); axisMat.resolution.set(w, h); for (const m of traceMats) m.resolution.set(w, h); sepGroup.children.forEach(c => c.material.resolution.set(w, h)); frame.children.forEach(c => c.material.resolution.set(w, h)); dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of views) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } }
  const ro = new ResizeObserver(() => { resize(); if (form) render(0); }); ro.observe(figure);
  rebuild(options.scenario ?? 'pco', options.scenarioOptions); resize();
  if (reducedMotion || exportMode) timeline.t = options.t ?? form.period * .35; else if (options.autoplay ?? true) timeline.playing = true;
  render(0); ensureLoop();
  return {
    get form() { return form; }, get stats() { return stats; }, timeline, scenarios: FORMATIONS,
    camera: { get current() { return cam.current; }, mode(m) { cam.current = m; render(0); }, transitionTo(m) { cam.current = m; render(0); } },
    setScenario(id, opts) { timeline.t = 0; rebuild(id, opts); render(0); },
    advance, perf, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.ff__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
