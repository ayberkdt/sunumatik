/* cr3bp.mjs — CR3BP / Lagrange Dinamiği Sahnesi (cr3bp_lagrange)

   Dairesel kısıtlı üç-cisim problemi, dönen çerçeve: birincil ve ikincil cisimler, ∇Ω = 0'dan
   ÇÖZÜLEN L1–L5, etkin potansiyel alanı, seçilen Jacobi sabiti için sıfır-hız eğrileri ve YASAK
   bölgeler (C kaydırıcısıyla L1 → L2 → L3 boyunlarının açılışı), test parçacığı yörüngesi (RK4,
   Jacobi korunumu canlı), L1/L2 Lyapunov yörünge aileleri (diferansiyel düzeltme + süreklilik),
   dönen ↔ eylemsiz çerçeve karşılaştırması. Çözücü: ../core/astro-cr3bp.mjs (saf).

   API:
     const cr = await mountCr3bp(host, { system:'earthMoon', C?, particle?:{x,y,vx,vy}, lyapunov?:{L:'L1', Ax}, warp });
     cr.setSystem(id) · cr.setJacobi(C) · cr.setParticle(state) · cr.setLyapunov(L, Ax) · cr.lagrange · cr.timeline · cr.dispose()
   2B tuval, THREE gerekmez. Birimler boyutsuz (uzunluk = birincil–ikincil mesafesi, zaman: 2π = 1 devir). */

import { SYSTEMS, lagrangePoints, omega, jacobi, propagate, lyapunovFamily, zeroVelocityCurves, rotatingToInertial } from '../core/astro-cr3bp.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountCr3bp(host, options = {}) {
  if (!host) throw new Error('mountCr3bp bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'cr3';
  figure.innerHTML = `
    <style>
      .cr3{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,12fr) minmax(0,8fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .cr3__rot{position:relative;min-width:0;min-height:0;} .cr3__rot canvas,.cr3__in canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .cr3__side{min-width:0;min-height:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr);}
      .cr3__hud{padding:10px 14px;border-bottom:1px solid var(--color-rule,#3a3c42);font-size:12px;color:var(--color-muted,#9a938a);}
      .cr3__hud table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;margin-bottom:6px;}
      .cr3__hud th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;text-align:right;font-weight:600;padding:1px 4px;} .cr3__hud th:first-child,.cr3__hud td:first-child{text-align:left;}
      .cr3__hud td{text-align:right;padding:1px 4px;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);font-size:11.5px;color:var(--color-ink,#e9e4d8);}
      .cr3__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px;} .cr3__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;align-self:baseline;}
      .cr3__hud dd{margin:0;text-align:right;font-family:var(--font-mono,ui-monospace,monospace);font-size:12.5px;color:var(--color-ink,#e9e4d8);} .cr3__hud dd.hi{color:var(--color-accent,#d9b877);}
      .cr3__in{position:relative;min-height:0;}
      .cr3__top{position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);pointer-events:none;}
    </style>
    <div class="cr3__rot"><canvas aria-label="Dönen çerçeve"></canvas><div class="cr3__top" data-top></div></div>
    <div class="cr3__side">
      <div class="cr3__hud" role="status">
        <table><thead><tr><th>nokta</th><th>x</th><th>y</th><th>C_L</th><th>‖∇Ω‖</th><th>uzaklık</th></tr></thead><tbody data-lp></tbody></table>
        <dl><dt>t</dt><dd data-h="t">—</dd><dt>Jacobi C</dt><dd data-h="C" class="hi">—</dd><dt>|C − C₀|</dt><dd data-h="dC">—</dd><dt>ZVC C</dt><dd data-h="Czvc">—</dd><dt>konum</dt><dd data-h="pos">—</dd><dt>hız</dt><dd data-h="v">—</dd></dl>
      </div>
      <div class="cr3__in"><canvas aria-label="Eylemsiz çerçeve"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const cvR = figure.querySelector('.cr3__rot canvas'), cvI = figure.querySelector('.cr3__in canvas'), lpEl = figure.querySelector('[data-lp]'), topEl = figure.querySelector('[data-top]');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10'), surface: tok('--color-surface', '#15161a') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), nf4 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  let sysId = options.system ?? 'earthMoon', sys = SYSTEMS[sysId], mu = sys.mu;
  let lagrange = null, Czvc = null, zvc = null, families = { L1: [], L2: [] }, lyap = { L: 'L1', Ax: .02, orbit: null };
  let particle = null, traj = null, C0 = 0;
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? .25, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); draw(); }, setWarp(w) { this.warp = w; } };
  const VIEWS = { full: { xMin: -1.6, xMax: 1.6, yMin: -1.35, yMax: 1.35 }, secondary: { xMin: .55, xMax: 1.45, yMin: -.42, yMax: .42 } };
  let viewId = options.view ?? 'full'; const view = { ...VIEWS[viewId] };
  let omegaImg = null;

  function setupSystem() {
    sys = SYSTEMS[sysId]; mu = sys.mu;
    lagrange = lagrangePoints(mu);
    const fam = { dt: 2e-3 };
    /* Ax listesi γ'ya (L–ikincil uzaklığı) göreli: mutlak liste Güneş–Dünya'da (γ ≈ 0,01) ilk adımı 0,4γ yapıyor ve sahte yörüngelere kilitleniyordu */
    const gam = L => Math.abs(lagrange[L].x - (1 - mu)), AXF = [.03, .05, .08, .12, .17, .23, .33, .46, .6];
    families.L1 = lyapunovFamily(mu, 'L1', AXF.map(f => f * gam('L1')), fam);
    families.L2 = lyapunovFamily(mu, 'L2', AXF.map(f => f * gam('L2')), fam);
    if (Czvc == null) Czvc = (lagrange.L1.C + lagrange.L2.C) / 2;
    zvc = zeroVelocityCurves(mu, Czvc, view);
    omegaImg = null;
    lpEl.innerHTML = ['L1', 'L2', 'L3', 'L4', 'L5'].map(k => { const p = lagrange[k]; const dKm = (k === 'L1' || k === 'L2') ? Math.abs(p.x - (1 - mu)) * sys.L : Math.hypot(p.x + mu, p.y) * sys.L; return `<tr><td>${k}</td><td>${nf4.format(p.x)}</td><td>${nf4.format(p.y)}</td><td>${nf4.format(p.C)}</td><td>${p.residual.toExponential(1)}</td><td>${nf0.format(dKm)} km ${(k === 'L1' || k === 'L2') ? `(${sys.secondary})` : `(${sys.primary})`}</td></tr>`; }).join('');
    topEl.textContent = `${sys.label} · μ = ${mu.toExponential(4)} · dönen çerçeve, boyutsuz (1 birim = ${nf0.format(sys.L)} km, 2π = ${(sys.T / 86400).toFixed(1)} gün)`;
  }
  function setLyapunov(L, Ax) {
    lyap.L = L; lyap.Ax = Ax;
    const fam = families[L]; if (!fam.length) { lyap.orbit = null; return; }
    lyap.orbit = fam.reduce((b, o) => Math.abs(o.Ax - Ax) < Math.abs(b.Ax - Ax) ? o : b, fam[0]);
  }
  function setParticle(s, span) {
    particle = s.slice(); C0 = jacobi(mu, particle);
    const dt = 2e-3;
    traj = propagate(mu, particle, span ?? 6 * Math.PI, dt);
    timeline.duration = traj.times[traj.times.length - 1];
    Czvc = C0; zvc = zeroVelocityCurves(mu, Czvc, view);
  }

  /* -------- çizim */
  let dpr = 1, W = 10, Hh = 10, Wi = 10, Hi = 10;
  const sc = () => Math.min(W / (view.xMax - view.xMin), Hh / (view.yMax - view.yMin));
  const X = x => W / 2 + (x - (view.xMin + view.xMax) / 2) * sc(), Y = y => Hh / 2 - (y - (view.yMin + view.yMax) / 2) * sc();
  function buildOmega() {
    /* Ω alanı: log ölçekli, koyu = derin kuyu; yasak bölge (2Ω < C) ayrı boyanır */
    const n = 160, off = document.createElement('canvas'); off.width = n; off.height = n; const c = off.getContext('2d'); const img = c.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = view.xMin + (view.xMax - view.xMin) * i / (n - 1), y = view.yMax - (view.yMax - view.yMin) * j / (n - 1); const om = 2 * omega(mu, x, y); const t = clamp((Math.log(om - 2.9 + .02) - Math.log(.02)) / Math.log(60), 0, 1); const k = (j * n + i) * 4; img.data[k] = 18 + 40 * t; img.data[k + 1] = 22 + 60 * t; img.data[k + 2] = 34 + 90 * t; img.data[k + 3] = 255; }
    c.putImageData(img, 0, 0); omegaImg = off;
  }
  function drawRot() {
    const ctx = cvR.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, Hh);
    if (!omegaImg) buildOmega();
    const s = sc(); const x0 = X(view.xMin), y0 = Y(view.yMax);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(omegaImg, x0, y0, (view.xMax - view.xMin) * s, (view.yMax - view.yMin) * s);
    /* yasak bölge: 2Ω < C → kırmızımsı örtü (ızgaradan) */
    if (zvc) { const n = zvc.n; const cell = (view.xMax - view.xMin) / (n - 1) * s; ctx.fillStyle = 'rgba(215,143,108,.16)';
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) if (zvc.field[i * n + j] < Czvc) ctx.fillRect(X(view.xMin + (view.xMax - view.xMin) * i / (n - 1)), Y(view.yMin + (view.yMax - view.yMin) * (j + 1) / (n - 1)), cell + .5, cell + .5);
      ctx.strokeStyle = P.data2; ctx.lineWidth = 1.3; ctx.beginPath(); for (const g of zvc.segs) { ctx.moveTo(X(g[0]), Y(g[1])); ctx.lineTo(X(g[2]), Y(g[3])); } ctx.stroke(); }
    /* Lyapunov aileleri (soluk) + seçili (parlak) */
    for (const L of ['L1', 'L2']) for (const o of families[L]) { ctx.strokeStyle = o === lyap.orbit ? P.accent : 'rgba(143,184,221,.28)'; ctx.lineWidth = o === lyap.orbit ? 1.8 : .8; ctx.beginPath(); o.states.forEach((st, k) => k ? ctx.lineTo(X(st[0]), Y(st[1])) : ctx.moveTo(X(st[0]), Y(st[1]))); ctx.stroke(); }
    /* cisimler */
    const body = (x, rKm, color, label) => { const r = Math.max(4, rKm / sys.L * s); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Y(0), r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.ink; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, X(x), Y(0) + r + 14); };
    body(-mu, sys.rPrimary, sysId === 'earthMoon' ? '#5f8fc4' : '#ffd27a', sys.primary); body(1 - mu, sys.rSecondary, sysId === 'earthMoon' ? '#b9b2a6' : '#5f8fc4', sys.secondary);
    /* baricentr + ikincil yörünge çemberi */
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(X(0), Y(0), s * (1 - mu) + 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.muted; ctx.beginPath(); ctx.arc(X(0), Y(0), 2, 0, Math.PI * 2); ctx.fill();
    /* Lagrange noktaları */
    ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'left';
    for (const k of ['L1', 'L2', 'L3', 'L4', 'L5']) { const p = lagrange[k]; ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(p.x) - 5, Y(p.y)); ctx.lineTo(X(p.x) + 5, Y(p.y)); ctx.moveTo(X(p.x), Y(p.y) - 5); ctx.lineTo(X(p.x), Y(p.y) + 5); ctx.stroke(); ctx.fillStyle = P.accent; ctx.fillText(k, X(p.x) + 7, Y(p.y) - 6); }
    /* parçacık izi */
    if (traj) { let n = 0; while (n < traj.times.length - 1 && traj.times[n + 1] <= timeline.t) n++;
      ctx.strokeStyle = 'rgba(233,228,216,.22)'; ctx.lineWidth = 1; ctx.beginPath(); traj.states.forEach((st, k) => k ? ctx.lineTo(X(st[0]), Y(st[1])) : ctx.moveTo(X(st[0]), Y(st[1]))); ctx.stroke();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.8; ctx.beginPath(); for (let k = 0; k <= n; k++) { const st = traj.states[k]; k ? ctx.lineTo(X(st[0]), Y(st[1])) : ctx.moveTo(X(st[0]), Y(st[1])); } ctx.stroke();
      const cur = traj.states[n]; ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(cur[0]), Y(cur[1]), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = P.canvas; ctx.lineWidth = 1.5; ctx.stroke();
      const Cn = jacobi(mu, cur);
      H.t.textContent = `${nf3.format(timeline.t)} TU · ${(timeline.t / (2 * Math.PI) * sys.T / 86400).toFixed(1)} gün`; H.C.textContent = nf4.format(Cn); H.dC.textContent = Math.abs(Cn - C0).toExponential(1);
      H.pos.textContent = `(${nf3.format(cur[0])}, ${nf3.format(cur[1])})`; H.v.textContent = nf3.format(Math.hypot(cur[3], cur[4], cur[5])); }
    H.Czvc.textContent = nf4.format(Czvc);
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`kırmızı: sıfır-hız eğrisi 2Ω = C (${nf4.format(Czvc)}); taralı: yasak bölge 2Ω < C · mavi: L1/L2 Lyapunov aileleri (diferansiyel düzeltme) · altın: seçili`, 14, Hh - 12);
  }
  function drawInertial() {
    const ctx = cvI.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, Wi, Hi);
    const s2 = Math.min(Wi, Hi) / 2 / 1.7, XI = x => Wi / 2 + x * s2, YI = y => Hi / 2 - y * s2;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('EYLEMSİZ (baricentrik) çerçeve: aynı yörünge, θ = t ile geri döndürülmüş', 12, 16);
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(XI(0), YI(0), s2 * (1 - mu), 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(XI(0), YI(0), s2 * mu, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (traj) { let n = 0; while (n < traj.times.length - 1 && traj.times[n + 1] <= timeline.t) n++;
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4; ctx.beginPath(); for (let k = 0; k <= n; k += 2) { const p = rotatingToInertial(traj.states[k], traj.times[k]); k ? ctx.lineTo(XI(p[0]), YI(p[1])) : ctx.moveTo(XI(p[0]), YI(p[1])); } ctx.stroke();
      const t = timeline.t, sec = [(1 - mu) * Math.cos(t), (1 - mu) * Math.sin(t)], pri = [-mu * Math.cos(t), -mu * Math.sin(t)];
      ctx.fillStyle = '#5f8fc4'; ctx.beginPath(); ctx.arc(XI(pri[0]), YI(pri[1]), 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b9b2a6'; ctx.beginPath(); ctx.arc(XI(sec[0]), YI(sec[1]), 4, 0, Math.PI * 2); ctx.fill();
      const cur = rotatingToInertial(traj.states[n], traj.times[n]); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(XI(cur[0]), YI(cur[1]), 4, 0, Math.PI * 2); ctx.fill();
      /* seçili Lyapunov yörüngesi de eylemsizde: (kapalı değil — ikincil ile birlikte döner) */
      if (lyap.orbit) { ctx.strokeStyle = 'rgba(217,184,119,.5)'; ctx.lineWidth = 1; ctx.beginPath(); lyap.orbit.states.forEach((st, k) => { const p = rotatingToInertial(st, lyap.orbit.times[k]); k ? ctx.lineTo(XI(p[0]), YI(p[1])) : ctx.moveTo(XI(p[0]), YI(p[1])); }); ctx.stroke(); }
    }
  }
  function draw() { drawRot(); drawInertial(); }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t += dt * timeline.warp; if (timeline.t > timeline.duration) timeline.t -= timeline.duration; } draw(); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); if (timeline.playing) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); const r = cvR.parentElement; W = Math.max(10, r.clientWidth); Hh = Math.max(10, r.clientHeight); cvR.width = Math.round(W * dpr); cvR.height = Math.round(Hh * dpr); const i = cvI.parentElement; Wi = Math.max(10, i.clientWidth); Hi = Math.max(10, i.clientHeight); cvI.width = Math.round(Wi * dpr); cvI.height = Math.round(Hi * dpr); draw(); }
  const ro = new ResizeObserver(resize); ro.observe(figure);

  setupSystem();
  setLyapunov(options.lyapunov?.L ?? 'L1', options.lyapunov?.Ax ?? .025);
  if (options.particle) setParticle([options.particle.x, options.particle.y, 0, options.particle.vx, options.particle.vy, 0], options.span);
  else if (lyap.orbit) setParticle([lyap.orbit.x0, 0, 0, 0, lyap.orbit.ydot0, 0], 3 * lyap.orbit.period);
  resize();
  if (reducedMotion || exportMode) timeline.t = timeline.duration * .4; else if (options.autoplay ?? true) timeline.playing = true;
  draw(); ensureLoop();
  return {
    get lagrange() { return lagrange; }, get system() { return sys; }, get mu() { return mu; }, get families() { return families; }, get lyapunov() { return lyap.orbit; }, get particle() { return { state: particle, C: C0, traj } ; }, get jacobiZvc() { return Czvc; }, timeline, systems: SYSTEMS,
    setSystem(id) { if (!SYSTEMS[id]) return; sysId = id; Czvc = null; setupSystem(); setLyapunov(lyap.L, lyap.Ax); if (lyap.orbit) setParticle([lyap.orbit.x0, 0, 0, 0, lyap.orbit.ydot0, 0], 3 * lyap.orbit.period); timeline.t = 0; draw(); },
    setJacobi(C) { Czvc = C; zvc = zeroVelocityCurves(mu, Czvc, view); draw(); },
    setView(id) { if (!VIEWS[id]) return; viewId = id; Object.assign(view, VIEWS[id]); omegaImg = null; zvc = zeroVelocityCurves(mu, Czvc, view); draw(); }, get view() { return viewId; },
    setParticle(s, span) { setParticle(s, span); timeline.t = 0; draw(); },
    setLyapunov(L, Ax) { setLyapunov(L, Ax); if (lyap.orbit) { setParticle([lyap.orbit.x0, 0, 0, 0, lyap.orbit.ydot0, 0], 3 * lyap.orbit.period); timeline.t = 0; } draw(); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.cr3__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
