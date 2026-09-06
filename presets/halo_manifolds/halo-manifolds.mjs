/* halo-manifolds.mjs — Halo Yörüngeleri ve Değişmez Manifoldlar (halo_manifolds)

   CR3BP dönen çerçevede 3B sahne: birincil/ikincil, ∇Ω = 0'dan çözülen L1/L2, Richardson + STM
   düzeltmesiyle bulunan halo AİLESİ, seçilen halo (vurgulu), aynı L'nin düzlemsel Lyapunov yörüngesi
   (karşılaştırma), monodromi özvektörlerinden kararsız (turuncu, ileri) ve kararlı (mavi, geri) manifold
   demetleri; yörünge üzerinde hareket eden uzay aracı imi. Yan panel: x–y ve x–z izdüşümleri + HUD.
   Çözücü: ../core/astro-cr3bp.mjs (saf). Sahne çerçevesi: dönen (x, y, z) → (X = x, Y = z, Z = −y).

   API: const hm = await mountHalo(host, { system, L, AzKm, northern, camera, warp, manifolds:{uPlus,uMinus,sPlus,sMinus}, tEnd, autoplay, t });
        hm.set({...}) · hm.model · hm.timeline · hm.camera · hm.show(branch, bool) · hm.dispose()
   Eksen güvenliği: yalnızca SphereGeometry + Line2 (silindir/koni yok). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { buildHalo, SYSTEMS } from './halo-model.mjs';
import { palette, Entrance, reveal, staticMode } from '../core/lab-scene.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function mountHalo(host, options = {}) {
  if (!host) throw new Error('mountHalo bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'hm';
  figure.innerHTML = `
    <style>
      .hm{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,12fr) minmax(0,8fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .hm__3d{position:relative;min-width:0;} .hm__3d canvas{display:block;width:100%;height:100%;}
      .hm__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .hm__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);text-shadow:0 1px 4px rgba(0,0,0,.9);}
      .hm__label.pt{color:var(--color-accent,#d9b877);font-weight:600;letter-spacing:.1em;} .hm__label.body{color:var(--color-ink,#e9e4d8);font-weight:600;}
      .hm__side{min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr);}
      .hm__views{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--color-rule,#3a3c42);} .hm__views canvas{display:block;width:100%;height:100%;min-height:0;}
      .hm__hud{padding:12px 16px 10px;}
      .hm .lab-hud__hero .v{font-size:17px;}
      .hm__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:1px 12px;} .hm__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .hm__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:11px;color:var(--color-ink,#e9e4d8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .hm__hud dd.hi{color:var(--color-accent,#d9b877);}
      .hm__legend{margin-top:6px;font-size:11px;letter-spacing:.04em;} .hm__legend i{display:inline-block;width:14px;height:3px;margin:0 6px 0 10px;vertical-align:middle;border-radius:2px;}
      .hm__top{position:absolute;top:14px;left:14px;padding:8px 12px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;font-size:11px;letter-spacing:.06em;color:var(--color-accent,#d9b877);
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
    </style>
    <div class="hm__3d" data-lab-reveal="fade"><div class="hm__labels" aria-hidden="true"></div><div class="lab-top" data-top></div></div>
    <div class="hm__side">
      <div class="hm__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">Az genliği</span><span class="v hi" data-h="amp">—</span></div>
          <div><span class="k">Periyot</span><span class="v hi" data-h="T">—</span></div>
          <div><span class="k">λ_u · ν</span><span class="v" data-h="lam">—</span></div>
          <div><span class="k">Wˢ en yakın yaklaşma</span><span class="v hi" data-h="tx">—</span></div>
        </div>
        <dl>
        <dt>Sistem · nokta</dt><dd data-h="sys">—</dd><dt>Aile</dt><dd data-h="fam">—</dd>
        <dt>Ax · yön</dt><dd data-h="ax">—</dd><dt>—</dt><dd></dd>
        <dt>Jacobi C</dt><dd data-h="C">—</dd><dt>C_L (nokta)</dt><dd data-h="CL">—</dd>
        <dt>det Φ · kapanış</dt><dd data-h="det">—</dd><dt>ΔV ekleme · TOF</dt><dd data-h="txdv">—</dd>
        <dt>Düzeltici</dt><dd data-h="corr">—</dd><dt>Richardson → düzeltilmiş</dt><dd data-h="rich">—</dd>
        <dt>Manifold</dt><dd data-h="mf">—</dd><dt>ε büyümesi (1 T)</dt><dd data-h="grow">—</dd>
        <dt>Lyapunov (aynı L)</dt><dd data-h="ly">—</dd><dt>t</dt><dd data-h="t">—</dd>
      </dl><div class="lab-legend" data-legend></div></div>
      <div class="hm__views" data-lab-reveal="fade"><canvas data-view="xy" aria-label="x–y izdüşümü (üstten)"></canvas><canvas data-view="xz" aria-label="x–z izdüşümü (yandan)"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.hm__3d'), labelLayer = figure.querySelector('.hm__labels'), topEl = figure.querySelector('[data-top]'), legendEl = figure.querySelector('[data-legend]');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const views = Array.from(figure.querySelectorAll('[data-view]'));
  const P = palette(figure);
  /* 3B giriş sahnesi: gruplar sırayla belirir (malzeme opaklığı hedef × ilerleme) */
  const matTargets = new Map(); const entrance = new Entrance({ bodies: { at: 0, dur: .6 }, family: { at: .3, dur: .8 }, halo: { at: .8, dur: .8 }, lyap: { at: 1.2, dur: .5 }, manifolds: { at: 1.3, dur: 1.4 } }, { onFrame: () => render(0) });
  const COL = { uPlus: '#e0895a', uMinus: '#f2c090', sPlus: '#6fa3d8', sMinus: '#a9cdea', halo: P.accent, family: P.muted, lyap: '#8fd39a' };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf4 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(P.canvas);
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 5000);
  const sun = new THREE.DirectionalLight('#fff4e6', 2.0); sun.position.set(-60, 40, 30); scene.add(sun);
  scene.add(new THREE.HemisphereLight('#8fa8c4', '#2a2418', .5)); scene.add(new THREE.AmbientLight('#3a404c', .6));
  { const rand = mulberry32(options.seed ?? 7), n = reducedMotion ? 500 : 1200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 1500 + rand() * 500, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .6, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08;
  const lineMats = [];
  const lineMat = (color, width, opacity, stage = 'bodies') => { const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true }); lineMats.push(m); matTargets.set(m, { target: opacity, stage }); return m; };
  const fadeMesh = (mesh, stage = 'bodies') => { mesh.material.transparent = true; matTargets.set(mesh.material, { target: 1, stage }); return mesh; };
  const mkLine = (flat, mat) => { const g = new LineGeometry(); g.setPositions(flat); return new Line2(g, mat); };
  const labels = []; const addLabel = (text, cls, pos) => { const el = document.createElement('div'); el.className = `hm__label ${cls}`; el.textContent = text; labelLayer.appendChild(el); labels.push({ el, pos }); };

  const U = 10;                                                      // 1 boyutsuz uzunluk = 10 sahne birimi
  const toScene = (s, out) => out.set(s[0] * U, s[2] * U, -s[1] * U);
  const groups = { bodies: new THREE.Group(), family: new THREE.Group(), halo: new THREE.Group(), lyap: new THREE.Group(), uPlus: new THREE.Group(), uMinus: new THREE.Group(), sPlus: new THREE.Group(), sMinus: new THREE.Group() };
  for (const g of Object.values(groups)) scene.add(g);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: P.accent, emissive: P.accent, emissiveIntensity: .8, roughness: .5 })); scene.add(marker);
  const show = { uPlus: true, uMinus: true, sPlus: true, sMinus: true, family: true, lyap: true, ...(options.manifolds || {}) };

  let cfg = { system: options.system ?? 'earthMoon', L: options.L ?? 'L1', AzKm: options.AzKm ?? null, northern: options.northern ?? true, tEnd: options.tEnd ?? 5, nMan: options.nManifold ?? 12 };
  let model = null, focus = new THREE.Vector3(), extent = 1;
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? .35, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); render(0); } };
  const cam = { current: options.camera ?? ((options.system ?? 'earthMoon') === 'earthMoon' ? 'overview' : 'lpoint') }; const camPos = new THREE.Vector3();

  function clear(g) { while (g.children.length) { const c = g.children.pop(); c.geometry?.dispose?.(); } }
  function flat(states) { const out = []; const v = new THREE.Vector3(); for (const s of states) { toScene(s, v); out.push(v.x, v.y, v.z); } return out; }
  function rebuild() {
    const sys = SYSTEMS[cfg.system];
    model = buildHalo({ system: cfg.system, L: cfg.L, Az: cfg.AzKm == null ? null : cfg.AzKm / sys.L, northern: cfg.northern, manifold: { n: cfg.nMan, tEnd: cfg.tEnd } });
    for (const g of Object.values(groups)) clear(g); for (const l of labels) l.el.remove(); labels.length = 0; matTargets.clear();
    if (!model) { topEl.textContent = 'Halo ailesi bulunamadı'; return; }
    const { mu, orbit, lagrange } = model;
    extent = Math.max(orbit.Ax, orbit.Az, 1e-4) * U; focus.set(lagrange[cfg.L].x * U, 0, 0);
    /* cisimler */
    const rp = Math.max(sys.rPrimary / sys.L, .004) * U, rs = Math.max(sys.rSecondary / sys.L, .003) * U;
    const prim = new THREE.Mesh(new THREE.SphereGeometry(rp, 40, 28), new THREE.MeshStandardMaterial({ color: cfg.system === 'earthMoon' ? '#3d6fa8' : '#f0c060', emissive: cfg.system === 'earthMoon' ? '#0b1d33' : '#6b4a10', emissiveIntensity: .6, roughness: .8 })); prim.position.set(-mu * U, 0, 0); groups.bodies.add(fadeMesh(prim));
    const sec = new THREE.Mesh(new THREE.SphereGeometry(rs, 32, 22), new THREE.MeshStandardMaterial({ color: cfg.system === 'earthMoon' ? '#a9a49b' : '#3d6fa8', roughness: .9 })); sec.position.set((1 - mu) * U, 0, 0); groups.bodies.add(fadeMesh(sec));
    addLabel(sys.primary, 'body', new THREE.Vector3(-mu * U, rp + Math.min(.6, extent * .3), 0)); addLabel(sys.secondary, 'body', new THREE.Vector3((1 - mu) * U, rs + Math.min(.35, extent * .25), 0));
    const axisMat = lineMat(P.muted, 1, .35); groups.bodies.add(mkLine([-1.3 * U, 0, 0, 1.4 * U, 0, 0], axisMat));
    for (const k of ['L1', 'L2']) { const p = lagrange[k]; const m = new THREE.Mesh(new THREE.SphereGeometry(Math.min(.06, extent * .04), 12, 8), new THREE.MeshBasicMaterial({ color: P.accent })); m.position.set(p.x * U, 0, 0); groups.bodies.add(m); addLabel(k, 'pt', new THREE.Vector3(p.x * U, -Math.min(.3, extent * .22), 0)); }
    /* aile */
    const famMat = lineMat(COL.family, 1, .22, 'family');
    for (const o of model.family) if (Math.abs(Math.abs(o.z0) - Math.abs(orbit.z0)) > 1e-6) groups.family.add(mkLine(flat(o.states), famMat));
    groups.halo.add(mkLine(flat(orbit.states), lineMat(COL.halo, 2.4, 1, 'halo')));
    if (model.lyap) groups.lyap.add(mkLine(flat(model.lyap.states), lineMat(COL.lyap, 1.3, .75, 'lyap')));
    for (const k of ['uPlus', 'uMinus', 'sPlus', 'sMinus']) { const mat = lineMat(COL[k], 1, .32, 'manifolds'); model.manifolds[k].forEach((tr, i) => { if (tr.states.length > 2) groups[k].add(mkLine(flat(tr.states), (model.transfer.best && model.transfer.best.branch === k && model.transfer.best.index === i) ? lineMat('#8fd39a', 2, .95, 'manifolds') : mat)); }); }
    /* odak ve ölçek */
    marker.scale.setScalar(Math.max(.002, extent * .03));
    timeline.duration = orbit.period; if (timeline.t > timeline.duration) timeline.t = 0;
    applyVisibility(); resize(); scaleCamera(true); writeHud();
  }
  function applyVisibility() { for (const k of ['uPlus', 'uMinus', 'sPlus', 'sMinus', 'family', 'lyap']) groups[k].visible = !!show[k]; }
  function writeHud() {
    const { sys, orbit, mono, family, lagrange, toKm, toDays, growth, lyap, manifoldOpts: mo } = model;
    H.sys.textContent = `${sys.label} · ${cfg.L} (x = ${nf4.format(lagrange[cfg.L].x)})`; H.fam.textContent = `${family.length} üye, Az ${nf0.format(toKm(model.AzMin))}–${nf0.format(toKm(model.AzMax))} km`;
    H.amp.innerHTML = `${nf0.format(toKm(orbit.Az))}<span class="u">km</span>`; H.ax.textContent = `${nf0.format(toKm(orbit.Ax))} km · ${orbit.northern ? 'kuzey' : 'güney'}`; H.T.innerHTML = `${nf2.format(toDays(orbit.period))}<span class="u">gün</span>`;
    H.C.textContent = nf4.format(orbit.C); H.CL.textContent = nf4.format(lagrange[cfg.L].C);
    H.lam.innerHTML = `${mono.lambdaU >= 1e4 ? mono.lambdaU.toExponential(1) : nf0.format(mono.lambdaU)}<span class="u">ν ${nf0.format(mono.nu)}</span>`; H.det.textContent = `${mono.det.toFixed(6)} · ${mono.closure.toExponential(1)}`;
    H.corr.textContent = `${orbit.iterations} yin. · artık ${orbit.residual.toExponential(1)}`;
    const g = orbit.guess; H.rich.textContent = g && g.gamma != null ? `Δx₀ ${nf0.format(toKm(Math.abs(orbit.x0 - g.x0)))} km · Δẏ₀ ${((Math.abs(orbit.ydot0 - g.ydot0) / Math.abs(g.ydot0)) * 100).toFixed(1)} %` : 'aile sürekliliği';
    H.mf.textContent = `${mo.n}×4 · ε ${nf0.format(toKm(mo.eps))} km · ${nf1.format(toDays(mo.tEnd))} gün`; H.grow.textContent = growth ? `×${growth.ratio >= 1e4 ? growth.ratio.toExponential(2) : nf1.format(growth.ratio)} (λ_u ${mono.lambdaU >= 1e4 ? mono.lambdaU.toExponential(2) : nf1.format(mono.lambdaU)})` : '—';
    H.ly.textContent = lyap ? `Ax ${nf0.format(toKm(lyap.Ax))} km · T ${nf2.format(toDays(lyap.period))} g` : '—';
    const tx = model.transfer.best; H.tx.innerHTML = tx ? `${nf0.format(tx.hKm)}<span class="u">km${tx.impact ? ' ✕' : ''}</span>` : '—'; H.txdv.textContent = tx ? `${nf2.format(tx.dvKmS)} km/s (v_in ${nf2.format(tx.vInKmS)}, v_c ${nf2.format(tx.vcKmS)}) · ${nf1.format(tx.tofDays)} gün` : '—';
    legendEl.innerHTML = `<i style="background:${COL.halo}"></i>seçili halo <i style="background:${COL.family}"></i>aile <i style="background:${COL.lyap}"></i>Lyapunov <i style="background:${COL.uPlus}"></i>kararsız W<sup>u</sup> (ileri) <i style="background:${COL.sPlus}"></i>kararlı W<sup>s</sup> (geri) <i style="background:#8fd39a"></i>en yakın yaklaşma yörüngesi`;
    topEl.textContent = `${sys.label} CR3BP · dönen çerçeve · ${cfg.L} halo, Az ${nf0.format(toKm(orbit.Az))} km · Richardson + STM düzeltmesi · manifoldlar Φ(T) özvektörlerinden`;
  }
  function stateAt(t) { const { states, times } = model.orbit; const T = model.orbit.period; let tt = ((t % T) + T) % T; let i = 0; while (i < times.length - 2 && times[i + 1] < tt) i++; const f = (tt - times[i]) / Math.max(1e-12, times[i + 1] - times[i]); return states[i].map((v, k) => v + (states[i + 1][k] - v) * f); }
  let dpr = 1;
  function drawViews(s) {
    for (const cv of views) {
      const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
      const isXY = cv.dataset.view === 'xy', ax = 0, ay = isXY ? 1 : 2, Lx = model.lagrange[cfg.L].x;
      const ext = Math.max(model.orbit.Ax, model.orbit.Az) * 2.6, sc = Math.min(W, Hh) / 2 / ext * .92, X = x => W / 2 + (x - Lx) * sc, Y = y => Hh / 2 - y * sc;
      ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(isXY ? 'x–y (üstten)' : 'x–z (yandan)', 8, 14);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.moveTo(X(Lx), 0); ctx.lineTo(X(Lx), Hh); ctx.stroke();
      const poly = (states, color, w, alpha) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = alpha; ctx.beginPath(); states.forEach((p, k) => k ? ctx.lineTo(X(p[ax]), Y(p[ay])) : ctx.moveTo(X(p[ax]), Y(p[ay]))); ctx.stroke(); ctx.globalAlpha = 1; };
      for (const k of ['uPlus', 'uMinus', 'sPlus', 'sMinus']) if (show[k]) for (const tr of model.manifolds[k]) poly(tr.states, COL[k], .8, .35);
      if (show.family) for (const o of model.family) poly(o.states, COL.family, .8, .3);
      if (show.lyap && model.lyap) poly(model.lyap.states, COL.lyap, 1, .8);
      const tb = model.transfer.best; if (tb && show[tb.branch]) poly(model.manifolds[tb.branch][tb.index].states, '#8fd39a', 1.6, .95);
      poly(model.orbit.states, COL.halo, 2, 1);
      const secX = 1 - model.mu; if (X(secX) < W + 20) { ctx.fillStyle = '#a9a49b'; ctx.beginPath(); ctx.arc(X(secX), Y(0), Math.max(2, model.sys.rSecondary / model.sys.L * sc), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(Lx), Y(0), 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(X(s[ax]), Y(s[ay]), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`${nf0.format(model.toKm(ext / 2.6))} km`, 8, Hh - 8);
    }
  }
  function scaleCamera(snap) { const d = cam.current === 'overview' ? U * 1.7 : extent * 3.6; const tgt = cam.current === 'overview' ? new THREE.Vector3((1 - model.mu) * U * .55, 0, 0) : focus; const p = cam.current === 'top' ? new THREE.Vector3(tgt.x, d * 1.2, tgt.z + .001) : cam.current === 'side' ? new THREE.Vector3(tgt.x, tgt.y + d * .08, tgt.z + d * 1.15) : new THREE.Vector3(tgt.x - d * .55, tgt.y + d * .6, tgt.z + d * .7); if (snap) { camPos.copy(p); controls.target.copy(tgt); } return { p, tgt }; }
  function updateCamera(dtReal) {
    if (cam.current === 'free') { controls.enabled = true; controls.update(); return; }
    controls.enabled = false; const { p, tgt } = scaleCamera(false);
    camPos.lerp(p, 1 - Math.exp(-dtReal * 4)); camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(tgt); controls.target.copy(tgt);
  }
  const _v = new THREE.Vector3(), _c = new THREE.Vector3();
  function render(dtReal) {
    if (!model) return;
    for (const [m, o] of matTargets) m.opacity = o.target * entrance.progress(o.stage);
    marker.visible = entrance.progress('halo') > .5;
    const s = stateAt(timeline.t); toScene(s, _v); marker.position.copy(_v);
    H.t.textContent = `${nf2.format(model.toDays(timeline.t))} g · ${nf2.format(timeline.t / model.orbit.period)} T · C ${nf4.format(model.jacobi(s))}`;
    drawViews(s); updateCamera(dtReal);
    const w = pane3d.clientWidth, h = pane3d.clientHeight;
    for (const l of labels) { _c.copy(l.pos).project(camera); const vis = _c.z < 1 && Math.abs(_c.x) < 1.05 && Math.abs(_c.y) < 1.05; l.el.style.display = vis ? '' : 'none'; if (vis) { l.el.style.left = `${((_c.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _c.y) / 2 * h).toFixed(1)}px`; } }
    renderer.render(scene, camera);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t -= timeline.duration; } render(dt); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); for (const m of lineMats) m.resolution.set(w, h); dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of views) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } }
  const ro = new ResizeObserver(() => { resize(); render(0); }); ro.observe(figure);
  reveal(figure); rebuild();
  if (reducedMotion || exportMode || options.t != null) timeline.t = options.t ?? (model ? model.orbit.period * .3 : 0); else if (options.autoplay ?? true) timeline.playing = true;
  render(0); entrance.start(); ensureLoop();
  return {
    get model() { return model; }, get config() { return { ...cfg }; }, timeline, systems: SYSTEMS, show: (k, v) => { show[k] = !!v; applyVisibility(); render(0); }, get visible() { return { ...show }; },
    camera: { get current() { return cam.current; }, mode(m) { cam.current = m; scaleCamera(true); render(0); }, transitionTo(m) { cam.current = m; render(0); } },
    set(c) { cfg = { ...cfg, ...c }; timeline.t = 0; rebuild(); render(0); entrance.start(); }, replay() { entrance.start(); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
