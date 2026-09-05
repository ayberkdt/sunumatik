/* porkchop.mjs — Porkchop / Fırlatma Penceresi Kâşifi (porkchop_explorer)

   scene-blocks "wave 2" ORBITAL bloğu — GERÇEK görev analizi: kalkış × varış
   tarih ızgarasının HER hücresi bir Lambert çözümüdür (../core/astro-lambert.mjs,
   evrensel değişkenler) ve gezegen konumları JPL yaklaşık Kepler elemanlarından
   (Standish) gelir. Kontur yüzeyi hazır bir ısı haritası DEĞİLDİR; hesaplanır.
   İmleç/çapraz kıl, seçili kalkış-varış-TOF-maliyet, minimum bölgesi ve yanda
   seçili transferin heliosantrik geometrisi (transfer yayı Kepler yayılımıyla).

   API:
     const pc = await mountPorkchop(host, { origin:'earth', target:'mars', depStart:'2026-09-01', depEnd:'2027-03-01',
                                            arrStart:'2027-04-01', arrEnd:'2028-03-01', n:60, metric:'c3'|'vinfArr'|'dvTotal' });
     pc.grid · pc.selected · pc.select(jdDep, jdArr) · pc.selectMin()
     pc.setRange({ depStart, depEnd, arrStart, arrEnd }) · pc.setBodies(origin, target) · pc.setMetric(m) · pc.compute()
     pc.dispose()
   Tümü 2B tuval (THREE yok). Deterministik: aynı girdiler aynı yüzey. */

import { porkchopGrid, evaluateTransfer, planetState, propagateKepler, julianDay, fmtJd, PLANETS, AU, DAY, MU_SUN } from '../core/astro-lambert.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return julianDay(y, m, d); };

/* renk rampası: koyu lacivert → mavi → altın → fildişi (algısal, tek ton yükselen) */
function ramp(t, out) {
  const stops = [[.08, .09, .15], [.16, .28, .55], [.33, .55, .75], [.85, .72, .45], [.98, .93, .80]];
  const x = clamp(t, 0, 1) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  for (let k = 0; k < 3; k++) out[k] = Math.round(255 * (stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f));
  return out;
}

/* marching squares — seviye eğrisi parçaları [[x0,y0,x1,y1],…] (ızgara indeks uzayı) */
function contour(field, nx, ny, level) {
  const segs = [];
  const at = (i, j) => field[i * ny + j];
  const interp = (a, b) => (level - a) / (b - a);
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) {
    const v = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
    if (v.some(x => !Number.isFinite(x))) continue;
    const idx = (v[0] >= level) | ((v[1] >= level) << 1) | ((v[2] >= level) << 2) | ((v[3] >= level) << 3);
    if (idx === 0 || idx === 15) continue;
    const pts = [];
    if ((idx & 1) !== ((idx >> 1) & 1)) pts.push([i + interp(v[0], v[1]), j]);
    if (((idx >> 1) & 1) !== ((idx >> 2) & 1)) pts.push([i + 1, j + interp(v[1], v[2])]);
    if (((idx >> 2) & 1) !== ((idx >> 3) & 1)) pts.push([i + interp(v[3], v[2]), j + 1]);
    if (((idx >> 3) & 1) !== (idx & 1)) pts.push([i, j + interp(v[0], v[3])]);
    if (pts.length === 2) segs.push([...pts[0], ...pts[1]]);
    else if (pts.length === 4) { segs.push([...pts[0], ...pts[1]]); segs.push([...pts[2], ...pts[3]]); }
  }
  return segs;
}

export async function mountPorkchop(host, options = {}) {
  if (!host) throw new Error('mountPorkchop bir kap ister');
  const figure = document.createElement('figure');
  figure.className = 'pork';
  figure.innerHTML = `
    <style>
      .pork{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,11fr) minmax(0,9fr);
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .pork__plot{position:relative;min-width:0;min-height:0;} .pork__plot canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair;}
      .pork__side{position:relative;min-width:0;min-height:0;border-left:1px solid var(--color-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,1fr);}
      .pork__side canvas{display:block;width:100%;height:100%;}
      .pork__geo{position:relative;min-height:0;}
      .pork__hud{padding:12px 16px 10px;border-bottom:1px solid var(--color-rule,#3a3c42);}
      .pork__hud h4{margin:0 0 6px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:600;color:var(--color-muted,#9a938a);}
      .pork__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr auto 1fr;gap:3px 12px;}
      .pork__hud dt{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted,#9a938a);align-self:baseline;}
      .pork__hud dd{margin:0;text-align:right;font-size:13.5px;font-variant-numeric:tabular-nums;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .pork__hud dd.hi{color:var(--color-accent,#d9b877);}
      .pork__status{position:absolute;left:14px;top:12px;font-size:11px;letter-spacing:.06em;color:var(--color-muted,#9a938a);pointer-events:none;}
      .pork__legend{position:absolute;right:20px;top:46px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--color-muted,#9a938a);pointer-events:none;}
      .pork__legend i{display:block;width:120px;height:8px;border-radius:4px;}
    </style>
    <div class="pork__plot"><canvas aria-label="Porkchop çizimi"></canvas>
      <div class="pork__status" data-status></div>
      <div class="pork__legend"><span data-legend-lo></span><i data-legend></i><span data-legend-hi></span></div></div>
    <div class="pork__side">
      <div class="pork__hud" role="status"><h4 data-hud="title">Seçili transfer</h4><dl>
        <dt>kalkış</dt><dd data-hud="dep">—</dd><dt>varış</dt><dd data-hud="arr">—</dd>
        <dt>TOF</dt><dd data-hud="tof">—</dd><dt>tip</dt><dd data-hud="type">—</dd>
        <dt>C3</dt><dd data-hud="c3" class="hi">—</dd><dt>v∞ kalkış</dt><dd data-hud="vinfd">—</dd>
        <dt>v∞ varış</dt><dd data-hud="vinfa">—</dd><dt>Δθ</dt><dd data-hud="dth">—</dd>
        <dt>ΔV kalkış</dt><dd data-hud="dvd">—</dd><dt>ΔV tutunma</dt><dd data-hud="dva">—</dd>
      </dl></div>
      <div class="pork__geo"><canvas aria-label="Heliosantrik transfer geometrisi"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const plotCanvas = figure.querySelector('.pork__plot canvas'), geoCanvas = figure.querySelector('.pork__geo canvas');
  const statusEl = figure.querySelector('[data-status]'), legendEl = figure.querySelector('[data-legend]'), legLo = figure.querySelector('[data-legend-lo]'), legHi = figure.querySelector('[data-legend-hi]');
  const hud = {}; for (const el of figure.querySelectorAll('[data-hud]')) hud[el.dataset.hud] = el;
  const css = getComputedStyle(figure);
  const tok = (name, fb) => (css.getPropertyValue(name) || '').trim() || fb;
  const palette = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10'), surface: tok('--color-surface', '#15161a') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const state = {
    origin: options.origin ?? 'earth', target: options.target ?? 'mars',
    depStart: parseDate(options.depStart ?? '2026-09-01'), depEnd: parseDate(options.depEnd ?? '2027-03-01'),
    arrStart: parseDate(options.arrStart ?? '2027-04-01'), arrEnd: parseDate(options.arrEnd ?? '2028-03-01'),
    n: options.n ?? 60, metric: options.metric ?? 'c3', parkAltDep: options.parkAltDep ?? 200, parkAltArr: options.parkAltArr ?? 300,
  };
  const METRICS = {
    c3: { label: 'C3 (km²/s²)', unit: 'km²/s²', levels: [8, 10, 12, 14, 16, 18, 20, 25, 30, 40, 50, 70, 100], get: g => g.c3 },
    vinfArr: { label: 'v∞ varış (km/s)', unit: 'km/s', levels: [2, 2.5, 3, 3.5, 4, 5, 6, 8, 10], get: g => g.vinfArr },
    dvTotal: { label: 'ΔV toplam (km/s)', unit: 'km/s', levels: [5, 5.5, 6, 6.5, 7, 8, 9, 10, 12, 15], get: g => g.dvTotal },
  };
  let grid = null, selected = null, hover = null, field = null, fieldMin = 0, fieldMax = 1, contours = [], tofContours = [];
  const plotArea = { x: 64, y: 28, w: 10, h: 10 };
  let plotW = 10, plotH = 10, dpr = 1, geoW = 10, geoH = 10;

  function compute() {
    const t0 = performance.now();
    grid = porkchopGrid(state.origin, state.target, state.depStart, state.depEnd, state.arrStart, state.arrEnd, state.n, state.n, { parkAltDep: state.parkAltDep, parkAltArr: state.parkAltArr });
    const ms = performance.now() - t0;
    prepareField();
    statusEl.textContent = `${PLANETS[state.origin].label} → ${PLANETS[state.target].label} · ${state.n}×${state.n} = ${nf0.format(state.n * state.n)} Lambert çözümü · ${nf0.format(ms)} ms · JPL yaklaşık elemanlar (Standish)`;
    if (grid.min) select(grid.min.jdDep, grid.min.jdArr); else { selected = null; draw(); }
  }
  function prepareField() {
    const M = METRICS[state.metric]; field = M.get(grid);
    const vals = Array.from(field).filter(Number.isFinite).sort((a, b) => a - b);
    fieldMin = vals[0] ?? 0; fieldMax = vals[Math.floor(vals.length * .92)] ?? 1;   // %92 persentil: üst uçlar tavanı bastırmasın
    if (fieldMax <= fieldMin) fieldMax = fieldMin + 1;
    contours = M.levels.filter(l => l > fieldMin && l < vals[vals.length - 1]).map(l => ({ level: l, segs: contour(field, grid.nDep, grid.nArr, l) }));
    tofContours = [50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 800, 1000].filter(l => l > Math.min(...grid.tof.filter(Number.isFinite)) && l < Math.max(...grid.tof.filter(Number.isFinite))).map(l => ({ level: l, segs: contour(grid.tof, grid.nDep, grid.nArr, l) }));
    /* lejant */
    legendEl.style.background = `linear-gradient(90deg, ${[0, .25, .5, .75, 1].map(t => { const c = ramp(t, [0, 0, 0]); return `rgb(${c[0]},${c[1]},${c[2]})`; }).join(',')})`;
    legLo.textContent = `${nf1.format(fieldMin)}`; legHi.textContent = `${nf1.format(fieldMax)}+ ${M.unit}`;
  }

  /* ızgara indeks ↔ piksel */
  const X = i => plotArea.x + (i / (grid.nDep - 1)) * plotArea.w, Y = j => plotArea.y + plotArea.h - (j / (grid.nArr - 1)) * plotArea.h;
  const jdX = jd => X((jd - grid.dep[0]) / (grid.dep[grid.nDep - 1] - grid.dep[0]) * (grid.nDep - 1));
  const jdY = jd => Y((jd - grid.arr[0]) / (grid.arr[grid.nArr - 1] - grid.arr[0]) * (grid.nArr - 1));
  const pxToJd = (px, py) => ({ jdDep: grid.dep[0] + clamp((px - plotArea.x) / plotArea.w, 0, 1) * (grid.dep[grid.nDep - 1] - grid.dep[0]), jdArr: grid.arr[0] + clamp(1 - (py - plotArea.y) / plotArea.h, 0, 1) * (grid.arr[grid.nArr - 1] - grid.arr[0]) });

  const ctx = plotCanvas.getContext('2d');
  const px = [0, 0, 0];
  let heat = null;   // ImageData önbelleği (ızgara çözünürlüğünde), draw'da ölçeklenir
  function buildHeat() {
    const off = document.createElement('canvas'); off.width = grid.nDep; off.height = grid.nArr;
    const c = off.getContext('2d'); const img = c.createImageData(grid.nDep, grid.nArr);
    for (let i = 0; i < grid.nDep; i++) for (let j = 0; j < grid.nArr; j++) {
      const v = field[i * grid.nArr + j]; const k = ((grid.nArr - 1 - j) * grid.nDep + i) * 4;
      if (!Number.isFinite(v)) { img.data[k + 3] = 0; continue; }
      /* logaritmik normalizasyon: minimum bölgesi geniş ve okunur */
      const t = Math.log(v / fieldMin) / Math.log(fieldMax / fieldMin);
      ramp(t, px); img.data[k] = px[0]; img.data[k + 1] = px[1]; img.data[k + 2] = px[2]; img.data[k + 3] = 255;
    }
    c.putImageData(img, 0, 0); heat = off;
  }
  function draw() {
    if (!grid) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = palette.canvas; ctx.fillRect(0, 0, plotW, plotH);
    plotArea.x = 96; plotArea.y = 40; plotArea.w = Math.max(10, plotW - plotArea.x - 18); plotArea.h = Math.max(10, plotH - plotArea.y - 44);
    if (!heat) buildHeat();
    /* ısı haritası: hücre merkezleri ızgara noktalarında → yarım hücre taşırılır */
    const cw = plotArea.w / (grid.nDep - 1), ch = plotArea.h / (grid.nArr - 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.save(); ctx.beginPath(); ctx.rect(plotArea.x, plotArea.y, plotArea.w, plotArea.h); ctx.clip();
    ctx.drawImage(heat, plotArea.x - cw / 2, plotArea.y - ch / 2, plotArea.w + cw, plotArea.h + ch);
    /* TOF eş-eğrileri (kesikli, sessiz) */
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
    for (const c of tofContours) { ctx.beginPath(); for (const s of c.segs) { ctx.moveTo(X(s[0]), Y(s[1])); ctx.lineTo(X(s[2]), Y(s[3])); } ctx.stroke();
      const s = c.segs[Math.floor(c.segs.length / 2)]; if (s) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`${c.level} g`, X(s[0]) + 3, Y(s[1]) - 3); } }
    ctx.setLineDash([]);
    /* metrik konturları */
    ctx.lineWidth = 1.1;
    for (const c of contours) { ctx.strokeStyle = 'rgba(10,12,18,.75)'; ctx.beginPath(); for (const s of c.segs) { ctx.moveTo(X(s[0]), Y(s[1])); ctx.lineTo(X(s[2]), Y(s[3])); } ctx.stroke();
      const s = c.segs[Math.floor(c.segs.length * .3)]; if (s) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '600 10px ui-monospace, monospace'; ctx.fillText(String(c.level), X(s[0]) + 3, Y(s[1]) + 4); } }
    /* minimum */
    if (grid.min) { ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(grid.min.i), Y(grid.min.j), 7, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = palette.ink; ctx.font = '600 10.5px ui-monospace, monospace'; ctx.fillText(`min ${nf1.format(METRICS[state.metric].get(grid)[grid.min.i * grid.nArr + grid.min.j])}`, X(grid.min.i) + 10, Y(grid.min.j) - 8); }
    /* seçili + imleç çapraz kılı */
    const cross = (jd1, jd2, color, dash) => { const x = jdX(jd1), y = jdY(jd2); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(plotArea.x, y); ctx.lineTo(plotArea.x + plotArea.w, y); ctx.moveTo(x, plotArea.y); ctx.lineTo(x, plotArea.y + plotArea.h); ctx.stroke(); ctx.setLineDash([]); return [x, y]; };
    if (hover) cross(hover.jdDep, hover.jdArr, 'rgba(255,255,255,.35)', [2, 3]);
    if (selected) { const [x, y] = cross(selected.jdDep, selected.jdArr, palette.accent, []); ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = palette.canvas; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
    /* eksenler */
    ctx.strokeStyle = palette.rule; ctx.lineWidth = 1; ctx.strokeRect(plotArea.x + .5, plotArea.y + .5, plotArea.w, plotArea.h);
    ctx.fillStyle = palette.muted; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
    const depSpan = grid.dep[grid.nDep - 1] - grid.dep[0], arrSpan = grid.arr[grid.nArr - 1] - grid.arr[0];
    const stepFor = span => span > 700 ? 90 : span > 300 ? 30 : span > 120 ? 14 : 7;
    for (let jd = Math.ceil(grid.dep[0] / stepFor(depSpan)) * stepFor(depSpan); jd <= grid.dep[grid.nDep - 1]; jd += stepFor(depSpan)) { const x = jdX(jd); ctx.fillText(fmtJd(jd), x, plotArea.y + plotArea.h + 16); ctx.fillRect(x, plotArea.y + plotArea.h, 1, 4); }
    ctx.textAlign = 'right';
    for (let jd = Math.ceil(grid.arr[0] / stepFor(arrSpan)) * stepFor(arrSpan); jd <= grid.arr[grid.nArr - 1]; jd += stepFor(arrSpan)) { const y = jdY(jd); ctx.fillText(fmtJd(jd), plotArea.x - 6, y + 4); ctx.fillRect(plotArea.x - 4, y, 4, 1); }
    ctx.textAlign = 'center'; ctx.fillStyle = palette.ink; ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText(`kalkış tarihi (${PLANETS[state.origin].label})`, plotArea.x + plotArea.w / 2, plotH - 8);
    ctx.save(); ctx.translate(16, plotArea.y + plotArea.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`varış tarihi (${PLANETS[state.target].label})`, 0, 0); ctx.restore();
    ctx.textAlign = 'left';
    drawGeo();
  }

  /* -------- heliosantrik geometri (üstten, ekliptik düzlemi) */
  const gctx = geoCanvas.getContext('2d');
  function drawGeo() {
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.fillStyle = palette.canvas; gctx.fillRect(0, 0, geoW, geoH);
    if (!selected || !selected.transfer) { gctx.fillStyle = palette.muted; gctx.font = '12px Inter, sans-serif'; gctx.fillText('Bu hücrede Lambert çözümü yok.', 16, 28); return; }
    const T = selected.transfer;
    const aMax = Math.max(PLANETS[state.origin].el[0], PLANETS[state.target].el[0]) * (1 + Math.max(PLANETS[state.origin].el[1], PLANETS[state.target].el[1])) * 1.12;
    const sc = Math.min(geoW, geoH) / 2 / (aMax * AU) * .92, cx = geoW / 2, cy = geoH / 2;
    const P = r => [cx + r[0] * sc, cy - r[1] * sc];
    /* gezegen yörüngeleri: bir tur boyunca efemeris */
    for (const name of [state.origin, state.target]) {
      const per = Math.sqrt(PLANETS[name].el[0] ** 3) * 365.25;
      gctx.strokeStyle = PLANETS[name].color; gctx.globalAlpha = .38; gctx.lineWidth = 1; gctx.beginPath();
      for (let k = 0; k <= 180; k++) { const s = planetState(name, selected.jdDep + per * k / 180); const [x, y] = P(s.r); k ? gctx.lineTo(x, y) : gctx.moveTo(x, y); }
      gctx.stroke(); gctx.globalAlpha = 1;
    }
    /* transfer yayı: v1'den Kepler yayılımı */
    gctx.strokeStyle = palette.accent; gctx.lineWidth = 2; gctx.beginPath();
    const N = 120;
    for (let k = 0; k <= N; k++) { const s = propagateKepler(T.r1, T.lambert.v1, T.tof * DAY * k / N); const [x, y] = P(s.r); k ? gctx.lineTo(x, y) : gctx.moveTo(x, y); }
    gctx.stroke();
    /* varışta hedef gezegenin kalkıştan varışa kadar yolu (kesikli) */
    gctx.setLineDash([3, 3]); gctx.strokeStyle = PLANETS[state.target].color; gctx.lineWidth = 1.2; gctx.beginPath();
    for (let k = 0; k <= 60; k++) { const s = planetState(state.target, selected.jdDep + T.tof * k / 60); const [x, y] = P(s.r); k ? gctx.lineTo(x, y) : gctx.moveTo(x, y); }
    gctx.stroke(); gctx.setLineDash([]);
    /* Güneş, gezegenler (kalkış ve varış anları) */
    const dotAt = (r, color, rad, label, dy = -8) => { const [x, y] = P(r); gctx.fillStyle = color; gctx.beginPath(); gctx.arc(x, y, rad, 0, Math.PI * 2); gctx.fill(); if (label) { gctx.fillStyle = palette.ink; gctx.font = '11px Inter, sans-serif'; gctx.fillText(label, x + 8, y + dy + 4); } };
    dotAt([0, 0, 0], '#ffd27a', 6, 'Güneş');
    dotAt(T.r1, PLANETS[state.origin].color, 4.5, `${PLANETS[state.origin].label} · kalkış`);
    dotAt(planetState(state.origin, selected.jdArr).r, PLANETS[state.origin].color, 3, `${PLANETS[state.origin].label} · varışta`, 8);
    dotAt(planetState(state.target, selected.jdDep).r, PLANETS[state.target].color, 3, `${PLANETS[state.target].label} · kalkışta`, 8);
    dotAt(T.r2, PLANETS[state.target].color, 4.5, `${PLANETS[state.target].label} · varış`);
    /* v∞ okları (yön: gezegen hızına göre fazla hız; ölçek: km/s → px) */
    const arrow = (r, v, color, label) => { const [x, y] = P(r); const k = 9; const ex = x + v[0] * k, ey = y - v[1] * k; gctx.strokeStyle = color; gctx.lineWidth = 1.6; gctx.beginPath(); gctx.moveTo(x, y); gctx.lineTo(ex, ey); gctx.stroke(); const ang = Math.atan2(ey - y, ex - x); gctx.beginPath(); gctx.moveTo(ex, ey); gctx.lineTo(ex - 6 * Math.cos(ang - .4), ey - 6 * Math.sin(ang - .4)); gctx.lineTo(ex - 6 * Math.cos(ang + .4), ey - 6 * Math.sin(ang + .4)); gctx.closePath(); gctx.fillStyle = color; gctx.fill(); gctx.fillStyle = color; gctx.font = '10.5px ui-monospace, monospace'; gctx.fillText(label, ex + 4, ey - 4); };
    arrow(T.r1, T.vinfDepVec, palette.data2, `v∞ ${nf2.format(T.vinfDep)} km/s`);
    arrow(T.r2, T.vinfArrVec, palette.data2, `v∞ ${nf2.format(T.vinfArr)} km/s`);
    gctx.fillStyle = palette.muted; gctx.font = '10.5px Inter, sans-serif';
    gctx.fillText(`Ekliptik düzlemi, üstten (J2000) · transfer a = ${nf2.format(T.lambert.a / AU)} AU · yay Kepler yayılımı · ${T.dir === 'prograde' ? 'prograd' : 'retrograd'}`, 12, geoH - 10);
  }

  function select(jdDep, jdArr) {
    const transfer = evaluateTransfer(state.origin, state.target, jdDep, jdArr, { parkAltDep: state.parkAltDep, parkAltArr: state.parkAltArr });
    selected = { jdDep, jdArr, transfer };
    hud.dep.textContent = fmtJd(jdDep); hud.arr.textContent = fmtJd(jdArr);
    if (transfer) {
      hud.tof.textContent = `${nf0.format(transfer.tof)} gün`; hud.type.textContent = `Tip ${transfer.type}`;
      hud.c3.textContent = `${nf2.format(transfer.c3)} km²/s²`; hud.vinfd.textContent = `${nf2.format(transfer.vinfDep)} km/s`; hud.vinfa.textContent = `${nf2.format(transfer.vinfArr)} km/s`;
      hud.dth.textContent = `${nf1.format(transfer.lambert.dtheta * 180 / Math.PI)}°`;
      hud.dvd.textContent = `${nf2.format(transfer.dvDep)} km/s`; hud.dva.textContent = `${nf2.format(transfer.dvArr)} km/s`;
    } else for (const k of ['tof', 'type', 'c3', 'vinfd', 'vinfa', 'dth', 'dvd', 'dva']) hud[k].textContent = '—';
    hud.title.textContent = grid?.min && Math.abs(jdDep - grid.min.jdDep) < 1e-6 && Math.abs(jdArr - grid.min.jdArr) < 1e-6 ? 'Seçili transfer · ızgara minimumu' : 'Seçili transfer';
    draw();
  }

  /* etkileşim */
  const onMove = e => { if (!grid) return; const r = plotCanvas.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; if (px < plotArea.x || px > plotArea.x + plotArea.w || py < plotArea.y || py > plotArea.y + plotArea.h) { hover = null; draw(); return; } hover = pxToJd(px, py); draw(); };
  const onLeave = () => { hover = null; draw(); };
  const onClick = e => { if (!hover) return; select(hover.jdDep, hover.jdArr); };
  plotCanvas.addEventListener('pointermove', onMove); plotCanvas.addEventListener('pointerleave', onLeave); plotCanvas.addEventListener('click', onClick);

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const pp = figure.querySelector('.pork__plot'); plotW = Math.max(10, pp.clientWidth); plotH = Math.max(10, pp.clientHeight); plotCanvas.width = Math.round(plotW * dpr); plotCanvas.height = Math.round(plotH * dpr);
    const gp = figure.querySelector('.pork__geo'); geoW = Math.max(10, gp.clientWidth); geoH = Math.max(10, gp.clientHeight); geoCanvas.width = Math.round(geoW * dpr); geoCanvas.height = Math.round(geoH * dpr);
    draw();
  }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  resize(); compute();

  return {
    get grid() { return grid; }, get selected() { return selected; }, get state() { return { ...state } }, METRICS, PLANETS,
    select, selectMin() { if (grid?.min) select(grid.min.jdDep, grid.min.jdArr); },
    setRange({ depStart, depEnd, arrStart, arrEnd }) { if (depStart) state.depStart = parseDate(depStart); if (depEnd) state.depEnd = parseDate(depEnd); if (arrStart) state.arrStart = parseDate(arrStart); if (arrEnd) state.arrEnd = parseDate(arrEnd); heat = null; compute(); },
    setBodies(origin, target) { state.origin = origin; state.target = target; heat = null; compute(); },
    setMetric(m) { if (!METRICS[m]) return; state.metric = m; heat = null; prepareField(); draw(); },
    setResolution(n) { state.n = clamp(Math.round(n), 12, 120); heat = null; compute(); },
    compute() { heat = null; compute(); },
    dispose() { ro.disconnect(); plotCanvas.removeEventListener('pointermove', onMove); plotCanvas.removeEventListener('pointerleave', onLeave); plotCanvas.removeEventListener('click', onClick); figure.remove(); },
  };
}
