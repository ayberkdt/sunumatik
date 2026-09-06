/* tisserand.mjs — Tisserand Grafiği sahnesi (tisserand_graph). 2B tuval, THREE gerekmez.

   Sol: (r_a, r_p) düzlemi (AU, log-log): her gezegenin sabit-v∞ eğrileri (α taraması), gezegen çizgileri (r_p = a_P,
   r_a = a_P), Dünya rezonans çizgileri (a = a_E (k/m)^{2/3}), seçilen dizinin bacakları (ok: geçişte α değişimi
   eğri boyunca kayış), erişilebilir yay (|Δα| ≤ δ_max). Sağ: güneş-merkezli yörünge görünümü (bacakların elipsleri
   ve gezegen daireleri) + bacak tablosu (v∞ giriş/çıkış, α, δ kullanılan/δ_max, r_p/r_a, periyot).

   API: const tg = await mountTisserand(host, { sequence:'veega', vinf0, hMin, vinfLevels }); tg.set({...}) · tg.plan · tg.dispose() */

import { PLANETS, AU, contour, planSequence, maxTurn, resonances, SEQUENCES, orbitFromVinf } from './tisserand-model.mjs';
import { palette, backdrop, polyline, marker, label, title, tag, Entrance, reveal, staticMode, rgba } from '../core/lab-scene.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountTisserand(host, options = {}) {
  if (!host) throw new Error('mountTisserand bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'tg';
  figure.innerHTML = `
    <style>
      .tg{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .tg canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .tg__cell{position:relative;min-height:0;min-width:0;}
      .tg__side{display:grid;grid-template-rows:minmax(0,1fr) auto;border-left:1px solid var(--color-rule,#3a3c42);min-width:0;min-height:0;}
      .tg__hud{padding:12px 16px 10px;border-top:1px solid var(--lab-rule,#3a3c42);overflow:auto;max-height:62%;}
      .tg__hud table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;} .tg__hud th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;text-align:right;font-weight:600;padding:2px 4px;} .tg__hud th:first-child,.tg__hud td:first-child{text-align:left;}
      .tg__hud td{text-align:right;padding:3px 4px;font-family:var(--font-mono);font-size:11.5px;color:var(--color-ink,#e9e4d8);white-space:nowrap;font-variant-numeric:tabular-nums;} .tg__hud td.bad{color:var(--color-data-2,#d78f6c);} .tg__hud tbody tr{border-top:1px solid var(--lab-rule,#3a3c42);}
      .tg__hud .note{margin-top:6px;font-size:11px;letter-spacing:.03em;}
    </style>
    <div class="tg__cell" data-lab-reveal="fade"><canvas class="p" data-plot="graph" aria-label="Tisserand grafiği"></canvas></div>
    <div class="tg__side">
      <div class="tg__cell" data-lab-reveal="fade"><canvas class="p" data-plot="helio" aria-label="Güneş-merkezli yörüngeler"></canvas></div>
      <div class="tg__hud lab-hud" role="status" data-lab-reveal><div class="lab-hud__hero"><div><span class="k">Kalkış v∞₀</span><span class="v" data-h="v0">—</span></div><div><span class="k">Varış v∞</span><span class="v hi" data-h="vf">—</span></div><div><span class="k">Geçiş sayısı</span><span class="v" data-h="nfly">—</span></div><div><span class="k">Dizi</span><span class="v" data-h="ok">—</span></div></div><table><thead><tr><th>bacak</th><th>v∞ giriş</th><th>α → α′</th><th>|Δα| / δ_max</th><th>r_p / r_a (AU)</th><th>T (yıl)</th><th>v∞ varış</th></tr></thead><tbody data-rows></tbody></table><div class="note" data-note></div></div>
    </div>`;
  host.appendChild(figure);
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const rowsEl = figure.querySelector('[data-rows]'), noteEl = figure.querySelector('[data-note]');
  const P = palette(figure); const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const entrance = new Entrance({ frame: { at: 0, dur: .4 }, contours: { at: .2, dur: 1.2 }, legs: { at: 1.0, dur: 1.6 } }, { onFrame: () => draw() });
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  let cfg = { sequence: options.sequence ?? 'veega', vinf0: options.vinf0 ?? null, hMin: options.hMin ?? 300, vinfLevels: options.vinfLevels ?? [3, 5, 7, 9, 12], planets: options.planets ?? ['venus', 'earth', 'mars', 'jupiter', 'saturn'] };
  let plan = null, contours = {};
  function rebuild() {
    const S = SEQUENCES[cfg.sequence]; plan = planSequence(S.seq, { vinf0: cfg.vinf0 ?? S.vinf0, hMin: cfg.hMin, mode: S.mode, resonanceTargets: S.resonanceTargets || {} });
    contours = {}; for (const p of cfg.planets) contours[p] = cfg.vinfLevels.map(v => ({ vinf: v, pts: contour(p, v).filter(o => !o.hyperbolic && o.rp > 0) }));
    writeTable();
  }
  function writeTable() {
    rowsEl.innerHTML = plan.legs.map((l, i) => `<tr><td>${PLANETS[l.from].label} → ${PLANETS[l.to].label}</td><td>${nf2.format(l.vinf)}</td><td>${nf0.format(l.alpha * 180 / Math.PI)}° → ${l.alphaNew == null ? '—' : nf0.format(l.alphaNew * 180 / Math.PI) + '°'}</td><td class="${l.reachable ? '' : 'bad'}">${l.delta == null ? 'kalkış' : l.reachable ? `${nf1.format(l.used * 180 / Math.PI)}° / ${nf1.format(l.delta * 180 / Math.PI)}°` : `— / ${nf1.format(l.delta * 180 / Math.PI)}° (erişilemez)`}</td><td>${l.orbit ? `${nf2.format(l.orbit.rp / AU)} / ${nf2.format(l.orbit.ra / AU)}` : '—'}</td><td>${l.orbit ? nf2.format(l.orbit.period / 86400 / 365.256) : '—'}</td><td>${l.vinfNext == null ? '—' : nf2.format(l.vinfNext)}</td></tr>`).join('');
    const last = plan.legs[plan.legs.length - 1];
    H.v0.innerHTML = `${nf1.format(plan.legs[0].vinf)}<span class="u">km/s</span>`; H.vf.innerHTML = plan.feasible ? `${nf2.format(plan.final.vinf)}<span class="u">km/s</span>` : '—'; H.nfly.innerHTML = `${Math.max(0, plan.legs.length - 1)}<span class="u">geçiş</span>`; H.ok.textContent = plan.feasible ? 'uygun' : 'uygun değil'; H.ok.className = plan.feasible ? 'v ok' : 'v bad';
    noteEl.textContent = plan.feasible ? `Dizi geometrik olarak erişilebilir (h_min ${cfg.hMin} km). Varış ${PLANETS[plan.final.planet].label}'de v∞ = ${nf2.format(plan.final.vinf)} km/s. Fazlama (gezegenlerin zamanlaması) bakılmadı — Tisserand grafiği nitel tasarım aracıdır.` : `Dizi bu v∞₀ ve h_min ile erişilemez: ${PLANETS[last.from].label} geçişinde gereken pompa açısı değişimi δ_max'ı aşıyor. v∞₀'ı ya da h_min'i değiştirin.`;
  }
  let dpr = 1;
  const legColor = i => [P.accent, '#8fd39a', P.data2, '#c9a0e0', P.data1][i % 5];
  function drawGraph() {
    const cv = plots.graph, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas }); const pCon = entrance.progress('contours'), pLeg = entrance.progress('legs');
    const pad = { l: 54, r: 14, t: 26, b: 34 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b;
    const xlo = Math.log10(.6), xhi = Math.log10(40), ylo = Math.log10(.25), yhi = Math.log10(12);
    const X = ra => pad.l + (Math.log10(ra / AU) - xlo) / (xhi - xlo) * pw, Y = rp => pad.t + ph - (Math.log10(rp / AU) - ylo) / (yhi - ylo) * ph;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('Tisserand grafiği: yatay r_a, düşey r_p (AU, log) · renkli eğriler gezegen sabit-v∞ (km/s) · kütleçekim yardımı eğri boyunca kaydırır · kesikli: Dünya rezonansları', pad.l, 14);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center';
    for (const v of [.7, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30]) { const x = X(v * AU); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.fillStyle = P.muted; ctx.fillText(String(v), x, Hh - 20); }
    ctx.textAlign = 'right'; for (const v of [.3, .5, .7, 1, 1.5, 2, 3, 5, 10]) { const y = Y(v * AU); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.fillText(String(v), pad.l - 4, y + 3); } ctx.textAlign = 'left';
    ctx.fillStyle = P.muted; ctx.fillText('r_a (AU)', pad.l + pw - 44, Hh - 6); ctx.save(); ctx.translate(12, pad.t + 40); ctx.rotate(-Math.PI / 2); ctx.fillText('r_p (AU)', 0, 0); ctx.restore();
    /* r_p ≤ r_a bölgesi: köşegen */
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(Math.pow(10, Math.max(xlo, ylo)) * AU), Y(Math.pow(10, Math.max(xlo, ylo)) * AU)); ctx.lineTo(X(Math.pow(10, Math.min(xhi, yhi)) * AU), Y(Math.pow(10, Math.min(xhi, yhi)) * AU)); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
    /* rezonanslar: a sabit → r_a = 2a − r_p eğrisi */
    for (const r of resonances('earth')) { ctx.strokeStyle = 'rgba(143,184,221,.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); let first = true; for (let k = 0; k <= 80; k++) { const rp = Math.pow(10, ylo + (Math.log10(r.a / AU) - ylo) * k / 80) * AU, ra = 2 * r.a - rp; if (ra < rp) break; first ? ctx.moveTo(X(ra), Y(rp)) : ctx.lineTo(X(ra), Y(rp)); first = false; } ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(143,184,221,.7)'; ctx.font = '9.5px ui-monospace, monospace'; ctx.fillText(r.label, X(2 * r.a - PLANETS.earth.a * .9) + 3, Y(PLANETS.earth.a * .9)); }
    /* gezegen çizgileri ve eğriler */
    for (const p of cfg.planets) { const Pl = PLANETS[p]; ctx.strokeStyle = Pl.color; ctx.globalAlpha = .35; ctx.beginPath(); ctx.moveTo(pad.l, Y(Pl.a)); ctx.lineTo(pad.l + pw, Y(Pl.a)); ctx.moveTo(X(Pl.a), pad.t); ctx.lineTo(X(Pl.a), pad.t + ph); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = Pl.color; ctx.font = '600 10.5px Inter, sans-serif'; ctx.fillText(Pl.label, X(Pl.a) + 4, Y(Pl.a) - 4);
      for (const c of contours[p]) { const cp = []; for (const o of c.pts) { if (o.ra === Infinity || o.rp <= 0) continue; cp.push([X(o.ra), Y(o.rp)]); } polyline(ctx, cp, { progress: pCon, color: Pl.color, width: 1, alpha: .55 }); const tip = c.pts[Math.floor(c.pts.length * .5)]; if (tip && tip.ra < Infinity) { ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = Pl.color; ctx.fillText(`${c.vinf}`, X(tip.ra) + 2, Y(tip.rp) - 2); } } }
    /* dizi bacakları */
    plan.legs.forEach((l, i) => { if (!l.orbit) return; const col = legColor(i); const pl = Math.min(1, Math.max(0, pLeg * plan.legs.length - i)); if (pl <= 0) return; ctx.save(); ctx.globalAlpha = pl;
      if (l.delta != null) { /* erişilebilir yay: mevcut gezegen eğrisi α ± δ */ const lo = Math.max(0, l.alpha - l.delta), hi = Math.min(Math.PI, l.alpha + l.delta); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = .35; ctx.beginPath(); let first = true; for (let k = 0; k <= 60; k++) { const o = orbitFromVinf(l.from, l.vinf, lo + (hi - lo) * k / 60); if (o.hyperbolic || o.rp <= 0) continue; first ? ctx.moveTo(X(o.ra), Y(o.rp)) : ctx.lineTo(X(o.ra), Y(o.rp)); first = false; } ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1; }
      const x = X(l.orbit.ra), y = Y(l.orbit.rp); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.ink; ctx.font = '600 10.5px Inter, sans-serif'; ctx.fillText(`${i + 1}: ${PLANETS[l.from].label}→${PLANETS[l.to].label}`, x + 8, y + 4);
      const prev = plan.legs[i - 1]; if (prev && prev.orbit) { ctx.strokeStyle = col; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(prev.orbit.ra), Y(prev.orbit.rp)); ctx.lineTo(X(prev.orbit.ra) + (x - X(prev.orbit.ra)) * pl, Y(prev.orbit.rp) + (y - Y(prev.orbit.rp)) * pl); ctx.stroke(); ctx.setLineDash([]); } ctx.restore(); });
    ctx.restore();
  }
  function drawHelio() {
    const cv = plots.helio, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas, grid: 36, gridAlpha: .025 }); const pLeg = entrance.progress('legs');
    const rmax = Math.max(...plan.legs.filter(l => l.orbit).map(l => l.orbit.ra), PLANETS[plan.legs[plan.legs.length - 1].to].a) * 1.1, sc = Math.min(W, Hh) / 2 / rmax * .92, X = x => W / 2 + x * sc, Y = y => Hh / 2 - y * sc;
    title(ctx, 'güneş-merkezli bacak yörüngeleri · eş-düzlem, fazlama yok', 12, 15, P);
    for (const p of cfg.planets) { const Pl = PLANETS[p]; if (Pl.a > rmax) continue; ctx.strokeStyle = Pl.color; ctx.globalAlpha = .4; ctx.beginPath(); ctx.arc(X(0), Y(0), Pl.a * sc, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(X(0), Y(0), 5, 0, Math.PI * 2); ctx.fill();
    plan.legs.forEach((l, i) => { if (!l.orbit) return; const o = l.orbit, col = legColor(i); const pl = Math.min(1, Math.max(0, pLeg * plan.legs.length - i)); if (pl <= 0) return; const ep = []; for (let k = 0; k <= 240; k++) { const nu = 2 * Math.PI * k / 240, r = o.a * (1 - o.e * o.e) / (1 + o.e * Math.cos(nu)); ep.push([X(r * Math.cos(nu + i * .35)), Y(r * Math.sin(nu + i * .35))]); } polyline(ctx, ep, { progress: pl, color: col, width: 1.6 }); ctx.fillStyle = col; ctx.font = '10px Inter, sans-serif'; ctx.fillText(`${i + 1}`, X(o.ra * Math.cos(Math.PI + i * .35)) + 4, Y(o.ra * Math.sin(Math.PI + i * .35))); });
    label(ctx, 'elipsler bacak numarasıyla · yönelimler görsel ayrım için kaydırılmıştır', 12, Hh - 8, P, { mono: false, size: 10.5 });
  }
  function draw() { if (!plan) return; drawGraph(); drawHelio(); }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure); rebuild(); resize(); entrance.start();
  return { get plan() { return plan; }, get config() { return { ...cfg }; }, sequences: SEQUENCES, planets: PLANETS, set(c) { const seqChanged = c.sequence && c.sequence !== cfg.sequence; cfg = { ...cfg, ...c }; rebuild(); draw(); if (seqChanged) entrance.start(); }, replay() { entrance.start(); }, dispose() { entrance.stop(); ro.disconnect(); figure.remove(); } };
}
