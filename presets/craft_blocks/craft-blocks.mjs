// craft-blocks.mjs — Parametrik uzay aracı kütüphanesi (SAF kurucular).
//
// DONMUŞ SÖZLEŞME (references/scene-blocks.md):
//   • Her kurucu THREE.Group döndürür; bağlama YOK (mount / rAF / doku çekme yok).
//   • Eksenler: +X = ileri/hız, −X = ana motor egzozu, +Z = yukarı/çanak tarafı.
//   • Orijin geometrik merkezde; en uzun boyut ≈ 1 × scale.
//   • palette = { body, panel, accent, metal } — varsayılan obsidyen–şampanya.
//   • Yalnızca MeshStandardMaterial; emissive yok, doku yok — geometri ve malzeme disiplini.
//   • Araç başına TEK vurgu (accent) öğesi; greeble ≤ 6 ve amaçlı.
//
// Tüketiciler bu modülü GÖRELİ yolla import eder ve import başarısız olursa
// basit bir yer tutucu Group'a düşmek ZORUNDADIR (bloklar birbirine sert bağımlı olamaz).

import * as THREE from 'three';

// Varsayılan palet: obsidyen gövde, koyu hücreler, şampanya vurgusu, saten çelik.
export const CRAFT_PALETTE = Object.freeze({
  body:   0x23252c,
  panel:  0x10151d,
  accent: 0xc9a35c,
  metal:  0x9aa0ab,
});

/* ------------------------------------------------------------------ */
/* Malzeme dili — tüm araçlar aynı satın mühendislik yüzeyini paylaşır */
/* ------------------------------------------------------------------ */

function makeMats(palette) {
  const p = { ...CRAFT_PALETTE, ...(palette || {}) };
  // Panel çerçevesi: hücre renginin aydınlatılmış hâli (ince açık çerçeve kuralı).
  const frame = new THREE.Color(p.panel).lerp(new THREE.Color(0xffffff), 0.42);
  return {
    body:     new THREE.MeshStandardMaterial({ color: p.body,  roughness: 0.55, metalness: 0.35 }),
    bodyFlat: new THREE.MeshStandardMaterial({ color: p.body,  roughness: 0.55, metalness: 0.35, flatShading: true }),
    panel:    new THREE.MeshStandardMaterial({ color: p.panel, roughness: 0.38, metalness: 0.55 }),
    frame:    new THREE.MeshStandardMaterial({ color: frame,   roughness: 0.50, metalness: 0.45 }),
    metal:    new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.30, metalness: 0.85 }),
    metalDS:  new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.30, metalness: 0.85, side: THREE.DoubleSide }),
    accent:   new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.32, metalness: 0.70 }),
    dark:     new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.65, metalness: 0.25, side: THREE.DoubleSide }),
  };
}

/* ------------------------------------------------- */
/* Geometri yardımcıları (hepsi deterministik)        */
/* ------------------------------------------------- */

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Silindir eksenini Y'den X'e çevirir (+Y ucu → +X ucu).
function alignX(geo) { geo.rotateZ(-Math.PI / 2); return geo; }

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cylX(rTop, rBottom, h, seg, mat, open = false) {
  // Ekseni X olan silindir; rTop +X ucundadır.
  return new THREE.Mesh(alignX(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open)), mat);
}

// İki nokta arasında dikme (strut).
function strut(a, b, r, mat, seg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
  return mesh;
}

// Gerçek çan profili (LatheGeometry): boğaz y=0'da, egzoz −Y'de.
// Hızlı genişleyip düzleşen klasik çan eğrisi — koni DEĞİL.
function bellMesh(rThroat, rExit, len, mat, seg = 48) {
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = rThroat + (rExit - rThroat) * Math.pow(t, 0.62);
    pts.push(new THREE.Vector2(r, -len * t));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
}

// Motor grubu: montaj halkası + çan; egzoz yerel −X'e bakar.
// mountX: montaj düzleminin x konumu (çan buradan −X'e uzanır).
function engineAssembly(m, { rThroat, rExit, len, mountX = 0, ringR = null }) {
  const g = new THREE.Group();
  const rr = ringR ?? rThroat * 1.6;
  const ring = cylX(rr, rr, 0.035, 24, m.metal);
  ring.position.x = mountX;
  g.add(ring);
  const bell = bellMesh(rThroat, rExit, len, m.metalDS);
  bell.geometry.rotateZ(-Math.PI / 2);       // −Y egzoz → −X egzoz
  bell.position.x = mountX - 0.017;
  g.add(bell);
  return g;
}

// Parabolik çanak: +Y'ye açılır; çağıran döndürür.
function dishMesh(R, depth, mat, seg = 48) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(new THREE.Vector2(R * t, depth * t * t));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
}

// Güneş paneli kanadı: koyu hücreler + ince açık çerçeve (iki tonlu grup, doku yok).
// XY düzleminde; hücreler +Z yüzünde. w = X boyu (cols), h = Y boyu (rows).
function panelWing(w, h, cols, rows, m, t = 0.016) {
  const g = new THREE.Group();
  const base = box(w, h, t, m.frame);           // açık çerçeve tabanı
  g.add(base);
  const gap = Math.min(w, h) * 0.035;
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h - gap * (rows + 1)) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cell = box(cw, ch, t * 0.55, m.panel);
      cell.position.set(
        -w / 2 + gap + cw / 2 + i * (cw + gap),
        -h / 2 + gap + ch / 2 + j * (ch + gap),
        t * 0.55,
      );
      g.add(cell);
    }
  }
  return g;
}

// İtici dörtlüsü (RCS quad) — amaçlı greeble: taban blok + 4 mini nozul.
function thrusterQuad(m, s = 1) {
  const g = new THREE.Group();
  const base = box(0.055 * s, 0.055 * s, 0.028 * s, m.metal);
  g.add(base);
  const dirs = [V3(1, 0, 0.55), V3(-1, 0, 0.55), V3(0, 1, 0.55), V3(0, -1, 0.55)];
  for (const d of dirs) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * s, 0.004 * s, 0.03 * s, 10, 1, true), m.dark);
    noz.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    noz.position.copy(d.clone().normalize().multiplyScalar(0.032 * s));
    g.add(noz);
  }
  return g;
}

// Bitirici: merkeze al, en uzun boyutu 1×scale'e normalle, kök Group döndür.
function finalize(inner, kind, scale) {
  const bb = new THREE.Box3().setFromObject(inner);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const s = scale / longest;
  inner.scale.setScalar(s);
  inner.position.copy(center).multiplyScalar(-s);
  const root = new THREE.Group();
  root.name = `craft:${kind}`;
  root.add(inner);
  let parts = 0;
  inner.traverse((o) => { if (o.isMesh) parts++; });
  root.userData = { preset: 'craft-blocks', kind, parts, designSize: size.toArray() };
  return root;
}

/* ================================================================== */
/* 1) YÖRÜNGE ARACI — gövde 1×0.7×0.6, kanat açıklığı ≈ 2.4           */
/* ================================================================== */

export function buildOrbiter({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // Gövde (bus) + pah hissi: ±X yüzlerinde metal geçiş plakaları, uzun kenar rayları.
  g.add(box(1, 0.7, 0.6, m.body));
  for (const sx of [1, -1]) {
    const pl = box(0.04, 0.74, 0.64, m.metal);
    pl.position.x = sx * 0.5;
    g.add(pl);
  }
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const rail = box(1.02, 0.055, 0.055, m.metal);
    rail.position.set(0, sy * 0.345, sz * 0.295);
    g.add(rail);
  }

  // Radyatör paneli (−Z yüzü): koyu, çerçevesiz düz plaka.
  const rad = box(0.78, 0.5, 0.02, m.panel);
  rad.position.z = -0.308;
  g.add(rad);

  // Güneş kanatları (±Y): boyunduruk + menteşe bloğu + iki tonlu hücre ızgarası.
  for (const sgn of [1, -1]) {
    const yoke = strut(V3(0, sgn * 0.35, 0), V3(0, sgn * 0.6, 0), 0.022, m.metal);
    g.add(yoke);
    const hinge = box(0.09, 0.05, 0.09, m.metal);
    hinge.position.set(0, sgn * 0.6, 0);
    g.add(hinge);
    const wing = panelWing(0.52, 0.64, 3, 5, m, 0.02);
    wing.position.set(0, sgn * 0.92, 0);
    g.add(wing);
  }

  // Yüksek kazançlı anten (+Z): direk + çanak + VURGU olarak çanak jant halkası.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.13, 16), m.metal);
  mast.geometry.rotateX(Math.PI / 2);
  mast.position.z = 0.365;
  g.add(mast);
  const dish = dishMesh(0.27, 0.085, m.metalDS);
  dish.geometry.rotateX(Math.PI / 2);        // +Y açılışı → +Z açılışı
  dish.position.z = 0.43;
  g.add(dish);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.268, 0.011, 12, 48), m.accent);
  rim.position.z = 0.515;                    // ÇANAK JANTI = tek vurgu öğesi
  g.add(rim);
  const feed = strut(V3(0, 0, 0.44), V3(0, 0, 0.6), 0.007, m.metal);
  g.add(feed);
  const feedTip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), m.metal);
  feedTip.position.z = 0.6;
  g.add(feedTip);

  // Ana motor (−X egzoz).
  g.add(engineAssembly(m, { rThroat: 0.05, rExit: 0.115, len: 0.19, mountX: -0.525 }));

  // Greeble'lar (4 adet, amaçlı): yıldız izleyici konisi, umbilikal panel, 2 RCS dörtlüsü.
  const tracker = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, 0.1, 16, 1, true), m.dark);
  tracker.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(0.35, 0, 1).normalize());
  tracker.position.set(0.3, -0.2, 0.33);
  g.add(tracker);
  const umb = box(0.05, 0.2, 0.14, m.dark);
  umb.position.set(0.505, 0.15, 0.12);
  g.add(umb);
  for (const [sy, sz] of [[1, -1], [-1, -1]]) {
    const q = thrusterQuad(m, 1);
    q.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, sy, sz).normalize());
    q.position.set(0.42, sy * 0.34, sz * 0.29);
    g.add(q);
  }

  return finalize(g, 'orbiter', scale);
}

/* ================================================================== */
/* 2) İNİŞ ARACI — geniş duruş, ~35° bacak açısı, gerçek çan          */
/*    Egzoz −X (sözleşme); iniş yönelimini tüketici verir.            */
/* ================================================================== */

export function buildLander({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  // Sekizgen gövde, ekseni X; düz yüzeyler bacak aralarına gelsin diye 22.5° döndürülmüş.
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8);
  bodyGeo.rotateY(Math.PI / 8);
  alignX(bodyGeo);
  g.add(new THREE.Mesh(bodyGeo, m.bodyFlat));

  // Üst güverte (+X): çerçeve renkli sekizgen plaka + VURGU: kenetlenme halkası.
  const deckGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.045, 8);
  deckGeo.rotateY(Math.PI / 8);
  alignX(deckGeo);
  const deck = new THREE.Mesh(deckGeo, m.bodyFlat);
  deck.position.x = 0.222;
  g.add(deck);
  const dockRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 14, 40), m.accent);
  dockRing.rotation.y = Math.PI / 2;         // halka normali +X — TEK vurgu öğesi
  dockRing.position.x = 0.26;
  g.add(dockRing);

  // Alt geçiş halkası + motor (−X egzoz).
  const skirt = cylX(0.34, 0.28, 0.07, 24, m.metal);
  skirt.position.x = -0.225;
  g.add(skirt);
  g.add(engineAssembly(m, { rThroat: 0.07, rExit: 0.17, len: 0.26, mountX: -0.26, ringR: 0.12 }));

  // Yakıt tankları: gövde yüzeylerine yarı gömülü 4 küre (bacak aralarında).
  // Kaplamalı tank görünümü: gövde saten malzemesi, parlak krom değil.
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;             // 0°, 90°, 180°, 270°
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), m.body);
    tank.position.set(0, Math.sin(a) * 0.46, Math.cos(a) * 0.46);
    g.add(tank);
    // Tank kuşağı: ince metal bant (pah/geçiş hissi).
    const bant = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.008, 8, 28), m.metal);
    bant.rotation.y = Math.PI / 2;
    bant.position.copy(tank.position);
    g.add(bant);
  }

  // Bacaklar: 45° aralıklarla 4 adet, −X ekseninden ~35° açılı; ayak tabanları.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const ry = Math.sin(a), rz = Math.cos(a);
    const A = V3(0.06, ry * 0.5, rz * 0.5);          // üst bağlantı
    const F = V3(-0.42, ry * 0.82, rz * 0.82);        // ayak (yanal 0.32 / eksenel 0.48 ≈ 34°)
    g.add(strut(A, F, 0.018, m.metal));
    // İkincil destek: alt gövdeden ana dikmenin 2/3'üne.
    const B = V3(-0.17, ry * 0.46, rz * 0.46);
    const Mid = A.clone().lerp(F, 0.62);
    g.add(strut(B, Mid, 0.011, m.metal));
    // Ayak tabanı: X eksenine dik disk.
    const pad = cylX(0.1, 0.115, 0.028, 20, m.bodyFlat);
    pad.position.set(-0.445, ry * 0.82, rz * 0.82);
    g.add(pad);
  }

  // Greeble'lar (4): anten direği + mini çanak (+Z), umbilikal kutu, 2 RCS dörtlüsü.
  g.add(strut(V3(0.24, 0, 0.3), V3(0.38, 0, 0.36), 0.007, m.metal));
  const miniDish = dishMesh(0.055, 0.016, m.metalDS);
  miniDish.geometry.rotateX(Math.PI / 2);
  miniDish.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0.6, 0, 1).normalize());
  miniDish.position.set(0.39, 0, 0.37);
  g.add(miniDish);
  const umb = box(0.14, 0.1, 0.05, m.dark);
  umb.position.set(0.1, -0.34, -0.36);
  umb.rotation.x = Math.PI / 4;
  g.add(umb);
  for (const sy of [1, -1]) {
    const q = thrusterQuad(m, 0.9);
    q.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, sy, 0));
    q.position.set(0.12, sy * 0.52, 0);
    g.add(q);
  }

  return finalize(g, 'lander', scale);
}

/* ================================================================== */
/* 3) ROKET — incelik oranı ~8, kademeler + ara halkalar + ojiv       */
/*    başlık + kafes kanatçıklar + motor kümesi. Burun +X.            */
/* ================================================================== */

export function buildRocket({ stages = 2, scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const R = 0.12;
  const stageLens = [0.88, 0.44, 0.3].slice(0, Math.max(1, Math.min(3, stages)));

  let x = 0; // kuyruk tabanı; +X'e doğru istifleriz, motorlar −X'e taşar

  // Motor eteği: tabana doğru hafif genişleyen geçiş (pah hissi) + ince metal taban halkası.
  const skirt = cylX(R, R * 1.15, 0.07, 40, m.body);
  skirt.position.x = x + 0.035;
  g.add(skirt);
  const tabanHalka = cylX(R * 1.16, R * 1.16, 0.018, 40, m.metal);
  tabanHalka.position.x = x + 0.012;
  g.add(tabanHalka);

  // 1. kademe motor kümesi: merkez çan + 4 çevre çanı.
  g.add(engineAssembly(m, { rThroat: 0.045, rExit: 0.095, len: 0.16, mountX: x, ringR: 0.07 }));
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const e = engineAssembly(m, { rThroat: 0.028, rExit: 0.058, len: 0.11, mountX: 0, ringR: 0.045 });
    e.position.set(x, Math.sin(a) * 0.072, Math.cos(a) * 0.072);
    g.add(e);
  }
  x += 0.07;

  // Kademeler + ara halkalar.
  for (let i = 0; i < stageLens.length; i++) {
    const L = stageLens[i];
    const stage = cylX(R, R, L, 40, m.body);
    stage.position.x = x + L / 2;
    g.add(stage);
    x += L;

    if (i === 0) {
      // Kafes kanatçıklar (grid fin): 1. kademe tepesinde, 4 adet, iki tonlu ince panel.
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        const ry = Math.sin(a), rz = Math.cos(a);
        const fin = new THREE.Group();
        const plateO = box(0.014, 0.12, 0.1, m.frame);          // dış çerçeve
        const plateI = box(0.017, 0.095, 0.078, m.panel);        // koyu iç ızgara
        fin.add(plateO, plateI);
        const hinge = box(0.045, 0.06, 0.028, m.metal);          // gövdeye bağlanan menteşe
        hinge.position.set(0.018, -0.055, 0);
        fin.add(hinge);
        // Yerelde +Y radyal; açıya döndür. İç kenar gövdeye hafif gömülü.
        fin.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(0, ry, rz));
        fin.position.set(x - 0.09, ry * (R + 0.055), rz * (R + 0.055));
        g.add(fin);
      }
      // Kablo kanalı (raceway) — greeble: gövde boyunca ince kanal.
      const race = box(stageLens[0] * 0.86, 0.024, 0.03, m.dark);
      race.position.set(x - stageLens[0] / 2, 0, R + 0.008);
      g.add(race);
    }

    // Ara halka: ilkinde ŞAMPANYA BANT (tek vurgu), diğerlerinde metal.
    if (i < stageLens.length - 1) {
      const ring = cylX(R * 1.045, R * 1.045, 0.07, 40, i === 0 ? m.accent : m.metal);
      ring.position.x = x + 0.035;
      g.add(ring);
      x += 0.07;
    }
  }

  // Başlık geçiş halkası + tanjant-ojiv başlık (LatheGeometry).
  const collar = cylX(R * 1.03, R * 1.03, 0.04, 40, m.metal);
  collar.position.x = x + 0.02;
  g.add(collar);
  x += 0.04;
  const L = 0.5;                                    // ojiv boyu
  const rho = (R * R + L * L) / (2 * R);            // tanjant-ojiv yarıçapı
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = Math.sqrt(rho * rho - (t * L) * (t * L)) + R - rho;
    pts.push(new THREE.Vector2(Math.max(r, 0), t * L));
  }
  const fairing = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), m.body);
  alignX(fairing.geometry);                          // taban x'te, uç +X'te
  fairing.position.x = x;
  g.add(fairing);

  return finalize(g, 'rocket', scale);
}

/* ================================================================== */
/* 4) KÜPSAT — görünür raylar, hafif gömülü yüzeyler, açılır paneller */
/* ================================================================== */

export function buildCubesat({ units = 3, scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const u = 0.1;
  const n = Math.max(1, Math.min(6, Math.round(units)));
  const L = n * u;                                   // X boyu (nU)

  // Çekirdek gövde: raylardan hafif içeride.
  g.add(box(L - 0.006, 0.088, 0.088, m.body));

  // Yüzey panelleri (±Y, ±Z): raylara göre GÖMÜLÜ iki tonlu hücre plakaları;
  // 1U başına bir hücre sırası.
  for (const [axis, sgn] of [['y', 1], ['y', -1], ['z', 1], ['z', -1]]) {
    const face = panelWing(L - 0.018, 0.082, n, 1, m, 0.004);
    if (axis === 'y') {
      face.rotation.x = sgn > 0 ? -Math.PI / 2 : Math.PI / 2;  // hücreler dışa baksın
      face.position.y = sgn * 0.0455;
    } else {
      if (sgn < 0) face.rotation.x = Math.PI;
      face.position.z = sgn * 0.0455;
    }
    g.add(face);
  }

  // Raylar: 4 uzun kenarda, gövdeden hafif taşkın (görünür ray kuralı).
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const rail = box(L + 0.008, 0.0095, 0.0095, m.metal);
    rail.position.set(0, sy * 0.0455, sz * 0.0455);
    g.add(rail);
  }

  // +X yüzü: kamera açıklığı + 2 teyp anten (greeble ×3).
  const cam = cylX(0.018, 0.02, 0.014, 20, m.dark);
  cam.position.set(L / 2 + 0.004, 0, -0.018);
  g.add(cam);
  for (const sy of [1, -1]) {
    g.add(strut(V3(L / 2, sy * 0.03, 0.03), V3(L / 2 + 0.1, sy * 0.085, 0.05), 0.0016, m.metal));
  }

  // −X yüzü: ayrılma halkası (geçiş halkası — pah hissi).
  const sep = cylX(0.034, 0.038, 0.01, 24, m.metal);
  sep.position.x = -L / 2 - 0.004;
  g.add(sep);

  // Açılır güneş kanatları (±Y): menteşeden hafif dihedral açıyla (gövde görünür kalsın).
  for (const sgn of [1, -1]) {
    const kanat = new THREE.Group();
    kanat.position.set(0, sgn * 0.052, 0.038);       // menteşe noktası (rayların üstü)
    kanat.rotation.x = sgn * 0.16;                    // uçlar hafif yukarı
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, L * 0.8, 12), m.metal);
    hinge.geometry.rotateZ(-Math.PI / 2);            // eksen X
    kanat.add(hinge);
    for (let seg = 0; seg < 2; seg++) {
      const wing = panelWing(L * 0.92, 0.094, n * 2, 1, m, 0.0045);
      wing.position.set(0, sgn * (0.053 + seg * 0.1), 0);
      kanat.add(wing);
    }
    g.add(kanat);
  }

  // TEK vurgu: −Z yüzünde şampanya erişim kapağı.
  const port = box(0.032, 0.032, 0.005, m.accent);
  port.position.set(-L / 2 + 0.05, 0, -0.049);
  g.add(port);

  return finalize(g, 'cubesat', scale);
}

/* ================================================================== */
/* 5) KAPSÜL — 33° yan duvarlı komuta modülü + küresel ısı kalkanı    */
/*    + servis modülü + motor. Tepe +X, kalkan/egzoz −X.              */
/* ================================================================== */

export function buildCapsule({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const Rb = 0.3;                                    // taban yarıçapı
  const Rt = 0.07;                                   // tepe yarıçapı
  const H = (Rb - Rt) / Math.tan((33 * Math.PI) / 180); // 33° yan duvar → ~0.354

  // Yan duvar: kesik koni (taban x=0, tepe +X).
  const wall = cylX(Rt, Rb, H, 48, m.body);
  wall.position.x = H / 2;
  g.add(wall);

  // Tepe: küresel kapak + kenetlenme tüneli + halkası.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(Rt, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.body);
  cap.geometry.rotateZ(-Math.PI / 2);                // kutup +X'e
  cap.position.x = H;
  g.add(cap);
  const tunnel = cylX(0.038, 0.044, 0.04, 24, m.metal);
  tunnel.position.x = H + 0.05;
  g.add(tunnel);
  const dockRing = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 10, 32), m.metal);
  dockRing.rotation.y = Math.PI / 2;
  dockRing.position.x = H + 0.072;
  g.add(dockRing);

  // Isı kalkanı: küresel kesit (R=0.72 küreden), −X'e şişkin; kenar dudak halkası.
  const shieldR = 0.72;
  const capAngle = Math.asin(Rb / shieldR);
  const spts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * capAngle;
    spts.push(new THREE.Vector2(shieldR * Math.sin(a), -(shieldR * (1 - Math.cos(a)))));
  }
  spts.reverse();                                    // lathe açık uçtan kapalı uca
  const shield = new THREE.Mesh(new THREE.LatheGeometry(spts, 48), m.dark);
  alignX(shield.geometry);                           // şişkinlik −X
  g.add(shield);
  const lip = cylX(0.306, 0.306, 0.026, 48, m.metal);
  lip.position.x = 0.0;
  g.add(lip);

  // TEK vurgu: +Z tarafında kapak (hatch) halkası, koni yüzeyine dik.
  const hx = 0.16;
  const hr = Rb - (Rb - Rt) * (hx / H);              // koninin o yükseklikteki yarıçapı
  const hatchDir = V3(Math.sin((33 * Math.PI) / 180), 0, Math.cos((33 * Math.PI) / 180));
  const hatch = new THREE.Group();
  const hDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 28), m.panel);
  hDisc.geometry.rotateX(Math.PI / 2);               // disk normali yerel +Z olacak biçimde
  hatch.add(hDisc);
  const hRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 12, 36), m.accent);
  hatch.add(hRing);
  hatch.quaternion.setFromUnitVectors(V3(0, 0, 1), hatchDir);
  hatch.position.set(hx, 0, hr + 0.004);
  g.add(hatch);

  // Servis modülü: kalkandan İÇERLEK gövde — adaptör konisi + silindir + radyatörler.
  const adapter = cylX(0.3, 0.262, 0.06, 48, m.body);
  adapter.position.x = -0.043;
  g.add(adapter);
  const sm = cylX(0.262, 0.262, 0.5, 48, m.body);
  sm.position.x = -0.323;
  g.add(sm);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const ry = Math.sin(a), rz = Math.cos(a);
    const radp = box(0.32, 0.15, 0.012, m.panel);
    radp.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, ry, rz));
    radp.position.set(-0.323, ry * 0.265, rz * 0.265);
    g.add(radp);
  }
  // SM kıç halkası (pah/geçiş).
  const aftRing = cylX(0.268, 0.268, 0.03, 48, m.metal);
  aftRing.position.x = -0.567;
  g.add(aftRing);

  // Greeble'lar (5): umbilikal kaplama + 4 RCS dörtlüsü.
  const umb = box(0.14, 0.09, 0.045, m.dark);
  umb.position.set(-0.15, 0, 0.262);
  g.add(umb);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const ry = Math.sin(a), rz = Math.cos(a);
    const q = thrusterQuad(m, 1.1);
    q.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0, ry, rz));
    q.position.set(-0.22, ry * 0.272, rz * 0.272);
    g.add(q);
  }

  // SM ana motoru (−X egzoz).
  g.add(engineAssembly(m, { rThroat: 0.06, rExit: 0.15, len: 0.23, mountX: -0.578, ringR: 0.095 }));

  return finalize(g, 'capsule', scale);
}
