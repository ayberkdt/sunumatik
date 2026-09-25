/* terrain-material.mjs — regolit / kum malzemeleri (§5).

   "Canlı doku"nun yarısı geometri, yarısı malzemedir. lunar_descent'in premium
   katmanı (dört-tap detay merdiveni + bölge albedosu) burada yeniden ve
   PAYLAŞILABİLİR yazılır:

   · Temel BRDF: Lambert — regolit Lambert yansıtıcıdır; Standard'ın GGX'i
     sıyırma açısında fiziksel olarak yersiz speküler bant basıyordu
     (surface-scene dersi). Karşıtlık etkisi (opposition surge) light-physics
     planının shader parçasıdır; buraya `uOppositionGain` uniform'u ve kanca
     bırakıldı, varsayılan 0 (etkisiz) — plan 3 gelince bağlanır.
   · Eğim-albedo: yamaç taze/kayalık (açık), düzlük tozlu (koyu, Mars'ta
     daha kırmızı): albedo = mix(dust, rock, smoothstep(s0, s1, eğim)).
   · Yükseklik-albedo: yayla mare'den açık — uHeightAlbedo (birim başına).
   · Detay merdiveni (dört tap, 2×2 döndürmeli): tekrar hiçbir mesafede okunmaz.
   · Bölge albedosu: krater ışın sistemleri + mare lekeleri, dünya uzayında.
   · Overlay kanalı (R4): harici skaler doku (alan boyama) — uOverlayMix.
   · Tri-planar ve tekerlek izi dokusu bu turda yok (plan §5; rigs planı). */

import { mulberry32, fbm2D } from './terrain-noise.mjs';

/** Detay dokusu: R = albedo modülasyonu, GB = mikro rölyef eğimi (merkezi fark). */
export function createDetailTexture(THREE, seed, size = 256) {
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = fbm2D(seed, { octaves: 4, gain: .55 });
  const f = 6 / size;
  const val = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) val[y * size + x] = n(x * f, y * f);
  const at = (x, y) => val[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const gx = (at(x + 1, y) - at(x - 1, y)) * 3, gy = (at(x, y + 1) - at(x, y - 1)) * 3;
    img.data[i] = 128 + at(x, y) * 220; img.data[i + 1] = 128 + gx * 255; img.data[i + 2] = 128 + gy * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Bölge albedosu (lunar_descent reçetesinin genellemesi): mare/highland
    lekeleri, taze krater ejecta örtüsü + ışın demeti, piroklastik lekeler.
    Dünya (x,z) → uv: aynı krater listesiyle boyandığı için ışınlar GERÇEK
    kenarlardan çıkar. Mars: mare yok, koyu bazalt kum lekeleri var. */
export function paintRegionAlbedo(THREE, field, { seed, extent = 6500, size = 1024, planet = 'moon' } = {}) {
  const rnd = mulberry32(seed ^ 0xB016E);
  const cnv = document.createElement('canvas'); cnv.width = cnv.height = size;
  const c = cnv.getContext('2d');
  const px = x => (x / (2 * extent) + .5) * size, py = z => (.5 - z / (2 * extent)) * size, pr = r => r / (2 * extent) * size;
  const moon = planet !== 'mars';
  c.fillStyle = moon ? '#7c7b75' : '#7f7a74'; c.fillRect(0, 0, size, size);   // nötr referans (tonu malzeme verir)
  for (let i = 0; i < 130; i++) {
    const r = size * (.04 + Math.pow(rnd(), 1.6) * .30), x = rnd() * size, y = rnd() * size;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rnd() < .5 ? 'rgba(150,148,141,.30)' : 'rgba(74,72,68,.30)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < (moon ? 6 : 4); i++) {                     // mare havzaları / bazalt kum lekeleri
    const r = size * (.14 + rnd() * .2), x = rnd() * size, y = rnd() * size;
    const g = c.createRadialGradient(x, y, r * .1, x, y, r);
    g.addColorStop(0, 'rgba(58,57,54,.46)'); g.addColorStop(.65, 'rgba(63,62,58,.30)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const craters = field.layers.find(L => L.name === 'craterField')?.describe().craters ?? [];
  for (const k of craters) {
    const fresh = 1 - k.age;
    if (k.R < 6 || fresh < .62) continue;
    const x = px(k.x), y = py(k.z), r = pr(k.R);
    if (r < 1.2) continue;
    const power = (fresh - .62) / .38;
    const g = c.createRadialGradient(x, y, r * .6, x, y, r * 2.6);
    g.addColorStop(0, `rgba(196,192,182,${(.30 * power).toFixed(3)})`); g.addColorStop(.35, `rgba(180,176,166,${(.15 * power).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
    if (k.R < 18) continue;
    const rays = 7 + Math.floor(rnd() * 9);
    c.save(); c.translate(x, y);
    for (let i = 0; i < rays; i++) {
      const a = rnd() * Math.PI * 2, len = r * (3 + Math.pow(rnd(), 1.4) * 7), half = r * (.10 + rnd() * .16);
      c.save(); c.rotate(a);
      const lg = c.createLinearGradient(r, 0, len, 0);
      lg.addColorStop(0, `rgba(202,198,188,${(.26 * power).toFixed(3)})`); lg.addColorStop(.4, `rgba(190,186,176,${(.13 * power).toFixed(3)})`); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(r * .8, -half * .5); c.lineTo(len, -half * 1.7); c.lineTo(len, half * 1.7); c.lineTo(r * .8, half * .5); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
  }
  for (let i = 0; i < 46; i++) {                                 // piroklastik / koyu lekeler
    const r = size * (.008 + Math.pow(rnd(), 2) * .05), x = rnd() * size, y = rnd() * size;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(52,51,48,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(cnv);
  /* doğrusal okunur: 0,49 nötr → çarpan 1,0; sRGB okunsaydı 0,2'ye çöküp zemini karartırdı (ölçüldü) */
  tex.colorSpace = THREE.NoColorSpace; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.anisotropy = 8;
  return { texture: tex, extent };
}

/** Regolit/kum malzemesi. `textures.albedo` isteğe bağlı (Lunaris webp);
    detay ve bölge dokuları burada üretilir. Dönen nesnede `uniforms` canlı. */
export function createTerrainMaterial(THREE, {
  seed = 1, dust = 0x8f8b84, rock = 0xb0aba2, slopeAlbedo = [20, 35], heightAlbedo = 0, planet = 'moon',
  albedoTexture = null, albedoRepeat = 9, region = null, detailA = null, detailB = null,
} = {}) {
  const dA = detailA || createDetailTexture(THREE, seed ^ 0xD3A1), dB = detailB || createDetailTexture(THREE, seed ^ 0x7B2E);
  /* Doku varsa taban rengi nötr gri (0xd0d0d0: surface-scene'in 0xd0ccc4'üyle
     aynı parlaklık, sıcak tonu yok — tonu yalnız uDust/uRock verir); ton çarpanları
     nötr griye (0,5 doğrusal) normalize edilir — üç çarpanın üst üste binip
     zemini kömürleştirdiği ilk ekran görüntüsünün dersi. */
  const mat = new THREE.MeshLambertMaterial({ color: albedoTexture ? 0xd0d0d0 : 0xffffff, map: albedoTexture || null });
  const lin = hex => { const c = new THREE.Color(hex); return .2126 * c.r + .7152 * c.g + .0722 * c.b; };
  const tonNorm = albedoTexture ? 1 / Math.max(.05, lin(dust)) : 1 / Math.max(.05, lin(dust)) * .5;
  if (albedoTexture) { albedoTexture.wrapS = albedoTexture.wrapT = THREE.RepeatWrapping; albedoTexture.repeat.set(albedoRepeat, albedoRepeat); }
  const toRgb = hex => new THREE.Color(hex);
  const uniforms = {
    uDust: { value: toRgb(dust) }, uRock: { value: toRgb(rock) }, uTonNorm: { value: tonNorm },
    uSlopeEdges: { value: new THREE.Vector2(Math.cos(slopeAlbedo[1] * Math.PI / 180), Math.cos(slopeAlbedo[0] * Math.PI / 180)) },
    uHeightAlbedo: { value: heightAlbedo },
    uDetay: { value: dA }, uDetay2: { value: dB },
    /* albedo tekrarı 9× / 60× / 220× / 900× (extent 10 000 birim üstünden) */
    uFrek: { value: new THREE.Vector4(9 / 10000, 60 / 10000, 220 / 10000, 900 / 10000) },
    uAlbAmp: { value: new THREE.Vector4(.16, .12, .10, .08) },
    uEgimAmp: { value: new THREE.Vector4(.9, .8, .6, .35) },
    uDetayGuc: { value: 1 },
    uBolge: { value: region?.texture ?? dA }, uBolgeOlcek: { value: region ? 1 / (2 * region.extent) : 0 }, uBolgeGuc: { value: region ? 1 : 0 },
    uOverlay: { value: dA }, uOverlayMix: { value: 0 }, uOverlayOlcek: { value: 1 / 10000 },
    uOppositionGain: { value: 0 },                       // light-physics kancası (plan 3)
    uPlanet: { value: planet === 'mars' ? 1 : 0 },
  };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec2 vDunyaXZ; varying float vDunyaY; varying vec3 vDunyaN;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 dunyaP = modelMatrix * vec4(transformed, 1.0);
       vDunyaXZ = dunyaP.xz; vDunyaY = dunyaP.y;
       vDunyaN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = `varying vec2 vDunyaXZ; varying float vDunyaY; varying vec3 vDunyaN;
      uniform vec3 uDust; uniform vec3 uRock; uniform vec2 uSlopeEdges; uniform float uHeightAlbedo; uniform float uTonNorm;
      uniform sampler2D uDetay; uniform sampler2D uDetay2; uniform vec4 uFrek; uniform vec4 uAlbAmp; uniform vec4 uEgimAmp; uniform float uDetayGuc;
      uniform sampler2D uBolge; uniform float uBolgeOlcek; uniform float uBolgeGuc;
      uniform sampler2D uOverlay; uniform float uOverlayMix; uniform float uOverlayOlcek;
      uniform float uOppositionGain; uniform float uPlanet;
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        mat2 DON1 = mat2(0.8000, 0.6000, -0.6000, 0.8000);
        mat2 DON2 = mat2(-0.5137, 0.8580, -0.8580, -0.5137);
        mat2 DON3 = DON1 * DON2;
        vec4 dtA = texture2D(uDetay, vDunyaXZ * uFrek.x);
        vec4 dtB = texture2D(uDetay2, (DON1 * vDunyaXZ) * uFrek.y + vec2(0.317, 0.771));
        vec4 dtC = texture2D(uDetay, (DON2 * vDunyaXZ) * uFrek.z + vec2(0.633, 0.194));
        vec4 dtD = texture2D(uDetay2, (DON3 * vDunyaXZ) * uFrek.w + vec2(0.118, 0.442));
        float dtAlb = (dtA.r - 0.5) * uAlbAmp.x + (dtB.r - 0.5) * uAlbAmp.y + (dtC.r - 0.5) * uAlbAmp.z + (dtD.r - 0.5) * uAlbAmp.w;
        /* eğim-albedo: yamaç kayalık (açık), düzlük tozlu */
        float egimCos = clamp(vDunyaN.y, 0.0, 1.0);
        float kayalik = 1.0 - smoothstep(uSlopeEdges.x, uSlopeEdges.y, egimCos);
        vec3 ton = mix(uDust, uRock, kayalik) * uTonNorm;
        ton *= 1.0 + uHeightAlbedo * vDunyaY;
        vec3 bolge = mix(vec3(0.49), texture2D(uBolge, vDunyaXZ * uBolgeOlcek + 0.5).rgb, uBolgeGuc);
        diffuseColor.rgb *= ton * (0.55 + 0.92 * bolge) * (1.0 + uDetayGuc * dtAlb);
        vec3 ovr = texture2D(uOverlay, vDunyaXZ * uOverlayOlcek + 0.5).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, ovr, uOverlayMix);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 dtEgim = (dtA.gb - 0.5) * uEgimAmp.x + ((dtB.gb - 0.5) * uEgimAmp.y) * DON1
                    + ((dtC.gb - 0.5) * uEgimAmp.z) * DON2 + ((dtD.gb - 0.5) * uEgimAmp.w) * DON3;
        vec3 dnyN = normalize(vDunyaN + vec3(-dtEgim.x, 0.0, -dtEgim.y) * uDetayGuc * 0.35);
        normal = normalize((viewMatrix * vec4(dnyN, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'terrain-regolith-v1';
  return { material: mat, uniforms, textures: [dA, dB, region?.texture].filter(Boolean),
    dispose() { mat.dispose(); dA.dispose(); dB.dispose(); region?.texture?.dispose(); } };
}
