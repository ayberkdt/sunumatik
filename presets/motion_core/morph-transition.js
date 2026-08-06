/* Morph helpers. Two techniques, one contract:
   - morphState(container, mutate): FLIP morph of [data-morph-key] elements.
     Elements keeping their key glide to their new geometry; new keys enter,
     removed keys leave. Works everywhere.
   - viewMorph(mutate): whole-document morph via the View Transitions API,
     falling back to an instant mutation.
   Both apply the mutation instantly under reduced motion or export mode,
   so the final state is always identical. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exporting = () => document.documentElement.dataset.export === 'true';

const DURATION = 460;
const EASE = 'cubic-bezier(.24,.8,.22,1)';

function snapshot(container) {
  const map = new Map();
  container.querySelectorAll('[data-morph-key]').forEach(el => {
    map.set(el.dataset.morphKey, { el, rect: el.getBoundingClientRect() });
  });
  return map;
}

export async function morphState(container, mutate, options = {}) {
  if (!container || typeof mutate !== 'function') return;
  if (reduced() || exporting()) { await mutate(); return; }

  const duration = Number(options.duration ?? DURATION);
  const easing = options.easing || EASE;
  const before = snapshot(container);
  await mutate();
  const after = snapshot(container);
  const animations = [];

  after.forEach(({ el, rect }, key) => {
    const prev = before.get(key);
    if (!prev) {
      el.classList.add('morph-enter');
      el.addEventListener('animationend', () => el.classList.remove('morph-enter'), { once: true });
      return;
    }
    const dx = prev.rect.left - rect.left;
    const dy = prev.rect.top - rect.top;
    const sx = prev.rect.width / Math.max(1, rect.width);
    const sy = prev.rect.height / Math.max(1, rect.height);
    if (!dx && !dy && sx === 1 && sy === 1) return;
    animations.push(el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: 'top left' },
       { transform: 'none', transformOrigin: 'top left' }],
      { duration, easing }
    ).finished);
  });

  /* Guard: in a hidden/throttled document WAAPI promises may never settle;
     the mutation is already applied, so resolving on a timeout is safe. */
  await Promise.race([
    Promise.allSettled(animations),
    new Promise(resolve => setTimeout(resolve, duration + 800)),
  ]);
}

export async function viewMorph(mutate, options = {}) {
  if (typeof mutate !== 'function') return;
  if (reduced() || exporting() || !document.startViewTransition) { await mutate(); return; }
  if (options.names) {
    Object.entries(options.names).forEach(([selector, name]) => {
      document.querySelectorAll(selector).forEach(el => { el.style.viewTransitionName = name; });
    });
  }
  const transition = document.startViewTransition(() => mutate());
  await transition.finished.catch(() => {});
}
