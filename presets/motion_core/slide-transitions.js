/* Slide transition driver for fixed-stage decks. Works with the stage
   contract: slides are absolutely stacked and switched with an active
   class controlling visibility/opacity/pointer-events.

   await transitionSlides(fromEl, toEl, {
     kind: 'fade-through' | 'push' | 'wipe-mask' | 'morph',
     direction: 1 | -1,          // push only: forward or back
     stage: stageEl,             // wipe-mask only: element the panel covers
     activeClass: 'is-active',
   });

   Reduced motion and export mode swap instantly. One transition runs at
   a time; a second call while one is in flight resolves the first
   immediately. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exporting = () => document.documentElement.dataset.export === 'true';

let inFlight = null;
let currentMarker = null;

function swap(fromEl, toEl, activeClass) {
  fromEl?.classList.remove(activeClass);
  toEl?.classList.add(activeClass);
}

/* Marker planted by zoom-into. Coordinates are stage-local: screen pixels
   divided by the stage's uniform scale. A new transition retires the
   previous marker so at most one mark is ever on stage. */
function stagePoint(stageEl, clientX, clientY) {
  const box = stageEl.getBoundingClientRect();
  const scale = box.width / (stageEl.offsetWidth || box.width);
  return { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale };
}

function retireMarker(fade = true) {
  const marker = currentMarker;
  currentMarker = null;
  if (!marker) return;
  if (!fade || reduced() || exporting()) { marker.remove(); return; }
  marker.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
    .finished.then(() => marker.remove()).catch(() => marker.remove());
  setTimeout(() => marker.remove(), 700);  // hidden/throttled documents never finish the fade
}

function plantMarker(stageEl, x, y) {
  retireMarker(false);
  const marker = document.createElement('div');
  marker.className = 'st-marker is-planted';
  marker.setAttribute('aria-hidden', 'true');
  marker.style.transform = `translate(${x - 23}px, ${y - 23}px)`;
  stageEl.appendChild(marker);
  currentMarker = marker;
  return marker;
}

function dockMarker(marker, stageEl, dockEl, duration) {
  const box = dockEl.getBoundingClientRect();
  const target = stagePoint(stageEl, box.left + box.width / 2, box.top + box.height / 2);
  const to = `translate(${target.x - 23}px, ${target.y - 23}px)`;
  if (reduced() || exporting()) { marker.style.transform = to; return Promise.resolve(); }
  const glide = marker.animate([{ transform: marker.style.transform }, { transform: to }],
    { duration, easing: 'cubic-bezier(.32,.72,.16,1)', fill: 'forwards' }).finished
    .then(() => { marker.style.transform = to; }).catch(() => {});
  /* hidden/throttled documents may never finish the glide — land it anyway */
  return Promise.race([glide, new Promise(resolve =>
    setTimeout(() => { marker.style.transform = to; resolve(); }, duration + 800))]);
}

/* Animations in a hidden or throttled document may never finish; the
   timeout guarantees the driver always resolves and cleans up, leaving
   the class-based resting state, which is correct by contract. */
function afterAnimations(elements, limit = 2400) {
  const settled = Promise.allSettled(
    elements.flatMap(el => el ? el.getAnimations().map(a => a.finished) : [])
  );
  return Promise.race([settled, new Promise(resolve => setTimeout(resolve, limit))]);
}

export async function transitionSlides(fromEl, toEl, options = {}) {
  const activeClass = options.activeClass || 'is-active';
  if (!toEl || fromEl === toEl) return;
  if (inFlight) { inFlight(); inFlight = null; }
  if (options.kind !== 'zoom-into') retireMarker();  // a planted mark belongs to its zoom context
  if (reduced() || exporting() || !fromEl) {
    swap(fromEl, toEl, activeClass);
    if (options.kind === 'zoom-into') {
      const stageEl = options.stage || toEl.parentElement;
      const dockEl = toEl.querySelector(options.dock || '[data-marker-dock]');
      if (dockEl && options.marker !== false) {
        const box = dockEl.getBoundingClientRect();
        const p = stagePoint(stageEl, box.left + box.width / 2, box.top + box.height / 2);
        plantMarker(stageEl, p.x, p.y).classList.remove('is-planted');
      }
    }
    return;
  }

  const kind = options.kind || 'fade-through';
  let cancelled = false;
  inFlight = () => { cancelled = true; };

  const cleanup = () => {
    [fromEl, toEl].forEach(el => el.classList.remove(
      'st-leaving', 'st-entering', 'st-fade-out', 'st-fade-in',
      'st-push-out', 'st-push-in', 'st-zoom-out', 'st-zoom-in'));
    fromEl.style.removeProperty('--st-direction');
    toEl.style.removeProperty('--st-direction');
    fromEl.style.removeProperty('transform-origin');
  };

  if (kind === 'zoom-into') {
    const stageEl = options.stage || fromEl.parentElement;
    const anchorEl = typeof options.anchor === 'string'
      ? fromEl.querySelector(options.anchor) : options.anchor;
    const anchorBox = (anchorEl || fromEl).getBoundingClientRect();
    const point = stagePoint(stageEl, anchorBox.left + anchorBox.width / 2, anchorBox.top + anchorBox.height / 2);
    fromEl.style.transformOrigin = `${point.x}px ${point.y}px`;
    const marker = (options.marker !== false && anchorEl) ? plantMarker(stageEl, point.x, point.y) : null;

    fromEl.classList.add('st-leaving', 'st-zoom-out');
    toEl.classList.add('st-entering', 'st-zoom-in');
    swap(fromEl, toEl, activeClass);
    await afterAnimations([fromEl, toEl]);
    cleanup();

    if (marker && !cancelled) {
      const dockEl = toEl.querySelector(options.dock || '[data-marker-dock]');
      if (dockEl) await dockMarker(marker, stageEl, dockEl, 520);
      else setTimeout(() => { if (currentMarker === marker) retireMarker(); }, 900);
    }
    inFlight = null;
    return;
  }

  if (kind === 'morph' && document.startViewTransition) {
    await document.startViewTransition(() => swap(fromEl, toEl, activeClass)).finished.catch(() => {});
    inFlight = null;
    return;
  }

  if (kind === 'wipe-mask') {
    const stage = options.stage || fromEl.parentElement;
    const panel = document.createElement('div');
    panel.className = 'st-wipe-panel';
    panel.setAttribute('aria-hidden', 'true');
    stage.appendChild(panel);
    panel.classList.add('is-sweeping');
    const duration = parseFloat(getComputedStyle(stage).getPropertyValue('--slide-duration')) || 560;
    await new Promise(resolve => setTimeout(resolve, duration * .75));
    if (!cancelled) swap(fromEl, toEl, activeClass);
    await afterAnimations([panel]);
    panel.remove();
    inFlight = null;
    return;
  }

  const direction = options.direction ?? 1;
  const outClass = kind === 'push' ? 'st-push-out' : 'st-fade-out';
  const inClass = kind === 'push' ? 'st-push-in' : 'st-fade-in';
  fromEl.style.setProperty('--st-direction', String(direction));
  toEl.style.setProperty('--st-direction', String(direction));

  fromEl.classList.add('st-leaving', outClass);
  toEl.classList.add('st-entering', inClass);
  swap(fromEl, toEl, activeClass);
  await afterAnimations([fromEl, toEl]);
  cleanup();
  inFlight = null;
}
