/* reentry.mjs — Giriş Koridoru Sahnesi (reentry_corridor)

   scene-blocks "wave 2" ORBITAL bloğu. reentry-model.mjs'in (saf) üstüne 2B tuval:
     • (h, v) düzlemi: eş-yavaşlama ve eş-ısı-akısı eğrileri (kapalı biçim), aşma ve altında-kalma
       sınır yörüngeleri, nominal yörünge (t'ye kadar), anlık nokta;
     • koridor çubuğu: γ_E ekseni, tarama sonuçları (skip / yörüngede / limit aşımı / uygun),
       koridor bandı, nominal γ imleci — koridorun NEDEN var olduğu buradan okunur;
     • profil: irtifa × yer menzili (atmosfer yoğunluk şeridi), yörünge, araç işareti;
     • HUD: t, h, v, γ, Mach, n (g), q̇, Q, ρ, q_dyn; olay rayı (arayüz, tepe q̇, tepe g, son).
   API:
     const re = await mountReentry(host, { vehicle:'capsule', entry:{ vEntry, gammaEntry, bank, nMax, qMax }, warp });
     re.sim · re.corridor · re.setEntry({...}) · re.setVehicle(id) · re.timeline · re.advance(dt) · re.dispose()
   Deterministik: aynı girdiler aynı eğriler; ?t= ile kare. THREE gerekmez. */

import { simulateEntry, findCorridor, isoDecelCurve, isoHeatCurve, sampleAt, VEHICLES, DEFAULT_ENTRY } from './reentry-model.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountReentry(host, options = {}) {
  if (!host) throw new Error('mountReentry bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'reen';
  figure.innerHTML = `
    <style>
      .reen{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);grid-template-rows:minmax(0,1fr) auto;
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .reen__hv{position:relative;min-width:0;min-height:0;} .reen__hv canvas,.reen__prof canvas,.reen__cor canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .reen__side{position:relative;min-width:0;min-height:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr) minmax(0,1fr);}
      .reen__hud{padding:10px 14px 8px;border-bottom:1px solid var(--color-rule,#3a3c42);}
      .reen__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 12px;}
      .reen__hud dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted,#9a938a);align-self:baseline;}
      .reen__hud dd{margin:0;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .reen__hud dd.hi{color:var(--color-accent,#d9b877);} .reen__hud dd.bad{color:var(--color-data-2,#d78f6c);}
      .reen__cor{position:relative;border-bottom:1px solid var(--color-rule,#3a3c42);} .reen__prof{position:relative;}
      .reen__events{grid-column:1/-1;position:relative;height:46px;border-top:1px solid var(--color-rule,#3a3c42);}
      .reen__events .rail{position:absolute;left:24px;right:24px;top:22px;height:2px;background:var(--color-rule,#3a3c42);}
      .reen__events .done{position:absolute;left:0;top:0;height:100%;background:var(--color-accent,#d9b877);transform-origin:left;}
      .reen__events .ev{position:absolute;top:0;height:44px;width:0;font-size:10.5px;letter-spacing:.04em;color:var(--color-muted,#9a938a);white-space:nowrap;}
      .reen__events .ev i{position:absolute;left:0;top:19px;width:8px;height:8px;transform:translateX(-50%);border-radius:50%;background:var(--color-canvas,#0b0c10);border:2px solid var(--color-muted,#9a938a);box-sizing:border-box;}
      .reen__events .ev span{position:absolute;left:0;transform:translateX(-50%);line-height:13px;}
      .reen__events .ev.derived{color:var(--color-data-2,#d78f6c);} .reen__events .ev.derived i{border-color:var(--color-data-2,#d78f6c);}
      .reen__events .ev.past{color:var(--color-ink,#e9e4d8);} .reen__events .ev.past i{background:var(--color-accent,#d9b877);border-color:var(--color-accent,#d9b877);}
    </style>
    <div class="reen__hv"><canvas aria-label="İrtifa–hız düzlemi"></canvas></div>
    <div class="reen__side">
      <div class="reen__hud" role="status"><dl>
        <dt>t</dt><dd data-hud="t">—</dd><dt>irtifa</dt><dd data-hud="h">—</dd>
        <dt>hız</dt><dd data-hud="v">—</dd><dt>γ</dt><dd data-hud="g">—</dd>
        <dt>Mach</dt><dd data-hud="mach">—</dd><dt>yavaşlama</dt><dd data-hud="n" class="hi">—</dd>
        <dt>q̇ (S–G)</dt><dd data-hud="q" class="hi">—</dd><dt>Q</dt><dd data-hud="Q">—</dd>
        <dt>ρ</dt><dd data-hud="rho">—</dd><dt>q_dyn</dt><dd data-hud="dyn">—</dd>
        <dt>sonuç</dt><dd data-hud="out">—</dd><dt>koridor</dt><dd data-hud="cor">—</dd>
      </dl></div>
      <div class="reen__cor"><canvas aria-label="Giriş koridoru"></canvas></div>
      <div class="reen__prof"><canvas aria-label="İrtifa–menzil profili"></canvas></div>
    </div>
    <div class="reen__events" aria-hidden="true"><div class="rail"><div class="done"></div></div></div>`;
  host.appendChild(figure);
  const cvHV = figure.querySelector('.reen__hv canvas'), cvCor = figure.querySelector('.reen__cor canvas'), cvProf = figure.querySelector('.reen__prof canvas');
  const hud = {}; for (const el of figure.querySelectorAll('[data-hud]')) hud[el.dataset.hud] = el;
  const eventsEl = figure.querySelector('.reen__events'), doneEl = eventsEl.querySelector('.done');
  const css = getComputedStyle(figure); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  const P = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10'), surface: tok('--color-surface', '#15161a') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let vehicleId = options.vehicle ?? 'capsule', vehicle = VEHICLES[vehicleId] || VEHICLES.capsule;
  let entry = { ...DEFAULT_ENTRY, ...(options.entry || {}) };
  let sim = null, corridor = null, iso = { g: [], q: [] }, eventNodes = [];
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 4, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); draw(); }, setWarp(w) { this.warp = w; } };

  function recompute() {
    sim = simulateEntry(vehicle, entry);
    corridor = findCorridor(vehicle, entry);
    iso.g = [1, 3, 5, 10, 20].map(n => ({ n, pts: isoDecelCurve(sim.beta, n, 20e3, entry.hEntry) }));
    iso.q = [0.5e6, 1e6, 2e6, 5e6].map(q => ({ q, pts: isoHeatCurve(vehicle.rn, q, 20e3, entry.hEntry) }));
    timeline.duration = sim.duration; timeline.t = Math.min(timeline.t, sim.duration);
    buildEvents();
  }
  function buildEvents() {
    for (const n of eventNodes) n.remove(); eventNodes = [];
    for (const e of sim.events) { const div = document.createElement('div'); div.className = 'ev' + (e.derived ? ' derived' : ''); div.dataset.t = String(e.t); div.innerHTML = `<span>${e.label}${e.q ? ` · ${nf2.format(e.q / 1e6)} MW/m²` : ''}${e.n ? ` · ${nf1.format(e.n)} g` : ''}</span><i></i>`; eventsEl.appendChild(div); eventNodes.push(div); }
    layoutEvents();
  }
  function layoutEvents() {
    const W = Math.max(60, eventsEl.clientWidth - 48), lanes = [];
    for (const div of eventNodes) { const x = 24 + Number(div.dataset.t) / sim.duration * W, w = div.firstElementChild.getBoundingClientRect().width || 60; let lane = 0; while (lane < 6 && lanes[lane] != null && x - w / 2 < lanes[lane] + 8) lane++; lanes[lane] = x + w / 2; div.style.left = `${x.toFixed(1)}px`; const above = lane % 2 === 0, k = Math.floor(lane / 2); div.querySelector('span').style.top = above ? `${4 - k * 13}px` : `${30 + k * 13}px`; }
  }

  /* -------- çizim yardımcıları */
  let dpr = 1; const size = { hv: [10, 10], cor: [10, 10], prof: [10, 10] };
  const setup = (cv, key) => { const w = Math.max(10, cv.parentElement.clientWidth), h = Math.max(10, cv.parentElement.clientHeight); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); size[key] = [w, h]; };
  const trajPath = (ctx, S, X, Y, upTo = Infinity) => { ctx.beginPath(); let first = true; for (const s of S) { if (s.t > upTo) break; const x = X(s), y = Y(s); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; } };

  function drawHV() {
    const ctx = cvHV.getContext('2d'); const [W, H] = size.hv; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, H);
    const pad = { l: 54, r: 18, t: 30, b: 40 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const vMax = Math.max(entry.vEntry * 1.08, 8500), hMax = entry.hEntry * 1.04;
    const X = s => pad.l + (s.v / vMax) * pw, Y = s => pad.t + ph - (s.h / hMax) * ph;
    /* ızgara */
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.fillStyle = P.muted; ctx.font = '10.5px ui-monospace, monospace'; ctx.textAlign = 'center';
    for (let v = 0; v <= vMax; v += 1000) { const x = X({ v }); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.fillText(`${v / 1000}`, x, H - pad.b + 16); }
    ctx.textAlign = 'right';
    for (let h = 0; h <= hMax; h += 20e3) { const y = Y({ h }); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.fillText(`${h / 1000}`, pad.l - 6, y + 4); }
    ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.fillText('hız (km/s)', pad.l + pw / 2, H - 8);
    ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('irtifa (km)', 0, 0); ctx.restore();
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('(h, v) düzlemi: eş-yavaşlama (kesikli, g) ve eş-ısı-akısı (noktalı, MW/m²) eğrileri kapalı biçimden; sınır yörüngeleri koridor aramasından', pad.l, 18);
    /* eş-eğriler */
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(215,143,108,.55)'; ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, monospace'; iso.g.forEach((c, i) => { trajPath(ctx, c.pts, X, Y); ctx.stroke(); const hTarget = 70e3 + i * 8e3; const p = c.pts.find(p => p.h >= hTarget); if (p && p.v < vMax * .98) { ctx.fillStyle = 'rgba(215,143,108,.9)'; ctx.fillText(`${c.n} g`, X(p) + 3, Y(p) - 3); } });
    ctx.setLineDash([1.5, 3]); ctx.strokeStyle = 'rgba(217,184,119,.55)';
    iso.q.forEach((c, i) => { trajPath(ctx, c.pts, X, Y); ctx.stroke(); const hTarget = 34e3 + i * 9e3; const p = c.pts.find(p => p.h >= hTarget); if (p && p.v < vMax) { ctx.fillStyle = 'rgba(217,184,119,.9)'; ctx.fillText(`${c.q / 1e6} MW/m²`, X(p) + 3, Y(p) + 10); } });
    ctx.setLineDash([]);
    /* sınır yörüngeleri */
    if (corridor?.overshootSim) { ctx.strokeStyle = 'rgba(143,184,221,.75)'; ctx.lineWidth = 1.3; trajPath(ctx, corridor.overshootSim.samples, X, Y); ctx.stroke(); }
    if (corridor?.undershootSim) { ctx.strokeStyle = 'rgba(215,143,108,.85)'; ctx.lineWidth = 1.3; trajPath(ctx, corridor.undershootSim.samples, X, Y); ctx.stroke(); }
    /* nominal: tam soluk + t'ye kadar parlak */
    ctx.strokeStyle = 'rgba(233,228,216,.3)'; ctx.lineWidth = 1; trajPath(ctx, sim.samples, X, Y); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.2; trajPath(ctx, sim.samples, X, Y, timeline.t); ctx.stroke();
    const cur = sampleAt(sim, timeline.t);
    ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(X(cur), Y(cur), 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = P.canvas; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    /* lejant */
    ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'left'; let lx = pad.l + 8, ly = pad.t + ph - 12;
    const leg = [[P.ink, 'nominal γ'], ['rgba(143,184,221,.9)', `aşma sınırı (kaldırma aşağı) γ = ${Number.isFinite(corridor?.gammaOvershoot) ? nf2.format(corridor.gammaOvershoot) + '°' : '—'}`], ['rgba(215,143,108,.9)', `altında-kalma sınırı (kaldırma yukarı) γ = ${Number.isFinite(corridor?.gammaUndershoot) ? nf2.format(corridor.gammaUndershoot) + '°' : '—'}`]];
    for (const [c, txt] of leg) { ctx.fillStyle = c; ctx.fillRect(lx, ly - 5, 14, 3); ctx.fillStyle = P.muted; ctx.fillText(txt, lx + 20, ly); ly -= 15; }
  }
  function drawCorridor() {
    const ctx = cvCor.getContext('2d'); const [W, H] = size.cor; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.surface; ctx.fillRect(0, 0, W, H);
    const gMin = -30, gMax = -0.2, pad = { l: 16, r: 16 }, pw = W - pad.l - pad.r, X = g => pad.l + (g - gMin) / (gMax - gMin) * pw;   // sol: dik (−30°), sağ: sığ (0°)
    const y0 = 52;
    ctx.fillStyle = P.muted; ctx.font = '10.5px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('GİRİŞ KORİDORU · γ_E taraması (sağ: sığ, sol: dik)', pad.l, 16);
    /* tarama noktaları: iki satır — kaldırma aşağı (yakalama), kaldırma yukarı (limit) */
    if (corridor) {
      for (const s of corridor.sweep) {
        const x = X(s.gamma);
        ctx.fillStyle = s.capturedDown ? 'rgba(143,184,221,.9)' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x, y0 - 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s.outcomeUp !== 'landed' ? 'rgba(255,255,255,.18)' : (s.withinUp ? 'rgba(143,184,221,.9)' : 'rgba(215,143,108,.9)'); ctx.beginPath(); ctx.arc(x, y0 + 10, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = P.muted; ctx.font = '9.5px Inter, sans-serif'; ctx.fillText('kaldırma AŞAĞI: yakalanır mı?', pad.l, y0 - 18); ctx.fillText('kaldırma YUKARI: n ve q̇ limit içinde mi?', pad.l, y0 + 26);
      /* koridor bandı */
      if (Number.isFinite(corridor.gammaOvershoot) && Number.isFinite(corridor.gammaUndershoot)) {
        const xa = X(corridor.gammaOvershoot), xb = X(corridor.gammaUndershoot);
        ctx.fillStyle = 'rgba(217,184,119,.18)'; ctx.fillRect(Math.min(xa, xb), y0 - 16, Math.abs(xb - xa), 32);
        ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.strokeRect(Math.min(xa, xb) + .5, y0 - 16 + .5, Math.abs(xb - xa), 32);
        ctx.fillStyle = P.accent; ctx.font = '600 10.5px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText(`koridor ${nf2.format(corridor.width)}°`, (xa + xb) / 2, y0 + 42);
      }
      /* eksen */
      ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(pad.l, y0 + 52); ctx.lineTo(pad.l + pw, y0 + 52); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center';
      for (let g = -30; g <= 0; g += 5) { ctx.fillText(`${g}°`, X(Math.min(Math.max(g, gMin), gMax)), y0 + 66); }
      /* nominal imleç */
      const xn = X(entry.gammaEntry);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xn, y0 - 22); ctx.lineTo(xn, y0 + 52); ctx.stroke();
      ctx.fillStyle = P.ink; ctx.font = '600 10.5px ui-monospace, monospace'; ctx.fillText(`γ_E ${nf2.format(entry.gammaEntry)}°`, xn, y0 + 80);
    }
  }
  function drawProfile() {
    const ctx = cvProf.getContext('2d'); const [W, H] = size.prof; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.canvas; ctx.fillRect(0, 0, W, H);
    const pad = { l: 44, r: 14, t: 22, b: 30 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const sMax = Math.max(sim.downrange, corridor?.overshootSim?.downrange || 0, 500e3) * 1.05, hMax = entry.hEntry * 1.04;
    const X = s => pad.l + (s.s / sMax) * pw, Y = s => pad.t + ph - (s.h / hMax) * ph;
    /* atmosfer şeridi: yoğunluk log ölçeğinde açık→koyu */
    const grad = ctx.createLinearGradient(0, pad.t + ph, 0, pad.t); grad.addColorStop(0, 'rgba(111,180,255,.22)'); grad.addColorStop(.25, 'rgba(111,180,255,.10)'); grad.addColorStop(.6, 'rgba(111,180,255,.03)'); grad.addColorStop(1, 'rgba(111,180,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(pad.l, pad.t, pw, ph);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = P.muted; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right';
    for (let h = 0; h <= hMax; h += 40e3) { const y = Y({ h }); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.fillText(`${h / 1000}`, pad.l - 5, y + 4); }
    ctx.textAlign = 'center'; { const step = sMax > 6e6 ? 2e6 : sMax > 3e6 ? 1e6 : 500e3; for (let s = 0; s <= sMax; s += step) ctx.fillText(`${s / 1000}`, X({ s }), H - pad.b + 14); }
    ctx.fillStyle = P.ink; ctx.font = '600 10.5px Inter, sans-serif'; ctx.fillText('yer menzili (km) — irtifa (km)', pad.l + pw / 2, H - 6);
    ctx.fillStyle = P.muted; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('profil (düzlemsel, küresel dönmeyen Dünya)', pad.l, 14);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
    if (corridor?.overshootSim) { ctx.strokeStyle = 'rgba(143,184,221,.5)'; ctx.lineWidth = 1; trajPath(ctx, corridor.overshootSim.samples, X, Y); ctx.stroke(); }
    if (corridor?.undershootSim) { ctx.strokeStyle = 'rgba(215,143,108,.6)'; ctx.lineWidth = 1; trajPath(ctx, corridor.undershootSim.samples, X, Y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(233,228,216,.3)'; trajPath(ctx, sim.samples, X, Y); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; trajPath(ctx, sim.samples, X, Y, timeline.t); ctx.stroke();
    const cur = sampleAt(sim, timeline.t);
    /* araç: küçük kapsül silüeti, hız yönünde; ısı akısıyla parlayan kızıl hale (q̇/q̇_tepe, sıfırdan rampalı) */
    const x = X(cur), y = Y(cur), ang = -Math.atan2(cur.gamma, 1) * 0 + Math.atan2(-(cur.v * Math.sin(cur.gamma)) / hMax * ph, (cur.v * Math.cos(cur.gamma)) / sMax * pw);
    const glow = clamp(cur.q / Math.max(1, sim.peakQ.q), 0, 1);
    if (glow > .01) { const g2 = ctx.createRadialGradient(x, y, 2, x, y, 14 + 10 * glow); g2.addColorStop(0, `rgba(255,190,120,${.85 * glow})`); g2.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, 14 + 10 * glow, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(4, -2.5); ctx.lineTo(6, 0); ctx.lineTo(4, 2.5); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
  }
  function draw() {
    if (!sim) return;
    drawHV(); drawCorridor(); drawProfile();
    const c = sampleAt(sim, timeline.t);
    hud.t.textContent = `${nf0.format(c.t)} s`; hud.h.textContent = `${nf1.format(c.h / 1000)} km`; hud.v.textContent = `${nf0.format(c.v)} m/s`;
    hud.g.textContent = `${nf2.format(c.gamma * 180 / Math.PI)}°`; hud.mach.textContent = nf1.format(c.mach); hud.n.textContent = `${nf2.format(c.n)} g`;
    hud.n.className = c.n > entry.nMax ? 'bad' : 'hi';
    hud.q.textContent = `${nf2.format(c.q / 1e6)} MW/m²`; hud.q.className = c.q > entry.qMax ? 'bad' : 'hi';
    hud.Q.textContent = `${nf0.format(c.Q / 1e6)} MJ/m²`; hud.rho.textContent = `${c.rho.toExponential(2)} kg/m³`; hud.dyn.textContent = `${nf1.format(c.dynP / 1000)} kPa`;
    hud.out.textContent = { landed: `iniş · tepe ${nf1.format(sim.peakG.n)} g, ${nf2.format(sim.peakQ.q / 1e6)} MW/m²`, skip: 'SKIP — atmosferden çıktı', orbit: 'yakalanamadı (yörüngede)', escape: 'kaçış' }[sim.outcome];
    hud.out.className = sim.outcome === 'landed' && sim.peakG.n <= entry.nMax && sim.peakQ.q <= entry.qMax ? '' : 'bad';
    const inCor = corridor && entry.gammaEntry <= corridor.gammaOvershoot && entry.gammaEntry >= corridor.gammaUndershoot;
    hud.cor.textContent = corridor && Number.isFinite(corridor.width) ? `${inCor ? 'içinde' : 'DIŞINDA'} · [${nf2.format(corridor.gammaUndershoot)}°, ${nf2.format(corridor.gammaOvershoot)}°]` : 'yok';
    hud.cor.className = inCor ? 'hi' : 'bad';
    doneEl.style.transform = `scaleX(${(timeline.t / sim.duration).toFixed(4)})`;
    for (const n of eventNodes) n.classList.toggle('past', Number(n.dataset.t) <= timeline.t);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing) { timeline.t = Math.min(timeline.duration, timeline.t + dt * timeline.warp); if (timeline.t >= timeline.duration) timeline.playing = false; } draw(); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); if (timeline.playing) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); setup(cvHV, 'hv'); setup(cvCor, 'cor'); setup(cvProf, 'prof'); if (sim) { layoutEvents(); draw(); } }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  recompute(); resize();
  const tableau = () => sim.peakG.t;
  if (reducedMotion || exportMode) timeline.t = tableau(); else if (options.autoplay ?? true) timeline.playing = true;
  draw(); ensureLoop();
  return {
    get sim() { return sim; }, get corridor() { return corridor; }, get entry() { return { ...entry }; }, get vehicleId() { return vehicleId; }, vehicles: VEHICLES, timeline,
    setEntry(e) { entry = { ...entry, ...e }; timeline.t = 0; recompute(); draw(); }, setVehicle(id) { if (VEHICLES[id]) { vehicleId = id; vehicle = VEHICLES[id]; timeline.t = 0; recompute(); draw(); } },
    get tableau() { return tableau(); }, advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.reen__hud').hidden = !v; },
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
