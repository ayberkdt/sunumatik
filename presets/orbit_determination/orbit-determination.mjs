/* orbit-determination.mjs — Yörünge Belirleme (EKF) Laboratuvarı (orbit_determination)

   Sol: ECI x–y izdüşümü (Dünya, gerçek yörünge, kestirim izi, dönen istasyonlar, anlık görüş çizgileri,
   kovaryans elipsi 3σ (Prr'nin x–y bloğu, ölçekli)). Sağ: (1) konum hatası |Δr| ve 3σ zarfı (log), (2) hız hatası
   ve 3σ, (3) normalize yenilikler ν/σ (menzil ve menzil-hızı; geçişler gölgeli), (4) NEES/NIS zaman serisi.
   HUD: t, |Δr|, |Δv|, 3σ, NEES, NIS, ölçüm/geçiş sayısı, filtre ayarları. Zaman çizgisi: simülasyon boyunca ilerler.
   Model: od-model.mjs (saf). THREE gerekmez.

   API: const od = await mountOd(host, { scenario, overrides, warp, autoplay, t });
        od.run · od.setScenario(id, ov) · od.timeline · od.dispose() */

import { runOd, SCENARIOS, STATIONS, R_E } from './od-model.mjs';
import { palette, backdrop, polyline, marker, label, title, tag, comet, Entrance, reveal, staticMode, rgba, starfield, planet, glow } from '../core/lab-scene.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountOd(host, options = {}) {
  if (!host) throw new Error('mountOd bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'od';
  figure.innerHTML = `
    <style>
      .od{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,10fr) minmax(0,10fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .od__orbit{position:relative;min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;} .od canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .od__cell{position:relative;min-height:0;}
      .od__hud{padding:12px 16px 10px;border-top:1px solid var(--lab-rule,#3a3c42);}
      .od__plots{min-width:0;min-height:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:repeat(4,minmax(0,1fr));}
      .od__plots .od__cell{border-bottom:1px solid var(--color-rule,#3a3c42);} .od__plots .od__cell:last-child{border-bottom:0;}
    </style>
    <div class="od__orbit">
      <div class="od__cell" data-lab-reveal="fade"><canvas class="p" data-plot="orbit" aria-label="ECI x–y izdüşümü"></canvas><div class="lab-top" data-top></div></div>
      <div class="od__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">|Δr| gerçek hata</span><span class="v hi" data-h="er">—</span></div>
          <div><span class="k">3σ konum (filtre)</span><span class="v" data-h="sr">—</span></div>
          <div><span class="k">NEES · beklenen 6</span><span class="v" data-h="nees">—</span></div>
          <div><span class="k">3σ içinde kalma</span><span class="v" data-h="in3">—</span></div>
        </div>
        <dl>
          <dt>t</dt><dd data-h="t">—</dd><dt>ölçüm · geçiş</dt><dd data-h="n">—</dd>
          <dt>|Δv| gerçek</dt><dd data-h="ev" class="hi">—</dd><dt>3σ hız</dt><dd data-h="sv">—</dd>
          <dt>NIS ort. (bekl. 1)</dt><dd data-h="nis">—</dd><dt>Son çeyrek RMS</dt><dd data-h="rms">—</dd>
          <dt>Filtre</dt><dd data-h="flt">—</dd><dt>Gürültü</dt><dd data-h="noise">—</dd>
        </dl>
        <div class="lab-legend" data-legend></div>
      </div>
    </div>
    <div class="od__plots">
      <div class="od__cell" data-lab-reveal="fade"><canvas class="p" data-plot="pos" aria-label="Konum hatası ve 3σ"></canvas></div>
      <div class="od__cell" data-lab-reveal="fade"><canvas class="p" data-plot="vel" aria-label="Hız hatası ve 3σ"></canvas></div>
      <div class="od__cell" data-lab-reveal="fade"><canvas class="p" data-plot="res" aria-label="Normalize yenilikler"></canvas></div>
      <div class="od__cell" data-lab-reveal="fade"><canvas class="p" data-plot="nees" aria-label="NEES ve NIS"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const topEl = figure.querySelector('[data-top]');
  const P = palette(figure); const legendEl = figure.querySelector('[data-legend]');
  legendEl.innerHTML = `<span><i style="background:${P.ink}"></i>gerçek yörünge</span><span><i style="background:${P.accent}"></i>kestirim izi · 3σ elipsi</span><span><i style="background:${P.data1}"></i>görüşteki istasyon · 3σ zarfı</span><span><i style="background:${P.data2}"></i>menzil-hızı yenilikleri</span>`;
  const entrance = new Entrance({ frame: { at: 0, dur: .5 }, orbit: { at: .2, dur: 1.0 }, plots: { at: .6, dur: 1.2 }, marks: { at: 1.4, dur: .4 } }, { onFrame: () => draw() });
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtKm = x => x >= 1 ? `${nf2.format(x)} km` : `${nf0.format(x * 1000)} m`; const fmtV = x => x >= 1e-3 ? `${nf2.format(x * 1000)} m/s` : `${nf1.format(x * 1e6)} mm/s`;
  const fmtT = s => `${Math.floor(s / 3600)} sa ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')} dk`;

  let scId = options.scenario ?? 'leoOne', ov = options.overrides || {}, run = null;
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 900, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); draw(); } };
  function rebuild() { run = runOd(scId, ov); timeline.duration = run.N * run.dt; if (timeline.t > timeline.duration) timeline.t = 0; writeStatic(); }
  function writeStatic() {
    const c = run.cfg, s = run.stats;
    H.flt.textContent = `EKF · ${c.filterJ2 ? 'J2 açık' : 'J2 YOK'} · σ_a ${c.sigA.toExponential(0)} km/s² · dt ${c.dt} s`; H.noise.textContent = `σρ ${nf0.format(c.sigRho * 1000)} m · σρ̇ ${nf1.format(c.sigRate * 1e5)} cm/s · maske ${c.maskDeg}°`;
    H.rms.textContent = `${fmtKm(s.rmsPosFinal)} · ${fmtV(s.rmsVelFinal)}`; H.in3.textContent = `%${nf0.format(s.inside3sigFrac * 100)}`; H.in3.className = s.inside3sigFrac > .95 ? 'v ok' : 'v bad';
    H.nis.textContent = Number.isFinite(s.nisMean) ? nf2.format(s.nisMean) : '—'; H.nis.className = !Number.isFinite(s.nisMean) || (s.nisMean > .5 && s.nisMean < 2) ? '' : 'bad';
    topEl.textContent = `${SCENARIOS[scId].label} · gerçek: iki-cisim + J2 · istasyonlar: ${run.stations.map(x => x.label).join(', ')} · ölçüm: ${c.meas.map(m => m === 'range' ? 'menzil' : 'menzil-hızı').join(' + ')} · başlangıç hatası ${fmtKm(c.err0Pos)}, ${fmtV(c.err0Vel)}`;
  }
  const idxAt = t => clamp(Math.round(t / run.dt), 0, run.samples.length - 1);
  let dpr = 1;
  function drawOrbit(k) {
    const cv = plots.orbit, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas, grid: 44, gridAlpha: .03 * entrance.progress('frame') }); const pO = entrance.progress('orbit'), pM = entrance.progress('marks');
    const S = run.samples, ext = Math.max(...S.filter((_, i) => i % 20 === 0).map(s => Math.hypot(s.truth[0], s.truth[1]))) * 1.08, sc = Math.min(W, Hh) / 2 / ext * .92, X = x => W / 2 + x * sc, Y = y => Hh / 2 - y * sc;
    starfield(ctx, W, Hh, { seed: 6, n: 130, alpha: .45 * pO }); planet(ctx, X(0), Y(0), R_E * sc, { color: '#3d6fa8', sunDir: [1, -.3], atmosphere: '#6fb4ff', alpha: pO });
    const truthPts = []; for (let i = 0; i < S.length; i += 2) truthPts.push([X(S[i].truth[0]), Y(S[i].truth[1])]); polyline(ctx, truthPts, { progress: pO, color: 'rgba(255,255,255,.22)', width: 1 });
    /* kestirim izi (hata abartılı çizilmez; gerçek ölçek) — son turu kuyruk gibi */
    const estPts = []; for (let i = 0; i <= k; i += 2) estPts.push([X(S[i].est[0]), Y(S[i].est[1])]); if (pO >= 1 && estPts.length > 1) comet(ctx, estPts, estPts.length - 1, { len: 220, color: P.accent, width: 1.6 });
    const s = S[k], t = s.t, sts = run.stationsEci(t);
    for (const st of sts) { const vis = run.meas.some(m => m.k === k && m.station === st.label); marker(ctx, X(st.R[0]), Y(st.R[1]), 3.5, vis ? P.data1 : P.muted, { alpha: pM, ring: vis }); if (pM > .8) label(ctx, st.label, X(st.R[0]) + 7, Y(st.R[1]) - 6, P, { mono: false, size: 11, color: vis ? P.data1 : P.muted }); if (vis) { /* ölçüm huzmesi: istasyondan uyduya sönen koni + görüş çizgisi */ const sx = X(st.R[0]), sy = Y(st.R[1]), tx = X(s.truth[0]), ty = Y(s.truth[1]), dx = tx - sx, dy = ty - sy, Ln = Math.hypot(dx, dy) || 1, nx = -dy / Ln * 7, ny = dx / Ln * 7; const gB = ctx.createLinearGradient(sx, sy, tx, ty); gB.addColorStop(0, rgba(P.data1, .38)); gB.addColorStop(1, rgba(P.data1, .03)); ctx.save(); ctx.fillStyle = gB; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx + nx, ty + ny); ctx.lineTo(tx - nx, ty - ny); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(P.data1, .8); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.restore(); glow(ctx, sx, sy, 11, P.data1, .5); } }
    /* kovaryans elipsi (x–y bloğu, 3σ) — ölçekte görünmezse büyütülüp yazılır */
    const a = s.Prr[0][0], b = s.Prr[0][1], c = s.Prr[1][1], tr = a + c, det = a * c - b * b, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det)), ang = Math.atan2(l1 - a, b || 1e-30);
    const semi1 = 3 * Math.sqrt(Math.max(l1, 0)), semi2 = 3 * Math.sqrt(Math.max(l2, 0)); let mag = 1; while (semi1 * sc * mag < 14 && mag < 1e6) mag *= 10;
    ctx.save(); ctx.translate(X(s.est[0]), Y(s.est[1])); ctx.rotate(-ang); ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, semi1 * sc * mag), Math.max(1, semi2 * sc * mag), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    glow(ctx, X(s.truth[0]), Y(s.truth[1]), 13, P.accent, .5 * pM); marker(ctx, X(s.truth[0]), Y(s.truth[1]), 3.2, P.ink, { alpha: pM, ringAlpha: .5 }); marker(ctx, X(s.est[0]), Y(s.est[1]), 2.4, P.accent, { alpha: pM, ring: false });
    title(ctx, `ECI x–y (üstten) · 3σ elipsi ${mag > 1 ? '×' + nf0.format(mag) + ' büyütülmüş' : 'gerçek ölçek'}`, 12, Hh - 12, P);
  }
  function frame(cv, text) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas }); title(ctx, text, 12, 15, P); const pad = { l: 58, r: 12, t: 24, b: 18 }; return { ctx, W, Hh, pad, pw: W - pad.l - pad.r, ph: Hh - pad.t - pad.b }; }
  function passShade(f, T) { const { ctx, pad, pw, ph } = f; ctx.fillStyle = 'rgba(143,184,221,.08)'; for (const p of run.passes) { const x0 = pad.l + p.t0 / T * pw, x1 = pad.l + p.t1 / T * pw; ctx.fillRect(x0, pad.t, Math.max(1, x1 - x0), ph); } }
  function cursor(f, t, T) { const { ctx, pad, ph, pw } = f; const x = pad.l + t / T * pw; ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); }
  function xTicks(f, T) { const { ctx, pad, pw, Hh } = f; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center'; const step = T > 30 * 3600 ? 12 * 3600 : 6 * 3600; for (let t = 0; t <= T + 1; t += step) ctx.fillText(`${t / 3600} sa`, pad.l + t / T * pw, Hh - 4); ctx.textAlign = 'left'; }
  function logPlot(cv, title, key, sigKey, unitScale, unit, t, T) {
    const f = frame(cv, title), { ctx, pad, pw, ph } = f, S = run.samples; passShade(f, T);
    const vals = S.map(s => Math.max(s[key], 1e-12) * unitScale), sig = S.map(s => Math.max(s[sigKey], 1e-12) * unitScale);
    const lo = Math.log10(Math.min(...vals, ...sig)) - .2, hi = Math.log10(Math.max(...vals, ...sig)) + .2, Y = v => pad.t + ph - (Math.log10(v) - lo) / (hi - lo) * ph, X = i => pad.l + S[i].t / T * pw;
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right';
    for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) { const y = Y(10 ** e); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.fillText(`${e >= 0 ? 10 ** e : '1e' + e} ${unit}`, pad.l - 4, y + 3); } ctx.textAlign = 'left';
    const pP = entrance.progress('plots'); const sp = [], vp = []; for (let i = 0; i < S.length; i += 2) { sp.push([X(i), Y(sig[i])]); vp.push([X(i), Y(vals[i])]); } polyline(ctx, sp, { progress: pP, color: P.data1, width: 1.3 }); polyline(ctx, vp, { progress: pP, color: P.ink, width: 1.4 });
    cursor(f, t, T); xTicks(f, T);
  }
  function resPlot(cv, t, T) {
    const f = frame(cv, 'normalize yenilik ν/σ — nokta: menzil (mavi), menzil-hızı (turuncu); çizgi ±3; gölge: geçişler'), { ctx, pad, pw, ph } = f; passShade(f, T);
    const Y = v => pad.t + ph / 2 - clamp(v, -6, 6) / 6 * ph / 2; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(pad.l + pw, Y(0)); ctx.stroke(); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(3)); ctx.lineTo(pad.l + pw, Y(3)); ctx.moveTo(pad.l, Y(-3)); ctx.lineTo(pad.l + pw, Y(-3)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText('+3', pad.l - 4, Y(3) + 3); ctx.fillText('0', pad.l - 4, Y(0) + 3); ctx.fillText('−3', pad.l - 4, Y(-3) + 3); ctx.fillText('±6 kırpık', pad.l - 4, pad.t + 8); ctx.textAlign = 'left';
    for (const m of run.meas) { ctx.fillStyle = m.type === 'range' ? P.data1 : P.data2; ctx.globalAlpha = m.t <= t ? .85 : .25; ctx.fillRect(pad.l + m.t / T * pw - 1, Y(m.innov / m.sigInnov) - 1, 2, 2); } ctx.globalAlpha = 1;
    cursor(f, t, T); xTicks(f, T);
  }
  function neesPlot(cv, t, T) {
    const f = frame(cv, 'NEES = eᵀP⁻¹e (beyaz, beklenen 6; log) ve ölçüm NIS (turuncu, beklenen 1)'), { ctx, pad, pw, ph } = f, S = run.samples; passShade(f, T);
    const lo = -1, hi = Math.max(2, Math.log10(Math.max(...S.map(s => s.nees || 1)) + 1) + .2), Y = v => pad.t + ph - (Math.log10(Math.max(v, .1)) - lo) / (hi - lo) * ph;
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; for (let e = 0; e <= Math.floor(hi); e++) { const y = Y(10 ** e); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.fillText(String(10 ** e), pad.l - 4, y + 3); } ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(217,184,119,.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(6)); ctx.lineTo(pad.l + pw, Y(6)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < S.length; i += 2) { const x = pad.l + S[i].t / T * pw, y = Y(S[i].nees); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (const m of run.meas) { ctx.fillStyle = P.data2; ctx.globalAlpha = m.t <= t ? .8 : .25; ctx.fillRect(pad.l + m.t / T * pw - 1, Y(m.nis) - 1, 2, 2); } ctx.globalAlpha = 1;
    cursor(f, t, T); xTicks(f, T);
  }
  function draw() {
    if (!run) return; const t = timeline.t, k = idxAt(t), s = run.samples[k], T = timeline.duration;
    drawOrbit(k); logPlot(plots.pos, 'konum hatası |Δr| (beyaz) ve filtre 3σ (mavi) — log ölçek', 'errPos', 'sig3Pos', 1000, 'm', t, T); logPlot(plots.vel, 'hız hatası |Δv| (beyaz) ve 3σ (mavi)', 'errVel', 'sig3Vel', 1e6, 'mm/s', t, T); resPlot(plots.res, t, T); neesPlot(plots.nees, t, T);
    H.t.textContent = fmtT(t); H.n.textContent = `${s.nMeasSoFar} · ${run.passes.filter(p => p.t0 <= t).length}/${run.passes.length}`; H.er.textContent = fmtKm(s.errPos); H.sr.textContent = fmtKm(s.sig3Pos); H.ev.textContent = fmtV(s.errVel); H.sv.textContent = fmtV(s.sig3Vel);
    H.nees.textContent = s.nees >= 1e4 ? s.nees.toExponential(1) : nf1.format(s.nees); H.nees.className = s.nees < 20 ? 'v' : 'v bad'; H.er.className = s.errPos <= s.sig3Pos ? 'v hi' : 'v bad';
  }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t = 0; } draw(); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && timeline.playing) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure); rebuild();
  if (reducedMotion || exportMode || options.t != null) timeline.t = options.t ?? timeline.duration * .5; else if (options.autoplay ?? true) timeline.playing = true;
  resize(); entrance.start(); ensureLoop();
  return {
    get run() { return run; }, get scenario() { return scId; }, timeline, scenarios: SCENARIOS, stations: STATIONS,
    setScenario(id, o) { scId = SCENARIOS[id] ? id : scId; ov = o || {}; timeline.t = 0; rebuild(); draw(); entrance.start(); }, replay() { entrance.start(); }, advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
