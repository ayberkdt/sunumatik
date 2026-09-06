/* transfer-explorer.mjs — Lambert Transfer Kâşifi (transfer_explorer)

   Sol: merkezi cisim, kalkış/varış dairesel yörüngeleri, r1/r2 vektörleri, transfer yayı (Kepler yayılımı),
   v1/v2 ve ΔV okları, transfer açısı Δθ; sağ: ΔV toplamı vs TOF eğrisi (kısa/uzun yol) + Hohmann referansı,
   seçili TOF imleci; HUD: ΔV₁, ΔV₂, toplam, a, e, r_p, Δθ, v∞. Çözücü: transfer-model.mjs → core/astro-lambert.mjs.

   API: const tx = await mountTransfer(host, { preset:'leoGeo', tof?, direction?, dth?, r1?, r2?, central? });
        tx.set({...}) · tx.solution · tx.sweep · tx.dispose()      (2B tuval, THREE gerekmez) */

import { solveTransfer, hohmann, tofSweep, PRESETS, CENTRAL } from './transfer-model.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountTransfer(host, options = {}) {
  if (!host) throw new Error('mountTransfer bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'tx';
  figure.innerHTML = `
    <style>
      .tx{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .tx__geo,.tx__sweep{position:relative;min-width:0;min-height:0;} .tx__sweep{border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr);}
      .tx canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .tx__cell{position:relative;min-height:0;}
      .tx__hud{padding:10px 14px;border-bottom:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .tx__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px;} .tx__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .tx__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);} .tx__hud dd.hi{color:var(--color-accent,#d9b877);}
    </style>
    <div class="tx__geo"><canvas class="p" data-plot="geo" aria-label="Transfer geometrisi"></canvas></div>
    <div class="tx__sweep">
      <div class="tx__hud" role="status"><dl>
        <dt>ΔV₁ kalkış</dt><dd data-h="dv1" class="hi">—</dd><dt>ΔV₂ varış</dt><dd data-h="dv2" class="hi">—</dd>
        <dt>ΔV toplam</dt><dd data-h="dvt" class="hi">—</dd><dt>Hohmann</dt><dd data-h="hoh">—</dd>
        <dt>TOF</dt><dd data-h="tof">—</dd><dt>Δθ (yol)</dt><dd data-h="dth">—</dd>
        <dt>a, e</dt><dd data-h="ae">—</dd><dt>r_p / r_a</dt><dd data-h="rpa">—</dd>
        <dt>|v1|, |v2|</dt><dd data-h="v12">—</dd><dt>tarama minimumu</dt><dd data-h="best">—</dd>
      </dl></div>
      <div class="tx__cell"><canvas class="p" data-plot="sweep" aria-label="ΔV vs TOF"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const pre = PRESETS[options.preset ?? 'leoGeo'];
  let cfg = { central: pre.central, r1: pre.r1, r2: pre.r2, dth: pre.dth, tof: pre.tof, tofRange: pre.tofRange, direction: 'prograde', ...(options.config || {}) };
  if (options.tof) cfg.tof = options.tof; if (options.direction) cfg.direction = options.direction; if (options.dth != null) cfg.dth = options.dth;
  let sol = null, sweep = null, hoh = null;
  const fmtT = s => s >= 3 * 86400 ? `${nf1.format(s / 86400)} gün` : `${nf2.format(s / 3600)} sa`;
  function recompute() {
    sol = solveTransfer(cfg); sweep = tofSweep(cfg, cfg.tofRange, 90); hoh = hohmann(CENTRAL[cfg.central].mu, cfg.r1, cfg.r2);
    if (sol) { H.dv1.textContent = `${nf3.format(sol.dv1)} km/s`; H.dv2.textContent = `${nf3.format(sol.dv2)} km/s`; H.dvt.textContent = `${nf3.format(sol.dvTotal)} km/s`; H.tof.textContent = fmtT(sol.tof); H.dth.textContent = `${nf1.format(sol.dtheta * 180 / Math.PI)}° (${cfg.direction === 'prograde' ? 'kısa' : 'uzun'} yol)`;
      const u = CENTRAL[cfg.central].unit; H.ae.textContent = `${nf3.format(sol.a / u)} ${CENTRAL[cfg.central].unitLabel}, ${nf3.format(sol.e)}`; H.rpa.textContent = `${nf3.format(sol.rp / u)} / ${sol.ra === Infinity ? '∞' : nf3.format(sol.ra / u)}`; H.v12.textContent = `${nf2.format(Math.hypot(...sol.v1))} / ${nf2.format(Math.hypot(...sol.v2))} km/s`; }
    else for (const k of ['dv1', 'dv2', 'dvt', 'tof', 'dth', 'ae', 'rpa', 'v12']) H[k].textContent = 'çözüm yok';
    H.hoh.textContent = `${nf3.format(hoh.dvTotal)} km/s @ ${fmtT(hoh.tof)}`; H.best.textContent = sweep.best ? `${nf3.format(sweep.best.dv)} km/s @ ${fmtT(sweep.best.tof)} ${sweep.best.way === 'short' ? 'kısa' : 'uzun'}` : '—';
    draw();
  }
  let dpr = 1;
  function drawGeo() {
    const cv = plots.geo, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const ext = Math.max(cfg.r1, cfg.r2, sol ? Math.max(...sol.arc.map(p => Math.hypot(p[0], p[1]))) : 0) * 1.12;
    const sc = Math.min(W, Hh) / 2 / ext * .9, cx = W / 2, cy = Hh / 2, X = x => cx + x * sc, Y = y => cy - y * sc;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`${CENTRAL[cfg.central].label} merkezli · kalkış/varış dairesel · transfer yayı Lambert v1'den Kepler yayılımı · yeşil oklar ΔV`, 14, 18);
    for (const [r, c] of [[cfg.r1, P.data1], [cfg.r2, P.data2]]) { ctx.strokeStyle = c; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X(0), Y(0), r * sc, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = cfg.central === 'sun' ? '#ffd27a' : '#5f8fc4'; ctx.beginPath(); ctx.arc(X(0), Y(0), cfg.central === 'sun' ? 7 : Math.max(5, 6378 * sc), 0, Math.PI * 2); ctx.fill();
    if (sol) {
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(sol.R1[0]), Y(sol.R1[1])); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(sol.R2[0]), Y(sol.R2[1])); ctx.stroke(); ctx.setLineDash([]);
      /* Δθ yayı */
      ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.beginPath(); const bodyPx = cfg.central === 'sun' ? 7 : Math.max(5, 6378 * sc); const ra = Math.max(Math.min(cfg.r1, cfg.r2) * sc * .35, bodyPx + 16); ctx.arc(X(0), Y(0), ra, 0, -sol.dtheta, true); ctx.stroke(); ctx.fillStyle = P.accent; ctx.font = '600 11px ui-monospace, monospace'; const lbA = sol.dtheta / 2; ctx.fillText(`Δθ = ${nf1.format(sol.dtheta * 180 / Math.PI)}°`, X(0) + (ra + 8) * Math.cos(lbA) - (Math.cos(lbA) < 0 ? 62 : 0), Y(0) - (ra + 8) * Math.sin(lbA) + 4);
      ctx.strokeStyle = P.accent; ctx.lineWidth = 2.2; ctx.beginPath(); sol.arc.forEach((p, k) => k ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
      const arrow = (x0, y0, vx, vy, k, color, label, w = 1.6) => { const x1 = x0 + vx * k, y1 = y0 - vy * k; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 7 * Math.cos(a - .38), y1 - 7 * Math.sin(a - .38)); ctx.lineTo(x1 - 7 * Math.cos(a + .38), y1 - 7 * Math.sin(a + .38)); ctx.closePath(); ctx.fill(); if (label) { ctx.font = '10.5px ui-monospace, monospace'; ctx.fillText(label, x1 + 6, y1 - 4); } };
      const kv = Math.min(W, Hh) * .14 / Math.max(Math.hypot(...sol.v1), Math.hypot(...sol.Vc1), 1e-9);
      arrow(X(sol.R1[0]), Y(sol.R1[1]), sol.Vc1[0], sol.Vc1[1], kv, 'rgba(143,184,221,.9)', 'v_c1'); arrow(X(sol.R1[0]), Y(sol.R1[1]), sol.v1[0], sol.v1[1], kv, P.accent, 'v1');
      arrow(X(sol.R1[0]) + sol.Vc1[0] * kv, Y(sol.R1[1]) - sol.Vc1[1] * kv, sol.dv1v[0], sol.dv1v[1], kv, '#8fd39a', `ΔV₁ ${nf2.format(sol.dv1)}`, 2.2);
      arrow(X(sol.R2[0]), Y(sol.R2[1]), sol.v2[0], sol.v2[1], kv, P.accent, 'v2'); arrow(X(sol.R2[0]), Y(sol.R2[1]), sol.Vc2[0], sol.Vc2[1], kv, 'rgba(215,143,108,.9)', 'v_c2');
      arrow(X(sol.R2[0]) + sol.v2[0] * kv, Y(sol.R2[1]) - sol.v2[1] * kv, sol.dv2v[0], sol.dv2v[1], kv, '#8fd39a', `ΔV₂ ${nf2.format(sol.dv2)}`, 2.2);
      ctx.fillStyle = P.data1; ctx.beginPath(); ctx.arc(X(sol.R1[0]), Y(sol.R1[1]), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.data2; ctx.beginPath(); ctx.arc(X(sol.R2[0]), Y(sol.R2[1]), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('r1 · kalkış', X(sol.R1[0]) + 8, Y(sol.R1[1]) + 16); ctx.fillText('r2 · varış', X(sol.R2[0]) + 8, Y(sol.R2[1]) + 16);
    } else { ctx.fillStyle = P.data2; ctx.font = '12px Inter, sans-serif'; ctx.fillText('Bu TOF için tek-tur Lambert çözümü yok (Δθ = 180° tekilliği ya da çok kısa TOF).', 14, Hh / 2); }
  }
  function drawSweep() {
    const cv = plots.sweep, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const pad = { l: 54, r: 14, t: 24, b: 30 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b, pts = sweep.points;
    const vals = pts.flatMap(p => [p.short, p.long]).filter(Number.isFinite); const lo = 0, hi = Math.min(Math.max(...vals), hoh.dvTotal * 3.2);
    const X = t => pad.l + Math.log(t / cfg.tofRange[0]) / Math.log(cfg.tofRange[1] / cfg.tofRange[0]) * pw, Y = v => pad.t + ph - clamp((v - lo) / (hi - lo), 0, 1.02) * ph;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('ΔV toplamı vs uçuş süresi (log TOF) — mavi: kısa yol, turuncu: uzun yol, kesikli: Hohmann', pad.l, 13);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k <= 4; k++) { const y = pad.t + ph * k / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); }
    for (const [key, color] of [['short', P.data1], ['long', P.data2]]) { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); let first = true; for (const p of pts) { const v = p[key]; if (!Number.isFinite(v) || v > hi * 1.02) { first = true; continue; } const x = X(p.tof), y = Y(v); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; } ctx.stroke(); }
    ctx.strokeStyle = P.ink; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Y(hoh.dvTotal)); ctx.lineTo(pad.l + pw, Y(hoh.dvTotal)); ctx.stroke(); ctx.setLineDash([]);
    if (hoh.tof >= cfg.tofRange[0] && hoh.tof <= cfg.tofRange[1]) { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(X(hoh.tof), Y(hoh.dvTotal), 3.5, 0, Math.PI * 2); ctx.fill(); ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`Hohmann ${nf3.format(hoh.dvTotal)}`, X(hoh.tof) + 6, Y(hoh.dvTotal) - 6); }
    if (sol) { const x = X(sol.tof); ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(x, Y(sol.dvTotal), 4.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(`${nf1.format(hi)} km/s`, pad.l - 4, pad.t + 8); ctx.fillText('0', pad.l - 4, pad.t + ph); ctx.textAlign = 'center';
    for (const f of [0, .25, .5, .75, 1]) { const t = cfg.tofRange[0] * Math.pow(cfg.tofRange[1] / cfg.tofRange[0], f); ctx.fillText(fmtT(t), X(t), Hh - 10); } ctx.textAlign = 'left';
  }
  function draw() { drawGeo(); drawSweep(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  recompute(); resize();
  return {
    get solution() { return sol; }, get sweep() { return sweep; }, get hohmann() { return hoh; }, get config() { return { ...cfg }; }, presets: PRESETS, central: CENTRAL,
    set(c) { cfg = { ...cfg, ...c }; recompute(); }, setPreset(id) { const p = PRESETS[id]; cfg = { central: p.central, r1: p.r1, r2: p.r2, dth: p.dth, tof: p.tof, tofRange: p.tofRange, direction: 'prograde' }; recompute(); },
    dispose() { ro.disconnect(); figure.remove(); },
  };
}
