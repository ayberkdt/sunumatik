/* lab-scene.mjs — 2B tuval laboratuvarları için ortak sunum-hareket katmanı.
   Hareket ilkeleri (references/motion-principles.md): zarflı giriş/çıkış, kaskad, tek ana olay, hassas nicelikte
   yay/overshoot yok; reduced-motion ve export'ta son durum. Bu modül ÇİZMEZ, çizimi yöneten araçlar verir:
     - palette(figure): token'lar
     - backdrop(ctx, W, H, {grid}): düz dikey gradyan + çok soluk ızgara (radyal yıkama yok)
     - ease.*: easeOutCubic / easeInOutCubic / smooth
     - Entrance: zamanlanmış giriş sahnesi (0→1 ilerleme; sahneler {at, dur}); reduced/export'ta anında 1
     - Tween: sayısal durum yumuşatıcı (parametre değişince eğriler morf eder), dizi interpolasyonu
     - polyline(ctx, pts, {progress, color, width, alpha, dash, cap}): yay uzunluğuna göre kısmi çizim
     - marker(ctx, x, y, r, color, {ring}): mat nokta + hairline halka (glow yok)
     - comet(ctx, pts, headIndex, {len, color}): iz kuyruğu (parlaklık zarfı)
     - counter(el, value, fmt): HUD sayısı yumuşak sayar (core-motion animateCount)
     - reveal(figure): [data-lab-reveal] kaskadı için --lab-i indeksleri; settle(figure)
   Kullanım: import { Entrance, Tween, polyline, backdrop, ... } from '../core/lab-scene.mjs' */

import { animateCount } from '../motion_core/core-motion.js';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const exporting = () => document.documentElement.dataset.export === 'true';
export const staticMode = () => reducedMotion() || exporting();

export const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  smooth: t => t * t * (3 - 2 * t),
  linear: t => t,
};
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export function palette(el) {
  const css = getComputedStyle(el); const tok = (n, fb) => (css.getPropertyValue(n) || '').trim() || fb;
  return { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'), canvas: tok('--color-canvas', '#0b0c10'), surface: tok('--color-surface', '#15161a'), green: '#8fd39a', violet: '#c9a0e0', mono: 'JetBrains Mono Deck, ui-monospace, monospace', body: 'Source Sans 3 Deck, Inter, system-ui, sans-serif', display: 'Space Grotesk Deck, Inter, system-ui, sans-serif' };
}
export function rgba(hex, a) { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

/** Düz dikey gradyan zemin + soluk ızgara. */
export function backdrop(ctx, W, H, { canvas = '#0b0c10', grid = 0, gridAlpha = .045, pad = { l: 0, r: 0, t: 0, b: 0 } } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, canvas); g.addColorStop(1, shade(canvas, -.35)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (grid > 0) { ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`; ctx.lineWidth = 1; ctx.beginPath(); for (let x = pad.l; x <= W - pad.r; x += grid) { ctx.moveTo(x + .5, pad.t); ctx.lineTo(x + .5, H - pad.b); } for (let y = pad.t; y <= H - pad.b; y += grid) { ctx.moveTo(pad.l, y + .5); ctx.lineTo(W - pad.r, y + .5); } ctx.stroke(); }
}
export function shade(hex, k) { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); const f = v => Math.max(0, Math.min(255, Math.round(v * (1 + k)))); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }

/** Panel başlığı (tuval içi) — display yazı, üstte, hairline altı. */
export function title(ctx, text, x, y, P, { size = 11.5, color = P.muted, tracking = true } = {}) {
  ctx.save(); ctx.font = `600 ${size}px ${P.body}`; ctx.fillStyle = color; if (tracking) ctx.letterSpacing = '.04em'; ctx.textAlign = 'left'; ctx.fillText(text, x, y); ctx.restore();
}
export function label(ctx, text, x, y, P, { size = 10, color = P.muted, align = 'left', mono = true, weight = 400 } = {}) {
  ctx.save(); ctx.font = `${weight} ${size}px ${mono ? P.mono : P.body}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y); ctx.restore();
}

/** Kümülatif yay uzunluğu ile kısmi çizgi: progress ∈ [0,1]. pts: [[x,y],…] (ekran koordinatı). Döner uç noktası. */
export function polyline(ctx, pts, { progress = 1, color = '#fff', width = 1.5, alpha = 1, dash = null, cap = 'round', join = 'round' } = {}) {
  if (!pts || pts.length < 2) return null;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = cap; ctx.lineJoin = join; if (dash) ctx.setLineDash(dash);
  let end = pts[pts.length - 1];
  if (progress >= 1) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
  else if (progress > 0) {
    let total = 0; const seg = new Float64Array(pts.length); for (let i = 1; i < pts.length; i++) { seg[i] = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); total += seg[i]; }
    let want = total * progress, acc = 0; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { if (acc + seg[i] >= want) { const f = seg[i] ? (want - acc) / seg[i] : 0; end = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; ctx.lineTo(end[0], end[1]); break; } acc += seg[i]; ctx.lineTo(pts[i][0], pts[i][1]); }
    ctx.stroke();
  } else end = pts[0];
  ctx.restore(); return end;
}
/** Kuyruklu iz: head indeksinden geriye len nokta, alfa zarfı ile (parlaklık kuyrukta söner). */
export function comet(ctx, pts, head, { len = 40, color = '#fff', width = 2 } = {}) {
  const i1 = Math.max(0, Math.min(pts.length - 1, Math.round(head))), i0 = Math.max(0, i1 - len); if (i1 <= i0) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = i0 + 1; i <= i1; i++) { const t = (i - i0) / (i1 - i0); ctx.globalAlpha = t * t; ctx.lineWidth = width * (.3 + .7 * t); ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
  ctx.restore();
}
/** Mat işaret: dolu nokta + hairline halka; opsiyonel dış halka (vurgu). */
export function marker(ctx, x, y, r, color, { ring = true, alpha = 1, hollow = false, ringAlpha = .35 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); hollow ? ctx.stroke() : ctx.fill();
  if (ring) { ctx.globalAlpha = alpha * ringAlpha; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
/** Ok: yumuşak uçlu (hassas nicelikler için düz). */
export function arrow(ctx, x0, y0, x1, y1, color, { width = 1.6, head = 7, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(a - .4), y1 - head * Math.sin(a - .4)); ctx.lineTo(x1 - head * Math.cos(a + .4), y1 - head * Math.sin(a + .4)); ctx.closePath(); ctx.fill(); ctx.restore();
}
/** Etiket kutusu (mat, hairline). */
export function tag(ctx, text, x, y, P, { color = P.ink, bg = P.surface, size = 10.5, mono = false, anchor = 'left' } = {}) {
  ctx.save(); ctx.font = `500 ${size}px ${mono ? P.mono : P.body}`; const w = ctx.measureText(text).width + 12, h = size + 8; const bx = anchor === 'left' ? x : anchor === 'right' ? x - w : x - w / 2, by = y - h / 2;
  ctx.fillStyle = rgba(bg === P.surface ? '#15161a' : bg, .88); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, by, w, h, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + 6, y + .5); ctx.restore(); return { x: bx, y: by, w, h };
}

/** Giriş sahnesi: stages = { name: { at, dur } } (saniye). progress(name) → 0..1 eased. */
export class Entrance {
  constructor(stages, { onFrame = null, total = null, ease: e = ease.outCubic } = {}) { this.stages = stages; this.onFrame = onFrame; this.ease = e; this.total = total ?? Math.max(...Object.values(stages).map(s => s.at + s.dur)); this.t = staticMode() ? this.total : 0; this._raf = 0; this._last = 0; this.done = staticMode(); }
  progress(name) { const s = this.stages[name]; if (!s) return 1; return this.ease(clamp01((this.t - s.at) / Math.max(1e-6, s.dur))); }
  raw(name) { const s = this.stages[name]; if (!s) return 1; return clamp01((this.t - s.at) / Math.max(1e-6, s.dur)); }
  start() { if (staticMode()) { this.t = this.total; this.done = true; this.onFrame?.(); return this; } this.stop(); this.t = 0; this.done = false; const t0 = performance.now(); const tick = now => { this.t = Math.min(this.total, (now - t0) / 1000); if (this.t >= this.total) this.done = true; this.onFrame?.(); this._raf = this.done ? 0 : requestAnimationFrame(tick); }; this._raf = requestAnimationFrame(tick); return this; }   // duvar saati: sekme gizlenip dönünce doğru ilerlemeye atlar
  finish() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; this.t = this.total; this.done = true; this.onFrame?.(); }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; }
}

/** Sayısal yumuşatıcı: set(target) → değer duration içinde eased ilerler; get() anlık; dizi desteği. */
export class Tween {
  constructor(value, { duration = .55, ease: e = ease.inOutCubic, onFrame = null } = {}) { this.value = value; this.from = value; this.to = value; this.t = 1; this.duration = duration; this.ease = e; this.onFrame = onFrame; this._raf = 0; this._last = 0; }
  static mix(a, b, t) { if (typeof a === 'number') return a + (b - a) * t; if (Array.isArray(a)) { const n = Math.max(a.length, b.length); const out = new Array(n); for (let i = 0; i < n; i++) { const x = a[Math.min(i, a.length - 1)], y = b[Math.min(i, b.length - 1)]; out[i] = Tween.mix(x, y, t); } return out; } if (a && typeof a === 'object') { const out = {}; for (const k of Object.keys(b)) out[k] = k in a ? Tween.mix(a[k], b[k], t) : b[k]; return out; } return t < 1 ? a : b; }
  set(target, { immediate = false } = {}) { if (immediate || staticMode()) { this.value = this.from = this.to = target; this.t = 1; this.onFrame?.(this.value); return; } this.from = this.value; this.to = target; this.t = 0; this._last = performance.now(); if (!this._raf) { const tick = now => { this.t = Math.min(1, this.t + (now - this._last) / 1000 / this.duration); this._last = now; this.value = this.t >= 1 ? this.to : Tween.mix(this.from, this.to, this.ease(this.t)); this.onFrame?.(this.value); this._raf = this.t < 1 ? requestAnimationFrame(tick) : 0; }; this._raf = requestAnimationFrame(tick); } }
  get() { return this.value; } get active() { return this.t < 1; } stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; }
}

/** HUD sayısı: değer değişince yumuşak sayar (statik modda anında). */
const _counts = new WeakMap();
export function counter(el, value, fmt = v => String(Math.round(v)), { duration = 600 } = {}) {
  if (!el) return; const prev = _counts.get(el); _counts.set(el, value);
  if (prev == null || !Number.isFinite(prev) || !Number.isFinite(value) || staticMode() || Math.abs(value - prev) < 1e-12) { el.textContent = fmt(value); return; }
  animateCount(el, prev, value, { duration, format: fmt });
}

/** Kaskad indeksleri: [data-lab-reveal] elemanlarına belge sırasıyla --lab-i verir. */
export function reveal(root) { let i = 0; for (const el of root.querySelectorAll('[data-lab-reveal]')) { if (!el.style.getPropertyValue('--lab-i')) el.style.setProperty('--lab-i', String(i)); i++; } if (staticMode()) document.documentElement.classList.add('lab-settled'); }
export function settle() { document.documentElement.classList.add('lab-settled'); }

/** Zaman dilimlerini basit "ne kadar ilerledi" bandı için: 0..1 ilerlemeye göre alfa zarfı (attack/decay). */
export const envelope = (t, attack = .15, release = .25) => t < attack ? ease.smooth(t / attack) : t > 1 - release ? ease.smooth((1 - t) / release) : 1;
