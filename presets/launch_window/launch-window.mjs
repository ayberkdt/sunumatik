/* launch-window.mjs — Fırlatma Penceresi sahnesi (launch_window). 2B tuval, THREE gerekmez.

   Sol: saha merkezli azimut pusulası (menzil güvenliği sektörü, eylemsiz ve dönme-düzeltmeli azimutlar, Dünya dönme
   vektörü) + gün çizelgesi (iki fırsat UTC, pencere genişliği). Sağ: kalkış gecikmesi → düzlem değişimi ΔV eğrisi
   (bütçe çizgisi, pencere) ve HUD. Model: launch-window-model.mjs (küresel trigonometri, Vallado 6.4). */

import { analyze, SITES, TARGETS } from './launch-window-model.mjs';
import { palette, backdrop, polyline, marker, label, title, tag, arrow, Entrance, reveal, staticMode, rgba, starfield, glow, band } from '../core/lab-scene.mjs';

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
      .lw__hud{padding:12px 16px 10px;border-top:1px solid var(--lab-rule,#3a3c42);}
      .lw .lab-hud__hero .v{font-size:17px;}
    </style>
    <div class="lw__left"><div class="lw__cell" data-lab-reveal="fade"><canvas class="p" data-plot="compass" aria-label="Azimut pusulası"></canvas></div><div class="lw__cell" data-lab-reveal="fade"><canvas class="p" data-plot="day" aria-label="Gün çizelgesi"></canvas></div></div>
    <div class="lw__right">
      <div class="lw__cell" data-lab-reveal="fade"><canvas class="p" data-plot="penalty" aria-label="Düzlem değişimi cezası"></canvas></div>
      <div class="lw__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">Azimut ↑ / ↓ (uçulan)</span><span class="v hi" data-h="br">—</span></div>
          <div><span class="k">Fırsatlar (UTC)</span><span class="v hi" data-h="utc">—</span></div>
          <div><span class="k">Pencere</span><span class="v hi" data-h="win">—</span></div>
          <div><span class="k">Uygunluk</span><span class="v" data-h="feas">—</span></div>
        </div>
        <dl>
          <dt>Saha · hedef</dt><dd data-h="st">—</dd><dt>Eylemsiz azimut ↑ / ↓</dt><dd data-h="bi">—</dd>
          <dt>Dönme tasarrufu</dt><dd data-h="sav">—</dd><dt>Menzil güvenliği</dt><dd data-h="rs">—</dd>
          <dt>LST ↑ / ↓</dt><dd data-h="lst">—</dd><dt>5 dk gecikme cezası</dt><dd data-h="p5">—</dd>
        </dl>
        <div class="lab-legend" data-legend></div>
      </div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const P = palette(figure); const legendEl = figure.querySelector('[data-legend]'); if (legendEl) legendEl.innerHTML = `<span><i style="background:${P.accent}"></i>uçulan azimut · fırsat</span><span><i style="background:${P.data1}"></i>eylemsiz azimut</span><span><i style="background:${P.data2}"></i>Dünya dönmesi · bütçe</span><span><i style="background:#8fd39a"></i>menzil güvenliği sektörü</span>`;
  const entrance = new Entrance({ frame: { at: 0, dur: .4 }, sector: { at: .2, dur: .6 }, arrows: { at: .6, dur: .8 }, curve: { at: .5, dur: 1.1 } }, { onFrame: () => draw() });
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtH = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; };
  let cfg = { site: options.site ?? 'ksc', target: options.target ?? 'iss', raan: options.raan ?? 0, doy: options.doy ?? 80, dvBudget: options.dvBudget ?? .1 }, A = null;
  function rebuild() { A = analyze(cfg); writeHud(); }
  function writeHud() {
    H.st.textContent = `${A.site.label} (${nf1.format(A.site.lat)}°) · ${A.target.label}`;
    if (!A.az.feasible) { H.feas.textContent = `dogleg (i ≥ ${nf1.format(A.az.minInc)}°)`; H.feas.className = 'v bad'; for (const k of ['bi', 'br', 'sav', 'rs', 'utc', 'lst', 'win', 'p5']) H[k].textContent = '—'; return; }
    H.feas.textContent = 'doğrudan'; H.feas.className = 'v ok';
    H.bi.textContent = `${nf1.format(A.az.betaAsc)}° / ${nf1.format(A.az.betaDesc)}°`; H.br.textContent = `${nf1.format(A.az.rotAsc.beta)}° / ${nf1.format(A.az.rotDesc.beta)}°`;
    H.sav.textContent = `${nf0.format(A.az.rotAsc.saving * 1000)} / ${nf0.format(A.az.rotDesc.saving * 1000)} m/s (v_eq ${nf0.format(A.az.vEq * 1000)} m/s)`;
    H.rs.textContent = `↑ ${A.ascAllowed ? 'izinli' : 'YASAK'} · ↓ ${A.descAllowed ? 'izinli' : 'YASAK'} (${A.site.azMin}°–${A.site.azMax}°)`; H.rs.className = A.ascAllowed || A.descAllowed ? '' : 'bad';
    H.utc.textContent = `${fmtH(A.opp.asc.utcHours)}↑ ${fmtH(A.opp.desc.utcHours)}↓`; H.lst.textContent = `${nf1.format(A.opp.asc.lst)}° / ${nf1.format(A.opp.desc.lst)}°`;
    H.win.innerHTML = `±${nf1.format(A.half / 60)}<span class="u">dk</span>`; const p5 = A.curve.find(c => Math.abs(c.dt - 300) < 40) ?? A.curve[65]; H.p5.textContent = `${nf0.format(p5.dv * 1000)} m/s (düzlem ${nf2.format(p5.planeDeg)}°)`;
  }
  let dpr = 1;
  function frame(cv, text) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas }); title(ctx, text, 12, 15, P); return { ctx, W, Hh }; }
  function drawCompass() {
    const f = frame(plots.compass, `${A.site.label}: azimut pusulası — sektör: menzil güvenliği · mavi: eylemsiz β · altın: dönme-düzeltmeli (roketin uçtuğu) β · turuncu ok: Dünya dönmesi`), { ctx, W, Hh } = f;
    const cx = W / 2, cy = Hh / 2 + 6, R0 = Math.min(W, Hh) / 2 - 40, ang = a => (a - 90) * Math.PI / 180, pt = (a, r) => [cx + r * Math.cos(ang(a)), cy + r * Math.sin(ang(a))];
    const pA = entrance.progress('arrows'), pSec = entrance.progress('sector');
    /* gökyüzü diski: sahadan yukarı bakış — merkezde açık, ufukta koyu; yıldızlar */ starfield(ctx, W, Hh, { seed: 9, n: 100, alpha: .4 }); { const gS = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0); gS.addColorStop(0, 'rgba(70,105,160,.26)'); gS.addColorStop(.7, 'rgba(50,80,130,.12)'); gS.addColorStop(1, 'rgba(30,50,90,.02)'); ctx.fillStyle = gS; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.fill(); }
    /* hedef düzlemin yer izi: uçulan azimut boyunca geniş yumuşak şerit (sahadan iki yöne) */ if (A.az.feasible) { ctx.save(); ctx.globalAlpha = .13 * pA; ctx.strokeStyle = P.accent; ctx.lineWidth = 16; ctx.lineCap = 'round'; const [ax, ay] = pt(A.az.rotAsc.beta, R0), [bx, by] = pt(A.az.rotAsc.beta + 180, R0); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = `rgba(143,211,154,${.12 * pSec})`; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R0, ang(A.site.azMin), ang(A.site.azMin) + (ang(A.site.azMax) - ang(A.site.azMin) + (ang(A.site.azMax) < ang(A.site.azMin) ? Math.PI * 2 : 0)) * pSec); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let a = 0; a < 360; a += 30) { const [x, y] = pt(a, R0); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; const [lx, ly] = pt(a, R0 + 14); ctx.fillText(a === 0 ? 'K' : a === 90 ? 'D' : a === 180 ? 'G' : a === 270 ? 'B' : `${a}°`, lx, ly + 4); }
    ctx.textAlign = 'left';
    const arrowAt = (a, r, color, w, text) => { const [x, y] = pt(a, r * pA); arrow(ctx, cx, cy, x, y, color, { width: w, head: 9, alpha: pA }); if (text && pA > .8) label(ctx, text, x + 6, y + 4, P, { mono: false, size: 11, color, weight: 600 }); };
    if (A.az.feasible) { arrowAt(A.az.betaAsc, R0 * .78, P.data1, 1.5, `β_i↑ ${nf1.format(A.az.betaAsc)}°`); arrowAt(A.az.betaDesc, R0 * .78, P.data1, 1.5, `β_i↓ ${nf1.format(A.az.betaDesc)}°`); arrowAt(A.az.rotAsc.beta, R0 * .95, P.accent, 2.4, `β↑ ${nf1.format(A.az.rotAsc.beta)}°`); arrowAt(A.az.rotDesc.beta, R0 * .95, P.accent, 2.4, `β↓ ${nf1.format(A.az.rotDesc.beta)}°`); arrowAt(90, R0 * .3, P.data2, 2, `ω_e R cos φ = ${nf0.format(A.az.vEq * 1000)} m/s`); }
    else { ctx.fillStyle = P.data2; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`i = ${A.target.inc}° < φ = ${nf1.format(A.site.lat)}°: doğrudan çıkış yok (dogleg / düzlem değişimi)`, cx, cy); ctx.textAlign = 'left'; }
    glow(ctx, cx, cy, 16, P.ink, .5); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill(); label(ctx, A.site.label, cx + 8, cy - 8, P, { mono: false, size: 10.5, weight: 600, color: P.ink });
  }
  function drawDay() {
    const f = frame(plots.day, `gün çizelgesi (UTC) — iki fırsat: çıkan ↑ ve inen ↓ düğüm geçişi; bant: ±${nf1.format(A.half / 60)} dk pencere (${nf0.format(A.dvBudget * 1000)} m/s bütçe)`), { ctx, W, Hh } = f;
    const pad = 40, pw = W - 2 * pad, y = Hh / 2 + 6, X = h => pad + h / 24 * pw;
    { /* 24 saat şeridi: gece (koyu) – gündüz (açık) döngüsü (yerel öğle ≈ 12:00 + boylam düzeltmesi, gösterim) */ const noon = ((12 - A.site.lon / 15) % 24 + 24) % 24, gD = ctx.createLinearGradient(pad, 0, pad + pw, 0); for (let h = 0; h <= 24; h += 1) { const d = Math.cos((h - noon) / 24 * Math.PI * 2); gD.addColorStop(h / 24, `rgba(120,160,220,${.04 + .14 * Math.max(0, d)})`); } ctx.fillStyle = gD; ctx.fillRect(pad, y - 14, pw, 28); }
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
    band(ctx, A.curve.map(c => [X(c.dt), Y(c.dv)]), [[X(-3600), Y(0)], [X(3600), Y(0)]], P.ink, .07);
    polyline(ctx, A.curve.map(c => [X(c.dt), Y(c.dv)]), { progress: entrance.progress('curve'), color: P.ink, width: 1.7 });
    ctx.fillStyle = P.accent; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`pencere ±${nf1.format(A.half / 60)} dk · i = ${A.target.inc}°, V = ${nf2.format(A.v)} km/s`, X(A.half) + 6, pad.t + 14);
  }
  function draw() { if (!A) return; drawCompass(); drawDay(); drawPenalty(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure); rebuild(); resize(); entrance.start();
  return { replay() { entrance.start(); }, get analysis() { return A; }, get config() { return { ...cfg }; }, sites: SITES, targets: TARGETS, set(c) { cfg = { ...cfg, ...c }; rebuild(); draw(); }, dispose() { ro.disconnect(); figure.remove(); } };
}
