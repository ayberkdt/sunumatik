/* three-body.mjs — "Üç-Cisim Durumları" sahnesi (three_body_states). 2B tuval, THREE gerekmez.

   Siyah zemin üzerinde 5×4 pano: her panoda düzlemsel üç-cisim probleminin bir periyodik çözümü canlı entegre
   edilir (three-body-model.mjs, RK4 uyarlanır adım). Görünüm: ışık kaynağı olarak cisimler (sıcak çekirdek +
   yumuşak hale), arkalarında YAŞA BAĞLI solan ışıklı iz: iz sabit SANİYE sürer (tail, gerçek zaman); en eski uç
   ilk andan itibaren silinir, büyüme ile silinme dengelenince uzunluk kararlı kalır (GIF davranışı). Her karede iz
   geçmiş tamponundan yaşa göre eşit aralıklı yeniden örneklenir ve OPAK, sönükleştirilmiş parçalar olarak çizilir
   (yarı saydam üst üste binme yok → boncuk yok); ışıma birleştirmede bulanık kopyalardan gelir. Her panonun zamanı görsel hıza göre normalize edilir (ortalama ekran hızı ~sabit) — hızlı ve yavaş
   çözümler aynı tempoda izlenir. Renkler üç cisim için sabit (turuncu · krem · mavi). Kaotik Pisagor problemi
   kaçışla biter ve baştan başlar.

   SİNEMA modu: tek çözüm tam kadrajda, alt yazıda ad · kaynak · periyot; pano ızgaradan kadraja yumuşak büyür (morf), sonra iz
   yeniden birikir; otomatik geçiş (dwell) ile çözümler sırayla akar — ekran koruyucu kullanımı.

   API: const tb = await mountThreeBody(host, { t, speed, labels, autoplay, tail (s), mode:'grid'|'cinema', index, dwell });
        tb.timeline{t, playing, speed, play(), pause(), scrub(t)} · tb.cinema(on, index?) · tb.next() · tb.prev() · tb.view
        · tb.catalog · tb.advance(dt) · tb.replay() · tb.setActive(v) · tb.dispose() */

import { CATALOG, sampleOrbit, advance, minDistance } from './three-body-model.mjs';
import { staticMode, Entrance, reveal, palette, ease } from '../core/lab-scene.mjs';

export const BODY_COLORS = ['#ff6226', '#f4dcb4', '#7f8cff'];   // GIF ölçümü: kızıl-turuncu (ton 0,047) · sıcak krem/ten · lavanta-periwinkle (ton 0,68)
export const HOT_COLORS = ['#ffd49a', '#fff8ec', '#dfe4ff'];    // baş çekirdeği: cisim rengine göre sıcak-beyaz (GIF'te baş sarı-beyaz, kuyruk doygun, uç koyu)
const HOT = HOT_COLORS.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
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
  const trailCv = document.createElement('canvas'), tctx = trailCv.getContext('2d');   // her kare yeniden çizilen iz tuvali (opak sönük renkler; ışıma birleştirmede)
  const TAIL = Math.max(.5, options.tail ?? 5.5);                              // iz süresi (gerçek saniye) ve yaş örnek sayısı
  const pathCv = document.createElement('canvas'), pctx = pathCv.getContext('2d');     // tam periyot yolları (statik)
  const bloomCv = document.createElement('canvas'), bctx = bloomCv.getContext('2d');   // ½ çözünürlük dar ışıma (bulanıklık küçük tuvalde)
  const bloom2Cv = document.createElement('canvas'), b2ctx = bloom2Cv.getContext('2d'); // ¼ çözünürlük geniş ışıma
  /* cisim ışıma sprite'ları: radyal gradyan bir kez çizilir, her karede drawImage (60 gradyan/kare yerine) */
  const glowSprites = RGB.map(c => { const g = document.createElement('canvas'); g.width = g.height = 128; const x = g.getContext('2d'); const r = x.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.6)`); r.addColorStop(.2, `rgba(${c[0]},${c[1]},${c[2]},.26)`); r.addColorStop(.55, `rgba(${c[0]},${c[1]},${c[2]},.07)`); r.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`); x.fillStyle = r; x.fillRect(0, 0, 128, 128); return g; });
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
    return { entry, m, orbit, half, cx, cy, k, st: Float64Array.from(entry.state()), t: 0, hist: [] };   // hist: [t, x1,y1,x2,y2,x3,y3] alt adım örnekleri
  });
  const resetPanel = p => { p.st = Float64Array.from(p.entry.state()); p.t = 0; p.hist = []; p.lastDir = null; };
  const spanOf = p => TAIL * timeline.speed * p.k * (view.mode === 'cinema' && view.morph > .5 ? 1.35 : 1);   // iz süresi pano zamanında
  /* dt (küresel zaman) kadar ilerlet: pano zamanı dt·k; alt adımlarda konumları biriktir (bu kare çizilecek parça) */
  const stepPanel = (p, dt) => {
    if (p.entry.chaotic && (p.t > p.entry.T || Math.max(...[0, 1, 2].map(b => Math.hypot(p.st[2 * b], p.st[2 * b + 1]))) > 9)) resetPanel(p);
    const dp = dt * p.k, sub = Math.max(1, Math.ceil(dp / .015)), h = dp / sub;
    for (let s = 0; s < sub; s++) {
      advance(p.st, p.m, h, p.entry.chaotic ? { hMax: 1e-3, k: 2e-3 } : { hMax: 2e-3, k: 4e-3 }); p.t += h;
      /* geçmişe seyreltilmiş kayıt: bir cisim son kayıttan beri yeterince yol aldıysa ya da yönü yeterince döndüyse (yakın geçiş) — kare başına çizilen nokta sayısı sınırlı kalır */
      const last = p.hist[p.hist.length - 1]; let keep = !last || p.t - last[0] > .25;
      if (!keep) for (let b = 0; b < 3 && !keep; b++) { const dx = p.st[2 * b] - last[1 + 2 * b], dy = p.st[2 * b + 1] - last[2 + 2 * b], d = Math.hypot(dx, dy); if (d > p.half * .035) keep = true; else if (d > p.half * .004) { const vx = p.st[6 + 2 * b], vy = p.st[7 + 2 * b], vn = Math.hypot(vx, vy) || 1, ln = p.lastDir ? p.lastDir[b] : null; if (ln && (vx * ln[0] + vy * ln[1]) / vn < Math.cos(.14)) keep = true; } }
      if (keep) { p.hist.push([p.t, p.st[0], p.st[1], p.st[2], p.st[3], p.st[4], p.st[5]]); p.lastDir = [0, 1, 2].map(b => { const vx = p.st[6 + 2 * b], vy = p.st[7 + 2 * b], vn = Math.hypot(vx, vy) || 1; return [vx / vn, vy / vn]; }); }
    }
    if (!p.hist.length || p.hist[p.hist.length - 1][0] < p.t) p.hist.push([p.t, p.st[0], p.st[1], p.st[2], p.st[3], p.st[4], p.st[5]]);   // baş her zaman güncel
    const keep = p.t - spanOf(p) * 1.05; let cut = 0; while (cut < p.hist.length - 2 && p.hist[cut + 1][0] < keep) cut++; if (cut) p.hist.splice(0, cut);
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
  /* iz: geçmiş tamponunun TÜM alt adım noktaları çizilir (yakın geçişlerdeki hızlı dönüşler kırılmaz); yaş 16 kovaya bölünür,
     her kova o yaş aralığındaki noktalardan tek bir yoldur (uçları zamanda ara değerlenir). Sönme w(yaş) = (1 − yaş/T)^0,6:
     uzun süre parlak, sonda belirgin biter, hayalet kalmaz; baş cisme özgü sıcak-beyaza karışır. OPAK renk → eklemde boncuk yok. */
  const NB = 12;
  const idxAt = (h, t) => { let lo = 0, hi = h.length; while (lo < hi) { const m = (lo + hi) >> 1; if (h[m][0] < t) lo = m + 1; else hi = m; } return lo; };   // ilk h[i].t ≥ t
  const posAt = (h, t, b, i) => { const q = h[Math.min(i, h.length - 1)], a = h[Math.max(0, i - 1)]; const f = q[0] - a[0] > 1e-12 ? clamp((t - a[0]) / (q[0] - a[0]), 0, 1) : 1; return [a[1 + 2 * b] + (q[1 + 2 * b] - a[1 + 2 * b]) * f, a[2 + 2 * b] + (q[2 + 2 * b] - a[2 + 2 * b]) * f]; };
  function drawTrails() {
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, W, H); tctx.globalCompositeOperation = 'source-over'; tctx.lineCap = 'round'; tctx.lineJoin = 'bevel';   // yoğun noktalarda bevel yeterli ve ucuz
    for (const p of panels) {
      if (p.alpha <= 0) continue; const h = p.hist; if (h.length < 2) continue;
      const f = clamp(Math.min(p.rw, p.rh) / 300, 1, 2.3), span = spanOf(p), tNow = p.t, tOld = Math.max(h[0][0], tNow - span);
      for (let k = NB - 1; k >= 0; k--) {   // en eski kova önce, baş en son
        const t1 = tNow - span * k / NB, t0 = tNow - span * (k + 1) / NB; if (t1 <= tOld) continue;
        const i1 = idxAt(h, t1), i0 = idxAt(h, Math.max(t0, tOld));
        const u = (k + .5) / NB, w = Math.pow(1 - u, .6) * p.alpha, hot = clamp(1 - u / .07, 0, 1) * .85;
        for (let b = 0; b < 3; b++) {
          const C = RGB[b], Hc = HOT[b];
          tctx.strokeStyle = `rgb(${Math.round((C[0] * (1 - hot) + Hc[0] * hot) * w)},${Math.round((C[1] * (1 - hot) + Hc[1] * hot) * w)},${Math.round((C[2] * (1 - hot) + Hc[2] * hot) * w)})`; tctx.lineWidth = f * (.6 + .7 * (1 - u));
          const e1 = posAt(h, t1, b, i1), e0 = posAt(h, Math.max(t0, tOld), b, i0);
          tctx.beginPath(); tctx.moveTo(X(p, e1[0]), Y(p, e1[1])); for (let i = i1 - 1; i >= i0; i--) tctx.lineTo(X(p, h[i][1 + 2 * b]), Y(p, h[i][2 + 2 * b])); tctx.lineTo(X(p, e0[0]), Y(p, e0[1])); tctx.stroke();
        }
      }
    }
  }
  /* t'ye git: baştan yeniden entegre; izi parça parça soldurarak yeniden kur (deterministik) */
  function seekTo(t) {
    for (const p of panels) resetPanel(p);
    let left = t; while (left > 1e-9) { const dt = Math.min(.05, left); for (const p of panels) stepPanel(p, dt); left -= dt; }
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const pE = entrance.progress('panels');
    /* birleştirme: soluk tam yol; iz rengi iki bulanık kopya (dar + geniş ışıma) + keskin gövde — hepsi toplamsal (ışık) */
    const tA = performance.now(); drawTrails(); perf.trails += performance.now() - tA; perf.pts = panels.reduce((a, p) => a + p.hist.length, 0); const tB = performance.now();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(pathCv, 0, 0); ctx.globalCompositeOperation = 'lighter';
    const fb = clamp(Math.min(W, H) / 600, 1, 2.2) * dpr; /* toplam parlaklık GIF ölçüsünde: keskin gövde + dar ışıma + geniş ışıma beyaza kırpmadan rengi korur (baş dışında beyaz yok) */
    if (perf.level < 2) { bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, bloomCv.width, bloomCv.height); bctx.filter = `blur(${(1.25 * fb).toFixed(1)}px)`; bctx.drawImage(trailCv, 0, 0, bloomCv.width, bloomCv.height); ctx.globalAlpha = perf.level ? .7 : .55; ctx.drawImage(bloomCv, 0, 0, cv.width, cv.height); }
    if (perf.level < 1) { b2ctx.setTransform(1, 0, 0, 1, 0, 0); b2ctx.clearRect(0, 0, bloom2Cv.width, bloom2Cv.height); b2ctx.filter = `blur(${(2.5 * fb).toFixed(1)}px)`; b2ctx.drawImage(trailCv, 0, 0, bloom2Cv.width, bloom2Cv.height); ctx.globalAlpha = .45; ctx.drawImage(bloom2Cv, 0, 0, cv.width, cv.height); }
    ctx.globalAlpha = perf.level === 2 ? 1 : .9; ctx.drawImage(trailCv, 0, 0); ctx.globalAlpha = 1; ctx.restore();
    panels.forEach((p, i) => {
      const a = clamp(pE * panels.length * .5 - i * .35, 0, 1) * p.alpha * (i === view.idx ? view.fade : 1);
      if (a < 1 && p.alpha > 0) { ctx.fillStyle = `rgba(0,0,0,${1 - a})`; ctx.fillRect(p.rx, p.ry, p.rw, p.rh); }
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) {
        const f = clamp(Math.min(p.rw, p.rh) / 300, 1, 2.3), x = X(p, p.st[2 * b]), y = Y(p, p.st[2 * b + 1]), r = (2.2 + (p.m[b] > 1 ? .5 * Math.sqrt(p.m[b] - 1) : 0)) * f, R = 30 * f;
        ctx.drawImage(glowSprites[b], x - R, y - R, 2 * R, 2 * R);
        ctx.fillStyle = rgba(b, 1); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${HOT[b][0]},${HOT[b][1]},${HOT[b][2]},.95)`; ctx.beginPath(); ctx.arc(x, y, r * .6, 0, Math.PI * 2); ctx.fill();
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
    perf.draw += performance.now() - tB;
    capEl.textContent = showLabels ? `t = ${timeline.t.toFixed(1)} · G = 1 · eşit kütleler (Lagrange 1·2·3 ve Pisagor 3·4·5 hariç) · Šuvakov–Dmitrašinović 2013, Lagrange, Euler, Broucke · pano hızları görsel tempoya normalize` : '';
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, cv.clientWidth); H = Math.max(1, cv.clientHeight);
    for (const c of [cv, trailCv, pathCv]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); } bloomCv.width = Math.round(W * dpr / 2); bloomCv.height = Math.round(H * dpr / 2); bloom2Cv.width = Math.round(W * dpr / 4); bloom2Cv.height = Math.round(H * dpr / 4);
    layout(); drawPaths(); draw();
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  /* bir kare ilerlet (gerçek saniye): dışarıdan kare kare sürmek ve ölçmek için de kullanılır */
  function tickView(dt) {
    let relayout = false;
    if (view.mode === 'cinema' && view.morph < 1) { view.morph = Math.min(1, view.morph + dt / .9); relayout = true;  }
    else if (view.mode === 'grid' && view.morph > 0) { view.morph = Math.max(0, view.morph - dt / .7); relayout = true;  }
    if (view.switching) { const sw = view.switching; sw.t += dt; if (sw.t < .55) view.fade = 1 - sw.t / .55; else if (!sw.done) { view.idx = sw.to; sw.done = true; relayout = true; } else { view.fade = Math.min(1, (sw.t - .55) / .8); if (view.fade >= 1) view.switching = null; } }
    else if (view.mode === 'cinema' && view.morph >= 1 && view.dwell > 0) { view.dwellT += dt; if (view.dwellT >= view.dwell) { view.dwellT = 0; view.switching = { to: (view.idx + 1) % panels.length, t: 0, done: false }; } }
    if (relayout) { layout(); drawPaths(); }
  }
  const perf = { physics: 0, trails: 0, draw: 0, pts: 0, n: 0, avg: 0, level: 0 };
  /* kalite yöneticisi: kare süresi ortalaması 14 ms'i aşarsa geniş ışıma kapanır (1), 20 ms'i aşarsa ışıma tamamen kapanır (2); düşerse geri açılır */
  const govern = ms => { perf.avg = perf.avg ? perf.avg * .9 + ms * .1 : ms; if (perf.avg > 20 && perf.level < 2) perf.level = 2; else if (perf.avg > 14 && perf.level < 1) perf.level = 1; else if (perf.avg < 9 && perf.level > 0) perf.level--; };
  function advanceFrame(dt) { tickView(dt); const ds = dt * timeline.speed; timeline.t += ds; const t0 = performance.now(); for (const p of panels) stepPanel(p, ds); perf.physics += performance.now() - t0; draw(); perf.n++; }
  function setCinema(on, idx) { if (idx != null) view.idx = clamp(idx, 0, panels.length - 1); view.mode = on ? 'cinema' : 'grid'; view.dwellT = 0; view.switching = null; view.fade = 1; if (staticMode()) { view.morph = on ? 1 : 0; layout(); drawPaths(); seekTo(timeline.t); } draw(); ensureLoop(); }
  function jump(delta) { if (view.mode !== 'cinema') { setCinema(true, (view.idx + delta + panels.length) % panels.length); return; } if (staticMode()) { setCinema(true, (view.idx + delta + panels.length) % panels.length); return; } view.dwellT = 0; view.switching = { to: (view.idx + delta + panels.length) % panels.length, t: 0, done: false }; ensureLoop(); }
  const viewBusy = () => (view.mode === 'cinema' ? view.morph < 1 : view.morph > 0) || !!view.switching;
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.05, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; const t0 = performance.now(); if (timeline.playing && entrance.done) advanceFrame(dt); else { tickView(dt); draw(); } govern(performance.now() - t0); if (timeline.playing || viewBusy()) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && !staticMode()) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure);
  if (staticMode() || options.t != null) { timeline.t = options.t ?? 6; seekTo(timeline.t); } else if (options.autoplay ?? true) timeline.playing = true;
  resize(); entrance.start(); ensureLoop();
  return {
    timeline, catalog: CATALOG, advance: advanceFrame, perf, cinema: setCinema, next: () => jump(1), prev: () => jump(-1), get view() { return { mode: view.mode, index: view.idx, dwell: view.dwell, entry: CATALOG[view.idx] }; }, set dwell(v) { view.dwell = Math.max(0, v || 0); view.dwellT = 0; }, panels: () => panels.map(p => ({ id: p.entry.id, t: p.t, k: p.k, minDist: minDistance(p.st) })),
    get labels() { return showLabels; }, set labels(v) { showLabels = !!v; draw(); }, replay() { entrance.start(); }, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
