/* Denklem adımlayıcı — dizgilenmiş bir denklemin TERİMLERİNİ adım adım
   anlatır: her adımda odaktaki terimler vurgulanır (alt çizgi süpürmesi +
   tam opaklık), kalanlar hayalete döner, iddia satırı değişir. Türetme
   anlatmanın "hepsi aynı anda ekranda ama sırayla konuşuluyor" hâli.

   Denklem HTML'i terimlerini data-term ile işaretler:
     <span class="eq" data-term="lhs">∂P̄ₙₘ/∂φ</span> =
     <span class="eq" data-term="rec">aₙₘ · P̄ₙ,ₘ₊₁</span> ...

   const eq = mountEquationSteps(container, {
     equation: '<div class="eqbox">...data-term işaretli HTML...</div>',
     steps: [
       { focus: ['lhs'], caption: 'Hedef: enlem türevi — faktöriyelsiz.' },
       { focus: ['rec','shift'], caption: 'İki komşu terim yeterli.' },
     ],
     exportStep: 1,                  // varsayılan: son adım
   });
   eq.next(); eq.prev(); eq.goTo(i); eq.dispose(); */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exportMode = () =>
  document.documentElement.dataset.export === 'true'
  || new URLSearchParams(location.search).get('export') === '1';

export function mountEquationSteps(container, spec) {
  if (!container) throw new Error('mountEquationSteps requires a container');
  const steps = spec.steps || [];
  const instant = exportMode() || reducedMotion();

  const root = document.createElement('section');
  root.className = 'eq-steps';
  root.tabIndex = 0;
  root.dataset.ownsArrows = '';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'adım adım denklem anlatımı');
  root.innerHTML = `
    <div class="eq-steps__equation">${spec.equation || ''}</div>
    <div class="eq-steps__bar">
      <span class="eq-steps__caption" aria-live="polite"></span>
      <span class="eq-steps__dots"></span>
    </div>`;
  container.appendChild(root);

  if (!document.getElementById('eq-steps-style')) {
    const style = document.createElement('style');
    style.id = 'eq-steps-style';
    style.textContent = `
      .eq-steps { outline: none; }
      .eq-steps [data-term] { position: relative; display: inline-block;
        transition: opacity .35s ease, filter .35s ease; }
      .eq-steps [data-term]::after { content: ""; position: absolute; left: 0; right: 0;
        bottom: -6px; height: 3px; background: var(--color-accent, #E8804A);
        transform: scaleX(0); transform-origin: left center;
        transition: transform .45s cubic-bezier(.4,0,.2,1); }
      .eq-steps.has-focus [data-term]:not(.is-focus) { opacity: .28; filter: saturate(.4); }
      .eq-steps [data-term].is-focus::after { transform: scaleX(1); }
      .eq-steps--instant [data-term], .eq-steps--instant [data-term]::after { transition: none; }
      .eq-steps__bar { display: flex; align-items: center; justify-content: space-between;
        gap: 16px; padding-top: 14px; }
      .eq-steps__caption { font-size: 19px; color: var(--color-ink, #222); min-height: 1.4em; }
      .eq-steps__dots { display: flex; gap: 7px; }
      .eq-steps__dot { width: 9px; height: 9px; border-radius: 50%; border: none; padding: 0;
        background: var(--color-rule, #bbb); cursor: pointer; }
      .eq-steps__dot[aria-current="true"] { background: var(--color-accent, #E8804A); }`;
    document.head.appendChild(style);
  }
  if (instant) root.classList.add('eq-steps--instant');

  const captionEl = root.querySelector('.eq-steps__caption');
  const dotsEl = root.querySelector('.eq-steps__dots');
  const terms = [...root.querySelectorAll('[data-term]')];

  steps.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'eq-steps__dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', `adım ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
  });

  let current = -1;
  const goTo = index => {
    const i = Math.max(0, Math.min(steps.length - 1, index));
    if (i === current) return;
    current = i;
    const step = steps[i];
    const focus = new Set(step.focus || []);
    root.classList.toggle('has-focus', focus.size > 0);
    for (const t of terms) t.classList.toggle('is-focus', focus.has(t.dataset.term));
    captionEl.textContent = step.caption || '';
    dotsEl.querySelectorAll('.eq-steps__dot').forEach((d, di) =>
      d.setAttribute('aria-current', String(di === i)));
  };

  const onKey = event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
  };
  root.addEventListener('keydown', onKey);

  goTo(instant ? (spec.exportStep ?? steps.length - 1) : 0);

  return {
    root,
    next: () => goTo(current + 1),
    prev: () => goTo(current - 1),
    goTo,
    get step() { return current; },
    dispose: () => { root.removeEventListener('keydown', onKey); root.remove(); },
  };
}
