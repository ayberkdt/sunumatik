/* low-thrust.mjs — Düşük İtkili Transfer Laboratuvarı sahnesi (low_thrust_transfer). 2B tuval, THREE gerekmez.

   Sol: spiral (üstten, ECI x–y; Dünya, başlangıç/hedef daireleri, itki açık/kapalı renkli iz, gölge bölgesi, araç imi).
   Sağ: (1) yarı-büyük eksen a(t) ve eğiklik i(t); (2) birikimli ΔV(t) — Edelbaum ve Hohmann yatay referansları;
   (3) kütle m(t) ve itki ivmesi. HUD: ΔV sayısal/Edelbaum/Hohmann, süre, tur, yakıt, e_max, T/W, görev çevrimi.

   API: const lt = await mountLowThrust(host, { scenario, overrides, warp, autoplay, t }); lt.set(ov) · lt.run · lt.timeline · lt.dispose() */

import { simulateSpiral, SCENARIOS, VEHICLES, R_E } from './low-thrust-model.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountLowThrust(host, options = {}) {
  if (!host) throw new Error('mountLowThrust bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'lt';
  figure.innerHTML = `
    <style>
      .lt{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .lt canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;} .lt__cell{position:relative;min-height:0;min-width:0;}
      .lt__left{display:grid;grid-template-rows:minmax(0,1fr) auto;min-width:0;min-height:0;}
      .lt__hud{padding:8px 12px;border-top:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .lt__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:1px 10px;} .lt__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .lt__hud dd{margin:0;text-align:right;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:11.5px;color:var(--color-ink,#e9e4d8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .lt__hud dd.hi{color:var(--color-accent,#d9b877);}
      .lt__plots{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));border-left:1px solid var(--color-rule,#3a3c42);min-width:0;min-height:0;} .lt__plots .lt__cell{border-bottom:1px solid var(--color-rule,#3a3c42);} .lt__plots .lt__cell:last-child{border-bottom:0;}
      .lt__top{position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);pointer-events:none;max-width:70%;}
    </style>
    <div class="lt__left">
      <div class="lt__cell"><canvas class="p" data-plot="spiral" aria-label="Spiral transfer (üstten)"></canvas><div class="lt__top" data-top></div></div>
      <div class="lt__hud" role="status"><dl>
        <dt>t</dt><dd data-h="t">—</dd><dt>a · e</dt><dd data-h="ae">—</dd>
        <dt>ΔV birikimli</dt><dd data-h="dv" class="hi">—</dd><dt>kütle · a_T</dt><dd data-h="m">—</dd>
        <dt>ΔV sayısal (toplam)</dt><dd data-h="dvt" class="hi">—</dd><dt>Edelbaum (analitik)</dt><dd data-h="ed">—</dd>
        <dt>Hohmann (impulsif)</dt><dd data-h="hoh">—</dd><dt>Süre · tur</dt><dd data-h="tof">—</dd>
        <dt>Yakıt (Isp)</dt><dd data-h="mp">—</dd><dt>Kimyasal yakıt (Isp 320)</dt><dd data-h="mpc">—</dd>
        <dt>T/W · e_max</dt><dd data-h="tw">—</dd><dt>Görev çevrimi</dt><dd data-h="duty">—</dd>
      </dl></div>
    </div>
    <div class="lt__plots">
      <div class="lt__cell"><canvas class="p" data-plot="a" aria-label="Yarı-büyük eksen ve eğiklik"></canvas></div>
      <div class="lt__cell"><canvas class="p" data-plot="dv" aria-label="Birikimli ΔV"></canvas></div>
      <div class="lt__cell"><canvas class="p" data-plot="m" aria-label="Kütle ve itki ivmesi"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const topEl = figure.querySelector('[data-top]');
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), canvas: tok('--color-canvas', '#0b0c10') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  let scId = options.scenario ?? 'gtoLikeLeoGeo', ov = options.overrides || {}, run = null;
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 86400 * 2, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); draw(); } };
  function rebuild() { run = simulateSpiral({ ...SCENARIOS[scId], ...ov }); timeline.duration = run.tof; if (timeline.t > timeline.duration) timeline.t = 0; writeStatic(); }
  function writeStatic() {
    const r = run, V = r.vehicle;
    H.dvt.textContent = `${nf3.format(r.dvTotal)} km/s${r.reached ? '' : ' (hedefe ulaşmadı)'}`; H.ed.textContent = `${nf3.format(r.edelbaum)} km/s${r.di ? ` (eş-düzlem ${nf3.format(r.edelbaumCoplanar)})` : ''}`; H.hoh.textContent = `${nf3.format(r.hohmann.dv)} km/s · ${nf1.format(r.hohmann.tof / 3600)} sa`;
    H.tof.textContent = `${nf1.format(r.tof / 86400)} gün · ${nf0.format(r.revs)} tur`; H.mp.textContent = `${nf1.format(r.mp)} kg / ${nf0.format(V.m0)} kg (Isp ${V.isp} s)`; H.mpc.textContent = `${nf1.format(r.hohmannProp.mp)} kg`;
    H.tw.textContent = `${r.thrustToWeight.toExponential(1)} · ${r.eMax.toExponential(1)}`; H.duty.textContent = `%${nf0.format(r.dutyCycle * 100)}`;
    topEl.textContent = `${SCENARIOS[scId].label} · ${V.label} (${V.thrust} N, Isp ${V.isp} s, ${nf0.format(V.m0)} kg) · sürekli teğetsel itki, RK4 ${r.steps} adım · ${r.di ? 'Edelbaum yaw kanunu' : 'eş-düzlem'}`;
  }
  const idxAt = t => { const S = run.samples; let lo = 0, hi = S.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (S[mid].t < t) lo = mid + 1; else hi = mid; } return lo; };
  let dpr = 1;
  function drawSpiral(k) {
    const cv = plots.spiral, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    const ext = Math.max(run.r0, run.r1) * 1.1, sc = Math.min(W, Hh) / 2 / ext * .94, X = x => W / 2 + x * sc, Y = y => Hh / 2 - y * sc;
    if (SCENARIOS[scId].shadow || ov.shadow) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(X(-ext), Y(R_E), ext * sc, 2 * R_E * sc); ctx.fillStyle = P.muted; ctx.font = '10px Inter, sans-serif'; ctx.fillText('gölge (silindirik) — itki kapalı', X(-ext) + 6, Y(R_E) - 4); }
    for (const [r, c] of [[run.r0, P.data1], [run.r1, P.data2]]) { ctx.strokeStyle = c; ctx.globalAlpha = .5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(X(0), Y(0), r * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#2f5b8a'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(3, R_E * sc), 0, Math.PI * 2); ctx.fill();
    const S = run.samples, Pth = run.path, nP = Pth.length / 4, tNow = S[k].t;
    /* yoğun iz: geçmiş turlar düşük alfa (binlerce tur bir halka gibi dolar — fiziksel gerçek), son ~1 tur parlak */
    let iEnd = 0; { let lo = 0, hi = nP - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (Pth[mid * 4] < tNow) lo = mid + 1; else hi = mid; } iEnd = lo; }
    const stride = Math.max(1, Math.ceil(iEnd / 40000)); ctx.lineWidth = 1;
    const revSteps = Math.max(2, Math.round(2 * Math.PI * Math.sqrt(S[k].a ** 3 / 398600.4418) / (run.tof / nP)));   // yaklaşık son tur uzunluğu (iz noktası sayısı)
    const iBright = Math.max(0, iEnd - revSteps);
    const seg = (i0, i1, st, alpha, colorOn, colorOff) => { ctx.globalAlpha = alpha; let on = -1; ctx.beginPath(); for (let i = i0; i <= i1; i += st) { const o = Pth[i * 4 + 3]; if (o !== on) { if (on >= 0) ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = o ? colorOn : colorOff; on = o; ctx.moveTo(X(Pth[i * 4 + 1]), Y(Pth[i * 4 + 2])); } else ctx.lineTo(X(Pth[i * 4 + 1]), Y(Pth[i * 4 + 2])); } ctx.stroke(); };
    if (iBright > 0) seg(0, iBright, stride, .18, P.accent, 'rgba(255,255,255,.6)');
    seg(iBright, iEnd, 1, .95, P.accent, 'rgba(255,255,255,.55)');
    ctx.globalAlpha = 1; ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(Pth[iEnd * 4 + 1]), Y(Pth[iEnd * 4 + 2]), 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(`üstten (ECI) · altın: itki açık · gri: itki kapalı · soluk: geçmiş turlar, parlak: son tur · mavi: başlangıç r₀ = ${nf0.format(run.r0 - R_E)} km yükseklik · turuncu: hedef ${nf0.format(run.r1 - R_E)} km`, 12, Hh - 10);
  }
  function frame(cv, title) { const ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh); ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.fillText(title, 10, 13); const pad = { l: 56, r: 12, t: 20, b: 16 }; return { ctx, W, Hh, pad, pw: W - pad.l - pad.r, ph: Hh - pad.t - pad.b }; }
  function linePlot(cv, title, series, t, T, unitFmt) {
    const f = frame(cv, title), { ctx, pad, pw, ph, Hh } = f, S = run.samples;
    const all = series.flatMap(s => s.vals); const lo = Math.min(...all, ...series.flatMap(s => s.refs || [])), hi = Math.max(...all, ...series.flatMap(s => s.refs || [])); const span = (hi - lo) || 1;
    const X = tt => pad.l + tt / T * pw, Y = v => pad.t + ph - (v - lo) / span * ph * .96 - ph * .02;
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'right'; for (let q = 0; q <= 4; q++) { const v = lo + span * q / 4, y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.fillText(unitFmt(v), pad.l - 4, y + 3); } ctx.textAlign = 'left';
    for (const s of series) { for (const [rv, label] of (s.refLabels || [])) { ctx.strokeStyle = s.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Y(rv)); ctx.lineTo(pad.l + pw, Y(rv)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = s.color; ctx.font = '9.5px ui-monospace, monospace'; ctx.fillText(label, pad.l + 4, Y(rv) - 3); }
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.3; ctx.beginPath(); S.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(s.vals[i])) : ctx.moveTo(X(p.t), Y(s.vals[i]))); ctx.stroke(); }
    const x = X(t); ctx.strokeStyle = P.accent; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center'; const days = T / 86400, step = days > 200 ? 100 : days > 60 ? 30 : days > 10 ? 5 : 1; for (let d = 0; d <= days; d += step) ctx.fillText(`${d} g`, X(d * 86400), Hh - 4); ctx.textAlign = 'left';
  }
  function draw() {
    if (!run) return; const t = timeline.t, k = idxAt(t), s = run.samples[k], T = timeline.duration, S = run.samples;
    drawSpiral(k);
    linePlot(plots.a, 'yarı-büyük eksen a(t) [km yükseklik] (beyaz)' + (run.di ? ' ve eğiklik i(t) [°] (mavi, sağ ölçek yok: 0…Δi)' : ''), [{ color: P.ink, vals: S.map(p => p.a - R_E), refs: [run.r1 - R_E], refLabels: [[run.r1 - R_E, 'hedef']] }, ...(run.di ? [{ color: P.data1, vals: S.map(p => (run.r0 - R_E) + (run.r1 - run.r0) * (p.inc / run.di)) }] : [])], t, T, v => `${nf0.format(v / 1000)}e3`);
    linePlot(plots.dv, 'birikimli ΔV(t) [km/s] — kesikli: Edelbaum (turuncu), Hohmann (mavi)', [{ color: P.ink, vals: S.map(p => p.dv), refs: [run.edelbaum, run.hohmann.dv] }, { color: P.data2, vals: S.map(() => run.edelbaum), refLabels: [[run.edelbaum, `Edelbaum ${nf3.format(run.edelbaum)}`]] }, { color: P.data1, vals: S.map(() => run.hohmann.dv), refLabels: [[run.hohmann.dv, `Hohmann ${nf3.format(run.hohmann.dv)}`]] }], t, T, v => nf2.format(v));
    linePlot(plots.m, 'kütle m(t) [kg] (beyaz) — itki ivmesi a_T = T/m büyür', [{ color: P.ink, vals: S.map(p => p.m) }], t, T, v => nf0.format(v));
    H.t.textContent = `${nf1.format(t / 86400)} gün`; H.ae.textContent = `${nf0.format(s.a - R_E)} km · ${s.e.toExponential(1)}${run.di ? ` · i ${nf1.format(s.inc)}°` : ''}`; H.dv.textContent = `${nf3.format(s.dv)} km/s`; H.m.textContent = `${nf1.format(s.m)} kg · ${(run.vehicle.thrust / s.m).toExponential(2)} m/s²`;
  }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } draw(); }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t = 0; } draw(); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && timeline.playing) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(figure);
  rebuild();
  if (reducedMotion || exportMode || options.t != null) timeline.t = options.t ?? timeline.duration * .6; else if (options.autoplay ?? true) timeline.playing = true;
  resize(); ensureLoop();
  return {
    get run() { return run; }, get scenario() { return scId; }, timeline, scenarios: SCENARIOS, vehicles: VEHICLES,
    set(id, o) { scId = SCENARIOS[id] ? id : scId; ov = o || {}; timeline.t = 0; rebuild(); draw(); }, advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
