/* Primitives Motion — JS eşleri (bkz. primitives-motion.css)
   motion-primitives'ten uyarlanmıştır (MIT, © ibelick — github.com/ibelick/motion-primitives).
   Yay sabitleri kaynaktan birebir: 280/18/0.3 (çevik, ζ≈0,98) ·
   26.7/4.1/0.2 (salınımlı, ζ≈0,89) · 170/26/1 (kritik sönümlü takip).
   Bağımlılık yok; her fonksiyon tek başına çağrılabilir. Sayfa,
   <head> içinde document.documentElement.classList.add('js') yapmalıdır. */
(function (global) {
  "use strict";
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EXPORT = document.documentElement.dataset.export === "true";
  const STATIC = REDUCED || EXPORT;

  /* ── Yay: Framer'ın modeliyle aynı yarı-örtük Euler entegratörü ── */
  function createSpring(opts, onUpdate) {
    const k = (opts && opts.stiffness) || 100,
          c = (opts && opts.damping) || 10,
          m = (opts && opts.mass) || 1;
    let x = 0, v = 0, target = 0, raf = null, last = 0;
    function tick(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
      const a = (-k * (x - target) - c * v) / m;
      v += a * dt; x += v * dt;
      if (Math.abs(v) < 0.01 && Math.abs(x - target) < 0.01) { x = target; v = 0; raf = null; }
      else raf = requestAnimationFrame(tick);
      onUpdate(x);
    }
    return {
      set(t) {
        target = t;
        if (STATIC) { x = t; v = 0; onUpdate(x); return; } /* azaltılmış harekette anında yerleş */
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      },
      jump(t) { x = target = t; v = 0; onUpdate(x); },
      get: () => x,
      stop() { if (raf) cancelAnimationFrame(raf); raf = null; }
    };
  }

  /* ── Kademeli metin: .px-text içeriğini parçalara böler ──
     per: 'char' | 'word' | 'line'. Kaynakla aynı ritim için boşluk
     parçaları da sayaca dahildir. Tetik: el.classList.add('is-visible'). */
  function splitText(el, per) {
    per = per || el.dataset.per || "word";
    const stagger = { char: 0.03, word: 0.05, line: 0.1 }[per];
    el.style.setProperty("--stagger", stagger + "s");
    el.setAttribute("aria-label", el.textContent);
    const text = el.textContent;
    const parts = per === "line" ? text.split("\n") : text.split(/(\s+)/);
    el.textContent = "";
    let i = 0;
    for (const p of parts) {
      const segs = per === "char" ? p.split("") : [p];
      for (const s of segs) {
        const span = document.createElement("span");
        span.dataset.seg = ""; span.setAttribute("aria-hidden", "true");
        span.style.setProperty("--i", i++);
        span.textContent = s;
        if (per === "line") span.style.display = "block";
        el.appendChild(span);
      }
    }
  }

  /* ── Telemetri çözülmesi (TextScramble) — kaynak: 0,8 s, 40 ms tik ──
     Türkçe karakterler sete dahil; boşluklar hiç karıştırılmaz. */
  function scramble(el, opts) {
    opts = opts || {};
    const duration = opts.duration || 0.8, speed = opts.speed || 0.04;
    const chars = opts.chars ||
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789çğıöşüÇĞİÖŞÜ";
    const text = el.dataset.text || (el.dataset.text = el.textContent);
    if (STATIC) { el.textContent = text; return; }
    const steps = duration / speed; let step = 0;
    clearInterval(el._scrIv);
    el._scrIv = setInterval(() => {
      const progress = step / steps; let out = "";
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") { out += " "; continue; }
        out += progress * text.length > i ? text[i]
             : chars[(Math.random() * chars.length) | 0];
      }
      el.textContent = out;
      if (++step > steps) { clearInterval(el._scrIv); el.textContent = text; }
    }, speed * 1000);
  }

  /* ── Başlık morfu (TextMorph) — ortak harfler yerine SÜZÜLÜR ──
     Kimlik: küçük-harf + o harfin kaçıncı tekrarı olduğu (a1, a2, b1…).
     Kaynak yay 280/18/0.3 ≈ 350 ms'lik bu bezier ile örtüşür. */
  function textMorph(el, next) {
    if (!el._morphInit) { /* ilk çağrıda mevcut metni span'lere aç */
      const cur = el.textContent; el.textContent = "";
      const counts = {};
      for (const ch of cur) {
        const lc = ch.toLowerCase(); counts[lc] = (counts[lc] || 0) + 1;
        const s = document.createElement("span");
        s.dataset.key = lc + counts[lc]; s.style.display = "inline-block";
        s.textContent = ch === " " ? " " : ch;
        el.appendChild(s);
      }
      el._morphInit = true;
    }
    const first = new Map([...el.children].map(s => [s.dataset.key, s.getBoundingClientRect().left]));
    const counts = {};
    const keys = [...next].map(ch => {
      const lc = ch.toLowerCase(); counts[lc] = (counts[lc] || 0) + 1;
      return { key: lc + counts[lc], label: ch === " " ? " " : ch };
    });
    el.textContent = "";
    for (const { key, label } of keys) {
      const s = document.createElement("span");
      s.dataset.key = key; s.textContent = label; s.style.display = "inline-block";
      el.appendChild(s);
    }
    if (STATIC) return;
    for (const s of el.children) {
      const from = first.get(s.dataset.key);
      if (from !== undefined) {
        const dx = from - s.getBoundingClientRect().left;
        if (dx) s.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }],
          { duration: 350, easing: "cubic-bezier(.25,1,.35,1)" });
      } else {
        s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: "ease-out" });
      }
    }
  }

  /* ── Yaylı sayı (AnimatedNumber) — tr-TR biçimlemesi varsayılan ── */
  function animatedNumber(el, opts) {
    opts = opts || {};
    const locale = opts.locale || "tr-TR";
    const s = createSpring(
      { stiffness: opts.stiffness || 100, damping: opts.damping || 10, mass: opts.mass || 1 },
      x => { el.textContent = Math.round(x).toLocaleString(locale); });
    return s;
  }

  /* ── Kilometre sayacı (SlidingNumber) — basamak başına yay ──
     En kısa yol hilesi kaynaktan: offset > 5 ise 10 yükseklik geri sar
     (9→0 ileri yuvarlanır, 8..1 üzerinden geri dönmez). */
  function slidingDigit(container) {
    container.className = "px-digit";
    container.innerHTML = '<span class="px-size">0</span>' +
      Array.from({ length: 10 }, (_, n) => `<span class="px-n" data-n="${n}">${n}</span>`).join("");
    const nums = [...container.querySelectorAll(".px-n")];
    const h = container.getBoundingClientRect().height || container.offsetHeight;
    return createSpring({ stiffness: 280, damping: 18, mass: 0.3 }, latest => {
      const place = ((latest % 10) + 10) % 10;
      for (const el of nums) {
        const n = +el.dataset.n;
        const offset = (10 + n - place) % 10;
        let y = offset * h;
        if (offset > 5) y -= 10 * h;
        el.style.transform = `translateY(${y}px)`;
      }
    });
  }
  function slidingNumber(root, value) {
    const digits = String(Math.abs(Math.trunc(value))).split("");
    root.textContent = "";
    const springs = digits.map(d => {
      const c = document.createElement("span"); root.appendChild(c);
      const s = slidingDigit(c); s.jump(+d); return s;
    });
    return {
      set(v) {
        const ds = String(Math.abs(Math.trunc(v))).padStart(springs.length, "0").split("");
        springs.forEach((s, i) => s.set(+ds[i]));
      }
    };
  }

  /* ── Sahne spotu — kritik sönümlü imleç takibi ── */
  function attachSpotlight(host, size) {
    size = size || 200;
    host.classList.add("px-spot-host");
    const dot = document.createElement("div"); dot.className = "px-spot";
    dot.style.width = dot.style.height = size + "px";
    host.appendChild(dot);
    const sx = createSpring({ stiffness: 170, damping: 26 }, x => dot.style.left = (x - size / 2) + "px");
    const sy = createSpring({ stiffness: 170, damping: 26 }, y => dot.style.top  = (y - size / 2) + "px");
    host.addEventListener("pointermove", e => {
      const r = host.getBoundingClientRect();
      sx.set(e.clientX - r.left); sy.set(e.clientY - r.top);
    });
  }

  /* ── Eğim kartı (Tilt) — ±15°, perspective 1000px (kaynak değerleri) ── */
  function attachTilt(el, opts) {
    opts = opts || {};
    const factor = opts.factor || 15;
    el.classList.add("px-tilt");
    el.style.transformStyle = "preserve-3d";
    let rx = 0, ry = 0;
    const apply = () => el.style.transform =
      `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    const spring = opts.spring || { stiffness: 300, damping: 30, mass: 1 };
    const sx = createSpring(spring, v => { rx = v; apply(); });
    const sy = createSpring(spring, v => { ry = v; apply(); });
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      const xPos = (e.clientX - r.left) / r.width - 0.5;
      const yPos = (e.clientY - r.top) / r.height - 0.5;
      sx.set(-yPos * 2 * factor);
      sy.set(xPos * -2 * factor);
    });
    el.addEventListener("pointerleave", () => { sx.set(0); sy.set(0); });
  }

  /* ── Mıknatıs (Magnetic) — salınımlı yay KASITLI: titreme efektin kendisi ── */
  function attachMagnetic(el, opts) {
    opts = opts || {};
    const intensity = opts.intensity || 0.6, range = opts.range || 100;
    let tx = 0, ty = 0, hovered = false;
    const apply = () => el.style.transform = `translate(${tx}px, ${ty}px)`;
    const sx = createSpring({ stiffness: 26.7, damping: 4.1, mass: 0.2 }, v => { tx = v; apply(); });
    const sy = createSpring({ stiffness: 26.7, damping: 4.1, mass: 0.2 }, v => { ty = v; apply(); });
    el.addEventListener("pointerenter", () => hovered = true);
    el.addEventListener("pointerleave", () => { hovered = false; sx.set(0); sy.set(0); });
    document.addEventListener("pointermove", e => {
      if (!hovered) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d <= range) {
        const falloff = 1 - d / range;
        sx.set(dx * intensity * falloff); sy.set(dy * intensity * falloff);
      } else { sx.set(0); sy.set(0); }
    });
  }

  /* ── Sonsuz şerit — hız tabanlı rAF; kaynağın restart muhasebesinden
     daha pürüzsüz ve hover'da hız değişimi sıçramasızdır. ── */
  function infiniteSlider(container, opts) {
    opts = opts || {};
    const gap = opts.gap || 16, speed = opts.speed || 100;
    const track = container.querySelector(".px-marquee-track");
    track.style.gap = gap + "px";
    track.append(...[...track.children].map(c => c.cloneNode(true)));
    if (STATIC) return;                       /* azaltılmış harekette sabit şerit */
    let x = 0, cur = speed, last = performance.now();
    const half = () => (track.scrollWidth + gap) / 2;
    (function frame(now) {
      const dt = (now - last) / 1000; last = now;
      x -= cur * dt;
      const h = half();
      if (x <= -h) x += h;
      track.style.transform = `translateX(${x}px)`;
      requestAnimationFrame(frame);
    })(performance.now());
    if (opts.speedOnHover) {
      container.addEventListener("pointerenter", () => cur = opts.speedOnHover);
      container.addEventListener("pointerleave", () => cur = speed);
    }
  }

  /* ── Kademeli derinlik bulanıklığı (ProgressiveBlur) ──
     PERFORMANS: yığılı backdrop-filter pahalıdır — tam sahne yerine şerit
     kullan (host'a inset ver) ya da layers'ı 4-6'ya indir. */
  function progressiveBlur(host, opts) {
    opts = opts || {};
    const direction = opts.direction || "bottom";
    const layers = Math.max(opts.layers || 6, 2);
    const intensity = opts.intensity || 0.5;
    const angle = { top: 0, right: 90, bottom: 180, left: 270 }[direction];
    const seg = 1 / (layers + 1);
    for (let i = 0; i < layers; i++) {
      const stops = [i, i + 1, i + 2, i + 3]
        .map((p, j) => `rgba(255,255,255,${j === 1 || j === 2 ? 1 : 0}) ${p * seg * 100}%`)
        .join(", ");
      const layer = document.createElement("div");
      Object.assign(layer.style, {
        position: "absolute", inset: "0", pointerEvents: "none",
        borderRadius: "inherit",
        maskImage: `linear-gradient(${angle}deg, ${stops})`,
        webkitMaskImage: `linear-gradient(${angle}deg, ${stops})`,
        backdropFilter: `blur(${i * intensity}px)`,
        webkitBackdropFilter: `blur(${i * intensity}px)`
      });
      host.appendChild(layer);
    }
  }

  /* ── Kenar kuyruğu kurulumu — CSS yapıyı üretir ── */
  function attachBorderTrail(host) {
    host.classList.add("px-trail-host");
    const t = document.createElement("div"); t.className = "px-trail";
    host.appendChild(t);
  }

  /* ── Deste entegrasyonu: bir slayt etkinleştiğinde çağır ──
     scope içindeki .px-text/.px-inview'ları sıfırlayıp yeniden doğurur,
     data-scramble'ları çözer. Slayt motoruna tek satır bağlanır. */
  function reveal(scope) {
    scope.querySelectorAll(".px-text, .px-inview").forEach(el => {
      el.classList.remove("is-visible");
      void el.offsetWidth;                    /* geçişi yeniden silahla */
      el.classList.add("is-visible");
    });
    scope.querySelectorAll("[data-scramble]").forEach(el => scramble(el));
  }

  /* Otomatik kurulum: işaretli elemanları bul, böl/donat */
  function init(root) {
    root = root || document;
    root.querySelectorAll(".px-text:not([data-split])").forEach(el => {
      el.dataset.split = "1"; splitText(el);
    });
    root.querySelectorAll(".px-shimmer").forEach(el =>
      el.style.setProperty("--spread", el.textContent.length * 2 + "px"));
    root.querySelectorAll("[data-tilt]").forEach(el => attachTilt(el));
    root.querySelectorAll("[data-magnetic]").forEach(el => attachMagnetic(el));
    root.querySelectorAll("[data-border-trail]").forEach(el => attachBorderTrail(el));
    root.querySelectorAll("[data-spotlight]").forEach(el => attachSpotlight(el));
    root.querySelectorAll(".px-marquee").forEach(el =>
      infiniteSlider(el, { speedOnHover: +el.dataset.hoverSpeed || undefined }));
  }

  global.Primitives = {
    createSpring, splitText, scramble, textMorph, animatedNumber,
    slidingNumber, attachSpotlight, attachTilt, attachMagnetic,
    attachBorderTrail, infiniteSlider, progressiveBlur, reveal, init
  };
})(window);
