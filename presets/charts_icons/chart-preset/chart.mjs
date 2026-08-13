/* Bildirimsel bilimsel grafik motoru — chart-theme.css sınıf sözleşmesini
   üretir (elle SVG çizmek yerine). Palet token'larını tüketir; animasyonlar
   reveal() ile tetiklenir, export/reduced-motion son kareyi basar.

   const chart = mountChart(container, {
     type: 'line' | 'bar' | 'scatter' | 'violin',
     viewBox: [960, 540],                // opsiyonel
     x: { label: 'Zaman', unit: 's', ticks: 5 },
     y: { label: 'Hata', unit: 'px', ticks: 5, min?, max? },
     series: [{
       name: 'Gözlem', data: [[x,y],...], slot: 1,
       style: 'observed'|'fitted'|'projected'|'simulated',
       markers: true, band: [[x,lo,hi],...],     // belirsizlik bandı
     }],
     // violin için: series: [{ name, values: [ham sayılar...], slot }]
     //   — kategori başına bir keman; x kategorik, y ortak ölçek
     refLines: [{ y: 1.5, label: 'eşik' }],
     annotations: [{ x, y, text, dx?, dy? }],
     legend: false,                      // direct label varsayılan
     reveal: 'auto' | 'manual',          // auto: görünür olunca oynar
   });
   chart.reveal(); chart.finish(); chart.dispose();
   chart.morphTo(patch, {duration});     // saçılım/sütun kayarak yeni veriye geçer,
                                         // çizgi 300ms çapraz solma; Promise döner.
                                         // Eksenler morph sırasında YENİDEN ÖLÇEKLENMEZ.
   chart.sheen(seriesIndex);             // sunucu tetikli TEK SEFERLİK dikkat süpürmesi
                                         // (asla döngü değil; reduced/export'ta no-op)

   KURALLAR (chart-presets.md): gözlem düz çizgi, fit/projeksiyon/simülasyon
   kesikli VE etiketli; belirsizlik varsa bant çizilir; 4+ seri = yeniden
   yapılandırma sinyali; punto tabanları tema CSS'inde. */

const SVG = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
};

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exportMode = () =>
  document.documentElement.dataset.export === 'true'
  || new URLSearchParams(location.search).get('export') === '1';

/* 1-2-5 dizisinde "güzel" tik adımı */
function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step0;
  const step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const lo = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = lo; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

const fmt = v => Math.abs(v) >= 1000 ? v.toLocaleString('tr-TR')
  : (Math.round(v * 100) / 100).toString().replace('.', ',');

/* Fritsch–Carlson MONOTON kübik: veriyi aşmayan (overshoot yok) yumuşak
   eğri — yayın kalitesi görünümün bel kemiği. Kırık çizgi poligonu yalnız
   ayrık adımlar anlam taşıyorsa kullanılır (series.curve: false). */
function monotoneSegs(pts) {
  const n = pts.length;
  if (n < 3) return null;
  const dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1e-9));
  }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  const segs = [];
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    segs.push([pts[i],
      [pts[i][0] + h / 3, pts[i][1] + t[i] * h / 3],
      [pts[i + 1][0] - h / 3, pts[i + 1][1] - t[i + 1] * h / 3],
      pts[i + 1]]);
  }
  return segs;
}
const r2 = v => Math.round(v * 100) / 100;
const segsToPath = segs => `M${r2(segs[0][0][0])},${r2(segs[0][0][1])}`
  + segs.map(s => `C${r2(s[1][0])},${r2(s[1][1])} ${r2(s[2][0])},${r2(s[2][1])} ${r2(s[3][0])},${r2(s[3][1])}`).join('');
const segsToPathReversed = segs => [...segs].reverse()
  .map(s => `C${r2(s[2][0])},${r2(s[2][1])} ${r2(s[1][0])},${r2(s[1][1])} ${r2(s[0][0])},${r2(s[0][1])}`).join('');
const pathFor = (pts, curve = true) => {
  const segs = curve !== false ? monotoneSegs(pts) : null;
  if (segs) return segsToPath(segs);
  return pts.map((p, i) => `${i ? 'L' : 'M'}${r2(p[0])},${r2(p[1])}`).join('');
};
/* üstü yuvarlatılmış sütun */
const barPath = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h);
  return `M${r2(x)},${r2(y + h)} V${r2(y + r)} Q${r2(x)},${r2(y)} ${r2(x + r)},${r2(y)} H${r2(x + w - r)} Q${r2(x + w)},${r2(y)} ${r2(x + w)},${r2(y + r)} V${r2(y + h)} Z`;
};

/* Doğrusal interpolasyonlu yüzdelik (R-7 tanımı) — sıralı dizi ister */
function percentileSorted(sorted, p) {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const idx = (n - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/* Gauss çekirdekli KDE — DETERMİNİSTİK, rastgelelik yok.
   Silverman bant genişliği: h = 0.9 · min(σ, IQR/1.34) · n^(-1/5).
   Yoğunluk [min−h, max+h] aralığında 48 eşit aralıklı y noktasında
   değerlendirilir; kuyruklar bu kadar taşar (çekirdeğin doğası). */
function violinStats(values) {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  if (!n) throw new Error('violin series needs values');
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const iqr = percentileSorted(v, .75) - percentileSorted(v, .25);
  let h = .9 * Math.min(sd || Infinity, iqr / 1.34 || Infinity) * Math.pow(n, -1 / 5);
  /* dejenere dağılım (σ=IQR=0) için güvenli taban — bölme sıfırlanmasın */
  if (!isFinite(h) || h <= 0) h = Math.max((v[n - 1] - v[0]) / 10, 1e-6);
  const lo = v[0] - h, hi = v[n - 1] + h;
  const K = 48, grid = [], dens = [];
  const c = 1 / (n * h * Math.sqrt(2 * Math.PI));
  for (let k = 0; k < K; k++) {
    const y = lo + (hi - lo) * k / (K - 1);
    let s = 0;
    for (const x of v) { const u = (y - x) / h; s += Math.exp(-.5 * u * u); }
    grid.push(y); dens.push(s * c);
  }
  return {
    grid, dens, h, lo, hi,
    q1: percentileSorted(v, .25), med: percentileSorted(v, .5), q3: percentileSorted(v, .75),
    p05: percentileSorted(v, .05), p95: percentileSorted(v, .95),
  };
}

let gradientCounter = 0;

export function mountChart(container, spec) {
  if (!container) throw new Error('mountChart requires a container');
  const [W, H] = spec.viewBox || [960, 540];
  const M = { top: spec.title ? (spec.subtitle ? 86 : 64) : 28, right: 150, bottom: 78, left: 92, ...(spec.margin || {}) };
  const type = spec.type || 'line';
  const series = spec.series || [];

  /* veri kapsamı */
  let xs = [], ys = [];
  /* violin: x kategorik (seri başına bir yuva), y kapsamı KDE aralığından */
  const vstats = type === 'violin' ? series.map(s => violinStats(s.values || [])) : null;
  if (vstats) {
    xs.push(0, series.length);
    for (const st of vstats) ys.push(st.lo, st.hi);
  } else for (const s of series) {
    for (const d of s.data) { xs.push(d[0]); ys.push(d[1]); }
    for (const b of s.band || []) { xs.push(b[0]); ys.push(b[1], b[2]); }
  }
  for (const r of spec.refLines || []) ys.push(r.y);
  if (!xs.length) throw new Error('chart has no data');
  const xMin = spec.x?.min ?? Math.min(...xs), xMax = spec.x?.max ?? Math.max(...xs);
  let yMin = spec.y?.min ?? Math.min(...ys), yMax = spec.y?.max ?? Math.max(...ys);
  if (type === 'bar') yMin = Math.min(0, yMin);
  const yPad = (yMax - yMin) * .06 || 1;
  if (spec.y?.min === undefined) yMin -= (type === 'bar' ? 0 : yPad);
  if (spec.y?.max === undefined) yMax += yPad;

  const plotW = W - M.left - M.right, plotH = H - M.top - M.bottom;
  const sx = v => M.left + (v - xMin) / (xMax - xMin || 1) * plotW;
  const sy = v => M.top + plotH - (v - yMin) / (yMax - yMin || 1) * plotH;

  const svg = el('svg', {
    class: 'sci-chart', viewBox: `0 0 ${W} ${H}`,
    role: 'img', 'aria-label': spec.title || spec.y?.label || 'grafik',
  });
  svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.display = 'block';
  container.appendChild(svg);

  /* grid (yatay) + eksenler */
  const yTicks = niceTicks(yMin, yMax, spec.y?.ticks || 5);
  const xTicks = vstats ? [] : niceTicks(xMin, xMax, spec.x?.ticks || 6);
  const grid = el('g', { class: 'grid' }, svg);
  for (const t of yTicks)
    el('line', { x1: M.left, x2: W - M.right, y1: sy(t), y2: sy(t) }, grid);

  const axisY = el('g', { class: 'axis' }, svg);
  el('line', { x1: M.left, x2: M.left, y1: M.top, y2: M.top + plotH }, axisY);
  for (const t of yTicks) {
    const tick = el('g', { class: 'tick' }, axisY);
    el('line', { x1: M.left - 7, x2: M.left, y1: sy(t), y2: sy(t) }, tick);
    el('text', { x: M.left - 12, y: sy(t) + 7, 'text-anchor': 'end' }, tick).textContent = fmt(t);
  }
  const axisX = el('g', { class: 'axis' }, svg);
  el('line', { x1: M.left, x2: W - M.right, y1: M.top + plotH, y2: M.top + plotH }, axisX);
  for (const t of xTicks) {
    const tick = el('g', { class: 'tick' }, axisX);
    el('line', { x1: sx(t), x2: sx(t), y1: M.top + plotH, y2: M.top + plotH + 7 }, tick);
    el('text', { x: sx(t), y: M.top + plotH + 30, 'text-anchor': 'middle' }, tick).textContent = fmt(t);
  }
  /* violin: kategori adları yuva merkezlerinin altına (sayısal tik yerine) */
  if (vstats) series.forEach((s, i) => {
    const tick = el('g', { class: 'tick' }, axisX);
    el('text', {
      x: M.left + (i + .5) * (plotW / series.length),
      y: M.top + plotH + 30, 'text-anchor': 'middle',
    }, tick).textContent = s.name || `#${i + 1}`;
  });
  const defs = el('defs', {}, svg);

  /* başlık: grafiğin İDDİASI (assertion) — konu etiketi değil */
  if (spec.title) {
    el('text', { class: 'sci-chart-title', x: M.left, y: 30 }, svg).textContent = spec.title;
  }
  if (spec.subtitle) {
    el('text', { class: 'sci-chart-subtitle', x: M.left, y: 54 }, svg).textContent = spec.subtitle;
  }
  if (spec.source) {
    el('text', { class: 'sci-chart-source', x: W - 10, y: H - 10, 'text-anchor': 'end' }, svg)
      .textContent = spec.source;
  }
  if (spec.y?.label) {
    const t = el('text', { class: 'axis-title', x: M.left, y: M.top - 8 }, svg);
    t.textContent = spec.y.label + (spec.y.unit ? '' : '');
    if (spec.y.unit) el('tspan', { class: 'axis-unit', dx: 8 }, t).textContent = `(${spec.y.unit})`;
  }
  if (spec.x?.label) {
    const t = el('text', {
      class: 'axis-title', x: M.left + plotW / 2, y: H - 14, 'text-anchor': 'middle',
    }, svg);
    t.textContent = spec.x.label;
    if (spec.x.unit) el('tspan', { class: 'axis-unit', dx: 8 }, t).textContent = `(${spec.x.unit})`;
  }

  /* referans çizgileri: eşik HER ZAMAN etiketlidir */
  for (const r of spec.refLines || []) {
    el('line', { class: 'ref-line', x1: M.left, x2: W - M.right, y1: sy(r.y), y2: sy(r.y) }, svg);
    el('text', { class: 'ref-label', x: W - M.right + 8, y: sy(r.y) + 6 }, svg)
      .textContent = r.label ?? fmt(r.y);
  }

  /* seriler */
  const animated = [];   /* {node, kind, delay?} — reveal sırasında oynatılır */
  const seriesNodes = []; /* morphTo/sheen için seri başına düğüm kaydı */
  const styleClass = { fitted: 'is-fitted', projected: 'is-projected', simulated: 'is-simulated' };
  series.forEach((s, si) => {
    const slot = s.slot || (si % 6) + 1;
    const g = el('g', { 'data-series-slot': slot }, svg);
    const rec = { g, line: null, markers: [], bars: [], shape: null, label: null };
    seriesNodes.push(rec);
    if (vstats) {
      /* ---- violin: aynalı yoğunluk konturu + kuartil kutusu + medyan ----
         Genişlik normalizasyonu KEMAN BAŞINA yapılır (her keman kendi maks.
         yoğunluğuna ölçeklenir): genişlikler kemanlar ARASINDA karşılaştırılamaz. */
      const st = vstats[si];
      const slotW = plotW / series.length;
      const cx = M.left + (si + .5) * slotW;
      const maxHalf = .36 * slotW;               /* paylaşılan maks. genişlik = .72 × yuva */
      const maxD = Math.max(...st.dens);
      let d = '';
      st.grid.forEach((y, k) => {                /* sağ kenar: alttan yukarı */
        d += `${k ? 'L' : 'M'}${r2(cx + st.dens[k] / maxD * maxHalf)},${r2(sy(y))}`;
      });
      for (let k = st.grid.length - 1; k >= 0; k--) /* sol kenar: aynalı, yukarıdan aşağı */
        d += `L${r2(cx - st.dens[k] / maxD * maxHalf)},${r2(sy(st.grid[k]))}`;
      const shape = el('path', { class: 'violin-shape', d: d + 'Z' }, g);
      rec.shape = shape;
      /* keman merkez çizgisinden yatay büyür (scaleX 0→1), ~90ms kademeli */
      animated.push({ node: shape, kind: 'growx', base: cx, delay: si * 90 });
      /* iç işaretler: bıyık (5–95) → kutu (Q1–Q3) → medyan noktası (işaret) */
      const wh = el('line', { class: 'violin-whisker', x1: cx, x2: cx, y1: r2(sy(st.p05)), y2: r2(sy(st.p95)) }, g);
      const box = el('rect', { class: 'violin-box', x: r2(cx - 5), width: 10, y: r2(sy(st.q3)), height: r2(sy(st.q1) - sy(st.q3)), rx: 2 }, g);
      const med = el('circle', { class: 'series-marker violin-median', cx: r2(cx), cy: r2(sy(st.med)), r: 5.2 }, g);
      animated.push({ node: wh, kind: 'fade', delay: si * 90 + 420 },
        { node: box, kind: 'fade', delay: si * 90 + 420 },
        { node: med, kind: 'pop', delay: si * 90 + 500 });
      return;
    }
    const screen = s.data.map(d => [sx(d[0]), sy(d[1])]);
    /* katman sırası: bant → alan → çizgi → noktalar (estetik yasası) */
    if (s.band && s.band.length) {
      const top = s.band.map(b => [sx(b[0]), sy(b[2])]);
      const bot = s.band.map(b => [sx(b[0]), sy(b[1])]);
      const topSegs = s.curve !== false ? monotoneSegs(top) : null;
      const botSegs = s.curve !== false ? monotoneSegs(bot) : null;
      const d = topSegs && botSegs
        ? `${segsToPath(topSegs)} L${r2(bot[bot.length - 1][0])},${r2(bot[bot.length - 1][1])} ${segsToPathReversed(botSegs)} Z`
        : [...top, ...[...bot].reverse()].map((p, i) => `${i ? 'L' : 'M'}${r2(p[0])},${r2(p[1])}`).join('') + 'Z';
      const band = el('path', { class: 'uncertainty-band', d }, g);
      animated.push({ node: band, kind: 'fade' });
    }
    if (type === 'bar') {
      const groups = series.length;
      const slotW = plotW / s.data.length;
      const barW = Math.min(64, slotW * .7 / groups);
      s.data.forEach(d => {
        const bx = sx(d[0]) - (groups * barW) / 2 + si * barW;
        const h = Math.abs(sy(d[1]) - sy(0));
        const bar = el('path', {
          class: 'series-bar',
          d: barPath(bx, sy(Math.max(0, d[1])), barW - 4, h, 3.5),
        }, g);
        bar.dataset.h = h; bar.dataset.bx = bx; /* morph için geometri kaydı */
        rec.bars.push(bar);
        animated.push({ node: bar, kind: 'grow', base: sy(0) });
      });
      rec.barW = barW; rec.groups = groups; rec.si = si;
    } else {
      /* epistemik stilli seriler (fit/projeksiyon/simülasyon) SAÇILIMDA da
         çizgidir — fit'i noktalarla çizmek onu veri gibi gösterir */
      const drawsLine = type === 'line' || !!s.style;
      const drawsMarkers = (type === 'scatter' && !s.style) || s.markers;
      if (drawsLine && s.area) {
        /* degrade alan dolgusu: seri renginden şeffafa dikey solma */
        const gid = `sciGrad${++gradientCounter}`;
        const grad = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        el('stop', { offset: '0%', style: `stop-color: var(--chart-series-${slot}); stop-opacity: .26` }, grad);
        el('stop', { offset: '100%', style: `stop-color: var(--chart-series-${slot}); stop-opacity: 0` }, grad);
        const baseY = M.top + plotH;
        const area = el('path', {
          class: 'series-area', fill: `url(#${gid})`,
          d: `${pathFor(screen, s.curve)} L${r2(screen[screen.length - 1][0])},${r2(baseY)} L${r2(screen[0][0])},${r2(baseY)} Z`,
        }, g);
        animated.push({ node: area, kind: 'fade' });
      }
      if (drawsLine) {
        const path = el('path', {
          class: `series-line ${styleClass[s.style] || ''}`.trim(),
          d: pathFor(screen, s.curve),
        }, g);
        rec.line = path;
        animated.push({ node: path, kind: 'draw' });
      }
      if (drawsMarkers) {
        /* saçılım pop-in: VERİ SIRASIYLA ~14ms arayla; toplam 1.2s'yi aşarsa
           adım ölçeklenerek sıkıştırılır */
        const step = Math.min(14, 1200 / Math.max(screen.length, 1));
        screen.forEach((p, pi) => {
          const m = el('circle', { class: 'series-marker', cx: r2(p[0]), cy: r2(p[1]), r: 4.6 }, g);
          rec.markers.push(m);
          animated.push({ node: m, kind: 'pop', delay: type === 'scatter' ? Math.round(pi * step) : undefined });
        });
      }
    }
    /* direct label: son noktanın yanına, seri renginde */
    if (s.name && !spec.legend) {
      const last = s.data[s.data.length - 1];
      const lbl = el('text', {
        class: 'direct-label', x: sx(last[0]) + 12, y: sy(last[1]) + 6,
      }, g);
      lbl.textContent = s.name;
      rec.label = lbl;
      animated.push({ node: lbl, kind: 'fade' });
    }
  });

  /* açıklamalar */
  for (const a of spec.annotations || []) {
    const gx = sx(a.x), gy = sy(a.y);
    const tx = gx + (a.dx ?? 18), ty = gy + (a.dy ?? -18);
    const line = el('line', { class: 'annotation-arrow', x1: tx, y1: ty + 4, x2: gx + 3, y2: gy - 3 }, svg);
    const txt = el('text', { class: 'annotation', x: tx, y: ty }, svg);
    txt.textContent = a.text;
    animated.push({ node: line, kind: 'fade' }, { node: txt, kind: 'fade' });
  }

  /* animasyon: reveal'a kadar gizli başlangıç; export/reduced anında biter */
  const instant = exportMode() || reducedMotion();
  let revealed = false;
  const prime = () => {
    for (const a of animated) {
      const n = a.node;
      if (a.kind === 'draw') {
        const len = n.getTotalLength ? n.getTotalLength() : 0;
        n.style.strokeDasharray = n.classList.contains('series-line') && !n.classList.contains('is-fitted')
          && !n.classList.contains('is-projected') && !n.classList.contains('is-simulated')
          ? `${len}` : n.style.strokeDasharray;
        if (n.style.strokeDasharray === `${len}`) n.style.strokeDashoffset = `${len}`;
        else n.style.opacity = '0';   /* kesikli çizgiler dash bozulmasın diye fade */
        n.dataset.len = len;
      } else if (a.kind === 'grow') {
        n.style.transformOrigin = `center ${a.base}px`;
        n.style.transform = 'scaleY(0)';
      } else if (a.kind === 'growx') {
        /* keman: merkez çizgisinden yatay büyüme */
        n.style.transformOrigin = `${a.base}px 0px`;
        n.style.transform = 'scaleX(0)';
      } else if (a.kind === 'pop') {
        n.style.transform = 'scale(0)';
        n.style.transformOrigin = `${n.getAttribute('cx')}px ${n.getAttribute('cy')}px`;
      } else n.style.opacity = '0';
    }
  };
  const play = () => {
    if (revealed) return;
    revealed = true;
    animated.forEach((a, i) => {
      const n = a.node, delay = a.delay ?? Math.min(i * 60, 900);
      /* pop: ~%6 taşmayla oturan küçük ölçek; growx: sakin, taşmasız büyüme */
      n.style.transition = a.kind === 'pop'
        ? `transform .42s ${delay}ms cubic-bezier(.34,1.3,.5,1), opacity .3s ${delay}ms ease`
        : a.kind === 'growx'
          ? `transform .6s ${delay}ms cubic-bezier(.4,0,.2,1), opacity .5s ${delay}ms ease`
          : `stroke-dashoffset .9s ${delay}ms cubic-bezier(.4,0,.2,1),`
          + `transform .55s ${delay}ms cubic-bezier(.34,1.4,.4,1), opacity .5s ${delay}ms ease`;
      requestAnimationFrame(() => {
        if (a.kind === 'draw' && n.style.strokeDashoffset) n.style.strokeDashoffset = '0';
        n.style.opacity = '1';
        n.style.transform = 'none';
      });
    });
  };
  const finish = () => {
    revealed = true;
    for (const a of animated) {
      const n = a.node;
      n.style.transition = 'none';
      n.style.opacity = '1';
      n.style.transform = 'none';
      if (a.kind === 'draw') n.style.strokeDashoffset = '0';
    }
  };

  let observer = null;
  if (instant) finish();
  else {
    prime();
    if ((spec.reveal || 'auto') === 'auto') {
      observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { play(); observer.disconnect(); }
      }, { threshold: .35 });
      observer.observe(svg);
      /* gizli sekme/sayfa güvencesi: IO hiç tetiklenmezse bile son durum kaybolmasın */
      setTimeout(() => { if (!revealed) finish(); }, 6000);
    }
  }

  /* ---- morphTo: seri verisini YERİNDE günceller ----
     patch: seri dizisiyle hizalı dizi — patch[si] = { data: [[x,y],...] }
     (ya da doğrudan veri dizisi); atlanan indeksler dokunulmaz.
     Eksen alanı morph sırasında YENİDEN ÖLÇEKLENMEZ: aynı domain'i
     y.min/max (ve x.min/max) ile sabitleyin, yoksa taşan noktalar
     plot dışına kayar (dürüst sınırlama).
     Saçılım: indeksle eşleşen noktalar kayar, fazlası söner, yenisi pop'lar.
     Sütun: yükseklik scaleY ile kayar. Çizgi: 'd' tween'lenemez —
     300ms opaklık çapraz solmasıyla yeniden çizilir. */
  function morphTo(patch, opts = {}) {
    const duration = opts.duration ?? 650;
    const instantNow = exportMode() || reducedMotion();
    let longest = 0;
    (patch || []).forEach((p, si) => {
      const rec = seriesNodes[si], s = series[si];
      if (!p || !rec || !s || vstats) return;   /* violin morph desteklenmez */
      const newData = Array.isArray(p) ? p : p.data;
      if (!Array.isArray(newData)) return;
      const screen = newData.map(d => [sx(d[0]), sy(d[1])]);

      /* -- işaretçiler (saçılım / markers:true): kay-sön-pop -- */
      if (rec.markers.length || (!rec.line && !rec.bars.length)) {
        const old = rec.markers;
        const nKeep = Math.min(old.length, screen.length);
        for (let i = 0; i < nKeep; i++) {
          const m = old[i];
          if (instantNow) {
            m.setAttribute('cx', r2(screen[i][0])); m.setAttribute('cy', r2(screen[i][1]));
          } else {
            m.style.transition = `cx ${duration}ms cubic-bezier(.4,0,.2,1), cy ${duration}ms cubic-bezier(.4,0,.2,1)`;
            requestAnimationFrame(() => { m.style.cx = `${r2(screen[i][0])}px`; m.style.cy = `${r2(screen[i][1])}px`; });
          }
        }
        for (let i = screen.length; i < old.length; i++) {   /* silinenler söner */
          const m = old[i];
          if (instantNow) m.remove();
          else {
            m.style.transition = `opacity ${Math.min(duration, 350)}ms ease`;
            requestAnimationFrame(() => { m.style.opacity = '0'; });
            setTimeout(() => m.remove(), duration + 60);
          }
        }
        rec.markers = old.slice(0, nKeep);
        for (let i = nKeep; i < screen.length; i++) {        /* eklenenler pop'lar */
          const m = el('circle', {
            class: 'series-marker pt', cx: r2(screen[i][0]), cy: r2(screen[i][1]), r: 4.6,
          }, rec.g);
          if (!instantNow) {
            m.style.transformOrigin = `${r2(screen[i][0])}px ${r2(screen[i][1])}px`;
            m.style.transform = 'scale(0)';
            requestAnimationFrame(() => requestAnimationFrame(() => { m.style.transform = 'scale(1)'; }));
          }
          rec.markers.push(m);
        }
        longest = Math.max(longest, duration);
      }

      /* -- çizgi: d tween'lenemez; 300ms çapraz solma -- */
      if (rec.line) {
        const newD = pathFor(screen, s.curve);
        if (instantNow) rec.line.setAttribute('d', newD);
        else {
          const ghost = rec.line.cloneNode(false);
          rec.line.after(ghost);
          rec.line.setAttribute('d', newD);
          rec.line.style.strokeDasharray = ''; rec.line.style.strokeDashoffset = '';
          rec.line.style.transition = 'none'; rec.line.style.opacity = '0';
          ghost.style.transition = 'opacity 300ms ease';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            rec.line.style.transition = 'opacity 300ms ease';
            rec.line.style.opacity = '1'; ghost.style.opacity = '0';
          }));
          setTimeout(() => ghost.remove(), 380);
          longest = Math.max(longest, 300);
        }
      }

      /* -- sütun: yeni yol + scaleY(eski/yeni) → scaleY(1) kayması -- */
      rec.bars.forEach((bar, i) => {
        const d = newData[i];
        if (!d) { bar.style.transition = 'opacity 300ms ease'; bar.style.opacity = '0'; return; }
        const h = Math.abs(sy(d[1]) - sy(0));
        const oldH = +bar.dataset.h || h;
        bar.setAttribute('d', barPath(+bar.dataset.bx, sy(Math.max(0, d[1])), rec.barW - 4, h, 3.5));
        bar.dataset.h = h;
        if (!instantNow && h > .5) {
          bar.style.transition = 'none';
          bar.style.transformOrigin = `center ${sy(0)}px`;
          bar.style.transform = `scaleY(${r2(oldH / h)})`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            bar.style.transition = `transform ${duration}ms cubic-bezier(.4,0,.2,1)`;
            bar.style.transform = 'scaleY(1)';
          }));
          longest = Math.max(longest, duration);
        } else bar.style.transform = 'none';
      });

      /* direct label yeni son noktayı izler (anında — küçük metin kayması) */
      if (rec.label && newData.length) {
        const last = newData[newData.length - 1];
        rec.label.setAttribute('x', r2(sx(last[0]) + 12));
        rec.label.setAttribute('y', r2(sy(last[1]) + 6));
      }
      s.data = newData;
    });
    /* geçiş bitince çözülür; stil cx/cy değerleri niteliklere yazılır */
    return new Promise(resolve => setTimeout(() => {
      for (const rec of seriesNodes) for (const m of rec.markers) {
        if (m.style.cx) { m.setAttribute('cx', parseFloat(m.style.cx)); m.style.cx = ''; }
        if (m.style.cy) { m.setAttribute('cy', parseFloat(m.style.cy)); m.style.cy = ''; }
      }
      resolve();
    }, instantNow ? 0 : longest + 80));
  }

  /* ---- sheen: sunucu tetikli TEK SEFERLİK dikkat süpürmesi ----
     Asla döngü yapmaz, kalıcı filtre/gölge bırakmaz; reduced-motion ve
     export modunda no-op. flashRow tablo grameriyle paraleldir. */
  function sheen(si = 0) {
    if (exportMode() || reducedMotion()) return;
    const rec = seriesNodes[si];
    if (!rec) return;
    const bright = 'color-mix(in srgb, var(--series-color, var(--chart-series-1)) 60%, white)';
    if (rec.line) {
      /* parlak kısa segman yol boyunca bir kez akar ve söner */
      const len = rec.line.getTotalLength();
      const ov = el('path', { class: 'sheen-overlay', d: rec.line.getAttribute('d') }, rec.g);
      ov.style.stroke = bright;
      ov.style.strokeDasharray = `18 ${Math.ceil(len) + 18}`;
      /* opaklık yol boyunca tam kalır, yalnız son çeyrekte söner —
         yoksa parlak segman daha yarı yolda görünmez olur */
      const anim = ov.animate(
        [{ strokeDashoffset: 18, opacity: 1 },
         { opacity: 1, offset: .72 },
         { strokeDashoffset: -len, opacity: 0 }],
        { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      anim.onfinish = () => ov.remove();
      setTimeout(() => ov.remove(), 1100);   /* güvence: her durumda kaldır */
    } else if (rec.shape) {
      /* keman: kontur üstünde tek seferlik parlaklık nabzı (0→1→0) */
      const ov = el('path', { class: 'sheen-outline', d: rec.shape.getAttribute('d') }, rec.g);
      ov.style.stroke = bright;
      const anim = ov.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }],
        { duration: 900, easing: 'ease-in-out' });
      anim.onfinish = () => ov.remove();
      setTimeout(() => ov.remove(), 1100);
    } else if (rec.markers.length) {
      /* saçılım: her noktadan 20ms kademeyle bir kez genişleyen halka */
      rec.markers.forEach((m, i) => {
        const cx = +m.getAttribute('cx'), cy = +m.getAttribute('cy');
        const ring = el('circle', { class: 'sheen-ripple', cx, cy, r: 8 }, rec.g);
        ring.style.stroke = bright;
        ring.style.transformOrigin = `${cx}px ${cy}px`;
        const anim = ring.animate(
          [{ transform: 'scale(.5)', opacity: .9 }, { transform: 'scale(2.6)', opacity: 0 }],
          { duration: 600, delay: i * 20, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'backwards' });
        anim.onfinish = () => ring.remove();
        setTimeout(() => ring.remove(), 700 + i * 20);
      });
    }
  }

  return {
    svg,
    reveal: play,
    finish,
    morphTo,
    sheen,
    dispose: () => { observer?.disconnect(); svg.remove(); },
  };
}
