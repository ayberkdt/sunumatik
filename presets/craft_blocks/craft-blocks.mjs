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

// Panel çerçevesi: hücre renginin aydınlatılmış hâli (ince açık çerçeve kuralı).
// Palet yerinde güncellenirken de AYNI türetme kullanılır — tek doğruluk kaynağı.
function cerceveRengi(panel) {
  return new THREE.Color(panel).lerp(new THREE.Color(0xffffff), 0.42);
}

// Kök Group → malzeme kaydı. Yerinde palet güncellemesi (applyCraftPalette)
// için tutulur; kök çöpe gidince kayıt da gider (WeakMap).
const MALZEME_KAYDI = new WeakMap();

function makeMats(palette) {
  const p = { ...CRAFT_PALETTE, ...(palette || {}) };
  const frame = cerceveRengi(p.panel);
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
// m: bu aracın malzeme kaydı — yerinde palet güncellemesi için saklanır.
function finalize(inner, kind, scale, m) {
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
  if (m) MALZEME_KAYDI.set(root, m);
  return root;
}

/* ------------------------------------------------------------------ */
/* Yerinde palet güncellemesi                                          */
/* ------------------------------------------------------------------ */
//
// Görünür araç YENİDEN KURULMAZ (webgl-scene-contract §2): palet değişiminde
// yalnız malzeme renkleri yerinde tazelenir. Sök-tak yolu tamamen ortadan
// kalkar — ne geometri dispose'u ne de tekrar üretim olur; türetilmiş
// çerçeve rengi de aynı kaynaktan (cerceveRengi) tazelenir.
//
//   applyCraftPalette(root, { body, panel, accent, metal }) → boolean
//   (root bu modülün kurucularından biriyle üretilmemişse false döner)
export function applyCraftPalette(root, palette) {
  const m = MALZEME_KAYDI.get(root);
  if (!m) return false;
  const p = { ...CRAFT_PALETTE, ...(palette || {}) };
  m.body.color.set(p.body);
  m.bodyFlat.color.set(p.body);
  m.panel.color.set(p.panel);
  m.frame.color.copy(cerceveRengi(p.panel));   // TÜRETİLMİŞ renk
  m.metal.color.set(p.metal);
  m.metalDS.color.set(p.metal);
  m.accent.color.set(p.accent);
  // m.dark palete bağlı değildir (sabit kaportalı boşluk rengi) — dokunulmaz.
  return true;
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

  return finalize(g, 'orbiter', scale, m);
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

  return finalize(g, 'lander', scale, m);
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

  return finalize(g, 'rocket', scale, m);
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

  return finalize(g, 'cubesat', scale, m);
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

  return finalize(g, 'capsule', scale, m);
}

/* ================================================================== */
/* Ortak parçalar — ikinci dalga                                      */
/* ================================================================== */

// Tekerlek: silindir + çevresinde radyal ÇITALAR (grouser).
// Çıtalar süs değil: gevşek regolitte tekerlek bir tırtıl gibi kazır,
// düz bir jant kayar. Gezgin tekerleklerinde bu yüzden kesme yönünde
// dişler vardır ve iz üstünde ayrık damgalar bırakırlar.
function tekerlek(m, { r = 0.13, w = 0.10, cita = 18 } = {}) {
  const g = new THREE.Group();
  const jant = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 26), m.metal);
  jant.rotation.x = Math.PI / 2;
  g.add(jant);
  const cg = new THREE.BoxGeometry(0.012, w * 0.94, 0.018);
  for (let i = 0; i < cita; i++) {
    const a = (i * 2 * Math.PI) / cita;
    const c = new THREE.Mesh(cg, m.frame);
    c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    c.rotation.y = -a;
    g.add(c);
  }
  const gobek = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.34, r * 0.34, w * 1.1, 16), m.body);
  gobek.rotation.x = Math.PI / 2;
  g.add(gobek);
  return g;
}

// Kanatlı radyoizotop güç kaynağı (RTG): silindir + boyuna kanatlar.
// Kanatlar ısıyı UZAYA ışıma yoluyla atar; RTG çıkışının yalnız ~%6'sı
// elektriktir, kalanı atık ısıdır ve konveksiyon olmadığı için tek yol budur.
function rtg(m, { r = 0.052, len = 0.30, kanat = 8 } = {}) {
  const g = new THREE.Group();
  g.add(cylX(r, r, len, 20, m.metal));
  const kg = new THREE.BoxGeometry(len * 0.92, 0.006, r * 0.85);
  for (let i = 0; i < kanat; i++) {
    const a = (i * 2 * Math.PI) / kanat;
    const k = new THREE.Mesh(kg, m.frame);
    k.position.set(0, Math.sin(a) * r * 1.3, Math.cos(a) * r * 1.3);
    k.rotation.x = -a;
    g.add(k);
  }
  return g;
}

/**
 * Rotor: N kanatlı, burulmalı. Kanat kesiti ince bir plakadır — Mars'ta
 * Reynolds sayısı 10⁴ mertebesindedir ve o rejimde kalın profil işe yaramaz.
 * Tek geometri üretilip bütün kanatlarda paylaşılır.
 */
function rotorDisk(m, { R = 0.6, kanat = 2, kokVeter = 0.10, ucVeter = 0.06, burulma = 12 } = {}) {
  const g = new THREE.Group();
  const N = 8, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const rr = R * (0.14 + 0.86 * t);
    const c = kokVeter + (ucVeter - kokVeter) * t;
    const tw = ((burulma * (1 - t)) * Math.PI) / 180;      // kökte çok, uçta az
    const ct = Math.cos(tw), stw = Math.sin(tw);
    for (const s of [-0.5, 0.5]) {
      const dx = s * c;
      pos.push(dx * ct, rr, dx * stw);
    }
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: m.frame.color, roughness: 0.5,
    metalness: 0.3, side: THREE.DoubleSide });
  for (let i = 0; i < kanat; i++) {
    const b = new THREE.Mesh(geo, mat);
    b.rotation.z = (i * 2 * Math.PI) / kanat;
    g.add(b);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.05, 14), m.metal));
  return g;
}

/* ================================================================== */
/* 6) STARSHIP SINIFI — paslanmaz iki kademeli, gövde flapli            */
/* ================================================================== */
//
// Bu sınıfın iki alışılmadık kararı vardır ve ikisi de geometride görünür:
//
// 1. FLAPLER KANAT DEĞİLDİR. Araç atmosfere KARNI ÖNDE, paraşütçü gibi
//    girer: amaç kaldırma üretmek değil, en büyük sürüklemeyi üretip
//    enerjiyi yüksekte harcamaktır. Dört flap (2 ön küçük, 2 arka büyük)
//    bağımsız hareket ederek ağırlık merkezi etrafındaki momenti dengeler —
//    yani kanat gibi kaldırma değil, paraşütçünün kolları gibi DURUŞ
//    kontrolü yaparlar. Arka flaplerin büyük olması, motor kütlesinin
//    ağırlık merkezini arkaya çekmesindendir.
//
// 2. İKİ TÜR MOTOR. Deniz seviyesi çanları küçük genişleme oranlıdır
//    (atmosferde akım ayrılmasın diye), vakum çanları çok büyüktür — vakumda
//    genişleme oranı ne kadar büyükse özgül itki o kadar yüksektir.
export function buildStarship({ scale = 1, palette, booster = false } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const R = 0.20;

  // Ojiv burun (Lathe) + silindirik gövde
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new THREE.Vector2(R * Math.sqrt(Math.max(0, 1 - Math.pow(1 - t, 2.1))), 0.56 + t * 0.30));
  }
  prof.reverse();
  const burun = new THREE.Mesh(new THREE.LatheGeometry(prof, 44), m.body);
  burun.geometry.rotateZ(-Math.PI / 2);
  g.add(burun);
  const govde = cylX(R, R, 1.32, 44, m.body);
  govde.position.x = -0.10;
  g.add(govde);

  // Isıl koruma: RÜZGÂR ALTI yüzde altıgen seramik karo alanı. Yalnız BİR
  // yüz kaplıdır çünkü araç hep aynı yüzü akıma verir; öteki yüz çıplak
  // paslanmazdır ve ısıyı ışıyarak atar.
  const karo = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.015, R * 1.015, 1.36, 44, 1, true, Math.PI * 0.60, Math.PI * 0.80),
    m.panel);
  karo.geometry.rotateZ(-Math.PI / 2);
  karo.position.x = -0.10;
  karo.material.side = THREE.DoubleSide;
  g.add(karo);

  const flap = (len, w, kal) => {
    const f = new THREE.Group();
    f.add(box(len, w, kal, m.body));
    const kenar = box(len * 0.96, 0.012, kal * 1.5, m.frame);
    kenar.position.y = w / 2;
    f.add(kenar);
    return f;
  };
  for (const s of [1, -1]) {
    const on = flap(0.20, 0.17, 0.030);
    on.position.set(0.50, s * (R + 0.075), 0.06);
    on.rotation.x = s * -0.30;
    g.add(on);
    const arka = flap(0.30, 0.26, 0.036);
    arka.position.set(-0.58, s * (R + 0.115), 0.05);
    arka.rotation.x = s * -0.26;
    g.add(arka);
    const mn = cylX(0.030, 0.030, 0.10, 14, m.metal);
    mn.rotation.z = Math.PI / 2;
    mn.position.set(-0.58, s * (R + 0.01), 0.05);
    g.add(mn);
  }

  // Motorlar: 3 deniz seviyesi (içte, gimballi) + 3 vakum (dışta, sabit)
  const kic = -0.76;
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 6;
    const e = engineAssembly(m, { rThroat: 0.030, rExit: 0.052, len: 0.10, mountX: kic, ringR: 0.040 });
    e.position.set(0, Math.sin(a) * 0.055, Math.cos(a) * 0.055);
    g.add(e);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    const e = engineAssembly(m, { rThroat: 0.032, rExit: 0.088, len: 0.19, mountX: kic + 0.02, ringR: 0.050 });
    e.position.set(0, Math.sin(a) * 0.115, Math.cos(a) * 0.115);
    g.add(e);
  }
  const kicHalka = cylX(R, R * 0.97, 0.05, 44, m.metal);
  kicHalka.position.x = kic + 0.03;
  g.add(kicHalka);

  const hat = box(1.18, 0.026, 0.020, m.accent);
  hat.position.set(-0.10, 0, R * 0.99);
  g.add(hat);

  if (booster) {
    const BL = 1.9;
    const bg = cylX(R, R, BL, 44, m.body);
    bg.position.x = kic - 0.12 - BL / 2;
    g.add(bg);
    // Sıcak ayırma halkası: üst kademe motorlarını, alt kademe hâlâ
    // yanarken ateşlemeye izin veren delikli geçiş parçası.
    const sicak = cylX(R * 1.02, R * 1.02, 0.10, 44, m.frame, true);
    sicak.position.x = kic - 0.12;
    sicak.material.side = THREE.DoubleSide;
    g.add(sicak);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const izgara = box(0.11, 0.015, 0.13, m.metal);
      izgara.position.set(kic - 0.34, Math.sin(a) * (R + 0.055), Math.cos(a) * (R + 0.055));
      izgara.rotation.x = -a;
      g.add(izgara);
    }
    const bKic = kic - 0.12 - BL;
    for (const [n, rr, re] of [[3, 0.045, 0.030], [10, 0.105, 0.026], [20, 0.160, 0.024]]) {
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n;
        const e = engineAssembly(m, { rThroat: re * 0.6, rExit: re, len: 0.055, mountX: bKic, ringR: re * 1.2 });
        e.position.set(0, Math.sin(a) * rr, Math.cos(a) * rr);
        g.add(e);
      }
    }
  }

  const root = finalize(g, booster ? 'starship-stack' : 'starship', scale, m);
  root.userData.notes = {
    regime: booster ? 'tam yığın · tekrar kullanılabilir' : 'gemi kademesi',
    why: 'Flapler kanat değildir: araç karnı önde, paraşütçü gibi iner ve flapler kaldırma değil DURUŞ kontrolü yapar. İki tür motorun sebebi genişleme oranıdır — vakumda büyük çan yüksek özgül itki verir, atmosferde ise akım ayrılır.',
  };
  return root;
}

/* ================================================================== */
/* 7) GEZGİN — rocker-bogie süspansiyonlu altı tekerlekli               */
/* ================================================================== */
//
// ROCKER-BOGIE'DE YAY YOKTUR. Her yanda iki kollu bir mekanizma vardır:
// ROCKER (ön tekerlek + bogie ekseni) ve BOGIE (orta + arka tekerlek).
// Gövde, iki rockerın açısının ORTALAMASINI alan bir diferansiyele bağlıdır.
// Sonuç: bir tekerlek kendi çapına yakın bir kayaya tırmanırken diğer beşi
// yerde kalır ve gövde eğimin yarısı kadar döner. Yaylı süspansiyon bunu
// yapamaz — yay, yükü aktarırken tekerleği yerden keser.
//
// Tırmanma yeteneği tekerlek çapıyla ölçeklenir; gezgin tekerlekleri bu
// yüzden gövdeye göre orantısız büyüktür.
export function buildRover({ scale = 1, palette, arm = true } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  const kasa = box(0.86, 0.44, 0.26, m.body);
  kasa.position.set(0, 0, 0.04);
  g.add(kasa);
  const guverte = box(0.62, 0.40, 0.05, m.panel);
  guverte.position.set(0.06, 0, 0.19);
  guverte.rotation.y = -0.06;
  g.add(guverte);

  const wR = 0.135, wW = 0.095;
  const N = { rockerP: [0.02, -0.02], bogieP: [-0.22, -0.13],
              on: [0.44, -0.30], orta: [-0.07, -0.30], arka: [-0.44, -0.30] };
  for (const s of [1, -1]) {
    const Y = s * 0.245, Yw = s * 0.31;
    const P = (k) => V3(N[k][0], Y, N[k][1]);
    const Pw = (k) => V3(N[k][0], Yw, N[k][1]);
    g.add(strut(P('rockerP'), Pw('on'), 0.016, m.metal));
    g.add(strut(P('rockerP'), P('bogieP'), 0.016, m.metal));
    g.add(strut(P('bogieP'), Pw('orta'), 0.013, m.metal));
    g.add(strut(P('bogieP'), Pw('arka'), 0.013, m.metal));
    for (const k of ['on', 'orta', 'arka']) {
      const t = tekerlek(m, { r: wR, w: wW });
      t.position.copy(Pw(k));
      g.add(t);
    }
    for (const k of ['rockerP', 'bogieP']) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 14), m.frame);
      p.rotation.x = Math.PI / 2;
      p.position.copy(P(k));
      g.add(p);
    }
  }
  // Diferansiyel çubuğu: iki rockerı gövdenin ÜSTÜNDEN bağlar; gövdenin
  // eğimi bu çubuk sayesinde iki yanın ortalaması olur.
  const dif = box(0.03, 0.52, 0.03, m.metal);
  dif.position.set(0.02, 0, 0.21);
  g.add(dif);

  const direk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.42, 14), m.metal);
  direk.rotation.x = Math.PI / 2;
  direk.position.set(0.28, 0, 0.42);
  g.add(direk);
  const bas = box(0.16, 0.22, 0.10, m.body);
  bas.position.set(0.30, 0, 0.66);
  g.add(bas);
  for (const s of [1, -1]) {
    const lens = cylX(0.022, 0.026, 0.045, 14, m.dark);
    lens.position.set(0.39, s * 0.07, 0.66);
    g.add(lens);
  }
  const maske = box(0.02, 0.23, 0.11, m.accent);
  maske.position.set(0.393, 0, 0.66);
  g.add(maske);

  // RTG arkada ve YUKARI KANIK: kanıklık ısıyı gövdeden uzağa yöneltir ve
  // ışıma görüş açısını açar.
  const r = rtg(m, { r: 0.055, len: 0.30 });
  r.position.set(-0.56, 0, 0.20);
  r.rotation.y = -0.42;
  g.add(r);

  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.016, 6), m.panel);
  ant.position.set(-0.18, 0.14, 0.24);
  ant.rotation.set(Math.PI / 2.4, 0, 0.3);
  g.add(ant);

  if (arm) {
    const p0 = V3(0.42, -0.20, -0.05), p1 = V3(0.62, -0.24, -0.16), p2 = V3(0.50, -0.30, -0.30);
    g.add(strut(p0, p1, 0.020, m.metal));
    g.add(strut(p1, p2, 0.017, m.metal));
    const turet = box(0.10, 0.10, 0.08, m.body);
    turet.position.copy(p2);
    g.add(turet);
    for (const p of [p0, p1]) {
      const j = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), m.frame);
      j.position.copy(p);
      g.add(j);
    }
  }

  const root = finalize(g, 'rover', scale, m);
  root.userData.notes = {
    regime: 'yüzey gezgini · rocker-bogie',
    why: 'Yay yoktur: rocker ve bogie kolları, gövdeyi iki yanın ORTALAMASINDA tutan bir diferansiyele bağlıdır. Bir tekerlek kendi çapına yakın bir kayaya tırmanırken diğer beşi yerde kalır. Tırmanma yeteneği tekerlek çapıyla ölçeklendiği için tekerlekler gövdeye göre orantısız büyüktür.',
  };
  return root;
}

/* ================================================================== */
/* 8) MARS HELİKOPTERİ — eş eksenli, ters dönen çift rotor              */
/* ================================================================== */
//
// NEDEN ROTOR BU KADAR BÜYÜK VE HIZLI: itki ≈ ρ A (ΩR)² ile gider ve Mars
// yüzeyinde hava yoğunluğu Dünya'nınkinin ~%1,2'sidir. Aynı itkiyi üretmek
// için ya alanı ya uç hızını büyütmek gerekir — ikisi de yapılmıştır: rotor
// gövdeye göre devasa, devir ~2400 dev/dk. Ama uç hızı ses hızının altında
// kalmak ZORUNDA olduğu için bu iki büyütme birbirini sınırlar; aracın
// boyutunu belirleyen denge budur.
//
// EŞ EKSENLİ VE TERS DÖNEN: tek rotor gövdeye tepki torku uygular ve gövde
// ters yöne döner. Kuyruk rotoru koymak yerine iki rotoru ters çevirmek
// torku sıfırlar, üstelik kuyruk kolunun kütlesinden de kurtarır.
export function buildMarsHelicopter({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();
  const R = 0.58;

  g.add(box(0.20, 0.15, 0.17, m.body));
  const alt = box(0.16, 0.12, 0.05, m.panel);
  alt.position.z = -0.10;
  g.add(alt);

  const mil = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.020, 0.40, 12), m.metal);
  mil.position.z = 0.29;
  g.add(mil);
  const rotorAlt = rotorDisk(m, { R, kanat: 2, kokVeter: 0.085, ucVeter: 0.055, burulma: 14 });
  rotorAlt.position.z = 0.20;
  rotorAlt.name = 'rotorAlt';
  g.add(rotorAlt);
  const rotorUst = rotorDisk(m, { R, kanat: 2, kokVeter: 0.085, ucVeter: 0.055, burulma: 14 });
  rotorUst.position.z = 0.40;
  rotorUst.rotation.z = Math.PI / 2;
  rotorUst.name = 'rotorUst';
  g.add(rotorUst);

  // Güneş paneli EN ÜSTTE, rotorların üstünde: aşağıda olsaydı rotorların
  // gölgesi altında kalırdı.
  const gp = panelWing(0.19, 0.19, 3, 3, m, 0.012);
  gp.position.z = 0.50;
  g.add(gp);

  // Dört ayak: uzun ve ince; iniş enerjisini bükülerek yutarlar.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const ust = V3(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.09);
    const yer = V3(Math.cos(a) * 0.20, Math.sin(a) * 0.20, -0.38);
    g.add(strut(ust, yer, 0.007, m.metal, 8));
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), m.frame);
    pad.position.copy(yer);
    g.add(pad);
  }

  const kam = cylX(0.016, 0.018, 0.03, 12, m.accent);
  kam.position.set(0.10, 0, -0.03);
  g.add(kam);

  const root = finalize(g, 'marshelicopter', scale, m);
  root.userData.rotors = [rotorAlt, rotorUst];
  root.userData.notes = {
    regime: 'gezegen atmosferinde döner kanat · ~2400 dev/dk',
    why: 'İtki ≈ ρA(ΩR)²; Mars yüzeyinde ρ Dünya’nınkinin ~%1,2’si. Hem alan hem uç hızı büyütülmüştür, ama uç hızı ses hızının altında kalmak zorunda olduğu için ikisi birbirini sınırlar. Rotorlar ters döner: tepki torku kuyruk rotoru olmadan sıfırlanır.',
  };
  return root;
}

/* ================================================================== */
/* 9) DERİN UZAY SONDASI — büyük çanak, boomlar, RTG                    */
/* ================================================================== */
//
// Bu aracın bütün siluetini üç kısıt belirler:
//  · ÇANAK BÜYÜK olmalı — alınan güç 1/r² ile düşer, kazanç ise çanak
//    alanıyla artar. Milyarlarca kilometreden bit taşımanın tek yolu budur.
//  · RTG UZAKTA olmalı — nötron ve gama akısı bilim aletlerini kirletir;
//    bu yüzden ayrı bir boomun ucundadır.
//  · MANYETOMETRE DAHA DA UZAKTA olmalı — aracın kendi elektroniği ve RTG'si
//    manyetik alan üretir, ölçüm için yerel alandan kaçmak gerekir. Bu yüzden
//    sondalarda en uzun eleman genellikle manyetometre boomudur.
export function buildProbe({ scale = 1, palette } = {}) {
  const m = makeMats(palette);
  const g = new THREE.Group();

  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.20, 10), m.body);
  bus.rotation.z = Math.PI / 2;
  g.add(bus);
  const raf = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.02, 10), m.frame);
  raf.rotation.z = Math.PI / 2;
  raf.position.x = -0.11;
  g.add(raf);

  // Yüksek kazançlı çanak +Z'ye bakar (blok sözleşmesi: çanak tarafı +Z).
  const cn = dishMesh(0.40, 0.11, m.metalDS, 48);
  cn.rotation.x = -Math.PI / 2;
  cn.position.set(0.02, 0, 0.20);
  g.add(cn);
  const besleme = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.16, 12), m.metal);
  besleme.position.set(0.02, 0, 0.30);
  g.add(besleme);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    g.add(strut(V3(0.02 + Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.215),
                V3(0.02, 0, 0.355), 0.006, m.metal, 6));
  }
  const dusuk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 14, 1, true), m.metalDS);
  dusuk.rotation.z = Math.PI;
  dusuk.position.set(-0.05, 0, -0.20);
  g.add(dusuk);

  const rtgUc = V3(-0.05, -0.62, -0.05);
  g.add(strut(V3(-0.02, -0.16, -0.02), rtgUc, 0.014, m.metal));
  for (let i = 0; i < 3; i++) {
    const r = rtg(m, { r: 0.042, len: 0.20, kanat: 8 });
    r.rotation.z = Math.PI / 2;
    r.position.set(rtgUc.x, rtgUc.y - i * 0.21, rtgUc.z);
    g.add(r);
  }

  const magUc = V3(0.04, 1.05, 0.06);
  g.add(strut(V3(0.02, 0.16, 0.03), magUc, 0.008, m.frame, 8));
  for (const t of [0.45, 0.78, 1.0]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), m.panel);
    s.position.set(0.02 + (magUc.x - 0.02) * t, 0.16 + (magUc.y - 0.16) * t, 0.03 + (magUc.z - 0.03) * t);
    g.add(s);
  }

  const plat = box(0.16, 0.14, 0.10, m.body);
  plat.position.set(0.16, 0.20, -0.10);
  g.add(plat);
  for (const [dy, r0] of [[0.05, 0.020], [-0.03, 0.026]]) {
    const tup = cylX(r0, r0 * 1.1, 0.14, 12, m.dark);
    tup.position.set(0.26, 0.20 + dy, -0.10);
    g.add(tup);
  }
  const vurgu = box(0.015, 0.15, 0.11, m.accent);
  vurgu.position.set(0.335, 0.20, -0.10);
  g.add(vurgu);

  for (const s of [1, -1]) {
    const q = thrusterQuad(m, 0.9);
    q.position.set(-0.12, s * 0.17, 0.02);
    g.add(q);
  }

  const root = finalize(g, 'probe', scale, m);
  root.userData.notes = {
    regime: 'derin uzay sondası',
    why: 'Silueti üç kısıt belirler: alınan güç 1/r² düştüğü için çanak büyük olmalı; RTG’nin nötron ve gama akısı aletleri kirlettiği için ayrı bir boomun ucunda olmalı; manyetometre aracın kendi alanından kaçmak zorunda olduğu için en uzun eleman odur.',
  };
  return root;
}

/* ================================================================== */
/* Kayıt                                                               */
/* ================================================================== */

export const CRAFT_BUILDERS = Object.freeze({
  orbiter: buildOrbiter,
  lander: buildLander,
  rocket: buildRocket,
  cubesat: buildCubesat,
  capsule: buildCapsule,
  starship: buildStarship,
  rover: buildRover,
  marshelicopter: buildMarsHelicopter,
  probe: buildProbe,
});

export const CRAFT_LABELS = Object.freeze({
  orbiter: 'yörünge aracı', lander: 'iniş aracı', rocket: 'roket',
  cubesat: 'cubesat', capsule: 'kapsül', starship: 'starship sınıfı',
  rover: 'gezgin', marshelicopter: 'mars helikopteri', probe: 'derin uzay sondası',
});

/** İsimle kur; bilinmeyen ad basit bir yer tutucuya düşer. */
export function buildCraft(kind, opts = {}) {
  const fn = CRAFT_BUILDERS[kind];
  if (fn) return fn(opts);
  const m = makeMats(opts.palette);
  const g = new THREE.Group();
  g.add(box(1, 0.3, 0.3, m.body));
  return finalize(g, 'placeholder', opts.scale || 1, m);
}
