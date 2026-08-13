/* Table motion helpers — pairs with table-motion.css.

   observeTableReveal(root?)  activates [data-table-reveal] cascades when
                              tables scroll into view (assigns --row-index,
                              adds .is-revealed; hidden-pane watchdog)
                              data-table-reveal="columns" → column mode
   flashRow(tr)               one-shot attention flash on a row
   enableColumnEmphasis(tbl)  header hover → column emphasis
   countCells(scope?, opts?)  [data-count] hücreleri 0→değer sayar
   cellBars(scope?)           [data-bar] hücrelerine metin altı veri çubuğu
   heatFill(scope?)           [data-heat] hücrelerine rampa arka planı
   columnCascade(table)       tek tabloyu sütun kaskadı moduna alır      */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exportMode = () =>
  document.documentElement.dataset.export === 'true'
  || new URLSearchParams(location.search).get('export') === '1';

export function observeTableReveal(root = document) {
  const tables = [...root.querySelectorAll('[data-table-reveal]')];
  if (root.matches?.('[data-table-reveal]')) tables.unshift(root);
  const finishAll = () => tables.forEach(t => t.classList.add('is-revealed'));
  if (exportMode() || reducedMotion()) { finishAll(); return () => {}; }
  for (const table of tables) {
    indexRows(table);
    /* "columns" modu: hücreler satır yerine sütun sırasıyla girer */
    if (table.getAttribute('data-table-reveal') === 'columns') indexColumns(table);
  }
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

/* ---- Hücre düzeyi dolgu efektleri ----------------------------------- */

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const clamp01 = value => Math.min(1, Math.max(0, value || 0));

/* satır/sütun indekslerini CSS değişkeni olarak yaz (kaskad gecikmeleri) */
const indexRows = table =>
  table.querySelectorAll('tbody tr').forEach((tr, i) =>
    tr.style.setProperty('--row-index', i));
const indexColumns = table =>
  table.querySelectorAll('tr').forEach(tr =>
    [...tr.children].forEach((cell, ci) => cell.style.setProperty('--col-index', ci)));

/* Dolgu geçişini kur: tablo data-table-reveal taşıyorsa .is-revealed'ı
   gözlemci ekler (aynı IO + bekçi); taşımıyorsa burada ekleriz. Hareket
   kapalıysa / dışa aktarımda hemen son duruma geç. */
function armFill(table) {
  indexRows(table);
  if (exportMode() || reducedMotion()) { table.classList.add('is-revealed'); return; }
  if (table.hasAttribute('data-table-reveal')) return;
  /* çift rAF: ilk kare scaleX(0)/saydam çizilsin ki geçiş oynasın */
  requestAnimationFrame(() =>
    requestAnimationFrame(() => table.classList.add('is-revealed')));
}

/* countCells — [data-count] hücrelerinde 0→değer sayacı.
   Türkçe biçim desteklenir: binlik "." , ondalık "," ; sayı dışındaki
   önek/sonek ("%", "ms", "≈"...) aynen korunur. Tekrar çağrılabilir:
   orijinal metin data-count-final'da saklanır. */
export function countCells(scope = document, opts = {}) {
  const duration = Number(opts.duration ?? 900);
  const stagger = Number(opts.stagger ?? 60);
  for (const cell of scope.querySelectorAll('[data-count]')) {
    if (!('countFinal' in cell.dataset)) cell.dataset.countFinal = cell.textContent.trim();
    const final = cell.dataset.countFinal;
    const match = final.match(/-?\d[\d.]*(?:,\d+)?/);
    if (!match) { cell.textContent = final; continue; }
    if (exportMode() || reducedMotion()) { cell.textContent = final; continue; }
    const prefix = final.slice(0, match.index);
    const suffix = final.slice(match.index + match[0].length);
    const decimals = (match[0].split(',')[1] || '').length;
    const value = parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
    const format = v => prefix
      + v.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      + suffix;
    /* sütun konumu × 60 ms kademe */
    const column = [...cell.parentElement.children].indexOf(cell);
    const start = performance.now() + column * stagger;
    cell.textContent = format(0);
    const tick = now => {
      const t = (now - start) / duration;
      if (t >= 1) { cell.textContent = final; return; }
      if (t > 0) cell.textContent = format(value * easeOutCubic(t));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

/* cellBars — [data-bar="0..1"] hücrelerine metnin ALTINDA yatay veri
   çubuğu. Duotone disiplin: %16 saydam gövde + tam renkte 2px uç kenarı.
   Renk: vurgu; data-bar-slot="2" → --color-data-2. Tekrar çağrılabilir. */
export function cellBars(scope = document) {
  const tables = new Set();
  for (const cell of scope.querySelectorAll('[data-bar]')) {
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
  const cells = [...scope.querySelectorAll('[data-heat]')];
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
