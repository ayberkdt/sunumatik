/* attitude-gnc.mjs — Yönelim / GNC Laboratuvarı (attitude_gnc)

   Gerçek katı-gövde dönme dinamiği (Euler denklemleri + tepki tekerlekleri + kuaterniyon PD)
   üstüne 3B sahne: eylemsiz eksen üçlüsü, gövde eksenleri, hedef yönelim hayaleti, işaret yönü
   (boresight) + işaret konisi, tekerlek momentumu çubukları, gövde hızı / hata / momentum grafikleri.
   Modlar: slew (kontrolcü tepkisi), tumble (Dzhanibekov ara-eksen kararsızlığı), saturation
   (sabit dış tork altında tekerlek doyması), gimbal (3-2-1 Euler tekilliği), slerp (kuaterniyon ↔
   Euler doğrusal interpolasyon karşılaştırması). Çözücü: attitude-model.mjs (saf).

   API:
     const gnc = await mountAttitude(host, { craft:'small', mode:'slew', wn, zeta, target:{psi,theta,phi}, w0, tauExt, duration, warp });
     gnc.sim · gnc.set({...}) · gnc.timeline · gnc.advance(dt) · gnc.dispose()
   Gövde eksenleri: +X gövde ileri (craft-blocks sözleşmesi), +Z gövde yukarı/çanak; boresight = +Z (çanak). */

import * as THREE from 'three';
import { starfield as starfield3, sunGlow, addEarth } from '../core/lab-three.mjs';
import { backdrop } from '../core/lab-scene.mjs';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { coneX } from '../core/geometry-axis.mjs';
import { simulateAttitude, sampleAt, qFromEuler321, qFromEuler123, qSlerp, qAngle, qMul, qConj, qRotate, euler321FromQ, eulerRateMatrix321, CRAFT_PRESETS } from './attitude-model.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const deg = x => x * 180 / Math.PI;
async function loadCraft() { try { const m = await import('../craft_blocks/craft-blocks.mjs'); return m.buildOrbiter; } catch (e) { console.warn('attitude: craft-blocks yok —', e.message); return () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, .4, .4), new THREE.MeshStandardMaterial({ color: 0x33353c }))); return g; }; } }

export async function mountAttitude(host, options = {}) {
  if (!host) throw new Error('mountAttitude bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'gnc';
  figure.innerHTML = `
    <style>
      .gnc{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .gnc__3d{position:relative;min-width:0;min-height:0;} .gnc__3d canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
      .gnc__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .gnc__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;letter-spacing:.06em;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.9);}
      .gnc__side{min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);}
      .gnc__hud{padding:10px 14px;border-bottom:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .gnc__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px;} .gnc__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .gnc__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);} .gnc__hud dd.hi{color:var(--color-accent,#d9b877);} .gnc__hud dd.bad{color:var(--color-data-2,#d78f6c);}
      .gnc__plot{position:relative;min-height:0;border-bottom:1px solid var(--color-rule,#3a3c42);} .gnc__plot canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .gnc__top{position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);pointer-events:none;}
      .gnc__wheels{position:absolute;left:14px;bottom:14px;padding:10px 12px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;width:210px;}
      .gnc__wheels h4{margin:0 0 6px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted,#9a938a);font-weight:600;}
      .gnc__wheels .bar{display:grid;grid-template-columns:14px 1fr 54px;align-items:center;gap:8px;font-size:11px;font-family:var(--font-mono,ui-monospace,monospace);margin:3px 0;}
      .gnc__wheels .bar i{display:block;height:8px;background:var(--color-rule,#3a3c42);border-radius:4px;position:relative;overflow:hidden;}
      .gnc__wheels .bar i b{position:absolute;top:0;bottom:0;left:50%;background:var(--color-data-1,#8fb8dd);} .gnc__wheels .bar i b.sat{background:var(--color-data-2,#d78f6c);}
    </style>
    <div class="gnc__3d"><div class="gnc__labels" aria-hidden="true"></div><div class="gnc__top" data-top></div>
      <div class="gnc__wheels" aria-hidden="true"><h4>Tepki tekerlekleri h_w / h_max</h4><div class="bar"><span>x</span><i><b data-w="0"></b></i><span data-wv="0"></span></div><div class="bar"><span>y</span><i><b data-w="1"></b></i><span data-wv="1"></span></div><div class="bar"><span>z</span><i><b data-w="2"></b></i><span data-wv="2"></span></div></div></div>
    <div class="gnc__side">
      <div class="gnc__hud" role="status"><dl>
        <dt>t</dt><dd data-h="t">—</dd><dt>hata açısı</dt><dd data-h="err" class="hi">—</dd>
        <dt>ω gövde</dt><dd data-h="w">—</dd><dt>|ω|</dt><dd data-h="wn">—</dd>
        <dt>Euler 3-2-1</dt><dd data-h="eu">—</dd><dt>q</dt><dd data-h="q">—</dd>
        <dt>τ_c</dt><dd data-h="tau">—</dd><dt>|H| toplam</dt><dd data-h="H">—</dd>
        <dt>gimbal 1/cosθ</dt><dd data-h="gim">—</dd><dt>enerji T</dt><dd data-h="T">—</dd>
      </dl></div>
      <div class="gnc__plot"><canvas data-plot="rates" aria-label="Gövde hızları"></canvas></div>
      <div class="gnc__plot"><canvas data-plot="err" aria-label="Hata açısı ve momentum"></canvas></div>
      <div class="gnc__plot"><canvas data-plot="euler" aria-label="Euler açıları"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.gnc__3d'), labelLayer = figure.querySelector('.gnc__labels'), topEl = figure.querySelector('[data-top]');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const wheelBars = [0, 1, 2].map(i => ({ b: figure.querySelector(`[data-w="${i}"]`), v: figure.querySelector(`[data-wv="${i}"]`) }));
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const AX = { x: '#d78f6c', y: '#9ad3a1', z: '#8fb8dd' };

  /* -------- 3B */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(36, 1, .05, 100); camera.position.set(3.2, 2.1, 3.6); camera.lookAt(0, 0, 0);
  scene.add(new THREE.DirectionalLight('#fff4e6', 2.2).translateX(4).translateY(5).translateZ(3)); scene.add(new THREE.HemisphereLight('#8fa8c4', '#2a2418', .55)); scene.add(new THREE.AmbientLight('#3a404c', .5));
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08;
  /* bağlam: yıldız alanı, Güneş ışıması (ışık yönünde) ve nadirde Dünya ufku (ölçek temsilî) — yönelim neyle ilişkili görülsün */
  starfield3(THREE, scene, { seed: 5, n: 900, r0: 42, r1: 60, size: .6, opacity: .6 }); sunGlow(THREE, scene, new THREE.Vector3(4, 5, 3), { dist: 70, size: 16 });
  { const eg = new THREE.Group(); scene.add(eg); await addEarth(THREE, eg, { radius: 16, baseUrl: import.meta.url, atmosphere: '#6fb4ff', atmoStrength: 1.1, segments: 96 }); eg.position.set(0, -16 - 2.3, 0); eg.rotation.set(-1.05, .7, 0); /* ufuk dalımı ≈ 36°: karenin alt kenarında Dünya yayı; orta enlemler yukarı */ }
  /* eylemsiz çerçeve: sahne X = eylemsiz x, sahne Y = eylemsiz z (yukarı), sahne Z = −eylemsiz y (sağ-elli) */
  const toScene = v => new THREE.Vector3(v[0], v[2], -v[1]);
  const lineMat = (color, width, opacity) => new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true });
  const mats = [];
  const mkLine = (pts, color, width, opacity) => { const g = new LineGeometry(); g.setPositions(pts); const m = lineMat(color, width, opacity); mats.push(m); return new Line2(g, m); };
  const labels = []; const addLabel = (text, color, pos, parent = null) => { const el = document.createElement('div'); el.className = 'gnc__label'; el.textContent = text; el.style.color = color; labelLayer.appendChild(el); labels.push({ el, pos, parent }); };
  /* eylemsiz eksenler (soluk) */
  for (const [k, v, c] of [['x', [1, 0, 0], AX.x], ['y', [0, 1, 0], AX.y], ['z', [0, 0, 1], AX.z]]) { const p = toScene(v.map(x => x * 2.4)); scene.add(mkLine([0, 0, 0, p.x, p.y, p.z], c, 1.1, .35)); addLabel(`${k}ᵢ`, c, p.clone().multiplyScalar(1.06)); }
  /* gövde: craft + gövde eksenleri (parlak) + boresight konisi */
  const buildOrbiter = await loadCraft();
  const body = new THREE.Group(); scene.add(body);
  const craftMesh = buildOrbiter({ scale: 1 }); craftMesh.scale.setScalar(1.1); body.add(craftMesh);
  for (const [k, v, c] of [['x', [1, 0, 0], AX.x], ['y', [0, 1, 0], AX.y], ['z', [0, 0, 1], AX.z]]) { const p = toScene(v.map(x => x * 1.5)); body.add(mkLine([0, 0, 0, p.x, p.y, p.z], c, 2.2, .95)); addLabel(`${k}_b`, c, p.clone().multiplyScalar(1.1), body); }
  /* boresight: gövde +Z (çanak) → sahne +Y; koni: coneX tepesi +X'te → kuaterniyonla yönlendir */
  const cone = coneX(.42, 2.2, 32, new THREE.MeshBasicMaterial({ color: P.accent, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide }), true);
  cone.position.x = 1.1 + .55; const coneHolder = new THREE.Group(); coneHolder.add(cone); coneHolder.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)); body.add(coneHolder);
  const bore = mkLine([0, 0, 0, 0, 2.6, 0], P.accent, 2, .9); body.add(bore);
  /* hedef hayaleti: yalnız eksenler + boresight, ince */
  const ghost = new THREE.Group(); scene.add(ghost);
  for (const [v, c] of [[[1, 0, 0], AX.x], [[0, 1, 0], AX.y], [[0, 0, 1], AX.z]]) { const p = toScene(v.map(x => x * 1.5)); ghost.add(mkLine([0, 0, 0, p.x, p.y, p.z], c, 1, .35)); }
  ghost.add(mkLine([0, 0, 0, 0, 2.6, 0], P.accent, 1, .35)); addLabel('hedef', P.accent, new THREE.Vector3(0, 2.75, 0), ghost);
  /* kuaterniyon [x,y,z,w] (gövde→eylemsiz) → sahne kuaterniyonu: sahne eksen eşlemesi R = (x→X, y→−Z, z→Y) */
  const mapQ = q => { const R = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)); const qi = new THREE.Quaternion(q[0], q[1], q[2], q[3]); const qR = new THREE.Quaternion().setFromRotationMatrix(R); return qR.clone().multiply(qi).multiply(qR.clone().invert()); };

  /* -------- durum */
  let cfg = { craft: options.craft ?? 'small', mode: options.mode ?? 'slew', wn: options.wn ?? .2, zeta: options.zeta ?? 1, target: options.target ?? { psi: .8, theta: .4, phi: -.6 }, w0: options.w0 ?? [0, 0, 0], tauExt: options.tauExt ?? [0, 0, 0], duration: options.duration ?? 120, wheels: options.wheels ?? true, seq: options.seq ?? '321' };
  let sim = null;
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 1, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); render(0); }, setWarp(w) { this.warp = w; } };
  function recompute() {
    const qT = cfg.seq === '123' ? qFromEuler123(cfg.target.phi, cfg.target.theta, cfg.target.psi) : qFromEuler321(cfg.target.psi, cfg.target.theta, cfg.target.phi);
    const base = { craft: cfg.craft, mode: cfg.mode === 'slerp' || cfg.mode === 'euler' || cfg.mode === 'gimbal' ? 'tumble' : cfg.mode, qTarget: qT, wn: cfg.wn, zeta: cfg.zeta, w0: cfg.w0, tauExt: cfg.tauExt, duration: cfg.duration, wheels: cfg.wheels };
    if (cfg.mode === 'saturation') base.qTarget = [0, 0, 0, 1];
    if (cfg.mode === 'slerp' || cfg.mode === 'euler' || cfg.mode === 'gimbal') { base.w0 = [0, 0, 0]; base.duration = 12; }
    sim = simulateAttitude(base);
    /* slerp / euler / gimbal modları kinematik gösterimdir: örnekleri kuaterniyon yollarıyla değiştir */
    if (cfg.mode === 'slerp' || cfg.mode === 'euler' || cfg.mode === 'gimbal') {
      const e0 = { psi: 0, theta: 0, phi: 0 };
      const eT = cfg.mode === 'gimbal' ? { psi: .9, theta: Math.PI / 2 - .02, phi: .7 } : cfg.target;
      const q0 = [0, 0, 0, 1], q1 = cfg.seq === '123' ? qFromEuler123(eT.phi, eT.theta, eT.psi) : qFromEuler321(eT.psi, eT.theta, eT.phi);
      sim.samples = sim.samples.map(s => { const f = clamp(s.t / 10, 0, 1);
        const qS = qSlerp(q0, q1, f);
        const eL = { psi: e0.psi + (eT.psi - e0.psi) * f, theta: e0.theta + (eT.theta - e0.theta) * f, phi: e0.phi + (eT.phi - e0.phi) * f };
        const qE = cfg.seq === '123' ? qFromEuler123(eL.phi, eL.theta, eL.psi) : qFromEuler321(eL.psi, eL.theta, eL.phi);
        const q = cfg.mode === 'slerp' ? qS : qE;
        const eu = euler321FromQ(q);
        return { ...s, q, qAlt: cfg.mode === 'slerp' ? qE : qS, w: [0, 0, 0], hw: [0, 0, 0], tauC: [0, 0, 0], err: qAngle(qMul(qConj(q1), q)), euler: eu, gimbal: eulerRateMatrix321(eu.theta, eu.phi).det, T: 0, H: 0 }; });
      sim.cfg.qTarget = q1; sim.events = [];
    }
    timeline.duration = sim.samples[sim.samples.length - 1].t; timeline.t = Math.min(timeline.t, timeline.duration);
    ghost.quaternion.copy(mapQ(sim.cfg.qTarget)); ghost.visible = cfg.mode !== 'tumble' && cfg.mode !== 'saturation';
    const c = CRAFT_PRESETS[cfg.craft];
    topEl.textContent = `${c.label} · I = diag(${c.I.join(', ')}) kg·m² · h_max ${c.hMax} N·m·s · τ_max ${c.tauMax} N·m · ω_n ${cfg.wn} rad/s, ζ ${cfg.zeta} · ${timeline.warp}× zaman`;
  }

  /* -------- grafikler */
  let dpr = 1;
  function drawPlot(cv, series, opts) {
    const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W, Hh, { canvas: P.canvas });
    const pad = { l: 40, r: 10, t: 18, b: 14 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b;
    let lo = Infinity, hi = -Infinity; for (const s of series) for (const v of s.data) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (opts.symmetric) { const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-6); lo = -m; hi = m; } if (hi - lo < 1e-9) { hi = lo + 1; } if (opts.zero) lo = Math.min(lo, 0);
    const X = i => pad.l + i / (series[0].data.length - 1) * pw, Y = v => pad.t + ph - (v - lo) / (hi - lo) * ph;
    ctx.strokeStyle = P.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(pad.l + pw, Y(0)); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(opts.fmt(hi), pad.l - 4, pad.t + 8); ctx.fillText(opts.fmt(lo), pad.l - 4, pad.t + ph); ctx.textAlign = 'left'; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(opts.title, pad.l, 12);
    series.forEach((s, k) => { ctx.strokeStyle = s.color; ctx.lineWidth = 1.4; ctx.beginPath(); s.data.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))); ctx.stroke(); ctx.fillStyle = s.color; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(s.label, pad.l + pw - 60 + k * 0, pad.t + 10 + k * 11); });
    const xi = timeline.t / timeline.duration * (series[0].data.length - 1); ctx.strokeStyle = P.accent; ctx.beginPath(); ctx.moveTo(X(xi), pad.t); ctx.lineTo(X(xi), pad.t + ph); ctx.stroke();
  }
  function drawPlots() {
    const S = sim.samples;
    drawPlot(plots.rates, [0, 1, 2].map(i => ({ label: 'ω' + 'xyz'[i], color: [AX.x, AX.y, AX.z][i], data: S.map(s => deg(s.w[i])) })), { title: 'gövde açısal hızları (°/s)', symmetric: true, fmt: v => nf1.format(v) });
    if (cfg.mode === 'tumble') drawPlot(plots.err, [{ label: 'T', color: P.accent, data: S.map(s => s.T) }, { label: '|H|', color: P.data1, data: S.map(s => s.H) }], { title: 'kinetik enerji (J) ve |H| (N·m·s) — korunum', zero: true, fmt: v => nf2.format(v) });
    else drawPlot(plots.err, [{ label: 'hata °', color: P.accent, data: S.map(s => deg(s.err)) }, { label: '|h_w|/h_max', color: P.data1, data: S.map(s => sim.cfg.hMax > 0 ? Math.hypot(...s.hw) / sim.cfg.hMax * (deg(S[0].err) || 1) : 0) }], { title: 'yönelim hatası (°) · tekerlek momentumu (ölçekli)', zero: true, fmt: v => nf1.format(v) });
    drawPlot(plots.euler, [{ label: 'ψ', color: AX.z, data: S.map(s => deg(s.euler.psi)) }, { label: 'θ', color: AX.y, data: S.map(s => deg(s.euler.theta)) }, { label: 'φ', color: AX.x, data: S.map(s => deg(s.euler.phi)) }], { title: cfg.mode === 'gimbal' ? 'Euler 3-2-1 (°) — θ → 90°: ψ ve φ ayrışamaz' : 'Euler 3-2-1 (°)', symmetric: true, fmt: v => nf1.format(v) });
  }

  /* -------- kare */
  const _v = new THREE.Vector3();
  function render(dtReal) {
    const s = sampleAt(sim, timeline.t);
    body.quaternion.copy(mapQ(s.q));
    controls.update();
    for (let i = 0; i < 3; i++) { const f = sim.cfg.hMax > 0 ? clamp(s.hw[i] / sim.cfg.hMax, -1, 1) : 0; const b = wheelBars[i].b; b.style.left = f >= 0 ? '50%' : `${50 + f * 50}%`; b.style.width = `${Math.abs(f) * 50}%`; b.className = Math.abs(f) > .999 ? 'sat' : ''; wheelBars[i].v.textContent = `${nf3.format(s.hw[i])}`; }
    H.t.textContent = `${nf1.format(s.t)} s`; H.err.textContent = `${nf2.format(deg(s.err))}°`; H.w.textContent = s.w.map(v => nf2.format(deg(v))).join(' / ') + ' °/s'; H.wn.textContent = `${nf2.format(deg(Math.hypot(...s.w)))} °/s`;
    H.eu.textContent = `${nf1.format(deg(s.euler.psi))} / ${nf1.format(deg(s.euler.theta))} / ${nf1.format(deg(s.euler.phi))}°`; H.q.textContent = s.q.map(v => nf3.format(v)).join(', ');
    H.tau.textContent = (s.tauC || [0, 0, 0]).map(v => v.toExponential(1)).join(' / ') + ' N·m'; H.H.textContent = `${nf3.format(s.H)} N·m·s`; H.gim.textContent = Math.abs(s.gimbal) > 50 ? `${Math.abs(s.gimbal).toExponential(1)} — KİLİT` : nf2.format(Math.abs(s.gimbal)); H.gim.className = Math.abs(s.gimbal) > 10 ? 'bad' : ''; H.T.textContent = `${nf3.format(s.T)} J`;
    drawPlots();
    const w = pane3d.clientWidth, h = pane3d.clientHeight;
    for (const l of labels) { _v.copy(l.pos); if (l.parent) l.parent.localToWorld(_v); _v.project(camera); const vis = _v.z < 1; l.el.style.display = vis ? '' : 'none'; if (vis) { l.el.style.left = `${((_v.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _v.y) / 2 * h).toFixed(1)}px`; } }
    renderer.render(scene, camera);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t = 0; } render(dt); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); for (const m of mats) m.resolution.set(w, h); dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } }
  const ro = new ResizeObserver(() => { resize(); if (sim) render(0); }); ro.observe(figure);
  recompute(); resize();
  if (reducedMotion || exportMode) timeline.t = options.t ?? timeline.duration * .35; else if (options.autoplay ?? true) timeline.playing = true;
  render(0); ensureLoop();
  return {
    get sim() { return sim; }, get config() { return { ...cfg } ; }, presets: CRAFT_PRESETS, timeline,
    set(c) { cfg = { ...cfg, ...c }; timeline.t = 0; recompute(); render(0); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.gnc__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
