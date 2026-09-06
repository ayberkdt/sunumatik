/* free-return.mjs — Ay Serbest Dönüş Yörüngesi sahnesi (free_return). 2B tuval, THREE gerekmez.

   Sol: dönen çerçeve (Dünya, Ay, seçili yörünge "8" figürü, perilune ve dönüş perigee imleri) ve eylemsiz çerçeve
   (Dünya-merkezli; Ay'ın konumu kalkış ve perilune anında). Sağ: (ΔV_TLI, θ₀) tarama haritası — renk: dönüş perigee
   yüksekliği, kontur: perilune sınırı; serbest dönüş koridoru; HUD. Model: free-return-model.mjs → core/astro-cr3bp.

   API: const fr = await mountFreeReturn(host, { dvKmS, theta0, h0 }); fr.set({...}) · fr.sim · fr.scan · fr.dispose() */

import { simulate, scan, SYS, MU, L, R_EARTH, R_MOON, TU } from './free-return-model.mjs';
import { palette, backdrop, polyline, marker, label, title, tag, comet, Entrance, reveal, staticMode, rgba } from '../core/lab-scene.mjs';

export async function mountFreeReturn(host, options = {}) {
  if (!host) throw new Error('mountFreeReturn bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'fr';
  figure.innerHTML = `
    <style>
      .fr{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .fr canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .fr__cell{position:relative;min-height:0;min-width:0;}
      .fr__left{display:grid;grid-template-columns:1fr 1fr;min-width:0;min-height:0;} .fr__left .fr__cell:first-child{border-right:1px solid var(--color-rule,#3a3c42);}
      .fr__right{display:grid;grid-template-rows:minmax(0,1fr) auto;border-left:1px solid var(--color-rule,#3a3c42);min-width:0;min-height:0;}
      .fr__hud{padding:12px 16px 10px;border-top:1px solid var(--lab-rule,#3a3c42);}
    </style>
    <div class="fr__left"><div class="fr__cell" data-lab-reveal="fade"><canvas class="p" data-plot="rot" aria-label="Dönen çerçeve"></canvas></div><div class="fr__cell" data-lab-reveal="fade"><canvas class="p" data-plot="in" aria-label="Eylemsiz çerçeve"></canvas></div></div>
    <div class="fr__right">
      <div class="fr__cell" data-lab-reveal="fade"><canvas class="p" data-plot="map" aria-label="ΔV–θ₀ tarama haritası"></canvas></div>
      <div class="fr__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">Serbest dönüş</span><span class="v" data-h="ok">—</span></div>
          <div><span class="k">Perilune</span><span class="v hi" data-h="hp">—</span></div>
          <div><span class="k">Dönüş perigee</span><span class="v hi" data-h="hr">—</span></div>
          <div><span class="k">Toplam süre</span><span class="v" data-h="tt">—</span></div>
        </div>
        <dl>
          <dt>ΔV_TLI · θ₀</dt><dd data-h="in" class="hi">—</dd><dt>Ay'a süre</dt><dd data-h="t">—</dd>
          <dt>Jacobi sapması</dt><dd data-h="jc">—</dd><dt>Koridor (tarama)</dt><dd data-h="cor">—</dd>
          <dt>En iyi aday</dt><dd data-h="best">—</dd><dt>Araç konumu</dt><dd data-h="pos">—</dd>
        </dl>
        <div class="lab-legend" data-legend></div>
      </div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const P = palette(figure); const legendEl = figure.querySelector('[data-legend]');
  legendEl.innerHTML = `<span><i style="background:${P.accent}"></i>yörünge</span><span><i style="background:${P.data2}"></i>perilune</span><span><i style="background:${P.green}"></i>dönüş perigee</span><span><i style="background:${P.ink}"></i>araç (kuyruklu iz)</span>`;
  const timeline = { playing: !staticMode() && options.autoplay !== false, u: options.u ?? .55, period: 9, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(u) { this.u = Math.min(1, Math.max(0, u)); this.playing = false; draw(); } };
  const entrance = new Entrance({ bodies: { at: 0, dur: .5 }, path: { at: .35, dur: 1.6 }, marks: { at: 1.7, dur: .4 }, map: { at: .6, dur: 1.0 }, craft: { at: 2.0, dur: .4 } }, { onFrame: () => draw() });
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  let cfg = { dvKmS: options.dvKmS ?? null, theta0: options.theta0 ?? null, h0: options.h0 ?? 200 }, S = null, SC = null;
  function rebuild() {
    if (!SC || SC.h0 !== cfg.h0) { SC = scan({ h0: cfg.h0 }); SC.h0 = cfg.h0; }
    if (cfg.dvKmS == null || cfg.theta0 == null) { const b = SC.best; cfg.dvKmS = b ? b.dv : 3.14; cfg.theta0 = b ? b.th : 229; }
    S = simulate({ h0: cfg.h0, dvKmS: cfg.dvKmS, theta0: cfg.theta0 }); writeHud();
  }
  const isFree = s => s.perilune && s.returnPerigee && s.perilune.altKm > SC.hpMin && !s.impactMoon && s.perilune.altKm < 20000 && Math.abs(s.returnPerigee.altKm - SC.hrTarget) < SC.hrTol;
  function writeHud() {
    H.in.textContent = `${nf3.format(cfg.dvKmS)} km/s · ${nf1.format(cfg.theta0)}°`; const ok = isFree(S); H.ok.textContent = ok ? 'EVET' : S.impactMoon ? 'HAYIR · Ay’a çarpar' : !S.perilune || S.perilune.altKm > 20000 ? 'HAYIR · Ay’a ulaşmaz' : 'HAYIR · perigee dışı'; H.ok.className = ok ? 'v ok' : 'v bad';
    H.hp.innerHTML = S.perilune ? `${nf0.format(S.perilune.altKm)}<span class="u">km</span>` : '—'; H.hr.innerHTML = S.returnPerigee ? `${nf0.format(S.returnPerigee.altKm)}<span class="u">km</span>` : '—'; H.tt.innerHTML = S.returnPerigee ? `${nf2.format(S.returnPerigee.tDays)}<span class="u">gün</span>` : '—';
    H.t.textContent = `${S.perilune ? nf2.format(S.perilune.tDays) : '—'} gün`; H.jc.textContent = S.jacobiDrift.toExponential(1);
    const rf = SC.refined; H.cor.textContent = rf.length ? `${rf.length} çözüm · ΔV ${nf3.format(Math.min(...rf.map(c => c.dv)))}–${nf3.format(Math.max(...rf.map(c => c.dv)))} km/s, θ₀ ${nf1.format(Math.min(...rf.map(c => c.th)))}–${nf1.format(Math.max(...rf.map(c => c.th)))}°` : 'yok'; H.best.textContent = SC.best ? `${nf3.format(SC.best.dv)} km/s, ${nf1.format(SC.best.th)}° → h_p ${nf0.format(SC.best.hp)} km, dönüş ${nf0.format(SC.best.hr)} km` : '—';
  }
  let dpr = 1;
  function frame(cv, text, grid = 0) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas, grid, gridAlpha: .03 }); title(ctx, text, 12, 16, P); return { ctx, W, Hh }; }
  /* zaman → örnek indeksi (araç konumu) */
  const idxAt = u => { const T = S.times[S.times.length - 1] * u; let lo = 0, hi = S.times.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (S.times[m] < T) lo = m + 1; else hi = m; } return lo; };
  function drawRot() {
    const f = frame(plots.rot, 'dönen çerçeve · Dünya–Ay doğrultusu sabit', 40), { ctx, W, Hh } = f; const pB = entrance.progress('bodies'), pP = entrance.progress('path'), pM = entrance.progress('marks');
    let xmin = -MU - .05, xmax = 1 - MU + .05, ymin = -.15, ymax = .15; for (const st of S.states) { xmin = Math.min(xmin, st[0]); xmax = Math.max(xmax, st[0]); ymin = Math.min(ymin, st[1]); ymax = Math.max(ymax, st[1]); }
    const mx = (xmin + xmax) / 2, my = (ymin + ymax) / 2, sc = Math.min((W - 40) / (xmax - xmin), (Hh - 60) / (ymax - ymin)), X = x => W / 2 + (x - mx) * sc, Y = y => Hh / 2 + 10 - (y - my) * sc;
    ctx.save(); ctx.globalAlpha = pB; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.arc(X(-MU), Y(0), 1 * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#3d6fa8'; ctx.beginPath(); ctx.arc(X(-MU), Y(0), Math.max(4, R_EARTH * sc), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = rgba('#3d6fa8', .4); ctx.beginPath(); ctx.arc(X(-MU), Y(0), Math.max(4, R_EARTH * sc) + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#a9a49b'; ctx.beginPath(); ctx.arc(X(1 - MU), Y(0), Math.max(3, R_MOON * sc), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const pts = S.states.map(s => [X(s[0]), Y(s[1])]); polyline(ctx, pts, { progress: pP, color: P.accent, width: 1.8 });
    if (pM > 0 && S.perilune) { const s = S.states[S.perilune.i]; marker(ctx, X(s[0]), Y(s[1]), 4 * pM, P.data2, { alpha: pM }); if (pM > .8) tag(ctx, `perilune ${nf0.format(S.perilune.altKm)} km`, X(s[0]) + (X(s[0]) > W * .6 ? -10 : 10), Y(s[1]) - 14, P, { color: P.data2, mono: true, anchor: X(s[0]) > W * .6 ? 'right' : 'left' }); }
    if (pM > 0 && S.returnPerigee) { const s = S.states[S.returnPerigee.i]; marker(ctx, X(s[0]), Y(s[1]), 5 * pM, P.green, { hollow: true, alpha: pM }); }
    label(ctx, 'Dünya', X(-MU) + 10, Y(0) + 16, P, { mono: false, size: 11, color: P.muted }); label(ctx, 'Ay', X(1 - MU) + 8, Y(0) + 16, P, { mono: false, size: 11, color: P.muted });
    const pC = entrance.progress('craft'); if (pC > 0) { const k = idxAt(timeline.u); comet(ctx, pts, k, { len: 60, color: P.ink, width: 2.2 }); marker(ctx, pts[k][0], pts[k][1], 3.5 * pC, P.ink, { ringAlpha: .5, alpha: pC }); }
  }
  function drawIn() {
    const f = frame(plots.in, 'eylemsiz çerçeve · Dünya merkezli, Ay yörüngesinde ilerler', 40), { ctx, W, Hh } = f; const pB = entrance.progress('bodies'), pP = entrance.progress('path');
    const pts = S.inertial.map((p, i) => { const s = S.states[i]; const t = S.times[i]; const ex = -MU * Math.cos(t), ey = -MU * Math.sin(t); return [p[0] - ex, p[1] - ey]; });   // Dünya-merkezli
    let xmin = -.1, xmax = .1, ymin = -.1, ymax = .1; for (const p of pts) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } const kIdx = idxAt(timeline.u), tM = S.times[kIdx]; for (const t of [0, tM, S.times[S.perilune ? S.perilune.i : 0]]) { xmin = Math.min(xmin, Math.cos(t)); xmax = Math.max(xmax, Math.cos(t)); ymin = Math.min(ymin, Math.sin(t)); ymax = Math.max(ymax, Math.sin(t)); }
    const mx = (xmin + xmax) / 2, my = (ymin + ymax) / 2, sc0 = Math.min((W - 40) / (xmax - xmin), (Hh - 60) / (ymax - ymin)), sc = sc0 / .8, X = x => W / 2 + (x - mx) * sc0, Y = y => Hh / 2 + 10 - (y - my) * sc0;
    ctx.save(); ctx.globalAlpha = pB; ctx.fillStyle = '#3d6fa8'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(4, R_EARTH * sc * .8), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.arc(X(0), Y(0), sc * .8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const spts = pts.map(p => [X(p[0]), Y(p[1])]); polyline(ctx, spts, { progress: pP, color: P.accent, width: 1.6 });
    const moonAt = t => [Math.cos(t), Math.sin(t)]; const k = idxAt(timeline.u), tNow = S.times[k], mNow = moonAt(tNow);
    /* Ay: kalkıştan şimdiye kadar süpürdüğü yay + anlık konum; araç kuyruklu iz */
    ctx.save(); ctx.globalAlpha = pB; ctx.strokeStyle = rgba('#a9a49b', .45); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(0), Y(0), sc * .8, -0, -tNow, true); ctx.stroke(); ctx.restore();
    marker(ctx, X(mNow[0]), Y(mNow[1]), 5, '#a9a49b', { alpha: pB }); label(ctx, 'Ay', X(mNow[0]) + 8, Y(mNow[1]) + 14, P, { mono: false, size: 11 });
    if (entrance.progress('craft') > 0) { comet(ctx, spts, k, { len: 60, color: P.ink, width: 2 }); marker(ctx, spts[k][0], spts[k][1], 3.5, P.ink, { ringAlpha: .5 }); }
    if (S.perilune) { const mp = moonAt(S.times[S.perilune.i]); marker(ctx, X(mp[0]), Y(mp[1]), 4, '#a9a49b', { hollow: true, alpha: pB * .7 }); }
  }
  function drawMap() {
    const f = frame(plots.map, `tarama · yatay θ₀, düşey ΔV_TLI · yeşil: dönüş perigee ≈ ${SC.hrTarget} km · turuncu: Ay'a çarpar · gri: ulaşmaz`), { ctx, W, Hh } = f; const pMap = entrance.progress('map');
    const pad = { l: 56, r: 12, t: 22, b: 22 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b, cw = pw / SC.nTh, ch = ph / SC.nDv;
    for (const c of SC.cells) { const a = Math.round((c.dv - SC.dvRange[0]) / (SC.dvRange[1] - SC.dvRange[0]) * (SC.nDv - 1)), b = Math.round((c.th - SC.thRange[0]) / (SC.thRange[1] - SC.thRange[0]) * (SC.nTh - 1)); const x = pad.l + b * cw, y = pad.t + ph - (a + 1) * ch;
      let col; if (!Number.isFinite(c.hp) || c.hp > 20000) col = 'rgba(255,255,255,.06)'; else if (c.hp < 0 || c.hp < SC.hpMin) col = 'rgba(215,143,108,.7)'; else { const d = Math.abs(c.hr - SC.hrTarget); col = d < 120 ? '#8fd39a' : d < 1000 ? 'rgba(143,211,154,.45)' : d < 10000 ? 'rgba(143,184,221,.35)' : 'rgba(143,184,221,.12)'; }
      const rowT = Math.min(1, Math.max(0, pMap * SC.nDv - a)); ctx.save(); ctx.globalAlpha = rowT; ctx.fillStyle = col; ctx.fillRect(x + .5, y + .5, cw - 1, ch - 1); ctx.restore(); }
    ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; for (let a = 0; a < SC.nDv; a += Math.max(1, Math.floor(SC.nDv / 5))) ctx.fillText(nf3.format(SC.dvRange[0] + (SC.dvRange[1] - SC.dvRange[0]) * a / (SC.nDv - 1)), pad.l - 4, pad.t + ph - (a + .5) * ch + 3); ctx.textAlign = 'center'; for (let b = 0; b < SC.nTh; b += Math.max(1, Math.floor(SC.nTh / 6))) ctx.fillText(`${nf0.format(SC.thRange[0] + (SC.thRange[1] - SC.thRange[0]) * b / (SC.nTh - 1))}°`, pad.l + (b + .5) * cw, Hh - 6); ctx.textAlign = 'left';
    for (const r of SC.refined) { const xr = pad.l + (r.th - SC.thRange[0]) / (SC.thRange[1] - SC.thRange[0]) * pw, yr = pad.t + ph - (r.dv - SC.dvRange[0]) / (SC.dvRange[1] - SC.dvRange[0]) * ph; ctx.fillStyle = '#8fd39a'; ctx.beginPath(); ctx.arc(xr, yr, 3, 0, Math.PI * 2); ctx.fill(); }
    const xs = pad.l + (cfg.theta0 - SC.thRange[0]) / (SC.thRange[1] - SC.thRange[0]) * pw, ys = pad.t + ph - (cfg.dvKmS - SC.dvRange[0]) / (SC.dvRange[1] - SC.dvRange[0]) * ph; ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xs, ys, 6, 0, Math.PI * 2); ctx.stroke();
  }
  function draw() { if (!S) return; drawRot(); drawIn(); drawMap(); if (H.pos) { const k = idxAt(timeline.u), st = S.states[k]; H.pos.textContent = `t = ${nf2.format(S.times[k] * TU / 86400)} gün · Ay uzaklığı ${nf0.format(Math.hypot(st[0] - 1 + MU, st[1]) * L)} km`; } }
  let active = true, rafId = 0, lastNow = 0;
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; if (timeline.playing && entrance.done) { timeline.u += dt / timeline.period; if (timeline.u > 1) timeline.u -= 1; draw(); } ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && timeline.playing && !staticMode()) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure); rebuild(); resize(); entrance.start(); ensureLoop();
  return { get sim() { return S; }, get scan() { return SC; }, get config() { return { ...cfg }; }, timeline, set(c) { cfg = { ...cfg, ...c }; rebuild(); draw(); }, replay() { entrance.start(); }, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); } };
}
