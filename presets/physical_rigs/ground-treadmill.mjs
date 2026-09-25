/* ground-treadmill.mjs — treadmill ARAZİSİNİN three tarafı: döşeli örgü,
 * periyodik prosedürel doku, kaya alanı ve tekerlek izi şeridi.
 * Çekirdek matematik three'sizdir (terrain-treadmill.mjs); burada yalnız
 * geometri/malzeme kurulur.
 *
 * DİKİŞ KURALI: tek bir düzlem örgüsü kurulur ve N kopya z boyunca period
 * aralıkla dizilir. Yükseklik fonksiyonu z'de periyodik olduğu için kopya
 * sınırında ne yükseklik ne EĞİM atlar; grup −mesafe kadar kaydırılınca
 * zemin sonsuz akıyor gibi görünür. Görünür geometri hiç yeniden kurulmaz
 * (webgl-scene-contract §2) — yalnız grup konumu değişir.
 *
 * DOKU: gürültü ızgaraları da periyodiktir (periodicNoise), bu yüzden
 * `repeat` ile döşenen doku kendi içinde de dikişsizdir. Renk ve tümsek
 * haritası aynı yükseklik alanından türetilir; ayrı ayrı uydurulmaz.
 *
 * API:
 *   buildTreadmillGround(THREE, field, { width, tiles, seg, floor, palette, renderer })
 *     → { group, geometry, material, textures, rocks, dispose() }
 *   buildTracks(THREE, { count, segments, length, halfWidth, spacing, tile })
 *     → { group, update(pathAt, height, distance), material, dispose() }
 *   contactShadow(THREE, { size, opacity }) → Mesh (yumuşak temas gölgesi)
 */

import { periodicFbm, mulberry32 } from './terrain-treadmill.mjs';

/* ── prosedürel zemin dokusu (renk + tümsek), periyodik ─────────────── */
function groundTextures(THREE, field, { size = 512, seed = 31027, palette, anisotropy = 8 } = {}) {
  const base = palette?.base ?? [74, 58, 54];
  const broad = periodicFbm(seed, [4, 8, 16], [0.53, 0.31, 0.16]);
  const grit = periodicFbm(seed + 991, [32, 64], [0.58, 0.42]);
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = color.height = bump.width = bump.height = size;
  const cctx = color.getContext('2d'), bctx = bump.getContext('2d');
  const img = cctx.createImageData(size, size), bimg = bctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    /* katman izi (stratum): sedimanter bantlanma — düz gürültü taş gibi okunmaz */
    const stratum = Math.sin(Math.PI * 2 * (v * 5 + broad(u, v) * 0.53)) * 0.07;
    const h = Math.max(0, Math.min(1, broad(u, v) * 0.7 + grit(u, v) * 0.3 + stratum));
    const p = (y * size + x) * 4, d = (h - 0.5) * 49;
    img.data[p] = base[0] + d; img.data[p + 1] = base[1] + d * 0.74; img.data[p + 2] = base[2] + d * 0.63;
    img.data[p + 3] = 255;
    const g = Math.round(255 * h);
    bimg.data[p] = bimg.data[p + 1] = bimg.data[p + 2] = g; bimg.data[p + 3] = 255;
  }
  cctx.putImageData(img, 0, 0); bctx.putImageData(bimg, 0, 0);
  /* Seyrek çakıl lekeleri: kameradan okunacak kadar büyük, parıldamayacak kadar mat. */
  const rnd = mulberry32(seed + 7118);
  for (let i = 0; i < 420; i++) {
    const x = 10 + rnd() * (size - 20), y = 10 + rnd() * (size - 20);
    const r = 1.4 + Math.pow(rnd(), 2) * 5.4;
    cctx.fillStyle = `rgba(19,21,25,${(0.13 + rnd() * 0.19).toFixed(3)})`;
    cctx.beginPath(); cctx.ellipse(x, y, r * 1.45, r * 0.7, rnd() * 6.283, 0, 6.283); cctx.fill();
    cctx.fillStyle = 'rgba(183,142,109,.12)';
    cctx.beginPath(); cctx.ellipse(x - r * 0.28, y - r * 0.25, r * 0.65, r * 0.25, 0, 0, 6.283); cctx.fill();
  }
  const map = new THREE.CanvasTexture(color), bumpMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, bumpMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; }
  return { map, bumpMap };
}

export function buildTreadmillGround(THREE, field, {
  width = 50, tiles = 5, segX = 112, segZ = 96, floor = 0, tile = null,
  palette = {}, anisotropy = 8, rocks = 420, lane = 1.6, laneHalfWidth = 1.2,
} = {}) {
  const P = field.period;
  const repeat = tile ?? P / 4;
  const { map, bumpMap } = groundTextures(THREE, field, { palette, anisotropy });
  map.repeat.set(width / repeat, P / repeat);
  bumpMap.repeat.set(width / repeat, P / repeat);

  /* Tek geometri, N kopya: yükseklik ve normal analitik alandan yazılır. */
  const geometry = new THREE.PlaneGeometry(width, P, segX, segZ);
  const pos = geometry.attributes.position, nrm = geometry.attributes.normal;
  const eps = 0.035, g = [0, 0];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = -pos.getY(i);
    pos.setZ(i, field.height(x, z));
    field.gradient(x, z, g);
    const inv = 1 / Math.hypot(g[0], g[1], 1);
    nrm.setXYZ(i, -g[0] * inv, g[1] * inv, inv);       // düzlem XY'de kurulu, -90° döndürülecek
  }
  pos.needsUpdate = true; nrm.needsUpdate = true;
  geometry.computeBoundingSphere();
  void eps;

  const material = new THREE.MeshStandardMaterial({
    map, bumpMap, bumpScale: palette.bumpScale ?? 0.037, roughness: 1, metalness: 0,
    color: palette.tint ?? 0xffffff, side: THREE.DoubleSide,
  });

  /* Kaya alanı: sürüş koridorunun dışında, tohumlu, tek çizim çağrısı. */
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: palette.rock ?? 0x75645d, roughness: 1, flatShading: true });
  const makeRocks = () => {
    const rnd = mulberry32(field.seed ^ 0x96051);
    const mesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks);
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < rocks; i++) {
      let x = (rnd() - 0.5) * (width * 0.68);
      if (Math.abs(Math.abs(x) - lane) < laneHalfWidth) x += x < 0 ? -laneHalfWidth : laneHalfWidth;
      const z = (rnd() - 0.5) * P;
      const s = 0.05 + Math.pow(rnd(), 4.2) * 0.40;
      o.position.set(x, floor + field.height(x, z) + s * 0.30, z);
      /* euler-ok: yuvarlanmış kaya. Rastgele bir yön arıyoruz, belirli
         bir hedef yok, bu yüzden bileşenlerin hangi sırada uygulandığı
         sonucu değiştirmiyor. */
      o.rotation.set(0.15, rnd() * 6.283, -0.08);
      o.scale.set(s * 1.65, s * 0.48, s);
      o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      c.setHSL(0.055, 0.11, 0.23 + rnd() * 0.16); mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  };

  const group = new THREE.Group();
  const rockMeshes = [];
  for (let i = 0; i < tiles; i++) {
    const seg = new THREE.Group();
    seg.position.z = (1 - i) * P;
    const surface = new THREE.Mesh(geometry, material);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = floor;
    surface.receiveShadow = true;
    seg.add(surface);
    if (rocks > 0) { const r = makeRocks(); r.castShadow = r.receiveShadow = true; seg.add(r); rockMeshes.push(r); }
    group.add(seg);
  }
  return {
    group, geometry, material, textures: { map, bumpMap }, rocks: rockMeshes, period: P,
    /** Zemin akışı: grup z'de ötelenir, doku örgüyle BİRLİKTE taşınır —
        ayrıca map.offset verilirse doku örgünün üstünde kayar ve zemin
        "buzda" gibi görünür (Night Traverse'de doku ofseti yalnız İZ
        şeridine uygulanır, zemine değil). Öteleme [0, P) içinde tutulur:
        büyüyen sayı float64'te bile er geç titreşim üretir. */
    advance(distance) {
      group.position.z = ((distance % P) + P) % P;
    },
    dispose() {
      geometry.dispose(); material.dispose(); map.dispose(); bumpMap.dispose();
      rockGeo.dispose(); rockMat.dispose();
    },
  };
}

/* ── tekerlek izi (rut) ────────────────────────────────────────────── */
/** Çıta deseninden türetilmiş iz dokusu: iki ray + eğik damgalar. */
export function trackTexture(THREE, { spokes = 48 } = {}) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(19,18,20,0)');
  grad.addColorStop(0.28, 'rgba(14,13,15,.46)');
  grad.addColorStop(0.72, 'rgba(14,13,15,.46)');
  grad.addColorStop(1, 'rgba(19,18,20,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = 'rgba(16,15,18,.34)'; g.lineWidth = 10;
  const adim = Math.max(24, Math.round(512 / (spokes / 6)));     // damga aralığı çıta sayısından
  for (let y = 0; y < 512; y += adim) { g.beginPath(); g.moveTo(35, y + 10); g.lineTo(92, y + 44); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** İki şerit: aracın GEÇMİŞ yolunu izler. Her karede köşe konumları
    yeniden yazılır (geometri yeniden KURULMAZ, yalnız attribute güncellenir). */
export function buildTracks(THREE, { segments = 84, length = 34, halfWidth = 0.115,
  spacing = 0.49, tile = 2.4, opacity = 0.75, texture } = {}) {
  const map = texture ?? trackTexture(THREE);
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity,
    depthWrite: false, side: THREE.DoubleSide });
  const group = new THREE.Group();
  const strips = [];
  for (const side of [-1, 1]) {
    const n = (segments + 1) * 2;
    const positions = new Float32Array(n * 3), uvs = new Float32Array(n * 2), index = [];
    for (let j = 0; j <= segments; j++) {
      for (let e = 0; e < 2; e++) { const i = j * 2 + e; uvs[i * 2] = e; uvs[i * 2 + 1] = j * length / segments / tile; }
      if (j < segments) { const a = j * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    strips.push({ mesh, positions, side });
  }
  return {
    group, material, strips,
    /** pathAt(lag) → {x, z} : lag birim GERİDEKİ araç merkezi.
        height(x, z) → zemin yüksekliği (dünya). */
    update(pathAt, height, { lift = 0.018 } = {}) {
      for (const strip of strips) {
        for (let j = 0; j <= segments; j++) {
          const lag = j * length / segments;
          const p = pathAt(lag);
          const cx = p.x + strip.side * spacing;
          for (let e = 0; e < 2; e++) {
            const i = j * 2 + e, x = cx + (e ? halfWidth : -halfWidth);
            strip.positions[i * 3] = x;
            strip.positions[i * 3 + 1] = height(x, p.z) + lift;
            strip.positions[i * 3 + 2] = p.z;
          }
        }
        strip.mesh.geometry.attributes.position.needsUpdate = true;
      }
    },
    scroll(distance) { map.offset.y = -distance / tile; },
    dispose() { for (const s of strips) s.mesh.geometry.dispose(); material.dispose(); map.dispose(); },
  };
}

/** Yumuşak temas gölgesi (havada duran cisim için): tek yarıçaplı degrade
    sprite. Gölge haritası pahalı, bu ucuz ve her zaman doğru yerde. */
export function contactShadow(THREE, { size = 2.5, opacity = 0.24 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(3,5,8,.48)');
  grad.addColorStop(0.55, 'rgba(3,5,8,.17)');
  grad.addColorStop(1, 'rgba(3,5,8,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.16),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
