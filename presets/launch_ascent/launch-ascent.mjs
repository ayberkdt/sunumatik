/* launch-ascent.mjs — Fırlatma / Tırmanış Sahnesi (launch_ascent)

   scene-blocks.md "wave 2" ORBITAL bloğu. Görsel katman ascent-model.mjs'in
   ÜSTÜNE kurulur: sahnede görünen her sayı (irtifa, hız, q, Max-Q, MECO,
   SECO…) simülasyondan gelir; olay çizelgesi hesaplanan olaylardan üretilir.
   webgl-scene-contract.md'ye istisnasız uyar: görünür geometri yeniden inşa
   edilmez (iz Line2 instanceCount ile ilerler), eşikler sıfırdan rampalanır,
   her görsel durum sim zamanı t'nin saf fonksiyonudur.

   API:
     const asc = await mountLaunchAscent(host, { vehicle?, profile?, seed?, active?, autoplay?, warp? });
     asc.sim                                  → simulateAscent çıktısı (samples, events, maxQ, losses, orbit)
     asc.timeline = { play, pause, scrub(t), t, duration, playing, setWarp(x), warp }
     asc.camera   = { mode(m), transitionTo(m,{duration}), current }   — pad|chase|wide|free|auto
     asc.setScenario(vehicle, profile)        → yeniden simüle eder, iz ve çizelge tazelenir
     asc.advance(dtSaniye) · asc.setActive(bool) · asc.hud(bool) · asc.dispose()

   Ölçek: 1 sahne birimi = 100 km (Dünya yarıçapı 63,78). Araç, görünürlük
   için ABARTILIR (irtifayla 4→12 km boy; HUD'da ilan edilir). */

import * as THREE from 'three';
import { OrbitControls } from '../moon_advanced/vendor/controls/OrbitControls.js';
import { Line2 } from '../moon_advanced/vendor/lines/Line2.js';
import { LineGeometry } from '../moon_advanced/vendor/lines/LineGeometry.js';
import { LineMaterial } from '../moon_advanced/vendor/lines/LineMaterial.js';
import { cylZ, cylX } from '../core/geometry-axis.mjs';
import { simulateAscent, sampleAt, R_EARTH, OMEGA_EARTH } from './ascent-model.mjs';

const TAU = Math.PI * 2;
const KM = 1 / 100;                     // 1 sahne birimi = 100 km  → km * KM
const M = KM / 1000;                    // metre → sahne
const R_SCENE = R_EARTH * M;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth01 = x => { const s = clamp01(x); return s * s * (3 - 2 * s); };
const lerp = (a, b, f) => a + (b - a) * f;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* craft-blocks yumuşak bağımlılık (sözleşme: başarısızlıkta yer tutucu) */
async function loadCraft() {
  try {
    const mod = await import('../craft_blocks/craft-blocks.mjs');
    let fx = null;
    try { fx = await import('../craft_blocks/craft-effects.mjs'); } catch { /* alevsiz devam */ }
    return { buildRocket: mod.buildRocket, buildEngineFX: fx?.buildEngineFX ?? null };
  } catch (error) {
    console.warn('launch-ascent: craft-blocks yüklenemedi, yer tutucu roket —', error.message);
    return {
      buildRocket: ({ stages = 2 } = {}) => {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: .4, roughness: .55 });
        const body = cylX(.06, .06, stages === 2 ? .9 : .5, 24, mat);
        g.add(body);
        return g;
      },
      buildEngineFX: null,
    };
  }
}

export async function mountLaunchAscent(host, options = {}) {
  if (!host) throw new Error('mountLaunchAscent bir kap ister');
  const seed = options.seed ?? 20260906;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const exportMode = options.exportMode
    ?? (new URLSearchParams(location.search).get('export') === '1' || document.documentElement.dataset.export === 'true');

  /* -------- DOM */
  const figure = document.createElement('figure');
  figure.className = 'launch-ascent';
  figure.innerHTML = `
    <style>
      .launch-ascent{position:relative;margin:0;width:100%;height:100%;overflow:hidden;
        background:var(--color-canvas,#0b0c10);font-family:var(--font-body,'Inter','Segoe UI',system-ui,sans-serif);color:var(--color-ink,#e9e4d8);}
      .launch-ascent__canvas{position:absolute;inset:0;}
      .launch-ascent__canvas canvas{display:block;width:100%;height:100%;}
      .launch-ascent__hud{position:absolute;top:16px;right:16px;min-width:236px;padding:12px 16px;
        border:1px solid var(--color-rule,#3a3c42);border-radius:10px;
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
      .launch-ascent__hud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 14px;}
      .launch-ascent__hud dt{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted,#9a938a);align-self:baseline;}
      .launch-ascent__hud dd{margin:0;text-align:right;font-size:14.5px;font-variant-numeric:tabular-nums;
        font-family:var(--font-mono,'JetBrains Mono',ui-monospace,monospace);}
      .launch-ascent__hud .phase{grid-column:1/-1;margin-top:5px;padding-top:6px;border-top:1px solid var(--color-rule,#3a3c42);
        font-size:11px;letter-spacing:.06em;color:var(--color-accent,#d9b877);text-align:right;}
      .launch-ascent__q{position:absolute;left:16px;bottom:16px;width:300px;padding:10px 12px 8px;
        border:1px solid var(--color-rule,#3a3c42);border-radius:10px;
        background:color-mix(in srgb,var(--color-surface,#15161a) 84%,transparent);pointer-events:none;}
      .launch-ascent__q h4{margin:0 0 4px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:600;color:var(--color-muted,#9a938a);}
      .launch-ascent__q h4 b{color:var(--color-ink,#e9e4d8);font-family:var(--font-mono,ui-monospace,monospace);font-weight:500;margin-left:6px;}
      .launch-ascent__q svg{display:block;width:100%;height:84px;overflow:visible;}
      .launch-ascent__events{position:absolute;left:16px;right:16px;top:16px;height:44px;pointer-events:none;}
      .launch-ascent__events .rail{position:absolute;left:0;right:270px;top:22px;height:2px;background:var(--color-rule,#3a3c42);}
      .launch-ascent__events .done{position:absolute;left:0;top:0;height:100%;background:var(--color-accent,#d9b877);transform-origin:left;}
      .launch-ascent__events .ev{position:absolute;top:0;height:44px;width:0;font-size:10.5px;letter-spacing:.04em;color:var(--color-muted,#9a938a);white-space:nowrap;}
      .launch-ascent__events .ev i{position:absolute;left:0;top:19px;width:8px;height:8px;transform:translateX(-50%);border-radius:50%;
        background:var(--color-canvas,#0b0c10);border:2px solid var(--color-muted,#9a938a);box-sizing:border-box;}
      .launch-ascent__events .ev span{position:absolute;left:0;transform:translateX(-50%);line-height:13px;}
      .launch-ascent__events .ev.derived{color:var(--color-data-2,#d78f6c);}
      .launch-ascent__events .ev.derived i{border-color:var(--color-data-2,#d78f6c);}
      .launch-ascent__events .ev.past{color:var(--color-ink,#e9e4d8);}
      .launch-ascent__events .ev.past i{background:var(--color-accent,#d9b877);border-color:var(--color-accent,#d9b877);}
      .launch-ascent__note{position:absolute;right:16px;bottom:16px;font-size:11px;letter-spacing:.04em;color:var(--color-muted,#9a938a);pointer-events:none;text-align:right;}
    </style>
    <div class="launch-ascent__canvas" aria-hidden="true"></div>
    <div class="launch-ascent__events" aria-hidden="true"><div class="rail"><div class="done"></div></div></div>
    <div class="launch-ascent__hud" role="status">
      <dl>
        <dt>T+</dt><dd data-hud="t">—</dd>
        <dt>irtifa</dt><dd data-hud="alt">—</dd>
        <dt>menzil</dt><dd data-hud="dr">—</dd>
        <dt>|v|</dt><dd data-hud="v">—</dd>
        <dt>γ</dt><dd data-hud="gamma">—</dd>
        <dt>q</dt><dd data-hud="q">—</dd>
        <dt>Mach</dt><dd data-hud="mach">—</dd>
        <dt>T/W</dt><dd data-hud="twr">—</dd>
        <dt>kütle</dt><dd data-hud="m">—</dd>
        <dt>ivme</dt><dd data-hud="g">—</dd>
        <div class="phase" data-hud="phase"></div>
      </dl>
    </div>
    <div class="launch-ascent__q" aria-hidden="true">
      <h4>q = ½ρv² <b data-q="max"></b></h4>
      <svg viewBox="0 0 300 84" preserveAspectRatio="none"></svg>
    </div>
    <div class="launch-ascent__note" data-note></div>`;
  host.appendChild(figure);
  const canvasHost = figure.querySelector('.launch-ascent__canvas');
  const hudEl = figure.querySelector('.launch-ascent__hud');
  const hud = {};
  for (const el of hudEl.querySelectorAll('[data-hud]')) hud[el.dataset.hud] = el;
  const eventsEl = figure.querySelector('.launch-ascent__events');
  const doneEl = eventsEl.querySelector('.done');
  const qSvg = figure.querySelector('.launch-ascent__q svg');
  const qMaxEl = figure.querySelector('[data-q="max"]');
  const noteEl = figure.querySelector('[data-note]');

  const css = getComputedStyle(figure);
  const tok = (name, fb) => (css.getPropertyValue(name) || '').trim() || fb;
  const palette = {
    ink: tok('--color-ink', '#e9e4d8'), muted: tok('--color-muted', '#9a938a'),
    accent: tok('--color-accent', '#d9b877'), data1: tok('--color-data-1', '#8fb8dd'),
    data2: tok('--color-data-2', '#d78f6c'), rule: tok('--color-rule', '#3a3c42'),
  };
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* -------- render altyapısı */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(tok('--color-canvas', '#07080c'));
  const camera = new THREE.PerspectiveCamera(42, 1, .002, 3000);

  /* ışık disiplini: tek güneş + yarıküre dolgu */
  const sunDir = new THREE.Vector3(-.55, .35, -.75).normalize();   // frameFromProfile'da siteye göre yeniden konur
  const sun = new THREE.DirectionalLight('#fff4e6', 2.4);
  sun.position.copy(sunDir).multiplyScalar(400);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#9fb4cc', '#1a1c22', .55));
  scene.add(new THREE.AmbientLight('#3a404c', .45));

  /* gökyüzü: kamera irtifasının saf fonksiyonu — atmosfer içinde Rayleigh mavisi, ~60 km üstünde uzay
     (ince-atmosfer yaklaşımı: tek bir arka plan rengi; saçılma hacmi çözülmez, sınırlar manifestte) */
  const skyLow = new THREE.Color('#4d84c0'), skyMid = new THREE.Color('#122a4e'), skyBlack = new THREE.Color(tok('--color-canvas', '#07080c'));
  const skyColor = new THREE.Color();
  let starsRef = null;
  function applySky(camAltM) {
    const f = smooth01(camAltM / 60e3);
    if (f < .5) skyColor.lerpColors(skyLow, skyMid, f * 2); else skyColor.lerpColors(skyMid, skyBlack, (f - .5) * 2);
    scene.background = skyColor;
    if (starsRef) starsRef.material.opacity = .7 * smooth01((camAltM - 25e3) / 40e3);
  }
  /* yıldızlar: SABİT */
  {
    const rand = mulberry32(seed);
    const n = reducedMotion ? 800 : 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 1200 + rand() * 900, th = rand() * TAU, ph = Math.acos(2 * rand() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd6e4', size: .6, sizeAttenuation: false, transparent: true, opacity: .7, depthWrite: false }));
    stars.renderOrder = -10; scene.add(stars);
    starsRef = stars;
  }

  /* -------- Dünya (gerçek dokular; başarısızlıkta düz küre) + atmosfer */
  const earth = new THREE.Group();
  scene.add(earth);
  {
    const loader = new THREE.TextureLoader();
    const url = rel => new URL(rel, import.meta.url).href;
    try {
      const [day, normal, spec] = await Promise.all([
        loader.loadAsync(url('../earth_advanced/textures/earth_atmos_2048.jpg')),
        loader.loadAsync(url('../earth_advanced/textures/earth_normal_2048.jpg')),
        loader.loadAsync(url('../earth_advanced/textures/earth_specular_2048.jpg')),
      ]);
      day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8;
      earth.add(new THREE.Mesh(new THREE.SphereGeometry(R_SCENE, 192, 128), new THREE.MeshPhongMaterial({
        map: day, normalMap: normal, normalScale: new THREE.Vector2(.7, .7), specularMap: spec,
        specular: new THREE.Color('#39434d'), shininess: 12,
      })));
    } catch (error) {
      console.warn('launch-ascent: doku yüklenemedi —', error.message);
      earth.add(new THREE.Mesh(new THREE.SphereGeometry(R_SCENE, 128, 96), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .85 })));
    }
    const atmoVert = `varying vec3 vN; varying vec3 vW;
      void main(){ vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
    /* atmosfer kalınlığı gerçek ölçekte (~1,5 %): halo 1,02 R, pus 1,004 R */
    const halo = new THREE.Mesh(new THREE.SphereGeometry(R_SCENE * 1.022, 128, 96), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDir }, uDay: { value: new THREE.Color('#7ec3ff') }, uNight: { value: new THREE.Color('#132a48') } },
      vertexShader: atmoVert,
      fragmentShader: `uniform vec3 uSun; uniform vec3 uDay; uniform vec3 uNight; varying vec3 vN; varying vec3 vW;
        void main(){ float glow = pow(clamp(.62 - dot(vN, vec3(0.,0.,1.)), 0., 1.4), 3.2);
          float sf = clamp(dot(normalize(vW), normalize(uSun)) * .6 + .4, 0., 1.);
          gl_FragColor = vec4(mix(uNight, uDay, sf) * glow * .9 * (.3 + .7 * sf), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment> }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    const haze = new THREE.Mesh(new THREE.SphereGeometry(R_SCENE * 1.004, 128, 96), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDir }, uColor: { value: new THREE.Color('#9fd0ff') } },
      vertexShader: atmoVert,
      fragmentShader: `uniform vec3 uSun; uniform vec3 uColor; varying vec3 vN; varying vec3 vW;
        void main(){ float rim = pow(1. - clamp(dot(vN, vec3(0.,0.,1.)), 0., 1.), 3.2);
          float sf = clamp(dot(normalize(vW), normalize(uSun)) * .7 + .3, 0., 1.);
          gl_FragColor = vec4(uColor * rim * .55 * sf, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment> }`,
      side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    scene.add(halo, haze);
  }

  /* -------- fırlatma geometrisi: site vektörü û ve doğu ê (eylemsiz, t=0) */
  let sim, U = new THREE.Vector3(), E = new THREE.Vector3();
  const siteLon = options.longitude ?? -80.6;
  function frameFromProfile(latDeg) {
    const lat = latDeg * Math.PI / 180, lon = siteLon * Math.PI / 180;
    U.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    E.set(-Math.sin(lon), 0, -Math.cos(lon));
    /* güneş: sabah fırlatması — site güneşli yarıda, güneş doğu-güneydoğuda ~35° yükseklikte
       (kamera düzlem normalinin +N tarafında; batıdan değil doğudan aydınlanan araç kadraja bakar) */
    const N = new THREE.Vector3().crossVectors(U, E).normalize();
    sunDir.copy(U).multiplyScalar(.62).addScaledVector(E, .70).addScaledVector(N, -.35).normalize();
    sun.position.copy(sunDir).multiplyScalar(400);
  }
  const posAt = (sample, out) => {
    const r = Math.hypot(sample.x, sample.y) * M;
    const th = Math.atan2(sample.y, sample.x);
    return out.copy(U).multiplyScalar(r * Math.cos(th)).addScaledVector(E, r * Math.sin(th));
  };
  const radialAt = (sample, out) => {
    const th = Math.atan2(sample.y, sample.x);
    return out.copy(U).multiplyScalar(Math.cos(th)).addScaledVector(E, Math.sin(th));
  };
  const horizAt = (sample, out) => {
    const th = Math.atan2(sample.y, sample.x);
    return out.copy(U).multiplyScalar(-Math.sin(th)).addScaledVector(E, Math.cos(th));
  };

  /* rampa: Dünya'nın çocuğu (onunla döner) — kule cylZ ile, çıplak kurucu yok */
  const pad = new THREE.Group();
  earth.add(pad);
  {
    const towerMat = new THREE.MeshStandardMaterial({ color: '#8b8f98', metalness: .6, roughness: .45 });
    const tower = cylZ(.0012, .0016, .018, 8, towerMat);       // 1,8 km — sahne ölçeğinde işaret
    tower.position.z = .009; pad.add(tower);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.004, .0055, 48), new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: .55, side: THREE.DoubleSide }));
    ring.position.z = .0004; pad.add(ring);
  }

  /* -------- iz (Line2; instanceCount ile ilerler — geometri yeniden inşa edilmez) */
  const trailMat = new LineMaterial({ color: new THREE.Color(palette.data1).getHex(), linewidth: 2.2, transparent: true, opacity: .95, depthTest: true });
  const ghostMat = new LineMaterial({ color: new THREE.Color(palette.muted).getHex(), linewidth: 1.2, transparent: true, opacity: .22, depthTest: true });
  let trailGeo = new LineGeometry(), ghostGeo = new LineGeometry();
  const trail = new Line2(trailGeo, trailMat);
  const ghost = new Line2(ghostGeo, ghostMat);
  scene.add(trail, ghost);
  let trailPositions = [];                       // sahne koordinatları (samples ile 1:1)
  let trailTimes = [];

  /* atılan kademe için balistik iz (yalnız yerçekimi) */
  const boosterMat = new LineMaterial({ color: new THREE.Color(palette.data2).getHex(), linewidth: 1.4, transparent: true, opacity: .5, depthTest: true });
  let boosterGeo = new LineGeometry();
  const boosterLine = new Line2(boosterGeo, boosterMat);
  scene.add(boosterLine);
  let boosterPath = [];                          // [{t, x, y}] (model düzlemi, m)

  /* -------- araçlar */
  const craft = await loadCraft();
  const rocketFull = craft.buildRocket({ stages: 2 });
  const upperStage = craft.buildRocket({ stages: 1 });
  const booster = craft.buildRocket({ stages: 2 });
  scene.add(rocketFull, upperStage, booster);
  /* kapak: LatheGeometry'li son mesh — ayrılmada solar (opaklık rampası) */
  const fairingMeshes = [];
  upperStage.traverse(o => { if (o.isMesh && o.geometry?.type === 'LatheGeometry') fairingMeshes.push(o); });
  for (const f of fairingMeshes) { f.material = f.material.clone(); f.material.transparent = true; }
  const setGroupOpacity = (g, a) => g.traverse(o => { if (o.isMesh && !o.userData.fx) { if (a < 1 && !o.material.transparent) { o.material = o.material.clone(); o.material.transparent = true; } o.material.opacity = a; o.visible = a > .003; } });

  let fx1 = null, fx2 = null;
  if (craft.buildEngineFX) {
    /* origin motor ağzında: craft_blocks vitrininin kuralı (bbox.min.x + 0,012) */
    const nozzleX = g => new THREE.Box3().setFromObject(g).min.x + .012;
    fx1 = craft.buildEngineFX({ scale: .22, tip: 'atmosfer', seed });
    fx1.group.position.x = nozzleX(rocketFull); rocketFull.add(fx1.group);
    fx2 = craft.buildEngineFX({ scale: .16, tip: 'vakum', seed: seed + 1 });
    fx2.group.position.x = nozzleX(upperStage); upperStage.add(fx2.group);
  }

  /* sabit-zaman modunda plüm durumu deterministik olsun: ateşleme geçici rejimi
     1/60 s adımlarla 90 kare ilerletilir (craft_blocks vitrininin kuralı) */
  function primeFx() {
    const s = sampleAt(sim, timeline.t);
    const preSep = timeline.t < (sim.tSep ?? Infinity);
    const g1 = preSep && s.thrust > 0 ? 1 : 0, g2 = !preSep && s.thrust > 0 ? 1 : 0;
    for (let k = 0; k < 90; k++) { fx1?.update(1 / 60, { gaz: g1, atesle: g1 > 0 }); fx2?.update(1 / 60, { gaz: g2, atesle: g2 > 0 }); }
  }

  /* -------- olay çizelgesi + q grafiği */
  let eventNodes = [];
  function buildEvents() {
    for (const n of eventNodes) n.remove();
    eventNodes = [];
    for (const e of sim.events) {
      if (e.id === 'depleted' || e.id === 'impact') continue;
      const div = document.createElement('div');
      div.className = 'ev' + (e.derived ? ' derived' : '');
      div.dataset.t = String(e.t);
      div.innerHTML = `<span>${e.label}${e.q ? ` · ${nf1.format(e.q / 1000)} kPa` : ''}</span><i></i>`;
      eventsEl.appendChild(div);
      eventNodes.push(div);
    }
    layoutEvents();
  }
  /* ray: SECO+30 s'ye kadar doğrusal (yörünge sahili rayı sıkıştırmasın); etiketler
     piksel çakışmasına göre 3 üst + 3 alt şeride greedy dağıtılır — dürüst eksen, okunur etiket */
  function layoutEvents() {
    const railW = Math.max(120, eventsEl.clientWidth - 270);
    const tEnd = (sim.tSeco ?? sim.duration) + 30;
    eventsEl.querySelector('.rail').dataset.tEnd = String(tEnd);
    const lanes = [];   // her şerit: son kullanılan sağ kenar (px)
    for (const div of eventNodes) {
      const t = Number(div.dataset.t);
      const x = Math.min(1, t / tEnd) * railW;
      const w = div.firstElementChild.getBoundingClientRect().width || 60;
      let lane = 0;
      while (lane < 6 && lanes[lane] != null && x - w / 2 < lanes[lane] + 8) lane++;
      lanes[lane] = x + w / 2;
      div.style.left = `${x.toFixed(1)}px`;
      const above = lane % 2 === 0, k = Math.floor(lane / 2);
      div.querySelector('span').style.top = above ? `${4 - k * 13}px` : `${30 + k * 13}px`;
    }
  }
  let qPathD = '', qMaxPt = null;
  function buildQChart() {
    const S = sim.samples, qmax = sim.maxQ.q, tEnd = Math.max(sim.tMeco ?? sim.duration, 1) * 1.15;
    const pts = [];
    for (const s of S) { if (s.t > tEnd) break; pts.push(`${(s.t / tEnd * 300).toFixed(1)},${(84 - 6 - s.q / qmax * 70).toFixed(1)}`); }
    qPathD = 'M' + pts.join('L');
    qMaxPt = [sim.maxQ.t / tEnd * 300, 84 - 6 - 70];
    qSvg.innerHTML = `
      <path d="${qPathD}" fill="none" stroke="${palette.data1}" stroke-width="1.6"/>
      <line x1="${qMaxPt[0].toFixed(1)}" y1="${qMaxPt[1].toFixed(1)}" x2="${qMaxPt[0].toFixed(1)}" y2="78" stroke="${palette.data2}" stroke-width="1" stroke-dasharray="2 3"/>
      <circle cx="${qMaxPt[0].toFixed(1)}" cy="${qMaxPt[1].toFixed(1)}" r="3" fill="${palette.data2}"/>
      <text x="${(qMaxPt[0] + 6).toFixed(1)}" y="${(qMaxPt[1] + 4).toFixed(1)}" font-size="10" fill="${palette.data2}" font-family="var(--font-mono, monospace)">Max-Q · T+${sim.maxQ.t.toFixed(0)} s · ${(sim.maxQ.alt / 1000).toFixed(1)} km · M ${sim.maxQ.mach.toFixed(2)}</text>
      <line data-cursor x1="0" y1="8" x2="0" y2="78" stroke="${palette.accent}" stroke-width="1"/>
      <circle data-dot r="3" fill="${palette.accent}" cx="0" cy="78"/>`;
    qMaxEl.textContent = `en yüksek ${nf1.format(qmax / 1000)} kPa`;
    qChart.tEnd = tEnd; qChart.cursor = qSvg.querySelector('[data-cursor]'); qChart.dot = qSvg.querySelector('[data-dot]');
  }
  const qChart = { tEnd: 1, cursor: null, dot: null };

  /* -------- senaryo kurulumu (simülasyon + iz) */
  function rebuildScenario(vehicle, profile) {
    sim = simulateAscent(vehicle, profile);
    frameFromProfile(sim.profile.latitude);
    pad.position.copy(U).multiplyScalar(R_SCENE);
    pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), U);
    /* iz noktaları */
    trailPositions = []; trailTimes = [];
    const v = new THREE.Vector3();
    const flat = [];
    for (const s of sim.samples) { posAt(s, v); trailPositions.push(v.clone()); trailTimes.push(s.t); flat.push(v.x, v.y, v.z); }
    /* Line2 geometrisi yeniden kurulur — bu anda iz görünmez (instanceCount 0) */
    trail.geometry.dispose(); trailGeo = new LineGeometry(); trailGeo.setPositions(flat); trail.geometry = trailGeo; trailGeo.instanceCount = 0;
    ghost.geometry.dispose(); ghostGeo = new LineGeometry(); ghostGeo.setPositions(flat); ghost.geometry = ghostGeo;
    /* atılan kademenin balistik yolu: MECO durumundan yalnız yerçekimiyle */
    boosterPath = [];
    if (sim.tSep != null) {
      const s0 = sampleAt(sim, sim.tSep);
      let x = s0.x, y = s0.y, vx = s0.vx, vy = s0.vy, t = sim.tSep;
      const mu = 3.986004418e14, dt = 2;
      const bflat = [];
      while (t < sim.tSep + 900 && Math.hypot(x, y) > R_EARTH) {
        const r3 = Math.hypot(x, y) ** 3;
        vx += -mu * x / r3 * dt; vy += -mu * y / r3 * dt; x += vx * dt; y += vy * dt; t += dt;
        boosterPath.push({ t, x, y });
        posAt({ x, y }, v); bflat.push(v.x, v.y, v.z);
      }
      boosterLine.geometry.dispose(); boosterGeo = new LineGeometry();
      if (bflat.length >= 6) boosterGeo.setPositions(bflat);
      boosterLine.geometry = boosterGeo; boosterGeo.instanceCount = 0;
    }
    buildEvents(); buildQChart();
    noteEl.textContent = `${sim.vehicle.name} · ${sim.ok ? `yörünge ${nf0.format(sim.orbit.hp / 1000)} × ${nf0.format(sim.orbit.ha / 1000)} km` : 'yörüngeye ULAŞAMADI'} · araç boyu görünürlük için abartılı`;
    timeline.duration = sim.duration;
  }

  /* -------- zaman çizelgesi */
  const timeline = {
    t: 0, duration: 1, playing: false, warp: options.warp ?? 2,
    play() { this.playing = true; ensureLoop(); }, pause() { this.playing = false; },
    scrub(t) { this.t = Math.min(this.duration, Math.max(0, t)); snapCamera = true; primeFx(); render(0); },
    setWarp(w) { this.warp = w; },
  };

  /* -------- kamera yönetmeni */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.enabled = false;
  const cam = { current: options.camera ?? 'auto', from: null, to: null, blend: 1, duration: 1 };
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  let snapCamera = true;
  const _p = new THREE.Vector3(), _r = new THREE.Vector3(), _h = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Vector3();
  function autoMode(t) {
    if (t < 28) return 'pad';
    if (sim.tSep != null && t > sim.tSep + 40) return 'wide';
    if (t > 150) return 'wide';
    return 'chase';
  }
  function poseFor(mode, t, s, out) {
    posAt(s, _p); radialAt(s, _r); horizAt(s, _h); _n.crossVectors(_r, _h).normalize();   // _n: yörünge düzlemi normali
    const L = rocketLength(s);
    if (mode === 'pad') {
      /* kule kamerası: rampanın 2,4 km yanı, hafif yüksek; roketi izler */
      /* kule kamerası: rampanın 4,5 km yanı, roketin boyuna göre geri çekilir */
      out.pos.copy(U).multiplyScalar(R_SCENE + .006).addScaledVector(_n, .045 + s.alt * M * .6).addScaledVector(E, -.012);
      out.target.copy(_p);
      out.fov = 34;
    } else if (mode === 'chase') {
      /* arkadan-yandan: hız yönünün gerisi, düzlem normali boyunca yana, biraz yukarı */
      const back = t < 60 ? -.35 : -.55;
      out.pos.copy(_p).addScaledVector(_h, back * L * 2.2).addScaledVector(_n, L * 2.6).addScaledVector(_r, L * 1.1);
      out.target.copy(_p);
      out.fov = 42;
    } else {
      /* geniş: menzil arttıkça geri çekilen, arkı ve Dünya kavisini gösteren plan */
      const dr = Math.max(150e3, s.downrange) * M;
      const mid = _q.copy(U).multiplyScalar(R_SCENE + s.alt * M * .55).addScaledVector(E, dr * .5);
      out.pos.copy(mid).addScaledVector(_n, Math.max(2.2, dr * 1.15)).addScaledVector(U, dr * .35);
      out.target.copy(mid);
      out.fov = 40;
    }
  }
  const poseA = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 42 }, poseB = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 42 };
  let lastMode = 'pad';
  function updateCamera(t, s, dtReal) {
    const desired = cam.current === 'auto' ? autoMode(t) : cam.current;
    if (desired === 'free') { controls.enabled = true; controls.update(); applySky(camera.position.length() / M - R_EARTH); return; }
    controls.enabled = false;
    if (desired !== lastMode) { cam.from = lastMode; cam.blend = 0; cam.duration = 1.6; lastMode = desired; }
    poseFor(desired, t, s, poseB);
    if (cam.blend < 1 && cam.from && !snapCamera) {
      poseFor(cam.from, t, s, poseA);
      cam.blend = Math.min(1, cam.blend + dtReal / cam.duration);
      const f = smooth01(cam.blend);
      camPos.lerpVectors(poseA.pos, poseB.pos, f); camTarget.lerpVectors(poseA.target, poseB.target, f);
      camera.fov = lerp(poseA.fov, poseB.fov, f);
    } else {
      if (snapCamera) { camPos.copy(poseB.pos); camTarget.copy(poseB.target); cam.blend = 1; }
      else { camPos.lerp(poseB.pos, 1 - Math.exp(-dtReal * 6)); camTarget.lerp(poseB.target, 1 - Math.exp(-dtReal * 8)); }
      camera.fov = poseB.fov;
    }
    camera.position.copy(camPos);
    applySky(camPos.length() / M - R_EARTH);
    camera.up.copy(_r.lengthSq() ? _r : U);
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
    snapCamera = false;
  }

  /* -------- araç ölçeği: irtifayla 4 → 12 km (saf fonksiyon, C0) */
  const rocketLength = s => lerp(.04, .12, smooth01(s.alt / 150e3));

  /* -------- kare */
  const upA = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), mtx = new THREE.Matrix4();
  function orient(group, s, pos, L, coastAlign) {
    radialAt(s, _r); horizAt(s, _h);
    let ang = s.thrust > 0 || !coastAlign ? s.pitch : s.gamma;
    if (s.phase === 'orbit' || s.phase === 'coast') ang = s.gamma;
    fwd.copy(_r).multiplyScalar(Math.sin(ang)).addScaledVector(_h, Math.cos(ang)).normalize();
    upA.copy(_r).addScaledVector(fwd, -_r.dot(fwd)).normalize();      // +Z = radyal (fwd'ye dik)
    side.crossVectors(upA, fwd).normalize();                            // Y = Z × X
    mtx.makeBasis(fwd, side, upA);
    group.quaternion.setFromRotationMatrix(mtx);
    group.position.copy(pos).addScaledVector(fwd, L * .5);     // kuyruk (motor ağzı) iz ucunda
    group.scale.setScalar(L);
  }
  function render(dtReal) {
    const t = timeline.t;
    const s = sampleAt(sim, t);
    earth.rotation.y = OMEGA_EARTH * t;
    /* iz: t'ye kadar (instanceCount saf fonksiyon) */
    let n = 0; { let lo = 0, hi = trailTimes.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; trailTimes[m] <= t ? lo = m : hi = m; } n = lo; }
    trailGeo.instanceCount = Math.max(0, n);
    /* araçlar */
    posAt(s, _p);
    const L = rocketLength(s);
    const sepT = sim.tSep ?? Infinity;
    const preSep = t < sepT;
    rocketFull.visible = preSep;
    if (preSep) orient(rocketFull, s, _p, L, true);
    upperStage.visible = !preSep;
    if (!preSep) orient(upperStage, s, _p, L * .55, true);
    /* atılan kademe: balistik yol boyunca, 20 s içinde solar */
    if (!preSep && boosterPath.length) {
      const age = t - sepT;
      const a = 1 - smooth01((age - 6) / 22);
      booster.visible = a > .003;
      if (booster.visible) {
        let k = Math.min(boosterPath.length - 1, Math.max(0, Math.floor(age / 2)));
        const b = boosterPath[k];
        posAt(b, _q); radialAt(b, _r); horizAt(b, _h);
        fwd.copy(_r).multiplyScalar(.3).addScaledVector(_h, 1).normalize();
        upA.copy(_r).addScaledVector(fwd, -_r.dot(fwd)).normalize(); side.crossVectors(upA, fwd).normalize();
        mtx.makeBasis(fwd, side, upA); booster.quaternion.setFromRotationMatrix(mtx);
        booster.position.copy(_q); booster.scale.setScalar(L);
        setGroupOpacity(booster, a);
      }
      boosterGeo.instanceCount = Math.min(boosterPath.length - 1, Math.max(0, Math.floor(age / 2)));
      boosterMat.opacity = .5 * (1 - smooth01((age - 60) / 60));
    } else { booster.visible = false; boosterGeo.instanceCount = 0; }
    /* kapak: ayrılmadan sonra 3 s içinde solar */
    const fairT = sim.tFairing ?? Infinity;
    const fa = 1 - smooth01((t - fairT) / 3);
    for (const f of fairingMeshes) { f.material.opacity = fa; f.visible = fa > .003; }
    /* motor efektleri: gaz = itki oranı (saf fonksiyon) */
    const throttle1 = preSep && s.thrust > 0 ? 1 : 0;
    const throttle2 = !preSep && s.thrust > 0 ? 1 : 0;
    if (fx1) fx1.update(Math.max(dtReal * timeline.warp, 0), { gaz: throttle1, atesle: throttle1 > 0 });
    if (fx2) fx2.update(Math.max(dtReal * timeline.warp, 0), { gaz: throttle2, atesle: throttle2 > 0 });
    /* kamera */
    updateCamera(t, s, dtReal);
    /* HUD */
    hud.t.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    hud.alt.textContent = `${nf1.format(s.alt / 1000)} km`;
    hud.dr.textContent = `${nf0.format(s.downrange / 1000)} km`;
    hud.v.textContent = `${nf0.format(s.v)} m/s`;
    hud.gamma.textContent = `${nf1.format(s.gamma * 180 / Math.PI)}°`;
    hud.q.textContent = `${nf1.format(s.q / 1000)} kPa`;
    hud.mach.textContent = s.alt < 90e3 ? nf2.format(s.mach) : '—';
    hud.twr.textContent = s.thrust > 0 ? nf2.format(s.twr) : '0';
    hud.m.textContent = `${nf1.format(s.m / 1000)} t`;
    hud.g.textContent = `${nf2.format(s.accel)} g`;
    const phaseLabel = { vertical: 'dikey kalkış', kick: 'pitch kick', gravityturn: 'yerçekimi dönüşü', coast: 'serbest uçuş', stage2: '2. kademe · kapalı-döngü pitch', orbit: 'yörüngede' }[s.phase] || s.phase;
    hud.phase.textContent = `${s.stage}. kademe · ${phaseLabel} · ${timeline.warp}× zaman`;
    /* olaylar + q grafiği */
    doneEl.style.transform = `scaleX(${clamp01(t / Number(eventsEl.querySelector('.rail').dataset.tEnd || sim.duration)).toFixed(4)})`;
    for (const nEl of eventNodes) nEl.classList.toggle('past', Number(nEl.dataset.t) <= t);
    if (qChart.cursor) {
      const x = Math.min(300, t / qChart.tEnd * 300);
      qChart.cursor.setAttribute('x1', x.toFixed(1)); qChart.cursor.setAttribute('x2', x.toFixed(1));
      qChart.dot.setAttribute('cx', x.toFixed(1)); qChart.dot.setAttribute('cy', (84 - 6 - Math.min(1, s.q / sim.maxQ.q) * 70).toFixed(1));
    }
    renderer.render(scene, camera);
  }

  /* -------- döngü */
  let active = options.active ?? true, rafId = 0, lastNow = 0;
  const stats = { advanceMs: 0 };
  function advance(dt) {
    const t0 = performance.now();
    if (timeline.playing) {
      timeline.t = Math.min(timeline.duration, timeline.t + dt * timeline.warp);
      if (timeline.t >= timeline.duration) timeline.playing = false;
    }
    render(dt);
    stats.advanceMs = stats.advanceMs * .9 + (performance.now() - t0) * .1;
  }
  function loop(now) {
    rafId = 0;
    if (!active || document.hidden) return;
    const dt = Math.min(.1, lastNow ? (now - lastNow) / 1000 : 1 / 60);
    lastNow = now;
    advance(dt);
    ensureLoop();
  }
  function ensureLoop() { if (active && !rafId && !document.hidden) rafId = requestAnimationFrame(loop); }
  const onVis = () => { lastNow = 0; ensureLoop(); };
  document.addEventListener('visibilitychange', onVis);

  /* -------- boyut */
  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    trailMat.resolution.set(w, h); ghostMat.resolution.set(w, h); boosterMat.resolution.set(w, h);
  }
  const ro = new ResizeObserver(() => { resize(); layoutEvents(); render(0); });
  ro.observe(host);

  /* -------- kurulum */
  rebuildScenario(options.vehicle, options.profile);
  resize();
  const tableau = sim.maxQ.t;                                  // ilan edilen tablo: Max-Q ânı
  if (reducedMotion || exportMode) { timeline.t = tableau; cam.current = options.camera ?? 'chase'; lastMode = 'chase'; }
  else if (options.autoplay ?? true) timeline.playing = true;
  snapCamera = true;
  render(0); render(0);
  ensureLoop();

  return {
    get sim() { return sim; },
    timeline,
    camera: {
      get current() { return cam.current; },
      mode(m) { cam.current = m; snapCamera = true; render(0); },
      transitionTo(m, { duration = 1.6 } = {}) { cam.current = m; cam.duration = Math.max(.01, duration / 1000); if (duration === 0) snapCamera = true; render(0); },
      get activeMode() { return cam.current === 'auto' ? autoMode(timeline.t) : cam.current; },
    },
    setScenario(vehicle, profile) { timeline.t = 0; rebuildScenario(vehicle, profile); snapCamera = true; render(0); },
    advance, stats,
    setActive(v) { active = !!v; if (active) { lastNow = 0; ensureLoop(); } },
    hud(v) { hudEl.hidden = !v; figure.querySelector('.launch-ascent__q').hidden = !v; },
    tableau,
    dispose() {
      active = false; if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
      fx1?.dispose(); fx2?.dispose(); controls.dispose(); renderer.dispose(); figure.remove();
    },
  };
}
