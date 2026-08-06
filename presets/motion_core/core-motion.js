const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exporting = () => document.documentElement.dataset.export === 'true';

export function settleAll(root = document) {
  root.querySelectorAll('[data-motion]').forEach(element => element.classList.add('is-settled'));
}

export function animatePreset(element, options = {}) {
  if (!element) return { finished: Promise.resolve(), cancel() {} };
  if (reduced() || exporting()) {
    element.classList.add('is-settled');
    return { finished: Promise.resolve(), cancel() {} };
  }

  const kind = options.kind || element.dataset.motion || 'reveal';
  const duration = Number(options.duration ?? element.dataset.duration ?? 420);
  const delay = Number(options.delay ?? element.dataset.delay ?? 0);
  const easing = options.easing || 'cubic-bezier(.22,.8,.24,1)';
  const frames = {
    reveal: [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
    rise: [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }],
    'comparison-wipe': [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
    focus: [{ opacity: .35, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }],
  };
  const animation = element.animate(frames[kind] || frames.reveal, { duration, delay, easing, fill: 'forwards' });
  animation.finished.then(() => element.classList.add('is-settled')).catch(() => {});
  return animation;
}

export function tracePath(path, options = {}) {
  if (!path) return { finished: Promise.resolve(), cancel() {} };
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  if (reduced() || exporting()) {
    path.style.strokeDashoffset = '0';
    return { finished: Promise.resolve(), cancel() {} };
  }
  return path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
    duration: Number(options.duration ?? 900),
    easing: options.easing || 'cubic-bezier(.22,.8,.24,1)',
    fill: 'forwards',
  });
}

export function animateCount(element, from, to, options = {}) {
  if (!element) return { finished: Promise.resolve(), cancel() {} };
  const format = options.format || (value => Math.round(value).toLocaleString());
  if (reduced() || exporting()) {
    element.textContent = format(to);
    return { finished: Promise.resolve(), cancel() {} };
  }
  const duration = Number(options.duration ?? 700);
  const animation = element.animate([{ opacity: .65 }, { opacity: 1 }], { duration, fill: 'forwards' });
  const start = performance.now();
  let frame;
  const tick = now => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    element.textContent = format(from + (to - from) * eased);
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  const cancel = animation.cancel.bind(animation);
  animation.cancel = () => { cancelAnimationFrame(frame); cancel(); };
  return animation;
}

/* Staged reveal: play every [data-motion] inside a newly activated slide in
   document order, separated by a stagger. Call it from the deck runtime when
   a slide becomes active. Explicit data-delay on an element wins over the
   computed stagger slot. */
export function revealStage(root, options = {}) {
  if (!root) return;
  const items = [...root.querySelectorAll('[data-motion]')];
  if (reduced() || exporting()) { settleAll(root); return; }
  const stagger = Number(options.stagger ?? root.dataset.stagger ?? 110);
  items.forEach((element, index) => {
    element.classList.remove('is-settled');
    const delay = element.dataset.delay != null ? Number(element.dataset.delay) : index * stagger;
    animatePreset(element, { delay });
  });
}

/* Scroll-triggered reveal for the linear reading view (never for the fixed
   stage, where slide activation is the trigger). Each [data-motion] plays
   once when it enters the viewport. */
export function observeReveal(root = document, options = {}) {
  const targets = [...root.querySelectorAll('[data-motion]')];
  if (reduced() || exporting() || !('IntersectionObserver' in window)) {
    settleAll(root);
    return { disconnect() {} };
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      animatePreset(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: options.threshold ?? 0.35 });
  targets.forEach(target => observer.observe(target));
  return observer;
}

if (reduced() || exporting()) settleAll();
