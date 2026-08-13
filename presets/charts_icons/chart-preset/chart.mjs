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

   ── KOREOGRAFİ KATMANI (deterministik zaman çizgisi; Math.random yok) ──
   chart.enter({stagger=1, sure=1, oynat=true})
     → { bitti: Promise, seek01(t), finish(), iptal() }
     Sahne girişi: eksenler süpürülerek çizilir, tik'ler kademeli düşer, grid
     sırayla belirir; SONRA veri katmanı tip'e göre girer:
       line    → yol boyunca çizim + uçta komet başı + akan değer okuması
                 (okuma ÇİZİLEN eğrinin o x'teki değeridir — yanlış değer ima
                 edilmez); işaretçiler komet geçerken pop'lar; çizgi oturunca
                 alan tek süpürüşle dolar; bant çizgiden dışa TEK nefeste şişer.
       bar     → yaylı kalkış (~%6 aşım), değer etiketleri sayarak gelir.
       scatter → damla yağmuru; fit çizgisi uçtan süpürülür (kesikli desen
                 bozulmadan, clip ile); bant nefes alarak şişer.
       violin  → kontur omurgadan dışa büyür; kutu/medyan snap + tek mikro-sarsım.
     seek01(t) SENKRON render eder (headless ?t= doğrulaması / gizli sekme).
     Tekrar çağrılabilir (replay). reduced-motion/export → SON KARE.
   chart.vurgula(hedef, {not})           // bar: {seri,indeks}|indeks → tek nabız
                                         // + diğerleri kısılır + iddia notu kayar;
                                         // çizgi: seri indeksi → diğer seriler kısılır.
                                         // vurgula(null) temizler.
   chart.kumeVurgula(maske, {seri, not}) // saçılım: maske (bool[] | (d,i)=>bool)
                                         // seçili küme öne, gerisi kısılır; null temizler.
   chart.setData(patch, {sure=800, delta=true, oynat=true})
     FLIP geçişi: eşleşen öğeler kayar, silinen söner, eklenen pop'lar; değişen
     öğenin yanında kısa ömürlü birimli delta çipi (+2,3 m) yüzer ve söner.
     Domain pin'lenmemişse eksen YENİDEN ÖLÇEKLENİR: tik'ler odometre gibi
     kayarak yeniden numaralanır, grid/seri/refLine hep birlikte akar.
     oynat:false → {seek01,finish,bitti} tutamacı döner (headless doğrulama).
   chart.sahnele([{vurgula|kumeVurgula|setData|sheen, not}, ...])
     → { ileri(), geri(), git(i), adim, uzunluk, sifirla() } — deste ok
     tuşlarına BAĞLANABİLİR olay API'si; global keydown EKLEMEZ.

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

/* ── Deterministik easing: kübik-bezier çözücü (Newton + ikili arama) ── */
function cubicBezierEase(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = t => ((ax * t + bx) * t + cx) * t;
  const sampleY = t => ((ay * t + by) * t + cy) * t;
  const slopeX = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slopeX(t);
      if (Math.abs(s) < 1e-6) break;
      t -= (sampleX(t) - x) / s;
    }
    if (t < 0 || t > 1 || Math.abs(sampleX(t) - x) > 1e-4) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; sampleX(m) < x ? lo = m : hi = m; }
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}
const EASE = {
  inOut: cubicBezierEase(.4, 0, .2, 1),
  out: cubicBezierEase(0, 0, .2, 1),
};
/* hafif aşımla oturan yay: s parlaklığı aşım miktarını belirler */
const backOut = (s = 1.70158) => t => { const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
/* monoton easing'in tersi (komet işaretçi zamanlaması için) */
const invEase = (ease, y) => {
  if (y <= 0) return 0;
  if (y >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; ease(m) < y ? lo = m : hi = m; }
  return (lo + hi) / 2;
};

/* ── Zaman çizgisi sürücüsü: rAF ile oynar, seekMs ile SENKRON konumlanır.
   Her iz {t0, dur, ease, apply(pEased)}; apply idempotenttir — herhangi bir
   ana atlayarak gelinebilir (?t= doğrulaması, gizli sekme). ── */
function makeTL() {
  const tracks = [];
  let total = 0, raf = 0, resolveDone = null;
  return {
    add(t0, dur, ease, apply) {
      tracks.push({ t0, dur: Math.max(dur, 1), ease, apply });
      total = Math.max(total, t0 + dur);
    },
    seekMs(ms) {
      for (const tr of tracks) {
        let p = (ms - tr.t0) / tr.dur;
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        tr.apply(tr.ease ? tr.ease(p) : p);
      }
    },
    total: () => total,
    play() {
      return new Promise(res => {
        resolveDone = res;
        const start = performance.now();
        const step = now => {
          const ms = now - start;
          this.seekMs(ms);
          if (ms >= total) { raf = 0; resolveDone = null; res(); }
          else raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      });
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (resolveDone) { resolveDone(); resolveDone = null; }
    },
  };
}

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

  /* domain MUTABLE tutulur: setData eksen yeniden ölçeklemesi dom üzerinden akar */
  const domainFrom = (list) => {
    let dxs = [], dys = [];
    for (const s of list) {
      for (const d of s.data || []) { dxs.push(d[0]); dys.push(d[1]); }
      for (const b of s.band || []) { dxs.push(b[0]); dys.push(b[1], b[2]); }
    }
    for (const r of spec.refLines || []) dys.push(r.y);
    let xMin = spec.x?.min ?? Math.min(...dxs), xMax = spec.x?.max ?? Math.max(...dxs);
    let yMin = spec.y?.min ?? Math.min(...dys), yMax = spec.y?.max ?? Math.max(...dys);
    if (type === 'bar') yMin = Math.min(0, yMin);
    const yPad = (yMax - yMin) * .06 || 1;
    if (spec.y?.min === undefined) yMin -= (type === 'bar' ? 0 : yPad);
    if (spec.y?.max === undefined) yMax += yPad;
    return { xMin, xMax, yMin, yMax };
  };
  const dom = (() => {
    if (vstats) {
      let yMin = spec.y?.min ?? Math.min(...ys), yMax = spec.y?.max ?? Math.max(...ys);
      const yPad = (yMax - yMin) * .06 || 1;
      if (spec.y?.min === undefined) yMin -= yPad;
      if (spec.y?.max === undefined) yMax += yPad;
      return { xMin: spec.x?.min ?? Math.min(...xs), xMax: spec.x?.max ?? Math.max(...xs), yMin, yMax };
    }
    return domainFrom(series);
  })();

  const plotW = W - M.left - M.right, plotH = H - M.top - M.bottom;
  const sx = v => M.left + (v - dom.xMin) / (dom.xMax - dom.xMin || 1) * plotW;
  const sy = v => M.top + plotH - (v - dom.yMin) / (dom.yMax - dom.yMin || 1) * plotH;
  const invY = py => dom.yMin + (M.top + plotH - py) / (plotH || 1) * (dom.yMax - dom.yMin);

  const svg = el('svg', {
    class: 'sci-chart', viewBox: `0 0 ${W} ${H}`,
    role: 'img', 'aria-label': spec.title || spec.y?.label || 'grafik',
  });
  svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.display = 'block';
  container.appendChild(svg);

  /* ── eksen/grid kayıtları: enter koreografisi ve setData yeniden ölçeklemesi
     bu kayıtlar üzerinden konumlar/solar ── */
  const axisParts = { yLine: null, xLine: null, yTicks: [], xTicks: [], catLabels: [], gridLines: [] };
  const headerNodes = [];         /* başlık, altbaşlık, kaynak, eksen başlıkları */
  const refEls = [], annoEls = [];

  const yTickVals = niceTicks(dom.yMin, dom.yMax, spec.y?.ticks || 5);
  const xTickVals = vstats ? [] : niceTicks(dom.xMin, dom.xMax, spec.x?.ticks || 6);
  const grid = el('g', { class: 'grid' }, svg);
  const makeGridLine = (val, hidden) => {
    const node = el('line', { x1: M.left, x2: W - M.right, y1: r2(sy(val)), y2: r2(sy(val)) }, grid);
    if (hidden) node.style.opacity = '0';
    return { node, val };
  };
  axisParts.gridLines = yTickVals.map(v => makeGridLine(v));

  const axisY = el('g', { class: 'axis' }, svg);
  axisParts.yLine = el('line', { x1: M.left, x2: M.left, y1: M.top, y2: M.top + plotH }, axisY);
  const makeYTick = (val, hidden) => {
    const g = el('g', { class: 'tick' }, axisY);
    const line = el('line', { x1: M.left - 7, x2: M.left, y1: r2(sy(val)), y2: r2(sy(val)) }, g);
    const text = el('text', { x: M.left - 12, y: r2(sy(val) + 7), 'text-anchor': 'end' }, g);
    text.textContent = fmt(val);
    if (hidden) g.style.opacity = '0';
    return { g, line, text, val };
  };
  axisParts.yTicks = yTickVals.map(v => makeYTick(v));

  const axisX = el('g', { class: 'axis' }, svg);
  axisParts.xLine = el('line', { x1: M.left, x2: W - M.right, y1: M.top + plotH, y2: M.top + plotH }, axisX);
  const makeXTick = (val, hidden) => {
    const g = el('g', { class: 'tick' }, axisX);
    const line = el('line', { x1: r2(sx(val)), x2: r2(sx(val)), y1: M.top + plotH, y2: M.top + plotH + 7 }, g);
    const text = el('text', { x: r2(sx(val)), y: M.top + plotH + 30, 'text-anchor': 'middle' }, g);
    text.textContent = fmt(val);
    if (hidden) g.style.opacity = '0';
    return { g, line, text, val };
  };
  axisParts.xTicks = xTickVals.map(v => makeXTick(v));

  /* violin: kategori adları yuva merkezlerinin altına (sayısal tik yerine) */
  if (vstats) series.forEach((s, i) => {
    const g = el('g', { class: 'tick' }, axisX);
    el('text', {
      x: M.left + (i + .5) * (plotW / series.length),
      y: M.top + plotH + 30, 'text-anchor': 'middle',
    }, g).textContent = s.name || `#${i + 1}`;
    axisParts.catLabels.push({ g, val: null });
  });
  const defs = el('defs', {}, svg);

  /* başlık: grafiğin İDDİASI (assertion) — konu etiketi değil */
  if (spec.title) {
    headerNodes.push(el('text', { class: 'sci-chart-title', x: M.left, y: 30 }, svg));
    headerNodes[headerNodes.length - 1].textContent = spec.title;
  }
  if (spec.subtitle) {
    const t = el('text', { class: 'sci-chart-subtitle', x: M.left, y: 54 }, svg);
    t.textContent = spec.subtitle;
    headerNodes.push(t);
  }
  if (spec.source) {
    const t = el('text', { class: 'sci-chart-source', x: W - 10, y: H - 10, 'text-anchor': 'end' }, svg);
    t.textContent = spec.source;
    headerNodes.push(t);
  }
  if (spec.y?.label) {
    const t = el('text', { class: 'axis-title', x: M.left, y: M.top - 8 }, svg);
    t.textContent = spec.y.label;
    if (spec.y.unit) el('tspan', { class: 'axis-unit', dx: 8 }, t).textContent = `(${spec.y.unit})`;
    headerNodes.push(t);
  }
  if (spec.x?.label) {
    const t = el('text', {
      class: 'axis-title', x: M.left + plotW / 2, y: H - 14, 'text-anchor': 'middle',
    }, svg);
    t.textContent = spec.x.label;
    if (spec.x.unit) el('tspan', { class: 'axis-unit', dx: 8 }, t).textContent = `(${spec.x.unit})`;
    headerNodes.push(t);
  }

  /* referans çizgileri: eşik HER ZAMAN etiketlidir */
  for (const r of spec.refLines || []) {
    const line = el('line', { class: 'ref-line', x1: M.left, x2: W - M.right, y1: r2(sy(r.y)), y2: r2(sy(r.y)) }, svg);
    const text = el('text', { class: 'ref-label', x: W - M.right + 8, y: r2(sy(r.y) + 6) }, svg);
    text.textContent = r.label ?? fmt(r.y);
    refEls.push({ line, text, r });
  }

  /* bant geometrisi: q=1 tam bant; q<1 orta hattından içe sıkışmış hâli
     (enter "nefes" şişmesi q'yu 0→~1.05→1 sürer — tek seferlik) */
  const bandScreen = (band, q = 1, curve = true) => {
    const top = [], bot = [];
    for (const b of band) {
      const x = sx(b[0]), loY = sy(b[1]), hiY = sy(b[2]), mid = (loY + hiY) / 2;
      top.push([x, mid + (hiY - mid) * q]);
      bot.push([x, mid + (loY - mid) * q]);
    }
    const topSegs = curve !== false ? monotoneSegs(top) : null;
    const botSegs = curve !== false ? monotoneSegs(bot) : null;
    return topSegs && botSegs
      ? `${segsToPath(topSegs)} L${r2(bot[bot.length - 1][0])},${r2(bot[bot.length - 1][1])} ${segsToPathReversed(botSegs)} Z`
      : [...top, ...[...bot].reverse()].map((p, i) => `${i ? 'L' : 'M'}${r2(p[0])},${r2(p[1])}`).join('') + 'Z';
  };
  const areaD = (screen, curve) =>
    `${pathFor(screen, curve)} L${r2(screen[screen.length - 1][0])},${r2(M.top + plotH)} L${r2(screen[0][0])},${r2(M.top + plotH)} Z`;

  /* seriler */
  const animated = [];   /* {node, kind, delay?} — reveal sırasında oynatılır */
  const seriesNodes = []; /* morphTo/sheen/enter/setData için seri başına düğüm kaydı */
  const styleClass = { fitted: 'is-fitted', projected: 'is-projected', simulated: 'is-simulated' };
  series.forEach((s, si) => {
    const slot = s.slot || (si % 6) + 1;
    const g = el('g', { 'data-series-slot': slot }, svg);
    const rec = { g, line: null, markers: [], bars: [], shape: null, label: null, band: null, area: null, valueLabels: null };
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
      rec.shape = shape; rec.cx = cx; rec.stats = st;
      /* keman merkez çizgisinden yatay büyür (scaleX 0→1), ~90ms kademeli */
      animated.push({ node: shape, kind: 'growx', base: cx, delay: si * 90 });
      /* iç işaretler: bıyık (5–95) → kutu (Q1–Q3) → medyan noktası (işaret) */
      const wh = el('line', { class: 'violin-whisker', x1: cx, x2: cx, y1: r2(sy(st.p05)), y2: r2(sy(st.p95)) }, g);
      const box = el('rect', { class: 'violin-box', x: r2(cx - 5), width: 10, y: r2(sy(st.q3)), height: r2(sy(st.q1) - sy(st.q3)), rx: 2 }, g);
      const med = el('circle', { class: 'series-marker violin-median', cx: r2(cx), cy: r2(sy(st.med)), r: 5.2 }, g);
      rec.whisker = wh; rec.box = box; rec.median = med;
      animated.push({ node: wh, kind: 'fade', delay: si * 90 + 420 },
        { node: box, kind: 'fade', delay: si * 90 + 420 },
        { node: med, kind: 'pop', delay: si * 90 + 500 });
      return;
    }
    const screen = s.data.map(d => [sx(d[0]), sy(d[1])]);
    /* katman sırası: bant → alan → çizgi → noktalar (estetik yasası) */
    if (s.band && s.band.length) {
      const band = el('path', { class: 'uncertainty-band', d: bandScreen(s.band, 1, s.curve) }, g);
      rec.band = band;
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
        const area = el('path', {
          class: 'series-area', fill: `url(#${gid})`,
          d: areaD(screen, s.curve),
        }, g);
        rec.area = area;
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

  /* direct label çakışma çözümü: aynı uçta biten seriler alt alta açılır */
  {
    const labs = seriesNodes.filter(r => r.label).map(r => r.label);
    for (let i = 1; i < labs.length; i++) for (let k = 0; k < i; k++) {
      const a = labs[k], b = labs[i];
      const dx = Math.abs(+a.getAttribute('x') - +b.getAttribute('x'));
      const dy = +b.getAttribute('y') - +a.getAttribute('y');
      if (dx < 150 && Math.abs(dy) < 26)
        b.setAttribute('y', r2(+a.getAttribute('y') + (dy >= 0 ? 26 : -26)));
    }
  }

  /* açıklamalar */
  for (const a of spec.annotations || []) {
    const gx = sx(a.x), gy = sy(a.y);
    const tx = gx + (a.dx ?? 18), ty = gy + (a.dy ?? -18);
    const line = el('line', { class: 'annotation-arrow', x1: tx, y1: ty + 4, x2: gx + 3, y2: gy - 3 }, svg);
    const txt = el('text', { class: 'annotation', x: tx, y: ty }, svg);
    txt.textContent = a.text;
    annoEls.push({ line, text: txt, a });
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

  /* ══════════════ KOREOGRAFİ KATMANI ══════════════ */

  /* --- ortak yardımcılar --- */
  const placeYTick = t => {
    const y = r2(sy(t.val));
    t.line.setAttribute('y1', y); t.line.setAttribute('y2', y);
    t.text.setAttribute('y', r2(sy(t.val) + 7));
  };
  const placeXTick = t => {
    const x = r2(sx(t.val));
    t.line.setAttribute('x1', x); t.line.setAttribute('x2', x);
    t.text.setAttribute('x', x);
  };
  const placeGrid = o => {
    const y = r2(sy(o.val));
    o.node.setAttribute('y1', y); o.node.setAttribute('y2', y);
  };
  const placeRef = re => {
    const y = r2(sy(re.r.y));
    re.line.setAttribute('y1', y); re.line.setAttribute('y2', y);
    re.text.setAttribute('y', r2(sy(re.r.y) + 6));
  };
  const placeAnno = ae => {
    const gx = sx(ae.a.x), gy = sy(ae.a.y);
    const tx = gx + (ae.a.dx ?? 18), ty = gy + (ae.a.dy ?? -18);
    ae.line.setAttribute('x1', r2(tx)); ae.line.setAttribute('y1', r2(ty + 4));
    ae.line.setAttribute('x2', r2(gx + 3)); ae.line.setAttribute('y2', r2(gy - 3));
    ae.text.setAttribute('x', r2(tx)); ae.text.setAttribute('y', r2(ty));
  };
  const positionBarValue = (rec, t, i, v) => {
    const bx = +rec.bars[i].dataset.bx;
    t.setAttribute('x', r2(bx + (rec.barW - 4) / 2));
    t.setAttribute('y', r2(v >= 0 ? sy(v) - 10 : sy(v) + 26));
  };
  /* bar değer etiketleri (enter/koreografi ile gelir; sonrasında kalıcıdır) */
  function ensureBarValues() {
    if (type !== 'bar') return;
    seriesNodes.forEach((rec, si) => {
      const s = series[si];
      if (!rec.bars.length || rec.valueLabels) return;
      rec.valueLabels = s.data.map((d, i) => {
        const t = el('text', { class: 'bar-value' }, rec.g);
        positionBarValue(rec, t, i, d[1]);
        t.textContent = fmt(d[1]);
        return t;
      });
    });
  }
  /* seri geometrisini verilen veriyle (mevcut dom altında) yeniden diz */
  function layoutSeries(si, dataArr, bandArr) {
    const rec = seriesNodes[si], s = series[si];
    if (!rec || vstats) return;
    const screen = dataArr.map(d => [sx(d[0]), sy(d[1])]);
    if (rec.line) {
      rec.line.style.strokeDasharray = ''; rec.line.style.strokeDashoffset = '';
      rec.line.setAttribute('d', pathFor(screen, s.curve));
    }
    if (rec.area) rec.area.setAttribute('d', areaD(screen, s.curve));
    if (rec.band && bandArr) rec.band.setAttribute('d', bandScreen(bandArr, 1, s.curve));
    rec.markers.forEach((m, i) => {
      if (i < screen.length) {
        m.setAttribute('cx', r2(screen[i][0])); m.setAttribute('cy', r2(screen[i][1]));
      }
    });
    rec.bars.forEach((bar, i) => {
      const d = dataArr[i];
      if (!d) return;
      const bx = sx(d[0]) - (rec.groups * rec.barW) / 2 + rec.si * rec.barW;
      bar.setAttribute('d', barPath(bx, sy(Math.max(0, d[1])), rec.barW - 4, Math.abs(sy(d[1]) - sy(0)), 3.5));
      bar.dataset.bx = bx; bar.dataset.h = Math.abs(sy(d[1]) - sy(0));
    });
    rec.valueLabels?.forEach((t, i) => {
      const d = dataArr[i];
      if (!d) { t.style.opacity = '0'; return; }
      positionBarValue(rec, t, i, d[1]);
      t.textContent = fmt(d[1]);
    });
    if (rec.label && dataArr.length) {
      const last = dataArr[dataArr.length - 1];
      rec.label.setAttribute('x', r2(sx(last[0]) + 12));
      rec.label.setAttribute('y', r2(sy(last[1]) + 6));
    }
  }
  /* süpürme clip'i düğümün KENDİ yatay kapsamından başlar — kesikli bir
     projeksiyon 50'de başlıyorsa süpürme 50'de başlar, plot solunda değil */
  const ensureClip = (rec, key, node) => {
    const bb = node.getBBox();
    const x0 = bb.width ? bb.x - 8 : M.left - 10;
    const span = (bb.width || plotW) + 16;
    if (rec[key]) {          /* replay: kapsamı güncel geometriye tazele */
      rec[key].rect.setAttribute('x', r2(x0));
      rec[key].rect.setAttribute('width', 0);
      rec[key].span = span;
      return rec[key];
    }
    const id = `sciClip${++gradientCounter}`;
    const cp = el('clipPath', { id }, defs);
    const rect = el('rect', { x: r2(x0), y: 0, width: 0, height: H }, cp);
    node.setAttribute('clip-path', `url(#${id})`);
    rec[key] = { rect, span };
    return rec[key];
  };
  /* işaretçilerin çizgi yolu üzerindeki yay-uzunluk kesirleri (x monoton) */
  const markerFractions = rec => {
    const path = rec.line, len = path.getTotalLength();
    return rec.markers.map(m => {
      const target = +m.getAttribute('cx');
      let lo = 0, hi = len;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        path.getPointAtLength(mid).x < target ? lo = mid : hi = mid;
      }
      return len ? ((lo + hi) / 2) / len : 0;
    });
  };

  /* --- iddia notu (callout): tek seferde bir tane; kayarak girer --- */
  let calloutEl = null;
  function hideCallout(immediate) {
    const c = calloutEl;
    if (!c) return;
    calloutEl = null;
    if (immediate || exportMode() || reducedMotion()) { c.remove(); return; }
    const a = c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease', fill: 'forwards' });
    a.onfinish = () => c.remove();
    setTimeout(() => c.remove(), 260);
  }
  function showCallout(text, ax, ay) {
    hideCallout(true);
    const gC = el('g', { class: 'chart-callout' }, svg);
    gC.style.pointerEvents = 'none';
    const pad = 12;
    const t = el('text', { x: pad, y: 0 }, gC);
    String(text).split('\n').forEach((ln, i) => {
      el('tspan', { x: pad, dy: i ? 26 : 0 }, t).textContent = ln;
    });
    const bb = t.getBBox();
    const w = bb.width + pad * 2, h = bb.height + 18;
    const rect = el('rect', { x: 0, y: r2(bb.y - 9), width: r2(w), height: r2(h), rx: 9 });
    gC.insertBefore(rect, t);
    let x = ax != null ? ax - w / 2 : W - M.right - w - 6;
    let y = ay != null ? ay : M.top + 26;
    x = Math.max(M.left + 6, Math.min(x, W - w - 8));
    y = Math.max(M.top + 20, Math.min(y, M.top + plotH - 12));
    gC.setAttribute('transform', `translate(${r2(x)},${r2(y)})`);
    calloutEl = gC;
    if (!(exportMode() || reducedMotion())) {
      gC.animate(
        [{ opacity: 0, transform: `translate(${r2(x + 16)}px, ${r2(y)}px)` },
         { opacity: 1, transform: `translate(${r2(x)}px, ${r2(y)}px)` }],
        { duration: 300, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
    return gC;
  }

  /* --- vurgu durumunu sıfırla --- */
  function clearEmphasis() {
    for (const rec of seriesNodes) {
      rec.g.style.opacity = '';
      for (const b of rec.bars) b.style.opacity = '';
      for (const m of rec.markers) m.style.opacity = '';
      rec.valueLabels?.forEach(t => { t.style.opacity = ''; });
    }
  }

  /* ---- vurgula: TEK nabız + diğerlerinin kısılması + iddia notu ----
     bar grafik: hedef = indeks | {seri, indeks}; diğer TÜM barlar .3'e iner,
     hedef bir kez nabız atar (kalıcı parlama yok), not kayarak girer.
     çizgi/saçılım: hedef = seri indeksi; diğer seriler kısılır.
     vurgula(null) durumu temizler. reduced/export: durum anında, nabızsız. */
  function vurgula(target, opts = {}) {
    if (target === null || target === undefined) { clearEmphasis(); hideCallout(); return; }
    const instantNow = exportMode() || reducedMotion();
    const trans = instantNow ? 'none' : 'opacity 260ms cubic-bezier(.4,0,.2,1)';
    if (type === 'bar') {
      const { seri = 0, indeks } = typeof target === 'object' ? target : { seri: 0, indeks: target };
      const rec = seriesNodes[seri];
      if (!rec || !rec.bars[indeks]) return;
      seriesNodes.forEach((r, rsi) => {
        r.bars.forEach((b, bi) => {
          const on = rsi === seri && bi === indeks;
          b.style.transition = trans; b.style.opacity = on ? '1' : '.3';
          const vl = r.valueLabels?.[bi];
          if (vl) { vl.style.transition = trans; vl.style.opacity = on ? '1' : '.3'; }
        });
      });
      const bar = rec.bars[indeks];
      if (!instantNow) {
        bar.style.transformOrigin = `0px ${sy(0)}px`;
        bar.animate(
          [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.06)' }, { transform: 'scaleY(1)' }],
          { duration: 440, easing: 'cubic-bezier(.34,1.2,.5,1)' });
      }
      if (opts.not) {
        let ax = +bar.dataset.bx + (rec.barW - 4) / 2;
        const v = series[seri].data[indeks]?.[1] ?? 0;
        let ay = sy(Math.max(0, v)) - 56;
        if (ay < M.top + 60) {   /* uzun sütun: not yana açılır, değeri örtmez */
          ay = M.top + 44;
          ax += rec.barW + 140;
        }
        showCallout(opts.not, ax, ay);
      } else hideCallout();
    } else {
      const seri = typeof target === 'object' ? (target.seri ?? 0) : target;
      if (!seriesNodes[seri]) return;
      seriesNodes.forEach((r, rsi) => {
        r.g.style.transition = trans;
        r.g.style.opacity = rsi === seri ? '1' : '.3';
      });
      if (opts.not) showCallout(opts.not); else hideCallout();
    }
  }

  /* ---- kumeVurgula: saçılımda seçili küme öne, gerisi kısılır ----
     maske: bool[] | (d,i)=>bool; null temizler. Seçilenler tek seferlik
     küçük bir nabız atar (kalıcı ölçek/parlaklık YOK — dürüstlük). */
  function kumeVurgula(maske, opts = {}) {
    if (maske === null || maske === undefined) { clearEmphasis(); hideCallout(); return; }
    const seri = opts.seri ?? 0;
    const rec = seriesNodes[seri], s = series[seri];
    if (!rec || !rec.markers.length) return;
    const test = typeof maske === 'function' ? i => !!maske(s.data[i], i) : i => !!maske[i];
    const instantNow = exportMode() || reducedMotion();
    const trans = instantNow ? 'none' : 'opacity 260ms cubic-bezier(.4,0,.2,1)';
    rec.markers.forEach((m, i) => {
      const on = test(i);
      m.style.transition = trans;
      m.style.opacity = on ? '1' : '.22';
      if (on && !instantNow) {
        m.style.transformOrigin = `${m.getAttribute('cx')}px ${m.getAttribute('cy')}px`;
        m.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
          { duration: 420, delay: (i % 12) * 18, easing: 'cubic-bezier(.34,1.3,.5,1)' });
      }
    });
    seriesNodes.forEach((r, rsi) => {
      if (rsi === seri) { r.g.style.opacity = ''; return; }
      r.g.style.transition = trans;
      r.g.style.opacity = '.3';
    });
    if (opts.not) showCallout(opts.not); else hideCallout();
  }

  /* ---- enter: sahne girişi koreografisi ---- */
  let currentEnter = null;
  function enterFinal() {
    revealed = true;
    observer?.disconnect();
    finish();
    for (const n of [axisParts.yLine, axisParts.xLine]) {
      n.style.opacity = ''; n.style.strokeDasharray = ''; n.style.strokeDashoffset = '';
    }
    for (const t of [...axisParts.yTicks, ...axisParts.xTicks, ...axisParts.catLabels]) {
      t.g.style.opacity = ''; t.g.style.transform = '';
    }
    for (const o of axisParts.gridLines) o.node.style.opacity = '';
    for (const n of headerNodes) { n.style.opacity = ''; n.style.transform = ''; }
    for (const re of refEls) { re.line.style.opacity = ''; re.text.style.opacity = ''; re.text.style.transform = ''; }
    ensureBarValues();
    seriesNodes.forEach((rec, si) => {
      rec.valueLabels?.forEach((t, i) => {
        const d = series[si].data[i];
        if (d) { t.style.opacity = ''; t.textContent = fmt(d[1]); }
      });
      if (rec.areaClip) rec.areaClip.rect.setAttribute('width', r2(rec.areaClip.span));
      if (rec.lineClip) rec.lineClip.rect.setAttribute('width', r2(rec.lineClip.span));
      if (rec.band && series[si].band) rec.band.setAttribute('d', bandScreen(series[si].band, 1, series[si].curve));
    });
  }
  function enter(opts = {}) {
    observer?.disconnect(); revealed = true;
    currentEnter?.iptal?.();
    const S = opts.sure ?? 1, G = opts.stagger ?? 1;
    const d = ms => ms * S, g = ms => ms * G;
    /* eski reveal geçiş kalıntılarını sök — zaman çizgisi stilleri doğrudan sürer */
    for (const a of animated) a.node.style.transition = 'none';
    if (exportMode() || reducedMotion()) {
      enterFinal();
      const h = { bitti: Promise.resolve(), seek01() {}, finish: enterFinal, iptal() {}, toplam: 0 };
      currentEnter = h;
      return h;
    }
    const tl = makeTL();
    const temp = [];    /* komet vb. geçici düğümler — bitince/iptalde kalkar */

    /* 0) başlıklar */
    headerNodes.forEach((n, i) => tl.add(d(i * 70), d(360), EASE.out, p => {
      n.style.opacity = String(p);
      n.style.transform = `translateY(${r2((1 - p) * 8)}px)`;
    }));
    /* 1) eksen süpürmesi (dashoffset ile uçtan çizim) */
    const sweep = (node, t0, dur) => {
      const x1 = +node.getAttribute('x1'), x2 = +node.getAttribute('x2');
      const y1 = +node.getAttribute('y1'), y2 = +node.getAttribute('y2');
      const len = Math.hypot(x2 - x1, y2 - y1);
      tl.add(t0, dur, EASE.inOut, p => {
        node.style.strokeDasharray = `${len}`;
        node.style.strokeDashoffset = `${r2(len * (1 - p))}`;
        node.style.opacity = p > 0 ? '1' : '0';
      });
    };
    sweep(axisParts.yLine, d(40), d(420));
    sweep(axisParts.xLine, d(160), d(460));
    /* 2) grid: alttan üste sırayla soluklaşarak */
    const gl = [...axisParts.gridLines].sort((a, b) => a.val - b.val);
    gl.forEach((o, i) => tl.add(d(180) + g(i * 38), d(320), EASE.out, p => {
      o.node.style.opacity = String(p);
    }));
    /* 3) tik'ler: y soldan kayar, x yukarıdan kademeli düşer */
    const yT = [...axisParts.yTicks].sort((a, b) => a.val - b.val);
    yT.forEach((t, i) => tl.add(d(240) + g(i * 46), d(300), EASE.out, p => {
      t.g.style.opacity = String(p);
      t.g.style.transform = `translateX(${r2(-10 * (1 - p))}px)`;
    }));
    const xT = [...axisParts.xTicks, ...axisParts.catLabels];
    xT.forEach((t, i) => tl.add(d(280) + g(i * 46), d(300), EASE.out, p => {
      t.g.style.opacity = String(p);
      t.g.style.transform = `translateY(${r2(-10 * (1 - p))}px)`;
    }));
    const tickCount = Math.max(yT.length, xT.length, gl.length);
    const dataStart = Math.max(d(280) + g((tickCount - 1) * 46) + d(340), d(680));
    let dataEnd = dataStart;

    /* 4) veri katmanı — tip'e göre */
    if (vstats) {
      /* keman: kontur omurgadan dışa; işaretler snap + tek mikro-sarsım */
      seriesNodes.forEach((rec, si) => {
        const t0 = dataStart + si * g(130);
        rec.shape.style.transformOrigin = `${rec.cx}px 0px`;
        tl.add(t0, d(700), EASE.out, p => {
          rec.shape.style.transform = `scaleX(${r2(p)})`;
          rec.shape.style.opacity = p > 0 ? '1' : '0';
        });
        const st = rec.stats;
        rec.whisker.style.transformOrigin = `${rec.cx}px ${r2((sy(st.p05) + sy(st.p95)) / 2)}px`;
        tl.add(t0 + d(500), d(260), EASE.out, p => {
          rec.whisker.style.transform = `scaleY(${r2(p)})`;
          rec.whisker.style.opacity = p > 0 ? '1' : '0';
        });
        rec.box.style.transformOrigin = `${rec.cx}px ${r2((sy(st.q1) + sy(st.q3)) / 2)}px`;
        tl.add(t0 + d(590), d(280), backOut(1.9), p => {
          rec.box.style.transform = `scale(${r2(Math.max(p, 0))})`;
          rec.box.style.opacity = p > 0 ? '1' : '0';
        });
        /* medyan: yukarıdan düşer, aşımla OTURUR (snap + mikro-sarsım) */
        tl.add(t0 + d(680), d(340), backOut(2.4), p => {
          rec.median.style.transform = `translateY(${r2(-14 * (1 - p))}px)`;
          rec.median.style.opacity = String(Math.min(1, Math.max(0, p * 3)));
        });
        dataEnd = Math.max(dataEnd, t0 + d(1050));
      });
    } else if (type === 'bar') {
      /* sütun: yaylı kalkış hafif aşımla; değer etiketleri sayarak gelir */
      ensureBarValues();
      const flat = [];
      seriesNodes.forEach((rec, si) => rec.bars.forEach((bar, i) =>
        flat.push({ rec, si, bar, i, v: series[si].data[i][1] })));
      flat.sort((a, b) => a.i - b.i || a.si - b.si);
      flat.forEach((f, k) => {
        const t0 = dataStart + k * g(70);
        f.bar.style.transformOrigin = `0px ${sy(0)}px`;
        tl.add(t0, d(620), backOut(1.5), p => {
          f.bar.style.transform = `scaleY(${r2(Math.max(p, 0))})`;
          f.bar.style.opacity = p > 0 ? '1' : '0';
        });
        const lbl = f.rec.valueLabels?.[f.i];
        if (lbl && opts.degerler !== false) tl.add(t0 + d(360), d(460), EASE.out, p => {
          lbl.style.opacity = p > 0 ? '1' : '0';
          lbl.textContent = fmt(f.v * p);       /* p=1 → tam değer, sapma yok */
        });
        else if (lbl) lbl.style.opacity = '0';
        dataEnd = Math.max(dataEnd, t0 + d(880));
      });
      /* direct label'lar */
      seriesNodes.forEach(rec => {
        if (rec.label) tl.add(dataEnd - d(200), d(280), EASE.out, p => {
          rec.label.style.opacity = String(p);
        });
      });
    } else if (type === 'scatter') {
      /* saçılım: damla yağmuru → fit çizgisi uçtan → bant tek nefeste */
      let rainEnd = dataStart;
      seriesNodes.forEach((rec, si) => {
        if (!rec.markers.length) return;
        const n = rec.markers.length;
        const step = Math.min(g(26), d(1300) / n);
        rec.markers.forEach((m, i) => {
          const t0 = dataStart + si * g(140) + i * step;
          tl.add(t0, d(480), backOut(1.1), p => {
            m.style.opacity = String(Math.min(1, Math.max(0, p * 4)));
            m.style.transform = `translateY(${r2(-30 * (1 - p))}px)`;
          });
          rainEnd = Math.max(rainEnd, t0 + d(480));
        });
      });
      let tLine = rainEnd + d(100);
      seriesNodes.forEach((rec, si) => {
        if (!rec.line) return;
        const clip = ensureClip(rec, 'lineClip', rec.line);
        const t0 = tLine;
        tl.add(t0, d(620), EASE.inOut, p => {
          rec.line.style.opacity = p > 0 ? '1' : '0';
          clip.rect.setAttribute('width', r2(clip.span * p));
        });
        tLine += g(160);
        dataEnd = Math.max(dataEnd, t0 + d(620));
      });
      seriesNodes.forEach((rec, si) => {
        const s = series[si];
        if (!rec.band || !s.band) return;
        const t0 = dataEnd + d(60);
        tl.add(t0, d(640), null, p => {
          const q = backOut(0.9)(p);   /* tek nefes: ~%5 şişip oturur */
          rec.band.setAttribute('d', bandScreen(s.band, q, s.curve));
          rec.band.style.opacity = String(Math.min(1, Math.max(0, p * 4)));
        });
        dataEnd = Math.max(dataEnd, t0 + d(640));
      });
      seriesNodes.forEach(rec => {
        if (rec.label) tl.add(dataEnd - d(160), d(280), EASE.out, p => {
          rec.label.style.opacity = String(p);
          rec.label.style.transform = `translateX(${r2((1 - p) * 8)}px)`;
        });
      });
    } else {
      /* çizgi: yol boyunca çizim + komet başı + akan değer okuması.
         Epistemik sıra: stilli seriler (fit/projeksiyon/simülasyon) gözlem
         çizgileri OTURDUKTAN sonra girer — tahmin, veriden önce konuşmaz. */
      let solidDrawEnd = dataStart;
      const addLineSeries = (rec, s, st0) => {
        let sEnd = st0;
        if (rec.line && !s.style) {
          const len = rec.line.getTotalLength();
          const drawDur = d(1050);
          const head = el('circle', { class: 'comet-head', r: 5.5 }, rec.g);
          const ro = el('g', { class: 'comet-readout' }, rec.g);
          const roText = el('text', { x: 0, y: 0 }, ro);
          temp.push(head, ro);
          const fracs = rec.markers.length ? markerFractions(rec) : [];
          tl.add(st0, drawDur, EASE.inOut, p => {
            rec.line.style.strokeDasharray = `${len}`;
            rec.line.style.strokeDashoffset = `${r2(len * (1 - p))}`;
            rec.line.style.opacity = p > 0 ? '1' : '0';
            const pt = rec.line.getPointAtLength(len * p);
            head.setAttribute('cx', r2(pt.x)); head.setAttribute('cy', r2(pt.y));
            head.style.opacity = p > 0 ? '1' : '0';
            /* okuma = ÇİZİLEN eğrinin o x'teki değeri (yanlış değer imâsı yok) */
            roText.textContent = fmt(invY(pt.y)) + (spec.y?.unit ? ` ${spec.y.unit}` : '');
            const flip = pt.x > W - M.right - 130;
            ro.setAttribute('transform', `translate(${r2(pt.x + (flip ? -16 : 16))},${r2(pt.y - 16)})`);
            roText.setAttribute('text-anchor', flip ? 'end' : 'start');
            ro.style.opacity = p > 0 ? '1' : '0';
          });
          /* işaretçiler: komet üzerlerinden geçerken pop'lar */
          rec.markers.forEach((m, j) => {
            m.style.transformOrigin = `${m.getAttribute('cx')}px ${m.getAttribute('cy')}px`;
            const tj = st0 + drawDur * invEase(EASE.inOut, fracs[j]);
            tl.add(tj, d(300), backOut(1.7), p => {
              m.style.transform = `scale(${r2(Math.max(p, 0))})`;
              m.style.opacity = p > 0 ? '1' : '0';
            });
          });
          /* komet sönümü */
          tl.add(st0 + drawDur, d(240), EASE.out, p => {
            head.style.opacity = String(1 - p);
            ro.style.opacity = String(1 - p);
            head.setAttribute('r', r2(5.5 * (1 - p * .9)));
          });
          /* alan dolgusu: çizgi oturunca TEK süpürüşle */
          if (rec.area) {
            const clip = ensureClip(rec, 'areaClip', rec.area);
            tl.add(st0 + drawDur + d(40), d(520), EASE.inOut, p => {
              rec.area.style.opacity = p > 0 ? '1' : '0';
              clip.rect.setAttribute('width', r2(clip.span * p));
            });
          }
          sEnd = st0 + drawDur + d(600);
        } else if (rec.line) {
          /* kesikli (epistemik) çizgi: clip süpürmesi — dash deseni bozulmaz */
          const clip = ensureClip(rec, 'lineClip', rec.line);
          tl.add(st0, d(650), EASE.inOut, p => {
            rec.line.style.opacity = p > 0 ? '1' : '0';
            clip.rect.setAttribute('width', r2(clip.span * p));
          });
          sEnd = st0 + d(650);
        }
        /* bant: çizgiden dışa TEK nefeste şişer */
        if (rec.band && s.band) {
          const bt0 = st0 + (s.style ? d(650) : d(1150));
          tl.add(bt0, d(640), null, p => {
            const q = backOut(0.9)(p);
            rec.band.setAttribute('d', bandScreen(s.band, q, s.curve));
            rec.band.style.opacity = String(Math.min(1, Math.max(0, p * 4)));
          });
          sEnd = Math.max(sEnd, bt0 + d(640));
        }
        if (rec.label) tl.add(st0 + (s.style ? d(560) : d(1080)), d(300), EASE.out, p => {
          rec.label.style.opacity = String(p);
          rec.label.style.transform = `translateX(${r2((1 - p) * 8)}px)`;
        });
        dataEnd = Math.max(dataEnd, sEnd);
      };
      let kSolid = 0;
      seriesNodes.forEach((rec, si) => {
        const s = series[si];
        if (s.style) return;
        const st0 = dataStart + (kSolid++) * g(260);
        addLineSeries(rec, s, st0);
        if (rec.line) solidDrawEnd = Math.max(solidDrawEnd, st0 + d(1050));
      });
      let kStyled = 0;
      seriesNodes.forEach((rec, si) => {
        const s = series[si];
        if (!s.style) return;
        addLineSeries(rec, s, solidDrawEnd + d(140) + (kStyled++) * g(160));
      });
    }

    /* 5) referans çizgileri + açıklamalar en sonda */
    refEls.forEach((re, i) => tl.add(dataEnd + d(80) + g(i * 80), d(340), EASE.out, p => {
      re.line.style.opacity = String(p);
      re.text.style.opacity = String(p);
      re.text.style.transform = `translateX(${r2((1 - p) * 10)}px)`;
    }));
    annoEls.forEach((ae, i) => {
      const t0 = dataEnd + d(160) + g(i * 90);
      const alen = Math.hypot(
        +ae.line.getAttribute('x2') - +ae.line.getAttribute('x1'),
        +ae.line.getAttribute('y2') - +ae.line.getAttribute('y1'));
      tl.add(t0, d(300), EASE.inOut, p => {
        ae.line.style.strokeDasharray = `${r2(alen)}`;
        ae.line.style.strokeDashoffset = `${r2(alen * (1 - p))}`;
        ae.line.style.opacity = p > 0 ? '1' : '0';
      });
      tl.add(t0 + d(140), d(280), EASE.out, p => { ae.text.style.opacity = String(p); });
    });

    const cleanup = () => { for (const n of temp) n.remove(); };
    const handle = {
      toplam: tl.total(),
      seek01: t => tl.seekMs(Math.max(0, Math.min(1, t)) * tl.total()),
      finish: () => { tl.stop(); tl.seekMs(tl.total()); cleanup(); },
      iptal: () => { tl.stop(); cleanup(); },
      bitti: Promise.resolve(),
    };
    if (opts.oynat !== false) {
      handle.bitti = tl.play().then(cleanup);
    } else tl.seekMs(0);
    currentEnter = handle;
    return handle;
  }

  /* ---- setData: FLIP geçişi + delta çipleri + eksen odometresi ----
     Domain spec.x/y min-max ile pin'li değilse eksen YENİDEN ÖLÇEKLENİR:
     tik'ler kayarak yeniden numaralanır, grid/seriler/refLine birlikte akar.
     Ara kareler eski↔yeni arasında interpolasyondur ve veri anlamı taşımaz
     (manifest'te belirtilir); uçlar iki eksiksiz gerçek durumdur. */
  let activeSet = null;
  function setData(patch, opts = {}) {
    if (vstats) return Promise.resolve();            /* keman desteklenmez */
    activeSet?.finish?.();                            /* üst üste binme yok */
    currentEnter?.finish?.();
    const sure = opts.sure ?? 800;
    const instantNow = exportMode() || reducedMotion();
    const jobs = [];
    (patch || []).forEach((p, si) => {
      const rec = seriesNodes[si], s = series[si];
      if (!p || !rec || !s) return;
      const nw = (Array.isArray(p) ? p : p.data)?.map(dd => [...dd]);
      if (!nw) return;
      jobs.push({
        si, rec, s,
        old: s.data.map(dd => [...dd]), nw,
        oldBand: s.band ? s.band.map(b => [...b]) : null,
        nwBand: (!Array.isArray(p) && p.band) ? p.band.map(b => [...b]) : (s.band ? s.band.map(b => [...b]) : null),
      });
    });
    if (!jobs.length) return Promise.resolve();

    const future = series.map((s, si) => {
      const j = jobs.find(jj => jj.si === si);
      return j ? { ...s, data: j.nw, band: j.nwBand } : s;
    });
    const oldDom = { ...dom };
    const newDom = domainFrom(future);
    const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const domChanged = ['xMin', 'xMax', 'yMin', 'yMax'].some(k => !near(oldDom[k], newDom[k]));

    /* delta çipleri: GERÇEK eski→yeni farkı, birimli */
    const deltas = [];
    for (const j of jobs) {
      if (type === 'bar' || (!j.rec.line && j.rec.markers.length)) {
        j.nw.forEach((dd, i) => {
          const o = j.old[i];
          if (o && Math.abs(dd[1] - o[1]) > 1e-9) deltas.push({ j, i, dv: dd[1] - o[1] });
        });
      } else {
        const o = j.old[j.old.length - 1], n = j.nw[j.nw.length - 1];
        if (o && n && Math.abs(n[1] - o[1]) > 1e-9) deltas.push({ j, i: j.nw.length - 1, dv: n[1] - o[1] });
      }
    }
    deltas.sort((a, b) => Math.abs(b.dv) - Math.abs(a.dv));
    deltas.length = Math.min(deltas.length, opts.deltaMax ?? 6);
    const wantDelta = opts.delta !== false && !instantNow && deltas.length > 0;

    /* eklenen/silinen öğe düğümleri şimdiden hazırlanır */
    for (const j of jobs) {
      const rec = j.rec;
      /* enter süpürme clip'leri tam açılır — yeni geometri kırpılmasın */
      for (const k of ['lineClip', 'areaClip']) {
        if (rec[k]) { rec[k].rect.setAttribute('x', 0); rec[k].rect.setAttribute('width', W); }
      }
      if (rec.markers.length || (!rec.line && !rec.bars.length)) {
        for (let i = rec.markers.length; i < j.nw.length; i++) {
          const m = el('circle', { class: 'series-marker pt', r: 4.6, cx: 0, cy: 0 }, rec.g);
          m.style.opacity = '0';
          rec.markers.push(m);
          (j.added ??= new Set()).add(i);
        }
        j.removedMarkers = rec.markers.slice(j.nw.length);
      }
      if (rec.bars.length) {
        for (let i = rec.bars.length; i < j.nw.length; i++) {
          const bar = el('path', { class: 'series-bar', d: '' }, rec.g);
          bar.style.opacity = '0';
          rec.bars.push(bar);
          (j.addedBars ??= new Set()).add(i);
          if (rec.valueLabels) {
            const t = el('text', { class: 'bar-value' }, rec.g);
            t.style.opacity = '0';
            rec.valueLabels.push(t);
          }
        }
        j.removedBars = rec.bars.slice(j.nw.length);
      }
    }

    /* yeni tik/grid seti (yalnız domain değiştiyse) — gizli doğar */
    let axisSwap = null;
    if (domChanged) {
      const save = { ...dom };
      Object.assign(dom, newDom);      /* yeni tikler nihai domain'de doğar */
      const nyv = niceTicks(newDom.yMin, newDom.yMax, spec.y?.ticks || 5);
      const nxv = niceTicks(newDom.xMin, newDom.xMax, spec.x?.ticks || 6);
      axisSwap = {
        newY: nyv.map(v => makeYTick(v, true)),
        newX: nxv.map(v => makeXTick(v, true)),
        newG: nyv.map(v => makeGridLine(v, true)),
      };
      Object.assign(dom, save);
    }

    const lerp = (a, b, p) => a + (b - a) * p;
    const renderFrame = p => {
      if (domChanged) {
        dom.xMin = lerp(oldDom.xMin, newDom.xMin, p);
        dom.xMax = lerp(oldDom.xMax, newDom.xMax, p);
        dom.yMin = lerp(oldDom.yMin, newDom.yMin, p);
        dom.yMax = lerp(oldDom.yMax, newDom.yMax, p);
        /* odometre: eski sayılar değerlerinde kayarak çıkar, yeniler kayarak yerleşir */
        for (const t of axisParts.yTicks) { placeYTick(t); t.g.style.opacity = String(Math.max(0, 1 - p / .45)); }
        for (const t of axisSwap.newY) { placeYTick(t); t.g.style.opacity = String(Math.max(0, Math.min(1, (p - .55) / .45))); }
        for (const t of axisParts.xTicks) { placeXTick(t); t.g.style.opacity = String(Math.max(0, 1 - p / .45)); }
        for (const t of axisSwap.newX) { placeXTick(t); t.g.style.opacity = String(Math.max(0, Math.min(1, (p - .55) / .45))); }
        for (const o of axisParts.gridLines) { placeGrid(o); o.node.style.opacity = String(Math.max(0, 1 - p / .45)); }
        for (const o of axisSwap.newG) { placeGrid(o); o.node.style.opacity = String(Math.max(0, Math.min(1, (p - .55) / .45))); }
        for (const re of refEls) placeRef(re);
        for (const ae of annoEls) placeAnno(ae);
      }
      for (const j of jobs) {
        const nK = Math.min(j.old.length, j.nw.length);
        const dataNow = j.nw.map((dd, i) =>
          i < nK && p < 1 ? [lerp(j.old[i][0], dd[0], p), lerp(j.old[i][1], dd[1], p)] : [...dd]);
        let bandNow = j.nwBand;
        if (j.oldBand && j.nwBand && j.oldBand.length === j.nwBand.length && p < 1) {
          bandNow = j.nwBand.map((b, i) => [
            lerp(j.oldBand[i][0], b[0], p), lerp(j.oldBand[i][1], b[1], p), lerp(j.oldBand[i][2], b[2], p)]);
        }
        /* layoutSeries s.data uzunluğuna göre değil verilen diziye göre çizer */
        const keepData = j.s.data; j.s.data = dataNow;   /* barW hesapları için */
        layoutSeries(j.si, dataNow, bandNow);
        j.s.data = keepData;
        j.added?.forEach(i => { j.rec.markers[i].style.opacity = String(Math.max(0, Math.min(1, (p - .6) / .4))); });
        j.removedMarkers?.forEach((m, k) => {
          const od = j.old[j.nw.length + k];
          if (od) { m.setAttribute('cx', r2(sx(od[0]))); m.setAttribute('cy', r2(sy(od[1]))); }
          m.style.opacity = String(Math.max(0, 1 - p / .4));
        });
        j.addedBars?.forEach(i => { j.rec.bars[i].style.opacity = String(Math.max(0, Math.min(1, (p - .6) / .4))); });
        j.removedBars?.forEach(bar => { bar.style.opacity = String(Math.max(0, 1 - p / .4)); });
      }
      /* dokunulmayan seriler de domain kayarken birlikte akar */
      if (domChanged) series.forEach((s, si) => {
        if (!jobs.some(j => j.si === si)) layoutSeries(si, s.data, s.band);
      });
    };

    /* delta çipleri: nihai konumda doğar, geçiş bitince yüzer ve söner */
    const chips = [];
    if (wantDelta) {
      const save = { ...dom };
      Object.assign(dom, newDom);
      for (const dc of deltas) {
        const dd = dc.j.nw[dc.i];
        let cxp, cyp;
        if (dc.j.rec.bars.length) {
          const groups = dc.j.rec.groups, barW = dc.j.rec.barW;
          cxp = sx(dd[0]) - (groups * barW) / 2 + dc.j.rec.si * barW + (barW - 4) / 2;
          cyp = sy(Math.max(0, dd[1])) - 40;
        } else { cxp = sx(dd[0]); cyp = sy(dd[1]) - 30; }
        const gC = el('g', { class: `delta-chip ${dc.dv >= 0 ? 'is-up' : 'is-down'}` }, svg);
        gC.style.pointerEvents = 'none';
        const t = el('text', { x: 0, y: 0, 'text-anchor': 'middle' }, gC);
        t.textContent = (dc.dv > 0 ? '+' : '−') + fmt(Math.abs(dc.dv)) + (spec.y?.unit ? ` ${spec.y.unit}` : '');
        const bb = t.getBBox();
        const w = bb.width + 18, hh = bb.height + 10;
        gC.insertBefore(el('rect', { x: r2(-w / 2), y: r2(bb.y - 5), width: r2(w), height: r2(hh), rx: r2(hh / 2) }), t);
        if (cyp < M.top + 22) {   /* tepeye sıkışırsa öğenin yanına kayar */
          cyp = M.top + 22;
          cxp += (dc.j.rec.bars.length ? dc.j.rec.barW : 24) + w / 2 + 6;
        }
        cxp = Math.max(M.left + w / 2 + 4, Math.min(cxp, W - M.right + 60));
        gC.dataset.x = cxp; gC.dataset.y = cyp;
        gC.style.opacity = '0';
        chips.push(gC);
      }
      Object.assign(dom, save);
    }

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      Object.assign(dom, newDom);
      for (const j of jobs) {
        j.s.data = j.nw;
        if (j.nwBand) j.s.band = j.nwBand;
        j.removedMarkers?.forEach(m => m.remove());
        j.rec.markers = j.rec.markers.slice(0, j.nw.length);
        j.removedBars?.forEach(b => b.remove());
        j.rec.bars = j.rec.bars.slice(0, j.nw.length);
        if (j.rec.valueLabels) {
          j.rec.valueLabels.slice(j.nw.length).forEach(t => t.remove());
          j.rec.valueLabels = j.rec.valueLabels.slice(0, j.nw.length);
        }
        j.added?.forEach(i => { const m = j.rec.markers[i]; if (m) m.style.opacity = ''; });
        j.addedBars?.forEach(i => { const b = j.rec.bars[i]; if (b) b.style.opacity = ''; });
      }
      if (axisSwap) {
        for (const t of axisParts.yTicks) t.g.remove();
        for (const t of axisParts.xTicks) t.g.remove();
        for (const o of axisParts.gridLines) o.node.remove();
        axisParts.yTicks = axisSwap.newY;
        axisParts.xTicks = axisSwap.newX;
        axisParts.gridLines = axisSwap.newG;
        for (const t of [...axisParts.yTicks, ...axisParts.xTicks]) t.g.style.opacity = '';
        for (const o of axisParts.gridLines) o.node.style.opacity = '';
      }
      series.forEach((s, si) => layoutSeries(si, s.data, s.band));
      for (const re of refEls) placeRef(re);
      for (const ae of annoEls) placeAnno(ae);
      for (const c of chips) c.remove();
      activeSet = null;
    };

    if (instantNow) { renderFrame(1); commit(); return opts.oynat === false ? { seek01() {}, finish() {}, bitti: Promise.resolve(), toplam: 0 } : Promise.resolve(); }

    const tl = makeTL();
    tl.add(0, sure, EASE.inOut, renderFrame);
    if (wantDelta) {
      tl.add(sure + 80, 1400, null, p => {
        const op = Math.min(Math.min(1, p / .18), Math.min(1, (1 - p) / .3));
        const rise = 16 * EASE.out(p);
        for (const c of chips) {
          c.style.opacity = String(Math.max(0, op));
          c.setAttribute('transform', `translate(${c.dataset.x},${r2(+c.dataset.y - rise)})`);
        }
      });
    }
    const handle = {
      toplam: tl.total(),
      seek01: t => tl.seekMs(Math.max(0, Math.min(1, t)) * tl.total()),
      finish: () => { tl.stop(); tl.seekMs(tl.total()); commit(); },
      iptal: () => { tl.stop(); commit(); },
      bitti: Promise.resolve(),
    };
    activeSet = handle;
    if (opts.oynat === false) { tl.seekMs(0); return handle; }
    handle.bitti = tl.play().then(commit);
    return handle.bitti;
  }

  /* ---- sahnele: anlatı modu — adım adım vurgu + not ----
     adım: { vurgula?, kumeVurgula?, seri?, setData?, sheen?, not? }
     Dönen API deste ok tuşlarına bağlanabilir; global keydown EKLENMEZ. */
  function sahnele(adimlar = []) {
    let mevcut = -1;
    const uygula = i => {
      const a = adimlar[i];
      if (!a) return;
      clearEmphasis();
      if (a.setData) {
        a._önce ??= series.map(s => s.data.map(dd => [...dd]));
        setData(a.setData, { sure: 650, ...(a.setDataOpts || {}) });
      }
      if (a.vurgula !== undefined && a.vurgula !== null) vurgula(a.vurgula, { not: a.not });
      else if (a.kumeVurgula) kumeVurgula(a.kumeVurgula, { seri: a.seri ?? 0, not: a.not });
      else if (a.not) showCallout(a.not);
      else hideCallout();
      if (a.sheen !== undefined) sheen(a.sheen);
    };
    const geriAl = i => {
      const a = adimlar[i];
      if (a?.setData && a._önce) setData(a._önce.map(dd => ({ data: dd.map(x => [...x]) })), { sure: 500, delta: false });
    };
    const git = i => {
      i = Math.max(-1, Math.min(adimlar.length - 1, i));
      if (i === mevcut) return mevcut;
      if (i > mevcut) for (let k = mevcut + 1; k <= i; k++) uygula(k);
      else {
        for (let k = mevcut; k > i; k--) geriAl(k);
        if (i >= 0) uygula(i);
        else { clearEmphasis(); hideCallout(); }
      }
      mevcut = i;
      return mevcut;
    };
    return {
      ileri: () => git(mevcut + 1),
      geri: () => git(mevcut - 1),
      git,
      sifirla: () => git(-1),
      uzunluk: adimlar.length,
      get adim() { return mevcut; },
    };
  }

  return {
    svg,
    reveal: play,
    finish,
    morphTo,
    sheen,
    enter,
    vurgula,
    kumeVurgula,
    setData,
    sahnele,
    dispose: () => { observer?.disconnect(); currentEnter?.iptal?.(); svg.remove(); },
  };
}
