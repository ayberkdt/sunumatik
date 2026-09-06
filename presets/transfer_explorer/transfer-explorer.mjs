/* transfer-explorer.mjs — Lambert Transfer Kâşifi (transfer_explorer)

   Sol: merkezi cisim, kalkış/varış dairesel yörüngeleri, r1/r2, transfer yayı (Kepler yayılımı) — giriş sahnesinde yay
   ÇİZİLİR, hız ve ΔV okları ardından belirir, ardından araç yay boyunca kuyruklu izle uçar (kahraman hareket; reduced
   motion ve export'ta sabit konum). Parametre değişince geometri ve tarama eğrisi eski durumdan yenisine MORF eder
   (Tween, 550 ms). Sağ: ΔV–TOF taraması (kısa/uzun yol) + Hohmann referansı, seçili TOF imleci. HUD: kahraman okumalar
   (ΔV toplam, ΔV₁, ΔV₂) + ikincil satırlar. Çözücü: transfer-model.mjs → core/astro-lambert.mjs.

   API: const tx = await mountTransfer(host, { preset:'leoGeo', tof?, direction?, dth?, u?, autoplay? });
        tx.set({...}) · tx.solution · tx.sweep · tx.timeline{playing,u,play,pause,scrub} · tx.replay() · tx.dispose() */

import { solveTransfer, hohmann, tofSweep, PRESETS, CENTRAL } from './transfer-model.mjs';
import { palette, backdrop, polyline, marker, arrow, tag, label, title, comet, Entrance, Tween, reveal, staticMode, rgba, starfield, planet, sun, glow, colorLine, speed } from '../core/lab-scene.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountTransfer(host, options = {}) {
  if (!host) throw new Error('mountTransfer bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'tx';
  figure.innerHTML = `
    <style>
      .tx{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);background:var(--color-canvas,#0b0c10);color:var(--color-ink,#e9e4d8);}
      .tx__geo,.tx__sweep{position:relative;min-width:0;min-height:0;} .tx__sweep{border-left:1px solid var(--lab-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr);}
      .tx canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .tx__cell{position:relative;min-height:0;}
      .tx__hud{padding:12px 16px 10px;border-bottom:1px solid var(--lab-rule,#3a3c42);}
    </style>
    <div class="tx__geo" data-lab-reveal="fade"><canvas class="p" data-plot="geo" aria-label="Transfer geometrisi"></canvas><div class="lab-top" data-top></div></div>
    <div class="tx__sweep">
      <div class="tx__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">ΔV toplam</span><span class="v hi" data-h="dvt">—</span></div>
          <div><span class="k">ΔV₁ kalkış</span><span class="v" data-h="dv1">—</span></div>
          <div><span class="k">ΔV₂ varış</span><span class="v" data-h="dv2">—</span></div>
          <div><span class="k">Hohmann limiti</span><span class="v" data-h="hoh">—</span></div>
        </div>
        <dl>
          <dt>TOF</dt><dd data-h="tof">—</dd><dt>Δθ · yol</dt><dd data-h="dth">—</dd>
          <dt>a · e</dt><dd data-h="ae">—</dd><dt>r_p / r_a</dt><dd data-h="rpa">—</dd>
          <dt>|v1| · |v2|</dt><dd data-h="v12">—</dd><dt>tarama minimumu</dt><dd data-h="best">—</dd>
        </dl>
        <div class="lab-legend" data-legend></div>
      </div>
      <div class="tx__cell" data-lab-reveal="fade"><canvas class="p" data-plot="sweep" aria-label="ΔV vs TOF"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const topEl = figure.querySelector('[data-top]'), legendEl = figure.querySelector('[data-legend]');
  const P = palette(figure);
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  legendEl.innerHTML = `<span><i style="background:${P.data1}"></i>kalkış yörüngesi</span><span><i style="background:${P.data2}"></i>varış yörüngesi</span><span><i style="background:${P.accent}"></i>transfer yayı</span><span><i style="background:${P.green}"></i>ΔV okları</span><span><i style="background:${P.ink}"></i>Hohmann (kesikli)</span>`;

  const pre = PRESETS[options.preset ?? 'leoGeo'];
  let cfg = { central: pre.central, r1: pre.r1, r2: pre.r2, dth: pre.dth, tof: pre.tof, tofRange: pre.tofRange, direction: 'prograde', ...(options.config || {}) };
  if (options.tof) cfg.tof = options.tof; if (options.direction) cfg.direction = options.direction; if (options.dth != null) cfg.dth = options.dth;
  let sol = null, sweep = null, hoh = null;
  const fmtT = s => s >= 3 * 86400 ? `${nf1.format(s / 86400)} gün` : `${nf2.format(s / 3600)} sa`;

  /* ── görsel durum (morf edilebilir) ─────────────────────────────────────── */
  const geomOf = s => s ? { arc: s.arc.flat(), R1: s.R1.slice(0, 2), R2: s.R2.slice(0, 2), Vc1: s.Vc1.slice(0, 2), Vc2: s.Vc2.slice(0, 2), v1: s.v1.slice(0, 2), v2: s.v2.slice(0, 2), dv1v: s.dv1v.slice(0, 2), dv2v: s.dv2v.slice(0, 2), dtheta: s.dtheta, dv1: s.dv1, dv2: s.dv2, r1: cfg.r1, r2: cfg.r2 } : null;
  const sweepOf = sw => ({ short: sw.points.map(p => Number.isFinite(p.short) ? p.short : NaN), long: sw.points.map(p => Number.isFinite(p.long) ? p.long : NaN), tofs: sw.points.map(p => p.tof) });
  const geo = new Tween(null, { duration: .55, onFrame: () => draw() }), swp = new Tween(null, { duration: .55 });
  const timeline = { playing: !(options.autoplay === false) && !staticMode(), u: options.u ?? .62, period: 7, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(u) { this.u = clamp(u, 0, 1); this.playing = false; draw(); } };
  const entrance = new Entrance({ frame: { at: 0, dur: .5 }, orbits: { at: .15, dur: .6 }, arc: { at: .45, dur: 1.1 }, vectors: { at: 1.35, dur: .5 }, sweep: { at: .7, dur: 1.2 }, craft: { at: 1.7, dur: .4 } }, { onFrame: () => draw() });

  function recompute({ immediate = false } = {}) {
    sol = solveTransfer(cfg); sweep = tofSweep(cfg, cfg.tofRange, 90); hoh = hohmann(CENTRAL[cfg.central].mu, cfg.r1, cfg.r2);
    const g = geomOf(sol); if (g && geo.value && geo.value.arc.length === g.arc.length && !immediate) geo.set(g); else geo.set(g, { immediate: true });
    const sw = sweepOf(sweep); if (swp.value && swp.value.short.length === sw.short.length && !immediate) swp.set(sw); else swp.set(sw, { immediate: true });
    writeHud(); draw();
  }
  function writeHud() {
    const u = CENTRAL[cfg.central];
    if (sol) {
      H.dvt.innerHTML = `${nf3.format(sol.dvTotal)}<span class="u">km/s</span>`; H.dv1.innerHTML = `${nf3.format(sol.dv1)}<span class="u">km/s</span>`; H.dv2.innerHTML = `${nf3.format(sol.dv2)}<span class="u">km/s</span>`;
      H.tof.textContent = fmtT(sol.tof); H.dth.textContent = `${nf1.format(sol.dtheta * 180 / Math.PI)}° · ${cfg.direction === 'prograde' ? 'kısa' : 'uzun'} yol`;
      H.ae.textContent = `${nf3.format(sol.a / u.unit)} ${u.unitLabel} · ${nf3.format(sol.e)}`; H.rpa.textContent = `${nf3.format(sol.rp / u.unit)} / ${sol.ra === Infinity ? '∞' : nf3.format(sol.ra / u.unit)}`; H.v12.textContent = `${nf2.format(Math.hypot(...sol.v1))} · ${nf2.format(Math.hypot(...sol.v2))} km/s`;
      H.dvt.className = 'v hi';
    } else { for (const k of ['dvt', 'dv1', 'dv2']) H[k].textContent = 'yok'; H.dvt.className = 'v bad'; for (const k of ['tof', 'dth', 'ae', 'rpa', 'v12']) H[k].textContent = 'çözüm yok'; }
    H.hoh.innerHTML = `${nf3.format(hoh.dvTotal)}<span class="u">km/s</span>`; H.tof.textContent = `${sol ? fmtT(sol.tof) : '—'} · Hohmann ${fmtT(hoh.tof)}`; H.best.textContent = sweep.best ? `${nf3.format(sweep.best.dv)} km/s @ ${fmtT(sweep.best.tof)} · ${sweep.best.way === 'short' ? 'kısa' : 'uzun'}` : '—';
    topEl.textContent = `${u.label} merkezli · kalkış/varış dairesel · yay Lambert v1'den Kepler yayılımı · araç yay boyunca uçar`;
  }
  let dpr = 1;
  function drawGeo() {
    const cv = plots.geo, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = geo.value; backdrop(ctx, W, Hh, { canvas: P.canvas, grid: 44, gridAlpha: .035 * entrance.progress('frame') }); starfield(ctx, W, Hh, { seed: 5, n: 150, alpha: .5 * entrance.progress('frame') });
    const r1 = g ? g.r1 : cfg.r1, r2 = g ? g.r2 : cfg.r2;
    let ext = Math.max(r1, r2); if (g) for (let i = 0; i < g.arc.length; i += 3) ext = Math.max(ext, Math.hypot(g.arc[i], g.arc[i + 1])); ext *= 1.12;
    const sc = Math.min(W, Hh) / 2 / ext * .9, cx = W / 2, cy = Hh / 2, X = x => cx + x * sc, Y = y => cy - y * sc;
    const pO = entrance.progress('orbits');
    for (const [r, c] of [[r1, P.data1], [r2, P.data2]]) { ctx.save(); ctx.globalAlpha = .5 * pO; ctx.strokeStyle = c; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(X(0), Y(0), r * sc, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pO); ctx.stroke(); ctx.restore(); }
    const bodyR = cfg.central === 'sun' ? 9 : Math.max(5, 6378 * sc);
    if (cfg.central === 'sun') sun(ctx, X(0), Y(0), bodyR, { alpha: pO, corona: 5 }); else planet(ctx, X(0), Y(0), bodyR, { color: '#3d6fa8', sunDir: [1, .2], atmosphere: '#6fb4ff', alpha: pO });
    label(ctx, CENTRAL[cfg.central].label, X(0) + bodyR + 9, Y(0) + 4, P, { mono: false, size: 11, color: P.muted });
    if (!g) { label(ctx, 'Bu TOF için tek-tur Lambert çözümü yok (Δθ = 180° tekilliği ya da çok kısa TOF).', 16, Hh / 2, P, { mono: false, size: 12.5, color: P.data2 }); return; }
    const pts = []; for (let i = 0; i < g.arc.length; i += 3) pts.push([X(g.arc[i]), Y(g.arc[i + 1])]);
    const pArc = entrance.progress('arc'), pV = entrance.progress('vectors');
    ctx.save(); ctx.globalAlpha = .3 * pO; ctx.strokeStyle = P.ink; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(g.R1[0]), Y(g.R1[1])); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(g.R2[0]), Y(g.R2[1])); ctx.stroke(); ctx.restore();
    const ra = Math.max(Math.min(r1, r2) * sc * .35, bodyR + 16);
    ctx.save(); ctx.globalAlpha = pArc; ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(0), Y(0), ra, 0, -g.dtheta * pArc, true); ctx.stroke(); ctx.restore();
    const lbA = g.dtheta / 2; if (pArc > .6) tag(ctx, `Δθ = ${nf1.format(g.dtheta * 180 / Math.PI)}°`, X(0) + (ra + 10) * Math.cos(lbA), Y(0) - (ra + 10) * Math.sin(lbA), P, { color: P.accent, mono: true, anchor: Math.cos(lbA) < 0 ? 'right' : 'left' });
    { /* yay hızla renklenir (vis-viva): periapsiste beyaz-sıcak, apoapsiste sönük */ const mu = CENTRAL[cfg.central].mu, a = sol ? sol.a : null, vs = []; for (let i = 0; i < g.arc.length; i += 3) { const r = Math.hypot(g.arc[i], g.arc[i + 1]); vs.push(a ? Math.sqrt(Math.max(0, mu * (2 / r - 1 / a))) : 1); } const vLo = Math.min(...vs), vHi = Math.max(...vs);
      polyline(ctx, pts, { progress: pArc, color: P.accent, width: 5, alpha: .16 }); colorLine(ctx, pts, (u, i) => speed((vs[i] - vLo) / Math.max(1e-9, vHi - vLo)), { progress: pArc, width: 2.4 }); }
    if (pV > 0) {
      const kv = Math.min(W, Hh) * .14 / Math.max(Math.hypot(...g.v1), Math.hypot(...g.Vc1), 1e-9), a = pV;
      const A = (x0, y0, v, k, color, text, w = 1.6) => { const x1 = x0 + v[0] * k * a, y1 = y0 - v[1] * k * a; arrow(ctx, x0, y0, x1, y1, color, { width: w, alpha: a }); if (text && pV > .7) label(ctx, text, x1 + 6, y1 - 4, P, { size: 10.5, color }); };
      A(X(g.R1[0]), Y(g.R1[1]), g.Vc1, kv, rgba(P.data1, .95), 'v_c1'); A(X(g.R1[0]), Y(g.R1[1]), g.v1, kv, P.accent, 'v1');
      A(X(g.R1[0]) + g.Vc1[0] * kv * a, Y(g.R1[1]) - g.Vc1[1] * kv * a, g.dv1v, kv, P.green, `ΔV₁ ${nf2.format(g.dv1)}`, 2.2);
      A(X(g.R2[0]), Y(g.R2[1]), g.v2, kv, P.accent, 'v2'); A(X(g.R2[0]), Y(g.R2[1]), g.Vc2, kv, rgba(P.data2, .95), 'v_c2');
      A(X(g.R2[0]) + g.v2[0] * kv * a, Y(g.R2[1]) - g.v2[1] * kv * a, g.dv2v, kv, P.green, `ΔV₂ ${nf2.format(g.dv2)}`, 2.2);
    }
    marker(ctx, X(g.R1[0]), Y(g.R1[1]), 4.5, P.data1, { alpha: pO }); marker(ctx, X(g.R2[0]), Y(g.R2[1]), 4.5, P.data2, { alpha: pO });
    if (pO > .8) { label(ctx, 'r1 · kalkış', X(g.R1[0]) + 8, Y(g.R1[1]) + 16, P, { mono: false, size: 11 }); label(ctx, 'r2 · varış', X(g.R2[0]) + 8, Y(g.R2[1]) + 16, P, { mono: false, size: 11 }); }
    const pC = entrance.progress('craft');
    if (pC > 0 && pArc >= 1) { const head = timeline.u * (pts.length - 1); comet(ctx, pts, head, { len: 34, color: P.ink, width: 2.4 }); const i = Math.floor(head), f = head - i, p0 = pts[Math.min(i, pts.length - 1)], p1 = pts[Math.min(i + 1, pts.length - 1)]; const hx = p0[0] + (p1[0] - p0[0]) * f, hy = p0[1] + (p1[1] - p0[1]) * f; glow(ctx, hx, hy, 14, P.accent, .5 * pC); marker(ctx, hx, hy, 3.5 * pC, P.ink, { ringAlpha: .5, alpha: pC }); }
  }
  function drawSweep() {
    const cv = plots.sweep, ctx = cv.getContext('2d'), W2 = cv.clientWidth, H2 = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W2, H2, { canvas: P.canvas });
    const s = swp.value; if (!s) return;
    const pad = { l: 56, r: 16, t: 28, b: 32 }, pw = W2 - pad.l - pad.r, ph = H2 - pad.t - pad.b;
    const vals = [...s.short, ...s.long].filter(Number.isFinite); const lo = 0, hi = Math.min(Math.max(...vals), hoh.dvTotal * 3.2);
    const X = t => pad.l + Math.log(t / cfg.tofRange[0]) / Math.log(cfg.tofRange[1] / cfg.tofRange[0]) * pw, Y = v => pad.t + ph - clamp((v - lo) / (hi - lo), 0, 1.02) * ph;
    title(ctx, 'ΔV toplamı vs uçuş süresi (log TOF) — kısa yol, uzun yol, Hohmann', pad.l, 16, P);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; for (let k = 0; k <= 4; k++) { const y = pad.t + ph * k / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); }
    const pS = entrance.progress('sweep');
    for (const [key, color] of [['short', P.data1], ['long', P.data2]]) { const segs = []; let run = []; s[key].forEach((v, i) => { if (!Number.isFinite(v) || v > hi * 1.02) { if (run.length > 1) segs.push(run); run = []; return; } run.push([X(s.tofs[i]), Y(v)]); }); if (run.length > 1) segs.push(run); for (const seg of segs) polyline(ctx, seg, { progress: pS, color, width: 1.6 }); }
    ctx.save(); ctx.globalAlpha = pS; ctx.strokeStyle = P.ink; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(pad.l, Y(hoh.dvTotal)); ctx.lineTo(pad.l + pw, Y(hoh.dvTotal)); ctx.stroke(); ctx.restore();
    if (hoh.tof >= cfg.tofRange[0] && hoh.tof <= cfg.tofRange[1] && pS > .9) { marker(ctx, X(hoh.tof), Y(hoh.dvTotal), 3.5, P.ink, { ring: false }); label(ctx, `Hohmann ${nf3.format(hoh.dvTotal)}`, X(hoh.tof) + 7, Y(hoh.dvTotal) - 7, P, { size: 10 }); }
    if (sol && pS >= 1) { const x = X(sol.tof); ctx.save(); ctx.strokeStyle = rgba(P.accent, .7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.restore(); marker(ctx, x, Y(sol.dvTotal), 5, P.accent); tag(ctx, `${nf3.format(sol.dvTotal)} km/s`, x + 8, Y(sol.dvTotal) - 14, P, { color: P.accent, mono: true }); }
    label(ctx, `${nf1.format(hi)} km/s`, pad.l - 6, pad.t + 8, P, { align: 'right' }); label(ctx, '0', pad.l - 6, pad.t + ph, P, { align: 'right' });
    for (const f of [0, .25, .5, .75, 1]) { const t = cfg.tofRange[0] * Math.pow(cfg.tofRange[1] / cfg.tofRange[0], f); label(ctx, fmtT(t), X(t), H2 - 10, P, { align: 'center' }); }
  }
  function draw() { drawGeo(); drawSweep(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  let active = true, rafId = 0, lastNow = 0;
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; if (timeline.playing && entrance.done) { timeline.u += dt / timeline.period; if (timeline.u > 1) timeline.u -= 1; draw(); } ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && timeline.playing && !staticMode()) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure); recompute({ immediate: true }); resize(); entrance.start(); ensureLoop();
  return {
    get solution() { return sol; }, get sweep() { return sweep; }, get hohmann() { return hoh; }, get config() { return { ...cfg }; }, presets: PRESETS, central: CENTRAL, timeline,
    set(c) { cfg = { ...cfg, ...c }; recompute(); }, setPreset(id) { const p = PRESETS[id]; cfg = { central: p.central, r1: p.r1, r2: p.r2, dth: p.dth, tof: p.tof, tofRange: p.tofRange, direction: 'prograde' }; recompute({ immediate: true }); entrance.start(); },
    replay() { entrance.start(); }, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
