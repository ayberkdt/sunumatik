/* three-body.mjs — "Üç-Cisim Durumları" sahnesi (three_body_states). 2B tuval, THREE gerekmez.

   Siyah zemin üzerinde 5×4 pano: her panoda düzlemsel üç-cisim probleminin bir periyodik çözümü canlı entegre
   edilir (three-body-model.mjs, RK4 uyarlanır adım). Görünüm: ışık kaynağı olarak cisimler (sıcak çekirdek +
   yumuşak hale), arkalarında üstel sönen ışıklı iz. İz KALICI TUVALDE tutulur: her karede yalnız yeni parça
   çizilir ve tuval e^(−dt/τ) ile soldurulur — binlerce parçayı yeniden çizmek yerine 3 kısa vuruş; bu yüzden
   60 fps. Her panonun zamanı görsel hıza göre normalize edilir (ortalama ekran hızı ~sabit) — hızlı ve yavaş
   çözümler aynı tempoda izlenir. Renkler üç cisim için sabit (turuncu · krem · mavi). Kaotik Pisagor problemi
   kaçışla biter ve baştan başlar.

   SİNEMA modu: tek çözüm tam kadrajda, alt yazıda ad · kaynak · periyot; pano ızgaradan kadraja yumuşak büyür (morf), sonra iz
   yeniden birikir; otomatik geçiş (dwell) ile çözümler sırayla akar — ekran koruyucu kullanımı.

   API: const tb = await mountThreeBody(host, { t, speed, labels, autoplay, mode:'grid'|'cinema', index, dwell });
        tb.timeline{t, playing, speed, play(), pause(), scrub(t)} · tb.cinema(on, index?) · tb.next() · tb.prev() · tb.view
        · tb.catalog · tb.advance(dt) · tb.replay() · tb.setActive(v) · tb.dispose() */

import { CATALOG, sampleOrbit, advance, minDistance } from './three-body-model.mjs';
import { staticMode, Entrance, reveal, palette, ease } from '../core/lab-scene.mjs';

export const BODY_COLORS = ['#ff7326', '#ffe6c4', '#8c9dff'];
const RGB = BODY_COLORS.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const rgba = (i, a) => `rgba(${RGB[i][0]},${RGB[i][1]},${RGB[i][2]},${a})`;
const dim = (i, k) => `rgb(${Math.round(RGB[i][0] * k)},${Math.round(RGB[i][1] * k)},${Math.round(RGB[i][2] * k)})`;   // OPAK sönük renk: toplamsal birleşimde zayıf ışıma, üst üste binen parçalarda boncuk yok
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountThreeBody(host, options = {}) {
  if (!host) throw new Error('mountThreeBody bir kap ister');
  const figure = document.createElement('figure'); figure.className = 'tb';
  figure.innerHTML = `<style>
      .tb{position:relative;margin:0;width:100%;height:100%;overflow:hidden;background:#000;} .tb canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .tb__cap{position:absolute;left:14px;bottom:10px;font:500 11px/1.4 var(--font-body,system-ui);letter-spacing:.06em;color:rgba(255,255,255,.42);pointer-events:none;}
    </style><canvas aria-label="Üç-cisim periyodik çözümleri"></canvas><div class="tb__cap" data-cap></div>`;
  host.appendChild(figure);
  const cv = figure.querySelector('canvas'), ctx = cv.getContext('2d'), capEl = figure.querySelector('[data-cap]');
  const trailCv = document.createElement('canvas'), tctx = trailCv.getContext('2d');   // kalıcı iz tuvali (renk, uzun ömür)
  const hotCv = document.createElement('canvas'), hctx = hotCv.getContext('2d');       // sıcak çekirdek tuvali (beyaz, kısa ömür → başa yakın beyaz-sıcak, geriye doğru renge döner)
  const pathCv = document.createElement('canvas'), pctx = pathCv.getContext('2d');     // tam periyot yolları (statik)
  const P = palette(figure);
  let showLabels = options.labels ?? false;
  /* sinema durumu: mode, seçili indeks, morf ilerlemesi (0 ızgara → 1 kadraj), geçiş solması, otomatik geçiş süresi */
  const view = { mode: options.mode === 'cinema' ? 'cinema' : 'grid', idx: clamp(options.index ?? 0, 0, CATALOG.length - 1), morph: options.mode === 'cinema' ? 1 : 0, fade: 1, dwell: options.dwell ?? 0, dwellT: 0, switching: null };
  const entrance = new Entrance({ panels: { at: 0, dur: 1.4 } }, { onFrame: () => draw() });

  /* ── panolar ─────────────────────────────────────────────────────────── */
  const panels = CATALOG.map(entry => {
    const m = entry.masses, orbit = entry.chaotic ? null : sampleOrbit(entry, { n: 900 });
    const bb = orbit ? orbit.bbox : { xmin: -3.4, xmax: 3.4, ymin: -3.4, ymax: 3.4 };
    const half = Math.max(bb.xmax - bb.xmin, bb.ymax - bb.ymin) / 2 * 1.14 || 1, cx = (bb.xmin + bb.xmax) / 2, cy = (bb.ymin + bb.ymax) / 2;
    /* görsel hız normalizasyonu: ortalama cisim hızı (pano-kesri / zaman birimi) → hedef tempo */
    let k = 1;
    if (orbit) { let sum = 0, n = 0; const dt = entry.T / (orbit.pts[0].length - 1); for (let b = 0; b < 3; b++) for (let i = 1; i < orbit.pts[b].length; i++) { sum += Math.hypot(orbit.pts[b][i][0] - orbit.pts[b][i - 1][0], orbit.pts[b][i][1] - orbit.pts[b][i - 1][1]) / dt; n++; } const meanNorm = (sum / n) * (.43 / half); k = clamp(.17 / Math.max(1e-6, meanNorm), .3, 2.4); }
    const tau = entry.chaotic ? 4 : clamp(entry.T * .22, 1.2, 6);   // iz ömrü (pano zamanı)
    return { entry, m, orbit, half, cx, cy, k, tau, st: Float64Array.from(entry.state()), t: 0, prev: null, seg: [] };
  });
  const resetPanel = p => { p.st = Float64Array.from(p.entry.state()); p.t = 0; p.prev = null; p.seg = []; };
  /* dt (küresel zaman) kadar ilerlet: pano zamanı dt·k; alt adımlarda konumları biriktir (bu kare çizilecek parça) */
  const stepPanel = (p, dt) => {
    if (p.entry.chaotic && (p.t > p.entry.T || Math.max(...[0, 1, 2].map(b => Math.hypot(p.st[2 * b], p.st[2 * b + 1]))) > 9)) { resetPanel(p); p.cleared = true; }
    const dp = dt * p.k, sub = Math.max(1, Math.ceil(dp / .015)), h = dp / sub;
    for (let s = 0; s < sub; s++) { advance(p.st, p.m, h, p.entry.chaotic ? { hMax: 1e-3, k: 2e-3 } : { hMax: 2e-3, k: 4e-3 }); p.t += h; p.seg.push([p.st[0], p.st[1], p.st[2], p.st[3], p.st[4], p.st[5]]); }
    return dp;
  };
  const timeline = { t: 0, playing: false, speed: options.speed ?? 1, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = Math.max(0, t); seekTo(this.t); draw(); } };

  /* ── yerleşim ve iz tuvali ───────────────────────────────────────────── */
  let dpr = 1, W = 0, H = 0, L = null;
  function layout() {
    const n = panels.length, cols = W >= H * 1.05 ? 5 : 4, rows = Math.ceil(n / cols), pw = W / cols, ph = H / rows; L = { cols, rows, pw, ph, s: Math.min(pw, ph) };
    const m = ease.inOutCubic(clamp(view.morph, 0, 1)), full = { ox: W / 2, oy: H / 2 - (H > W ? 0 : H * .02), s: Math.min(W, H) * .88, rx: 0, ry: 0, w: W, h: H };
    panels.forEach((p, i) => {
      const g = { ox: (i % cols) * pw + pw / 2, oy: Math.floor(i / cols) * ph + ph / 2, s: L.s * .86, rx: (i % cols) * pw, ry: Math.floor(i / cols) * ph, w: pw, h: ph };
      const f = i === view.idx ? m : 0; const mix = (a, b) => a + (b - a) * f;
      p.ox = mix(g.ox, full.ox); p.oy = mix(g.oy, full.oy); p.sc = mix(g.s, full.s) * .5 / p.half; p.rx = mix(g.rx, full.rx); p.ry = mix(g.ry, full.ry); p.rw = mix(g.w, full.w); p.rh = mix(g.h, full.h);
      p.alpha = i === view.idx ? 1 : 1 - m;   // sinemada diğer panolar söner
    });
  }
  const X = (p, x) => p.ox + (x - p.cx) * p.sc, Y = (p, y) => p.oy - (y - p.cy) * p.sc;
  function drawPaths() {
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0); pctx.clearRect(0, 0, W, H); pctx.lineWidth = 1;
    for (const p of panels) { if (!p.orbit || p.entry.T >= 32 || p.alpha <= 0) continue; pctx.globalAlpha = p.alpha; for (let b = 0; b < 3; b++) { const pts = p.orbit.pts[b]; pctx.strokeStyle = rgba(b, .075); pctx.beginPath(); for (let k = 0; k < pts.length; k++) { const x = X(p, pts[k][0]), y = Y(p, pts[k][1]); k ? pctx.lineTo(x, y) : pctx.moveTo(x, y); } pctx.stroke(); } }
  }
  /* iz tuvali: soldur (destination-out) + yeni parçaları toplamsal çiz */
  function paintTrails(dtGlobal) {
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of panels) {
      if (p.cleared) { tctx.clearRect(p.rx, p.ry, p.rw, p.rh); hctx.clearRect(p.rx, p.ry, p.rw, p.rh); p.cleared = false; }
      if (p.alpha <= 0 || (view.mode === 'cinema' && view.morph < 1)) { p.seg = []; p.prev = null; continue; }   // sinemaya geçişte iz yeniden birikir
      const f = clamp(Math.min(p.rw, p.rh) / 300, 1, 2.3), tau = p.tau * (view.mode === 'cinema' && view.morph >= 1 ? 1.7 : 1);   // büyük kadrajda vuruşlar ve iz ömrü büyür
      const dp = dtGlobal * p.k, tauH = tau * .16, rT = Math.exp(-dp / tau), rH = Math.exp(-dp / tauH);
      if (dp > 0) { for (const [c, r] of [[tctx, rT], [hctx, rH]]) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = `rgba(0,0,0,${1 - r})`; c.fillRect(p.rx, p.ry, p.rw, p.rh); } }
      if (!p.seg.length) continue;
      /* source-over + yuvarlak uç: ardışık kare parçaları eklemde ne boşluk ne parlak nokta bırakır (toplamsal karışım yalnız tuvaller
         birleştirilirken); halo ve renk uzun ömürlü tuvale, beyaz-sıcak çekirdek kısa ömürlü tuvale */
      for (const c of [tctx, hctx]) { c.globalCompositeOperation = 'source-over'; c.lineCap = 'round'; c.lineJoin = 'round'; }
      for (let b = 0; b < 3; b++) {
        const start = p.prev ? p.prev : p.seg[0], end = p.seg[p.seg.length - 1]; const path = new Path2D(); path.moveTo(X(p, start[2 * b]), Y(p, start[2 * b + 1])); for (const s of p.seg) path.lineTo(X(p, s[2 * b]), Y(p, s[2 * b + 1]));
        /* parça boyunca alfa gradyanı: eski uç bir önceki solmuş parçayla (r) aynı alfada başlar, yeni uç 1 — iz boyunca alfa sürekli e^(−yaş/τ),
           basamak/boncuk yok; vuruşlar opak renkle, ışıma toplamsal birleşimle */
        const gx0 = X(p, start[2 * b]), gy0 = Y(p, start[2 * b + 1]), gx1 = X(p, end[2 * b]), gy1 = Y(p, end[2 * b + 1]);
        const grad = (c, col, r) => { if (Math.abs(gx1 - gx0) + Math.abs(gy1 - gy0) < .01) return col(1); const g = c.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, col(r)); g.addColorStop(1, col(1)); return g; };
        const dimA = (k, a) => `rgba(${Math.round(RGB[b][0] * k)},${Math.round(RGB[b][1] * k)},${Math.round(RGB[b][2] * k)},${a})`;
        /* yalnız ince renk gövdesi: hale, birleştirmede bulanıklaştırılmış kopyadan gelir (parça eklemleri yok → pürüzsüz ışıma) */
        tctx.strokeStyle = grad(tctx, a => dimA(1, a * .9), rT); tctx.lineWidth = 1.4 * f; tctx.stroke(path);
        hctx.strokeStyle = grad(hctx, a => `rgba(255,255,255,${a * .8})`, rH); hctx.lineWidth = .6 * f; hctx.stroke(path);   // beyaz-sıcak çekirdek (hızlı söner)
      }
      p.prev = p.seg[p.seg.length - 1]; p.seg = [];
    }
    tctx.globalCompositeOperation = 'source-over'; hctx.globalCompositeOperation = 'source-over';
  }
  /* t'ye git: baştan yeniden entegre; izi parça parça soldurarak yeniden kur (deterministik) */
  function seekTo(t) {
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, W, H); hctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.clearRect(0, 0, W, H);
    for (const p of panels) resetPanel(p);
    /* ince parçalar (1/48 s): iz sürekli kalır; görünür pencerenin (en uzun 4τ) dışında kalan kısım yalnız entegre edilir, çizilmez */
    const win = Math.max(...panels.map(p => 4 * p.tau * 1.7 / p.k));
    let left = t; while (left > 1e-9) { const dt = Math.min(1 / 48, left); for (const p of panels) stepPanel(p, dt); if (left <= win) paintTrails(dt); else for (const p of panels) { p.prev = p.seg[p.seg.length - 1] || p.prev; p.seg = []; } left -= dt; }
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const pE = entrance.progress('panels');
    /* birleştirme: soluk tam yol; iz rengi iki bulanık kopya (dar + geniş ışıma) + keskin gövde; beyaz-sıcak çekirdek — hepsi toplamsal (ışık) */
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(pathCv, 0, 0); ctx.globalCompositeOperation = 'lighter';
    const fb = clamp(Math.min(W, H) / 600, 1, 2.2) * dpr; ctx.filter = `blur(${(3 * fb).toFixed(1)}px)`; ctx.globalAlpha = .55; ctx.drawImage(trailCv, 0, 0); ctx.filter = `blur(${(12 * fb).toFixed(1)}px)`; ctx.globalAlpha = .5; ctx.drawImage(trailCv, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = .95; ctx.drawImage(trailCv, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(hotCv, 0, 0); ctx.restore();
    panels.forEach((p, i) => {
      const a = clamp(pE * panels.length * .5 - i * .35, 0, 1) * p.alpha * (i === view.idx ? view.fade : 1);
      if (a < 1 && p.alpha > 0) { ctx.fillStyle = `rgba(0,0,0,${1 - a})`; ctx.fillRect(p.rx, p.ry, p.rw, p.rh); }
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) {
        const f = clamp(Math.min(p.rw, p.rh) / 300, 1, 2.3), x = X(p, p.st[2 * b]), y = Y(p, p.st[2 * b + 1]), r = (2.4 + (p.m[b] > 1 ? .5 * Math.sqrt(p.m[b] - 1) : 0)) * f, R = 16 * f;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, rgba(b, .62)); g.addColorStop(.3, rgba(b, .24)); g.addColorStop(1, rgba(b, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(b, 1); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x, y, r * .55, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (showLabels && view.morph < .5) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `500 ${Math.max(9, L.s * .055)}px ${P.body}`; ctx.textAlign = 'center'; ctx.fillText(p.entry.name + (p.entry.chaotic ? ' · kaotik' : ''), p.ox, p.oy + L.s * .47); }
      ctx.restore();
    });
    /* sinema alt yazısı: ad · kaynak · periyot · kütleler; sağ altta sıra */
    if (view.morph > .6) { const e = panels[view.idx].entry, a = clamp((view.morph - .6) / .4, 0, 1) * view.fade, pad = Math.max(22, Math.min(W, H) * .04); ctx.save(); ctx.globalAlpha = a; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = `600 ${Math.max(18, Math.min(W, H) * .036)}px ${P.display}`; ctx.textAlign = 'left'; ctx.fillText(e.name, pad, H - pad - Math.max(16, Math.min(W, H) * .03));
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `500 ${Math.max(11, Math.min(W, H) * .016)}px ${P.body}`; ctx.fillText(`${e.src}${e.note ? ' · ' + e.note : ''} · ${e.chaotic ? 'periyodik değil' : 'T = ' + e.T.toFixed(3)} · kütleler ${e.masses.join(' · ')} · G = 1`, pad, H - pad);
      ctx.textAlign = 'right'; ctx.font = `500 ${Math.max(11, Math.min(W, H) * .016)}px ${P.mono}`; ctx.fillText(`${view.idx + 1} / ${panels.length}`, W - pad, pad + 12); ctx.restore(); }
    capEl.textContent = showLabels ? `t = ${timeline.t.toFixed(1)} · G = 1 · eşit kütleler (Lagrange 1·2·3 ve Pisagor 3·4·5 hariç) · Šuvakov–Dmitrašinović 2013, Lagrange, Euler, Broucke · pano hızları görsel tempoya normalize` : '';
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, cv.clientWidth); H = Math.max(1, cv.clientHeight);
    for (const c of [cv, trailCv, hotCv, pathCv]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    layout(); drawPaths(); seekTo(timeline.t); draw();
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  /* bir kare ilerlet (gerçek saniye): dışarıdan kare kare sürmek ve ölçmek için de kullanılır */
  function tickView(dt) {
    let relayout = false;
    if (view.mode === 'cinema' && view.morph < 1) { view.morph = Math.min(1, view.morph + dt / .9); relayout = true; if (view.morph >= 1) { tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, W, H); hctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.clearRect(0, 0, W, H); for (const p of panels) { p.prev = null; p.seg = []; } } }
    else if (view.mode === 'grid' && view.morph > 0) { view.morph = Math.max(0, view.morph - dt / .7); relayout = true; if (view.morph <= 0) { tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, W, H); hctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.clearRect(0, 0, W, H); for (const p of panels) { p.prev = null; p.seg = []; } } }
    if (view.switching) { const sw = view.switching; sw.t += dt; if (sw.t < .55) view.fade = 1 - sw.t / .55; else if (!sw.done) { view.idx = sw.to; sw.done = true; relayout = true; tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, W, H); hctx.setTransform(dpr, 0, 0, dpr, 0, 0); hctx.clearRect(0, 0, W, H); for (const p of panels) { p.prev = null; p.seg = []; } } else { view.fade = Math.min(1, (sw.t - .55) / .8); if (view.fade >= 1) view.switching = null; } }
    else if (view.mode === 'cinema' && view.morph >= 1 && view.dwell > 0) { view.dwellT += dt; if (view.dwellT >= view.dwell) { view.dwellT = 0; view.switching = { to: (view.idx + 1) % panels.length, t: 0, done: false }; } }
    if (relayout) { layout(); drawPaths(); }
  }
  function advanceFrame(dt) { tickView(dt); const ds = dt * timeline.speed; timeline.t += ds; for (const p of panels) stepPanel(p, ds); paintTrails(ds); draw(); }
  function setCinema(on, idx) { if (idx != null) view.idx = clamp(idx, 0, panels.length - 1); view.mode = on ? 'cinema' : 'grid'; view.dwellT = 0; view.switching = null; view.fade = 1; if (staticMode()) { view.morph = on ? 1 : 0; layout(); drawPaths(); seekTo(timeline.t); } draw(); ensureLoop(); }
  function jump(delta) { if (view.mode !== 'cinema') { setCinema(true, (view.idx + delta + panels.length) % panels.length); return; } if (staticMode()) { setCinema(true, (view.idx + delta + panels.length) % panels.length); return; } view.dwellT = 0; view.switching = { to: (view.idx + delta + panels.length) % panels.length, t: 0, done: false }; ensureLoop(); }
  const viewBusy = () => (view.mode === 'cinema' ? view.morph < 1 : view.morph > 0) || !!view.switching;
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.05, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; if (timeline.playing && entrance.done) advanceFrame(dt); else { tickView(dt); draw(); } if (timeline.playing || viewBusy()) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && !staticMode()) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure);
  if (staticMode() || options.t != null) timeline.t = options.t ?? 6; else if (options.autoplay ?? true) timeline.playing = true;
  resize(); entrance.start(); ensureLoop();
  return {
    timeline, catalog: CATALOG, advance: advanceFrame, cinema: setCinema, next: () => jump(1), prev: () => jump(-1), get view() { return { mode: view.mode, index: view.idx, dwell: view.dwell, entry: CATALOG[view.idx] }; }, set dwell(v) { view.dwell = Math.max(0, v || 0); view.dwellT = 0; }, panels: () => panels.map(p => ({ id: p.entry.id, t: p.t, k: p.k, minDist: minDistance(p.st) })),
    get labels() { return showLabels; }, set labels(v) { showLabels = !!v; draw(); }, replay() { entrance.start(); }, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
