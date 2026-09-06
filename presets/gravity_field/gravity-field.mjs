/* gravity-field.mjs — Küresel Harmonik Yerçekimi Alanı Sahnesi (gravity_field)

   Küre üstünde jeoit yüksekliği / yerçekimi anomalisi boyaması (CanvasTexture) + abartılı jeoit
   yer değiştirmesi (vertex displacement, parametre değişince attribute güncellenir), 2B harita, derece
   varyans spektrumu (Kaula referansı), kesme (truncation) karşılaştırması ve tek-derece katkısı;
   yalnız-C̄20 alanıyla düğüm kayması çapraz-denetimi (J2 sekülar). Çözücü: gravity-model.mjs (saf).
   DÜRÜSTLÜK: düşük derece gerçek (EGM96 yuvarlatılmış), üstü SENTETİK (Kaula) — sahne bunu yazar.

   API:
     const gf = await mountGravityField(host, { Lmax:24, lMaxShow, field:'N'|'dg', zonalOnly, onlyDegree, exaggeration, seed });
     gf.set({...}) · gf.grid · gf.spectrum · gf.dispose()
   Sahne: ECEF (X = x, Y = z, Z = −y); 1 birim = R. */

import * as THREE from 'three';
import { starfield as starfield3, atmosphereShell, sunGlow } from '../core/lab-three.mjs';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { buildCoefficients, surfaceGrid, degreeSpectrum, propagateNodeDrift, loadCoefficients, R } from './gravity-model.mjs';
import { j2Rates } from '../core/astro-orbit.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function ramp(t, out) { const stops = [[.18, .27, .62], [.30, .55, .85], [.92, .92, .88], [.90, .55, .30], [.62, .16, .12]]; const x = clamp(t, 0, 1) * 4, i = Math.min(3, Math.floor(x)), f = x - i; for (let k = 0; k < 3; k++) out[k] = Math.round(255 * (stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f)); return out; }

export async function mountGravityField(host, options = {}) {
  if (!host) throw new Error('mountGravityField bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const figure = document.createElement('figure');
  figure.className = 'grav';
  figure.innerHTML = `
    <style>
      .grav{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .grav__3d{position:relative;min-width:0;min-height:0;} .grav__3d canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
      .grav__side{min-width:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto auto minmax(0,1fr);}
      .grav__map{position:relative;} .grav__map canvas{display:block;width:100%;}
      .grav__hud{padding:10px 14px;border-bottom:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .grav__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px;} .grav__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .grav__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);} .grav__hud dd.hi{color:var(--color-accent,#d9b877);}
      .grav__spec{position:relative;min-height:0;} .grav__spec canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .grav__top{position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);pointer-events:none;max-width:70%;}
      .grav__warn{position:absolute;left:14px;bottom:14px;padding:8px 12px;border:1px solid var(--color-data-2,#d78f6c);border-radius:8px;font-size:11px;letter-spacing:.05em;color:var(--color-data-2,#d78f6c);background:color-mix(in srgb,var(--color-surface,#15161a) 86%,transparent);pointer-events:none;}
      .grav__legend{position:absolute;right:14px;bottom:14px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--color-muted,#9a938a);pointer-events:none;} .grav__legend i{display:block;width:120px;height:8px;border-radius:4px;}
    </style>
    <div class="grav__3d"><div class="grav__top" data-top></div><div class="grav__warn" data-warn></div><div class="grav__legend"><span data-lo></span><i data-bar></i><span data-hi></span></div></div>
    <div class="grav__side">
      <div class="grav__hud" role="status"><dl>
        <dt>alan</dt><dd data-h="field">—</dd><dt>dereceler</dt><dd data-h="deg">—</dd>
        <dt>aralık</dt><dd data-h="range" class="hi">—</dd><dt>RMS</dt><dd data-h="rms">—</dd>
        <dt>C̄20 (gerçek)</dt><dd data-h="c20">—</dd><dt>J2 = −√5 C̄20</dt><dd data-h="j2">—</dd>
        <dt>Ω̇ (C̄20 alanı, sayısal)</dt><dd data-h="rn" class="hi">—</dd><dt>Ω̇ (J2 analitik)</dt><dd data-h="ra">—</dd>
      </dl></div>
      <div class="grav__map"><canvas aria-label="Anomali haritası"></canvas></div>
      <div class="grav__spec"><canvas aria-label="Derece spektrumu"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.grav__3d'), topEl = figure.querySelector('[data-top]'), warnEl = figure.querySelector('[data-warn]'), mapCanvas = figure.querySelector('.grav__map canvas'), specCanvas = figure.querySelector('.grav__spec canvas');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const legBar = figure.querySelector('[data-bar]'), legLo = figure.querySelector('[data-lo]'), legHi = figure.querySelector('[data-hi]');
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(36, 1, .01, 100); camera.position.set(2.6, 1.7, 3.1);
  scene.add(new THREE.DirectionalLight('#fff4e6', 1.6).translateX(4).translateY(3).translateZ(5)); scene.add(new THREE.HemisphereLight('#8fa8c4', '#2a2418', .6)); scene.add(new THREE.AmbientLight('#3a404c', .6));
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08; controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = .35;
  starfield3(THREE, scene, { seed: 3, n: 900, r0: 40, r1: 60, size: .6, opacity: .55 }); scene.add(atmosphereShell(THREE, 1, '#8fb8dd', .8, 1.03)); sunGlow(THREE, scene, new THREE.Vector3(4, 3, 5), { dist: 70, size: 14 });
  /* küre: yer değiştirme için yeterli çözünürlük; doku CanvasTexture */
  const NLON = 180, NLAT = 90;
  const geo = new THREE.SphereGeometry(1, 180, 90); const basePos = geo.attributes.position.array.slice();
  const texCanvas = document.createElement('canvas'); texCanvas.width = NLON; texCanvas.height = NLAT; const tctx = texCanvas.getContext('2d'); const tex = new THREE.CanvasTexture(texCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter;
  const globe = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: .85, metalness: .05 })); scene.add(globe);
  /* referans elipsoid çizgisi: ekvator + meridyen (ince) */
  { const pts = []; for (let k = 0; k <= 128; k++) { const a = k / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 1.002, 0, Math.sin(a) * 1.002)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: P.muted, transparent: true, opacity: .35 }))); }

  let cfg = { Lmax: options.Lmax ?? 24, lMaxShow: options.lMaxShow ?? 24, lMin: options.lMin ?? 2, field: options.field ?? 'N', zonalOnly: options.zonalOnly ?? false, onlyDegree: options.onlyDegree ?? null, exaggeration: options.exaggeration ?? 6000, seed: options.seed ?? 7, coefficients: options.coefficients ?? null, removeNormal: options.removeNormal ?? true };
  let cs = null, grid = null, spectrum = null, nodeCheck = null;
  function recompute() {
    cs = cfg.coefficients ? loadCoefficients(cfg.coefficients, cfg.Lmax) : buildCoefficients(cfg.Lmax, { seed: cfg.seed });
    const opts = { lMin: cfg.lMin, lMax: Math.min(cfg.lMaxShow, cfg.Lmax), zonalOnly: cfg.zonalOnly, onlyDegree: cfg.onlyDegree, removeNormal: cfg.removeNormal };
    grid = surfaceGrid(cs, NLON, NLAT, opts); spectrum = degreeSpectrum(cs);
    /* doku + yer değiştirme */
    const img = tctx.createImageData(NLON, NLAT), px = [0, 0, 0];
    const arr = cfg.field === 'N' ? grid.N : grid.dg, lo = cfg.field === 'N' ? grid.nMin : grid.gMin, hi = cfg.field === 'N' ? grid.nMax : grid.gMax, amp = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    for (let j = 0; j < NLAT; j++) for (let i = 0; i < NLON; i++) { const v = arr[j * NLON + i]; ramp(.5 + .5 * v / amp, px); const k = ((NLAT - 1 - j) * NLON + i) * 4; img.data[k] = px[0]; img.data[k + 1] = px[1]; img.data[k + 2] = px[2]; img.data[k + 3] = 255; }
    tctx.putImageData(img, 0, 0); tex.needsUpdate = true;
    const pos = geo.attributes.position.array;
    for (let v = 0; v < pos.length / 3; v++) { const x = basePos[v * 3], y = basePos[v * 3 + 1], z = basePos[v * 3 + 2]; const lat = Math.asin(clamp(y, -1, 1)), lon = Math.atan2(-z, x); let i = Math.floor((lon / Math.PI + 1) / 2 * NLON), j = Math.floor((lat / (Math.PI / 2) + 1) / 2 * NLAT); i = clamp(i, 0, NLON - 1); j = clamp(j, 0, NLAT - 1); const Nm = grid.N[j * NLON + i]; const s = 1 + Nm * cfg.exaggeration / R; pos[v * 3] = x * s; pos[v * 3 + 1] = y * s; pos[v * 3 + 2] = z * s; }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    /* lejant + HUD */
    legBar.style.background = `linear-gradient(90deg, ${[0, .25, .5, .75, 1].map(t => { const c = ramp(t, [0, 0, 0]); return `rgb(${c[0]},${c[1]},${c[2]})`; }).join(',')})`;
    const unit = cfg.field === 'N' ? 'm' : 'mGal'; legLo.textContent = `${nf1.format(-amp)} ${unit}`; legHi.textContent = `+${nf1.format(amp)} ${unit}`;
    H.field.textContent = (cfg.field === 'N' ? 'jeoit yüksekliği N (Bruns)' : 'serbest-hava anomalisi δg') + (cfg.removeNormal ? ' · elipsoide göre' : ' · KÜREYE göre (J2 dahil)'); H.deg.textContent = cfg.onlyDegree != null ? `yalnız l = ${cfg.onlyDegree}` : `${cfg.lMin} … ${opts.lMax}${cfg.zonalOnly ? ' (yalnız zonal)' : ''}`;
    H.range.textContent = `${nf1.format(lo)} … ${nf1.format(hi)} ${unit}`;
    let rms = 0, wsum = 0; for (let j = 0; j < NLAT; j++) { const w = Math.cos(-Math.PI / 2 + (j + .5) / NLAT * Math.PI); for (let i = 0; i < NLON; i++) { rms += w * arr[j * NLON + i] ** 2; wsum += w; } } H.rms.textContent = `${nf1.format(Math.sqrt(rms / wsum))} ${unit}`;
    H.c20.textContent = cs.C[2][0].toExponential(5); H.j2.textContent = (-Math.sqrt(5) * cs.C[2][0]).toExponential(5);
    const realCount = cs.prov.reduce((n, row) => n + Array.from(row).filter(p => p === 1).length, 0), totalCount = (cfg.Lmax + 1) * (cfg.Lmax + 2) / 2 - 3;
    topEl.textContent = `Küresel harmonikler L = ${cfg.Lmax} · tam normalize P̄_lm · ${realCount} gerçek katsayı (EGM96 düşük derece, yuvarlatılmış) + ${totalCount - realCount} SENTETİK (Kaula 1e−5/l², tohum ${cfg.seed}) · abartı ×${cfg.exaggeration}`;
    warnEl.textContent = cfg.coefficients ? 'Dış katsayı seti yüklendi' : 'DİKKAT: l ≥ 3 tesseral ve l ≥ 5 tüm katsayılar SENTETİKTİR — gerçek Dünya jeoidi değildir (illüstratif). Gerçek alan için EGM2008 katsayıları yükleyin.';
    /* düğüm kayması çapraz denetimi (C̄20 tek): kısa yayılım ~150 ms */
    setTimeout(() => { const csJ2 = loadCoefficients([{ l: 2, m: 0, C: cs.C[2][0], S: 0 }], 2); nodeCheck = propagateNodeDrift(csJ2, { hours: 4, dt: 40, opts: { removeNormal: false } }); const an = j2Rates({ a: 6778.137, e: 0, i: 51.6 * Math.PI / 180 }).raanDot; H.rn.textContent = `${nf3.format(nodeCheck.raanDot * 86400 * 180 / Math.PI)} °/gün`; H.ra.textContent = `${nf3.format(an * 86400 * 180 / Math.PI)} °/gün`; }, 20);
    drawMap(); drawSpectrum();
  }
  let dpr = 1;
  function drawMap() {
    const ctx = mapCanvas.getContext('2d'), W = mapCanvas.clientWidth, Hh = mapCanvas.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(texCanvas, 0, 0, W, Hh);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; for (let lon = -180; lon <= 180; lon += 60) { const x = (lon + 180) / 360 * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Hh); ctx.stroke(); } for (let lat = -60; lat <= 60; lat += 30) { const y = (90 - lat) / 180 * Hh; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = '10px Inter, sans-serif'; ctx.fillText(cfg.field === 'N' ? 'jeoit yüksekliği N (m) — eşdikdörtgen' : 'serbest-hava anomalisi δg (mGal)', 6, 12);
  }
  function drawSpectrum() {
    const ctx = specCanvas.getContext('2d'), W = specCanvas.clientWidth, Hh = specCanvas.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const pad = { l: 52, r: 14, t: 22, b: 26 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b;
    const ls = spectrum.map(s => Math.log10(s.sigma)), lk = spectrum.map(s => Math.log10(s.kaula)), lo = Math.min(...ls, ...lk) - .2, hi = Math.max(...ls, ...lk) + .2;
    const X = l => pad.l + (l - 2) / (cfg.Lmax - 2) * pw, Y = v => pad.t + ph - (v - lo) / (hi - lo) * ph;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('derece varyansı σ_l = √Σ_m(C̄²+S̄²) (log) · kesikli: Kaula 1e−5/l² · altın: gerçek dereceler', pad.l, 13);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k <= 4; k++) { const y = pad.t + ph * k / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); }
    ctx.strokeStyle = P.data2; ctx.setLineDash([4, 4]); ctx.beginPath(); spectrum.forEach((s, k) => k ? ctx.lineTo(X(s.l), Y(lk[k])) : ctx.moveTo(X(s.l), Y(lk[k]))); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = P.data1; ctx.lineWidth = 1.4; ctx.beginPath(); spectrum.forEach((s, k) => k ? ctx.lineTo(X(s.l), Y(ls[k])) : ctx.moveTo(X(s.l), Y(ls[k]))); ctx.stroke();
    spectrum.forEach((s, k) => { const real = Array.from(cs.prov[s.l]).some(p => p === 1); ctx.fillStyle = real ? P.accent : P.data1; ctx.beginPath(); ctx.arc(X(s.l), Y(ls[k]), real ? 3.5 : 2.2, 0, Math.PI * 2); ctx.fill(); });
    const lShow = Math.min(cfg.lMaxShow, cfg.Lmax); ctx.strokeStyle = P.accent; ctx.beginPath(); ctx.moveTo(X(lShow) + 4, pad.t); ctx.lineTo(X(lShow) + 4, pad.t + ph); ctx.stroke(); ctx.fillStyle = P.accent; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`kesme L = ${lShow}`, X(lShow) - 60, pad.t + 10);
    ctx.fillStyle = P.muted; ctx.textAlign = 'right'; ctx.fillText(`1e${hi.toFixed(1)}`, pad.l - 4, pad.t + 8); ctx.fillText(`1e${lo.toFixed(1)}`, pad.l - 4, pad.t + ph); ctx.textAlign = 'center'; for (let l = 2; l <= cfg.Lmax; l += Math.ceil(cfg.Lmax / 8)) ctx.fillText(String(l), X(l), Hh - 8); ctx.fillText('derece l', pad.l + pw / 2, Hh + 2); ctx.textAlign = 'left';
  }
  let active = true, rafId = 0;
  function loop() { rafId = 0; if (!active || document.hidden) return; controls.update(); renderer.render(scene, camera); rafId = requestAnimationFrame(loop); }
  const onVis = () => { if (!rafId) rafId = requestAnimationFrame(loop); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dpr = Math.min(devicePixelRatio || 1, 2); const mw = Math.max(10, figure.querySelector('.grav__side').clientWidth), mh = Math.round(mw / 2); mapCanvas.width = Math.round(mw * dpr); mapCanvas.height = Math.round(mh * dpr); mapCanvas.style.height = `${mh}px`; specCanvas.width = Math.round(specCanvas.clientWidth * dpr); specCanvas.height = Math.round(specCanvas.clientHeight * dpr); if (grid) { drawMap(); drawSpectrum(); } renderer.render(scene, camera); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  recompute(); resize(); rafId = requestAnimationFrame(loop);
  return {
    get grid() { return grid; }, get spectrum() { return spectrum; }, get coefficients() { return cs; }, get config() { return { ...cfg }; }, get nodeCheck() { return nodeCheck; },
    set(c) { cfg = { ...cfg, ...c }; recompute(); }, setAutoRotate(v) { controls.autoRotate = !!v; },
    setActive(v) { active = !!v; if (active && !rafId) rafId = requestAnimationFrame(loop); },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
