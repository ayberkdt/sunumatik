/* Table motion helpers — pairs with table-motion.css.

   observeTableReveal(root?)  activates [data-table-reveal] cascades when
                              tables scroll into view (assigns --row-index,
                              adds .is-revealed; hidden-pane watchdog)
   flashRow(tr)               one-shot attention flash on a row
   enableColumnEmphasis(tbl)  header hover → column emphasis            */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exportMode = () =>
  document.documentElement.dataset.export === 'true'
  || new URLSearchParams(location.search).get('export') === '1';

export function observeTableReveal(root = document) {
  const tables = [...root.querySelectorAll('[data-table-reveal]')];
  const finishAll = () => tables.forEach(t => t.classList.add('is-revealed'));
  if (exportMode() || reducedMotion()) { finishAll(); return () => {}; }
  for (const table of tables) {
    table.querySelectorAll('tbody tr').forEach((tr, i) =>
      tr.style.setProperty('--row-index', i));
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
