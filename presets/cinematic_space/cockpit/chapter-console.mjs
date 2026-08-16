/* chapter-console.mjs — güvertedeki bölüm seçim paneli (plan §8-9).

   Veri güdümlü: 2–4 bölüm, mount seçeneklerinden gelir; hiçbir bölüm adı
   koda gömülü değildir. Panel DOM'dur ve bunu SAKLAMAYIZ — gerçek <button>
   odak/klavye/ekran okuyucu davranışını bedavaya getirir; "gömme alet
   paneli" görünümü CSS'in işidir, erişilebilirlikten çalınmaz.

   Görsel dil: gömme (recessed) pano, kısık LED durum ışıkları, tek aksan
   rengi, KISITLI mikro-etkileşim (aydınlanma + 1 mm derinlik). Neon yok,
   anlamsız telemetri yok. Seçimde iki aşamalı "arm → execute": yanlış
   dokunuş bir şey fırlatmaz, ikinci dokunuş onaydır (gerçek panel
   disiplini) — Escape ya da odak kaybı arm'ı düşürür. */

export function buildChapterConsole(host, { chapters, onSelect }) {
  const el = document.createElement('nav');
  el.className = 'cine-konsol';
  el.setAttribute('aria-label', 'Görev bölümleri');
  el.innerHTML = `
    <style>
      .cine-konsol { position: absolute; left: 50%; bottom: 6.5%;
        transform: translateX(-50%) translateY(14px); width: min(46%, 560px);
        background: linear-gradient(180deg, #0c1018, #090c13);
        border: 1px solid #1b2333; border-radius: 12px;
        box-shadow: inset 0 1px 0 #ffffff0e, inset 0 -8px 18px #00000066, 0 6px 24px #000000aa;
        padding: 10px 12px 12px; z-index: 6;
        opacity: 0; pointer-events: none;
        transition: opacity .5s ease, transform .5s ease; }
      .cine-konsol.acik { opacity: 1; pointer-events: auto;
        transform: translateX(-50%) translateY(0); }
      .cine-konsol h3 { margin: 0 0 8px; font: 600 10.5px/1 ui-sans-serif, system-ui;
        letter-spacing: .34em; color: #7d8aa6; text-transform: uppercase; }
      .cine-konsol h3 small { float: right; letter-spacing: .1em; color: #55617a; }
      .cine-konsol ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
      .cine-konsol button { display: grid; grid-template-columns: 14px 1fr auto;
        align-items: center; gap: 10px; width: 100%; text-align: left;
        background: #0e1420; color: #c7d0e2; border: 1px solid #1d2739;
        border-radius: 8px; padding: 9px 12px; font: 500 14px/1.3 ui-sans-serif, system-ui;
        cursor: pointer; transition: background .18s, border-color .18s, transform .18s; }
      .cine-konsol button .led { width: 7px; height: 7px; border-radius: 50%;
        background: #2c3952; box-shadow: 0 0 0 2px #00000055; }
      .cine-konsol button .alt { display: block; font-size: 11.5px; color: #6d7890; }
      .cine-konsol button .ok { font-size: 12px; color: #55617a; letter-spacing: .12em; }
      .cine-konsol button:hover:not([disabled]) { background: #131b2b; border-color: #2b3a56;
        transform: translateY(-1px); }
      .cine-konsol button:hover:not([disabled]) .led { background: #c9a35c; }
      .cine-konsol button:focus-visible { outline: 2px solid #5f9ee0; outline-offset: 1px; }
      .cine-konsol button[data-arm] { border-color: #c9a35c; background: #191c14; }
      .cine-konsol button[data-arm] .led { background: #c9a35c; box-shadow: 0 0 6px #c9a35c88; }
      .cine-konsol button[data-arm] .ok::after { content: ' — ONAYLA'; color: #c9a35c; }
      .cine-konsol button[disabled] { opacity: .45; cursor: not-allowed; }
      @media (prefers-reduced-motion: reduce) {
        .cine-konsol, .cine-konsol button { transition: none; }
      }
    </style>
    <h3>Görev Bölümleri <small>↑↓ · Enter</small></h3>
    <ul></ul>`;
  const list = el.querySelector('ul');

  const buttons = chapters.map((chapter, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = chapter.id;
    if (chapter.disabled) { button.disabled = true; button.title = chapter.disabledNote || 'Hazırlanıyor'; }
    button.innerHTML = `<span class="led" aria-hidden="true"></span>
      <span>${chapter.label}${chapter.sublabel ? `<span class="alt">${chapter.sublabel}</span>` : ''}</span>
      <span class="ok" aria-hidden="true">SEÇ</span>`;
    /* roving tabindex: panel içine tek Tab durağı, içeride oklar gezer */
    button.tabIndex = index === 0 ? 0 : -1;
    li.appendChild(button);
    list.appendChild(li);
    return button;
  });

  let armli = null;
  const disarm = () => { if (armli) { delete armli.dataset.arm; armli = null; } };
  const secim = button => {
    if (button.disabled) return;
    if (armli !== button) { disarm(); armli = button; button.dataset.arm = '1'; return; }
    disarm();
    onSelect(button.dataset.id);
  };

  list.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) secim(button);
  });
  el.addEventListener('keydown', event => {
    const at = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();                            // deste çalıştırıcısına sızmasın
      const next = at < 0 ? 0
        : (at + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons.forEach((b, i) => { b.tabIndex = i === next ? 0 : -1; });
      buttons[next].focus();
    } else if (event.key === 'Escape' && armli) {
      event.stopPropagation();
      disarm();
    }
  });
  el.addEventListener('focusout', event => {
    if (!el.contains(event.relatedTarget)) disarm();
  });

  host.appendChild(el);
  return {
    el,
    setVisible(visible) { el.classList.toggle('acik', Boolean(visible)); if (!visible) disarm(); },
    focus() { (buttons.find(b => !b.disabled) || buttons[0])?.focus(); },
    dispose() { el.remove(); },
  };
}
