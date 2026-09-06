/* three-body.mjs — "Üç-Cisim Durumları" sahnesi (three_body_states). 2B tuval, THREE gerekmez.

   Siyah zemin üzerinde 5×4 pano: her panoda düzlemsel üç-cisim probleminin bir periyodik çözümü canlı entegre
   edilir (three-body-model.mjs, RK4 uyarlanır adım). Görünüm: ışık kaynağı olarak cisimler (sıcak çekirdek +
   yumuşak hale), arkalarında üstel sönen ışıklı iz. İz KALICI TUVALDE tutulur: her karede yalnız yeni parça
   çizilir ve tuval e^(−dt/τ) ile soldurulur — binlerce parçayı yeniden çizmek yerine 3 kısa vuruş; bu yüzden
   60 fps. Her panonun zamanı görsel hıza göre normalize edilir (ortalama ekran hızı ~sabit) — hızlı ve yavaş
   çözümler aynı tempoda izlenir. Renkler üç cisim için sabit (turuncu · krem · mavi). Kaotik Pisagor problemi
   kaçışla biter ve baştan başlar.

   API: const tb = await mountThreeBody(host, { t, speed, labels, autoplay });
        tb.timeline{t, playing, speed, play(), pause(), scrub(t)} · tb.catalog · tb.replay() · tb.setActive(v) · tb.dispose() */

import { CATALOG, sampleOrbit, advance, minDistance } from './three-body-model.mjs';
import { staticMode, Entrance, reveal, palette } from '../core/lab-scene.mjs';

export const BODY_COLORS = ['#ff7326', '#ffe6c4', '#8c9dff'];
const RGB = BODY_COLORS.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const rgba = (i, a) => `rgba(${RGB[i][0]},${RGB[i][1]},${RGB[i][2]},${a})`;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountThreeBody(host, options = {}) {
  if (!host) throw new Error('mountThreeBody bir kap ister');
  const figure = document.createElement('figure'); figure.className = 'tb';
  figure.innerHTML = `<style>
      .tb{position:relative;margin:0;width:100%;height:100%;overflow:hidden;background:#000;} .tb canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .tb__cap{position:absolute;left:14px;bottom:10px;font:500 11px/1.4 var(--font-body,system-ui);letter-spacing:.06em;color:rgba(255,255,255,.42);pointer-events:none;}
    </style><canvas aria-label="Üç-cisim periyodik çözümleri"></canvas><div class="tb__cap" data-cap></div>`;
  host.appendChild(figure);
  const cv = figure.querySelector('canvas'), ctx = cv.getContext('2d'), capEl = figure.querySelector('[data-cap]');
  const trailCv = document.createElement('canvas'), tctx = trailCv.getContext('2d');   // kalıcı iz tuvali
  const pathCv = document.createElement('canvas'), pctx = pathCv.getContext('2d');     // tam periyot yolları (statik)
  const P = palette(figure);
  let showLabels = options.labels ?? false;
  const entrance = new Entrance({ panels: { at: 0, dur: 1.4 } }, { onFrame: () => draw() });

  /* ── panolar ─────────────────────────────────────────────────────────── */
  const panels = CATALOG.map(entry => {
    const m = entry.masses, orbit = entry.chaotic ? null : sampleOrbit(entry, { n: 900 });
    const bb = orbit ? orbit.bbox : { xmin: -3.4, xmax: 3.4, ymin: -3.4, ymax: 3.4 };
    const half = Math.max(bb.xmax - bb.xmin, bb.ymax - bb.ymin) / 2 * 1.14 || 1, cx = (bb.xmin + bb.xmax) / 2, cy = (bb.ymin + bb.ymax) / 2;
    /* görsel hız normalizasyonu: ortalama cisim hızı (pano-kesri / zaman birimi) → hedef tempo */
    let k = 1;
    if (orbit) { let sum = 0, n = 0; const dt = entry.T / (orbit.pts[0].length - 1); for (let b = 0; b < 3; b++) for (let i = 1; i < orbit.pts[b].length; i++) { sum += Math.hypot(orbit.pts[b][i][0] - orbit.pts[b][i - 1][0], orbit.pts[b][i][1] - orbit.pts[b][i - 1][1]) / dt; n++; } const meanNorm = (sum / n) * (.43 / half); k = clamp(.17 / Math.max(1e-6, meanNorm), .3, 2.4); }
    const tau = entry.chaotic ? 4 : clamp(entry.T * .22, 1.2, 6);   // iz ömrü (pano zamanı)
    return { entry, m, orbit, half, cx, cy, k, tau, st: Float64Array.from(entry.state()), t: 0, prev: null, seg: [] };
  });
  const resetPanel = p => { p.st = Float64Array.from(p.entry.state()); p.t = 0; p.prev = null; p.seg = []; };
  /* dt (küresel zaman) kadar ilerlet: pano zamanı dt·k; alt adımlarda konumları biriktir (bu kare çizilecek parça) */
  const stepPanel = (p, dt) => {
    if (p.entry.chaotic && (p.t > p.entry.T || Math.max(...[0, 1, 2].map(b => Math.hypot(p.st[2 * b], p.st[2 * b + 1]))) > 9)) { resetPanel(p); p.cleared = true; }
    const dp = dt * p.k, sub = Math.max(1, Math.ceil(dp / .015)), h = dp / sub;
    for (let s = 0; s < sub; s++) { advance(p.st, p.m, h, p.entry.chaotic ? { hMax: 1e-3, k: 2e-3 } : { hMax: 2e-3, k: 4e-3 }); p.t += h; p.seg.push([p.st[0], p.st[1], p.st[2], p.st[3], p.st[4], p.st[5]]); }
    return dp;
  };
  const timeline = { t: 0, playing: false, speed: options.speed ?? 1, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = Math.max(0, t); seekTo(this.t); draw(); } };

  /* ── yerleşim ve iz tuvali ───────────────────────────────────────────── */
  let dpr = 1, W = 0, H = 0, L = null;
  function layout() { const n = panels.length, cols = W >= H * 1.05 ? 5 : 4, rows = Math.ceil(n / cols), pw = W / cols, ph = H / rows; L = { cols, rows, pw, ph, s: Math.min(pw, ph) }; panels.forEach((p, i) => { p.ox = (i % cols) * pw + pw / 2; p.oy = Math.floor(i / cols) * ph + ph / 2; p.sc = (L.s * .5 * .86) / p.half; p.rx = (i % cols) * pw; p.ry = Math.floor(i / cols) * ph; }); }
  const X = (p, x) => p.ox + (x - p.cx) * p.sc, Y = (p, y) => p.oy - (y - p.cy) * p.sc;
  function drawPaths() {
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0); pctx.clearRect(0, 0, W, H); pctx.lineWidth = 1;
    for (const p of panels) { if (!p.orbit || p.entry.T >= 32) continue; for (let b = 0; b < 3; b++) { const pts = p.orbit.pts[b]; pctx.strokeStyle = rgba(b, .075); pctx.beginPath(); for (let k = 0; k < pts.length; k++) { const x = X(p, pts[k][0]), y = Y(p, pts[k][1]); k ? pctx.lineTo(x, y) : pctx.moveTo(x, y); } pctx.stroke(); } }
  }
  /* iz tuvali: soldur (destination-out) + yeni parçaları toplamsal çiz */
  function paintTrails(dtGlobal) {
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of panels) {
      if (p.cleared) { tctx.clearRect(p.rx, p.ry, L.pw, L.ph); p.cleared = false; }
      const dp = dtGlobal * p.k; if (dp > 0) { tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dp / p.tau)})`; tctx.fillRect(p.rx, p.ry, L.pw, L.ph); }
      if (!p.seg.length) continue;
      tctx.globalCompositeOperation = 'lighter'; tctx.lineCap = 'round'; tctx.lineJoin = 'round';
      for (let b = 0; b < 3; b++) {
        const start = p.prev ? p.prev : p.seg[0];
        tctx.beginPath(); tctx.moveTo(X(p, start[2 * b]), Y(p, start[2 * b + 1])); for (const s of p.seg) tctx.lineTo(X(p, s[2 * b]), Y(p, s[2 * b + 1]));
        tctx.strokeStyle = rgba(b, .08); tctx.lineWidth = 5.5; tctx.stroke();     // yumuşak hale
        tctx.strokeStyle = rgba(b, .5); tctx.lineWidth = 1.7; tctx.stroke();      // orta (renk burada)
        tctx.strokeStyle = 'rgba(255,255,255,.22)'; tctx.lineWidth = .8; tctx.stroke();   // ince sıcak çekirdek
      }
      p.prev = p.seg[p.seg.length - 1]; p.seg = [];
    }
    tctx.globalCompositeOperation = 'source-over';
  }
  /* t'ye git: baştan yeniden entegre; izi parça parça soldurarak yeniden kur (deterministik) */
  function seekTo(t) {
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, W, H);
    for (const p of panels) resetPanel(p);
    let left = t; while (left > 1e-9) { const dt = Math.min(.05, left); for (const p of panels) stepPanel(p, dt); paintTrails(dt); left -= dt; }
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const pE = entrance.progress('panels');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(pathCv, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(trailCv, 0, 0); ctx.restore();
    panels.forEach((p, i) => {
      const a = clamp(pE * panels.length * .5 - i * .35, 0, 1);
      if (a < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - a})`; ctx.fillRect(p.rx, p.ry, L.pw, L.ph); }
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) {
        const x = X(p, p.st[2 * b]), y = Y(p, p.st[2 * b + 1]), r = 2.4 + (p.m[b] > 1 ? .5 * Math.sqrt(p.m[b] - 1) : 0);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 16); g.addColorStop(0, rgba(b, .62)); g.addColorStop(.3, rgba(b, .24)); g.addColorStop(1, rgba(b, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(b, 1); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x, y, r * .55, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (showLabels) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `500 ${Math.max(9, L.s * .055)}px ${P.body}`; ctx.textAlign = 'center'; ctx.fillText(p.entry.name + (p.entry.chaotic ? ' · kaotik' : ''), p.ox, p.oy + L.s * .47); }
      ctx.restore();
    });
    capEl.textContent = showLabels ? `t = ${timeline.t.toFixed(1)} · G = 1 · eşit kütleler (Lagrange 1·2·3 ve Pisagor 3·4·5 hariç) · Šuvakov–Dmitrašinović 2013, Lagrange, Euler, Broucke · pano hızları görsel tempoya normalize` : '';
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, cv.clientWidth); H = Math.max(1, cv.clientHeight);
    for (const c of [cv, trailCv, pathCv]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    layout(); drawPaths(); seekTo(timeline.t); draw();
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  /* bir kare ilerlet (gerçek saniye): dışarıdan kare kare sürmek ve ölçmek için de kullanılır */
  function advanceFrame(dt) { const ds = dt * timeline.speed; timeline.t += ds; for (const p of panels) stepPanel(p, ds); paintTrails(ds); draw(); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.05, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; if (timeline.playing && entrance.done) advanceFrame(dt); else draw(); if (timeline.playing) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && !staticMode()) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure);
  if (staticMode() || options.t != null) timeline.t = options.t ?? 6; else if (options.autoplay ?? true) timeline.playing = true;
  resize(); entrance.start(); ensureLoop();
  return {
    timeline, catalog: CATALOG, advance: advanceFrame, panels: () => panels.map(p => ({ id: p.entry.id, t: p.t, k: p.k, minDist: minDistance(p.st) })),
    get labels() { return showLabels; }, set labels(v) { showLabels = !!v; draw(); }, replay() { entrance.start(); }, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
