/* ===========================================================================
   type-treatments.js — görüntü tipi muameleleri (display type treatments)
   ---------------------------------------------------------------------------
   DÜRÜSTLÜK NOTU: burada YENİ BİR YAZI KARAKTERİ ÇİZİLMEZ. Bu dosya, gerçek
   yazı karakterlerinin üzerine uygulanan CSS/SVG efektlerini yönetir.
   "Kraterli ay fontu" bir font değil, bir MUAMELEDİR.

   API
     applyTypeTreatment(el, 'ay'|'gravur'|'isil'|'yildiz'|'baski'|'buz', {
       seed:   number   // tohum — aynı tohum aynı krater/yıldız alanı
       yon:    number   // ışığın GELDİĞİ açı, derece (210 = sol üst)
       siddet: number   // 0..1
       canli:  boolean  // hareketli varyant (yalnız isil/yildiz)
     }) -> { el, kind, destroy(), refresh() }

     autoTypeTreatments(root)   // [data-tip] taşıyan her ögeyi bağlar
     contrastRatio(a, b)        // WCAG kontrast oranı
     surfaceColorOf(el)         // ögenin ardındaki etkin zemin rengi

   AŞAMALI GELİŞTİRME
     Bu dosya HİÇ çalışmazsa, type-treatments.css metni DÜZ ama TAM
     KONTRASTLI bırakır. JS yalnızca tohumlu krater/yıldız alanını, zemin
     algılamayı ve >=64px kural denetimini EKLER.

   KURALLAR
     - Muamele yalnız görüntü boyutunda (>= 64px) ve yalnız başlıkta.
       Küçükse muamele SÖKÜLÜR (data-tip-off) ve konsola uyarı düşülür.
     - prefers-reduced-motion ve [data-export] altında statik.
     - Hareketli varyantta parlaklık salınımı +-%15'i geçmez (kod +-%5).
   =========================================================================== */
(function (global) {
  'use strict';

  /* --- sabitler: her şeyden ÖNCE tanımlı (TDZ tuzağı) -------------------- */
  var KINDS = ['ay', 'gravur', 'isil', 'yildiz', 'baski', 'buz'];
  var CLASS_OF = {
    ay: 'tip-ay', gravur: 'tip-gravur', isil: 'tip-isil',
    yildiz: 'tip-yildiz', baski: 'tip-baski', buz: 'tip-buz'
  };
  var MIN_DISPLAY_PX = 64;   /* belge kuralı: muamele tabanı */
  var HERO_ONLY_PX = 96;     /* "yalnız dev başlık" damgalı muameleler */
  var DEFAULTS = { seed: 7, yon: 210, siddet: 1, canli: false };
  var STORE = '__tipTreatment';

  /* --- tohumlu PRNG (mulberry32) ---------------------------------------- */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* --- renk yardımcıları ------------------------------------------------- */
  function parseRGB(str) {
    if (!str) return null;
    var m = String(str).match(/rgba?\(([^)]+)\)/i);
    if (m) {
      var p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
      if (p.length < 3 || !isFinite(p[0])) return null;
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    var h = String(str).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!h) return null;
    var s = h[1];
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16), a: 1
    };
  }

  function over(fg, bg) {                     /* alpha compositing */
    var a = fg.a;
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a), a: 1
    };
  }

  function relLum(c) {
    function ch(v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }

  function contrastRatio(a, b) {
    var ca = typeof a === 'string' ? parseRGB(a) : a;
    var cb = typeof b === 'string' ? parseRGB(b) : b;
    if (!ca || !cb) return NaN;
    var la = relLum(ca), lb = relLum(cb);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* Ögenin ARDINDAKİ etkin zemin: şeffaf katmanları aşağıdan yukarı birleştir. */
  function surfaceColorOf(el) {
    var stack = [];
    var node = el;
    while (node && node.nodeType === 1) {
      var bg = getComputedStyle(node).backgroundColor;
      var c = parseRGB(bg);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
      node = node.parentElement;
    }
    var base = { r: 255, g: 255, b: 255, a: 1 };
    for (var i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  }

  function isDarkSurface(el) { return relLum(surfaceColorOf(el)) < 0.35; }

  /* --- ortam denetimleri ------------------------------------------------- */
  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function exporting(el) {
    return !!(el.closest && el.closest('[data-export]'));
  }

  /* --- mavi-gürültü (best-candidate) yerleşim ----------------------------
     Küçük popülasyonlar uniform-rastgele DAİMA kümelenir; her yeni noktayı
     mevcut noktalara EN UZAK adaydan seç. (WebGL sahne sözleşmesi §5) */
  function blueNoise(n, rand, w, h, tries) {
    var pts = [];
    tries = tries || 12;
    for (var i = 0; i < n; i++) {
      var best = null, bestD = -1;
      for (var t = 0; t < tries; t++) {
        var p = { x: rand() * w, y: rand() * h };
        var d = Infinity;
        for (var j = 0; j < pts.length; j++) {
          var dx = p.x - pts[j].x, dy = p.y - pts[j].y;
          var dd = dx * dx + dy * dy;
          if (dd < d) d = dd;
        }
        if (pts.length === 0) { best = p; break; }
        if (d > bestD) { bestD = d; best = p; }
      }
      pts.push(best);
    }
    return pts;
  }

  /* ölçek dağılımı DÜŞÜĞE eğilir, nadiren büyük (contract §5) */
  function skewLow(rand, min, max) {
    var u = rand();
    return min + (max - min) * Math.pow(u, 2.2);
  }

  function lightVec(yonDeg) {
    var r = (yonDeg * Math.PI) / 180;
    return { x: Math.cos(r), y: Math.sin(r) };   /* ögeden IŞIĞA doğru */
  }

  /* --- krater alanı ------------------------------------------------------
     Fizik: alçak güneş, TEK yön.
       - Kraterin IŞIĞA BAKAN iç duvarı -> GÖLGE  (yakın taraf)
       - Kraterin KARŞI iç duvarı       -> AYDINLIK (uzak taraf)
       - Yükseltilmiş dış kenar, ışık tarafında ince parlak yay
     Böylece "parlak kenar" ile "iç gölge" TAM KARŞI yönlerdedir. */
  function craterField(w, h, opts) {
    var rand = rng(opts.seed);
    var s = lightVec(opts.yon);
    var area = w * h;
    /* Görünür mürekkep, kutunun KÜÇÜK bir kesridir (harf gövdeleri arası boşluk
       maskelenir). Bu yüzden yoğunluk yüksek, yarıçap ise kutuya değil PUNTOYA
       bağlıdır: krater gövde kalınlığıyla aynı mertebede olmalı, yoksa
       kırpılır ve hiç görünmez. */
    var fs = opts.fontSize || Math.min(w, h);
    /* KONTRAST SINIRI (piksel ölçümüyle kalibre edildi).
       Koyu zeminde mürekkep PARLAKTIR; krater iç gölgesi onu karartır ve
       4.5:1'in altına düşürebilir. Parlak mürekkep üzerinde siyah alfa a
       için sonuç ~ ink*(1-a); katmanlar da çarpışır. Ölçüm, koyu zeminde
       toplam kararmanın ~0.43'ü geçmemesi gerektiğini gösterdi, bu yüzden
       iç gölge 0.66 -> 0.30, benek 0.16 -> 0.07 olarak kısılır.
       Açık zeminde mürekkep KOYUDUR; karartma zaten kontrastı ARTIRIR,
       dolayısıyla tam şiddet serbesttir. */
    var dark = !!opts.darkSurface;
    var aGolge = dark ? 0.30 : 0.66;
    var aBenek = dark ? 0.07 : 0.16;
    var n = Math.max(20, Math.min(130, Math.round(area / 900)));
    var pts = blueNoise(n, rand, w, h);
    var base = fs;
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var r = skewLow(rand, base * 0.055, base * 0.185);
      var k = opts.siddet;
      /* YÜKSELTİLMİŞ KENAR HALKASI — kraterin dairesel okunmasını sağlayan şey
         budur. Halka olmadan yönlü gölgeler yalnızca bir leke gibi okunur. */
      out.push('radial-gradient(circle ' + r.toFixed(1) + 'px at ' +
        p.x.toFixed(1) + 'px ' + p.y.toFixed(1) + 'px, ' +
        'rgba(255,255,255,0) 0 68%, rgba(255,255,255,' + (0.30 * k).toFixed(3) +
        ') 78%, rgba(255,255,255,0) 100%)');
      /* iç gölge — IŞIĞA yakın taraf; kenarı sert tutulur, yoksa bulanır */
      out.push('radial-gradient(circle ' + (r * 0.74).toFixed(1) + 'px at ' +
        (p.x + s.x * r * 0.26).toFixed(1) + 'px ' + (p.y + s.y * r * 0.26).toFixed(1) + 'px, ' +
        'rgba(0,0,0,' + (aGolge * k).toFixed(3) + ') 0 46%, rgba(0,0,0,' + (aGolge * 0.64 * k).toFixed(3) +
        ') 74%, rgba(0,0,0,0) 96%)');
      /* aydınlık iç duvar — TAM KARŞI taraf, dar ve platolu */
      out.push('radial-gradient(circle ' + (r * 0.52).toFixed(1) + 'px at ' +
        (p.x - s.x * r * 0.40).toFixed(1) + 'px ' + (p.y - s.y * r * 0.40).toFixed(1) + 'px, ' +
        'rgba(255,255,255,' + (0.62 * k).toFixed(3) + ') 0 40%, rgba(255,255,255,' +
        (0.34 * k).toFixed(3) + ') 70%, rgba(255,255,255,0) 98%)');
      /* dış kenarın ışık alan yamacı — ince parlak yay */
      out.push('radial-gradient(circle ' + (r * 0.30).toFixed(1) + 'px at ' +
        (p.x + s.x * r * 1.02).toFixed(1) + 'px ' + (p.y + s.y * r * 1.02).toFixed(1) + 'px, ' +
        'rgba(255,255,255,' + (0.42 * k).toFixed(3) + ') 0 35%, rgba(255,255,255,0) 100%)');
    }
    /* regolit mikro benek — kontrastı bozmayan ince doku */
    var grains = blueNoise(Math.round(n * 1.6), rand, w, h);
    for (var g = 0; g < grains.length; g++) {
      var q = grains[g];
      var gr = skewLow(rand, base * 0.010, base * 0.030);
      out.push('radial-gradient(circle ' + gr.toFixed(1) + 'px at ' +
        q.x.toFixed(1) + 'px ' + q.y.toFixed(1) + 'px, rgba(0,0,0,' +
        (aBenek * opts.siddet).toFixed(3) + ') 0%, rgba(0,0,0,0) 100%)');
    }
    return out.join(', ');
  }

  /* --- yıldız alanı ------------------------------------------------------ */
  function starField(w, h, opts) {
    var rand = rng(opts.seed + 991);
    var base = opts.fontSize || Math.min(w, h);
    var n = Math.max(24, Math.min(110, Math.round((w * h) / 900)));
    var pts = blueNoise(n, rand, w, h);
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var r = skewLow(rand, base * 0.012, base * 0.045);
      var a = 0.55 + rand() * 0.45;
      out.push('radial-gradient(circle ' + r.toFixed(1) + 'px at ' +
        p.x.toFixed(1) + 'px ' + p.y.toFixed(1) + 'px, rgba(255,255,255,' +
        (a * opts.siddet).toFixed(3) + ') 0%, rgba(255,255,255,0) 100%)');
    }
    return out.join(', ');
  }

  /* --- kırağı kristalleri ------------------------------------------------ */
  function frostField(w, h, opts) {
    var rand = rng(opts.seed + 3307);
    var base = opts.fontSize || Math.min(w, h);
    var n = Math.max(8, Math.min(26, Math.round((w * h) / 4000)));
    var pts = blueNoise(n, rand, w, h);
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var ang = rand() * 360;
      var len = base * (0.06 + rand() * 0.16);
      out.push('linear-gradient(' + ang.toFixed(0) + 'deg, rgba(255,255,255,' +
        (0.42 * opts.siddet).toFixed(3) + ') 0 ' + len.toFixed(1) + 'px, rgba(255,255,255,0) ' +
        (len + 1).toFixed(1) + 'px)');
    }
    return out.join(', ');
  }

  /* --- ana API ----------------------------------------------------------- */
  function applyTypeTreatment(el, kind, options) {
    if (!el || el.nodeType !== 1) throw new TypeError('applyTypeTreatment: geçerli bir öge gerekli');
    if (KINDS.indexOf(kind) === -1) {
      throw new RangeError('applyTypeTreatment: bilinmeyen muamele "' + kind +
        '". Geçerli: ' + KINDS.join(', '));
    }
    var prev = el[STORE];
    if (prev) prev.destroy();

    var o = {
      seed: 0, yon: DEFAULTS.yon, siddet: DEFAULTS.siddet, canli: DEFAULTS.canli
    };
    var k;
    for (k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) o[k] = DEFAULTS[k];
    if (options) for (k in options) if (Object.prototype.hasOwnProperty.call(options, k)) o[k] = options[k];
    o.siddet = Math.max(0, Math.min(1, Number(o.siddet)));

    var cls = CLASS_OF[kind];
    el.classList.add(cls);
    el.setAttribute('data-tip', kind);

    var ro = null;
    var raf = 0;

    function paint() {
      /* 1) boyut kuralı — belge kuralı: >= 64px, yalnız başlık */
      var cs = getComputedStyle(el);
      var px = parseFloat(cs.fontSize) || 0;
      var heroOnly = el.hasAttribute('data-tip-only-hero');
      var floor = heroOnly ? HERO_ONLY_PX : MIN_DISPLAY_PX;
      if (px < floor) {
        el.setAttribute('data-tip-off', 'kucuk');
        if (global.console && console.warn) {
          console.warn('[type-treatments] "' + kind + '" ' + px.toFixed(0) +
            'px olan ögede söküldü; taban ' + floor + 'px. Muameleler yalnız ' +
            'görüntü boyutunda ve yalnız başlıkta kullanılır.');
        }
        return;
      }
      el.removeAttribute('data-tip-off');

      /* 2) zemin algılama -> dolgu jetonlarını koyu/açık zemine göre seç */
      var dark = isDarkSurface(el);
      el.classList.toggle('tip-on-dark', dark);
      el.classList.toggle('tip-on-light', !dark);

      /* 3) ortak jetonlar */
      el.style.setProperty('--tip-yon', o.yon + 'deg');
      el.style.setProperty('--tip-siddet', String(o.siddet));

      /* 4) hareket: azaltılmış hareket veya dışa aktarımda ASLA */
      var still = reducedMotion() || exporting(el);
      el.classList.toggle('tip-canli', !!o.canli && !still);

      /* 5) tohumlu alanlar — px tabanlı, en-boy oranından bağımsız */
      var w = el.offsetWidth || 0, h = el.offsetHeight || 0;
      if (!w || !h) return;
      o.fontSize = px;   /* alan ölçekleri PUNTOYA bağlıdır, kutuya değil */
      o.darkSurface = dark;
      if (kind === 'ay') {
        el.style.setProperty('--tip-ay-kraterler', craterField(w, h, o));
        el.style.setProperty('--tip-ay-regolit', 'none');
        el.style.backgroundSize = w + 'px ' + h + 'px';
      } else if (kind === 'yildiz') {
        el.style.setProperty('--tip-yildiz-yildizlar', starField(w, h, o));
        el.style.backgroundSize = w + 'px ' + h + 'px';
      } else if (kind === 'buz') {
        el.style.setProperty('--tip-buz-kristal', frostField(w, h, o));
        el.style.backgroundSize = w + 'px ' + h + 'px';
      }
    }

    function schedule() {
      if (raf) return;
      raf = global.requestAnimationFrame(function () { raf = 0; paint(); });
    }

    paint();

    if (global.ResizeObserver) {
      ro = new ResizeObserver(schedule);
      ro.observe(el);
    }

    var handle = {
      el: el, kind: kind, options: o,
      refresh: paint,
      destroy: function () {
        if (ro) { ro.disconnect(); ro = null; }
        if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
        el.classList.remove(cls, 'tip-canli', 'tip-on-dark', 'tip-on-light');
        el.removeAttribute('data-tip');
        el.removeAttribute('data-tip-off');
        ['--tip-yon', '--tip-siddet', '--tip-ay-kraterler', '--tip-ay-regolit',
          '--tip-yildiz-yildizlar', '--tip-buz-kristal'].forEach(function (p) {
            el.style.removeProperty(p);
          });
        el.style.backgroundSize = '';
        try { delete el[STORE]; } catch (e) { el[STORE] = null; }
      }
    };
    el[STORE] = handle;
    return handle;
  }

  /* [data-tip="ay"] data-tip-seed data-tip-yon data-tip-siddet data-tip-canli */
  function autoTypeTreatments(root) {
    var scope = root || global.document;
    var nodes = scope.querySelectorAll('[data-tip]');
    var made = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var kind = el.getAttribute('data-tip');
      if (KINDS.indexOf(kind) === -1) continue;
      made.push(applyTypeTreatment(el, kind, {
        seed: Number(el.getAttribute('data-tip-seed')) || DEFAULTS.seed,
        yon: el.hasAttribute('data-tip-yon') ? Number(el.getAttribute('data-tip-yon')) : DEFAULTS.yon,
        siddet: el.hasAttribute('data-tip-siddet') ? Number(el.getAttribute('data-tip-siddet')) : 1,
        canli: el.hasAttribute('data-tip-canli')
      }));
    }
    return made;
  }

  var api = {
    applyTypeTreatment: applyTypeTreatment,
    autoTypeTreatments: autoTypeTreatments,
    contrastRatio: contrastRatio,
    surfaceColorOf: surfaceColorOf,
    relativeLuminance: relLum,
    parseColor: parseRGB,
    KINDS: KINDS,
    MIN_DISPLAY_PX: MIN_DISPLAY_PX,
    HERO_ONLY_PX: HERO_ONLY_PX
  };

  global.TypeTreatments = api;
  global.applyTypeTreatment = applyTypeTreatment;
  global.autoTypeTreatments = autoTypeTreatments;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
