/* Bildirimsel bilimsel grafik motoru — chart-theme.css sınıf sözleşmesini
   üretir (elle SVG çizmek yerine). Palet token'larını tüketir; animasyonlar
   reveal() ile tetiklenir, export/reduced-motion son kareyi basar.

   const chart = mountChart(container, {
     type: 'line' | 'bar' | 'scatter',
     viewBox: [960, 540],                // opsiyonel
     x: { label: 'Zaman', unit: 's', ticks: 5 },
     y: { label: 'Hata', unit: 'px', ticks: 5, min?, max? },
     series: [{
       name: 'Gözlem', data: [[x,y],...], slot: 1,
       style: 'observed'|'fitted'|'projected'|'simulated',
       markers: true, band: [[x,lo,hi],...],     // belirsizlik bandı
     }],
     refLines: [{ y: 1.5, label: 'eşik' }],
     annotations: [{ x, y, text, dx?, dy? }],
     legend: false,                      // direct label varsayılan
     reveal: 'auto' | 'manual',          // auto: görünür olunca oynar
   });
   chart.reveal(); chart.finish(); chart.dispose();

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

let gradientCounter = 0;

export function mountChart(container, spec) {
  if (!container) throw new Error('mountChart requires a container');
  const [W, H] = spec.viewBox || [960, 540];
  const M = { top: spec.title ? (spec.subtitle ? 86 : 64) : 28, right: 150, bottom: 78, left: 92, ...(spec.margin || {}) };
  const type = spec.type || 'line';
  const series = spec.series || [];

  /* veri kapsamı */
  let xs = [], ys = [];
  for (const s of series) {
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
  const xTicks = niceTicks(xMin, xMax, spec.x?.ticks || 6);
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
  const animated = [];   /* {node, kind} — reveal sırasında oynatılır */
  const styleClass = { fitted: 'is-fitted', projected: 'is-projected', simulated: 'is-simulated' };
  series.forEach((s, si) => {
    const slot = s.slot || (si % 6) + 1;
    const g = el('g', { 'data-series-slot': slot }, svg);
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
        const bar = el('path', {
          class: 'series-bar',
          d: barPath(bx, sy(Math.max(0, d[1])), barW - 4, Math.abs(sy(d[1]) - sy(0)), 3.5),
        }, g);
        animated.push({ node: bar, kind: 'grow', base: sy(0) });
      });
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
        animated.push({ node: path, kind: 'draw' });
      }
      if (drawsMarkers) {
        screen.forEach(p => {
          const m = el('circle', { class: 'series-marker', cx: r2(p[0]), cy: r2(p[1]), r: 4.6 }, g);
          animated.push({ node: m, kind: 'pop' });
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
      const n = a.node, delay = Math.min(i * 60, 900);
      n.style.transition = `stroke-dashoffset .9s ${delay}ms cubic-bezier(.4,0,.2,1),`
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

  return {
    svg,
    reveal: play,
    finish,
    dispose: () => { observer?.disconnect(); svg.remove(); },
  };
}
