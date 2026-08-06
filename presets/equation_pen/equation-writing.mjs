/* Equation writing preset: reveals an equation the way a hand writes it —
   token by token in reading order, with a pen nib gliding along the
   baseline. A presentational flourish, not a scientific claim: it never
   reorders mathematics and it disappears entirely in export and
   reduced-motion modes, leaving the complete equation.

   Ink units — the atoms of writing — are the elements tagged `data-ink`
   inside the root (document order; give explicit numbers `data-ink="3"`
   to override). They can be KaTeX/MathJax output wrappers, plain spans,
   or SVG <text>/<path> elements. A unit with `data-stroke` on an SVG
   path is drawn as a true stroke (dashoffset), for hand-authored glyphs
   like integral signs or annotation arrows. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exporting = () => document.documentElement.dataset.export === 'true';

function collectInk(root) {
  const units = [...root.querySelectorAll('[data-ink]')];
  const explicit = units.every(el => el.dataset.ink !== '' && !isNaN(Number(el.dataset.ink)));
  return explicit && units.length
    ? units.sort((a, b) => Number(a.dataset.ink) - Number(b.dataset.ink))
    : units;
}

function showInstantly(units, root) {
  units.forEach(el => {
    el.classList.remove('ink-pending');
    el.classList.add('ink-written');
    if (el.dataset.stroke !== undefined) el.style.strokeDashoffset = '0';
  });
  root.querySelector('.ink-pen')?.remove();
}

function makePen(root) {
  const pen = document.createElement('span');
  pen.className = 'ink-pen';
  pen.setAttribute('aria-hidden', 'true');
  pen.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20 L6 13 L17 2 L22 7 L11 18 Z M6 13 L11 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  root.appendChild(pen);
  return pen;
}

const penAt = (x, y, tilt = 0) => `translate(${x}px, ${y}px) rotate(${tilt}deg)`;

function unitGeometry(root, el) {
  const rootBox = root.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  return {
    startX: box.left - rootBox.left,
    endX: box.right - rootBox.left,
    y: box.bottom - rootBox.top - 6,
  };
}

/* Pen-up hop: the nib lifts off the paper, arcs to the next token,
   and touches down with a slight forward tilt — a hand, not a cursor. */
function penTravel(pen, root, el, duration) {
  const { startX, y } = unitGeometry(root, el);
  const from = pen.dataset.x !== undefined
    ? { x: Number(pen.dataset.x), y: Number(pen.dataset.y) }
    : { x: startX - 30, y: y - 24 };
  const midX = (from.x + startX) / 2;
  const midY = Math.min(from.y, y) - 16;
  const finished = pen.animate([
    { transform: penAt(from.x, from.y, 0), offset: 0 },
    { transform: penAt(midX, midY, -10), offset: .55 },
    { transform: penAt(startX, y, 4), offset: 1 },
  ], { duration, easing: 'cubic-bezier(.4,.15,.35,1)', fill: 'forwards' }).finished;
  pen.dataset.x = startX;
  pen.dataset.y = y;
  return finished.catch(() => {});
}

/* Pen-down sweep: the nib rides across the token in sync with the ink,
   bobbing and tilting the way a writing hand oscillates. */
function penSweep(pen, root, el, duration) {
  const { startX, endX, y } = unitGeometry(root, el);
  const step = (endX - startX) / 4;
  const finished = pen.animate([
    { transform: penAt(startX, y, 4), offset: 0 },
    { transform: penAt(startX + step, y - 2.5, 8), offset: .28 },
    { transform: penAt(startX + step * 2, y + 1.5, 2), offset: .52 },
    { transform: penAt(startX + step * 3, y - 2, 7), offset: .76 },
    { transform: penAt(endX, y, 3), offset: 1 },
  ], { duration, easing: 'linear', fill: 'forwards' }).finished;
  pen.dataset.x = endX;
  pen.dataset.y = y;
  return finished.catch(() => {});
}

/* Stroke tracing: the nib physically follows the SVG path while the
   dashoffset draws it — the closest thing to real handwriting. */
function penTraceStroke(pen, root, path, duration) {
  if (typeof path.getPointAtLength !== 'function' || !path.getScreenCTM) return Promise.resolve();
  const length = path.getTotalLength();
  const start = performance.now();
  return new Promise(resolve => {
    const tick = now => {
      if (!pen.isConnected) { resolve(); return; }
      const t = Math.min(1, (now - start) / duration);
      const rootBox = root.getBoundingClientRect();
      const matrix = path.getScreenCTM();
      if (matrix) {
        const point = path.getPointAtLength(length * t).matrixTransform(matrix);
        const x = point.x - rootBox.left, y = point.y - rootBox.top;
        pen.style.transform = penAt(x, y, 5);
        pen.dataset.x = x;
        pen.dataset.y = y;
      }
      if (t < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function writeUnit(el, duration, pen, root) {
  if (el.dataset.stroke !== undefined && typeof el.getTotalLength === 'function') {
    const length = el.getTotalLength();
    const drawTime = Math.max(duration, length * 2.2);
    el.style.strokeDasharray = `${length}`;
    el.classList.remove('ink-pending');
    const draw = el.animate(
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      { duration: drawTime, easing: 'cubic-bezier(.45,.1,.4,1)', fill: 'forwards' }
    ).finished.then(() => { el.classList.add('ink-written'); el.style.strokeDashoffset = '0'; }).catch(() => {});
    const trace = pen ? penTraceStroke(pen, root, el, drawTime) : Promise.resolve();
    return Promise.all([draw, trace]);
  }
  el.classList.remove('ink-pending');
  /* Ink follows the nib: a stepped, slightly uneven wipe with a
     fresh-ink settle instead of one flat linear reveal. */
  const reveal = el.animate([
    { opacity: 0,   clipPath: 'inset(-10% 102% -10% -2%)', offset: 0 },
    { opacity: .85, clipPath: 'inset(-10% 68% -10% -2%)',  offset: .3 },
    { opacity: .9,  clipPath: 'inset(-10% 52% -10% -2%)',  offset: .45 },
    { opacity: .95, clipPath: 'inset(-10% 22% -10% -2%)',  offset: .78 },
    { opacity: 1,   clipPath: 'inset(-10% -8% -10% -2%)',  offset: 1 },
  ], { duration, easing: 'linear', fill: 'forwards' }).finished
    .then(() => el.classList.add('ink-written')).catch(() => {});
  const sweep = pen ? penSweep(pen, root, el, duration) : Promise.resolve();
  return Promise.all([reveal, sweep]);
}

/* Write one equation. Returns a controller with `finished`, `cancel`,
   and `settle`. Root must be position:relative (the CSS handles it). */
export function writeEquation(root, options = {}) {
  const units = collectInk(root);
  if (!units.length) return { finished: Promise.resolve(), cancel() {}, settle() {} };
  units.forEach(el => { el.classList.remove('ink-written'); el.classList.add('ink-pending'); });

  if (reduced() || exporting()) {
    showInstantly(units, root);
    return { finished: Promise.resolve(), cancel() {}, settle() {} };
  }

  const unitDuration = Number(options.unitDuration ?? 240);
  const gap = Number(options.gap ?? 70);
  const usePen = options.pen ?? true;
  const pen = usePen ? makePen(root) : null;
  let cancelled = false;

  const finished = (async () => {
    for (const el of units) {
      if (cancelled) return;
      if (pen) await penTravel(pen, root, el, gap + 90);
      /* Wider tokens take proportionally longer — a hand writes at ink
         speed, not at token count. */
      const width = el.getBoundingClientRect().width;
      const duration = el.dataset.stroke !== undefined
        ? unitDuration * 2
        : unitDuration * Math.min(2.2, Math.max(.7, width / 90));
      await writeUnit(el, duration, pen, root);
      await new Promise(resolve => setTimeout(resolve, gap));
    }
    pen?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' })
      .finished.then(() => pen.remove()).catch(() => {});
  })();

  const settle = () => { cancelled = true; showInstantly(units, root); };
  return { finished, cancel: () => { cancelled = true; pen?.remove(); }, settle };
}

/* Write several equations (derivation steps) in sequence. */
export function writeSequence(roots, options = {}) {
  const list = [...roots];
  if (reduced() || exporting()) {
    list.forEach(root => showInstantly(collectInk(root), root));
    return { finished: Promise.resolve(), cancel() {}, settle() {} };
  }
  let active = null;
  let cancelled = false;
  const finished = (async () => {
    for (const root of list) {
      if (cancelled) return;
      active = writeEquation(root, options);
      await active.finished;
      await new Promise(resolve => setTimeout(resolve, Number(options.stepGap ?? 420)));
    }
  })();
  return {
    finished,
    cancel: () => { cancelled = true; active?.cancel(); },
    settle: () => { cancelled = true; active?.cancel(); list.forEach(root => showInstantly(collectInk(root), root)); },
  };
}
