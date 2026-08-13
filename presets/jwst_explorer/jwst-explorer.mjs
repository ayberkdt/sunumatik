/* JWST Explorer — gerçek Webb görüntüleri üstünde sinematik keşif
   Bir teleskop görüntüsünü tuvale basar; yumuşak kaydırma/yakınlaşma,
   numaralı ilgi noktaları (iddia altyazılı), ve Webb↔Hubble / NIRCam↔MIRI
   karşılaştırma perdesi sunar. Bağımlılık yok.

   Kullanım:
     import { mountJwstExplorer } from './jwst-explorer.mjs';
     const ex = await mountJwstExplorer(host, { entry, imagesBase });
     ex.goTo(1);            // 1. ilgi noktasına süzül (0 = genel bakış)
     ex.compare(pairEntry); // karşılaştırma perdesini aç
     ex.dispose();

   `entry` images/manifest.json içindeki bir kayıttır. Görüntü kredisi
   (CC BY 4.0 gereği) sağ altta HER ZAMAN görünür — kaldırılamaz.

   Hareket sözleşmesi: prefers-reduced-motion'da kamera sıçrayarak gider,
   sürüklenme yok; html[data-export=true] genel bakış karesinde donar ve
   tüm işaretçiler görünür. Klavye: ←/→ ilgi noktaları, 0 genel bakış,
   C karşılaştırma perdesini imleçle sürükleme yerine ok tuşlarına bağlar. */

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EXPORT = document.documentElement.dataset.export === "true";
const STATIC = REDUCED || EXPORT;

/* Kritik sönümlü yay — kamera hedefe yumuşak yerleşir, sekmez. */
function spring(onUpdate, k = 120, c = 22) {
  let x = 0, v = 0, target = 0, raf = null, last = 0;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    const a = -k * (x - target) - c * v;
    v += a * dt; x += v * dt;
    if (Math.abs(v) < 1e-4 && Math.abs(x - target) < 1e-4) { x = target; v = 0; raf = null; }
    else raf = requestAnimationFrame(tick);
    onUpdate(x);
  }
  return {
    set(t) {
      target = t;
      if (STATIC) { x = t; v = 0; onUpdate(x); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    },
    jump(t) { x = target = t; v = 0; onUpdate(x); },
    get: () => x,
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; }
  };
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => rej(new Error("görüntü yüklenemedi: " + url));
    im.src = url;
  });
}

export async function mountJwstExplorer(host, options = {}) {
  const entry = options.entry;
  if (!entry) throw new Error("options.entry gerekli (manifest kaydı)");
  const base = options.imagesBase ?? new URL("images/", import.meta.url).href;

  /* ── iskele ── */
  host.classList.add("jwstx-host");
  host.innerHTML = "";
  const figure = document.createElement("figure");
  figure.className = "jwstx"; figure.tabIndex = 0;
  figure.setAttribute("role", "application");
  figure.setAttribute("aria-label", (entry.title_tr || entry.target) + " — etkileşimli JWST görüntüsü");
  const cv = document.createElement("canvas");
  const caption = document.createElement("figcaption");
  caption.className = "jwstx__caption"; caption.setAttribute("aria-live", "polite");
  const credit = document.createElement("div");
  credit.className = "jwstx__credit"; credit.textContent = entry.credit || "NASA, ESA, CSA, STScI";
  const hud = document.createElement("div");
  hud.className = "jwstx__hud";
  figure.append(cv, caption, credit, hud);
  host.appendChild(figure);
  injectStyle();

  const ctx = cv.getContext("2d");
  const img = await loadImage(base + entry.file);
  let cmpImg = null, cmpEntry = null, cmpT = 0;      /* karşılaştırma perdesi 0..1 */

  /* ── kamera: görüntü uzayında merkez + ölçek ── */
  let W = 0, H = 0, dpr = 1;
  const cam = { cx: img.width / 2, cy: img.height / 2, s: 1 };
  const minScale = () => Math.min(W / img.width, H / img.height);
  const sx = spring(v => { cam.cx = v; dirty = true; });
  const sy = spring(v => { cam.cy = v; dirty = true; });
  /* Ölçek LOG uzayında yaylanır: iki kat yakınlaşma her seviyede aynı hissettirir. */
  const sz = spring(v => { cam.s = Math.exp(v); dirty = true; });
  const sc = spring(v => { cmpT = v; dirty = true; }, 170, 26);

  let dirty = true, rafId = null, disposed = false;
  function resize() {
    const r = figure.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(2, Math.round(r.width)); H = Math.max(2, Math.round(r.height - 0));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(figure);
  resize();

  function overview() {
    sx.set(img.width / 2); sy.set(img.height / 2);
    sz.set(Math.log(minScale()));
    setCaption(-1);
  }

  /* ── çizim ── */
  function draw() {
    rafId = null;
    if (disposed) return;
    if (!dirty) { schedule(); return; }
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#050608"; ctx.fillRect(0, 0, W, H);
    const s = Math.max(cam.s, 1e-6);
    const ox = W / 2 - cam.cx * s, oy = H / 2 - cam.cy * s;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);
    /* karşılaştırma: perdenin sağı ikinci görüntü */
    if (cmpImg && cmpT > 0.001) {
      const split = W * (1 - cmpT * (1 - hudSplit));
      ctx.save();
      ctx.beginPath(); ctx.rect(split, 0, W - split, H); ctx.clip();
      /* iki görüntü aynı hedefin karesi — aynı kamerayla, kendi piksel
         oranına ölçeklenerek basılır */
      const k = img.width / cmpImg.width;
      ctx.drawImage(cmpImg, ox, oy, cmpImg.width * s * k, cmpImg.height * s * k);
      ctx.restore();
      /* perde çizgisi + tutamaç */
      ctx.strokeStyle = "rgba(244,238,225,.9)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, H); ctx.stroke();
      ctx.fillStyle = "rgba(244,238,225,.9)";
      ctx.beginPath(); ctx.arc(split, H / 2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0F1013"; ctx.font = "600 11px Bahnschrift,'Segoe UI',sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("⇄", split, H / 2 + 0.5);
      /* iki yaka etiketi */
      label(entryLabel(entry), 14, 16, "left");
      label(entryLabel(cmpEntry), W - 14, 16, "right");
    }
    /* ilgi noktaları — karşılaştırma açıkken gizlenir (perde ile yarışmasın) */
    if (!(cmpImg && cmpT > 0.3)) {
      const pois = getPois();
      pois.forEach((p, i) => {
        const px = ox + (p.x / 100) * img.width * s;
        const py = oy + (p.y / 100) * img.height * s;
        if (px < -20 || py < -20 || px > W + 20 || py > H + 20) return;
        const on = i === activePoi;
        ctx.strokeStyle = on ? "#D3B26A" : "rgba(244,238,225,.75)";
        ctx.lineWidth = on ? 2 : 1.2;
        ctx.beginPath(); ctx.arc(px, py, on ? 15 : 11, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = on ? "#D3B26A" : "rgba(15,16,19,.72)";
        ctx.beginPath(); ctx.arc(px, py - (on ? 26 : 21), 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = on ? "#191307" : "#F4EEE1";
        ctx.font = "700 11px Bahnschrift,'Segoe UI',sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), px, py - (on ? 26 : 21) + 0.5);
      });
    }
    schedule();
  }
  function label(text, x, y, align) {
    if (!text) return;
    ctx.font = "600 12px Bahnschrift,'Segoe UI',sans-serif";
    ctx.textAlign = align; ctx.textBaseline = "top";
    const w = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(5,6,8,.62)";
    ctx.fillRect(align === "left" ? x - 6 : x - w - 6, y - 4, w + 12, 22);
    ctx.fillStyle = "rgba(244,238,225,.92)";
    ctx.fillText(text, x, y);
  }
  function entryLabel(e) {
    return e ? (e.instrument || e.title_tr || "") : "";
  }
  function schedule() { if (!rafId && !disposed) rafId = requestAnimationFrame(draw); }
  schedule();

  /* ── ilgi noktaları ── */
  function getPois() { return entry.poi || entry.pois || entry.points || []; }
  let activePoi = -1;
  function setCaption(i) {
    activePoi = i; dirty = true;
    const pois = getPois();
    if (i < 0 || !pois[i]) {
      caption.innerHTML = "<b>" + (entry.title_tr || entry.target) + "</b>" +
        (entry.instrument ? ' <span class="jwstx__inst">' + entry.instrument + "</span>" : "");
      return;
    }
    const p = pois[i];
    caption.innerHTML = '<span class="jwstx__n">' + (i + 1) + "</span><b>" +
      p.label_tr + "</b> — " + (p.note_tr || "");
  }
  function goTo(n) {
    const pois = getPois();
    if (n <= 0 || !pois[n - 1]) { overview(); return; }
    const p = pois[n - 1];
    sx.set((p.x / 100) * img.width);
    sy.set((p.y / 100) * img.height);
    sz.set(Math.log(minScale() * (p.zoom || 3.2)));
    setCaption(n - 1);
  }

  /* ── etkileşim ── */
  let dragging = false, dragCurtain = false, lx = 0, ly = 0, hudSplit = 0.5;
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId);
    const split = W * (1 - cmpT * (1 - hudSplit));
    dragCurtain = cmpImg && cmpT > 0.5 && Math.abs(e.offsetX - split) < 18;
    dragging = true; lx = e.offsetX; ly = e.offsetY;
  });
  cv.addEventListener("pointermove", e => {
    if (!dragging) return;
    if (dragCurtain) {
      /* perde imleci izler: split = W·hudSplit (cmpT=1 iken) */
      hudSplit = Math.min(0.98, Math.max(0.02, e.offsetX / W));
      dirty = true; return;
    }
    const s = cam.s;
    sx.jump(cam.cx - (e.offsetX - lx) / s);
    sy.jump(cam.cy - (e.offsetY - ly) / s);
    lx = e.offsetX; ly = e.offsetY;
  });
  addEventListener("pointerup", () => { dragging = dragCurtain = false; });
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    /* imlece doğru yakınlaş: imlecin görüntü noktası sabit kalır */
    const s0 = cam.s, f = Math.exp(-e.deltaY * 0.0012);
    const s1 = Math.min(minScale() * 40, Math.max(minScale() * 0.9, s0 * f));
    const ix = cam.cx + (e.offsetX - W / 2) / s0;
    const iy = cam.cy + (e.offsetY - H / 2) / s0;
    sz.jump(Math.log(s1));
    sx.jump(ix - (e.offsetX - W / 2) / s1);
    sy.jump(iy - (e.offsetY - H / 2) / s1);
  }, { passive: false });
  cv.addEventListener("dblclick", e => {
    const ix = cam.cx + (e.offsetX - W / 2) / cam.s;
    const iy = cam.cy + (e.offsetY - H / 2) / cam.s;
    sx.set(ix); sy.set(iy); sz.set(Math.log(cam.s * 2.4));
  });
  figure.addEventListener("keydown", e => {
    const pois = getPois();
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(((activePoi + 1) % pois.length) + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(((activePoi - 1 + pois.length) % pois.length) + 1); }
    else if (e.key === "0" || e.key === "Escape") { e.preventDefault(); overview(); }
  });

  /* ── karşılaştırma ── */
  async function compare(pair) {
    if (!pair) { sc.set(0); cmpEntry = null; return; }
    cmpEntry = pair;
    cmpImg = await loadImage(base + pair.file);
    hudSplit = 0.5;
    sc.set(1);
    overview();
  }

  /* ── hud düğmeleri ── */
  const pois = getPois();
  if (pois.length) {
    const ov = hudBtn("◎", "Genel bakış (0)", () => overview());
    hud.appendChild(ov);
    pois.forEach((p, i) => hud.appendChild(hudBtn(String(i + 1), p.label_tr, () => goTo(i + 1))));
  }
  function hudBtn(txt, title, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = txt; b.title = title;
    b.addEventListener("click", fn); return b;
  }

  /* başlangıç: genel bakış; export modunda anında yerleşir */
  sx.jump(img.width / 2); sy.jump(img.height / 2); sz.jump(Math.log(1));
  requestAnimationFrame(() => { resize(); overview(); if (STATIC) { sz.jump(Math.log(minScale())); } });
  setCaption(-1);

  return {
    figure, goTo, overview, compare,
    setSplit(v) { hudSplit = Math.min(0.98, Math.max(0.02, v)); dirty = true; },
    /* Deterministik dışa aktarım / gizli-pencere testi: rAF beklemeden
       mevcut kamera durumunu senkron basar (Sol'un advance() muadili). */
    renderNow() { resize(); dirty = true; draw(); },
    dispose() { disposed = true; ro.disconnect(); sx.stop(); sy.stop(); sz.stop(); sc.stop(); host.innerHTML = ""; }
  };
}

/* Stil bir kez enjekte edilir — palet token'larına saygılı, yoksa koyu varsayılan. */
let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const st = document.createElement("style");
  st.textContent = `
.jwstx{position:relative;margin:0;width:100%;height:100%;min-height:320px;
  border-radius:12px;overflow:hidden;background:#050608;outline:none;
  border:1px solid var(--color-rule,#2E3037)}
.jwstx:focus-visible{border-color:var(--color-accent,#D3B26A)}
.jwstx canvas{position:absolute;inset:0;display:block;cursor:grab}
.jwstx canvas:active{cursor:grabbing}
.jwstx__caption{position:absolute;left:14px;bottom:12px;max-width:62%;
  background:rgba(5,6,8,.72);border-left:3px solid var(--color-accent,#D3B26A);
  color:var(--color-ink,#F4EEE1);padding:9px 13px;border-radius:0 8px 8px 0;
  font:500 14px/1.45 Bahnschrift,'Segoe UI',sans-serif}
.jwstx__caption b{font-weight:700}
.jwstx__inst{opacity:.65;font-size:.85em;letter-spacing:.06em}
.jwstx__n{display:inline-grid;place-items:center;width:18px;height:18px;
  margin-right:8px;border-radius:50%;background:var(--color-accent,#D3B26A);
  color:#191307;font-weight:700;font-size:11px;vertical-align:-3px}
.jwstx__credit{position:absolute;right:10px;bottom:8px;
  color:rgba(244,238,225,.55);font:400 10.5px Bahnschrift,'Segoe UI',sans-serif;
  letter-spacing:.02em;pointer-events:none}
.jwstx__hud{position:absolute;right:10px;top:10px;display:flex;gap:6px}
.jwstx__hud button{width:30px;height:30px;border-radius:8px;cursor:pointer;
  background:rgba(15,16,19,.78);border:1px solid var(--color-rule,#2E3037);
  color:var(--color-ink,#F4EEE1);font:600 13px Bahnschrift,'Segoe UI',sans-serif}
.jwstx__hud button:hover{border-color:var(--color-accent,#D3B26A)}
html[data-export="true"] .jwstx__hud{display:none}`;
  document.head.appendChild(st);
}
