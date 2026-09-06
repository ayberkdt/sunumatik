/* reentry.mjs — Giriş Koridoru Sahnesi (reentry_corridor)

   SOL — GİRİŞ SAHNESİ (irtifa–menzil, düşey abartılı; abartı çarpanı yazılır): katmanlı atmosfer (termosfer /
   mezosfer / stratosfer / troposfer bantları, Kármán çizgisi), ufuk ışıltısı, yüzey; nominal yörünge ISI AKISI ile
   renklenir (mavi → kehribar → beyaz-sıcak), kapsül γ yönünde uçar, çevresinde q̇ ile büyüyen PLAZMA KILIFI ve
   iyonize kuyruk (Sutton–Graves q̇'dan; adlandırılmış fizik: şok katmanı ısınması); koridor sınır yörüngeleri ve
   aralarındaki KORİDOR BÖLGESİ dolgu olarak; olaylar işaretli. Giriş sahnesi: atmosfer katmanları yükselir, sınırlar
   çizilir, yörünge çizilir, kapsül yola çıkar.
   SAĞ — kahraman HUD (yavaşlama, q̇, koridor, sonuç) + (h, v) düzlemi (eş-yavaşlama / eş-ısı eğrileri, sınır
   yörüngeleri) + koridor γ taraması. Alt — olay rayı. Çözücü: reentry-model.mjs (saf).

   API: const re = await mountReentry(host, { vehicle, entry, warp, autoplay });
        re.sim · re.corridor · re.timeline · re.setEntry({...}) · re.setVehicle(id) · re.tableau · re.replay() · re.dispose() */

import { simulateEntry, findCorridor, isoDecelCurve, isoHeatCurve, sampleAt, VEHICLES, DEFAULT_ENTRY } from './reentry-model.mjs';
import { palette, backdrop, polyline, marker, label, title, tag, Entrance, reveal, rgba } from '../core/lab-scene.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
/* ısı akısı → renk (soğuk mavi → kehribar → turuncu → beyaz-sıcak), 0..1 */
function heatColor(t) { t = clamp(t, 0, 1); const stops = [[0, [143, 184, 221]], [.35, [217, 184, 119]], [.7, [255, 150, 70]], [1, [255, 245, 225]]]; for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const f = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]), a = stops[i - 1][1], b = stops[i][1]; return `rgb(${Math.round(mix(a[0], b[0], f))},${Math.round(mix(a[1], b[1], f))},${Math.round(mix(a[2], b[2], f))})`; } return 'rgb(255,245,225)'; }

export async function mountReentry(host, options = {}) {
  if (!host) throw new Error('mountReentry bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'reen';
  figure.innerHTML = `
    <style>
      .reen{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);grid-template-rows:minmax(0,1fr) auto;background:var(--color-canvas,#0b0c10);color:var(--color-ink,#e9e4d8);}
      .reen__scene{position:relative;min-width:0;min-height:0;} .reen canvas.p{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .reen__side{position:relative;min-width:0;min-height:0;border-left:1px solid var(--lab-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr) auto;}
      .reen__hud{padding:12px 16px 10px;border-bottom:1px solid var(--lab-rule,#3a3c42);}
      .reen__hv{position:relative;min-height:0;} .reen__cor{position:relative;height:118px;border-top:1px solid var(--lab-rule,#3a3c42);}
      .reen__events{grid-column:1/-1;position:relative;height:46px;border-top:1px solid var(--lab-rule,#3a3c42);background:var(--lab-panel,var(--color-surface,#15161a));}
      .reen__events .rail{position:absolute;left:24px;right:24px;top:22px;height:2px;background:var(--color-rule,#3a3c42);}
      .reen__events .done{position:absolute;left:0;top:0;height:100%;background:var(--color-accent,#d9b877);transform-origin:left;}
      .reen__events .ev{position:absolute;top:0;height:44px;width:0;font-size:10.5px;letter-spacing:.04em;color:var(--color-muted,#9a938a);white-space:nowrap;font-family:var(--font-body);}
      .reen__events .ev i{position:absolute;left:0;top:19px;width:8px;height:8px;transform:translateX(-50%);border-radius:50%;background:var(--color-canvas,#0b0c10);border:2px solid var(--color-muted,#9a938a);box-sizing:border-box;}
      .reen__events .ev span{position:absolute;left:0;transform:translateX(-50%);line-height:13px;}
      .reen__events .ev.derived{color:var(--color-data-2,#d78f6c);} .reen__events .ev.derived i{border-color:var(--color-data-2,#d78f6c);}
      .reen__events .ev.past{color:var(--color-ink,#e9e4d8);} .reen__events .ev.past i{background:var(--color-accent,#d9b877);border-color:var(--color-accent,#d9b877);}
    </style>
    <div class="reen__scene" data-lab-reveal="fade"><canvas class="p" data-plot="scene" aria-label="Giriş sahnesi: irtifa–menzil"></canvas><div class="lab-top" data-top></div></div>
    <div class="reen__side">
      <div class="reen__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">yavaşlama</span><span class="v hi" data-hud="n">—</span></div>
          <div><span class="k">ısı akısı q̇</span><span class="v hi" data-hud="q">—</span></div>
          <div><span class="k">koridor γ</span><span class="v" data-hud="cor">—</span></div>
          <div><span class="k">sonuç</span><span class="v" data-hud="out">—</span></div>
        </div>
        <dl>
          <dt>t</dt><dd data-hud="t">—</dd><dt>irtifa · hız</dt><dd data-hud="hv">—</dd>
          <dt>γ · Mach</dt><dd data-hud="gm">—</dd><dt>ısı yükü Q</dt><dd data-hud="Q">—</dd>
          <dt>ρ · q_dyn</dt><dd data-hud="rho">—</dd><dt>araç</dt><dd data-hud="veh">—</dd>
        </dl>
        <div class="lab-legend" data-legend></div>
      </div>
      <div class="reen__hv" data-lab-reveal="fade"><canvas class="p" data-plot="hv" aria-label="İrtifa–hız düzlemi"></canvas></div>
      <div class="reen__cor" data-lab-reveal="fade"><canvas class="p" data-plot="cor" aria-label="Giriş koridoru"></canvas></div>
    </div>
    <div class="reen__events" aria-hidden="true"><div class="rail"><div class="done"></div></div></div>`;
  host.appendChild(figure);
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const hud = {}; for (const el of figure.querySelectorAll('[data-hud]')) hud[el.dataset.hud] = el;
  const eventsEl = figure.querySelector('.reen__events'), doneEl = eventsEl.querySelector('.done'), topEl = figure.querySelector('[data-top]'), legendEl = figure.querySelector('[data-legend]');
  const P = palette(figure);
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  legendEl.innerHTML = `<span><i style="background:linear-gradient(90deg,#8fb8dd,#d9b877,#ff9646,#fff5e1)"></i>nominal · ısı akısıyla renkli</span><span><i style="background:${P.data1}"></i>aşma sınırı (kaldırma aşağı)</span><span><i style="background:${P.data2}"></i>altında-kalma sınırı (kaldırma yukarı)</span><span><i style="background:${rgba(P.accent, .35)}"></i>koridor bölgesi</span>`;

  let vehicleId = options.vehicle ?? 'capsule', vehicle = VEHICLES[vehicleId] || VEHICLES.capsule;
  let entry = { ...DEFAULT_ENTRY, ...(options.entry || {}) };
  let sim = null, corridor = null, iso = { g: [], q: [] }, eventNodes = [];
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 4, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); draw(); }, setWarp(w) { this.warp = w; } };
  const entrance = new Entrance({ sky: { at: 0, dur: .9 }, layers: { at: .3, dur: .9 }, bounds: { at: .8, dur: .9 }, path: { at: 1.0, dur: 1.4 }, hv: { at: .6, dur: 1.2 } }, { onFrame: () => draw() });

  function recompute() {
    sim = simulateEntry(vehicle, entry);
    corridor = findCorridor(vehicle, entry);
    iso.g = [1, 3, 5, 10, 20].map(n => ({ n, pts: isoDecelCurve(sim.beta, n, 20e3, entry.hEntry) }));
    iso.q = [0.5e6, 1e6, 2e6, 5e6].map(q => ({ q, pts: isoHeatCurve(vehicle.rn, q, 20e3, entry.hEntry) }));
    timeline.duration = sim.duration; timeline.t = Math.min(timeline.t, sim.duration);
    buildEvents();
    topEl.textContent = `${vehicle.label} · v_E ${nf0.format(entry.vEntry)} m/s, γ_E ${nf2.format(entry.gammaEntry)}°, yatış ${entry.bank}° · düşey ölçek abartılı · plazma kılıfı q̇ (Sutton–Graves) ile ölçekli`;
    hud.veh.textContent = `β ${nf0.format(sim.beta)} kg/m² · L/D ${nf2.format(vehicle.ld)} · r_n ${nf1.format(vehicle.rn)} m`;
  }
  function buildEvents() {
    for (const n of eventNodes) n.remove(); eventNodes = [];
    for (const e of sim.events) { const div = document.createElement('div'); div.className = 'ev' + (e.derived ? ' derived' : ''); div.dataset.t = String(e.t); div.innerHTML = `<span>${e.label}${e.q ? ` · ${nf2.format(e.q / 1e6)} MW/m²` : ''}${e.n ? ` · ${nf1.format(e.n)} g` : ''}</span><i></i>`; eventsEl.appendChild(div); eventNodes.push(div); }
    layoutEvents();
  }
  function layoutEvents() {
    const W = Math.max(60, eventsEl.clientWidth - 48), lanes = [];
    for (const div of eventNodes) { const x = 24 + Number(div.dataset.t) / sim.duration * W, w = div.firstElementChild.getBoundingClientRect().width || 60; let lane = 0; while (lane < 6 && lanes[lane] != null && x - w / 2 < lanes[lane] + 8) lane++; lanes[lane] = x + w / 2; div.style.left = `${x.toFixed(1)}px`; const above = lane % 2 === 0, k = Math.floor(lane / 2); div.querySelector('span').style.top = above ? `${4 - k * 13}px` : `${28 + k * 13}px`; }
  }

  let dpr = 1;
  const setup = cv => { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); };
  const path = (S, X, Y, upTo = Infinity) => { const out = []; for (const s of S) { if (s.t > upTo) break; out.push([X(s), Y(s)]); } return out; };

  /* ── SAHNE ─────────────────────────────────────────────────────────────── */
  function drawScene() {
    const cv = plots.scene, ctx = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = { l: 54, r: 18, t: 36, b: 40 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    /* yatay ölçek: nominal ve altında-kalma sınırı tam görünür; aşma (skip) yörüngesi çerçeveden çıkarken kırpılır */
    const sMax = Math.max(sim.downrange * 1.12, (corridor?.undershootSim?.downrange || 0) * 1.05, 400e3), hMax = 125e3;
    const X = s => pad.l + (s.s / sMax) * pw, Y = s => pad.t + ph - (s.h / hMax) * ph;
    const pSky = entrance.progress('sky'), pLay = entrance.progress('layers'), pB = entrance.progress('bounds'), pP = entrance.progress('path');
    backdrop(ctx, W, H, { canvas: P.canvas });
    /* gökyüzü: uzay → termosfer moru → alçak atmosfer mavisi (düz dikey gradyan) */
    const sky = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    sky.addColorStop(0, 'rgba(8,9,14,0)'); sky.addColorStop(.25, `rgba(52,40,92,${.22 * pSky})`); sky.addColorStop(.6, `rgba(40,80,150,${.28 * pSky})`); sky.addColorStop(.9, `rgba(90,150,215,${.45 * pSky})`); sky.addColorStop(1, `rgba(150,200,240,${.6 * pSky})`);
    ctx.fillStyle = sky; ctx.fillRect(pad.l, pad.t, pw, ph);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
    /* katmanlar: yüzeyden yukarı sırayla belirir */
    const layers = [[0, 12e3, 'troposfer', 'rgba(255,255,255,.045)'], [12e3, 50e3, 'stratosfer', 'rgba(255,255,255,.028)'], [50e3, 85e3, 'mezosfer', 'rgba(255,255,255,.016)'], [85e3, 125e3, 'termosfer', 'rgba(255,255,255,.008)']];
    layers.forEach(([h0, h1, name, col], i) => { const a = clamp(pLay * 4 - i, 0, 1); if (a <= 0) return; ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(pad.l, Y({ h: h1 }), pw, Y({ h: h0 }) - Y({ h: h1 })); ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.moveTo(pad.l, Y({ h: h1 }) + .5); ctx.lineTo(pad.l + pw, Y({ h: h1 }) + .5); ctx.stroke(); ctx.globalAlpha = 1; label(ctx, `${name} · ${h1 / 1000} km`, pad.l + pw - 8, Y({ h: h1 }) + 12, P, { align: 'right', mono: false, size: 10.5, color: rgba('#ffffff', .45 * a) }); });
    ctx.save(); ctx.globalAlpha = pLay; ctx.setLineDash([3, 6]); ctx.strokeStyle = rgba(P.accent, .45); ctx.beginPath(); ctx.moveTo(pad.l, Y({ h: 100e3 })); ctx.lineTo(pad.l + pw, Y({ h: 100e3 })); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    if (pLay > .8) label(ctx, 'Kármán çizgisi 100 km', pad.l + 8, Y({ h: 100e3 }) - 5, P, { mono: false, size: 10.5, color: rgba(P.accent, .8) });
    /* koridor bölgesi: sınır yörüngeleri arası dolgu */
    if (corridor?.overshootSim && corridor?.undershootSim && pB > 0) {
      const A = path(corridor.overshootSim.samples, X, Y), B = path(corridor.undershootSim.samples, X, Y);
      ctx.save(); ctx.globalAlpha = .22 * pB; const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph); g.addColorStop(0, rgba(P.accent, .05)); g.addColorStop(1, rgba(P.accent, .55)); ctx.fillStyle = g; ctx.beginPath(); A.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]); ctx.closePath(); ctx.fill(); ctx.restore();
      polyline(ctx, A, { progress: pB, color: P.data1, width: 1.1, alpha: .75, dash: [5, 5] }); polyline(ctx, B, { progress: pB, color: P.data2, width: 1.1, alpha: .8, dash: [5, 5] });
      if (pB > .9) { const a = A[Math.floor(A.length * .55)], b = B[Math.floor(B.length * .55)]; if (a) tag(ctx, `aşma sınırı γ ${nf2.format(corridor.gammaOvershoot)}°`, a[0] + 8, a[1] - 12, P, { color: P.data1 }); if (b) tag(ctx, `altında-kalma γ ${nf2.format(corridor.gammaUndershoot)}°`, b[0] + 8, b[1] + 14, P, { color: P.data2 }); }
    }
    /* nominal yörünge: soluk tam iz + t'ye kadar ısı renkli kalın iz */
    polyline(ctx, path(sim.samples, X, Y), { progress: pP, color: 'rgba(233,228,216,.22)', width: 1 });
    const tNow = Math.min(timeline.t, sim.duration * pP), qPk = Math.max(1, sim.peakQ.q);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < sim.samples.length; i++) { const s0 = sim.samples[i - 1], s1 = sim.samples[i]; if (s1.t > tNow) break; const hq = clamp(s1.q / qPk, 0, 1); ctx.strokeStyle = heatColor(hq); ctx.lineWidth = 2 + 2.5 * hq; ctx.beginPath(); ctx.moveTo(X(s0), Y(s0)); ctx.lineTo(X(s1), Y(s1)); ctx.stroke(); }
    ctx.restore();
    for (const e of sim.events) { if (e.t > tNow || !e.h) continue; const sp = sampleAt(sim, e.t); marker(ctx, X(sp), Y(sp), 2.5, e.derived ? P.data2 : P.muted, { ring: false }); }
    /* kapsül + plazma kılıfı + iyonize kuyruk (q̇ ile ölçekli, sıfırdan rampalı) */
    const cur = sampleAt(sim, tNow), x = X(cur), y = Y(cur);
    const ang = Math.atan2(-(cur.v * Math.sin(cur.gamma)) / hMax * ph, (cur.v * Math.cos(cur.gamma)) / sMax * pw);
    const heat = clamp(cur.q / qPk, 0, 1);
    if (heat > .02 && pP >= 1) {
      const len = 26 + 70 * heat; ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      for (let k = 0; k < 9; k++) { const f = k / 8, r = (10 + 14 * heat) * (1 - .55 * f), cx = -f * len; const gg = ctx.createRadialGradient(cx, 0, 0, cx, 0, r); gg.addColorStop(0, `rgba(255,230,190,${.55 * heat * (1 - f)})`); gg.addColorStop(.5, `rgba(255,150,70,${.32 * heat * (1 - f)})`); gg.addColorStop(1, 'rgba(255,90,40,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, 0, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = pP;
    ctx.fillStyle = heat > .3 ? heatColor(.35 + .4 * heat) : P.ink; ctx.beginPath(); ctx.moveTo(7, 0); ctx.quadraticCurveTo(7, -6, 2, -6); ctx.lineTo(-8, -2.5); ctx.lineTo(-8, 2.5); ctx.lineTo(2, 6); ctx.quadraticCurveTo(7, 6, 7, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(20,16,10,.9)'; ctx.beginPath(); ctx.moveTo(-8, -2.5); ctx.lineTo(-2, -1.5); ctx.lineTo(-2, 1.5); ctx.lineTo(-8, 2.5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
    /* yüzey: koyu bant + ufuk ışıltısı */
    const ground = ctx.createLinearGradient(0, pad.t + ph - 6, 0, pad.t + ph + 30); ground.addColorStop(0, `rgba(120,170,220,${.35 * pSky})`); ground.addColorStop(.3, '#101820'); ground.addColorStop(1, '#0a0e14'); ctx.fillStyle = ground; ctx.fillRect(pad.l, pad.t + ph - 4, pw, pad.b + 4);
    /* eksenler */
    label(ctx, 'irtifa (km)', 14, pad.t - 10, P, { mono: false, size: 11, color: P.ink, weight: 600 });
    for (let h = 0; h <= hMax; h += 25e3) label(ctx, `${h / 1000}`, pad.l - 8, Y({ h }) + 4, P, { align: 'right' });
    const step = sMax > 6e6 ? 2e6 : sMax > 3e6 ? 1e6 : 500e3; for (let s = 0; s <= sMax; s += step) label(ctx, `${s / 1000}`, X({ s }), H - pad.b + 16, P, { align: 'center' });
    label(ctx, `yer menzili (km) · düşey abartı ×${nf0.format((ph / hMax) / (pw / sMax))}`, pad.l + pw / 2, H - 8, P, { align: 'center', mono: false, size: 11, color: P.ink, weight: 600 });
    if (heat > .05 && pP >= 1) tag(ctx, `q̇ ${nf2.format(cur.q / 1e6)} MW/m² · ${nf1.format(cur.n)} g`, x + (x > pad.l + pw * .7 ? -16 : 16), y - 18, P, { color: heatColor(.35 + .6 * heat), mono: true, anchor: x > pad.l + pw * .7 ? 'right' : 'left' });
  }
  /* ── (h, v) DÜZLEMİ ─────────────────────────────────────────────────────── */
  function drawHV() {
    const cv = plots.hv, ctx = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W, H, { canvas: P.canvas }); const pHv = entrance.progress('hv');
    const pad = { l: 46, r: 14, t: 24, b: 30 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const vMax = Math.max(entry.vEntry * 1.08, 8500), hMax = entry.hEntry * 1.04;
    const X = s => pad.l + (s.v / vMax) * pw, Y = s => pad.t + ph - (s.h / hMax) * ph;
    title(ctx, '(h, v) düzlemi · kesikli: eş-yavaşlama g · noktalı: eş-ısı-akısı MW/m²', pad.l, 15, P);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; for (let v = 0; v <= vMax; v += 2000) { const x = X({ v }); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); label(ctx, `${v / 1000}`, x, H - pad.b + 14, P, { align: 'center' }); }
    for (let h = 0; h <= hMax; h += 40e3) { const y = Y({ h }); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); label(ctx, `${h / 1000}`, pad.l - 6, y + 4, P, { align: 'right' }); }
    label(ctx, 'km/s', pad.l + pw - 4, H - 6, P, { align: 'right', mono: false, size: 10.5 }); label(ctx, 'km', pad.l - 6, pad.t - 4, P, { align: 'right', mono: false, size: 10.5 });
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
    iso.g.forEach((c, i) => { polyline(ctx, path(c.pts, X, Y), { progress: pHv, color: rgba(P.data2, .5), width: 1, dash: [4, 4] }); const p = c.pts.find(p => p.h >= 70e3 + i * 8e3); if (p && p.v < vMax * .98 && pHv > .9) label(ctx, `${c.n} g`, X(p) + 3, Y(p) - 3, P, { color: rgba(P.data2, .9), size: 9.5 }); });
    iso.q.forEach((c, i) => { polyline(ctx, path(c.pts, X, Y), { progress: pHv, color: rgba(P.accent, .5), width: 1, dash: [1.5, 3] }); const p = c.pts.find(p => p.h >= 34e3 + i * 9e3); if (p && p.v < vMax && pHv > .9) label(ctx, `${c.q / 1e6}`, X(p) + 3, Y(p) + 10, P, { color: rgba(P.accent, .9), size: 9.5 }); });
    if (corridor?.overshootSim) polyline(ctx, path(corridor.overshootSim.samples, X, Y), { progress: pHv, color: rgba(P.data1, .75), width: 1.2 });
    if (corridor?.undershootSim) polyline(ctx, path(corridor.undershootSim.samples, X, Y), { progress: pHv, color: rgba(P.data2, .85), width: 1.2 });
    polyline(ctx, path(sim.samples, X, Y), { progress: pHv, color: 'rgba(233,228,216,.28)', width: 1 });
    const tNow = Math.min(timeline.t, sim.duration * pHv), qPk = Math.max(1, sim.peakQ.q);
    ctx.lineCap = 'round'; for (let i = 1; i < sim.samples.length; i++) { const s0 = sim.samples[i - 1], s1 = sim.samples[i]; if (s1.t > tNow) break; ctx.strokeStyle = heatColor(clamp(s1.q / qPk, 0, 1)); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(s0), Y(s0)); ctx.lineTo(X(s1), Y(s1)); ctx.stroke(); }
    const cur = sampleAt(sim, tNow); marker(ctx, X(cur), Y(cur), 4.5, P.accent, { ringAlpha: .5 });
    ctx.restore();
  }
  /* ── KORİDOR ÇUBUĞU ────────────────────────────────────────────────────── */
  function drawCorridor() {
    const cv = plots.cor, ctx = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, W, H, { canvas: P.surface });
    const gMin = -30, gMax = -0.2, pad = { l: 18, r: 18 }, pw = W - pad.l - pad.r, X = g => pad.l + (g - gMin) / (gMax - gMin) * pw, y0 = 50;
    title(ctx, 'giriş koridoru · γ_E taraması (sol: dik, sağ: sığ)', pad.l, 15, P);
    if (!corridor) return;
    for (const s of corridor.sweep) { const x = X(s.gamma); marker(ctx, x, y0 - 10, 2.6, s.capturedDown ? P.data1 : 'rgba(255,255,255,.2)', { ring: false }); marker(ctx, x, y0 + 10, 2.6, s.outcomeUp !== 'landed' ? 'rgba(255,255,255,.2)' : (s.withinUp ? P.data1 : P.data2), { ring: false }); }
    label(ctx, 'kaldırma AŞAĞI · yakalanır mı?', pad.l, y0 - 18, P, { mono: false, size: 9.5 }); label(ctx, 'kaldırma YUKARI · n ve q̇ limit içinde mi?', pad.l, y0 + 26, P, { mono: false, size: 9.5 });
    if (Number.isFinite(corridor.gammaOvershoot) && Number.isFinite(corridor.gammaUndershoot)) {
      const xa = X(corridor.gammaOvershoot), xb = X(corridor.gammaUndershoot); const g = ctx.createLinearGradient(Math.min(xa, xb), 0, Math.max(xa, xb), 0); g.addColorStop(0, rgba(P.data2, .25)); g.addColorStop(1, rgba(P.data1, .25));
      ctx.fillStyle = g; ctx.fillRect(Math.min(xa, xb), y0 - 16, Math.abs(xb - xa), 32); ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.strokeRect(Math.min(xa, xb) + .5, y0 - 15.5, Math.abs(xb - xa), 32);
      tag(ctx, `koridor ${nf2.format(corridor.width)}°`, (xa + xb) / 2, y0 + 48, P, { color: P.accent, mono: true, anchor: 'center' });
    }
    ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(pad.l, y0 + 60); ctx.lineTo(pad.l + pw, y0 + 60); ctx.stroke();
    for (let g = -30; g <= 0; g += 5) label(ctx, `${g}°`, X(clamp(g, gMin, gMax)), y0 + 74, P, { align: 'center' });
    const xn = X(entry.gammaEntry); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xn, y0 - 22); ctx.lineTo(xn, y0 + 60); ctx.stroke(); label(ctx, `γ_E ${nf2.format(entry.gammaEntry)}°`, xn, y0 + 88, P, { align: 'center', color: P.ink, weight: 600 });
  }
  function draw() {
    if (!sim) return;
    drawScene(); drawHV(); drawCorridor();
    const c = sampleAt(sim, timeline.t);
    hud.t.textContent = `${nf0.format(c.t)} s`; hud.hv.textContent = `${nf1.format(c.h / 1000)} km · ${nf0.format(c.v)} m/s`; hud.gm.textContent = `${nf2.format(c.gamma * 180 / Math.PI)}° · M ${nf1.format(c.mach)}`;
    hud.n.innerHTML = `${nf2.format(c.n)}<span class="u">g</span>`; hud.n.className = c.n > entry.nMax ? 'v bad' : 'v hi';
    hud.q.innerHTML = `${nf2.format(c.q / 1e6)}<span class="u">MW/m²</span>`; hud.q.className = c.q > entry.qMax ? 'v bad' : 'v hi';
    hud.Q.textContent = `${nf0.format(c.Q / 1e6)} MJ/m²`; hud.rho.textContent = `${c.rho.toExponential(1)} kg/m³ · ${nf1.format(c.dynP / 1000)} kPa`;
    hud.out.textContent = { landed: `iniş · ${nf1.format(sim.peakG.n)} g`, skip: 'SKIP', orbit: 'yakalanamadı', escape: 'kaçış' }[sim.outcome];
    hud.out.className = sim.outcome === 'landed' && sim.peakG.n <= entry.nMax && sim.peakQ.q <= entry.qMax ? 'v ok' : 'v bad';
    const inCor = corridor && entry.gammaEntry <= corridor.gammaOvershoot && entry.gammaEntry >= corridor.gammaUndershoot;
    hud.cor.innerHTML = corridor && Number.isFinite(corridor.width) ? `${nf2.format(corridor.width)}<span class="u">° · ${inCor ? 'içinde' : 'DIŞINDA'}</span>` : 'yok';
    hud.cor.className = inCor ? 'v hi' : 'v bad';
    doneEl.style.transform = `scaleX(${(timeline.t / sim.duration).toFixed(4)})`;
    for (const n of eventNodes) n.classList.toggle('past', Number(n.dataset.t) <= timeline.t);
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing && entrance.done) { timeline.t = Math.min(timeline.duration, timeline.t + dt * timeline.warp); if (timeline.t >= timeline.duration) timeline.playing = false; } draw(); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); if (timeline.playing) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) setup(cv); if (sim) { layoutEvents(); draw(); } }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure); recompute(); resize();
  const tableau = () => sim.peakG.t;
  if (reducedMotion || exportMode) timeline.t = tableau(); else if (options.autoplay ?? true) timeline.playing = true;
  entrance.start(); draw(); ensureLoop();
  return {
    get sim() { return sim; }, get corridor() { return corridor; }, get entry() { return { ...entry }; }, get vehicleId() { return vehicleId; }, vehicles: VEHICLES, timeline,
    setEntry(e) { entry = { ...entry, ...e }; timeline.t = 0; recompute(); draw(); }, setVehicle(id) { if (VEHICLES[id]) { vehicleId = id; vehicle = VEHICLES[id]; timeline.t = 0; recompute(); draw(); entrance.start(); } },
    get tableau() { return tableau(); }, replay() { entrance.start(); }, advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } }, hud(v) { figure.querySelector('.reen__hud').hidden = !v; },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
