/* Figür işaretleme preset'i — bilimsel bir görselin (fotoğraf, plot, şema)
   üzerinde ADIM ADIM anlatım: kutu/daire/ok işaretleri, bölge dışını
   karartan spot ışığı, büyüteç merceği ve her adımda değişen bir iddia
   satırı. Ok tuşlarıyla gezilir (data-owns-arrows), export son adımı basar.

   const fig = mountFigureStory(container, {
     src: 'image.png' | { html: '<svg .../>' },
     alt: 'figür açıklaması',
     steps: [{
       caption: 'Kenar halkası burada kırılıyor',   // iddia taşır (assertion!)
       box:    { x, y, w, h },        // yüzde koordinat (0-100)
       circle: { x, y, r },
       arrow:  { x1, y1, x2, y2 },
       lens:   { x, y, r, zoom: 2.2 },// büyüteç (src görsellerde)
       dim: true,                     // bölge dışını karart
     }],
     exportStep: 2,                   // varsayılan: son adım
   });
   fig.next(); fig.prev(); fig.goTo(i); fig.dispose(); */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exportMode = () =>
  document.documentElement.dataset.export === 'true'
  || new URLSearchParams(location.search).get('export') === '1';

export function mountFigureStory(container, spec) {
  if (!container) throw new Error('mountFigureStory requires a container');
  const steps = spec.steps || [];
  const instant = exportMode() || reducedMotion();

  const root = document.createElement('figure');
  root.className = 'fig-story';
  root.tabIndex = 0;
  root.dataset.ownsArrows = '';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', spec.alt || 'işaretlemeli figür');
  root.innerHTML = `
    <div class="fig-story__stage"></div>
    <figcaption class="fig-story__bar">
      <span class="fig-story__caption" aria-live="polite"></span>
      <span class="fig-story__dots"></span>
    </figcaption>`;
  container.appendChild(root);

  if (!document.getElementById('fig-story-style')) {
    const style = document.createElement('style');
    style.id = 'fig-story-style';
    style.textContent = `
      .fig-story { margin: 0; outline: none; }
      .fig-story__stage { position: relative; overflow: hidden; border-radius: 8px; }
      .fig-story__stage img, .fig-story__stage svg { display: block; width: 100%; height: auto; }
      .fig-story__overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
      .fig-story__mark { fill: none; stroke: var(--color-accent, #E8804A); stroke-width: .55;
        vector-effect: non-scaling-stroke; stroke-width: 3px; }
      .fig-story__mark--arrow { marker-end: url(#figArrowHead); }
      .fig-story__scrim path { fill: rgba(8, 8, 12, .52); fill-rule: evenodd; }
      .fig-story__lens { position: absolute; border-radius: 50%; pointer-events: none;
        border: 3px solid var(--color-accent, #E8804A); box-shadow: 0 10px 30px rgba(0,0,0,.35);
        background-repeat: no-repeat; }
      .fig-story__bar { display: flex; align-items: center; justify-content: space-between;
        gap: 16px; padding: 12px 4px 0; }
      .fig-story__caption { font-size: 19px; color: var(--color-ink, #222); min-height: 1.4em; }
      .fig-story__dots { display: flex; gap: 7px; }
      .fig-story__dot { width: 9px; height: 9px; border-radius: 50%; border: none; padding: 0;
        background: var(--color-rule, #bbb); cursor: pointer; }
      .fig-story__dot[aria-current="true"] { background: var(--color-accent, #E8804A); }
      .fig-story--animate .fig-story__mark { transition: opacity .3s ease; }
      .fig-story--animate .fig-story__mark--trace {
        stroke-dasharray: var(--len); stroke-dashoffset: var(--len);
        transition: stroke-dashoffset .7s cubic-bezier(.4,0,.2,1), opacity .2s ease; }
      .fig-story--animate .fig-story__mark--trace.is-on { stroke-dashoffset: 0; }
      .fig-story--animate .fig-story__scrim path { transition: d .001s; }
      .fig-story--animate .fig-story__scrim { transition: opacity .45s ease; }
      .fig-story--animate .fig-story__lens { transition: opacity .4s ease, transform .5s cubic-bezier(.34,1.3,.4,1); }
      .fig-story--animate .fig-story__caption { transition: opacity .3s ease; }`;
    document.head.appendChild(style);
  }
  if (!instant) root.classList.add('fig-story--animate');

  const stage = root.querySelector('.fig-story__stage');
  const captionEl = root.querySelector('.fig-story__caption');
  const dotsEl = root.querySelector('.fig-story__dots');

  /* görsel */
  let imgSrc = null;
  if (typeof spec.src === 'string') {
    const img = document.createElement('img');
    img.src = spec.src; img.alt = spec.alt || '';
    stage.appendChild(img);
    imgSrc = spec.src;
  } else if (spec.src && spec.src.html) {
    stage.insertAdjacentHTML('afterbegin', spec.src.html);
  }

  /* işaret katmanı: yüzde koordinat sistemi (0-100), oran korunmaz —
     işaretler görselin ÜZERİNDEKİ konuma yüzdeyle çakılır */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(SVGNS, 'svg');
  overlay.setAttribute('class', 'fig-story__overlay');
  overlay.setAttribute('viewBox', '0 0 100 100');
  overlay.setAttribute('preserveAspectRatio', 'none');
  overlay.innerHTML = `
    <defs><marker id="figArrowHead" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--color-accent, #E8804A)"/></marker></defs>
    <g class="fig-story__scrim" style="opacity:0"><path d=""/></g>
    <g class="fig-story__marks"></g>`;
  stage.appendChild(overlay);
  const scrimG = overlay.querySelector('.fig-story__scrim');
  const scrimPath = scrimG.querySelector('path');
  const marksG = overlay.querySelector('.fig-story__marks');

  const lens = document.createElement('div');
  lens.className = 'fig-story__lens';
  lens.style.opacity = '0';
  stage.appendChild(lens);

  /* adım işaretlerini önceden kur (adım başına bir grup) */
  const stepGroups = steps.map(step => {
    const g = document.createElementNS(SVGNS, 'g');
    g.style.opacity = '0';
    const mk = (name, attrs, trace) => {
      const n = document.createElementNS(SVGNS, name);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      n.classList.add('fig-story__mark');
      if (trace) n.classList.add('fig-story__mark--trace');
      g.appendChild(n);
      return n;
    };
    if (step.box) mk('rect', { x: step.box.x, y: step.box.y, width: step.box.w, height: step.box.h, rx: 1.2 }, true);
    if (step.circle) mk('circle', { cx: step.circle.x, cy: step.circle.y, r: step.circle.r }, true);
    if (step.arrow) {
      const a = mk('line', { x1: step.arrow.x1, y1: step.arrow.y1, x2: step.arrow.x2, y2: step.arrow.y2 }, true);
      a.classList.add('fig-story__mark--arrow');
    }
    marksG.appendChild(g);
    return g;
  });
  /* iz uzunlukları (yüzde uzayında yaklaşık; sadece animasyon için) */
  for (const g of stepGroups) {
    for (const n of g.querySelectorAll('.fig-story__mark--trace')) {
      let len = 300;
      try { len = Math.ceil(n.getTotalLength()); } catch (e) {}
      n.style.setProperty('--len', len);
    }
  }

  /* noktalar */
  steps.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'fig-story__dot';
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
    stepGroups.forEach((g, gi) => {
      g.style.opacity = gi === i ? '1' : '0';
      g.querySelectorAll('.fig-story__mark--trace').forEach(n =>
        n.classList.toggle('is-on', gi === i));
    });
    /* spot ışığı: dışarısı kararır, bölge açık kalır (evenodd delik) */
    if (step.dim && (step.box || step.circle)) {
      const hole = step.box
        ? `M${step.box.x},${step.box.y} h${step.box.w} v${step.box.h} h${-step.box.w} z`
        : `M${step.circle.cx ?? step.circle.x - step.circle.r},${step.circle.y}
           a${step.circle.r},${step.circle.r} 0 1,0 ${step.circle.r * 2},0
           a${step.circle.r},${step.circle.r} 0 1,0 ${-step.circle.r * 2},0`;
      scrimPath.setAttribute('d', `M0,0 H100 V100 H0 z ${hole}`);
      scrimG.style.opacity = '1';
    } else scrimG.style.opacity = '0';
    /* büyüteç */
    if (step.lens && imgSrc) {
      const { x, y, r, zoom = 2 } = step.lens;
      const rect = stage.getBoundingClientRect();
      const px = rect.width * x / 100, py = rect.height * y / 100;
      const pr = rect.width * r / 100;
      lens.style.width = lens.style.height = `${pr * 2}px`;
      lens.style.left = `${px - pr}px`;
      lens.style.top = `${py - pr}px`;
      lens.style.backgroundImage = `url("${imgSrc}")`;
      lens.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
      lens.style.backgroundPosition = `${-(px * zoom - pr)}px ${-(py * zoom - pr)}px`;
      lens.style.opacity = '1';
      lens.style.transform = 'scale(1)';
    } else { lens.style.opacity = '0'; lens.style.transform = 'scale(.7)'; }
    captionEl.textContent = step.caption || '';
    dotsEl.querySelectorAll('.fig-story__dot').forEach((d, di) =>
      d.setAttribute('aria-current', String(di === i)));
  };

  const onKey = event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
  };
  root.addEventListener('keydown', onKey);

  goTo(instant ? (spec.exportStep ?? steps.length - 1) : 0);

  return {
    figure: root,
    next: () => goTo(current + 1),
    prev: () => goTo(current - 1),
    goTo,
    get step() { return current; },
    dispose: () => { root.removeEventListener('keydown', onKey); root.remove(); },
  };
}
