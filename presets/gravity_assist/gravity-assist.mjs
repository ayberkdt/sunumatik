/* gravity-assist.mjs — Yerçekimi Yardımı + B-Düzlemi Sahnesi (gravity_assist)

   Üç görünüm, tek model (flyby-model.mjs, saf):
     A) gezegen-göreli çerçeve: hiperbol, asimptotlar, enberi, B-düzlemi çizgisi ve B vektörü, dönme açısı δ,
        v∞_in / v∞_out okları, hareket eden araç;
     B) heliosantrik çerçeve: Güneş, gezegen yörüngesi, önce/sonra heliosantrik yörüngeler, hız üçgeni
        (V_p + v∞ = V): |v∞| aynı, |V| farklı — "gezegen çekti" değil, çerçeve değişimi;
     C) B-düzlemi hedef görünümü: T̂–R̂ eksenleri, çarpma dairesi, B vektörü (B·T, B·R).
   API:
     const ga = await mountGravityAssist(host, { body:'jupiter', vinf, alpha, rpRatio, theta, warp });
     ga.set({ ... }) · ga.flyby · ga.timeline · ga.advance(dt) · ga.dispose()
   2B tuval, THREE gerekmez. */

import { solveFlyby, hyperbolaPath, heliocentricPath, helioOrbitPoints, BODIES, AU } from './flyby-model.mjs';
import { palette, backdrop, starfield, planet, sun, glow, colorLine, speed } from '../core/lab-scene.mjs';
const BODY_COLOR = { jupiter: '#d9b877', earth: '#5f8fc4', mars: '#d78f6c', venus: '#e6c58a', saturn: '#e0d2a8', neptune: '#7fa0e0', uranus: '#9fd0d8', mercury: '#b9b0a3' };
const bodyLook = id => ({ color: BODY_COLOR[id] || '#e0d2a8', atmosphere: id === 'earth' ? '#6fb4ff' : id === 'venus' ? '#f0d9a0' : id === 'jupiter' ? '#e8c890' : null, rings: id === 'saturn' ? { tilt: .3 } : null });

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountGravityAssist(host, options = {}) {
  if (!host) throw new Error('mountGravityAssist bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'ga';
  figure.innerHTML = `
    <style>
      .ga{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .ga__rel{grid-row:1/3;position:relative;min-width:0;min-height:0;} .ga__helio,.ga__bplane{position:relative;min-width:0;min-height:0;border-left:1px solid var(--color-rule,#3a3c42);}
      .ga__bplane{border-top:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-columns:minmax(0,1fr) auto;}
      .ga canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .ga__bp{position:relative;min-width:0;}
      .ga__hud{position:relative;padding:10px 14px;font-size:12px;color:var(--color-muted,#9a938a);border-left:1px solid var(--color-rule,#3a3c42);min-width:200px;overflow:auto;}
      .ga__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;} .ga__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .ga__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:12px;color:var(--color-ink,#e9e4d8);} .ga__hud dd.hi{color:var(--color-accent,#d9b877);} .ga__hud dd.bad{color:var(--color-data-2,#d78f6c);}
      .ga__hud .sep{grid-column:1/-1;border-top:1px solid var(--color-rule,#3a3c42);margin:4px 0 2px;}
    </style>
    <div class="ga__rel"><canvas aria-label="Gezegen-göreli hiperbol"></canvas></div>
    <div class="ga__helio"><canvas aria-label="Heliosantrik çerçeve"></canvas></div>
    <div class="ga__bplane"><div class="ga__bp"><canvas aria-label="B-düzlemi"></canvas></div>
      <div class="ga__hud" role="status"><dl>
        <dt>v∞</dt><dd data-h="vinf">—</dd><dt>e</dt><dd data-h="e">—</dd><dt>δ dönme</dt><dd data-h="delta" class="hi">—</dd><dt>r_p</dt><dd data-h="rp">—</dd><dt>|B|</dt><dd data-h="b">—</dd><dt>B·T / B·R</dt><dd data-h="bt">—</dd><dt>çarpma</dt><dd data-h="imp">—</dd>
        <div class="sep"></div>
        <dt>|V_in|</dt><dd data-h="vin">—</dd><dt>|V_out|</dt><dd data-h="vout">—</dd><dt>ΔV helio</dt><dd data-h="dv" class="hi">—</dd><dt>ΔE</dt><dd data-h="dE">—</dd>
        <dt>önce a, e</dt><dd data-h="bef">—</dd><dt>sonra a, e</dt><dd data-h="aft">—</dd><dt>Tisserand</dt><dd data-h="tiss">—</dd><dt>t</dt><dd data-h="t">—</dd>
      </dl></div></div>`;
  host.appendChild(figure);
  const cvR = figure.querySelector('.ga__rel canvas'), cvH = figure.querySelector('.ga__helio canvas'), cvB = figure.querySelector('.ga__bp canvas');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const P = palette(figure);
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), nf4 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  let cfg = { body: options.body ?? 'jupiter', vinf: options.vinf ?? 6, alpha: options.alpha ?? 120, rpRatio: options.rpRatio ?? 6, theta: options.theta ?? 0 };
  let fb = null, path = null, hpath = null, orbBefore = null, orbAfter = null;
  const timeline = { t: 0, tMin: -1, tMax: 1, duration: 2, playing: false, warp: options.warp ?? 20000, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, this.tMin, this.tMax); draw(); }, setWarp(w) { this.warp = w; } };

  function recompute() {
    fb = solveFlyby({ body: cfg.body, vinf: cfg.vinf, alpha: cfg.alpha, rp: cfg.rpRatio * BODIES[cfg.body].R, theta: cfg.theta });
    /* yol: enberiden ±(SOI ya da 40 r_p) */
    path = hyperbolaPath(fb, { n: 600, rMax: Math.min(fb.soi, Math.max(40 * fb.rp, 12 * fb.body.R)) });
    hpath = heliocentricPath(fb, path);
    timeline.tMin = path[0].t; timeline.tMax = path[path.length - 1].t; timeline.duration = timeline.tMax - timeline.tMin; if (timeline.t < timeline.tMin || timeline.t > timeline.tMax) timeline.t = timeline.tMin;
    orbBefore = helioOrbitPoints(fb.rPlanet, fb.Vin); orbAfter = helioOrbitPoints(fb.rPlanet, fb.Vout);
    H.vinf.textContent = `${nf2.format(fb.vinf)} km/s`; H.e.textContent = nf3.format(fb.e); H.delta.textContent = `${nf1.format(fb.delta * 180 / Math.PI)}°`; H.rp.textContent = `${nf0.format(fb.rp)} km (${nf1.format(fb.rp / fb.body.R)} R)`;
    H.b.textContent = `${nf0.format(fb.b)} km`; H.bt.textContent = `${nf0.format(fb.BT)} / ${nf0.format(fb.BR)} km`; H.imp.textContent = fb.impact ? 'ÇARPAR' : `hayır (|B| > ${nf0.format(fb.bImpact)} km)`; H.imp.className = fb.impact ? 'bad' : '';
    H.vin.textContent = `${nf2.format(Math.hypot(...fb.Vin))} km/s`; H.vout.textContent = `${nf2.format(Math.hypot(...fb.Vout))} km/s`; H.dv.textContent = `${nf2.format(fb.dV)} km/s`; H.dE.textContent = `${fb.dEnergy >= 0 ? '+' : ''}${nf1.format(fb.dEnergy)} km²/s²`;
    const el = e => e.e < 1 ? `${nf2.format(e.a / AU)} AU, ${nf3.format(e.e)}` : `hiperbolik, e ${nf3.format(e.e)}`;
    H.bef.textContent = el(fb.before); H.aft.textContent = el(fb.after); H.tiss.textContent = `${nf4.format(fb.tisserandIn)} → ${nf4.format(fb.tisserandOut)}`;
  }

  let dpr = 1; const sz = {};
  const setup = (cv, k) => { const w = Math.max(10, cv.parentElement.clientWidth), h = Math.max(10, cv.parentElement.clientHeight); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); sz[k] = [w, h]; };
  const arrow = (ctx, x0, y0, x1, y1, color, label, w = 1.6) => { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 7 * Math.cos(a - .38), y1 - 7 * Math.sin(a - .38)); ctx.lineTo(x1 - 7 * Math.cos(a + .38), y1 - 7 * Math.sin(a + .38)); ctx.closePath(); ctx.fill(); if (label) { ctx.font = '10.5px ui-monospace, monospace'; ctx.fillText(label, x1 + 6, y1 - 4); } };
  const curIndex = () => { let n = 0; while (n < path.length - 1 && path[n + 1].t <= timeline.t) n++; return n; };

  /* A) gezegen-göreli: düzlem S–B̂ (hiperbol düzlemi); ekran x = S yönü, y = B̂ yönü */
  function drawRel() {
    const ctx = cvR.getContext('2d'); const [W, Hh] = sz.rel; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W, Hh, { canvas: P.canvas }); starfield(ctx, W, Hh, { seed: 21, n: 140, alpha: .5 });
    const proj = r => [r[0] * fb.S[0] + r[1] * fb.S[1] + r[2] * fb.S[2], r[0] * fb.Bhat[0] + r[1] * fb.Bhat[1] + r[2] * fb.Bhat[2]];
    const ext = Math.max(2.4 * fb.b, 9 * fb.rp, 4 * fb.body.R);   // enberi bölgesi okunur kalsın; yol tuval dışına taşabilir
    const sc = Math.min(W, Hh) / 2 / ext * .92, cx = W / 2, cy = Hh / 2, X = v => cx + v * sc, Y = v => cy - v * sc;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`GEZEGEN-GÖRELİ çerçeve (hiperbol düzlemi: yatay = S = v∞_in yönü, düşey = B̂) · ${fb.body.label}`, 14, 18);
    /* SOI (varsa görünür) */
    ctx.beginPath(); ctx.arc(X(0), Y(0), fb.soi * sc, 0, Math.PI * 2); ctx.fillStyle = 'rgba(95,196,212,.045)'; ctx.fill(); ctx.strokeStyle = 'rgba(95,196,212,.28)'; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    /* B-düzlemi çizgisi (S'ye dik, merkezden) */
    ctx.strokeStyle = 'rgba(217,184,119,.45)'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), Hh); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.accent; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('B-düzlemi (S ⊥)', X(0) + 6, 34);
    /* asimptotlar */
    const bpx = fb.b * sc;
    ctx.strokeStyle = 'rgba(143,184,221,.4)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(0, Y(fb.b)); ctx.lineTo(W, Y(fb.b)); ctx.stroke();   // gelen asimptot: B̂ yönünde b ofset, S yönünde
    const d = fb.delta; const so = [Math.cos(d), -Math.sin(d)];   // çıkan asimptot yönü (S–B̂ düzleminde)
    /* çıkan asimptot: enberiye simetrik; asimptotların kesişimi: S yönünde x = −b·tan? — kesişim noktası (x_c, b): x_c = b/tan(δ/2)… hiperbol merkezi. Basit: kesişim = −a·e? merkez (−a e) P̂ yönünde */
    const cd = -fb.a * fb.e; const center = proj([fb.Phat[0] * cd, fb.Phat[1] * cd, fb.Phat[2] * cd]);   // hiperbol merkezi odaktan |a|e uzakta, enberi yönünde
    ctx.beginPath(); ctx.moveTo(X(center[0] - so[0] * ext * 3), Y(center[1] - so[1] * ext * 3)); ctx.lineTo(X(center[0] + so[0] * ext * 3), Y(center[1] + so[1] * ext * 3)); ctx.stroke(); ctx.setLineDash([]);
    /* dönme açısı yayı (asimptot kesişiminde) */
    ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X(center[0]), Y(center[1]), 28, 0, -Math.atan2(-so[1], so[0]) * 0 + Math.atan2(so[1], so[0]) * -1, so[1] < 0); ctx.stroke();
    ctx.fillStyle = P.accent; ctx.font = '600 11px ui-monospace, monospace'; ctx.fillText(`δ = ${nf1.format(fb.delta * 180 / Math.PI)}°`, X(center[0]) + 34, Y(center[1]) + 24);
    /* hiperbol */
    const n = curIndex();
    { /* hiperbol hızla renklenir: enberide beyaz-sıcak (v_rel en büyük), asimptotlarda sönük amber */ const pts = path.map(p => { const q = proj(p.r); return [X(q[0]), Y(q[1])]; }); const vLo = Math.min(...path.map(p => p.speed)), vHi = Math.max(...path.map(p => p.speed)); const col = (u, i) => speed((path[i].speed - vLo) / Math.max(1e-9, vHi - vLo)); colorLine(ctx, pts, col, { width: 1.2, alpha: .35 }); colorLine(ctx, pts.slice(0, n + 1), col, { width: 2.6 }); }
    /* gezegen */
    const rpx = Math.max(7, fb.body.R * sc); planet(ctx, X(0), Y(0), rpx, { ...bodyLook(cfg.body), sunDir: [-1, .35] });
    /* enberi + B vektörü */
    const per = proj([fb.Phat[0] * fb.rp, fb.Phat[1] * fb.rp, fb.Phat[2] * fb.rp]);
    ctx.fillStyle = P.data2; ctx.beginPath(); ctx.arc(X(per[0]), Y(per[1]), 3.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`enberi r_p = ${nf1.format(fb.rp / fb.body.R)} R`, X(per[0]) + 10, Y(per[1]) + 16);
    arrow(ctx, X(0), Y(0), X(0), Y(fb.b), P.accent, '');
    ctx.fillStyle = P.accent; ctx.font = '600 10.5px ui-monospace, monospace'; ctx.fillText(`B = ${nf0.format(fb.b)} km`, X(0) + 8, Y(fb.b / 2) + 4);
    /* v∞ okları (asimptot uçlarında) */
    const L = Math.min(ext * .22, fb.vinf * ext / 8);
    const pin = proj(path[0].r); arrow(ctx, X(pin[0]), Y(pin[1]), X(pin[0] + L), Y(pin[1]), P.data1, 'v∞_in');
    const pout = proj(path[path.length - 1].r); arrow(ctx, X(pout[0]), Y(pout[1]), X(pout[0] + so[0] * L), Y(pout[1] + so[1] * L), P.data1, 'v∞_out');
    /* araç */
    const c = proj(path[n].r); glow(ctx, X(c[0]), Y(c[1]), 18, P.accent, .55); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(c[0]), Y(c[1]), 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = P.canvas; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = P.ink; ctx.font = '600 11px ui-monospace, monospace'; ctx.fillText(`araç: r = ${nf0.format(path[n].dist)} km · v_rel = ${nf2.format(path[n].speed)} km/s · t = ${timeline.t >= 0 ? '+' : '−'}${nf1.format(Math.abs(timeline.t) / 3600)} sa`, 14, Hh - 30);
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`|v∞| korunur: ${nf2.format(fb.vinf)} km/s giriş = ${nf2.format(Math.hypot(...fb.vinfOut))} km/s çıkış · e = 1 + r_p v∞²/μ · δ = 2 asin(1/e) · b = r_p √(1 + 2μ/(r_p v∞²))`, 14, Hh - 12);
  }
  /* B) heliosantrik */
  function drawHelio() {
    const ctx = cvH.getContext('2d'); const [W, Hh] = sz.helio; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W, Hh, { canvas: P.canvas }); starfield(ctx, W, Hh, { seed: 21, n: 140, alpha: .5 });
    const ap = fb.body.a; const ra = Math.min(12 * AU, Math.max(ap * 1.25, fb.before.e < 1 ? fb.before.ra : ap * 1.25, fb.after.e < 1 ? fb.after.ra : ap * 2.2));
    const sc = Math.min(W, Hh) / 2 / ra * .9, cx = W * .38, cy = Hh / 2, X = v => cx + v * sc, Y = v => cy - v * sc;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('HELİOSANTRİK çerçeve: önce (mavi) / sonra (altın) yörüngeler; gezegen dairesel', 14, 18);
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(X(0), Y(0), ap * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    sun(ctx, X(0), Y(0), 7, { corona: 5 });
    const drawOrb = (o, color) => { ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath(); let first = true; for (const p of o.pts) { const x = X(p[0]), y = Y(p[1]); if (Math.abs(x - cx) > W * 3 || Math.abs(y - cy) > Hh * 3) { first = true; continue; } first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; } ctx.stroke(); };
    drawOrb(orbBefore, 'rgba(143,184,221,.8)'); drawOrb(orbAfter, 'rgba(217,184,119,.9)');
    /* gezegen ve heliosantrik yama yolu */
    const n = curIndex(); const hp = hpath[n];
    planet(ctx, X(hp.planet[0]), Y(hp.planet[1]), 6.5, { ...bodyLook(cfg.body), sunDir: [X(0) - X(hp.planet[0]), Y(0) - Y(hp.planet[1])] });
    glow(ctx, X(hp.r[0]), Y(hp.r[1]), 12, P.accent, .5); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(hp.r[0]), Y(hp.r[1]), 3.5, 0, Math.PI * 2); ctx.fill();
    /* hız üçgenleri (sağ üst): V_p + v∞_in = V_in ; V_p + v∞_out = V_out */
    const ox = W * .74, oy = Hh * .68, ks = Math.min(W * .3, Hh * .42) / Math.max(Math.hypot(...fb.Vin), Math.hypot(...fb.Vout), fb.vinf + Math.hypot(...fb.Vp));
    const V = v => [ox + v[0] * ks, oy - v[1] * ks];
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('hız üçgeni: V = V_p + v∞ (|v∞| çemberi kesikli)', ox, 34); ctx.textAlign = 'left';
    const vp = V(fb.Vp); arrow(ctx, ox, oy, vp[0], vp[1], P.data2, ''); ctx.fillStyle = P.data2; ctx.font = '10.5px ui-monospace, monospace'; ctx.fillText('V_p', (ox + vp[0]) / 2 - 24, (oy + vp[1]) / 2);
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(vp[0], vp[1], fb.vinf * ks, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const vin = V(fb.Vin); arrow(ctx, vp[0], vp[1], vin[0], vin[1], 'rgba(143,184,221,.9)', ''); arrow(ctx, ox, oy, vin[0], vin[1], 'rgba(143,184,221,.9)', '', 2.2);
    ctx.fillStyle = 'rgba(143,184,221,.95)'; ctx.font = '10.5px ui-monospace, monospace'; ctx.fillText(`V_in ${nf2.format(Math.hypot(...fb.Vin))}`, vin[0] + 8, vin[1] - 4); ctx.fillText('v∞_in', (vp[0] + vin[0]) / 2 + 6, (vp[1] + vin[1]) / 2);
    const vout = V(fb.Vout); arrow(ctx, vp[0], vp[1], vout[0], vout[1], 'rgba(217,184,119,.9)', ''); arrow(ctx, ox, oy, vout[0], vout[1], 'rgba(217,184,119,.95)', '', 2.2);
    ctx.fillStyle = 'rgba(217,184,119,.95)'; ctx.fillText(`V_out ${nf2.format(Math.hypot(...fb.Vout))}`, vout[0] + 8, vout[1] + 12); ctx.fillText('v∞_out', (vp[0] + vout[0]) / 2 + 6, (vp[1] + vout[1]) / 2 + 12);
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`ΔV = |V_out − V_in| = 2 v∞ sin(δ/2) = ${nf2.format(fb.dV)} km/s · ΔE = V_p·Δv∞ = ${fb.dEnergy >= 0 ? '+' : ''}${nf1.format(fb.dEnergy)} km²/s²`, 14, Hh - 12);
  }
  /* C) B-düzlemi */
  function drawBplane() {
    const ctx = cvB.getContext('2d'); const [W, Hh] = sz.bp; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W, Hh, { canvas: P.canvas }); starfield(ctx, W, Hh, { seed: 21, n: 140, alpha: .5 });
    const ext = Math.max(fb.b, fb.bImpact) * 1.35, sc = Math.min(W, Hh) / 2 / ext * .9, cx = W / 2, cy = Hh / 2;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText('B-DÜZLEMİ (S boyunca bakış): T̂ →, R̂ ↓', 12, 16);
    ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, Hh); ctx.stroke();
    { const gI = ctx.createRadialGradient(cx, cy, 0, cx, cy, fb.bImpact * sc); gI.addColorStop(0, 'rgba(215,143,108,.34)'); gI.addColorStop(1, 'rgba(215,143,108,.07)'); ctx.fillStyle = gI; ctx.beginPath(); ctx.arc(cx, cy, fb.bImpact * sc, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = P.data2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
    planet(ctx, cx, cy, Math.max(4, fb.body.R * sc), { ...bodyLook(cfg.body), sunDir: [-1, -.4] });
    ctx.fillStyle = P.data2; ctx.font = '10px Inter, sans-serif'; ctx.fillText(`çarpma dairesi b = R√(1+2μ/(Rv∞²)) = ${nf0.format(fb.bImpact)} km`, cx + fb.bImpact * sc * .3, cy + fb.bImpact * sc + 14);
    /* B vektörü: T̂ sağa, R̂ aşağı (klasik) */
    arrow(ctx, cx, cy, cx + fb.BT * sc, cy + fb.BR * sc, P.accent, `B (${nf0.format(fb.BT)}, ${nf0.format(fb.BR)})`, 2);
    ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.fillText('T̂', W - 16, cy - 4); ctx.fillText('R̂', cx + 5, Hh - 6);
  }
  function draw() { if (!fb) return; drawRel(); drawHelio(); drawBplane(); H.t.textContent = `${timeline.t >= 0 ? '+' : '−'}${nf1.format(Math.abs(timeline.t) / 3600)} sa (enberi t = 0)`; }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.tMax) timeline.t = timeline.tMin; } draw(); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); if (timeline.playing) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); setup(cvR, 'rel'); setup(cvH, 'helio'); setup(cvB, 'bp'); draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  recompute(); resize();
  if (reducedMotion || exportMode) timeline.t = 0; else if (options.autoplay ?? true) { timeline.t = timeline.tMin; timeline.playing = true; }
  draw(); ensureLoop();
  return {
    get flyby() { return fb; }, get config() { return { ...cfg }; }, bodies: BODIES, timeline,
    set(c) { cfg = { ...cfg, ...c }; recompute(); draw(); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.ga__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
