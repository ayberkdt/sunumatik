/* sat-build.mjs — parça kataloğunu GÖVDEYE çevirir.
 *
 * Her parça kendi satırındaki `sekil`, `size` ve `pos` ile kurulur; burada
 * tek bir ölçü elle yazılmaz. Böylece kataloğu değiştirmek modeli de
 * değiştirir ve kütle bütçesiyle çizim asla ayrışmaz.
 *
 * Eksen sözleşmesi: çıplak CylinderGeometry/ConeGeometry kullanılmaz,
 * `core/geometry-axis.mjs` yardımcıları kullanılır (eksen ratchet'i sınar).
 */

import { PARTS, SUBSYSTEMS, partById, depth } from './sat-parts.mjs';
import { cylGeoY, cylGeoX, coneGeoZ, latheZ } from '../core/geometry-axis.mjs';

const renkler = (THREE, tk = {}) => ({
  yapi: new THREE.MeshStandardMaterial({ color: tk.yapi ?? 0x9aa0aa, roughness: .55, metalness: .65 }),
  itki: new THREE.MeshStandardMaterial({ color: tk.itki ?? 0xc98a5c, roughness: .5, metalness: .55 }),
  guc: new THREE.MeshStandardMaterial({ color: tk.guc ?? 0xe0b25a, roughness: .45, metalness: .35 }),
  adcs: new THREE.MeshStandardMaterial({ color: tk.adcs ?? 0x7fb0c9, roughness: .4, metalness: .5 }),
  haberlesme: new THREE.MeshStandardMaterial({ color: tk.haberlesme ?? 0xb4a8c9, roughness: .4, metalness: .5 }),
  isil: new THREE.MeshStandardMaterial({ color: tk.isil ?? 0x8fa2b4, roughness: .7, metalness: .3 }),
  faydali: new THREE.MeshStandardMaterial({ color: tk.faydali ?? 0x9ec98a, roughness: .35, metalness: .45 }),
  kablaj: new THREE.MeshStandardMaterial({ color: tk.kablaj ?? 0x6f7688, roughness: .8, metalness: .2,
    transparent: true, opacity: .34 }),
});

/* Güneş paneli yüzü: hücre deseni prosedürel (doku ÇEKİLMEZ). */
function hucreDokusu(THREE, seed = 7) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#16283a'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(190,210,235,.30)'; g.lineWidth = 1;
  for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 40; i++) g.fillRect((i * 37 + seed) % 256, (i * 53) % 128, 14, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Tek parçanın gövdesi. Dönen grup parçanın MERKEZİNDE oturur. */
function govde(THREE, p, mat, dokular) {
  const [sx, sy, sz] = p.size;
  const g = new THREE.Group();
  const ekle = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  switch (p.sekil) {
    case 'halka': {
      const dis = ekle(new THREE.Mesh(cylGeoY(sx / 2, sx / 2, sz, 40, true), mat));
      dis.rotation.x = Math.PI / 2;
      const ic = ekle(new THREE.Mesh(cylGeoY(sx / 2 - 0.05, sx / 2 - 0.05, sz * 1.02, 40, true), mat));
      ic.rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const c = ekle(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, sz * 1.4), mat));
        c.position.set(Math.cos(a) * (sx / 2 - 0.025), Math.sin(a) * (sx / 2 - 0.025), 0);
      }
      break;
    }
    case 'silindir': {
      const m = ekle(new THREE.Mesh(cylGeoY(sx / 2, sx / 2, sz, 32, false), mat));
      m.rotation.x = Math.PI / 2;
      break;
    }
    case 'tank': {
      const m = ekle(new THREE.Mesh(cylGeoY(sx / 2, sx / 2, sz * 0.7, 28), mat));
      m.rotation.x = Math.PI / 2;
      for (const s of [1, -1]) {
        const kap = ekle(new THREE.Mesh(new THREE.SphereGeometry(sx / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat));
        kap.position.z = s * sz * 0.35;
        kap.rotation.x = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      break;
    }
    case 'kure': ekle(new THREE.Mesh(new THREE.SphereGeometry(sx / 2, 22, 16), mat)); break;
    case 'nozul': {
      const bogaz = ekle(new THREE.Mesh(cylGeoY(sx * 0.22, sx * 0.3, sz * 0.4, 20), mat));
      bogaz.rotation.x = Math.PI / 2; bogaz.position.z = sz * 0.28;
      const can = ekle(new THREE.Mesh(coneGeoZ(sx / 2, sz * 0.7, 24, true), mat));
      can.rotation.x = Math.PI;                    // ağız −Z'ye baksın
      can.position.z = -sz * 0.1;
      break;
    }
    case 'panel': ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)); break;
    case 'kutu': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
      const kapak = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * .8, sy * .04, sz * .8), mat));
      kapak.position.y = sy / 2;
      break;
    }
    case 'tekerlek': {
      const m = ekle(new THREE.Mesh(cylGeoY(sx / 2, sx / 2, sz, 26), mat));
      m.rotation.x = Math.PI / 2;
      const hub = ekle(new THREE.Mesh(cylGeoY(sx * 0.16, sx * 0.16, sz * 1.25, 14), mat));
      hub.rotation.x = Math.PI / 2;
      break;
    }
    case 'bafil': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * .8, sy * .8, sz * .5), mat));
      const b = ekle(new THREE.Mesh(cylGeoY(sx / 2, sx / 2, sz * .6, 20, true), mat));
      b.rotation.x = Math.PI / 2; b.position.z = sz * .45;
      break;
    }
    case 'cubuk': {
      const m = ekle(new THREE.Mesh(cylGeoY(sx / 2, sx / 2, sz, 14), mat));
      m.rotation.x = Math.PI / 2;
      break;
    }
    case 'boru': {
      for (const s of [-1, 1]) {
        const m = ekle(new THREE.Mesh(cylGeoX(0.022, 0.022, sx * .9, 12), mat));
        m.position.set(0, s * sy * 0.22, 0);
      }
      break;
    }
    case 'kanat': {
      const tex = dokular.hucre;
      const panelMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: .35, metalness: .25 });
      panelMat.map.repeat.set(3, 1.4);
      for (let i = 0; i < 3; i++) {
        const w = sx / 3;
        const m = ekle(new THREE.Mesh(new THREE.BoxGeometry(w * .97, sy, sz), panelMat));
        m.position.x = (i - 1) * w;
      }
      const boyunduruk = ekle(new THREE.Mesh(cylGeoX(0.03, 0.03, sx * 0.14, 10), mat));
      boyunduruk.position.x = -sx / 2 - sx * 0.07;
      break;
    }
    case 'canak': {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, r = (sx / 2) * u;
        pts.push(new THREE.Vector2(r, (r * r) / (sx * 0.55)));
      }
      /* Çanak: eksen yardımcısıyla (+Z) — çıplak LatheGeometry eksen
         ratchet'ine takılır ve lathe normalleri profil sırasına duyarlıdır. */
      const canakMat = mat.clone(); canakMat.side = THREE.DoubleSide;
      const m = ekle(latheZ(pts, 32, canakMat));
      const besleme = ekle(new THREE.Mesh(cylGeoY(0.035, 0.035, sz * 0.9, 12), mat));
      besleme.rotation.x = Math.PI / 2; besleme.position.z = sz * 0.5;
      break;
    }
    case 'kabuk': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz),
        new THREE.MeshStandardMaterial({ color: 0xd8c98a, roughness: .9, metalness: .1,
          transparent: true, opacity: .16, side: THREE.DoubleSide }));
      g.add(m);
      break;
    }
    case 'gizli': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat.clone());
      m.material.transparent = true; m.material.opacity = .22; m.material.depthWrite = false;
      g.add(m);
      break;
    }
    default: ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
  }
  return g;
}

/**
 * Bütün uyduyu kurar.
 * Dönen `parcalar`: { id, part, group, taban, yon, derinlik } — patlatma ve
 * entegrasyon sırası bu listeden sürülür.
 */
export function buildSatellite(THREE, { tokens = {}, scale = 1 } = {}) {
  const mats = renkler(THREE, tokens);
  const dokular = { hucre: hucreDokusu(THREE) };
  const kok = new THREE.Group();
  const parcalar = [];

  for (const p of PARTS) {
    const mat = mats[p.sistem];
    const yerler = [];
    const n = p.qty ?? 1;
    if (n === 1) yerler.push(p.pos);
    else {
      /* Çoklu parçalar simetrik dizilir: köşeler (4), zıt yönler (2),
         üç eksen (3). Konum kataloğdaki ÖRNEK konumun yansımalarıdır. */
      const [x, y, z] = p.pos;
      if (n === 4) for (const sx of [1, -1]) for (const sy of [1, -1]) yerler.push([sx * Math.abs(x), sy * Math.abs(y), z]);
      else if (n === 2) for (const sx of [1, -1]) yerler.push([sx * Math.abs(x), y, z]);
      else if (n === 3) for (let i = 0; i < 3; i++) yerler.push([x, y + (i - 1) * 0.42, z]);
      else for (let i = 0; i < n; i++) yerler.push([x, y, z]);
    }

    yerler.forEach((yer, i) => {
      const g = govde(THREE, p, mat, dokular);
      g.position.set(yer[0] * scale, yer[1] * scale, yer[2] * scale);
      g.scale.setScalar(scale);
      g.userData.part = p;
      g.userData.kopya = i;
      kok.add(g);

      /* PATLATMA YÖNÜ montajın tersidir: parça, bağlandığı yüzeyden
         DIŞARI çıkar. Yön, parçanın bağlandığı parçaya göre konumundan
         türetilir; eksene çok yakınsa fırlatma ekseni boyunca açılır. */
      const ust = p.mountsTo ? partById(p.mountsTo) : null;
      const yon = new THREE.Vector3(
        yer[0] - (ust ? ust.pos[0] : 0),
        yer[1] - (ust ? ust.pos[1] : 0),
        yer[2] - (ust ? ust.pos[2] : 0));
      if (yon.lengthSq() < 1e-4) yon.set(0, 0, p.step >= 5 ? 1 : -1);
      yon.normalize();
      parcalar.push({
        id: p.id + (n > 1 ? `#${i + 1}` : ''), part: p, group: g,
        taban: g.position.clone(), yon, derinlik: depth(p.id),
      });
    });
  }

  return {
    root: kok, parts: parcalar, materials: mats, textures: dokular,
    /** Patlatma: k = 0 montajlı, k = 1 tamamen ayrık. */
    explode(k, { mesafe = 1.15 } = {}) {
      for (const q of parcalar) {
        const d = 0.45 + q.derinlik * 0.42;            // derinde olan daha uzağa
        q.group.position.copy(q.taban).addScaledVector(q.yon, k * d * mesafe * scale);
      }
    },
    /** Entegrasyon adımı: adımdan sonrası gizli, o adım vurgulu. */
    showStep(step, { hepsi = false } = {}) {
      for (const q of parcalar) {
        const s = q.part.step;
        q.group.visible = hepsi || s <= step;
        q.group.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = false; });
      }
    },
    dispose() {
      kok.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); const mm = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mm) m?.dispose?.(); } });
      for (const t of Object.values(dokular)) t.dispose?.();
    },
  };
}

export { SUBSYSTEMS };
