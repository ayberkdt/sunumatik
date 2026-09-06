/* entry-dispersion.mjs — Giriş Dağılımı (Monte Carlo) sahnesi (entry_dispersion). 2B tuval, THREE gerekmez.

   Sol: yükseklik–menzil düzleminde yörünge yelpazesi (ilk N örnek + nominal vurgulu; atlama/kaçış kırmızı) ve
   iniş noktaları. Sağ: (1) menzil histogramı (p05/p50/p95, ±3σ, nominal), (2) duyarlılık çubukları (her sapmanın
   σ_s payı, RSS vs Monte Carlo), (3) menzil–γ saçılımı (doğrusallık). HUD: σ_s, 3σ menzil, p05–p95, tepe g/ısı yükü
   istatistikleri, atlama sayısı, doğrusallık oranı. Model: dispersion-model.mjs → reentry_corridor/reentry-model.mjs.

   API: const ed = await mountDispersion(host, { scenario, n, seed, sigmas }); ed.set({...}) · ed.result · ed.dispose() */

import { runDispersion, SCENARIOS, PARAMS } from './dispersion-model.mjs';
import { palette, backdrop, polyline, marker, label, title, tag, arrow, Entrance, reveal, staticMode, rgba, starfield, glow, band } from '../core/lab-scene.mjs';

export async function mountDispersion(host, options = {}) {
  if (!host) throw new Error('mountDispersion bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'ed';
  figure.innerHTML = `
    <style>
      .ed{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .ed canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .ed__cell{position:relative;min-height:0;min-width:0;}
      .ed__left{display:grid;grid-template-rows:minmax(0,1fr) auto;min-width:0;min-height:0;}
      .ed__hud{padding:12px 16px 10px;border-top:1px solid var(--lab-rule,#3a3c42);}
      .ed__plots{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));border-left:1px solid var(--color-rule,#3a3c42);min-width:0;min-height:0;} .ed__plots .ed__cell{border-bottom:1px solid var(--color-rule,#3a3c42);} .ed__plots .ed__cell:last-child{border-bottom:0;}
    </style>
    <div class="ed__left">
      <div class="ed__cell" data-lab-reveal="fade"><canvas class="p" data-plot="fan" aria-label="Yörünge yelpazesi"></canvas><div class="lab-top" data-top></div></div>
      <div class="ed__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">σ_s Monte Carlo</span><span class="v hi" data-h="sig">—</span></div>
          <div><span class="k">3σ menzil</span><span class="v hi" data-h="s3">—</span></div>
          <div><span class="k">Doğrusallık RSS/MC</span><span class="v" data-h="lin">—</span></div>
          <div><span class="k">Atlama / kaçış</span><span class="v" data-h="skip">—</span></div>
        </div>
        <dl>
          <dt>Nominal menzil</dt><dd data-h="nom">—</dd><dt>Örnek</dt><dd data-h="n">—</dd>
          <dt>σ_s (doğrusal RSS)</dt><dd data-h="rss">—</dd><dt>p05 – p95</dt><dd data-h="p">—</dd>
          <dt>Tepe g</dt><dd data-h="g">—</dd><dt>Isı yükü</dt><dd data-h="q">—</dd>
        </dl>
        <div class="lab-legend" data-legend></div>
      </div>
    </div>
    <div class="ed__plots">
      <div class="ed__cell" data-lab-reveal="fade"><canvas class="p" data-plot="hist" aria-label="Menzil histogramı"></canvas></div>
      <div class="ed__cell" data-lab-reveal="fade"><canvas class="p" data-plot="sens" aria-label="Duyarlılık payları"></canvas></div>
      <div class="ed__cell" data-lab-reveal="fade"><canvas class="p" data-plot="scatter" aria-label="Menzil–γ saçılımı"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const topEl = figure.querySelector('[data-top]');
  const P = palette(figure); const legendEl = figure.querySelector('[data-legend]'); if (legendEl) legendEl.innerHTML = `<span><i style="background:${P.data1}"></i>örnek yörüngeler · iniş noktaları</span><span><i style="background:${P.accent}"></i>nominal</span><span><i style="background:${P.data2}"></i>atlama / kaçış</span>`;
  const entrance = new Entrance({ frame: { at: 0, dur: .4 }, fan: { at: .2, dur: 1.4 }, marks: { at: 1.3, dur: .5 } }, { onFrame: () => draw() });
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let cfg = { scenario: options.scenario ?? 'leoNominal', n: options.n ?? 200, seed: options.seed ?? 20260906, sigmas: options.sigmas ?? null }, R = null;
  function rebuild() { R = runDispersion(cfg.scenario, { n: cfg.n, seed: cfg.seed, sigmas: cfg.sigmas }); writeHud(); }
  function writeHud() {
    const s = R.stats.s, g = R.stats.peakG, q = R.stats.Q;
    H.nom.textContent = `${nf1.format(R.nominal.s)} km`; H.n.textContent = `${R.runs.length} (tohum ${R.cfg.seed})`;
    H.sig.innerHTML = s ? `${nf2.format(s.std)}<span class="u">km</span>` : '—'; H.rss.textContent = `${nf2.format(R.rssSigma)} km`; H.s3.innerHTML = s ? `±${nf1.format(3 * s.std)}<span class="u">km</span>` : '—'; H.p.textContent = s ? `${nf1.format(s.p05)} – ${nf1.format(s.p95)} km` : '—';
    H.g.textContent = g ? `${nf2.format(g.mean)} ± ${nf2.format(g.std)} g (maks ${nf2.format(g.max)})` : '—'; H.q.textContent = q ? `${nf1.format(q.mean)} ± ${nf1.format(q.std)} MJ/m²` : '—';
    H.skip.textContent = `${R.skipouts} / ${R.runs.length}`; H.skip.className = R.skipouts ? 'v bad' : 'v ok'; H.lin.textContent = Number.isFinite(R.linearity) ? nf2.format(R.linearity) : '—'; H.lin.className = Number.isFinite(R.linearity) && Math.abs(R.linearity - 1) < .3 ? 'v ok' : 'v bad';
    const sg = R.cfg.sigmas; topEl.textContent = `${SCENARIOS[cfg.scenario].label} · ${R.vehicle.label} · γ ${R.cfg.entry.gammaEntry}°, v ${nf0.format(R.cfg.entry.vEntry)} m/s · 1σ sapmalar: γ ${sg.gamma}°, v ${sg.v} m/s, ρ ${nf0.format(sg.rhoScale * 100)} %, L/D ${nf0.format(sg.ld * 100)} %, kütle ${nf0.format(sg.mass * 100)} %, yatış ${sg.bank}°`;
  }
  let dpr = 1;
  function frame(cv, text) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas }); title(ctx, text, 12, 15, P); const pad = { l: 50, r: 12, t: 20, b: 18 }; return { ctx, W, Hh, pad, pw: W - pad.l - pad.r, ph: Hh - pad.t - pad.b }; }
  function drawFan() {
    const f = frame(plots.fan, ''), { ctx, pad, pw, ph, Hh } = f; const pF = entrance.progress('fan'), pM = entrance.progress('marks'); const trajs = R.runs.filter(r => r.samples); const sMax = Math.max(R.nominal.s, ...R.runs.map(r => r.s)) * 1.05, hMax = 125;
    const X = s => pad.l + s / sMax * pw, Y = h => pad.t + ph - h / hMax * ph;
    /* gökyüzü: uzaydan (üst) atmosfere (alt) gradyan; katmanlar; Kármán çizgisi; yer */
    { ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip(); const gS = ctx.createLinearGradient(0, Y(hMax), 0, Y(0)); gS.addColorStop(0, 'rgba(6,8,16,0)'); gS.addColorStop(.55, 'rgba(20,40,80,.35)'); gS.addColorStop(.85, 'rgba(60,110,170,.55)'); gS.addColorStop(1, 'rgba(120,170,220,.7)'); ctx.fillStyle = gS; ctx.fillRect(pad.l, pad.t, pw, ph); starfield(ctx, pw, Y(80) - pad.t, { seed: 4, n: 60, alpha: .4 }); ctx.restore();
      for (const [h0, h1, name] of [[0, 12, 'troposfer'], [12, 50, 'stratosfer'], [50, 85, 'mezosfer'], [85, 125, 'termosfer']]) { ctx.fillStyle = 'rgba(255,255,255,.025)'; if (name === 'stratosfer' || name === 'termosfer') ctx.fillRect(pad.l, Y(h1), pw, Y(h0) - Y(h1)); label(ctx, `${name} · ${h1} km`, pad.l + pw - 6, Y(h1) + 11, P, { align: 'right', mono: false, size: 9.5, color: 'rgba(255,255,255,.35)' }); }
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(pad.l, Y(100)); ctx.lineTo(pad.l + pw, Y(100)); ctx.stroke(); ctx.setLineDash([]); label(ctx, 'Kármán çizgisi 100 km', pad.l + 6, Y(100) - 4, P, { mono: false, size: 9.5, color: 'rgba(255,255,255,.4)' });
      const gG = ctx.createLinearGradient(0, Y(0) - 6, 0, Y(0) + 8); gG.addColorStop(0, 'rgba(80,70,50,0)'); gG.addColorStop(1, 'rgba(120,100,70,.5)'); ctx.fillStyle = gG; ctx.fillRect(pad.l, Y(0) - 6, pw, 14); }
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; for (const h of [0, 25, 50, 75, 100, 120]) { ctx.beginPath(); ctx.moveTo(pad.l, Y(h)); ctx.lineTo(pad.l + pw, Y(h)); ctx.stroke(); ctx.fillText(`${h} km`, pad.l - 4, Y(h) + 3); } ctx.textAlign = 'center'; const step = sMax > 3000 ? 500 : sMax > 1200 ? 250 : 100; for (let s = 0; s <= sMax; s += step) ctx.fillText(`${s}`, X(s), Hh - 5); ctx.textAlign = 'left'; ctx.fillText('menzil (km)', pad.l + pw - 70, Hh - 5);
    /* kaskad: yörüngeler sırayla çizilir (her biri kısmi ilerlemeyle), nominal en son ve kalın */
    trajs.forEach((r, j) => { const pr = Math.min(1, Math.max(0, pF * (trajs.length + 6) / trajs.length - j / trajs.length * 1.0)); if (pr <= 0) return; polyline(ctx, r.samples.map(p => [X(p.s / 1000), Y(p.h / 1000)]), { progress: pr, color: r.outcome === 'landed' ? P.data1 : P.data2, alpha: r.outcome === 'landed' ? .32 : .85, width: 1 }); });
    polyline(ctx, R.nominal.samples.map(p => [X(p.s / 1000), Y(p.h / 1000)]), { progress: pF, color: P.accent, width: 2.2 });
    if (pM > 0) { const st = R.stats.s; if (st) { /* iniş bölgesi: p05–p95 bandı ve ±3σ sınırları yerde */ ctx.save(); ctx.globalAlpha = pM; const gz = ctx.createLinearGradient(0, Y(14), 0, Y(0)); gz.addColorStop(0, rgba(P.data1, 0)); gz.addColorStop(1, rgba(P.data1, .35)); ctx.fillStyle = gz; ctx.fillRect(X(st.p05), Y(14), X(st.p95) - X(st.p05), Y(0) - Y(14)); ctx.strokeStyle = rgba(P.data1, .7); ctx.setLineDash([2, 3]); for (const v of [st.mean - 3 * st.std, st.mean + 3 * st.std]) { ctx.beginPath(); ctx.moveTo(X(v), Y(18)); ctx.lineTo(X(v), Y(0)); ctx.stroke(); } ctx.setLineDash([]); ctx.restore(); label(ctx, `p05–p95 · ±3σ ${nf0.format(3 * st.std)} km`, X(st.p95) + 6, Y(6), P, { size: 9.5, color: P.data1 }); }
      ctx.save(); ctx.globalAlpha = pM; for (const r of R.runs) if (r.outcome === 'landed') { ctx.fillStyle = rgba(P.data1, .7); ctx.fillRect(X(r.s) - 1, Y(10) - 1, 2, 2); } ctx.restore(); glow(ctx, X(R.nominal.s), Y(10), 14, P.accent, .55 * pM); marker(ctx, X(R.nominal.s), Y(10), 4 * pM, P.accent, { alpha: pM }); }
    title(ctx, `yükseklik–menzil · ${trajs.length} örnek yörünge · iniş noktaları 10 km'de`, pad.l, Hh - 26, P);
  }
  function drawHist() {
    const f = frame(plots.hist, 'menzil histogramı — p05 / p50 / p95 (kesikli), ±3σ (mavi), nominal (altın)'), { ctx, pad, pw, ph, Hh } = f; const s = R.stats.s; if (!s) return;
    const vals = R.runs.filter(r => r.outcome === 'landed').map(r => r.s), lo = Math.min(s.mean - 3.5 * s.std, s.min), hi = Math.max(s.mean + 3.5 * s.std, s.max), nb = 30, bins = new Array(nb).fill(0); for (const v of vals) bins[Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * nb)))]++;
    const bmax = Math.max(...bins) || 1, X = v => pad.l + (v - lo) / (hi - lo) * pw, Y = c => pad.t + ph - c / bmax * ph * .9;
    ctx.fillStyle = 'rgba(143,184,221,.55)'; bins.forEach((c, i) => { const x0 = pad.l + i / nb * pw; ctx.fillRect(x0 + 1, Y(c), pw / nb - 2, pad.t + ph - Y(c)); });
    const vline = (v, color, dash, label) => { ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(X(v), pad.t); ctx.lineTo(X(v), pad.t + ph); ctx.stroke(); ctx.setLineDash([]); if (label) { ctx.fillStyle = color; ctx.font = '9.5px ui-monospace, monospace'; ctx.fillText(label, X(v) + 3, pad.t + 10); } };
    vline(s.p05, P.muted, [3, 3], 'p05'); vline(s.p50, P.muted, [3, 3], 'p50'); vline(s.p95, P.muted, [3, 3], 'p95'); vline(s.mean - 3 * s.std, P.data1, [], '−3σ'); vline(s.mean + 3 * s.std, P.data1, [], '+3σ'); vline(R.nominal.s, P.accent, [], 'nominal');
    ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center'; for (let k = 0; k <= 4; k++) ctx.fillText(nf0.format(lo + (hi - lo) * k / 4), pad.l + pw * k / 4, Hh - 5); ctx.textAlign = 'left';
  }
  function drawSens() {
    const f = frame(plots.sens, `σ_s payları (doğrusal): RSS ${nf2.format(R.rssSigma)} km vs Monte Carlo ${R.stats.s ? nf2.format(R.stats.s.std) : '—'} km — çubuk: |∂s/∂x·σ_x|`), { ctx, pad, pw, ph } = f;
    const items = R.sens.filter(x => x.sigma), maxC = Math.max(...items.map(x => Math.abs(x.contrib)), 1e-9), bh = Math.min(22, ph / Math.max(1, items.length) - 4);
    items.forEach((x, i) => { const y = pad.t + 4 + i * (bh + 4), w = Math.abs(x.contrib) / maxC * (pw - 250); ctx.fillStyle = x.contrib >= 0 ? P.data1 : P.data2; ctx.fillRect(pad.l + 70, y, w, bh); ctx.fillStyle = P.ink; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(x.label, pad.l + 64, y + bh * .72); ctx.textAlign = 'left'; ctx.font = '9.5px ui-monospace, monospace'; ctx.fillStyle = P.muted; ctx.fillText(`${x.contrib >= 0 ? '+' : '−'}${nf1.format(Math.abs(x.contrib))} km (${nf0.format(x.share * 100)} %) · ∂s/∂x ${nf1.format(x.dsdx)} km/${x.unit || 'birim'}`, pad.l + 74 + w, y + bh * .72); });
  }
  function drawScatter() {
    const f = frame(plots.scatter, 'menzil – γ sapması saçılımı (doğrusallık: eğim ∂s/∂γ, kesikli)'), { ctx, pad, pw, ph, Hh } = f; const pts = R.runs.filter(r => r.outcome === 'landed'); if (!pts.length) return;
    const gx = pts.map(r => r.dev.gamma), gmin = Math.min(...gx, -1e-6), gmax = Math.max(...gx, 1e-6), smin = Math.min(...pts.map(r => r.s)), smax = Math.max(...pts.map(r => r.s)); const X = v => pad.l + (v - gmin) / (gmax - gmin) * pw, Y = v => pad.t + ph - (v - smin) / Math.max(1e-9, smax - smin) * ph;
    ctx.fillStyle = 'rgba(143,184,221,.7)'; for (const r of pts) ctx.fillRect(X(r.dev.gamma) - 1.5, Y(r.s) - 1.5, 3, 3);
    const sg = R.sens.find(x => x.key === 'gamma'); if (sg && sg.sigma) { ctx.strokeStyle = P.accent; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(gmin), Y(R.nominal.s + sg.dsdx * gmin)); ctx.lineTo(X(gmax), Y(R.nominal.s + sg.dsdx * gmax)); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(`Δγ ${nf2.format(gmin)}°`, X(gmin) + 24, Hh - 5); ctx.fillText(`Δγ ${nf2.format(gmax)}°`, X(gmax) - 24, Hh - 5); ctx.textAlign = 'right'; ctx.fillText(nf0.format(smax), pad.l - 4, pad.t + 8); ctx.fillText(nf0.format(smin), pad.l - 4, pad.t + ph); ctx.textAlign = 'left';
  }
  function draw() { if (!R) return; drawFan(); drawHist(); drawSens(); drawScatter(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure); rebuild(); resize(); entrance.start();
  return { replay() { entrance.start(); }, get result() { return R; }, get config() { return { ...cfg }; }, scenarios: SCENARIOS, params: PARAMS, set(c) { cfg = { ...cfg, ...c }; rebuild(); draw(); }, dispose() { ro.disconnect(); figure.remove(); } };
}
