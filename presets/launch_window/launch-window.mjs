/* launch-window.mjs — Fırlatma Penceresi sahnesi (launch_window). 2B tuval, THREE gerekmez.

   Sol: saha merkezli azimut pusulası (menzil güvenliği sektörü, eylemsiz ve dönme-düzeltmeli azimutlar, Dünya dönme
   vektörü) + gün çizelgesi (iki fırsat UTC, pencere genişliği). Sağ: kalkış gecikmesi → düzlem değişimi ΔV eğrisi
   (bütçe çizgisi, pencere) ve HUD. Model: launch-window-model.mjs (küresel trigonometri, Vallado 6.4). */

import { analyze, SITES, TARGETS } from './launch-window-model.mjs';

export async function mountLaunchWindow(host, options = {}) {
  if (!host) throw new Error('mountLaunchWindow bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'lw';
  figure.innerHTML = `
    <style>
      .lw{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,10fr) minmax(0,10fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .lw canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .lw__cell{position:relative;min-height:0;min-width:0;}
      .lw__left{display:grid;grid-template-rows:minmax(0,3fr) minmax(0,1fr);min-width:0;min-height:0;} .lw__left .lw__cell:first-child{border-bottom:1px solid var(--color-rule,#3a3c42);}
      .lw__right{display:grid;grid-template-rows:minmax(0,1fr) auto;border-left:1px solid var(--color-rule,#3a3c42);min-width:0;min-height:0;}
      .lw__hud{padding:8px 12px;border-top:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .lw__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:1px 10px;} .lw__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .lw__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:11.5px;color:var(--color-ink,#e9e4d8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .lw__hud dd.hi{color:var(--color-accent,#d9b877);} .lw__hud dd.bad{color:var(--color-data-2,#d78f6c);}
    </style>
    <div class="lw__left"><div class="lw__cell"><canvas class="p" data-plot="compass" aria-label="Azimut pusulası"></canvas></div><div class="lw__cell"><canvas class="p" data-plot="day" aria-label="Gün çizelgesi"></canvas></div></div>
    <div class="lw__right">
      <div class="lw__cell"><canvas class="p" data-plot="penalty" aria-label="Düzlem değişimi cezası"></canvas></div>
      <div class="lw__hud" role="status"><dl>
        <dt>Saha · hedef</dt><dd data-h="st">—</dd><dt>Uygunluk</dt><dd data-h="feas">—</dd>
        <dt>Eylemsiz azimut ↑ / ↓</dt><dd data-h="bi" class="hi">—</dd><dt>Dönme-düzeltmeli azimut</dt><dd data-h="br" class="hi">—</dd>
        <dt>Dönme tasarrufu</dt><dd data-h="sav">—</dd><dt>Menzil güvenliği</dt><dd data-h="rs">—</dd>
        <dt>Fırsatlar (UTC)</dt><dd data-h="utc" class="hi">—</dd><dt>LST ↑ / ↓</dt><dd data-h="lst">—</dd>
        <dt>Pencere (bütçe)</dt><dd data-h="win" class="hi">—</dd><dt>5 dk gecikme cezası</dt><dd data-h="p5">—</dd>
      </dl></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtH = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; };
  let cfg = { site: options.site ?? 'ksc', target: options.target ?? 'iss', raan: options.raan ?? 0, doy: options.doy ?? 80, dvBudget: options.dvBudget ?? .1 }, A = null;
  function rebuild() { A = analyze(cfg); writeHud(); }
  function writeHud() {
    H.st.textContent = `${A.site.label} (${nf1.format(A.site.lat)}°) · ${A.target.label}`;
    if (!A.az.feasible) { H.feas.textContent = `çözüm yok — ${A.az.reason} (min i = ${nf1.format(A.az.minInc)}°): dogleg gerekir`; H.feas.className = 'bad'; for (const k of ['bi', 'br', 'sav', 'rs', 'utc', 'lst', 'win', 'p5']) H[k].textContent = '—'; return; }
    H.feas.textContent = 'doğrudan çıkış mümkün'; H.feas.className = '';
    H.bi.textContent = `${nf1.format(A.az.betaAsc)}° / ${nf1.format(A.az.betaDesc)}°`; H.br.textContent = `${nf1.format(A.az.rotAsc.beta)}° / ${nf1.format(A.az.rotDesc.beta)}°`;
    H.sav.textContent = `${nf0.format(A.az.rotAsc.saving * 1000)} / ${nf0.format(A.az.rotDesc.saving * 1000)} m/s (v_eq ${nf0.format(A.az.vEq * 1000)} m/s)`;
    H.rs.textContent = `↑ ${A.ascAllowed ? 'izinli' : 'YASAK'} · ↓ ${A.descAllowed ? 'izinli' : 'YASAK'} (${A.site.azMin}°–${A.site.azMax}°)`; H.rs.className = A.ascAllowed || A.descAllowed ? '' : 'bad';
    H.utc.textContent = `${fmtH(A.opp.asc.utcHours)} ↑ · ${fmtH(A.opp.desc.utcHours)} ↓`; H.lst.textContent = `${nf1.format(A.opp.asc.lst)}° / ${nf1.format(A.opp.desc.lst)}°`;
    H.win.textContent = `±${nf1.format(A.half / 60)} dk (${nf0.format(A.dvBudget * 1000)} m/s)`; const p5 = A.curve.find(c => Math.abs(c.dt - 300) < 40) ?? A.curve[65]; H.p5.textContent = `${nf0.format(p5.dv * 1000)} m/s (düzlem ${nf2.format(p5.planeDeg)}°)`;
  }
  let dpr = 1;
  function frame(cv, title) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh); ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(title, 10, 13); return { ctx, W, Hh }; }
  function drawCompass() {
    const f = frame(plots.compass, `${A.site.label}: azimut pusulası — sektör: menzil güvenliği · mavi: eylemsiz β · altın: dönme-düzeltmeli (roketin uçtuğu) β · turuncu ok: Dünya dönmesi`), { ctx, W, Hh } = f;
    const cx = W / 2, cy = Hh / 2 + 6, R0 = Math.min(W, Hh) / 2 - 40, ang = a => (a - 90) * Math.PI / 180, pt = (a, r) => [cx + r * Math.cos(ang(a)), cy + r * Math.sin(ang(a))];
    ctx.fillStyle = 'rgba(143,211,154,.12)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R0, ang(A.site.azMin), ang(A.site.azMax)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let a = 0; a < 360; a += 30) { const [x, y] = pt(a, R0); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; const [lx, ly] = pt(a, R0 + 14); ctx.fillText(a === 0 ? 'K' : a === 90 ? 'D' : a === 180 ? 'G' : a === 270 ? 'B' : `${a}°`, lx, ly + 4); }
    ctx.textAlign = 'left';
    const arrow = (a, r, color, w, label) => { const [x, y] = pt(a, r); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); const th = ang(a); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9 * Math.cos(th - .4), y - 9 * Math.sin(th - .4)); ctx.lineTo(x - 9 * Math.cos(th + .4), y - 9 * Math.sin(th + .4)); ctx.closePath(); ctx.fill(); if (label) { ctx.font = '600 10.5px Inter, sans-serif'; ctx.fillText(label, x + 6, y); } ctx.lineWidth = 1; };
    if (A.az.feasible) { arrow(A.az.betaAsc, R0 * .78, P.data1, 1.5, `β_i↑ ${nf1.format(A.az.betaAsc)}°`); arrow(A.az.betaDesc, R0 * .78, P.data1, 1.5, `β_i↓ ${nf1.format(A.az.betaDesc)}°`); arrow(A.az.rotAsc.beta, R0 * .95, P.accent, 2.4, `β↑ ${nf1.format(A.az.rotAsc.beta)}°`); arrow(A.az.rotDesc.beta, R0 * .95, P.accent, 2.4, `β↓ ${nf1.format(A.az.rotDesc.beta)}°`); arrow(90, R0 * .3, P.data2, 2, `ω_e R cos φ = ${nf0.format(A.az.vEq * 1000)} m/s`); }
    else { ctx.fillStyle = P.data2; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`i = ${A.target.inc}° < φ = ${nf1.format(A.site.lat)}°: doğrudan çıkış yok (dogleg / düzlem değişimi)`, cx, cy); ctx.textAlign = 'left'; }
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawDay() {
    const f = frame(plots.day, `gün çizelgesi (UTC) — iki fırsat: çıkan ↑ ve inen ↓ düğüm geçişi; bant: ±${nf1.format(A.half / 60)} dk pencere (${nf0.format(A.dvBudget * 1000)} m/s bütçe)`), { ctx, W, Hh } = f;
    const pad = 40, pw = W - 2 * pad, y = Hh / 2 + 6, X = h => pad + h / 24 * pw;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + pw, y); ctx.stroke(); ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center'; for (let h = 0; h <= 24; h += 3) { ctx.beginPath(); ctx.moveTo(X(h), y - 4); ctx.lineTo(X(h), y + 4); ctx.stroke(); ctx.fillText(`${String(h).padStart(2, '0')}:00`, X(h), y + 18); }
    if (A.opp.feasible) for (const [o, lab, ok] of [[A.opp.asc, '↑', A.ascAllowed], [A.opp.desc, '↓', A.descAllowed]]) { const w = Math.max(2, A.half / 3600 * 2 / 24 * pw); ctx.fillStyle = ok ? 'rgba(217,184,119,.35)' : 'rgba(215,143,108,.35)'; ctx.fillRect(X(o.utcHours) - w / 2, y - 12, w, 24); ctx.fillStyle = ok ? P.accent : P.data2; ctx.beginPath(); ctx.arc(X(o.utcHours), y, 4, 0, Math.PI * 2); ctx.fill(); ctx.font = '600 10.5px Inter, sans-serif'; ctx.fillText(`${lab} ${fmtH(o.utcHours)}`, X(o.utcHours), y - 18); }
    ctx.textAlign = 'left';
  }
  function drawPenalty() {
    const f = frame(plots.penalty, 'kalkış gecikmesi → düzlem hatası → düzlem değişimi ΔV = 2V sin(θ/2) (beyaz); kesikli: bütçe; gölge: pencere'), { ctx, W, Hh } = f;
    const pad = { l: 56, r: 14, t: 22, b: 22 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b, dvMax = Math.max(...A.curve.map(c => c.dv)) * 1.05 || 1, X = dt => pad.l + (dt + 3600) / 7200 * pw, Y = v => pad.t + ph - v / dvMax * ph;
    ctx.fillStyle = 'rgba(217,184,119,.12)'; ctx.fillRect(X(-A.half), pad.t, X(A.half) - X(-A.half), ph);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; for (let q = 0; q <= 4; q++) { const v = dvMax * q / 4; ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(pad.l + pw, Y(v)); ctx.stroke(); ctx.fillText(`${nf0.format(v * 1000)} m/s`, pad.l - 4, Y(v) + 3); } ctx.textAlign = 'center'; for (let m = -60; m <= 60; m += 20) ctx.fillText(`${m} dk`, X(m * 60), Hh - 6); ctx.textAlign = 'left';
    ctx.strokeStyle = P.data2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Y(A.dvBudget)); ctx.lineTo(pad.l + pw, Y(A.dvBudget)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.beginPath(); A.curve.forEach((c, i) => i ? ctx.lineTo(X(c.dt), Y(c.dv)) : ctx.moveTo(X(c.dt), Y(c.dv))); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = P.accent; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`pencere ±${nf1.format(A.half / 60)} dk · i = ${A.target.inc}°, V = ${nf2.format(A.v)} km/s`, X(A.half) + 6, pad.t + 14);
  }
  function draw() { if (!A) return; drawCompass(); drawDay(); drawPenalty(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  rebuild(); resize();
  return { get analysis() { return A; }, get config() { return { ...cfg }; }, sites: SITES, targets: TARGETS, set(c) { cfg = { ...cfg, ...c }; rebuild(); draw(); }, dispose() { ro.disconnect(); figure.remove(); } };
}
