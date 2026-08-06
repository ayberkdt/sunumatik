/* Chronology timeline preset: an interactive horizontal or vertical
   timeline "tree" for historical sequences, mission phases, and program
   milestones. One event holds focus at a time; click, arrow keys, or the
   wheel move attention along the axis and the track glides so the focused
   event stays centered. Branch tracks hold parallel threads (e.g. missions
   above the axis, science results below).

   Ordering is ordinal by default: slots are evenly spaced in sequence
   order, which is honest as long as the dates stay visible. Pass
   scale: 'time' with numeric `t` values when spacing itself carries
   meaning — then gaps are proportional and may not be hidden.

   Dates and claims are content: verify them with the evidence skill;
   this preset only presents them. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exporting = () => document.documentElement.dataset.export === 'true';

export function mountTimeline(container, options = {}) {
  if (!container) throw new Error('mountTimeline requires a container element');
  const events = options.events || [];
  if (!events.length) throw new Error('mountTimeline requires events');
  const vertical = options.orientation === 'vertical';
  const slot = options.slotSize ?? (vertical ? 150 : 280);
  const scale = options.scale || 'ordinal';

  container.classList.add('tl', vertical ? 'tl--vertical' : 'tl--horizontal');
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', options.ariaLabel || 'Interactive chronology');

  const viewport = document.createElement('div');
  viewport.className = 'tl-viewport';
  const track = document.createElement('div');
  track.className = 'tl-track';
  viewport.appendChild(track);
  container.appendChild(viewport);

  /* Positions along the main axis, px from track start */
  let positions;
  if (scale === 'time') {
    const ts = events.map(e => Number(e.t));
    const min = Math.min(...ts), span = Math.max(...ts) - min || 1;
    const length = slot * (events.length - 1);
    positions = ts.map(t => ((t - min) / span) * length);
  } else {
    positions = events.map((_, i) => i * slot);
  }
  const trackLength = positions[positions.length - 1] + slot;
  track.style[vertical ? 'height' : 'width'] = `${trackLength}px`;

  const axis = document.createElement('div');
  axis.className = 'tl-axis';
  track.appendChild(axis);

  /* Era bands under the axis */
  (options.eras || []).forEach(era => {
    const from = positions[Math.max(0, era.from)] ?? 0;
    const to = positions[Math.min(events.length - 1, era.to)] ?? trackLength;
    const band = document.createElement('div');
    band.className = 'tl-era';
    band.style[vertical ? 'top' : 'left'] = `${from - slot * .3}px`;
    band.style[vertical ? 'height' : 'width'] = `${to - from + slot * .6}px`;
    const label = document.createElement('span');
    label.className = 'tl-era-label';
    label.textContent = era.label;
    band.appendChild(label);
    track.appendChild(band);
  });

  /* Event nodes */
  const nodes = events.map((event, index) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'tl-event';
    node.dataset.track = String(event.track ?? 1);
    node.style[vertical ? 'top' : 'left'] = `${positions[index]}px`;
    node.setAttribute('aria-label', `${event.date} — ${event.title}`);
    node.innerHTML = [
      '<span class="tl-dot" aria-hidden="true"></span>',
      '<span class="tl-connector" aria-hidden="true"></span>',
      '<span class="tl-card">',
      `<span class="tl-date">${event.date}</span>`,
      `<span class="tl-title">${event.title}</span>`,
      event.detail ? `<span class="tl-detail">${event.detail}</span>` : '',
      '</span>',
    ].join('');
    track.appendChild(node);
    node.addEventListener('click', () => focus(index));
    return node;
  });

  const status = document.createElement('p');
  status.className = 'tl-status';
  status.setAttribute('aria-live', 'polite');
  container.appendChild(status);

  let current = -1;
  const center = () => {
    const size = vertical ? viewport.clientHeight : viewport.clientWidth;
    const offset = size / 2 - positions[current] - slot * .5;
    track.style.transform = vertical ? `translateY(${offset}px)` : `translateX(${offset}px)`;
  };

  function focus(index, announce = true) {
    current = Math.max(0, Math.min(events.length - 1, index));
    nodes.forEach((node, i) => {
      node.classList.toggle('is-focused', i === current);
      node.classList.toggle('is-passed', i < current);
    });
    center();
    const era = (options.eras || []).find(e => current >= e.from && current <= e.to);
    status.textContent = `${current + 1} / ${events.length}` +
      (era ? ` · ${era.label}` : '') + (announce ? ` · ${events[current].title}` : '');
    container.dispatchEvent(new CustomEvent('tl:focus', { detail: { index: current, event: events[current] } }));
  }

  /* Keyboard: arrows along the axis, Home/End for endpoints */
  const forwardKeys = vertical ? ['ArrowDown'] : ['ArrowRight'];
  const backKeys = vertical ? ['ArrowUp'] : ['ArrowLeft'];
  container.addEventListener('keydown', event => {
    if (forwardKeys.includes(event.key)) { focus(current + 1); event.preventDefault(); }
    if (backKeys.includes(event.key)) { focus(current - 1); event.preventDefault(); }
    if (event.key === 'Home') { focus(0); event.preventDefault(); }
    if (event.key === 'End') { focus(events.length - 1); event.preventDefault(); }
  });

  /* Wheel: one deliberate step per gesture, never free-scroll jitter */
  let wheelLock = 0;
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    const now = performance.now();
    if (now - wheelLock < 350) return;
    wheelLock = now;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    focus(current + (delta > 0 ? 1 : -1));
  }, { passive: false });

  addEventListener('resize', center);

  if (reduced() || exporting()) container.classList.add('tl--settled');
  focus(options.initialIndex ?? (exporting() ? (options.exportIndex ?? 0) : 0), false);

  return {
    focus,
    next: () => focus(current + 1),
    prev: () => focus(current - 1),
    get index() { return current; },
    element: container,
  };
}
