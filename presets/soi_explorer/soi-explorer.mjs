/* soi-explorer.mjs — Etki Küresi (SOI) Kâşifi sahnesi (soi_explorer), three.js.

   3B (Dünya merkezli, 1 birim = 10 000 km, GERÇEK ölçek): dokulu Dünya + atmosfer ışıması (Rayleigh rim), Ay (doku),
   Ay yörüngesi, AY SOI küresi (66 100 km), DÜNYA SOI küresi (924 000 km, Laplace 2/5 yasası), Hill küresi halkası,
   park yörüngesinden v∞ hedefli KALKIŞ HİPERBOLÜ (Line2, ilerlemeli çizim), craft_blocks sondası, kuyruk; SOI
   kabuğundan geçerken kabuk nabzı (enerji alanı: attack + üstel sönüm) ve "el değiştirme" etiketi. Kamera: soi | moon |
   earth | follow. Yan panel: kahraman HUD + Laplace oran grafiği (log-log: iki bakışın bozucu/ana oranları r_SOI'de
   kesişir) + gezegen SOI ölçek çubuğu (log). Hiçbir sayı elle yerleştirilmez (soi-model.mjs).

   API: const so = await mountSoi(host, { case:'mars', vinf?, hPark?, camera?, autoplay?, t? });
        so.set({...}) · so.model · so.timeline · so.camera · so.replay() · so.dispose()
   Eksen güvenliği: SphereGeometry, RingGeometry, Line2 (silindir/koni yok). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { BODIES, soiRadius, hillRadius, laplaceCrossing, accelRatios, departure, CASES, AU } from './soi-model.mjs';
import { palette, backdrop, polyline, marker, label, title, tag, Entrance, reveal, staticMode, rgba, clamp01 } from '../core/lab-scene.mjs';

const U = 1 / 10000;   // km → sahne birimi
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function loadCraft() { try { const m = await import('../craft_blocks/craft-blocks.mjs'); return m.buildProbe; } catch (e) { console.warn('soi: craft-blocks yok —', e.message); return ({ scale = 1 }) => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(.4 * scale, 12, 8), new THREE.MeshStandardMaterial({ color: '#d9b877' }))); return g; }; } }
async function loadTex(url) { try { return await new THREE.TextureLoader().loadAsync(url); } catch (e) { console.warn('soi: doku yok', url); return null; } }
/* Fresnel kabuk: kenarda parlar, merkezde saydam — "etki küresi" için mat, HUE'lu (beyaz additif değil) */
const shellMaterial = (color, strength = .9) => new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uAlpha: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.FrontSide,
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 uColor; uniform float uStrength; uniform float uAlpha; varying vec3 vN; varying vec3 vV; void main(){ float f = 1. - max(0., dot(normalize(vN), normalize(vV))); float rim = pow(f, 3.2); gl_FragColor = vec4(uColor * (0.35 + 0.65 * rim), (0.045 + 0.5 * rim) * uStrength * uAlpha); }' });

export async function mountSoi(host, options = {}) {
  if (!host) throw new Error('mountSoi bir kap ister');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');
  const figure = document.createElement('figure');
  figure.className = 'soi';
  figure.innerHTML = `
    <style>
      .soi{position:relative;margin:0;width:100%;height:100%;overflow:hidden;display:grid;grid-template-columns:minmax(0,12fr) minmax(0,8fr);background:var(--color-canvas,#0b0c10);color:var(--color-ink,#e9e4d8);}
      .soi__3d{position:relative;min-width:0;min-height:0;} .soi__3d canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
      .soi__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .soi__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-family:var(--font-body);font-size:11.5px;letter-spacing:.05em;color:var(--color-muted,#9a938a);text-shadow:0 1px 4px rgba(0,0,0,.95);}
      .soi__label.body{color:var(--color-ink,#e9e4d8);font-weight:600;} .soi__label.shell{color:#9fd0d8;font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:10.5px;} .soi__label.hand{color:var(--color-accent,#d9b877);font-weight:600;}
      .soi__side{min-width:0;min-height:0;border-left:1px solid var(--lab-rule,#3a3c42);display:grid;grid-template-rows:auto minmax(0,5fr) minmax(0,5fr) minmax(0,3fr);}
      .soi__hud{padding:12px 16px 10px;border-bottom:1px solid var(--lab-rule,#3a3c42);} .soi .lab-hud dl{grid-template-columns:auto 1fr;} .soi .lab-hud__hero .v{font-size:18px;}
      .soi__cell{position:relative;min-height:0;} .soi__cell canvas{position:absolute;inset:0;width:100%;height:100%;display:block;} .soi__cell + .soi__cell{border-top:1px solid var(--lab-rule,#3a3c42);}
    </style>
    <div class="soi__3d" data-lab-reveal="fade"><div class="soi__labels" aria-hidden="true"></div><div class="lab-top" data-top></div></div>
    <div class="soi__side">
      <div class="soi__hud lab-hud" role="status" data-lab-reveal>
        <div class="lab-hud__hero">
          <div><span class="k">Dünya r_SOI</span><span class="v hi" data-h="rsoi">—</span></div>
          <div><span class="k">SOI’ye süre</span><span class="v hi" data-h="tsoi">—</span></div>
          <div><span class="k">ΔV enjeksiyon</span><span class="v" data-h="dv">—</span></div>
          <div><span class="k">Güneş çerçevesi</span><span class="v" data-h="helio">—</span></div>
        </div>
        <dl>
          <dt>Hill küresi</dt><dd data-h="hill">—</dd><dt>Ay r_SOI</dt><dd data-h="moon">—</dd>
          <dt>v∞ · e · sapma</dt><dd data-h="hyp">—</dd><dt>SOI’de |v| − v∞</dt><dd data-h="res">—</dd>
          <dt>Laplace geçişi (sayısal)</dt><dd data-h="lap">—</dd><dt>t · konum</dt><dd data-h="t">—</dd>
        </dl>
        <div class="lab-legend" data-legend></div>
      </div>
      <div class="soi__cell" data-lab-reveal="fade"><canvas data-plot="laplace" aria-label="Laplace oran grafiği"></canvas></div>
      <div class="soi__cell" data-lab-reveal="fade"><canvas data-plot="helio" aria-label="Güneş çerçevesi yörünge görünümü"></canvas></div>
      <div class="soi__cell" data-lab-reveal="fade"><canvas data-plot="scale" aria-label="Gezegen SOI ölçeği"></canvas></div>
    </div>`;
  host.appendChild(figure);
  const pane3d = figure.querySelector('.soi__3d'), labelLayer = figure.querySelector('.soi__labels'), topEl = figure.querySelector('[data-top]'), legendEl = figure.querySelector('[data-legend]');
  const H = {}; for (const el of figure.querySelectorAll('[data-h]')) H[el.dataset.h] = el;
  const plots = {}; for (const cv of figure.querySelectorAll('[data-plot]')) plots[cv.dataset.plot] = cv;
  const P = palette(figure);
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nf3 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  legendEl.innerHTML = `<span><i style="background:#9fd0d8"></i>Dünya etki küresi</span><span><i style="background:#c9b9a0"></i>Ay etki küresi</span><span><i style="background:${P.accent}"></i>kalkış hiperbolü · sonda</span><span><i style="background:${P.data2}"></i>Hill küresi</span>`;

  /* ── three ─────────────────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = THREE.SRGBColorSpace;
  pane3d.insertBefore(renderer.domElement, pane3d.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#06070b');
  const camera = new THREE.PerspectiveCamera(36, 1, .02, 20000);
  const sunDir = new THREE.Vector3(-.85, .25, .45).normalize();
  const sun = new THREE.DirectionalLight('#fff3df', 2.6); sun.position.copy(sunDir).multiplyScalar(3000); scene.add(sun);
  scene.add(new THREE.AmbientLight('#2a3140', .9)); scene.add(new THREE.HemisphereLight('#9fb8d8', '#3a2f26', .7));
  { const rand = mulberry32(options.seed ?? 11), n = reducedMotion ? 700 : 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 9000 + rand() * 3000, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); const w = .6 + rand() * .5, tint = rand(); col[i * 3] = w * (tint < .2 ? .85 : 1); col[i * 3 + 1] = w * (tint < .2 ? .9 : tint > .8 ? .92 : 1); col[i * 3 + 2] = w * (tint > .8 ? .8 : 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: .9, sizeAttenuation: false, transparent: true, opacity: .75, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); }
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .07;
  const lineMats = []; const lineMat = (color, width, opacity, dashed = false) => { const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true, dashed, dashSize: 1.2, gapSize: .8 }); lineMats.push(m); return m; };
  const mkLine = (flat, mat) => { const g = new LineGeometry(); g.setPositions(flat); const l = new Line2(g, mat); if (mat.dashed) l.computeLineDistances(); return l; };
  const labels = []; const addLabel = (text, cls, pos, key) => { const el = document.createElement('div'); el.className = `soi__label ${cls}`; el.textContent = text; labelLayer.appendChild(el); const rec = { el, pos, key }; labels.push(rec); return rec; };
  const [earthTex, moonTex, buildProbe] = await Promise.all([loadTex('../earth_advanced/textures/earth_atmos_2048.jpg'), loadTex('../moon_react_source/public/lunaris/textures/aesthetic_moon_real.webp'), loadCraft()]);
  if (earthTex) earthTex.colorSpace = THREE.SRGBColorSpace; if (moonTex) moonTex.colorSpace = THREE.SRGBColorSpace;

  const E = BODIES.earth, M = BODIES.moon, rE = E.R * U, rM = M.R * U, rSoiE = soiRadius('earth') * U, rHill = hillRadius('earth') * U, rSoiM = soiRadius('moon') * U, aMoon = M.a * U;
  /* Dünya + atmosfer ışıması */
  const earth = new THREE.Mesh(new THREE.SphereGeometry(rE, 64, 48), new THREE.MeshStandardMaterial({ map: earthTex || null, color: earthTex ? '#ffffff' : '#3d6fa8', roughness: .85, metalness: 0 })); scene.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(rE * 1.035, 64, 48), shellMaterial('#6fb4ff', 1.6)); scene.add(atmo);
  /* Ay + yörüngesi + SOI'si (Ay sabit fazda: kalkış anındaki konumu; Ay yörünge hareketi bu sahnede modellenmez) */
  const moonGroup = new THREE.Group(); scene.add(moonGroup);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(rM, 48, 32), new THREE.MeshStandardMaterial({ map: moonTex || null, color: moonTex ? '#ffffff' : '#a9a49b', roughness: .95 })); moonGroup.add(moon);
  const moonShell = new THREE.Mesh(new THREE.SphereGeometry(rSoiM, 48, 32), shellMaterial('#c9b9a0', .9)); moonGroup.add(moonShell);
  const moonPhase = options.moonPhase ?? 2.2; moonGroup.position.set(aMoon * Math.cos(moonPhase), 0, -aMoon * Math.sin(moonPhase));
  { const pts = []; for (let k = 0; k <= 180; k++) { const a = Math.PI * 2 * k / 180; pts.push(aMoon * Math.cos(a), 0, -aMoon * Math.sin(a)); } scene.add(mkLine(pts, lineMat('#a9a49b', 1, .35))); }
  /* Dünya SOI ve Hill */
  const soiShell = new THREE.Mesh(new THREE.SphereGeometry(rSoiE, 64, 48), shellMaterial('#5fc4d4', .75)); scene.add(soiShell);
  const soiBack = new THREE.Mesh(new THREE.SphereGeometry(rSoiE, 64, 48), new THREE.MeshBasicMaterial({ color: '#0e2a33', transparent: true, opacity: .11, side: THREE.BackSide, depthWrite: false })); scene.add(soiBack);
  /* SOI kabuğu üstünde ince enlem/boylam ağı (1 px, düşük opaklık): sınırın bir yüzey olduğunu okutur, dekor değil */
  const soiGrid = (() => { const v = []; const seg = 96; for (let m = 0; m < 12; m++) { const lon = Math.PI * m / 12; for (let k = 0; k < seg; k++) { const a0 = Math.PI * 2 * k / seg, a1 = Math.PI * 2 * (k + 1) / seg; v.push(rSoiE * Math.cos(a0) * Math.cos(lon), rSoiE * Math.sin(a0), -rSoiE * Math.cos(a0) * Math.sin(lon), rSoiE * Math.cos(a1) * Math.cos(lon), rSoiE * Math.sin(a1), -rSoiE * Math.cos(a1) * Math.sin(lon)); } }
    for (const lat of [-60, -30, 30, 60]) { const r = rSoiE * Math.cos(lat * Math.PI / 180), y = rSoiE * Math.sin(lat * Math.PI / 180); for (let k = 0; k < seg; k++) { const a0 = Math.PI * 2 * k / seg, a1 = Math.PI * 2 * (k + 1) / seg; v.push(r * Math.cos(a0), y, -r * Math.sin(a0), r * Math.cos(a1), y, -r * Math.sin(a1)); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#5fc4d4', transparent: true, opacity: .1, depthWrite: false })); scene.add(l); return l; })();
  /* SOI geçiş halkası: kabuk üstünde, radyal eksenli, nabızla genişleyip sönen (tek olay, sönümlü) */
  const crossRing = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 72), new THREE.MeshBasicMaterial({ color: '#b8f0f8', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); scene.add(crossRing);
  { const pts = []; for (let k = 0; k <= 240; k++) { const a = Math.PI * 2 * k / 240; pts.push(rHill * Math.cos(a), 0, -rHill * Math.sin(a)); } const hillLine = mkLine(pts, lineMat(P.data2, 1.2, .55, true)); scene.add(hillLine); }
  { const pts = []; for (let k = 0; k <= 240; k++) { const a = Math.PI * 2 * k / 240; pts.push(rSoiE * Math.cos(a), 0, -rSoiE * Math.sin(a)); } scene.add(mkLine(pts, lineMat('#5fc4d4', 1, .5))); }
  addLabel('Dünya', 'body', new THREE.Vector3(0, rE * 1.6, 0)); addLabel('Ay', 'body', new THREE.Vector3(0, rM * 2.4, 0), 'moon'); addLabel('Ay etki küresi', 'shell', new THREE.Vector3(0, rSoiM * 1.08, 0), 'moonShell');
  addLabel('Dünya etki küresi', 'shell', new THREE.Vector3(-rSoiE * .58, rSoiE * .8, 0)); addLabel('Güneş yönü →', 'shell', sunDir.clone().multiplyScalar(rSoiE * 1.3)); addLabel('Hill küresi', 'shell', new THREE.Vector3(rHill * .72, 0, -rHill * .72));
  /* hiperbol + sonda */
  const hypGroup = new THREE.Group(); scene.add(hypGroup);
  const probe = buildProbe({ scale: 1 }); scene.add(probe); probe.visible = false;
  /* ışıma noktaları: SOI ölçeğinde Dünya (6 378 km) ve Ay tek piksele iner — kamera uzaklığıyla ölçeklenen yumuşak ışıma onları okunur tutar */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(255,255,255,.55)'); r.addColorStop(.5, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mkGlow = (color, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, depthTest: false })); sp.renderOrder = 5; scene.add(sp); return sp; };
  const earthGlow = mkGlow('#9fc4ea', .85), moonGlow = mkGlow('#d8d2c6', .6); moonGlow.position.copy(moonGroup.position);
  const sunGlow = mkGlow('#ffe6bd', .95); sunGlow.position.copy(sunDir).multiplyScalar(7000); sunGlow.scale.setScalar(760); sunGlow.renderOrder = -5;
  /* gün işaretleri: hiperbol üstünde 1., 2., 3. gün — zamanın okunması (yeniden kurulumda temizlenir) */
  const dayMarks = []; const removeLabel = rec => { rec.el.remove(); const i = labels.indexOf(rec); if (i >= 0) labels.splice(i, 1); };
  const nMoon = Math.sqrt(E.mu / (M.a * M.a * M.a));   // Ay ortalama hareketi (rad/s), dairesel yörünge
  const handLabel = addLabel('el değiştirme · Dünya → Güneş çerçevesi', 'hand', new THREE.Vector3(), 'hand'); handLabel.el.style.opacity = '0';

  let cfg = { case: options.case ?? 'mars', vinf: options.vinf ?? null, hPark: options.hPark ?? 200 }, model = null, hypLine = null, asymLine = null, hypPts = [];
  const cam = { current: options.camera ?? 'soi' }; const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const timeline = { t: 0, duration: 1, playing: false, warp: options.warp ?? 6, play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; }, scrub(t) { this.t = clamp(t, 0, this.duration); render(0); } };
  const entrance = new Entrance({ bodies: { at: 0, dur: .7 }, shells: { at: .4, dur: 1.0 }, hyp: { at: 1.1, dur: 1.2 }, probe: { at: 2.0, dur: .4 }, laplace: { at: .8, dur: 1.2 } }, { onFrame: () => render(0) });
  let pulse = 0;   // SOI geçiş nabzı (enerji alanı: sönümlü)
  function rebuild() {
    const vinf = cfg.vinf ?? CASES[cfg.case].vinf; model = departure('earth', { hPark: cfg.hPark, vinf, n: 400 });
    while (hypGroup.children.length) { const c = hypGroup.children.pop(); c.geometry?.dispose?.(); }
    /* hiperbol düzlemi: Ay yörünge düzlemi (x–z), asimptot +x'e doğru; sondanın kalkışı gösterim amaçlı */
    const rot = -model.nuInf; hypPts = model.pts.map(p => { const x = p.x * Math.cos(rot) - p.y * Math.sin(rot), y = p.x * Math.sin(rot) + p.y * Math.cos(rot); return [x * U, 0, -y * U, p.t]; });
    const flat = hypPts.flatMap(p => [p[0], p[1], p[2]]);
    /* hız ile renk: perigee'de beyaz-sıcak, SOI'ye yaklaşırken sönük amber — hızın konumla nasıl düştüğü çizginin kendisinde */
    { const vLo = model.vAtSoi, vHi = model.vPeri, cA = new THREE.Color('#7a5a30'), cB = new THREE.Color(P.accent), cC = new THREE.Color('#fff3d6'), cols = [];
      for (const q of model.pts) { const u = Math.sqrt(clamp01((q.v - vLo) / Math.max(1e-9, vHi - vLo))); const c = u < .5 ? cA.clone().lerp(cB, u * 2) : cB.clone().lerp(cC, (u - .5) * 2); cols.push(c.r, c.g, c.b); }
      const hm = lineMat('#ffffff', 2.6, 1); hm.vertexColors = true; const g = new LineGeometry(); g.setPositions(flat); g.setColors(cols); hypLine = new Line2(g, hm); hypGroup.add(hypLine); }
    for (const d of dayMarks) { scene.remove(d.mesh); d.mesh.geometry.dispose(); removeLabel(d.rec); } dayMarks.length = 0;
    for (let day = 1; day * 86400 < model.tSoiDays * 86400; day++) { const pos = stateAt(day * 86400).p; const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: P.ink, transparent: true, opacity: .9 })); mesh.position.copy(pos); scene.add(mesh); const rec = addLabel(`${day}. gün`, '', pos.clone().add(new THREE.Vector3(0, -rSoiE * .045, 0))); dayMarks.push({ mesh, rec }); }
    { const last = hypPts[hypPts.length - 1]; crossRing.position.set(last[0], 0, last[2]); crossRing.lookAt(0, 0, 0); }
    const last = hypPts[hypPts.length - 1], dir = new THREE.Vector3(last[0] - hypPts[hypPts.length - 6][0], 0, last[2] - hypPts[hypPts.length - 6][2]).normalize();
    asymLine = mkLine([last[0], 0, last[2], last[0] + dir.x * rSoiE * .5, 0, last[2] + dir.z * rSoiE * .5], lineMat(P.accent, 1.4, .5, true)); hypGroup.add(asymLine);
    { const pts = []; for (let k = 0; k <= 120; k++) { const a = Math.PI * 2 * k / 120; pts.push(model.rp * U * Math.cos(a), 0, -model.rp * U * Math.sin(a)); } hypGroup.add(mkLine(pts, lineMat(P.data1, 1, .5))); }
    timeline.duration = model.tSoiDays * 86400 * 1.25; if (timeline.t > timeline.duration) timeline.t = 0;
    writeHud(); resize(); scaleCamera(true); drawPanels();
  }
  function writeHud() {
    const m = model; H.rsoi.innerHTML = `${nf0.format(soiRadius('earth'))}<span class="u">km</span>`; H.tsoi.innerHTML = `${nf2.format(m.tSoiDays)}<span class="u">gün</span>`; H.dv.innerHTML = `${nf3.format(m.dvInject)}<span class="u">km/s</span>`;
    H.helio.innerHTML = m.helio.hyperbolic ? `kaçış<span class="u">e ${nf2.format(m.helio.e)}</span>` : `${nf2.format(m.helio.aphelion / AU)}<span class="u">AU afel</span>`;
    H.hill.textContent = `${nf0.format(hillRadius('earth'))} km`; H.moon.textContent = `${nf0.format(soiRadius('moon'))} km`; H.hyp.textContent = `${nf2.format(cfg.vinf ?? CASES[cfg.case].vinf)} km/s · e ${nf3.format(m.e)} · δ ${nf1.format(m.turnDeg)}°`;
    H.res.textContent = `${nf3.format(m.residual)} km/s · ${nf1.format(m.residualPct)} %`; H.lap.textContent = `${nf0.format(laplaceCrossing('earth') / 1000)}e3 km · ${nf2.format(laplaceCrossing('earth') / soiRadius('earth'))} r_SOI`;
    topEl.textContent = `Dünya merkezli, gerçek ölçek (1 birim = 10 000 km) · r_SOI = a(m/M)^(2/5) · Hill = a(m/3M)^(1/3) · ${CASES[cfg.case].label} · park ${cfg.hPark} km · Ay ortalama hareketle ilerler, hiperbol Ay çekimini içermez`;
  }
  const stateAt = t => { const s = t; let i = 0; while (i < hypPts.length - 2 && hypPts[i + 1][3] < s) i++; if (s >= hypPts[hypPts.length - 1][3]) { const last = hypPts[hypPts.length - 1], prev = hypPts[hypPts.length - 6]; const d = new THREE.Vector3(last[0] - prev[0], 0, last[2] - prev[2]).normalize(); const dt = s - last[3]; const v = model.vAtSoi * U; return { p: new THREE.Vector3(last[0] + d.x * v * dt, 0, last[2] + d.z * v * dt), beyond: true }; } const a = hypPts[i], b = hypPts[i + 1], f = (s - a[3]) / Math.max(1e-9, b[3] - a[3]); return { p: new THREE.Vector3(a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f), beyond: false }; };
  function scaleCamera(snap) { const d = cam.current === 'soi' ? rSoiE * 3.1 : cam.current === 'moon' ? rSoiM * 4 : cam.current === 'earth' ? rE * 14 : rSoiE * .9; const tgt = cam.current === 'moon' ? moonGroup.position.clone() : cam.current === 'follow' ? stateAt(timeline.t).p : new THREE.Vector3(0, 0, 0); const p = tgt.clone().add(new THREE.Vector3(-.55 * d, .62 * d, .68 * d)); if (snap) { camPos.copy(p); camTgt.copy(tgt); controls.target.copy(tgt); } return { p, tgt }; }
  function updateCamera(dtReal) { if (cam.current === 'free') { controls.enabled = true; controls.update(); return; } controls.enabled = false; const { p, tgt } = scaleCamera(false); const k = dtReal > 0 ? 1 - Math.exp(-dtReal * 3.5) : (reducedMotion || exportMode ? 1 : 0); camPos.lerp(p, k); camTgt.lerp(tgt, k); camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(camTgt); controls.target.copy(camTgt); }

  /* ── yan paneller ─────────────────────────────────────────────────────── */
  let dpr = 1;
  function drawLaplace() {
    const cv = plots.laplace, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas });
    const pad = { l: 54, r: 14, t: 26, b: 30 }, pw = W - pad.l - pad.r, ph = Hh - pad.t - pad.b, pL = entrance.progress('laplace');
    title(ctx, 'Laplace ölçütü · bozucu / ana ivme oranları (log–log) — kesişim: etki küresi', pad.l, 15, P);
    const rLo = 2e4, rHi = 5e6, X = r => pad.l + Math.log10(r / rLo) / Math.log10(rHi / rLo) * pw; const geo = [], hel = []; let yLo = 1e9, yHi = -1e9;
    for (let k = 0; k <= 160; k++) { const r = rLo * Math.pow(rHi / rLo, k / 160), q = accelRatios('earth', r); geo.push([r, q.geo]); hel.push([r, q.helio]); yLo = Math.min(yLo, q.geo, q.helio); yHi = Math.max(yHi, q.geo, q.helio); }
    const Y = v => pad.t + ph - (Math.log10(v) - Math.log10(yLo)) / (Math.log10(yHi) - Math.log10(yLo)) * ph;
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; for (const r of [5e4, 1e5, 5e5, 1e6]) { ctx.beginPath(); ctx.moveTo(X(r), pad.t); ctx.lineTo(X(r), pad.t + ph); ctx.stroke(); label(ctx, `${r / 1000}e3`, X(r), Hh - 19, P, { align: 'center' }); }
    for (const v of [1e-4, 1e-2, 1, 1e2]) if (v > yLo && v < yHi) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(pad.l + pw, Y(v)); ctx.stroke(); label(ctx, v.toExponential(0), pad.l - 6, Y(v) + 3, P, { align: 'right' }); }
    polyline(ctx, geo.map(p => [X(p[0]), Y(p[1])]), { progress: pL, color: '#5fc4d4', width: 1.6 }); polyline(ctx, hel.map(p => [X(p[0]), Y(p[1])]), { progress: pL, color: P.data2, width: 1.6 });
    const rs = soiRadius('earth'), rl = laplaceCrossing('earth'), rh = hillRadius('earth');
    if (pL > .9) { ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(P.accent, .8); ctx.beginPath(); ctx.moveTo(X(rs), pad.t); ctx.lineTo(X(rs), pad.t + ph); ctx.stroke(); ctx.strokeStyle = rgba(P.data2, .6); ctx.beginPath(); ctx.moveTo(X(rh), pad.t); ctx.lineTo(X(rh), pad.t + ph); ctx.stroke(); ctx.restore();
      marker(ctx, X(rl), Y(accelRatios('earth', rl).geo), 4.5, P.ink); tag(ctx, `r_SOI ${nf0.format(rs / 1000)}e3 km`, X(rs) + 6, pad.t + 14, P, { color: P.accent, mono: true }); tag(ctx, `sayısal kesişim ${nf0.format(rl / 1000)}e3`, X(rl) - 6, Y(accelRatios('earth', rl).geo) + 18, P, { mono: true, anchor: 'right' }); tag(ctx, 'Hill', X(rh) + 6, pad.t + 34, P, { color: P.data2 }); }
    label(ctx, 'Dünya çerçevesi: Güneş gelgiti / Dünya çekimi', pad.l + 6, Y(geo[20][1]) - 8, P, { mono: false, size: 10.5, color: '#5fc4d4' }); label(ctx, 'Güneş çerçevesi: Dünya çekimi / Güneş çekimi', pad.l + 6, Y(hel[20][1]) + 14, P, { mono: false, size: 10.5, color: P.data2 });
    label(ctx, 'Dünya’dan uzaklık (km)', pad.l + pw / 2, Hh - 6, P, { align: 'center', mono: false, size: 10.5 });
  }
  function drawScale() {
    const cv = plots.scale, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas });
    const ids = ['moon', 'mercury', 'mars', 'venus', 'earth', 'uranus', 'neptune', 'saturn', 'jupiter']; const pad = { l: 64, r: 14, t: 24, b: 8 }, pw = W - pad.l - pad.r, bh = Math.min(16, (Hh - pad.t - pad.b) / ids.length - 3), pL = entrance.progress('laplace');
    title(ctx, 'etki küresi yarıçapları (log ölçek) — hepsi a(m/M)^(2/5)', pad.l, 15, P);
    const lo = 3e4, hi = 1.6e8, X = r => pad.l + Math.log10(r / lo) / Math.log10(hi / lo) * pw;
    ids.forEach((id, i) => { const r = soiRadius(id), y = pad.t + 4 + i * (bh + 3), w = (X(r) - pad.l) * pL; ctx.fillStyle = id === 'earth' ? P.accent : rgba(BODIES[id].color, .8); ctx.fillRect(pad.l, y, Math.max(1, w), bh); label(ctx, BODIES[id].label, pad.l - 6, y + bh * .75, P, { align: 'right', mono: false, size: 10.5, color: id === 'earth' ? P.ink : P.muted }); if (pL > .9) { const txt = `${r >= 1e6 ? nf1.format(r / 1e6) + ' M' : nf0.format(r / 1000) + ' e3'} km`; const inside = pad.l + w + 70 > W; label(ctx, txt, inside ? pad.l + w - 6 : pad.l + w + 6, y + bh * .75, P, { size: 9.5, align: inside ? 'right' : 'left', color: inside ? P.canvas : P.muted, weight: inside ? 600 : 400 }); } });
  }
  function drawHelio() {
    const cv = plots.helio, ctx = cv.getContext('2d'), W = cv.clientWidth, Hh = cv.clientHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx, W, Hh, { canvas: P.canvas }); if (!model || W < 60 || Hh < 70) return;
    const h = model.helio, pL = entrance.progress('laplace'), pH = entrance.progress('hyp');
    const target = cfg.case === 'jupiter' ? 'jupiter' : cfg.case === 'mars' ? 'mars' : null;
    const rMax = (h.hyperbolic ? 5.6 * AU : Math.max(h.aphelion, target ? BODIES[target].a : AU) * 1.18);
    const cx = W / 2, cy = Hh / 2 + 6, S = Math.min(W, Hh - 30) * .47 / rMax, X = (r, th) => cx + r * Math.cos(th) * S, Y = (r, th) => cy - r * Math.sin(th) * S;
    title(ctx, `Güneş çerçevesi · V_⊕ + v∞ = ${nf2.format(h.v)} km/s → ${h.hyperbolic ? 'hiperbolik: Güneş sisteminden kaçış' : `afel ${nf2.format(h.aphelion / AU)} AU`}`, 12, 15, P);
    /* Güneş: ışıma */ { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26); g.addColorStop(0, 'rgba(255,238,200,1)'); g.addColorStop(.25, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill(); }
    for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn']) { const B = BODIES[id]; if (B.a * S > Math.min(W, Hh) * .62) continue; const isT = id === target || id === 'earth'; ctx.beginPath(); ctx.arc(cx, cy, B.a * S, 0, Math.PI * 2); ctx.strokeStyle = rgba(B.color, isT ? .75 : .28); ctx.lineWidth = isT ? 1.2 : .8; ctx.stroke(); if (isT || id === 'jupiter' || id === 'saturn') label(ctx, B.label, cx + B.a * S * .707 + 4, cy - B.a * S * .707 - 4, P, { mono: false, size: 10, color: rgba(B.color, isT ? 1 : .6) }); }
    /* transfer: perihel Dünya'da (θ = 0), prograd; eliptikse afele kadar, hiperbolikse asimptota yakın */
    const aH = h.a, eH = h.e, pp = h.hyperbolic ? -aH * (eH * eH - 1) : aH * (1 - eH * eH), thMax = h.hyperbolic ? Math.acos(-1 / eH) - .06 : Math.PI; const pts = [];
    for (let k = 0; k <= 160; k++) { const th = thMax * k / 160, r = pp / (1 + eH * Math.cos(th)); if (r * S > Math.hypot(W, Hh)) break; pts.push([X(r, th), Y(r, th)]); }
    if (!h.hyperbolic) { const rest = []; for (let k = 0; k <= 120; k++) { const th = Math.PI + Math.PI * k / 120, r = pp / (1 + eH * Math.cos(th)); rest.push([X(r, th), Y(r, th)]); } polyline(ctx, rest, { progress: pL, color: P.accent, width: 1, alpha: .3, dash: [3, 5] }); }
    polyline(ctx, pts, { progress: pL, color: P.accent, width: 2 });
    marker(ctx, X(AU, 0), Y(AU, 0), 4, BODIES.earth.color, { ring: true }); tag(ctx, 'Dünya · kalkış', X(AU, 0) + 8, Y(AU, 0) + 14, P, { color: BODIES.earth.color });
    { const L = 26, x0 = X(AU, 0), y0 = Y(AU, 0); ctx.strokeStyle = rgba(P.ink, .8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - L); ctx.lineTo(x0 - 4, y0 - L + 6); ctx.moveTo(x0, y0 - L); ctx.lineTo(x0 + 4, y0 - L + 6); ctx.stroke(); label(ctx, 'v∞ ∥ V_⊕', x0 + 8, y0 - L + 4, P, { size: 9.5 }); }
    if (!h.hyperbolic && pL > .9) { marker(ctx, X(h.aphelion, Math.PI), Y(h.aphelion, Math.PI), 3.5, P.accent); tag(ctx, `afel ${nf2.format(h.aphelion / AU)} AU${target ? ` · ${BODIES[target].label} yörüngesi ${nf2.format(BODIES[target].a / AU)} AU` : ''}`, X(h.aphelion, Math.PI) + 8, Y(h.aphelion, Math.PI) + 16, P, { color: P.accent, mono: true }); }
    if (h.hyperbolic && pL > .9) { const q = pts[Math.floor(pts.length * .8)]; if (q) tag(ctx, `e = ${nf2.format(eH)} · kaçış`, q[0] + 8, q[1], P, { color: P.accent, mono: true }); }
    label(ctx, 'ölçek: AU · dairesel gezegen yörüngeleri · fazlama yok', 12, Hh - 8, P, { mono: false, size: 9.5 });
  }
  function drawPanels() { drawLaplace(); drawHelio(); drawScale(); }

  /* ── render ────────────────────────────────────────────────────────────── */
  const _c = new THREE.Vector3(); let lastBeyond = false;
  function render(dtReal) {
    if (!model) return;
    const pB = entrance.progress('bodies'), pS = entrance.progress('shells'), pH = entrance.progress('hyp'), pP = entrance.progress('probe');
    earth.material.transparent = true; earth.material.opacity = pB; moon.material.transparent = true; moon.material.opacity = pB; atmo.material.uniforms.uAlpha.value = pB;
    const sc = .001 + .999 * pS; soiShell.scale.setScalar(sc); soiBack.scale.setScalar(sc); moonShell.scale.setScalar(sc); soiGrid.scale.setScalar(sc); soiGrid.material.opacity = .1 * pS * clamp01((camera.position.length() - rSoiE * 1.2) / (rSoiE * .9));
    { const a = moonPhase + nMoon * timeline.t; moonGroup.position.set(aMoon * Math.cos(a), 0, -aMoon * Math.sin(a)); moonGlow.position.copy(moonGroup.position); moon.rotation.y = a + Math.PI; earth.rotation.y = Math.PI * 2 * timeline.t / 86164; }
    crossRing.material.opacity = .9 * pulse; crossRing.scale.setScalar(rSoiE * (.05 + .3 * (1 - pulse)));
    soiShell.material.uniforms.uAlpha.value = 1 + 1.4 * pulse; soiShell.material.uniforms.uStrength.value = .75 + .9 * pulse;
    if (hypLine) { hypLine.geometry.instanceCount = Math.max(0, Math.floor((hypPts.length - 1) * pH)); asymLine.material.opacity = .5 * (pH >= 1 ? 1 : 0); }
    const st = stateAt(timeline.t); probe.visible = pP > 0 && pH >= 1; probe.position.copy(st.p); probe.rotation.y += dtReal * .4;
    if (st.beyond && !lastBeyond && timeline.playing) pulse = 1; lastBeyond = st.beyond; pulse *= Math.exp(-dtReal * 1.6);
    handLabel.pos.copy(st.p).add(new THREE.Vector3(0, rSoiE * .06, 0)); handLabel.el.style.opacity = st.beyond ? String(Math.min(1, .35 + pulse)) : '0';
    for (const l of labels) { if (l.key === 'moon') l.pos.copy(moonGroup.position).add(new THREE.Vector3(0, rM * 2.4, 0)); if (l.key === 'moonShell') l.pos.copy(moonGroup.position).add(new THREE.Vector3(0, rSoiM * 1.08, 0)); }
    updateCamera(dtReal);
    { const dE = camera.position.length(), dM = camera.position.distanceTo(moonGroup.position), dP = camera.position.distanceTo(probe.position);
      earthGlow.scale.setScalar(Math.max(rE * 3, dE * .028)); earthGlow.material.opacity = .85 * pB * clamp01((dE - rE * 20) / (rE * 40)); moonGlow.scale.setScalar(Math.max(rM * 3, dM * .016)); moonGlow.material.opacity = .6 * pB * clamp01((dM - rM * 20) / (rM * 40));
      probe.scale.setScalar(Math.max(rE * 1.2, dP * .045));
      for (const d of dayMarks) { d.mesh.visible = pH >= 1; d.rec.el.style.display = pH >= 1 ? '' : 'none'; d.mesh.scale.setScalar(Math.max(rE * .25, camera.position.distanceTo(d.mesh.position) * .0032)); } }
    const w = pane3d.clientWidth, h = pane3d.clientHeight;
    for (const l of labels) { _c.copy(l.pos).project(camera); const vis = _c.z < 1 && Math.abs(_c.x) < 1.05 && Math.abs(_c.y) < 1.05; l.el.style.display = vis ? '' : 'none'; if (vis) { l.el.style.left = `${((_c.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _c.y) / 2 * h).toFixed(1)}px`; } }
    renderer.render(scene, camera);
    H.t.textContent = `${nf2.format(timeline.t / 86400)} gün · ${nf0.format(st.p.length() / U / 1000)}e3 km${st.beyond ? ' · dışarıda' : ''}`;
  }
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  function advance(dt) { if (timeline.playing && entrance.done) { timeline.t += dt * timeline.warp * 3600; if (timeline.t > timeline.duration) { timeline.t = 0; lastBeyond = false; } } render(dt); }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, pane3d.clientWidth), h = Math.max(1, pane3d.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); for (const m of lineMats) m.resolution.set(w, h); dpr = Math.min(devicePixelRatio || 1, 2); for (const cv of Object.values(plots)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); } drawPanels(); }
  const ro = new ResizeObserver(() => { resize(); render(0); }); ro.observe(figure);
  reveal(figure); rebuild();
  if (reducedMotion || exportMode || options.t != null) { timeline.t = options.t ?? model.tSoiDays * 86400 * .55; scaleCamera(true); } else if (options.autoplay ?? true) timeline.playing = true;
  entrance.start(); render(0); ensureLoop();
  return {
    get model() { return model; }, get config() { return { ...cfg }; }, timeline, cases: CASES, bodies: BODIES,
    camera: { get current() { return cam.current; }, mode(m) { cam.current = m; scaleCamera(true); render(0); }, transitionTo(m) { cam.current = m; render(0); } },
    set(c) { cfg = { ...cfg, ...c }; timeline.t = 0; lastBeyond = false; rebuild(); render(0); entrance.start(); }, replay() { entrance.start(); },
    advance, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    dispose() { active = false; entrance.stop(); if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
