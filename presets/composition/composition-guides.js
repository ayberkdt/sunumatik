/* KOMPOZİSYON — kılavuz katmanı, yönlendiren çizgi üreteci, ölçüm katmanı
   Eş dosya: composition-guides.css   Doküman: ../references/composition.md

   DIŞA AÇILAN API
   ───────────────────────────────────────────────────────────────────────
   KOMP                          sahne sabitleri (salt okunur)
   kompHazirla()                 ?export=1 → html[data-export]; ?kilavuz=1 okur
   enableCompositionGuides(kok, s)  kılavuz bindirmesi → DENETLEYİCİ döndürür
                                    (modül düzeyinde global keydown YOK;
                                     dinleyici kaldir() ile sökülür)
   olcCompozisyon(kok, s)        SAYISAL ölçüm: kesişim uzaklıkları, optik
                                 merkez sapması, boş alan oranı, denge
   izCiz(kok, s)                 yönlendiren çizgi: iki çapa → SVG yol
   roiBagla(pencere, detay, s)   ROI penceresi ↔ detay paneli bağı (2 iz)
   ucNoktalari(kok)              4 kesişimin sahne koordinatı
   ───────────────────────────────────────────────────────────────────────
   SÖZLEŞME: deterministik, dış ağ yok. prefers-reduced-motion ve
   html[data-export="true"] → kılavuzlar GÖRÜNMEZ, izler SON KAREDE.

   TUZAK NOTU: bu dosyada her `const` kendi kullanımından ÖNCE tanımlıdır
   (geçici ölü bölge / TDZ modülü sessizce öldürür).                       */

/* ═══════════════════════════════════════════════════════════════════════
   0. SABİTLER — sahne sayıları tek kaynaktan (CSS jetonlarıyla EŞ)
   ═══════════════════════════════════════════════════════════════════════ */

export const KOMP = Object.freeze({
  en: 1920,
  boy: 1080,
  uclerX: [640, 1280],
  uclerY: [360, 720],
  /* optik merkez: geometrik merkezin %3,3 (36 px) ÜSTÜ; 504 = 63×8 */
  optik: Object.freeze({ x: 960, y: 504 }),
  geometrik: Object.freeze({ x: 960, y: 540 }),
  guvenli: Object.freeze({ x: 96, y: 72 }),
  izgara: Object.freeze({ kenar: 64, oluk: 24, sutun: 12, sutunEn: 1528 / 12 }),
  /* altın oran — YALNIZ referans katmanı için; composition.md'de neden
     üçler kuralının yeterli olduğu açıkça yazılıdır */
  phi: 1.6180339887
});

const KESISIM_ADLARI = Object.freeze({
  '640,360': 'sol-üst', '1280,360': 'sağ-üst',
  '640,720': 'sol-alt', '1280,720': 'sağ-alt'
});

const SVG_NS = 'http://www.w3.org/2000/svg';
const HUCRE = 20;                    /* boş alan ızgarası: 96 × 54 hücre */
const YAKIN_ESIK = 120;              /* kesişime "çapalı" sayılma yarıçapı */

/* ═══════════════════════════════════════════════════════════════════════
   1. ORTAK YARDIMCILAR
   ═══════════════════════════════════════════════════════════════════════ */

const azaltilmisHareket = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

const disaAktarim = () =>
  document.documentElement.dataset.export === 'true';

/* Kılavuzlar bu iki durumda ASLA görünmez (CSS'te de mühürlü) */
const kilavuzYasak = () => azaltilmisHareket() || disaAktarim();

/** ?export=1 → html[data-export="true"] damgası; ?kilavuz=1 okunur.
 *  Modül yüklenirken DEĞİL, çağrıldığında çalışır (yan etkisiz modül). */
export function kompHazirla() {
  const q = new URLSearchParams(location.search);
  if (q.get('export') === '1') document.documentElement.dataset.export = 'true';
  return {
    kilavuz: q.get('kilavuz') === '1',
    disaAktarim: disaAktarim(),
    bolum: q.get('bolum') || null
  };
}

/** Sahnenin CSS ölçeği (demo sayfaları sahneyi küçültür).
 *  offsetWidth ölçekten ETKİLENMEZ, getBoundingClientRect ETKİLENİR. */
function olcek(kok) {
  const gorunen = kok.getBoundingClientRect().width;
  const gercek = kok.offsetWidth || KOMP.en;
  return gorunen > 0 && gercek > 0 ? gorunen / gercek : 1;
}

/** Bir öğenin SAHNE koordinat sistemindeki kutusu (ölçekten arındırılmış) */
function kutu(kok, el) {
  const s = olcek(kok);
  const k = kok.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - k.left) / s,
    y: (r.top - k.top) / s,
    w: r.width / s,
    h: r.height / s
  };
}

const merkezi = k => ({ x: k.x + k.w / 2, y: k.y + k.h / 2 });
const uzaklik = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const yuvarla = (n, basamak = 1) => {
  const p = Math.pow(10, basamak);
  return Math.round(n * p) / p;
};

function alfa(renk) {
  if (!renk || renk === 'transparent') return 0;
  const m = renk.match(/rgba?\(([^)]+)\)/);
  if (!m) return 1;
  const parcalar = m[1].split(/[,\s/]+/).filter(Boolean);
  return parcalar.length > 3 ? parseFloat(parcalar[3]) : 1;
}

function svgOge(ad, ozellikler = {}) {
  const el = document.createElementNS(SVG_NS, ad);
  for (const [k, v] of Object.entries(ozellikler)) el.setAttribute(k, v);
  return el;
}

/** 4 üçler kesişiminin sahne koordinatı (ad + x + y) */
export function ucNoktalari() {
  const liste = [];
  for (const y of KOMP.uclerY)
    for (const x of KOMP.uclerX)
      liste.push({ ad: KESISIM_ADLARI[`${x},${y}`], x, y });
  return liste;
}

/* ═══════════════════════════════════════════════════════════════════════
   2. ALTIN SPİRAL — yalnız REFERANS katmanı
   16:9 sahne altın dikdörtgen DEĞİLDİR (1,778 ≠ 1,618). Sığan en büyük
   altın dikdörtgen 1747,4 × 1080'dir; sahnenin 172,6 px'i dışarıda kalır.
   Bindirme bunu gizlemez, ETİKETLER.
   ═══════════════════════════════════════════════════════════════════════ */

function altinDikdortgen() {
  const h = KOMP.boy;
  const w = h * KOMP.phi;
  return { x: (KOMP.en - w) / 2, y: 0, w, h, artik: KOMP.en - w };
}

/** Kareleri sol→üst→sağ→alt sırasıyla kesip her karede çeyrek yay çizer.
 *  Tüm yaylar sweep=1 (ekranda saat yönü); uçlar birbirine DEĞER. */
function altinSpiralYolu(dikdortgen, adim = 8) {
  let { x, y, w, h } = dikdortgen;
  let taraf = 0;
  const parcalar = [];
  for (let i = 0; i < adim; i++) {
    if (w < 1 || h < 1) break;
    let s, bas, son;
    if (taraf === 0) {            /* kare SOLDA */
      s = h;
      bas = { x, y: y + s }; son = { x: x + s, y };
      x += s; w -= s;
    } else if (taraf === 1) {     /* kare ÜSTTE */
      s = w;
      bas = { x, y }; son = { x: x + s, y: y + s };
      y += s; h -= s;
    } else if (taraf === 2) {     /* kare SAĞDA */
      s = h;
      bas = { x: x + w, y }; son = { x: x + w - s, y: y + s };
      w -= s;
    } else {                      /* kare ALTTA */
      s = w;
      bas = { x: x + w, y: y + h }; son = { x, y: y + h - s };
      h -= s;
    }
    if (i === 0) parcalar.push(`M ${yuvarla(bas.x, 2)} ${yuvarla(bas.y, 2)}`);
    parcalar.push(
      `A ${yuvarla(s, 2)} ${yuvarla(s, 2)} 0 0 1 ${yuvarla(son.x, 2)} ${yuvarla(son.y, 2)}`);
    taraf = (taraf + 1) % 4;
  }
  return parcalar.join(' ');
}

/* ═══════════════════════════════════════════════════════════════════════
   3. KILAVUZ BİNDİRMESİ
   ═══════════════════════════════════════════════════════════════════════ */

const VARSAYILAN_KATMANLAR = Object.freeze({
  izgara: true,      /* 12 sütun */
  guvenli: true,     /* güvenli alan */
  ucler: true,       /* üçler ızgarası */
  kesisim: true,     /* kesişim jetonları */
  optik: true,       /* optik merkez + geometrik merkez */
  spiral: false      /* altın spiral — isteğe bağlı, "referans" etiketli */
});

function kilavuzCiz(katmanlar) {
  const svg = svgOge('svg', {
    class: 'komp-kilavuz__cizim',
    viewBox: `0 0 ${KOMP.en} ${KOMP.boy}`,
    preserveAspectRatio: 'none'
  });

  /* --- 12 sütun ızgara (en sessiz) ------------------------------------ */
  if (katmanlar.izgara) {
    const g = svgOge('g', { class: 'kk-izgara' });
    const { kenar, oluk, sutun, sutunEn } = KOMP.izgara;
    for (let i = 0; i < sutun; i++) {
      g.appendChild(svgOge('rect', {
        x: yuvarla(kenar + i * (sutunEn + oluk), 2), y: 0,
        width: yuvarla(sutunEn, 2), height: KOMP.boy
      }));
    }
    svg.appendChild(g);
  }

  /* --- güvenli alan ---------------------------------------------------- */
  if (katmanlar.guvenli) {
    const g = svgOge('g', { class: 'kk-guvenli' });
    g.appendChild(svgOge('rect', {
      x: KOMP.guvenli.x, y: KOMP.guvenli.y,
      width: KOMP.en - 2 * KOMP.guvenli.x,
      height: KOMP.boy - 2 * KOMP.guvenli.y
    }));
    const t = svgOge('text', {
      class: 'kk-etiket', x: KOMP.guvenli.x + 10, y: KOMP.guvenli.y - 12
    });
    t.textContent = 'güvenli alan 96 × 72';
    g.appendChild(t);
    svg.appendChild(g);
  }

  /* --- altın spiral: REFERANS, ana kılavuz değil ----------------------- */
  if (katmanlar.spiral) {
    const g = svgOge('g', { class: 'kk-spiral' });
    const dd = altinDikdortgen();
    g.appendChild(svgOge('rect', {
      x: yuvarla(dd.x, 2), y: 0,
      width: yuvarla(dd.w, 2), height: dd.h
    }));
    g.appendChild(svgOge('path', { d: altinSpiralYolu(dd) }));
    /* rozet sol-altta durur; spiral etiketi onun ÜSTÜNE yazılır */
    const t = svgOge('text', {
      class: 'kk-etiket', x: yuvarla(dd.x + 12, 2), y: KOMP.boy - 110
    });
    /* etiket sahne px'inde yazılır ve --komp-olcek ile büyür; kısa tutulur
       ki ölçekli sahnelerde sağ kenardan taşmasın */
    t.textContent = `referans · altın dikdörtgen 1747×1080 (sahne değil)`;
    g.appendChild(t);
    svg.appendChild(g);
  }

  /* --- üçler ızgarası -------------------------------------------------- */
  if (katmanlar.ucler) {
    const g = svgOge('g', { class: 'kk-ucler' });
    for (const x of KOMP.uclerX)
      g.appendChild(svgOge('line', { x1: x, y1: 0, x2: x, y2: KOMP.boy }));
    for (const y of KOMP.uclerY)
      g.appendChild(svgOge('line', { x1: 0, y1: y, x2: KOMP.en, y2: y }));
    svg.appendChild(g);
  }

  /* --- optik merkez (+ geometrik merkezin soluk izi) ------------------- */
  if (katmanlar.optik) {
    /* İkisi de TAM GENİŞLİK çizilir: 36 px'lik fark ancak iki paralel
       çizgi olarak görülünce anlaşılır. Etiketler sol kenara yazılır —
       ortalanmış hero başlığıyla çakışmasınlar. */
    const g = svgOge('g', { class: 'kk-optik' });
    g.appendChild(svgOge('line', {
      class: 'kk-geometrik',
      x1: 0, y1: KOMP.geometrik.y, x2: KOMP.en, y2: KOMP.geometrik.y
    }));
    g.appendChild(svgOge('line', {
      x1: 0, y1: KOMP.optik.y, x2: KOMP.en, y2: KOMP.optik.y
    }));
    g.appendChild(svgOge('line', {
      x1: KOMP.optik.x, y1: KOMP.optik.y - 34,
      x2: KOMP.optik.x, y2: KOMP.optik.y + 34
    }));
    const t = svgOge('text', {
      class: 'kk-etiket', x: KOMP.guvenli.x + 12, y: KOMP.optik.y - 16
    });
    t.textContent = 'optik 960·504';
    g.appendChild(t);
    const tg = svgOge('text', {
      class: 'kk-etiket', x: KOMP.guvenli.x + 12, y: KOMP.geometrik.y + 40
    });
    tg.textContent = 'geometrik 540 (−36)';
    g.appendChild(tg);
    svg.appendChild(g);
  }

  /* --- kesişim jetonları ----------------------------------------------- */
  if (katmanlar.kesisim) {
    const g = svgOge('g', { class: 'kk-kesisim' });
    for (const n of ucNoktalari()) {
      g.appendChild(svgOge('circle', { class: 'kk-halka', cx: n.x, cy: n.y, r: 26 }));
      g.appendChild(svgOge('circle', { class: 'kk-gobek', cx: n.x, cy: n.y, r: 6 }));
      const t = svgOge('text', {
        class: 'kk-etiket kk-etiket--ana',
        x: n.x + 34, y: n.y - 30
      });
      t.textContent = `${n.x} · ${n.y}`;
      g.appendChild(t);
    }
    svg.appendChild(g);
  }

  return svg;
}

/**
 * Kılavuz bindirmesini kurar ve DENETLEYİCİ döndürür.
 * Modül düzeyinde global keydown EKLENMEZ; dinleyici bu çağrıyla doğar,
 * kaldir() ile ölür. secenekler.tus = null → hiç klavye bağlanmaz.
 *
 * @param {Element} kok  .komp-sahne
 * @param {{tus?:string|null, acik?:boolean, katmanlar?:object,
 *          kapsam?:'belge'|'kok', rozet?:boolean}} secenekler
 */
export function enableCompositionGuides(kok, secenekler = {}) {
  if (!kok) throw new Error('enableCompositionGuides: kök öğe gerekli');
  const ayar = kompHazirla();
  const tus = secenekler.tus === null ? null : (secenekler.tus || 'k');
  const kapsam = secenekler.kapsam === 'kok' ? kok : (kok.ownerDocument || document);
  const katmanlar = { ...VARSAYILAN_KATMANLAR, ...(secenekler.katmanlar || {}) };
  const rozetIster = secenekler.rozet !== false;

  const katman = document.createElement('div');
  katman.className = 'komp-kilavuz';
  katman.setAttribute('aria-hidden', 'true');
  katman.setAttribute('data-komp-yoksay', '');

  let rozet = null;
  const yenidenCiz = () => {
    katman.replaceChildren();
    katman.appendChild(kilavuzCiz(katmanlar));
    if (rozetIster) {
      rozet = document.createElement('div');
      rozet.className = 'komp-kilavuz__rozet';
      /* KISA tutulur: rozet metni de sahne px'indedir ve --komp-olcek ile
         büyür; katman listesi yazılırsa ölçekli sahnede satır taşar */
      const sayi = Object.values(katmanlar).filter(Boolean).length;
      rozet.textContent =
        `kılavuz · ${sayi} katman${katmanlar.spiral ? ' · spiral(ref)' : ''}` +
        (tus ? ` · [${tus.toUpperCase()}]` : '');
      katman.appendChild(rozet);
    }
  };
  yenidenCiz();
  kok.appendChild(katman);

  let acik = false;
  const uygula = () => {
    /* Yasak durumda sınıf HİÇ eklenmez — CSS mührüne ek ikinci kilit */
    katman.classList.toggle('acik', acik && !kilavuzYasak());
    kok.dispatchEvent(new CustomEvent('kompkilavuz', { detail: { acik } }));
  };

  const ac = () => { acik = true; uygula(); return !kilavuzYasak(); };
  const kapat = () => { acik = false; uygula(); return false; };
  const degistir = () => (acik ? kapat() : ac());

  let dinleyici = null;
  if (tus) {
    dinleyici = e => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const h = e.target;
      /* form alanında yazarken kısayolu YUTMA */
      if (h && (h.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName || ''))) return;
      if (e.key.toLowerCase() !== tus.toLowerCase()) return;
      e.preventDefault();
      degistir();
    };
    kapsam.addEventListener('keydown', dinleyici);
  }

  /* ilk durum: seçenek > ?kilavuz=1 > kapalı */
  if (secenekler.acik ?? ayar.kilavuz) ac(); else uygula();

  return {
    ac, kapat, degistir,
    acikMi: () => acik && !kilavuzYasak(),
    /** tek katmanı aç/kapat ve yeniden çiz (ör. katmanAyarla('spiral', true)) */
    katmanAyarla(ad, durum) {
      katmanlar[ad] = !!durum;
      yenidenCiz();
      uygula();
      return { ...katmanlar };
    },
    katmanlar: () => ({ ...katmanlar }),
    element: katman,
    /** dinleyiciyi söker, DOM'u temizler */
    kaldir() {
      if (dinleyici) kapsam.removeEventListener('keydown', dinleyici);
      dinleyici = null;
      katman.remove();
    }
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   4. YÖNLENDİREN ÇİZGİ (.komp-iz)
   ═══════════════════════════════════════════════════════════════════════ */

const ADLI_NOKTALAR = Object.freeze({
  'sol-ust': { x: KOMP.uclerX[0], y: KOMP.uclerY[0] },
  'sag-ust': { x: KOMP.uclerX[1], y: KOMP.uclerY[0] },
  'sol-alt': { x: KOMP.uclerX[0], y: KOMP.uclerY[1] },
  'sag-alt': { x: KOMP.uclerX[1], y: KOMP.uclerY[1] },
  'optik': { ...KOMP.optik },
  'merkez': { ...KOMP.geometrik }
});

/** Kutunun kenarında, hedefe BAKAN nokta (merkez yerine kenar → çizgi
 *  öğenin içine girmez, ona DEĞER) */
function kenarNoktasi(k, hedef) {
  const m = merkezi(k);
  const dx = hedef.x - m.x;
  const dy = hedef.y - m.y;
  if (dx === 0 && dy === 0) return m;
  const tx = dx === 0 ? Infinity : (k.w / 2) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (k.h / 2) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: m.x + dx * t, y: m.y + dy * t };
}

function capaCoz(kok, capa, karsi) {
  if (Array.isArray(capa)) return { x: capa[0], y: capa[1] };
  if (capa && typeof capa === 'object' && 'x' in capa) return { x: capa.x, y: capa.y };
  if (typeof capa === 'string' && ADLI_NOKTALAR[capa]) return { ...ADLI_NOKTALAR[capa] };
  const el = typeof capa === 'string' ? kok.querySelector(capa) : capa;
  if (!el) throw new Error(`izCiz: çapa bulunamadı → ${capa}`);
  const k = kutu(kok, el);
  return karsi ? kenarNoktasi(k, karsi) : merkezi(k);
}

function izKatmani(kok) {
  let svg = kok.querySelector(':scope > .komp-iz-katman');
  if (!svg) {
    svg = svgOge('svg', {
      class: 'komp-iz-katman',
      viewBox: `0 0 ${KOMP.en} ${KOMP.boy}`,
      preserveAspectRatio: 'none'
    });
    svg.setAttribute('data-komp-yoksay', '');
    kok.appendChild(svg);
  }
  return svg;
}

/**
 * İki çapa arasında yönlendiren çizgi üretir.
 * Çapa biçimleri: CSS seçici | Element | [x,y] | {x,y} | adlı nokta
 * ('sol-ust','sag-ust','sol-alt','sag-alt','optik','merkez').
 *
 * @param {Element} kok
 * @param {{baslangic:*, bitis:*, egri?:number, ucIsareti?:boolean,
 *          etiket?:string, sinif?:string, ilerleme?:number}} s
 */
export function izCiz(kok, s = {}) {
  const svg = izKatmani(kok);
  const grup = svgOge('g', { class: 'komp-iz-grup' });
  const yol = svgOge('path', { class: `komp-iz ${s.sinif || ''}`.trim() });
  grup.appendChild(yol);
  let uc = null;
  let etiketGrup = null;
  const egri = s.egri ?? 0.18;
  const ucIster = s.ucIsareti !== false;

  const hesapla = () => {
    /* karşılıklı çözüm: her çapa DİĞERİNE bakan kenar noktasını verir */
    const kabaB = capaCoz(kok, s.baslangic, null);
    const kabaS = capaCoz(kok, s.bitis, null);
    const a = capaCoz(kok, s.baslangic, kabaS);
    const b = capaCoz(kok, s.bitis, kabaB);
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    /* kontrol noktası: orta noktadan DİKEY sapma → yay */
    const kx = (a.x + b.x) / 2 + (-dy / d) * d * egri;
    const ky = (a.y + b.y) / 2 + (dx / d) * d * egri;
    return { a, b, kx, ky, d };
  };

  const uygula = () => {
    const { a, b, kx, ky } = hesapla();
    yol.setAttribute('d',
      `M ${yuvarla(a.x, 1)} ${yuvarla(a.y, 1)} Q ${yuvarla(kx, 1)} ${yuvarla(ky, 1)} ${yuvarla(b.x, 1)} ${yuvarla(b.y, 1)}`);

    if (ucIster) {
      if (!uc) { uc = svgOge('path', { class: 'komp-iz-uc' }); grup.appendChild(uc); }
      /* ok ucu: yolun son teğetine göre döner */
      const tx = b.x - kx, ty = b.y - ky;
      const tl = Math.hypot(tx, ty) || 1;
      const ux = tx / tl, uy = ty / tl;
      const boy = 20, en = 9;
      const p1 = `${yuvarla(b.x, 1)},${yuvarla(b.y, 1)}`;
      const p2 = `${yuvarla(b.x - ux * boy - uy * en, 1)},${yuvarla(b.y - uy * boy + ux * en, 1)}`;
      const p3 = `${yuvarla(b.x - ux * boy + uy * en, 1)},${yuvarla(b.y - uy * boy - ux * en, 1)}`;
      uc.setAttribute('d', `M ${p1} L ${p2} L ${p3} Z`);
    }

    if (s.etiket) {
      if (!etiketGrup) {
        etiketGrup = svgOge('g', { class: 'komp-iz-etiket-grup' });
        etiketGrup.appendChild(svgOge('rect', { class: 'komp-iz-etiket-zemin', rx: 4 }));
        etiketGrup.appendChild(svgOge('text', { class: 'komp-iz-etiket' }));
        grup.appendChild(etiketGrup);
      }
      const metin = etiketGrup.querySelector('text');
      metin.textContent = s.etiket;
      /* Q eğrisinin t=0,5 noktası */
      const mx = 0.25 * a.x + 0.5 * kx + 0.25 * b.x;
      const my = 0.25 * a.y + 0.5 * ky + 0.25 * b.y;
      const genislik = s.etiket.length * 12 + 20;
      metin.setAttribute('x', yuvarla(mx - genislik / 2 + 10, 1));
      metin.setAttribute('y', yuvarla(my + 8, 1));
      etiketGrup.querySelector('rect').setAttribute('x', yuvarla(mx - genislik / 2, 1));
      etiketGrup.querySelector('rect').setAttribute('y', yuvarla(my - 18, 1));
      etiketGrup.querySelector('rect').setAttribute('width', genislik);
      etiketGrup.querySelector('rect').setAttribute('height', 34);
    }
  };

  /** ilerleme p∈[0,1]: çizgi çizilirken açığa çıkar.
   *  export / reduced-motion → HER ZAMAN son kare (p=1). */
  const ilerlemeUygula = p => {
    const son = (disaAktarim() || azaltilmisHareket()) ? 1 : Math.min(1, Math.max(0, p));
    const boy = yol.getTotalLength ? yol.getTotalLength() : 0;
    if (!boy) return;
    yol.style.strokeDasharray = `${boy}`;
    yol.style.strokeDashoffset = `${boy * (1 - son)}`;
    const gorunur = son > 0.98 ? '' : 'none';
    if (uc) uc.style.display = gorunur;
    if (etiketGrup) etiketGrup.style.display = gorunur;
  };

  uygula();
  svg.appendChild(grup);
  if (s.ilerleme !== undefined) ilerlemeUygula(s.ilerleme);

  return {
    element: grup,
    yol,
    guncelle: () => { uygula(); return grup; },
    ilerleme: ilerlemeUygula,
    kaldir: () => grup.remove()
  };
}

/**
 * ROI kadrajı bağı: kaynak görseldeki pencere ile büyütülmüş detay
 * panelini iki izle birleştirir (klasik büyüteç kadrajı).
 * Pencere ve detay AYNI sahnede olmalıdır.
 */
export function roiBagla(kok, pencere, detay, s = {}) {
  const pe = typeof pencere === 'string' ? kok.querySelector(pencere) : pencere;
  const de = typeof detay === 'string' ? kok.querySelector(detay) : detay;
  if (!pe || !de) throw new Error('roiBagla: pencere veya detay bulunamadı');
  const kp = kutu(kok, pe);
  const kd = kutu(kok, de);
  /* detay pencerenin sağındaysa pencerenin SAĞ köşelerinden bağla */
  const sagda = merkezi(kd).x >= merkezi(kp).x;
  const px = sagda ? kp.x + kp.w : kp.x;
  const dx = sagda ? kd.x : kd.x + kd.w;
  const ortak = { egri: 0, ucIsareti: false, sinif: 'komp-iz--sessiz' };
  const ustIz = izCiz(kok, { ...ortak, ...s, baslangic: [px, kp.y], bitis: [dx, kd.y] });
  const altIz = izCiz(kok, {
    ...ortak, ...s,
    baslangic: [px, kp.y + kp.h], bitis: [dx, kd.y + kd.h]
  });
  return {
    guncelle: () => { ustIz.guncelle(); altIz.guncelle(); },
    kaldir: () => { ustIz.kaldir(); altIz.kaldir(); }
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   5. ÖLÇÜM KATMANI — olcCompozisyon()
   Taktik doğrulayıcısının tüketebileceği SAYILAR. Görüş bildirmez,
   ölçer; eşikler `uyarilar` dizisinde açıkça yazılıdır.
   ═══════════════════════════════════════════════════════════════════════ */

const GORSEL_ETIKET = /^(IMG|SVG|CANVAS|VIDEO|PICTURE|FIGURE)$/;

/** Ölçüme giren "mürekkepli" öğeler: metni, görseli, zemini veya kenarı
 *  olanlar. Sahnenin %85'inden büyük kutular ZEMİN sayılır, sayılmaz. */
function murekkepOgeleri(kok) {
  const cikti = [];
  const sahneAlan = KOMP.en * KOMP.boy;
  for (const el of kok.querySelectorAll('*')) {
    if (el.closest('[data-komp-yoksay], .komp-kilavuz, .komp-iz-katman')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) < 0.05) continue;
    const k = kutu(kok, el);
    if (k.w < 2 || k.h < 2) continue;
    if (k.w * k.h > 0.85 * sahneAlan) continue;
    const etiket = (el.tagName || '').toUpperCase();
    const gorsel = GORSEL_ETIKET.test(etiket);
    const metinli = [...el.childNodes]
      .some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    const zeminli = alfa(cs.backgroundColor) > 0.06 || cs.backgroundImage !== 'none';
    const kenarli = ['borderTopWidth', 'borderRightWidth',
      'borderBottomWidth', 'borderLeftWidth']
      .some(p => parseFloat(cs[p]) > 0);
    if (!(gorsel || metinli || zeminli || kenarli)) continue;

    /* yoğunluk sezgiseli: görsel dolu, metin punto ile, zemin sessiz */
    let yogunluk = 0.3;
    if (gorsel) yogunluk = 1;
    else if (metinli) {
      const punto = parseFloat(cs.fontSize) || 28;
      const kalin = (parseInt(cs.fontWeight, 10) || 400) >= 600 ? 1.15 : 1;
      yogunluk = Math.min(1, (0.25 + punto / 160) * kalin);
    }
    cikti.push({ el, kutu: k, yogunluk, gorsel, metinli, punto: parseFloat(cs.fontSize) || 0 });
  }
  return cikti;
}

/** Boş alan oranı: 20 px'lik ızgarada işgal edilmeyen hücrelerin payı */
function bosAlan(murekkep) {
  const sutun = Math.ceil(KOMP.en / HUCRE);
  const satir = Math.ceil(KOMP.boy / HUCRE);
  const dolu = new Uint8Array(sutun * satir);
  for (const m of murekkep) {
    const x0 = Math.max(0, Math.floor(m.kutu.x / HUCRE));
    const x1 = Math.min(sutun - 1, Math.floor((m.kutu.x + m.kutu.w) / HUCRE));
    const y0 = Math.max(0, Math.floor(m.kutu.y / HUCRE));
    const y1 = Math.min(satir - 1, Math.floor((m.kutu.y + m.kutu.h) / HUCRE));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) dolu[y * sutun + x] = 1;
  }
  let sayac = 0;
  for (let i = 0; i < dolu.length; i++) sayac += dolu[i];
  return 1 - sayac / dolu.length;
}

/** İç içe işaretlenmiş öğelerden yalnız EN DIŞTAKİLERİ tut.
 *  (Bir başlık, işaretli bir iddia bloğunun içindeyse iki kez sayılmamalı;
 *  aksi hâlde `ogeSayisi` ve `baskinlik` şişer.) */
function enDistakiler(liste) {
  return liste.filter(el => !liste.some(d => d !== el && d.contains(el)));
}

/** Ana öğeler: açık işaret ([data-komp-oge]) varsa onlar, yoksa sahnenin
 *  doğrudan çocuklarından alanı ≥ %2 olanlar. */
function anaOgeler(kok, secici) {
  if (secici) return enDistakiler([...kok.querySelectorAll(secici)]);
  const isaretli = enDistakiler([...kok.querySelectorAll('[data-komp-oge]')]);
  if (isaretli.length) return isaretli;
  const esik = 0.02 * KOMP.en * KOMP.boy;
  return [...kok.children].filter(el => {
    if (el.matches('[data-komp-yoksay], .komp-kilavuz, .komp-iz-katman')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const k = kutu(kok, el);
    return k.w * k.h >= esik;
  });
}

/**
 * Bir slaydın kompozisyonunu ÖLÇER.
 * @param {Element} kok  .komp-sahne
 * @param {{secici?:string, baslikSecici?:string}} secenekler
 * @returns {object} sahne, ogeler[], ucler, optikMerkez, bosAlanOrani,
 *                   doluAlanOrani, denge, baskinlik, uyarilar[]
 */
export function olcCompozisyon(kok, secenekler = {}) {
  if (!kok) throw new Error('olcCompozisyon: kök öğe gerekli');
  const kesisimler = ucNoktalari();
  const murekkep = murekkepOgeleri(kok);
  const bos = bosAlan(murekkep);

  /* --- ana öğeler ve kesişim uzaklıkları ------------------------------- */
  const ogeler = anaOgeler(kok, secenekler.secici).map(el => {
    const k = kutu(kok, el);
    const m = merkezi(k);
    let enYakin = kesisimler[0];
    let mesafe = Infinity;
    for (const n of kesisimler) {
      const d = uzaklik(m, n);
      if (d < mesafe) { mesafe = d; enYakin = n; }
    }
    const alan = k.w * k.h;
    const ic = murekkep.filter(x => el.contains(x.el) || x.el === el);
    const yogunluk = ic.length
      ? ic.reduce((t, x) => t + x.yogunluk * x.kutu.w * x.kutu.h, 0) /
        Math.max(1, ic.reduce((t, x) => t + x.kutu.w * x.kutu.h, 0))
      : 0.3;
    return {
      ad: el.dataset.kompOge || el.id || el.tagName.toLowerCase(),
      element: el,
      kutu: { x: yuvarla(k.x), y: yuvarla(k.y), w: yuvarla(k.w), h: yuvarla(k.h) },
      merkez: { x: yuvarla(m.x), y: yuvarla(m.y) },
      alanOrani: yuvarla(alan / (KOMP.en * KOMP.boy), 3),
      agirlik: yuvarla(alan * yogunluk),
      enYakinKesisim: { ad: enYakin.ad, x: enYakin.x, y: enYakin.y },
      kesisimUzakligi: {
        px: yuvarla(mesafe),
        oran: yuvarla(mesafe / Math.hypot(KOMP.en, KOMP.boy), 4),
        capali: mesafe <= YAKIN_ESIK
      }
    };
  });

  /* --- optik merkez sapması (başlık) ------------------------------------ */
  const baslikEl =
    kok.querySelector(secenekler.baslikSecici || '[data-komp-oge="baslik"]') ||
    kok.querySelector('[data-komp-baslik], .komp-capa-baslik, h1');
  let optikMerkez = { hedef: { ...KOMP.optik }, baslik: null, sapma: null };
  if (baslikEl) {
    const k = kutu(kok, baslikEl);
    const m = merkezi(k);
    optikMerkez = {
      hedef: { ...KOMP.optik },
      baslik: { x: yuvarla(m.x), y: yuvarla(m.y), w: yuvarla(k.w), h: yuvarla(k.h) },
      sapma: {
        x: yuvarla(m.x - KOMP.optik.x),
        y: yuvarla(m.y - KOMP.optik.y),
        px: yuvarla(uzaklik(m, KOMP.optik)),
        /* geometrik merkeze göre KAZANÇ: pozitifse optik merkeze daha yakın */
        geometrikeGoreKazanc: yuvarla(uzaklik(m, KOMP.geometrik) - uzaklik(m, KOMP.optik))
      }
    };
  }

  /* --- görsel ağırlık merkezi ve denge --------------------------------- */
  let toplam = 0, sx = 0, sy = 0;
  for (const m of murekkep) {
    const a = m.kutu.w * m.kutu.h * m.yogunluk;
    const c = merkezi(m.kutu);
    toplam += a; sx += c.x * a; sy += c.y * a;
  }
  const agirlikMerkezi = toplam
    ? { x: yuvarla(sx / toplam), y: yuvarla(sy / toplam) }
    : { x: KOMP.geometrik.x, y: KOMP.geometrik.y };
  const sapmaX = agirlikMerkezi.x - KOMP.geometrik.x;
  const sapmaY = agirlikMerkezi.y - KOMP.geometrik.y;
  const denge = {
    agirlikMerkezi,
    sapma: { x: yuvarla(sapmaX), y: yuvarla(sapmaY), px: yuvarla(Math.hypot(sapmaX, sapmaY)) },
    /* ±64 px (bir kenar boşluğu) içinde kalan yerleşim SİMETRİK okunur */
    tur: Math.hypot(sapmaX, sapmaY) <= 64 ? 'simetrik' : 'asimetrik'
  };

  /* --- baskınlık: en ağır öğe ikinciden ne kadar ağır ------------------ */
  const agirliklar = ogeler.map(o => o.agirlik).sort((a, b) => b - a);
  const baskinlik = agirliklar.length >= 2 && agirliklar[1] > 0
    ? yuvarla(agirliklar[0] / agirliklar[1], 2)
    : (agirliklar.length === 1 ? Infinity : 0);

  /* --- uyarılar: eşikler açıkça yazılı --------------------------------- */
  /* HERO yerleşimi (kapak, bölüm ayracı, tek denklem): tek baskın öğe,
     optik merkeze oturmuş. composition.md §1 ve §7 gereği bu yerleşim
     üçler kesişimine ÇAPALANMAZ ve boş olması normaldir — bu iki uyarı
     hero'da bastırılır, yoksa doğru yerleşim hatalı raporlanır. */
  const hero = ogeler.length <= 1 &&
    !!optikMerkez.sapma && optikMerkez.sapma.px <= 60;

  const uyarilar = [];
  if (bos < 0.30)
    uyarilar.push(`boş alan oranı %${Math.round(bos * 100)} (eşik %30) — slayt kalabalık; en ucuz çare bir şeyi ÇIKARMAK`);
  if (bos > 0.85 && ogeler.length >= 2)
    uyarilar.push(`boş alan oranı %${Math.round(bos * 100)} (eşik %85) — içerik sahneye tutunmuyor, kadrajı sıkın`);
  if (ogeler.length && !hero && !ogeler.some(o => o.kesisimUzakligi.capali))
    uyarilar.push(`hiçbir ana öğe kesişime çapalı değil (en yakın ${Math.min(...ogeler.map(o => o.kesisimUzakligi.px))} px, eşik ${YAKIN_ESIK} px)`);
  if (ogeler.length >= 6)
    uyarilar.push(`${ogeler.length} ana öğe — tek baskın öğe kuralı bozuluyor, gruplayın veya bölün`);
  if (baskinlik !== Infinity && baskinlik > 0 && baskinlik < 1.6 && ogeler.length >= 2)
    uyarilar.push(`baskınlık oranı ${baskinlik} (eşik 1,6) — hiçbir öğe açıkça birinci değil, göz nereye ineceğini bilemez`);
  if (optikMerkez.sapma && Math.abs(optikMerkez.baslik.x - KOMP.optik.x) < 40 &&
      optikMerkez.sapma.geometrikeGoreKazanc < -12) {
    const asagida = optikMerkez.sapma.y > 0;
    const fark = Math.abs(Math.round(optikMerkez.sapma.y));
    uyarilar.push(`ortalanmış başlık optik merkezin ${fark} px ${asagida ? 'ALTINDA' : 'ÜSTÜNDE'} — ${fark} px ${asagida ? 'yukarı' : 'aşağı'} alın (hedef y=${KOMP.optik.y})`);
  }

  return {
    sahne: { en: KOMP.en, boy: KOMP.boy },
    ogeSayisi: ogeler.length,
    ogeler,
    ucler: { kesisimler, yakinEsik: YAKIN_ESIK },
    optikMerkez,
    bosAlanOrani: yuvarla(bos, 3),
    doluAlanOrani: yuvarla(1 - bos, 3),
    denge,
    baskinlik,
    hero,
    uyarilar
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   6. TOPLU KURULUM — demo ve deste sayfaları için tek çağrı
   ═══════════════════════════════════════════════════════════════════════ */

/** [data-komp-iz='#a → #b'] biçimli işaretlemeleri otomatik çizer. */
export function izleriKur(kok) {
  const cikti = [];
  for (const el of kok.querySelectorAll('[data-komp-iz]')) {
    const [bas, son] = el.dataset.kompIz.split('→').map(t => t.trim());
    if (!bas || !son) continue;
    cikti.push(izCiz(kok, {
      baslangic: bas,
      bitis: son,
      egri: parseFloat(el.dataset.kompIzEgri ?? '0.18'),
      etiket: el.dataset.kompIzEtiket || undefined,
      sinif: el.dataset.kompIzSinif || ''
    }));
  }
  return cikti;
}
