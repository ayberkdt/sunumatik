/* ml_attention_flow — transformer dikkatini GERÇEK hesapla gösteren
   2D SVG sahnesi (three.js yok).

   Doğruluk düzeyi: ANALİTİK. Yaylar softmax(QKᵀ/√d) formülünün gerçek
   çıktısını gösterir; Q = X·Wq, K = X·Wk. Gömme ve ağırlık matrisleri
   attention-data.mjs içinde tohumlu PRNG ile bir kez üretilmiş sabit
   LİTERALLERDİR — eğitilmiş bir model değildir, bunu söyleyen rozet
   görünür kalmalıdır. Her softmax satırının 1'e toplandığı çalışma
   zamanında console.assert ile doğrulanır.

   Sahne anatomisi:
   - jeton şeridi: yuvarlatılmış çipler (surface/rule/ink), sorgu çipinde
     vurgu (accent) halkası;
   - dikkat yayları: sorgu çipinden her anahtar çipe kübik Bézier;
     kalınlık (1–7 px) VE opaklık (.15–.95) ağırlığı birlikte kodlar;
     pathLength ile iz-çizimi, güçlüden zayıfa 70 ms kademe;
   - top-1 yayında TEK atımlık gezici nokta (döngü yok);
   - ağırlık okuması: her anahtar çipin üstünde 2 ondalıklı tabular sayı;
   - katman geçişi: katman 1 çıktısı (ağırlıklı karışım + artık bağlantı,
     RMS sabitleme) yeni gömme olur — çipler kısa bir karışım parıltısıyla
     (opaklık çapraz geçişi) morf eder, yaylar yeniden hesaplanır.

   API: mountAttentionFlow(host, options) →
        { play, pause, restart, step, setLayer, setHead, setQuery, dispose }
   setLayer/setHead 1 tabanlı (Katman 1/2, Kafa 1/2); setQuery 0 tabanlı
   jeton dizinidir. Azaltılmış hareket / dışa aktarım: varsayılan sorgunun
   yayları tam çizili, ağırlıklar görünür, nokta atımı yok. */

import { TOKENS, EMB, LAYERS, D_HEAD } from './attention-data.mjs';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const exporting = () => document.documentElement.dataset.export === 'true';

/* ---------- model: gerçek, deterministik hesap ---------- */

const matmul = (A, B) => A.map(row =>
  B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));

function softmaxRow(row) {
  const m = Math.max(...row);
  const exps = row.map(v => Math.exp(v - m));
  const total = exps.reduce((a, b) => a + b, 0);
  const out = exps.map(v => v / total);
  const sum = out.reduce((a, b) => a + b, 0);
  console.assert(Math.abs(sum - 1) < 1e-6, 'softmax satırı 1 toplamıyor:', sum);
  return out;
}

/* Katman girdileri: X[0] = sabit gömme; X[1] = katman 1 çıktısı —
   iki kafanın dikkat-ağırlıklı karışımının ortalaması + artık bağlantı,
   ardından satır RMS'i sabitlenir (LayerNorm'un kaba karşılığı; skor
   ölçeği katmanlar arasında karşılaştırılabilir kalsın diye). */
const inputCache = [EMB, null];

function layerInput(l) {
  if (inputCache[l]) return inputCache[l];
  const X = layerInput(l - 1);
  const heads = LAYERS[l - 1].map(head => rawAttention(X, head));
  const mixed = X.map((row, i) => row.map((v, d) => {
    let acc = 0;
    for (const A of heads) {
      for (let j = 0; j < X.length; j++) acc += A[i][j] * X[j][d];
    }
    return v + acc / heads.length; // ortalama karışım + artık bağlantı
  }));
  const target = Math.sqrt(1 / 3); // gömme satırlarının tipik RMS'i
  inputCache[l] = mixed.map(row => {
    const rms = Math.sqrt(row.reduce((s, v) => s + v * v, 0) / row.length) || 1;
    return row.map(v => v * target / rms);
  });
  return inputCache[l];
}

function rawAttention(X, { wq, wk }) {
  const Q = matmul(X, wq);
  const K = matmul(X, wk);
  return Q.map(q => softmaxRow(K.map(k =>
    q.reduce((s, v, i) => s + v * k[i], 0) / Math.sqrt(D_HEAD))));
}

const attnCache = new Map();

/* Dikkat matrisi (8×8). layer/head 1 tabanlı — slayt metniyle aynı dil. */
export function attentionFor(layer = 1, head = 1) {
  const key = `${layer}:${head}`;
  if (!attnCache.has(key)) {
    attnCache.set(key, rawAttention(layerInput(layer - 1), LAYERS[layer - 1][head - 1]));
  }
  return attnCache.get(key);
}

export { TOKENS };

/* ---------- SVG yardımcıları ---------- */

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------- sahne ---------- */

export function mountAttentionFlow(host, options = {}) {
  if (!host) throw new Error('mountAttentionFlow bir kap elementi ister');

  const N = TOKENS.length;
  let layer = Math.min(2, Math.max(1, options.layer ?? 1));
  let head = Math.min(2, Math.max(1, options.head ?? 1));
  let query = Math.min(N - 1, Math.max(0, options.query ?? 0));
  let active = options.active !== false;
  let playing = false;
  let disposed = false;

  const isStatic = () => reduced() || exporting();

  host.classList.add('afp');
  host.dataset.ownsArrows = ''; // deste gezinimi ok tuşlarını sahneye bıraksın

  /* Durum satırı: görünür + aria-live — sorgu değişince Türkçe özet okur */
  const status = document.createElement('p');
  status.className = 'afp-status';
  status.setAttribute('aria-live', 'polite');
  host.appendChild(status);

  /* Ölçüler viewBox biriminde — CSS transform'lu .slide içinde de aynı */
  const CHIP_H = 50;
  const CHIP_TOP = 232;
  const VIEW_H = CHIP_TOP + CHIP_H + 8;
  const GAP = 26;
  const PAD_X = 26;

  const svg = svgEl('svg', {
    role: 'img',
    'aria-label': 'Dikkat akışı: 8 jetonluk cümle üzerinde sorgu jetonundan ' +
      'anahtar jetonlara giden yaylar; yay kalınlığı ve opaklığı softmax ' +
      'dikkat ağırlığını gösterir.',
  });
  const gArcs = svgEl('g', { class: 'afp-arcs' });
  const gWeights = svgEl('g', { class: 'afp-weights' });
  const gChips = svgEl('g', { class: 'afp-chips' });
  const gDot = svgEl('g', { class: 'afp-dot-layer' });
  svg.append(gArcs, gWeights, gChips, gDot);
  host.appendChild(svg);

  /* --- çipler: önce metinleri koy, ölç, sonra yerleştir --- */
  const chips = TOKENS.map((tok, i) => {
    const g = svgEl('g', {
      class: 'afp-chip',
      role: 'button',
      tabindex: '0',
      'aria-label': `'${tok}' jetonunu sorgu yap`,
    });
    g.style.setProperty('--chip-i', i);
    const box = svgEl('rect', { class: 'afp-chip-box', rx: 12, ry: 12, height: CHIP_H });
    const mix = svgEl('rect', { class: 'afp-chip-mix', rx: 12, ry: 12, height: CHIP_H });
    const ring = svgEl('rect', { class: 'afp-chip-ring', rx: 15, ry: 15, height: CHIP_H + 10, y: -5 });
    const text = svgEl('text', { class: 'afp-chip-text', y: CHIP_H / 2 + 6, 'text-anchor': 'middle' });
    text.textContent = tok;
    g.append(box, mix, ring, text);
    gChips.appendChild(g);
    return { g, box, mix, ring, text, tok, x: 0, w: 0, cx: 0 };
  });

  /* Metin genişliği: yerleşik ölçüm; gizli bölmede 0 dönerse kestirim */
  const measure = chip => {
    let len = 0;
    try { len = chip.text.getComputedTextLength(); } catch { /* ölçülemedi */ }
    if (!len || !isFinite(len)) len = 12 + chip.tok.length * 10.4;
    return len;
  };

  let viewW = 900;
  const layout = () => {
    const widths = chips.map(c => Math.max(46, measure(c) + 34));
    const total = widths.reduce((a, b) => a + b, 0) + GAP * (N - 1);
    viewW = Math.max(total + PAD_X * 2, 900);
    let x = (viewW - total) / 2;
    chips.forEach((chip, i) => {
      chip.x = x; chip.w = widths[i]; chip.cx = x + widths[i] / 2;
      chip.g.setAttribute('transform', `translate(${x.toFixed(1)} ${CHIP_TOP})`);
      chip.box.setAttribute('width', widths[i].toFixed(1));
      chip.mix.setAttribute('width', widths[i].toFixed(1));
      chip.ring.setAttribute('width', (widths[i] + 10).toFixed(1));
      chip.ring.setAttribute('x', -5);
      chip.text.setAttribute('x', (widths[i] / 2).toFixed(1));
      x += widths[i] + GAP;
    });
    svg.setAttribute('viewBox', `0 0 ${Math.ceil(viewW)} ${VIEW_H}`);
  };

  /* --- yaylar + ağırlık okumaları: anahtar başına bir kez, sonra güncelle --- */
  const arcs = chips.map(() => {
    const p = svgEl('path', { class: 'afp-arc', pathLength: '1', fill: 'none' });
    gArcs.appendChild(p);
    return p;
  });
  const labels = chips.map(() => {
    const t = svgEl('text', { class: 'afp-weight', 'text-anchor': 'middle', y: CHIP_TOP - 13 });
    gWeights.appendChild(t);
    return t;
  });
  const dot = svgEl('circle', { class: 'afp-dot', r: 3.5 });
  gDot.appendChild(dot);

  const arcPath = (qi, ki) => {
    const a = chips[qi], b = chips[ki];
    if (qi === ki) {
      // öz-dikkat: çipin üstünde küçük ilmek (ağırlık okuması ilmeğin içine girer)
      const c = a.cx;
      return `M ${(c - 18).toFixed(1)} ${CHIP_TOP} C ${(c - 34).toFixed(1)} ${CHIP_TOP - 70}, ` +
        `${(c + 34).toFixed(1)} ${CHIP_TOP - 70}, ${(c + 18).toFixed(1)} ${CHIP_TOP}`;
    }
    const dx = b.cx - a.cx;
    const dist = Math.abs(dx);
    // karekök ölçek: uzak yaylar yükselir ama tavana yapışıp ÜST ÜSTE BİNMEZ
    // (doğrusal+kelepçe en uzun üç yayı aynı düzlüğe yığıyordu)
    const span = Math.max(1, chips[N - 1].cx - chips[0].cx);
    const h = 54 + 176 * Math.sqrt(dist / span);
    // kontrol noktaları içeri çekilir: yaylar kökten AÇIYLA ayrılır —
    // sorgu çipinin üstünde dikey demet sütunu oluşmaz, ilmek görünür kalır
    const c1x = a.cx + dx * .24;
    const c2x = b.cx - dx * .24;
    return `M ${a.cx.toFixed(1)} ${CHIP_TOP} C ${c1x.toFixed(1)} ${(CHIP_TOP - h).toFixed(1)}, ` +
      `${c2x.toFixed(1)} ${(CHIP_TOP - h).toFixed(1)}, ${b.cx.toFixed(1)} ${CHIP_TOP}`;
  };

  const widthFor = w => 1 + 6 * w;          // 1–7 px
  const opacityFor = w => .15 + .8 * w;     // .15–.95

  /* --- zamanlayıcı temizliği --- */
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };
  const clearTimers = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
  let dotRaf = 0;
  const stopDot = () => {
    if (dotRaf) cancelAnimationFrame(dotRaf);
    dotRaf = 0;
    dot.style.opacity = '0';
  };

  /* --- top-1 yayında tek atımlık gezici nokta (döngü DEĞİL) --- */
  const runDot = path => {
    stopDot();
    const len = path.getTotalLength();
    if (!len) return;
    const dur = 1150;
    let start = 0;
    const frame = now => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / dur);
      const pt = path.getPointAtLength(easeInOut(t) * len);
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      // zarf: yumuşak atak, daha uzun sönüş — hiçbir şey tam güçte doğmaz/ölmez
      const env = Math.min(1, t / .18) * Math.min(1, (1 - t) / .3);
      dot.style.opacity = (env * .95).toFixed(3);
      dot.setAttribute('r', (2.6 + env * 1.6).toFixed(2));
      if (t < 1) dotRaf = requestAnimationFrame(frame);
      else stopDot();
    };
    dotRaf = requestAnimationFrame(frame);
  };

  /* --- sözlü özet (aria-live) --- */
  const announce = () => {
    const row = attentionFor(layer, head)[query];
    const ranked = row.map((w, j) => [w, j]).sort((a, b) => b[0] - a[0]);
    const [topW, topJ] = ranked[0];
    const top3 = Math.round(ranked.slice(0, 3).reduce((s, [w]) => s + w, 0) * 100);
    const hedef = topJ === query ? 'kendine' : `'${TOKENS[topJ]}' anahtarına`;
    status.textContent =
      `Katman ${layer}, Kafa ${head} — '${TOKENS[query]}' en çok ${hedef} ` +
      `bakıyor (%${Math.round(topW * 100)}); ilk 3 anahtar toplam %${top3}.`;
  };

  /* --- durum boyama --- */
  const paintQueryChip = () => {
    chips.forEach((chip, i) => chip.g.classList.toggle('is-query', i === query));
  };

  /* Son durumu geçişsiz bas: azaltılmış hareket, dışa aktarım, pasif slayt */
  const renderFinal = () => {
    clearTimers(); stopDot();
    host.classList.add('is-instant');
    const row = attentionFor(layer, head)[query];
    chips.forEach((_, k) => {
      const p = arcs[k];
      p.setAttribute('d', arcPath(query, k));
      p.style.transitionDelay = '0ms';
      p.style.strokeWidth = widthFor(row[k]).toFixed(2);
      p.style.strokeDasharray = '1';
      p.style.strokeDashoffset = '0';
      p.style.opacity = opacityFor(row[k]).toFixed(3);
      const t = labels[k];
      t.setAttribute('x', chips[k].cx.toFixed(1));
      t.setAttribute('y', k === query ? CHIP_TOP - 34 : CHIP_TOP - 13);
      t.textContent = row[k].toFixed(2);
      t.style.transitionDelay = '0ms';
      t.classList.add('is-on');
    });
    paintQueryChip();
    announce();
    // sınıfı bir kare sonra kaldır ki sonraki etkileşimler yine aksın
    requestAnimationFrame(() => host.classList.remove('is-instant'));
  };

  /* Kademeli açılış: güçlüden zayıfa iz-çizimi + ağırlıkların belirişi */
  const reveal = () => {
    if (isStatic()) { renderFinal(); return; }
    const row = attentionFor(layer, head)[query];
    const rankOf = new Array(N);
    row.map((w, j) => [w, j]).sort((a, b) => b[0] - a[0])
      .forEach(([, j], rank) => { rankOf[j] = rank; });

    host.classList.remove('is-retracting');
    chips.forEach((_, k) => {
      const p = arcs[k];
      p.style.transition = 'none';
      p.setAttribute('d', arcPath(query, k));
      p.style.strokeWidth = widthFor(row[k]).toFixed(2);
      p.style.strokeDasharray = '1';
      p.style.strokeDashoffset = '1';
      p.style.opacity = '0';
      const t = labels[k];
      t.classList.remove('is-on');
      t.style.transition = 'none';
      t.setAttribute('x', chips[k].cx.toFixed(1));
      t.setAttribute('y', k === query ? CHIP_TOP - 34 : CHIP_TOP - 13);
      t.textContent = row[k].toFixed(2);
    });
    void svg.getBoundingClientRect(); // başlangıç durumunu sabitle
    chips.forEach((_, k) => {
      const d = rankOf[k] * 70; // kademe: en güçlü önce
      const p = arcs[k];
      p.style.transition = '';
      p.style.transitionDelay = `${d}ms`;
      p.style.strokeDashoffset = '0';
      p.style.opacity = opacityFor(row[k]).toFixed(3);
      const t = labels[k];
      t.style.transition = '';
      t.style.transitionDelay = `${d + 240}ms`;
      t.classList.add('is-on');
    });
    paintQueryChip();
    announce();
    // top-1 yayı çizimini bitirince nokta bir kez süzülür
    const topKey = rankOf.indexOf(0);
    later(() => runDot(arcs[topKey]), 690);
    // Yerleşme bekçisi: gizli bölme/başsız kipte kare üretimi durursa CSS
    // geçişleri yarı yolda DONAR (satır içi hedef değerler zaten sondadır) —
    // toplam süre geçince geçişler bir karelik kapatılıp son durum basılır.
    // Canlı sekmede görsel fark yaratmaz; her etkileşim bekçiyi iptal eder.
    later(() => {
      stopDot();
      host.classList.add('is-instant');
      void svg.getBoundingClientRect();
      requestAnimationFrame(() => host.classList.remove('is-instant'));
    }, 2050);
  };

  /* Hızlı geri sarma (ters iz), sonra devam eden adım */
  const retract = done => {
    if (isStatic()) { done(); return; }
    stopDot();
    const row = attentionFor(layer, head)[query];
    const rankOf = new Array(N);
    row.map((w, j) => [w, j]).sort((a, b) => b[0] - a[0])
      .forEach(([, j], rank) => { rankOf[j] = rank; });
    host.classList.add('is-retracting');
    chips.forEach((_, k) => {
      const d = (N - 1 - rankOf[k]) * 24; // son beliren önce çekilir
      const p = arcs[k];
      p.style.transitionDelay = `${d}ms`;
      p.style.strokeDashoffset = '1';
      p.style.opacity = '0';
      const t = labels[k];
      t.style.transitionDelay = `${Math.round(d * .5)}ms`;
      t.classList.remove('is-on');
    });
    later(() => { host.classList.remove('is-retracting'); done(); }, 240 + (N - 1) * 24 + 40);
  };

  /* Katman geçişi: çipler karışım parıltısıyla morf eder (katman 1 çıktısı
     yeni gömme olur), ardından yaylar yeni matrisle yeniden açılır */
  const morphChips = done => {
    if (isStatic()) { done(); return; }
    chips.forEach(chip => chip.g.classList.add('is-mixing'));
    later(() => {
      chips.forEach(chip => chip.g.classList.remove('is-mixing'));
      done();
    }, 640 + (N - 1) * 45 + 40);
  };

  /* --- API --- */
  let autoTimer = 0;
  const scheduleAuto = () => {
    autoTimer = later(() => { if (playing) stepInternal(); }, options.dwellMs ?? 2600);
  };
  const stepInternal = () => {
    setQuery((query + 1) % N);
    if (playing) scheduleAuto();
  };

  function setQuery(i) {
    const next = Math.min(N - 1, Math.max(0, i));
    if (next === query) return;
    clearTimers();
    if (playing) scheduleAuto();
    retract(() => { query = next; reveal(); });
  }

  function setLayer(n) {
    const next = Math.min(2, Math.max(1, n));
    if (next === layer) return;
    clearTimers();
    if (playing) scheduleAuto();
    retract(() => {
      layer = next;
      morphChips(() => reveal());
    });
  }

  function setHead(n) {
    const next = Math.min(2, Math.max(1, n));
    if (next === head) return;
    clearTimers();
    if (playing) scheduleAuto();
    retract(() => { head = next; reveal(); });
  }

  const play = () => {
    if (playing || isStatic()) return;
    playing = true;
    host.classList.add('is-playing');
    scheduleAuto();
  };
  const pause = () => {
    playing = false;
    host.classList.remove('is-playing');
    if (autoTimer) { clearTimeout(autoTimer); timers.delete(autoTimer); autoTimer = 0; }
  };
  const restart = () => {
    pause();
    clearTimers();
    layer = Math.min(2, Math.max(1, options.layer ?? 1));
    head = Math.min(2, Math.max(1, options.head ?? 1));
    retract(() => { query = Math.min(N - 1, Math.max(0, options.query ?? 0)); reveal(); });
  };

  /* --- etkileşim --- */
  chips.forEach((chip, i) => {
    chip.g.addEventListener('click', () => setQuery(i));
    chip.g.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setQuery(i);
      }
    });
  });
  const onKey = event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); setQuery((query + 1) % N); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); setQuery((query + N - 1) % N); }
  };
  host.addEventListener('keydown', onKey);

  /* Sekme gizlenince otomatik akış durur — performans sözleşmesi */
  const onVisibility = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVisibility);

  /* --- kuruluş --- */
  layout();
  if (active && !isStatic()) reveal();
  else renderFinal();

  return {
    play,
    pause,
    restart,
    step: () => { pause(); stepInternal(); },
    setLayer,
    setHead,
    setQuery,
    get state() { return { layer, head, query, playing }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      clearTimers();
      stopDot();
      host.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      host.classList.remove('afp', 'is-playing', 'is-retracting', 'is-instant');
      delete host.dataset.ownsArrows;
      status.remove();
      svg.remove();
    },
  };
}
