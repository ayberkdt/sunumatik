/* geo-stationkeeping.mjs — GEO İstasyon Tutma Bütçesi sahnesi (geo_stationkeeping). 2B tuval, THREE gerekmez.

   Sol üst: boylam ivmesi λ̈(λ) ve yıllık ΔV_DB(λ) eğrisi, denge noktaları (kararlı dolu / kararsız boş), seçili boylam
   ve sürüklenme yönü; sol alt: serbest sürüklenme λ(t) (libration). Sağ üst: eğiklik vektörü izi (1 yıl, Ay+Güneş) ve
   ΔV_KG; sağ orta: SRP eksantriklik çemberi; sağ alt: yıllık bütçe çubukları + ömür yakıtı (kimyasal vs elektrikli). HUD.

   API: const gk = await mountGeoSk(host, { lonDeg, years, m0 }); gk.set({...}) · gk.model · gk.dispose() */

import { eastAccel, lonAccel, dvEastWestPerYear, equilibria, librationPeriodYears, driftTrajectory, northSouth, srpEccentricity, budget, COEFF, V_GEO } from './geo-sk-model.mjs';

export async function mountGeoSk(host, options = {}) {
  if (!host) throw new Error('mountGeoSk bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'gk';
  figure.innerHTML = `
    <style>
      .gk{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .gk canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .gk__cell{position:relative;min-height:0;min-width:0;}
      .gk__left{display:grid;grid-template-rows:minmax(0,3fr) minmax(0,2fr) auto;min-width:0;min-height:0;} .gk__left .gk__cell{border-bottom:1px solid var(--color-rule,#3a3c42);}
      .gk__hud{padding:8px 12px;font-size:12px;color:var(--color-muted,#9a938a);}
      .gk__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:1px 10px;} .gk__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .gk__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:11.5px;color:var(--color-ink,#e9e4d8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .gk__hud dd.hi{color:var(--color-accent,#d9b877);}
      .gk__right{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));border-left:1px solid var(--color-rule,#3a3c42);min-width:0;min-height:0;} .gk__right .gk__cell{border-bottom:1px solid var(--color-rule,#3a3c42);} .gk__right .gk__cell:last-child{border-bottom:0;}
    </style>
    <div class="gk__left">
      <div class="gk__cell"><canvas class="p" data-plot="lon" aria-label="Boylam ivmesi ve yıllık ΔV"></canvas></div>
      <div class="gk__cell"><canvas class="p" data-plot="drift" aria-label="Serbest sürüklenme"></canvas></div>
      <div class="gk__hud" role="status"><dl>
        <dt>Boylam</dt><dd data-h="lon" class="hi">—</dd><dt>Kararlı / kararsız</dt><dd data-h="eq">—</dd>
        <dt>ΔV doğu–batı</dt><dd data-h="ew" class="hi">—</dd><dt>ΔV kuzey–güney</dt><dd data-h="ns" class="hi">—</dd>
        <dt>Δi / yıl</dt><dd data-h="di">—</dd><dt>Libration periyodu</dt><dd data-h="lib">—</dd>
        <dt>SRP e_max</dt><dd data-h="e">—</dd><dt>C̄22 · S̄22</dt><dd data-h="c">—</dd>
        <dt>Ömür ΔV</dt><dd data-h="life">—</dd><dt>Yakıt (kimyasal / elektrikli)</dt><dd data-h="prop">—</dd>
      </dl></div>
    </div>
    <div class="gk__right">
      <div class="gk__cell"><canvas class="p" data-plot="inc" aria-label="Eğiklik vektörü"></canvas></div>
      <div class="gk__cell"><canvas class="p" data-plot="ecc" aria-label="Eksantriklik vektörü"></canvas></div>
      <div class="gk__cell"><canvas class="p" data-plot="budget" aria-label="Yıllık bütçe"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  let cfg = { lonDeg: options.lonDeg ?? 42, years: options.years ?? 15, m0: options.m0 ?? 3000 };
  const eq = equilibria(), lib = librationPeriodYears(), ns = northSouth(), srp = srpEccentricity(); let M = null, drift = null;
  function rebuild() { M = budget({ lonDeg: cfg.lonDeg, years: cfg.years, m0: cfg.m0, ns }); drift = driftTrajectory(cfg.lonDeg, Math.min(12, 1.5 * lib)); writeHud(); }
  function writeHud() {
    H.lon.textContent = `${nf1.format(Math.abs(cfg.lonDeg))}° ${cfg.lonDeg >= 0 ? 'D' : 'B'}`; H.eq.textContent = eq.map(e => `${nf1.format(Math.abs(e.lonDeg))}°${e.lonDeg >= 0 ? 'D' : 'B'}${e.stable ? '●' : '○'}`).join(' ');
    H.ew.textContent = `${nf2.format(M.ewPerYear)} m/s/yıl`; H.ns.textContent = `${nf1.format(M.nsPerYear)} m/s/yıl`; H.di.textContent = `${nf3.format(ns.diPerYear)}°`; H.lib.textContent = `${nf1.format(lib)} yıl`;
    H.e.textContent = `${srp.eMax.toExponential(2)} (A/m 0,04)`; H.c.textContent = `${COEFF.C22.toExponential(3)} · ${COEFF.S22.toExponential(3)}`;
    H.life.textContent = `${nf0.format(M.lifetimeDv)} m/s (${cfg.years} yıl)`; H.prop.textContent = `${nf0.format(M.propChem)} / ${nf0.format(M.propEp)} kg (m₀ ${nf0.format(cfg.m0)})`;
  }
  let dpr = 1;
  function frame(cv, title) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh); ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(title, 10, 13); const pad = { l: 52, r: 14, t: 22, b: 20 }; return { ctx, W, Hh, pad, pw: W - pad.l - pad.r, ph: Hh - pad.t - pad.b }; }
  function drawLon() {
    const f = frame(plots.lon, 'yıllık doğu–batı ΔV(λ) [m/s] (beyaz) ve boylam ivmesi λ̈ (mavi, işaretli) — GERÇEK C̄22/S̄22 ile; ● kararlı, ○ kararsız'), { ctx, pad, pw, ph, Hh } = f;
    const n = 361, dv = [], la = []; for (let k = 0; k < n; k++) { const lon = -180 + 360 * k / (n - 1); dv.push(dvEastWestPerYear(lon)); la.push(lonAccel(lon * Math.PI / 180)); }
    const dvMax = Math.max(...dv) * 1.1, laMax = Math.max(...la.map(Math.abs)) * 1.1, X = lon => pad.l + (lon + 180) / 360 * pw, Ydv = v => pad.t + ph - v / dvMax * ph, Yla = v => pad.t + ph / 2 - v / laMax * ph / 2;
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center'; for (let lon = -180; lon <= 180; lon += 30) { ctx.beginPath(); ctx.moveTo(X(lon), pad.t); ctx.lineTo(X(lon), pad.t + ph); ctx.stroke(); ctx.fillText(`${Math.abs(lon)}${lon < 0 ? 'B' : lon > 0 ? 'D' : ''}`, X(lon), Hh - 6); }
    ctx.textAlign = 'right'; for (let q = 0; q <= 4; q++) ctx.fillText(nf2.format(dvMax * q / 4), pad.l - 4, Ydv(dvMax * q / 4) + 3); ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(143,184,221,.3)'; ctx.beginPath(); ctx.moveTo(pad.l, Yla(0)); ctx.lineTo(pad.l + pw, Yla(0)); ctx.stroke();
    ctx.strokeStyle = P.data1; ctx.lineWidth = 1.2; ctx.beginPath(); la.forEach((v, k) => k ? ctx.lineTo(X(-180 + 360 * k / (n - 1)), Yla(v)) : ctx.moveTo(X(-180), Yla(v))); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.beginPath(); dv.forEach((v, k) => k ? ctx.lineTo(X(-180 + 360 * k / (n - 1)), Ydv(v)) : ctx.moveTo(X(-180), Ydv(v))); ctx.stroke();
    for (const e of eq) { ctx.fillStyle = e.stable ? '#8fd39a' : P.data2; ctx.strokeStyle = ctx.fillStyle; ctx.beginPath(); ctx.arc(X(e.lonDeg), Yla(0), 5, 0, Math.PI * 2); e.stable ? ctx.fill() : ctx.stroke(); ctx.font = '600 10px Inter, sans-serif'; ctx.fillText(`${nf1.format(Math.abs(e.lonDeg))}°${e.lonDeg >= 0 ? 'D' : 'B'} ${e.stable ? 'kararlı' : 'kararsız'}`, X(e.lonDeg) + 7, Yla(0) - 8); }
    const x = X(cfg.lonDeg); ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(x, Ydv(dvEastWestPerYear(cfg.lonDeg)), 4.5, 0, Math.PI * 2); ctx.fill();
    const dir = lonAccel(cfg.lonDeg * Math.PI / 180) > 0 ? 1 : -1; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`istasyon ${nf1.format(Math.abs(cfg.lonDeg))}°${cfg.lonDeg >= 0 ? 'D' : 'B'} → ${dir > 0 ? 'doğuya' : 'batıya'} sürüklenir · ${nf2.format(M.ewPerYear)} m/s/yıl`, x + (dir > 0 ? 8 : -8), pad.t + 28); if (dir < 0) { ctx.textAlign = 'right'; ctx.fillText('', x, 0); ctx.textAlign = 'left'; }
  }
  function drawDrift() {
    const f = frame(plots.drift, `serbest sürüklenme λ(t): manevrasız istasyon kararlı nokta çevresinde salınır (libration periyodu ${nf1.format(lib)} yıl)`), { ctx, pad, pw, ph, Hh } = f;
    const T = drift[drift.length - 1].t, lons = drift.map(d => d.lonDeg), lo = Math.min(...lons) - 5, hi = Math.max(...lons) + 5, X = t => pad.l + t / T * pw, Y = v => pad.t + ph - (v - lo) / (hi - lo) * ph;
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; for (let q = 0; q <= 3; q++) { const v = lo + (hi - lo) * q / 3; ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(pad.l + pw, Y(v)); ctx.stroke(); ctx.fillText(`${nf0.format(v)}°`, pad.l - 4, Y(v) + 3); } ctx.textAlign = 'center'; for (let y = 0; y <= T / 31557600; y += 2) ctx.fillText(`${y} yıl`, X(y * 31557600), Hh - 6); ctx.textAlign = 'left';
    for (const e of eq) if (e.lonDeg > lo && e.lonDeg < hi) { ctx.strokeStyle = e.stable ? 'rgba(143,211,154,.5)' : 'rgba(215,143,108,.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(e.lonDeg)); ctx.lineTo(pad.l + pw, Y(e.lonDeg)); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.5; ctx.beginPath(); drift.forEach((d, i) => i ? ctx.lineTo(X(d.t), Y(d.lonDeg)) : ctx.moveTo(X(d.t), Y(d.lonDeg))); ctx.stroke();
  }
  function drawInc() {
    const f = frame(plots.inc, `eğiklik vektörü (i cosΩ, i sinΩ) [°] — 1 yıl Ay + Güneş (RK4): Δi ${nf3.format(ns.diPerYear)}°/yıl → ΔV_KG ${nf1.format(ns.dvPerYear)} m/s/yıl`), { ctx, pad, pw, ph, W, Hh } = f;
    const tr = ns.trace, ext = Math.max(.3, ...tr.map(p => Math.max(Math.abs(p.ix), Math.abs(p.iy)))) * 1.2, sc = Math.min(pw, ph) / 2 / ext, cx = pad.l + pw / 2, cy = pad.t + ph / 2, X = v => cx + v * sc, Y = v => cy - v * sc;
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(pad.l, cy); ctx.lineTo(pad.l + pw, cy); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + ph); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; for (const r of [.25, .5, .75, 1]) { ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = P.muted; ctx.font = '9px ui-monospace, monospace'; ctx.fillText(`${r}°`, X(r) + 2, cy - 2); }
    ctx.strokeStyle = P.data1; ctx.lineWidth = 1.5; ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(X(p.ix), Y(p.iy)) : ctx.moveTo(X(p.ix), Y(p.iy))); ctx.stroke();
    const l = tr[tr.length - 1]; ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(l.ix), Y(l.iy), 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.muted; ctx.font = '10px Inter, sans-serif'; ctx.fillText('sürüklenme yönü ≈ ekliptik kutbuna (Ω ≈ 90°); tutma: yılda Δi kadar ters düğüm manevrası', pad.l, Hh - 6);
  }
  function drawEcc() {
    const f = frame(plots.ecc, `eksantriklik vektörü (e cos ϖ, e sin ϖ) — SRP, A/m 0,04, 1 yıl: e_max ${srp.eMax.toExponential(2)} (doğal çember; kontrol DB manevralarıyla birleştirilir)`), { ctx, pad, pw, ph, Hh } = f;
    const tr = srp.trace, ext = Math.max(1e-4, ...tr.map(p => Math.max(Math.abs(p.ex), Math.abs(p.ey)))) * 1.25, sc = Math.min(pw, ph) / 2 / ext, cx = pad.l + pw / 2, cy = pad.t + ph / 2, X = v => cx + v * sc, Y = v => cy - v * sc;
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(pad.l, cy); ctx.lineTo(pad.l + pw, cy); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + ph); ctx.stroke();
    ctx.strokeStyle = P.data2; ctx.lineWidth = 1.3; ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(X(p.ex), Y(p.ey)) : ctx.moveTo(X(p.ex), Y(p.ey))); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = '9px ui-monospace, monospace'; ctx.fillText(`ölçek ${ext.toExponential(1)}`, pad.l + pw - 70, Hh - 6);
  }
  function drawBudget() {
    const f = frame(plots.budget, `yıllık bütçe [m/s] ve ${cfg.years} yıl ömür yakıtı — m₀ ${nf0.format(cfg.m0)} kg`), { ctx, pad, pw, ph } = f;
    const items = [['doğu–batı', M.ewPerYear, P.ink], ['kuzey–güney', M.nsPerYear, P.data1], ['toplam / yıl', M.totalPerYear, P.accent]]; const mx = Math.max(...items.map(i => i[1])) * 1.15, bh = Math.min(22, ph / 4 - 6);
    items.forEach(([lab, v, col], i) => { const y = pad.t + 6 + i * (bh + 8), w = v / mx * (pw - 150); ctx.fillStyle = col; ctx.fillRect(pad.l + 80, y, w, bh); ctx.fillStyle = P.ink; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(lab, pad.l + 74, y + bh * .72); ctx.textAlign = 'left'; ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = P.muted; ctx.fillText(`${nf1.format(v)} m/s`, pad.l + 86 + w, y + bh * .72); });
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`ömür ΔV ${nf0.format(M.lifetimeDv)} m/s → yakıt: kimyasal (Isp 300 s) ${nf0.format(M.propChem)} kg · elektrikli (Isp 1500 s) ${nf0.format(M.propEp)} kg`, pad.l, pad.t + ph - 4);
  }
  function draw() { if (!M) return; drawLon(); drawDrift(); drawInc(); drawEcc(); drawBudget(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  rebuild(); resize();
  return { get model() { return { budget: M, equilibria: eq, libration: lib, ns, srp, drift }; }, get config() { return { ...cfg }; }, set(c) { cfg = { ...cfg, ...c }; rebuild(); draw(); }, dispose() { ro.disconnect(); figure.remove(); } };
}
