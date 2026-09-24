/* hab-build.mjs — habitat kataloğunu GÖVDEYE çevirir.
 *
 * sat-build.mjs ile aynı sözleşme: tek bir ölçü elle yazılmaz, her şey
 * katalogdaki `sekil`, `size`, `pos` alanlarından çıkar. Katalog
 * değişirse model de değişir; kütle bütçesiyle çizim ayrışamaz.
 *
 * Eksen sözleşmesi: çıplak CylinderGeometry/ConeGeometry yok —
 * `core/geometry-axis.mjs`. Saha koordinatı +Z yukarı.
 */

import { PARTS, SUBSYSTEMS, partById, envAllows } from './hab-parts.mjs';
import { cylGeoZ, cylGeoX, coneGeoZ, latheX } from '../core/geometry-axis.mjs';

const TAU = Math.PI * 2;

export function habMaterials(THREE, tk = {}) {
  const std = (c, r, m, ek = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ek });
  return {
    basincli: std(tk.basincli ?? 0xd8d4cc, .52, .28),
    gecis: std(tk.gecis ?? 0xc9a35c, .48, .42),
    yapi: std(tk.yapi ?? 0x9aa0aa, .72, .38),
    guc: std(tk.guc ?? 0xe0b25a, .45, .35),
    isil: std(tk.isil ?? 0x8fa2b4, .38, .62),
    isru: std(tk.isru ?? 0x9ec98a, .5, .45),
    hat: std(tk.hat ?? 0x7fb0c9, .55, .6),
    iletisim: std(tk.iletisim ?? 0xb4a8c9, .42, .5),
    koyu: std(0x3a3f47, .8, .25),
    cam: std(0x2a3c4a, .15, .1, { transparent: true, opacity: .45 }),
    regolit: std(0x6b5a48, .96, .02),
  };
}

/* MLI/zar dikişi: yorgan görüntüsü prosedürel — doku dosyası ÇEKİLMEZ. */
function zarDokusu(THREE, renk = '#d8d4cc') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = renk; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(70,64,56,.36)'; g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.strokeStyle = 'rgba(70,64,56,.18)'; g.lineWidth = 1;
  for (let y = 0; y <= 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 90; i++) g.fillRect((i * 61) % 256, (i * 97) % 256, 9, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* Güneş hücresi deseni. */
function hucreDokusu(THREE) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#17293b'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(185,205,232,.28)'; g.lineWidth = 1;
  for (let x = 0; x <= 256; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 21) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Kapı: basınçlı modüllerin üstünde görünen kapak halkası. */
function kapak(THREE, r, mat, koyu) {
  const g = new THREE.Group();
  const halka = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 22), mat);
  g.add(halka);
  const govde = new THREE.Mesh(cylGeoZ(r * 0.88, r * 0.88, r * 0.32, 22), koyu);
  g.add(govde);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    const kilit = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, r * 0.1, r * 0.4), mat);
    kilit.position.set(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, 0);
    kilit.rotation.z = a;
    g.add(kilit);
  }
  return g;
}

/** Tek parçanın gövdesi. Grup parçanın MERKEZİNDE oturur. */
function govde(THREE, p, M, dok) {
  const [sx, sy, sz] = p.size;
  const g = new THREE.Group();
  const mat = M[p.sistem] || M.yapi;
  const ekle = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  switch (p.sekil) {
    case 'platform': {
      const m = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.regolit));
      m.castShadow = false;
      /* yürüyüş yolu: sıkıştırılmış şeritler zemini okunur kılar */
      for (const [ox, oy, w, h] of [[0, 0, sx * 0.72, 1.4], [3.2, 0, 1.4, sy * 0.66]]) {
        const y = ekle(new THREE.Mesh(new THREE.BoxGeometry(w, h, sz * 0.4),
          new THREE.MeshStandardMaterial({ color: 0x7d6b56, roughness: .98, metalness: .02 })));
        y.position.set(ox, oy, sz * 0.5); y.castShadow = false;
      }
      break;
    }
    case 'plaka': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
      const c = ekle(new THREE.Mesh(cylGeoZ(sx * 0.1, sx * 0.1, sz * 2.4, 12), M.koyu));
      c.position.z = sz * 0.9;
      break;
    }
    case 'silindir-yatay': {
      const r = sy / 2, boy = sx - sy;              // uçlar küresel kapak
      const govdeM = ekle(new THREE.Mesh(cylGeoX(r, r, boy, 36), mat));
      govdeM.material = mat.clone(); govdeM.material.map = dok.zar;
      govdeM.material.map.repeat.set(4, 2);
      for (const s of [-1, 1]) {
        const k = ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, 0, TAU, 0, Math.PI / 2), mat));
        k.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        k.position.x = s * boy / 2;
      }
      /* kuşak kaburgaları: basınç kabuğunun burkulmasını tutan halkalar */
      const n = Math.max(3, Math.round(boy / 1.1));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const kab = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.012, r * 0.035, 6, 30), M.koyu));
        kab.position.x = t * boy; kab.rotation.y = Math.PI / 2;
      }
      for (const q of (p.ports || [])) {
        const kp = kapak(THREE, r * 0.34, mat, M.koyu);
        kp.position.set(q.pos[0], q.pos[1], q.pos[2]);
        const d = new THREE.Vector3(...q.dir);
        kp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
        g.add(kp);
      }
      break;
    }
    case 'silindir-dikey': {
      const r = sx / 2;
      ekle(new THREE.Mesh(cylGeoZ(r, r, sz, 30), mat));
      for (const z of [-sz / 2, sz / 2]) {
        const h = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.06, 6, 28), M.koyu));
        h.position.z = z;
      }
      for (const q of (p.ports || [])) {
        const kp = kapak(THREE, r * 0.52, mat, M.koyu);
        kp.position.set(q.pos[0], q.pos[1], q.pos[2]);
        kp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...q.dir));
        g.add(kp);
      }
      break;
    }
    case 'tunel': {
      const r = sy / 2;
      /* iki rijit uç + ortada körük: ısıl genleşmeyi ve oturmayı yutar */
      for (const s of [-1, 1]) {
        const u = ekle(new THREE.Mesh(cylGeoX(r, r, sx * 0.3, 26), mat));
        u.position.x = s * sx * 0.35;
      }
      const n = 7, boy = sx * 0.4;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const k = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.13, 7, 26), M.koyu));
        k.position.x = t * boy; k.rotation.y = Math.PI / 2;
      }
      const ic = ekle(new THREE.Mesh(cylGeoX(r * 0.92, r * 0.92, boy, 24), M.koyu));
      ic.position.x = 0;
      break;
    }
    case 'dugum': {
      const r = sx / 2;
      ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 30, 20), mat));
      /* dört yatay kapı + bir tavan penceresi kollarıyla */
      const kollar = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]];
      for (const d of kollar) {
        const kol = ekle(new THREE.Mesh(cylGeoZ(r * 0.42, r * 0.42, r * 0.7, 20), mat));
        const v = new THREE.Vector3(...d);
        kol.position.copy(v).multiplyScalar(r * 0.92);
        kol.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
        const kp = kapak(THREE, r * 0.42, mat, M.koyu);
        kp.position.copy(v).multiplyScalar(r * 1.26);
        kp.quaternion.copy(kol.quaternion);
        g.add(kp);
      }
      break;
    }
    case 'toroid': {
      /* şişme modül: zar bombeli, dikiş şeritleri gerilme dağılımını gösterir */
      const R = sx * 0.3, r = sz * 0.5;
      const t = ekle(new THREE.Mesh(new THREE.TorusGeometry(R, r, 20, 40), mat));
      t.material = mat.clone(); t.material.map = dok.zar; t.material.map.repeat.set(8, 2);
      const cekirdek = ekle(new THREE.Mesh(cylGeoZ(R * 0.42, R * 0.42, sz * 1.05, 26), M.koyu));
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        const serit = ekle(new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, r * 0.05, 5, 18), M.koyu));
        serit.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
        serit.rotation.set(Math.PI / 2, 0, a + Math.PI / 2);
      }
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + Math.PI / 8;
        const j = ekle(new THREE.Mesh(cylGeoX(R * 0.06, R * 0.06, R * 0.62, 10), M.koyu));
        j.position.set(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, 0);
        j.rotation.z = a;
      }
      break;
    }
    case 'ortu': {
      /* regolit örtüsü: yarım silindir kabuk, yüzeyi kırık */
      const r = sy / 2;
      /* Yarım kabuk kısmi lathe ile kurulur. Çıplak CylinderGeometry'nin
         thetaLength'i burada işe yarardı ama eksen sözleşmesi çıplak
         silindiri yasaklar; latheX zaten kısmi tur alıyor. */
      const profil = [new THREE.Vector2(r, -sx / 2), new THREE.Vector2(r, sx / 2)];
      const m = ekle(latheX(profil, 26, M.regolit, 0, Math.PI));
      m.position.z = -sz * 0.34;
      m.castShadow = false;
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (i + 0.5) / 26;
        const yig = ekle(new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 7, 5), M.regolit));
        yig.position.set((i % 7 - 3) * sx * 0.14, Math.cos(a) * r * 0.96, -sz * 0.34 + Math.sin(a) * r * 0.96);
        yig.scale.set(1, 1, 0.6); yig.castShadow = false;
      }
      break;
    }
    case 'raf': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M.koyu));
      const n = 5;
      for (let i = 0; i < n; i++) {
        const r = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx / n * 0.88, sy * 1.1, sz * 0.82), mat));
        r.position.x = (i / (n - 1) - 0.5) * sx * 0.82;
      }
      break;
    }
    case 'kutu': {
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
      const kpk = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.72, sy * 0.06, sz * 0.62), M.koyu));
      kpk.position.y = -sy / 2;
      for (let i = 0; i < 4; i++) {
        const ay = ekle(new THREE.Mesh(cylGeoZ(sx * 0.04, sx * 0.04, sz * 0.3, 10), M.koyu));
        ay.position.set((i % 2 ? 1 : -1) * sx * 0.4, (i < 2 ? 1 : -1) * sy * 0.4, -sz * 0.62);
      }
      break;
    }
    case 'tank-dikey': {
      const r = sx / 2, boy = sz - sx;
      const t = ekle(new THREE.Mesh(cylGeoZ(r, r, boy, 30), mat));
      t.material = mat.clone(); t.material.map = dok.zar; t.material.map.repeat.set(6, 3);
      for (const s of [-1, 1]) {
        const k = ekle(new THREE.Mesh(new THREE.SphereGeometry(r, 26, 16, 0, TAU, 0, Math.PI / 2), mat));
        k.rotation.x = s > 0 ? 0 : Math.PI;
        k.position.z = s * boy / 2;
      }
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4;
        const bac = ekle(new THREE.Mesh(cylGeoZ(r * 0.06, r * 0.06, sz * 0.5, 10), M.koyu));
        bac.position.set(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, -sz * 0.6);
      }
      break;
    }
    case 'panel-tarla': {
      /* eğik paneller: toz kayması için. Ay'da dik durur (ortam kuralı). */
      const sira = 3;
      for (let i = 0; i < sira; i++) {
        const pan = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy / sira * 0.82, 0.05), mat));
        pan.material = new THREE.MeshStandardMaterial({ map: dok.hucre, roughness: .3, metalness: .5 });
        pan.material.map.repeat.set(3, 1);
        pan.position.set(0, (i - (sira - 1) / 2) * sy / sira, sz * 0.5);
        pan.rotation.x = -32 * Math.PI / 180;
        const dir = ekle(new THREE.Mesh(cylGeoZ(0.05, 0.05, sz, 8), M.koyu));
        dir.position.set(0, pan.position.y, 0);
      }
      break;
    }
    case 'radyator': {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const k = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, 0.03, sz), mat));
        k.position.y = (i / (n - 1) - 0.5) * sy * 4;
      }
      const t = ekle(new THREE.Mesh(cylGeoX(0.06, 0.06, sx * 1.02, 10), M.koyu));
      t.position.z = -sz / 2;
      break;
    }
    case 'semsiye': {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n;
        const dilim = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.46, sx * 0.17, 0.03), mat));
        dilim.position.set(Math.cos(a) * sx * 0.27, Math.sin(a) * sx * 0.27, 0);
        dilim.rotation.z = a;
        dilim.rotation.y = -14 * Math.PI / 180;
      }
      ekle(new THREE.Mesh(cylGeoZ(sx * 0.07, sx * 0.07, sz * 2, 12), M.koyu));
      break;
    }
    case 'reaktor': {
      const r = sx / 2;
      ekle(new THREE.Mesh(cylGeoZ(r * 0.62, r * 0.62, sz * 0.72, 22), mat));
      /* gölge kalkanı: üsse bakan yüzde konik, doz mesafeyle değil kalkanla düşer */
      const kal = ekle(new THREE.Mesh(coneGeoZ(r, sz * 0.36, 22), M.koyu));
      kal.position.z = -sz * 0.4;
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        const bor = ekle(new THREE.Mesh(cylGeoZ(r * 0.05, r * 0.05, sz * 0.8, 8), M.isil));
        bor.position.set(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, sz * 0.1);
      }
      break;
    }
    case 'direk': {
      ekle(new THREE.Mesh(cylGeoZ(sx * 0.34, sx * 0.5, sz, 10), mat));
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        const ger = ekle(new THREE.Mesh(cylGeoZ(0.012, 0.012, sz * 0.92, 5), M.koyu));
        ger.position.set(Math.cos(a) * sz * 0.16, Math.sin(a) * sz * 0.16, -sz * 0.04);
        ger.rotation.set(Math.sin(a) * 0.32, -Math.cos(a) * 0.32, 0);
      }
      break;
    }
    case 'canak': {
      const r = sx / 2;
      const c = ekle(new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.5, 30, 16, 0, TAU, 0, Math.asin(r / (r * 1.5))), mat));
      c.rotation.x = Math.PI;
      c.position.z = r * 0.62;
      const bes = ekle(new THREE.Mesh(cylGeoZ(r * 0.09, r * 0.09, r * 0.62, 10), M.koyu));
      const alici = ekle(new THREE.Mesh(cylGeoZ(r * 0.13, r * 0.09, r * 0.24, 12), M.koyu));
      alici.position.z = r * 0.7;
      break;
    }
    case 'ruzgar': {
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        const kol = ekle(new THREE.Mesh(cylGeoX(0.008, 0.008, sx * 0.46, 6), mat));
        kol.position.set(Math.cos(a) * sx * 0.23, Math.sin(a) * sx * 0.23, 0);
        kol.rotation.z = a;
        const kup = ekle(new THREE.Mesh(new THREE.SphereGeometry(sx * 0.1, 12, 8, 0, TAU, 0, Math.PI / 2), mat));
        kup.position.set(Math.cos(a) * sx * 0.46, Math.sin(a) * sx * 0.46, 0);
        kup.rotation.x = Math.PI / 2; kup.rotation.z = a;
      }
      ekle(new THREE.Mesh(cylGeoZ(0.014, 0.014, sz, 8), M.koyu));
      break;
    }
    case 'tente': {
      /* kapalı değil: dört ayak, gergili örtü, altta şarj kablosu */
      for (let i = 0; i < 4; i++) {
        const bac = ekle(new THREE.Mesh(cylGeoZ(0.06, 0.08, sz, 8), mat));
        bac.position.set((i % 2 ? 1 : -1) * sx * 0.44, (i < 2 ? 1 : -1) * sy * 0.44, 0);
      }
      const ort = ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.05), M.gecis));
      ort.position.z = sz * 0.5;
      ort.rotation.y = 5 * Math.PI / 180;
      for (let i = 0; i < 5; i++) {
        const kir = ekle(new THREE.Mesh(cylGeoX(0.03, 0.03, sx, 6), M.koyu));
        kir.position.set(0, (i / 4 - 0.5) * sy * 0.9, sz * 0.5 - 0.05);
      }
      break;
    }
    case 'hat':
      /* Hatlar routing.mjs tarafından kurulur; burada yer tutucu yok. */
      break;
    default:
      ekle(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
  }
  return g;
}

/**
 * Bütün üssü kurar.
 * Dönen: { root, nodes: Map(id → Object3D), reddedilen }
 * `nodes` doğrudan `core/exploded-view.mjs`'e verilebilir — patlatma
 * için ek bir adım gerekmez.
 */
export function buildHabitat(THREE, { env = 'mars', tema = {} } = {}) {
  const M = habMaterials(THREE, tema);
  const dok = { zar: zarDokusu(THREE), hucre: hucreDokusu(THREE) };
  const root = new THREE.Group();
  root.name = 'habitat';
  const nodes = new Map();
  const reddedilen = [];

  for (const p of PARTS) {
    const izin = envAllows(p.id, env);
    if (!izin.ok) { reddedilen.push({ id: p.id, neden: izin.neden, oneri: izin.oneri }); continue; }
    const g = govde(THREE, p, M, dok);
    g.name = p.id;
    g.position.set(p.pos[0], p.pos[1], p.pos[2]);
    g.userData.partId = p.id;
    g.traverse(o => { o.userData.partId = p.id; });
    g.userData.notes = { regime: `${env} yüzeyi`, why: p.why };
    nodes.set(p.id, g);
    root.add(g);
  }

  /* Çoklu bileşenler (qty) katalogdaki tek gövdenin kopyalarıdır; temel
     plakaları ve panel sıraları tek tek beyan edilmez, dizilir. */
  const dizi = { 'temel-hab': { n: 6, adim: [0, 0, 0], yay: 'halka', r: 3.2 },
    'panel-tarlasi': { n: 4, adim: [6.2, 0, 0] }, 'radyator-dizisi': { n: 2, adim: [0, 2.6, 0] } };
  for (const [id, d] of Object.entries(dizi)) {
    const temel = nodes.get(id);
    if (!temel) continue;
    for (let i = 1; i < d.n; i++) {
      const k = temel.clone(true);
      if (d.yay === 'halka') {
        const a = i * TAU / d.n;
        k.position.set(temel.position.x + Math.cos(a) * d.r, temel.position.y + Math.sin(a) * d.r, temel.position.z);
      } else {
        k.position.set(temel.position.x + d.adim[0] * i, temel.position.y + d.adim[1] * i, temel.position.z + d.adim[2] * i);
      }
      /* Kopya ana gövdenin ALTINA girer: patlatma parçayı tek düğüm
         olarak taşır, dizinin altı dağılmaz. Konum bu yüzden ana
         gövdeye görelidir. */
      k.position.sub(temel.position);
      temel.add(k);
    }
  }

  root.userData.rig = {
    kind: 'habitat', units: 'design', scaleToRoot: 1,
    joints: [], contacts: ['platform'], massClass: 'yuzey-ussu',
  };
  root.userData.notes = { regime: `${env} yüzeyi`,
    why: 'Üs adım adım kurulur: zemin, basınçlı çekirdek, geçişler, hacim, güç, ısıl/ISRU, hatlar. Her bileşen bir öncekine dayanır.' };
  return { root, nodes, reddedilen, materials: M, textures: dok };
}

export { PARTS, SUBSYSTEMS, partById };
