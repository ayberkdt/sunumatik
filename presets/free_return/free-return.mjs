/* free-return.mjs — Ay Serbest Dönüş Yörüngesi sahnesi (free_return). 2B tuval, THREE gerekmez.

   Sol: dönen çerçeve (Dünya, Ay, seçili yörünge "8" figürü, perilune ve dönüş perigee imleri) ve eylemsiz çerçeve
   (Dünya-merkezli; Ay'ın konumu kalkış ve perilune anında). Sağ: (ΔV_TLI, θ₀) tarama haritası — renk: dönüş perigee
   yüksekliği, kontur: perilune sınırı; serbest dönüş koridoru; HUD. Model: free-return-model.mjs → core/astro-cr3bp.

   API: const fr = await mountFreeReturn(host, { dvKmS, theta0, h0 }); fr.set({...}) · fr.sim · fr.scan · fr.dispose() */

import { simulate, scan, SYS, MU, L, R_EARTH, R_MOON } from './free-return-model.mjs';

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
      .fr__hud{padding:8px 12px;border-top:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .fr__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:1px 10px;} .fr__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .fr__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:11.5px;color:var(--color-ink,#e9e4d8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .fr__hud dd.hi{color:var(--color-accent,#d9b877);} .fr__hud dd.bad{color:var(--color-data-2,#d78f6c);} .fr__hud dd.ok{color:#8fd39a;}
    </style>
    <div class="fr__left"><div class="fr__cell"><canvas class="p" data-plot="rot" aria-label="Dönen çerçeve"></canvas></div><div class="fr__cell"><canvas class="p" data-plot="in" aria-label="Eylemsiz çerçeve"></canvas></div></div>
    <div class="fr__right">
      <div class="fr__cell"><canvas class="p" data-plot="map" aria-label="ΔV–θ₀ tarama haritası"></canvas></div>
      <div class="fr__hud" role="status"><dl>
        <dt>ΔV_TLI · θ₀</dt><dd data-h="in" class="hi">—</dd><dt>Serbest dönüş?</dt><dd data-h="ok">—</dd>
        <dt>Perilune</dt><dd data-h="hp" class="hi">—</dd><dt>Dönüş perigee</dt><dd data-h="hr" class="hi">—</dd>
        <dt>Ay'a süre · toplam</dt><dd data-h="t">—</dd><dt>Jacobi sapması</dt><dd data-h="jc">—</dd>
        <dt>Koridor (tarama)</dt><dd data-h="cor">—</dd><dt>En iyi aday</dt><dd data-h="best">—</dd>
      </dl></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  let cfg = { dvKmS: options.dvKmS ?? null, theta0: options.theta0 ?? null, h0: options.h0 ?? 200 }, S = null, SC = null;
  function rebuild() {
    if (!SC || SC.h0 !== cfg.h0) { SC = scan({ h0: cfg.h0 }); SC.h0 = cfg.h0; }
    if (cfg.dvKmS == null || cfg.theta0 == null) { const b = SC.best; cfg.dvKmS = b ? b.dv : 3.14; cfg.theta0 = b ? b.th : 229; }
    S = simulate({ h0: cfg.h0, dvKmS: cfg.dvKmS, theta0: cfg.theta0 }); writeHud();
  }
  const isFree = s => s.perilune && s.returnPerigee && s.perilune.altKm > SC.hpMin && !s.impactMoon && s.perilune.altKm < 20000 && Math.abs(s.returnPerigee.altKm - SC.hrTarget) < SC.hrTol;
  function writeHud() {
    H.in.textContent = `${nf3.format(cfg.dvKmS)} km/s · ${nf1.format(cfg.theta0)}°`; const ok = isFree(S); H.ok.textContent = ok ? 'EVET — manevrasız Dünya atmosferine döner' : S.impactMoon ? 'HAYIR — Ay’a çarpar' : !S.perilune || S.perilune.altKm > 20000 ? 'HAYIR — Ay’a ulaşmaz' : 'HAYIR — dönüş perigee hedef dışı'; H.ok.className = ok ? 'ok' : 'bad';
    H.hp.textContent = S.perilune ? `${nf0.format(S.perilune.altKm)} km` : '—'; H.hr.textContent = S.returnPerigee ? `${nf0.format(S.returnPerigee.altKm)} km` : '—';
    H.t.textContent = `${S.perilune ? nf2.format(S.perilune.tDays) : '—'} gün · ${S.returnPerigee ? nf2.format(S.returnPerigee.tDays) : '—'} gün`; H.jc.textContent = S.jacobiDrift.toExponential(1);
    const rf = SC.refined; H.cor.textContent = rf.length ? `${rf.length} çözüm · ΔV ${nf3.format(Math.min(...rf.map(c => c.dv)))}–${nf3.format(Math.max(...rf.map(c => c.dv)))} km/s, θ₀ ${nf1.format(Math.min(...rf.map(c => c.th)))}–${nf1.format(Math.max(...rf.map(c => c.th)))}°` : 'yok'; H.best.textContent = SC.best ? `${nf3.format(SC.best.dv)} km/s, ${nf1.format(SC.best.th)}° → h_p ${nf0.format(SC.best.hp)} km, dönüş ${nf0.format(SC.best.hr)} km` : '—';
  }
  let dpr = 1;
  function frame(cv, title) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh); ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(title, 10, 13); return { ctx, W, Hh }; }
  function drawRot() {
    const f = frame(plots.rot, 'dönen çerçeve (Dünya–Ay sabit) · altın: yörünge · ● perilune · ○ dönüş perigee'), { ctx, W, Hh } = f;
    const ext = 1.35, sc = Math.min(W, Hh) / 2 / ext * .9, X = x => W / 2 + (x - .5) * sc, Y = y => Hh / 2 - y * sc + 6;
    ctx.fillStyle = '#3d6fa8'; ctx.beginPath(); ctx.arc(X(-MU), Y(0), Math.max(4, R_EARTH * sc), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a9a49b'; ctx.beginPath(); ctx.arc(X(1 - MU), Y(0), Math.max(3, R_MOON * sc), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(X(-MU), Y(0), 1 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.5; ctx.beginPath(); S.states.forEach((s, i) => i ? ctx.lineTo(X(s[0]), Y(s[1])) : ctx.moveTo(X(s[0]), Y(s[1]))); ctx.stroke();
    if (S.perilune) { const s = S.states[S.perilune.i]; ctx.fillStyle = P.data2; ctx.beginPath(); ctx.arc(X(s[0]), Y(s[1]), 4, 0, Math.PI * 2); ctx.fill(); }
    if (S.returnPerigee) { const s = S.states[S.returnPerigee.i]; ctx.strokeStyle = '#8fd39a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(s[0]), Y(s[1]), 5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = P.muted; ctx.font = '10px Inter, sans-serif'; ctx.fillText('Dünya', X(-MU) + 8, Y(0) + 14); ctx.fillText('Ay', X(1 - MU) + 6, Y(0) + 14);
  }
  function drawIn() {
    const f = frame(plots.in, 'eylemsiz çerçeve (Dünya-merkezli) · Ay: kalkışta ○, perilune anında ●'), { ctx, W, Hh } = f;
    const pts = S.inertial.map((p, i) => { const s = S.states[i]; const t = S.times[i]; const ex = -MU * Math.cos(t), ey = -MU * Math.sin(t); return [p[0] - ex, p[1] - ey]; });   // Dünya-merkezli
    const ext = 1.3, sc = Math.min(W, Hh) / 2 / ext * .9, X = x => W / 2 + x * sc * .8, Y = y => Hh / 2 - y * sc * .8 + 6;
    ctx.fillStyle = '#3d6fa8'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(4, R_EARTH * sc * .8), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(X(0), Y(0), sc * .8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
    const moonAt = t => [Math.cos(t), Math.sin(t)]; const m0 = moonAt(0); ctx.strokeStyle = '#a9a49b'; ctx.beginPath(); ctx.arc(X(m0[0]), Y(m0[1]), 5, 0, Math.PI * 2); ctx.stroke();
    if (S.perilune) { const mp = moonAt(S.times[S.perilune.i]); ctx.fillStyle = '#a9a49b'; ctx.beginPath(); ctx.arc(X(mp[0]), Y(mp[1]), 5, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawMap() {
    const f = frame(plots.map, `tarama: yatay θ₀ (${SC.thRange[0]}–${SC.thRange[1]}°), düşey ΔV_TLI (${SC.dvRange[0]}–${SC.dvRange[1]} km/s) · renk: dönüş perigee (yeşil ≈ hedef ${SC.hrTarget} km) · gri: Ay'a ulaşmaz · kırmızı: Ay'a çarpar · ● bisection çözümleri`), { ctx, W, Hh } = f;
    const pad = { l: 56, r: 12, t: 22, b: 22 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b, cw = pw / SC.nTh, ch = ph / SC.nDv;
    for (const c of SC.cells) { const a = Math.round((c.dv - SC.dvRange[0]) / (SC.dvRange[1] - SC.dvRange[0]) * (SC.nDv - 1)), b = Math.round((c.th - SC.thRange[0]) / (SC.thRange[1] - SC.thRange[0]) * (SC.nTh - 1)); const x = pad.l + b * cw, y = pad.t + ph - (a + 1) * ch;
      let col; if (!Number.isFinite(c.hp) || c.hp > 20000) col = 'rgba(255,255,255,.06)'; else if (c.hp < 0 || c.hp < SC.hpMin) col = 'rgba(215,143,108,.7)'; else { const d = Math.abs(c.hr - SC.hrTarget); col = d < 120 ? '#8fd39a' : d < 1000 ? 'rgba(143,211,154,.45)' : d < 10000 ? 'rgba(143,184,221,.35)' : 'rgba(143,184,221,.12)'; }
      ctx.fillStyle = col; ctx.fillRect(x + .5, y + .5, cw - 1, ch - 1); }
    ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; for (let a = 0; a < SC.nDv; a += Math.max(1, Math.floor(SC.nDv / 5))) ctx.fillText(nf3.format(SC.dvRange[0] + (SC.dvRange[1] - SC.dvRange[0]) * a / (SC.nDv - 1)), pad.l - 4, pad.t + ph - (a + .5) * ch + 3); ctx.textAlign = 'center'; for (let b = 0; b < SC.nTh; b += Math.max(1, Math.floor(SC.nTh / 6))) ctx.fillText(`${nf0.format(SC.thRange[0] + (SC.thRange[1] - SC.thRange[0]) * b / (SC.nTh - 1))}°`, pad.l + (b + .5) * cw, Hh - 6); ctx.textAlign = 'left';
    for (const r of SC.refined) { const xr = pad.l + (r.th - SC.thRange[0]) / (SC.thRange[1] - SC.thRange[0]) * pw, yr = pad.t + ph - (r.dv - SC.dvRange[0]) / (SC.dvRange[1] - SC.dvRange[0]) * ph; ctx.fillStyle = '#8fd39a'; ctx.beginPath(); ctx.arc(xr, yr, 3, 0, Math.PI * 2); ctx.fill(); }
    const xs = pad.l + (cfg.theta0 - SC.thRange[0]) / (SC.thRange[1] - SC.thRange[0]) * pw, ys = pad.t + ph - (cfg.dvKmS - SC.dvRange[0]) / (SC.dvRange[1] - SC.dvRange[0]) * ph; ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xs, ys, 6, 0, Math.PI * 2); ctx.stroke();
  }
  function draw() { if (!S) return; drawRot(); drawIn(); drawMap(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  rebuild(); resize();
  return { get sim() { return S; }, get scan() { return SC; }, get config() { return { ...cfg }; }, set(c) { cfg = { ...cfg, ...c }; rebuild(); draw(); }, dispose() { ro.disconnect(); figure.remove(); } };
}
