/* Table motion helpers — pairs with table-motion.css.

   ---- mevcut (geriye uyumlu) ------------------------------------------
   observeTableReveal(root?)  [data-table-reveal] VE [data-table-enter]
                              tablolarını görünürlükte tetikler
   flashRow(tr)               one-shot attention flash on a row
   enableColumnEmphasis(tbl)  header hover → column emphasis
   countCells(scope?, opts?)  [data-count] hücreleri 0→değer sayar;
                              data-count="odometer" → rakam silindirleri
   cellBars(scope?)           [data-bar] hücrelerine metin altı veri çubuğu
   heatFill(scope?)           [data-heat] hücrelerine rampa arka planı
   columnCascade(table)       tek tabloyu sütun kaskadı moduna alır

   ---- yeni -------------------------------------------------------------
   initTableMotion(scope?)    TÜM data-öznitelikli yetenekleri tek çağrıyla
                              kurar (bar+heat+spark+duel+total+reveal+count)
   cellSparks(scope?, opts?)  [data-spark="3,5,4,8"] mini çizgi hücresi
   totalFlow(table, opts?)    [data-total-of] sütundan toplam hücresine
                              akış izi + odometre dolumu (tek seferlik)
   cellDuel(table, opts?)     table[data-duel="colA,colB"] sütun düellosu
   tabloSirala(table, col, o) FLIP yeniden sıralama (transform-only)
   tabloAdimlari(table, adım) satır spotlight anlatısı — denetleyici döner,
                              global keydown EKLEMEZ
   renderTableEnterAt(t, p)   yönetmenli girişin p∈[0,1] anındaki karesini
                              senkron çizer (headless QA / sabit-zaman)

   Tüm zaman çizgileri opts.progress ∈ [0,1] ile senkron tek kare çizebilir
   (gizli sekmede rAF donmasına karşı). prefers-reduced-motion ve
   html[data-export="true"] her yerde SON DURUMU basar.                  */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ?export=1 sorgusu html[data-export="true"] ile EŞ tutulur: öznitelik
   burada damgalanır ki CSS'teki export kuralları da devreye girsin */
if (new URLSearchParams(location.search).get('export') === '1')
  document.documentElement.dataset.export = 'true';
const exportMode = () => document.documentElement.dataset.export === 'true';

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = value => Math.min(1, Math.max(0, value || 0));

const NUM_RE = /-?\d[\d.]*(?:,\d+)?/;
const ODO_H = 1.16;                     /* em — CSS .sci-odo-d ile eş */

/* kapsamın kendisi + altındakiler (element scope'lar için) */
const qsa = (scope, sel) => {
  const list = [...(scope.querySelectorAll?.(sel) ?? [])];
  if (scope.matches?.(sel)) list.unshift(scope);
  return list;
};

/* Türkçe biçimli sayıyı çöz: "1.248" → 1248, "%96,4" → 96.4 */
const parseTr = text => {
  const m = String(text ?? '').trim().match(NUM_RE);
  return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : NaN;
};

/* ---- ortak zaman çizgisi --------------------------------------------
   frame(Tms) her karede mutlak milisaniye alır. opts.progress verilirse
   TEK kare senkron çizilir (headless sabit-zaman); export/reduced-motion
   son kareyi basar. Durdurucu fonksiyon döner. */
function runTimeline(duration, frame, done, opts = {}) {
  if (opts.progress != null) {
    frame(clamp01(opts.progress) * duration);
    if (opts.progress >= 1) done?.();
    return () => {};
  }
  if (exportMode() || reducedMotion()) { frame(duration); done?.(); return () => {}; }
  let raf;
  const start = performance.now();
  const tick = now => {
    const T = Math.min(duration, now - start);
    frame(T);
    if (T < duration) raf = requestAnimationFrame(tick); else done?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/* tek seferlik görünürlük tetikleyicisi (IO + 6 sn bekçi) */
function onceVisible(el, fn, delayMs = 0) {
  if (exportMode() || reducedMotion()) { fn(); return () => {}; }
  let fired = false;
  const go = () => { if (!fired) { fired = true; io.disconnect(); clearTimeout(watchdog); setTimeout(fn, delayMs); } };
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) go();
  }, { threshold: .3 });
  io.observe(el);
  const watchdog = setTimeout(go, 6000);
  return () => { io.disconnect(); clearTimeout(watchdog); };
}

/* girişli tabloda akış/düello için tahmini bekleme (giriş bitsin) */
const entranceDelay = table =>
  (table.hasAttribute('data-table-reveal') || table.hasAttribute('data-table-enter'))
    ? 700 + (table.tBodies[0]?.rows.length ?? 0) * 110
    : 250;

/* ---- reveal gözlemcisi ---------------------------------------------- */

export function observeTableReveal(root = document) {
  const tables = qsa(root, '[data-table-reveal],[data-table-enter]');
  const finishAll = () => tables.forEach(t => t.classList.add('is-revealed'));
  for (const table of tables) {
    indexRows(table);
    if (table.getAttribute('data-table-reveal') === 'columns') indexColumns(table);
    if (table.hasAttribute('data-table-enter')) prepEnter(table);
  }
  if (exportMode() || reducedMotion()) { finishAll(); return () => {}; }
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: .3 });
  tables.forEach(t => io.observe(t));
  /* gizli sekme güvencesi: IO hiç tetiklenmezse satırlar kaybolmasın */
  const watchdog = setTimeout(finishAll, 6000);
  return () => { io.disconnect(); clearTimeout(watchdog); };
}

export function flashRow(tr) {
  if (!tr || exportMode() || reducedMotion()) return;
  tr.classList.remove('is-flash');
  void tr.offsetWidth;             /* animasyonu yeniden tetikle */
  tr.classList.add('is-flash');
  tr.addEventListener('animationend', () => tr.classList.remove('is-flash'), { once: true });
}

export function enableColumnEmphasis(table) {
  if (!table) return () => {};
  table.setAttribute('data-col-emph', '');
  const headers = [...table.querySelectorAll('thead th')];
  const setCol = index => {
    table.classList.toggle('has-emph', index >= 0);
    table.querySelectorAll('tr').forEach(tr => {
      [...tr.children].forEach((cell, ci) =>
        cell.classList.toggle('is-emph-col', ci === index));
    });
  };
  const enter = event => setCol(headers.indexOf(event.currentTarget));
  const leave = () => setCol(-1);
  headers.forEach(h => {
    h.addEventListener('mouseenter', enter);
    h.addEventListener('mouseleave', leave);
  });
  return () => headers.forEach(h => {
    h.removeEventListener('mouseenter', enter);
    h.removeEventListener('mouseleave', leave);
  });
}

/* ---- indeksler ------------------------------------------------------- */

/* satır/sütun indekslerini CSS değişkeni olarak yaz (kaskad gecikmeleri) */
const indexRows = table => {
  const bodyRows = [...table.querySelectorAll('tbody tr')];
  bodyRows.forEach((tr, i) => tr.style.setProperty('--row-index', i));
  /* tfoot girişte gövdenin devamı gibi aksın */
  table.querySelectorAll('tfoot tr').forEach((tr, i) =>
    tr.style.setProperty('--row-index', bodyRows.length + i));
};
const indexColumns = table =>
  table.querySelectorAll('tr').forEach(tr =>
    [...tr.children].forEach((cell, ci) => cell.style.setProperty('--col-index', ci)));

/* data-table-enter hazırlığı: değeri normalleştir + tüm indeksleri yaz */
function prepEnter(table) {
  const mode = table.getAttribute('data-table-enter');
  if (!['cascade', 'wipe', 'rows'].includes(mode))
    table.setAttribute('data-table-enter', 'cascade');
  indexColumns(table);
}

/* Dolgu geçişini kur: tablo reveal/enter taşıyorsa .is-revealed'ı
   gözlemci ekler; taşımıyorsa burada ekleriz. Hareket kapalıysa /
   dışa aktarımda hemen son duruma geç. */
function armFill(table) {
  indexRows(table);
  if (exportMode() || reducedMotion()) { table.classList.add('is-revealed'); return; }
  if (table.hasAttribute('data-table-reveal') || table.hasAttribute('data-table-enter')) return;
  /* çift rAF: ilk kare scaleX(0)/saydam çizilsin ki geçiş oynasın */
  requestAnimationFrame(() =>
    requestAnimationFrame(() => table.classList.add('is-revealed')));
}

/* ---- sayaç işleri ---------------------------------------------------- */

/* Klasik metin sayacı: 0→değer, Türkçe biçim korunur */
function plainCountJob(cell, final, match) {
  const prefix = final.slice(0, match.index);
  const suffix = final.slice(match.index + match[0].length);
  const decimals = (match[0].split(',')[1] || '').length;
  const value = parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
  const format = v => prefix
    + v.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    + suffix;
  return {
    frame: lt => { cell.textContent = lt >= 1 ? final : format(value * easeOutCubic(clamp01(lt))); },
    done: () => { cell.textContent = final; }
  };
}

/* Odometre: her rakam bir silindir; değer v(t) sürekli akar, silindirler
   basamak değerine göre döner (ara kareler gerçek ara değerlerdir —
   rastgele takırdama yok). Ayraçlar/önek/sonek sabit durur. */
function odometerJob(cell, final, match) {
  const numStart = match.index;
  const numEnd = match.index + match[0].length;
  cell.textContent = '';
  const wrap = document.createElement('span');
  wrap.className = 'sci-odo';
  const reels = [];
  [...final].forEach((ch, idx) => {
    if (/\d/.test(ch) && idx >= numStart && idx < numEnd) {
      const digit = document.createElement('span');
      digit.className = 'sci-odo-d';
      const reel = document.createElement('span');
      reel.className = 'sci-odo-reel';
      for (let n = 0; n <= 10; n++) {             /* 0..9 + sarma için 0 */
        const s = document.createElement('span');
        s.textContent = String(n % 10);
        reel.appendChild(s);
      }
      digit.appendChild(reel);
      wrap.appendChild(digit);
      reels.push({ reel, ch, k: 0 });
    } else {
      const s = document.createElement('span');
      s.className = 'sci-odo-c';
      s.textContent = ch;
      wrap.appendChild(s);
    }
  });
  cell.appendChild(wrap);
  /* basamak değerleri sağdan sola: 10^k (ayraçlar atlanır) */
  for (let i = reels.length - 1, k = 0; i >= 0; i--, k++) reels[i].k = k;
  const N = parseInt(match[0].replace(/\D/g, ''), 10) || 0;
  return {
    frame: lt => {
      const S = N * easeOutCubic(clamp01(lt));
      for (const r of reels) {
        const pos = (S / 10 ** r.k) % 10;
        r.reel.style.transform = `translateY(${(-pos * ODO_H).toFixed(4)}em)`;
      }
    },
    done: () => {
      for (const r of reels)
        r.reel.style.transform = `translateY(${(-Number(r.ch) * ODO_H).toFixed(4)}em)`;
      /* bitişte kısa oturma vurgusu — tek mikro ölçek, sürekli değil */
      wrap.classList.add('is-settle');
      wrap.addEventListener('animationend', () => wrap.classList.remove('is-settle'), { once: true });
    }
  };
}

/* countCells — [data-count] hücrelerinde 0→değer sayacı.
   data-count="odometer" (veya opts.odometer) rakam silindirleriyle akar.
   Türkçe biçim desteklenir: binlik "." , ondalık "," ; sayı dışındaki
   önek/sonek ("%", "ms", "≈"...) aynen korunur. Tekrar çağrılabilir:
   orijinal metin data-count-final'da saklanır. data-total-of hücreleri
   atlanır (onları totalFlow doldurur). */
export function countCells(scope = document, opts = {}) {
  const duration = Number(opts.duration ?? 900);
  const stagger = Number(opts.stagger ?? 60);
  const jobs = [];
  for (const cell of qsa(scope, '[data-count]')) {
    if (cell.hasAttribute('data-total-of')) continue;      /* totalFlow'un işi */
    if (!('countFinal' in cell.dataset)) cell.dataset.countFinal = cell.textContent.trim();
    const final = cell.dataset.countFinal;
    const match = final.match(NUM_RE);
    if (!match) { cell.textContent = final; continue; }
    if (exportMode() || reducedMotion()) { cell.textContent = final; continue; }
    /* sütun konumu × 60 ms kademe */
    const column = [...cell.parentElement.children].indexOf(cell);
    const odo = opts.odometer || cell.dataset.count === 'odometer';
    jobs.push({
      offset: column * stagger,
      ...(odo ? odometerJob(cell, final, match) : plainCountJob(cell, final, match))
    });
  }
  if (!jobs.length) return () => {};
  const total = duration + Math.max(...jobs.map(j => j.offset));
  return runTimeline(total, T => {
    for (const j of jobs) j.frame((T - j.offset) / duration);
  }, () => jobs.forEach(j => j.done?.()), opts);
}

/* ---- hücre düzeyi dolgu efektleri ----------------------------------- */

/* düello sütunundaki data-bar hücresini normal çubuktan muaf tut */
function isDuelCell(cell) {
  const table = cell.closest('table');
  if (!table?.hasAttribute('data-duel')) return false;
  const pair = (table.getAttribute('data-duel') || '').split(',')
    .map(s => resolveColumn(table, s.trim()));
  return pair.includes(cell.cellIndex);
}

/* cellBars — [data-bar="0..1"] hücrelerine metnin ALTINDA yatay veri
   çubuğu. Duotone disiplin: %16 saydam gövde + tam renkte 2px uç kenarı.
   Renk: vurgu; data-bar-slot="2" → --color-data-2. Tekrar çağrılabilir. */
export function cellBars(scope = document) {
  const tables = new Set();
  for (const cell of qsa(scope, '[data-bar]')) {
    if (isDuelCell(cell)) continue;                 /* düello kendi çubuğunu kurar */
    cell.classList.add('sci-cell--bar');
    let bar = cell.querySelector(':scope > .sci-cell-bar');
    if (!bar) {
      bar = document.createElement('i');
      bar.className = 'sci-cell-bar';
      bar.setAttribute('aria-hidden', 'true');
      cell.appendChild(bar);
    }
    bar.style.setProperty('--bar', clamp01(parseFloat(cell.dataset.bar)));
    if (cell.dataset.barSlot)
      bar.style.setProperty('--bar-color',
        `var(--color-data-${cell.dataset.barSlot}, var(--color-accent))`);
    const table = cell.closest('table');
    if (table) tables.add(table);
  }
  tables.forEach(armFill);
}

/* heatFill — [data-heat="0..1"] hücrelerine rampa arka planı.
   5 duraklı --ramp-seq-1..5 rampasında en yakın çift seçilir, arası
   color-mix ile doldurulur. Rampa yoksa (genişletilmemiş palet) vurgu
   rengi × ısı×.3 saydamlığa düşülür. Isı > .55 → zemin koyulaşır,
   mürekkep okunur kalsın diye --color-canvas'a çevrilir. */
export function heatFill(scope = document) {
  const cells = qsa(scope, '[data-heat]');
  if (!cells.length) return;
  const rootStyle = getComputedStyle(document.documentElement);
  const hasRamp = [1, 2, 3, 4, 5]
    .every(i => rootStyle.getPropertyValue(`--ramp-seq-${i}`).trim());
  const tables = new Set();
  for (const cell of cells) {
    const heat = clamp01(parseFloat(cell.dataset.heat));
    cell.classList.add('sci-cell--heat');
    if (hasRamp) {
      const position = heat * 4;                       /* 0..4 → 5 durak */
      const lower = Math.min(3, Math.floor(position));
      const mix = Math.round((position - lower) * 100);
      cell.style.setProperty('--heat-bg',
        `color-mix(in srgb, var(--ramp-seq-${lower + 2}) ${mix}%, var(--ramp-seq-${lower + 1}))`);
      cell.classList.toggle('sci-cell--heat-deep', heat > .55);
    } else {
      cell.style.setProperty('--heat-bg',
        `color-mix(in srgb, var(--color-accent, #E8804A) ${Math.round(heat * 30)}%, transparent)`);
      cell.classList.remove('sci-cell--heat-deep');
    }
    const table = cell.closest('table');
    if (table) tables.add(table);
  }
  tables.forEach(armFill);
}

/* columnCascade — satır kaskadının sütun aynası: tabloyu "columns"
   moduna alır ve aynı gözlemci/bekçi düzeniyle izler. */
export function columnCascade(table) {
  if (!table) return () => {};
  table.setAttribute('data-table-reveal', 'columns');
  return observeTableReveal(table);
}

/* ---- mini-sparkline hücresi ----------------------------------------- */

const SPARK_W = 72, SPARK_H = 20, SPARK_PAD = 3;

/* cellSparks — [data-spark="3,5,4,8"] hücresine satır içi mini SVG çizgi.
   Çizgi kendini çizerek girer (dasharray/dashoffset, tablo reveal'ına
   bağlı), uçta minik nokta belirir. Satır yüksekliğini bozmaz. Renk:
   --color-data-2; data-spark-slot="1" → --color-data-1. Tekrarlanabilir. */
export function cellSparks(scope = document, opts = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const tables = new Set();
  for (const cell of qsa(scope, '[data-spark]')) {
    const values = cell.dataset.spark.split(',').map(Number).filter(Number.isFinite);
    if (values.length < 2) continue;
    cell.querySelector(':scope > .sci-spark')?.remove();
    const min = Math.min(...values), max = Math.max(...values);
    const span = (max - min) || 1;
    const points = values.map((v, i) => [
      SPARK_PAD + i * (SPARK_W - 2 * SPARK_PAD) / (values.length - 1),
      SPARK_H - SPARK_PAD - (v - min) / span * (SPARK_H - 2 * SPARK_PAD)
    ]);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sci-spark');
    svg.setAttribute('viewBox', `0 0 ${SPARK_W} ${SPARK_H}`);
    svg.setAttribute('width', SPARK_W);
    svg.setAttribute('height', SPARK_H);
    svg.setAttribute('aria-hidden', 'true');
    if (cell.dataset.sparkSlot)
      svg.style.setProperty('--spark-color',
        `var(--color-data-${cell.dataset.sparkSlot}, var(--color-accent))`);
    const line = document.createElementNS(NS, 'polyline');
    line.setAttribute('points', points.map(p => p.map(n => n.toFixed(1)).join(',')).join(' '));
    svg.appendChild(line);
    const dot = document.createElementNS(NS, 'circle');
    const [ex, ey] = points[points.length - 1];
    dot.setAttribute('cx', ex.toFixed(1));
    dot.setAttribute('cy', ey.toFixed(1));
    dot.setAttribute('r', '2.6');
    svg.appendChild(dot);
    cell.appendChild(svg);
    const len = line.getTotalLength();
    line.style.setProperty('--spark-len', len.toFixed(1));
    if (opts.progress != null) {                       /* sabit-zaman karesi */
      const e = easeOutCubic(clamp01(opts.progress));
      line.style.strokeDashoffset = (len * (1 - e)).toFixed(1);
      dot.style.opacity = opts.progress > .9 ? 1 : 0;
      dot.style.transform = opts.progress > .9 ? 'scale(1)' : 'scale(.4)';
    }
    const table = cell.closest('table');
    if (table) tables.add(table);
  }
  if (opts.progress == null) tables.forEach(armFill);
}

/* ---- katman: akış izleri + spotlight notları ------------------------ */

const layers = new WeakMap();
function layerFor(table) {
  let layer = layers.get(table);
  if (!layer || !layer.isConnected) {
    const parent = table.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    layer = document.createElement('div');
    layer.className = 'sci-table-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.appendChild(layer);
    layers.set(table, layer);
  }
  layer.style.left = table.offsetLeft + 'px';
  layer.style.top = table.offsetTop + 'px';
  layer.style.width = table.offsetWidth + 'px';
  layer.style.height = table.offsetHeight + 'px';
  return layer;
}

/* sütun anahtarı: sayı → indeks; değilse başlık metniyle eşleşir */
function resolveColumn(table, key) {
  const n = Number(key);
  if (key !== '' && Number.isFinite(n)) return n;
  const heads = [...table.querySelectorAll('thead th')];
  const i = heads.findIndex(h =>
    h.textContent.trim().toLocaleLowerCase('tr') === String(key).trim().toLocaleLowerCase('tr'));
  return Math.max(0, i);
}

/* ---- toplam satırı akışı -------------------------------------------- */

/* totalFlow — [data-total-of="sütun"] hücresi için: o sütunun gövde
   hücrelerinden toplam hücresine küçük parlak noktalar süzülür; ilk
   varıştan itibaren toplam odometreyle dolar. Toplamın NEREDEN geldiğini
   gösteren TEK SEFERLİK bir olaydır (opts.repeat ile yeniden oynar).
   Sayısal dürüstlük: toplam metni yazarın verdiği değerdir — akış izi
   sadece kaynağı işaret eder, değer üretmez. */
export function totalFlow(table, opts = {}) {
  const targets = qsa(table, '[data-total-of]');
  const stops = [];
  for (const cell of targets) {
    if (!('countFinal' in cell.dataset)) cell.dataset.countFinal = cell.textContent.trim();
    if (exportMode() || reducedMotion()) { cell.textContent = cell.dataset.countFinal; continue; }
    if (cell.dataset.flowDone && !opts.repeat && opts.progress == null) continue;
    cell.dataset.flowDone = '1';
    stops.push(runFlow(table, cell, opts));
  }
  return () => stops.forEach(s => s?.());
}

function runFlow(table, totalCell, opts) {
  const col = resolveColumn(table, totalCell.getAttribute('data-total-of'));
  const rows = [...(table.tBodies[0]?.rows ?? [])];
  const sources = rows.map(r => r.cells[col]).filter(Boolean);
  const final = totalCell.dataset.countFinal;
  const match = final.match(NUM_RE);
  const job = match
    ? (totalCell.dataset.count === 'plain'
        ? plainCountJob(totalCell, final, match)
        : odometerJob(totalCell, final, match))
    : null;
  if (!sources.length) { totalCell.textContent = final; return () => {}; }
  const layer = layerFor(table);
  /* yalnız KENDİ sütununun eski izlerini temizle — eşzamanlı akışlar
     (iki toplam hücresi) birbirinin noktalarını silmesin */
  layer.querySelectorAll(`.sci-flow-dot[data-flow-col="${col}"]`)
    .forEach(d => d.remove());
  const tableRect = table.getBoundingClientRect();
  /* sayılar sağa dayalı: iz, hücrenin sayı bölgesinden kalksın */
  const anchor = r => ({
    x: r.right - tableRect.left - Math.min(34, r.width * .3),
    y: r.top - tableRect.top + r.height / 2
  });
  const target = anchor(totalCell.getBoundingClientRect());
  const dots = sources.map(cellEl => {
    const p0 = anchor(cellEl.getBoundingClientRect());
    const dot = document.createElement('i');
    dot.className = 'sci-flow-dot';
    dot.dataset.flowCol = col;
    layer.appendChild(dot);
    /* hafif sola kavis: iz sütunun solundan süzülerek toplama iner */
    const cp = { x: Math.min(p0.x, target.x) - 46, y: (p0.y + target.y) / 2 };
    return { p0, cp, dot, arrived: false };
  });
  const GAP = 150, TRAVEL = 620;
  const countStart = TRAVEL * .85;                      /* ilk varışa doğru */
  const countDur = (dots.length - 1) * GAP + 620;       /* son varıştan az sonra biter */
  const total = countStart + countDur + 80;
  const bez = (a, c, b, t) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y
  });
  const pulse = () => {
    totalCell.classList.remove('sci-cell--charge');
    void totalCell.offsetWidth;
    totalCell.classList.add('sci-cell--charge');
  };
  return runTimeline(total, T => {
    dots.forEach((d, i) => {
      const lt = (T - i * GAP) / TRAVEL;
      if (lt <= 0) { d.dot.style.opacity = 0; return; }
      if (lt >= 1) {
        d.dot.style.opacity = 0;
        if (!d.arrived) { d.arrived = true; if (opts.progress == null) pulse(); }
        return;
      }
      const e = easeInOutCubic(lt);
      const p = bez(d.p0, d.cp, target, e);
      d.dot.style.opacity = Math.min(1, lt * 6, (1 - lt) * 5 + .15).toFixed(3);
      d.dot.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    });
    job?.frame((T - countStart) / countDur);
  }, () => {
    job?.done();
    setTimeout(() => dots.forEach(d => d.dot.remove()), 400);
  }, opts);
}

/* ---- FLIP yeniden sıralama ------------------------------------------ */

/* tabloSirala — gövde satırlarını colIdx sütununa göre sıralar; satırlar
   FLIP ile (transform-only, layout thrash yok) yeni yerine süzülür ve
   anahtar sütun tek seferlik vurgulanır. yon: "azalan" (vars.) | "artan".
   Değer: data-sort → data-count-final → hücre metni (Türkçe sayı). */
export function tabloSirala(table, colIdx, opts = {}) {
  const tbody = table.tBodies[0];
  if (!tbody) return;
  const direction = opts.yon === 'artan' ? 1 : -1;
  const rows = [...tbody.rows];
  const valueOf = row => {
    const cell = row.cells[colIdx];
    return parseTr(cell?.dataset.sort ?? cell?.dataset.countFinal ?? cell?.textContent);
  };
  const sorted = rows.slice().sort((a, b) => {
    const va = valueOf(a), vb = valueOf(b);
    if (Number.isNaN(va) && Number.isNaN(vb))
      return direction * (a.cells[colIdx]?.textContent ?? '')
        .localeCompare(b.cells[colIdx]?.textContent ?? '', 'tr');
    return direction * (va - vb);
  });
  const keyFlash = () => {
    if (exportMode() || reducedMotion()) return;
    for (const row of sorted) {
      const cell = row.cells[colIdx];
      if (!cell) continue;
      cell.classList.remove('is-sort-key');
      void cell.offsetWidth;
      cell.classList.add('is-sort-key');
      cell.addEventListener('animationend', () => cell.classList.remove('is-sort-key'), { once: true });
    }
  };
  if (sorted.every((row, i) => row === rows[i])) { keyFlash(); return; }
  /* FLIP: first → reorder → last → invert → play */
  const first = new Map(rows.map(row => [row, row.getBoundingClientRect().top]));
  sorted.forEach(row => tbody.appendChild(row));
  indexRows(table);
  if (exportMode() || reducedMotion()) return;
  const deltas = new Map(sorted.map(row =>
    [row, first.get(row) - row.getBoundingClientRect().top]));
  if (opts.progress != null) {                          /* sabit-zaman karesi */
    const p = easeOutCubic(clamp01(opts.progress));
    sorted.forEach(row => {
      const d = deltas.get(row) || 0;
      row.classList.toggle('is-flip', !!d && opts.progress < 1);
      row.style.transform = d && opts.progress < 1 ? `translateY(${(d * (1 - p)).toFixed(2)}px)` : '';
      row.style.zIndex = d && opts.progress < 1 ? String(Math.round(Math.abs(d))) : '';
    });
    if (opts.progress >= 1) keyFlash();
    return;
  }
  let moving = 0;
  sorted.forEach(row => {
    const d = deltas.get(row) || 0;
    if (!d) return;
    moving++;
    row.classList.add('is-flip');
    row.style.zIndex = String(Math.round(Math.abs(d)));  /* uzun yol üstte süzülür */
    row.style.transition = 'none';
    row.style.transform = `translateY(${d.toFixed(2)}px)`;
  });
  void tbody.offsetHeight;                               /* invert karesini bas */
  sorted.forEach((row, i) => {
    if (!deltas.get(row)) return;
    row.style.transition = `transform .55s cubic-bezier(.22,.8,.3,1) ${i * 30}ms`;
    row.style.transform = '';
    row.addEventListener('transitionend', () => {
      row.classList.remove('is-flip');
      row.style.removeProperty('z-index');
      row.style.removeProperty('transition');
      if (--moving === 0) keyFlash();
    }, { once: true });
  });
}

/* ---- ikili sütun düellosu ------------------------------------------- */

const duelValue = cell => {
  const v = parseFloat(cell.dataset.bar);
  if (Number.isFinite(v)) return clamp01(v);
  const n = parseTr(cell.textContent);
  return Number.isFinite(n) ? clamp01(n / 100) : 0;
};

function ensureDuelBar(cell, side, slot) {
  cell.classList.add('sci-cell--duel');
  let bar = cell.querySelector(':scope > .sci-duel-bar');
  if (!bar) {
    bar = document.createElement('i');
    bar.className = `sci-duel-bar sci-duel-bar--${side}`;
    bar.setAttribute('aria-hidden', 'true');
    cell.appendChild(bar);
  }
  const fallback = side === 'a' ? 'var(--color-data-1, var(--color-accent))'
                                : 'var(--color-data-2, var(--color-accent))';
  cell.style.setProperty('--duel-color',
    slot ? `var(--color-data-${slot}, var(--color-accent))` : fallback);
  return bar;
}

/* cellDuel — table[data-duel="colA,colB"]: iki sütunun oran çubukları
   karşılıklı (A sağdan, B soldan) büyür; her satırda kazanan hücre tek
   nabız atar ve fark çipi (+%12) belirir. Değer: data-bar → "%.." metni.
   Çip puan farkıdır: (kazanan − kaybeden) × 100. Tekrar çağrılabilir. */
export function cellDuel(table, opts = {}) {
  const raw = (table.getAttribute('data-duel') || '').split(',');
  if (raw.length !== 2) return () => {};
  const [colA, colB] = raw.map(s => resolveColumn(table, s.trim()));
  const pairs = [];
  [...(table.tBodies[0]?.rows ?? [])].forEach((row, ri) => {
    const a = row.cells[colA], b = row.cells[colB];
    if (!a || !b) return;
    row.querySelectorAll('.sci-duel-chip').forEach(c => c.remove());
    a.classList.remove('is-duel-win');
    b.classList.remove('is-duel-win');
    const barA = ensureDuelBar(a, 'a', a.dataset.barSlot);
    const barB = ensureDuelBar(b, 'b', b.dataset.barSlot);
    const va = duelValue(a), vb = duelValue(b);
    /* dürüstlük: iki çubuk AYNI piksel ölçeğinde (dar hücre baz alınır) —
       sütun genişlikleri farklıysa yüzde tabanı yanıltıcı olurdu */
    const base = Math.min(a.clientWidth, b.clientWidth);
    barA.style.width = (va * base).toFixed(1) + 'px';
    barB.style.width = (vb * base).toFixed(1) + 'px';
    barA.style.transform = 'translateY(-50%) scaleX(0)';
    barB.style.transform = 'translateY(-50%) scaleX(0)';
    pairs.push({ a, b, va, vb, barA, barB, ri, chipped: false });
  });
  if (!pairs.length) return () => {};
  const STAG = 90, DUR = 700;
  const settle = pair => {
    if (pair.chipped) return;
    pair.chipped = true;
    const diff = Math.abs(pair.va - pair.vb);
    if (diff < .005) return;                            /* berabere: çip yok */
    const winner = pair.va > pair.vb ? pair.a : pair.b;
    winner.classList.add('is-duel-win');                /* tek nabız (1x anim) */
    const chip = document.createElement('span');
    chip.className = 'sci-duel-chip';
    chip.textContent = '+%' + Math.round(diff * 100).toLocaleString('tr-TR');
    winner.appendChild(chip);
  };
  const total = (pairs.length - 1) * STAG + DUR + 350;
  return runTimeline(total, T => {
    for (const pair of pairs) {
      const lt = clamp01((T - pair.ri * STAG) / DUR);
      const e = easeOutCubic(lt);
      pair.barA.style.transform = `translateY(-50%) scaleX(${e.toFixed(4)})`;
      pair.barB.style.transform = `translateY(-50%) scaleX(${e.toFixed(4)})`;
      if (lt >= 1) settle(pair);
    }
  }, () => pairs.forEach(settle), opts);
}

/* ---- satır spotlight anlatısı --------------------------------------- */

/* tabloAdimlari — adım adım satır anlatısı. adimlar: satır indeksi ya da
   { satir, not } nesneleri (not verilmezse tr[data-not] okunur). Global
   keydown EKLEMEZ; deste yazarı dönen denetleyiciyi kendi tuşlarına
   bağlar. Her adımda "tabloadim" CustomEvent'i tablodan yayınlanır.
   Denetleyici: { ileri, geri, git, sifirla, indeks, uzunluk, kapat }.  */
export function tabloAdimlari(table, adimlar = [], opts = {}) {
  const rows = [...(table.tBodies[0]?.rows ?? [])];
  const steps = adimlar.map(s =>
    typeof s === 'object' ? { satir: s.satir, not: s.not } : { satir: s });
  table.classList.add('sci-spot-on');
  let index = -1;
  let note = null;
  const clearNote = () => { note?.remove(); note = null; };
  const apply = () => {
    clearNote();
    const step = steps[index];
    rows.forEach((row, ri) => {
      row.classList.toggle('is-spot', !!step && ri === step.satir);
      row.classList.toggle('is-dim', !!step && ri !== step.satir);
    });
    if (step && !exportMode()) {
      const row = rows[step.satir];
      const text = step.not ?? row?.dataset.not;
      if (row && text) {
        const layer = layerFor(table);
        note = document.createElement('div');
        note.className = 'sci-spot-note';
        note.textContent = text;
        note.style.top = (row.offsetTop + row.offsetHeight / 2) + 'px';
        /* dışarıda yer varsa sağ kenarın ötesine, yoksa iç kenara */
        const room = document.documentElement.clientWidth - table.getBoundingClientRect().right;
        if (room > 220) note.style.left = (table.offsetWidth + 14) + 'px';
        else { note.style.right = '14px'; note.classList.add('is-inside'); }
        layer.appendChild(note);
      }
    }
    table.dispatchEvent(new CustomEvent('tabloadim',
      { detail: { indeks: index, adim: steps[index] ?? null } }));
  };
  const git = n => {
    index = Math.max(-1, Math.min(steps.length - 1, n));
    apply();
    return index;
  };
  return {
    ileri: () => git(index + 1),
    geri: () => git(index - 1),
    git,
    sifirla: () => git(-1),
    indeks: () => index,
    uzunluk: steps.length,
    kapat: () => {
      index = -1;
      clearNote();
      rows.forEach(row => row.classList.remove('is-spot', 'is-dim'));
      table.classList.remove('sci-spot-on');
    }
  };
}

/* ---- yönetmenli girişin sabit-zaman karesi (headless QA) ------------- */

/* CSS zaman çizgisinin aynası: th girişi → başlık altı çizgi → gövde.
   p ∈ [0,1] toplam süreye eşlenir; stiller satır içi ve senkron basılır.
   Süreler table-motion.css'teki data-table-enter kurallarıyla EŞTİR.   */
export function renderTableEnterAt(table, p = 1) {
  const mode = table.getAttribute('data-table-enter') || 'cascade';
  table.classList.add('no-anim', 'is-revealed');
  indexRows(table);
  indexColumns(table);
  const spans = [];
  [...table.querySelectorAll('thead th')].forEach((th, c) => {
    spans.push(
      { start: c * 50, dur: 300, apply: e => {
          th.style.opacity = e.toFixed(3);
          th.style.transform = `translateY(${(-6 * (1 - e)).toFixed(2)}px)`;
        } },
      { start: 200 + c * 70, dur: 300, apply: e => {
          th.style.backgroundSize = `${(e * 100).toFixed(1)}% 2px`;
        } });
  });
  const bodyRows = [...(table.tBodies[0]?.rows ?? []),
                    ...(table.tFoot?.rows ?? [])];
  bodyRows.forEach((tr, r) => {
    if (mode === 'rows') {
      spans.push({ start: 550 + r * 90, dur: 450, apply: e => {
        tr.style.opacity = e.toFixed(3);
        tr.style.transform = `translateY(${(10 * (1 - e)).toFixed(2)}px)`;
      } });
      return;
    }
    [...tr.cells].forEach((td, c) => {
      if (mode === 'wipe')
        spans.push({ start: 550 + r * 120 + c * 60, dur: 400, apply: e => {
          td.style.clipPath = `inset(0 ${((1 - e) * 100).toFixed(1)}% 0 0)`;
        } });
      else
        spans.push({ start: 550 + r * 100 + c * 50, dur: 500, apply: e => {
          td.style.opacity = e.toFixed(3);
          td.style.transform = `translateY(${(10 * (1 - e)).toFixed(2)}px)`;
        } });
    });
  });
  const total = Math.max(...spans.map(s => s.start + s.dur));
  const T = clamp01(p) * total;
  spans.forEach(s => s.apply(easeOutCubic(clamp01((T - s.start) / s.dur))));
  return total;
}

/* ---- tek çağrılık kurulum ------------------------------------------- */

/* initTableMotion — kapsamdaki tüm tablo yeteneklerini data-öznitelikten
   okuyup kurar: bar + heat + spark dolguları, reveal/enter gözlemcisi,
   sayaçlar, düello ve toplam akışı (görünürlükte, giriş bittikten sonra).
   Durdurucu fonksiyon döner. */
export function initTableMotion(scope = document, opts = {}) {
  cellBars(scope);
  heatFill(scope);
  cellSparks(scope, opts);
  const stops = [observeTableReveal(scope)];
  countCells(scope, opts);
  for (const table of qsa(scope, 'table[data-duel]'))
    stops.push(onceVisible(table, () => cellDuel(table), entranceDelay(table)));
  const flowTables = new Set(qsa(scope, '[data-total-of]')
    .map(cell => cell.closest('table')).filter(Boolean));
  for (const table of flowTables)
    stops.push(onceVisible(table, () => totalFlow(table), entranceDelay(table)));
  return () => stops.forEach(stop => stop?.());
}
