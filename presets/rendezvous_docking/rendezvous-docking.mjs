/* rendezvous-docking.mjs — Randevu ve Kenetlenme Sahnesi (rendezvous_docking)

   scene-blocks.md "wave 2" ORBITAL bloğu. LVLH (hedef merkezli) çerçevede
   Clohessy–Wiltshire göreli hareketi: V-bar / R-bar yaklaşma geometrisi,
   keep-out küresi (KOS), yaklaşma koridoru, bekleme noktaları, kapanma hızı,
   kenetlenme ekseni hizası, temas. Görsel katman rendezvous-model.mjs'in
   üstüne kurulur (../core/astro-relative.mjs paylaşılan çözücü); her sayı oradan.

   API:
     const rdv = await mountRendezvous(host, { scenario:'vbar'|'rbar'|'push'|'custom', scenarioOptions?, seed?, warp?, camera?, autoplay? });
     rdv.sim · rdv.timeline{play,pause,scrub,t,duration,setWarp,warp,playing}
     rdv.camera{ mode(m), transitionTo(m,{duration}), current }   — overview|dock|chase|free
     rdv.setScenario(id, opts) · rdv.advance(dt) · rdv.setActive(b) · rdv.hud(b) · rdv.dispose()

   Sahne eşlemesi: LVLH (x radyal dışa, y iz boyu, z çapraz-iz) → sahne (X = y, Y = x, Z = −z);
   1 sahne birimi = 100 m. Araç ölçekleri görünürlük için abartılır (HUD notunda ilan). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { coneX } from '../core/geometry-axis.mjs';
import { simulateRendezvous, sampleAt, losMetrics, SCENARIOS } from './rendezvous-model.mjs';
import { R_EARTH } from '../core/astro-relative.mjs';

const U = 1 / 100;                                  // m → sahne
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth01 = x => { const s = clamp01(x); return s * s * (3 - 2 * s); };
const lerp = (a, b, f) => a + (b - a) * f;
const toScene = (s, out) => out.set(s[1] * U, s[0] * U, -s[2] * U);
const dirToScene = (d, out) => out.set(d[1], d[0], -d[2]);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
async function loadCraft() {
  try { const m = await import('../craft_blocks/craft-blocks.mjs'); return { buildOrbiter: m.buildOrbiter, buildCapsule: m.buildCapsule }; }
  catch (error) {
    console.warn('rendezvous: craft-blocks yüklenemedi, yer tutucu —', error.message);
    const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, metalness: .4, roughness: .55 }));
    return { buildOrbiter: () => { const g = new THREE.Group(); g.add(box(.5, .2, .2, 0x33353c)); return g; }, buildCapsule: () => { const g = new THREE.Group(); g.add(box(.4, .25, .25, 0x8a877e)); return g; } };
  }
}

export async function mountRendezvous(host, options = {}) {
  if (!host) throw new Error('mountRendezvous bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');

  const figure = document.createElement('figure');
  figure.className = 'rdv';
  figure.innerHTML = `
    <style>
      .rdv{position:relative;margin:0;width:100%;height:100%;overflow:hidden;background:var(--color-canvas,#0b0c10);
        font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .rdv__canvas{position:absolute;inset:0;} .rdv__canvas canvas{display:block;width:100%;height:100%;}
      .rdv__labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
      .rdv__label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11.5px;letter-spacing:.06em;
        color:var(--color-muted,#9a938a);text-shadow:0 1px 4px rgba(0,0,0,.9);}
      .rdv__label.axis{color:var(--color-ink,#e9e4d8);font-weight:600;letter-spacing:.1em;}
      .rdv__label.hold{color:var(--color-accent,#d9b877);}
      .rdv__hud{position:absolute;top:16px;right:16px;min-width:250px;padding:12px 16px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
      .rdv__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 14px;}
      .rdv__hud dt{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted,#9a938a);align-self:baseline;}
      .rdv__hud dd{margin:0;text-align:right;font-size:14.5px;font-variant-numeric:tabular-nums;font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .rdv__hud dd.ok{color:#8fd39a;} .rdv__hud dd.bad{color:var(--color-data-2,#d78f6c);}
      .rdv__hud .phase{grid-column:1/-1;margin-top:5px;padding-top:6px;border-top:1px solid var(--color-rule,#3a3c42);font-size:11px;letter-spacing:.06em;color:var(--color-accent,#d9b877);text-align:right;}
      .rdv__plot{position:absolute;left:16px;bottom:16px;width:320px;padding:10px 12px 8px;border:1px solid var(--color-rule,#3a3c42);border-radius:10px;
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
      .rdv__plot h4{margin:0 0 4px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:600;color:var(--color-muted,#9a938a);}
      .rdv__plot svg{display:block;width:100%;height:200px;overflow:visible;font-family:var(--font-mono,ui-monospace,monospace);}
      .rdv__note{position:absolute;right:16px;bottom:16px;font-size:11px;letter-spacing:.04em;color:var(--color-muted,#9a938a);pointer-events:none;text-align:right;max-width:46%;}
    </style>
    <div class="rdv__canvas" aria-hidden="true"></div>
    <div class="rdv__labels" aria-hidden="true"></div>
    <div class="rdv__hud" role="status"><dl>
      <dt>t</dt><dd data-hud="t">—</dd>
      <dt>mesafe ρ</dt><dd data-hud="rho">—</dd>
      <dt>kapanma ρ̇</dt><dd data-hud="rhodot">—</dd>
      <dt>R / V / H</dt><dd data-hud="xyz">—</dd>
      <dt>LOS açısı</dt><dd data-hud="los">—</dd>
      <dt>koridor</dt><dd data-hud="cor">—</dd>
      <dt>itki</dt><dd data-hud="thr">—</dd>
      <dt>ΣΔV</dt><dd data-hud="dv">—</dd>
      <div class="phase" data-hud="phase"></div>
    </dl></div>
    <div class="rdv__plot" aria-hidden="true"><h4>LVLH düzlem-içi: V-bar (yatay) × R-bar (düşey)</h4><svg viewBox="0 0 320 200"></svg></div>
    <div class="rdv__note" data-note></div>`;
  host.appendChild(figure);
  const canvasHost = figure.querySelector('.rdv__canvas');
  const labelLayer = figure.querySelector('.rdv__labels');
  const hudEl = figure.querySelector('.rdv__hud');
  const hud = {}; for (const el of hudEl.querySelectorAll('[data-hud]')) hud[el.dataset.hud] = el;
  const plotSvg = figure.querySelector('.rdv__plot svg');
  const noteEl = figure.querySelector('[data-note]');
  const css = getComputedStyle(figure);
  const tok = (name, fb) => (css.getPropertyValue(name) || '').trim() || fb;
  const palette = { ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'), accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'), data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42') };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* -------- render */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(40, 1, .05, 400000);
  const sunDir = new THREE.Vector3(.75, .3, .55).normalize();   // yandan: Dünya'nın görünen üst yüzü sıyırma ışığında kalır, sahne fonu okunur
  const sun = new THREE.DirectionalLight('#fff4e6', 2.3); sun.position.copy(sunDir).multiplyScalar(500); scene.add(sun);
  scene.add(new THREE.HemisphereLight('#8fa8c4', '#2a2418', .5));
  scene.add(new THREE.AmbientLight('#3a404c', .5));
  {
    const rand = mulberry32(seed), n = reducedMotion ? 700 : 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 250000 + rand() * 50000, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .7, depthWrite: false })); stars.renderOrder = -10; scene.add(stars);
  }
  /* Dünya: nadir yönünde (sahne −Y), gerçek ölçekte — R-bar'ın nereye baktığı görülsün */
  const earth = new THREE.Group(); scene.add(earth);
  let earthRadiusScene = R_EARTH * U;
  {
    const loader = new THREE.TextureLoader(); const url = rel => new URL(rel, import.meta.url).href;
    try {
      const day = await loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8;
      earth.add(new THREE.Mesh(new THREE.SphereGeometry(earthRadiusScene, 128, 96), new THREE.MeshPhongMaterial({ map: day, color: new THREE.Color('#6e7378'), specular: new THREE.Color('#1c2126'), shininess: 8 })));
    } catch (error) { console.warn('rendezvous: doku yok —', error.message); earth.add(new THREE.Mesh(new THREE.SphereGeometry(earthRadiusScene, 96, 64), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .9 }))); }
    const atmoVert = `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(earthRadiusScene * 1.018, 128, 96), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#6fb4ff') } }, vertexShader: atmoVert,
      fragmentShader: `uniform vec3 uColor; varying vec3 vN; void main(){ float g = pow(clamp(.6 - dot(vN, vec3(0.,0.,1.)), 0., 1.2), 3.); gl_FragColor = vec4(uColor * g * .8, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment> }`, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
  }

  /* -------- LVLH eksenleri (V-bar, R-bar, H-bar), KOS, koridor, bekleme noktaları, izler */
  const frame = new THREE.Group(); scene.add(frame);
  const lineMat = (color, width, opacity) => new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, depthTest: true });
  const mats = { axis: lineMat(palette.muted, 1.2, .45), trail: lineMat(palette.data1, 2.4, 1), ghost: lineMat(palette.data1, 1.2, .22), kos: lineMat(palette.data2, 1.2, .5), corridor: lineMat(palette.accent, 1.2, .55) };
  const line = (pts, mat) => { const g = new LineGeometry(); g.setPositions(pts); return new Line2(g, mat); };
  let axisLen = 40;
  const axes = new THREE.Group(); frame.add(axes);
  const kosGroup = new THREE.Group(); frame.add(kosGroup);
  const corridorGroup = new THREE.Group(); frame.add(corridorGroup);
  const holdGroup = new THREE.Group(); frame.add(holdGroup);
  let trail = null, ghost = null, trailTimes = [];
  const labels = [];   // { el, pos:Vector3 }
  /* gate: {center, radius, minPx} — nesnenin ekrandaki yarıçapı minPx altındaysa etiket gizlenir (küçük ölçekte yığılma olmasın) */
  const addLabel = (text, cls, pos, gate = null) => { const el = document.createElement('div'); el.className = `rdv__label ${cls}`; el.textContent = text; labelLayer.appendChild(el); labels.push({ el, pos, gate }); };

  /* -------- araçlar */
  const craft = await loadCraft();
  const target = craft.buildOrbiter({ scale: 1 }); target.scale.setScalar(1.2);          // 120 m — istasyon sınıfı, abartılı
  const capsule = craft.buildCapsule({ scale: 1 }); capsule.scale.setScalar(.45);        // 45 m — kapsül (abartılı)
  const chaser = new THREE.Group(); chaser.add(capsule);                                  // rig: orijin = kapak (port) yüzü
  { const bb = new THREE.Box3().setFromObject(capsule); capsule.position.x = -bb.max.x; }  // +X kapak yüzü rig orijininde
  scene.add(target, chaser);
  /* hedef: +X = V-bar (ileri), +Z = zenit (sahne +Y) → kıç portu −V, nadir portu −zenit */
  { const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)); target.quaternion.setFromRotationMatrix(m); }
  /* port yüzü LVLH orijininde: göreli durum port–kapak mesafesidir, temas ρ = 0'da gövdeler çakışmaz */
  function placeTargetPort(axisS) { target.position.set(0, 0, 0); target.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(target); target.position.copy(axisS).multiplyScalar(-1).multiply(new THREE.Vector3(Math.abs(axisS.x) > .5 ? (axisS.x < 0 ? bb.max.x : -bb.min.x) : 0, Math.abs(axisS.y) > .5 ? (axisS.y < 0 ? bb.max.y : -bb.min.y) : 0, 0).multiplyScalar(-1)); }
  /* itki işaretçisi (sürekli itki): kapsülün kıçından (−X) çıkan kısa ışıklı koni */
  const thrustCone = coneX(.12, .5, 16, new THREE.MeshBasicMaterial({ color: '#ffd9a6', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  thrustCone.userData.fx = true; capsule.add(thrustCone);
  const dvArrows = [];

  /* -------- senaryo kurulumu */
  let sim, sceneExtent = 30;
  function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.geometry?.dispose?.(); c.material?.dispose?.(); } }
  function rebuild(id, opts) {
    sim = simulateRendezvous(id, opts);
    const G = sim.geometry;
    /* ölçek: en uzak nokta */
    sceneExtent = Math.max(6, sim.samples.reduce((m, s) => Math.max(m, Math.abs(s.state[0]), Math.abs(s.state[1]), Math.abs(s.state[2])), 0) * U * 1.15);
    axisLen = sceneExtent * 1.3;
    for (const l of labels) l.el.remove(); labels.length = 0;
    clearGroup(axes); clearGroup(kosGroup); clearGroup(corridorGroup); clearGroup(holdGroup);
    for (const a of dvArrows) scene.remove(a); dvArrows.length = 0;
    /* eksenler */
    axes.add(line([-axisLen, 0, 0, axisLen * .35, 0, 0], mats.axis));                 // V-bar
    axes.add(line([0, -axisLen, 0, 0, axisLen * .35, 0], mats.axis));                 // R-bar
    axes.add(line([0, 0, -axisLen * .35, 0, 0, axisLen * .35], mats.axis));           // H-bar
    addLabel('V-bar  (+iz boyu →)', 'axis', new THREE.Vector3(axisLen * .35, .6, 0));
    addLabel('−V-bar', 'axis', new THREE.Vector3(-axisLen, .6, 0));
    addLabel('R-bar ↓ Dünya', 'axis', new THREE.Vector3(1.2, -axisLen, 0));
    addLabel('+R (zenit)', 'axis', new THREE.Vector3(1.2, axisLen * .35, 0));
    addLabel('H-bar', 'axis', new THREE.Vector3(.6, .6, axisLen * .35));
    /* KOS: küre + üç büyük çember */
    const kr = G.kosRadius * U;
    const kosMesh = new THREE.Mesh(new THREE.SphereGeometry(kr, 48, 32), new THREE.MeshBasicMaterial({ color: palette.data2, transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide }));
    kosGroup.add(kosMesh);
    const circ = (fn) => { const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(...fn(a)); } return line(pts, mats.kos); };
    kosGroup.add(circ(a => [kr * Math.cos(a), kr * Math.sin(a), 0]), circ(a => [kr * Math.cos(a), 0, kr * Math.sin(a)]), circ(a => [0, kr * Math.cos(a), kr * Math.sin(a)]));
    addLabel(`KOS · ${nf0.format(G.kosRadius)} m`, '', new THREE.Vector3(kr * .8, -kr * 1.1, 0), { center: new THREE.Vector3(0, 0, 0), radius: kr, minPx: 36 });
    /* koridor: tepe portta, yaklaşma yönünde açılan koni (coneX + birim-vektör kuaterniyonu) */
    const axisS = dirToScene(G.axis, new THREE.Vector3());
    const corLen = Math.min(sceneExtent, Math.max(kr * 1.6, 3.5));
    const corR = corLen * Math.tan(G.corridorHalfAngle);
    const cone = coneX(corR, corLen, 40, new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: .07, depthWrite: false, side: THREE.DoubleSide }), true);
    cone.position.x = -corLen / 2;                                  // tepe orijinde (portta), taban −X'te
    const holder = new THREE.Group(); holder.add(cone);
    for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) holder.add(line([0, 0, 0, -corLen, corR * Math.cos(a), corR * Math.sin(a)], mats.corridor));
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), axisS);
    corridorGroup.add(holder);
    placeTargetPort(axisS);
    addLabel(`yaklaşma koridoru ±${(G.corridorHalfAngle * 180 / Math.PI).toFixed(0)}°`, '', axisS.clone().multiplyScalar(corLen * 1.02).add(new THREE.Vector3(0, -corR - .6, 0)), { center: new THREE.Vector3(0, 0, 0), radius: corLen, minPx: 90 });
    /* bekleme noktaları */
    for (const h of G.holds) {
      const p = toScene(h.r, new THREE.Vector3());
      const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .68, 40), new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.copy(p); holdGroup.add(ring);
      addLabel(h.label, 'hold', p.clone().add(new THREE.Vector3(0, 1.1, 0)));
    }
    /* izler */
    if (trail) { scene.remove(trail, ghost); trail.geometry.dispose(); ghost.geometry.dispose(); }
    const flat = []; trailTimes = [];
    const v = new THREE.Vector3();
    for (const s of sim.samples) { toScene(s.state, v); flat.push(v.x, v.y, v.z); trailTimes.push(s.t); }
    trail = line(flat, mats.trail); trail.geometry.instanceCount = 0; ghost = line(flat, mats.ghost);
    scene.add(trail, ghost);
    /* impuls okları */
    for (const e of sim.events) {
      if (!e.dvVec) continue;
      const s = sampleAt(sim, e.t); const p = toScene(s.state, new THREE.Vector3());
      const d = dirToScene(e.dvVec, new THREE.Vector3()).normalize();
      const arrow = new THREE.ArrowHelper(d, p, Math.max(1.2, sceneExtent * .08), new THREE.Color(palette.data2).getHex(), Math.max(.4, sceneExtent * .025), Math.max(.2, sceneExtent * .012));
      arrow.userData.t = e.t; arrow.visible = false; scene.add(arrow); dvArrows.push(arrow);
    }
    /* kapsül yönelimi: +X (kapak/port) hedefin portuna, yani −axis yönüne */
    { const fwd = axisS.clone().negate(); const up = new THREE.Vector3(0, 1, 0); if (Math.abs(up.dot(fwd)) > .9) up.set(0, 0, 1); const side = new THREE.Vector3().crossVectors(up, fwd).normalize(); const up2 = new THREE.Vector3().crossVectors(fwd, side).normalize(); chaser.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, side, up2)); }
    buildPlot();
    timeline.duration = sim.duration;
    noteEl.textContent = `${sim.label} · ${nf0.format(sim.altitude / 1000)} km dairesel referans, n = ${(sim.n * 1e3).toFixed(3)} mrad/s · araç boyları abartılı · CW doğrusal model`;
  }

  /* -------- 2B düzlem-içi çizim (SVG) */
  const plot = { sx: 1, sy: 1, ox: 160, oy: 100, dot: null, head: null };
  function buildPlot() {
    const S = sim.samples, G = sim.geometry;
    let maxY = 0, maxX = 0;
    for (const s of S) { maxY = Math.max(maxY, Math.abs(s.state[1])); maxX = Math.max(maxX, Math.abs(s.state[0])); }
    const ext = Math.max(maxY, maxX * 1.2, G.kosRadius * 2.2, 300) * 1.1;
    const W = 320, H = 200, pad = 18;
    const sc = Math.min((W - 2 * pad) / (2 * ext), (H - 2 * pad) / (2 * ext * .62));
    plot.sx = sc; plot.sy = sc;
    /* orijin: hedef sağ-ortada (yaklaşma soldan) — vbar/push için; rbar için üst-ortada */
    const fromBelow = G.axis[0] < 0;
    plot.ox = fromBelow ? W / 2 : W - pad - 20; plot.oy = fromBelow ? pad + 14 : H / 2;
    const X = y => plot.ox + y * sc, Y = x => plot.oy - x * sc;
    const path = S.filter((_, i) => i % 4 === 0).map((s, i) => `${i ? 'L' : 'M'}${X(s.state[1]).toFixed(1)},${Y(s.state[0]).toFixed(1)}`).join('');
    const kr = G.kosRadius * sc;
    const ang = G.corridorHalfAngle, ax = G.axis, L = Math.max(kr * 2, 60);
    const corr = [[Math.cos(ang), Math.sin(ang)], [Math.cos(ang), -Math.sin(ang)]].map(([c, s]) => {
      /* eksen etrafında ±ang döndürülmüş yön (düzlem-içi): (y,x) bileşenleri */
      const dy = ax[1] * c - ax[0] * s, dx = ax[0] * c + ax[1] * s; return `M${X(0)},${Y(0)}L${(X(0) + dy * L).toFixed(1)},${(Y(0) - dx * L).toFixed(1)}`; });
    plotSvg.innerHTML = `
      <line x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="${palette.rule}" stroke-width="1"/>
      <line x1="${X(0)}" y1="0" x2="${X(0)}" y2="${H}" stroke="${palette.rule}" stroke-width="1"/>
      <text x="${W - 4}" y="${Y(0) - 4}" text-anchor="end" font-size="9" fill="${palette.muted}">V-bar →</text>
      <text x="${X(0) + 4}" y="${H - 4}" font-size="9" fill="${palette.muted}">R-bar ↓ Dünya</text>
      <circle cx="${X(0)}" cy="${Y(0)}" r="${kr.toFixed(1)}" fill="${palette.data2}" fill-opacity=".08" stroke="${palette.data2}" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="${corr.join('')}" stroke="${palette.accent}" stroke-width="1" fill="none" stroke-opacity=".8"/>
      ${G.holds.map(h => `<circle cx="${X(h.r[1])}" cy="${Y(h.r[0])}" r="3.5" fill="none" stroke="${palette.accent}" stroke-width="1.2"/>`).join('')}
      <path d="${path}" fill="none" stroke="${palette.data1}" stroke-width="1" stroke-opacity=".3"/>
      <path data-head d="" fill="none" stroke="${palette.data1}" stroke-width="1.6"/>
      <rect x="${X(0) - 3}" y="${Y(0) - 3}" width="6" height="6" fill="${palette.ink}"/>
      <circle data-dot cx="${X(0)}" cy="${Y(0)}" r="3.5" fill="${palette.accent}"/>
      <text x="4" y="12" font-size="9" fill="${palette.muted}">ölçek: ${nf0.format(Math.round(50 / sc))} m / 50 px</text>`;
    plot.dot = plotSvg.querySelector('[data-dot]'); plot.head = plotSvg.querySelector('[data-head]');
    plot.X = X; plot.Y = Y;
  }

  /* -------- zaman çizelgesi */
  const timeline = {
    t: 0, duration: 1, playing: false, warp: options.warp ?? 30,
    play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; },
    scrub(t) { this.t = Math.min(this.duration, Math.max(0, t)); snapCamera = true; render(0); },
    setWarp(w) { this.warp = w; },
  };

  /* -------- kamera */
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .08; controls.enabled = false;
  const cam = { current: options.camera ?? 'overview', from: null, blend: 1, duration: 1.6 };
  let lastMode = cam.current, snapCamera = true;
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const poseA = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40 }, poseB = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40 };
  const _p = new THREE.Vector3(), _ax = new THREE.Vector3();
  function poseFor(mode, s, out) {
    toScene(s.state, _p); dirToScene(sim.geometry.axis, _ax);
    if (mode === 'overview') {
      /* tüm sahne: −Z tarafından (H-bar), hafif yukarıdan; ölçek senaryodan */
      const c = _p.clone().multiplyScalar(.5);
      const d = Math.max(sceneExtent * 1.9, 8);
      /* hafif AŞAĞIDAN, yukarı bakarak: Dünya ufku alt kenarda kalır, LVLH geometrisi gökyüzüne karşı okunur */
      out.pos.set(c.x - d * .3, c.y + d * .03, c.z - d * 1.05); out.target.copy(c).add(new THREE.Vector3(0, -d * .06, 0)); out.fov = 40;
    } else if (mode === 'dock') {
      /* kenetlenme kamerası: portun hemen dışında, yaklaşma ekseni boyunca araca bakar */
      /* portun 1,4 birim dışında, hafif yandan; araç uzaktayken geri çekilir */
      const rho = _p.length();
      out.pos.copy(_ax).multiplyScalar(Math.max(1.4, rho * .6)).add(new THREE.Vector3(.4, .45, -.9)); out.target.copy(_p).multiplyScalar(.5); out.fov = 46;
    } else {
      /* takip: aracın arkasında (hedeften uzak tarafta), hafif yanda */
      const rho = Math.max(_p.length(), .8);
      const back = _ax.clone().multiplyScalar(Math.max(1.6, rho * .35));
      out.pos.copy(_p).add(back).add(new THREE.Vector3(0, Math.max(.6, rho * .12), -Math.max(1.2, rho * .3))); out.target.lerpVectors(_p, new THREE.Vector3(0, 0, 0), .35); out.fov = 42;
    }
  }
  function updateCamera(s, dtReal) {
    const desired = cam.current;
    if (desired === 'free') { controls.enabled = true; controls.update(); return; }
    controls.enabled = false;
    if (desired !== lastMode) { cam.from = lastMode; cam.blend = 0; lastMode = desired; }
    poseFor(desired, s, poseB);
    if (cam.blend < 1 && cam.from && !snapCamera) {
      poseFor(cam.from, s, poseA); cam.blend = Math.min(1, cam.blend + dtReal / cam.duration);
      const f = smooth01(cam.blend); camPos.lerpVectors(poseA.pos, poseB.pos, f); camTarget.lerpVectors(poseA.target, poseB.target, f); camera.fov = lerp(poseA.fov, poseB.fov, f);
    } else {
      if (snapCamera) { camPos.copy(poseB.pos); camTarget.copy(poseB.target); cam.blend = 1; }
      else { camPos.lerp(poseB.pos, 1 - Math.exp(-dtReal * 5)); camTarget.lerp(poseB.target, 1 - Math.exp(-dtReal * 7)); }
      camera.fov = poseB.fov;
    }
    camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(camTarget); camera.updateProjectionMatrix();
    snapCamera = false;
  }

  /* -------- kare */
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  function render(dtReal) {
    const t = timeline.t;
    const s = sampleAt(sim, t);
    const G = sim.geometry;
    earth.position.set(0, -(R_EARTH + sim.altitude) * U, 0);
    /* iz */
    let lo = 0, hi = trailTimes.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; trailTimes[m] <= t ? lo = m : hi = m; }
    trail.geometry.instanceCount = Math.max(0, lo);
    /* araç */
    toScene(s.state, _p); chaser.position.copy(_p);
    const thr = Math.hypot(...s.thrust);
    thrustCone.material.opacity = .85 * smooth01(thr / 2e-3);                 // 2 mm/s² tam parlaklık — eşik sıfırdan rampalanır
    thrustCone.position.x = -.55 - .25 * thrustCone.material.opacity;
    if (thr > 1e-9) { dirToScene(s.thrust, _v).normalize(); /* koni −X'ten çıkar: kapsülün yerelinde itki yönü tersine */ }
    /* impuls okları: olaydan sonra 120 s görünür, sıfırdan rampalı */
    for (const a of dvArrows) { const age = t - a.userData.t; const op = age < 0 ? 0 : (1 - smooth01((age - 90) / 60)) * smooth01(age / 4); a.visible = op > .003; a.line.material.opacity = op; a.cone.material.opacity = op; a.line.material.transparent = a.cone.material.transparent = true; }
    /* HUD */
    const m = losMetrics(s.state, G);
    hud.t.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    hud.rho.textContent = m.rho >= 1000 ? `${nf2.format(m.rho / 1000)} km` : `${nf1.format(m.rho)} m`;
    hud.rhodot.textContent = `${nf2.format(m.rhoDot)} m/s`;
    hud.xyz.textContent = `${nf0.format(s.state[0])} / ${nf0.format(s.state[1])} / ${nf0.format(s.state[2])} m`;
    hud.los.textContent = `${nf1.format(m.losAngle * 180 / Math.PI)}°`;
    hud.cor.textContent = m.inCorridor ? 'içinde' : 'dışında'; hud.cor.className = m.inCorridor ? 'ok' : 'bad';
    hud.thr.textContent = thr > 1e-9 ? `${(thr * 1000).toFixed(2)} mm/s²` : '—';
    let dvSoFar = 0; for (const e of sim.events) if (e.dvVec && e.t <= t) dvSoFar += e.dv;
    for (let k = 1; k < sim.samples.length && sim.samples[k].t <= t; k++) dvSoFar += Math.hypot(...sim.samples[k].thrust) * (sim.samples[k].t - sim.samples[k - 1].t);
    hud.dv.textContent = `${nf2.format(dvSoFar)} m/s`;
    const phaseLabel = { hold: 'bekleme (V-bar, doğal)', 'hold-thrust': 'bekleme (R-bar, sürekli itki)', transfer: 'CW iki-impuls transfer', glideslope: 'glideslope (sürekli itki)', drift: 'serbest CW sürüklenme' }[s.phase] || s.phase;
    hud.phase.textContent = `${phaseLabel} · ${timeline.warp}× zaman`;
    /* 2B çizim */
    if (plot.dot) { plot.dot.setAttribute('cx', plot.X(s.state[1]).toFixed(1)); plot.dot.setAttribute('cy', plot.Y(s.state[0]).toFixed(1));
      const S = sim.samples; let d = ''; for (let k = 0; k <= lo; k += 4) d += `${k ? 'L' : 'M'}${plot.X(S[k].state[1]).toFixed(1)},${plot.Y(S[k].state[0]).toFixed(1)}`; if (lo % 4) d += `L${plot.X(s.state[1]).toFixed(1)},${plot.Y(s.state[0]).toFixed(1)}`; plot.head.setAttribute('d', d); }
    /* kamera + etiketler */
    updateCamera(s, dtReal);
    const w = host.clientWidth, h = host.clientHeight;
    for (const l of labels) {
      _v.copy(l.pos).project(camera);
      let vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
      if (vis && l.gate) { const c = _v2.copy(l.gate.center).project(camera); const e = _v3.copy(l.gate.center).addScaledVector(camera.up, l.gate.radius).project(camera); if (Math.hypot((c.x - e.x) * w / 2, (c.y - e.y) * h / 2) < l.gate.minPx) vis = false; }
      l.el.style.display = vis ? '' : 'none';
      if (vis) { l.el.style.left = `${((_v.x + 1) / 2 * w).toFixed(1)}px`; l.el.style.top = `${((1 - _v.y) / 2 * h).toFixed(1)}px`; }
    }
    renderer.render(scene, camera);
  }

  let active = options.active ?? true, rafId = 0, lastNow = 0;
  const stats = { advanceMs: 0 };
  function advance(dt) { const t0 = performance.now(); if (timeline.playing) { timeline.t = Math.min(timeline.duration, timeline.t + dt * timeline.warp); if (timeline.t >= timeline.duration) timeline.playing = false; } render(dt); stats.advanceMs = stats.advanceMs * .9 + (performance.now() - t0) * .1; }
  function loop(now) { rafId = 0; if (!active || document.hidden) return; const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60); lastNow = now; advance(dt); ensureLoop(); }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); }; document.addEventListener('visibilitychange', onVis);
  function resize() { const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); for (const m of Object.values(mats)) m.resolution.set(w, h); }
  const ro = new ResizeObserver(() => { resize(); render(0); }); ro.observe(host);

  rebuild(options.scenario ?? 'vbar', options.scenarioOptions);
  resize();
  const tableauFor = () => { const g = sim.events.find(e => e.id === 'glide-start'); return g ? g.t + 600 : sim.duration * .5; };
  if (reducedMotion || exportMode) timeline.t = tableauFor();
  else if (options.autoplay ?? true) timeline.playing = true;
  snapCamera = true; render(0); render(0); ensureLoop();

  return {
    get sim() { return sim; }, timeline,
    camera: { get current() { return cam.current; }, mode(m) { cam.current = m; snapCamera = true; render(0); }, transitionTo(m, { duration = 1600 } = {}) { cam.current = m; cam.duration = Math.max(.01, duration / 1000); if (duration === 0) snapCamera = true; render(0); } },
    setScenario(id, opts) { timeline.t = 0; rebuild(id, opts); snapCamera = true; render(0); },
    get tableau() { return tableauFor(); },
    advance, stats, setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    hud(v) { hudEl.hidden = !v; figure.querySelector('.rdv__plot').hidden = !v; },
    scenarios: SCENARIOS,
    dispose() { active = false; if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); controls.dispose(); renderer.dispose(); figure.remove(); },
  };
}
