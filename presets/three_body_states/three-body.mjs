/* three-body.mjs — "Üç-Cisim Durumları" sahnesi (three_body_states). 2B tuval, THREE gerekmez.

   Siyah zemin üzerinde 5×4 pano: her panoda düzlemsel üç-cisim probleminin bir periyodik çözümü canlı entegre
   edilir (three-body-model.mjs, RK4 uyarlanır adım). Her cisim kendi renginde ışıyan bir nokta; ardında sönen
   kuyruklu iz, altında tam periyodun soluk yolu. Renkler üç cisim için sabittir (turuncu · krem · mavi);
   parlaklık toplamsal (ışık kaynağı), dekor yok. Kaotik Pisagor problemi kaçışla biter ve baştan başlar.

   API: const tb = await mountThreeBody(host, { t, speed, labels, autoplay });
        tb.timeline{t, playing, speed, play(), pause(), scrub(t)} · tb.catalog · tb.replay() · tb.setActive(v) · tb.dispose() */

import { CATALOG, sampleOrbit, advance, minDistance } from './three-body-model.mjs';
import { staticMode, Entrance, reveal, palette } from '../core/lab-scene.mjs';

export const BODY_COLORS = ['#ff7a2e', '#f6dfbd', '#8a99ff'];
const RGB = BODY_COLORS.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const rgba = (i, a) => `rgba(${RGB[i][0]},${RGB[i][1]},${RGB[i][2]},${a})`;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function mountThreeBody(host, options = {}) {
  if (!host) throw new Error('mountThreeBody bir kap ister');
  const figure = document.createElement('figure'); figure.className = 'tb';
  figure.innerHTML = `<style>
      .tb{position:relative;margin:0;width:100%;height:100%;overflow:hidden;background:#000;} .tb canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .tb__cap{position:absolute;left:14px;bottom:10px;font:500 11px/1.4 var(--font-body,system-ui);letter-spacing:.06em;color:rgba(255,255,255,.42);pointer-events:none;}
    </style><canvas aria-label="Üç-cisim periyodik çözümleri"></canvas><div class="tb__cap" data-cap></div>`;
  host.appendChild(figure);
  const cv = figure.querySelector('canvas'), ctx = cv.getContext('2d'), capEl = figure.querySelector('[data-cap]');
  const P = palette(figure);
  let showLabels = options.labels ?? false;
  const speed = options.speed ?? .8;                    // zaman birimi / gerçek saniye
  const entrance = new Entrance({ panels: { at: 0, dur: 1.2 } }, { onFrame: () => draw() });

  /* ── panolar ─────────────────────────────────────────────────────────── */
  const panels = CATALOG.map(entry => {
    const m = entry.masses, orbit = entry.chaotic ? null : sampleOrbit(entry, { n: 900 });
    const bb = orbit ? orbit.bbox : { xmin: -3.2, xmax: 3.2, ymin: -3.2, ymax: 3.2 };
    const half = Math.max(bb.xmax - bb.xmin, bb.ymax - bb.ymin) / 2 * 1.12 || 1, cx = (bb.xmin + bb.xmax) / 2, cy = (bb.ymin + bb.ymax) / 2;
    return { entry, m, orbit, half, cx, cy, st: Float64Array.from(entry.state()), t: 0, trail: [[], [], []], tau: entry.chaotic ? 5 : clamp(entry.T * .24, 1.4, 6) };
  });
  const record = p => { for (let b = 0; b < 3; b++) { const tr = p.trail[b]; tr.push([p.st[2 * b], p.st[2 * b + 1], p.t]); while (tr.length && p.t - tr[0][2] > p.tau) tr.shift(); } };
  const stepPanel = (p, dt) => {
    /* kaotik problem: bir cisim kaçınca (uzaklık > 9) ya da 70 birim sonra baştan */
    if (p.entry.chaotic && (p.t > p.entry.T || Math.max(...[0, 1, 2].map(b => Math.hypot(p.st[2 * b], p.st[2 * b + 1]))) > 9)) { p.st = Float64Array.from(p.entry.state()); p.t = 0; p.trail = [[], [], []]; }
    const sub = Math.max(1, Math.ceil(dt / .02)); const h = dt / sub;
    for (let k = 0; k < sub; k++) { advance(p.st, p.m, h, p.entry.chaotic ? { hMax: 1e-3, k: 2e-3 } : { hMax: 2e-3, k: 4e-3 }); p.t += h; record(p); }
  };
  const seekTo = t => { for (const p of panels) { p.st = Float64Array.from(p.entry.state()); p.t = 0; p.trail = [[], [], []]; record(p); let left = t; while (left > 1e-9) { const dt = Math.min(.05, left); stepPanel(p, dt); left -= dt; } } };
  const timeline = { t: 0, playing: false, speed, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = Math.max(0, t); seekTo(this.t); draw(); } };

  /* ── çizim ───────────────────────────────────────────────────────────── */
  let dpr = 1, W = 0, H = 0;
  function layout() { const n = panels.length; const cols = W >= H * 1.05 ? 5 : 4, rows = Math.ceil(n / cols); const pw = W / cols, ph = H / rows; return { cols, rows, pw, ph, s: Math.min(pw, ph) }; }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const L = layout(), pE = entrance.progress('panels');
    panels.forEach((p, i) => {
      const col = i % L.cols, row = Math.floor(i / L.cols), ox = col * L.pw + L.pw / 2, oy = row * L.ph + L.ph / 2, sc = (L.s * .5 * .86) / p.half;
      const X = x => ox + (x - p.cx) * sc, Y = y => oy - (y - p.cy) * sc;
      const a = clamp(pE * panels.length * .5 - i * .35, 0, 1); if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a;
      /* tam periyot yolu: soluk, cisim rengiyle */
      if (p.orbit && p.entry.T < 32) for (let b = 0; b < 3; b++) { const pts = p.orbit.pts[b]; ctx.strokeStyle = rgba(b, .07); ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < pts.length; k++) { const x = X(pts[k][0]), y = Y(pts[k][1]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      /* kuyruklu izler + ışıyan cisimler (toplamsal: ışık kaynağı) */
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let b = 0; b < 3; b++) {
        const tr = p.trail[b]; if (tr.length > 1) { const n = tr.length;
          for (let k = 1; k < n; k++) { const u = k / (n - 1); const x0 = X(tr[k - 1][0]), y0 = Y(tr[k - 1][1]), x1 = X(tr[k][0]), y1 = Y(tr[k][1]); ctx.strokeStyle = rgba(b, .10 * u * u); ctx.lineWidth = 3.6 * u + .8; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = rgba(b, .9 * u * u); ctx.lineWidth = 1.1 * u + .3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } }
        const x = X(p.st[2 * b]), y = Y(p.st[2 * b + 1]), r = 2.6 + .6 * (p.m[b] - 1) ** .5 * (p.m[b] > 1 ? 1 : 0);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 11); g.addColorStop(0, rgba(b, .6)); g.addColorStop(.35, rgba(b, .22)); g.addColorStop(1, rgba(b, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.globalAlpha = a * .95; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = rgba(b, 1); ctx.beginPath(); ctx.arc(x, y, r * .62, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a;
      }
      ctx.globalCompositeOperation = 'source-over';
      if (showLabels) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `500 ${Math.max(9, L.s * .055)}px ${P.body}`; ctx.textAlign = 'center'; ctx.fillText(p.entry.name + (p.entry.chaotic ? ' · kaotik' : ''), ox, oy + L.s * .47); }
      ctx.restore();
    });
    capEl.textContent = showLabels ? `t = ${timeline.t.toFixed(1)} · G = 1 · eşit kütleler (Lagrange 1·2·3 ve Pisagor 3·4·5 hariç) · Šuvakov–Dmitrašinović 2013, Lagrange, Euler, Broucke` : '';
  }
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, cv.clientWidth); H = Math.max(1, cv.clientHeight); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); draw(); }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; if (timeline.playing && entrance.done) { const ds = dt * timeline.speed; timeline.t += ds; for (const p of panels) stepPanel(p, ds); } draw(); if (timeline.playing) ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden && !staticMode()) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(figure);
  reveal(figure);
  if (staticMode() || options.t != null) { timeline.t = options.t ?? 4.5; seekTo(timeline.t); } else if (options.autoplay ?? true) timeline.playing = true;
  resize(); entrance.start(); ensureLoop();
  return {
    timeline, catalog: CATALOG, panels: () => panels.map(p => ({ id: p.entry.id, t: p.t, minDist: minDistance(p.st) })),
    get labels() { return showLabels; }, set labels(v) { showLabels = !!v; draw(); }, replay() { entrance.start(); }, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); figure.remove(); },
  };
}
