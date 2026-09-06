/* lab-three.mjs — three.js laboratuvar sahneleri için ortak görsel yapı taşları.
   Hepsi fiziksel gerekçeli ve mat: fresnel atmosfer (kenarda saçılma), kamera uzaklığıyla ölçeklenen ışıma noktaları
   (küçük cisimlerin okunurluğu), uzak Güneş ışıması (ışık yönünün görünür kaynağı), dokulu Dünya, tohumlu yıldız alanı.
   Kullanım: import { atmosphereMaterial, glowSprite, sunGlow, addEarth, starfield, fitGlow } from '../core/lab-three.mjs';
   THREE modülü çağıranın importmap'inden verilir (tek kopya kuralı: presets/moon_advanced/vendor). */

export const EARTH_TEX = '../earth_advanced/textures/earth_atmos_2048.jpg';
export const EARTH_NORMAL = '../earth_advanced/textures/earth_normal_2048.jpg';
export const EARTH_SPEC = '../earth_advanced/textures/earth_specular_2048.jpg';
export const MOON_TEX = '../moon_react_source/public/lunaris/textures/aesthetic_moon_real.webp';

export function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Fresnel kabuk: kenarda parlar, merkezde saydam (atmosfer, etki küresi). uniforms: uColor, uStrength, uAlpha. */
export function atmosphereMaterial(THREE, color, strength = 1.4, { side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uAlpha: { value: 1 } }, transparent: true, depthWrite: false, side,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uStrength; uniform float uAlpha; varying vec3 vN; varying vec3 vV; void main(){ float f = 1. - max(0., dot(normalize(vN), normalize(vV))); float rim = pow(f, 3.2); gl_FragColor = vec4(uColor * (0.35 + 0.65 * rim), (0.045 + 0.5 * rim) * uStrength * uAlpha); }' });
}
/** Atmosfer kabuğu: yarıçap r·k, fresnel. */
export function atmosphereShell(THREE, r, color = '#6fb4ff', strength = 1.5, k = 1.035) { const m = new THREE.Mesh(new THREE.SphereGeometry(r * k, 64, 48), atmosphereMaterial(THREE, color, strength)); m.renderOrder = 2; return m; }

let _glowTex = null;
export function glowTexture(THREE) {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(255,255,255,.55)'); r.addColorStop(.5, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c); _glowTex.colorSpace = THREE.SRGBColorSpace; return _glowTex;
}
/** Işıma noktası (sprite): küçük cisimleri uzaktan okunur tutar. depthTest kapalı → her zaman görünür. */
export function glowSprite(THREE, color, opacity = .7, { depthTest = false } = {}) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE), color, transparent: true, opacity, depthWrite: false, depthTest })); sp.renderOrder = 5; return sp; }
/** Işımayı kamera uzaklığıyla ölçekle: görünür yarıçap ~ sabit piksel. */
export function fitGlow(sprite, camera, k = .03, min = 0) { const d = camera.position.distanceTo(sprite.getWorldPosition(_tmp)); sprite.scale.setScalar(Math.max(min, d * k)); }
const _tmp = { x: 0, y: 0, z: 0, set() { return this; } };
/** Uzak Güneş: yön vektörü boyunca uzakta, büyük sıcak ışıma. */
export function sunGlow(THREE, scene, dir, { dist = 400, size = 60, color = '#ffe6bd', opacity = .95 } = {}) { const sp = glowSprite(THREE, color, opacity); sp.position.copy(dir).normalize().multiplyScalar(dist); sp.scale.setScalar(size); sp.renderOrder = -5; scene.add(sp); return sp; }
/** Tohumlu yıldız alanı (Points), yarıçap aralığında. */
export function starfield(THREE, scene, { seed = 11, n = 1400, r0 = 200, r1 = 350, size = .7, opacity = .7 } = {}) {
  const rand = mulberry32(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = r0 + rand() * (r1 - r0), th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph); const w = .6 + rand() * .5, tint = rand(); col[i * 3] = w * (tint < .2 ? .85 : 1); col[i * 3 + 1] = w * (tint < .2 ? .9 : tint > .8 ? .92 : 1); col[i * 3 + 2] = w * (tint > .8 ? .8 : 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size, sizeAttenuation: false, transparent: true, opacity, depthWrite: false })); stars.renderOrder = -10; scene.add(stars); return stars;
}
/** Dokulu Dünya (gün dokusu + opsiyonel normal/spekülar) + fresnel atmosfer; base URL çağıranın modülü. */
export async function addEarth(THREE, parent, { radius = 1, baseUrl, atmosphere = '#6fb4ff', atmoStrength = 1.5, detail = false, segments = 96, color = '#ffffff' } = {}) {
  const loader = new THREE.TextureLoader(); const url = rel => baseUrl ? new URL(rel, baseUrl).href : rel;
  let mesh;
  try {
    const day = await loader.loadAsync(url(EARTH_TEX)); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8;
    const opts = { map: day, color: new THREE.Color(color), specular: new THREE.Color('#2a3138'), shininess: 10 };
    if (detail) { try { const [normal, spec] = await Promise.all([loader.loadAsync(url(EARTH_NORMAL)), loader.loadAsync(url(EARTH_SPEC))]); opts.normalMap = normal; opts.normalScale = new THREE.Vector2(.7, .7); opts.specularMap = spec; } catch (e) { /* ayrıntı dokusu yoksa gün dokusuyla devam */ } }
    mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments * .75)), new THREE.MeshPhongMaterial(opts));
  } catch (e) { mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), new THREE.MeshStandardMaterial({ color: '#274668', roughness: .85 })); }
  parent.add(mesh);
  const atmo = atmosphere ? atmosphereShell(THREE, radius, atmosphere, atmoStrength) : null; if (atmo) parent.add(atmo);
  return { mesh, atmo };
}
